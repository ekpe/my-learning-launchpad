/**
 * LOCAL signed-in test harness (NOT shipped, never touches Firebase or any real data).
 *
 *   npx tsx tests/helpers/e2e-server.ts            # API + fake Firestore/Auth on :3100
 *   (the browser side is tests/e2e-fake/vite.config.mts, which swaps firebase/* for HTTP shims)
 *
 * What it is: one in-memory database shared by every browser tab, so two tabs behave like two devices.
 * It serves (a) the REAL admin handlers from api/_lib/course-admin.ts and (b) a small model of firestore.rules
 * so UI error paths and learner isolation can be exercised.
 *
 * What it is NOT: the real security rules. The model below is a hand-written copy; it cannot prove
 * firestore.rules is correct (that needs the Firestore emulator, which needs JDK 21+).
 *
 * Debug:  GET /__debug/state   POST /__reset?scenario=published|prelaunch   GET /__debug/mail
 */
import express from "express";
import { readFileSync } from "node:fs";
import { createFakeDb } from "./fake-firestore.ts";

process.env.FIREBASE_PROJECT_ID = "e2e-harness";

const { handleCourseAdminOp, syncCourseList } = await import("../../api/_lib/course-admin.ts");
const { courses } = await import("../../src/data/courses.ts");

// ── accounts (local fake only) ───────────────────────────────────────────────
const PASSWORD = "e2e-local-only-1";
const ACCOUNTS: Record<string, { email: string; displayName: string; role: "ADMIN" | "STUDENT" }> = {
  admin1: { email: "admin@e2e.test", displayName: "E2E Admin", role: "ADMIN" },
  learner1: { email: "learner@e2e.test", displayName: "Lena Learner", role: "STUDENT" },
  legacy1: { email: "legacy@e2e.test", displayName: "Leo Legacy", role: "STUDENT" },
  partial1: { email: "partial@e2e.test", displayName: "Pia Partial", role: "STUDENT" },
  other1: { email: "other@e2e.test", displayName: "Otto Other", role: "STUDENT" },
};
const extraAccounts = new Map<string, { email: string; displayName: string; password: string }>();

// ── store ────────────────────────────────────────────────────────────────────
let db = createFakeDb();
const versions = new Map<string, number>();
const mail: any[] = [];
const FID = "ai-strategy-leaders";
const ts = (ms = Date.now()) => ({ toDate: () => new Date(ms) });
const bump = (col: string, id: string) => versions.set(`${col}/${id}`, (versions.get(`${col}/${id}`) ?? 0) + 1);
const ver = (col: string, id: string) => versions.get(`${col}/${id}`) ?? 0;

const staticFlagship = courses.find((c) => c.id === FID)!;
const liveV1 = JSON.parse(readFileSync(new URL("../../docs/archive/ai-strategy-leaders.live-firestore-2026-10-14.json", import.meta.url), "utf8"));

function seed(scenario: string) {
  db = createFakeDb();
  versions.clear();
  mail.length = 0;
  for (const [uid, a] of Object.entries(ACCOUNTS)) db.seed("users", uid, { uid, email: a.email, displayName: a.displayName, role: a.role, createdAt: ts() });

  if (scenario === "published") {
    // Live flagship = the 90-minute v2, already published (lesson media still empty: "Video in production").
    db.seed("courses", FID, { ...JSON.parse(JSON.stringify(staticFlagship)), publishedAt: ts() });
  } else {
    // Production-like: the live record is still version 1 (the real backup), v2 exists only as source.
    db.seed("courses", FID, JSON.parse(JSON.stringify(liveV1)));
  }

  // legacy1: finished the ORIGINAL course (unstamped = version 1) and holds a certificate.
  const allV1: string[] = [];
  const sizes = [4, 5, 5, 5, 5, 5, 6];
  sizes.forEach((n, m) => { for (let l = 0; l < n; l++) allV1.push(`${m}_${l}`); });
  db.seed("enrollments", `legacy1_${FID}`, { userId: "legacy1", courseId: FID, status: "COMPLETED", enrolledAt: ts(Date.now() - 40 * 86400000), progress: 100, completedLessons: allV1 });
  db.seed("certificates", `CERT_legacy1_${FID}`, { userId: "legacy1", courseId: FID, courseTitle: "AI Strategy for Leaders", userName: "Leo Legacy", issuedAt: ts(Date.now() - 30 * 86400000), certificateId: `CERT_legacy1_${FID}` });
  // partial1: part-way through the original course.
  db.seed("enrollments", `partial1_${FID}`, { userId: "partial1", courseId: FID, status: "IN_PROGRESS", enrolledAt: ts(Date.now() - 10 * 86400000), progress: 11, completedLessons: ["0_0", "0_1", "0_2", "0_3"] });
  // Synthetic extras so a migration dry run has something to count.
  for (let i = 0; i < 4; i++) db.seed("enrollments", `syn${i}_${FID}`, { userId: `syn${i}`, courseId: FID, status: i === 0 ? "COMPLETED" : "IN_PROGRESS", enrolledAt: ts(), progress: i === 0 ? 100 : 5, completedLessons: i === 0 ? allV1 : ["0_0", "1_4"] });
}
seed("prelaunch");

