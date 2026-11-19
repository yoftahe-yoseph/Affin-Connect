import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.ts';
import type {
  CoffeeBeanForm,
  CoffeeProcessMethod,
  CoffeeProductDetails,
  CoffeeRoastLevel,
  Product,
} from '../types/index.ts';
import {
  CANONICAL_COFFEE_CATEGORY,
  classifyProductCoffeeCategory,
  normalizeProductCategory,
  type CoffeeCategorizationResult,
} from '../utils/coffeeCategorizer.ts';
import {
  MAX_IMAGE_FILE_BYTES,
  MAX_IMAGE_UPLOAD_DATA_URL_LENGTH,
  validateImagePayloadSize,
} from '../utils/imageUpload.ts';
import {
  extractProductDraftWithGemini,
  parseGeminiApiError,
  type AiExtractedProductPatch,
  type ChatTurnInput,
} from './gemini.ts';
import {
  extractBearerToken,
  firestoreRestUpsertProduct,
  validateAndPrepareProductWrite,
} from './products.ts';
import {
  verifySellerFromFirestore,
  type SellerVerificationCheckResult,
  type VerifiedShopSummary,
} from './sellerAuth.ts';

const VALID_ROAST_LEVELS = new Set<CoffeeRoastLevel>(['light', 'medium', 'medium_dark', 'dark']);
const VALID_PROCESS_METHODS = new Set<CoffeeProcessMethod>([
  'washed',
  'natural',
  'honey',
  'anaerobic',
]);
const VALID_BEAN_FORMS = new Set<CoffeeBeanForm>(['whole_bean', 'ground']);
const DATA_IMAGE_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export interface ListingDraftSpecs {
  brand?: string;
  condition?: string;
  size?: string;
  color?: string;
}

export interface ListingDraft {
  draftId: string;
  ownerUid: string;
  shopId: string;
  shopName: string;
  status: 'collecting' | 'ready_for_confirmation' | 'published' | 'canceled';
  name?: string;
  description?: string;
  category?: string;
  productType?: string;
  price?: number;
  previousPrice?: number;
  stock?: number;
  imageUrl?: string;
  additionalImages?: string[];
  specs?: ListingDraftSpecs;
  coffeeDetails?: Partial<CoffeeProductDetails>;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  categoryConfirmed?: boolean;
  confirmedCategory?: string;
  categorization?: CoffeeCategorizationResult;
  missingFields: string[];
  validationErrors: Record<string, string>;
  completionPercent: number;
  publishedProductId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublishDraftResult {
  ok: true;
  status: number;
  product: Product;
  categorization: CoffeeCategorizationResult;
  draft: ListingDraft;
  duplicatePrevented: boolean;
}

export interface DraftActionFailure {
  ok: false;
  status: number;
  code: string;
  error: string;
  draft?: ListingDraft;
  categorization?: CoffeeCategorizationResult;
  verificationStatus?: string;
}

function isValidDraftImage(url: string): { valid: boolean; reason?: string } {
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false, reason: 'Image cannot be empty.' };
  }
  if (trimmed.startsWith('data:image/')) {
    if (!DATA_IMAGE_REGEX.test(trimmed)) {
      return {
        valid: false,
        reason: 'Unsupported image format. Please upload a JPG, PNG, or WebP photo.',
      };
    }
    const sizeCheck = validateImagePayloadSize(
      trimmed,
      MAX_IMAGE_FILE_BYTES,
      MAX_IMAGE_UPLOAD_DATA_URL_LENGTH
    );
    if (!sizeCheck.valid) {
      return {
        valid: false,
        reason: 'Uploaded image exceeds the 150 KB safety limit. Please upload a smaller photo.',
      };
    }
    return { valid: true };
  }
  if (
    (trimmed.startsWith('https://') || trimmed.startsWith('/')) &&
    trimmed.length <= 2048
  ) {
    return { valid: true };
  }
  return {
    valid: false,
    reason: 'Image must be an uploaded JPG/PNG/WebP photo (under 150 KB) or a valid https:// URL.',
  };
}

/**
 * Builds a factual description ONLY from fields the seller actually supplied
 * (never inventing certifications, warranties, or promotional claims).
 */
export function buildFactualDescriptionFromDraft(draft: ListingDraft): string {
  const parts: string[] = [];
  if (draft.description && draft.description.trim().length >= 5) {
    return draft.description.trim();
  }
  if (draft.name) {
    parts.push(draft.name.trim());
  }
  if (draft.specs?.brand) parts.push(`Brand: ${draft.specs.brand}`);
  if (draft.specs?.condition) parts.push(`Condition: ${draft.specs.condition}`);
  if (draft.specs?.size) parts.push(`Size: ${draft.specs.size}`);
  if (draft.specs?.color) parts.push(`Color: ${draft.specs.color}`);
  if (draft.coffeeDetails?.origin) parts.push(`Origin: ${draft.coffeeDetails.origin}`);
  if (draft.coffeeDetails?.roastLevel) {
    parts.push(`Roast: ${draft.coffeeDetails.roastLevel.replace('_', ' ')}`);
  }
  if (draft.coffeeDetails?.processingMethod) {
    parts.push(`Process: ${draft.coffeeDetails.processingMethod}`);
  }
  if (draft.coffeeDetails?.beanForm) {
    parts.push(
      draft.coffeeDetails.beanForm === 'ground' ? 'Form: Ground coffee' : 'Form: Whole beans'
    );
  }
  if (draft.coffeeDetails?.packageWeight) {
    parts.push(`Weight: ${draft.coffeeDetails.packageWeight}`);
  }
  if (draft.coffeeDetails?.roastDate) {
    parts.push(`Roast date: ${draft.coffeeDetails.roastDate}`);
  }
  const composed = parts.join(' · ').trim();
  return composed.length >= 5 ? composed.slice(0, 1900) : '';
}

