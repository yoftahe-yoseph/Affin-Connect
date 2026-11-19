import { GoogleGenAI, ThinkingLevel, Type, type Content } from '@google/genai';

function getAiClient(): GoogleGenAI {
  const apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY ||
    ''
  ).trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function parseGeminiApiError(error: unknown): { status: number; message: string } {
  const rawMessage = error instanceof Error ? error.message : String(error ?? 'Gemini request failed.');
  const errObj = error as { status?: number; code?: number } | null;
  let statusCode =
    typeof errObj?.status === 'number'
      ? errObj.status
      : typeof errObj?.code === 'number'
        ? errObj.code
        : 500;
  let apiStatus = '';
  let parsedDetail = '';

  const trimmed = rawMessage.trim();
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart)) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed?.error) {
        if (typeof parsed.error.code === 'number') statusCode = parsed.error.code;
        if (typeof parsed.error.status === 'string') apiStatus = parsed.error.status;
        if (typeof parsed.error.message === 'string') parsedDetail = parsed.error.message;
      }
    } catch {
      // Fall back to string inspection below
    }
  }

  const upper = `${apiStatus} ${rawMessage}`.toUpperCase();

  if (statusCode === 429 || upper.includes('RESOURCE_EXHAUSTED') || upper.includes('QUOTA')) {
    return {
      status: 429,
      message:
        'Gemini API quota reached for the current key. Please upgrade or select a billing-enabled key in Settings > Secrets.',
    };
  }

  if (
    statusCode === 503 ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('HIGH DEMAND') ||
    upper.includes('OVERLOADED')
  ) {
    return {
      status: 503,
      message:
        'The AI assistant is experiencing high traffic right now. Please tap Retry in a few seconds.',
    };
  }

  if (
    statusCode === 403 ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('API KEY NOT VALID')
  ) {
    return {
      status: statusCode === 403 ? 403 : 400,
      message:
        'Gemini API key permission denied or invalid. Please check GEMINI_API_KEY in Settings > Secrets.',
    };
  }

  if (statusCode === 404 || upper.includes('NOT_FOUND')) {
    return {
      status: 404,
      message: 'The requested Gemini model is unavailable right now. Please try another mode.',
    };
  }

  if (statusCode === 400 || upper.includes('INVALID_ARGUMENT')) {
    return {
      status: 400,
      message: parsedDetail || 'Invalid request sent to Gemini API.',
    };
  }

  return {
    status: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
    message: parsedDetail || rawMessage || 'Gemini request failed.',
  };
}

export function isTransientGeminiOverloadError(error: unknown): boolean {
  const parsed = parseGeminiApiError(error);
  if (parsed.status === 503 || parsed.status === 502 || parsed.status === 504) {
    return true;
  }
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const upper = raw.toUpperCase();
  return (
    upper.includes('UNAVAILABLE') ||
    upper.includes('HIGH DEMAND') ||
    upper.includes('OVERLOADED') ||
    upper.includes('ECONNRESET') ||
    upper.includes('ETIMEDOUT')
  );
}

function isModelUnavailableError(error: unknown): boolean {
  const parsed = parseGeminiApiError(error);
  if (parsed.status === 404) return true;
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const upper = raw.toUpperCase();
  return upper.includes('NOT_FOUND') || upper.includes('NOT FOUND') || upper.includes('UNSUPPORTED MODEL');
}

function shouldTryNextGeminiModel(error: unknown): boolean {
  return isTransientGeminiOverloadError(error) || isModelUnavailableError(error);
}

export type ConciergeMode = 'balanced' | 'deep' | 'fast' | 'lite';

export interface ChatTurnInput {
  role: 'user' | 'model';
  content: string;
}

export interface GroundedPlace {
  title: string;
  uri: string;
  placeId?: string;
  reviewSnippets?: string[];
}

const DEFAULT_HAWASSA_SYSTEM_INSTRUCTION = `You are the Affin Connect AI Assistant for Hawassa, Sidama Region, Ethiopia.
Help shoppers and local merchants with practical, accurate, concise advice:
- Recommend products, Sidama specialty coffee, handwoven Habesha Netela/Gabi, Berbere/spices, and electronics in Ethiopian Birr (ETB).
- Explain Hawassa neighborhoods (Piazza, Menhariya, Gebeya Dar, Tabor, Datto, Arab Sefer, Lake Hawassa shore), local delivery vs. in-shop pickup, and payment options (Telebirr, CBE, Chapa, Cash on Delivery, Pay at Pickup).
- Assist merchants with bilingual product listings, stock planning, and friendly customer replies.
- Keep replies concise, scannable, warm, and well-structured for mobile reading without inventing unverified street addresses or business hours.`;

