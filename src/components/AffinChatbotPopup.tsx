import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Bot,
  Camera,
  CheckCircle2,
  Coffee,
  Edit3,
  ExternalLink,
  ImagePlus,
  Loader2,
  MessageCircle,
  PackagePlus,
  RefreshCw,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Store,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import {
  cancelListingDraft,
  confirmListingDraftCategory,
  fetchListingEligibility,
  ListingAssistantApiError,
  publishListingDraft,
  sendListingAssistantMessage,
  uploadListingDraftImages,
  type ListingDraftView,
  type ListingEligibilityResponse,
  type VerifiedShopOption,
} from '../services/listingAssistantClient';
import { CANONICAL_COFFEE_CATEGORY } from '../utils/coffeeCategorizer';
import { processUploadedPhotoFile } from '../utils/imageUpload';
import { formatETB } from '../utils/marketplaceLogic';
import type { Product } from '../types';

type ConciergeMode = 'balanced' | 'deep' | 'fast' | 'lite';
type AssistantSurfaceMode = 'general' | 'listing';

interface ChatMessageAction {
  type: 'verify_seller' | 'sign_in' | 'seller_portal';
  label: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  model?: string;
  content: string;
  action?: ChatMessageAction;
}

const LOCAL_CHAT_STORAGE_KEY = 'affin_chatbot_history_v1';

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-msg',
  role: 'model',
  model: 'gemini-4-hydrogen',
  content:
    'Selam! I am your **Affin Connect Assistant**. Ask me about Sidama coffee, Habesha textiles, local Hawassa shops, prices in ETB, delivery zones, or Telebirr & CBE checkout.',
};

const STARTER_PROMPTS = [
  'Best coffee & gift ideas under ETB 2,500',
  'Delivery vs pickup across Piazza and Tabor',
  'How do Telebirr & CBE payments work here?',
];

const LISTING_EXAMPLE_PROMPTS = [
  'I want to sell Sidama coffee, 500 grams, for 350 ETB.',
  'Post a Samsung phone for 18,000 birr.',
  "Help me list women's shoes in size 38.",
];

const PERSONA_PRESETS = [
  {
    id: 'shopper',
    label: 'Shopper Guide',
    instruction:
      'You are the Affin Connect shopping assistant helping Hawassa customers discover local products, compare ETB prices, and choose neighborhood delivery or pickup.',
  },
  {
    id: 'merchant',
    label: 'Merchant Coach',
    instruction:
      'You are an Ethiopian e-commerce advisor helping Hawassa shop owners write bilingual product descriptions, price in ETB, and fulfill orders smoothly.',
  },
  {
    id: 'logistics',
    label: 'Delivery & Pay',
    instruction:
      'You help Affin Connect users with Hawassa neighborhood fulfillment (Piazza, Menhariya, Gebeya Dar, Tabor, Datto, Arab Sefer) and Telebirr, CBE, Chapa, or Cash on Delivery payments.',
  },
];

const CATEGORY_DISPLAY_LABELS: Record<string, string> = {
  coffee: 'Coffee Traders',
  'food-drinks': 'Food & Drinks',
  groceries: 'Groceries',
  'clothing-fashion': 'Clothing & Fashion',
  electronics: 'Electronics',
  'beauty-health': 'Beauty & Health',
  'home-living': 'Home & Living',
  'books-stationery': 'Books & Stationery',
  'sports-outdoors': 'Sports & Outdoors',
  'hardware-tools': 'Hardware & Tools',
  'baby-kids': 'Baby & Kids',
  'gifts-crafts': 'Gifts & Crafts',
};

function formatCategoryLabel(category?: string): string {
  if (!category) return 'Detecting category...';
  return CATEGORY_DISPLAY_LABELS[category] ?? category;
}