/**
 * Independently evaluates a draft against Affin Connect's real Product model,
 * coffee categorization engine, and inventory rules.
 */
export function evaluateListingDraft(draft: ListingDraft): ListingDraft {
  const validationErrors: Record<string, string> = {};
  const missingFields: string[] = [];

  const trimmedName = (draft.name ?? '').trim();
  if (!trimmedName) {
    missingFields.push('name');
  } else if (trimmedName.length < 3 || trimmedName.length > 140) {
    validationErrors.name = 'Product name must be between 3 and 140 characters.';
  }

  // Run authoritative backend coffee categorization when we have a name or category
  let categorization: CoffeeCategorizationResult | undefined;
  let resolvedCategory = draft.category ? normalizeProductCategory(draft.category) : '';
  if (trimmedName || resolvedCategory || draft.productType) {
    categorization = classifyProductCoffeeCategory({
      name: trimmedName,
      category: resolvedCategory || undefined,
      productType: draft.productType,
      coffeeDetails: draft.coffeeDetails,
      categoryConfirmed: draft.categoryConfirmed,
      confirmedCategory: draft.confirmedCategory,
    });

    if (categorization.outcome === 'coffee') {
      resolvedCategory = CANONICAL_COFFEE_CATEGORY;
    } else if (categorization.outcome === 'non_coffee') {
      resolvedCategory = categorization.resolvedCategory;
    } else if (categorization.outcome === 'conflict') {
      validationErrors.category = categorization.reason;
    } else if (categorization.outcome === 'ambiguous' && categorization.requiresConfirmation) {
      missingFields.push('categoryConfirmation');
    }
  } else {
    missingFields.push('category');
  }

  const isCoffee =
    resolvedCategory === CANONICAL_COFFEE_CATEGORY &&
    categorization?.outcome === 'coffee';

  // Merge factual inferred coffee details without overwriting explicit seller input
  let nextCoffeeDetails: Partial<CoffeeProductDetails> | undefined;
  if (isCoffee) {
    const merged: Partial<CoffeeProductDetails> = {
      ...(categorization?.inferredCoffeeDetails ?? {}),
      ...(draft.coffeeDetails ?? {}),
    };
    if (merged.roastDate && !/^\d{4}-\d{2}-\d{2}$/.test(merged.roastDate)) {
      validationErrors.coffeeRoastDate = 'Roast date must use YYYY-MM-DD format.';
    }
    nextCoffeeDetails = Object.keys(merged).length > 0 ? merged : undefined;

    if (!nextCoffeeDetails?.origin?.trim()) {
      missingFields.push('coffeeOrigin');
    }
    if (!nextCoffeeDetails?.packageWeight?.trim()) {
      missingFields.push('coffeePackageWeight');
    }
    if (!nextCoffeeDetails?.beanForm) {
      missingFields.push('coffeeBeanForm');
    }
    if (!nextCoffeeDetails?.roastLevel) {
      missingFields.push('coffeeRoastLevel');
    }
  } else {
    nextCoffeeDetails = undefined;
  }

  if (draft.price === undefined || draft.price === null) {
    missingFields.push('price');
  } else if (!Number.isFinite(draft.price) || draft.price <= 0 || draft.price > 10_000_000) {
    validationErrors.price = 'Price must be a positive number in ETB.';
  }

  if (draft.stock === undefined || draft.stock === null) {
    missingFields.push('stock');
  } else if (!Number.isFinite(draft.stock) || draft.stock < 0 || !Number.isInteger(draft.stock)) {
    validationErrors.stock = 'Stock must be a whole number (0 or higher).';
  }

  const trimmedDescription = (draft.description ?? '').trim();
  if (!trimmedDescription) {
    missingFields.push('description');
  } else if (trimmedDescription.length < 5 || trimmedDescription.length > 2000) {
    validationErrors.description = 'Description must be between 5 and 2000 characters.';
  }

  if (!draft.imageUrl) {
    missingFields.push('image');
  } else {
    const imgCheck = isValidDraftImage(draft.imageUrl);
    if (!imgCheck.valid) {
      validationErrors.image = imgCheck.reason ?? 'Invalid product photo.';
    }
  }

  if (!draft.pickupAvailable && !draft.deliveryAvailable) {
    validationErrors.fulfillment = 'Enable either delivery or in-shop pickup.';
  }

  const requiredCount = isCoffee ? 9 : 5;
  const remainingCount = missingFields.length + Object.keys(validationErrors).length;
  const completedCount = Math.max(0, requiredCount - remainingCount);
  const completionPercent = Math.min(
    100,
    Math.round((completedCount / Math.max(1, requiredCount)) * 100)
  );

  const isComplete =
    missingFields.length === 0 && Object.keys(validationErrors).length === 0;

  const nextStatus: ListingDraft['status'] =
    draft.status === 'published' || draft.status === 'canceled'
      ? draft.status
      : isComplete
        ? 'ready_for_confirmation'
        : 'collecting';

  return {
    ...draft,
    name: trimmedName || undefined,
    description: trimmedDescription || undefined,
    category: resolvedCategory || undefined,
    coffeeDetails: nextCoffeeDetails,
    categorization,
    missingFields,
    validationErrors,
    completionPercent: nextStatus === 'ready_for_confirmation' ? 100 : completionPercent,
    status: nextStatus,
  };
}

