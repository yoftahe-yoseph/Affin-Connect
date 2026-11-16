import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { isSqlConfigured } from './src/db/index.ts';
import {
  appendChatMessages,
  clearUserChatHistory,
  deleteSavedPlace,
  getPromoReels,
  getSavedPlaces,
  getUserChatHistory,
  recordPromoReel,
  saveGroundedPlace,
} from './src/db/marketplaceSql.ts';
import {
  chatWithConcierge,
  generatePromoCaption,
  parseGeminiApiError,
  searchHawassaWithMapsGrounding,
  type ConciergeMode,
} from './src/server/gemini.ts';
import {
  buildWelcomeBackEmail,
  dispatchWelcomeBackEmail,
  isValidEmailAddress,
} from './src/server/welcomeBackEmail.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isSqlUnavailableError(error: unknown): boolean {
  if (!isSqlConfigured()) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connect|database|timeout/i.test(msg);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Public runtime Maps config (avoids exposing hardcoded keys while supporting AI Studio secrets)
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
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, history, mode, systemInstruction, language } = req.body ?? {};
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'A chat message is required.' });
      }

      const result = await chatWithConcierge({
        message: message.trim(),
        history: Array.isArray(history) ? history : [],
        mode: mode as ConciergeMode,
        systemInstruction: typeof systemInstruction === 'string' ? systemInstruction : undefined,
        language: typeof language === 'string' ? language : 'en',
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
            { role: 'user', model: result.model, content: message.trim() },
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
            : 'https://hawasagebeya.vercel.app');

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

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  const argv = process.argv.slice(2);
  let cliPort: number | undefined;
  let cliHost: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--port' && argv[i + 1]) {
      cliPort = Number(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith('--port=')) {
      cliPort = Number(arg.split('=')[1]);
    } else if (arg === '--host' && argv[i + 1]) {
      cliHost = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--host=')) {
      cliHost = arg.split('=')[1];
    } else if (/^\d{2,5}$/.test(arg) && !cliPort) {
      cliPort = Number(arg);
    } else if (/^(\d{1,3}\.){3}\d{1,3}$/.test(arg) && !cliHost) {
      cliHost = arg;
    }
  }

  const envPort = Number(process.env.PORT);
  const isDevMode = process.env.NODE_ENV !== 'production';
  const resolvedEnvPort =
    Number.isFinite(envPort) && envPort > 0 && !(isDevMode && envPort === 8080)
      ? envPort
      : undefined;
  const port =
    cliPort && Number.isFinite(cliPort) && cliPort > 0
      ? cliPort
      : resolvedEnvPort ?? 3000;
  const host = cliHost?.trim() || '0.0.0.0';

  if (isDevMode) {
    const vitePromise = createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    vitePromise.catch((err) => {
      console.error('Failed to initialize Vite dev middleware:', err);
      process.exit(1);
    });
    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = app.listen(port, host, () => {
    console.log(`Hawasa Gebeya server listening on http://${host}:${port}`);
  });
  httpServer.on('error', (err) => {
    console.error(`Server listen error on ${host}:${port}:`, err);
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
