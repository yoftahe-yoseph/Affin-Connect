import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { loadFirebaseAppletConfig } from './firebaseConfigLoader.ts';

const firebaseConfig = loadFirebaseAppletConfig();

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId || undefined,
  });
}

export const adminAuth = getAuth();