export function applyUntrustedPatchToDraft(
  draft: ListingDraft,
  patch: AiExtractedProductPatch,
  nowIso: string = new Date().toISOString()
): ListingDraft {
  const next: ListingDraft = {
    ...draft,
    specs: draft.specs ? { ...draft.specs } : undefined,
    coffeeDetails: draft.coffeeDetails ? { ...draft.coffeeDetails } : undefined,
    updatedAt: nowIso,
  };

  if (typeof patch.name === 'string' && patch.name.trim().length > 0) {
    next.name = patch.name.trim().slice(0, 140);
  }
  if (typeof patch.description === 'string' && patch.description.trim().length > 0) {
    next.description = patch.description.trim().slice(0, 2000);
  }
  if (typeof patch.productType === 'string' && patch.productType.trim().length > 0) {
    next.productType = patch.productType.trim().slice(0, 60);
  }
  if (typeof patch.rawCategory === 'string' && patch.rawCategory.trim().length > 0) {
    const normalized = normalizeProductCategory(patch.rawCategory);
    if (normalized) {
      next.category = normalized;
      next.categoryConfirmed = undefined;
      next.confirmedCategory = undefined;
    }
  }

  if (typeof patch.priceEtb === 'number' && Number.isFinite(patch.priceEtb)) {
    next.price = Math.round(patch.priceEtb);
  }
  if (typeof patch.previousPriceEtb === 'number' && Number.isFinite(patch.previousPriceEtb)) {
    next.previousPrice = Math.round(patch.previousPriceEtb);
  }
  if (typeof patch.stockQuantity === 'number' && Number.isFinite(patch.stockQuantity)) {
    next.stock = Math.trunc(patch.stockQuantity);
  }

  if (typeof patch.pickupAvailable === 'boolean') {
    next.pickupAvailable = patch.pickupAvailable;
  }
  if (typeof patch.deliveryAvailable === 'boolean') {
    next.deliveryAvailable = patch.deliveryAvailable;
  }

  const nextSpecs: ListingDraftSpecs = { ...(next.specs ?? {}) };
  if (typeof patch.brand === 'string' && patch.brand.trim()) {
    nextSpecs.brand = patch.brand.trim().slice(0, 80);
  }
  if (typeof patch.condition === 'string' && patch.condition.trim()) {
    nextSpecs.condition = patch.condition.trim().slice(0, 40);
  }
  if (typeof patch.size === 'string' && patch.size.trim()) {
    nextSpecs.size = patch.size.trim().slice(0, 40);
  }
  if (typeof patch.color === 'string' && patch.color.trim()) {
    nextSpecs.color = patch.color.trim().slice(0, 40);
  }
  next.specs = Object.keys(nextSpecs).length > 0 ? nextSpecs : undefined;

  const nextCoffee: Partial<CoffeeProductDetails> = { ...(next.coffeeDetails ?? {}) };
  if (typeof patch.coffeeOrigin === 'string' && patch.coffeeOrigin.trim()) {
    nextCoffee.origin = patch.coffeeOrigin.trim().slice(0, 80);
  }
  if (typeof patch.brand === 'string' && patch.brand.trim()) {
    nextCoffee.brand = patch.brand.trim().slice(0, 80);
  }
  if (
    typeof patch.coffeeRoastLevel === 'string' &&
    VALID_ROAST_LEVELS.has(patch.coffeeRoastLevel as CoffeeRoastLevel)
  ) {
    nextCoffee.roastLevel = patch.coffeeRoastLevel as CoffeeRoastLevel;
  }
  if (
    typeof patch.coffeeProcessingMethod === 'string' &&
    VALID_PROCESS_METHODS.has(patch.coffeeProcessingMethod as CoffeeProcessMethod)
  ) {
    nextCoffee.processingMethod = patch.coffeeProcessingMethod as CoffeeProcessMethod;
  }
  if (
    typeof patch.coffeeBeanForm === 'string' &&
    VALID_BEAN_FORMS.has(patch.coffeeBeanForm as CoffeeBeanForm)
  ) {
    nextCoffee.beanForm = patch.coffeeBeanForm as CoffeeBeanForm;
  }
  if (typeof patch.coffeePackageWeight === 'string' && patch.coffeePackageWeight.trim()) {
    nextCoffee.packageWeight = patch.coffeePackageWeight.trim().slice(0, 32);
  }
  if (typeof patch.coffeeRoastDate === 'string' && patch.coffeeRoastDate.trim()) {
    nextCoffee.roastDate = patch.coffeeRoastDate.trim().slice(0, 32);
  }
  next.coffeeDetails = Object.keys(nextCoffee).length > 0 ? nextCoffee : undefined;

  return evaluateListingDraft(next);
}

/**
 * Generates a concise, natural follow-up message asking ONLY for missing or
 * invalid fields (never asking the seller to repeat details already provided).
 */
