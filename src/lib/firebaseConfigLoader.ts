import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface FirebaseAppletServerConfig {
  projectId: string;
  firestoreDatabaseId: string;
}

let cachedConfig: FirebaseAppletServerConfig | null = null;

export function loadFirebaseAppletConfig(): FirebaseAppletServerConfig {
  if (cachedConfig) return cachedConfig;

  const candidates: (string | URL)[] = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    new URL('../../firebase-applet-config.json', import.meta.url),
    new URL('../firebase-applet-config.json', import.meta.url),
    new URL('./firebase-applet-config.json', import.meta.url),
  ];

  for (const candidate of candidates) {
    try {
      const exists = candidate instanceof URL ? existsSync(candidate) : existsSync(candidate);
      if (!exists) continue;
      const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as {
        projectId?: string;
        firestoreDatabaseId?: string;
      };
      if (parsed.projectId) {
        cachedConfig = {
          projectId: parsed.projectId,
          firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)',
        };
        return cachedConfig;
      }
    } catch {
      // Try next candidate
    }
  }

  cachedConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '',
    firestoreDatabaseId:
      process.env.FIREBASE_DATABASE_ID ||
      process.env.VITE_FIREBASE_DATABASE_ID ||
      '(default)',
  };
  return cachedConfig;
}
