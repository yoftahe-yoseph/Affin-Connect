import type { PaymentMethod } from '../types';

export const MAX_CHAT_MESSAGE_LENGTH = 2000;
export const MAX_CHAT_HISTORY_ITEMS = 20;
export const MAX_CHAT_HISTORY_ITEM_LENGTH = 4000;
export const MAX_CHAT_SYSTEM_INSTRUCTION_LENGTH = 1500;
export const MAX_CHAT_CONTEXT_SUMMARY_LENGTH = 2500;
export const MAX_CHAT_LANGUAGE_LENGTH = 16;

export const MAX_PAYMENT_CART_ITEMS = 50;
export const MAX_PAYMENT_CATALOG_PRODUCTS = 500;
export const MAX_PAYMENT_ID_LENGTH = 128;
export const MAX_PAYMENT_SHOP_NAME_LENGTH = 120;
export const MAX_PAYMENT_REF_LENGTH = 40;
export const MAX_PAYMENT_VERIFY_REF_LENGTH = 128;
export const MAX_PAYMENT_PROMO_LENGTH = 40;
export const MAX_PAYMENT_URL_LENGTH = 500;

export const VALID_CHAT_MODES = ['balanced', 'deep', 'fast', 'lite'] as const;
export type ValidChatMode = (typeof VALID_CHAT_MODES)[number];

export const VALID_PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash_on_delivery',
  'pay_at_pickup',
  'telebirr',
  'cbe_birr',
  'chapa',
  'telebirr_sandbox',
  'cbe_birr_sandbox',
] as const;

export interface ValidatedChatPayload {
  message: string;
  history: { role: 'user' | 'model'; content: string }[];
  mode: ValidChatMode;
  systemInstruction?: string;
  language: string;
  contextSummary?: string;
}

export function validateChatRequestPayload(
  rawBody: unknown
): { ok: true; data: ValidatedChatPayload } | { ok: false; error: string } {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }

  const body = rawBody as Record<string, unknown>;

  if (typeof body.message !== 'string') {
    return { ok: false, error: 'A chat message string is required.' };
  }
  const message = body.message.trim();
  if (message.length === 0) {
    return { ok: false, error: 'A chat message is required.' };
  }
  if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `Chat message exceeds the ${MAX_CHAT_MESSAGE_LENGTH}-character limit.`,
    };
  }

  let mode: ValidChatMode = 'balanced';
  if (body.mode !== undefined) {
    if (typeof body.mode !== 'string' || !(VALID_CHAT_MODES as readonly string[]).includes(body.mode)) {
      return { ok: false, error: 'Invalid chat mode.' };
    }
    mode = body.mode as ValidChatMode;
  }

  const history: { role: 'user' | 'model'; content: string }[] = [];
  if (body.history !== undefined) {
    if (!Array.isArray(body.history)) {
      return { ok: false, error: 'Chat history must be an array.' };
    }
    if (body.history.length > MAX_CHAT_HISTORY_ITEMS) {
      return {
        ok: false,
        error: `Chat history cannot exceed ${MAX_CHAT_HISTORY_ITEMS} turns.`,
      };
    }
    for (const turn of body.history) {
      if (!turn || typeof turn !== 'object' || Array.isArray(turn)) {
        return { ok: false, error: 'Each chat history entry must be an object.' };
      }
      const item = turn as Record<string, unknown>;
      if (item.role !== 'user' && item.role !== 'model') {
        return { ok: false, error: 'Chat history role must be "user" or "model".' };
      }
      if (typeof item.content !== 'string' || item.content.trim().length === 0) {
        return { ok: false, error: 'Chat history entries must contain non-empty text.' };
      }
      if (item.content.length > MAX_CHAT_HISTORY_ITEM_LENGTH) {
        return {
          ok: false,
          error: `Chat history entry exceeds ${MAX_CHAT_HISTORY_ITEM_LENGTH} characters.`,
        };
      }
      history.push({ role: item.role, content: item.content });
    }
  }

  let systemInstruction: string | undefined;
  if (body.systemInstruction !== undefined) {
    if (typeof body.systemInstruction !== 'string') {
      return { ok: false, error: 'systemInstruction must be a string.' };
    }
    if (body.systemInstruction.length > MAX_CHAT_SYSTEM_INSTRUCTION_LENGTH) {
      return {
        ok: false,
        error: `systemInstruction exceeds ${MAX_CHAT_SYSTEM_INSTRUCTION_LENGTH} characters.`,
      };
    }
    const clean = body.systemInstruction.trim();
    if (clean) systemInstruction = clean;
  }

  let language = 'en';
  if (body.language !== undefined) {
    if (typeof body.language !== 'string' || body.language.length > MAX_CHAT_LANGUAGE_LENGTH) {
      return {
        ok: false,
        error: `language must be a string up to ${MAX_CHAT_LANGUAGE_LENGTH} characters.`,
      };
    }
    language = body.language.trim() || 'en';
  }

  let contextSummary: string | undefined;
  if (body.contextSummary !== undefined) {
    if (typeof body.contextSummary !== 'string') {
      return { ok: false, error: 'contextSummary must be a string.' };
    }
    if (body.contextSummary.length > MAX_CHAT_CONTEXT_SUMMARY_LENGTH) {
      return {
        ok: false,
        error: `contextSummary exceeds ${MAX_CHAT_CONTEXT_SUMMARY_LENGTH} characters.`,
      };
    }
    const clean = body.contextSummary.trim();
    if (clean) contextSummary = clean;
  }

  return {
    ok: true,
    data: {
      message,
      history,
      mode,
      systemInstruction,
      language,
      contextSummary,
    },
  };
}