export function buildListingAssistantReply(
  draft: ListingDraft,
  assistantNote?: string
): string {
  const lines: string[] = [];

  if (assistantNote && assistantNote.trim()) {
    lines.push(assistantNote.trim());
  }

  const errorEntries = Object.entries(draft.validationErrors);
  if (errorEntries.length > 0) {
    lines.push('Please fix the following before publishing:');
    for (const [, msg] of errorEntries) {
      lines.push(`- ${msg}`);
    }
    return lines.join('\n');
  }

  if (draft.status === 'ready_for_confirmation') {
    const categoryLabel =
      draft.category === CANONICAL_COFFEE_CATEGORY
        ? '**Coffee Traders**'
        : `**${draft.category}**`;
    lines.push(
      `Everything is ready for ${categoryLabel}! Please review your product preview card below and tap **Publish Product** to confirm, **Edit Details** to make changes, or **Cancel**.`
    );
    return lines.join('\n\n');
  }

  if (draft.missingFields.includes('categoryConfirmation')) {
    lines.push(
      'This product name could fit either **Coffee Traders** or a general category. Tap one of the confirmation buttons below to choose where it belongs.'
    );
    return lines.join('\n\n');
  }

  const prompts: string[] = [];
  for (const field of draft.missingFields) {
    if (prompts.length >= 2) break;
    switch (field) {
      case 'name':
        prompts.push('What is the **product name** you want to sell?');
        break;
      case 'price':
        prompts.push('What is the **selling price in ETB**?');
        break;
      case 'stock':
        prompts.push('How many **units are available in stock**?');
        break;
      case 'coffeeOrigin':
        prompts.push('Which **Ethiopian coffee origin** is this from (e.g., Sidama, Yirgacheffe, Guji, Harar, Jimma)?');
        break;
      case 'coffeePackageWeight':
        prompts.push('What is the **package weight** (e.g., 250g, 500g, 1kg)?');
        break;
      case 'coffeeBeanForm':
        prompts.push('Is this coffee **whole beans** or **ground coffee**?');
        break;
      case 'coffeeRoastLevel':
        prompts.push('What is the **roast level** (light, medium, medium-dark, or dark) — and optionally the processing method (washed, natural, honey)?');
        break;
      case 'description':
        prompts.push('Add a short **product description** (quality, material, condition, or key details for Hawassa buyers).');
        break;
      case 'image':
        prompts.push('Please **upload at least one product photo** using the camera/photo button below.');
        break;
      default:
        break;
    }
  }

  if (prompts.length === 0) {
    prompts.push('Tell me what product you would like to list, along with its price in ETB and available stock.');
  }

  if (draft.category === CANONICAL_COFFEE_CATEGORY && draft.categorization?.isCoffee) {
    lines.push(
      draft.categorization.autoAssigned
        ? 'Auto-detected as **Ethiopian Coffee** — this listing will be placed in **Coffee Traders**.'
        : 'Categorized under **Coffee Traders**.'
    );
  }

  if (prompts.length === 1) {
    lines.push(prompts[0]);
  } else {
    lines.push('Just a couple more details:');
    for (const p of prompts) {
      lines.push(`- ${p}`);
    }
  }

  return lines.join('\n');
}

function summarizeDraftForAi(draft: ListingDraft): string {
  return JSON.stringify(
    {
      name: draft.name ?? null,
      category: draft.category ?? null,
      productType: draft.productType ?? null,
      priceEtb: draft.price ?? null,
      stock: draft.stock ?? null,
      description: draft.description ?? null,
      specs: draft.specs ?? null,
      coffeeDetails: draft.coffeeDetails ?? null,
      hasImage: Boolean(draft.imageUrl),
      missingFields: draft.missingFields,
    },
    null,
    2
  );
}

/**
 * Authoritative server-side draft state manager.
 * - Strictly binds every draft to its authenticated seller UID (`ownerUid`).
 * - Prevents cross-seller access, editing, canceling, or publishing.
 * - Enforces idempotent publishing so double-clicks or retries never create duplicates.
 */
export class ListingDraftStore {
  private drafts = new Map<string, ListingDraft>();
  private activeDraftByOwner = new Map<string, string>();
  private publishedByIdempotencyKey = new Map<string, PublishDraftResult>();
  private inFlightPublishes = new Map<string, Promise<PublishDraftResult | DraftActionFailure>>();

  getActiveDraftForOwner(ownerUid: string): ListingDraft | null {
    const draftId = this.activeDraftByOwner.get(ownerUid);
    if (!draftId) return null;
    const draft = this.drafts.get(draftId);
    if (!draft || draft.ownerUid !== ownerUid) return null;
    if (draft.status === 'published' || draft.status === 'canceled') return null;
    return draft;
  }

