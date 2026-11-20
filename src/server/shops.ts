import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth.ts';
import { loadFirebaseAppletConfig } from '../lib/firebaseConfigLoader.ts';
import type {
  MerchantVerification,
  Product,
  PublicShopDirectoryItem,
  Shop,
  ShopAvailabilityStatus,
  UserProfile,
} from '../types/index.ts';
import {
  buildShopSlug,
  canShopListProducts,
  getEffectiveShopVerificationStatus,
  isVerifiedMerchantShop,
} from '../utils/marketplaceLogic.ts';
import {
  filterAndPaginateDiscoverShops,
  getShopAvailabilityStatus,
  isShopPubliclyDiscoverable,
  sanitizePublicShopProfile,
  SHOP_AVAILABILITY_STATUSES,
  SHOP_DIRECTORY_CATEGORIES,
  validateShopProfilePayload,
  type ShopProfileValidationInput,
} from '../utils/shopDirectory.ts';

const firebaseConfig = loadFirebaseAppletConfig();
const FIRESTORE_PROJECT_ID = firebaseConfig.projectId;
const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId || '(default)';
const SUPER_ADMIN_EMAIL = 'yoftaheyoseph5@gmail.com';

// ---------------------------------------------------------------------------
// Firestore REST Value Encoding / Decoding
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

