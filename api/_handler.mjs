var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/server/apiApp.ts
import dotenv from "dotenv";
import express from "express";

// src/lib/firebase-admin.ts
import crypto from "node:crypto";

// src/lib/firebaseConfigLoader.ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
var cachedConfig = null;
function loadFirebaseAppletConfig() {
  if (cachedConfig) return cachedConfig;
  const candidates = [
    path.resolve(process.cwd(), "firebase-applet-config.json"),
    new URL("../../firebase-applet-config.json", import.meta.url),
    new URL("../firebase-applet-config.json", import.meta.url),
    new URL("./firebase-applet-config.json", import.meta.url)
  ];
  for (const candidate of candidates) {
    try {
      const exists = candidate instanceof URL ? existsSync(candidate) : existsSync(candidate);
      if (!exists) continue;
      const parsed = JSON.parse(readFileSync(candidate, "utf8"));
      if (parsed.projectId) {
        cachedConfig = {
          projectId: parsed.projectId,
          firestoreDatabaseId: parsed.firestoreDatabaseId || "(default)"
        };
        return cachedConfig;
      }
    } catch {
    }
  }
  cachedConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "",
    firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || "(default)"
  };
  return cachedConfig;
}

// src/lib/firebase-admin.ts
var FIREBASE_X509_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
var cachedAdminAuth = null;
var firebaseAdminLoadFailed = false;
var cachedCerts = null;
var cachedCertsExpiresAt = 0;
function decodeBase64UrlJson(segment) {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const raw = Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(raw);
}
function decodeBase64UrlBuffer(segment) {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}
async function fetchFirebasePublicCerts(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedCerts && now < cachedCertsExpiresAt) {
    return cachedCerts;
  }
  const res = await fetch(FIREBASE_X509_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase public keys (HTTP ${res.status}).`);
  }
  const certs = await res.json();
  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  cachedCerts = certs;
  cachedCertsExpiresAt = now + Math.max(60, maxAgeSec) * 1e3;
  return certs;
}
async function verifyFirebaseIdTokenWithCrypto(idToken) {
  if (typeof idToken !== "string" || !idToken.trim()) {
    throw new Error("Firebase ID token must be a non-empty string.");
  }
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid Firebase ID token format.");
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeBase64UrlJson(headerB64);
  const payload = decodeBase64UrlJson(payloadB64);
  if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) {
    throw new Error("Firebase ID token has unsupported algorithm or missing key ID.");
  }
  const { projectId } = loadFirebaseAppletConfig();
  if (!projectId) {
    throw new Error("Firebase projectId is not configured on the server.");
  }
  const nowSec = Math.floor(Date.now() / 1e3);
  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  const iat = typeof payload.iat === "number" ? payload.iat : 0;
  const authTime = typeof payload.auth_time === "number" ? payload.auth_time : 0;
  const aud = typeof payload.aud === "string" ? payload.aud : "";
  const iss = typeof payload.iss === "string" ? payload.iss : "";
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  if (exp <= nowSec) {
    throw new Error("Firebase ID token has expired.");
  }
  if (iat > nowSec + 300) {
    throw new Error("Firebase ID token issued-at time is in the future.");
  }
  if (authTime > nowSec + 300) {
    throw new Error("Firebase ID token auth_time is in the future.");
  }
  if (aud !== projectId) {
    throw new Error("Firebase ID token audience does not match this project.");
  }
  if (iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("Firebase ID token issuer is invalid.");
  }
  if (!sub || sub.length > 128) {
    throw new Error("Firebase ID token subject (uid) is invalid.");
  }
  let certs = await fetchFirebasePublicCerts(false);
  let certPem = certs[header.kid];
  if (!certPem) {
    certs = await fetchFirebasePublicCerts(true);
    certPem = certs[header.kid];
  }
  if (!certPem) {
    throw new Error("Firebase ID token key ID did not match any active Google signing certificate.");
  }
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, "utf8");
  const signature = decodeBase64UrlBuffer(signatureB64);
  const valid = crypto.verify("RSA-SHA256", signingInput, certPem, signature);
  if (!valid) {
    throw new Error("Firebase ID token signature verification failed.");
  }
  return {
    ...payload,
    uid: sub
  };
}
async function tryLoadFirebaseAdminAuth() {
  if (cachedAdminAuth) return cachedAdminAuth;
  if (firebaseAdminLoadFailed) return null;
  try {
    const [{ getApps, initializeApp }, { getAuth }] = await Promise.all([
      import("firebase-admin/app"),
      import("firebase-admin/auth")
    ]);
    const firebaseConfig3 = loadFirebaseAppletConfig();
    if (!getApps().length) {
      initializeApp({
        projectId: firebaseConfig3.projectId || void 0
      });
    }
    cachedAdminAuth = getAuth();
    return cachedAdminAuth;
  } catch (err) {
    firebaseAdminLoadFailed = true;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("firebase-admin unavailable in this runtime, using native RS256 verifier:", msg);
    return null;
  }
}
var adminAuth = {
  async verifyIdToken(idToken, checkRevoked) {
    const sdkAuth = await tryLoadFirebaseAdminAuth();
    if (sdkAuth) {
      return sdkAuth.verifyIdToken(idToken, checkRevoked);
    }
    return verifyFirebaseIdTokenWithCrypto(idToken);
  }
};

// src/middleware/auth.ts
var requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  chatMessages: () => chatMessages,
  chatMessagesRelations: () => chatMessagesRelations,
  promoReels: () => promoReels,
  promoReelsRelations: () => promoReelsRelations,
  savedPlaces: () => savedPlaces,
  savedPlacesRelations: () => savedPlacesRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  preferredNeighborhood: text("preferred_neighborhood"),
  createdAt: timestamp("created_at").defaultNow()
});
var chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: text("role").notNull(),
  // 'user' | 'model'
  model: text("model").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var savedPlaces = pgTable("saved_places", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  query: text("query").notNull(),
  mapsUri: text("maps_uri"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow()
});
var promoReels = pgTable("promo_reels", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  productId: text("product_id"),
  title: text("title").notNull(),
  caption: text("caption").notNull(),
  aspectRatio: text("aspect_ratio").notNull(),
  // '16:9' | '9:16'
  createdAt: timestamp("created_at").defaultNow()
});
var usersRelations = relations(users, ({ many }) => ({
  chatMessages: many(chatMessages),
  savedPlaces: many(savedPlaces),
  promoReels: many(promoReels)
}));
var chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id]
  })
}));
var savedPlacesRelations = relations(savedPlaces, ({ one }) => ({
  user: one(users, {
    fields: [savedPlaces.userId],
    references: [users.id]
  })
}));
var promoReelsRelations = relations(promoReels, ({ one }) => ({
  user: one(users, {
    fields: [promoReels.userId],
    references: [users.id]
  })
}));

// src/db/index.ts
var { Pool } = pg;
function isSqlConfigured() {
  return Boolean(
    process.env.SQL_HOST && process.env.SQL_DB_NAME && process.env.SQL_USER
  );
}
var createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 5e3
    });
    global._postgresPool.on("error", (err) => {
      if (isSqlConfigured()) {
        console.warn("Idle SQL pool notice:", err.message);
      }
    });
  }
  return global._postgresPool;
};
var cachedDb = null;
function getDb() {
  if (!cachedDb) {
    cachedDb = drizzle(createPool(), { schema: schema_exports });
  }
  return cachedDb;
}
var db = new Proxy({}, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  }
});

// src/db/users.ts
async function getOrCreateUser(uid, email, displayName) {
  try {
    const result = await db.insert(users).values({
      uid,
      email,
      displayName: displayName ?? null
    }).onConflictDoUpdate({
      target: users.uid,
      set: {
        email,
        ...displayName ? { displayName } : {}
      }
    }).returning();
    return result[0];
  } catch (error) {
    console.error("Database query failed in getOrCreateUser:", error);
    throw new Error("Unable to synchronize user profile. Please try again later.", {
      cause: error
    });
  }
}

// src/db/marketplaceSql.ts
import { and, desc, eq } from "drizzle-orm";
async function getUserChatHistory(uid) {
  try {
    return await db.select({
      id: chatMessages.id,
      role: chatMessages.role,
      model: chatMessages.model,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt
    }).from(chatMessages).innerJoin(users, eq(chatMessages.userId, users.id)).where(eq(users.uid, uid)).orderBy(chatMessages.id);
  } catch (error) {
    console.error("Database query failed in getUserChatHistory:", error);
    throw new Error("Unable to load conversation history right now.", { cause: error });
  }
}
async function appendChatMessages(userId, entries) {
  if (entries.length === 0) return [];
  try {
    return await db.insert(chatMessages).values(
      entries.map((entry) => ({
        userId,
        role: entry.role,
        model: entry.model,
        content: entry.content
      }))
    ).returning();
  } catch (error) {
    console.error("Database query failed in appendChatMessages:", error);
    throw new Error("Unable to save conversation messages.", { cause: error });
  }
}
async function clearUserChatHistory(userId) {
  try {
    await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
  } catch (error) {
    console.error("Database query failed in clearUserChatHistory:", error);
    throw new Error("Unable to clear conversation history.", { cause: error });
  }
}
async function getSavedPlaces(uid) {
  try {
    return await db.select({
      id: savedPlaces.id,
      title: savedPlaces.title,
      query: savedPlaces.query,
      mapsUri: savedPlaces.mapsUri,
      notes: savedPlaces.notes,
      createdAt: savedPlaces.createdAt
    }).from(savedPlaces).innerJoin(users, eq(savedPlaces.userId, users.id)).where(eq(users.uid, uid)).orderBy(desc(savedPlaces.id));
  } catch (error) {
    console.error("Database query failed in getSavedPlaces:", error);
    throw new Error("Unable to load saved Hawassa places.", { cause: error });
  }
}
async function saveGroundedPlace(userId, place) {
  try {
    const result = await db.insert(savedPlaces).values({
      userId,
      title: place.title,
      query: place.query,
      mapsUri: place.mapsUri ?? null,
      notes: place.notes ?? null
    }).returning();
    return result[0];
  } catch (error) {
    console.error("Database query failed in saveGroundedPlace:", error);
    throw new Error("Unable to save place bookmark.", { cause: error });
  }
}
async function deleteSavedPlace(userId, placeId) {
  try {
    await db.delete(savedPlaces).where(and(eq(savedPlaces.id, placeId), eq(savedPlaces.userId, userId)));
  } catch (error) {
    console.error("Database query failed in deleteSavedPlace:", error);
    throw new Error("Unable to delete saved place.", { cause: error });
  }
}
async function getPromoReels(uid) {
  try {
    return await db.select({
      id: promoReels.id,
      productId: promoReels.productId,
      title: promoReels.title,
      caption: promoReels.caption,
      aspectRatio: promoReels.aspectRatio,
      createdAt: promoReels.createdAt
    }).from(promoReels).innerJoin(users, eq(promoReels.userId, users.id)).where(eq(users.uid, uid)).orderBy(desc(promoReels.id));
  } catch (error) {
    console.error("Database query failed in getPromoReels:", error);
    throw new Error("Unable to load saved promo reels.", { cause: error });
  }
}
async function recordPromoReel(userId, reel) {
  try {
    const result = await db.insert(promoReels).values({
      userId,
      productId: reel.productId ?? null,
      title: reel.title,
      caption: reel.caption,
      aspectRatio: reel.aspectRatio
    }).returning();
    return result[0];
  } catch (error) {
    console.error("Database query failed in recordPromoReel:", error);
    throw new Error("Unable to save promo reel metadata.", { cause: error });
  }
}

// src/server/gemini.ts
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
function getAiClient() {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in server secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
function parseGeminiApiError(error) {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "Gemini request failed.");
  const errObj = error;
  let statusCode = typeof errObj?.status === "number" ? errObj.status : typeof errObj?.code === "number" ? errObj.code : 500;
  let apiStatus = "";
  let parsedDetail = "";
  const trimmed = rawMessage.trim();
  const jsonStart = trimmed.indexOf("{");
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart));
      if (parsed?.error) {
        if (typeof parsed.error.code === "number") statusCode = parsed.error.code;
        if (typeof parsed.error.status === "string") apiStatus = parsed.error.status;
        if (typeof parsed.error.message === "string") parsedDetail = parsed.error.message;
      }
    } catch {
    }
  }
  const upper = `${apiStatus} ${rawMessage}`.toUpperCase();
  if (statusCode === 429 || upper.includes("RESOURCE_EXHAUSTED") || upper.includes("QUOTA")) {
    return {
      status: 429,
      message: "Gemini API quota reached for the current key. Please upgrade or select a billing-enabled key in Settings > Secrets."
    };
  }
  if (statusCode === 503 || upper.includes("UNAVAILABLE") || upper.includes("HIGH DEMAND") || upper.includes("OVERLOADED")) {
    return {
      status: 503,
      message: "The AI assistant is experiencing high traffic right now. Please tap Retry in a few seconds."
    };
  }
  if (statusCode === 403 || upper.includes("PERMISSION_DENIED") || upper.includes("API_KEY_INVALID") || upper.includes("API KEY NOT VALID")) {
    return {
      status: statusCode === 403 ? 403 : 400,
      message: "Gemini API key permission denied or invalid. Please check GEMINI_API_KEY in Settings > Secrets."
    };
  }
  if (statusCode === 404 || upper.includes("NOT_FOUND")) {
    return {
      status: 404,
      message: "The requested Gemini model is unavailable right now. Please try another mode."
    };
  }
  if (statusCode === 400 || upper.includes("INVALID_ARGUMENT")) {
    return {
      status: 400,
      message: parsedDetail || "Invalid request sent to Gemini API."
    };
  }
  return {
    status: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
    message: parsedDetail || rawMessage || "Gemini request failed."
  };
}
function isTransientGeminiOverloadError(error) {
  const parsed = parseGeminiApiError(error);
  if (parsed.status === 503 || parsed.status === 502 || parsed.status === 504) {
    return true;
  }
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const upper = raw.toUpperCase();
  return upper.includes("UNAVAILABLE") || upper.includes("HIGH DEMAND") || upper.includes("OVERLOADED") || upper.includes("ECONNRESET") || upper.includes("ETIMEDOUT");
}
function isModelUnavailableError(error) {
  const parsed = parseGeminiApiError(error);
  if (parsed.status === 404) return true;
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const upper = raw.toUpperCase();
  return upper.includes("NOT_FOUND") || upper.includes("NOT FOUND") || upper.includes("UNSUPPORTED MODEL");
}
function shouldTryNextGeminiModel(error) {
  return isTransientGeminiOverloadError(error) || isModelUnavailableError(error);
}
var DEFAULT_HAWASSA_SYSTEM_INSTRUCTION = `You are the Affin Connect AI Assistant for Hawassa, Sidama Region, Ethiopia.
Help shoppers and local merchants with practical, accurate, concise advice:
- Recommend products, Sidama specialty coffee, handwoven Habesha Netela/Gabi, Berbere/spices, and electronics in Ethiopian Birr (ETB).
- Explain Hawassa neighborhoods (Piazza, Menhariya, Gebeya Dar, Tabor, Datto, Arab Sefer, Lake Hawassa shore), local delivery vs. in-shop pickup, and payment options (Telebirr, CBE, Chapa, Cash on Delivery, Pay at Pickup).
- Assist merchants with bilingual product listings, stock planning, and friendly customer replies.
- Keep replies concise, scannable, warm, and well-structured for mobile reading without inventing unverified street addresses or business hours.`;
function normalizeChatHistory(history = []) {
  const cleaned = history.filter(
    (h) => (h.role === "user" || h.role === "model") && typeof h.content === "string" && h.content.trim().length > 0
  ).slice(-20);
  while (cleaned.length > 0 && cleaned[0].role === "model") {
    cleaned.shift();
  }
  const merged = [];
  for (const turn of cleaned) {
    const trimmedContent = turn.content.trim();
    const prev = merged[merged.length - 1];
    if (prev && prev.role === turn.role) {
      prev.content = `${prev.content}

${trimmedContent}`;
    } else {
      merged.push({ role: turn.role, content: trimmedContent });
    }
  }
  while (merged.length > 0 && merged[merged.length - 1].role === "user") {
    merged.pop();
  }
  return merged.map((h) => ({
    role: h.role,
    parts: [{ text: h.content }]
  }));
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function chatWithConcierge(params) {
  const ai = getAiClient();
  const mode = params.mode ?? "fast";
  const primaryModel = mode === "lite" ? "gemini-3.1-flash-lite" : "gemini-4-hydrogen";
  const primaryThinkingLevel = mode === "deep" ? ThinkingLevel.XHIGH : mode === "fast" ? ThinkingLevel.LOW : mode === "balanced" ? ThinkingLevel.MEDIUM : void 0;
  const formattedHistory = normalizeChatHistory(params.history);
  const languageHint = params.language === "am" ? "Respond primarily in Amharic (with English product names or ETB prices when helpful)." : params.language === "om" ? "Respond primarily in Afaan Oromo (with English product names or ETB prices when helpful)." : params.language === "sid" ? "Respond primarily in Sidaamu Afoo (with English product names or ETB prices when helpful)." : "Respond in clear, friendly English (using authentic Hawassa/Ethiopian terms where natural).";
  const contextBlock = typeof params.contextSummary === "string" && params.contextSummary.trim().length > 0 ? `Current Affin Connect Live Context:
${params.contextSummary.trim().slice(0, 2e3)}` : "";
  const fullSystemInstruction = [
    params.systemInstruction?.trim() || DEFAULT_HAWASSA_SYSTEM_INSTRUCTION,
    languageHint,
    contextBlock
  ].filter(Boolean).join("\n\n");
  const runModelChat = async (model, thinkingLevel) => {
    const chat = ai.chats.create({
      model,
      history: formattedHistory,
      config: {
        systemInstruction: fullSystemInstruction,
        ...thinkingLevel && model === "gemini-4-hydrogen" ? { thinkingConfig: { thinkingLevel } } : {}
      }
    });
    const response = await chat.sendMessage({ message: params.message });
    return {
      text: response.text?.trim() || "I could not generate a response right now. Please try asking again.",
      model
    };
  };
  const candidateModels = primaryModel === "gemini-3.1-flash-lite" ? ["gemini-3.1-flash-lite", "gemini-4-hydrogen", "gemini-2.5-flash"] : ["gemini-4-hydrogen", "gemini-3.1-flash-lite", "gemini-2.5-flash"];
  const primaryTimeoutMs = mode === "deep" ? 18e3 : 1e4;
  let lastError;
  for (let idx = 0; idx < candidateModels.length; idx += 1) {
    const modelName = candidateModels[idx];
    const timeoutMs = idx === 0 ? primaryTimeoutMs : 12e3;
    const thinking = modelName === "gemini-4-hydrogen" ? primaryThinkingLevel : void 0;
    try {
      return await Promise.race([
        runModelChat(modelName, thinking),
        new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("503 UNAVAILABLE: Primary model timed out under high demand.")),
            timeoutMs
          );
        })
      ]);
    } catch (error) {
      lastError = error;
      if (!shouldTryNextGeminiModel(error) || idx === candidateModels.length - 1) {
        throw error;
      }
      if (isTransientGeminiOverloadError(error)) {
        await sleep(250);
      }
    }
  }
  throw lastError;
}
async function searchHawassaWithMapsGrounding(params) {
  const ai = getAiClient();
  const lat = typeof params.latitude === "number" && Number.isFinite(params.latitude) ? params.latitude : 7.0621;
  const lng = typeof params.longitude === "number" && Number.isFinite(params.longitude) ? params.longitude : 38.4763;
  const prompt = `${params.query.trim()} (Focus on Hawassa, Sidama Region, Ethiopia unless another location is specified.)`;
  const response = await ai.models.generateContent({
    model: "gemini-4-hydrogen",
    contents: prompt,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: lat,
            longitude: lng
          }
        }
      }
    }
  });
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const places = [];
  for (const chunk of chunks) {
    const mapsInfo = chunk.maps;
    if (mapsInfo?.uri && mapsInfo?.title) {
      const snippets = mapsInfo.placeAnswerSources?.reviewSnippets?.map((s) => s.content || s.text || "").filter(Boolean) ?? [];
      places.push({
        title: mapsInfo.title,
        uri: mapsInfo.uri,
        placeId: mapsInfo.placeId,
        reviewSnippets: snippets.length > 0 ? snippets : void 0
      });
    }
  }
  return {
    text: response.text ?? "",
    places,
    coordinates: { latitude: lat, longitude: lng }
  };
}
async function generatePromoCaption(params) {
  const ai = getAiClient();
  const parts = [];
  if (params.imageBase64 && params.mimeType) {
    parts.push({
      inlineData: {
        mimeType: params.mimeType,
        data: params.imageBase64
      }
    });
  }
  const contextLines = [
    params.productName ? `Product: ${params.productName}` : "",
    params.shopName ? `Shop: ${params.shopName}` : "",
    params.priceEtb ? `Price: ETB ${params.priceEtb}` : ""
  ].filter(Boolean).join(" | ");
  parts.push({
    text: `Write a short, punchy 1-line marketplace reel headline (max 7 words) and a 1-sentence subtitle (max 14 words) for a local Hawassa shop video promo. ${contextLines ? `Context: ${contextLines}.` : ""} Format strictly as:
HEADLINE: <headline>
SUBTITLE: <subtitle>`
  });
  const response = await ai.models.generateContent({
    model: "gemini-4-hydrogen",
    contents: { parts },
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    }
  });
  const raw = response.text ?? "";
  const headlineMatch = raw.match(/HEADLINE:\s*(.+)/i);
  const subtitleMatch = raw.match(/SUBTITLE:\s*(.+)/i);
  return {
    headline: headlineMatch?.[1]?.trim() || params.productName || "Fresh from Hawasa Gebeya",
    subtitle: subtitleMatch?.[1]?.trim() || "Same-day delivery & pickup across Hawassa local merchants."
  };
}
var PRODUCT_EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: ["update_listing", "cancel_listing", "general_question"],
      description: "Whether the seller is providing/updating product listing fields, canceling the draft, or asking an unrelated general question."
    },
    name: {
      type: Type.STRING,
      description: "Clean product title if explicitly provided or updated by the seller. Omit if not mentioned."
    },
    description: {
      type: Type.STRING,
      description: "Factual product description ONLY from details the seller explicitly stated. Do NOT invent certifications, warranties, or specs."
    },
    rawCategory: {
      type: Type.STRING,
      description: "Product category mentioned or implied (e.g., Coffee, Ethiopian Coffee, Electronics, Clothing, Groceries, Spices, Home, Beauty, Sports, Automotive)."
    },
    productType: {
      type: Type.STRING,
      description: "Specific product type (e.g., Roasted Coffee, Ground Coffee, Smartphone, Women Shoes, Traditional Dress)."
    },
    priceEtb: {
      type: Type.NUMBER,
      description: "Numeric selling price in Ethiopian Birr (ETB) ONLY if explicitly stated by the seller."
    },
    previousPriceEtb: {
      type: Type.NUMBER,
      description: "Original/compare-at price in ETB ONLY if seller explicitly mentioned a discount or previous price."
    },
    stockQuantity: {
      type: Type.INTEGER,
      description: "Available inventory count/quantity ONLY if explicitly stated by the seller. Never guess stock."
    },
    brand: {
      type: Type.STRING,
      description: "Brand or roastery name ONLY if stated by the seller."
    },
    condition: {
      type: Type.STRING,
      description: "Item condition (e.g., Brand New, Like New, Used) ONLY if stated by the seller."
    },
    size: {
      type: Type.STRING,
      description: "Size (e.g., 38, Medium, 256GB) ONLY if stated by the seller."
    },
    color: {
      type: Type.STRING,
      description: "Color ONLY if stated by the seller."
    },
    pickupAvailable: {
      type: Type.BOOLEAN,
      description: "Set ONLY if seller explicitly changed pickup availability."
    },
    deliveryAvailable: {
      type: Type.BOOLEAN,
      description: "Set ONLY if seller explicitly changed delivery availability."
    },
    coffeeOrigin: {
      type: Type.STRING,
      description: "Coffee origin region (e.g., Sidama, Yirgacheffe, Guji, Harar, Jimma) ONLY if stated."
    },
    coffeeRoastLevel: {
      type: Type.STRING,
      enum: ["light", "medium", "medium_dark", "dark"],
      description: "Roast level ONLY if explicitly stated."
    },
    coffeeProcessingMethod: {
      type: Type.STRING,
      enum: ["washed", "natural", "honey", "anaerobic"],
      description: "Coffee processing method ONLY if explicitly stated."
    },
    coffeeBeanForm: {
      type: Type.STRING,
      enum: ["whole_bean", "ground"],
      description: "Whole beans or ground coffee ONLY if explicitly stated."
    },
    coffeePackageWeight: {
      type: Type.STRING,
      description: "Package weight (e.g., 250g, 500g, 1kg, 20kg) ONLY if stated."
    },
    coffeeRoastDate: {
      type: Type.STRING,
      description: "Roast date in YYYY-MM-DD format ONLY if explicitly stated."
    },
    assistantNote: {
      type: Type.STRING,
      description: "Brief, warm 1-sentence acknowledgment of what was captured (never claim the product is published)."
    }
  },
  required: ["intent"]
};
async function extractProductDraftWithGemini(params) {
  const ai = getAiClient();
  const recentTurns = (params.history ?? []).slice(-6).map((h) => `${h.role === "user" ? "Seller" : "Assistant"}: ${h.content.slice(0, 400)}`).join("\n");
  const systemInstruction = `You are the Affin Connect Product Listing Extraction Engine for Hawassa, Ethiopia.
Your job is to extract ONLY the product facts explicitly provided by the seller in their latest message into the JSON schema.

CRITICAL RULES:
1. NEVER invent or assume prices, stock quantities, roast dates, certifications, warranties, brands, sizes, or specifications that the seller did not state.
2. NEVER publish a product or claim a product is already published.
3. Convert Ethiopian Birr expressions cleanly (e.g. "350 ETB" -> 350, "18,000 birr" -> 18000).
4. Distinguish package weight from stock quantity carefully:
   - "Sidama coffee, 500 grams, for 350 ETB" -> coffeePackageWeight: "500g", priceEtb: 350, stockQuantity OMITTED (not stated!).
   - "20 kilograms of roasted coffee beans" -> if price per kg or total stock isn't clear, capture coffeePackageWeight: "1kg" or "20kg" accurately and omit stockQuantity unless unit count is explicit (e.g., "15 bags in stock" -> stockQuantity: 15).
5. If the seller says "cancel", "never mind", "discard", or "stop listing", set intent: "cancel_listing".
6. Only include fields that the seller newly provided or explicitly changed in this message.`;
  const prompt = [
    `Verified Shop: ${params.shopName}`,
    `Current Draft State:
${params.currentDraftSummary}`,
    recentTurns ? `Recent Conversation:
${recentTurns}` : "",
    `Latest Seller Message:
${params.message.trim()}`
  ].filter(Boolean).join("\n\n");
  const runExtraction = async (model, thinkingLevel) => {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: PRODUCT_EXTRACTION_SCHEMA,
        ...thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}
      }
    });
    const rawText = (response.text ?? "").trim();
    if (!rawText) {
      throw new Error("Empty structured response from Gemini.");
    }
    const parsed = JSON.parse(rawText);
    return {
      patch: parsed,
      model
    };
  };
  const extractionModels = ["gemini-4-hydrogen", "gemini-3.1-flash-lite", "gemini-2.5-flash"];
  let lastError;
  for (let idx = 0; idx < extractionModels.length; idx += 1) {
    const modelName = extractionModels[idx];
    const thinking = modelName === "gemini-4-hydrogen" ? ThinkingLevel.LOW : void 0;
    try {
      return await Promise.race([
        runExtraction(modelName, thinking),
        new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("503 UNAVAILABLE: Listing extraction timed out.")),
            1e4
          );
        })
      ]);
    } catch (error) {
      lastError = error;
      if (!shouldTryNextGeminiModel(error) || idx === extractionModels.length - 1) {
        throw error;
      }
    }
  }
  throw lastError;
}

// src/server/welcomeBackEmail.ts
import nodemailer from "nodemailer";

// src/constants/translations.ts
var NEIGHBORHOOD_TRANSLATIONS = {
  en: {
    "All Hawassa": "All Hawassa",
    Piazza: "Piazza",
    Menhariya: "Menhariya",
    "Gebeya Dar": "Gebeya Dar",
    Datto: "Datto",
    "Arab Sefer": "Arab Sefer",
    Tabor: "Tabor",
    Bilo: "Bilo",
    Atote: "Atote",
    "Hayk Dar": "Hayk Dar",
    Addisu: "Addisu",
    Gudumale: "Gudumale",
    "Amora Gedel / Lake Side": "Amora Gedel / Lake Side",
    Mobile: "Mobile",
    "Millennium / Alamura": "Millennium / Alamura",
    "Hawassa University Main Campus": "Hawassa University Main Campus"
  },
  am: {
    "All Hawassa": "\u1218\u120B\u12CD \u1210\u12CB\u1233",
    Piazza: "\u1352\u12EB\u1233",
    Menhariya: "\u1218\u1293\u12B8\u122A\u12EB",
    "Gebeya Dar": "\u1308\u1260\u12EB \u12F3\u122D",
    Datto: "\u12F3\u1276",
    "Arab Sefer": "\u12A0\u1228\u1265 \u1230\u1348\u122D",
    Tabor: "\u1273\u1266\u122D",
    Bilo: "\u1262\u120E",
    Atote: "\u12A0\u1276\u1274",
    "Hayk Dar": "\u1210\u12ED\u1245 \u12F3\u122D",
    Addisu: "\u12A0\u12F2\u1231",
    Gudumale: "\u1309\u12F1\u121B\u120C",
    "Amora Gedel / Lake Side": "\u12A0\u121E\u122B \u1308\u12F0\u120D / \u1210\u12ED\u1245 \u12F3\u122D\u127B",
    Mobile: "\u121E\u1263\u12ED\u120D",
    "Millennium / Alamura": "\u121A\u120A\u1292\u12E8\u121D / \u12A0\u120B\u1219\u122B",
    "Hawassa University Main Campus": "\u1210\u12CB\u1233 \u12E9\u1292\u1268\u122D\u1232\u1272 \u12CB\u1293 \u130D\u1262"
  },
  om: {
    "All Hawassa": "Hawaasa Guutuu",
    Piazza: "Piyaasaa",
    Menhariya: "Mannaahariyaa",
    "Gebeya Dar": "Gabaa Dar",
    Datto: "Daattoo",
    "Arab Sefer": "Arab Safar",
    Tabor: "Taaboor",
    Bilo: "Biiloo",
    Atote: "Atootee",
    "Hayk Dar": "Hayiq Dar",
    Addisu: "Addisuu",
    Gudumale: "Gudumaalee",
    "Amora Gedel / Lake Side": "Amora Gedel / Qarqara Haroo",
    Mobile: "Moobaayil",
    "Millennium / Alamura": "Miileenniyam / Alamuraa",
    "Hawassa University Main Campus": "Yuunivarsiitii Hawaasaa Kaampasii Ijoo"
  },
  sid: {
    "All Hawassa": "Hawaasa Baala",
    Piazza: "Piyaassa",
    Menhariya: "Menhaariya",
    "Gebeya Dar": "Dikko Qarqara",
    Datto: "Daatto",
    "Arab Sefer": "Araabi Seferi",
    Tabor: "Taaboori",
    Bilo: "Biilo",
    Atote: "Atoote",
    "Hayk Dar": "Baaru Qarqara",
    Addisu: "Haaro",
    Gudumale: "Gudumaale",
    "Amora Gedel / Lake Side": "Amora Gedeli / Baaru Qarqara",
    Mobile: "Moobaayile",
    "Millennium / Alamura": "Miileenniyame / Alamuura",
    "Hawassa University Main Campus": "Hawaasi Yuniveriste Qara Kaampase"
  }
};
function getLocalizedNeighborhood(neighborhood, language) {
  return NEIGHBORHOOD_TRANSLATIONS[language]?.[neighborhood] ?? neighborhood;
}

// src/server/welcomeBackEmail.ts
var VALID_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function isValidEmailAddress(email) {
  if (typeof email !== "string") return false;
  const clean = email.trim();
  return clean.length >= 5 && clean.length <= 254 && VALID_EMAIL_RE.test(clean);
}
function normalizeSupportedLanguage(lang) {
  if (lang === "am" || lang === "om" || lang === "sid" || lang === "en") {
    return lang;
  }
  return "en";
}
function escapeHtml(raw) {
  return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function formatLoginTimestamp(rawTimestamp) {
  const date = rawTimestamp ? new Date(rawTimestamp) : /* @__PURE__ */ new Date();
  const safeDate = Number.isNaN(date.getTime()) ? /* @__PURE__ */ new Date() : date;
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Addis_Ababa",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(safeDate);
    return `${formatted} (Hawassa \xB7 EAT)`;
  } catch {
    return safeDate.toISOString();
  }
}
var EMAIL_LOCALE_COPY = {
  en: {
    subject: (name) => `Welcome back to Hawasa Gebeya, ${name}!`,
    eyebrow: "HAWASSA SIGN-IN SECURITY CONFIRMATION",
    headline: (name) => `Welcome back to Hawasa Gebeya, ${name}!`,
    securityConfirm: "We noticed a new sign-in to your Hawasa Gebeya account. Verified Hawassa shops across your neighborhood are ready for you.",
    detailEmailLabel: "Account Email",
    detailNeighborhoodLabel: "Preferred Hawassa Neighborhood",
    detailTimeLabel: "Sign-In Time",
    ctaLabel: "Return to Hawasa Gebeya",
    footerNote: "If this was you, no further action is needed. If you did not sign in, please update your password or contact Hawasa Gebeya support."
  },
  am: {
    subject: (name) => `\u12C8\u12F0 \u1210\u12CB\u1233 \u1308\u1260\u12EB \u12A5\u1295\u12B3\u1295 \u1260\u12F0\u1205\u1293 \u1270\u1218\u1208\u1231\u1363 ${name}!`,
    eyebrow: "\u12E8\u1210\u12CB\u1233 \u1308\u1260\u12EB \u12E8\u1218\u130D\u1262\u12EB \u12F0\u1205\u1295\u1290\u1275 \u121B\u1228\u130B\u1308\u132B",
    headline: (name) => `\u12C8\u12F0 \u1210\u12CB\u1233 \u1308\u1260\u12EB \u12A5\u1295\u12B3\u1295 \u1260\u12F0\u1205\u1293 \u1270\u1218\u1208\u1231\u1363 ${name}!`,
    securityConfirm: "\u12C8\u12F0 \u1210\u12CB\u1233 \u1308\u1260\u12EB \u1218\u1208\u12EB\u12CE \u12A0\u12F2\u1235 \u1218\u130D\u1263\u1275 \u1270\u1218\u12DD\u130D\u1267\u120D\u1362 \u1260\u1230\u1348\u122D\u12CE \u12EB\u1209 \u12E8\u1270\u1228\u130B\u1308\u1321 \u12E8\u1210\u12CB\u1233 \u1231\u1246\u127D \u1208\u12A5\u122D\u1235\u12CE \u12DD\u130D\u1301 \u1293\u1278\u12CD\u1362",
    detailEmailLabel: "\u12E8\u1218\u1208\u12EB \u12A2\u121C\u12ED\u120D",
    detailNeighborhoodLabel: "\u12E8\u1270\u1218\u1228\u1320 \u12E8\u1210\u12CB\u1233 \u1230\u1348\u122D",
    detailTimeLabel: "\u12E8\u1308\u1261\u1260\u1275 \u1230\u12D3\u1275",
    ctaLabel: "\u12C8\u12F0 \u1210\u12CB\u1233 \u1308\u1260\u12EB \u12ED\u1218\u1208\u1231",
    footerNote: "\u12ED\u1205 \u12A5\u122D\u1235\u12CE \u12A8\u1206\u1291 \u1270\u1328\u121B\u122A \u12A5\u122D\u121D\u1303 \u12A0\u12EB\u1235\u1348\u120D\u130D\u121D\u1362 \u12A5\u122D\u1235\u12CE \u12AB\u120D\u1308\u1261 \u12E8\u12ED\u1208\u134D \u1243\u120D\u12CE\u1295 \u12ED\u1240\u12ED\u1229 \u12C8\u12ED\u121D \u12E8\u1210\u12CB\u1233 \u1308\u1260\u12EB \u12F5\u130B\u134D\u1295 \u12EB\u130D\u1299\u1362"
  },
  om: {
    subject: (name) => `Baga Gara Hawasa Gebeya Deebitan, ${name}!`,
    eyebrow: "MIRKANEESSA NAGEENYA SEENAA HAWAASAA",
    headline: (name) => `Baga Gara Hawasa Gebeya Deebitan, ${name}!`,
    securityConfirm: "Eenyummeessa Hawasa Gebeya keessanitti seenuun haaraan argameera. Suuqiiwwan Hawaasaa naannoo keessanii qophiidha.",
    detailEmailLabel: "Imeelii Eenyummeessaa",
    detailNeighborhoodLabel: "Naannoo Hawaasaa Filatame",
    detailTimeLabel: "Yeroo Seensaa",
    ctaLabel: "Gara Hawasa Gebeya Deebi'i",
    footerNote: "Kun isin yoo ta'e tarkaanfiin dabalataa hin barbaachisu. Yoo isin hin seenne ta'e jecha darbii keessan jijjiiraa."
  },
  sid: {
    subject: (name) => `Hawasa Gebeyara Baxe Daggino, ${name}!`,
    eyebrow: "HAWAASA GEBEYA EENNYUMMA KEERANCHIMMA",
    headline: (name) => `Hawasa Gebeyara Baxe Daggino, ${name}!`,
    securityConfirm: "Hawasa Gebeya akkawuntita'nera haaro eessinoonni. Quchumaho buuxantino suuqqa qixxaaweenno.",
    detailEmailLabel: "Imeele Akkawunte",
    detailNeighborhoodLabel: "Dooramino Hawaasa Quchuma",
    detailTimeLabel: "Eessino Yanna",
    ctaLabel: "Hawasa Gebeyara Higge",
    footerNote: "Tini atooti ikkitiro wole hajo dihasii'anno. Ati eessitoonte ikkiro saato qaale soorri."
  }
};
function buildWelcomeBackEmail(payload) {
  const normalizedEmail = (payload.email ?? "").trim().toLowerCase();
  const displayName = (payload.displayName ?? "").trim().slice(0, 100) || "Hawassa Shopper";
  const neighborhood = (payload.neighborhood ?? "").trim().slice(0, 100) || "All Hawassa";
  const language = normalizeSupportedLanguage(payload.language);
  const localizedNeighborhood = getLocalizedNeighborhood(neighborhood, language);
  const formattedTimestamp = formatLoginTimestamp(payload.loginTimestamp);
  const rawAppUrl = (payload.appUrl ?? "").trim();
  const appUrl = /^https?:\/\//i.test(rawAppUrl) ? rawAppUrl : "https://hawasagebeya.vercel.app";
  const copy = EMAIL_LOCALE_COPY[language];
  const subject = copy.subject(displayName);
  const headline = copy.headline(displayName);
  const safeName = escapeHtml(displayName);
  const safeEmail = escapeHtml(normalizedEmail);
  const safeNeighborhood = escapeHtml(localizedNeighborhood);
  const safeTime = escapeHtml(formattedTimestamp);
  const safeAppUrl = escapeHtml(appUrl);
  const safeHeadline = escapeHtml(headline);
  const safeEyebrow = escapeHtml(copy.eyebrow);
  const safeSecurity = escapeHtml(copy.securityConfirm);
  const safeFooter = escapeHtml(copy.footerNote);
  const html = `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1C1917;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FAF8F5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #E7E5E4;box-shadow:0 8px 24px rgba(4,120,87,0.08);">
          <!-- Sidama Forest Emerald & Honey Gold Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#064E3B 0%,#047857 65%,#D97706 100%);padding:28px 28px 24px 28px;text-align:left;">
              <div style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:rgba(255,255,255,0.18);border:1px solid rgba(253,230,138,0.45);color:#FDE68A;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                ${safeEyebrow}
              </div>
              <h1 style="margin:12px 0 4px 0;font-size:22px;line-height:1.3;font-weight:800;color:#FFFFFF;">
                ${safeHeadline}
              </h1>
              <p style="margin:0;font-size:13px;color:#ECFDF5;opacity:0.92;">
                Hawasa Gebeya \xB7 Hawassa, Sidama
              </p>
            </td>
          </tr>
          <!-- Tibeb Accent Strip -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#047857 0%,#D97706 50%,#C2410C 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Main Body -->
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#44403C;">
                ${safeSecurity}
              </p>

              <!-- Sign-In Details Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FAF8F5;border:1px solid #E7E5E4;border-radius:14px;padding:16px 18px;margin-bottom:22px;">
                <tr>
                  <td style="padding:6px 0;font-size:12px;color:#78716C;width:44%;">
                    ${escapeHtml(copy.detailEmailLabel)}
                  </td>
                  <td style="padding:6px 0;font-size:12px;font-weight:700;color:#1C1917;text-align:right;">
                    ${safeEmail}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:12px;color:#78716C;border-top:1px solid #E7E5E4;">
                    ${escapeHtml(copy.detailNeighborhoodLabel)}
                  </td>
                  <td style="padding:6px 0;font-size:12px;font-weight:700;color:#047857;text-align:right;border-top:1px solid #E7E5E4;">
                    ${safeNeighborhood}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:12px;color:#78716C;border-top:1px solid #E7E5E4;">
                    ${escapeHtml(copy.detailTimeLabel)}
                  </td>
                  <td style="padding:6px 0;font-size:12px;font-weight:600;color:#D97706;text-align:right;border-top:1px solid #E7E5E4;">
                    ${safeTime}
                  </td>
                </tr>
              </table>

              <!-- Primary Emerald CTA -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding:4px 0 8px 0;">
                    <a href="${safeAppUrl}" style="display:inline-block;padding:13px 26px;background-color:#047857;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:700;border-radius:12px;">
                      ${escapeHtml(copy.ctaLabel)} \u2192
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0 0;padding-top:16px;border-top:1px solid #E7E5E4;font-size:11px;line-height:1.55;color:#78716C;">
                Signed in as <strong style="color:#44403C;">${safeName}</strong>. ${safeFooter}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  const text2 = [
    headline,
    "",
    copy.securityConfirm,
    "",
    `${copy.detailEmailLabel}: ${normalizedEmail}`,
    `${copy.detailNeighborhoodLabel}: ${localizedNeighborhood}`,
    `${copy.detailTimeLabel}: ${formattedTimestamp}`,
    "",
    `${copy.ctaLabel}: ${appUrl}`,
    "",
    copy.footerNote
  ].join("\n");
  return {
    subject,
    html,
    text: text2,
    normalizedEmail,
    displayName,
    neighborhood,
    localizedNeighborhood,
    language,
    formattedTimestamp,
    appUrl
  };
}
async function dispatchWelcomeBackEmail(rendered) {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    try {
      const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || "Hawasa Gebeya <onboarding@resend.dev>";
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [rendered.normalizedEmail],
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text
        })
      });
      if (response.ok) {
        console.info(
          `[Hawasa Gebeya Mail \xB7 Resend] Sent welcome-back email to ${rendered.normalizedEmail} (${rendered.localizedNeighborhood})`
        );
        return { sent: true, mode: "simulated_or_smtp", channel: "resend" };
      }
      const errBody = await response.text().catch(() => "");
      console.warn(
        `[Hawasa Gebeya Mail \xB7 Resend] HTTP ${response.status}; falling back to server log: ${errBody}`
      );
    } catch (err) {
      console.warn("[Hawasa Gebeya Mail \xB7 Resend] Dispatch failed; falling back:", err);
    }
  }
  const smtpHost = process.env.SMTP_HOST?.trim();
  if (smtpHost) {
    try {
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const smtpUser = process.env.SMTP_USER?.trim();
      const smtpPass = process.env.SMTP_PASS?.trim();
      const fromAddress = process.env.SMTP_FROM?.trim() || "Hawasa Gebeya <no-reply@hawasagebeya.et>";
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        ...smtpUser && smtpPass ? { auth: { user: smtpUser, pass: smtpPass } } : {}
      });
      await transporter.sendMail({
        from: fromAddress,
        to: rendered.normalizedEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text
      });
      console.info(
        `[Hawasa Gebeya Mail \xB7 SMTP] Sent welcome-back email to ${rendered.normalizedEmail} (${rendered.localizedNeighborhood})`
      );
      return { sent: true, mode: "simulated_or_smtp", channel: "smtp" };
    } catch (err) {
      console.warn("[Hawasa Gebeya Mail \xB7 SMTP] Dispatch failed; falling back:", err);
    }
  }
  console.info(
    [
      "------------------------------------------------------------",
      "[Hawasa Gebeya Mail \xB7 Simulated Preview Dispatch]",
      `To:           ${rendered.normalizedEmail}`,
      `Name:         ${rendered.displayName}`,
      `Neighborhood: ${rendered.localizedNeighborhood} (${rendered.neighborhood})`,
      `Language:     ${rendered.language}`,
      `Timestamp:    ${rendered.formattedTimestamp}`,
      `Subject:      ${rendered.subject}`,
      `App URL:      ${rendered.appUrl}`,
      "------------------------------------------------------------"
    ].join("\n")
  );
  return { sent: true, mode: "simulated_or_smtp", channel: "preview_log" };
}

