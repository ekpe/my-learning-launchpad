// Stand-in for 'firebase/firestore' (local signed-in test harness only). Every call goes over HTTP to the
// in-memory database in tests/helpers/e2e-server.ts, so several browser tabs share one store (like devices).
import { getSession, onSession, tokenFor } from './session';

// ── value types ──────────────────────────────────────────────────────────────
export class Timestamp {
  constructor(public seconds: number, public nanoseconds = 0) {}
  static now() { return Timestamp.fromMillis(Date.now()); }
  static fromMillis(ms: number) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  static fromDate(d: Date) { return Timestamp.fromMillis(d.getTime()); }
  toDate() { return new Date(this.seconds * 1000 + this.nanoseconds / 1e6); }
  toMillis() { return this.toDate().getTime(); }
}

type Sentinel = { __op: string; values?: unknown[] };
export const serverTimestamp = (): Sentinel => ({ __op: 'serverTimestamp' });
export const arrayUnion = (...values: unknown[]): Sentinel => ({ __op: 'arrayUnion', values });
export const arrayRemove = (...values: unknown[]): Sentinel => ({ __op: 'arrayRemove', values });

const enc = (v: any): any => {
  if (v instanceof Timestamp) return { __ts: v.toDate().toISOString() };
  if (v instanceof Date) return { __ts: v.toISOString() };
  if (Array.isArray(v)) return v.map(enc);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, enc(x)]));
  return v;
};
const dec = (v: any): any => {
  if (Array.isArray(v)) return v.map(dec);
  if (v && typeof v === 'object') {
    if (typeof v.__ts === 'string') return Timestamp.fromMillis(Date.parse(v.__ts));
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dec(x)]));
  }
  return v;
};

// ── transport ────────────────────────────────────────────────────────────────
class FsError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

