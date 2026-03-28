import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import cors from "cors";
import dotenv from "dotenv";
import sgMail from "@sendgrid/mail";
import admin from "firebase-admin";
import fs from "fs";

dotenv.config();

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

const db = admin.firestore(firebaseConfig.firestoreDatabaseId);
const auth = admin.auth();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Admin middleware
  const verifyAdmin = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      const userDoc = await db.collection("users").doc(decodedToken.uid).get();
      const userData = userDoc.data();

      if (userData?.role !== "ADMIN") {
        return res.status(403).json({ error: "Forbidden: Admin access required" });
      }

      req.user = decodedToken;
      next();
    } catch (error) {
      console.error("Auth error:", error);
      res.status(401).json({ error: "Invalid token" });
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

      res.json({ id: session.id });
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

      const userRecord = await auth.createUser({
        email,
        password,
        displayName,
      });

      await db.collection("users").doc(userRecord.uid).set({
        email,
        displayName,
        role: role || "STUDENT",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ uid: userRecord.uid });
    } catch (error: any) {
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
      const { to, subject, text, html } = req.body;

      if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
        console.warn("SendGrid not configured. Email not sent.");
        return res.status(200).json({ status: "skipped", message: "SendGrid not configured" });
      }

      const msg = {
        to,
        from: process.env.SENDGRID_FROM_EMAIL,
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
