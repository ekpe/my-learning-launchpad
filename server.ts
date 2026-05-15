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
      console.warn("[Webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification");
      return res.json({ received: true });
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
      const { courseId, courseName, price, userId } = req.body;

      if (!stripe) {
        return res.status(503).json({ error: "Stripe not configured — set STRIPE_SECRET_KEY" });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: courseName,
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

  app.get("/api/checkout-session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/upload", verifyAdmin, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
      res.json({ url: fileUrl, filename: req.file.filename });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // User Management
  app.get("/api/admin/users", verifyAdmin, async (req, res) => {
    try {
      const usersSnapshot = await db.collection("users").get();
      const users = usersSnapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      }));
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/create-user", verifyAdmin, async (req, res) => {
    try {
      const { email, password, displayName, role } = req.body;
      console.log(`API: create-user request for ${email}, role: ${role}`);
      
      if (!db) {
        throw new Error("Firestore service not initialized");
      }

      const firebaseConfig = firebaseAppletConfig;
      const apiKey = firebaseConfig.apiKey;

      console.log("API: Creating user via REST API...");
      const restResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName,
          returnSecureToken: true
        })
      });

      const restData: any = await restResponse.json();

      if (!restResponse.ok) {
        console.error("REST API Error:", restData);
        throw new Error(restData.error?.message || "Failed to create user via REST API");
      }

      const uid = restData.localId;
      console.log(`API: User created with UID: ${uid}`);

      // Helper to convert to Firestore REST format
      const toFirestoreValue = (val: any): any => {
        if (typeof val === 'string') return { stringValue: val };
        if (typeof val === 'number') return { doubleValue: val };
        if (typeof val === 'boolean') return { booleanValue: val };
        if (val === null) return { nullValue: null };
        if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
        if (typeof val === 'object') {
          if (val._seconds !== undefined) return { timestampValue: new Date(val._seconds * 1000).toISOString() };
          return { mapValue: { fields: Object.fromEntries(Object.entries(val).map(([k, v]) => [k, toFirestoreValue(v)])) } };
        }
        return { stringValue: String(val) };
      };

      console.log("API: Creating Firestore record via REST API with Admin Token...");
      try {
        const firestoreData = {
          fields: {
            uid: { stringValue: uid },
            email: { stringValue: email },
            displayName: { stringValue: displayName },
            role: { stringValue: role || "STUDENT" },
            createdAt: { timestampValue: new Date().toISOString() }
          }
        };

        const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${dbId}/documents/users/${uid}?updateMask.fieldPaths=uid&updateMask.fieldPaths=email&updateMask.fieldPaths=displayName&updateMask.fieldPaths=role&updateMask.fieldPaths=createdAt`;
        
        const fsResponse = await fetch(firestoreUrl, {
          method: 'PATCH', // Use PATCH to create or update
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': req.headers.authorization || ''
          },
          body: JSON.stringify(firestoreData)
        });

        if (!fsResponse.ok) {
          const fsError = await fsResponse.json();
          console.error("Firestore REST Error:", fsError);
          throw new Error(fsError.error?.message || "Failed to create Firestore record via REST API");
        }

        console.log("API: Firestore record created successfully via REST API");
      } catch (fsError: any) {
        console.error("API: Firestore REST error:", fsError.message);
        throw fsError;
      }

      res.json({ uid });
    } catch (error: any) {
      console.error("API: create-user error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/update-user-role", verifyAdmin, async (req, res) => {
    try {
      const { uid, role } = req.body;
      await db.collection("users").doc(uid).update({ role });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/users/:uid", verifyAdmin, async (req, res) => {
    try {
      const { uid } = req.params;
      console.log(`API: delete-user request for UID: ${uid}`);

      if (!auth) {
        throw new Error("Auth service not initialized");
      }

      // 1. Delete from Firebase Auth
      console.log("API: Deleting user from Firebase Auth...");
      try {
        await auth.deleteUser(uid);
        console.log("API: User deleted from Firebase Auth");
      } catch (authError: any) {
        console.error("API: Firebase Auth Delete Error:", authError.message);
        
        const isApiDisabledError = authError.message.includes('Identity Toolkit API') || 
                                  authError.message.includes('148520817040') ||
                                  authError.code === 'auth/internal-error';
        
        const isPermissionError = authError.code === 'auth/insufficient-permission' || 
                                 authError.message.includes('permission');

        if (isApiDisabledError || isPermissionError) {
          console.warn("API: Auth delete failed due to API/Permission issues, proceeding to Firestore delete anyway...");
        } else if (authError.code !== 'auth/user-not-found') {
          throw authError;
        }
      }

      // 2. Delete from Firestore using REST API
      console.log("API: Deleting Firestore record via REST API...");
      const firebaseConfig = firebaseAppletConfig;
      const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${dbId}/documents/users/${uid}`;
      
      const fsResponse = await fetch(firestoreUrl, {
        method: 'DELETE',
        headers: { 
          'Authorization': req.headers.authorization || ''
        }
      });

      if (!fsResponse.ok) {
        const fsError = await fsResponse.json();
        console.error("Firestore REST Delete Error:", fsError);
        // If document doesn't exist, we can consider it a success for deletion purposes
        if (fsResponse.status !== 404) {
          throw new Error(fsError.error?.message || "Failed to delete Firestore record via REST API");
        }
      }

      console.log("API: Firestore record deleted successfully");
      res.json({ success: true });
    } catch (error: any) {
      console.error("API: delete-user error:", error);
      res.status(500).json({ error: error.message });
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

  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, text, html, from } = req.body;

      if (!resend) {
        console.warn("[Email] RESEND_API_KEY not configured — skipping");
        return res.status(200).json({ status: "skipped", message: "Email service not configured" });
      }

      const fromEmail = from || process.env.RESEND_FROM_EMAIL || "info@mylearninglaunchpad.com";

      const { data, error } = await resend.emails.send({ from: fromEmail, to, subject, text, html });

      if (error) {
        console.error("[Email] Resend error:", error);
        return res.status(500).json({ error: error.message });
      }

      console.log(`[Email] Sent to ${to}: ${subject} (id: ${data?.id})`);
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
