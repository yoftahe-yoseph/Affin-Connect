import type { CoffeeProductDetails, Product } from '../types';
import type { CoffeeCategorizationResult } from '../utils/coffeeCategorizer';

export interface VerifiedShopOption {
  shopId: string;
  name: string;
  traderType: 'coffee' | 'general';
  neighborhood: string;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  verificationStatus: 'approved';
}

export interface ListingDraftSpecsView {
  brand?: string;
  condition?: string;
  size?: string;
  color?: string;
}

export interface ListingDraftView {
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
  specs?: ListingDraftSpecsView;
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

export interface ListingEligibilityResponse {
  eligible: boolean;
  isSeller: boolean;
  isAdmin: boolean;
  verificationStatus: string;
  code?: string;
  reason?: string;
  verifiedShops: VerifiedShopOption[];
  activeShop: VerifiedShopOption | null;
  activeDraft: ListingDraftView | null;
}

export interface ListingMessageResponse {
  reply: string;
  draft: ListingDraftView;
  model?: string;
  verifiedShops?: VerifiedShopOption[];
}

export interface PublishListingResponse {
  product: Product;
  categorization: CoffeeCategorizationResult;
  draft: ListingDraftView;
  duplicatePrevented: boolean;
}

export class ListingAssistantApiError extends Error {
  status: number;
  code?: string;
  isSeller?: boolean;
  verificationStatus?: string;
  draft?: ListingDraftView;

  constructor(
    message: string,
    status: number,
    details?: {
      code?: string;
      isSeller?: boolean;
      verificationStatus?: string;
      draft?: ListingDraftView;
    }
  ) {
    super(message);
    this.name = 'ListingAssistantApiError';
    this.status = status;
    this.code = details?.code;
    this.isSeller = details?.isSeller;
    this.verificationStatus = details?.verificationStatus;
    this.draft = details?.draft;
  }
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const raw = await res.text();
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      if (!res.ok) {
        throw new ListingAssistantApiError(raw.slice(0, 200) || 'Request failed.', res.status);
      }
      throw new ListingAssistantApiError('Invalid server response format.', res.status);
    }
  }

  if (!res.ok) {
    const errorMsg =
      typeof parsed.error === 'string' && parsed.error.trim()
        ? parsed.error
        : 'Unable to complete listing request.';
    throw new ListingAssistantApiError(errorMsg, res.status, {
      code: typeof parsed.code === 'string' ? parsed.code : undefined,
      isSeller: typeof parsed.isSeller === 'boolean' ? parsed.isSeller : undefined,
      verificationStatus:
        typeof parsed.verificationStatus === 'string' ? parsed.verificationStatus : undefined,
      draft: parsed.draft as ListingDraftView | undefined,
    });
  }

  return parsed as T;
}

export async function fetchListingEligibility(
  idToken: string
): Promise<ListingEligibilityResponse> {
  const res = await fetch('/api/chat/listing/eligibility', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  return parseJsonResponse<ListingEligibilityResponse>(res);
}

export async function sendListingAssistantMessage(
  idToken: string,
  payload: {
    message?: string;
    draftId?: string;
    shopId?: string;
    startNew?: boolean;
    history?: { role: 'user' | 'model'; content: string }[];
    language?: string;
  }
): Promise<ListingMessageResponse> {
  const res = await fetch('/api/chat/listing/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<ListingMessageResponse>(res);
}

export async function uploadListingDraftImages(
  idToken: string,
  draftId: string,
  images: string[]
): Promise<{ draft: ListingDraftView; reply: string }> {
  const res = await fetch(`/api/chat/listing/drafts/${encodeURIComponent(draftId)}/images`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ images }),
  });
  return parseJsonResponse<{ draft: ListingDraftView; reply: string }>(res);
}

export async function confirmListingDraftCategory(
  idToken: string,
  draftId: string,
  confirmedCategory: string
): Promise<{ draft: ListingDraftView; reply: string }> {
  const res = await fetch(
    `/api/chat/listing/drafts/${encodeURIComponent(draftId)}/confirm-category`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ confirmedCategory }),
    }
  );
  return parseJsonResponse<{ draft: ListingDraftView; reply: string }>(res);
}

export async function publishListingDraft(
  idToken: string,
  draftId: string,
  idempotencyKey: string
): Promise<PublishListingResponse> {
  const res = await fetch(`/api/chat/listing/drafts/${encodeURIComponent(draftId)}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      confirmPublish: true,
      idempotencyKey,
    }),
  });
  return parseJsonResponse<PublishListingResponse>(res);
}

export async function cancelListingDraft(
  idToken: string,
  draftId: string
): Promise<{ draft: ListingDraftView; reply: string }> {
  const res = await fetch(`/api/chat/listing/drafts/${encodeURIComponent(draftId)}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  });
  return parseJsonResponse<{ draft: ListingDraftView; reply: string }>(res);
}
