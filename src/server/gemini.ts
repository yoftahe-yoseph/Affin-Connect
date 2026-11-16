import { GoogleGenAI, ThinkingLevel, type Content } from '@google/genai';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
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

const DEFAULT_HAWASSA_SYSTEM_INSTRUCTION = `You are the Hawasa Gebeya Marketplace Concierge for Hawassa, Sidama Region, Ethiopia.
Help shoppers and local merchants with practical, accurate, concise advice:
- Recommend products, Sidama specialty coffee, handwoven Habesha Netela/Gabi, Berbere/spices, and electronics in Ethiopian Birr (ETB).
- Give guidance on Hawassa neighborhoods (Piazza, Menhariya, Gebeya Dar, Tabor, Datto, Arab Sefer, Lake Hawassa shore), delivery vs. in-shop pickup, and Cash on Delivery / Pay at Pickup.
- Assist sellers with bilingual (English, Amharic, Afaan Oromo) product descriptions, inventory planning, and customer service replies.
- Keep responses scannable, warm, and well-structured without inventing real-world street addresses or unverified business hours.`;

export async function chatWithConcierge(params: {
  message: string;
  history?: ChatTurnInput[];
  mode?: ConciergeMode;
  systemInstruction?: string;
  language?: string;
}) {
  const ai = getAiClient();
  const mode = params.mode ?? 'balanced';

  const model = mode === 'lite' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';

  const thinkingLevel =
    mode === 'deep'
      ? ThinkingLevel.XHIGH
      : mode === 'fast'
        ? ThinkingLevel.LOW
        : mode === 'balanced'
          ? ThinkingLevel.MEDIUM
          : undefined;

  const formattedHistory: Content[] = (params.history ?? [])
    .filter((h) => h.content.trim().length > 0)
    .slice(-20)
    .map((h) => ({
      role: h.role,
      parts: [{ text: h.content }],
    }));

  const languageHint =
    params.language === 'am'
      ? 'Respond primarily in Amharic (with English product terms when helpful).'
      : params.language === 'om'
        ? 'Respond primarily in Afaan Oromo (with English product terms when helpful).'
        : 'Respond in clear English (feel free to include authentic local Hawassa/Ethiopian terms where natural).';

  const fullSystemInstruction = [
    params.systemInstruction?.trim() || DEFAULT_HAWASSA_SYSTEM_INSTRUCTION,
    languageHint,
  ].join('\n\n');

  const chat = ai.chats.create({
    model,
    history: formattedHistory,
    config: {
      systemInstruction: fullSystemInstruction,
      ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
    },
  });

  const response = await chat.sendMessage({ message: params.message });
  return {
    text: response.text ?? 'I could not generate a response right now. Please try again.',
    model,
  };
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
