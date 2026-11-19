import type { Request, Response } from 'express';
import { loadFirebaseAppletConfig } from '../lib/firebaseConfigLoader.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import type { CoffeeProductDetails, Product, ProductVariant } from '../types/index.ts';
import {
  CANONICAL_COFFEE_CATEGORY,
  classifyProductCoffeeCategory,
  normalizeProductCategory,
  planCoffeeProductMigration,
  type CoffeeCategorizationResult,
} from '../utils/coffeeCategorizer.ts';
import { verifySellerFromFirestore } from './sellerAuth.ts';

const firebaseConfig = loadFirebaseAppletConfig();
const FIRESTORE_PROJECT_ID = firebaseConfig.projectId;
const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId || '(default)';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{2,128}$/;
const VALID_ROAST_LEVELS = new Set(['light', 'medium', 'medium_dark', 'dark']);
const VALID_PROCESS_METHODS = new Set(['washed', 'natural', 'honey', 'anaerobic']);
const VALID_BEAN_FORMS = new Set(['whole_bean', 'ground']);
const VALID_PRODUCT_STATUSES = new Set(['active', 'archived', 'pending_review']);
const DATA_IMAGE_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export interface ProductWriteRequestBody {
  productId?: string;
  shopId?: string;
  shopName?: string;
  name?: string;
  description?: string;
  category?: string;
  productType?: string;
  price?: number;
  previousPrice?: number;
  stock?: number;
  isAvailable?: boolean;
  imageUrl?: string;
  additionalImages?: string[];
  variants?: ProductVariant[];
  coffeeDetails?: CoffeeProductDetails;
  pickupAvailable?: boolean;
  deliveryAvailable?: boolean;
  status?: 'active' | 'archived' | 'pending_review';
  rating?: number;
  reviewCount?: number;
  createdAt?: string;
  updatedAt?: string;
  categoryConfirmed?: boolean;
  confirmedCategory?: string;
}

export interface ProductWriteValidationSuccess {
  ok: true;
  product: Product;
  categorization: CoffeeCategorizationResult;
}

export interface ProductWriteValidationFailure {
  ok: false;
  status: number;
  code:
    | 'INVALID_PAYLOAD'
    | 'CATEGORY_CONFLICT'
    | 'CATEGORY_CONFIRMATION_REQUIRED';
  error: string;
  categorization?: CoffeeCategorizationResult;
}

export type ProductWriteValidationResult =
  | ProductWriteValidationSuccess
  | ProductWriteValidationFailure;

function isValidImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) {
    return trimmed.length >= 32 && trimmed.length <= 205000 && DATA_IMAGE_REGEX.test(trimmed);
  }
  return (
    trimmed.length >= 1 &&
    trimmed.length <= 2048 &&
    (trimmed.startsWith('https://') || trimmed.startsWith('/'))
  );
}

function sanitizeCoffeeDetails(
  raw?: Partial<CoffeeProductDetails>,
  inferred?: Partial<CoffeeProductDetails>
): CoffeeProductDetails | undefined {
  const merged: Partial<CoffeeProductDetails> = {
    ...(inferred ?? {}),
    ...(raw ?? {}),
  };
  const clean: CoffeeProductDetails = {};

  if (typeof merged.origin === 'string' && merged.origin.trim()) {
    clean.origin = merged.origin.trim().slice(0, 80);
  }
  if (typeof merged.brand === 'string' && merged.brand.trim()) {
    clean.brand = merged.brand.trim().slice(0, 80);
  }
  if (typeof merged.roastLevel === 'string' && VALID_ROAST_LEVELS.has(merged.roastLevel)) {
    clean.roastLevel = merged.roastLevel as CoffeeProductDetails['roastLevel'];
  }
  if (
    typeof merged.processingMethod === 'string' &&
    VALID_PROCESS_METHODS.has(merged.processingMethod)
  ) {
    clean.processingMethod = merged.processingMethod as CoffeeProductDetails['processingMethod'];
  }
  if (typeof merged.beanForm === 'string' && VALID_BEAN_FORMS.has(merged.beanForm)) {
    clean.beanForm = merged.beanForm as CoffeeProductDetails['beanForm'];
  }
  if (typeof merged.packageWeight === 'string' && merged.packageWeight.trim()) {
    clean.packageWeight = merged.packageWeight.trim().slice(0, 32);
  }
  if (
    typeof merged.roastDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(merged.roastDate.trim())
  ) {
    clean.roastDate = merged.roastDate.trim();
  }

  return Object.keys(clean).length > 0 ? clean : undefined;
}