function detectListingIntent(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return /\b(want to sell|i('m| am) selling|post a|post my|list a|list my|create a listing|publish a product|add a product|post product|sell my|help me list|help me sell|help me post)\b/i.test(
    normalized
  );
}

function renderFormattedLine(line: string, keyPrefix: string) {
  const segments = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="font-bold text-[#F5FAFA]">
          {seg.slice(2, -2)}
        </strong>
      );
    }
    if (seg.startsWith('*') && seg.endsWith('*') && seg.length > 2) {
      return (
        <em key={`${keyPrefix}-i-${i}`} className="italic text-[#DCEAE8]">
          {seg.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t-${i}`}>{seg}</React.Fragment>;
  });
}

function FormattedChatText({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={`sp-${idx}`} className="h-1" />;
        if (line === '---') {
          return <hr key={`hr-${idx}`} className="border-[#14443F] my-1.5" />;
        }
        if (/^#{1,3}\s+/.test(line)) {
          const cleanHeading = line.replace(/^#{1,3}\s+/, '');
          return (
            <div key={`h-${idx}`} className="font-bold text-[#00D68F] pt-1">
              {renderFormattedLine(cleanHeading, `h-${idx}`)}
            </div>
          );
        }
        if (/^[*-]\s+/.test(line)) {
          const cleanItem = line.replace(/^[*-]\s+/, '');
          return (
            <div key={`li-${idx}`} className="flex gap-1.5 pl-1">
              <span className="text-[#00D68F] font-bold shrink-0">•</span>
              <span className="flex-1">{renderFormattedLine(cleanItem, `li-${idx}`)}</span>
            </div>
          );
        }
        return <div key={`p-${idx}`}>{renderFormattedLine(line, `p-${idx}`)}</div>;
      })}
    </div>
  );
}

function readLocalMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(LOCAL_CHAT_STORAGE_KEY);
    if (!raw) return [WELCOME_MESSAGE];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      const sanitized = parsed.filter(
        (m) =>
          m &&
          (m.role === 'user' || m.role === 'model') &&
          typeof m.content === 'string' &&
          m.content.trim().length > 0
      );
      if (sanitized.length > 0) {
        return sanitized;
      }
    }
  } catch {
    // ignore corrupted local storage
  }
  return [WELCOME_MESSAGE];
}

export const AffinChatbotSurface: React.FC<{
  variant: 'popup' | 'page';
  onClose?: () => void;
}> = ({ variant, onClose }) => {
  const {
    goBack,
    navigate,
    openAuthScreen,
    refreshCatalogFromFirestore,
    firebaseUser,
    language,
    selectedNeighborhood,
    activeRoleView,
    cart,
    products,
    shops,
  } = useMarketplace();

  const [surfaceMode, setSurfaceMode] = useState<AssistantSurfaceMode>('general');
  const [mode, setMode] = useState<ConciergeMode>('lite');
  const [personaId, setPersonaId] = useState<string>('shopper');
  const [showOptions, setShowOptions] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<
    | { type: 'general'; text: string }
    | { type: 'listing'; text: string }
    | { type: 'publish' }
    | null
  >(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => readLocalMessages());

  // Server-authoritative seller listing assistant state
  const [eligibility, setEligibility] = useState<ListingEligibilityResponse | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [verifiedShops, setVerifiedShops] = useState<VerifiedShopOption[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string | undefined>(undefined);
  const [listingDraft, setListingDraft] = useState<ListingDraftView | null>(null);
  const [publishIdempotencyKey, setPublishIdempotencyKey] = useState<string>('');
  const [uploadingImages, setUploadingImages] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [confirmingCategory, setConfirmingCategory] = useState(false);
  const [publishedProduct, setPublishedProduct] = useState<Product | null>(null);
  const [editingHint, setEditingHint] = useState(false);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const contextSummary = useMemo(() => {
    const activeShops = shops
      .filter((s) => s.status === 'approved')
      .slice(0, 8)
      .map((s) => `${s.name} (${s.neighborhood})`)
      .join(', ');

    const featuredCatalog = products
      .filter((p) => p.status === 'active' && p.isAvailable)
      .slice(0, 10)
      .map((p) => `${p.name} - ${formatETB(p.price)} (${p.shopName})`)
      .join('; ');

    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    return [
      `Selected neighborhood: ${selectedNeighborhood}`,
      `User workspace role: ${activeRoleView}`,
      `Items currently in cart: ${cartCount}`,
      activeShops ? `Active local shops: ${activeShops}` : '',
      featuredCatalog ? `Sample active products: ${featuredCatalog}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }, [shops, products, cart, selectedNeighborhood, activeRoleView]);

  const loadCloudHistory = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/sql/chat', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const rawText = await res.text();
      if (!rawText) return;
      const data = JSON.parse(rawText) as {
        messages?: { id: number; role: 'user' | 'model'; model: string; content: string }[];
      };
      if (data.messages && data.messages.length > 0) {
        setMessages(
          data.messages.map((m) => ({
            id: `sql-${m.id}`,
            role: m.role,
            model: m.model,
            content: m.content,
          }))
        );
      }
    } catch {
      // Keep local messages if Cloud SQL history is not active
    }
  }, [firebaseUser]);

  const refreshEligibility = useCallback(async (): Promise<ListingEligibilityResponse | null> => {
    if (!firebaseUser) {
      setEligibility(null);
      setVerifiedShops([]);
      setListingDraft(null);
      setSurfaceMode('general');
      return null;
    }
    setEligibilityLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const data = await fetchListingEligibility(token);
      setEligibility(data);
      setVerifiedShops(data.verifiedShops ?? []);
      if (data.activeShop?.shopId) {
        setSelectedShopId((prev) => prev ?? data.activeShop?.shopId);
      }
      if (data.eligible && data.activeDraft) {
        setListingDraft(data.activeDraft);
        setPublishIdempotencyKey((prev) => prev || `pub-${data.activeDraft!.draftId}`);
      } else if (!data.eligible) {
        setListingDraft(null);
        setSurfaceMode('general');
      }
      return data;
    } catch {
      // Never assume eligibility on network error
      return null;
    } finally {
      setEligibilityLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    loadCloudHistory();
  }, [loadCloudHistory]);

  useEffect(() => {
    refreshEligibility();
  }, [refreshEligibility]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      // ignore storage quota errors
    }
  }, [messages]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, listingDraft, publishedProduct]);

  useEffect(() => {
    if (variant === 'popup') {
      const timer = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [variant]);

  const handleMessageAction = (action: ChatMessageAction) => {
    onClose?.();
    if (action.type === 'verify_seller') {
      navigate({ name: 'seller', tab: 'verification' });
    } else if (action.type === 'seller_portal') {
      navigate({ name: 'seller', tab: 'shop' });
    } else if (action.type === 'sign_in') {
      openAuthScreen();
    }
  };

  const pushRestrictedSellerNotice = (info?: {
    isSeller?: boolean;
    reason?: string;
    signedOut?: boolean;
  }) => {
    if (info?.signedOut) {
      setMessages((prev) => [
        ...prev,
        {
          id: `m-auth-${Date.now()}`,
          role: 'model',
          content:
            'Product listing via the assistant is exclusively available to **verified Affin Connect sellers**. Sign in with your verified seller account to post products.',
          action: { type: 'sign_in', label: 'Sign In to Seller Account' },
        },
      ]);
      return;
    }

    if (info?.isSeller) {
      setMessages((prev) => [
        ...prev,
        {
          id: `m-verify-${Date.now()}`,
          role: 'model',
          content:
            info.reason ||
            'Your merchant account must be **verified** before you can create or publish product listings through the chatbot. Complete seller verification in the Seller Portal and try again.',
          action: { type: 'verify_seller', label: 'Go to Seller Verification' },
        },
      ]);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `m-cust-${Date.now()}`,
        role: 'model',
        content:
          info?.reason ||
          'Product listing through the chatbot is exclusively available to **verified sellers**. You can still ask me anything about Hawassa shops, Ethiopian coffee, prices in ETB, delivery, or payments!',
        action: { type: 'seller_portal', label: 'Open Seller Portal' },
      },
    ]);
  };

  const startOrResumeListingSession = async (options?: {
    initialMessage?: string;
    startNew?: boolean;
    shopId?: string;
    skipUserBubble?: boolean;
  }) => {
    if (!firebaseUser) {
      pushRestrictedSellerNotice({ signedOut: true });
      return;
    }

    setError(null);
    setLastFailedAction(null);
    setPublishedProduct(null);
    setEditingHint(false);

    const trimmedMsg = options?.initialMessage?.trim() ?? '';
    if (trimmedMsg && !options?.skipUserBubble) {
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: 'user', content: trimmedMsg.slice(0, 1500) },
      ]);
    }

    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const historyForApi = messages
        .filter((m) => m.id !== 'welcome-msg')
        .slice(-8)
        .map((m) => ({
          role: m.role,
          content: m.content.slice(0, 1500),
        }));

      const res = await sendListingAssistantMessage(token, {
        message: trimmedMsg || undefined,
        draftId: options?.startNew ? undefined : listingDraft?.draftId,
        shopId: options?.shopId ?? selectedShopId,
        startNew: options?.startNew,
        history: historyForApi,
        language: language.slice(0, 16),
      });

      setSurfaceMode('listing');
      setListingDraft(res.draft);
      setPublishIdempotencyKey(`pub-${res.draft.draftId}`);
      if (res.verifiedShops) {
        setVerifiedShops(res.verifiedShops);
      }
      if (res.draft.shopId) {
        setSelectedShopId(res.draft.shopId);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m-list-${Date.now()}`,
          role: 'model',
          model: res.model,
          content: res.reply,
        },
      ]);

      if (res.draft.status === 'canceled') {
        setListingDraft(null);
        setSurfaceMode('general');
      }
    } catch (err) {
      if (err instanceof ListingAssistantApiError && err.status === 403) {
        setSurfaceMode('general');
        setListingDraft(null);
        pushRestrictedSellerNotice({
          isSeller: err.isSeller ?? eligibility?.isSeller,
          reason: err.message,
        });
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not update your product draft. Please try again.'
        );
        if (trimmedMsg) {
          setLastFailedAction({ type: 'listing', text: trimmedMsg });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (overrideText?: string, isRetry = false) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading || publishing) return;

    if (!isRetry) {
      setInput('');
    }
    setError(null);
    setLastFailedAction(null);
    setEditingHint(false);

    // If currently in Listing Assistant mode, route through the backend listing assistant
    if (surfaceMode === 'listing') {
      await startOrResumeListingSession({
        initialMessage: text,
        skipUserBubble: isRetry,
      });
      return;
    }

    // Detect natural language product-listing intent even while in General Chat
    if (detectListingIntent(text)) {
      if (!isRetry) {
        setMessages((prev) => [
          ...prev,
          { id: `u-${Date.now()}`, role: 'user', content: text.slice(0, 1500) },
        ]);
      }

      if (!firebaseUser) {
        pushRestrictedSellerNotice({ signedOut: true });
        return;
      }

      const latestEligibility = eligibility ?? (await refreshEligibility());
      if (latestEligibility && !latestEligibility.eligible) {
        pushRestrictedSellerNotice({
          isSeller: latestEligibility.isSeller,
          reason: latestEligibility.reason,
        });
        return;
      }

      // Always let the backend verify seller status and process the listing message
      await startOrResumeListingSession({
        initialMessage: text,
        skipUserBubble: true,
      });
      return;
    }

    // Standard Affin Connect Assistant chat flow (preserved 100%)
    const historyForApi = messages
      .filter(
        (m) =>
          m.id !== 'welcome-msg' &&
          (m.role === 'user' || m.role === 'model') &&
          typeof m.content === 'string' &&
          m.content.trim().length > 0
      )
      .slice(-20)
      .map((m) => ({
        role: m.role,
        content: m.content.trim().slice(0, 4000),
      }));

    if (!isRetry) {
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: text.slice(0, 2000),
      };
      setMessages((prev) => [...prev, userMsg]);
    }

    setLoading(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
        } catch {
          // Optional auth header for Cloud SQL history; never block general chat
        }
      }

      const activePersona = PERSONA_PRESETS.find((p) => p.id === personaId);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text.slice(0, 2000),
          history: historyForApi,
          mode,
          systemInstruction: activePersona?.instruction?.slice(0, 1500),
          language: language.slice(0, 16),
          contextSummary: contextSummary.slice(0, 2500),
        }),
      });

      const rawText = await res.text();
      let data: { text?: string; model?: string; error?: string } = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText) as { text?: string; model?: string; error?: string };
        } catch {
          data = {
            error: res.ok ? 'Invalid response format from server.' : rawText.slice(0, 180),
          };
        }
      }

      if (!res.ok || !data.text) {
        throw new Error(data.error || 'Could not reach the Affin Connect Assistant.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          model: data.model,
          content: data.text!,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message. Please try again.');
      setLastFailedAction({ type: 'general', text });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0 || !firebaseUser || !listingDraft) return;

    const existingImages = [
      ...(listingDraft.imageUrl ? [listingDraft.imageUrl] : []),
      ...(listingDraft.additionalImages ?? []),
    ];
    const remainingSlots = Math.max(0, 4 - existingImages.length);
    if (remainingSlots === 0) {
      setError('Maximum 4 photos per product listing. Remove a photo to add another.');
      return;
    }

    setUploadingImages(true);
    setError(null);
    try {
      const compressed: string[] = [];
      for (const file of files.slice(0, remainingSlots)) {
        const dataUrl = await processUploadedPhotoFile(file);
        compressed.push(dataUrl);
      }

      const nextImages = [...existingImages, ...compressed].slice(0, 4);
      const token = await firebaseUser.getIdToken();
      const res = await uploadListingDraftImages(token, listingDraft.draftId, nextImages);
      setListingDraft(res.draft);
      setMessages((prev) => [
        ...prev,
        {
          id: `m-img-${Date.now()}`,
          role: 'model',
          content: res.reply,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not upload photo. Use a JPG, PNG, or WebP image.'
      );
    } finally {
      setUploadingImages(false);
    }
  };

  const handleRemoveDraftImage = async (indexToRemove: number) => {
    if (!firebaseUser || !listingDraft || uploadingImages) return;
    const allImages = [
      ...(listingDraft.imageUrl ? [listingDraft.imageUrl] : []),
      ...(listingDraft.additionalImages ?? []),
    ];
    const remaining = allImages.filter((_, idx) => idx !== indexToRemove);
    if (remaining.length === 0) {
      setListingDraft({
        ...listingDraft,
        imageUrl: undefined,
        additionalImages: undefined,
        status: 'collecting',
        missingFields: listingDraft.missingFields.includes('image')
          ? listingDraft.missingFields
          : [...listingDraft.missingFields, 'image'],
      });
      return;
    }

    setUploadingImages(true);
    setError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await uploadListingDraftImages(token, listingDraft.draftId, remaining);
      setListingDraft(res.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update draft photos.');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleConfirmCategory = async (confirmedCategory: string) => {
    if (!firebaseUser || !listingDraft || confirmingCategory) return;
    setConfirmingCategory(true);
    setError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await confirmListingDraftCategory(
        token,
        listingDraft.draftId,
        confirmedCategory
      );
      setListingDraft(res.draft);
      setMessages((prev) => [
        ...prev,
        {
          id: `m-cat-${Date.now()}`,
          role: 'model',
          content: res.reply,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to confirm product category.');
    } finally {
      setConfirmingCategory(false);
    }
  };

  const handlePublishDraft = async () => {
    if (!firebaseUser || !listingDraft || publishing) return;
    setPublishing(true);
    setError(null);
    setLastFailedAction(null);

    const stableKey = publishIdempotencyKey || `pub-${listingDraft.draftId}`;
    if (!publishIdempotencyKey) {
      setPublishIdempotencyKey(stableKey);
    }

    try {
      const token = await firebaseUser.getIdToken();
      const res = await publishListingDraft(token, listingDraft.draftId, stableKey);
      setListingDraft(null);
      setPublishedProduct(res.product);
      setSurfaceMode('general');

      const destLabel =
        res.product.category === CANONICAL_COFFEE_CATEGORY
          ? '**Coffee Traders**'
          : `**${formatCategoryLabel(res.product.category)}**`;

      setMessages((prev) => [
        ...prev,
        {
          id: `m-pub-${Date.now()}`,
          role: 'model',
          content: `Published **${res.product.name}** (${formatETB(res.product.price)}) to ${destLabel} under **${res.product.shopName}**. Buyers can now discover and purchase it immediately!`,
        },
      ]);

      // Refresh live catalog so Home, Search, Coffee Traders, and Seller Products update immediately
      refreshCatalogFromFirestore().catch(() => {
        // Non-blocking catalog refresh
      });
    } catch (err) {
      if (err instanceof ListingAssistantApiError && err.status === 403) {
        setListingDraft(null);
        setSurfaceMode('general');
        pushRestrictedSellerNotice({
          isSeller: err.isSeller ?? eligibility?.isSeller,
          reason: err.message,
        });
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to publish product right now. Tap Retry to safely resubmit without duplicates.'
        );
        setLastFailedAction({ type: 'publish' });
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleCancelDraft = async () => {
    if (!firebaseUser || !listingDraft || canceling) return;
    setCanceling(true);
    setError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await cancelListingDraft(token, listingDraft.draftId);
      setListingDraft(null);
      setSurfaceMode('general');
      setPublishedProduct(null);
      setMessages((prev) => [
        ...prev,
        {
          id: `m-cancel-${Date.now()}`,
          role: 'model',
          content: res.reply,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel draft.');
    } finally {
      setCanceling(false);
    }
  };

  const handleEditDetailsClick = () => {
    setEditingHint(true);
    inputRef.current?.focus();
  };

  const handleShopSwitch = async (nextShopId: string) => {
    setSelectedShopId(nextShopId);
    if (listingDraft && surfaceMode === 'listing') {
      await startOrResumeListingSession({ shopId: nextShopId });
    }
  };

  const handleClearChat = async () => {
    if (firebaseUser) {
      try {
        const token = await firebaseUser.getIdToken();
        await fetch('/api/sql/chat', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Ignore network error on clear
      }
    }
    setError(null);
    setLastFailedAction(null);
    setPublishedProduct(null);
    setSurfaceMode('general');
    setMessages([
      {
        id: 'welcome-msg',
        role: 'model',
        model: 'gemini-4-hydrogen',
        content: 'Conversation cleared. How can I help you on **Affin Connect** today?',
      },
    ]);
  };

  const draftImages = useMemo(() => {
    if (!listingDraft) return [];
    return [
      ...(listingDraft.imageUrl ? [listingDraft.imageUrl] : []),
      ...(listingDraft.additionalImages ?? []),
    ];
  }, [listingDraft]);

  const isCoffeeDraft = listingDraft?.category === CANONICAL_COFFEE_CATEGORY;
  const isVerifiedSeller = Boolean(eligibility?.eligible);

  return (
    <div className="flex flex-col h-full bg-[#031719] text-[#F5FAFA]">
      {/* Header */}
      <header className="bg-[#092825] border-b border-[#14443F] px-3.5 py-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {variant === 'page' && (
              <button
                type="button"
                onClick={goBack}
                aria-label="Go back"
                className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#A9C0BD] hover:text-[#F5FAFA] hover:bg-[#102F2B] transition-colors shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${
                surfaceMode === 'listing'
                  ? isCoffeeDraft
                    ? 'bg-gradient-to-br from-[#C68B59] to-[#4B2E24] text-[#F8F4EE]'
                    : 'bg-gradient-to-br from-[#00D68F] to-[#00C8D7] text-[#031719]'
                  : 'bg-gradient-to-br from-[#00D68F] to-[#00C8D7] text-[#031719]'
              }`}
            >
              {surfaceMode === 'listing' ? (
                isCoffeeDraft ? (
                  <Coffee className="w-5 h-5 stroke-[2.2]" />
                ) : (
                  <PackagePlus className="w-5 h-5 stroke-[2.2]" />
                )
              ) : (
                <Bot className="w-5 h-5 stroke-[2.2]" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-display font-bold text-[#F5FAFA] truncate leading-tight">
                {surfaceMode === 'listing' ? 'Product Listing Assistant' : 'Affin Connect Assistant'}
              </h2>
              <p className="text-[11px] text-[#A9C0BD] truncate">
                {surfaceMode === 'listing'
                  ? `Verified Seller · ${listingDraft?.shopName ?? 'Creating Draft'}`
                  : 'Hawassa Shopping · Delivery · Pay'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isVerifiedSeller && (
              <button
                type="button"
                onClick={() => {
                  if (surfaceMode === 'listing') {
                    setSurfaceMode('general');
                  } else if (listingDraft) {
                    setSurfaceMode('listing');
                  } else {
                    startOrResumeListingSession();
                  }
                }}
                aria-label={
                  surfaceMode === 'listing'
                    ? 'Switch to general chat'
                    : 'Start product listing assistant'
                }
                className={`px-2.5 min-h-[36px] rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors ${
                  surfaceMode === 'listing'
                    ? 'bg-[#102F2B] border border-[#00D68F]/40 text-[#00D68F]'
                    : 'bg-[#00D68F]/15 border border-[#00D68F]/40 text-[#00D68F] hover:bg-[#00D68F]/25'
                }`}
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>{surfaceMode === 'listing' ? 'Chat' : listingDraft ? 'Draft' : 'List'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowOptions((prev) => !prev)}
              aria-label="Toggle assistant options"
              aria-expanded={showOptions}
              className={`min-w-[38px] min-h-[38px] rounded-xl flex items-center justify-center transition-colors ${
                showOptions
                  ? 'bg-[#00D68F]/15 text-[#00D68F]'
                  : 'text-[#A9C0BD] hover:text-[#F5FAFA] hover:bg-[#102F2B]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleClearChat}
              aria-label="Clear conversation"
              className="min-w-[38px] min-h-[38px] rounded-xl flex items-center justify-center text-[#A9C0BD] hover:text-[#FF6577] hover:bg-[#102F2B] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {variant === 'popup' && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close chatbot"
                className="min-w-[38px] min-h-[38px] rounded-xl flex items-center justify-center text-[#A9C0BD] hover:text-[#F5FAFA] hover:bg-[#102F2B] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Persona & Speed Controls */}
        {showOptions && (
          <div className="grid grid-cols-2 gap-2 pt-2.5 mt-2 border-t border-[#14443F]/80">
            <select
              aria-label="Assistant Persona"
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
              className="px-2.5 py-2 rounded-xl border border-[#14443F] bg-[#031719] text-[11px] font-semibold text-[#F5FAFA] focus:outline-none focus:border-[#00D68F]"
            >
              {PERSONA_PRESETS.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#092825] text-[#F5FAFA]">
                  {p.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Assistant Response Mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as ConciergeMode)}
              className="px-2.5 py-2 rounded-xl border border-[#14443F] bg-[#031719] text-[11px] font-semibold text-[#F5FAFA] focus:outline-none focus:border-[#00D68F]"
            >
              <option value="fast" className="bg-[#092825] text-[#F5FAFA]">
                Fast (Quick Reply)
              </option>
              <option value="balanced" className="bg-[#092825] text-[#F5FAFA]">
                Balanced
              </option>
              <option value="deep" className="bg-[#092825] text-[#F5FAFA]">
                Deep Advice
              </option>
              <option value="lite" className="bg-[#092825] text-[#F5FAFA]">
                Instant Lite
              </option>
            </select>
          </div>
        )}

        {/* Active Listing Progress Strip */}
        {surfaceMode === 'listing' && listingDraft && (
          <div className="mt-2.5 pt-2 border-t border-[#14443F]/80 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <BadgeCheck className="w-3.5 h-3.5 text-[#00D68F] shrink-0" />
                {verifiedShops.length > 1 ? (
                  <select
                    aria-label="Select verified shop"
                    value={listingDraft.shopId}
                    onChange={(e) => handleShopSwitch(e.target.value)}
                    className="bg-[#031719] border border-[#14443F] rounded-lg px-2 py-0.5 text-[11px] font-semibold text-[#F5FAFA] focus:outline-none focus:border-[#00D68F]"
                  >
                    {verifiedShops.map((shop) => (
                      <option key={shop.shopId} value={shop.shopId} className="bg-[#092825]">
                        {shop.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-semibold text-[#F5FAFA] truncate">
                    {listingDraft.shopName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {listingDraft.category && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                      isCoffeeDraft
                        ? 'bg-[#4B2E24] text-[#F8F4EE] border border-[#C68B59]/60'
                        : 'bg-[#102F2B] text-[#00D68F] border border-[#00D68F]/30'
                    }`}
                  >
                    {isCoffeeDraft && <Coffee className="w-3 h-3 text-[#C68B59]" />}
                    {formatCategoryLabel(listingDraft.category)}
                  </span>
                )}
                <span className="text-[10px] font-bold text-[#A9C0BD]">
                  {listingDraft.completionPercent}%
                </span>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#031719] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  listingDraft.completionPercent >= 100
                    ? 'w-full'
                    : listingDraft.completionPercent >= 80
                      ? 'w-5/6'
                      : listingDraft.completionPercent >= 65
                        ? 'w-2/3'
                        : listingDraft.completionPercent >= 50
                          ? 'w-1/2'
                          : listingDraft.completionPercent >= 30
                            ? 'w-1/3'
                            : listingDraft.completionPercent >= 15
                              ? 'w-1/6'
                              : 'w-[10%]'
                } ${
                  isCoffeeDraft
                    ? 'bg-gradient-to-r from-[#C68B59] to-[#E6B98A]'
                    : 'bg-gradient-to-r from-[#00D68F] to-[#00C8D7]'
                }`}
              />
            </div>
          </div>
        )}
      </header>

      {/* Scrollable Multi-Turn Conversation Thread */}
      <div className="flex-1 overflow-y-auto mobile-scroll p-3.5 space-y-3 bg-[#031719]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'model' && (
              <div className="w-7 h-7 rounded-xl bg-[#092825] border border-[#14443F] text-[#00D68F] flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div
              className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-gradient-to-r from-[#00D68F] to-[#00C8D7] text-[#031719] font-medium rounded-br-sm whitespace-pre-line shadow-sm'
                  : 'bg-[#092825] border border-[#14443F] text-[#DCEAE8] rounded-bl-sm'
              }`}
            >
              {m.role === 'model' ? <FormattedChatText content={m.content} /> : m.content}
              {m.action && (
                <button
                  type="button"
                  onClick={() => handleMessageAction(m.action!)}
                  className="mt-2.5 w-full min-h-[38px] px-3 py-2 rounded-xl bg-[#00D68F]/15 hover:bg-[#00D68F]/25 border border-[#00D68F]/45 text-[#00D68F] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{m.action.label}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-7 h-7 rounded-xl bg-[#102F2B] border border-[#14443F] text-[#A9C0BD] flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {/* Ambiguous Category Confirmation Card */}
        {surfaceMode === 'listing' &&
          listingDraft &&
          listingDraft.missingFields.includes('categoryConfirmation') && (
            <div className="rounded-2xl bg-[#092825] border border-[#C68B59]/50 p-3 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F8F4EE]">
                <Coffee className="w-4 h-4 text-[#C68B59]" />
                <span>Confirm Product Category</span>
              </div>
              <p className="text-[11px] text-[#A9C0BD] leading-relaxed">
                Should <strong className="text-[#F5FAFA]">{listingDraft.name}</strong> be listed in{' '}
                <strong className="text-[#C68B59]">Coffee Traders</strong> or kept in the general
                marketplace?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={confirmingCategory}
                  onClick={() => handleConfirmCategory(CANONICAL_COFFEE_CATEGORY)}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-[#4B2E24] hover:bg-[#5D3A2E] border border-[#C68B59]/70 text-[#F8F4EE] text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  <Coffee className="w-3.5 h-3.5 text-[#C68B59]" />
                  <span>Coffee Traders</span>
                </button>
                <button
                  type="button"
                  disabled={confirmingCategory}
                  onClick={() =>
                    handleConfirmCategory(
                      listingDraft.categorization?.resolvedCategory &&
                        listingDraft.categorization.resolvedCategory !== CANONICAL_COFFEE_CATEGORY
                        ? listingDraft.categorization.resolvedCategory
                        : 'home-living'
                    )
                  }
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-[#102F2B] hover:bg-[#14443F] border border-[#14443F] text-[#F5FAFA] text-xs font-bold disabled:opacity-50 transition-colors"
                >
                  Keep Non-Coffee
                </button>
              </div>
            </div>
          )}

        {/* Explicit Seller Preview & Publish Confirmation Card */}
        {surfaceMode === 'listing' &&
          listingDraft &&
          listingDraft.status === 'ready_for_confirmation' && (
            <div
              className={`rounded-2xl overflow-hidden border shadow-lg ${
                isCoffeeDraft
                  ? 'bg-[#092825] border-[#C68B59]/60'
                  : 'bg-[#092825] border-[#00D68F]/50'
              }`}
            >
              <div
                className={`px-3.5 py-2 flex items-center justify-between gap-2 ${
                  isCoffeeDraft
                    ? 'bg-gradient-to-r from-[#4B2E24] to-[#6A4333] text-[#F8F4EE]'
                    : 'bg-[#102F2B] text-[#F5FAFA] border-b border-[#14443F]'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  {isCoffeeDraft ? (
                    <Coffee className="w-4 h-4 text-[#C68B59]" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-[#00D68F]" />
                  )}
                  <span>Product Listing Preview</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    isCoffeeDraft
                      ? 'bg-[#031719]/45 text-[#F8F4EE]'
                      : 'bg-[#00D68F]/15 text-[#00D68F]'
                  }`}
                >
                  {formatCategoryLabel(listingDraft.category)}
                </span>
              </div>

              <div className="p-3.5 space-y-3">
                <div className="flex gap-3">
                  {listingDraft.imageUrl && (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#14443F] shrink-0 bg-[#031719]">
                      <img
                        src={listingDraft.imageUrl}
                        alt={listingDraft.name || 'Product preview'}
                        className="w-full h-full object-cover"
                      />
                      {(listingDraft.additionalImages?.length ?? 0) > 0 && (
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/75 text-[10px] font-bold text-[#F5FAFA]">
                          +{listingDraft.additionalImages!.length}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="text-sm font-display font-bold text-[#F5FAFA] leading-snug line-clamp-2">
                      {listingDraft.name}
                    </h3>
                    <div className="flex items-center gap-1 text-[11px] text-[#A9C0BD]">
                      <Store className="w-3 h-3 text-[#00D68F] shrink-0" />
                      <span className="truncate">{listingDraft.shopName}</span>
                      <BadgeCheck className="w-3.5 h-3.5 text-[#00D68F] shrink-0" />
                    </div>
                    <div className="flex items-baseline gap-2 pt-0.5">
                      <span className="text-base font-display font-bold text-[#00D68F]">
                        {formatETB(listingDraft.price ?? 0)}
                      </span>
                      <span className="text-[11px] text-[#A9C0BD]">
                        · Stock: <strong className="text-[#F5FAFA]">{listingDraft.stock}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {listingDraft.description && (
                  <p className="text-xs text-[#DCEAE8] leading-relaxed bg-[#031719]/65 rounded-xl p-2.5 border border-[#14443F]/70">
                    {listingDraft.description}
                  </p>
                )}

                {/* Coffee-specific metadata */}
                {isCoffeeDraft && listingDraft.coffeeDetails && (
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {listingDraft.coffeeDetails.origin && (
                      <div className="px-2.5 py-1.5 rounded-lg bg-[#4B2E24]/35 border border-[#C68B59]/35">
                        <span className="text-[#C68B59] block text-[10px]">Origin</span>
                        <span className="font-semibold text-[#F8F4EE]">
                          {listingDraft.coffeeDetails.origin}
                        </span>
                      </div>
                    )}
                    {listingDraft.coffeeDetails.packageWeight && (
                      <div className="px-2.5 py-1.5 rounded-lg bg-[#4B2E24]/35 border border-[#C68B59]/35">
                        <span className="text-[#C68B59] block text-[10px]">Weight</span>
                        <span className="font-semibold text-[#F8F4EE]">
                          {listingDraft.coffeeDetails.packageWeight}
                        </span>
                      </div>
                    )}
                    {listingDraft.coffeeDetails.roastLevel && (
                      <div className="px-2.5 py-1.5 rounded-lg bg-[#4B2E24]/35 border border-[#C68B59]/35">
                        <span className="text-[#C68B59] block text-[10px]">Roast</span>
                        <span className="font-semibold text-[#F8F4EE] capitalize">
                          {listingDraft.coffeeDetails.roastLevel.replace('_', ' ')}
                        </span>
                      </div>
                    )}
                    {listingDraft.coffeeDetails.beanForm && (
                      <div className="px-2.5 py-1.5 rounded-lg bg-[#4B2E24]/35 border border-[#C68B59]/35">
                        <span className="text-[#C68B59] block text-[10px]">Form</span>
                        <span className="font-semibold text-[#F8F4EE]">
                          {listingDraft.coffeeDetails.beanForm === 'ground'
                            ? 'Ground Coffee'
                            : 'Whole Beans'}
                        </span>
                      </div>
                    )}
                    {listingDraft.coffeeDetails.processingMethod && (
                      <div className="px-2.5 py-1.5 rounded-lg bg-[#4B2E24]/35 border border-[#C68B59]/35">
                        <span className="text-[#C68B59] block text-[10px]">Process</span>
                        <span className="font-semibold text-[#F8F4EE] capitalize">
                          {listingDraft.coffeeDetails.processingMethod}
                        </span>
                      </div>
                    )}
                    {listingDraft.coffeeDetails.roastDate && (
                      <div className="px-2.5 py-1.5 rounded-lg bg-[#4B2E24]/35 border border-[#C68B59]/35">
                        <span className="text-[#C68B59] block text-[10px]">Roast Date</span>
                        <span className="font-semibold text-[#F8F4EE]">
                          {listingDraft.coffeeDetails.roastDate}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Non-coffee specifications */}
                {!isCoffeeDraft && listingDraft.specs && (
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {listingDraft.specs.brand && (
                      <span className="px-2 py-1 rounded-lg bg-[#102F2B] border border-[#14443F] text-[#DCEAE8]">
                        Brand: <strong className="text-[#F5FAFA]">{listingDraft.specs.brand}</strong>
                      </span>
                    )}
                    {listingDraft.specs.condition && (
                      <span className="px-2 py-1 rounded-lg bg-[#102F2B] border border-[#14443F] text-[#DCEAE8]">
                        Condition:{' '}
                        <strong className="text-[#F5FAFA]">{listingDraft.specs.condition}</strong>
                      </span>
                    )}
                    {listingDraft.specs.size && (
                      <span className="px-2 py-1 rounded-lg bg-[#102F2B] border border-[#14443F] text-[#DCEAE8]">
                        Size: <strong className="text-[#F5FAFA]">{listingDraft.specs.size}</strong>
                      </span>
                    )}
                    {listingDraft.specs.color && (
                      <span className="px-2 py-1 rounded-lg bg-[#102F2B] border border-[#14443F] text-[#DCEAE8]">
                        Color: <strong className="text-[#F5FAFA]">{listingDraft.specs.color}</strong>
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 text-[11px] text-[#A9C0BD]">
                  {listingDraft.deliveryAvailable && (
                    <span className="px-2 py-0.5 rounded-md bg-[#102F2B] text-[#00C8D7]">
                      Delivery Available
                    </span>
                  )}
                  {listingDraft.pickupAvailable && (
                    <span className="px-2 py-0.5 rounded-md bg-[#102F2B] text-[#00D68F]">
                      In-Shop Pickup
                    </span>
                  )}
                </div>

                {/* Explicit Seller Confirmation Actions */}
                <div className="pt-1 space-y-2">
                  <button
                    type="button"
                    disabled={publishing || canceling}
                    onClick={handlePublishDraft}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00D68F] to-[#00C8D7] hover:brightness-105 text-[#031719] text-xs font-extrabold flex items-center justify-center gap-2 disabled:opacity-55 transition-all active:scale-[0.99] shadow-md shadow-[#00D68F]/20"
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Publishing to Affin Connect...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 stroke-[2.3]" />
                        <span>Publish Product</span>
                      </>
                    )}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={publishing || canceling}
                      onClick={handleEditDetailsClick}
                      className="min-h-[38px] px-3 py-2 rounded-xl bg-[#102F2B] hover:bg-[#14443F] border border-[#14443F] text-[#F5FAFA] text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#00C8D7]" />
                      <span>Edit Details</span>
                    </button>
                    <button
                      type="button"
                      disabled={publishing || canceling}
                      onClick={handleCancelDraft}
                      className="min-h-[38px] px-3 py-2 rounded-xl bg-[#2A1216]/70 hover:bg-[#2A1216] border border-[#FF6577]/35 text-[#FFD1D6] text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                    >
                      {canceling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-[#FF6577]" />
                      )}
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Published Product Confirmation Card */}
        {publishedProduct && (
          <div className="rounded-2xl bg-[#092825] border border-[#22C98B]/50 p-3.5 space-y-2.5 shadow-md">
            <div className="flex items-center gap-2 text-xs font-bold text-[#22C98B]">
              <CheckCircle2 className="w-4 h-4" />
              <span>Product Published Live</span>
            </div>
            <div className="flex items-center gap-2.5">
              <img
                src={publishedProduct.imageUrl}
                alt={publishedProduct.name}
                className="w-12 h-12 rounded-xl object-cover border border-[#14443F] shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#F5FAFA] truncate">
                  {publishedProduct.name}
                </div>
                <div className="text-[11px] text-[#A9C0BD]">
                  {formatETB(publishedProduct.price)} ·{' '}
                  {formatCategoryLabel(publishedProduct.category)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  navigate({ name: 'product', productId: publishedProduct.productId });
                }}
                className="min-h-[38px] px-3 py-2 rounded-xl bg-[#00D68F]/15 hover:bg-[#00D68F]/25 border border-[#00D68F]/45 text-[#00D68F] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Listing</span>
              </button>
              <button
                type="button"
                onClick={() => startOrResumeListingSession({ startNew: true })}
                className="min-h-[38px] px-3 py-2 rounded-xl bg-[#102F2B] hover:bg-[#14443F] border border-[#14443F] text-[#F5FAFA] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <PackagePlus className="w-3.5 h-3.5 text-[#00C8D7]" />
                <span>Post Another</span>
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#A9C0BD]">
            <div className="w-7 h-7 rounded-xl bg-[#092825] border border-[#14443F] text-[#00D68F] flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <span>
              {surfaceMode === 'listing' ? 'Updating product draft...' : 'Replying...'}
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3 rounded-2xl bg-[#2A1216] border border-[#FF6577]/40 text-xs text-[#FFD1D6] flex items-start justify-between gap-2.5"
          >
            <div className="flex items-start gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-[#FF6577] shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
            {lastFailedAction && (
              <button
                type="button"
                onClick={() => {
                  if (lastFailedAction.type === 'publish') {
                    handlePublishDraft();
                  } else {
                    sendMessage(lastFailedAction.text, true);
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#FF6577]/20 hover:bg-[#FF6577]/30 border border-[#FF6577]/40 text-[#FFE4E8] font-semibold flex items-center gap-1 shrink-0 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        {/* Quick Prompts + Verified Seller Entry Point */}
        {surfaceMode === 'general' && messages.length <= 2 && !loading && (
          <div className="pt-1 space-y-2">
            {isVerifiedSeller && (
              <button
                type="button"
                onClick={() => startOrResumeListingSession()}
                className="w-full text-left px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-[#092825] to-[#102F2B] border border-[#00D68F]/45 hover:border-[#00D68F] transition-colors flex items-center justify-between gap-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#00D68F]/15 text-[#00D68F] flex items-center justify-center shrink-0">
                    <PackagePlus className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#F5FAFA]">
                      {listingDraft ? 'Resume Product Listing Draft' : 'Post a Product with AI'}
                    </div>
                    <div className="text-[11px] text-[#A9C0BD] truncate">
                      Verified Seller · Coffee Traders & Marketplace
                    </div>
                  </div>
                </div>
                <BadgeCheck className="w-4 h-4 text-[#00D68F] shrink-0" />
              </button>
            )}

            {!isVerifiedSeller && !eligibilityLoading && eligibility?.isSeller && (
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  navigate({ name: 'seller', tab: 'verification' });
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-2xl bg-[#092825] border border-[#FFB547]/40 hover:border-[#FFB547]/70 transition-colors flex items-center justify-between gap-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#FFB547]/15 text-[#FFB547] flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#F5FAFA]">
                      Verify Seller Account to Post via Chat
                    </div>
                    <div className="text-[11px] text-[#A9C0BD] truncate">
                      Status: {eligibility.verificationStatus.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[#FFB547] shrink-0" />
              </button>
            )}

            <div className="text-[11px] font-semibold text-[#A9C0BD]">Quick prompts</div>
            <div className="flex flex-col gap-1.5">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="text-left min-h-[40px] px-3 py-2 rounded-xl bg-[#092825] border border-[#14443F] text-xs text-[#F5FAFA] hover:bg-[#102F2B] hover:border-[#00D68F]/50 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Listing Example Prompts when draft just started */}
        {surfaceMode === 'listing' &&
          listingDraft &&
          listingDraft.completionPercent === 0 &&
          !loading && (
            <div className="pt-1 space-y-1.5">
              <div className="text-[11px] font-semibold text-[#A9C0BD]">Try describing a product</div>
              <div className="flex flex-col gap-1.5">
                {LISTING_EXAMPLE_PROMPTS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => sendMessage(example)}
                    className="text-left min-h-[38px] px-3 py-2 rounded-xl bg-[#092825] border border-[#14443F] text-xs text-[#F5FAFA] hover:bg-[#102F2B] hover:border-[#00D68F]/50 transition-colors"
                  >
                    “{example}”
                  </button>
                ))}
              </div>
            </div>
          )}

        <div ref={scrollEndRef} />
      </div>

      {/* Inline Photo Tray when in Listing Mode */}
      {surfaceMode === 'listing' && listingDraft && (
        <div className="px-3 py-2 bg-[#092825] border-t border-[#14443F]/80 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            multiple
            onChange={handlePhotoFilesSelected}
            className="hidden"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-x-auto py-0.5">
              {draftImages.map((src, idx) => (
                <div
                  key={`draft-img-${idx}`}
                  className="relative w-11 h-11 rounded-xl overflow-hidden border border-[#14443F] shrink-0"
                >
                  <img src={src} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveDraftImage(idx)}
                    aria-label={`Remove photo ${idx + 1}`}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/75 text-[#F5FAFA] flex items-center justify-center hover:bg-[#FF6577]"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
              {draftImages.length < 4 && (
                <button
                  type="button"
                  disabled={uploadingImages}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-11 px-3 rounded-xl bg-[#102F2B] hover:bg-[#14443F] border border-dashed border-[#00D68F]/45 text-[11px] font-semibold text-[#00D68F] flex items-center gap-1.5 shrink-0 disabled:opacity-50 transition-colors"
                >
                  {uploadingImages ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {draftImages.length === 0
                      ? 'Add Product Photo'
                      : `Add Photo (${draftImages.length}/4)`}
                  </span>
                </button>
              )}
            </div>

            {listingDraft.status === 'collecting' && (
              <button
                type="button"
                disabled={canceling}
                onClick={handleCancelDraft}
                className="text-[11px] font-semibold text-[#A9C0BD] hover:text-[#FF6577] shrink-0 px-1.5 py-1 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="p-2.5 bg-[#092825] border-t border-[#14443F] flex items-center gap-2 shrink-0"
      >
        {surfaceMode === 'listing' && listingDraft && (
          <button
            type="button"
            disabled={uploadingImages || draftImages.length >= 4}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload product photo"
            title="Upload product photo"
            className="min-w-[42px] min-h-[42px] rounded-2xl bg-[#102F2B] hover:bg-[#14443F] border border-[#14443F] text-[#00D68F] flex items-center justify-center disabled:opacity-45 shrink-0 transition-colors"
          >
            {uploadingImages ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            surfaceMode === 'listing'
              ? editingHint
                ? 'Tell me what to change (e.g., Change price to 420 ETB)...'
                : 'Describe your product, price in ETB, stock...'
              : 'Ask about Hawassa shops, prices, delivery...'
          }
          aria-label="Message Affin Connect Assistant"
          className="flex-1 min-h-[44px] px-3.5 rounded-2xl bg-[#031719] border border-[#14443F] text-xs text-[#F5FAFA] placeholder:text-[#A9C0BD]/70 focus:outline-none focus:border-[#00D68F]"
        />
        <button
          type="submit"
          disabled={loading || publishing || !input.trim()}
          aria-label="Send message"
          className="min-w-[44px] min-h-[44px] rounded-2xl bg-gradient-to-br from-[#00D68F] to-[#00C8D7] hover:brightness-105 text-[#031719] flex items-center justify-center disabled:opacity-45 shrink-0 transition-all active:scale-95 shadow-sm shadow-[#00D68F]/20"
        >
          <Send className="w-4 h-4 stroke-[2.2]" />
        </button>
      </form>
    </div>
  );
};

export const AffinChatbotFloatingButton: React.FC = () => {
  const { route, cartToast, chatbotOpen, openChatbot, tradeChatModalOpen } = useMarketplace();

  if (chatbotOpen || tradeChatModalOpen || route.name === 'chat') {
    return null;
  }

  const hasStickyFooterCta =
    route.name === 'product' ||
    route.name === 'cart' ||
    route.name === 'checkout' ||
    route.name === 'order_confirmation';

  const bottomOffsetClass = cartToast
    ? hasStickyFooterCta
      ? 'bottom-32'
      : 'bottom-20'
    : hasStickyFooterCta
      ? 'bottom-20'
      : 'bottom-4';

  return (
    <button
      type="button"
      onClick={openChatbot}
      aria-label="Open Affin Connect Assistant"
      title="Affin Connect Assistant"
      className={`absolute right-3.5 ${bottomOffsetClass} z-30 w-12 h-12 rounded-full bg-gradient-to-br from-[#00D68F] to-[#00C8D7] text-[#031719] border border-[#00D68F]/45 shadow-[0_8px_24px_rgba(0,214,143,0.35)] flex items-center justify-center hover:brightness-105 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D68F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#031719]`}
    >
      <MessageCircle className="w-5 h-5 stroke-[2.3]" />
    </button>
  );
};

export const AffinChatbotPopup: React.FC = () => {
  const { chatbotOpen, closeChatbot } = useMarketplace();

  useEffect(() => {
    if (!chatbotOpen) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeChatbot();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chatbotOpen, closeChatbot]);

  if (!chatbotOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Affin Connect Assistant"
      className="absolute inset-0 z-40 flex flex-col justify-end p-2.5 sm:p-3 bg-black/55 backdrop-blur-[2px]"
    >
      <button
        type="button"
        aria-label="Close assistant backdrop"
        onClick={closeChatbot}
        className="flex-1 w-full cursor-default"
        tabIndex={-1}
      />
      <div className="w-full h-[80%] max-h-[620px] min-h-[380px] rounded-3xl overflow-hidden border border-[#00C8D7]/30 shadow-2xl shadow-black/70 bg-[#031719] flex flex-col animate-[fadeIn_160ms_ease-out]">
        <AffinChatbotSurface variant="popup" onClose={closeChatbot} />
      </div>
    </div>
  );
};
