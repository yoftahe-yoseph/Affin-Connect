import dotenv from 'dotenv';
import express from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { requireAuth, type AuthRequest } from '../middleware/auth.ts';
import { getOrCreateUser } from '../db/users.ts';
import { isSqlConfigured } from '../db/index.ts';
import {
  appendChatMessages,
  clearUserChatHistory,
  deleteSavedPlace,
  getPromoReels,
  getSavedPlaces,
  getUserChatHistory,
  recordPromoReel,
  saveGroundedPlace,
} from '../db/marketplaceSql.ts';
import {
  chatWithConcierge,
  generatePromoCaption,
  parseGeminiApiError,
  searchHawassaWithMapsGrounding,
  type ConciergeMode,
} from './gemini.ts';
import {
  buildWelcomeBackEmail,
  dispatchWelcomeBackEmail,
  isValidEmailAddress,
} from './welcomeBackEmail.ts';
import {
  getPaymentProvidersStatus,
  handleChapaWebhook,
  handleInitiatePayment,
  handleProviderWebhook,
  handleVerifyPayment,
} from './payments.ts';
import { createRateLimiter } from './rateLimit.ts';
import { validateChatRequestPayload } from './requestValidation.ts';
import {
  handleCategorizeProductPreview,
  handleCreateProduct,
  handleMigrateCoffeeProducts,
  handleUpdateProduct,
} from './products.ts';
import {
  handleAttachListingImages,
  handleCancelListingDraft,
  handleConfirmListingCategory,
  handleListingAssistantMessage,
  handleListingEligibility,
  handlePublishListingDraft,
} from './listingAssistant.ts';

dotenv.config();

function isSqlUnavailableError(error: unknown): boolean {
  if (!isSqlConfigured()) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connect|database|timeout/i.test(msg);
}

/**
 * Creates the Express API application shared by both:
 * - Local / Cloud Run full-stack server (`server.ts`)
 * - Vercel Node.js serverless function (`api/index.ts`)
 */
