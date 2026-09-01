import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";
import { initializeApp, getApps, getApp, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp } from "firebase/app";
import { getFirestore as getClientFirestore, doc, setDoc, serverTimestamp as clientTimestamp } from "firebase/firestore";
import { readFileSync, mkdirSync, existsSync } from "fs";
import multer from "multer";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Load Firebase client config — env vars take priority (Vercel), file is the local dev fallback.
function loadFirebaseAppletConfig(): Record<string, string> {
  // 1. Env vars (production / Vercel)
  if (process.env.VITE_FIREBASE_PROJECT_ID) {
    return {
      apiKey:            process.env.VITE_FIREBASE_API_KEY            ?? "",
      authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN        ?? "",
      projectId:         process.env.VITE_FIREBASE_PROJECT_ID         ?? "",
      storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET     ?? "",
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
      appId:             process.env.VITE_FIREBASE_APP_ID             ?? "",
      firestoreDatabaseId: process.env.VITE_FIRESTORE_DATABASE_ID     ?? "",
    };
  }
  // 2. Local config file (git-ignored, for dev only)
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    console.error(
      "[server] firebase-applet-config.json not found and VITE_FIREBASE_PROJECT_ID is not set.\n" +
      "  • For local dev:  copy firebase-applet-config.json into the project root.\n" +
      "  • For production: set the VITE_FIREBASE_* environment variables."
    );
    process.exit(1);
  }
}
const firebaseAppletConfig = loadFirebaseAppletConfig();

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log("Starting server initialization...");

  // Initialize Firebase Admin
  let db: any;
  let auth: Auth;
  let clientDb: any;
  let initError: any = null;

  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    console.log(`Reading config from: ${configPath}`);
    const firebaseConfig = firebaseAppletConfig;
    
    const projectId = firebaseConfig.projectId;
    console.log(`Initializing Firebase Admin for project: ${projectId}`);
    
    let firebaseApp: App;
    
    if (getApps().length === 0) {
      // Explicitly set the project ID from the config
      firebaseApp = initializeApp({
        projectId: projectId,
      });
      console.log("Firebase Admin initialized successfully with projectId");
    } else {
      firebaseApp = getApp();
      console.log("Using existing Firebase Admin app");
    }
    
    auth = getAuth(firebaseApp);
    
    // Handle named database if present
    if (firebaseConfig.firestoreDatabaseId) {
      console.log(`Connecting to Firestore database: ${firebaseConfig.firestoreDatabaseId}`);
      db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    } else {
      db = getFirestore(firebaseApp);
    }

    // Initialize Client SDK on server as a fallback/alternative
    const clientApp = initializeClientApp(firebaseConfig);
    clientDb = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== firebaseConfig.projectId)
      ? getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId)
      : getClientFirestore(clientApp);
    
    console.log("Firebase Admin and Client services ready");
  } catch (error: any) {
    initError = error;
    console.error("CRITICAL: Firebase Admin initialization failed:", error);
  }

  const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;
  if (!stripe) console.warn("[server] STRIPE_SECRET_KEY not set — payment routes disabled");

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (!resend) console.warn("[server] RESEND_API_KEY not set — email routes disabled");

  app.use(cors());
  app.use(express.json());
  app.use("/uploads", express.static(uploadsDir));

  // Health check route - MUST be before any other routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Admin middleware
  const verifyAdmin = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid authorization header" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      if (!auth || !db) {
        console.error("verifyAdmin: Firebase Admin services not initialized. Error:", initError?.message);
        return res.status(500).json({ 
          error: "Server error: Firebase Admin not initialized",
          details: initError?.message || "Unknown initialization error"
        });
      }
      
      console.log("verifyAdmin: Verifying ID token...");
      let decodedToken;
      try {
        decodedToken = await auth.verifyIdToken(idToken);
      } catch (authError: any) {
        console.error("verifyAdmin: Token verification failed:", authError.message);
        return res.status(401).json({ error: `Invalid token: ${authError.message}` });
      }

      console.log(`verifyAdmin: Decoded token for UID: ${decodedToken.uid}, Email: ${decodedToken.email}`);
      
      // Admin email from environment (set ADMIN_EMAIL in your .env / Vercel dashboard)
      const isAdminEmail = process.env.ADMIN_EMAIL
        ? decodedToken.email === process.env.ADMIN_EMAIL
        : false;
      
      if (isAdminEmail) {
        console.log(`verifyAdmin: Access granted to primary admin email: ${decodedToken.email}`);
        req.user = decodedToken;
        return next();
      }

      // If not primary admin, check Firestore for role
      try {
        const userDoc = await db.collection("users").doc(decodedToken.uid).get();
        const userData = userDoc.data();
        const hasAdminRole = userData?.role === "ADMIN";

        if (!hasAdminRole) {
          console.warn(`verifyAdmin: User ${decodedToken.uid} (${decodedToken.email}) is not an admin. Role: ${userData?.role}`);
          return res.status(403).json({ error: "Forbidden: Admin access required" });
        }

        console.log(`verifyAdmin: Access granted to ${decodedToken.email} (HasAdminRole: ${hasAdminRole})`);
        req.user = decodedToken;
        next();
      } catch (dbError: any) {
        console.error("verifyAdmin: Firestore read error:", dbError.message);
        return res.status(500).json({ error: `Database error during verification: ${dbError.message}` });
      }
    } catch (error: any) {
      console.error("verifyAdmin: Unexpected error:", error.message);
      res.status(500).json({ error: `Unexpected server error: ${error.message}` });
    }
  };

  // Stripe webhook — must use raw body, registered BEFORE express.json()
  app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
    if (!stripe) return res.status(503).json({ error: "Stripe not configured" });
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      // Refuse rather than trust an unverified body — see api/stripe-webhook.ts.
      console.error("[Webhook] STRIPE_WEBHOOK_SECRET not set — refusing to process unverified events");
      return res.status(503).json({ error: "Webhook not configured: STRIPE_WEBHOOK_SECRET missing" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
    } catch (err: any) {
      console.error("[Webhook] Signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { courseId, userId } = session.metadata || {};

      if (courseId && userId && session.payment_status === "paid") {
        try {
          const enrollmentId = `${userId}_${courseId}`;
          await db.collection("enrollments").doc(enrollmentId).set({
            userId,
            courseId,
            status: "ENROLLED",
            enrolledAt: FieldValue.serverTimestamp(),
            progress: 0,
            paymentId: session.id,
          }, { merge: true });
          console.log(`[Webhook] Enrollment created for user ${userId}, course ${courseId}`);
        } catch (err: any) {
          console.error("[Webhook] Failed to create enrollment:", err.message);
        }
      }
    }

    res.json({ received: true });
  });

  // API routes
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { courseId, userId } = req.body;

      if (!stripe) {
        return res.status(503).json({ error: "Stripe not configured — set STRIPE_SECRET_KEY" });
      }
      if (!db) {
        return res.status(500).json({ error: "Firebase Admin not initialized" });
      }
      if (!courseId || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Price and title come from Firestore, never from the client — trusting
      // a client-supplied price would let anyone check out for any amount.
      const courseSnap = await db.collection("courses").doc(courseId).get();
      if (!courseSnap.exists) {
        return res.status(404).json({ error: "Course not found" });
      }
      const course = courseSnap.data();

      if (course.isFree) {
        return res.status(400).json({ error: "This course is free — enroll directly, no checkout needed" });
      }

      const price = Number(course.price);
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(500).json({ error: "Course does not have a valid price configured" });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: course.title || "Course",
              },
              unit_amount: Math.round(price * 100), // Stripe expects cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.headers.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&courseId=${courseId}`,
        cancel_url: `${req.headers.origin}/course/${courseId}`,
        metadata: {
          courseId,
          userId,
        },
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error("Stripe error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Confirms payment with Stripe directly and writes the enrollment via the
  // Admin SDK. Mirrors api/verify-enrollment.ts — the client is never
  // trusted to say "I paid".
  app.post("/api/verify-enrollment", async (req, res) => {
    try {
      if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
      if (!auth || !db) return res.status(500).json({ error: "Firebase Admin not initialized" });

      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: missing Bearer token" });
      }

      let decodedToken;
      try {
        decodedToken = await auth.verifyIdToken(authHeader.split("Bearer ")[1]);
      } catch (err: any) {
        return res.status(401).json({ error: `Invalid token: ${err.message}` });
      }

      const { sessionId } = req.body || {};
      if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") {
        return res.status(402).json({ error: "Payment not completed" });
      }

      const { courseId, userId } = session.metadata || {};
      if (!courseId || !userId) {
        return res.status(400).json({ error: "Session is missing courseId/userId metadata" });
      }
      if (userId !== decodedToken.uid) {
        return res.status(403).json({ error: "This checkout session does not belong to you" });
      }

      const enrollmentId = `${userId}_${courseId}`;
      await db.collection("enrollments").doc(enrollmentId).set(
        {
          userId,
          courseId,
          status: "ENROLLED",
          enrolledAt: FieldValue.serverTimestamp(),
          progress: 0,
          paymentId: session.id,
        },
        { merge: true }
      );

      res.json({ success: true, courseId, status: "ENROLLED" });
    } catch (error: any) {
      console.error("[verify-enrollment] error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Consolidated admin dispatch — mirrors api/admin.ts's `?resource=` query
  // param routing exactly. AdminDashboard.tsx only ever calls
  // `/api/admin?resource=...`; the previous per-route Express endpoints here
  // (`/api/admin/users`, `/api/admin/create-user`, etc.) used a different URL
  // shape the frontend never actually requested, so every admin action was
  // silently broken in local dev. Also fills in sync-courses/sync-users,
  // which existed in production but had no local-dev equivalent at all.
  app.all("/api/admin", verifyAdmin, upload.single("file"), async (req, res) => {
    const resource = req.query.resource as string;
    try {
      if (!auth || !db) {
        return res.status(500).json({ error: "Firebase Admin not initialized" });
      }

      if (req.method === "GET" && resource === "users") {
        const snapshot = await db.collection("users").get();
        return res.json(snapshot.docs.map((d: any) => ({ uid: d.id, ...d.data() })));
      }

      if (req.method === "POST" && resource === "create-user") {
        const { email, password, displayName, role = "STUDENT" } = req.body;
        if (!email || !password || !displayName) {
          return res.status(400).json({ error: "email, password and displayName are required" });
        }
        const allowedRoles = ["ADMIN", "INSTRUCTOR", "STUDENT"];
        if (!allowedRoles.includes(role)) {
          return res.status(400).json({ error: `role must be one of ${allowedRoles.join(", ")}` });
        }
        const userRecord = await auth.createUser({ email, password, displayName });
        await db.collection("users").doc(userRecord.uid).set({
          uid: userRecord.uid, email, displayName, role,
          createdAt: FieldValue.serverTimestamp(),
        });
        return res.json({ uid: userRecord.uid });
      }

      if (req.method === "POST" && resource === "update-user-role") {
        const { uid, role } = req.body;
        if (!uid || !role) return res.status(400).json({ error: "uid and role are required" });
        const allowedRoles = ["ADMIN", "INSTRUCTOR", "STUDENT"];
        if (!allowedRoles.includes(role)) {
          return res.status(400).json({ error: `role must be one of ${allowedRoles.join(", ")}` });
        }
        await db.collection("users").doc(uid).update({ role });
        return res.json({ success: true });
      }

      if (req.method === "DELETE" && resource === "delete-user") {
        const uid = req.query.uid as string;
        if (!uid) return res.status(400).json({ error: "uid query param is required" });
        try {
          await auth.deleteUser(uid);
        } catch (e: any) {
          if (e.code !== "auth/user-not-found") console.error("[admin] Auth delete failed:", e.message);
        }
        await db.collection("users").doc(uid).delete();
        return res.json({ success: true });
      }

      if (req.method === "POST" && resource === "upload") {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
        return res.json({ url: fileUrl, filename: req.file.filename });
      }

      if (req.method === "POST" && resource === "sync-courses") {
        const { courses: courseList } = req.body;
        if (!Array.isArray(courseList) || courseList.length === 0) {
          return res.status(400).json({ error: "courses array is required" });
        }
        let synced = 0;
        const errors: string[] = [];
        for (const course of courseList) {
          if (!course.id) { errors.push(`Course missing id: ${course.title}`); continue; }
          try {
            await db.collection("courses").doc(course.id).set(
              { ...course, updatedAt: FieldValue.serverTimestamp() },
              { merge: true }
            );
            synced++;
          } catch (e: any) {
            errors.push(`${course.id}: ${e.message}`);
          }
        }
        return res.json({ success: true, synced, errors: errors.length > 0 ? errors : undefined });
      }

      if (req.method === "POST" && resource === "sync-users") {
        const adminEmail = process.env.ADMIN_EMAIL ?? "";
        const created: string[] = [];
        const skipped: string[] = [];
        const errors: string[] = [];
        let nextPageToken: string | undefined;
        do {
          const result = await auth.listUsers(1000, nextPageToken);
          nextPageToken = result.pageToken;
          for (const u of result.users) {
            try {
              const docRef = db.collection("users").doc(u.uid);
              if ((await docRef.get()).exists) { skipped.push(u.uid); continue; }
              await docRef.set({
                uid: u.uid,
                email: u.email ?? "",
                displayName: u.displayName ?? u.email?.split("@")[0] ?? "User",
                role: adminEmail && u.email === adminEmail ? "ADMIN" : "STUDENT",
                createdAt: u.metadata.creationTime ? new Date(u.metadata.creationTime) : FieldValue.serverTimestamp(),
                lastLogin: u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime) : null,
                provider: u.providerData?.[0]?.providerId ?? "password",
                photoURL: u.photoURL ?? null,
              });
              created.push(u.email ?? u.uid);
            } catch (e: any) {
              errors.push(`${u.email ?? u.uid}: ${e.message}`);
            }
          }
        } while (nextPageToken);
        return res.json({
          success: true,
          created: created.length,
          skipped: skipped.length,
          errors: errors.length > 0 ? errors : undefined,
          createdUsers: created,
        });
      }

      return res.status(404).json({ error: `Unknown admin resource: "${resource}"` });
    } catch (err: any) {
      console.error(`[admin] ${resource} error:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log(`API: login request for email: ${email}`);

      if (!auth) {
        throw new Error("Auth service not initialized");
      }

      const firebaseConfig = firebaseAppletConfig;

      // Use REST API to verify password (since Admin SDK doesn't have a direct signIn)
      const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`;
      const response = await fetch(signInUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Auth REST Login Error:", data);
        return res.status(response.status).json({ error: data.error?.message || "Login failed" });
      }

      // Generate a custom token for the client to use with signInWithCustomToken
      // This bypasses network issues with the standard login flow
      const customToken = await auth.createCustomToken(data.localId);
      
      res.json({ customToken, uid: data.localId });
    } catch (error: any) {
      console.error("API: login error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const EMAIL_MAX_SUBJECT = 200;
  const EMAIL_MAX_BODY = 20000;
  const EMAIL_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
  const EMAIL_RATE_LIMIT_MAX = 5;

  // Mirrors api/send-email.ts: 'self' emails always go to the authenticated
  // caller's own verified address; 'public' emails (contact form, lead
  // magnet) allow an arbitrary address but are validated and rate-limited
  // by IP so this endpoint can't be scripted into a bulk spam relay.
  async function checkEmailRateLimit(key: string): Promise<boolean> {
    const ref = db.collection("emailRateLimits").doc(key);
    const now = Date.now();
    return db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : null;
      if (!data || now - data.windowStart > EMAIL_RATE_LIMIT_WINDOW_MS) {
        tx.set(ref, { count: 1, windowStart: now });
        return true;
      }
      if (data.count >= EMAIL_RATE_LIMIT_MAX) return false;
      tx.set(ref, { count: data.count + 1, windowStart: data.windowStart });
      return true;
    });
  }

  app.post("/api/send-email", async (req, res) => {
    try {
      if (!resend) {
        console.warn("[Email] RESEND_API_KEY not configured — skipping");
        return res.status(200).json({ status: "skipped", message: "Email service not configured" });
      }

      const { context, to, subject, text, html } = req.body;
      if (!subject || !text) {
        return res.status(400).json({ error: "Missing required fields: subject, text" });
      }
      if (subject.length > EMAIL_MAX_SUBJECT || text.length > EMAIL_MAX_BODY || (html && html.length > EMAIL_MAX_BODY)) {
        return res.status(400).json({ error: "subject/text/html exceeds allowed length" });
      }

      let recipient: string;

      if (context === "self") {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return res.status(401).json({ error: "Unauthorized: missing Bearer token" });
        }
        if (!auth) return res.status(500).json({ error: "Firebase Admin not initialized" });
        let decoded;
        try {
          decoded = await auth.verifyIdToken(authHeader.split("Bearer ")[1]);
        } catch (err: any) {
          return res.status(401).json({ error: `Invalid token: ${err.message}` });
        }
        if (!decoded.email) return res.status(400).json({ error: "Account has no email address" });
        recipient = decoded.email;
      } else if (context === "public") {
        if (typeof to !== "string" || to.length >= 320 || !EMAIL_RE.test(to)) {
          return res.status(400).json({ error: "A valid `to` address is required" });
        }
        if (!db) return res.status(500).json({ error: "Firebase Admin not initialized" });
        const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() || req.ip || "unknown";
        const allowed = await checkEmailRateLimit(ip);
        if (!allowed) {
          return res.status(429).json({ error: "Too many requests — please try again later" });
        }
        recipient = to;
      } else {
        return res.status(400).json({ error: "context must be 'self' or 'public'" });
      }

      const fromEmail = process.env.RESEND_FROM_EMAIL || "info@mylearninglaunchpad.com";

      const { data, error } = await resend.emails.send({ from: fromEmail, to: recipient, subject, text, html });

      if (error) {
        console.error("[Email] Resend error:", error);
        return res.status(500).json({ error: error.message });
      }

      console.log(`[Email] Sent to ${recipient}: ${subject} (id: ${data?.id})`);
      res.json({ status: "success", id: data?.id });
    } catch (error: any) {
      console.error("[Email] Unexpected error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite middleware...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware initialized");
    } catch (error) {
      console.error("Failed to initialize Vite middleware:", error);
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  try {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
}

startServer().catch((error) => {
  console.error("Fatal error during server startup:", error);
});
