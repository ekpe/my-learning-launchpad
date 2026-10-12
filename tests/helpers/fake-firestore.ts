/**
 * Minimal in-memory stand-in for the slice of the Firebase Admin Firestore API
 * that the webinar code uses. It exists so the real handlers can be exercised
 * end to end without credentials or the emulator (which needs JDK 21+).
 */

type Data = Record<string, any>;

const clone = <T,>(v: T): T => (v === undefined ? v : structuredCloneSafe(v));

function structuredCloneSafe(v: any): any {
  if (v === null || typeof v !== "object") return v;
  if (typeof v.toDate === "function") return v; // timestamp stand-ins are immutable
  if (v instanceof Date) return new Date(v);
  if (Array.isArray(v)) return v.map(structuredCloneSafe);
  const out: Data = {};
  for (const [k, val] of Object.entries(v)) out[k] = structuredCloneSafe(val);
  return out;
}

/** Replaces FieldValue sentinels (serverTimestamp) with a Timestamp-like object. */
function materialize(v: any, now: Date): any {
  if (v && typeof v === "object" && typeof v.isEqual === "function" && typeof v.toDate !== "function") {
    return { toDate: () => new Date(now) };
  }
  if (Array.isArray(v)) return v.map((x) => materialize(x, now));
  if (v && typeof v === "object" && !(v instanceof Date) && typeof v.toDate !== "function") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, materialize(x, now)]));
  }
  return v;
}

function setPath(target: Data, path: string, value: unknown) {
  const parts = path.split(".");
  let cur = target;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const getPath = (obj: Data, path: string) => path.split(".").reduce((o: any, k) => (o == null ? undefined : o[k]), obj);

const err = (code: number, message: string) => Object.assign(new Error(message), { code });

export function createFakeDb(opts: { now?: () => Date } = {}) {
  const nowFn = opts.now ?? (() => new Date());
  const collections = new Map<string, Map<string, Data>>();
  const col = (name: string) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  };

  class DocRef {
    constructor(public collection: string, public id: string) {}
    get ref() {
      return this;
    }
    async get() {
      const d = col(this.collection).get(this.id);
      return { exists: d !== undefined, id: this.id, ref: this, data: () => (d ? clone(d) : undefined) };
    }
    async set(data: Data, options?: { merge?: boolean }) {
      const m = clone(materialize(data, nowFn()));
      const existing = col(this.collection).get(this.id);
      col(this.collection).set(this.id, options?.merge && existing ? { ...existing, ...m } : m);
    }
    async create(data: Data) {
      if (col(this.collection).has(this.id)) throw err(6, "ALREADY_EXISTS: Document already exists");
      col(this.collection).set(this.id, clone(materialize(data, nowFn())));
    }
    async update(data: Data) {
      const existing = col(this.collection).get(this.id);
      if (!existing) throw err(5, "NOT_FOUND: No document to update");
      const next = clone(existing);
      for (const [k, v] of Object.entries(clone(materialize(data, nowFn())))) setPath(next, k, v);
      col(this.collection).set(this.id, next);
    }
  }

  class Query {
    constructor(
      protected name: string,
      protected filters: [string, string, unknown][] = [],
      protected limitN = Infinity,
      protected after: string | null = null
    ) {}
    where(field: string, op: string, value: unknown) {
      if (op !== "==") throw new Error("fake db supports == only");
      return new Query(this.name, [...this.filters, [field, op, value]], this.limitN, this.after);
    }
    orderBy() {
      return this; // always ordered by document id in this fake
    }
    limit(n: number) {
      return new Query(this.name, this.filters, n, this.after);
    }
    startAfter(cursor: string) {
      return new Query(this.name, this.filters, this.limitN, cursor);
    }
    private rows() {
      return [...col(this.name).entries()]
        .filter(([, d]) => this.filters.every(([f, , v]) => getPath(d, f) === v))
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .filter(([id]) => this.after === null || id > this.after)
        .slice(0, this.limitN);
    }
    async get() {
      const docs = this.rows().map(([id, d]) => ({ id, ref: new DocRef(this.name, id), data: () => clone(d) }));
      return { docs, size: docs.length, empty: docs.length === 0 };
    }
    count() {
      return { get: async () => ({ data: () => ({ count: this.rows().length }) }) };
    }
  }

  class Collection extends Query {
    constructor(name: string) {
      super(name);
    }
    doc(id: string) {
      return new DocRef(this.name, id);
    }
  }

  const db = {
    collection: (name: string) => new Collection(name),
    async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      const tx = {
        get: (ref: DocRef) => ref.get(),
        set: (ref: DocRef, data: Data, o?: any) => ref.set(data, o),
        update: (ref: DocRef, data: Data) => ref.update(data),
      };
      return fn(tx);
    },
    // test helpers
    raw: (name: string, id: string): Data | undefined => col(name).get(id),
    all: (name: string): Array<Data & { id: string }> => [...col(name).entries()].map(([id, d]) => ({ id, ...(clone(d) as Data) })),
    seed: (name: string, id: string, data: Data) => void col(name).set(id, clone(data)),
    patch: (name: string, id: string, data: Data) => {
      const d = col(name).get(id)!;
      for (const [k, v] of Object.entries(data)) setPath(d, k, v);
    },
  };
  return db;
}

export type FakeDb = ReturnType<typeof createFakeDb>;

// ── Resend over fetch ────────────────────────────────────────────────────────

export interface CapturedRequest {
  url: string;
  method: string;
  body: any;
}

/**
 * Replaces globalThis.fetch with a recorder that answers like the Resend API.
 * `respond` can override the response for a given request (e.g. to simulate failures).
 */
export function installResendMock(respond?: (req: CapturedRequest) => Response | undefined) {
  const original = globalThis.fetch;
  const calls: CapturedRequest[] = [];
  let n = 0;
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = typeof input === "string" ? input : input.url;
    let body: any = undefined;
    try {
      body = init.body ? JSON.parse(init.body) : undefined;
    } catch {
      body = init.body;
    }
    const req = { url, method: init.method ?? "GET", body };
    calls.push(req);
    const custom = respond?.(req);
    if (custom) return custom;
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
    if (/\/emails\/[^/]+\/cancel$/.test(url)) return json({ object: "email", id: url.split("/").slice(-2)[0] });
    if (/\/emails\/[^/]+$/.test(url) && req.method === "GET") return json({ id: url.split("/").pop(), last_event: "delivered" });
    return json({ id: `em_${++n}` });
  }) as typeof fetch;
  return {
    calls,
    sends: () => calls.filter((c) => c.method === "POST" && /\/emails$/.test(c.url)),
    cancels: () => calls.filter((c) => /\/cancel$/.test(c.url)),
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

// ── Vercel req/res stand-ins ─────────────────────────────────────────────────

export function mockReq(init: { method?: string; query?: Record<string, string>; body?: any; headers?: Record<string, string> } = {}): any {
  return { method: init.method ?? "GET", query: init.query ?? {}, body: init.body, headers: { "x-forwarded-for": "203.0.113.7", ...(init.headers ?? {}) } };
}

export function mockRes(): any {
  const r: any = { statusCode: 200, headers: {}, body: undefined };
  r.status = (c: number) => ((r.statusCode = c), r);
  r.json = (b: unknown) => ((r.body = b), r);
  r.send = (b: unknown) => ((r.body = b), r);
  r.setHeader = (k: string, v: string) => ((r.headers[k] = v), r);
  r.end = () => r;
  return r;
}