function encodeFirestoreValue(val: unknown): FirestoreValue | undefined {
  if (val === undefined) return undefined;
  if (val === null) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return undefined;
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (Array.isArray(val)) {
    const values = val
      .map((item) => encodeFirestoreValue(item))
      .filter((item): item is FirestoreValue => item !== undefined);
    return { arrayValue: { values } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      const encoded = encodeFirestoreValue(v);
      if (encoded !== undefined) {
        fields[k] = encoded;
      }
    }
    return { mapValue: { fields } };
  }
  return undefined;
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

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

function isAdminIdentity(params: {
  email?: string;
  emailVerified?: boolean;
  userProfile?: Partial<UserProfile> | null;
}): boolean {
  return (
    params.userProfile?.role === 'admin' ||
    (Boolean(params.emailVerified) &&
      typeof params.email === 'string' &&
      params.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL)
  );
}

async function firestoreGetDoc<T>(
  collectionPath: string,
  docId: string,
  idField: string,
  idToken?: string | null
): Promise<T | null> {
  const url = `${firestoreDocumentsRoot()}/${collectionPath}/${encodeURIComponent(docId)}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const res = await fetch(url, { method: 'GET', headers });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) {
    throw new Error(`Firestore read ${collectionPath}/${docId} failed (${res.status})`);
  }
  const json = (await res.json()) as FirestoreDocumentResponse;
  return decodeFirestoreDoc<T>(json, idField);
}

async function firestoreListCollection<T>(
  collectionPath: string,
  idField: string,
  idToken?: string | null
): Promise<T[]> {
  const results: T[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const query = new URLSearchParams({ pageSize: '200' });
    if (pageToken) query.set('pageToken', pageToken);
    const url = `${firestoreDocumentsRoot()}/${collectionPath}?${query.toString()}`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      throw new Error(`Firestore list ${collectionPath} failed (${res.status})`);
    }
    const json = (await res.json()) as {
      documents?: FirestoreDocumentResponse[];
      nextPageToken?: string;
    };
    for (const doc of json.documents ?? []) {
      const parsed = decodeFirestoreDoc<T>(doc, idField);
      if (parsed && (parsed as Record<string, unknown>)[idField]) {
        results.push(parsed);
      }
    }
    pageToken = json.nextPageToken;
    pages += 1;
  } while (pageToken && pages < 10);

  return results;
}

async function firestoreWriteShopDoc(
  shop: Shop,
  idToken: string,
  mode: 'create' | 'update'
): Promise<void> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(shop as unknown as Record<string, unknown>)) {
    const encoded = encodeFirestoreValue(v);
    if (encoded !== undefined) {
      fields[k] = encoded;
    }
  }

  const baseUrl = `${firestoreDocumentsRoot()}/shops/${encodeURIComponent(shop.shopId)}`;
  const url = mode === 'create' ? `${baseUrl}?currentDocument.exists=false` : baseUrl;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    const err = new Error(
      `Firestore shop ${mode} failed (${res.status}): ${bodyText.slice(0, 240)}`
    ) as Error & { status?: number };
    err.status = res.status === 403 ? 403 : res.status === 409 ? 409 : 500;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Pure Authoritative Business Logic (Unit-Testable)
// ---------------------------------------------------------------------------

export interface ShopAuthCheckResult {
  allowed: boolean;
  status: number;
  isAdmin: boolean;
  code?:
    | 'UNAUTHENTICATED'
    | 'ACCOUNT_SUSPENDED'
    | 'CUSTOMER_NOT_SELLER'
    | 'SHOP_NOT_FOUND'
    | 'SHOP_NOT_OWNED'
    | 'SHOP_SUSPENDED'
    | 'SELLER_NOT_VERIFIED';
  error?: string;
}

export function evaluateShopCreateAuthorization(params: {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  userProfile?: Partial<UserProfile> | null;
  existingShops: Shop[];
}): ShopAuthCheckResult {
  const uid = (params.uid ?? '').trim();
  if (!uid) {
    return {
      allowed: false,
      status: 401,
      isAdmin: false,
      code: 'UNAUTHENTICATED',
      error: 'Authentication is required to create a shop profile.',
    };
  }
  if (params.userProfile?.accountStatus === 'suspended') {
    return {
      allowed: false,
      status: 403,
      isAdmin: false,
      code: 'ACCOUNT_SUSPENDED',
      error: 'Your account is suspended and cannot create or manage shop profiles.',
    };
  }
  const isAdmin = isAdminIdentity(params);
  const ownsAnyShop = params.existingShops.some((s) => s.ownerUid === uid);
  const isSeller = isAdmin || params.userProfile?.role === 'seller' || ownsAnyShop;
  if (!isSeller) {
    return {
      allowed: false,
      status: 403,
      isAdmin: false,
      code: 'CUSTOMER_NOT_SELLER',
      error: 'Only registered sellers can create and manage shop profiles.',
    };
  }
  return { allowed: true, status: 200, isAdmin };
}

export function evaluateShopUpdateAuthorization(params: {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  userProfile?: Partial<UserProfile> | null;
  existingShop?: Shop | null;
}): ShopAuthCheckResult {
  const uid = (params.uid ?? '').trim();
  if (!uid) {
    return {
      allowed: false,
      status: 401,
      isAdmin: false,
      code: 'UNAUTHENTICATED',
      error: 'Authentication is required to edit a shop profile.',
    };
  }
  if (params.userProfile?.accountStatus === 'suspended') {
    return {
      allowed: false,
      status: 403,
      isAdmin: false,
      code: 'ACCOUNT_SUSPENDED',
      error: 'Your account is suspended and cannot modify shop profiles.',
    };
  }
  const isAdmin = isAdminIdentity(params);
  if (!params.existingShop) {
    return {
      allowed: false,
      status: 404,
      isAdmin,
      code: 'SHOP_NOT_FOUND',
      error: 'Shop profile not found.',
    };
  }
  if (!isAdmin && params.existingShop.ownerUid !== uid) {
    return {
      allowed: false,
      status: 403,
      isAdmin: false,
      code: 'SHOP_NOT_OWNED',
      error: 'You can only edit shop profiles owned by your seller account.',
    };
  }
  if (!isAdmin && params.existingShop.status === 'suspended') {
    return {
      allowed: false,
      status: 403,
      isAdmin: false,
      code: 'SHOP_SUSPENDED',
      error: 'This shop is currently suspended and cannot be updated.',
    };
  }
  return { allowed: true, status: 200, isAdmin };
}

function buildUniqueShopSlug(name: string, shopId: string, existingShops: Shop[]): string {
  const baseSlug = buildShopSlug(name, shopId);
  const taken = new Set(
    existingShops
      .filter((s) => s.shopId !== shopId)
      .map((s) => (s.slug || '').trim().toLowerCase())
  );
  if (!taken.has(baseSlug)) return baseSlug;
  const suffix = shopId.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toLowerCase() || String(Date.now()).slice(-4);
  return `${baseSlug.slice(0, 56)}-${suffix}`;
}

export function buildCreatedShopDocument(params: {
  input: ShopProfileValidationInput & { shopId?: string };
  uid: string;
  isAdmin: boolean;
  accountPhone?: string | null;
  existingShops: Shop[];
  defaultLogoUrl?: string;
  defaultCoverUrl?: string;
  now?: string;
}):
  | { ok: true; shop: Shop }
  | { ok: false; status: number; error: string; fieldErrors: Record<string, string> } {
  const effectiveAccountPhone =
    (params.accountPhone ?? '').trim() || (params.input.phoneNumber ?? '').trim();

  const validation = validateShopProfilePayload({
    ...params.input,
    phoneNumber: effectiveAccountPhone,
  });

  if (!validation.valid || !validation.normalized) {
    return {
      ok: false,
      status: 400,
      error: Object.values(validation.errors)[0] || 'Invalid shop profile details.',
      fieldErrors: validation.errors,
    };
  }

  const normalized = validation.normalized;
  const now = params.now ?? new Date().toISOString();
  const requestedId = (params.input.shopId ?? '').trim();
  const shopId =
    requestedId && /^[a-zA-Z0-9_-]{3,128}$/.test(requestedId)
      ? requestedId
      : `shop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  if (params.existingShops.some((s) => s.shopId === shopId)) {
    return {
      ok: false,
      status: 409,
      error: 'A shop profile with this ID already exists.',
      fieldErrors: { shopId: 'Duplicate shop ID.' },
    };
  }

  const slug = buildUniqueShopSlug(normalized.name, shopId, params.existingShops);
  // Non-admin newly created shops always begin pending/unverified until approved via merchant verification.
  const status: Shop['status'] = params.isAdmin ? 'approved' : 'pending';
  const verificationStatus: Shop['verificationStatus'] = params.isAdmin ? 'approved' : 'unverified';
  const isPublished = params.isAdmin ? normalized.availabilityStatus !== 'inactive' : false;

  const shop: Shop = {
    shopId,
    ownerUid: params.uid,
    name: normalized.name,
    slug,
    description: normalized.description,
    logoUrl: normalized.logoUrl || params.defaultLogoUrl || '/assets/aistudio/image_703e5fa8.png',
    coverImageUrl: normalized.coverImageUrl ?? params.defaultCoverUrl ?? '',
    phoneNumber: normalized.phoneNumber,
    ...(normalized.businessPhoneNumber ? { businessPhoneNumber: normalized.businessPhoneNumber } : {}),
    publishBusinessPhone: normalized.publishBusinessPhone,
    preferredContactMethod: normalized.preferredContactMethod,
    mainCategory: normalized.mainCategory,
    productTypes: normalized.productTypes,
    region: normalized.region,
    city: normalized.city,
    ...(normalized.subCity ? { subCity: normalized.subCity } : {}),
    neighborhood: normalized.neighborhood,
    address: normalized.address,
    ...(normalized.latitude !== undefined && normalized.longitude !== undefined
      ? { latitude: normalized.latitude, longitude: normalized.longitude }
      : {}),
    ...(normalized.operatingHours ? { operatingHours: normalized.operatingHours } : {}),
    deliveryAvailable: normalized.deliveryAvailable,
    pickupAvailable: normalized.pickupAvailable,
    status,
    verificationStatus,
    availabilityStatus: normalized.availabilityStatus,
    isPublished,
    traderType: normalized.mainCategory === 'coffee' ? 'coffee' : 'general',
    rating: 0,
    reviewCount: 0,
    featured: false,
    createdAt: now,
    updatedAt: now,
  };

  return { ok: true, shop };
}

export function buildUpdatedShopDocument(params: {
  existingShop: Shop;
  input: ShopProfileValidationInput & { isPublished?: boolean };
  isAdmin: boolean;
  accountPhone?: string | null;
  verification?: MerchantVerification | null;
  existingShops: Shop[];
  now?: string;
}):
  | { ok: true; shop: Shop }
  | { ok: false; status: number; error: string; fieldErrors?: Record<string, string> } {
  const mergedInput: ShopProfileValidationInput = {
    name: params.input.name ?? params.existingShop.name,
    mainCategory: params.input.mainCategory ?? params.existingShop.mainCategory ?? (params.existingShop.traderType === 'coffee' ? 'coffee' : 'other'),
    productTypes: params.input.productTypes ?? params.existingShop.productTypes ?? [params.existingShop.name],
    description: params.input.description ?? params.existingShop.description,
    region: params.input.region ?? params.existingShop.region ?? 'Sidama Region',
    city: params.input.city ?? params.existingShop.city ?? 'Hawassa',
    subCity: params.input.subCity ?? params.existingShop.subCity,
    neighborhood: params.input.neighborhood ?? params.existingShop.neighborhood,
    address: params.input.address ?? params.existingShop.address,
    latitude: params.input.latitude !== undefined ? params.input.latitude : params.existingShop.latitude,
    longitude: params.input.longitude !== undefined ? params.input.longitude : params.existingShop.longitude,
    operatingHours:
      params.input.operatingHours !== undefined
        ? params.input.operatingHours
        : params.existingShop.operatingHours,
    phoneNumber:
      (params.accountPhone ?? '').trim() ||
      (params.input.phoneNumber ?? '').trim() ||
      params.existingShop.phoneNumber,
    businessPhoneNumber:
      params.input.businessPhoneNumber !== undefined
        ? params.input.businessPhoneNumber
        : params.existingShop.businessPhoneNumber,
    publishBusinessPhone:
      params.input.publishBusinessPhone !== undefined
        ? params.input.publishBusinessPhone
        : params.existingShop.publishBusinessPhone,
    preferredContactMethod:
      params.input.preferredContactMethod ?? params.existingShop.preferredContactMethod ?? 'both',
    availabilityStatus:
      params.input.availabilityStatus ?? getShopAvailabilityStatus(params.existingShop),
    logoUrl: params.input.logoUrl !== undefined ? params.input.logoUrl : params.existingShop.logoUrl,
    coverImageUrl:
      params.input.coverImageUrl !== undefined
        ? params.input.coverImageUrl
        : params.existingShop.coverImageUrl,
    deliveryAvailable:
      params.input.deliveryAvailable !== undefined
        ? params.input.deliveryAvailable
        : params.existingShop.deliveryAvailable,
    pickupAvailable:
      params.input.pickupAvailable !== undefined
        ? params.input.pickupAvailable
        : params.existingShop.pickupAvailable,
  };

  const validation = validateShopProfilePayload(mergedInput);
  if (!validation.valid || !validation.normalized) {
    return {
      ok: false,
      status: 400,
      error: Object.values(validation.errors)[0] || 'Invalid shop profile update.',
      fieldErrors: validation.errors,
    };
  }

  const normalized = validation.normalized;
  const isVerifiedShop =
    params.isAdmin || canShopListProducts(params.existingShop, params.verification);

  const requestedPublish =
    params.input.isPublished !== undefined
      ? Boolean(params.input.isPublished)
      : params.existingShop.isPublished ?? isVerifiedShop;

  if (requestedPublish && !isVerifiedShop) {
    return {
      ok: false,
      status: 403,
      error:
        'Only verified sellers can publish a shop profile to Discover Shops. Complete merchant verification first.',
    };
  }

  const now = params.now ?? new Date().toISOString();
  const slug = buildUniqueShopSlug(
    normalized.name,
    params.existingShop.shopId,
    params.existingShops
  );

  const updated: Shop = {
    ...params.existingShop,
    name: normalized.name,
    slug,
    description: normalized.description,
    logoUrl: normalized.logoUrl ?? params.existingShop.logoUrl,
    coverImageUrl: normalized.coverImageUrl ?? params.existingShop.coverImageUrl,
    phoneNumber: normalized.phoneNumber,
    ...(normalized.businessPhoneNumber
      ? { businessPhoneNumber: normalized.businessPhoneNumber }
      : {}),
    publishBusinessPhone: normalized.publishBusinessPhone,
    preferredContactMethod: normalized.preferredContactMethod,
    mainCategory: normalized.mainCategory,
    productTypes: normalized.productTypes,
    region: normalized.region,
    city: normalized.city,
    ...(normalized.subCity ? { subCity: normalized.subCity } : {}),
    neighborhood: normalized.neighborhood,
    address: normalized.address,
    ...(normalized.latitude !== undefined && normalized.longitude !== undefined
      ? { latitude: normalized.latitude, longitude: normalized.longitude }
      : {}),
    ...(normalized.operatingHours ? { operatingHours: normalized.operatingHours } : {}),
    deliveryAvailable: normalized.deliveryAvailable,
    pickupAvailable: normalized.pickupAvailable,
    availabilityStatus: normalized.availabilityStatus,
    isPublished: normalized.availabilityStatus === 'inactive' ? false : requestedPublish && isVerifiedShop,
    traderType: normalized.mainCategory === 'coffee' ? 'coffee' : 'general',
    // Strictly preserve moderation/admin-controlled fields
    shopId: params.existingShop.shopId,
    ownerUid: params.existingShop.ownerUid,
    status: params.existingShop.status,
    verificationStatus: params.existingShop.verificationStatus,
    rating: params.existingShop.rating,
    reviewCount: params.existingShop.reviewCount,
    featured: params.existingShop.featured,
    ...(params.existingShop.suspensionReason
      ? { suspensionReason: params.existingShop.suspensionReason }
      : {}),
    createdAt: params.existingShop.createdAt,
    updatedAt: now,
  };

  if (!normalized.businessPhoneNumber) {
    delete updated.businessPhoneNumber;
  }
  if (!normalized.subCity) {
    delete updated.subCity;
  }
  if (!normalized.operatingHours) {
    delete updated.operatingHours;
  }

  return { ok: true, shop: updated };
}

export function buildStatusUpdatedShopDocument(params: {
  existingShop: Shop;
  availabilityStatus?: string;
  isPublished?: boolean;
  isAdmin: boolean;
  verification?: MerchantVerification | null;
  now?: string;
}): { ok: true; shop: Shop } | { ok: false; status: number; error: string } {
  const nextStatus = (params.availabilityStatus ?? '').trim().toLowerCase() as ShopAvailabilityStatus;
  if (!SHOP_AVAILABILITY_STATUSES.includes(nextStatus)) {
    return {
      ok: false,
      status: 400,
      error: 'availabilityStatus must be one of: active, temporarily_closed, inactive.',
    };
  }

  const isVerifiedShop =
    params.isAdmin || canShopListProducts(params.existingShop, params.verification);

  const wantsPublicActivation =
    params.isPublished === true ||
    (params.isPublished === undefined && nextStatus !== 'inactive');

  if (wantsPublicActivation && !isVerifiedShop) {
    return {
      ok: false,
      status: 403,
      error:
        'Only verified sellers can activate and publish a shop profile in Discover Shops. Complete verification first.',
    };
  }

  const nextPublished =
    nextStatus === 'inactive'
      ? false
      : params.isPublished !== undefined
        ? Boolean(params.isPublished) && isVerifiedShop
        : isVerifiedShop;

  return {
    ok: true,
    shop: {
      ...params.existingShop,
      availabilityStatus: nextStatus,
      isPublished: nextPublished,
      updatedAt: params.now ?? new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Express Route Handlers
// ---------------------------------------------------------------------------

export async function handleListPublicShops(req: Request, res: Response) {
  try {
    const searchQuery =
      typeof req.query.q === 'string'
        ? req.query.q
        : typeof req.query.search === 'string'
          ? req.query.search
          : '';
    const category = typeof req.query.category === 'string' ? req.query.category : 'all';
    const location =
      typeof req.query.location === 'string'
        ? req.query.location
        : typeof req.query.neighborhood === 'string'
          ? req.query.neighborhood
          : 'All Hawassa';
    const rawAvailability =
      typeof req.query.availability === 'string' ? req.query.availability : 'all';
    const availability: 'all' | 'active' | 'temporarily_closed' =
      rawAvailability === 'active' || rawAvailability === 'temporarily_closed'
        ? rawAvailability
        : 'all';
    const rawSort = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'featured';
    const sortBy: 'featured' | 'rating' | 'newest' =
      rawSort === 'rating' || rawSort === 'newest' ? rawSort : 'featured';
    const page = Number(req.query.page ?? 1) || 1;
    const pageSize = Number(req.query.pageSize ?? req.query.limit ?? 12) || 12;

    const [shops, products] = await Promise.all([
      firestoreListCollection<Shop>('shops', 'shopId'),
      firestoreListCollection<Product>('products', 'productId').catch(() => [] as Product[]),
    ]);

    const productsByShop = new Map<string, Product[]>();
    for (const p of products) {
      if (p.status !== 'active') continue;
      const list = productsByShop.get(p.shopId);
      if (list) list.push(p);
      else productsByShop.set(p.shopId, [p]);
    }

    const result = filterAndPaginateDiscoverShops(shops, products, {
      searchQuery,
      category,
      location,
      availability,
      strictShopVerification: true,
      sortBy,
      page,
      pageSize,
    });

    const sanitized: PublicShopDirectoryItem[] = result.items.map((shop) =>
      sanitizePublicShopProfile(shop, productsByShop.get(shop.shopId) ?? [])
    );

    return res.json({
      shops: sanitized,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        hasMore: result.hasMore,
      },
      categories: SHOP_DIRECTORY_CATEGORIES,
    });
  } catch (error) {
    console.error('Public shop directory query error:', error);
    return res.status(500).json({ error: 'Unable to load Discover Shops directory right now.' });
  }
}

export async function handleGetPublicShopById(req: Request, res: Response) {
  try {
    const shopId = (req.params.shopId ?? '').trim();
    if (!shopId || !/^[a-zA-Z0-9_-]{1,128}$/.test(shopId)) {
      return res.status(400).json({ error: 'Invalid shop ID.' });
    }

    const shop = await firestoreGetDoc<Shop>('shops', shopId, 'shopId');
    if (!shop || !isShopPubliclyDiscoverable(shop, { strictShopVerification: true })) {
      return res.status(404).json({ error: 'Shop profile not found.' });
    }

    return res.json({
      shop: sanitizePublicShopProfile(shop),
    });
  } catch (error) {
    console.error('Public shop detail error:', error);
    return res.status(500).json({ error: 'Unable to load shop profile.' });
  }
}

export async function handleGetMyShops(req: AuthRequest, res: Response) {
  try {
    const uid = req.user?.uid;
    const idToken = extractBearerToken(req);
    if (!uid || !idToken) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const [userProfile, allShops] = await Promise.all([
      firestoreGetDoc<UserProfile>('users', uid, 'uid', idToken),
      firestoreListCollection<Shop>('shops', 'shopId', idToken),
    ]);

    const isAdmin = isAdminIdentity({
      email: req.user?.email,
      emailVerified: req.user?.email_verified,
      userProfile,
    });

    const ownedShops = isAdmin ? allShops : allShops.filter((s) => s.ownerUid === uid);
    const verificationByShopId: Record<string, string> = {};

    await Promise.all(
      ownedShops.map(async (shop) => {
        const verification = await firestoreGetDoc<MerchantVerification>(
          'merchant_verifications',
          shop.shopId,
          'verificationId',
          idToken
        );
        verificationByShopId[shop.shopId] = getEffectiveShopVerificationStatus(shop, verification);
      })
    );

    const registeredPhoneNumber =
      (userProfile?.phoneNumber ?? '').trim() ||
      (typeof req.user?.phone_number === 'string' ? req.user.phone_number.trim() : '');

    return res.json({
      uid,
      role: userProfile?.role ?? 'customer',
      isAdmin,
      isSeller: isAdmin || userProfile?.role === 'seller' || ownedShops.length > 0,
      accountStatus: userProfile?.accountStatus ?? 'active',
      registeredPhoneNumber: registeredPhoneNumber || null,
      shops: ownedShops,
      verificationByShopId,
    });
  } catch (error) {
    console.error('Fetch seller shops error:', error);
    return res.status(500).json({ error: 'Unable to load your shop profiles.' });
  }
}

export async function handleCreateShopProfile(req: AuthRequest, res: Response) {
  try {
    const uid = req.user?.uid;
    const idToken = extractBearerToken(req);
    if (!uid || !idToken) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const [userProfile, allShops] = await Promise.all([
      firestoreGetDoc<UserProfile>('users', uid, 'uid', idToken),
      firestoreListCollection<Shop>('shops', 'shopId', idToken),
    ]);

    const authCheck = evaluateShopCreateAuthorization({
      uid,
      email: req.user?.email,
      emailVerified: req.user?.email_verified,
      userProfile,
      existingShops: allShops,
    });

    if (!authCheck.allowed) {
      return res.status(authCheck.status).json({
        error: authCheck.error,
        code: authCheck.code,
      });
    }

    const registeredAccountPhone =
      (userProfile?.phoneNumber ?? '').trim() ||
      (typeof req.user?.phone_number === 'string' ? req.user.phone_number.trim() : '');

    const built = buildCreatedShopDocument({
      input: (req.body ?? {}) as ShopProfileValidationInput & { shopId?: string },
      uid,
      isAdmin: authCheck.isAdmin,
      accountPhone: registeredAccountPhone,
      existingShops: allShops,
    });

    if (built.ok === false) {
      return res.status(built.status).json({
        error: built.error,
        fieldErrors: built.fieldErrors,
      });
    }

    await firestoreWriteShopDoc(built.shop, idToken, 'create');

    return res.status(201).json({
      shop: built.shop,
      publicProfile: sanitizePublicShopProfile(built.shop),
      verificationRequired: !isVerifiedMerchantShop(built.shop),
    });
  } catch (error) {
    console.error('Create shop profile error:', error);
    const status = (error as { status?: number })?.status ?? 500;
    return res.status(status).json({
      error: error instanceof Error ? error.message : 'Unable to create shop profile.',
    });
  }
}

export async function handleUpdateShopProfile(req: AuthRequest, res: Response) {
  try {
    const uid = req.user?.uid;
    const idToken = extractBearerToken(req);
    const shopId = (req.params.shopId ?? '').trim();
    if (!uid || !idToken) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!shopId || !/^[a-zA-Z0-9_-]{1,128}$/.test(shopId)) {
      return res.status(400).json({ error: 'Invalid shop ID.' });
    }

    const [userProfile, allShops, verification] = await Promise.all([
      firestoreGetDoc<UserProfile>('users', uid, 'uid', idToken),
      firestoreListCollection<Shop>('shops', 'shopId', idToken),
      firestoreGetDoc<MerchantVerification>('merchant_verifications', shopId, 'verificationId', idToken),
    ]);

    const existingShop = allShops.find((s) => s.shopId === shopId) ?? null;

    const authCheck = evaluateShopUpdateAuthorization({
      uid,
      email: req.user?.email,
      emailVerified: req.user?.email_verified,
      userProfile,
      existingShop,
    });

    if (!authCheck.allowed || !existingShop) {
      return res.status(authCheck.status).json({
        error: authCheck.error,
        code: authCheck.code,
      });
    }

    const registeredAccountPhone =
      (userProfile?.phoneNumber ?? '').trim() ||
      (typeof req.user?.phone_number === 'string' ? req.user.phone_number.trim() : '');

    const built = buildUpdatedShopDocument({
      existingShop,
      input: (req.body ?? {}) as ShopProfileValidationInput & { isPublished?: boolean },
      isAdmin: authCheck.isAdmin,
      accountPhone: registeredAccountPhone,
      verification,
      existingShops: allShops,
    });

    if (built.ok === false) {
      return res.status(built.status).json({
        error: built.error,
        fieldErrors: built.fieldErrors,
      });
    }

    await firestoreWriteShopDoc(built.shop, idToken, 'update');

    return res.json({
      shop: built.shop,
      publicProfile: sanitizePublicShopProfile(built.shop),
    });
  } catch (error) {
    console.error('Update shop profile error:', error);
    const status = (error as { status?: number })?.status ?? 500;
    return res.status(status).json({
      error: error instanceof Error ? error.message : 'Unable to update shop profile.',
    });
  }
}

export async function handleUpdateShopAvailabilityStatus(req: AuthRequest, res: Response) {
  try {
    const uid = req.user?.uid;
    const idToken = extractBearerToken(req);
    const shopId = (req.params.shopId ?? '').trim();
    if (!uid || !idToken) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!shopId || !/^[a-zA-Z0-9_-]{1,128}$/.test(shopId)) {
      return res.status(400).json({ error: 'Invalid shop ID.' });
    }

    const [userProfile, existingShop, verification] = await Promise.all([
      firestoreGetDoc<UserProfile>('users', uid, 'uid', idToken),
      firestoreGetDoc<Shop>('shops', shopId, 'shopId', idToken),
      firestoreGetDoc<MerchantVerification>('merchant_verifications', shopId, 'verificationId', idToken),
    ]);

    const authCheck = evaluateShopUpdateAuthorization({
      uid,
      email: req.user?.email,
      emailVerified: req.user?.email_verified,
      userProfile,
      existingShop,
    });

    if (!authCheck.allowed || !existingShop) {
      return res.status(authCheck.status).json({
        error: authCheck.error,
        code: authCheck.code,
      });
    }

    const body = (req.body ?? {}) as {
      availabilityStatus?: string;
      isPublished?: boolean;
    };

    const built = buildStatusUpdatedShopDocument({
      existingShop,
      availabilityStatus: body.availabilityStatus,
      isPublished: body.isPublished,
      isAdmin: authCheck.isAdmin,
      verification,
    });

    if (built.ok === false) {
      return res.status(built.status).json({ error: built.error });
    }

    await firestoreWriteShopDoc(built.shop, idToken, 'update');

    return res.json({
      shop: built.shop,
      publicProfile: sanitizePublicShopProfile(built.shop),
    });
  } catch (error) {
    console.error('Update shop status error:', error);
    const status = (error as { status?: number })?.status ?? 500;
    return res.status(status).json({
      error: error instanceof Error ? error.message : 'Unable to update shop availability status.',
    });
  }
}
