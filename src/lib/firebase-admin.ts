import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { loadFirebaseAppletConfig } from './firebaseConfigLoader.ts';

let cachedAuth: Auth | null = null;

export function getAdminAuth(): Auth {
  if (!cachedAuth) {
    const firebaseConfig = loadFirebaseAppletConfig();
    if (!getApps().length) {
      initializeApp({
        projectId: firebaseConfig.projectId || undefined,
      });
    }
    cachedAuth = getAuth();
  }
  return cachedAuth;
}

export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_target, prop, receiver) {
    const instance = getAdminAuth();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
