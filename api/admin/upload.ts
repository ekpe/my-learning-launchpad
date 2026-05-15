import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withAdmin } from "../_lib/with-admin";
import { handleOptions } from "../_lib/cors";
import { getAdminApp } from "../_lib/firebase-admin";
import { getStorage } from "firebase-admin/storage";
import { v4 as uuidv4 } from "uuid";

export const config = { api: { bodyParser: false } };

async function getRawBody(req: VercelRequest): Promise<{ data: Buffer; mimeType: string; originalName: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let mimeType = "application/octet-stream";
    let originalName = "upload";

    // Parse multipart/form-data boundary
    const contentType = req.headers["content-type"] || "";
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) return reject(new Error("No multipart boundary found"));

    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("binary");
      const boundary = "--" + boundaryMatch[1];
      const parts = body.split(boundary).slice(1, -1);

      for (const part of parts) {
        const [headerSection, ...bodyParts] = part.split("\r\n\r\n");
        const headers = headerSection.toLowerCase();
        if (headers.includes('name="file"')) {
          const nameMatch = headerSection.match(/filename="([^"]+)"/i);
          if (nameMatch) originalName = nameMatch[1];
          const ctMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);
          if (ctMatch) mimeType = ctMatch[1].trim();
          const fileData = bodyParts.join("\r\n\r\n").replace(/\r\n$/, "");
          resolve({ data: Buffer.from(fileData, "binary"), mimeType, originalName });
          return;
        }
      }
      reject(new Error("No file field found in multipart body"));
    });
    req.on("error", reject);
  });
}

export default withAdmin(async (req: VercelRequest, res: VercelResponse) => {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!storageBucket) {
    return res.status(500).json({ error: "FIREBASE_STORAGE_BUCKET not configured" });
  }

  try {
    const { data, mimeType, originalName } = await getRawBody(req);
    const fileId = `${Date.now()}-${uuidv4()}`;
    const ext = originalName.split(".").pop() || "bin";
    const filePath = `uploads/${fileId}.${ext}`;

    const bucket = getStorage(getAdminApp()).bucket(storageBucket);
    const file = bucket.file(filePath);

    await file.save(data, { contentType: mimeType, resumable: false });
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${storageBucket}/${filePath}`;
    res.json({ url: publicUrl, filename: `${fileId}.${ext}` });
  } catch (err: any) {
    console.error("[Admin] upload error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
