// Stand-in for 'firebase/app' (local signed-in test harness only).
const app = { name: '[e2e-fake]', options: {} };
export const initializeApp = () => app;
export const getApps = () => [app];
export const getApp = () => app;
