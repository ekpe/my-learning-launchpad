// Browser-side session for the local signed-in test harness (tests/helpers/e2e-server.ts). Never shipped.
const KEY = 'e2e.session';

export interface FakeUser {
  uid: string;
  email: string;
  displayName: string | null;
}

let current: FakeUser | null = null;
const listeners = new Set<(u: FakeUser | null) => void>();

try {
  // "?as=<uid>" signs in as a seeded account without typing credentials. "?as=" (empty) signs out.
  const as = new URLSearchParams(location.search).get('as');
  if (as !== null) {
    if (as) localStorage.setItem('e2e.as', as);
    else localStorage.removeItem(KEY);
  }
  const saved = localStorage.getItem(KEY);
  if (saved) current = JSON.parse(saved);
} catch {
  /* ignore */
}

export const getSession = () => current;
export const tokenFor = (u: FakeUser | null) => (u ? `fake-token:${u.uid}` : null);

export function setSession(u: FakeUser | null) {
  current = u;
  try {
    if (u) localStorage.setItem(KEY, JSON.stringify(u));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(u));
}

export const onSession = (l: (u: FakeUser | null) => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Resolves a pending "?as=uid" into a real session by asking the server who that is. */
export async function bootstrap(): Promise<void> {
  let as: string | null = null;
  try {
    as = localStorage.getItem('e2e.as');
    localStorage.removeItem('e2e.as');
  } catch {
    /* ignore */
  }
  if (!as) return;
  const res = await fetch('/__fs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer fake-token:${as}` },
    body: JSON.stringify({ op: 'get', col: 'users', id: as }),
  });
  const body = await res.json();
  if (body.exists) setSession({ uid: as, email: body.data.email, displayName: body.data.displayName });
}