// src/server/payments.ts
import crypto2 from "node:crypto";

// src/utils/imageUpload.ts
var MAX_IMAGE_FILE_BYTES = 150 * 1024;
var MAX_IMAGE_UPLOAD_DATA_URL_LENGTH = 205e3;
function estimateDataUrlByteSize(dataUrl) {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) return dataUrl.length;
  const base64 = dataUrl.slice(commaIdx + 1).trim();
  if (!base64) return 0;
  let padding = 0;
  if (base64.endsWith("==")) padding = 2;
  else if (base64.endsWith("=")) padding = 1;
  return Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
}
function validateImagePayloadSize(dataUrl, maxBytes = MAX_IMAGE_FILE_BYTES, maxLength = MAX_IMAGE_UPLOAD_DATA_URL_LENGTH) {
  const byteSize = estimateDataUrlByteSize(dataUrl);
  const valid = byteSize > 0 && byteSize < maxBytes && dataUrl.length <= maxLength;
  return { valid, byteSize };
}

// src/utils/coffeeCategorizer.ts
var CANONICAL_COFFEE_CATEGORY = "coffee";
var COFFEE_CATEGORY_ALIAS_MAP = /* @__PURE__ */ new Set([
  "coffee",
  "ethiopian coffee",
  "ethiopian-coffee",
  "roasted coffee",
  "roasted-coffee",
  "coffee beans",
  "coffee-beans",
  "green coffee",
  "green-coffee",
  "green coffee beans",
  "green-coffee-beans",
  "ground coffee",
  "ground-coffee",
  "whole bean coffee",
  "whole-bean-coffee",
  "specialty coffee",
  "specialty-coffee",
  "coffee traders",
  "coffee-traders",
  "arabica coffee",
  "arabica-coffee",
  "single origin coffee",
  "single-origin-coffee",
  "espresso beans",
  "espresso-beans",
  "buna",
  "ethiopian buna",
  "ethiopian-buna"
]);
var GENERAL_CATEGORY_ALIAS_MAP = {
  groceries: "groceries",
  grocery: "groceries",
  "groceries & coffee": "groceries",
  "groceries and coffee": "groceries",
  supermarket: "groceries",
  pantry: "groceries",
  "clothing-fashion": "clothing-fashion",
  clothing: "clothing-fashion",
  fashion: "clothing-fashion",
  apparel: "clothing-fashion",
  "clothing & habesha": "clothing-fashion",
  "clothing and habesha": "clothing-fashion",
  electronics: "electronics",
  "phones & electronics": "electronics",
  "phones and electronics": "electronics",
  phones: "electronics",
  mobile: "electronics",
  "mobile phones": "electronics",
  gadgets: "electronics",
  "food-spices": "food-spices",
  spices: "food-spices",
  "spices & honey": "food-spices",
  "spices and honey": "food-spices",
  "food & spices": "food-spices",
  "food & drinks": "food-spices",
  "home-living": "home-living",
  home: "home-living",
  household: "home-living",
  "home & household": "home-living",
  "home & living": "home-living",
  furniture: "home-living",
  kitchenware: "home-living",
  "beauty-cosmetics": "beauty-cosmetics",
  beauty: "beauty-cosmetics",
  cosmetics: "beauty-cosmetics",
  "beauty & care": "beauty-cosmetics",
  "beauty & health": "beauty-cosmetics",
  skincare: "beauty-cosmetics",
  sports: "sports",
  fitness: "sports",
  "sports & fitness": "sports",
  automotive: "automotive",
  auto: "automotive",
  "car parts": "automotive"
};
var PERMISSIVE_AUTO_COFFEE_SOURCE_CATEGORIES = /* @__PURE__ */ new Set([
  "",
  "coffee",
  "groceries",
  "food-spices"
]);
var CONFLICTING_NON_COFFEE_CATEGORIES = /* @__PURE__ */ new Set([
  "electronics",
  "clothing-fashion",
  "home-living",
  "beauty-cosmetics",
  "sports",
  "automotive"
]);
var KNOWN_COFFEE_ORIGINS = [
  "Sidama",
  "Yirgacheffe",
  "Guji",
  "Harar",
  "Jimma",
  "Kaffa",
  "Limu",
  "Nekemte",
  "Bench Maji"
];
var COFFEE_ACCESSORY_OR_AMBIGUOUS_PATTERN = /\b(mug|mugs|cup|cups|tumbler|thermos|flask|table|tables|tray|coaster|maker|machine|grinder|press|kettle|pot|jebena|filter|filters|scale|tamper|frother|spoon|jar|canister|tin|rack|stand|poster|art|sign|scrub|soap|lotion|cream|serum|shampoo|mask|candle|perfume|lipstick|polish|cake|cookie|cookies|biscuit|biscuits|brownie|chocolate|candy|toffee|ice[\s-]?cream|syrup|liqueur|shirt|t-shirt|tee|dress|kemis|pants|trousers|jeans|jacket|hoodie|sweater|scarf|shoes|sneakers|bag|backpack|sofa|curtain|rug|pillow|paint|dye|colored|colour|color|shade|brown|flavored|flavoured|scented|print|themed)\b/i;
var DEFINITE_NON_COFFEE_PRODUCT_PATTERN = /\b(smartphone|mobile\s+phone|cell\s+phone|iphone|samsung|galaxy|tecno|infinix|xiaomi|redmi|huawei|laptop|notebook|tablet|ipad|earbuds|airpods|headphones|charger|power\s+bank|television|smart\s+tv|refrigerator|washing\s+machine|habesha\s+kemis|cotton\s+dress|t-shirt|jeans|sneakers|running\s+shoes|car\s+battery|motor\s+oil|brake\s+pad|dumbbell|treadmill|football|basketball|berbere|mitmita|shiro|teff\s+flour|pure\s+honey|sidama\s+honey)\b/i;
var REGIONAL_COFFEE_PATTERN = /\b(sidama|yirgacheffe|yirgachefe|harar|hararghe|jimma|kaffa|guji|limu|nekemte|bench[\s-]?maji|ethiopian)\b[\s\w-]{0,40}\b(coffee|buna|arabica|espresso)\b/i;
var EXPLICIT_COFFEE_FORM_PATTERN = /\b(roasted|ground|green|whole[\s-]?bean|single[\s-]?origin|specialty|organic|washed|natural|honey[\s-]?process|arabica|espresso|decaf|instant|traditional|freshly[\s-]?roasted|dark[\s-]?roast|medium[\s-]?roast|light[\s-]?roast)\s+(?:ethiopian\s+|sidama\s+|yirgacheffe\s+|harar\s+|jimma\s+|guji\s+)?(coffee|buna)(\s+beans?)?\b/i;
var COFFEE_NOUN_HEAD_PATTERN = /\b(coffee|buna)\s+(beans?|powder|roast|roasted|blend|grounds?|pack|pouch|bag|lot|sack|harvest|export|250\s*g|500\s*g|1\s*kg|2\s*kg|5\s*kg)\b/i;
var REGIONAL_ROASTED_BEANS_PATTERN = /\b(sidama|yirgacheffe|yirgachefe|harar|hararghe|jimma|kaffa|guji|limu|ethiopian)\s+(roasted|washed|natural|green|whole)\s+beans?\b/i;
var STANDALONE_COFFEE_WORD_PATTERN = /\b(coffee|buna)\b/i;
var PACKAGE_WEIGHT_REGEX = /\b(\d+(?:\.\d+)?\s*(?:g|kg))\b/i;
function normalizeProductCategory(rawCategory) {
  if (!rawCategory || typeof rawCategory !== "string") return "";
  const cleaned = rawCategory.trim().toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
  if (!cleaned) return "";
  if (COFFEE_CATEGORY_ALIAS_MAP.has(cleaned)) {
    return CANONICAL_COFFEE_CATEGORY;
  }
  const hyphenated = cleaned.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (COFFEE_CATEGORY_ALIAS_MAP.has(hyphenated)) {
    return CANONICAL_COFFEE_CATEGORY;
  }
  if (GENERAL_CATEGORY_ALIAS_MAP[cleaned]) {
    return GENERAL_CATEGORY_ALIAS_MAP[cleaned];
  }
  if (GENERAL_CATEGORY_ALIAS_MAP[hyphenated]) {
    return GENERAL_CATEGORY_ALIAS_MAP[hyphenated];
  }
  return hyphenated;
}
function inferNonCoffeeCategoryHint(structuredText) {
  const lower = structuredText.toLowerCase();
  if (/\b(smartphone|mobile\s+phone|phone|iphone|samsung|galaxy|tecno|infinix|xiaomi|redmi|laptop|tablet|earbuds|charger|tv)\b/.test(lower)) {
    return "electronics";
  }
  if (/\b(shirt|t-shirt|tee|dress|kemis|pants|trousers|jeans|jacket|hoodie|sweater|scarf|shoes|sneakers)\b/.test(lower)) {
    return "clothing-fashion";
  }
  if (/\b(scrub|soap|lotion|cream|serum|shampoo|mask|perfume|lipstick|polish)\b/.test(lower)) {
    return "beauty-cosmetics";
  }
  if (/\b(mug|cup|tumbler|thermos|flask|table|tray|coaster|maker|machine|grinder|press|kettle|pot|jebena|filter|candle|sofa|curtain|rug|pillow)\b/.test(lower)) {
    return "home-living";
  }
  if (/\b(car\s+battery|motor\s+oil|brake\s+pad|tire)\b/.test(lower)) {
    return "automotive";
  }
  if (/\b(dumbbell|treadmill|football|basketball)\b/.test(lower)) {
    return "sports";
  }
  if (/\b(berbere|mitmita|shiro|honey)\b/.test(lower)) {
    return "food-spices";
  }
  return "groceries";
}
function inferCoffeeDetailsFromStructuredFields(name, productType) {
  const text2 = `${name ?? ""} ${productType ?? ""}`.trim();
  if (!text2) return {};
  const inferred = {};
  for (const origin of KNOWN_COFFEE_ORIGINS) {
    if (new RegExp(`\\b${origin}\\b`, "i").test(text2)) {
      inferred.origin = origin;
      break;
    }
  }
  if (!inferred.origin && /\byirgachefe\b/i.test(text2)) {
    inferred.origin = "Yirgacheffe";
  } else if (!inferred.origin && /\bhararghe\b/i.test(text2)) {
    inferred.origin = "Harar";
  }
  let beanForm;
  if (/\b(ground|powder|fine\s+grind|medium\s+grind|coarse\s+grind)\b/i.test(text2)) {
    beanForm = "ground";
  } else if (/\b(whole[\s-]?bean|coffee\s+beans?|green\s+coffee\s+beans?|roasted\s+beans?)\b/i.test(text2)) {
    beanForm = "whole_bean";
  }
  if (beanForm) inferred.beanForm = beanForm;
  let roastLevel;
  if (/\bmedium[\s-]?dark\s+roast\b/i.test(text2)) {
    roastLevel = "medium_dark";
  } else if (/\blight\s+roast\b/i.test(text2)) {
    roastLevel = "light";
  } else if (/\bmedium\s+roast\b/i.test(text2)) {
    roastLevel = "medium";
  } else if (/\bdark\s+roast\b/i.test(text2)) {
    roastLevel = "dark";
  }
  if (roastLevel) inferred.roastLevel = roastLevel;
  let processingMethod;
  if (/\bwashed\b/i.test(text2)) {
    processingMethod = "washed";
  } else if (/\bnatural(?:\s+process)?\b/i.test(text2)) {
    processingMethod = "natural";
  } else if (/\bhoney[\s-]?process\b/i.test(text2)) {
    processingMethod = "honey";
  } else if (/\banaerobic\b/i.test(text2)) {
    processingMethod = "anaerobic";
  }
  if (processingMethod) inferred.processingMethod = processingMethod;
  const weightMatch = text2.match(PACKAGE_WEIGHT_REGEX);
  if (weightMatch?.[1]) {
    inferred.packageWeight = weightMatch[1].replace(/\s+/g, "").toLowerCase();
  }
  return inferred;
}
function classifyProductCoffeeCategory(input) {
  const name = (input.name ?? "").trim();
  const productType = (input.productType ?? "").trim();
  const rawCategory = (input.category ?? "").trim();
  const normalizedCategory = normalizeProductCategory(rawCategory);
  const normalizedProductTypeCategory = normalizeProductCategory(productType);
  const structuredText = `${name} ${productType}`.trim();
  const matchedSignals = [];
  const categoryIsCoffee = normalizedCategory === CANONICAL_COFFEE_CATEGORY;
  const productTypeIsCoffee = normalizedProductTypeCategory === CANONICAL_COFFEE_CATEGORY;
  if (categoryIsCoffee) matchedSignals.push(`category:${rawCategory || "coffee"}`);
  if (productTypeIsCoffee) matchedSignals.push(`productType:${productType}`);
  const hasAccessoryOrAmbiguousTerm = COFFEE_ACCESSORY_OR_AMBIGUOUS_PATTERN.test(structuredText);
  const hasDefiniteNonCoffeeTerm = DEFINITE_NON_COFFEE_PRODUCT_PATTERN.test(structuredText);
  const hasRegionalCoffee = REGIONAL_COFFEE_PATTERN.test(structuredText);
  const hasExplicitCoffeeForm = EXPLICIT_COFFEE_FORM_PATTERN.test(structuredText);
  const hasCoffeeNounHead = COFFEE_NOUN_HEAD_PATTERN.test(structuredText);
  const hasRegionalBeans = REGIONAL_ROASTED_BEANS_PATTERN.test(structuredText);
  const hasCoffeeWord = STANDALONE_COFFEE_WORD_PATTERN.test(structuredText);
  if (hasRegionalCoffee) matchedSignals.push("regional_coffee_name");
  if (hasExplicitCoffeeForm) matchedSignals.push("coffee_form_name");
  if (hasCoffeeNounHead) matchedSignals.push("coffee_noun_head");
  if (hasRegionalBeans) matchedSignals.push("regional_roasted_beans");
  if (hasCoffeeWord && matchedSignals.length === 0) matchedSignals.push("coffee_keyword");
  const inferredCoffeeDetails = inferCoffeeDetailsFromStructuredFields(name, productType);
  const inferredPayload = Object.keys(inferredCoffeeDetails).length > 0 ? inferredCoffeeDetails : void 0;
  if ((hasCoffeeWord || categoryIsCoffee || productTypeIsCoffee) && hasAccessoryOrAmbiguousTerm) {
    const hintedNonCoffee = normalizedCategory && normalizedCategory !== CANONICAL_COFFEE_CATEGORY ? normalizedCategory : inferNonCoffeeCategoryHint(structuredText);
    if (input.categoryConfirmed) {
      const confirmed = normalizeProductCategory(
        input.confirmedCategory || normalizedCategory || hintedNonCoffee
      );
      if (confirmed === CANONICAL_COFFEE_CATEGORY) {
        return {
          outcome: "coffee",
          isCoffee: true,
          resolvedCategory: CANONICAL_COFFEE_CATEGORY,
          requestedCategory: normalizedCategory,
          suggestedCategory: CANONICAL_COFFEE_CATEGORY,
          autoAssigned: normalizedCategory !== CANONICAL_COFFEE_CATEGORY,
          requiresConfirmation: false,
          reason: "Seller confirmed this ambiguous product belongs in Coffee Traders.",
          matchedSignals,
          inferredCoffeeDetails: inferredPayload
        };
      }
      return {
        outcome: "non_coffee",
        isCoffee: false,
        resolvedCategory: confirmed || hintedNonCoffee,
        requestedCategory: normalizedCategory,
        suggestedCategory: confirmed || hintedNonCoffee,
        autoAssigned: false,
        requiresConfirmation: false,
        reason: `Seller confirmed this product belongs in "${confirmed || hintedNonCoffee}" rather than Coffee Traders.`,
        matchedSignals
      };
    }
    return {
      outcome: "ambiguous",
      isCoffee: false,
      resolvedCategory: hintedNonCoffee,
      requestedCategory: normalizedCategory || hintedNonCoffee,
      suggestedCategory: hintedNonCoffee,
      autoAssigned: false,
      requiresConfirmation: true,
      reason: "Product name/type looks coffee-related but resembles an accessory, apparel, or non-coffee item. Confirm whether it belongs in Coffee Traders or a general category.",
      matchedSignals
    };
  }
  const hasClearCoffeeSignal = !hasDefiniteNonCoffeeTerm && (productTypeIsCoffee || hasRegionalCoffee || hasExplicitCoffeeForm || hasCoffeeNounHead || hasRegionalBeans || hasCoffeeWord);
  if (hasClearCoffeeSignal) {
    if (normalizedCategory && CONFLICTING_NON_COFFEE_CATEGORIES.has(normalizedCategory)) {
      return {
        outcome: "conflict",
        isCoffee: true,
        resolvedCategory: CANONICAL_COFFEE_CATEGORY,
        requestedCategory: normalizedCategory,
        suggestedCategory: CANONICAL_COFFEE_CATEGORY,
        autoAssigned: false,
        requiresConfirmation: false,
        reason: `Product "${name}" is identified as Ethiopian/specialty coffee and cannot be listed under "${normalizedCategory}". Assign it to Coffee Traders ("coffee").`,
        matchedSignals,
        inferredCoffeeDetails: inferredPayload
      };
    }
    if (PERMISSIVE_AUTO_COFFEE_SOURCE_CATEGORIES.has(normalizedCategory)) {
      return {
        outcome: "coffee",
        isCoffee: true,
        resolvedCategory: CANONICAL_COFFEE_CATEGORY,
        requestedCategory: normalizedCategory,
        suggestedCategory: CANONICAL_COFFEE_CATEGORY,
        autoAssigned: rawCategory.trim() !== CANONICAL_COFFEE_CATEGORY,
        requiresConfirmation: false,
        reason: normalizedCategory === CANONICAL_COFFEE_CATEGORY ? "Normalized coffee category assigned to Coffee Traders." : "Automatically detected coffee product from structured fields and assigned to Coffee Traders.",
        matchedSignals,
        inferredCoffeeDetails: inferredPayload
      };
    }
    return {
      outcome: "conflict",
      isCoffee: true,
      resolvedCategory: CANONICAL_COFFEE_CATEGORY,
      requestedCategory: normalizedCategory,
      suggestedCategory: CANONICAL_COFFEE_CATEGORY,
      autoAssigned: false,
      requiresConfirmation: false,
      reason: `Product "${name}" is identified as a coffee product and conflicts with category "${normalizedCategory}".`,
      matchedSignals,
      inferredCoffeeDetails: inferredPayload
    };
  }
  if (categoryIsCoffee) {
    if (hasDefiniteNonCoffeeTerm) {
      const suggested = inferNonCoffeeCategoryHint(structuredText);
      return {
        outcome: "conflict",
        isCoffee: false,
        resolvedCategory: suggested,
        requestedCategory: CANONICAL_COFFEE_CATEGORY,
        suggestedCategory: suggested,
        autoAssigned: false,
        requiresConfirmation: false,
        reason: `Product "${name}" appears to be a non-coffee item and cannot be categorized under Coffee Traders.`,
        matchedSignals
      };
    }
    return {
      outcome: "coffee",
      isCoffee: true,
      resolvedCategory: CANONICAL_COFFEE_CATEGORY,
      requestedCategory: CANONICAL_COFFEE_CATEGORY,
      suggestedCategory: CANONICAL_COFFEE_CATEGORY,
      autoAssigned: rawCategory.trim() !== CANONICAL_COFFEE_CATEGORY,
      requiresConfirmation: false,
      reason: "Coffee category normalized and assigned to Coffee Traders.",
      matchedSignals,
      inferredCoffeeDetails: inferredPayload
    };
  }
  const finalNonCoffeeCategory = normalizedCategory || "groceries";
  return {
    outcome: "non_coffee",
    isCoffee: false,
    resolvedCategory: finalNonCoffeeCategory,
    requestedCategory: finalNonCoffeeCategory,
    suggestedCategory: finalNonCoffeeCategory,
    autoAssigned: false,
    requiresConfirmation: false,
    reason: "Standard non-coffee marketplace product.",
    matchedSignals: []
  };
}
function planCoffeeProductMigration(products, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
  let alreadyCategorized = 0;
  let skipped = 0;
  let ambiguous = 0;
  const changes = [];
  for (const product of products) {
    const normalizedCurrent = normalizeProductCategory(product.category);
    const alreadyCanonicalCoffee = product.category === CANONICAL_COFFEE_CATEGORY;
    if (alreadyCanonicalCoffee) {
      alreadyCategorized += 1;
      continue;
    }
    const classification = classifyProductCoffeeCategory({
      name: product.name,
      category: product.category,
      productType: product.productType,
      coffeeDetails: product.coffeeDetails
    });
    if (classification.outcome === "ambiguous") {
      ambiguous += 1;
      continue;
    }
    if (classification.outcome === "coffee") {
      const mergedCoffeeDetails = product.coffeeDetails || classification.inferredCoffeeDetails ? {
        ...classification.inferredCoffeeDetails ?? {},
        ...product.coffeeDetails ?? {}
      } : void 0;
      const updatedProduct = {
        ...product,
        category: CANONICAL_COFFEE_CATEGORY,
        ...mergedCoffeeDetails && Object.keys(mergedCoffeeDetails).length > 0 ? { coffeeDetails: mergedCoffeeDetails } : {},
        updatedAt: nowIso
      };
      changes.push({
        productId: product.productId,
        name: product.name,
        previousCategory: product.category,
        nextCategory: CANONICAL_COFFEE_CATEGORY,
        updatedProduct,
        reason: classification.reason
      });
      continue;
    }
    if (normalizedCurrent && normalizedCurrent !== product.category) {
      const updatedProduct = {
        ...product,
        category: normalizedCurrent,
        updatedAt: nowIso
      };
      if ("coffeeDetails" in updatedProduct) {
        delete updatedProduct.coffeeDetails;
      }
      changes.push({
        productId: product.productId,
        name: product.name,
        previousCategory: product.category,
        nextCategory: normalizedCurrent,
        updatedProduct,
        reason: `Normalized category slug from "${product.category}" to "${normalizedCurrent}".`
      });
      continue;
    }
    skipped += 1;
  }
  return {
    scanned: products.length,
    alreadyCategorized,
    eligible: changes.length,
    skipped,
    ambiguous,
    changes
  };
}

