import crypto from 'node:crypto';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import { loadFirebaseAppletConfig } from './firebaseConfigLoader.ts';

const FIREBASE_X509_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedAdminAuth: Auth | null = null;
let firebaseAdminLoadFailed = false;

let cachedCerts: Record<string, string> | null = null;
let cachedCertsExpiresAt = 0;

function decodeBase64UrlJson<T>(segment: string): T {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const raw = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(raw) as T;
}

function decodeBase64UrlBuffer(segment: string): Buffer {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
}

async function fetchFirebasePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && cachedCerts && now < cachedCertsExpiresAt) {
    return cachedCerts;
  }

  const res = await fetch(FIREBASE_X509_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase public keys (HTTP ${res.status}).`);
  }

  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  cachedCerts = certs;
  cachedCertsExpiresAt = now + Math.max(60, maxAgeSec) * 1000;
  return certs;
}

/**
 * Pure-Node cryptographic Firebase ID Token verification following Firebase's official
 * third-party JWT verification spec (RS256 against Google's X.509 securetoken certs).
 * Used automatically in serverless runtimes where firebase-admin's jwks-rsa/jose CJS-ESM
 * bridge cannot load (e.g. ERR_REQUIRE_ESM).
 */
async function verifyFirebaseIdTokenWithCrypto(idToken: string): Promise<DecodedIdToken> {
  if (typeof idToken !== 'string' || !idToken.trim()) {
    throw new Error('Firebase ID token must be a non-empty string.');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid Firebase ID token format.');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(headerB64);
  const payload = decodeBase64UrlJson<Record<string, unknown>>(payloadB64);

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    throw new Error('Firebase ID token has unsupported algorithm or missing key ID.');
  }

  const { projectId } = loadFirebaseAppletConfig();
  if (!projectId) {
    throw new Error('Firebase projectId is not configured on the server.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  const iat = typeof payload.iat === 'number' ? payload.iat : 0;
  const authTime = typeof payload.auth_time === 'number' ? payload.auth_time : 0;
  const aud = typeof payload.aud === 'string' ? payload.aud : '';
  const iss = typeof payload.iss === 'string' ? payload.iss : '';
  const sub = typeof payload.sub === 'string' ? payload.sub : '';

  if (exp <= nowSec) {
    throw new Error('Firebase ID token has expired.');
  }
  if (iat > nowSec + 300) {
    throw new Error('Firebase ID token issued-at time is in the future.');
  }
  if (authTime > nowSec + 300) {
    throw new Error('Firebase ID token auth_time is in the future.');
  }
  if (aud !== projectId) {
    throw new Error('Firebase ID token audience does not match this project.');
  }
  if (iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Firebase ID token issuer is invalid.');
  }
  if (!sub || sub.length > 128) {
    throw new Error('Firebase ID token subject (uid) is invalid.');
  }

  let certs = await fetchFirebasePublicCerts(false);
  let certPem = certs[header.kid];
  if (!certPem) {
    certs = await fetchFirebasePublicCerts(true);
    certPem = certs[header.kid];
  }
  if (!certPem) {
    throw new Error('Firebase ID token key ID did not match any active Google signing certificate.');
  }

  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
  const signature = decodeBase64UrlBuffer(signatureB64);
  const valid = crypto.verify('RSA-SHA256', signingInput, certPem, signature);
  if (!valid) {
    throw new Error('Firebase ID token signature verification failed.');
  }

  return {
    ...(payload as unknown as DecodedIdToken),
    uid: sub,
  };
}

async function tryLoadFirebaseAdminAuth(): Promise<Auth | null> {
  if (cachedAdminAuth) return cachedAdminAuth;
  if (firebaseAdminLoadFailed) return null;

  try {
    const [{ getApps, initializeApp }, { getAuth }] = await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/auth'),
    ]);
    const firebaseConfig = loadFirebaseAppletConfig();
    if (!getApps().length) {
      initializeApp({
        projectId: firebaseConfig.projectId || undefined,
      });
    }
    cachedAdminAuth = getAuth();
    return cachedAdminAuth;
  } catch (err) {
    firebaseAdminLoadFailed = true;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('firebase-admin unavailable in this runtime, using native RS256 verifier:', msg);
    return null;
  }
}

export const adminAuth = {
  async verifyIdToken(idToken: string, checkRevoked?: boolean): Promise<DecodedIdToken> {
    const sdkAuth = await tryLoadFirebaseAdminAuth();
    if (sdkAuth) {
      return sdkAuth.verifyIdToken(idToken, checkRevoked);
    }
    return verifyFirebaseIdTokenWithCrypto(idToken);
  },
};
