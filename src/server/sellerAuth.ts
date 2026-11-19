import { loadFirebaseAppletConfig } from '../lib/firebaseConfigLoader.ts';
import type {
  DocumentVerificationStatus,
  MerchantVerification,
  Shop,
  UserProfile,
} from '../types/index.ts';
import {
  canShopListProducts,
  getEffectiveShopVerificationStatus,
} from '../utils/marketplaceLogic.ts';

const firebaseConfig = loadFirebaseAppletConfig();
const FIRESTORE_PROJECT_ID = firebaseConfig.projectId;
const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId || '(default)';

const SUPER_ADMIN_EMAIL = 'yoftaheyoseph5@gmail.com';

export type SellerVerificationDenyCode =
  | 'UNAUTHENTICATED'
  | 'ACCOUNT_SUSPENDED'
  | 'CUSTOMER_NOT_SELLER'
  | 'NO_SHOP_CREATED'
  | 'SELLER_NOT_VERIFIED'
  | 'SHOP_NOT_VERIFIED_OR_NOT_OWNED';

export interface VerifiedShopSummary {
  shopId: string;
  name: string;
  neighborhood: string;
  traderType?: Shop['traderType'];
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  verificationStatus: DocumentVerificationStatus;
}

export interface SellerVerificationCheckResult {
  authorized: boolean;
  uid: string;
  isAdmin: boolean;
  isSeller: boolean;
  verificationStatus: DocumentVerificationStatus | 'none';
  code?: SellerVerificationDenyCode;
  reason?: string;
  verifiedShops: VerifiedShopSummary[];
  activeShop?: VerifiedShopSummary;
  ownedShopsCount: number;
}

/**
 * Pure server-side seller verification evaluator.
 * Never trusts client flags or client-provided verification status — derives
 * authorization exclusively from database records (`userProfile`, `shops`,
 * and `merchant_verifications`).
 */
export function evaluateSellerVerification(params: {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  userProfile?: Partial<UserProfile> | null;
  shops: Shop[];
  verificationsByShopId: Record<string, MerchantVerification | null | undefined>;
  requestedShopId?: string;
}): SellerVerificationCheckResult {
  const uid = (params.uid ?? '').trim();
  if (!uid) {
    return {
      authorized: false,
      uid: '',
      isAdmin: false,
      isSeller: false,
      verificationStatus: 'none',
      code: 'UNAUTHENTICATED',
      reason: 'Sign in with a verified seller account to post products.',
      verifiedShops: [],
      ownedShopsCount: 0,
    };
  }

  if (params.userProfile?.accountStatus === 'suspended') {
    return {
      authorized: false,
      uid,
      isAdmin: false,
      isSeller: params.userProfile?.role === 'seller',
      verificationStatus: 'rejected',
      code: 'ACCOUNT_SUSPENDED',
      reason: 'Your account is currently suspended and cannot publish listings.',
      verifiedShops: [],
      ownedShopsCount: 0,
    };
  }

  const isAdmin =
    params.userProfile?.role === 'admin' ||
    (Boolean(params.emailVerified) &&
      typeof params.email === 'string' &&
      params.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL);

  const ownedShops = params.shops.filter((s) => s.ownerUid === uid);
  const candidateShops = isAdmin ? params.shops : ownedShops;

  const verifiedShopEntries: VerifiedShopSummary[] = [];
  for (const shop of candidateShops) {
    const verification = params.verificationsByShopId[shop.shopId] ?? null;
    const effectiveStatus = getEffectiveShopVerificationStatus(shop, verification);
    const allowed = isAdmin
      ? shop.status !== 'suspended'
      : canShopListProducts(shop, verification);
    if (allowed) {
      verifiedShopEntries.push({
        shopId: shop.shopId,
        name: shop.name,
        neighborhood: shop.neighborhood,
        traderType: shop.traderType,
        deliveryAvailable: Boolean(shop.deliveryAvailable),
        pickupAvailable: Boolean(shop.pickupAvailable),
        verificationStatus: effectiveStatus,
      });
    }
  }

  const isSeller = isAdmin || params.userProfile?.role === 'seller' || ownedShops.length > 0;

  if (params.requestedShopId) {
    const requested = params.requestedShopId.trim();
    const matched = verifiedShopEntries.find((s) => s.shopId === requested);
    if (!matched) {
      const ownedMatch = ownedShops.find((s) => s.shopId === requested);
      const status: DocumentVerificationStatus | 'none' = ownedMatch
        ? getEffectiveShopVerificationStatus(
            ownedMatch,
            params.verificationsByShopId[ownedMatch.shopId] ?? null
          )
        : 'none';
      return {
        authorized: false,
        uid,
        isAdmin,
        isSeller,
        verificationStatus: status,
        code: ownedMatch ? 'SELLER_NOT_VERIFIED' : 'SHOP_NOT_VERIFIED_OR_NOT_OWNED',
        reason: ownedMatch
          ? 'This shop is not yet verified to publish listings. Complete merchant verification in Seller Portal first.'
          : 'You can only publish products to a verified shop owned by your account.',
        verifiedShops: verifiedShopEntries,
        ownedShopsCount: ownedShops.length,
      };
    }
    return {
      authorized: true,
      uid,
      isAdmin,
      isSeller: true,
      verificationStatus: 'approved',
      verifiedShops: verifiedShopEntries,
      activeShop: matched,
      ownedShopsCount: ownedShops.length,
    };
  }

  if (verifiedShopEntries.length > 0) {
    return {
      authorized: true,
      uid,
      isAdmin,
      isSeller: true,
      verificationStatus: 'approved',
      verifiedShops: verifiedShopEntries,
      activeShop: verifiedShopEntries[0],
      ownedShopsCount: ownedShops.length,
    };
  }

  if (ownedShops.length === 0) {
    if (isSeller) {
      return {
        authorized: false,
        uid,
        isAdmin,
        isSeller: true,
        verificationStatus: 'unverified',
        code: 'NO_SHOP_CREATED',
        reason:
          'Create and verify your Hawassa virtual shop in Seller Portal before listing products through the assistant.',
        verifiedShops: [],
        ownedShopsCount: 0,
      };
    }
    return {
      authorized: false,
      uid,
      isAdmin,
      isSeller: false,
      verificationStatus: 'none',
      code: 'CUSTOMER_NOT_SELLER',
      reason:
        'Product listing is exclusively available to verified Affin Connect sellers. You can continue using the assistant for shopping, prices, and delivery help.',
      verifiedShops: [],
      ownedShopsCount: 0,
    };
  }

  // Seller owns one or more shops, but none are verified/approved yet
  const statuses = ownedShops.map((s) =>
    getEffectiveShopVerificationStatus(s, params.verificationsByShopId[s.shopId] ?? null)
  );
  const highestStatus: DocumentVerificationStatus = statuses.includes('pending_review')
    ? 'pending_review'
    : statuses.includes('rejected')
      ? 'rejected'
      : 'unverified';

  const statusMessage =
    highestStatus === 'pending_review'
      ? 'Your merchant verification is currently under review. Once approved, you can publish products directly through the assistant.'
      : highestStatus === 'rejected'
        ? 'Your previous merchant verification was not approved. Please resubmit your business license in Seller Portal to unlock product posting.'
        : 'Only verified sellers can create and publish product listings. Please submit your trade license in Seller Portal to get verified.';

  return {
    authorized: false,
    uid,
    isAdmin,
    isSeller: true,
    verificationStatus: highestStatus,
    code: 'SELLER_NOT_VERIFIED',
    reason: statusMessage,
    verifiedShops: [],
    ownedShopsCount: ownedShops.length,
  };
}