function isSafeHttpUrl(rawUrl: string): boolean {
  if (rawUrl.length > MAX_PAYMENT_URL_LENGTH) return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validatePaymentInitiateBody(
  rawBody: unknown
): { ok: true } | { ok: false; error: string } {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }

  const body = rawBody as Record<string, unknown>;

  if (
    typeof body.shopId !== 'string' ||
    body.shopId.trim().length === 0 ||
    body.shopId.length > MAX_PAYMENT_ID_LENGTH ||
    !/^[a-zA-Z0-9_-]+$/.test(body.shopId)
  ) {
    return { ok: false, error: 'Valid shopId is required.' };
  }

  if (!body.shop || typeof body.shop !== 'object' || Array.isArray(body.shop)) {
    return { ok: false, error: 'Shop details object is required.' };
  }
  const shop = body.shop as Record<string, unknown>;
  if (shop.shopId !== body.shopId) {
    return { ok: false, error: 'shop.shopId must match shopId.' };
  }
  if (
    typeof shop.name !== 'string' ||
    shop.name.trim().length === 0 ||
    shop.name.length > MAX_PAYMENT_SHOP_NAME_LENGTH
  ) {
    return {
      ok: false,
      error: `Shop name must be between 1 and ${MAX_PAYMENT_SHOP_NAME_LENGTH} characters.`,
    };
  }

  if (!Array.isArray(body.cartItems) || body.cartItems.length === 0) {
    return { ok: false, error: 'Non-empty cartItems array is required.' };
  }
  if (body.cartItems.length > MAX_PAYMENT_CART_ITEMS) {
    return {
      ok: false,
      error: `cartItems cannot exceed ${MAX_PAYMENT_CART_ITEMS} line items.`,
    };
  }
  for (const rawItem of body.cartItems) {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      return { ok: false, error: 'Each cartItem must be an object.' };
    }
    const item = rawItem as Record<string, unknown>;
    const prod = item.product as Record<string, unknown> | undefined;
    if (
      !prod ||
      typeof prod !== 'object' ||
      typeof prod.productId !== 'string' ||
      prod.productId.length === 0 ||
      prod.productId.length > MAX_PAYMENT_ID_LENGTH
    ) {
      return { ok: false, error: 'Each cartItem must reference a valid productId.' };
    }
    if (
      typeof item.quantity !== 'number' ||
      !Number.isFinite(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 999
    ) {
      return { ok: false, error: 'Cart item quantity must be between 1 and 999.' };
    }
  }

  if (body.catalogProducts !== undefined) {
    if (!Array.isArray(body.catalogProducts)) {
      return { ok: false, error: 'catalogProducts must be an array.' };
    }
    if (body.catalogProducts.length > MAX_PAYMENT_CATALOG_PRODUCTS) {
      return {
        ok: false,
        error: `catalogProducts cannot exceed ${MAX_PAYMENT_CATALOG_PRODUCTS} items.`,
      };
    }
  }

  if (
    body.fulfillmentMethod !== undefined &&
    body.fulfillmentMethod !== 'delivery' &&
    body.fulfillmentMethod !== 'pickup'
  ) {
    return { ok: false, error: 'Invalid fulfillmentMethod.' };
  }

  if (body.paymentMethod !== undefined) {
    if (
      typeof body.paymentMethod !== 'string' ||
      !(VALID_PAYMENT_METHODS as readonly string[]).includes(body.paymentMethod)
    ) {
      return { ok: false, error: 'Invalid paymentMethod.' };
    }
  }

  if (body.promoCode !== undefined && (typeof body.promoCode !== 'string' || body.promoCode.length > MAX_PAYMENT_PROMO_LENGTH)) {
    return { ok: false, error: `promoCode cannot exceed ${MAX_PAYMENT_PROMO_LENGTH} characters.` };
  }
  if (
    body.paymentReference !== undefined &&
    (typeof body.paymentReference !== 'string' || body.paymentReference.length > MAX_PAYMENT_REF_LENGTH)
  ) {
    return {
      ok: false,
      error: `paymentReference cannot exceed ${MAX_PAYMENT_REF_LENGTH} characters.`,
    };
  }
  if (
    body.idempotencyKey !== undefined &&
    (typeof body.idempotencyKey !== 'string' || body.idempotencyKey.length > MAX_PAYMENT_ID_LENGTH)
  ) {
    return {
      ok: false,
      error: `idempotencyKey cannot exceed ${MAX_PAYMENT_ID_LENGTH} characters.`,
    };
  }
  if (
    body.customerEmail !== undefined &&
    (typeof body.customerEmail !== 'string' || body.customerEmail.length > 150)
  ) {
    return { ok: false, error: 'customerEmail cannot exceed 150 characters.' };
  }
  if (
    body.customerName !== undefined &&
    (typeof body.customerName !== 'string' || body.customerName.length > 100)
  ) {
    return { ok: false, error: 'customerName cannot exceed 100 characters.' };
  }
  if (
    body.customerPhone !== undefined &&
    (typeof body.customerPhone !== 'string' || body.customerPhone.length > 30)
  ) {
    return { ok: false, error: 'customerPhone cannot exceed 30 characters.' };
  }
  if (body.callbackUrl !== undefined && (typeof body.callbackUrl !== 'string' || !isSafeHttpUrl(body.callbackUrl))) {
    return { ok: false, error: 'Invalid callbackUrl.' };
  }
  if (body.returnUrl !== undefined && (typeof body.returnUrl !== 'string' || !isSafeHttpUrl(body.returnUrl))) {
    return { ok: false, error: 'Invalid returnUrl.' };
  }

  if (
    body.deliveryFeeEtb !== undefined &&
    (typeof body.deliveryFeeEtb !== 'number' || !Number.isFinite(body.deliveryFeeEtb) || body.deliveryFeeEtb < 0 || body.deliveryFeeEtb > 50_000)
  ) {
    return { ok: false, error: 'Invalid deliveryFeeEtb.' };
  }
  if (
    body.pointsToRedeem !== undefined &&
    (typeof body.pointsToRedeem !== 'number' || !Number.isFinite(body.pointsToRedeem) || body.pointsToRedeem < 0 || body.pointsToRedeem > 1_000_000)
  ) {
    return { ok: false, error: 'Invalid pointsToRedeem.' };
  }
  if (
    body.availableLoyaltyPoints !== undefined &&
    (typeof body.availableLoyaltyPoints !== 'number' || !Number.isFinite(body.availableLoyaltyPoints) || body.availableLoyaltyPoints < 0 || body.availableLoyaltyPoints > 10_000_000)
  ) {
    return { ok: false, error: 'Invalid availableLoyaltyPoints.' };
  }

  return { ok: true };
}