// ── encode / decode (Timestamp, serverTimestamp, arrayUnion/Remove) ──────────
const encode = (_k: string, v: any) => (v && typeof v.toDate === "function" ? { __ts: v.toDate().toISOString() } : v);
const send = (res: express.Response, status: number, body: unknown) => res.status(status).type("json").send(JSON.stringify(body, encode));

function decode(v: any): any {
  if (Array.isArray(v)) return v.map(decode);
  if (v && typeof v === "object") {
    if (typeof v.__ts === "string") return ts(Date.parse(v.__ts));
    if (v.__op === "serverTimestamp") return ts();
    if (v.__op) return v; // arrayUnion / arrayRemove, resolved against the existing document
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x)]));
  }
  return v;
}
const getPath = (o: any, p: string) => p.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
function resolveOps(existing: any, data: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && v.__op === "arrayUnion") {
      const cur: any[] = getPath(existing, k) ?? [];
      out[k] = [...cur, ...v.values.filter((x: any) => !cur.some((c) => JSON.stringify(c) === JSON.stringify(x)))];
    } else if (v && typeof v === "object" && v.__op === "arrayRemove") {
      const cur: any[] = getPath(existing, k) ?? [];
      out[k] = cur.filter((c) => !v.values.some((x: any) => JSON.stringify(c) === JSON.stringify(x)));
    } else out[k] = v;
  }
  return out;
}

// ── MODEL of firestore.rules (see header: not the real rules) ────────────────
type Op = "get" | "list" | "create" | "update" | "delete";
const authUid = (req: express.Request) => {
  const h = String(req.headers.authorization ?? "");
  const m = /^Bearer fake-token:(.+)$/.exec(h);
  return m ? m[1] : null;
};
const isAdminUid = (uid: string | null) => !!uid && (db.raw("users", uid) as any)?.role === "ADMIN";

function allowed(op: Op, col: string, id: string, uid: string | null, existing: any, next: any, queryFilters: any[] = []): boolean {
  const owner = (d: any) => !!uid && d?.userId === uid;
  switch (col) {
    case "users": return !!uid && (id === uid || isAdminUid(uid));
    case "courses": return op === "get" || op === "list" ? true : isAdminUid(uid);
    case "enrollments":
      if (op === "get") return !!uid && (owner(existing) || isAdminUid(uid));
      if (op === "list") return !!uid && (queryFilters.some((f) => f[0] === "userId" && f[1] === "==" && f[2] === uid) || isAdminUid(uid));
      if (op === "create") return !!uid && next?.userId === uid && (db.raw("courses", next.courseId) as any)?.isFree === true;
      if (op === "update") return !!uid && (owner(existing) || isAdminUid(uid)) && next?.userId === existing?.userId && next?.courseId === existing?.courseId;
      return false;
    case "certificates":
      if (op === "get" || op === "list") return !!uid && (owner(existing) || isAdminUid(uid));
      if (op === "create") return !!uid && next?.userId === uid;
      return false;
    case "actionCards": {
      // Mirrors firestore.rules: owner-only; id = uid_courseId; six keys; <= 800 chars; enrollment must exist.
      if (op === "get") return !!uid && (existing == null || existing.userId === uid);
      if (op === "list" || op === "delete") return false;
      const valid =
        !!uid && next?.userId === uid && typeof next?.courseId === "string" && id === `${uid}_${next.courseId}` &&
        next.outputs && typeof next.outputs === "object" &&
        Object.entries(next.outputs).every(([k, o]: [string, any]) => /^m[1-6]$/.test(k) && typeof o?.text === "string" && o.text.length <= 800 && Number.isInteger(o.rev) && o.rev >= 1) &&
        !!db.raw("enrollments", id);
      if (op === "create") return valid;
      return valid && existing?.userId === uid && existing?.courseId === next.courseId;
    }
    case "analytics": case "leads": return op === "create";
    case "forumPosts": return op === "get" || op === "list" ? !!uid : op === "create" && !!uid;
    default: return false;
  }
}

