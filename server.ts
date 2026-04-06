import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import cors from "cors";
import dotenv from "dotenv";
import sgMail from "@sendgrid/mail";
import { initializeApp, getApps, getApp, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log("Starting server initialization...");

  // Initialize Firebase Admin
  let db: any;
  let auth: Auth;
  let initError: any = null;

  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    console.log(`Reading config from: ${configPath}`);
    const firebaseConfig = JSON.parse(readFileSync(configPath, "utf-8"));
    
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
    
    console.log("Firebase Admin services (Auth & Firestore) ready");
  } catch (error: any) {
    initError = error;
    console.error("CRITICAL: Firebase Admin initialization failed:", error);
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

  if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }

  app.use(cors());
  app.use(express.json());

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
      
      // Hardcoded admin email check to match firestore.rules
      const isAdminEmail = decodedToken.email === "ekpe.okorafor@gmail.com";
      
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

  // API routes
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { courseId, courseName, price, userId } = req.body;

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: "Stripe secret key not configured" });
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
      
      if (!auth || !db) {
        throw new Error("Firebase Admin services not initialized");
      }

      console.log("API: Creating auth record...");
      const userRecord = await auth.createUser({
        email,
        password,
        displayName,
      });
      console.log(`API: Auth record created with UID: ${userRecord.uid}`);

      console.log("API: Creating Firestore record...");
      await db.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        displayName,
        role: role || "STUDENT",
        createdAt: FieldValue.serverTimestamp(),
      });
      console.log("API: Firestore record created successfully");

      res.json({ uid: userRecord.uid });
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
      await auth.deleteUser(uid);
      await db.collection("users").doc(uid).delete();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, text, html, from } = req.body;

      if (!process.env.SENDGRID_API_KEY) {
        console.warn("SendGrid API key not configured. Email not sent.");
        return res.status(200).json({ status: "skipped", message: "SendGrid API key not configured" });
      }

      const fromEmail = from || process.env.SENDGRID_FROM_EMAIL;
      if (!fromEmail) {
        console.warn("SendGrid 'from' email not configured. Email not sent.");
        return res.status(200).json({ status: "skipped", message: "SendGrid 'from' email not configured" });
      }

      const msg = {
        to,
        from: fromEmail,
        subject,
        text,
        html,
      };

      await sgMail.send(msg);
      res.json({ status: "success" });
    } catch (error: any) {
      console.error("SendGrid error:", error);
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