async function rpc(body: Record<string, unknown>): Promise<any> {
  const tok = tokenFor(getSession());
  const res = await fetch('/__fs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new FsError(json.code ? `${json.code}` : 'unavailable', json.message);
  return json;
}

// ── refs ─────────────────────────────────────────────────────────────────────
export const getFirestore = () => ({ __db: true });
type CollRef = { type: 'collection'; name: string };
type DocRef = { type: 'doc'; col: string; id: string; path: string };
type QueryRef = { type: 'query'; col: string; filters: any[]; orders: any[]; limitN?: number };

export const collection = (_db: unknown, name: string): CollRef => ({ type: 'collection', name });
const autoId = () => `auto${Math.random().toString(36).slice(2, 10)}`;
export function doc(base: any, ...segments: string[]): DocRef {
  if (base?.type === 'collection') {
    const id = segments[0] ?? autoId();
    return { type: 'doc', col: base.name, id, path: `${base.name}/${id}` };
  }
  const parts = segments.join('/').split('/');
  return { type: 'doc', col: parts[0], id: parts[1], path: parts.slice(0, 2).join('/') };
}

export const where = (field: string, op: string, value: unknown) => ({ kind: 'where', field, op, value });
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc') => ({ kind: 'order', field, dir });
export const limit = (n: number) => ({ kind: 'limit', n });
export function query(base: CollRef | QueryRef, ...cs: any[]): QueryRef {
  const q: QueryRef = base.type === 'query' ? { ...base } : { type: 'query', col: base.name, filters: [], orders: [] };
  for (const c of cs) {
    if (c.kind === 'where') q.filters = [...q.filters, [c.field, c.op, enc(c.value)]];
    else if (c.kind === 'order') q.orders = [...q.orders, [c.field, c.dir]];
    else if (c.kind === 'limit') q.limitN = c.n;
  }
  return q;
}

// ── snapshots ────────────────────────────────────────────────────────────────
const docSnap = (ref: DocRef, exists: boolean, data: any) => ({
  id: ref.id,
  ref,
  exists: () => exists,
  data: () => (exists ? dec(data) : undefined),
});

async function fetchQuery(q: QueryRef | CollRef) {
  const qr = q.type === 'collection' ? query(q) : q;
  const { docs } = await rpc({ op: 'query', col: qr.col, filters: qr.filters, orders: qr.orders, limit: qr.limitN });
  const list = docs.map((d: any) => docSnap({ type: 'doc', col: qr.col, id: d.id, path: `${qr.col}/${d.id}` }, true, d.data));
  return { docs: list, empty: list.length === 0, size: list.length, forEach: (fn: any) => list.forEach(fn) };
}

export async function getDoc(ref: DocRef) {
  const r = await rpc({ op: 'get', col: ref.col, id: ref.id });
  return docSnap(ref, r.exists, r.data);
}
export const getDocs = (q: QueryRef | CollRef) => fetchQuery(q);

export async function setDoc(ref: DocRef, data: any, opts?: { merge?: boolean }) {
  await rpc({ op: 'set', col: ref.col, id: ref.id, data: enc(data), merge: !!opts?.merge });
  notify();
}
export async function updateDoc(ref: DocRef, data: any) {
  await rpc({ op: 'update', col: ref.col, id: ref.id, data: enc(data) });
  notify();
}
export async function addDoc(coll: CollRef, data: any) {
  const { id } = await rpc({ op: 'add', col: coll.name, data: enc(data) });
  notify();
  return doc(coll, id);
}
export async function deleteDoc(ref: DocRef) {
  await rpc({ op: 'delete', col: ref.col, id: ref.id });
  notify();
}

// ── transactions (optimistic; retried when another device wrote in between) ──
export async function runTransaction<T>(_db: unknown, fn: (tx: any) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const reads: { col: string; id: string; v: number }[] = [];
    const writes: any[] = [];
    const tx = {
      async get(ref: DocRef) {
        const r = await rpc({ op: 'get', col: ref.col, id: ref.id });
        reads.push({ col: ref.col, id: ref.id, v: r.v });
        return docSnap(ref, r.exists, r.data);
      },
      set(ref: DocRef, data: any, opts?: { merge?: boolean }) {
        writes.push({ type: 'set', col: ref.col, id: ref.id, data: enc(data), merge: !!opts?.merge });
        return tx;
      },
      update(ref: DocRef, data: any) {
        writes.push({ type: 'update', col: ref.col, id: ref.id, data: enc(data) });
        return tx;
      },
      delete(ref: DocRef) {
        writes.push({ type: 'delete', col: ref.col, id: ref.id });
        return tx;
      },
    };
    const result = await fn(tx);
    const out = await rpc({ op: 'commit', reads, writes });
    if (!out.aborted) {
      notify();
      return result;
    }
  }
  throw new FsError('aborted', 'Too many retries.');
}

// ── live listeners (polling) ─────────────────────────────────────────────────
type Listener = { poll: () => Promise<void> };
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;

function ensureTimer() {
  if (timer) return;
  timer = setInterval(() => listeners.forEach((l) => void l.poll()), 700);
}
function notify() {
  setTimeout(() => listeners.forEach((l) => void l.poll()), 30);
}
// A change of user changes what the rules allow, so re-poll everything.
onSession(() => notify());

export function onSnapshot(target: any, onNext: (s: any) => void, onError?: (e: any) => void) {
  let last = '';
  let alive = true;
  const poll = async () => {
    if (!alive) return;
    try {
      let snap: any, sig: string;
      if (target.type === 'doc') {
        const r = await rpc({ op: 'get', col: target.col, id: target.id });
        sig = JSON.stringify([r.exists, r.data]);
        snap = docSnap(target, r.exists, r.data);
      } else {
        const q = target.type === 'collection' ? query(target) : target;
        const r = await rpc({ op: 'query', col: q.col, filters: q.filters, orders: q.orders, limit: q.limitN });
        sig = JSON.stringify(r.docs);
        snap = await fetchQuery(target);
      }
      if (!alive) return;
      if (sig !== last) {
        last = sig;
        onNext(snap);
      }
    } catch (e: any) {
      if (!alive) return;
      const sig = `err:${e.code}`;
      if (sig !== last) {
        last = sig;
        onError?.(e);
      }
    }
  };
  const l: Listener = { poll };
  listeners.add(l);
  ensureTimer();
  void poll();
  return () => {
    alive = false;
    listeners.delete(l);
  };
}