  createDraft(
    ownerUid: string,
    shop: VerifiedShopSummary,
    nowIso: string = new Date().toISOString()
  ): ListingDraft {
    const draftId = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const initial: ListingDraft = evaluateListingDraft({
      draftId,
      ownerUid,
      shopId: shop.shopId,
      shopName: shop.name,
      status: 'collecting',
      category: shop.traderType === 'coffee' ? CANONICAL_COFFEE_CATEGORY : undefined,
      pickupAvailable: shop.pickupAvailable,
      deliveryAvailable: shop.deliveryAvailable,
      missingFields: [],
      validationErrors: {},
      completionPercent: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    this.drafts.set(draftId, initial);
    this.activeDraftByOwner.set(ownerUid, draftId);
    return initial;
  }

  getDraftForOwner(
    draftId: string,
    ownerUid: string
  ): { ok: true; draft: ListingDraft } | DraftActionFailure {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      return {
        ok: false,
        status: 404,
        code: 'DRAFT_NOT_FOUND',
        error: 'Listing draft was not found or has expired. Start a new listing to continue.',
      };
    }
    if (draft.ownerUid !== ownerUid) {
      return {
        ok: false,
        status: 403,
        code: 'FORBIDDEN_DRAFT_ACCESS',
        error: 'You do not have permission to view, edit, or publish another seller’s listing draft.',
      };
    }
    return { ok: true, draft };
  }

  updateDraftShop(
    draftId: string,
    ownerUid: string,
    shop: VerifiedShopSummary,
    nowIso: string = new Date().toISOString()
  ): { ok: true; draft: ListingDraft } | DraftActionFailure {
    const lookup = this.getDraftForOwner(draftId, ownerUid);
    if (!lookup.ok) return lookup;
    if (lookup.draft.status === 'published' || lookup.draft.status === 'canceled') {
      return {
        ok: false,
        status: 409,
        code: 'DRAFT_CLOSED',
        error: 'This draft can no longer be edited.',
      };
    }
    const updated = evaluateListingDraft({
      ...lookup.draft,
      shopId: shop.shopId,
      shopName: shop.name,
      pickupAvailable: shop.pickupAvailable,
      deliveryAvailable: shop.deliveryAvailable,
      updatedAt: nowIso,
    });
    this.drafts.set(draftId, updated);
    return { ok: true, draft: updated };
  }

  applyPatch(
    draftId: string,
    ownerUid: string,
    patch: AiExtractedProductPatch,
    nowIso: string = new Date().toISOString()
  ): { ok: true; draft: ListingDraft } | DraftActionFailure {
    const lookup = this.getDraftForOwner(draftId, ownerUid);
    if (!lookup.ok) return lookup;
    if (lookup.draft.status === 'published') {
      return {
        ok: false,
        status: 409,
        code: 'DRAFT_ALREADY_PUBLISHED',
        error: 'This listing has already been published. Start a new listing to post another product.',
        draft: lookup.draft,
      };
    }
    if (lookup.draft.status === 'canceled') {
      return {
        ok: false,
        status: 409,
        code: 'DRAFT_CANCELED',
        error: 'This listing draft was canceled. Start a new listing to continue.',
        draft: lookup.draft,
      };
    }
    if (patch.intent === 'cancel_listing') {
      return this.cancelDraft(draftId, ownerUid, nowIso);
    }

    const updated = applyUntrustedPatchToDraft(lookup.draft, patch, nowIso);
    this.drafts.set(draftId, updated);
    return { ok: true, draft: updated };
  }

  attachImages(
    draftId: string,
    ownerUid: string,
    images: string[],
    nowIso: string = new Date().toISOString()
  ): { ok: true; draft: ListingDraft } | DraftActionFailure {
    const lookup = this.getDraftForOwner(draftId, ownerUid);
    if (!lookup.ok) return lookup;
    if (lookup.draft.status === 'published' || lookup.draft.status === 'canceled') {
      return {
        ok: false,
        status: 409,
        code: 'DRAFT_CLOSED',
        error: 'Cannot attach images to a closed or published draft.',
        draft: lookup.draft,
      };
    }
    if (!Array.isArray(images) || images.length === 0) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_IMAGE',
        error: 'Provide at least one product image.',
      };
    }
    if (images.length > 4) {
      return {
        ok: false,
        status: 400,
        code: 'TOO_MANY_IMAGES',
        error: 'You can attach up to 4 product photos per listing.',
      };
    }

    const validated: string[] = [];
    for (const img of images) {
      if (typeof img !== 'string') {
        return {
          ok: false,
          status: 400,
          code: 'INVALID_IMAGE',
          error: 'Each uploaded photo must be a valid image string.',
        };
      }
      const check = isValidDraftImage(img);
      if (!check.valid) {
        return {
          ok: false,
          status: 400,
          code: 'INVALID_IMAGE',
          error: check.reason ?? 'Unsupported or oversized product photo.',
        };
      }
      validated.push(img.trim());
    }