// ── app ──────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "2mb" }));

app.post("/__auth/login", (req, res) => {
  const { email, password } = req.body ?? {};
  const acct = Object.entries(ACCOUNTS).find(([, a]) => a.email === email);
  if (acct && password === PASSWORD) return send(res, 200, { uid: acct[0], email: acct[1].email, displayName: acct[1].displayName });
  const extra = [...extraAccounts.entries()].find(([, a]) => a.email === email && a.password === password);
  if (extra) return send(res, 200, { uid: extra[0], email: extra[1].email, displayName: extra[1].displayName });
  return send(res, 400, { code: "auth/invalid-credential" });
});

app.post("/__auth/register", (req, res) => {
  const { email, password, displayName } = req.body ?? {};
  if (!email || !password || String(password).length < 6) return send(res, 400, { code: "auth/weak-password" });
  const uid = `new${extraAccounts.size + 1}`;
  extraAccounts.set(uid, { email, password, displayName: displayName ?? "" });
  return send(res, 200, { uid, email, displayName: displayName ?? "" });
});

app.post("/__fs", (req, res) => {
  const uid = authUid(req);
  const b = req.body;
  const denied = () => send(res, 403, { code: "permission-denied", message: "Missing or insufficient permissions." });

  try {
    if (b.op === "get") {
      const existing = db.raw(b.col, b.id);
      if (!allowed("get", b.col, b.id, uid, existing, null)) return denied();
      return send(res, 200, { exists: existing !== undefined, data: existing, v: ver(b.col, b.id) });
    }

    if (b.op === "query") {
      const filters: any[] = b.filters ?? [];
      if (!allowed("list", b.col, "", uid, null, null, filters)) return denied();
      let rows = db.all(b.col).filter((d: any) =>
        filters.every(([f, op, val]: any) => {
          const x = getPath(d, f);
          if (op === "==") return JSON.stringify(x) === JSON.stringify(val);
          if (op === "in") return Array.isArray(val) && val.includes(x);
          if (op === "array-contains") return Array.isArray(x) && x.includes(val);
          if (op === "!=") return x !== val;
          return true;
        }));
      for (const [f, dir] of [...(b.orders ?? [])].reverse()) {
        rows = rows.sort((a: any, c: any) => {
          const av = getPath(a, f), cv = getPath(c, f);
          const na = av?.toDate ? av.toDate().getTime() : av, nc = cv?.toDate ? cv.toDate().getTime() : cv;
          return (na > nc ? 1 : na < nc ? -1 : 0) * (dir === "desc" ? -1 : 1);
        });
      }
      if (b.limit) rows = rows.slice(0, b.limit);
      return send(res, 200, { docs: rows.map((r: any) => ({ id: r.id, data: db.raw(b.col, r.id) })) });
    }

    const apply = (w: any): boolean => {
      const data = decode(w.data);
      const existing = db.raw(w.col, w.id);
      if (w.type === "delete") return false; // not needed by any tested flow; the real rules also restrict it
      if (w.type === "set") {
        const merged = w.merge && existing ? { ...existing, ...resolveOps(existing, data) } : data;
        if (!allowed(existing === undefined ? "create" : "update", w.col, w.id, uid, existing, merged)) return false;
        db.seed(w.col, w.id, merged);
      } else if (w.type === "update") {
        if (existing === undefined) throw Object.assign(new Error("NOT_FOUND"), { code: "not-found" });
        const resolved = resolveOps(existing, data);
        const next = JSON.parse(JSON.stringify(existing, encode), (_k, v) => (v && typeof v.__ts === "string" ? ts(Date.parse(v.__ts)) : v));
        for (const [k, v] of Object.entries(resolved)) {
          const parts = k.split(".");
          let cur = next;
          for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]] ??= {};
          cur[parts[parts.length - 1]] = v;
        }
        if (!allowed("update", w.col, w.id, uid, existing, next)) return false;
        db.seed(w.col, w.id, next);
      }
      bump(w.col, w.id);
      return true;
    };

    if (b.op === "set" || b.op === "update") {
      if (!apply({ type: b.op, ...b })) return denied();
      return send(res, 200, { ok: true });
    }
    if (b.op === "add") {
      const id = `auto${Math.random().toString(36).slice(2, 10)}`;
      if (!apply({ type: "set", col: b.col, id, data: b.data })) return denied();
      return send(res, 200, { id });
    }
    if (b.op === "delete") return denied();

    if (b.op === "commit") {
      // Optimistic transaction: abort if any document read has changed since (the client retries, like the real SDK).
      for (const r of b.reads ?? []) if (ver(r.col, r.id) !== r.v) return send(res, 200, { aborted: true });
      for (const w of b.writes ?? []) if (!apply(w)) return denied();
      return send(res, 200, { ok: true });
    }
    return send(res, 400, { code: "invalid-argument" });
  } catch (e: any) {
    return send(res, 500, { code: e.code ?? "internal", message: e.message });
  }
});