// src/utils/marketplaceLogic.ts
var DEFAULT_HAWASSA_DELIVERY_FEE_ETB = 80;
var FREE_DELIVERY_THRESHOLD_ETB = 2e3;
var DEFAULT_MAX_ORDER_AMOUNT_ETB = 1e5;
var DEFAULT_GOVERNANCE_CONFIG = {
  configId: "global",
  deliveryFeeEtb: DEFAULT_HAWASSA_DELIVERY_FEE_ETB,
  freeDeliveryThresholdEtb: FREE_DELIVERY_THRESHOLD_ETB,
  maxOrderAmountEtb: DEFAULT_MAX_ORDER_AMOUNT_ETB,
  orderingPaused: false,
  maintenanceBanner: "",
  strictShopVerification: true,
  updatedAt: "2026-11-10T08:00:00.000Z"
};
var LOYALTY_ETB_PER_POINT_EARNED = 20;
var LOYALTY_ETB_PER_POINT_REDEEMED = 1;
var LOYALTY_MIN_REDEEM_POINTS = 10;
function calculateEarnedLoyaltyPoints(netMerchandiseEtb) {
  if (!Number.isFinite(netMerchandiseEtb) || netMerchandiseEtb < LOYALTY_ETB_PER_POINT_EARNED) {
    return 0;
  }
  return Math.floor(netMerchandiseEtb / LOYALTY_ETB_PER_POINT_EARNED);
}
function calculateMaxRedeemablePoints(availablePoints, subtotalAfterPromoEtb) {
  if (!Number.isFinite(availablePoints) || !Number.isFinite(subtotalAfterPromoEtb)) return 0;
  const maxByOrder = Math.floor(Math.max(0, subtotalAfterPromoEtb) / LOYALTY_ETB_PER_POINT_REDEEMED);
  return Math.max(0, Math.min(Math.floor(availablePoints), maxByOrder));
}
function validateLoyaltyRedemption(requestedPoints, availablePoints, subtotalAfterPromoEtb) {
  const cleanRequested = Number.isFinite(requestedPoints) ? Math.max(0, Math.floor(requestedPoints)) : 0;
  if (cleanRequested === 0) {
    return { valid: true, appliedPoints: 0, discountAmount: 0 };
  }
  const safeAvailable = Number.isFinite(availablePoints) ? Math.max(0, Math.floor(availablePoints)) : 0;
  if (safeAvailable < LOYALTY_MIN_REDEEM_POINTS || cleanRequested < LOYALTY_MIN_REDEEM_POINTS) {
    return {
      valid: false,
      appliedPoints: 0,
      discountAmount: 0,
      errorKey: "loyaltyErrorMinPoints"
    };
  }
  const maxRedeemable = calculateMaxRedeemablePoints(safeAvailable, subtotalAfterPromoEtb);
  if (maxRedeemable < LOYALTY_MIN_REDEEM_POINTS) {
    return {
      valid: false,
      appliedPoints: 0,
      discountAmount: 0,
      errorKey: "loyaltyErrorOrderTooLow"
    };
  }
  const appliedPoints = Math.min(cleanRequested, maxRedeemable);
  return {
    valid: true,
    appliedPoints,
    discountAmount: appliedPoints * LOYALTY_ETB_PER_POINT_REDEEMED
  };
}
var PROMO_CODES = [
  {
    code: "HAWASSA10",
    type: "percent",
    value: 10,
    maxDiscount: 500,
    minSubtotal: 300,
    summaryKey: "promoDescHawassa10"
  },
  {
    code: "SIDAMA150",
    type: "flat",
    value: 150,
    minSubtotal: 1e3,
    summaryKey: "promoDescSidama150"
  },
  {
    code: "FREEDEL",
    type: "free_delivery",
    value: 0,
    minSubtotal: 0,
    summaryKey: "promoDescFreedel"
  }
];
function validatePromoCode(rawCode, subtotal, fulfillmentMethod) {
  const normalizedCode = rawCode.trim().toUpperCase();
  if (!normalizedCode) {
    return { valid: false, normalizedCode: "", discountAmount: 0, waivesDelivery: false };
  }
  const rule = PROMO_CODES.find((p) => p.code === normalizedCode);
  if (!rule) {
    return {
      valid: false,
      normalizedCode,
      discountAmount: 0,
      waivesDelivery: false,
      errorKey: "promoErrorInvalid"
    };
  }
  if (subtotal < rule.minSubtotal) {
    return {
      valid: false,
      normalizedCode,
      discountAmount: 0,
      waivesDelivery: false,
      errorKey: "promoErrorMinSubtotal",
      minSubtotal: rule.minSubtotal
    };
  }
  if (rule.type === "free_delivery") {
    if (fulfillmentMethod === "pickup") {
      return {
        valid: false,
        normalizedCode,
        discountAmount: 0,
        waivesDelivery: false,
        errorKey: "promoErrorDeliveryOnly"
      };
    }
    return {
      valid: true,
      normalizedCode,
      discountAmount: 0,
      waivesDelivery: true
    };
  }
  const rawDiscount = rule.type === "percent" ? Math.round(subtotal * rule.value / 100) : rule.value;
  const capped = rule.maxDiscount != null ? Math.min(rawDiscount, rule.maxDiscount) : rawDiscount;
  return {
    valid: true,
    normalizedCode,
    discountAmount: Math.min(subtotal, Math.max(0, capped)),
    waivesDelivery: false
  };
}
function getCartItemUnitPrice(item) {
  if (typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice) && item.unitPrice > 0) {
    return item.unitPrice;
  }
  if (item.variantId && item.product.variants) {
    const matched = item.product.variants.find((v) => v.id === item.variantId);
    if (matched) return matched.price;
  }
  return item.product.price;
}
function calculateCartSummary(items, fulfillmentMethod, deliveryFeePerOrder = DEFAULT_HAWASSA_DELIVERY_FEE_ETB, promoCode, loyaltyPointsToRedeem = 0, availableLoyaltyPoints = 0, freeDeliveryThresholdEtb = FREE_DELIVERY_THRESHOLD_ETB) {
  const shopIds = Array.from(new Set(items.map((item) => item.shopId)));
  const stockIssues = [];
  let subtotal = 0;
  let itemCount = 0;
  for (const item of items) {
    const qty = Math.max(0, Math.floor(item.quantity));
    if (qty <= 0) continue;
    itemCount += qty;
    subtotal += getCartItemUnitPrice(item) * qty;
    const variantStock = item.variantId && item.product.variants ? item.product.variants.find((v) => v.id === item.variantId)?.stock ?? item.product.stock : item.product.stock;
    if (!item.product.isAvailable || item.product.status !== "active") {
      stockIssues.push(`${item.product.name} is currently unavailable.`);
    } else if (qty > variantStock) {
      stockIssues.push(`Only ${variantStock} left in stock for ${item.product.name}.`);
    }
  }
  const promoResult = promoCode ? validatePromoCode(promoCode, subtotal, fulfillmentMethod) : null;
  const promoDiscountAmount = promoResult?.valid ? promoResult.discountAmount : 0;
  const subtotalAfterPromo = Math.max(0, subtotal - promoDiscountAmount);
  const loyaltyValidation = validateLoyaltyRedemption(
    loyaltyPointsToRedeem,
    availableLoyaltyPoints,
    subtotalAfterPromo
  );
  const loyaltyPointsApplied = loyaltyValidation.valid ? loyaltyValidation.appliedPoints : 0;
  const loyaltyDiscountAmount = loyaltyValidation.valid ? loyaltyValidation.discountAmount : 0;
  const discountAmount = promoDiscountAmount + loyaltyDiscountAmount;
  const netMerchandise = Math.max(0, subtotal - discountAmount);
  const pointsToEarn = items.length > 0 ? calculateEarnedLoyaltyPoints(netMerchandise) : 0;
  const safeThreshold = Math.max(0, freeDeliveryThresholdEtb);
  const freeDeliveryByThreshold = subtotal >= safeThreshold;
  const freeDeliveryUnlocked = fulfillmentMethod === "delivery" && items.length > 0 && (freeDeliveryByThreshold || Boolean(promoResult?.valid && promoResult.waivesDelivery));
  const deliveryFee = items.length > 0 && fulfillmentMethod === "delivery" && !freeDeliveryUnlocked ? deliveryFeePerOrder : 0;
  const amountToFreeDelivery = Math.max(0, safeThreshold - subtotal);
  return {
    itemCount,
    subtotal,
    promoDiscountAmount,
    loyaltyPointsApplied,
    loyaltyDiscountAmount,
    loyaltyErrorKey: loyaltyValidation.errorKey,
    pointsToEarn,
    discountAmount,
    promoCode: promoResult?.valid ? promoResult.normalizedCode : null,
    promoErrorKey: promoResult && !promoResult.valid ? promoResult.errorKey : void 0,
    promoMinSubtotal: promoResult?.minSubtotal,
    deliveryFee,
    freeDeliveryUnlocked,
    amountToFreeDelivery,
    totalAmount: netMerchandise + deliveryFee,
    shopIds,
    hasMultipleShops: shopIds.length > 1,
    primaryShopId: shopIds[0] ?? null,
    hasStockIssues: stockIssues.length > 0,
    stockIssues
  };
}
function validateOrderAgainstGovernance(params) {
  if (params.userProfile?.accountStatus === "suspended") {
    return { allowed: false, errorKey: "governanceUserSuspended" };
  }
  if (params.config.orderingPaused) {
    return {
      allowed: false,
      errorKey: "governanceOrderingPaused",
      customMessage: params.config.maintenanceBanner?.trim() || void 0
    };
  }
  if (!params.shop || params.shop.status === "suspended" || params.config.strictShopVerification && params.shop.status !== "approved") {
    return { allowed: false, errorKey: "governanceShopUnavailable" };
  }
  if (params.totalAmount > params.config.maxOrderAmountEtb) {
    return { allowed: false, errorKey: "governanceMaxOrderExceeded" };
  }
  return { allowed: true };
}
function getEffectiveShopVerificationStatus(shop, verification) {
  if (verification?.status) return verification.status;
  if (shop?.verificationStatus) return shop.verificationStatus;
  if (shop?.status === "approved") return "approved";
  return "unverified";
}
function canShopListProducts(shop, verification) {
  if (!shop || shop.status === "suspended") return false;
  const docStatus = getEffectiveShopVerificationStatus(shop, verification);
  return docStatus === "approved" && shop.status === "approved";
}
function normalizePhoneToE164(raw) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { valid: false, e164: "", errorKey: "phoneAuthErrorInvalid" };
  }
  const cleaned = trimmed.replace(/[\s\-().]/g, "");
  let candidate = cleaned;
  if (candidate.startsWith("00")) {
    candidate = `+${candidate.slice(2)}`;
  } else if (/^0[79]\d{8}$/.test(candidate)) {
    candidate = `+251${candidate.slice(1)}`;
  } else if (/^[79]\d{8}$/.test(candidate)) {
    candidate = `+251${candidate}`;
  } else if (/^251[79]\d{8}$/.test(candidate)) {
    candidate = `+${candidate}`;
  } else if (!candidate.startsWith("+") && /^\d{8,15}$/.test(candidate)) {
    candidate = `+${candidate}`;
  }
  if (/^\+[1-9]\d{7,14}$/.test(candidate)) {
    return { valid: true, e164: candidate };
  }
  return { valid: false, e164: "", errorKey: "phoneAuthErrorInvalid" };
}
function isElectronicPaymentMethod(method) {
  return method === "telebirr" || method === "cbe_birr" || method === "chapa" || method === "telebirr_sandbox" || method === "cbe_birr_sandbox";
}
function validateGatewayReferenceLive(method, ref) {
  if (!isElectronicPaymentMethod(method)) {
    return {
      valid: true,
      isEmpty: true,
      normalizedRef: "",
      detectedKind: "none"
    };
  }
  const trimmed = (ref ?? "").trim();
  if (!trimmed) {
    return {
      valid: false,
      isEmpty: true,
      normalizedRef: "",
      detectedKind: "invalid",
      errorKey: "paymentReferenceInvalidError"
    };
  }
  const phoneCleaned = trimmed.replace(/[\s\-().]/g, "");
  if (/^(\+?251|0)[79]\d{8}$/.test(phoneCleaned)) {
    const phoneCheck = normalizePhoneToE164(trimmed);
    if (phoneCheck.valid && /^\+251[79]\d{8}$/.test(phoneCheck.e164)) {
      return {
        valid: true,
        isEmpty: false,
        normalizedRef: phoneCheck.e164.slice(1),
        // e.g. 251911223344 (passes 5-40 alnum Firestore rule)
        detectedKind: "phone"
      };
    }
  }
  const upperCompact = trimmed.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9_-]{5,40}$/.test(upperCompact)) {
    return {
      valid: false,
      isEmpty: false,
      normalizedRef: upperCompact,
      detectedKind: "invalid",
      errorKey: "paymentReferenceInvalidError"
    };
  }
  if (/^(CHAPA-|CHP)[A-Z0-9_-]{2,35}$/.test(upperCompact)) {
    return {
      valid: true,
      isEmpty: false,
      normalizedRef: upperCompact,
      detectedKind: "chapa"
    };
  }
  if (/^(TRX|TB|FT)[A-Z0-9_-]{2,37}$/.test(upperCompact)) {
    return {
      valid: true,
      isEmpty: false,
      normalizedRef: upperCompact,
      detectedKind: "trx"
    };
  }
  if (/^\d{10}$/.test(upperCompact)) {
    return {
      valid: true,
      isEmpty: false,
      normalizedRef: upperCompact,
      detectedKind: "numeric10"
    };
  }
  return {
    valid: true,
    isEmpty: false,
    normalizedRef: upperCompact,
    detectedKind: "custom"
  };
}
function validatePaymentReference(method, ref) {
  const live = validateGatewayReferenceLive(method, ref);
  if (live.valid) {
    return { valid: true, normalizedRef: live.normalizedRef };
  }
  return {
    valid: false,
    normalizedRef: live.normalizedRef,
    errorKey: live.errorKey ?? "paymentReferenceInvalidError"
  };
}
function reconcileCartWithCatalog(cartItems, liveProducts, shopsById = {}, strictShopVerification = true) {
  const productById = new Map(
    liveProducts.map((p) => [p.productId, p])
  );
  let unavailableCount = 0;
  let priceChangedCount = 0;
  let stockIssueCount = 0;
  const entries = cartItems.map((item) => {
    const liveProduct = productById.get(item.product.productId);
    const liveShop = shopsById[item.shopId];
    const snapshotUnitPrice = getCartItemUnitPrice(item);
    const matchedVariant = item.variantId && liveProduct?.variants ? liveProduct.variants.find((v) => v.id === item.variantId) : void 0;
    const liveUnitPrice = liveProduct ? matchedVariant ? matchedVariant.price : liveProduct.price : snapshotUnitPrice;
    const availableStock = liveProduct ? matchedVariant ? Math.max(0, matchedVariant.stock ?? liveProduct.stock) : Math.max(0, liveProduct.stock) : 0;
    const shopBlocked = liveShop ? strictShopVerification ? liveShop.status !== "approved" : liveShop.status === "suspended" : false;
    const variantMissing = Boolean(
      item.variantId && liveProduct?.variants && liveProduct.variants.length > 0 && !matchedVariant
    );
    const isUnavailable = !liveProduct || !liveProduct.isAvailable || liveProduct.status !== "active" || availableStock <= 0 || shopBlocked || variantMissing;
    const priceChanged = Boolean(liveProduct && !isUnavailable && liveUnitPrice !== snapshotUnitPrice);
    const exceedsStock = !isUnavailable && item.quantity > availableStock;
    if (isUnavailable) unavailableCount += 1;
    if (priceChanged) priceChangedCount += 1;
    if (exceedsStock) stockIssueCount += 1;
    const reconciledProduct = liveProduct ? liveProduct : { ...item.product, isAvailable: false, stock: 0 };
    const reconciledItem = {
      ...item,
      product: reconciledProduct,
      variantLabel: matchedVariant?.label ?? item.variantLabel,
      unitPrice: liveUnitPrice
    };
    return {
      item,
      reconciledItem,
      snapshotUnitPrice,
      liveUnitPrice,
      priceChanged,
      availableStock,
      isUnavailable,
      exceedsStock
    };
  });
  return {
    entries,
    reconciledCart: entries.map((e) => e.reconciledItem),
    unavailableCount,
    priceChangedCount,
    stockIssueCount,
    hasBlockingIssues: unavailableCount > 0 || stockIssueCount > 0
  };
}