/**
 * Authoritative backend validation + automatic coffee categorization for both
 * product creation (`POST /api/products`) and updates (`PUT /api/products/:productId`).
 *
 * - Enforces canonical lowercase category slugs (e.g., `Coffee`, `COFFEE`,
 *   `Roasted Coffee`, `Ethiopian Coffee`, `Ground Coffee` -> `'coffee'`).
 * - Prevents sellers from bypassing categorization by submitting a conflicting
 *   category directly to the API (returns HTTP 400 `CATEGORY_CONFLICT`).
 * - Requires explicit seller confirmation for ambiguous items (returns HTTP 409
 *   `CATEGORY_CONFIRMATION_REQUIRED`).
 * - Preserves existing shopId, ownership, ratings, reviewCount, and createdAt on edits.
 * - Automatically removes `coffeeDetails` when a coffee product is edited into a
 *   non-coffee category.
 */
export function validateAndPrepareProductWrite(
  body: ProductWriteRequestBody,
  options: {
    mode: 'create' | 'update';
    existingProduct?: Product | null;
    productIdOverride?: string;
    nowIso?: string;
  }
): ProductWriteValidationResult {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const existing = options.existingProduct ?? null;

  const productId = (
    options.productIdOverride ??
    body.productId ??
    existing?.productId ??
    `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  ).trim();

  if (!VALID_ID_REGEX.test(productId)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_PAYLOAD',
      error: 'Invalid productId format.',
    };
  }

  const shopId = (
    options.mode === 'update' && existing ? existing.shopId : body.shopId ?? ''
  ).trim();
  if (!VALID_ID_REGEX.test(shopId)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_PAYLOAD',
      error: 'A valid shopId is required.',
    };
  }

  const shopName = (body.shopName ?? existing?.shopName ?? '').trim().slice(0, 120);
  if (!shopName) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_PAYLOAD',
      error: 'shopName is required.',
    };
  }

  const name = (body.name ?? existing?.name ?? '').trim();
  if (name.length < 3 || name.length > 140) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_PAYLOAD',
      error: 'Product name must be between 3 and 140 characters.',
    };
  }

  const description = (body.description ?? existing?.description ?? '').trim();
  if (description.length < 5 || description.length > 2000) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_PAYLOAD',
      error: 'Product description must be between 5 and 2000 characters.',
    };
  }

  const rawProductType =
    body.productType !== undefined
      ? body.productType
      : options.mode === 'update'
        ? existing?.productType
        : undefined;
  const productType =
    typeof rawProductType === 'string' && rawProductType.trim().length > 0
      ? rawProductType.trim().slice(0, 60)
      : undefined;

  const price = Number(body.price ?? existing?.price);
  if (!Number.isFinite(price) || price <= 0 || price > 10_000_000) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_PAYLOAD',
      error: 'Product price must be a positive number in ETB.',
    };
  }

  const stock = Number(body.stock ?? existing?.stock);
  if (!Number.isFinite(stock) || stock < 0 || stock > 1_000_000) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_PAYLOAD',
      error: 'Stock quantity must be 0 or greater.',
    };
  }

  const imageUrl = (body.imageUrl ?? existing?.imageUrl ?? '').trim();
  if (!isValidImageUrl(imageUrl)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_PAYLOAD',
      error:
        'Product imageUrl must be a valid https:// URL, local asset path, or compressed image under 150 KB.',
    };
  }

  const pickupAvailable = Boolean(body.pickupAvailable ?? existing?.pickupAvailable ?? true);
  const deliveryAvailable = Boolean(body.deliveryAvailable ?? existing?.deliveryAvailable ?? true);
  if (!pickupAvailable && !deliveryAvailable) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_PAYLOAD',
      error: 'Enable at least one fulfillment method (delivery or pickup).',
    };
  }

  const requestedCategoryRaw = body.category ?? existing?.category ?? '';
  const categorization = classifyProductCoffeeCategory({
    name,
    category: requestedCategoryRaw,
    productType,
    coffeeDetails: body.coffeeDetails,
    categoryConfirmed: Boolean(body.categoryConfirmed),
    confirmedCategory: body.confirmedCategory,
  });

  if (categorization.outcome === 'conflict') {
    return {
      ok: false,
      status: 400,
      code: 'CATEGORY_CONFLICT',
      error: categorization.reason,
      categorization,
    };
  }

  if (categorization.outcome === 'ambiguous' && categorization.requiresConfirmation) {
    return {
      ok: false,
      status: 409,
      code: 'CATEGORY_CONFIRMATION_REQUIRED',
      error: categorization.reason,
      categorization,
    };
  }

  const resolvedCategory = normalizeProductCategory(categorization.resolvedCategory);
  if (!resolvedCategory || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(resolvedCategory)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_PAYLOAD',
      error: 'A valid product category is required.',
    };
  }

  const roundedPrice = Math.round(price);
  const rawPreviousPrice =
    body.previousPrice !== undefined ? Number(body.previousPrice) : existing?.previousPrice;
  const previousPrice =
    rawPreviousPrice !== undefined &&
    Number.isFinite(rawPreviousPrice) &&
    rawPreviousPrice > roundedPrice
      ? Math.round(rawPreviousPrice)
      : undefined;

  const flooredStock = Math.floor(stock);
  const isAvailable =
    body.isAvailable !== undefined ? Boolean(body.isAvailable) && flooredStock > 0 : flooredStock > 0;

  const rawStatus = body.status ?? existing?.status ?? 'active';
  const status = (
    VALID_PRODUCT_STATUSES.has(rawStatus) ? rawStatus : 'active'
  ) as Product['status'];

  const sanitizedCoffeeDetails =
    resolvedCategory === CANONICAL_COFFEE_CATEGORY
      ? sanitizeCoffeeDetails(
          body.coffeeDetails ?? (existing?.category === CANONICAL_COFFEE_CATEGORY ? existing.coffeeDetails : undefined),
          categorization.inferredCoffeeDetails
        )
      : undefined;

  const additionalImages = Array.isArray(body.additionalImages)
    ? body.additionalImages
        .filter((img): img is string => typeof img === 'string' && isValidImageUrl(img))
        .slice(0, 6)
    : existing?.additionalImages;

  const variants = Array.isArray(body.variants)
    ? body.variants
        .filter(
          (v): v is ProductVariant =>
            Boolean(v) &&
            typeof v.id === 'string' &&
            typeof v.label === 'string' &&
            Number.isFinite(v.price) &&
            v.price > 0
        )
        .slice(0, 12)
    : existing?.variants;

  const rating = existing?.rating ?? (typeof body.rating === 'number' ? body.rating : undefined);
  const reviewCount =
    existing?.reviewCount ?? (typeof body.reviewCount === 'number' ? body.reviewCount : undefined);

  const product: Product = {
    productId,
    shopId,
    shopName,
    name,
    description,
    category: resolvedCategory,
    ...(productType ? { productType } : {}),
    price: roundedPrice,
    ...(previousPrice !== undefined ? { previousPrice } : {}),
    stock: flooredStock,
    isAvailable,
    imageUrl,
    ...(additionalImages && additionalImages.length > 0 ? { additionalImages } : {}),
    ...(variants && variants.length > 0 ? { variants } : {}),
    ...(sanitizedCoffeeDetails ? { coffeeDetails: sanitizedCoffeeDetails } : {}),
    pickupAvailable,
    deliveryAvailable,
    status,
    ...(existing?.moderationReason ? { moderationReason: existing.moderationReason } : {}),
    ...(rating !== undefined ? { rating } : {}),
    ...(reviewCount !== undefined ? { reviewCount } : {}),
    createdAt: existing?.createdAt ?? body.createdAt ?? nowIso,
    updatedAt: nowIso,
  };

  return {
    ok: true,
    product,
    categorization,
  };
}

// ---------------------------------------------------------------------------
// Firestore REST API helpers authenticated with the caller's Firebase ID token
// (enforces firestore.rules natively without requiring Admin SDK IAM roles)
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

function encodeFirestoreValue(value: unknown): FirestoreValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined;
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    const encoded = value
      .map((item) => encodeFirestoreValue(item))
      .filter((item): item is FirestoreValue => item !== undefined);
    return { arrayValue: { values: encoded } };
  }
  if (typeof value === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
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

function productToFirestoreFields(product: Product): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(product as unknown as Record<string, unknown>)) {
    const encoded = encodeFirestoreValue(v);
    if (encoded !== undefined) {
      fields[k] = encoded;
    }
  }
  return fields;
}

function firestoreDocToProduct(doc: FirestoreDocumentResponse): Product | null {
  if (!doc.fields) return null;
  const raw: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    raw[k] = decodeFirestoreValue(v);
  }
  if (typeof raw.productId !== 'string' && typeof doc.name === 'string') {
    raw.productId = doc.name.split('/').pop() ?? '';
  }
  if (typeof raw.productId !== 'string' || !raw.productId) return null;
  return raw as unknown as Product;
}

function firestoreProductsBaseUrl(): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIRESTORE_PROJECT_ID
  )}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents/products`;
}

export function extractBearerToken(req: Request): string {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export async function firestoreRestGetProduct(
  productId: string,
  idToken: string
): Promise<Product | null> {
  const url = `${firestoreProductsBaseUrl()}/${encodeURIComponent(productId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: 'application/json',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firestore read failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as FirestoreDocumentResponse;
  return firestoreDocToProduct(json);
}

export async function firestoreRestUpsertProduct(
  product: Product,
  idToken: string
): Promise<void> {
  const url = `${firestoreProductsBaseUrl()}/${encodeURIComponent(product.productId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      fields: productToFirestoreFields(product),
    }),
  });
  if (!res.ok) {
    let message = `Firestore write rejected (${res.status}).`;
    try {
      const errJson = (await res.json()) as { error?: { message?: string; status?: string } };
      if (errJson.error?.status === 'PERMISSION_DENIED') {
        message =
          'Permission denied: ensure your virtual shop is approved/verified and owned by your account.';
      } else if (errJson.error?.message) {
        message = errJson.error.message;
      }
    } catch {
      // ignore parse failure
    }
    const err = new Error(message) as Error & { statusCode?: number };
    err.statusCode = res.status === 403 ? 403 : 502;
    throw err;
  }
}

