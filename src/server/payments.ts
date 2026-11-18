import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import type {
  CartItem,
  CustomerAddress,
  MarketplaceGovernanceConfig,
  PaymentMethod,
  Product,
  Shop,
  UserProfile,
} from '../types';
import {
  calculateCartSummary,
  DEFAULT_GOVERNANCE_CONFIG,
  isElectronicPaymentMethod,
  reconcileCartWithCatalog,
  validateOrderAgainstGovernance,
  validatePaymentReference,
} from '../utils/marketplaceLogic.ts';

export type ProviderId = 'telebirr' | 'cbe_birr' | 'chapa';

export interface ProviderConfigStatus {
  provider: ProviderId;
  configured: boolean;
  missingEnvVars: string[];
}

const TELEBIRR_REQUIRED_ENV = [
  'TELEBIRR_BASE_URL',
  'TELEBIRR_APP_ID',
  'TELEBIRR_APP_SECRET',
  'TELEBIRR_MERCHANT_CODE',
  'TELEBIRR_PRIVATE_KEY',
] as const;

const CBE_REQUIRED_ENV = [
  'CBE_BASE_URL',
  'CBE_MERCHANT_ID',
  'CBE_API_KEY',
] as const;

const CHAPA_REQUIRED_ENV = ['CHAPA_SECRET_KEY'] as const;

function inspectMissingEnv(keys: readonly string[]): string[] {
  return keys.filter((key) => {
    const val = process.env[key];
    return typeof val !== 'string' || val.trim().length === 0;
  });
}

export function getPaymentProvidersStatus(): Record<ProviderId, ProviderConfigStatus> {
  const telebirrMissing = inspectMissingEnv(TELEBIRR_REQUIRED_ENV);
  const cbeMissing = inspectMissingEnv(CBE_REQUIRED_ENV);
  const chapaMissing = inspectMissingEnv(CHAPA_REQUIRED_ENV);

  return {
    telebirr: {
      provider: 'telebirr',
      configured: telebirrMissing.length === 0,
      missingEnvVars: telebirrMissing,
    },
    cbe_birr: {
      provider: 'cbe_birr',
      configured: cbeMissing.length === 0,
      missingEnvVars: cbeMissing,
    },
    chapa: {
      provider: 'chapa',
      configured: chapaMissing.length === 0,
      missingEnvVars: chapaMissing,
    },
  };
}

interface CachedInitiation {
  expiresAt: number;
  payload: Record<string, unknown>;
}

const IDEMPOTENCY_TTL_MS = 30 * 60 * 1000;
const initiationCache = new Map<string, CachedInitiation>();
const processedWebhookEvents = new Set<string>();

function pruneExpiredCache(nowMs: number) {
  for (const [k, entry] of initiationCache.entries()) {
    if (entry.expiresAt <= nowMs) {
      initiationCache.delete(k);
    }
  }
  if (processedWebhookEvents.size > 2000) {
    processedWebhookEvents.clear();
  }
}

async function resolveOptionalAuthUid(
  req: Request
): Promise<{ ok: true; uid: string } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return { ok: true, uid: 'guest-local' };
  }
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Invalid Authorization header format.' };
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return { ok: false, status: 401, error: 'Empty Bearer token.' };
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { ok: true, uid: decoded.uid };
  } catch (error) {
    console.warn('Payment route Bearer token rejected:', error);
    return { ok: false, status: 401, error: 'Unauthorized: Invalid Firebase ID token.' };
  }
}

function generateCryptoDeliveryPin(): string {
  return String(crypto.randomInt(1000, 10000));
}

function resolveProviderId(method: PaymentMethod): ProviderId | null {
  if (method === 'telebirr' || method === 'telebirr_sandbox') return 'telebirr';
  if (method === 'cbe_birr' || method === 'cbe_birr_sandbox') return 'cbe_birr';
  if (method === 'chapa') return 'chapa';
  return null;
}