export function normalizeChatHistory(history: ChatTurnInput[] = []): Content[] {
  const cleaned = history
    .filter(
      (h) =>
        (h.role === 'user' || h.role === 'model') &&
        typeof h.content === 'string' &&
        h.content.trim().length > 0
    )
    .slice(-20);

  // Drop leading model greeting turns so conversation history always begins with a user turn
  while (cleaned.length > 0 && cleaned[0].role === 'model') {
    cleaned.shift();
  }

  // Collapse adjacent same-role messages and ensure history never ends on a user turn before sendMessage
  const merged: ChatTurnInput[] = [];
  for (const turn of cleaned) {
    const trimmedContent = turn.content.trim();
    const prev = merged[merged.length - 1];
    if (prev && prev.role === turn.role) {
      prev.content = `${prev.content}\n\n${trimmedContent}`;
    } else {
      merged.push({ role: turn.role, content: trimmedContent });
    }
  }
  while (merged.length > 0 && merged[merged.length - 1].role === 'user') {
    merged.pop();
  }

  return merged.map((h) => ({
    role: h.role,
    parts: [{ text: h.content }],
  }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function chatWithConcierge(params: {
  message: string;
  history?: ChatTurnInput[];
  mode?: ConciergeMode;
  systemInstruction?: string;
  language?: string;
  contextSummary?: string;
}) {
  const ai = getAiClient();
  const mode = params.mode ?? 'fast';

  const primaryModel = mode === 'lite' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';

  const primaryThinkingLevel =
    mode === 'deep'
      ? ThinkingLevel.XHIGH
      : mode === 'fast'
        ? ThinkingLevel.LOW
        : mode === 'balanced'
          ? ThinkingLevel.MEDIUM
          : undefined;

  const formattedHistory = normalizeChatHistory(params.history);

  const languageHint =
    params.language === 'am'
      ? 'Respond primarily in Amharic (with English product names or ETB prices when helpful).'
      : params.language === 'om'
        ? 'Respond primarily in Afaan Oromo (with English product names or ETB prices when helpful).'
        : params.language === 'sid'
          ? 'Respond primarily in Sidaamu Afoo (with English product names or ETB prices when helpful).'
          : 'Respond in clear, friendly English (using authentic Hawassa/Ethiopian terms where natural).';

  const contextBlock =
    typeof params.contextSummary === 'string' && params.contextSummary.trim().length > 0
      ? `Current Affin Connect Live Context:\n${params.contextSummary.trim().slice(0, 2000)}`
      : '';

  const fullSystemInstruction = [
    params.systemInstruction?.trim() || DEFAULT_HAWASSA_SYSTEM_INSTRUCTION,
    languageHint,
    contextBlock,
  ]
    .filter(Boolean)
    .join('\n\n');

  const runModelChat = async (model: string, thinkingLevel?: ThinkingLevel) => {
    const chat = ai.chats.create({
      model,
      history: formattedHistory,
      config: {
        systemInstruction: fullSystemInstruction,
        ...(thinkingLevel && model === 'gemini-4-hydrogen'
          ? { thinkingConfig: { thinkingLevel } }
          : {}),
      },
    });

    const response = await chat.sendMessage({ message: params.message });
    return {
      text:
        response.text?.trim() ||
        'I could not generate a response right now. Please try asking again.',
      model,
    };
  };

  const candidateModels =
    primaryModel === 'gemini-3.1-flash-lite'
      ? ['gemini-3.1-flash-lite', 'gemini-4-hydrogen', 'gemini-2.5-flash']
      : ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];

  const primaryTimeoutMs = mode === 'deep' ? 18000 : 10000;
  let lastError: unknown;

  for (let idx = 0; idx < candidateModels.length; idx += 1) {
    const modelName = candidateModels[idx];
    const timeoutMs = idx === 0 ? primaryTimeoutMs : 12000;
    const thinking = modelName === 'gemini-4-hydrogen' ? primaryThinkingLevel : undefined;

    try {
      return await Promise.race([
        runModelChat(modelName, thinking),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('503 UNAVAILABLE: Primary model timed out under high demand.')),
            timeoutMs
          );
        }),
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

export async function searchHawassaWithMapsGrounding(params: {
  query: string;
  latitude?: number;
  longitude?: number;
}) {
  const ai = getAiClient();

  const lat =
    typeof params.latitude === 'number' && Number.isFinite(params.latitude)
      ? params.latitude
      : 7.0621;
  const lng =
    typeof params.longitude === 'number' && Number.isFinite(params.longitude)
      ? params.longitude
      : 38.4763;

  const prompt = `${params.query.trim()} (Focus on Hawassa, Sidama Region, Ethiopia unless another location is specified.)`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: lat,
            longitude: lng,
          },
        },
      },
    },
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const places: GroundedPlace[] = [];

  for (const chunk of chunks) {
    const mapsInfo = (chunk as {
      maps?: {
        uri?: string;
        title?: string;
        placeId?: string;
        placeAnswerSources?: {
          reviewSnippets?: { content?: string; text?: string }[];
        };
      };
    }).maps;

    if (mapsInfo?.uri && mapsInfo?.title) {
      const snippets =
        mapsInfo.placeAnswerSources?.reviewSnippets
          ?.map((s) => s.content || s.text || '')
          .filter(Boolean) ?? [];

      places.push({
        title: mapsInfo.title,
        uri: mapsInfo.uri,
        placeId: mapsInfo.placeId,
        reviewSnippets: snippets.length > 0 ? snippets : undefined,
      });
    }
  }

  return {
    text: response.text ?? '',
    places,
    coordinates: { latitude: lat, longitude: lng },
  };
}