// ---------------------------------------------------------------------------
// Firestore REST helpers (authenticated via the caller's Firebase ID token)
// ---------------------------------------------------------------------------

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

interface FirestoreDocumentResponse {
  name?: string;
  fields?: Record<string, FirestoreValue>;
}

function decodeFirestoreValue(value?: FirestoreValue): unknown {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map((item) => decodeFirestoreValue(item));
  }
  if ('mapValue' in value) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value.mapValue.fields ?? {})) {
      obj[k] = decodeFirestoreValue(v);
    }
    return obj;
  }
  return undefined;
}

function decodeFirestoreDoc<T>(doc: FirestoreDocumentResponse, idField: string): T | null {
  if (!doc.fields) return null;
  const raw: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    raw[k] = decodeFirestoreValue(v);
  }
  if (typeof raw[idField] !== 'string' && typeof doc.name === 'string') {
    raw[idField] = doc.name.split('/').pop() ?? '';
  }
  return raw as T;
}

function firestoreDocumentsRoot(): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIRESTORE_PROJECT_ID
  )}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents`;
}

async function firestoreGetDoc<T>(
  collectionPath: string,
  docId: string,
  idField: string,
  idToken: string
): Promise<T | null> {
  const url = `${firestoreDocumentsRoot()}/${collectionPath}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: 'application/json',
    },
  });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) {
    throw new Error(`Firestore read ${collectionPath}/${docId} failed (${res.status})`);
  }
  const json = (await res.json()) as FirestoreDocumentResponse;
  return decodeFirestoreDoc<T>(json, idField);
}

async function firestoreListShops(idToken: string): Promise<Shop[]> {
  const shops: Shop[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const query = new URLSearchParams({ pageSize: '200' });
    if (pageToken) query.set('pageToken', pageToken);
    const url = `${firestoreDocumentsRoot()}/shops?${query.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Firestore shops query failed (${res.status})`);
    }
    const json = (await res.json()) as {
      documents?: FirestoreDocumentResponse[];
      nextPageToken?: string;
    };
    for (const doc of json.documents ?? []) {
      const parsed = decodeFirestoreDoc<Shop>(doc, 'shopId');
      if (parsed?.shopId) shops.push(parsed);
    }
    pageToken = json.nextPageToken;
    pages += 1;
  } while (pageToken && pages < 10);

  return shops;
}

/**
 * Authoritative live Firestore seller verification check using the caller's
 * verified Firebase ID token. Called on eligibility checks, listing turns,
 * photo uploads, and immediately before saving/publishing any product.
 */
export async function verifySellerFromFirestore(params: {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  idToken: string;
  requestedShopId?: string;
}): Promise<SellerVerificationCheckResult> {
  const [userProfile, shops] = await Promise.all([
    firestoreGetDoc<UserProfile>('users', params.uid, 'uid', params.idToken),
    firestoreListShops(params.idToken),
  ]);

  const ownedShops = shops.filter((s) => s.ownerUid === params.uid);
  const verificationsByShopId: Record<string, MerchantVerification | null> = {};

  await Promise.all(
    ownedShops.map(async (shop) => {
      const verification = await firestoreGetDoc<MerchantVerification>(
        'merchant_verifications',
        shop.shopId,
        'verificationId',
        params.idToken
      );
      verificationsByShopId[shop.shopId] = verification;
    })
  );

  return evaluateSellerVerification({
    uid: params.uid,
    email: params.email,
    emailVerified: params.emailVerified,
    userProfile,
    shops,
    verificationsByShopId,
    requestedShopId: params.requestedShopId,
  });
}