    const updated = evaluateListingDraft({
      ...lookup.draft,
      imageUrl: validated[0],
      additionalImages: validated.length > 1 ? validated.slice(1) : undefined,
      updatedAt: nowIso,
    });
    this.drafts.set(draftId, updated);
    return { ok: true, draft: updated };
  }

  confirmAmbiguousCategory(
    draftId: string,
    ownerUid: string,
    confirmedCategory: string,
    nowIso: string = new Date().toISOString()
  ): { ok: true; draft: ListingDraft } | DraftActionFailure {
    const lookup = this.getDraftForOwner(draftId, ownerUid);
    if (!lookup.ok) return lookup;
    if (lookup.draft.status === 'published' || lookup.draft.status === 'canceled') {
      return {
        ok: false,
        status: 409,
        code: 'DRAFT_CLOSED',
        error: 'Cannot modify a closed draft.',
      };
    }
    const normalized = normalizeProductCategory(confirmedCategory);
    if (!normalized) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_CATEGORY',
        error: 'Choose a valid category to confirm.',
      };
    }
    const updated = evaluateListingDraft({
      ...lookup.draft,
      category: normalized,
      categoryConfirmed: true,
      confirmedCategory: normalized,
      updatedAt: nowIso,
    });
    this.drafts.set(draftId, updated);
    return { ok: true, draft: updated };
  }

  cancelDraft(
    draftId: string,
    ownerUid: string,
    nowIso: string = new Date().toISOString()
  ): { ok: true; draft: ListingDraft } | DraftActionFailure {
    const lookup = this.getDraftForOwner(draftId, ownerUid);
    if (!lookup.ok) return lookup;
    if (lookup.draft.status === 'published') {
      return {
        ok: false,
        status: 409,
        code: 'DRAFT_ALREADY_PUBLISHED',
        error: 'This listing has already been published and cannot be canceled.',
        draft: lookup.draft,
      };
    }
    const canceled: ListingDraft = {
      ...lookup.draft,
      status: 'canceled',
      updatedAt: nowIso,
    };
    this.drafts.set(draftId, canceled);
    if (this.activeDraftByOwner.get(ownerUid) === draftId) {
      this.activeDraftByOwner.delete(ownerUid);
    }
    return { ok: true, draft: canceled };
  }

  async publishDraft(params: {
    draftId: string;
    ownerUid: string;
    confirmPublish: boolean;
    idempotencyKey?: string;
    verifySeller: (shopId: string) => Promise<SellerVerificationCheckResult>;
    persistProduct: (product: Product) => Promise<void>;
    nowIso?: string;
  }): Promise<PublishDraftResult | DraftActionFailure> {
    if (params.confirmPublish !== true) {
      return {
        ok: false,
        status: 400,
        code: 'EXPLICIT_CONFIRMATION_REQUIRED',
        error: 'Explicit seller confirmation is required before publishing a product listing.',
      };
    }

    const lookup = this.getDraftForOwner(params.draftId, params.ownerUid);
    if (!lookup.ok) return lookup;

    const draft = lookup.draft;
    if (draft.status === 'canceled') {
      return {
        ok: false,
        status: 409,
        code: 'DRAFT_CANCELED',
        error: 'This listing draft was canceled and cannot be published.',
        draft,
      };
    }

    const normalizedKey = (params.idempotencyKey ?? draft.draftId).trim().slice(0, 128);
    const cacheKey = `${params.ownerUid}:${draft.draftId}:${normalizedKey}`;
    const draftPublishedKey = `${params.ownerUid}:${draft.draftId}`;

    const cached =
      this.publishedByIdempotencyKey.get(cacheKey) ??
      this.publishedByIdempotencyKey.get(draftPublishedKey);
    if (cached) {
      return {
        ...cached,
        status: 200,
        duplicatePrevented: true,
      };
    }

    const existingInFlight =
      this.inFlightPublishes.get(cacheKey) ?? this.inFlightPublishes.get(draftPublishedKey);
    if (existingInFlight) {
      const result = await existingInFlight;
      if (result.ok) {
        return { ...result, status: 200, duplicatePrevented: true };
      }
      return result;
    }

    const publishWork = (async (): Promise<PublishDraftResult | DraftActionFailure> => {
      // Re-verify seller verification status immediately before saving!
      const sellerCheck = await params.verifySeller(draft.shopId);
      if (!sellerCheck.authorized || !sellerCheck.activeShop) {
        return {
          ok: false,
          status: 403,
          code: sellerCheck.code ?? 'SELLER_NOT_VERIFIED',
          error:
            sellerCheck.reason ??
            'Seller verification is required before publishing products.',
          verificationStatus: sellerCheck.verificationStatus,
        };
      }

      const evaluated = evaluateListingDraft(draft);
      if (evaluated.missingFields.length > 0 || Object.keys(evaluated.validationErrors).length > 0) {
        this.drafts.set(draft.draftId, evaluated);
        return {
          ok: false,
          status: 400,
          code: 'DRAFT_INCOMPLETE',
          error: buildListingAssistantReply(evaluated),
          draft: evaluated,
        };
      }

      const finalDescription = buildFactualDescriptionFromDraft(evaluated);
      const specLines: string[] = [];
      if (evaluated.specs?.brand) specLines.push(`Brand: ${evaluated.specs.brand}`);
      if (evaluated.specs?.condition) specLines.push(`Condition: ${evaluated.specs.condition}`);
      if (evaluated.specs?.size) specLines.push(`Size: ${evaluated.specs.size}`);
      if (evaluated.specs?.color) specLines.push(`Color: ${evaluated.specs.color}`);
      const enrichedDescription =
        specLines.length > 0 &&
        !specLines.every((line) => finalDescription.toLowerCase().includes(line.toLowerCase()))
          ? `${finalDescription}\n${specLines.join(' · ')}`.slice(0, 2000)
          : finalDescription;

      const nowIso = params.nowIso ?? new Date().toISOString();
      const validation = validateAndPrepareProductWrite(
        {
          shopId: sellerCheck.activeShop.shopId,
          shopName: sellerCheck.activeShop.name,
          name: evaluated.name,
          description: enrichedDescription,
          category: evaluated.category,
          productType: evaluated.productType,
          price: evaluated.price,
          previousPrice: evaluated.previousPrice,
          stock: evaluated.stock,
          isAvailable: (evaluated.stock ?? 0) > 0,
          imageUrl: evaluated.imageUrl,
          additionalImages: evaluated.additionalImages,
          coffeeDetails:
            evaluated.category === CANONICAL_COFFEE_CATEGORY
              ? (evaluated.coffeeDetails as CoffeeProductDetails | undefined)
              : undefined,
          pickupAvailable: evaluated.pickupAvailable,
          deliveryAvailable: evaluated.deliveryAvailable,
          status: 'active',
          categoryConfirmed: evaluated.categoryConfirmed,
          confirmedCategory: evaluated.confirmedCategory,
        },
        {
          mode: 'create',
          nowIso,
        }
      );

      if (!validation.ok) {
        return {
          ok: false,
          status: validation.status,
          code: validation.code,
          error: validation.error,
          draft: evaluated,
          categorization: validation.categorization,
        };
      }

      await params.persistProduct(validation.product);

      const publishedDraft: ListingDraft = {
        ...evaluated,
        category: validation.product.category,
        status: 'published',
        publishedProductId: validation.product.productId,
        updatedAt: nowIso,
      };
      this.drafts.set(draft.draftId, publishedDraft);
      if (this.activeDraftByOwner.get(params.ownerUid) === draft.draftId) {
        this.activeDraftByOwner.delete(params.ownerUid);
      }

      const result: PublishDraftResult = {
        ok: true,
        status: 201,
        product: validation.product,
        categorization: validation.categorization,
        draft: publishedDraft,
        duplicatePrevented: false,
      };
      this.publishedByIdempotencyKey.set(cacheKey, result);
      this.publishedByIdempotencyKey.set(draftPublishedKey, result);
      return result;
    })();

    this.inFlightPublishes.set(cacheKey, publishWork);
    this.inFlightPublishes.set(draftPublishedKey, publishWork);
    try {
      return await publishWork;
    } finally {
      this.inFlightPublishes.delete(cacheKey);
      this.inFlightPublishes.delete(draftPublishedKey);
    }
  }
}