export async function generatePromoCaption(params: {
  productName?: string;
  shopName?: string;
  priceEtb?: number;
  imageBase64?: string;
  mimeType?: string;
}) {
  const ai = getAiClient();

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  if (params.imageBase64 && params.mimeType) {
    parts.push({
      inlineData: {
        mimeType: params.mimeType,
        data: params.imageBase64,
      },
    });
  }

  const contextLines = [
    params.productName ? `Product: ${params.productName}` : '',
    params.shopName ? `Shop: ${params.shopName}` : '',
    params.priceEtb ? `Price: ETB ${params.priceEtb}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  parts.push({
    text: `Write a short, punchy 1-line marketplace reel headline (max 7 words) and a 1-sentence subtitle (max 14 words) for a local Hawassa shop video promo. ${contextLines ? `Context: ${contextLines}.` : ''} Format strictly as:\nHEADLINE: <headline>\nSUBTITLE: <subtitle>`,
  });

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const raw = response.text ?? '';
  const headlineMatch = raw.match(/HEADLINE:\s*(.+)/i);
  const subtitleMatch = raw.match(/SUBTITLE:\s*(.+)/i);

  return {
    headline: headlineMatch?.[1]?.trim() || params.productName || 'Fresh from Hawasa Gebeya',
    subtitle:
      subtitleMatch?.[1]?.trim() ||
      'Same-day delivery & pickup across Hawassa local merchants.',
  };
}

export interface AiExtractedProductPatch {
  intent: 'update_listing' | 'cancel_listing' | 'general_question';
  name?: string;
  description?: string;
  rawCategory?: string;
  productType?: string;
  priceEtb?: number;
  previousPriceEtb?: number;
  stockQuantity?: number;
  brand?: string;
  condition?: string;
  size?: string;
  color?: string;
  pickupAvailable?: boolean;
  deliveryAvailable?: boolean;
  coffeeOrigin?: string;
  coffeeRoastLevel?: string;
  coffeeProcessingMethod?: string;
  coffeeBeanForm?: string;
  coffeePackageWeight?: string;
  coffeeRoastDate?: string;
  assistantNote?: string;
}

const PRODUCT_EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: ['update_listing', 'cancel_listing', 'general_question'],
      description:
        'Whether the seller is providing/updating product listing fields, canceling the draft, or asking an unrelated general question.',
    },
    name: {
      type: Type.STRING,
      description: 'Clean product title if explicitly provided or updated by the seller. Omit if not mentioned.',
    },
    description: {
      type: Type.STRING,
      description:
        'Factual product description ONLY from details the seller explicitly stated. Do NOT invent certifications, warranties, or specs.',
    },
    rawCategory: {
      type: Type.STRING,
      description:
        'Product category mentioned or implied (e.g., Coffee, Ethiopian Coffee, Electronics, Clothing, Groceries, Spices, Home, Beauty, Sports, Automotive).',
    },
    productType: {
      type: Type.STRING,
      description:
        'Specific product type (e.g., Roasted Coffee, Ground Coffee, Smartphone, Women Shoes, Traditional Dress).',
    },
    priceEtb: {
      type: Type.NUMBER,
      description: 'Numeric selling price in Ethiopian Birr (ETB) ONLY if explicitly stated by the seller.',
    },
    previousPriceEtb: {
      type: Type.NUMBER,
      description: 'Original/compare-at price in ETB ONLY if seller explicitly mentioned a discount or previous price.',
    },
    stockQuantity: {
      type: Type.INTEGER,
      description: 'Available inventory count/quantity ONLY if explicitly stated by the seller. Never guess stock.',
    },
    brand: {
      type: Type.STRING,
      description: 'Brand or roastery name ONLY if stated by the seller.',
    },
    condition: {
      type: Type.STRING,
      description: 'Item condition (e.g., Brand New, Like New, Used) ONLY if stated by the seller.',
    },
    size: {
      type: Type.STRING,
      description: 'Size (e.g., 38, Medium, 256GB) ONLY if stated by the seller.',
    },
    color: {
      type: Type.STRING,
      description: 'Color ONLY if stated by the seller.',
    },
    pickupAvailable: {
      type: Type.BOOLEAN,
      description: 'Set ONLY if seller explicitly changed pickup availability.',
    },
    deliveryAvailable: {
      type: Type.BOOLEAN,
      description: 'Set ONLY if seller explicitly changed delivery availability.',
    },
    coffeeOrigin: {
      type: Type.STRING,
      description: 'Coffee origin region (e.g., Sidama, Yirgacheffe, Guji, Harar, Jimma) ONLY if stated.',
    },
    coffeeRoastLevel: {
      type: Type.STRING,
      enum: ['light', 'medium', 'medium_dark', 'dark'],
      description: 'Roast level ONLY if explicitly stated.',
    },
    coffeeProcessingMethod: {
      type: Type.STRING,
      enum: ['washed', 'natural', 'honey', 'anaerobic'],
      description: 'Coffee processing method ONLY if explicitly stated.',
    },
    coffeeBeanForm: {
      type: Type.STRING,
      enum: ['whole_bean', 'ground'],
      description: 'Whole beans or ground coffee ONLY if explicitly stated.',
    },
    coffeePackageWeight: {
      type: Type.STRING,
      description: 'Package weight (e.g., 250g, 500g, 1kg, 20kg) ONLY if stated.',
    },
    coffeeRoastDate: {
      type: Type.STRING,
      description: 'Roast date in YYYY-MM-DD format ONLY if explicitly stated.',
    },
    assistantNote: {
      type: Type.STRING,
      description:
        'Brief, warm 1-sentence acknowledgment of what was captured (never claim the product is published).',
    },
  },
  required: ['intent'],
};

/**
 * Extracts structured product fields from a verified seller's conversational
 * message using Gemini structured JSON output. The returned patch is ALWAYS
 * treated as an untrusted draft and independently validated by the backend.
 */
export async function extractProductDraftWithGemini(params: {
  message: string;
  currentDraftSummary: string;
  history?: ChatTurnInput[];
  language?: string;
  shopName: string;
}): Promise<{ patch: AiExtractedProductPatch; model: string }> {
  const ai = getAiClient();

  const recentTurns = (params.history ?? [])
    .slice(-6)
    .map((h) => `${h.role === 'user' ? 'Seller' : 'Assistant'}: ${h.content.slice(0, 400)}`)
    .join('\n');

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
    `Current Draft State:\n${params.currentDraftSummary}`,
    recentTurns ? `Recent Conversation:\n${recentTurns}` : '',
    `Latest Seller Message:\n${params.message.trim()}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const runExtraction = async (model: string, thinkingLevel?: ThinkingLevel) => {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: PRODUCT_EXTRACTION_SCHEMA,
        ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
      },
    });
    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      throw new Error('Empty structured response from Gemini.');
    }
    const parsed = JSON.parse(rawText) as AiExtractedProductPatch;
    return {
      patch: parsed,
      model,
    };
  };

  const extractionModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
  let lastError: unknown;

  for (let idx = 0; idx < extractionModels.length; idx += 1) {
    const modelName = extractionModels[idx];
    const thinking = modelName === 'gemini-4-hydrogen' ? ThinkingLevel.LOW : undefined;
    try {
      return await Promise.race([
        runExtraction(modelName, thinking),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('503 UNAVAILABLE: Listing extraction timed out.')),
            10000
          );
        }),
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