// Admin API: the REAL handlers from api/_lib/course-admin.ts behind a fake-token check.
app.all("/api/admin", async (req, res) => {
  const uid = authUid(req);
  if (!uid) return send(res, 401, { error: "Unauthorized: missing Bearer token" });
  if (!isAdminUid(uid)) return send(res, 403, { error: "Forbidden: admin only" });
  const resource = String(req.query.resource ?? "");
  const stampFn = () => ({ isEqual: () => false }); // the fake db turns this into a server timestamp
  try {
    if (resource === "upload") return send(res, 200, { url: `https://media.e2e-test.example.com/uploads/${Date.now()}.mp4`, filename: "upload.mp4" });
    if (req.method === "POST" && resource === "sync-courses") {
      const r = await syncCourseList(db, req.body.courses, stampFn, { confirmMediaReplacement: req.body.confirmMediaReplacement });
      return send(res, 200, { success: r.blocked.length === 0 && r.errors.length === 0, synced: r.synced, archived: r.archived.length ? r.archived : undefined, drafted: r.drafted.length ? r.drafted : undefined, blocked: r.blocked.length ? r.blocked : undefined, errors: r.errors.length ? r.errors : undefined });
    }
    if (resource.startsWith("course-")) {
      const out = await handleCourseAdminOp(db, { method: req.method, resource, query: req.query as any, body: req.body }, stampFn);
      if (out) return send(res, out.status, out.body);
    }
    return send(res, 404, { error: `Unknown admin resource: "${resource}"` });
  } catch (e: any) {
    return send(res, 500, { error: e.message });
  }
});

app.get("/api/config-check", (_req, res) => send(res, 200, { ok: true, checks: {} }));
app.post("/api/send-email", (req, res) => { mail.push({ to: req.body?.to, subject: req.body?.subject }); send(res, 200, { ok: true }); });

app.post("/__reset", (req, res) => { seed(String(req.query.scenario ?? "prelaunch")); send(res, 200, { ok: true, scenario: req.query.scenario ?? "prelaunch" }); });
app.get("/__debug/mail", (_req, res) => send(res, 200, mail));
app.get("/__debug/state", (req, res) => {
  const col = String(req.query.col ?? "");
  send(res, 200, col ? db.all(col) : { courses: db.all("courses").map((c: any) => ({ id: c.id, curriculumVersion: c.curriculumVersion, modules: c.curriculum?.length })), drafts: db.all("courseDrafts").map((d: any) => d.id), archive: db.all("courseArchive").map((d: any) => d.id), enrollments: db.all("enrollments").length, actionCards: db.all("actionCards") });
});
// Simulate "the other device" saving: writes straight to the store, bypassing rules.
app.post("/__debug/set", (req, res) => { const { col, id, data } = req.body; db.seed(col, id, decode(data)); bump(col, id); send(res, 200, { ok: true }); });

app.listen(3100, () => console.log("[e2e] API + fake Firestore/Auth on http://localhost:3100  (scenario: prelaunch)"));