async function firestoreRestListAllProducts(idToken: string): Promise<Product[]> {
  const products: Product[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const query = new URLSearchParams({ pageSize: '200' });
    if (pageToken) query.set('pageToken', pageToken);
    const url = `${firestoreProductsBaseUrl()}?${query.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Firestore list failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      documents?: FirestoreDocumentResponse[];
      nextPageToken?: string;
    };
    for (const doc of json.documents ?? []) {
      const parsed = firestoreDocToProduct(doc);
      if (parsed) products.push(parsed);
    }
    pageToken = json.nextPageToken;
    pages += 1;
  } while (pageToken && pages < 15);

  return products;
}

// ---------------------------------------------------------------------------
// Express route handlers
// ---------------------------------------------------------------------------

export function handleCategorizeProductPreview(req: AuthRequest, res: Response) {
  const body = (req.body ?? {}) as ProductWriteRequestBody;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const productType = typeof body.productType === 'string' ? body.productType.trim() : '';

  if (!name && !category && !productType) {
    return res.status(400).json({
      error: 'Provide at least name, category, or productType to classify.',
    });
  }

  const categorization = classifyProductCoffeeCategory({
    name,
    category,
    productType,
    coffeeDetails: body.coffeeDetails,
    categoryConfirmed: Boolean(body.categoryConfirmed),
    confirmedCategory: body.confirmedCategory,
  });

  return res.json({ categorization });
}

export async function handleCreateProduct(req: AuthRequest, res: Response) {
  const idToken = extractBearerToken(req);
  const body = (req.body ?? {}) as ProductWriteRequestBody;

  const sellerCheck = await verifySellerFromFirestore({
    uid: req.user!.uid,
    email: req.user!.email,
    emailVerified: req.user!.email_verified,
    idToken,
    requestedShopId: typeof body.shopId === 'string' ? body.shopId.trim() : undefined,
  });

  if (!sellerCheck.authorized || !sellerCheck.activeShop) {
    return res.status(403).json({
      code: sellerCheck.code ?? 'SELLER_NOT_VERIFIED',
      error:
        sellerCheck.reason ??
        'Only verified sellers can publish products on Affin Connect.',
      verificationStatus: sellerCheck.verificationStatus,
    });
  }

  const validation = validateAndPrepareProductWrite(
    {
      ...body,
      shopId: sellerCheck.activeShop.shopId,
      shopName: sellerCheck.activeShop.name,
    },
    {
      mode: 'create',
    }
  );

  if (!validation.ok) {
    return res.status(validation.status).json({
      code: validation.code,
      error: validation.error,
      categorization: validation.categorization,
    });
  }

  try {
    await firestoreRestUpsertProduct(validation.product, idToken);
    return res.status(201).json({
      product: validation.product,
      categorization: validation.categorization,
    });
  } catch (err) {
    const statusCode =
      typeof (err as { statusCode?: number }).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : 500;
    return res.status(statusCode).json({
      error: err instanceof Error ? err.message : 'Unable to save product.',
    });
  }
}

export async function handleUpdateProduct(req: AuthRequest, res: Response) {
  const idToken = extractBearerToken(req);
  const productId = String(req.params.productId ?? '').trim();
  const body = (req.body ?? {}) as ProductWriteRequestBody;

  if (!VALID_ID_REGEX.test(productId)) {
    return res.status(400).json({
      code: 'INVALID_PAYLOAD',
      error: 'Invalid productId parameter.',
    });
  }

  let existingProduct: Product | null = null;
  try {
    existingProduct = await firestoreRestGetProduct(productId, idToken);
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : 'Unable to fetch existing product.',
    });
  }

  const targetShopId = existingProduct?.shopId ?? (typeof body.shopId === 'string' ? body.shopId.trim() : undefined);
  const sellerCheck = await verifySellerFromFirestore({
    uid: req.user!.uid,
    email: req.user!.email,
    emailVerified: req.user!.email_verified,
    idToken,
    requestedShopId: targetShopId,
  });

  if (!sellerCheck.authorized || !sellerCheck.activeShop) {
    return res.status(403).json({
      code: sellerCheck.code ?? 'SELLER_NOT_VERIFIED',
      error:
        sellerCheck.reason ??
        'Only verified sellers can edit products on Affin Connect.',
      verificationStatus: sellerCheck.verificationStatus,
    });
  }

  const validation = validateAndPrepareProductWrite(
    {
      ...body,
      shopId: sellerCheck.activeShop.shopId,
      shopName: sellerCheck.activeShop.name,
    },
    {
      mode: existingProduct ? 'update' : 'create',
      existingProduct,
      productIdOverride: productId,
    }
  );

  if (!validation.ok) {
    return res.status(validation.status).json({
      code: validation.code,
      error: validation.error,
      categorization: validation.categorization,
    });
  }

  try {
    await firestoreRestUpsertProduct(validation.product, idToken);
    return res.status(200).json({
      product: validation.product,
      categorization: validation.categorization,
    });
  } catch (err) {
    const statusCode =
      typeof (err as { statusCode?: number }).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : 500;
    return res.status(statusCode).json({
      error: err instanceof Error ? err.message : 'Unable to update product.',
    });
  }
}

export async function handleMigrateCoffeeProducts(req: AuthRequest, res: Response) {
  const idToken = extractBearerToken(req);
  const dryRun = Boolean((req.body as { dryRun?: boolean } | undefined)?.dryRun);

  try {
    const existingProducts = await firestoreRestListAllProducts(idToken);
    const plan = planCoffeeProductMigration(existingProducts);

    let updated = 0;
    const failed: { productId: string; error: string }[] = [];

    if (!dryRun) {
      for (const change of plan.changes) {
        try {
          await firestoreRestUpsertProduct(change.updatedProduct, idToken);
          updated += 1;
        } catch (err) {
          failed.push({
            productId: change.productId,
            error: err instanceof Error ? err.message : 'Permission denied or write failed.',
          });
        }
      }
    }

    return res.status(200).json({
      dryRun,
      scanned: plan.scanned,
      alreadyCategorized: plan.alreadyCategorized,
      eligible: plan.eligible,
      updated,
      skipped: plan.skipped,
      ambiguous: plan.ambiguous,
      failed,
      changes: plan.changes.map((c) => ({
        productId: c.productId,
        name: c.name,
        previousCategory: c.previousCategory,
        nextCategory: c.nextCategory,
        reason: c.reason,
      })),
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : 'Unable to run coffee product migration.',
    });
  }
}