export function createApiApp(): express.Express {
  const app = express();

  app.use('/api/chat/listing', express.json({ limit: '750kb' }));
  app.use('/api/chat', express.json({ limit: '64kb' }));
  app.use('/api/payments', express.json({ limit: '128kb' }));
  app.use('/api/products', express.json({ limit: '350kb' }));
  app.use('/api/video/caption', express.json({ limit: '1mb' }));
  app.use(express.json({ limit: '256kb' }));

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (
        err &&
        typeof err === 'object' &&
        'type' in err &&
        (err as { type?: string }).type === 'entity.too.large'
      ) {
        return res.status(413).json({ error: 'Request payload exceeds the allowed size limit.' });
      }
      if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({ error: 'Malformed JSON request body.' });
      }
      return next(err);
    }
  );

  const chatRateLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 15,
    keyPrefix: 'chat',
  });
  const paymentInitiateRateLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 10,
    keyPrefix: 'pay-initiate',
  });
  const paymentVerifyRateLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 15,
    keyPrefix: 'pay-verify',
  });
  const paymentWebhookRateLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 60,
    keyPrefix: 'pay-webhook',
  });
  const productWriteRateLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 30,
    keyPrefix: 'products',
  });
  const listingAssistantRateLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 25,
    keyPrefix: 'chat-listing',
  });

  // Public runtime Maps config (avoids exposing hardcoded keys while supporting server secrets)
  app.get('/api/maps-config', (_req, res) => {
    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      '';
    res.json({ apiKey });
  });

  // Sync Firebase user into Cloud SQL PostgreSQL (gracefully skipped when SQL is not provisioned)
  app.post('/api/sql/sync-user', requireAuth, async (req: AuthRequest, res) => {
    if (!isSqlConfigured()) {
      return res.json({ skipped: true, user: null });
    }
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || `${uid}@hawasagebeya.local`;
      const displayName = (req.body?.displayName as string | undefined) || req.user!.name || null;
      const user = await getOrCreateUser(uid, email, displayName);
      res.json({ user });
    } catch (error) {
      if (isSqlUnavailableError(error)) {
        return res.json({ skipped: true, user: null });
      }
      const message = error instanceof Error ? error.message : 'Failed to sync user profile';
      res.status(500).json({ error: message });
    }
  });

  // Chat history endpoints (Cloud SQL)
  app.get('/api/sql/chat', requireAuth, async (req: AuthRequest, res) => {
    if (!isSqlConfigured()) {
      return res.json({ skipped: true, messages: [] });
    }
    try {
      const uid = req.user!.uid;
      await getOrCreateUser(uid, req.user!.email || `${uid}@hawasagebeya.local`, req.user!.name);
      const messages = await getUserChatHistory(uid);
      res.json({ messages });
    } catch (error) {
      if (isSqlUnavailableError(error)) {
        return res.json({ skipped: true, messages: [] });
      }
      const message = error instanceof Error ? error.message : 'Failed to fetch chat history';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/sql/chat', requireAuth, async (req: AuthRequest, res) => {
    if (!isSqlConfigured()) {
      return res.json({ skipped: true, cleared: true });
    }
    try {
      const uid = req.user!.uid;
      const user = await getOrCreateUser(
        uid,
        req.user!.email || `${uid}@hawasagebeya.local`,
        req.user!.name
      );
      await clearUserChatHistory(user.id);
      res.json({ cleared: true });
    } catch (error) {
      if (isSqlUnavailableError(error)) {
        return res.json({ skipped: true, cleared: true });
      }
      const message = error instanceof Error ? error.message : 'Failed to clear chat history';
      res.status(500).json({ error: message });
    }
  });

  // Saved grounded places endpoints (Cloud SQL)
  app.get('/api/sql/places', requireAuth, async (req: AuthRequest, res) => {
    if (!isSqlConfigured()) {
      return res.json({ skipped: true, places: [] });
    }
    try {
      const uid = req.user!.uid;
      await getOrCreateUser(uid, req.user!.email || `${uid}@hawasagebeya.local`, req.user!.name);
      const places = await getSavedPlaces(uid);
      res.json({ places });
    } catch (error) {
      if (isSqlUnavailableError(error)) {
        return res.json({ skipped: true, places: [] });
      }
      const message = error instanceof Error ? error.message : 'Failed to fetch saved places';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/sql/places', requireAuth, async (req: AuthRequest, res) => {
    const { title, query, mapsUri, notes } = req.body ?? {};
    if (!title || !query) {
      return res.status(400).json({ error: 'Place title and query are required.' });
    }
    if (!isSqlConfigured()) {
      return res.json({
        skipped: true,
        place: {
          id: Date.now(),
          title: String(title),
          query: String(query),
          mapsUri: mapsUri ? String(mapsUri) : null,
          notes: notes ? String(notes) : null,
          createdAt: new Date().toISOString(),
        },
      });
    }
    try {
      const uid = req.user!.uid;
      const user = await getOrCreateUser(
        uid,
        req.user!.email || `${uid}@hawasagebeya.local`,
        req.user!.name
      );
      const saved = await saveGroundedPlace(user.id, {
        title: String(title),
        query: String(query),
        mapsUri: mapsUri ? String(mapsUri) : null,
        notes: notes ? String(notes) : null,
      });
      res.status(201).json({ place: saved });
    } catch (error) {
      if (isSqlUnavailableError(error)) {
        return res.json({
          skipped: true,
          place: {
            id: Date.now(),
            title: String(title),
            query: String(query),
            mapsUri: mapsUri ? String(mapsUri) : null,
            notes: notes ? String(notes) : null,
            createdAt: new Date().toISOString(),
          },
        });
      }
      const message = error instanceof Error ? error.message : 'Failed to save place';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/sql/places/:id', requireAuth, async (req: AuthRequest, res) => {
    const placeId = Number(req.params.id);
    if (!Number.isFinite(placeId)) {
      return res.status(400).json({ error: 'Invalid place ID.' });
    }
    if (!isSqlConfigured()) {
      return res.json({ skipped: true, deleted: true });
    }
    try {
      const uid = req.user!.uid;
      const user = await getOrCreateUser(
        uid,
        req.user!.email || `${uid}@hawasagebeya.local`,
        req.user!.name
      );
      await deleteSavedPlace(user.id, placeId);
      res.json({ deleted: true });
    } catch (error) {
      if (isSqlUnavailableError(error)) {
        return res.json({ skipped: true, deleted: true });
      }
      const message = error instanceof Error ? error.message : 'Failed to delete saved place';
      res.status(500).json({ error: message });
    }
  });

  // Promo reels metadata endpoints (Cloud SQL)
  app.get('/api/sql/reels', requireAuth, async (req: AuthRequest, res) => {
    if (!isSqlConfigured()) {
      return res.json({ skipped: true, reels: [] });
    }
    try {
      const uid = req.user!.uid;
      await getOrCreateUser(uid, req.user!.email || `${uid}@hawasagebeya.local`, req.user!.name);
      const reels = await getPromoReels(uid);
      res.json({ reels });
    } catch (error) {
      if (isSqlUnavailableError(error)) {
        return res.json({ skipped: true, reels: [] });
      }
      const message = error instanceof Error ? error.message : 'Failed to fetch promo reels';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/sql/reels', requireAuth, async (req: AuthRequest, res) => {
    const { productId, title, caption, aspectRatio } = req.body ?? {};
    if (!title || !aspectRatio) {
      return res.status(400).json({ error: 'Reel title and aspectRatio are required.' });
    }
    if (!isSqlConfigured()) {
      return res.json({
        skipped: true,
        reel: {
          id: Date.now(),
          productId: productId ? String(productId) : null,
          title: String(title),
          caption: String(caption || ''),
          aspectRatio: String(aspectRatio),
          createdAt: new Date().toISOString(),
        },
      });
    }
    try {
      const uid = req.user!.uid;
      const user = await getOrCreateUser(
        uid,
        req.user!.email || `${uid}@hawasagebeya.local`,
        req.user!.name
      );
      const reel = await recordPromoReel(user.id, {
        productId: productId ? String(productId) : null,
        title: String(title),
        caption: String(caption || ''),
        aspectRatio: String(aspectRatio),
      });
      res.status(201).json({ reel });
    } catch (error) {
      if (isSqlUnavailableError(error)) {
        return res.json({
          skipped: true,
          reel: {
            id: Date.now(),
            productId: productId ? String(productId) : null,
            title: String(title),
            caption: String(caption || ''),
            aspectRatio: String(aspectRatio),
            createdAt: new Date().toISOString(),
          },
        });
      }
      const message = error instanceof Error ? error.message : 'Failed to save promo reel';
      res.status(500).json({ error: message });
    }
  });

  // Multi-turn Gemini AI Concierge chat (saves turns to Cloud SQL if configured & Bearer token provided)
  app.post('/api/chat', chatRateLimiter.middleware, async (req, res) => {
    try {
      const validation = validateChatRequestPayload(req.body);
      if (validation.ok === false) {
        return res.status(400).json({ error: validation.error });
      }

      const {
        message,
        history,
        mode,
        systemInstruction,
        language,
        contextSummary,
      } = validation.data;

      const result = await chatWithConcierge({
        message,
        history,
        mode: mode as ConciergeMode,
        systemInstruction,
        language,
        contextSummary,
      });

      const authHeader = req.headers.authorization;
      if (isSqlConfigured() && authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
          const user = await getOrCreateUser(
            decoded.uid,
            decoded.email || `${decoded.uid}@hawasagebeya.local`,
            decoded.name
          );
          await appendChatMessages(user.id, [
            { role: 'user', model: result.model, content: message },
            { role: 'model', model: result.model, content: result.text },
          ]);
        } catch (syncErr) {
          console.warn('Optional Cloud SQL chat persistence skipped:', syncErr);
        }
      }

      res.json(result);
    } catch (error) {
      console.error('Chat endpoint error:', error);
      const parsed = parseGeminiApiError(error);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  // Verified Seller AI Product Listing Assistant (server-verified authorization + idempotent publish)
  app.get(
    '/api/chat/listing/eligibility',
    listingAssistantRateLimiter.middleware,
    requireAuth,
    handleListingEligibility
  );
  app.post(
    '/api/chat/listing/message',
    listingAssistantRateLimiter.middleware,
    requireAuth,
    handleListingAssistantMessage
  );
  app.post(
    '/api/chat/listing/drafts/:draftId/images',
    listingAssistantRateLimiter.middleware,
    requireAuth,
    handleAttachListingImages
  );
  app.post(
    '/api/chat/listing/drafts/:draftId/confirm-category',
    listingAssistantRateLimiter.middleware,
    requireAuth,
    handleConfirmListingCategory
  );
  app.post(
    '/api/chat/listing/drafts/:draftId/publish',
    listingAssistantRateLimiter.middleware,
    requireAuth,
    handlePublishListingDraft
  );
  app.post(
    '/api/chat/listing/drafts/:draftId/cancel',
    listingAssistantRateLimiter.middleware,
    requireAuth,
    handleCancelListingDraft
  );

  // Google Maps Grounding via Gemini API
  app.post('/api/maps-grounding', async (req, res) => {
    try {
      const { query, latitude, longitude } = req.body ?? {};
      if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({ error: 'A location or place query is required.' });
      }
      const data = await searchHawassaWithMapsGrounding({
        query: query.trim(),
        latitude: typeof latitude === 'number' ? latitude : undefined,
        longitude: typeof longitude === 'number' ? longitude : undefined,
      });
      res.json(data);
    } catch (error) {
      console.error('Maps grounding error:', error);
      const parsed = parseGeminiApiError(error);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  // Promo caption helper for Photo-to-Video Studio
  app.post('/api/video/caption', async (req, res) => {
    try {
      const { productName, shopName, priceEtb, imageBase64, mimeType } = req.body ?? {};
      const caption = await generatePromoCaption({
        productName: typeof productName === 'string' ? productName : undefined,
        shopName: typeof shopName === 'string' ? shopName : undefined,
        priceEtb: typeof priceEtb === 'number' ? priceEtb : undefined,
        imageBase64: typeof imageBase64 === 'string' ? imageBase64 : undefined,
        mimeType: typeof mimeType === 'string' ? mimeType : undefined,
      });
      res.json(caption);
    } catch (error) {
      console.error('Video caption error:', error);
      const parsed = parseGeminiApiError(error);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  // Returning user "Welcome Back to Hawasa Gebeya" sign-in security email endpoint
  app.post('/api/auth/welcome-back-email', async (req, res) => {
    try {
      const { email, displayName, neighborhood, language, loginTimestamp } = req.body ?? {};
      if (!isValidEmailAddress(email)) {
        return res.status(400).json({ error: 'A valid recipient email address is required.' });
      }

      const configuredAppUrl = process.env.APP_URL?.trim();
      const safeConfiguredUrl =
        configuredAppUrl &&
        /^https?:\/\//i.test(configuredAppUrl) &&
        !configuredAppUrl.includes('MY_APP_URL')
          ? configuredAppUrl
          : '';
      const originHeader = req.get('origin');
      const hostHeader = req.get('host');
      const appUrl =
        safeConfiguredUrl ||
        (originHeader && /^https?:\/\//i.test(originHeader)
          ? originHeader
          : hostHeader
            ? `${req.protocol || 'https'}://${hostHeader}`
            : 'https://affin-connect.vercel.app');

      const rendered = buildWelcomeBackEmail({
        email,
        displayName: typeof displayName === 'string' ? displayName : undefined,
        neighborhood: typeof neighborhood === 'string' ? neighborhood : undefined,
        language: typeof language === 'string' ? language : 'en',
        loginTimestamp: typeof loginTimestamp === 'string' ? loginTimestamp : undefined,
        appUrl,
      });

      const result = await dispatchWelcomeBackEmail(rendered);
      return res.json({
        sent: result.sent,
        mode: result.mode,
        channel: result.channel,
        recipient: rendered.normalizedEmail,
        subject: rendered.subject,
        loginTimestamp: rendered.formattedTimestamp,
      });
    } catch (error) {
      console.error('Welcome-back email endpoint error:', error);
      return res.status(500).json({ error: 'Failed to process welcome-back email.' });
    }
  });

  // Ethiopian payment provider readiness, idempotent initiation, verification, and webhooks
  app.get('/api/payments/providers', (_req, res) => {
    res.json({ providers: getPaymentProvidersStatus() });
  });

  app.post('/api/payments/initiate', paymentInitiateRateLimiter.middleware, handleInitiatePayment);
  app.post('/api/payments/verify', paymentVerifyRateLimiter.middleware, handleVerifyPayment);
  app.post('/api/payments/webhook/chapa', paymentWebhookRateLimiter.middleware, handleChapaWebhook);
  app.post('/api/payments/webhook/telebirr', paymentWebhookRateLimiter.middleware, handleProviderWebhook('telebirr'));
  app.post('/api/payments/webhook/cbe', paymentWebhookRateLimiter.middleware, handleProviderWebhook('cbe_birr'));

  // Authoritative product creation, updates, automatic coffee categorization & idempotent backfill
  app.post(
    '/api/products/categorize',
    productWriteRateLimiter.middleware,
    requireAuth,
    handleCategorizeProductPreview
  );
  app.post(
    '/api/products/migrate-coffee',
    productWriteRateLimiter.middleware,
    requireAuth,
    handleMigrateCoffeeProducts
  );
  app.post(
    '/api/products',
    productWriteRateLimiter.middleware,
    requireAuth,
    handleCreateProduct
  );
  app.put(
    '/api/products/:productId',
    productWriteRateLimiter.middleware,
    requireAuth,
    handleUpdateProduct
  );

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