export const listingDraftStore = new ListingDraftStore();

// ---------------------------------------------------------------------------
// Express Route Handlers
// ---------------------------------------------------------------------------

export async function handleListingEligibility(req: AuthRequest, res: Response) {
  const idToken = extractBearerToken(req);
  try {
    const check = await verifySellerFromFirestore({
      uid: req.user!.uid,
      email: req.user!.email,
      emailVerified: req.user!.email_verified,
      idToken,
    });

    const activeDraft = check.authorized
      ? listingDraftStore.getActiveDraftForOwner(req.user!.uid)
      : null;

    return res.json({
      eligible: check.authorized,
      isSeller: check.isSeller,
      isAdmin: check.isAdmin,
      verificationStatus: check.verificationStatus,
      code: check.code,
      reason: check.reason,
      verifiedShops: check.verifiedShops,
      activeShop: check.activeShop ?? null,
      activeDraft,
    });
  } catch (err) {
    console.error('Listing eligibility check failed:', err);
    return res.status(502).json({
      error: 'Unable to verify seller status right now. Please try again.',
    });
  }
}

export async function handleListingAssistantMessage(req: AuthRequest, res: Response) {
  const idToken = extractBearerToken(req);
  const body = (req.body ?? {}) as {
    message?: string;
    draftId?: string;
    shopId?: string;
    startNew?: boolean;
    history?: ChatTurnInput[];
    language?: string;
  };

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1500) : '';
  const requestedShopId =
    typeof body.shopId === 'string' && body.shopId.trim() ? body.shopId.trim() : undefined;

  let sellerCheck: SellerVerificationCheckResult;
  try {
    sellerCheck = await verifySellerFromFirestore({
      uid: req.user!.uid,
      email: req.user!.email,
      emailVerified: req.user!.email_verified,
      idToken,
      requestedShopId,
    });
  } catch (err) {
    console.error('Seller verification check failed:', err);
    return res.status(502).json({
      error: 'Unable to confirm seller verification right now. Please try again.',
    });
  }

  if (!sellerCheck.authorized || !sellerCheck.activeShop) {
    return res.status(403).json({
      code: sellerCheck.code ?? 'SELLER_NOT_VERIFIED',
      error:
        sellerCheck.reason ??
        'Only verified sellers can create and publish products through the assistant.',
      isSeller: sellerCheck.isSeller,
      verificationStatus: sellerCheck.verificationStatus,
    });
  }

  // Resolve or create draft strictly bound to the verified seller UID
  let draft: ListingDraft;
  if (body.draftId && !body.startNew) {
    const lookup = listingDraftStore.getDraftForOwner(body.draftId.trim(), req.user!.uid);
    if (!lookup.ok) {
      return res.status(lookup.status).json({
        code: lookup.code,
        error: lookup.error,
      });
    }
    draft = lookup.draft;
    if (requestedShopId && requestedShopId !== draft.shopId) {
      const switched = listingDraftStore.updateDraftShop(
        draft.draftId,
        req.user!.uid,
        sellerCheck.activeShop
      );
      if (!switched.ok) {
        return res.status(switched.status).json({
          code: switched.code,
          error: switched.error,
        });
      }
      draft = switched.draft;
    }
  } else if (!body.startNew) {
    draft =
      listingDraftStore.getActiveDraftForOwner(req.user!.uid) ??
      listingDraftStore.createDraft(req.user!.uid, sellerCheck.activeShop);
  } else {
    draft = listingDraftStore.createDraft(req.user!.uid, sellerCheck.activeShop);
  }

  // If seller just tapped "Post a Product" without an initial message, return draft + greeting
  if (!message) {
    const greeting =
      draft.completionPercent > 0
        ? `Welcome back to your listing draft for **${draft.shopName}**.\n\n${buildListingAssistantReply(draft)}`
        : `Ready to list a product for **${draft.shopName}**! Tell me what you want to sell — for example:\n- *"I want to sell Sidama coffee, 500 grams, for 350 ETB"*\n- *"Post a Samsung phone for 18,000 birr"*`;
    return res.json({
      reply: greeting,
      draft,
      verifiedShops: sellerCheck.verifiedShops,
    });
  }

  try {
    const extraction = await extractProductDraftWithGemini({
      message,
      currentDraftSummary: summarizeDraftForAi(draft),
      history: Array.isArray(body.history) ? body.history.slice(-8) : [],
      language: typeof body.language === 'string' ? body.language : 'en',
      shopName: draft.shopName,
    });

    const updated = listingDraftStore.applyPatch(draft.draftId, req.user!.uid, extraction.patch);
    if (!updated.ok) {
      return res.status(updated.status).json({
        code: updated.code,
        error: updated.error,
        draft: updated.draft,
      });
    }

    if (updated.draft.status === 'canceled') {
      return res.json({
        reply: 'Draft canceled. No product was published. Tap **Post a Product** anytime to start again.',
        draft: updated.draft,
        model: extraction.model,
        verifiedShops: sellerCheck.verifiedShops,
      });
    }

    const reply = buildListingAssistantReply(updated.draft, extraction.patch.assistantNote);
    return res.json({
      reply,
      draft: updated.draft,
      model: extraction.model,
      verifiedShops: sellerCheck.verifiedShops,
    });
  } catch (error) {
    console.error('Listing assistant extraction error:', error);
    const parsed = parseGeminiApiError(error);
    return res.status(parsed.status).json({
      error: parsed.message,
      draft,
    });
  }
}