// src/server/requestValidation.ts
var MAX_CHAT_MESSAGE_LENGTH = 2e3;
var MAX_CHAT_HISTORY_ITEMS = 20;
var MAX_CHAT_HISTORY_ITEM_LENGTH = 4e3;
var MAX_CHAT_SYSTEM_INSTRUCTION_LENGTH = 1500;
var MAX_CHAT_CONTEXT_SUMMARY_LENGTH = 2500;
var MAX_CHAT_LANGUAGE_LENGTH = 16;
var MAX_PAYMENT_CART_ITEMS = 50;
var MAX_PAYMENT_CATALOG_PRODUCTS = 500;
var MAX_PAYMENT_ID_LENGTH = 128;
var MAX_PAYMENT_SHOP_NAME_LENGTH = 120;
var MAX_PAYMENT_REF_LENGTH = 40;
var MAX_PAYMENT_VERIFY_REF_LENGTH = 128;
var MAX_PAYMENT_PROMO_LENGTH = 40;
var MAX_PAYMENT_URL_LENGTH = 500;
var VALID_CHAT_MODES = ["balanced", "deep", "fast", "lite"];
var VALID_PAYMENT_METHODS = [
  "cash_on_delivery",
  "pay_at_pickup",
  "telebirr",
  "cbe_birr",
  "chapa",
  "telebirr_sandbox",
  "cbe_birr_sandbox"
];
function validateChatRequestPayload(rawBody) {
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const body = rawBody;
  if (typeof body.message !== "string") {
    return { ok: false, error: "A chat message string is required." };
  }
  const message = body.message.trim();
  if (message.length === 0) {
    return { ok: false, error: "A chat message is required." };
  }
  if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `Chat message exceeds the ${MAX_CHAT_MESSAGE_LENGTH}-character limit.`
    };
  }
  let mode = "balanced";
  if (body.mode !== void 0) {
    if (typeof body.mode !== "string" || !VALID_CHAT_MODES.includes(body.mode)) {
      return { ok: false, error: "Invalid chat mode." };
    }
    mode = body.mode;
  }
  const history = [];
  if (body.history !== void 0) {
    if (!Array.isArray(body.history)) {
      return { ok: false, error: "Chat history must be an array." };
    }
    if (body.history.length > MAX_CHAT_HISTORY_ITEMS) {
      return {
        ok: false,
        error: `Chat history cannot exceed ${MAX_CHAT_HISTORY_ITEMS} turns.`
      };
    }
    for (const turn of body.history) {
      if (!turn || typeof turn !== "object" || Array.isArray(turn)) {
        return { ok: false, error: "Each chat history entry must be an object." };
      }
      const item = turn;
      if (item.role !== "user" && item.role !== "model") {
        return { ok: false, error: 'Chat history role must be "user" or "model".' };
      }
      if (typeof item.content !== "string" || item.content.trim().length === 0) {
        return { ok: false, error: "Chat history entries must contain non-empty text." };
      }
      if (item.content.length > MAX_CHAT_HISTORY_ITEM_LENGTH) {
        return {
          ok: false,
          error: `Chat history entry exceeds ${MAX_CHAT_HISTORY_ITEM_LENGTH} characters.`
        };
      }
      history.push({ role: item.role, content: item.content });
    }
  }
  let systemInstruction;
  if (body.systemInstruction !== void 0) {
    if (typeof body.systemInstruction !== "string") {
      return { ok: false, error: "systemInstruction must be a string." };
    }
    if (body.systemInstruction.length > MAX_CHAT_SYSTEM_INSTRUCTION_LENGTH) {
      return {
        ok: false,
        error: `systemInstruction exceeds ${MAX_CHAT_SYSTEM_INSTRUCTION_LENGTH} characters.`
      };
    }
    const clean = body.systemInstruction.trim();
    if (clean) systemInstruction = clean;
  }
  let language = "en";
  if (body.language !== void 0) {
    if (typeof body.language !== "string" || body.language.length > MAX_CHAT_LANGUAGE_LENGTH) {
      return {
        ok: false,
        error: `language must be a string up to ${MAX_CHAT_LANGUAGE_LENGTH} characters.`
      };
    }
    language = body.language.trim() || "en";
  }
  let contextSummary;
  if (body.contextSummary !== void 0) {
    if (typeof body.contextSummary !== "string") {
      return { ok: false, error: "contextSummary must be a string." };
    }
    if (body.contextSummary.length > MAX_CHAT_CONTEXT_SUMMARY_LENGTH) {
      return {
        ok: false,
        error: `contextSummary exceeds ${MAX_CHAT_CONTEXT_SUMMARY_LENGTH} characters.`
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
      contextSummary
    }
  };
}
function isSafeHttpUrl(rawUrl) {
  if (rawUrl.length > MAX_PAYMENT_URL_LENGTH) return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
function validatePaymentInitiateBody(rawBody) {
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const body = rawBody;
  if (typeof body.shopId !== "string" || body.shopId.trim().length === 0 || body.shopId.length > MAX_PAYMENT_ID_LENGTH || !/^[a-zA-Z0-9_-]+$/.test(body.shopId)) {
    return { ok: false, error: "Valid shopId is required." };
  }
  if (!body.shop || typeof body.shop !== "object" || Array.isArray(body.shop)) {
    return { ok: false, error: "Shop details object is required." };
  }
  const shop = body.shop;
  if (shop.shopId !== body.shopId) {
    return { ok: false, error: "shop.shopId must match shopId." };
  }
  if (typeof shop.name !== "string" || shop.name.trim().length === 0 || shop.name.length > MAX_PAYMENT_SHOP_NAME_LENGTH) {
    return {
      ok: false,
      error: `Shop name must be between 1 and ${MAX_PAYMENT_SHOP_NAME_LENGTH} characters.`
    };
  }
  if (!Array.isArray(body.cartItems) || body.cartItems.length === 0) {
    return { ok: false, error: "Non-empty cartItems array is required." };
  }
  if (body.cartItems.length > MAX_PAYMENT_CART_ITEMS) {
    return {
      ok: false,
      error: `cartItems cannot exceed ${MAX_PAYMENT_CART_ITEMS} line items.`
    };
  }
  for (const rawItem of body.cartItems) {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
      return { ok: false, error: "Each cartItem must be an object." };
    }
    const item = rawItem;
    const prod = item.product;
    if (!prod || typeof prod !== "object" || typeof prod.productId !== "string" || prod.productId.length === 0 || prod.productId.length > MAX_PAYMENT_ID_LENGTH) {
      return { ok: false, error: "Each cartItem must reference a valid productId." };
    }
    if (typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity < 1 || item.quantity > 999) {
      return { ok: false, error: "Cart item quantity must be between 1 and 999." };
    }
  }
  if (body.catalogProducts !== void 0) {
    if (!Array.isArray(body.catalogProducts)) {
      return { ok: false, error: "catalogProducts must be an array." };
    }
    if (body.catalogProducts.length > MAX_PAYMENT_CATALOG_PRODUCTS) {
      return {
        ok: false,
        error: `catalogProducts cannot exceed ${MAX_PAYMENT_CATALOG_PRODUCTS} items.`
      };
    }
  }
  if (body.fulfillmentMethod !== void 0 && body.fulfillmentMethod !== "delivery" && body.fulfillmentMethod !== "pickup") {
    return { ok: false, error: "Invalid fulfillmentMethod." };
  }
  if (body.paymentMethod !== void 0) {
    if (typeof body.paymentMethod !== "string" || !VALID_PAYMENT_METHODS.includes(body.paymentMethod)) {
      return { ok: false, error: "Invalid paymentMethod." };
    }
  }
  if (body.promoCode !== void 0 && (typeof body.promoCode !== "string" || body.promoCode.length > MAX_PAYMENT_PROMO_LENGTH)) {
    return { ok: false, error: `promoCode cannot exceed ${MAX_PAYMENT_PROMO_LENGTH} characters.` };
  }
  if (body.paymentReference !== void 0 && (typeof body.paymentReference !== "string" || body.paymentReference.length > MAX_PAYMENT_REF_LENGTH)) {
    return {
      ok: false,
      error: `paymentReference cannot exceed ${MAX_PAYMENT_REF_LENGTH} characters.`
    };
  }
  if (body.idempotencyKey !== void 0 && (typeof body.idempotencyKey !== "string" || body.idempotencyKey.length > MAX_PAYMENT_ID_LENGTH)) {
    return {
      ok: false,
      error: `idempotencyKey cannot exceed ${MAX_PAYMENT_ID_LENGTH} characters.`
    };
  }
  if (body.customerEmail !== void 0 && (typeof body.customerEmail !== "string" || body.customerEmail.length > 150)) {
    return { ok: false, error: "customerEmail cannot exceed 150 characters." };
  }
  if (body.customerName !== void 0 && (typeof body.customerName !== "string" || body.customerName.length > 100)) {
    return { ok: false, error: "customerName cannot exceed 100 characters." };
  }
  if (body.customerPhone !== void 0 && (typeof body.customerPhone !== "string" || body.customerPhone.length > 30)) {
    return { ok: false, error: "customerPhone cannot exceed 30 characters." };
  }
  if (body.callbackUrl !== void 0 && (typeof body.callbackUrl !== "string" || !isSafeHttpUrl(body.callbackUrl))) {
    return { ok: false, error: "Invalid callbackUrl." };
  }
  if (body.returnUrl !== void 0 && (typeof body.returnUrl !== "string" || !isSafeHttpUrl(body.returnUrl))) {
    return { ok: false, error: "Invalid returnUrl." };
  }
  if (body.deliveryFeeEtb !== void 0 && (typeof body.deliveryFeeEtb !== "number" || !Number.isFinite(body.deliveryFeeEtb) || body.deliveryFeeEtb < 0 || body.deliveryFeeEtb > 5e4)) {
    return { ok: false, error: "Invalid deliveryFeeEtb." };
  }
  if (body.pointsToRedeem !== void 0 && (typeof body.pointsToRedeem !== "number" || !Number.isFinite(body.pointsToRedeem) || body.pointsToRedeem < 0 || body.pointsToRedeem > 1e6)) {
    return { ok: false, error: "Invalid pointsToRedeem." };
  }
  if (body.availableLoyaltyPoints !== void 0 && (typeof body.availableLoyaltyPoints !== "number" || !Number.isFinite(body.availableLoyaltyPoints) || body.availableLoyaltyPoints < 0 || body.availableLoyaltyPoints > 1e7)) {
    return { ok: false, error: "Invalid availableLoyaltyPoints." };
  }
  return { ok: true };
}
function validatePaymentVerifyBody(rawBody) {
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const body = rawBody;
  if (typeof body.paymentMethod !== "string" || !VALID_PAYMENT_METHODS.includes(body.paymentMethod)) {
    return { ok: false, error: "Valid paymentMethod is required." };
  }
  if (body.txRef !== void 0 && typeof body.txRef !== "string") {
    return { ok: false, error: "txRef must be a string." };
  }
  if (body.paymentReference !== void 0 && typeof body.paymentReference !== "string") {
    return { ok: false, error: "paymentReference must be a string." };
  }
  const refToCheck = (body.txRef || body.paymentReference || "").trim();
  if (refToCheck.length > MAX_PAYMENT_VERIFY_REF_LENGTH) {
    return {
      ok: false,
      error: `Transaction reference cannot exceed ${MAX_PAYMENT_VERIFY_REF_LENGTH} characters.`
    };
  }
  if (refToCheck && !/^[a-zA-Z0-9._\-:]+$/.test(refToCheck)) {
    return { ok: false, error: "Transaction reference contains invalid characters." };
  }
  if (body.expectedAmountEtb !== void 0 && (typeof body.expectedAmountEtb !== "number" || !Number.isFinite(body.expectedAmountEtb) || body.expectedAmountEtb <= 0 || body.expectedAmountEtb > 1e7)) {
    return { ok: false, error: "expectedAmountEtb must be a positive number." };
  }
  return { ok: true };
}

