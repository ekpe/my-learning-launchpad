// Stand-in for 'firebase/auth' (local signed-in test harness only). Talks to tests/helpers/e2e-server.ts.
import { bootstrap, getSession, onSession, setSession, tokenFor, type FakeUser } from './session';

export type User = FakeUser & { getIdToken: () => Promise<string> };

const wrap = (u: FakeUser | null): User | null => (u ? { ...u, getIdToken: async () => tokenFor(u)! } : null);

const authObject: { currentUser: User | null } = { currentUser: wrap(getSession()) };
onSession((u) => (authObject.currentUser = wrap(u)));

export const getAuth = () => authObject;

export function onAuthStateChanged(_auth: unknown, cb: (u: User | null) => void) {
  let alive = true;
  bootstrap().finally(() => {
    if (!alive) return;
    authObject.currentUser = wrap(getSession());
    cb(authObject.currentUser);
  });
  const off = onSession((u) => alive && cb(wrap(u)));
  return () => {
    alive = false;
    off();
  };
}

const call = async (path: string, body: unknown) => {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.code), { code: json.code });
  return json;
};

export async function signInWithEmailAndPassword(_a: unknown, email: string, password: string) {
  const u = await call('/__auth/login', { email, password });
  setSession(u);
  return { user: wrap(u)! };
}

export async function createUserWithEmailAndPassword(_a: unknown, email: string, password: string) {
  const u = await call('/__auth/register', { email, password });
  setSession(u);
  return { user: wrap(u)! };
}

export async function updateProfile(user: User, patch: { displayName?: string }) {
  const next = { uid: user.uid, email: user.email, displayName: patch.displayName ?? user.displayName };
  setSession(next);
}

export async function signOut() {
  setSession(null);
}

export class GoogleAuthProvider {}
export async function signInWithPopup(): Promise<never> {
  throw Object.assign(new Error('popup unavailable in the local harness'), { code: 'auth/popup-closed-by-user' });
}