export function validatePaymentVerifyBody(
  rawBody: unknown
): { ok: true } | { ok: false; error: string } {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }

  const body = rawBody as Record<string, unknown>;

  if (
    typeof body.paymentMethod !== 'string' ||
    !(VALID_PAYMENT_METHODS as readonly string[]).includes(body.paymentMethod)
  ) {
    return { ok: false, error: 'Valid paymentMethod is required.' };
  }

  if (body.txRef !== undefined && typeof body.txRef !== 'string') {
    return { ok: false, error: 'txRef must be a string.' };
  }
  if (body.paymentReference !== undefined && typeof body.paymentReference !== 'string') {
    return { ok: false, error: 'paymentReference must be a string.' };
  }

  const refToCheck = ((body.txRef as string | undefined) || (body.paymentReference as string | undefined) || '').trim();
  if (refToCheck.length > MAX_PAYMENT_VERIFY_REF_LENGTH) {
    return {
      ok: false,
      error: `Transaction reference cannot exceed ${MAX_PAYMENT_VERIFY_REF_LENGTH} characters.`,
    };
  }
  if (refToCheck && !/^[a-zA-Z0-9._\-:]+$/.test(refToCheck)) {
    return { ok: false, error: 'Transaction reference contains invalid characters.' };
  }

  if (
    body.expectedAmountEtb !== undefined &&
    (typeof body.expectedAmountEtb !== 'number' ||
      !Number.isFinite(body.expectedAmountEtb) ||
      body.expectedAmountEtb <= 0 ||
      body.expectedAmountEtb > 10_000_000)
  ) {
    return { ok: false, error: 'expectedAmountEtb must be a positive number.' };
  }

  return { ok: true };
}