// src/server/payments.ts
var TELEBIRR_REQUIRED_ENV = [
  "TELEBIRR_BASE_URL",
  "TELEBIRR_APP_ID",
  "TELEBIRR_APP_SECRET",
  "TELEBIRR_MERCHANT_CODE",
  "TELEBIRR_PRIVATE_KEY"
];
var CBE_REQUIRED_ENV = [
  "CBE_BASE_URL",
  "CBE_MERCHANT_ID",
  "CBE_API_KEY"
];
var CHAPA_REQUIRED_ENV = ["CHAPA_SECRET_KEY"];
function inspectMissingEnv(keys) {
  return keys.filter((key) => {
    const val = process.env[key];
    return typeof val !== "string" || val.trim().length === 0;
  });
}
function getPaymentProvidersStatus() {
  const telebirrMissing = inspectMissingEnv(TELEBIRR_REQUIRED_ENV);
  const cbeMissing = inspectMissingEnv(CBE_REQUIRED_ENV);
  const chapaMissing = inspectMissingEnv(CHAPA_REQUIRED_ENV);
  return {
    telebirr: {
      provider: "telebirr",
      configured: telebirrMissing.length === 0,
      missingEnvVars: telebirrMissing
    },
    cbe_birr: {
      provider: "cbe_birr",
      configured: cbeMissing.length === 0,
      missingEnvVars: cbeMissing
    },
    chapa: {
      provider: "chapa",
      configured: chapaMissing.length === 0,
      missingEnvVars: chapaMissing
    }
  };
}
var IDEMPOTENCY_TTL_MS = 30 * 60 * 1e3;
var initiationCache = /* @__PURE__ */ new Map();
var processedWebhookEvents = /* @__PURE__ */ new Set();
function pruneExpiredCache(nowMs) {
  for (const [k, entry] of initiationCache.entries()) {
    if (entry.expiresAt <= nowMs) {
      initiationCache.delete(k);
    }
  }
  if (processedWebhookEvents.size > 2e3) {
    processedWebhookEvents.clear();
  }
}
async function requireVerifiedAuthUid(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized: Missing Firebase ID token."
    };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { ok: false, status: 401, error: "Unauthorized: Empty Bearer token." };
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { ok: true, uid: decoded.uid };
  } catch (error) {
    console.warn("Payment route Bearer token rejected:", error);
    return {
      ok: false,
      status: 401,
      error: "Unauthorized: Invalid or expired Firebase ID token."
    };
  }
}
function generateCryptoDeliveryPin() {
  return String(crypto2.randomInt(1e3, 1e4));
}
function resolveProviderId(method) {
  if (method === "telebirr" || method === "telebirr_sandbox") return "telebirr";
  if (method === "cbe_birr" || method === "cbe_birr_sandbox") return "cbe_birr";
  if (method === "chapa") return "chapa";
  return null;
}
async function handleInitiatePayment(req, res) {
  const authResult = await requireVerifiedAuthUid(req);
  if (authResult.ok === false) {
    return res.status(authResult.status).json({ error: authResult.error });
  }
  const inputCheck = validatePaymentInitiateBody(req.body);
  if (inputCheck.ok === false) {
    return res.status(400).json({ error: inputCheck.error });
  }
  const nowMs = Date.now();
  pruneExpiredCache(nowMs);
  const headerIdempotency = req.header("idempotency-key")?.trim();
  const body = req.body ?? {};
  const rawKey = (headerIdempotency || body.idempotencyKey || "").trim();
  const cacheKey = rawKey ? `${authResult.uid}:${rawKey}` : "";
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
    fulfillmentMethod = "delivery",
    deliveryFeeEtb = 80,
    promoCode,
    pointsToRedeem = 0,
    availableLoyaltyPoints = 0,
    paymentMethod = "cash_on_delivery",
    paymentReference,
    governanceConfig = DEFAULT_GOVERNANCE_CONFIG,
    userProfile = null,
    customerEmail,
    customerName,
    customerPhone,
    callbackUrl,
    returnUrl
  } = body;
  if (!shopId || !shop || !Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ error: "Shop details and non-empty cartItems are required." });
  }
  if (fulfillmentMethod !== "delivery" && fulfillmentMethod !== "pickup") {
    return res.status(400).json({ error: "Invalid fulfillmentMethod." });
  }
  const shopsMap = { [shop.shopId]: shop };
  const productPool = Array.isArray(catalogProducts) && catalogProducts.length > 0 ? catalogProducts : cartItems.map((ci) => ci.product);
  const reconciled = reconcileCartWithCatalog(
    cartItems,
    productPool,
    shopsMap,
    governanceConfig.strictShopVerification
  );
  if (reconciled.hasBlockingIssues) {
    return res.status(400).json({
      error: "One or more items in your cart are unavailable or exceed available stock."
    });
  }
  const refValidation = validatePaymentReference(paymentMethod, paymentReference);
  if (!refValidation.valid) {
    return res.status(400).json({
      error: "Invalid or missing payment reference for selected electronic payment method.",
      errorKey: refValidation.errorKey
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
    return res.status(400).json({ error: "Calculated order total is invalid." });
  }
  const govCheck = validateOrderAgainstGovernance({
    config: governanceConfig,
    userProfile,
    shop,
    totalAmount: summary.totalAmount
  });
  if (!govCheck.allowed) {
    return res.status(400).json({
      error: govCheck.customMessage || "Order does not satisfy marketplace governance rules.",
      errorKey: govCheck.errorKey
    });
  }
  const orderId = `ord-${nowMs}-${crypto2.randomBytes(2).toString("hex")}`;
  const txRef = `AC-${nowMs}-${crypto2.randomBytes(3).toString("hex").toUpperCase()}`;
  const deliveryPin = generateCryptoDeliveryPin();
  const providers = getPaymentProvidersStatus();
  const providerId = resolveProviderId(paymentMethod);
  if (!providerId || !isElectronicPaymentMethod(paymentMethod)) {
    const responsePayload2 = {
      ok: true,
      orderId,
      txRef,
      paymentMethod,
      paymentStatus: "pending",
      verifiedPaid: false,
      configured: true,
      deliveryPin,
      summary
    };
    if (cacheKey) {
      initiationCache.set(cacheKey, {
        expiresAt: nowMs + IDEMPOTENCY_TTL_MS,
        payload: responsePayload2
      });
    }
    return res.json(responsePayload2);
  }
  const providerStatus = providers[providerId];
  if (providerId === "chapa" && providerStatus.configured) {
    try {
      const chapaSecret = process.env.CHAPA_SECRET_KEY;
      const originHeader = req.get("origin") || "http://localhost:3000";
      const initRes = await fetch("https://api.chapa.co/v1/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${chapaSecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: String(Math.round(summary.totalAmount)),
          currency: "ETB",
          email: customerEmail || "customer@hawasagebeya.local",
          first_name: (customerName || "Hawassa Customer").slice(0, 50),
          phone_number: customerPhone || void 0,
          tx_ref: txRef,
          callback_url: callbackUrl || `${originHeader}/api/payments/webhook/chapa`,
          return_url: returnUrl || `${originHeader}`,
          customization: {
            title: "Affin Connect Checkout",
            description: `Order from ${shop.name}`.slice(0, 90)
          }
        })
      });
      const initJson = await initRes.json().catch(() => ({}));
      const checkoutUrl = initRes.ok && initJson?.data?.checkout_url ? initJson.data.checkout_url : void 0;
      const responsePayload2 = {
        ok: true,
        orderId,
        txRef,
        paymentMethod,
        paymentStatus: "pending",
        verifiedPaid: false,
        configured: true,
        missingEnvVars: [],
        checkoutUrl,
        gatewayMessage: checkoutUrl ? "Chapa checkout session initialized. Awaiting verified payment completion." : initJson?.message || "Chapa gateway returned an incomplete checkout URL; order remains pending verification.",
        deliveryPin,
        summary
      };
      if (cacheKey) {
        initiationCache.set(cacheKey, {
          expiresAt: nowMs + IDEMPOTENCY_TTL_MS,
          payload: responsePayload2
        });
      }
      return res.json(responsePayload2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Chapa gateway connection failed";
      return res.json({
        ok: true,
        orderId,
        txRef,
        paymentMethod,
        paymentStatus: "pending",
        verifiedPaid: false,
        configured: true,
        missingEnvVars: [],
        gatewayMessage: `Gateway request failed (${msg}). Order stays pending payment verification.`,
        deliveryPin,
        summary
      });
    }
  }
  const responsePayload = {
    ok: true,
    orderId,
    txRef,
    paymentMethod,
    paymentStatus: "pending",
    verifiedPaid: false,
    configured: providerStatus.configured,
    missingEnvVars: providerStatus.missingEnvVars,
    gatewayMessage: providerStatus.configured ? `${providerId.toUpperCase()} payment initiated and awaiting gateway settlement confirmation.` : `${providerId.toUpperCase()} live merchant API credentials (${providerStatus.missingEnvVars.join(", ")}) are not configured on this server. Order recorded as Payment Pending.`,
    deliveryPin,
    summary
  };
  if (cacheKey) {
    initiationCache.set(cacheKey, {
      expiresAt: nowMs + IDEMPOTENCY_TTL_MS,
      payload: responsePayload
    });
  }
  return res.json(responsePayload);
}
async function handleVerifyPayment(req, res) {
  const authResult = await requireVerifiedAuthUid(req);
  if (authResult.ok === false) {
    return res.status(authResult.status).json({ error: authResult.error });
  }
  const inputCheck = validatePaymentVerifyBody(req.body);
  if (inputCheck.ok === false) {
    return res.status(400).json({ error: inputCheck.error });
  }
  const { paymentMethod, txRef, paymentReference, expectedAmountEtb } = req.body ?? {};
  if (!paymentMethod) {
    return res.status(400).json({ error: "paymentMethod is required." });
  }
  const providerId = resolveProviderId(paymentMethod);
  if (!providerId) {
    return res.json({
      verifiedPaid: false,
      paymentStatus: "pending",
      configured: true,
      message: "Offline payment methods settle upon delivery/pickup verification."
    });
  }
  const providers = getPaymentProvidersStatus();
  const status = providers[providerId];
  const refToCheck = (txRef || paymentReference || "").trim();
  if (!status.configured) {
    return res.json({
      verifiedPaid: false,
      paymentStatus: "pending",
      configured: false,
      missingEnvVars: status.missingEnvVars,
      message: `${providerId.toUpperCase()} verification unavailable: missing ${status.missingEnvVars.join(", ")}.`
    });
  }
  if (!refToCheck) {
    return res.status(400).json({ error: "A transaction reference is required to verify payment." });
  }
  if (providerId === "chapa") {
    try {
      const verifyRes = await fetch(
        `https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(refToCheck)}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`
          }
        }
      );
      const verifyJson = await verifyRes.json().catch(() => ({}));
      const settledAmount = Number(verifyJson?.data?.amount ?? 0);
      const amountMatches = expectedAmountEtb == null || !Number.isFinite(expectedAmountEtb) || Math.abs(settledAmount - expectedAmountEtb) < 0.01;
      const verifiedPaid = verifyRes.ok && verifyJson?.status === "success" && verifyJson?.data?.status === "success" && verifyJson?.data?.currency === "ETB" && amountMatches;
      return res.json({
        verifiedPaid,
        paymentStatus: verifiedPaid ? "paid" : "pending",
        configured: true,
        missingEnvVars: [],
        message: verifiedPaid ? "Chapa payment verified and settled." : verifyJson?.message || "Transaction not yet settled on Chapa."
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error verifying Chapa transaction";
      return res.json({
        verifiedPaid: false,
        paymentStatus: "pending",
        configured: true,
        missingEnvVars: [],
        message: msg
      });
    }
  }
  return res.json({
    verifiedPaid: false,
    paymentStatus: "pending",
    configured: status.configured,
    missingEnvVars: status.missingEnvVars,
    message: "Live server-to-server transaction verification awaits merchant gateway settlement callback."
  });
}
function timingSafeHexCompare(provided, expected) {
  const a = Buffer.from(provided.trim().toLowerCase(), "utf8");
  const b = Buffer.from(expected.trim().toLowerCase(), "utf8");
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto2.timingSafeEqual(a, b);
}
function handleChapaWebhook(req, res) {
  const secret = process.env.CHAPA_WEBHOOK_SECRET?.trim() || process.env.CHAPA_SECRET_KEY?.trim();
  if (!secret) {
    return res.status(503).json({
      error: "Chapa webhook secret is not configured on this server."
    });
  }
  const signature = req.header("chapa-signature") || req.header("x-chapa-signature") || "";
  const payloadStr = JSON.stringify(req.body ?? {});
  const expectedSig = crypto2.createHmac("sha256", secret).update(payloadStr).digest("hex");
  if (!timingSafeHexCompare(signature, expectedSig)) {
    return res.status(401).json({ error: "Invalid webhook signature." });
  }
  const eventId = String(req.body?.tx_ref || req.body?.reference || "");
  if (eventId && processedWebhookEvents.has(`chapa:${eventId}`)) {
    return res.json({ received: true, duplicate: true });
  }
  if (eventId) processedWebhookEvents.add(`chapa:${eventId}`);
  return res.json({ received: true, status: req.body?.status ?? "pending" });
}
function handleProviderWebhook(provider) {
  return (req, res) => {
    const secret = provider === "telebirr" ? process.env.TELEBIRR_APP_SECRET?.trim() : process.env.CBE_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return res.status(503).json({
        error: `${provider.toUpperCase()} webhook secret is not configured on this server.`
      });
    }
    const signature = req.header("x-signature") || req.header("x-webhook-signature") || "";
    const payloadStr = JSON.stringify(req.body ?? {});
    const expectedSig = crypto2.createHmac("sha256", secret).update(payloadStr).digest("hex");
    if (!timingSafeHexCompare(signature, expectedSig)) {
      return res.status(401).json({ error: "Invalid webhook signature." });
    }
    const eventId = String(req.body?.merch_order_id || req.body?.transactionId || req.body?.txRef || "");
    if (eventId && processedWebhookEvents.has(`${provider}:${eventId}`)) {
      return res.json({ received: true, duplicate: true });
    }
    if (eventId) processedWebhookEvents.add(`${provider}:${eventId}`);
    return res.json({ received: true });
  };
}

// src/server/rateLimit.ts
function extractClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    const firstHop = forwarded.split(",")[0]?.trim();
    if (firstHop) return firstHop;
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    const firstHop = forwarded[0]?.split(",")[0]?.trim();
    if (firstHop) return firstHop;
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}
function createRateLimiter(options) {
  const windowMs = Math.max(1e3, Math.floor(options.windowMs));
  const maxRequests = Math.max(1, Math.floor(options.maxRequests));
  const keyPrefix = options.keyPrefix ? `${options.keyPrefix}:` : "";
  const buckets = /* @__PURE__ */ new Map();
  function pruneStaleBuckets(nowMs) {
    if (buckets.size < 500) return;
    const cutoff = nowMs - windowMs;
    for (const [k, timestamps] of buckets.entries()) {
      const fresh = timestamps.filter((ts) => ts > cutoff);
      if (fresh.length === 0) {
        buckets.delete(k);
      } else {
        buckets.set(k, fresh);
      }
    }
  }
  function check(rawKey, nowMs = Date.now()) {
    pruneStaleBuckets(nowMs);
    const key = `${keyPrefix}${rawKey || "unknown"}`;
    const cutoff = nowMs - windowMs;
    const existing = buckets.get(key) ?? [];
    const active = existing.filter((ts) => ts > cutoff);
    if (active.length >= maxRequests) {
      buckets.set(key, active);
      const oldestActive = active[0] ?? nowMs;
      const retryMs = Math.max(1e3, oldestActive + windowMs - nowMs);
      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        retryAfterSeconds: Math.ceil(retryMs / 1e3)
      };
    }
    active.push(nowMs);
    buckets.set(key, active);
    return {
      allowed: true,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - active.length),
      retryAfterSeconds: 0
    };
  }
  function middleware(req, res, next) {
    const ip = extractClientIp(req);
    const result = check(ip);
    res.setHeader("X-RateLimit-Limit", String(result.limit));
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfterSeconds));
      return res.status(429).json({
        error: "Too many requests. Please slow down and try again shortly.",
        retryAfterSeconds: result.retryAfterSeconds
      });
    }
    return next();
  }
  function reset() {
    buckets.clear();
  }
  return { check, middleware, reset };
}