export async function handleInitiatePayment(req: Request, res: Response) {
  const authResult = await resolveOptionalAuthUid(req);
  if (authResult.ok === false) {
    return res.status(authResult.status).json({ error: authResult.error });
  }

  const nowMs = Date.now();
  pruneExpiredCache(nowMs);

  const headerIdempotency = req.header('idempotency-key')?.trim();
  const body = (req.body ?? {}) as {
    idempotencyKey?: string;
    shopId?: string;
    shop?: Shop;
    catalogProducts?: Product[];
    cartItems?: CartItem[];
    fulfillmentMethod?: 'delivery' | 'pickup';
    deliveryAddress?: CustomerAddress;
    deliveryFeeEtb?: number;
    promoCode?: string;
    pointsToRedeem?: number;
    availableLoyaltyPoints?: number;
    paymentMethod?: PaymentMethod;
    paymentReference?: string;
    governanceConfig?: MarketplaceGovernanceConfig;
    userProfile?: UserProfile | null;
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
    callbackUrl?: string;
    returnUrl?: string;
  };

  const rawKey = (headerIdempotency || body.idempotencyKey || '').trim();
  const cacheKey = rawKey ? `${authResult.uid}:${rawKey}` : '';
  if (cacheKey) {
    const cached = initiationCache.get(cacheKey);
    if (cached && cached.expiresAt > nowMs) {
      return res.json({ ...cached.payload, idempotentReplay: true });
    }
  }

  const {
    shopId,
    shop,
    catalogProducts,
    cartItems,
    fulfillmentMethod = 'delivery',
    deliveryFeeEtb = 80,
    promoCode,
    pointsToRedeem = 0,
    availableLoyaltyPoints = 0,
    paymentMethod = 'cash_on_delivery',
    paymentReference,
    governanceConfig = DEFAULT_GOVERNANCE_CONFIG,
    userProfile = null,
    customerEmail,
    customerName,
    customerPhone,
    callbackUrl,
    returnUrl,
  } = body;

  if (!shopId || !shop || !Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ error: 'Shop details and non-empty cartItems are required.' });
  }

  if (fulfillmentMethod !== 'delivery' && fulfillmentMethod !== 'pickup') {
    return res.status(400).json({ error: 'Invalid fulfillmentMethod.' });
  }

  const shopsMap: Record<string, Shop> = { [shop.shopId]: shop };
  const productPool =
    Array.isArray(catalogProducts) && catalogProducts.length > 0
      ? catalogProducts
      : cartItems.map((ci) => ci.product);

  const reconciled = reconcileCartWithCatalog(
    cartItems,
    productPool,
    shopsMap,
    governanceConfig.strictShopVerification
  );
  if (reconciled.hasBlockingIssues) {
    return res.status(400).json({
      error: 'One or more items in your cart are unavailable or exceed available stock.',
    });
  }

  const refValidation = validatePaymentReference(paymentMethod, paymentReference);
  if (!refValidation.valid) {
    return res.status(400).json({
      error: 'Invalid or missing payment reference for selected electronic payment method.',
      errorKey: refValidation.errorKey,
    });
  }

  const summary = calculateCartSummary(
    reconciled.reconciledCart,
    fulfillmentMethod,
    deliveryFeeEtb,
    promoCode,
    pointsToRedeem,
    availableLoyaltyPoints,
    governanceConfig.freeDeliveryThresholdEtb
  );

  if (!Number.isFinite(summary.totalAmount) || summary.totalAmount < 0) {
    return res.status(400).json({ error: 'Calculated order total is invalid.' });
  }

  const govCheck = validateOrderAgainstGovernance({
    config: governanceConfig,
    userProfile,
    shop,
    totalAmount: summary.totalAmount,
  });
  if (!govCheck.allowed) {
    return res.status(400).json({
      error: govCheck.customMessage || 'Order does not satisfy marketplace governance rules.',
      errorKey: govCheck.errorKey,
    });
  }

  const orderId = `ord-${nowMs}-${crypto.randomBytes(2).toString('hex')}`;
  const txRef = `AC-${nowMs}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const deliveryPin = generateCryptoDeliveryPin();
  const providers = getPaymentProvidersStatus();
  const providerId = resolveProviderId(paymentMethod);

  // Offline / pay-later methods
  if (!providerId || !isElectronicPaymentMethod(paymentMethod)) {
    const responsePayload = {
      ok: true,
      orderId,
      txRef,
      paymentMethod,
      paymentStatus: 'pending' as const,
      verifiedPaid: false,
      configured: true,
      deliveryPin,
      summary,
    };
    if (cacheKey) {
      initiationCache.set(cacheKey, {
        expiresAt: nowMs + IDEMPOTENCY_TTL_MS,
        payload: responsePayload,
      });
    }
    return res.json(responsePayload);
  }

  const providerStatus = providers[providerId];

  // Attempt live Chapa initialization only when CHAPA_SECRET_KEY is configured
  if (providerId === 'chapa' && providerStatus.configured) {
    try {
      const chapaSecret = process.env.CHAPA_SECRET_KEY!;
      const originHeader = req.get('origin') || 'http://localhost:3000';
      const initRes = await fetch('https://api.chapa.co/v1/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${chapaSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: String(Math.round(summary.totalAmount)),
          currency: 'ETB',
          email: customerEmail || 'customer@hawasagebeya.local',
          first_name: (customerName || 'Hawassa Customer').slice(0, 50),
          phone_number: customerPhone || undefined,
          tx_ref: txRef,
          callback_url: callbackUrl || `${originHeader}/api/payments/webhook/chapa`,
          return_url: returnUrl || `${originHeader}`,
          customization: {
            title: 'Affin Connect Checkout',
            description: `Order from ${shop.name}`.slice(0, 90),
          },
        }),
      });
      const initJson = (await initRes.json().catch(() => ({}))) as {
        status?: string;
        message?: string;
        data?: { checkout_url?: string };
      };

      const checkoutUrl =
        initRes.ok && initJson?.data?.checkout_url ? initJson.data.checkout_url : undefined;

      const responsePayload = {
        ok: true,
        orderId,
        txRef,
        paymentMethod,
        paymentStatus: 'pending' as const,
        verifiedPaid: false,
        configured: true,
        missingEnvVars: [],
        checkoutUrl,
        gatewayMessage: checkoutUrl
          ? 'Chapa checkout session initialized. Awaiting verified payment completion.'
          : initJson?.message || 'Chapa gateway returned an incomplete checkout URL; order remains pending verification.',
        deliveryPin,
        summary,
      };

      if (cacheKey) {
        initiationCache.set(cacheKey, {
          expiresAt: nowMs + IDEMPOTENCY_TTL_MS,
          payload: responsePayload,
        });
      }
      return res.json(responsePayload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Chapa gateway connection failed';
      return res.json({
        ok: true,
        orderId,
        txRef,
        paymentMethod,
        paymentStatus: 'pending' as const,
        verifiedPaid: false,
        configured: true,
        missingEnvVars: [],
        gatewayMessage: `Gateway request failed (${msg}). Order stays pending payment verification.`,
        deliveryPin,
        summary,
      });
    }
  }

  // Telebirr / CBE / Unconfigured Chapa: NEVER fake verified paid status
  const responsePayload = {
    ok: true,
    orderId,
    txRef,
    paymentMethod,
    paymentStatus: 'pending' as const,
    verifiedPaid: false,
    configured: providerStatus.configured,
    missingEnvVars: providerStatus.missingEnvVars,
    gatewayMessage: providerStatus.configured
      ? `${providerId.toUpperCase()} payment initiated and awaiting gateway settlement confirmation.`
      : `${providerId.toUpperCase()} live merchant API credentials (${providerStatus.missingEnvVars.join(', ')}) are not configured on this server. Order recorded as Payment Pending.`,
    deliveryPin,
    summary,
  };

  if (cacheKey) {
    initiationCache.set(cacheKey, {
      expiresAt: nowMs + IDEMPOTENCY_TTL_MS,
      payload: responsePayload,
    });
  }
  return res.json(responsePayload);
}

export async function handleVerifyPayment(req: Request, res: Response) {
  const authResult = await resolveOptionalAuthUid(req);
  if (authResult.ok === false) {
    return res.status(authResult.status).json({ error: authResult.error });
  }

  const { paymentMethod, txRef, paymentReference, expectedAmountEtb } = (req.body ?? {}) as {
    paymentMethod?: PaymentMethod;
    txRef?: string;
    paymentReference?: string;
    expectedAmountEtb?: number;
  };

  if (!paymentMethod) {
    return res.status(400).json({ error: 'paymentMethod is required.' });
  }

  const providerId = resolveProviderId(paymentMethod);
  if (!providerId) {
    return res.json({
      verifiedPaid: false,
      paymentStatus: 'pending',
      configured: true,
      message: 'Offline payment methods settle upon delivery/pickup verification.',
    });
  }

  const providers = getPaymentProvidersStatus();
  const status = providers[providerId];
  const refToCheck = (txRef || paymentReference || '').trim();

  if (!status.configured) {
    return res.json({
      verifiedPaid: false,
      paymentStatus: 'pending',
      configured: false,
      missingEnvVars: status.missingEnvVars,
      message: `${providerId.toUpperCase()} verification unavailable: missing ${status.missingEnvVars.join(', ')}.`,
    });
  }

  if (!refToCheck) {
    return res.status(400).json({ error: 'A transaction reference is required to verify payment.' });
  }

  if (providerId === 'chapa') {
    try {
      const verifyRes = await fetch(
        `https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(refToCheck)}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY!}`,
          },
        }
      );
      const verifyJson = (await verifyRes.json().catch(() => ({}))) as {
        status?: string;
        message?: string;
        data?: { status?: string; currency?: string; amount?: string | number };
      };
      const settledAmount = Number(verifyJson?.data?.amount ?? 0);
      const amountMatches =
        expectedAmountEtb == null ||
        !Number.isFinite(expectedAmountEtb) ||
        Math.abs(settledAmount - expectedAmountEtb) < 0.01;
      const verifiedPaid =
        verifyRes.ok &&
        verifyJson?.status === 'success' &&
        verifyJson?.data?.status === 'success' &&
        verifyJson?.data?.currency === 'ETB' &&
        amountMatches;

      return res.json({
        verifiedPaid,
        paymentStatus: verifiedPaid ? 'paid' : 'pending',
        configured: true,
        missingEnvVars: [],
        message: verifiedPaid
          ? 'Chapa payment verified and settled.'
          : verifyJson?.message || 'Transaction not yet settled on Chapa.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error verifying Chapa transaction';
      return res.json({
        verifiedPaid: false,
        paymentStatus: 'pending',
        configured: true,
        missingEnvVars: [],
        message: msg,
      });
    }
  }

  // Telebirr / CBE server-to-server verification requires live merchant API handshake
  return res.json({
    verifiedPaid: false,
    paymentStatus: 'pending',
    configured: status.configured,
    missingEnvVars: status.missingEnvVars,
    message:
      'Live server-to-server transaction verification awaits merchant gateway settlement callback.',
  });
}

function timingSafeHexCompare(provided: string, expected: string): boolean {
  const a = Buffer.from(provided.trim().toLowerCase(), 'utf8');
  const b = Buffer.from(expected.trim().toLowerCase(), 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function handleChapaWebhook(req: Request, res: Response) {
  const secret = process.env.CHAPA_WEBHOOK_SECRET?.trim() || process.env.CHAPA_SECRET_KEY?.trim();
  if (!secret) {
    return res.status(503).json({
      error: 'Chapa webhook secret is not configured on this server.',
    });
  }

  const signature = req.header('chapa-signature') || req.header('x-chapa-signature') || '';
  const payloadStr = JSON.stringify(req.body ?? {});
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');

  if (!timingSafeHexCompare(signature, expectedSig)) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  const eventId = String(req.body?.tx_ref || req.body?.reference || '');
  if (eventId && processedWebhookEvents.has(`chapa:${eventId}`)) {
    return res.json({ received: true, duplicate: true });
  }
  if (eventId) processedWebhookEvents.add(`chapa:${eventId}`);

  return res.json({ received: true, status: req.body?.status ?? 'pending' });
}

export function handleProviderWebhook(provider: 'telebirr' | 'cbe_birr') {
  return (req: Request, res: Response) => {
    const secret =
      provider === 'telebirr'
        ? process.env.TELEBIRR_APP_SECRET?.trim()
        : process.env.CBE_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return res.status(503).json({
        error: `${provider.toUpperCase()} webhook secret is not configured on this server.`,
      });
    }

    const signature =
      req.header('x-signature') ||
      req.header('x-webhook-signature') ||
      '';
    const payloadStr = JSON.stringify(req.body ?? {});
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');

    if (!timingSafeHexCompare(signature, expectedSig)) {
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    const eventId = String(req.body?.merch_order_id || req.body?.transactionId || req.body?.txRef || '');
    if (eventId && processedWebhookEvents.has(`${provider}:${eventId}`)) {
      return res.json({ received: true, duplicate: true });
    }
    if (eventId) processedWebhookEvents.add(`${provider}:${eventId}`);

    return res.json({ received: true });
  };
}