export async function handleAttachListingImages(req: AuthRequest, res: Response) {
  const idToken = extractBearerToken(req);
  const draftId = String(req.params.draftId ?? '').trim();
  const body = (req.body ?? {}) as { images?: string[] };

  let sellerCheck: SellerVerificationCheckResult;
  try {
    sellerCheck = await verifySellerFromFirestore({
      uid: req.user!.uid,
      email: req.user!.email,
      emailVerified: req.user!.email_verified,
      idToken,
    });
  } catch {
    return res.status(502).json({ error: 'Unable to verify seller account right now.' });
  }

  if (!sellerCheck.authorized) {
    return res.status(403).json({
      code: sellerCheck.code ?? 'SELLER_NOT_VERIFIED',
      error: sellerCheck.reason ?? 'Only verified sellers can upload product photos.',
    });
  }

  const result = listingDraftStore.attachImages(
    draftId,
    req.user!.uid,
    Array.isArray(body.images) ? body.images : []
  );

  if (!result.ok) {
    return res.status(result.status).json({
      code: result.code,
      error: result.error,
      draft: result.draft,
    });
  }

  return res.json({
    draft: result.draft,
    reply: buildListingAssistantReply(
      result.draft,
      `Uploaded ${1 + (result.draft.additionalImages?.length ?? 0)} product photo${
        (result.draft.additionalImages?.length ?? 0) > 0 ? 's' : ''
      }.`
    ),
  });
}

export async function handleConfirmListingCategory(req: AuthRequest, res: Response) {
  const idToken = extractBearerToken(req);
  const draftId = String(req.params.draftId ?? '').trim();
  const body = (req.body ?? {}) as { confirmedCategory?: string };

  let sellerCheck: SellerVerificationCheckResult;
  try {
    sellerCheck = await verifySellerFromFirestore({
      uid: req.user!.uid,
      email: req.user!.email,
      emailVerified: req.user!.email_verified,
      idToken,
    });
  } catch {
    return res.status(502).json({ error: 'Unable to verify seller account right now.' });
  }

  if (!sellerCheck.authorized) {
    return res.status(403).json({
      code: sellerCheck.code ?? 'SELLER_NOT_VERIFIED',
      error: sellerCheck.reason ?? 'Only verified sellers can manage listing drafts.',
    });
  }

  const result = listingDraftStore.confirmAmbiguousCategory(
    draftId,
    req.user!.uid,
    typeof body.confirmedCategory === 'string' ? body.confirmedCategory : ''
  );

  if (!result.ok) {
    return res.status(result.status).json({
      code: result.code,
      error: result.error,
      draft: result.draft,
    });
  }

  return res.json({
    draft: result.draft,
    reply: buildListingAssistantReply(
      result.draft,
      `Category confirmed as **${
        result.draft.category === CANONICAL_COFFEE_CATEGORY
          ? 'Coffee Traders'
          : result.draft.category
      }**.`
    ),
  });
}

export async function handleCancelListingDraft(req: AuthRequest, res: Response) {
  const draftId = String(req.params.draftId ?? '').trim();
  const result = listingDraftStore.cancelDraft(draftId, req.user!.uid);
  if (!result.ok) {
    return res.status(result.status).json({
      code: result.code,
      error: result.error,
      draft: result.draft,
    });
  }
  return res.json({
    draft: result.draft,
    reply: 'Draft canceled without publishing. You can start a new product listing anytime.',
  });
}

export async function handlePublishListingDraft(req: AuthRequest, res: Response) {
  const idToken = extractBearerToken(req);
  const draftId = String(req.params.draftId ?? '').trim();
  const body = (req.body ?? {}) as {
    confirmPublish?: boolean;
    idempotencyKey?: string;
  };

  try {
    const result = await listingDraftStore.publishDraft({
      draftId,
      ownerUid: req.user!.uid,
      confirmPublish: body.confirmPublish === true,
      idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
      verifySeller: (shopId) =>
        verifySellerFromFirestore({
          uid: req.user!.uid,
          email: req.user!.email,
          emailVerified: req.user!.email_verified,
          idToken,
          requestedShopId: shopId,
        }),
      persistProduct: (product) => firestoreRestUpsertProduct(product, idToken),
    });

    if (!result.ok) {
      return res.status(result.status).json({
        code: result.code,
        error: result.error,
        draft: result.draft,
        categorization: result.categorization,
        verificationStatus: result.verificationStatus,
      });
    }

    return res.status(result.status).json({
      product: result.product,
      categorization: result.categorization,
      draft: result.draft,
      duplicatePrevented: result.duplicatePrevented,
    });
  } catch (err) {
    const statusCode =
      typeof (err as { statusCode?: number }).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : 500;
    return res.status(statusCode).json({
      error: err instanceof Error ? err.message : 'Unable to publish product listing.',
    });
  }
}