// src/server/sellerAuth.ts
var firebaseConfig = loadFirebaseAppletConfig();
var FIRESTORE_PROJECT_ID = firebaseConfig.projectId;
var FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId || "(default)";
var SUPER_ADMIN_EMAIL = "yoftaheyoseph5@gmail.com";
function evaluateSellerVerification(params) {
  const uid = (params.uid ?? "").trim();
  if (!uid) {
    return {
      authorized: false,
      uid: "",
      isAdmin: false,
      isSeller: false,
      verificationStatus: "none",
      code: "UNAUTHENTICATED",
      reason: "Sign in with a verified seller account to post products.",
      verifiedShops: [],
      ownedShopsCount: 0
    };
  }
  if (params.userProfile?.accountStatus === "suspended") {
    return {
      authorized: false,
      uid,
      isAdmin: false,
      isSeller: params.userProfile?.role === "seller",
      verificationStatus: "rejected",
      code: "ACCOUNT_SUSPENDED",
      reason: "Your account is currently suspended and cannot publish listings.",
      verifiedShops: [],
      ownedShopsCount: 0
    };
  }
  const isAdmin = params.userProfile?.role === "admin" || Boolean(params.emailVerified) && typeof params.email === "string" && params.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
  const ownedShops = params.shops.filter((s) => s.ownerUid === uid);
  const candidateShops = isAdmin ? params.shops : ownedShops;
  const verifiedShopEntries = [];
  for (const shop of candidateShops) {
    const verification = params.verificationsByShopId[shop.shopId] ?? null;
    const effectiveStatus = getEffectiveShopVerificationStatus(shop, verification);
    const allowed = isAdmin ? shop.status !== "suspended" : canShopListProducts(shop, verification);
    if (allowed) {
      verifiedShopEntries.push({
        shopId: shop.shopId,
        name: shop.name,
        neighborhood: shop.neighborhood,
        traderType: shop.traderType,
        deliveryAvailable: Boolean(shop.deliveryAvailable),
        pickupAvailable: Boolean(shop.pickupAvailable),
        verificationStatus: effectiveStatus
      });
    }
  }
  const isSeller = isAdmin || params.userProfile?.role === "seller" || ownedShops.length > 0;
  if (params.requestedShopId) {
    const requested = params.requestedShopId.trim();
    const matched = verifiedShopEntries.find((s) => s.shopId === requested);
    if (!matched) {
      const ownedMatch = ownedShops.find((s) => s.shopId === requested);
      const status = ownedMatch ? getEffectiveShopVerificationStatus(
        ownedMatch,
        params.verificationsByShopId[ownedMatch.shopId] ?? null
      ) : "none";
      return {
        authorized: false,
        uid,
        isAdmin,
        isSeller,
        verificationStatus: status,
        code: ownedMatch ? "SELLER_NOT_VERIFIED" : "SHOP_NOT_VERIFIED_OR_NOT_OWNED",
        reason: ownedMatch ? "This shop is not yet verified to publish listings. Complete merchant verification in Seller Portal first." : "You can only publish products to a verified shop owned by your account.",
        verifiedShops: verifiedShopEntries,
        ownedShopsCount: ownedShops.length
      };
    }
    return {
      authorized: true,
      uid,
      isAdmin,
      isSeller: true,
      verificationStatus: "approved",
      verifiedShops: verifiedShopEntries,
      activeShop: matched,
      ownedShopsCount: ownedShops.length
    };
  }
  if (verifiedShopEntries.length > 0) {
    return {
      authorized: true,
      uid,
      isAdmin,
      isSeller: true,
      verificationStatus: "approved",
      verifiedShops: verifiedShopEntries,
      activeShop: verifiedShopEntries[0],
      ownedShopsCount: ownedShops.length
    };
  }
  if (ownedShops.length === 0) {
    if (isSeller) {
      return {
        authorized: false,
        uid,
        isAdmin,
        isSeller: true,
        verificationStatus: "unverified",
        code: "NO_SHOP_CREATED",
        reason: "Create and verify your Hawassa virtual shop in Seller Portal before listing products through the assistant.",
        verifiedShops: [],
        ownedShopsCount: 0
      };
    }
    return {
      authorized: false,
      uid,
      isAdmin,
      isSeller: false,
      verificationStatus: "none",
      code: "CUSTOMER_NOT_SELLER",
      reason: "Product listing is exclusively available to verified Affin Connect sellers. You can continue using the assistant for shopping, prices, and delivery help.",
      verifiedShops: [],
      ownedShopsCount: 0
    };
  }
  const statuses = ownedShops.map(
    (s) => getEffectiveShopVerificationStatus(s, params.verificationsByShopId[s.shopId] ?? null)
  );
  const highestStatus = statuses.includes("pending_review") ? "pending_review" : statuses.includes("rejected") ? "rejected" : "unverified";
  const statusMessage = highestStatus === "pending_review" ? "Your merchant verification is currently under review. Once approved, you can publish products directly through the assistant." : highestStatus === "rejected" ? "Your previous merchant verification was not approved. Please resubmit your business license in Seller Portal to unlock product posting." : "Only verified sellers can create and publish product listings. Please submit your trade license in Seller Portal to get verified.";
  return {
    authorized: false,
    uid,
    isAdmin,
    isSeller: true,
    verificationStatus: highestStatus,
    code: "SELLER_NOT_VERIFIED",
    reason: statusMessage,
    verifiedShops: [],
    ownedShopsCount: ownedShops.length
  };
}
function decodeFirestoreValue(value) {
  if (!value) return void 0;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) {
    return (value.arrayValue.values ?? []).map((item) => decodeFirestoreValue(item));
  }
  if ("mapValue" in value) {
    const obj = {};
    for (const [k, v] of Object.entries(value.mapValue.fields ?? {})) {
      obj[k] = decodeFirestoreValue(v);
    }
    return obj;
  }
  return void 0;
}
function decodeFirestoreDoc(doc, idField) {
  if (!doc.fields) return null;
  const raw = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    raw[k] = decodeFirestoreValue(v);
  }
  if (typeof raw[idField] !== "string" && typeof doc.name === "string") {
    raw[idField] = doc.name.split("/").pop() ?? "";
  }
  return raw;
}
function firestoreDocumentsRoot() {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIRESTORE_PROJECT_ID
  )}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents`;
}
async function firestoreGetDoc(collectionPath, docId, idField, idToken) {
  const url = `${firestoreDocumentsRoot()}/${collectionPath}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: "application/json"
    }
  });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) {
    throw new Error(`Firestore read ${collectionPath}/${docId} failed (${res.status})`);
  }
  const json = await res.json();
  return decodeFirestoreDoc(json, idField);
}
async function firestoreListShops(idToken) {
  const shops = [];
  let pageToken;
  let pages = 0;
  do {
    const query = new URLSearchParams({ pageSize: "200" });
    if (pageToken) query.set("pageToken", pageToken);
    const url = `${firestoreDocumentsRoot()}/shops?${query.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: "application/json"
      }
    });
    if (!res.ok) {
      throw new Error(`Firestore shops query failed (${res.status})`);
    }
    const json = await res.json();
    for (const doc of json.documents ?? []) {
      const parsed = decodeFirestoreDoc(doc, "shopId");
      if (parsed?.shopId) shops.push(parsed);
    }
    pageToken = json.nextPageToken;
    pages += 1;
  } while (pageToken && pages < 10);
  return shops;
}
async function verifySellerFromFirestore(params) {
  const [userProfile, shops] = await Promise.all([
    firestoreGetDoc("users", params.uid, "uid", params.idToken),
    firestoreListShops(params.idToken)
  ]);
  const ownedShops = shops.filter((s) => s.ownerUid === params.uid);
  const verificationsByShopId = {};
  await Promise.all(
    ownedShops.map(async (shop) => {
      const verification = await firestoreGetDoc(
        "merchant_verifications",
        shop.shopId,
        "verificationId",
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
    requestedShopId: params.requestedShopId
  });
}

// src/server/products.ts
var firebaseConfig2 = loadFirebaseAppletConfig();
var FIRESTORE_PROJECT_ID2 = firebaseConfig2.projectId;
var FIRESTORE_DATABASE_ID2 = firebaseConfig2.firestoreDatabaseId || "(default)";
var VALID_ID_REGEX = /^[a-zA-Z0-9_-]{2,128}$/;
var VALID_ROAST_LEVELS = /* @__PURE__ */ new Set(["light", "medium", "medium_dark", "dark"]);
var VALID_PROCESS_METHODS = /* @__PURE__ */ new Set(["washed", "natural", "honey", "anaerobic"]);
var VALID_BEAN_FORMS = /* @__PURE__ */ new Set(["whole_bean", "ground"]);
var VALID_PRODUCT_STATUSES = /* @__PURE__ */ new Set(["active", "archived", "pending_review"]);
var DATA_IMAGE_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;
function isValidImageUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("data:image/")) {
    return trimmed.length >= 32 && trimmed.length <= 205e3 && DATA_IMAGE_REGEX.test(trimmed);
  }
  return trimmed.length >= 1 && trimmed.length <= 2048 && (trimmed.startsWith("https://") || trimmed.startsWith("/"));
}
function sanitizeCoffeeDetails(raw, inferred) {
  const merged = {
    ...inferred ?? {},
    ...raw ?? {}
  };
  const clean = {};
  if (typeof merged.origin === "string" && merged.origin.trim()) {
    clean.origin = merged.origin.trim().slice(0, 80);
  }
  if (typeof merged.brand === "string" && merged.brand.trim()) {
    clean.brand = merged.brand.trim().slice(0, 80);
  }
  if (typeof merged.roastLevel === "string" && VALID_ROAST_LEVELS.has(merged.roastLevel)) {
    clean.roastLevel = merged.roastLevel;
  }
  if (typeof merged.processingMethod === "string" && VALID_PROCESS_METHODS.has(merged.processingMethod)) {
    clean.processingMethod = merged.processingMethod;
  }
  if (typeof merged.beanForm === "string" && VALID_BEAN_FORMS.has(merged.beanForm)) {
    clean.beanForm = merged.beanForm;
  }
  if (typeof merged.packageWeight === "string" && merged.packageWeight.trim()) {
    clean.packageWeight = merged.packageWeight.trim().slice(0, 32);
  }
  if (typeof merged.roastDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(merged.roastDate.trim())) {
    clean.roastDate = merged.roastDate.trim();
  }
  return Object.keys(clean).length > 0 ? clean : void 0;
}
function validateAndPrepareProductWrite(body, options) {
  const nowIso = options.nowIso ?? (/* @__PURE__ */ new Date()).toISOString();
  const existing = options.existingProduct ?? null;
  const productId = (options.productIdOverride ?? body.productId ?? existing?.productId ?? `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`).trim();
  if (!VALID_ID_REGEX.test(productId)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_PAYLOAD",
      error: "Invalid productId format."
    };
  }
  const shopId = (options.mode === "update" && existing ? existing.shopId : body.shopId ?? "").trim();
  if (!VALID_ID_REGEX.test(shopId)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_PAYLOAD",
      error: "A valid shopId is required."
    };
  }
  const shopName = (body.shopName ?? existing?.shopName ?? "").trim().slice(0, 120);
  if (!shopName) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_PAYLOAD",
      error: "shopName is required."
    };
  }
  const name = (body.name ?? existing?.name ?? "").trim();
  if (name.length < 3 || name.length > 140) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_PAYLOAD",
      error: "Product name must be between 3 and 140 characters."
    };
  }
  const description = (body.description ?? existing?.description ?? "").trim();
  if (description.length < 5 || description.length > 2e3) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_PAYLOAD",
      error: "Product description must be between 5 and 2000 characters."
    };
  }
  const rawProductType = body.productType !== void 0 ? body.productType : options.mode === "update" ? existing?.productType : void 0;
  const productType = typeof rawProductType === "string" && rawProductType.trim().length > 0 ? rawProductType.trim().slice(0, 60) : void 0;
  const price = Number(body.price ?? existing?.price);
  if (!Number.isFinite(price) || price <= 0 || price > 1e7) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_PAYLOAD",
      error: "Product price must be a positive number in ETB."
    };
  }
  const stock = Number(body.stock ?? existing?.stock);
  if (!Number.isFinite(stock) || stock < 0 || stock > 1e6) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_PAYLOAD",
      error: "Stock quantity must be 0 or greater."
    };
  }
  const imageUrl = (body.imageUrl ?? existing?.imageUrl ?? "").trim();
  if (!isValidImageUrl(imageUrl)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_PAYLOAD",
      error: "Product imageUrl must be a valid https:// URL, local asset path, or compressed image under 150 KB."
    };
  }
  const pickupAvailable = Boolean(body.pickupAvailable ?? existing?.pickupAvailable ?? true);
  const deliveryAvailable = Boolean(body.deliveryAvailable ?? existing?.deliveryAvailable ?? true);
  if (!pickupAvailable && !deliveryAvailable) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_PAYLOAD",
      error: "Enable at least one fulfillment method (delivery or pickup)."
    };
  }
  const requestedCategoryRaw = body.category ?? existing?.category ?? "";
  const categorization = classifyProductCoffeeCategory({
    name,
    category: requestedCategoryRaw,
    productType,
    coffeeDetails: body.coffeeDetails,
    categoryConfirmed: Boolean(body.categoryConfirmed),
    confirmedCategory: body.confirmedCategory
  });
  if (categorization.outcome === "conflict") {
    return {
      ok: false,
      status: 400,
      code: "CATEGORY_CONFLICT",
      error: categorization.reason,
      categorization
    };
  }
  if (categorization.outcome === "ambiguous" && categorization.requiresConfirmation) {
    return {
      ok: false,
      status: 409,
      code: "CATEGORY_CONFIRMATION_REQUIRED",
      error: categorization.reason,
      categorization
    };
  }
  const resolvedCategory = normalizeProductCategory(categorization.resolvedCategory);
  if (!resolvedCategory || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(resolvedCategory)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_PAYLOAD",
      error: "A valid product category is required."
    };
  }
  const roundedPrice = Math.round(price);
  const rawPreviousPrice = body.previousPrice !== void 0 ? Number(body.previousPrice) : existing?.previousPrice;
  const previousPrice = rawPreviousPrice !== void 0 && Number.isFinite(rawPreviousPrice) && rawPreviousPrice > roundedPrice ? Math.round(rawPreviousPrice) : void 0;
  const flooredStock = Math.floor(stock);
  const isAvailable = body.isAvailable !== void 0 ? Boolean(body.isAvailable) && flooredStock > 0 : flooredStock > 0;
  const rawStatus = body.status ?? existing?.status ?? "active";
  const status = VALID_PRODUCT_STATUSES.has(rawStatus) ? rawStatus : "active";
  const sanitizedCoffeeDetails = resolvedCategory === CANONICAL_COFFEE_CATEGORY ? sanitizeCoffeeDetails(
    body.coffeeDetails ?? (existing?.category === CANONICAL_COFFEE_CATEGORY ? existing.coffeeDetails : void 0),
    categorization.inferredCoffeeDetails
  ) : void 0;
  const additionalImages = Array.isArray(body.additionalImages) ? body.additionalImages.filter((img) => typeof img === "string" && isValidImageUrl(img)).slice(0, 6) : existing?.additionalImages;
  const variants = Array.isArray(body.variants) ? body.variants.filter(
    (v) => Boolean(v) && typeof v.id === "string" && typeof v.label === "string" && Number.isFinite(v.price) && v.price > 0
  ).slice(0, 12) : existing?.variants;
  const rating = existing?.rating ?? (typeof body.rating === "number" ? body.rating : void 0);
  const reviewCount = existing?.reviewCount ?? (typeof body.reviewCount === "number" ? body.reviewCount : void 0);
  const product = {
    productId,
    shopId,
    shopName,
    name,
    description,
    category: resolvedCategory,
    ...productType ? { productType } : {},
    price: roundedPrice,
    ...previousPrice !== void 0 ? { previousPrice } : {},
    stock: flooredStock,
    isAvailable,
    imageUrl,
    ...additionalImages && additionalImages.length > 0 ? { additionalImages } : {},
    ...variants && variants.length > 0 ? { variants } : {},
    ...sanitizedCoffeeDetails ? { coffeeDetails: sanitizedCoffeeDetails } : {},
    pickupAvailable,
    deliveryAvailable,
    status,
    ...existing?.moderationReason ? { moderationReason: existing.moderationReason } : {},
    ...rating !== void 0 ? { rating } : {},
    ...reviewCount !== void 0 ? { reviewCount } : {},
    createdAt: existing?.createdAt ?? body.createdAt ?? nowIso,
    updatedAt: nowIso
  };
  return {
    ok: true,
    product,
    categorization
  };
}
function encodeFirestoreValue(value) {
  if (value === void 0) return void 0;
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return void 0;
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    const encoded = value.map((item) => encodeFirestoreValue(item)).filter((item) => item !== void 0);
    return { arrayValue: { values: encoded } };
  }
  if (typeof value === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      const encoded = encodeFirestoreValue(v);
      if (encoded !== void 0) {
        fields[k] = encoded;
      }
    }
    return { mapValue: { fields } };
  }
  return void 0;
}
function decodeFirestoreValue2(value) {
  if (!value) return void 0;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) {
    return (value.arrayValue.values ?? []).map((item) => decodeFirestoreValue2(item));
  }
  if ("mapValue" in value) {
    const obj = {};
    for (const [k, v] of Object.entries(value.mapValue.fields ?? {})) {
      obj[k] = decodeFirestoreValue2(v);
    }
    return obj;
  }
  return void 0;
}
function productToFirestoreFields(product) {
  const fields = {};
  for (const [k, v] of Object.entries(product)) {
    const encoded = encodeFirestoreValue(v);
    if (encoded !== void 0) {
      fields[k] = encoded;
    }
  }
  return fields;
}
function firestoreDocToProduct(doc) {
  if (!doc.fields) return null;
  const raw = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    raw[k] = decodeFirestoreValue2(v);
  }
  if (typeof raw.productId !== "string" && typeof doc.name === "string") {
    raw.productId = doc.name.split("/").pop() ?? "";
  }
  if (typeof raw.productId !== "string" || !raw.productId) return null;
  return raw;
}
function firestoreProductsBaseUrl() {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIRESTORE_PROJECT_ID2
  )}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID2)}/documents/products`;
}
function extractBearerToken(req) {
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}
async function firestoreRestGetProduct(productId, idToken) {
  const url = `${firestoreProductsBaseUrl()}/${encodeURIComponent(productId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: "application/json"
    }
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text2 = await res.text().catch(() => "");
    throw new Error(`Firestore read failed (${res.status}): ${text2.slice(0, 200)}`);
  }
  const json = await res.json();
  return firestoreDocToProduct(json);
}
async function firestoreRestUpsertProduct(product, idToken) {
  const url = `${firestoreProductsBaseUrl()}/${encodeURIComponent(product.productId)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      fields: productToFirestoreFields(product)
    })
  });
  if (!res.ok) {
    let message = `Firestore write rejected (${res.status}).`;
    try {
      const errJson = await res.json();
      if (errJson.error?.status === "PERMISSION_DENIED") {
        message = "Permission denied: ensure your virtual shop is approved/verified and owned by your account.";
      } else if (errJson.error?.message) {
        message = errJson.error.message;
      }
    } catch {
    }
    const err = new Error(message);
    err.statusCode = res.status === 403 ? 403 : 502;
    throw err;
  }
}
async function firestoreRestListAllProducts(idToken) {
  const products = [];
  let pageToken;
  let pages = 0;
  do {
    const query = new URLSearchParams({ pageSize: "200" });
    if (pageToken) query.set("pageToken", pageToken);
    const url = `${firestoreProductsBaseUrl()}?${query.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: "application/json"
      }
    });
    if (!res.ok) {
      const text2 = await res.text().catch(() => "");
      throw new Error(`Firestore list failed (${res.status}): ${text2.slice(0, 200)}`);
    }
    const json = await res.json();
    for (const doc of json.documents ?? []) {
      const parsed = firestoreDocToProduct(doc);
      if (parsed) products.push(parsed);
    }
    pageToken = json.nextPageToken;
    pages += 1;
  } while (pageToken && pages < 15);
  return products;
}
function handleCategorizeProductPreview(req, res) {
  const body = req.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const productType = typeof body.productType === "string" ? body.productType.trim() : "";
  if (!name && !category && !productType) {
    return res.status(400).json({
      error: "Provide at least name, category, or productType to classify."
    });
  }
  const categorization = classifyProductCoffeeCategory({
    name,
    category,
    productType,
    coffeeDetails: body.coffeeDetails,
    categoryConfirmed: Boolean(body.categoryConfirmed),
    confirmedCategory: body.confirmedCategory
  });
  return res.json({ categorization });
}
async function handleCreateProduct(req, res) {
  const idToken = extractBearerToken(req);
  const body = req.body ?? {};
  const sellerCheck = await verifySellerFromFirestore({
    uid: req.user.uid,
    email: req.user.email,
    emailVerified: req.user.email_verified,
    idToken,
    requestedShopId: typeof body.shopId === "string" ? body.shopId.trim() : void 0
  });
  if (!sellerCheck.authorized || !sellerCheck.activeShop) {
    return res.status(403).json({
      code: sellerCheck.code ?? "SELLER_NOT_VERIFIED",
      error: sellerCheck.reason ?? "Only verified sellers can publish products on Affin Connect.",
      verificationStatus: sellerCheck.verificationStatus
    });
  }
  const validation = validateAndPrepareProductWrite(
    {
      ...body,
      shopId: sellerCheck.activeShop.shopId,
      shopName: sellerCheck.activeShop.name
    },
    {
      mode: "create"
    }
  );
  if (!validation.ok) {
    return res.status(validation.status).json({
      code: validation.code,
      error: validation.error,
      categorization: validation.categorization
    });
  }
  try {
    await firestoreRestUpsertProduct(validation.product, idToken);
    return res.status(201).json({
      product: validation.product,
      categorization: validation.categorization
    });
  } catch (err) {
    const statusCode = typeof err.statusCode === "number" ? err.statusCode : 500;
    return res.status(statusCode).json({
      error: err instanceof Error ? err.message : "Unable to save product."
    });
  }
}
async function handleUpdateProduct(req, res) {
  const idToken = extractBearerToken(req);
  const productId = String(req.params.productId ?? "").trim();
  const body = req.body ?? {};
  if (!VALID_ID_REGEX.test(productId)) {
    return res.status(400).json({
      code: "INVALID_PAYLOAD",
      error: "Invalid productId parameter."
    });
  }
  let existingProduct = null;
  try {
    existingProduct = await firestoreRestGetProduct(productId, idToken);
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Unable to fetch existing product."
    });
  }
  const targetShopId = existingProduct?.shopId ?? (typeof body.shopId === "string" ? body.shopId.trim() : void 0);
  const sellerCheck = await verifySellerFromFirestore({
    uid: req.user.uid,
    email: req.user.email,
    emailVerified: req.user.email_verified,
    idToken,
    requestedShopId: targetShopId
  });
  if (!sellerCheck.authorized || !sellerCheck.activeShop) {
    return res.status(403).json({
      code: sellerCheck.code ?? "SELLER_NOT_VERIFIED",
      error: sellerCheck.reason ?? "Only verified sellers can edit products on Affin Connect.",
      verificationStatus: sellerCheck.verificationStatus
    });
  }
  const validation = validateAndPrepareProductWrite(
    {
      ...body,
      shopId: sellerCheck.activeShop.shopId,
      shopName: sellerCheck.activeShop.name
    },
    {
      mode: existingProduct ? "update" : "create",
      existingProduct,
      productIdOverride: productId
    }
  );
  if (!validation.ok) {
    return res.status(validation.status).json({
      code: validation.code,
      error: validation.error,
      categorization: validation.categorization
    });
  }
  try {
    await firestoreRestUpsertProduct(validation.product, idToken);
    return res.status(200).json({
      product: validation.product,
      categorization: validation.categorization
    });
  } catch (err) {
    const statusCode = typeof err.statusCode === "number" ? err.statusCode : 500;
    return res.status(statusCode).json({
      error: err instanceof Error ? err.message : "Unable to update product."
    });
  }
}
async function handleMigrateCoffeeProducts(req, res) {
  const idToken = extractBearerToken(req);
  const dryRun = Boolean(req.body?.dryRun);
  try {
    const existingProducts = await firestoreRestListAllProducts(idToken);
    const plan = planCoffeeProductMigration(existingProducts);
    let updated = 0;
    const failed = [];
    if (!dryRun) {
      for (const change of plan.changes) {
        try {
          await firestoreRestUpsertProduct(change.updatedProduct, idToken);
          updated += 1;
        } catch (err) {
          failed.push({
            productId: change.productId,
            error: err instanceof Error ? err.message : "Permission denied or write failed."
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
        reason: c.reason
      }))
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Unable to run coffee product migration."
    });
  }
}

// src/server/listingAssistant.ts
var VALID_ROAST_LEVELS2 = /* @__PURE__ */ new Set(["light", "medium", "medium_dark", "dark"]);
var VALID_PROCESS_METHODS2 = /* @__PURE__ */ new Set([
  "washed",
  "natural",
  "honey",
  "anaerobic"
]);
var VALID_BEAN_FORMS2 = /* @__PURE__ */ new Set(["whole_bean", "ground"]);
var DATA_IMAGE_REGEX2 = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;
function isValidDraftImage(url) {
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false, reason: "Image cannot be empty." };
  }
  if (trimmed.startsWith("data:image/")) {
    if (!DATA_IMAGE_REGEX2.test(trimmed)) {
      return {
        valid: false,
        reason: "Unsupported image format. Please upload a JPG, PNG, or WebP photo."
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
        reason: "Uploaded image exceeds the 150 KB safety limit. Please upload a smaller photo."
      };
    }
    return { valid: true };
  }
  if ((trimmed.startsWith("https://") || trimmed.startsWith("/")) && trimmed.length <= 2048) {
    return { valid: true };
  }
  return {
    valid: false,
    reason: "Image must be an uploaded JPG/PNG/WebP photo (under 150 KB) or a valid https:// URL."
  };
}
function buildFactualDescriptionFromDraft(draft) {
  const parts = [];
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
    parts.push(`Roast: ${draft.coffeeDetails.roastLevel.replace("_", " ")}`);
  }
  if (draft.coffeeDetails?.processingMethod) {
    parts.push(`Process: ${draft.coffeeDetails.processingMethod}`);
  }
  if (draft.coffeeDetails?.beanForm) {
    parts.push(
      draft.coffeeDetails.beanForm === "ground" ? "Form: Ground coffee" : "Form: Whole beans"
    );
  }
  if (draft.coffeeDetails?.packageWeight) {
    parts.push(`Weight: ${draft.coffeeDetails.packageWeight}`);
  }
  if (draft.coffeeDetails?.roastDate) {
    parts.push(`Roast date: ${draft.coffeeDetails.roastDate}`);
  }
  const composed = parts.join(" \xB7 ").trim();
  return composed.length >= 5 ? composed.slice(0, 1900) : "";
}
function evaluateListingDraft(draft) {
  const validationErrors = {};
  const missingFields = [];
  const trimmedName = (draft.name ?? "").trim();
  if (!trimmedName) {
    missingFields.push("name");
  } else if (trimmedName.length < 3 || trimmedName.length > 140) {
    validationErrors.name = "Product name must be between 3 and 140 characters.";
  }
  let categorization;
  let resolvedCategory = draft.category ? normalizeProductCategory(draft.category) : "";
  if (trimmedName || resolvedCategory || draft.productType) {
    categorization = classifyProductCoffeeCategory({
      name: trimmedName,
      category: resolvedCategory || void 0,
      productType: draft.productType,
      coffeeDetails: draft.coffeeDetails,
      categoryConfirmed: draft.categoryConfirmed,
      confirmedCategory: draft.confirmedCategory
    });
    if (categorization.outcome === "coffee") {
      resolvedCategory = CANONICAL_COFFEE_CATEGORY;
    } else if (categorization.outcome === "non_coffee") {
      resolvedCategory = categorization.resolvedCategory;
    } else if (categorization.outcome === "conflict") {
      validationErrors.category = categorization.reason;
    } else if (categorization.outcome === "ambiguous" && categorization.requiresConfirmation) {
      missingFields.push("categoryConfirmation");
    }
  } else {
    missingFields.push("category");
  }
  const isCoffee = resolvedCategory === CANONICAL_COFFEE_CATEGORY && categorization?.outcome === "coffee";
  let nextCoffeeDetails;
  if (isCoffee) {
    const merged = {
      ...categorization?.inferredCoffeeDetails ?? {},
      ...draft.coffeeDetails ?? {}
    };
    if (merged.roastDate && !/^\d{4}-\d{2}-\d{2}$/.test(merged.roastDate)) {
      validationErrors.coffeeRoastDate = "Roast date must use YYYY-MM-DD format.";
    }
    nextCoffeeDetails = Object.keys(merged).length > 0 ? merged : void 0;
    if (!nextCoffeeDetails?.origin?.trim()) {
      missingFields.push("coffeeOrigin");
    }
    if (!nextCoffeeDetails?.packageWeight?.trim()) {
      missingFields.push("coffeePackageWeight");
    }
    if (!nextCoffeeDetails?.beanForm) {
      missingFields.push("coffeeBeanForm");
    }
    if (!nextCoffeeDetails?.roastLevel) {
      missingFields.push("coffeeRoastLevel");
    }
  } else {
    nextCoffeeDetails = void 0;
  }
  if (draft.price === void 0 || draft.price === null) {
    missingFields.push("price");
  } else if (!Number.isFinite(draft.price) || draft.price <= 0 || draft.price > 1e7) {
    validationErrors.price = "Price must be a positive number in ETB.";
  }
  if (draft.stock === void 0 || draft.stock === null) {
    missingFields.push("stock");
  } else if (!Number.isFinite(draft.stock) || draft.stock < 0 || !Number.isInteger(draft.stock)) {
    validationErrors.stock = "Stock must be a whole number (0 or higher).";
  }
  const trimmedDescription = (draft.description ?? "").trim();
  if (!trimmedDescription) {
    missingFields.push("description");
  } else if (trimmedDescription.length < 5 || trimmedDescription.length > 2e3) {
    validationErrors.description = "Description must be between 5 and 2000 characters.";
  }
  if (!draft.imageUrl) {
    missingFields.push("image");
  } else {
    const imgCheck = isValidDraftImage(draft.imageUrl);
    if (!imgCheck.valid) {
      validationErrors.image = imgCheck.reason ?? "Invalid product photo.";
    }
  }
  if (!draft.pickupAvailable && !draft.deliveryAvailable) {
    validationErrors.fulfillment = "Enable either delivery or in-shop pickup.";
  }
  const requiredCount = isCoffee ? 9 : 5;
  const remainingCount = missingFields.length + Object.keys(validationErrors).length;
  const completedCount = Math.max(0, requiredCount - remainingCount);
  const completionPercent = Math.min(
    100,
    Math.round(completedCount / Math.max(1, requiredCount) * 100)
  );
  const isComplete = missingFields.length === 0 && Object.keys(validationErrors).length === 0;
  const nextStatus = draft.status === "published" || draft.status === "canceled" ? draft.status : isComplete ? "ready_for_confirmation" : "collecting";
  return {
    ...draft,
    name: trimmedName || void 0,
    description: trimmedDescription || void 0,
    category: resolvedCategory || void 0,
    coffeeDetails: nextCoffeeDetails,
    categorization,
    missingFields,
    validationErrors,
    completionPercent: nextStatus === "ready_for_confirmation" ? 100 : completionPercent,
    status: nextStatus
  };
}
function applyUntrustedPatchToDraft(draft, patch, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
  const next = {
    ...draft,
    specs: draft.specs ? { ...draft.specs } : void 0,
    coffeeDetails: draft.coffeeDetails ? { ...draft.coffeeDetails } : void 0,
    updatedAt: nowIso
  };
  if (typeof patch.name === "string" && patch.name.trim().length > 0) {
    next.name = patch.name.trim().slice(0, 140);
  }
  if (typeof patch.description === "string" && patch.description.trim().length > 0) {
    next.description = patch.description.trim().slice(0, 2e3);
  }
  if (typeof patch.productType === "string" && patch.productType.trim().length > 0) {
    next.productType = patch.productType.trim().slice(0, 60);
  }
  if (typeof patch.rawCategory === "string" && patch.rawCategory.trim().length > 0) {
    const normalized = normalizeProductCategory(patch.rawCategory);
    if (normalized) {
      next.category = normalized;
      next.categoryConfirmed = void 0;
      next.confirmedCategory = void 0;
    }
  }
  if (typeof patch.priceEtb === "number" && Number.isFinite(patch.priceEtb)) {
    next.price = Math.round(patch.priceEtb);
  }
  if (typeof patch.previousPriceEtb === "number" && Number.isFinite(patch.previousPriceEtb)) {
    next.previousPrice = Math.round(patch.previousPriceEtb);
  }
  if (typeof patch.stockQuantity === "number" && Number.isFinite(patch.stockQuantity)) {
    next.stock = Math.trunc(patch.stockQuantity);
  }
  if (typeof patch.pickupAvailable === "boolean") {
    next.pickupAvailable = patch.pickupAvailable;
  }
  if (typeof patch.deliveryAvailable === "boolean") {
    next.deliveryAvailable = patch.deliveryAvailable;
  }
  const nextSpecs = { ...next.specs ?? {} };
  if (typeof patch.brand === "string" && patch.brand.trim()) {
    nextSpecs.brand = patch.brand.trim().slice(0, 80);
  }
  if (typeof patch.condition === "string" && patch.condition.trim()) {
    nextSpecs.condition = patch.condition.trim().slice(0, 40);
  }
  if (typeof patch.size === "string" && patch.size.trim()) {
    nextSpecs.size = patch.size.trim().slice(0, 40);
  }
  if (typeof patch.color === "string" && patch.color.trim()) {
    nextSpecs.color = patch.color.trim().slice(0, 40);
  }
  next.specs = Object.keys(nextSpecs).length > 0 ? nextSpecs : void 0;
  const nextCoffee = { ...next.coffeeDetails ?? {} };
  if (typeof patch.coffeeOrigin === "string" && patch.coffeeOrigin.trim()) {
    nextCoffee.origin = patch.coffeeOrigin.trim().slice(0, 80);
  }
  if (typeof patch.brand === "string" && patch.brand.trim()) {
    nextCoffee.brand = patch.brand.trim().slice(0, 80);
  }
  if (typeof patch.coffeeRoastLevel === "string" && VALID_ROAST_LEVELS2.has(patch.coffeeRoastLevel)) {
    nextCoffee.roastLevel = patch.coffeeRoastLevel;
  }
  if (typeof patch.coffeeProcessingMethod === "string" && VALID_PROCESS_METHODS2.has(patch.coffeeProcessingMethod)) {
    nextCoffee.processingMethod = patch.coffeeProcessingMethod;
  }
  if (typeof patch.coffeeBeanForm === "string" && VALID_BEAN_FORMS2.has(patch.coffeeBeanForm)) {
    nextCoffee.beanForm = patch.coffeeBeanForm;
  }
  if (typeof patch.coffeePackageWeight === "string" && patch.coffeePackageWeight.trim()) {
    nextCoffee.packageWeight = patch.coffeePackageWeight.trim().slice(0, 32);
  }
  if (typeof patch.coffeeRoastDate === "string" && patch.coffeeRoastDate.trim()) {
    nextCoffee.roastDate = patch.coffeeRoastDate.trim().slice(0, 32);
  }
  next.coffeeDetails = Object.keys(nextCoffee).length > 0 ? nextCoffee : void 0;
  return evaluateListingDraft(next);
}
function buildListingAssistantReply(draft, assistantNote) {
  const lines = [];
  if (assistantNote && assistantNote.trim()) {
    lines.push(assistantNote.trim());
  }
  const errorEntries = Object.entries(draft.validationErrors);
  if (errorEntries.length > 0) {
    lines.push("Please fix the following before publishing:");
    for (const [, msg] of errorEntries) {
      lines.push(`- ${msg}`);
    }
    return lines.join("\n");
  }
  if (draft.status === "ready_for_confirmation") {
    const categoryLabel = draft.category === CANONICAL_COFFEE_CATEGORY ? "**Coffee Traders**" : `**${draft.category}**`;
    lines.push(
      `Everything is ready for ${categoryLabel}! Please review your product preview card below and tap **Publish Product** to confirm, **Edit Details** to make changes, or **Cancel**.`
    );
    return lines.join("\n\n");
  }
  if (draft.missingFields.includes("categoryConfirmation")) {
    lines.push(
      "This product name could fit either **Coffee Traders** or a general category. Tap one of the confirmation buttons below to choose where it belongs."
    );
    return lines.join("\n\n");
  }
  const prompts = [];
  for (const field of draft.missingFields) {
    if (prompts.length >= 2) break;
    switch (field) {
      case "name":
        prompts.push("What is the **product name** you want to sell?");
        break;
      case "price":
        prompts.push("What is the **selling price in ETB**?");
        break;
      case "stock":
        prompts.push("How many **units are available in stock**?");
        break;
      case "coffeeOrigin":
        prompts.push("Which **Ethiopian coffee origin** is this from (e.g., Sidama, Yirgacheffe, Guji, Harar, Jimma)?");
        break;
      case "coffeePackageWeight":
        prompts.push("What is the **package weight** (e.g., 250g, 500g, 1kg)?");
        break;
      case "coffeeBeanForm":
        prompts.push("Is this coffee **whole beans** or **ground coffee**?");
        break;
      case "coffeeRoastLevel":
        prompts.push("What is the **roast level** (light, medium, medium-dark, or dark) \u2014 and optionally the processing method (washed, natural, honey)?");
        break;
      case "description":
        prompts.push("Add a short **product description** (quality, material, condition, or key details for Hawassa buyers).");
        break;
      case "image":
        prompts.push("Please **upload at least one product photo** using the camera/photo button below.");
        break;
      default:
        break;
    }
  }
  if (prompts.length === 0) {
    prompts.push("Tell me what product you would like to list, along with its price in ETB and available stock.");
  }
  if (draft.category === CANONICAL_COFFEE_CATEGORY && draft.categorization?.isCoffee) {
    lines.push(
      draft.categorization.autoAssigned ? "Auto-detected as **Ethiopian Coffee** \u2014 this listing will be placed in **Coffee Traders**." : "Categorized under **Coffee Traders**."
    );
  }
  if (prompts.length === 1) {
    lines.push(prompts[0]);
  } else {
    lines.push("Just a couple more details:");
    for (const p of prompts) {
      lines.push(`- ${p}`);
    }
  }
  return lines.join("\n");
}
function summarizeDraftForAi(draft) {
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
      missingFields: draft.missingFields
    },
    null,
    2
  );
}
var ListingDraftStore = class {
  constructor() {
    this.drafts = /* @__PURE__ */ new Map();
    this.activeDraftByOwner = /* @__PURE__ */ new Map();
    this.publishedByIdempotencyKey = /* @__PURE__ */ new Map();
    this.inFlightPublishes = /* @__PURE__ */ new Map();
  }
  getActiveDraftForOwner(ownerUid) {
    const draftId = this.activeDraftByOwner.get(ownerUid);
    if (!draftId) return null;
    const draft = this.drafts.get(draftId);
    if (!draft || draft.ownerUid !== ownerUid) return null;
    if (draft.status === "published" || draft.status === "canceled") return null;
    return draft;
  }
  createDraft(ownerUid, shop, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
    const draftId = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const initial = evaluateListingDraft({
      draftId,
      ownerUid,
      shopId: shop.shopId,
      shopName: shop.name,
      status: "collecting",
      category: shop.traderType === "coffee" ? CANONICAL_COFFEE_CATEGORY : void 0,
      pickupAvailable: shop.pickupAvailable,
      deliveryAvailable: shop.deliveryAvailable,
      missingFields: [],
      validationErrors: {},
      completionPercent: 0,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    this.drafts.set(draftId, initial);
    this.activeDraftByOwner.set(ownerUid, draftId);
    return initial;
  }
  getDraftForOwner(draftId, ownerUid) {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      return {
        ok: false,
        status: 404,
        code: "DRAFT_NOT_FOUND",
        error: "Listing draft was not found or has expired. Start a new listing to continue."
      };
    }
    if (draft.ownerUid !== ownerUid) {
      return {
        ok: false,
        status: 403,
        code: "FORBIDDEN_DRAFT_ACCESS",
        error: "You do not have permission to view, edit, or publish another seller\u2019s listing draft."
      };
    }
    return { ok: true, draft };
  }
  updateDraftShop(draftId, ownerUid, shop, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
    const lookup = this.getDraftForOwner(draftId, ownerUid);
    if (!lookup.ok) return lookup;
    if (lookup.draft.status === "published" || lookup.draft.status === "canceled") {
      return {
        ok: false,
        status: 409,
        code: "DRAFT_CLOSED",
        error: "This draft can no longer be edited."
      };
    }
    const updated = evaluateListingDraft({
      ...lookup.draft,
      shopId: shop.shopId,
      shopName: shop.name,
      pickupAvailable: shop.pickupAvailable,
      deliveryAvailable: shop.deliveryAvailable,
      updatedAt: nowIso
    });
    this.drafts.set(draftId, updated);
    return { ok: true, draft: updated };
  }
  applyPatch(draftId, ownerUid, patch, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
    const lookup = this.getDraftForOwner(draftId, ownerUid);
    if (!lookup.ok) return lookup;
    if (lookup.draft.status === "published") {
      return {
        ok: false,
        status: 409,
        code: "DRAFT_ALREADY_PUBLISHED",
        error: "This listing has already been published. Start a new listing to post another product.",
        draft: lookup.draft
      };
    }
    if (lookup.draft.status === "canceled") {
      return {
        ok: false,
        status: 409,
        code: "DRAFT_CANCELED",
        error: "This listing draft was canceled. Start a new listing to continue.",
        draft: lookup.draft
      };
    }
    if (patch.intent === "cancel_listing") {
      return this.cancelDraft(draftId, ownerUid, nowIso);
    }
    const updated = applyUntrustedPatchToDraft(lookup.draft, patch, nowIso);
    this.drafts.set(draftId, updated);
    return { ok: true, draft: updated };
  }
  attachImages(draftId, ownerUid, images, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
    const lookup = this.getDraftForOwner(draftId, ownerUid);
    if (!lookup.ok) return lookup;
    if (lookup.draft.status === "published" || lookup.draft.status === "canceled") {
      return {
        ok: false,
        status: 409,
        code: "DRAFT_CLOSED",
        error: "Cannot attach images to a closed or published draft.",
        draft: lookup.draft
      };
    }
    if (!Array.isArray(images) || images.length === 0) {
      return {
        ok: false,
        status: 400,
        code: "INVALID_IMAGE",
        error: "Provide at least one product image."
      };
    }
    if (images.length > 4) {
      return {
        ok: false,
        status: 400,
        code: "TOO_MANY_IMAGES",
        error: "You can attach up to 4 product photos per listing."
      };
    }
    const validated = [];
    for (const img of images) {
      if (typeof img !== "string") {
        return {
          ok: false,
          status: 400,
          code: "INVALID_IMAGE",
          error: "Each uploaded photo must be a valid image string."
        };
      }
      const check = isValidDraftImage(img);
      if (!check.valid) {
        return {
          ok: false,
          status: 400,
          code: "INVALID_IMAGE",
          error: check.reason ?? "Unsupported or oversized product photo."
        };
      }
      validated.push(img.trim());
    }
    const updated = evaluateListingDraft({
      ...lookup.draft,
      imageUrl: validated[0],
      additionalImages: validated.length > 1 ? validated.slice(1) : void 0,
      updatedAt: nowIso
    });
    this.drafts.set(draftId, updated);
    return { ok: true, draft: updated };
  }
  confirmAmbiguousCategory(draftId, ownerUid, confirmedCategory, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
    const lookup = this.getDraftForOwner(draftId, ownerUid);
    if (!lookup.ok) return lookup;
    if (lookup.draft.status === "published" || lookup.draft.status === "canceled") {
      return {
        ok: false,
        status: 409,
        code: "DRAFT_CLOSED",
        error: "Cannot modify a closed draft."
      };
    }
    const normalized = normalizeProductCategory(confirmedCategory);
    if (!normalized) {
      return {
        ok: false,
        status: 400,
        code: "INVALID_CATEGORY",
        error: "Choose a valid category to confirm."
      };
    }
    const updated = evaluateListingDraft({
      ...lookup.draft,
      category: normalized,
      categoryConfirmed: true,
      confirmedCategory: normalized,
      updatedAt: nowIso
    });
    this.drafts.set(draftId, updated);
    return { ok: true, draft: updated };
  }
  cancelDraft(draftId, ownerUid, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
    const lookup = this.getDraftForOwner(draftId, ownerUid);
    if (!lookup.ok) return lookup;
    if (lookup.draft.status === "published") {
      return {
        ok: false,
        status: 409,
        code: "DRAFT_ALREADY_PUBLISHED",
        error: "This listing has already been published and cannot be canceled.",
        draft: lookup.draft
      };
    }
    const canceled = {
      ...lookup.draft,
      status: "canceled",
      updatedAt: nowIso
    };
    this.drafts.set(draftId, canceled);
    if (this.activeDraftByOwner.get(ownerUid) === draftId) {
      this.activeDraftByOwner.delete(ownerUid);
    }
    return { ok: true, draft: canceled };
  }
  async publishDraft(params) {
    if (params.confirmPublish !== true) {
      return {
        ok: false,
        status: 400,
        code: "EXPLICIT_CONFIRMATION_REQUIRED",
        error: "Explicit seller confirmation is required before publishing a product listing."
      };
    }
    const lookup = this.getDraftForOwner(params.draftId, params.ownerUid);
    if (!lookup.ok) return lookup;
    const draft = lookup.draft;
    if (draft.status === "canceled") {
      return {
        ok: false,
        status: 409,
        code: "DRAFT_CANCELED",
        error: "This listing draft was canceled and cannot be published.",
        draft
      };
    }
    const normalizedKey = (params.idempotencyKey ?? draft.draftId).trim().slice(0, 128);
    const cacheKey = `${params.ownerUid}:${draft.draftId}:${normalizedKey}`;
    const draftPublishedKey = `${params.ownerUid}:${draft.draftId}`;
    const cached = this.publishedByIdempotencyKey.get(cacheKey) ?? this.publishedByIdempotencyKey.get(draftPublishedKey);
    if (cached) {
      return {
        ...cached,
        status: 200,
        duplicatePrevented: true
      };
    }
    const existingInFlight = this.inFlightPublishes.get(cacheKey) ?? this.inFlightPublishes.get(draftPublishedKey);
    if (existingInFlight) {
      const result = await existingInFlight;
      if (result.ok) {
        return { ...result, status: 200, duplicatePrevented: true };
      }
      return result;
    }
    const publishWork = (async () => {
      const sellerCheck = await params.verifySeller(draft.shopId);
      if (!sellerCheck.authorized || !sellerCheck.activeShop) {
        return {
          ok: false,
          status: 403,
          code: sellerCheck.code ?? "SELLER_NOT_VERIFIED",
          error: sellerCheck.reason ?? "Seller verification is required before publishing products.",
          verificationStatus: sellerCheck.verificationStatus
        };
      }
      const evaluated = evaluateListingDraft(draft);
      if (evaluated.missingFields.length > 0 || Object.keys(evaluated.validationErrors).length > 0) {
        this.drafts.set(draft.draftId, evaluated);
        return {
          ok: false,
          status: 400,
          code: "DRAFT_INCOMPLETE",
          error: buildListingAssistantReply(evaluated),
          draft: evaluated
        };
      }
      const finalDescription = buildFactualDescriptionFromDraft(evaluated);
      const specLines = [];
      if (evaluated.specs?.brand) specLines.push(`Brand: ${evaluated.specs.brand}`);
      if (evaluated.specs?.condition) specLines.push(`Condition: ${evaluated.specs.condition}`);
      if (evaluated.specs?.size) specLines.push(`Size: ${evaluated.specs.size}`);
      if (evaluated.specs?.color) specLines.push(`Color: ${evaluated.specs.color}`);
      const enrichedDescription = specLines.length > 0 && !specLines.every((line) => finalDescription.toLowerCase().includes(line.toLowerCase())) ? `${finalDescription}
${specLines.join(" \xB7 ")}`.slice(0, 2e3) : finalDescription;
      const nowIso = params.nowIso ?? (/* @__PURE__ */ new Date()).toISOString();
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
          coffeeDetails: evaluated.category === CANONICAL_COFFEE_CATEGORY ? evaluated.coffeeDetails : void 0,
          pickupAvailable: evaluated.pickupAvailable,
          deliveryAvailable: evaluated.deliveryAvailable,
          status: "active",
          categoryConfirmed: evaluated.categoryConfirmed,
          confirmedCategory: evaluated.confirmedCategory
        },
        {
          mode: "create",
          nowIso
        }
      );
      if (!validation.ok) {
        return {
          ok: false,
          status: validation.status,
          code: validation.code,
          error: validation.error,
          draft: evaluated,
          categorization: validation.categorization
        };
      }
      await params.persistProduct(validation.product);
      const publishedDraft = {
        ...evaluated,
        category: validation.product.category,
        status: "published",
        publishedProductId: validation.product.productId,
        updatedAt: nowIso
      };
      this.drafts.set(draft.draftId, publishedDraft);
      if (this.activeDraftByOwner.get(params.ownerUid) === draft.draftId) {
        this.activeDraftByOwner.delete(params.ownerUid);
      }
      const result = {
        ok: true,
        status: 201,
        product: validation.product,
        categorization: validation.categorization,
        draft: publishedDraft,
        duplicatePrevented: false
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
};
var listingDraftStore = new ListingDraftStore();
async function handleListingEligibility(req, res) {
  const idToken = extractBearerToken(req);
  try {
    const check = await verifySellerFromFirestore({
      uid: req.user.uid,
      email: req.user.email,
      emailVerified: req.user.email_verified,
      idToken
    });
    const activeDraft = check.authorized ? listingDraftStore.getActiveDraftForOwner(req.user.uid) : null;
    return res.json({
      eligible: check.authorized,
      isSeller: check.isSeller,
      isAdmin: check.isAdmin,
      verificationStatus: check.verificationStatus,
      code: check.code,
      reason: check.reason,
      verifiedShops: check.verifiedShops,
      activeShop: check.activeShop ?? null,
      activeDraft
    });
  } catch (err) {
    console.error("Listing eligibility check failed:", err);
    return res.status(502).json({
      error: "Unable to verify seller status right now. Please try again."
    });
  }
}
async function handleListingAssistantMessage(req, res) {
  const idToken = extractBearerToken(req);
  const body = req.body ?? {};
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 1500) : "";
  const requestedShopId = typeof body.shopId === "string" && body.shopId.trim() ? body.shopId.trim() : void 0;
  let sellerCheck;
  try {
    sellerCheck = await verifySellerFromFirestore({
      uid: req.user.uid,
      email: req.user.email,
      emailVerified: req.user.email_verified,
      idToken,
      requestedShopId
    });
  } catch (err) {
    console.error("Seller verification check failed:", err);
    return res.status(502).json({
      error: "Unable to confirm seller verification right now. Please try again."
    });
  }
  if (!sellerCheck.authorized || !sellerCheck.activeShop) {
    return res.status(403).json({
      code: sellerCheck.code ?? "SELLER_NOT_VERIFIED",
      error: sellerCheck.reason ?? "Only verified sellers can create and publish products through the assistant.",
      isSeller: sellerCheck.isSeller,
      verificationStatus: sellerCheck.verificationStatus
    });
  }
  let draft;
  if (body.draftId && !body.startNew) {
    const lookup = listingDraftStore.getDraftForOwner(body.draftId.trim(), req.user.uid);
    if (!lookup.ok) {
      return res.status(lookup.status).json({
        code: lookup.code,
        error: lookup.error
      });
    }
    draft = lookup.draft;
    if (requestedShopId && requestedShopId !== draft.shopId) {
      const switched = listingDraftStore.updateDraftShop(
        draft.draftId,
        req.user.uid,
        sellerCheck.activeShop
      );
      if (!switched.ok) {
        return res.status(switched.status).json({
          code: switched.code,
          error: switched.error
        });
      }
      draft = switched.draft;
    }
  } else if (!body.startNew) {
    draft = listingDraftStore.getActiveDraftForOwner(req.user.uid) ?? listingDraftStore.createDraft(req.user.uid, sellerCheck.activeShop);
  } else {
    draft = listingDraftStore.createDraft(req.user.uid, sellerCheck.activeShop);
  }
  if (!message) {
    const greeting = draft.completionPercent > 0 ? `Welcome back to your listing draft for **${draft.shopName}**.

${buildListingAssistantReply(draft)}` : `Ready to list a product for **${draft.shopName}**! Tell me what you want to sell \u2014 for example:
- *"I want to sell Sidama coffee, 500 grams, for 350 ETB"*
- *"Post a Samsung phone for 18,000 birr"*`;
    return res.json({
      reply: greeting,
      draft,
      verifiedShops: sellerCheck.verifiedShops
    });
  }
  try {
    const extraction = await extractProductDraftWithGemini({
      message,
      currentDraftSummary: summarizeDraftForAi(draft),
      history: Array.isArray(body.history) ? body.history.slice(-8) : [],
      language: typeof body.language === "string" ? body.language : "en",
      shopName: draft.shopName
    });
    const updated = listingDraftStore.applyPatch(draft.draftId, req.user.uid, extraction.patch);
    if (!updated.ok) {
      return res.status(updated.status).json({
        code: updated.code,
        error: updated.error,
        draft: updated.draft
      });
    }
    if (updated.draft.status === "canceled") {
      return res.json({
        reply: "Draft canceled. No product was published. Tap **Post a Product** anytime to start again.",
        draft: updated.draft,
        model: extraction.model,
        verifiedShops: sellerCheck.verifiedShops
      });
    }
    const reply = buildListingAssistantReply(updated.draft, extraction.patch.assistantNote);
    return res.json({
      reply,
      draft: updated.draft,
      model: extraction.model,
      verifiedShops: sellerCheck.verifiedShops
    });
  } catch (error) {
    console.error("Listing assistant extraction error:", error);
    const parsed = parseGeminiApiError(error);
    return res.status(parsed.status).json({
      error: parsed.message,
      draft
    });
  }
}
async function handleAttachListingImages(req, res) {
  const idToken = extractBearerToken(req);
  const draftId = String(req.params.draftId ?? "").trim();
  const body = req.body ?? {};
  let sellerCheck;
  try {
    sellerCheck = await verifySellerFromFirestore({
      uid: req.user.uid,
      email: req.user.email,
      emailVerified: req.user.email_verified,
      idToken
    });
  } catch {
    return res.status(502).json({ error: "Unable to verify seller account right now." });
  }
  if (!sellerCheck.authorized) {
    return res.status(403).json({
      code: sellerCheck.code ?? "SELLER_NOT_VERIFIED",
      error: sellerCheck.reason ?? "Only verified sellers can upload product photos."
    });
  }
  const result = listingDraftStore.attachImages(
    draftId,
    req.user.uid,
    Array.isArray(body.images) ? body.images : []
  );
  if (!result.ok) {
    return res.status(result.status).json({
      code: result.code,
      error: result.error,
      draft: result.draft
    });
  }
  return res.json({
    draft: result.draft,
    reply: buildListingAssistantReply(
      result.draft,
      `Uploaded ${1 + (result.draft.additionalImages?.length ?? 0)} product photo${(result.draft.additionalImages?.length ?? 0) > 0 ? "s" : ""}.`
    )
  });
}
async function handleConfirmListingCategory(req, res) {
  const idToken = extractBearerToken(req);
  const draftId = String(req.params.draftId ?? "").trim();
  const body = req.body ?? {};
  let sellerCheck;
  try {
    sellerCheck = await verifySellerFromFirestore({
      uid: req.user.uid,
      email: req.user.email,
      emailVerified: req.user.email_verified,
      idToken
    });
  } catch {
    return res.status(502).json({ error: "Unable to verify seller account right now." });
  }
  if (!sellerCheck.authorized) {
    return res.status(403).json({
      code: sellerCheck.code ?? "SELLER_NOT_VERIFIED",
      error: sellerCheck.reason ?? "Only verified sellers can manage listing drafts."
    });
  }
  const result = listingDraftStore.confirmAmbiguousCategory(
    draftId,
    req.user.uid,
    typeof body.confirmedCategory === "string" ? body.confirmedCategory : ""
  );
  if (!result.ok) {
    return res.status(result.status).json({
      code: result.code,
      error: result.error,
      draft: result.draft
    });
  }
  return res.json({
    draft: result.draft,
    reply: buildListingAssistantReply(
      result.draft,
      `Category confirmed as **${result.draft.category === CANONICAL_COFFEE_CATEGORY ? "Coffee Traders" : result.draft.category}**.`
    )
  });
}
async function handleCancelListingDraft(req, res) {
  const draftId = String(req.params.draftId ?? "").trim();
  const result = listingDraftStore.cancelDraft(draftId, req.user.uid);
  if (!result.ok) {
    return res.status(result.status).json({
      code: result.code,
      error: result.error,
      draft: result.draft
    });
  }
  return res.json({
    draft: result.draft,
    reply: "Draft canceled without publishing. You can start a new product listing anytime."
  });
}
async function handlePublishListingDraft(req, res) {
  const idToken = extractBearerToken(req);
  const draftId = String(req.params.draftId ?? "").trim();
  const body = req.body ?? {};
  try {
    const result = await listingDraftStore.publishDraft({
      draftId,
      ownerUid: req.user.uid,
      confirmPublish: body.confirmPublish === true,
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : void 0,
      verifySeller: (shopId) => verifySellerFromFirestore({
        uid: req.user.uid,
        email: req.user.email,
        emailVerified: req.user.email_verified,
        idToken,
        requestedShopId: shopId
      }),
      persistProduct: (product) => firestoreRestUpsertProduct(product, idToken)
    });
    if (!result.ok) {
      return res.status(result.status).json({
        code: result.code,
        error: result.error,
        draft: result.draft,
        categorization: result.categorization,
        verificationStatus: result.verificationStatus
      });
    }
    return res.status(result.status).json({
      product: result.product,
      categorization: result.categorization,
      draft: result.draft,
      duplicatePrevented: result.duplicatePrevented
    });
  } catch (err) {
    const statusCode = typeof err.statusCode === "number" ? err.statusCode : 500;
    return res.status(statusCode).json({
      error: err instanceof Error ? err.message : "Unable to publish product listing."
    });
  }
}

// src/server/apiApp.ts
dotenv.config();
function isSqlUnavailableError(error) {
  if (!isSqlConfigured()) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connect|database|timeout/i.test(msg);
}
function createApiApp() {
  const app = express();
  app.use("/api/chat/listing", express.json({ limit: "750kb" }));
  app.use("/api/chat", express.json({ limit: "64kb" }));
  app.use("/api/payments", express.json({ limit: "128kb" }));
  app.use("/api/products", express.json({ limit: "350kb" }));
  app.use("/api/video/caption", express.json({ limit: "1mb" }));
  app.use(express.json({ limit: "256kb" }));
  app.use(
    (err, _req, res, next) => {
      if (err && typeof err === "object" && "type" in err && err.type === "entity.too.large") {
        return res.status(413).json({ error: "Request payload exceeds the allowed size limit." });
      }
      if (err instanceof SyntaxError && "body" in err) {
        return res.status(400).json({ error: "Malformed JSON request body." });
      }
      return next(err);
    }
  );
  const chatRateLimiter = createRateLimiter({
    windowMs: 6e4,
    maxRequests: 15,
    keyPrefix: "chat"
  });
  const paymentInitiateRateLimiter = createRateLimiter({
    windowMs: 6e4,
    maxRequests: 10,
    keyPrefix: "pay-initiate"
  });
  const paymentVerifyRateLimiter = createRateLimiter({
    windowMs: 6e4,
    maxRequests: 15,
    keyPrefix: "pay-verify"
  });
  const paymentWebhookRateLimiter = createRateLimiter({
    windowMs: 6e4,
    maxRequests: 60,
    keyPrefix: "pay-webhook"
  });
  const productWriteRateLimiter = createRateLimiter({
    windowMs: 6e4,
    maxRequests: 30,
    keyPrefix: "products"
  });
  const listingAssistantRateLimiter = createRateLimiter({
    windowMs: 6e4,
    maxRequests: 25,
    keyPrefix: "chat-listing"
  });
  app.get("/api/maps-config", (_req, res) => {
    const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
    res.json({ apiKey });
  });
  app.post("/api/sql/sync-user", requireAuth, async (req, res) => {
    if (!isSqlConfigured()) {
      return res.json({ skipped: true, user: null });
    }
    try {
      const uid = req.user.uid;
      const email = req.user.email || `${uid}@hawasagebeya.local`;
      const displayName = req.body?.displayName || req.user.name || null;
      const user = await getOrCreateUser(uid, email, displayName);
      res.json({ user });
    } catch (error) {
      if (isSqlUnavailableError(error)) {
        return res.json({ skipped: true, user: null });
      }
      const message = error instanceof Error ? error.message : "Failed to sync user profile";
      res.status(500).json({ error: message });
    }
  });
  app.get("/api/sql/chat", requireAuth, async (req, res) => {
    if (!isSqlConfigured()) {
      return res.json({ skipped: true, messages: [] });
    }
    try {
      const uid = req.user.uid;
      await getOrCreateUser(uid, req.user.email || `${uid}@hawasagebeya.local`, req.user.name);
      const messages = await getUserChatHistory(uid);
      res.json({ messages });
    } catch (error) {
      if (isSqlUnavailableError(error)) {
        return res.json({ skipped: true, messages: [] });
      }
      const message = error instanceof Error ? error.message : "Failed to fetch chat history";
      res.status(500).json({ error: message });
    }
  });
  app.delete("/api/sql/chat", requireAuth, async (req, res) => {
    if (!isSqlConfigured()) {
      return res.json({ skipped: true, cleared: true });
    }
    try {
      const uid = req.user.uid;
      const user = await getOrCreateUser(
        uid,
        req.user.email || `${uid}@hawasagebeya.local`,
        req.user.name
      );
      await clearUserChatHistory(user.id);
      res.json({ cleared: true });
    } catch (error) {
      if (isSqlUnavailableError(error)) {
        return res.json({ skipped: true, cleared: true });
      }
      const message = error instanceof Error ? error.message : "Failed to clear chat history";
      res.status(500).json({ error: message });
    }
  });
  app.get("/api/sql/places", requireAuth, async (req, res) => {
    if (!isSqlConfigured()) {
      return res.json({ skipped: true, places: [] });
    }
    try {
      const uid = req.user.uid;
      await getOrCreateUser(uid, req.user.email || `${uid}@hawasagebeya.local`, req.user.name);
      const places = await getSavedPlaces(uid);
      res.json({ places });
    } catch (error) {
      if (isSqlUnavailableError(error)) {
        return res.json({ skipped: true, places: [] });
      }
      const message = error instanceof Error ? error.message : "Failed to fetch saved places";
      res.status(500).json({ error: message });
    }
  });
  app.post("/api/sql/places", requireAuth, async (req, res) => {
    const { title, query, mapsUri, notes } = req.body ?? {};
    if (!title || !query) {
      return res.status(400).json({ error: "Place title and query are required." });
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
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    }
    try {
      const uid = req.user.uid;
      const user = await getOrCreateUser(
        uid,
        req.user.email || `${uid}@hawasagebeya.local`,
        req.user.name
      );
      const saved = await saveGroundedPlace(user.id, {
        title: String(title),
        query: String(query),
        mapsUri: mapsUri ? String(mapsUri) : null,
        notes: notes ? String(notes) : null
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
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        });
      }
      const message = error instanceof Error ? error.message : "Failed to save place";
      res.status(500).json({ error: message });
    }
  });
  app.delete("/api/sql/places/:id", requireAuth, async (req, res) => {
    const placeId = Number(req.params.id);
    if (!Number.isFinite(placeId)) {
      return res.status(400).json({ error: "Invalid place ID." });
    }
    if (!isSqlConfigured()) {
      return res.json({ skipped: true, deleted: true });
    }
    try {
      const uid = req.user.uid;
      const user = await getOrCreateUser(
        uid,
        req.user.email || `${uid}@hawasagebeya.local`,
        req.user.name
      );
      await deleteSavedPlace(user.id, placeId);
      res.json({ deleted: true });
    } catch (error) {
      if (isSqlUnavailableError(error)) {
        return res.json({ skipped: true, deleted: true });
      }
      const message = error instanceof Error ? error.message : "Failed to delete saved place";
      res.status(500).json({ error: message });
    }
  });
  app.get("/api/sql/reels", requireAuth, async (req, res) => {
    if (!isSqlConfigured()) {
      return res.json({ skipped: true, reels: [] });
    }
    try {
      const uid = req.user.uid;
      await getOrCreateUser(uid, req.user.email || `${uid}@hawasagebeya.local`, req.user.name);
      const reels = await getPromoReels(uid);
      res.json({ reels });
    } catch (error) {
      if (isSqlUnavailableError(error)) {
        return res.json({ skipped: true, reels: [] });
      }
      const message = error instanceof Error ? error.message : "Failed to fetch promo reels";
      res.status(500).json({ error: message });
    }
  });
  app.post("/api/sql/reels", requireAuth, async (req, res) => {
    const { productId, title, caption, aspectRatio } = req.body ?? {};
    if (!title || !aspectRatio) {
      return res.status(400).json({ error: "Reel title and aspectRatio are required." });
    }
    if (!isSqlConfigured()) {
      return res.json({
        skipped: true,
        reel: {
          id: Date.now(),
          productId: productId ? String(productId) : null,
          title: String(title),
          caption: String(caption || ""),
          aspectRatio: String(aspectRatio),
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    }
    try {
      const uid = req.user.uid;
      const user = await getOrCreateUser(
        uid,
        req.user.email || `${uid}@hawasagebeya.local`,
        req.user.name
      );
      const reel = await recordPromoReel(user.id, {
        productId: productId ? String(productId) : null,
        title: String(title),
        caption: String(caption || ""),
        aspectRatio: String(aspectRatio)
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
            caption: String(caption || ""),
            aspectRatio: String(aspectRatio),
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        });
      }
      const message = error instanceof Error ? error.message : "Failed to save promo reel";
      res.status(500).json({ error: message });
    }
  });
  app.post("/api/chat", chatRateLimiter.middleware, async (req, res) => {
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
        contextSummary
      } = validation.data;
      const result = await chatWithConcierge({
        message,
        history,
        mode,
        systemInstruction,
        language,
        contextSummary
      });
      const authHeader = req.headers.authorization;
      if (isSqlConfigured() && authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
          const user = await getOrCreateUser(
            decoded.uid,
            decoded.email || `${decoded.uid}@hawasagebeya.local`,
            decoded.name
          );
          await appendChatMessages(user.id, [
            { role: "user", model: result.model, content: message },
            { role: "model", model: result.model, content: result.text }
          ]);
        } catch (syncErr) {
          console.warn("Optional Cloud SQL chat persistence skipped:", syncErr);
        }
      }
      res.json(result);
    } catch (error) {
      console.error("Chat endpoint error:", error);
      const parsed = parseGeminiApiError(error);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });
  app.get(
    "/api/chat/listing/eligibility",
    listingAssistantRateLimiter.middleware,
    requireAuth,
    handleListingEligibility
  );
  app.post(
    "/api/chat/listing/message",
    listingAssistantRateLimiter.middleware,
    requireAuth,
    handleListingAssistantMessage
  );
  app.post(
    "/api/chat/listing/drafts/:draftId/images",
    listingAssistantRateLimiter.middleware,
    requireAuth,
    handleAttachListingImages
  );
  app.post(
    "/api/chat/listing/drafts/:draftId/confirm-category",
    listingAssistantRateLimiter.middleware,
    requireAuth,
    handleConfirmListingCategory
  );
  app.post(
    "/api/chat/listing/drafts/:draftId/publish",
    listingAssistantRateLimiter.middleware,
    requireAuth,
    handlePublishListingDraft
  );
  app.post(
    "/api/chat/listing/drafts/:draftId/cancel",
    listingAssistantRateLimiter.middleware,
    requireAuth,
    handleCancelListingDraft
  );
  app.post("/api/maps-grounding", async (req, res) => {
    try {
      const { query, latitude, longitude } = req.body ?? {};
      if (!query || typeof query !== "string" || !query.trim()) {
        return res.status(400).json({ error: "A location or place query is required." });
      }
      const data = await searchHawassaWithMapsGrounding({
        query: query.trim(),
        latitude: typeof latitude === "number" ? latitude : void 0,
        longitude: typeof longitude === "number" ? longitude : void 0
      });
      res.json(data);
    } catch (error) {
      console.error("Maps grounding error:", error);
      const parsed = parseGeminiApiError(error);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });
  app.post("/api/video/caption", async (req, res) => {
    try {
      const { productName, shopName, priceEtb, imageBase64, mimeType } = req.body ?? {};
      const caption = await generatePromoCaption({
        productName: typeof productName === "string" ? productName : void 0,
        shopName: typeof shopName === "string" ? shopName : void 0,
        priceEtb: typeof priceEtb === "number" ? priceEtb : void 0,
        imageBase64: typeof imageBase64 === "string" ? imageBase64 : void 0,
        mimeType: typeof mimeType === "string" ? mimeType : void 0
      });
      res.json(caption);
    } catch (error) {
      console.error("Video caption error:", error);
      const parsed = parseGeminiApiError(error);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });
  app.post("/api/auth/welcome-back-email", async (req, res) => {
    try {
      const { email, displayName, neighborhood, language, loginTimestamp } = req.body ?? {};
      if (!isValidEmailAddress(email)) {
        return res.status(400).json({ error: "A valid recipient email address is required." });
      }
      const configuredAppUrl = process.env.APP_URL?.trim();
      const safeConfiguredUrl = configuredAppUrl && /^https?:\/\//i.test(configuredAppUrl) && !configuredAppUrl.includes("MY_APP_URL") ? configuredAppUrl : "";
      const originHeader = req.get("origin");
      const hostHeader = req.get("host");
      const appUrl = safeConfiguredUrl || (originHeader && /^https?:\/\//i.test(originHeader) ? originHeader : hostHeader ? `${req.protocol || "https"}://${hostHeader}` : "https://affin-connect.vercel.app");
      const rendered = buildWelcomeBackEmail({
        email,
        displayName: typeof displayName === "string" ? displayName : void 0,
        neighborhood: typeof neighborhood === "string" ? neighborhood : void 0,
        language: typeof language === "string" ? language : "en",
        loginTimestamp: typeof loginTimestamp === "string" ? loginTimestamp : void 0,
        appUrl
      });
      const result = await dispatchWelcomeBackEmail(rendered);
      return res.json({
        sent: result.sent,
        mode: result.mode,
        channel: result.channel,
        recipient: rendered.normalizedEmail,
        subject: rendered.subject,
        loginTimestamp: rendered.formattedTimestamp
      });
    } catch (error) {
      console.error("Welcome-back email endpoint error:", error);
      return res.status(500).json({ error: "Failed to process welcome-back email." });
    }
  });
  app.get("/api/payments/providers", (_req, res) => {
    res.json({ providers: getPaymentProvidersStatus() });
  });
  app.post("/api/payments/initiate", paymentInitiateRateLimiter.middleware, handleInitiatePayment);
  app.post("/api/payments/verify", paymentVerifyRateLimiter.middleware, handleVerifyPayment);
  app.post("/api/payments/webhook/chapa", paymentWebhookRateLimiter.middleware, handleChapaWebhook);
  app.post("/api/payments/webhook/telebirr", paymentWebhookRateLimiter.middleware, handleProviderWebhook("telebirr"));
  app.post("/api/payments/webhook/cbe", paymentWebhookRateLimiter.middleware, handleProviderWebhook("cbe_birr"));
  app.post(
    "/api/products/categorize",
    productWriteRateLimiter.middleware,
    requireAuth,
    handleCategorizeProductPreview
  );
  app.post(
    "/api/products/migrate-coffee",
    productWriteRateLimiter.middleware,
    requireAuth,
    handleMigrateCoffeeProducts
  );
  app.post(
    "/api/products",
    productWriteRateLimiter.middleware,
    requireAuth,
    handleCreateProduct
  );
  app.put(
    "/api/products/:productId",
    productWriteRateLimiter.middleware,
    requireAuth,
    handleUpdateProduct
  );
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

// src/server/vercelEntry.ts
var appInstance = null;
var initError = null;
try {
  appInstance = createApiApp();
} catch (err) {
  initError = err;
  console.error("Vercel API initialization failed:", err);
}
function handler(req, res) {
  if (!appInstance) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: initError instanceof Error ? initError.message : "Server API failed to initialize."
      })
    );
    return;
  }
  const vercelReq = req;
  if (vercelReq.body !== void 0 && vercelReq._body !== true) {
    vercelReq._body = true;
  }
  return appInstance(req, res);
}
export {
  handler as default
};
