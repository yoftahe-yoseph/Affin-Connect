import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  onAuthStateChanged,
  RecaptchaVerifier,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  updateProfile,
  type ConfirmationResult,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, testConnection } from '../services/firebase';
import {
  adminResolveReturnRequestInFirestore,
  adminUpdateOrderInFirestore,
  deleteAddressInFirestore,
  deletePriceAlertInFirestore,
  deleteProductInFirestore,
  deleteReviewInFirestore,
  deleteShopInFirestore,
  fetchCatalogSnapshotFromFirestore,
  findUserByEmailInFirestore,
  getSharedWishlistFromFirestore,
  markNotificationReadInFirestore,
  moderateProductGovernanceInFirestore,
  moderateShopGovernanceInFirestore,
  recordAdminAuditLogInFirestore,
  recordLoyaltyTransactionsInFirestore,
  reviewMerchantVerificationInFirestore,
  saveAddressInFirestore,
  saveCategoryInFirestore,
  saveMarketplaceConfigInFirestore,
  saveNotificationInFirestore,
  saveOrderWithLoyaltyInFirestore,
  savePriceAlertInFirestore,
  saveProductInFirestore,
  saveSharedWishlistInFirestore,
  saveShopInFirestore,
  saveUserProfileInFirestore,
  seedCatalogToFirestore,
  submitMerchantVerificationInFirestore,
  submitReturnRequestInFirestore,
  submitReviewInFirestore,
  subscribeToAdminAuditLogs,
  subscribeToAllOrdersForAdmin,
  subscribeToAllReturnRequestsForAdmin,
  subscribeToAllUsersForAdmin,
  subscribeToAllVerificationsForAdmin,
  subscribeToCategories,
  subscribeToMarketplaceConfig,
  subscribeToOwnerVerifications,
  subscribeToProducts,
  subscribeToReviews,
  subscribeToShopOrders,
  subscribeToShops,
  subscribeToUserAddresses,
  subscribeToUserLoyaltyTransactions,
  subscribeToUserNotifications,
  subscribeToUserOrders,
  subscribeToUserPriceAlerts,
  subscribeToUserReturnRequests,
  updateOrderPaymentInFirestore,
  updateOrderStatusInFirestore,
  updateReviewInFirestore,
  updateUserGovernanceInFirestore,
  subscribeToBuyerChatThreads,
  subscribeToSellerChatThreads,
  subscribeToAllChatThreadsForAdmin,
  subscribeToChatMessages,
  sendTradeChatMessageInFirestore,
  requestAdminSupervisionInFirestore,
  adminMediateChatInFirestore,
  ProductCategorizationApiError,
  runCoffeeProductMigrationViaApi,
  saveProductViaBackendApi,
} from '../services/marketplaceService';
import { SEED_CATEGORIES, SEED_PRODUCTS, SEED_REVIEWS, SEED_SHOPS } from '../data/seedData';
import {
  buildWishlistShareUrl,
  calculateCartSummary,
  calculateDistanceKm,
  calculateLoyaltyBalanceFromTransactions,
  calculateProductRatingSummary,
  calculateShopRatingSummary,
  canShopListProducts,
  DEFAULT_GOVERNANCE_CONFIG,
  DEFAULT_HAWASSA_DELIVERY_FEE_ETB,
  findUserByNormalizedEmail,
  findNearbyDiscountedDeals,
  formatETB,
  formatFriendlyErrorMessage,
  generateDeliveryPin,
  getCartItemKey,
  getItemReturnRequest,
  getNeighborhoodCoordinates,
  getNeighborhoodDeliveryEstimate,
  getQualifyingPurchaseOrder,
  getUserProductReview,
  HAWASSA_CENTER,
  HAWASSA_NEIGHBORHOODS,
  isElectronicPaymentMethod,
  isEmailFormat,
  isOrderEligibleForReturn,
  isReturningGoogleSignIn,
  isSuperAdminEmail,
  isUserPendingEmailVerification,
  isValidOtpCode,
  isValidThemePreference,
  normalizePhoneToE164,
  parseSharedWishlistFallbackIds,
  rankShopsByProximity,
  resolveActiveSellerShopId,
  resolveClosestNeighborhood,
  resolveInitialOrderPaymentStatus,
  resolveThemePreference,
  sanitizeWishlistProductIds,
  shouldTriggerPriceAlert,
  validateEmailSignInInput,
  validateMerchantVerificationInput,
  validateOrderAgainstGovernance,
  validatePaymentReference,
  validatePriceAlertThreshold,
  validateProductImageUrl,
  validateRegistrationInput,
  validateReturnRequestInput,
  validateReviewInput,
  verifyDeliveryPin,
  buildOrderChatThreadId,
  buildShopChatThreadId,
  formatOrderChatCode,
  validateChatMessageInput,
  validateSupervisionReason,
  sortTradeChatThreads,
  countSupervisionAttentionThreads,
  mergeUniqueIds,
  toggleUniqueId,
  reconcileCartWithCatalog,
  CANONICAL_COFFEE_CATEGORY,
  classifyProductCoffeeCategory,
  normalizeProductCategory,
  planCoffeeProductMigration,
  type CoffeeCategorizationResult,
} from '../utils/marketplaceLogic';
import { getLocalizedNeighborhood, translations } from '../constants/translations';
import {
  dispatchBrowserPushNotification,
  getPushPermissionState,
  requestBrowserPushPermission,
} from '../utils/pushNotifications';
import type {
  AccountStatus,
  AdminAuditLog,
  AdminAuditTargetType,
  CartItem,
  Category,
  CustomerAddress,
  LoyaltyTransaction,
  MarketplaceGovernanceConfig,
  MerchantVerification,
  NearbyDiscountDeal,
  NotificationItem,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PriceAlert,
  Product,
  ProductVariant,
  PushPermissionState,
  ResolvedTheme,
  ReturnRequest,
  ReturnRequestReason,
  ReturnRequestStatus,
  ReturnRequestType,
  ReviewItem,
  SharedWishlist,
  Shop,
  ShopWithProximity,
  SupportedLanguage,
  ThemePreference,
  TradeChatMessage,
  TradeChatThread,
  UserCoordinates,
  UserLocationState,
  UserProfile,
  UserRole,
} from '../types';

export type AdminTabId =
  | 'overview'
  | 'shops'
  | 'verifications'
  | 'products'
  | 'orders'
  | 'supervision'
  | 'users'
  | 'reviews'
  | 'categories'
  | 'config'
  | 'audit';

export type AppRoute =
  | { name: 'onboarding' }
  | { name: 'home' }
  | { name: 'search'; initialQuery?: string; initialCategory?: string }
  | { name: 'categories' }
  | { name: 'product'; productId: string }
  | { name: 'shop'; shopId: string }
  | { name: 'shops'; initialCategory?: string; showAll?: boolean }
  | { name: 'coffee_traders'; initialShopId?: string }
  | { name: 'cart' }
  | { name: 'checkout' }
  | { name: 'order_confirmation'; orderId: string }
  | { name: 'orders'; selectedOrderId?: string; initialTab?: 'active' | 'history' }
  | { name: 'favorites' }
  | { name: 'notifications' }
  | { name: 'profile'; section?: 'main' | 'addresses' | 'settings' | 'help' }
  | { name: 'loyalty' }
  | { name: 'shared_wishlist'; shareId: string; fallbackProductIds?: string[] }
  | { name: 'seller'; tab?: 'dashboard' | 'orders' | 'products' | 'verification' | 'shop' }
  | { name: 'admin'; tab?: AdminTabId }
  | { name: 'map'; shopId?: string }
  | { name: 'chat' }
  | { name: 'video' };

export interface SearchSessionState {
  queryText: string;
  searchType: 'all' | 'shops' | 'products';
  category: string;
  selectedNeighborhoods: string[];
  minPrice: string;
  maxPrice: string;
  minShopRating: number | null;
  inStockOnly: boolean;
  deliveryOnly: boolean;
  pickupOnly: boolean;
  verifiedOnly: boolean;
  sortBy: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'nearest';
}

const DEFAULT_SEARCH_SESSION: SearchSessionState = {
  queryText: '',
  searchType: 'all',
  category: 'all',
  selectedNeighborhoods: [],
  minPrice: '',
  maxPrice: '',
  minShopRating: null,
  inStockOnly: false,
  deliveryOnly: false,
  pickupOnly: false,
  verifiedOnly: false,
  sortBy: 'relevance',
};

const STORAGE_KEYS = {
  ONBOARDED: 'hg_onboarded_v1',
  LANGUAGE: 'hg_language_v1',
  NEIGHBORHOOD: 'hg_neighborhood_v1',
  CART: 'hg_cart_v1',
  FAVORITES: 'hg_favorites_v1',
  RECENT_SEARCHES: 'hg_recent_searches_v1',
  LOCAL_ORDERS: 'hg_local_orders_v1',
  LOCAL_ADDRESSES: 'hg_local_addresses_v1',
  LOCAL_NOTIFS: 'hg_local_notifs_v1',
  LOCAL_PRODUCTS: 'hg_local_products_v1',
  LOCAL_SHOPS: 'hg_local_shops_v1',
  LOCAL_REVIEWS: 'hg_local_reviews_v1',
  DELIVERY_FEE: 'hg_delivery_fee_v1',
  RECENTLY_VIEWED: 'hg_recently_viewed_v1',
  FOLLOWED_SHOPS: 'hg_followed_shops_v1',
  PROMO_CODE: 'hg_promo_code_v1',
  LOYALTY_TX: 'hg_loyalty_tx_v1',
  SHARED_WISHLISTS: 'hg_shared_wishlists_v1',
  MY_WISHLIST_SHARE_ID: 'hg_my_wishlist_share_id_v1',
  LOCAL_RETURNS: 'hg_return_requests_v1',
  PRICE_ALERTS: 'hg_price_alerts_v1',
  THEME: 'hg_theme_v1',
  GOVERNANCE_CONFIG: 'hg_governance_config_v1',
  ADMIN_AUDIT: 'hg_admin_audit_v1',
  LOCAL_USERS: 'hg_local_users_v1',
  MERCHANT_VERIFICATIONS: 'hg_merchant_verifications_v1',
  DEVELOPER_MODE: 'hg_dev_mode_v1',
  USER_LOCATION: 'hg_user_location_v1',
  NEARBY_ALERTS_ENABLED: 'hg_nearby_alerts_v1',
  TRADE_CHATS: 'hg_trade_chats_v1',
  TRADE_CHAT_MESSAGES: 'hg_trade_chat_messages_v1',
};

const DEFAULT_LOCAL_ADDRESSES: CustomerAddress[] = [
  {
    addressId: 'addr-default-piazza',
    customerUid: 'guest-local',
    label: 'Home',
    recipientName: 'Abebe Tadesse',
    phoneNumber: '0911684520',
    city: 'Hawassa',
    neighborhood: 'Piazza',
    streetOrLandmark: 'Near St. Gabriel Cathedral, White Gate',
    additionalInstructions: 'Call on arrival near the bakery',
    isDefault: true,
    createdAt: '2026-11-10T08:00:00.000Z',
  },
];

export interface PhoneOtpState {
  step: 'idle' | 'sending' | 'code_sent' | 'verifying';
  formattedPhone: string;
  pendingDisplayName: string;
}

interface MarketplaceContextValue {
  route: AppRoute;
  navigate: (next: AppRoute) => void;
  goBack: () => void;
  routePathString: string;

  // Auth & Role
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  activeRoleView: UserRole;
  setActiveRoleView: (role: UserRole) => void;
  canAccessSeller: boolean;
  canAccessAdmin: boolean;
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
  authLoading: boolean;
  isEmailVerified: boolean;
  needsEmailVerification: boolean;
  emailVerificationCooldown: number;
  emailVerificationNotice: string | null;
  clearEmailVerificationNotice: () => void;
  resendVerificationEmail: () => Promise<{ ok: boolean; error?: string }>;
  checkEmailVerificationStatus: () => Promise<{ verified: boolean; error?: string }>;
  welcomeBackNotice: {
    displayName: string;
    email: string;
    neighborhood: string;
    loginTimestamp: string;
    mode: string;
  } | null;
  clearWelcomeBackNotice: () => void;
  guestAccessGranted: boolean;
  isAuthGateActive: boolean;
  continueAsGuest: () => void;
  openAuthScreen: () => void;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<boolean>;
  signInWithEmailPassword: (params: {
    emailOrPhone: string;
    password: string;
    rememberMe?: boolean;
  }) => Promise<{ ok: boolean; switchToPhoneOtp?: string; error?: string }>;
  resetPasswordByEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
  registerWithEmailPassword: (params: {
    fullName: string;
    email: string;
    phoneNumber: string;
    neighborhood: string;
    accountType: 'customer' | 'seller';
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  phoneOtpState: PhoneOtpState;
  sendPhoneOtp: (
    phoneInput: string,
    displayNameInput?: string
  ) => Promise<{ ok: boolean; formattedPhone?: string; error?: string }>;
  verifyPhoneOtp: (
    otpCode: string,
    displayNameInput?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  resetPhoneOtp: () => void;
  signOutUser: () => Promise<void>;
  firebaseConnected: boolean;

  // Localization, Theme & Location
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setThemePreference: (theme: ThemePreference) => void;
  toggleTheme: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  selectedNeighborhood: string;
  setSelectedNeighborhood: (n: string) => void;
  userLocation: UserLocationState | null;
  effectiveUserCoords: UserCoordinates;
  detectingLocation: boolean;
  locationError: string | null;
  detectUserLocation: () => Promise<UserLocationState>;
  proximityRankings: ShopWithProximity[];
  proximityByShopId: Record<string, ShopWithProximity>;
  shopDistanceById: Record<string, number>;
  nearbyDeals: NearbyDiscountDeal[];
  nearbyAlertsEnabled: boolean;
  toggleNearbyAlerts: () => Promise<boolean>;
  triggerNearbyDiscountAlert: (options?: {
    isTest?: boolean;
    forceNotify?: boolean;
  }) => Promise<boolean>;
  completeOnboarding: () => void;

  // Catalog Data
  shops: Shop[];
  shopsById: Record<string, Shop>;
  products: Product[];
  categories: Category[];
  reviews: ReviewItem[];
  recentSearches: string[];
  addRecentSearch: (q: string) => void;
  searchSession: SearchSessionState;
  setSearchSession: React.Dispatch<React.SetStateAction<SearchSessionState>>;
  refreshCatalogFromFirestore: () => Promise<void>;

  // Cart, Favorites, Recently Viewed & Followed Shops
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, variant?: ProductVariant) => void;
  updateCartQuantity: (productId: string, quantity: number, variantId?: string) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  clearCart: (shopId?: string) => void;
  syncCartWithLiveCatalog: (shopId?: string) => void;
  promoCode: string;
  setPromoCode: (code: string) => void;
  cartToast: {
    id: number;
    message: string;
    actionLabel?: string;
    actionRoute?: AppRoute | null;
  } | null;
  dismissCartToast: () => void;
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  saveWishlistToFavorites: (productIds: string[]) => void;
  addWishlistToCart: (productIds: string[]) => number;
  shareWishlist: (title?: string) => Promise<{ wishlist: SharedWishlist; shareUrl: string }>;
  loadSharedWishlist: (
    shareId: string,
    fallbackProductIds?: string[]
  ) => Promise<SharedWishlist | null>;
  followedShops: string[];
  toggleFollowShop: (shopId: string) => void;
  recentlyViewedIds: string[];
  recordProductView: (productId: string) => void;

  // Orders & Addresses & Notifications & Loyalty
  orders: Order[];
  sellerOrders: Order[];
  addresses: CustomerAddress[];
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  deliveryFeeEtb: number;
  setDeliveryFeeEtb: (fee: number) => void;
  loyaltyTransactions: LoyaltyTransaction[];
  loyaltyBalance: number;
  lifetimeLoyaltyPoints: number;
  totalRedeemedLoyaltyPoints: number;
  redeemLoyaltyPoints: number;
  setRedeemLoyaltyPoints: (points: number) => void;

  // Mutations & Admin Governance
  isCloudAdmin: boolean;
  governanceConfig: MarketplaceGovernanceConfig;
  adminUsers: UserProfile[];
  adminOrders: Order[];
  adminReturnRequests: ReturnRequest[];
  adminAuditLogs: AdminAuditLog[];
  placeOrder: (params: {
    shopId: string;
    fulfillmentMethod: 'delivery' | 'pickup';
    deliveryAddress?: CustomerAddress;
    paymentMethod: PaymentMethod;
    paymentReference?: string;
    notes?: string;
    promoCode?: string;
    pointsToRedeem?: number;
    idempotencyKey?: string;
  }) => Promise<Order>;
  verifyOrderPayment: (orderId: string) => Promise<{
    verifiedPaid: boolean;
    paymentStatus: PaymentStatus;
    configured: boolean;
    message?: string;
    missingEnvVars?: string[];
  }>;
  paymentProviders: Record<
    'telebirr' | 'cbe_birr' | 'chapa',
    { configured: boolean; missingEnvVars: string[] }
  > | null;
  reorderFromOrder: (order: Order) => { addedCount: number; skippedCount: number };
  updateOrderStatus: (
    orderId: string,
    newStatus: OrderStatus,
    rejectionReason?: string,
    deliveryPinInput?: string
  ) => Promise<void>;
  saveAddress: (address: Omit<CustomerAddress, 'addressId' | 'customerUid' | 'createdAt'>) => Promise<void>;
  deleteAddress: (addressId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  saveSellerProduct: (
    product: Product,
    options?: {
      categoryConfirmed?: boolean;
      confirmedCategory?: string;
    }
  ) => Promise<{ product: Product; categorization: CoffeeCategorizationResult }>;
  runCoffeeMigrationAsAdmin: (dryRun?: boolean) => Promise<{
    dryRun: boolean;
    scanned: number;
    alreadyCategorized: number;
    eligible: number;
    updated: number;
    skipped: number;
    ambiguous: number;
  }>;
  saveSellerShop: (shop: Shop) => Promise<void>;
  moderateShopStatus: (shopId: string, status: 'approved' | 'suspended' | 'pending') => Promise<void>;
  moderateShopGovernance: (params: {
    shopId: string;
    status?: 'approved' | 'suspended' | 'pending';
    featured?: boolean;
    reason?: string;
  }) => Promise<void>;
  deleteShopAsAdmin: (shopId: string, reason: string) => Promise<void>;
  moderateProductStatus: (
    productId: string,
    status: 'active' | 'archived' | 'pending_review'
  ) => Promise<void>;
  moderateProductGovernance: (params: {
    productId: string;
    status?: 'active' | 'archived' | 'pending_review';
    isAvailable?: boolean;
    stock?: number;
    reason?: string;
  }) => Promise<void>;
  deleteProductAsAdmin: (productId: string, reason: string) => Promise<void>;
  adminForceOrderAction: (params: {
    orderId: string;
    orderStatus?: OrderStatus;
    paymentStatus?: PaymentStatus;
    reason: string;
  }) => Promise<void>;
  adminResolveReturnRequest: (params: {
    returnId: string;
    status: ReturnRequestStatus;
    resolutionNote: string;
  }) => Promise<void>;
  adminUpdateUserAccount: (params: {
    uid: string;
    role?: UserRole;
    accountStatus?: AccountStatus;
    reason: string;
  }) => Promise<void>;
  adminGrantRoleByEmail: (params: {
    email: string;
    role: UserRole;
    reason?: string;
  }) => Promise<{ ok: boolean; user?: UserProfile; error?: string }>;
  adminDeleteReview: (reviewId: string, reason: string) => Promise<void>;
  updateGovernanceConfig: (
    patch: Partial<
      Pick<
        MarketplaceGovernanceConfig,
        | 'deliveryFeeEtb'
        | 'freeDeliveryThresholdEtb'
        | 'maxOrderAmountEtb'
        | 'orderingPaused'
        | 'maintenanceBanner'
        | 'strictShopVerification'
      >
    >,
    reason?: string
  ) => Promise<void>;
  saveCategory: (category: Category) => Promise<void>;
  submitReview: (params: {
    productId: string;
    shopId: string;
    rating: number;
    comment: string;
    shopRating?: number;
    shopComment?: string;
  }) => Promise<void>;
  updateReview: (
    reviewId: string,
    rating: number,
    comment: string,
    shopRating?: number,
    shopComment?: string
  ) => Promise<void>;
  deleteReview: (reviewId: string) => Promise<void>;
  returnRequests: ReturnRequest[];
  submitReturnRequest: (params: {
    orderId: string;
    productId: string;
    variantLabel?: string;
    requestType: ReturnRequestType;
    reason: ReturnRequestReason;
    details: string;
    photoDataUrl?: string;
  }) => Promise<ReturnRequest>;
  priceAlerts: PriceAlert[];
  pushPermission: PushPermissionState;
  requestPushPermission: () => Promise<PushPermissionState>;
  subscribePriceAlert: (params: {
    product: Product;
    targetPrice: number;
    enablePush: boolean;
  }) => Promise<PriceAlert>;
  removePriceAlert: (alertId: string) => Promise<void>;
  merchantVerifications: MerchantVerification[];
  getShopVerification: (shopId: string) => MerchantVerification | null;
  submitMerchantVerification: (params: {
    shopId: string;
    businessLegalName: string;
    licenseNumber: string;
    tinNumber?: string;
    issuingAuthority: string;
    expiryDate?: string;
    licenseImageDataUrl: string;
    documentFileName?: string;
  }) => Promise<MerchantVerification>;
  adminReviewMerchantVerification: (params: {
    verificationId: string;
    decision: 'approved' | 'rejected';
    reviewNote?: string;
  }) => Promise<void>;
  activeSellerShopId: string;
  setActiveSellerShopId: (shopId: string) => void;
  tradeChats: TradeChatThread[];
  tradeChatModalOpen: boolean;
  activeTradeChatThreadId: string | null;
  setActiveTradeChatThreadId: (threadId: string | null) => void;
  activeTradeChatThread: TradeChatThread | null;
  tradeChatMessages: TradeChatMessage[];
  adminSupervisedThreadId: string | null;
  setAdminSupervisedThreadId: (threadId: string | null) => void;
  adminSupervisedMessages: TradeChatMessage[];
  supervisionAttentionCount: number;
  openOrderChat: (order: Order) => void;
  openShopChat: (shop: Shop) => void;
  openTradeChatInbox: (threadId?: string) => void;
  closeTradeChatModal: () => void;
  sendTradeChatMessage: (
    threadId: string,
    body: string,
    preferredRole?: 'buyer' | 'seller'
  ) => Promise<void>;
  requestAdminSupervision: (threadId: string, reason?: string) => Promise<void>;
  adminJoinChatMediation: (threadId: string, introNote?: string) => Promise<void>;
  adminSendMediatorMessage: (threadId: string, body: string) => Promise<void>;
  adminResolveChatSupervision: (threadId: string, resolutionNote?: string) => Promise<void>;
  chatbotOpen: boolean;
  openChatbot: () => void;
  closeChatbot: () => void;
  toggleChatbot: () => void;
}

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const MarketplaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialWishlistId =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('wishlist')?.trim() || ''
      : '';
  const initialFallbackIds =
    typeof window !== 'undefined' ? parseSharedWishlistFallbackIds(window.location.search) : [];

  const [history, setHistory] = useState<AppRoute[]>([
    initialWishlistId
      ? {
          name: 'shared_wishlist',
          shareId: initialWishlistId,
          fallbackProductIds: initialFallbackIds,
        }
      : { name: 'home' },
  ]);
  const route = history[history.length - 1];

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);
  const [emailVerificationCooldown, setEmailVerificationCooldown] = useState<number>(0);
  const [emailVerificationNotice, setEmailVerificationNotice] = useState<string | null>(null);
  const [welcomeBackNotice, setWelcomeBackNotice] = useState<{
    displayName: string;
    email: string;
    neighborhood: string;
    loginTimestamp: string;
    mode: string;
  } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeRoleView, setActiveRoleView] = useState<UserRole>('customer');
  const [authLoading, setAuthLoading] = useState(true);
  const [guestAccessGranted, setGuestAccessGranted] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [phoneOtpState, setPhoneOtpState] = useState<PhoneOtpState>({
    step: 'idle',
    formattedPhone: '',
    pendingDisplayName: '',
  });
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const pendingPhoneDisplayNameRef = useRef<string>('');
  const pendingRegistrationProfileRef = useRef<{
    displayName: string;
    phoneNumber: string;
    neighborhood: string;
    role: 'customer' | 'seller';
  } | null>(null);
  const newlyCreatedInSessionUidsRef = useRef<Set<string>>(new Set());
  const welcomeBackSentAtRef = useRef<{ uid: string; at: number } | null>(null);
  const [firebaseConnected, setFirebaseConnected] = useState(true);

  const [language, setLanguageState] = useState<SupportedLanguage>(() =>
    readStorage<SupportedLanguage>(STORAGE_KEYS.LANGUAGE, 'en')
  );
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => {
    const stored = readStorage<unknown>(STORAGE_KEYS.THEME, 'dark');
    return isValidThemePreference(stored) ? stored : 'dark';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true
  );
  const [selectedNeighborhood, setSelectedNeighborhoodState] = useState<string>(() =>
    readStorage<string>(STORAGE_KEYS.NEIGHBORHOOD, 'All Hawassa')
  );

  const [shops, setShops] = useState<Shop[]>(() =>
    readStorage<Shop[]>(STORAGE_KEYS.LOCAL_SHOPS, SEED_SHOPS)
  );
  const [products, setProducts] = useState<Product[]>(() => {
    const cached = readStorage<Product[]>(STORAGE_KEYS.LOCAL_PRODUCTS, SEED_PRODUCTS);
    const seedById = new Map(SEED_PRODUCTS.map((sp) => [sp.productId, sp]));
    return cached.map((p) => {
      const seed = seedById.get(p.productId);
      return seed
        ? {
            ...p,
            variants: p.variants ?? seed.variants,
            additionalImages: p.additionalImages ?? seed.additionalImages,
          }
        : p;
    });
  });
  const [categories, setCategories] = useState<Category[]>(SEED_CATEGORIES);
  const [reviews, setReviews] = useState<ReviewItem[]>(() =>
    readStorage<ReviewItem[]>(STORAGE_KEYS.LOCAL_REVIEWS, SEED_REVIEWS)
  );

  const [cart, setCart] = useState<CartItem[]>(() =>
    readStorage<CartItem[]>(STORAGE_KEYS.CART, [])
  );
  const [promoCode, setPromoCodeState] = useState<string>(() =>
    readStorage<string>(STORAGE_KEYS.PROMO_CODE, '')
  );
  const [cartToast, setCartToast] = useState<{
    id: number;
    message: string;
    actionLabel?: string;
    actionRoute?: AppRoute | null;
  } | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() =>
    readStorage<string[]>(STORAGE_KEYS.FAVORITES, [])
  );
  const [followedShops, setFollowedShops] = useState<string[]>(() =>
    mergeUniqueIds(readStorage<string[]>(STORAGE_KEYS.FOLLOWED_SHOPS, []), [])
  );
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() =>
    readStorage<string[]>(STORAGE_KEYS.RECENTLY_VIEWED, [])
  );
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    readStorage<string[]>(STORAGE_KEYS.RECENT_SEARCHES, ['Sidama Coffee', 'Netela', 'Berbere', 'Honey'])
  );
  const [searchSession, setSearchSession] = useState<SearchSessionState>(DEFAULT_SEARCH_SESSION);

  const [orders, setOrders] = useState<Order[]>(() =>
    readStorage<Order[]>(STORAGE_KEYS.LOCAL_ORDERS, [])
  );
  const [sellerOrders, setSellerOrders] = useState<Order[]>(() =>
    readStorage<Order[]>(STORAGE_KEYS.LOCAL_ORDERS, [])
  );
  const [addresses, setAddresses] = useState<CustomerAddress[]>(() =>
    readStorage<CustomerAddress[]>(STORAGE_KEYS.LOCAL_ADDRESSES, DEFAULT_LOCAL_ADDRESSES)
  );
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    readStorage<NotificationItem[]>(STORAGE_KEYS.LOCAL_NOTIFS, [
      {
        notificationId: 'notif-welcome',
        userUid: 'guest-local',
        title: 'Welcome to Hawasa Gebeya',
        message: 'Discover verified local shops across Piazza, Menhariya, Gebeya Dar, and Tabor.',
        type: 'system',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ])
  );
  const [deliveryFeeEtb, setDeliveryFeeEtbState] = useState<number>(() =>
    readStorage<number>(STORAGE_KEYS.DELIVERY_FEE, DEFAULT_HAWASSA_DELIVERY_FEE_ETB)
  );
  const [governanceConfig, setGovernanceConfig] = useState<MarketplaceGovernanceConfig>(() => {
    const stored = readStorage<MarketplaceGovernanceConfig | null>(
      STORAGE_KEYS.GOVERNANCE_CONFIG,
      null
    );
    const storedFee = readStorage<number>(
      STORAGE_KEYS.DELIVERY_FEE,
      DEFAULT_HAWASSA_DELIVERY_FEE_ETB
    );
    return stored ?? { ...DEFAULT_GOVERNANCE_CONFIG, deliveryFeeEtb: storedFee };
  });
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>(() =>
    readStorage<UserProfile[]>(STORAGE_KEYS.LOCAL_USERS, [])
  );
  const [adminOrders, setAdminOrders] = useState<Order[]>(() =>
    readStorage<Order[]>(STORAGE_KEYS.LOCAL_ORDERS, [])
  );
  const [adminReturnRequests, setAdminReturnRequests] = useState<ReturnRequest[]>(() =>
    readStorage<ReturnRequest[]>(STORAGE_KEYS.LOCAL_RETURNS, [])
  );
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLog[]>(() =>
    readStorage<AdminAuditLog[]>(STORAGE_KEYS.ADMIN_AUDIT, [])
  );
  const [merchantVerifications, setMerchantVerifications] = useState<MerchantVerification[]>(() =>
    readStorage<MerchantVerification[]>(STORAGE_KEYS.MERCHANT_VERIFICATIONS, [])
  );
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>(() =>
    readStorage<LoyaltyTransaction[]>(STORAGE_KEYS.LOYALTY_TX, [])
  );
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>(() =>
    readStorage<ReturnRequest[]>(STORAGE_KEYS.LOCAL_RETURNS, [])
  );
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>(() =>
    readStorage<PriceAlert[]>(STORAGE_KEYS.PRICE_ALERTS, [])
  );
  const [pushPermission, setPushPermission] = useState<PushPermissionState>(() =>
    getPushPermissionState()
  );
  const [userLocation, setUserLocation] = useState<UserLocationState | null>(() =>
    readStorage<UserLocationState | null>(STORAGE_KEYS.USER_LOCATION, null)
  );
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [nearbyAlertsEnabled, setNearbyAlertsEnabled] = useState<boolean>(() =>
    readStorage<boolean>(STORAGE_KEYS.NEARBY_ALERTS_ENABLED, false)
  );
  const triggeredAlertsRef = useRef<Set<string>>(new Set());
  const triggeredNearbyAlertKeysRef = useRef<Map<string, number>>(new Map());
  const [redeemLoyaltyPoints, setRedeemLoyaltyPointsState] = useState<number>(0);
  const [activeSellerShopId, setActiveSellerShopId] = useState<string>(SEED_SHOPS[0].shopId);
  const [developerMode, setDeveloperModeState] = useState<boolean>(() =>
    readStorage<boolean>(STORAGE_KEYS.DEVELOPER_MODE, false)
  );
  const [localTradeChats, setLocalTradeChats] = useState<TradeChatThread[]>(() =>
    readStorage<TradeChatThread[]>(STORAGE_KEYS.TRADE_CHATS, [])
  );
  const [localTradeMessagesByThread, setLocalTradeMessagesByThread] = useState<
    Record<string, TradeChatMessage[]>
  >(() => readStorage<Record<string, TradeChatMessage[]>>(STORAGE_KEYS.TRADE_CHAT_MESSAGES, {}));
  const [draftTradeThreads, setDraftTradeThreads] = useState<Record<string, TradeChatThread>>({});
  const [buyerCloudChats, setBuyerCloudChats] = useState<TradeChatThread[]>([]);
  const [sellerCloudChats, setSellerCloudChats] = useState<TradeChatThread[]>([]);
  const [adminCloudChats, setAdminCloudChats] = useState<TradeChatThread[]>([]);
  const [tradeChatModalOpen, setTradeChatModalOpen] = useState<boolean>(false);
  const [activeTradeChatThreadId, setActiveTradeChatThreadId] = useState<string | null>(null);
  const [cloudActiveChatMessages, setCloudActiveChatMessages] = useState<TradeChatMessage[]>([]);
  const [adminSupervisedThreadId, setAdminSupervisedThreadId] = useState<string | null>(null);
  const [cloudAdminSupervisedMessages, setCloudAdminSupervisedMessages] = useState<
    TradeChatMessage[]
  >([]);
  const [chatbotOpen, setChatbotOpen] = useState<boolean>(false);

  const openChatbot = () => setChatbotOpen(true);
  const closeChatbot = () => setChatbotOpen(false);
  const toggleChatbot = () => setChatbotOpen((prev) => !prev);

  const isCloudAdmin = Boolean(
    firebaseUser &&
      (userProfile?.role === 'admin' ||
        (isEmailVerified && isSuperAdminEmail(firebaseUser.email)))
  );
  const canAccessSeller = Boolean(isCloudAdmin || userProfile?.role === 'seller');
  const canAccessAdmin = Boolean(isCloudAdmin || userProfile?.role === 'admin');

  const setDeveloperMode = (enabled: boolean) => {
    setDeveloperModeState(enabled);
    localStorage.setItem(STORAGE_KEYS.DEVELOPER_MODE, JSON.stringify(enabled));
    if (!enabled && activeRoleView !== 'customer') {
      setActiveRoleView('customer');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener?.('change', handleChange);
    return () => mq.removeEventListener?.('change', handleChange);
  }, []);

  const resolvedTheme: ResolvedTheme = resolveThemePreference(
    themePreference,
    systemPrefersDark
  );

  // Sync dark mode class, colorScheme, and localStorage persistence
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
      document.documentElement.style.colorScheme = resolvedTheme;
    }
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(themePreference));
    } catch {
      // ignore storage errors
    }
  }, [resolvedTheme, themePreference]);

  // Persist local states cleanly
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROMO_CODE, JSON.stringify(promoCode));
  }, [promoCode]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
  }, [favorites]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FOLLOWED_SHOPS, JSON.stringify(followedShops));
  }, [followedShops]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RECENTLY_VIEWED, JSON.stringify(recentlyViewedIds));
  }, [recentlyViewedIds]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(recentSearches));
  }, [recentSearches]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DELIVERY_FEE, JSON.stringify(deliveryFeeEtb));
  }, [deliveryFeeEtb]);
  useEffect(() => {
    if (!cartToast) return;
    const timer = setTimeout(() => setCartToast(null), 3800);
    return () => clearTimeout(timer);
  }, [cartToast]);

  // Boot connection check + public catalog listeners
  useEffect(() => {
    testConnection().then(setFirebaseConnected);

    const unsubShops = subscribeToShops(setShops);
    const unsubProducts = subscribeToProducts(setProducts);
    const unsubCategories = subscribeToCategories(setCategories);
    const unsubReviews = subscribeToReviews(setReviews);
    const unsubConfig = subscribeToMarketplaceConfig((cloudConfig) => {
      if (cloudConfig) {
        setGovernanceConfig(cloudConfig);
        setDeliveryFeeEtbState(cloudConfig.deliveryFeeEtb);
        localStorage.setItem(STORAGE_KEYS.GOVERNANCE_CONFIG, JSON.stringify(cloudConfig));
        localStorage.setItem(STORAGE_KEYS.DELIVERY_FEE, JSON.stringify(cloudConfig.deliveryFeeEtb));
      }
    });

    return () => {
      unsubShops();
      unsubProducts();
      unsubCategories();
      unsubReviews();
      unsubConfig();
    };
  }, []);

  // Email verification 60s resend cooldown countdown
  useEffect(() => {
    if (emailVerificationCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setEmailVerificationCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [emailVerificationCooldown]);

  // Auth listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setIsEmailVerified(Boolean(user?.emailVerified));
      if (user) {
        const isAdminEmail = Boolean(
          user.emailVerified && isSuperAdminEmail(user.email)
        );
        if (isAdminEmail) {
          await seedCatalogToFirestore(true);
        }

        const pendingReg = pendingRegistrationProfileRef.current;
        const resolvedDisplayName =
          pendingReg?.displayName?.trim() ||
          user.displayName?.trim() ||
          pendingPhoneDisplayNameRef.current.trim() ||
          'Hawassa Shopper';

        try {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) {
            const loaded = userSnap.data() as UserProfile;
            const localFollowed = mergeUniqueIds(
              readStorage<string[]>(STORAGE_KEYS.FOLLOWED_SHOPS, []),
              []
            );
            const cloudFollowed = Array.isArray(loaded.favoriteShopIds)
              ? loaded.favoriteShopIds
              : [];
            const mergedFollowed = mergeUniqueIds(cloudFollowed, localFollowed);
            setFollowedShops(mergedFollowed);

            let syncedProfile = loaded;
            const needsPhoneSync = Boolean(user.phoneNumber && !loaded.phoneNumber);
            const needsNameSync = Boolean(
              pendingPhoneDisplayNameRef.current.trim() &&
                (!loaded.displayName || loaded.displayName === 'Hawassa Shopper')
            );
            const needsAdminUpgrade = Boolean(
              isAdminEmail && (loaded.role !== 'admin' || loaded.accountStatus !== 'active')
            );
            const needsFavoriteShopsSync =
              mergedFollowed.length > cloudFollowed.length ||
              mergedFollowed.some((id, idx) => cloudFollowed[idx] !== id);
            if (needsPhoneSync || needsNameSync || needsAdminUpgrade || needsFavoriteShopsSync) {
              syncedProfile = {
                ...loaded,
                ...(needsPhoneSync ? { phoneNumber: user.phoneNumber || undefined } : {}),
                ...(needsNameSync
                  ? { displayName: pendingPhoneDisplayNameRef.current.trim().slice(0, 100) }
                  : {}),
                ...(needsAdminUpgrade
                  ? { role: 'admin' as UserRole, accountStatus: 'active' as AccountStatus }
                  : {}),
                ...(needsFavoriteShopsSync ? { favoriteShopIds: mergedFollowed } : {}),
                updatedAt: new Date().toISOString(),
              };
              await saveUserProfileInFirestore(syncedProfile);
            }
            setUserProfile(syncedProfile);
            if (syncedProfile.neighborhood && selectedNeighborhood === 'All Hawassa') {
              setSelectedNeighborhoodState(syncedProfile.neighborhood);
              localStorage.setItem(
                STORAGE_KEYS.NEIGHBORHOOD,
                JSON.stringify(syncedProfile.neighborhood)
              );
            }
          } else {
            const localFollowed = mergeUniqueIds(
              readStorage<string[]>(STORAGE_KEYS.FOLLOWED_SHOPS, []),
              []
            );
            const resolvedRole: UserRole = isAdminEmail
              ? 'admin'
              : pendingReg?.role === 'seller'
                ? 'seller'
                : 'customer';
            const resolvedPhone = pendingReg?.phoneNumber || user.phoneNumber || '';
            const resolvedNeighborhood =
              pendingReg?.neighborhood ||
              (selectedNeighborhood !== 'All Hawassa' ? selectedNeighborhood : undefined);
            const newProfile: UserProfile = {
              uid: user.uid,
              displayName: resolvedDisplayName.slice(0, 100),
              email: (user.email || '').trim().toLowerCase(),
              ...(resolvedPhone ? { phoneNumber: resolvedPhone } : {}),
              ...(resolvedNeighborhood ? { neighborhood: resolvedNeighborhood } : {}),
              ...(user.photoURL ? { photoURL: user.photoURL } : {}),
              ...(localFollowed.length > 0 ? { favoriteShopIds: localFollowed } : {}),
              role: resolvedRole,
              accountStatus: 'active',
              preferredLanguage: language,
              preferredTheme: themePreference,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await saveUserProfileInFirestore(newProfile);
            newlyCreatedInSessionUidsRef.current.add(user.uid);
            setUserProfile(newProfile);
            pendingRegistrationProfileRef.current = null;
          }
        } catch (err) {
          console.warn('Could not load Firestore user profile:', err);
        }

        // Sync Firebase Auth user to Cloud SQL PostgreSQL (ID token held in memory only)
        try {
          const idToken = await user.getIdToken();
          await fetch('/api/sql/sync-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              displayName: resolvedDisplayName,
            }),
          });
        } catch (sqlErr) {
          console.warn('Background profile sync skipped:', sqlErr);
        }
      } else {
        setUserProfile(null);
      }
      setAuthLoading(false);
    });
    return () => unsubAuth();
  }, [language]);

  // Authenticated user-specific Firestore listeners
  useEffect(() => {
    if (!firebaseUser) return;
    const unsubOrders = subscribeToUserOrders(firebaseUser.uid, (cloudOrders) => {
      setOrders(cloudOrders);
    });
    const unsubAddresses = subscribeToUserAddresses(firebaseUser.uid, (cloudAddrs) => {
      if (cloudAddrs.length > 0) setAddresses(cloudAddrs);
    });
    const unsubNotifs = subscribeToUserNotifications(firebaseUser.uid, (cloudNotifs) => {
      if (cloudNotifs.length > 0) setNotifications(cloudNotifs);
    });
    const unsubLoyalty = subscribeToUserLoyaltyTransactions(firebaseUser.uid, (cloudTxs) => {
      setLoyaltyTransactions(cloudTxs);
    });
    const unsubReturns = subscribeToUserReturnRequests(firebaseUser.uid, (cloudReturns) => {
      setReturnRequests(cloudReturns);
    });
    const unsubPriceAlerts = subscribeToUserPriceAlerts(firebaseUser.uid, (cloudAlerts) => {
      setPriceAlerts(cloudAlerts);
    });
    const unsubOwnerVerifications = subscribeToOwnerVerifications(
      firebaseUser.uid,
      (cloudOwnerVerifications) => {
        if (!isCloudAdmin) {
          setMerchantVerifications((prev) => {
            const others = prev.filter(
              (v) => !cloudOwnerVerifications.some((cv) => cv.verificationId === v.verificationId)
            );
            const merged = [...cloudOwnerVerifications, ...others];
            localStorage.setItem(STORAGE_KEYS.MERCHANT_VERIFICATIONS, JSON.stringify(merged));
            return merged;
          });
        }
      }
    );
    const unsubBuyerChats = subscribeToBuyerChatThreads(firebaseUser.uid, (threads) => {
      setBuyerCloudChats(threads);
    });
    const unsubSellerChats = subscribeToSellerChatThreads(firebaseUser.uid, (threads) => {
      setSellerCloudChats(threads);
    });
    return () => {
      unsubOrders();
      unsubAddresses();
      unsubNotifs();
      unsubLoyalty();
      unsubReturns();
      unsubPriceAlerts();
      unsubOwnerVerifications();
      unsubBuyerChats();
      unsubSellerChats();
    };
  }, [firebaseUser, isCloudAdmin]);

  // Automatically keep activeSellerShopId aligned with the signed-in seller's owned shop
  useEffect(() => {
    const resolved = resolveActiveSellerShopId({
      shops,
      currentShopId: activeSellerShopId,
      userUid: firebaseUser?.uid,
      isAdminMode: activeRoleView === 'admin' || isCloudAdmin,
      preferredShopId: userProfile?.shopId,
    });
    if (resolved !== activeSellerShopId) {
      setActiveSellerShopId(resolved);
    }
  }, [shops, activeSellerShopId, firebaseUser?.uid, activeRoleView, isCloudAdmin, userProfile?.shopId]);

  // Seller shop orders listener only when authenticated as shop owner or admin
  useEffect(() => {
    if (!firebaseUser || !activeSellerShopId) return;
    const targetShopOwnerUid = shops.find((s) => s.shopId === activeSellerShopId)?.ownerUid;
    const canListenShopOrders =
      isCloudAdmin ||
      (userProfile?.role === 'seller' && targetShopOwnerUid === firebaseUser.uid);
    if (!canListenShopOrders) return;
    const unsubSellerOrders = subscribeToShopOrders(
      activeSellerShopId,
      (cloudSellerOrders) => {
        setSellerOrders(cloudSellerOrders);
      },
      !isCloudAdmin ? firebaseUser.uid : undefined
    );
    return () => unsubSellerOrders();
  }, [firebaseUser, activeSellerShopId, isCloudAdmin, userProfile?.role, shops]);

  // Strict Admin-only Firestore subscriptions (only attached for verified cloud admins)
  useEffect(() => {
    if (!isCloudAdmin) return;
    const unsubUsers = subscribeToAllUsersForAdmin((cloudUsers) => {
      setAdminUsers(cloudUsers);
    });
    const unsubOrders = subscribeToAllOrdersForAdmin((cloudOrders) => {
      setAdminOrders(cloudOrders);
    });
    const unsubReturns = subscribeToAllReturnRequestsForAdmin((cloudReturns) => {
      setAdminReturnRequests(cloudReturns);
    });
    const unsubAudit = subscribeToAdminAuditLogs((cloudLogs) => {
      setAdminAuditLogs(cloudLogs);
    });
    const unsubAllVerifications = subscribeToAllVerificationsForAdmin((cloudVerifications) => {
      setMerchantVerifications(cloudVerifications);
      localStorage.setItem(STORAGE_KEYS.MERCHANT_VERIFICATIONS, JSON.stringify(cloudVerifications));
    });
    const unsubAllChats = subscribeToAllChatThreadsForAdmin((cloudChats) => {
      setAdminCloudChats(cloudChats);
    });
    return () => {
      unsubUsers();
      unsubOrders();
      unsubReturns();
      unsubAudit();
      unsubAllVerifications();
      unsubAllChats();
    };
  }, [isCloudAdmin]);

  // Real-time messages listener for active Buyer-Seller Chat Modal thread
  useEffect(() => {
    if (!firebaseUser || !activeTradeChatThreadId) {
      setCloudActiveChatMessages([]);
      return;
    }
    const isDraftOnly =
      Boolean(draftTradeThreads[activeTradeChatThreadId]) &&
      !buyerCloudChats.some((t) => t.threadId === activeTradeChatThreadId) &&
      !sellerCloudChats.some((t) => t.threadId === activeTradeChatThreadId) &&
      !adminCloudChats.some((t) => t.threadId === activeTradeChatThreadId);
    if (isDraftOnly) {
      setCloudActiveChatMessages([]);
      return;
    }
    const unsubMsgs = subscribeToChatMessages(activeTradeChatThreadId, (msgs) => {
      setCloudActiveChatMessages(msgs);
    });
    return () => unsubMsgs();
  }, [
    firebaseUser,
    activeTradeChatThreadId,
    draftTradeThreads,
    buyerCloudChats,
    sellerCloudChats,
    adminCloudChats,
  ]);

  // Real-time messages listener for Admin Supervision Console thread
  useEffect(() => {
    if (!firebaseUser || !isCloudAdmin || !adminSupervisedThreadId) {
      setCloudAdminSupervisedMessages([]);
      return;
    }
    const unsubAdminMsgs = subscribeToChatMessages(adminSupervisedThreadId, (msgs) => {
      setCloudAdminSupervisedMessages(msgs);
    });
    return () => unsubAdminMsgs();
  }, [firebaseUser, isCloudAdmin, adminSupervisedThreadId]);

  const navigate = (next: AppRoute) => {
    if (next.name === 'search') {
      setSearchSession({
        ...DEFAULT_SEARCH_SESSION,
        queryText: next.initialQuery ?? '',
        category: next.initialCategory ?? 'all',
      });
    }
    setHistory((prev) => {
      const current = prev[prev.length - 1];
      if (JSON.stringify(current) === JSON.stringify(next)) return prev;
      return [...prev.slice(-20), next];
    });
  };

  const refreshCatalogFromFirestore = async () => {
    const snapshot = await fetchCatalogSnapshotFromFirestore();
    setShops(snapshot.shops);
    setProducts(snapshot.products);
  };

  const goBack = () => {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : [{ name: 'home' }]));
  };

  const routePathString = useMemo(() => {
    switch (route.name) {
      case 'onboarding':
        return '/onboarding';
      case 'home':
        return '/(customer)/index';
      case 'search':
        return '/(customer)/search';
      case 'categories':
        return '/(customer)/categories';
      case 'product':
        return `/product/${route.productId}`;
      case 'shop':
        return `/shop/${route.shopId}`;
      case 'shops':
        return '/(customer)/shops';
      case 'coffee_traders':
        return route.initialShopId
          ? `/(customer)/coffee-traders?shop=${route.initialShopId}`
          : '/(customer)/coffee-traders';
      case 'cart':
        return '/(customer)/cart';
      case 'checkout':
        return '/checkout/index';
      case 'order_confirmation':
        return `/checkout/confirmation?id=${route.orderId}`;
      case 'orders':
        return route.selectedOrderId ? `/order/${route.selectedOrderId}` : '/(customer)/orders';
      case 'favorites':
        return '/(customer)/favorites';
      case 'notifications':
        return '/notifications/index';
      case 'profile':
        return `/(customer)/profile${route.section && route.section !== 'main' ? `/${route.section}` : ''}`;
      case 'loyalty':
        return '/rewards/loyalty';
      case 'shared_wishlist':
        return `/wishlist/${route.shareId}`;
      case 'seller':
        return `/seller/${route.tab ?? 'dashboard'}`;
      case 'admin':
        return `/admin/${route.tab ?? 'overview'}`;
      case 'map':
        return route.shopId ? `/explore/map?shop=${route.shopId}` : '/explore/map';
      case 'chat':
        return '/concierge/chat';
      case 'video':
        return '/studio/video';
    }
  }, [route]);

  const needsEmailVerification = Boolean(
    firebaseUser &&
      !isEmailVerified &&
      isUserPendingEmailVerification({
        email: firebaseUser.email,
        emailVerified: isEmailVerified,
        phoneNumber: firebaseUser.phoneNumber,
        providerIds: firebaseUser.providerData.map((p) => p.providerId),
      })
  );

  const isAuthGateActive =
    !authLoading &&
    !guestAccessGranted &&
    route.name !== 'shared_wishlist' &&
    (!firebaseUser || needsEmailVerification);

  const continueAsGuest = () => {
    setAuthError(null);
    setGuestAccessGranted(true);
    localStorage.setItem(STORAGE_KEYS.ONBOARDED, JSON.stringify(true));
    if (route.name === 'onboarding') {
      setHistory([{ name: 'home' }]);
    }
  };

  const openAuthScreen = () => {
    setAuthError(null);
    setGuestAccessGranted(false);
    setHistory([{ name: 'home' }]);
  };

  const clearAuthError = () => setAuthError(null);
  const clearEmailVerificationNotice = () => setEmailVerificationNotice(null);
  const clearWelcomeBackNotice = () => setWelcomeBackNotice(null);

  const mapFirebaseAuthError = (
    err: unknown,
    fallback: string,
    channel: 'phone' | 'email' | 'google' = 'phone'
  ): string => {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code ?? '')
        : '';
    switch (code) {
      case 'auth/operation-not-allowed':
        return channel === 'email'
          ? 'Email/Password sign-in is not enabled yet in Firebase Console → Authentication → Sign-in method.'
          : 'Phone (SMS) sign-in is not enabled yet in Firebase Console → Authentication → Sign-in method.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Switch to Sign In or use Google Sign-In.';
      case 'auth/invalid-email':
        return t('authErrorInvalidEmail');
      case 'auth/weak-password':
        return t('authErrorPasswordLength');
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect email or password. Please check your credentials and try again.';
      case 'auth/network-request-failed':
        return 'Network error while connecting to Firebase Authentication. Please check your connection.';
      case 'auth/unauthorized-domain':
        return `This domain (${typeof window !== 'undefined' ? window.location.hostname : 'preview'}) is not listed under Firebase Console → Authentication → Settings → Authorized domains.`;
      case 'auth/invalid-phone-number':
        return 'Invalid phone number format. Use +251 9XX XXX XXX or 09XX XXX XXX.';
      case 'auth/missing-phone-number':
        return 'Please enter your mobile phone number.';
      case 'auth/invalid-verification-code':
        return 'Incorrect 6-digit SMS code. Please check the message and try again.';
      case 'auth/code-expired':
        return 'This verification code has expired. Tap Resend Code for a new SMS.';
      case 'auth/too-many-requests':
        return 'Too many verification attempts. Please wait a few minutes before trying again.';
      case 'auth/captcha-check-failed':
        return 'Security verification (reCAPTCHA) failed. Please refresh and try again.';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in popup was closed before finishing.';
      case 'auth/popup-blocked':
        return 'Sign-in popup was blocked by your browser. Allow popups or use Email / Phone sign-in.';
      default:
        return err instanceof Error ? err.message : fallback;
    }
  };

  const cleanupRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // ignore cleanup error if already cleared
      }
      recaptchaVerifierRef.current = null;
    }
    if (typeof document !== 'undefined') {
      const container = document.getElementById('hg-phone-recaptcha-container');
      if (container) {
        container.innerHTML = '';
      }
    }
  };

  const resetPhoneOtp = () => {
    confirmationResultRef.current = null;
    pendingPhoneDisplayNameRef.current = '';
    cleanupRecaptcha();
    setPhoneOtpState({
      step: 'idle',
      formattedPhone: '',
      pendingDisplayName: '',
    });
    setAuthError(null);
  };

  const dispatchWelcomeBackWorkflow = async (user: FirebaseUser): Promise<void> => {
    const email = user.email?.trim();
    if (!email) return;

    const nowMs = Date.now();
    if (
      welcomeBackSentAtRef.current &&
      welcomeBackSentAtRef.current.uid === user.uid &&
      nowMs - welcomeBackSentAtRef.current.at < 10000
    ) {
      return;
    }
    welcomeBackSentAtRef.current = { uid: user.uid, at: nowMs };

    let resolvedProfile = userProfile?.uid === user.uid ? userProfile : null;
    if (!resolvedProfile) {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          resolvedProfile = snap.data() as UserProfile;
        }
      } catch {
        // Fallback cleanly to FirebaseUser & local state
      }
    }

    const displayName =
      resolvedProfile?.displayName?.trim() ||
      user.displayName?.trim() ||
      'Hawassa Shopper';
    const neighborhood =
      resolvedProfile?.neighborhood?.trim() ||
      (selectedNeighborhood !== 'All Hawassa' ? selectedNeighborhood : 'All Hawassa');
    const localizedNeighborhood = getLocalizedNeighborhood(neighborhood, language);
    const loginTimestamp = new Date().toISOString();

    let mode = 'simulated_or_smtp';
    try {
      const resp = await fetch('/api/auth/welcome-back-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          displayName,
          neighborhood,
          language,
          loginTimestamp,
        }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { mode?: string };
        if (data?.mode) mode = data.mode;
      }
    } catch (err) {
      console.warn('Welcome-back email request notice:', err);
    }

    const notif: NotificationItem = {
      notificationId: `notif-login-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
      userUid: user.uid,
      title: t('welcomeBackSecurityNotifTitle', { name: displayName }),
      message: t('welcomeBackSecurityNotifDesc', {
        email,
        neighborhood: localizedNeighborhood,
      }),
      type: 'system',
      isRead: false,
      createdAt: loginTimestamp,
    };

    setNotifications((prev) => {
      const updated = [notif, ...prev].slice(0, 40);
      localStorage.setItem(STORAGE_KEYS.LOCAL_NOTIFS, JSON.stringify(updated));
      return updated;
    });
    void saveNotificationInFirestore(notif).catch((err) => {
      console.warn('Welcome-back notification persistence skipped:', err);
    });

    setWelcomeBackNotice({
      displayName,
      email,
      neighborhood,
      loginTimestamp,
      mode,
    });

    setCartToast({
      id: Date.now(),
      message: t('welcomeBackToast', { name: displayName, email }),
      actionLabel: t('notifications'),
      actionRoute: { name: 'notifications' },
    });
  };

  const signInWithGoogle = async (): Promise<boolean> => {
    setAuthError(null);
    setWelcomeBackNotice(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      localStorage.setItem(STORAGE_KEYS.ONBOARDED, JSON.stringify(true));

      const additionalInfo = getAdditionalUserInfo(result);
      let hadExistingProfileDoc = false;
      if (additionalInfo?.isNewUser == null) {
        try {
          const snap = await getDoc(doc(db, 'users', result.user.uid));
          hadExistingProfileDoc =
            snap.exists() && !newlyCreatedInSessionUidsRef.current.has(result.user.uid);
        } catch {
          hadExistingProfileDoc = false;
        }
      }

      const isReturning = isReturningGoogleSignIn({
        isNewUser: additionalInfo?.isNewUser,
        creationTime: result.user.metadata?.creationTime,
        lastSignInTime: result.user.metadata?.lastSignInTime,
        hadExistingProfileDoc,
      });

      if (isReturning && result.user.email) {
        void dispatchWelcomeBackWorkflow(result.user);
      }

      return true;
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, 'Google Sign-In failed.', 'google'));
      return false;
    }
  };

  const sendVerificationEmailToUser = async (user: FirebaseUser): Promise<boolean> => {
    auth.languageCode = language === 'am' ? 'am' : 'en';
    await sendEmailVerification(user);
    setEmailVerificationCooldown(60);
    setEmailVerificationNotice(
      t('emailVerifySentNotice', { email: user.email || '' })
    );
    return true;
  };

  const resendVerificationEmail = async (): Promise<{ ok: boolean; error?: string }> => {
    setAuthError(null);
    const current = auth.currentUser;
    if (!current || !current.email) {
      const msg = t('authErrorInvalidEmail');
      setAuthError(msg);
      return { ok: false, error: msg };
    }
    if (emailVerificationCooldown > 0) {
      const msg = t('emailVerifyCooldownWait', { seconds: emailVerificationCooldown });
      return { ok: false, error: msg };
    }
    try {
      await sendVerificationEmailToUser(current);
      return { ok: true };
    } catch (err) {
      const msg = mapFirebaseAuthError(err, 'Could not resend verification email.', 'email');
      setAuthError(msg);
      return { ok: false, error: msg };
    }
  };

  const checkEmailVerificationStatus = async (): Promise<{
    verified: boolean;
    error?: string;
  }> => {
    setAuthError(null);
    const current = auth.currentUser;
    if (!current) {
      return { verified: false, error: 'No active session found.' };
    }
    try {
      await reload(current);
      const verified = Boolean(auth.currentUser?.emailVerified);
      setIsEmailVerified(verified);
      if (verified) {
        setEmailVerificationNotice(null);
        setGuestAccessGranted(true);
        localStorage.setItem(STORAGE_KEYS.ONBOARDED, JSON.stringify(true));
        setCartToast({
          id: Date.now(),
          message: t('emailVerifyConfirmedToast'),
        });
        if (isSuperAdminEmail(auth.currentUser?.email)) {
          await seedCatalogToFirestore(true);
          if (userProfile && (userProfile.role !== 'admin' || userProfile.accountStatus !== 'active')) {
            const upgraded: UserProfile = {
              ...userProfile,
              role: 'admin',
              accountStatus: 'active',
              updatedAt: new Date().toISOString(),
            };
            setUserProfile(upgraded);
            try {
              await saveUserProfileInFirestore(upgraded);
            } catch (upgradeErr) {
              console.warn('Could not upgrade verified super-admin profile:', upgradeErr);
            }
          }
        }
        if (route.name === 'onboarding') {
          setHistory([{ name: 'home' }]);
        }
        return { verified: true };
      }
      return { verified: false, error: t('emailVerifyNotYetPrompt') };
    } catch (err) {
      const msg = mapFirebaseAuthError(err, 'Could not check verification status.', 'email');
      setAuthError(msg);
      return { verified: false, error: msg };
    }
  };

  const signInWithEmailPassword = async (params: {
    emailOrPhone: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<{ ok: boolean; switchToPhoneOtp?: string; error?: string }> => {
    setAuthError(null);
    setEmailVerificationNotice(null);
    setWelcomeBackNotice(null);
    const check = validateEmailSignInInput(params);
    if (check.mode === 'phone_redirect' && check.normalizedPhone) {
      const msg = t('authSignInPhoneUseOtpHint');
      setAuthError(msg);
      return { ok: false, switchToPhoneOtp: check.normalizedPhone, error: msg };
    }
    if (!check.valid || !check.normalizedEmail) {
      const firstErrKey =
        check.errors.emailOrPhone || check.errors.password || 'authErrorInvalidEmail';
      const msg = t(firstErrKey);
      setAuthError(msg);
      return { ok: false, error: msg };
    }
    try {
      if (typeof params.rememberMe === 'boolean') {
        try {
          await setPersistence(
            auth,
            params.rememberMe ? browserLocalPersistence : browserSessionPersistence
          );
        } catch (persistErr) {
          console.warn('Auth persistence update skipped:', persistErr);
        }
      }
      const cred = await signInWithEmailAndPassword(
        auth,
        check.normalizedEmail,
        params.password
      );
      setIsEmailVerified(Boolean(cred.user.emailVerified));
      localStorage.setItem(STORAGE_KEYS.ONBOARDED, JSON.stringify(true));
      if (cred.user.email && !cred.user.emailVerified) {
        setGuestAccessGranted(false);
        try {
          await sendVerificationEmailToUser(cred.user);
        } catch (verifyErr) {
          console.warn('Could not send verification email on sign-in:', verifyErr);
        }
      } else if (cred.user.email) {
        void dispatchWelcomeBackWorkflow(cred.user);
      }
      return { ok: true };
    } catch (err) {
      const msg = mapFirebaseAuthError(err, 'Sign-in failed.', 'email');
      setAuthError(msg);
      return { ok: false, error: msg };
    }
  };

  const resetPasswordByEmail = async (
    emailInput: string
  ): Promise<{ ok: boolean; error?: string }> => {
    setAuthError(null);
    const cleanEmail = (emailInput ?? '').trim().toLowerCase();
    if (!isEmailFormat(cleanEmail)) {
      const msg = t('authErrorInvalidEmail');
      setAuthError(msg);
      return { ok: false, error: msg };
    }
    try {
      auth.languageCode = language === 'am' ? 'am' : 'en';
      await sendPasswordResetEmail(auth, cleanEmail);
      return { ok: true };
    } catch (err) {
      const msg = mapFirebaseAuthError(err, 'Could not send password reset email.', 'email');
      setAuthError(msg);
      return { ok: false, error: msg };
    }
  };

  const registerWithEmailPassword = async (params: {
    fullName: string;
    email: string;
    phoneNumber: string;
    neighborhood: string;
    accountType: 'customer' | 'seller';
    password: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    setAuthError(null);
    setEmailVerificationNotice(null);
    const check = validateRegistrationInput(params);
    if (!check.valid) {
      const firstErrKey =
        check.errors.fullName ||
        check.errors.email ||
        check.errors.phoneNumber ||
        check.errors.password ||
        'authErrorInvalidEmail';
      const msg = t(firstErrKey);
      setAuthError(msg);
      return { ok: false, error: msg };
    }

    const normalizedRole: 'customer' | 'seller' =
      params.accountType === 'seller' ? 'seller' : 'customer';

    pendingRegistrationProfileRef.current = {
      displayName: check.normalizedName,
      phoneNumber: check.normalizedPhone,
      neighborhood: check.normalizedNeighborhood,
      role: normalizedRole,
    };

    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        check.normalizedEmail,
        params.password
      );
      setIsEmailVerified(Boolean(cred.user.emailVerified));
      setGuestAccessGranted(false);
      try {
        await updateProfile(cred.user, { displayName: check.normalizedName });
      } catch {
        // non-critical displayName sync
      }
      const now = new Date().toISOString();
      const isAdminEmail = Boolean(
        cred.user.emailVerified && isSuperAdminEmail(cred.user.email)
      );
      const profile: UserProfile = {
        uid: cred.user.uid,
        displayName: check.normalizedName,
        email: check.normalizedEmail,
        phoneNumber: check.normalizedPhone,
        neighborhood: check.normalizedNeighborhood,
        role: isAdminEmail ? 'admin' : normalizedRole,
        accountStatus: 'active',
        preferredLanguage: language,
        preferredTheme: themePreference,
        createdAt: now,
        updatedAt: now,
      };
      await saveUserProfileInFirestore(profile);
      setUserProfile(profile);
      setSelectedNeighborhood(check.normalizedNeighborhood);
      localStorage.setItem(STORAGE_KEYS.ONBOARDED, JSON.stringify(true));
      pendingRegistrationProfileRef.current = null;
      if (cred.user.email && !cred.user.emailVerified) {
        try {
          await sendVerificationEmailToUser(cred.user);
        } catch (verifyErr) {
          console.warn('Could not send initial verification email:', verifyErr);
        }
      }
      return { ok: true };
    } catch (err) {
      pendingRegistrationProfileRef.current = null;
      const msg = mapFirebaseAuthError(err, 'Account creation failed.', 'email');
      setAuthError(msg);
      return { ok: false, error: msg };
    }
  };

  const sendPhoneOtp = async (
    phoneInput: string,
    displayNameInput?: string
  ): Promise<{ ok: boolean; formattedPhone?: string; error?: string }> => {
    setAuthError(null);
    const normalized = normalizePhoneToE164(phoneInput);
    if (!normalized.valid) {
      const msg = t(normalized.errorKey || 'phoneAuthErrorInvalid');
      setAuthError(msg);
      return { ok: false, error: msg };
    }

    const cleanName = (displayNameInput ?? '').trim().slice(0, 100);
    pendingPhoneDisplayNameRef.current = cleanName;
    setPhoneOtpState({
      step: 'sending',
      formattedPhone: normalized.e164,
      pendingDisplayName: cleanName,
    });

    try {
      cleanupRecaptcha();
      let containerEl =
        typeof document !== 'undefined'
          ? document.getElementById('hg-phone-recaptcha-container')
          : null;
      if (!containerEl && typeof document !== 'undefined') {
        containerEl = document.createElement('div');
        containerEl.id = 'hg-phone-recaptcha-container';
        containerEl.className = 'sr-only';
        document.body.appendChild(containerEl);
      }
      if (!containerEl) {
        throw new Error('Phone verification container unavailable.');
      }

      const verifier = new RecaptchaVerifier(auth, containerEl, {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved automatically
        },
        'expired-callback': () => {
          setAuthError('Security check expired. Please request a new code.');
        },
      });
      recaptchaVerifierRef.current = verifier;

      const confirmation = await signInWithPhoneNumber(auth, normalized.e164, verifier);
      confirmationResultRef.current = confirmation;
      setPhoneOtpState({
        step: 'code_sent',
        formattedPhone: normalized.e164,
        pendingDisplayName: cleanName,
      });
      return { ok: true, formattedPhone: normalized.e164 };
    } catch (err) {
      cleanupRecaptcha();
      const msg = mapFirebaseAuthError(err, 'Could not send SMS verification code.');
      setAuthError(msg);
      setPhoneOtpState({
        step: 'idle',
        formattedPhone: normalized.e164,
        pendingDisplayName: cleanName,
      });
      return { ok: false, error: msg };
    }
  };

  const verifyPhoneOtp = async (
    otpCode: string,
    displayNameInput?: string
  ): Promise<{ ok: boolean; error?: string }> => {
    setAuthError(null);
    const cleanCode = otpCode.trim();
    if (!isValidOtpCode(cleanCode)) {
      const msg = t('phoneAuthErrorOtpInvalid');
      setAuthError(msg);
      return { ok: false, error: msg };
    }

    const confirmation = confirmationResultRef.current;
    if (!confirmation) {
      const msg = 'Session expired. Please request a new SMS code.';
      setAuthError(msg);
      setPhoneOtpState((prev) => ({ ...prev, step: 'idle' }));
      return { ok: false, error: msg };
    }

    const desiredName = (displayNameInput ?? phoneOtpState.pendingDisplayName).trim().slice(0, 100);
    if (desiredName) {
      pendingPhoneDisplayNameRef.current = desiredName;
    }

    setPhoneOtpState((prev) => ({ ...prev, step: 'verifying' }));

    try {
      const credential = await confirmation.confirm(cleanCode);
      if (desiredName && !credential.user.displayName) {
        try {
          await updateProfile(credential.user, { displayName: desiredName });
        } catch {
          // ignore non-critical profile displayName update error
        }
      }
      confirmationResultRef.current = null;
      cleanupRecaptcha();
      setPhoneOtpState({
        step: 'idle',
        formattedPhone: '',
        pendingDisplayName: '',
      });
      return { ok: true };
    } catch (err) {
      const msg = mapFirebaseAuthError(err, 'Invalid SMS verification code.');
      setAuthError(msg);
      setPhoneOtpState((prev) => ({ ...prev, step: 'code_sent' }));
      return { ok: false, error: msg };
    }
  };

  const signOutUser = async () => {
    resetPhoneOtp();
    await signOut(auth);
    setIsEmailVerified(false);
    setEmailVerificationCooldown(0);
    setEmailVerificationNotice(null);
    setWelcomeBackNotice(null);
    newlyCreatedInSessionUidsRef.current.clear();
    welcomeBackSentAtRef.current = null;
    setGuestAccessGranted(false);
    setActiveRoleView('customer');
    setLoyaltyTransactions(readStorage<LoyaltyTransaction[]>(STORAGE_KEYS.LOYALTY_TX, []));
    setPriceAlerts(readStorage<PriceAlert[]>(STORAGE_KEYS.PRICE_ALERTS, []));
    setRedeemLoyaltyPointsState(0);
    setHistory([{ name: 'home' }]);
  };

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, JSON.stringify(lang));
    if (firebaseUser && userProfile) {
      const updatedProfile: UserProfile = {
        ...userProfile,
        preferredLanguage: lang,
        updatedAt: new Date().toISOString(),
      };
      setUserProfile(updatedProfile);
      saveUserProfileInFirestore(updatedProfile).catch((err) => {
        console.warn('Could not sync preferredLanguage to Firestore:', err);
      });
    }
  };

  const setThemePreference = (nextTheme: ThemePreference) => {
    const validTheme: ThemePreference = isValidThemePreference(nextTheme) ? nextTheme : 'dark';
    setThemePreferenceState(validTheme);
    const nextResolved = resolveThemePreference(validTheme, systemPrefersDark);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', nextResolved === 'dark');
      document.documentElement.style.colorScheme = nextResolved;
    }
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(validTheme));
    } catch {
      // ignore storage errors
    }
  };

  const toggleTheme = () => {
    setThemePreference(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const setSelectedNeighborhood = (n: string) => {
    setSelectedNeighborhoodState(n);
    localStorage.setItem(STORAGE_KEYS.NEIGHBORHOOD, JSON.stringify(n));
    setLocationError(null);
    if (n !== 'All Hawassa') {
      const nextLoc: UserLocationState = {
        coords: getNeighborhoodCoordinates(n),
        label: n,
        neighborhood: n,
        source: 'neighborhood',
        updatedAt: new Date().toISOString(),
      };
      setUserLocation(nextLoc);
      localStorage.setItem(STORAGE_KEYS.USER_LOCATION, JSON.stringify(nextLoc));
    } else if (userLocation?.source === 'neighborhood') {
      setUserLocation(null);
      localStorage.removeItem(STORAGE_KEYS.USER_LOCATION);
    }
  };

  const completeOnboarding = () => {
    localStorage.setItem(STORAGE_KEYS.ONBOARDED, JSON.stringify(true));
    setHistory([{ name: 'home' }]);
  };

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let text = translations[language]?.[key] ?? translations.en[key] ?? key;
    if (vars) {
      for (const [varKey, value] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${varKey}\\}`, 'g'), String(value));
      }
    }
    return text;
  };

  const shopsById = useMemo(() => {
    const map: Record<string, Shop> = {};
    for (const s of shops) map[s.shopId] = s;
    return map;
  }, [shops]);

  const addRecentSearch = (q: string) => {
    const clean = q.trim();
    if (!clean) return;
    setRecentSearches((prev) => [clean, ...prev.filter((item) => item !== clean)].slice(0, 6));
  };

  const setPromoCode = (code: string) => {
    setPromoCodeState(code.trim().toUpperCase());
  };

  const loyaltyStats = useMemo(
    () => calculateLoyaltyBalanceFromTransactions(loyaltyTransactions),
    [loyaltyTransactions]
  );

  const setRedeemLoyaltyPoints = (points: number) => {
    const clean = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
    setRedeemLoyaltyPointsState(Math.min(clean, loyaltyStats.balance));
  };

  const dismissCartToast = () => setCartToast(null);

  const addToCart = (product: Product, quantity: number = 1, variant?: ProductVariant) => {
    const resolvedVariant =
      variant ??
      (product.variants && product.variants.length > 0
        ? product.variants.find((v) => v.price === product.price) ?? product.variants[0]
        : undefined);
    const maxStock = resolvedVariant?.stock ?? product.stock;
    const itemKey = getCartItemKey(product.productId, resolvedVariant?.id);

    setCart((prev) => {
      const existing = prev.find(
        (c) => getCartItemKey(c.product.productId, c.variantId) === itemKey
      );
      if (existing) {
        const nextQty = Math.min(maxStock, existing.quantity + quantity);
        return prev.map((c) =>
          getCartItemKey(c.product.productId, c.variantId) === itemKey
            ? { ...c, quantity: nextQty }
            : c
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: Math.min(maxStock, Math.max(1, quantity)),
          shopId: product.shopId,
          variantId: resolvedVariant?.id,
          variantLabel: resolvedVariant?.label,
          unitPrice: resolvedVariant?.price ?? product.price,
        },
      ];
    });
    setCartToast({
      id: Date.now(),
      message: t('addedProductToCart', { name: product.name }),
    });
  };

  const updateCartQuantity = (productId: string, quantity: number, variantId?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
      return;
    }
    const targetKey = getCartItemKey(productId, variantId);
    setCart((prev) =>
      prev.map((item) => {
        if (getCartItemKey(item.product.productId, item.variantId) !== targetKey) return item;
        const maxStock =
          item.variantId && item.product.variants
            ? item.product.variants.find((v) => v.id === item.variantId)?.stock ?? item.product.stock
            : item.product.stock;
        return { ...item, quantity: Math.min(maxStock, quantity) };
      })
    );
  };

  const removeFromCart = (productId: string, variantId?: string) => {
    const targetKey = getCartItemKey(productId, variantId);
    setCart((prev) =>
      prev.filter((item) => getCartItemKey(item.product.productId, item.variantId) !== targetKey)
    );
  };

  const clearCart = (shopId?: string) => {
    if (!shopId) {
      setCart([]);
    } else {
      setCart((prev) => prev.filter((item) => item.shopId !== shopId));
    }
  };

  const syncCartWithLiveCatalog = (shopId?: string) => {
    setCart((prev) => {
      const targetItems = shopId ? prev.filter((i) => i.shopId === shopId) : prev;
      const { entries } = reconcileCartWithCatalog(
        targetItems,
        products,
        shopsById,
        governanceConfig.strictShopVerification
      );
      const entryByKey = new Map(
        entries.map((e) => [getCartItemKey(e.item.product.productId, e.item.variantId), e])
      );
      let changed = false;
      const next = prev.map((item) => {
        const key = getCartItemKey(item.product.productId, item.variantId);
        const match = entryByKey.get(key);
        if (!match) return item;
        const clampedQty = match.isUnavailable
          ? item.quantity
          : Math.min(item.quantity, Math.max(1, match.availableStock));
        if (
          match.priceChanged ||
          clampedQty !== item.quantity ||
          match.reconciledItem.product.updatedAt !== item.product.updatedAt
        ) {
          changed = true;
          return { ...match.reconciledItem, quantity: clampedQty };
        }
        return item;
      });
      return changed ? next : prev;
    });
  };

  const toggleFavorite = (productId: string) => {
    setFavorites((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const saveWishlistToFavorites = (productIds: string[]) => {
    const valid = sanitizeWishlistProductIds(productIds);
    if (valid.length === 0) return;
    setFavorites((prev) => Array.from(new Set([...prev, ...valid])));
  };

  const addWishlistToCart = (productIds: string[]): number => {
    const valid = sanitizeWishlistProductIds(productIds);
    let addedCount = 0;
    for (const pid of valid) {
      const prod = products.find((p) => p.productId === pid);
      if (!prod || !prod.isAvailable || prod.stock <= 0 || prod.status !== 'active') continue;
      addToCart(prod, 1);
      addedCount += 1;
    }
    if (addedCount > 0) {
      setCartToast({
        id: Date.now(),
        message: t('addedAllToCartToast', { count: addedCount }),
      });
    }
    return addedCount;
  };

  const shareWishlist = async (
    title?: string
  ): Promise<{ wishlist: SharedWishlist; shareUrl: string }> => {
    const cleanIds = sanitizeWishlistProductIds(
      favorites.filter((id) => products.some((p) => p.productId === id && p.status === 'active'))
    );
    if (cleanIds.length === 0) {
      throw new Error('Save at least one product to your favorites before sharing.');
    }

    const storedMap = readStorage<Record<string, SharedWishlist>>(STORAGE_KEYS.SHARED_WISHLISTS, {});
    const existingShareId = readStorage<string>(STORAGE_KEYS.MY_WISHLIST_SHARE_ID, '');
    const shareId =
      existingShareId && /^[a-zA-Z0-9_-]{4,64}$/.test(existingShareId)
        ? existingShareId
        : `wl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    const now = new Date().toISOString();
    const existingRecord = storedMap[shareId];
    const cleanTitle = (title ?? '').trim().slice(0, 120) || t('wishlistDefaultTitle');
    const ownerUid = firebaseUser?.uid ?? 'guest-local';
    const ownerName = (firebaseUser?.displayName || 'Hawassa Shopper').trim().slice(0, 100);

    const wishlist: SharedWishlist = {
      shareId,
      ownerUid,
      ownerName,
      title: cleanTitle,
      productIds: cleanIds,
      createdAt: existingRecord?.createdAt ?? now,
      updatedAt: now,
    };

    if (firebaseUser) {
      await saveSharedWishlistInFirestore(wishlist);
    }

    const nextMap = { ...storedMap, [shareId]: wishlist };
    localStorage.setItem(STORAGE_KEYS.SHARED_WISHLISTS, JSON.stringify(nextMap));
    localStorage.setItem(STORAGE_KEYS.MY_WISHLIST_SHARE_ID, JSON.stringify(shareId));

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://hawasagebeya.et';
    const shareUrl = buildWishlistShareUrl(
      origin,
      shareId,
      firebaseUser ? undefined : cleanIds
    );
    return { wishlist, shareUrl };
  };

  const loadSharedWishlist = async (
    shareId: string,
    fallbackProductIds?: string[]
  ): Promise<SharedWishlist | null> => {
    const cleanShareId = shareId.trim();
    if (!cleanShareId) return null;

    const storedMap = readStorage<Record<string, SharedWishlist>>(STORAGE_KEYS.SHARED_WISHLISTS, {});
    const localMatch = storedMap[cleanShareId] ?? null;

    try {
      const cloudMatch = await getSharedWishlistFromFirestore(cleanShareId);
      if (cloudMatch) return cloudMatch;
    } catch {
      // Fall back cleanly to local storage or URL snapshot if cloud read is unavailable
    }

    if (localMatch) return localMatch;

    const safeFallback = sanitizeWishlistProductIds(fallbackProductIds ?? []);
    if (safeFallback.length > 0) {
      const now = new Date().toISOString();
      return {
        shareId: cleanShareId,
        ownerUid: 'guest-shared',
        ownerName: 'Hawassa Shopper',
        title: t('wishlistDefaultTitle'),
        productIds: safeFallback,
        createdAt: now,
        updatedAt: now,
      };
    }

    return null;
  };

  const toggleFollowShop = (shopId: string) => {
    const cleanId = shopId.trim();
    if (!cleanId) return;
    const wasFollowed = followedShops.includes(cleanId);
    const next = toggleUniqueId(followedShops, cleanId);
    const shopName = shops.find((s) => s.shopId === cleanId)?.name ?? 'Shop';
    setFollowedShops(next);
    setCartToast({
      id: Date.now(),
      message: t(wasFollowed ? 'favoriteShopRemovedToast' : 'favoriteShopAddedToast', {
        shop: shopName,
      }),
      actionRoute: null,
    });
    if (firebaseUser && userProfile) {
      const updatedProfile: UserProfile = {
        ...userProfile,
        favoriteShopIds: next,
        updatedAt: new Date().toISOString(),
      };
      setUserProfile(updatedProfile);
      void saveUserProfileInFirestore(updatedProfile).catch((err) => {
        console.warn('Could not sync favorite shops to Firestore:', err);
      });
    }
  };

  const recordProductView = (productId: string) => {
    setRecentlyViewedIds((prev) => [productId, ...prev.filter((id) => id !== productId)].slice(0, 8));
  };

  const setDeliveryFeeEtb = (fee: number) => {
    const clean = Math.max(0, Math.round(fee));
    setDeliveryFeeEtbState(clean);
    void updateGovernanceConfig({ deliveryFeeEtb: clean }, 'Updated standard delivery fee');
  };

  const reorderFromOrder = (order: Order): { addedCount: number; skippedCount: number } => {
    let addedCount = 0;
    let skippedCount = 0;
    for (const item of order.items) {
      const liveProd = products.find((p) => p.productId === item.productId);
      if (!liveProd || !liveProd.isAvailable || liveProd.stock <= 0 || liveProd.status !== 'active') {
        skippedCount += 1;
        continue;
      }
      const matchedVariant = item.variantLabel
        ? liveProd.variants?.find((v) => v.label === item.variantLabel)
        : undefined;
      addToCart(liveProd, Math.min(item.quantity, matchedVariant?.stock ?? liveProd.stock), matchedVariant);
      addedCount += 1;
    }
    if (addedCount > 0) {
      setCartToast({ id: Date.now(), message: t('reorderedToast') });
    }
    return { addedCount, skippedCount };
  };

  const placeOrder = async ({
    shopId,
    fulfillmentMethod,
    deliveryAddress,
    paymentMethod,
    paymentReference,
    notes,
    promoCode: explicitPromo,
    pointsToRedeem: explicitPointsToRedeem,
    idempotencyKey,
  }: {
    shopId: string;
    fulfillmentMethod: 'delivery' | 'pickup';
    deliveryAddress?: CustomerAddress;
    paymentMethod: PaymentMethod;
    paymentReference?: string;
    notes?: string;
    promoCode?: string;
    pointsToRedeem?: number;
    idempotencyKey?: string;
  }): Promise<Order> => {
    const rawShopItems = cart.filter((c) => c.shopId === shopId);
    const shop = shopsById[shopId];
    if (!shop || rawShopItems.length === 0) {
      throw new Error('No valid items for this shop in your cart.');
    }

    const reconciled = reconcileCartWithCatalog(
      rawShopItems,
      products,
      shopsById,
      governanceConfig.strictShopVerification
    );
    if (reconciled.hasBlockingIssues) {
      throw new Error(t('removeUnavailableHint'));
    }
    const shopItems = reconciled.reconciledCart;

    const refValidation = validatePaymentReference(paymentMethod, paymentReference);
    if (!refValidation.valid) {
      throw new Error(t(refValidation.errorKey ?? 'paymentReferenceInvalidError'));
    }

    const activeCode = explicitPromo ?? promoCode;
    const requestedRedeem = explicitPointsToRedeem ?? redeemLoyaltyPoints;
    const summary = calculateCartSummary(
      shopItems,
      fulfillmentMethod,
      deliveryFeeEtb,
      activeCode,
      requestedRedeem,
      loyaltyStats.balance,
      governanceConfig.freeDeliveryThresholdEtb
    );
    const subtotal = summary.subtotal;
    const deliveryFee = summary.deliveryFee;
    const totalAmount = summary.totalAmount;

    const govCheck = validateOrderAgainstGovernance({
      config: governanceConfig,
      userProfile,
      shop,
      totalAmount,
    });
    if (!govCheck.allowed) {
      throw new Error(
        govCheck.customMessage ||
          t(govCheck.errorKey ?? 'governanceOrderingPaused', {
            limit: formatETB(governanceConfig.maxOrderAmountEtb),
          })
      );
    }

    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    let orderId = `ord-${nowMs}-${Math.random().toString(36).slice(2, 6)}`;
    let deliveryPin = generateDeliveryPin();
    let serverVerifiedPaid = false;

    if (firebaseUser) {
      const stripDataUrl = (url?: string) =>
        url && url.startsWith('data:image/') ? '' : url;
      const slimShop: Shop = {
        ...shop,
        logoUrl: stripDataUrl(shop.logoUrl) || '',
        coverImageUrl: stripDataUrl(shop.coverImageUrl) || '',
      };
      const slimCatalogProducts = products
        .filter((p) => p.shopId === shop.shopId)
        .map((p) => ({
          ...p,
          imageUrl: stripDataUrl(p.imageUrl) || '',
          ...(p.additionalImages ? { additionalImages: [] } : {}),
        }));
      const slimCartItems = shopItems.map((ci) => ({
        ...ci,
        product: {
          ...ci.product,
          imageUrl: stripDataUrl(ci.product.imageUrl) || '',
          ...(ci.product.additionalImages ? { additionalImages: [] } : {}),
        },
      }));

      let initRes: Response | null = null;
      try {
        const idToken = await firebaseUser.getIdToken();
        initRes = await fetch('/api/payments/initiate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
          },
          body: JSON.stringify({
            idempotencyKey,
            shopId: shop.shopId,
            shop: slimShop,
            catalogProducts: slimCatalogProducts,
            cartItems: slimCartItems,
            fulfillmentMethod,
            deliveryAddress,
            deliveryFeeEtb,
            promoCode: activeCode,
            pointsToRedeem: requestedRedeem,
            availableLoyaltyPoints: loyaltyStats.balance,
            paymentMethod,
            paymentReference: refValidation.normalizedRef || undefined,
            governanceConfig,
            userProfile,
            customerEmail: firebaseUser?.email || userProfile?.email || undefined,
            customerName:
              deliveryAddress?.recipientName || firebaseUser?.displayName || undefined,
            customerPhone: deliveryAddress?.phoneNumber || undefined,
          }),
        });
      } catch {
        // Offline / network fallback keeps serverVerifiedPaid false so electronic payments remain 'pending'
      }

      if (initRes) {
        if (!initRes.ok) {
          const errJson = (await initRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(
            errJson.error || 'Payment initiation was rejected by the server. Please try again.'
          );
        }
        const initData = (await initRes.json()) as {
          orderId?: string;
          deliveryPin?: string;
          verifiedPaid?: boolean;
        };
        if (initData.orderId) orderId = initData.orderId;
        if (initData.deliveryPin && /^\d{4}$/.test(initData.deliveryPin)) {
          deliveryPin = initData.deliveryPin;
        }
        if (initData.verifiedPaid === true) {
          serverVerifiedPaid = true;
        }
      }
    }

    const customerUid = firebaseUser?.uid ?? 'guest-local';
    const deliveryEtaLabel =
      fulfillmentMethod === 'delivery'
        ? getNeighborhoodDeliveryEstimate(deliveryAddress?.neighborhood).label
        : '15–25 min';
    const initialPaymentStatus: PaymentStatus = resolveInitialOrderPaymentStatus({
      paymentMethod,
      serverVerifiedPaid,
    });

    const order: Order = {
      orderId,
      customerUid,
      customerName:
        deliveryAddress?.recipientName || firebaseUser?.displayName || 'Hawassa Customer',
      customerPhone: deliveryAddress?.phoneNumber || '0911684520',
      shopId,
      shopOwnerUid: shop.ownerUid,
      shopName: shop.name,
      items: shopItems.map((i) => ({
        productId: i.product.productId,
        name: i.product.name,
        price: i.unitPrice ?? i.product.price,
        quantity: i.quantity,
        imageUrl: i.product.imageUrl,
        ...(i.variantLabel ? { variantLabel: i.variantLabel } : {}),
      })),
      subtotal,
      ...(summary.discountAmount > 0 ? { discountAmount: summary.discountAmount } : {}),
      ...(summary.promoCode ? { promoCode: summary.promoCode } : {}),
      ...(summary.promoDiscountAmount > 0 ? { promoDiscountAmount: summary.promoDiscountAmount } : {}),
      ...(summary.loyaltyPointsApplied > 0 ? { pointsRedeemed: summary.loyaltyPointsApplied } : {}),
      ...(summary.loyaltyDiscountAmount > 0 ? { pointsDiscountAmount: summary.loyaltyDiscountAmount } : {}),
      ...(summary.pointsToEarn > 0 ? { pointsEarned: summary.pointsToEarn } : {}),
      deliveryFee,
      totalAmount,
      currency: 'ETB',
      fulfillmentMethod,
      deliveryAddress:
        fulfillmentMethod === 'delivery' && deliveryAddress
          ? `${deliveryAddress.neighborhood} — ${deliveryAddress.streetOrLandmark}`
          : `${shop.neighborhood} — ${shop.address}`,
      neighborhood:
        fulfillmentMethod === 'delivery'
          ? deliveryAddress?.neighborhood
          : shop.neighborhood,
      paymentMethod,
      paymentStatus: initialPaymentStatus,
      verifiedPaid: serverVerifiedPaid,
      ...(refValidation.normalizedRef ? { paymentReference: refValidation.normalizedRef } : {}),
      deliveryPin,
      deliveryEtaLabel,
      orderStatus: 'pending',
      notes: notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const newLoyaltyTxs: LoyaltyTransaction[] = [];
    if (summary.loyaltyPointsApplied > 0) {
      newLoyaltyTxs.push({
        transactionId: `ltx-${nowMs}-${Math.random().toString(36).slice(2, 6)}-red`,
        customerUid,
        orderId,
        shopId,
        shopName: shop.name.slice(0, 120),
        type: 'redeemed',
        points: -Math.round(summary.loyaltyPointsApplied),
        orderAmountEtb: Math.round(totalAmount),
        description: `Redeemed ${summary.loyaltyPointsApplied} pts on order #${orderId.slice(-6).toUpperCase()} at ${shop.name}`.slice(0, 240),
        createdAt: now,
      });
    }
    if (summary.pointsToEarn > 0) {
      newLoyaltyTxs.push({
        transactionId: `ltx-${nowMs}-${Math.random().toString(36).slice(2, 6)}-earn`,
        customerUid,
        orderId,
        shopId,
        shopName: shop.name.slice(0, 120),
        type: 'earned',
        points: Math.round(summary.pointsToEarn),
        orderAmountEtb: Math.round(totalAmount),
        description: `Earned ${summary.pointsToEarn} pts on order #${orderId.slice(-6).toUpperCase()} at ${shop.name}`.slice(0, 240),
        createdAt: new Date(nowMs + 1).toISOString(),
      });
    }

    const nextTxList = [...[...newLoyaltyTxs].reverse(), ...loyaltyTransactions];
    const nextStats = calculateLoyaltyBalanceFromTransactions(nextTxList);

    if (firebaseUser) {
      await saveOrderWithLoyaltyInFirestore(
        order,
        newLoyaltyTxs,
        nextStats.balance,
        nextStats.lifetimeEarned
      );
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              loyaltyPoints: nextStats.balance,
              lifetimeLoyaltyPoints: nextStats.lifetimeEarned,
              updatedAt: now,
            }
          : prev
      );
    } else {
      const nextOrders = [order, ...orders];
      setOrders(nextOrders);
      setSellerOrders(nextOrders);
      localStorage.setItem(STORAGE_KEYS.LOCAL_ORDERS, JSON.stringify(nextOrders));

      setLoyaltyTransactions(nextTxList);
      localStorage.setItem(STORAGE_KEYS.LOYALTY_TX, JSON.stringify(nextTxList));

      const earnedMsg =
        summary.pointsToEarn > 0
          ? ` You earned +${summary.pointsToEarn} Hawasa Rewards pts.`
          : '';
      const notif: NotificationItem = {
        notificationId: `notif-${nowMs}`,
        userUid: 'guest-local',
        title: 'Order Placed',
        message: `Order #${order.orderId.slice(-6).toUpperCase()} sent to ${shop.name}. Total: ETB ${totalAmount.toLocaleString()}.${earnedMsg}`,
        type: 'order_status',
        orderId: order.orderId,
        isRead: false,
        createdAt: now,
      };
      const nextNotifs = [notif, ...notifications];
      setNotifications(nextNotifs);
      localStorage.setItem(STORAGE_KEYS.LOCAL_NOTIFS, JSON.stringify(nextNotifs));
    }

    // Decrement product stock locally for immediate accurate UI
    setProducts((prev) =>
      prev.map((p) => {
        const bought = shopItems.find((si) => si.product.productId === p.productId);
        if (!bought) return p;
        const newStock = Math.max(0, p.stock - bought.quantity);
        return { ...p, stock: newStock, isAvailable: newStock > 0 };
      })
    );

    clearCart(shopId);
    setPromoCodeState('');
    setRedeemLoyaltyPointsState(0);
    return order;
  };

  const [paymentProviders, setPaymentProviders] = useState<
    Record<'telebirr' | 'cbe_birr' | 'chapa', { configured: boolean; missingEnvVars: string[] }> | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/payments/providers')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.providers) {
          setPaymentProviders(data.providers);
        }
      })
      .catch(() => {
        // Provider readiness check fails closed
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const verifyOrderPayment = async (
    orderId: string
  ): Promise<{
    verifiedPaid: boolean;
    paymentStatus: PaymentStatus;
    configured: boolean;
    message?: string;
    missingEnvVars?: string[];
  }> => {
    const target = orders.find((o) => o.orderId === orderId);
    if (!target) {
      return {
        verifiedPaid: false,
        paymentStatus: 'pending',
        configured: false,
        message: 'Order not found.',
      };
    }
    if (target.paymentStatus === 'paid') {
      return {
        verifiedPaid: true,
        paymentStatus: 'paid',
        configured: true,
        message: 'Payment already verified.',
      };
    }

    if (!firebaseUser) {
      return {
        verifiedPaid: false,
        paymentStatus: target.paymentStatus,
        configured: false,
        message: 'Please sign in with your Affin Connect account to verify payment.',
      };
    }

    const idToken = await firebaseUser.getIdToken();
    const res = await fetch('/api/payments/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        paymentMethod: target.paymentMethod,
        paymentReference: target.paymentReference,
        expectedAmountEtb: target.totalAmount,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      verifiedPaid?: boolean;
      paymentStatus?: PaymentStatus;
      configured?: boolean;
      message?: string;
      error?: string;
      missingEnvVars?: string[];
    };

    if (!res.ok) {
      return {
        verifiedPaid: false,
        paymentStatus: target.paymentStatus,
        configured: Boolean(data.configured),
        message: data.error || data.message || 'Unable to verify payment right now.',
        missingEnvVars: data.missingEnvVars,
      };
    }

    const verifiedPaid = data.verifiedPaid === true && data.paymentStatus === 'paid';
    if (verifiedPaid) {
      const canPersistAdminPayment =
        userProfile?.role === 'admin' || isSuperAdminEmail(firebaseUser.email);
      if (canPersistAdminPayment) {
        await updateOrderPaymentInFirestore(orderId, 'paid', target.paymentReference);
      }
      const nowIso = new Date().toISOString();
      const patchOrder = (list: Order[]) =>
        list.map((o) =>
          o.orderId === orderId
            ? { ...o, paymentStatus: 'paid' as PaymentStatus, verifiedPaid: true, updatedAt: nowIso }
            : o
        );
      setOrders(patchOrder);
      setSellerOrders(patchOrder);
    }

    return {
      verifiedPaid,
      paymentStatus: verifiedPaid ? 'paid' : target.paymentStatus,
      configured: Boolean(data.configured),
      message: data.message,
      missingEnvVars: data.missingEnvVars,
    };
  };

  const updateOrderStatus = async (
    orderId: string,
    newStatus: OrderStatus,
    rejectionReason?: string,
    deliveryPinInput?: string
  ) => {
    const target = orders.find((o) => o.orderId === orderId) || sellerOrders.find((o) => o.orderId === orderId);
    if (!target) return;

    if (newStatus === 'delivered' && activeRoleView !== 'admin' && target.deliveryPin) {
      const pinCheck = verifyDeliveryPin(target.deliveryPin, deliveryPinInput);
      if (!pinCheck.valid) {
        throw new Error(t(pinCheck.errorKey ?? 'deliveryPinInvalidError'));
      }
    }

    const isOfflinePayOnReceipt =
      target.paymentMethod === 'cash_on_delivery' ||
      target.paymentMethod === 'pay_at_pickup';
    const nextPaymentStatus: PaymentStatus | undefined =
      newStatus === 'delivered' &&
      target.paymentStatus === 'pending' &&
      isOfflinePayOnReceipt
        ? 'paid'
        : undefined;

    if (firebaseUser) {
      await updateOrderStatusInFirestore(
        orderId,
        newStatus,
        target.customerUid,
        target.shopName,
        rejectionReason,
        nextPaymentStatus
      );
    }

    const updatedMs = Date.now();
    const updatedAt = new Date(updatedMs).toISOString();
    const updater = (list: Order[]) =>
      list.map((o) =>
        o.orderId === orderId
          ? {
              ...o,
              orderStatus: newStatus,
              ...(nextPaymentStatus ? { paymentStatus: nextPaymentStatus } : {}),
              rejectionReason: rejectionReason ?? o.rejectionReason,
              updatedAt,
            }
          : o
      );

    setOrders((prev) => {
      const next = updater(prev);
      if (!firebaseUser) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_ORDERS, JSON.stringify(next));
      }
      return next;
    });
    setSellerOrders(updater);

    // Reverse earned points and refund redeemed points if the order is canceled or rejected
    if (newStatus === 'canceled' || newStatus === 'rejected') {
      const reversalTxs: LoyaltyTransaction[] = [];
      const alreadyRefunded = loyaltyTransactions.some(
        (tx) => tx.orderId === orderId && tx.type === 'refunded'
      );
      const alreadyReversed = loyaltyTransactions.some(
        (tx) => tx.orderId === orderId && tx.type === 'reversed'
      );

      if ((target.pointsRedeemed ?? 0) > 0 && !alreadyRefunded) {
        const refundedPts = Math.round(target.pointsRedeemed!);
        reversalTxs.push({
          transactionId: `ltx-${updatedMs}-${Math.random().toString(36).slice(2, 6)}-ref`,
          customerUid: target.customerUid,
          orderId,
          shopId: target.shopId,
          shopName: target.shopName.slice(0, 120),
          type: 'refunded',
          points: refundedPts,
          orderAmountEtb: Math.round(target.totalAmount),
          description: `Refunded ${refundedPts} pts for ${newStatus} order #${orderId.slice(-6).toUpperCase()}`.slice(0, 240),
          createdAt: updatedAt,
        });
      }

      if ((target.pointsEarned ?? 0) > 0 && !alreadyReversed) {
        const reversedPts = Math.round(target.pointsEarned!);
        reversalTxs.push({
          transactionId: `ltx-${updatedMs}-${Math.random().toString(36).slice(2, 6)}-rev`,
          customerUid: target.customerUid,
          orderId,
          shopId: target.shopId,
          shopName: target.shopName.slice(0, 120),
          type: 'reversed',
          points: -reversedPts,
          orderAmountEtb: Math.round(target.totalAmount),
          description: `Reversed ${reversedPts} earned pts for ${newStatus} order #${orderId.slice(-6).toUpperCase()}`.slice(0, 240),
          createdAt: new Date(updatedMs + 1).toISOString(),
        });
      }

      if (reversalTxs.length > 0) {
        const nextTxList = [...[...reversalTxs].reverse(), ...loyaltyTransactions];
        const nextStats = calculateLoyaltyBalanceFromTransactions(nextTxList);
        if (firebaseUser) {
          if (target.customerUid === firebaseUser.uid || userProfile?.role === 'admin') {
            await recordLoyaltyTransactionsInFirestore(
              target.customerUid,
              reversalTxs,
              nextStats.balance,
              nextStats.lifetimeEarned
            );
          }
        } else {
          setLoyaltyTransactions(nextTxList);
          localStorage.setItem(STORAGE_KEYS.LOYALTY_TX, JSON.stringify(nextTxList));
        }
      }
    }

    if (!firebaseUser) {
      const notif: NotificationItem = {
        notificationId: `notif-${updatedMs}`,
        userUid: 'guest-local',
        title: `Order ${newStatus.replace(/_/g, ' ')}`,
        message: rejectionReason
          ? `${target.shopName} declined order #${orderId.slice(-6).toUpperCase()}: ${rejectionReason}`
          : `${target.shopName} updated order #${orderId.slice(-6).toUpperCase()} to ${newStatus.replace(/_/g, ' ')}.`,
        type: 'order_status',
        orderId,
        isRead: false,
        createdAt: updatedAt,
      };
      const nextNotifs = [notif, ...notifications];
      setNotifications(nextNotifs);
      localStorage.setItem(STORAGE_KEYS.LOCAL_NOTIFS, JSON.stringify(nextNotifs));
    }
  };

  const saveAddress = async (
    addrInput: Omit<CustomerAddress, 'addressId' | 'customerUid' | 'createdAt'>
  ) => {
    const newAddr: CustomerAddress = {
      ...addrInput,
      addressId: `addr-${Date.now()}`,
      customerUid: firebaseUser?.uid ?? 'guest-local',
      createdAt: new Date().toISOString(),
    };

    if (firebaseUser) {
      await saveAddressInFirestore(newAddr);
    } else {
      const next = addrInput.isDefault
        ? [newAddr, ...addresses.map((a) => ({ ...a, isDefault: false }))]
        : [newAddr, ...addresses];
      setAddresses(next);
      localStorage.setItem(STORAGE_KEYS.LOCAL_ADDRESSES, JSON.stringify(next));
    }
  };

  const deleteAddress = async (addressId: string) => {
    if (firebaseUser) {
      await deleteAddressInFirestore(addressId);
    } else {
      const next = addresses.filter((a) => a.addressId !== addressId);
      setAddresses(next);
      localStorage.setItem(STORAGE_KEYS.LOCAL_ADDRESSES, JSON.stringify(next));
    }
  };

  const markNotificationRead = async (notificationId: string) => {
    if (firebaseUser) {
      await markNotificationReadInFirestore(notificationId);
    }
    setNotifications((prev) => {
      const next = prev.map((n) =>
        n.notificationId === notificationId ? { ...n, isRead: true } : n
      );
      if (!firebaseUser) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_NOTIFS, JSON.stringify(next));
      }
      return next;
    });
  };

  const getShopVerification = (shopId: string): MerchantVerification | null => {
    return (
      merchantVerifications.find(
        (v) => v.shopId === shopId || v.verificationId === shopId
      ) ?? null
    );
  };

  const saveSellerProduct = async (
    product: Product,
    options?: {
      categoryConfirmed?: boolean;
      confirmedCategory?: string;
    }
  ): Promise<{ product: Product; categorization: CoffeeCategorizationResult }> => {
    if (userProfile?.accountStatus === 'suspended') {
      throw new Error(t('governanceUserSuspended'));
    }
    const targetShop = shopsById[product.shopId];
    if (!targetShop) {
      throw new Error('Selected virtual shop was not found. Please create or select your shop first.');
    }
    if (targetShop.status === 'suspended' && activeRoleView !== 'admin') {
      throw new Error('Suspended shops cannot create or edit product listings.');
    }
    if (
      firebaseUser &&
      !isCloudAdmin &&
      activeRoleView !== 'admin' &&
      targetShop.ownerUid !== firebaseUser.uid
    ) {
      throw new Error('You can only upload products to a virtual shop owned by your account.');
    }
    const shopVerification = getShopVerification(product.shopId);
    if (activeRoleView !== 'admin' && !canShopListProducts(targetShop, shopVerification)) {
      throw new Error(t('docVerifyGateDesc'));
    }
    if (!validateProductImageUrl(product.imageUrl)) {
      throw new Error(t('imageSizeTooLargeError'));
    }

    const existsLocally = products.some((p) => p.productId === product.productId);
    let savedProduct: Product = product;
    let categorization: CoffeeCategorizationResult;

    if (firebaseUser) {
      try {
        const idToken = await firebaseUser.getIdToken();
        const response = await saveProductViaBackendApi(product, idToken, {
          mode: existsLocally ? 'update' : 'create',
          categoryConfirmed: options?.categoryConfirmed,
          confirmedCategory: options?.confirmedCategory,
        });
        savedProduct = response.product;
        categorization = response.categorization;
      } catch (err) {
        if (err instanceof ProductCategorizationApiError) {
          throw err;
        }
        throw new Error(
          formatFriendlyErrorMessage(err, 'Unable to save product listing to the server.')
        );
      }
    } else {
      const localCheck = classifyProductCoffeeCategory({
        name: product.name,
        category: product.category,
        productType: product.productType,
        coffeeDetails: product.coffeeDetails,
        categoryConfirmed: options?.categoryConfirmed,
        confirmedCategory: options?.confirmedCategory,
      });
      if (localCheck.outcome === 'conflict') {
        throw new ProductCategorizationApiError(
          localCheck.reason,
          'CATEGORY_CONFLICT',
          400,
          localCheck
        );
      }
      if (localCheck.outcome === 'ambiguous' && localCheck.requiresConfirmation) {
        throw new ProductCategorizationApiError(
          localCheck.reason,
          'CATEGORY_CONFIRMATION_REQUIRED',
          409,
          localCheck
        );
      }
      const normalizedCategory = normalizeProductCategory(localCheck.resolvedCategory);
      const nextProduct: Product = {
        ...product,
        category: normalizedCategory,
        ...(normalizedCategory === CANONICAL_COFFEE_CATEGORY &&
        (product.coffeeDetails || localCheck.inferredCoffeeDetails)
          ? {
              coffeeDetails: {
                ...(localCheck.inferredCoffeeDetails ?? {}),
                ...(product.coffeeDetails ?? {}),
              },
            }
          : {}),
      };
      if (normalizedCategory !== CANONICAL_COFFEE_CATEGORY && 'coffeeDetails' in nextProduct) {
        delete nextProduct.coffeeDetails;
      }
      savedProduct = nextProduct;
      categorization = localCheck;
    }

    setProducts((prev) => {
      const exists = prev.some((p) => p.productId === savedProduct.productId);
      const next = exists
        ? prev.map((p) => (p.productId === savedProduct.productId ? savedProduct : p))
        : [savedProduct, ...prev];
      if (!firebaseUser) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_PRODUCTS, JSON.stringify(next));
      }
      return next;
    });

    return { product: savedProduct, categorization };
  };

  const runCoffeeMigrationAsAdmin = async (dryRun: boolean = false) => {
    if (firebaseUser) {
      const idToken = await firebaseUser.getIdToken();
      const summary = await runCoffeeProductMigrationViaApi(idToken, dryRun);
      if (!dryRun && summary.updated > 0) {
        await refreshCatalogFromFirestore();
      }
      return summary;
    }

    const plan = planCoffeeProductMigration(products);
    if (!dryRun && plan.changes.length > 0) {
      const updatedMap = new Map(
        plan.changes.map((c) => [c.productId, c.updatedProduct])
      );
      setProducts((prev) => {
        const next = prev.map((p) => updatedMap.get(p.productId) ?? p);
        localStorage.setItem(STORAGE_KEYS.LOCAL_PRODUCTS, JSON.stringify(next));
        return next;
      });
    }
    return {
      dryRun,
      scanned: plan.scanned,
      alreadyCategorized: plan.alreadyCategorized,
      eligible: plan.eligible,
      updated: dryRun ? 0 : plan.changes.length,
      skipped: plan.skipped,
      ambiguous: plan.ambiguous,
    };
  };

  const saveSellerShop = async (shop: Shop) => {
    if (userProfile?.accountStatus === 'suspended') {
      throw new Error(t('governanceUserSuspended'));
    }
    if (firebaseUser) {
      await saveShopInFirestore(shop);
    }
    setShops((prev) => {
      const exists = prev.some((s) => s.shopId === shop.shopId);
      const next = exists
        ? prev.map((s) => (s.shopId === shop.shopId ? shop : s))
        : [shop, ...prev];
      if (!firebaseUser) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_SHOPS, JSON.stringify(next));
      }
      return next;
    });
  };

  const submitMerchantVerification = async ({
    shopId,
    businessLegalName,
    licenseNumber,
    tinNumber,
    issuingAuthority,
    expiryDate,
    licenseImageDataUrl,
    documentFileName,
  }: {
    shopId: string;
    businessLegalName: string;
    licenseNumber: string;
    tinNumber?: string;
    issuingAuthority: string;
    expiryDate?: string;
    licenseImageDataUrl: string;
    documentFileName?: string;
  }): Promise<MerchantVerification> => {
    if (userProfile?.accountStatus === 'suspended') {
      throw new Error(t('governanceUserSuspended'));
    }
    const targetShop = shopsById[shopId];
    if (!targetShop) {
      throw new Error('Shop profile not found.');
    }
    const validationErrors = validateMerchantVerificationInput({
      businessLegalName,
      licenseNumber,
      tinNumber,
      issuingAuthority,
      expiryDate,
      licenseImageDataUrl,
    });
    const firstErrKey = Object.values(validationErrors)[0];
    if (firstErrKey) {
      throw new Error(t(firstErrKey));
    }

    const existing = getShopVerification(shopId);
    const now = new Date().toISOString();
    const ownerUid = firebaseUser?.uid ?? targetShop.ownerUid ?? 'seller-applicant';
    const cleanTin = tinNumber?.trim().slice(0, 30);
    const cleanExpiry = expiryDate?.trim().slice(0, 30);
    const cleanFileName = documentFileName?.trim().slice(0, 120);

    const verification: MerchantVerification = {
      verificationId: shopId,
      shopId,
      shopName: targetShop.name.trim().slice(0, 120),
      ownerUid,
      businessLegalName: businessLegalName.trim().slice(0, 140),
      licenseNumber: licenseNumber.trim().slice(0, 60),
      ...(cleanTin ? { tinNumber: cleanTin } : {}),
      issuingAuthority: issuingAuthority.trim().slice(0, 140),
      ...(cleanExpiry ? { expiryDate: cleanExpiry } : {}),
      licenseImageDataUrl,
      ...(cleanFileName ? { documentFileName: cleanFileName } : {}),
      status: 'pending_review',
      submittedAt: existing?.submittedAt ?? now,
      updatedAt: now,
    };

    if (firebaseUser) {
      const canUpdateShopDoc = targetShop.ownerUid === firebaseUser.uid || isCloudAdmin;
      await submitMerchantVerificationInFirestore(verification, canUpdateShopDoc);
    }

    setMerchantVerifications((prev) => {
      const next = [
        verification,
        ...prev.filter((v) => v.verificationId !== verification.verificationId),
      ];
      localStorage.setItem(STORAGE_KEYS.MERCHANT_VERIFICATIONS, JSON.stringify(next));
      return next;
    });

    setShops((prev) => {
      const next = prev.map((s) =>
        s.shopId === shopId
          ? { ...s, verificationStatus: 'pending_review' as const, updatedAt: now }
          : s
      );
      if (!firebaseUser) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_SHOPS, JSON.stringify(next));
      }
      return next;
    });

    setCartToast({
      id: Date.now(),
      message: t('docVerifySubmittedToast'),
    });

    return verification;
  };

  const adminReviewMerchantVerification = async ({
    verificationId,
    decision,
    reviewNote,
  }: {
    verificationId: string;
    decision: 'approved' | 'rejected';
    reviewNote?: string;
  }) => {
    const target = merchantVerifications.find((v) => v.verificationId === verificationId);
    if (!target) return;
    const cleanNote = reviewNote?.trim().slice(0, 300);
    const now = new Date().toISOString();
    const reviewerUid = firebaseUser?.uid ?? 'preview-admin';

    if (isCloudAdmin) {
      await reviewMerchantVerificationInFirestore({
        verification: target,
        decision,
        reviewNote: cleanNote,
        reviewerUid,
      });
    }

    setMerchantVerifications((prev) => {
      const next = prev.map((v) => {
        if (v.verificationId !== verificationId) return v;
        const updated: MerchantVerification = {
          ...v,
          status: decision,
          reviewedAt: now,
          reviewedByUid: reviewerUid,
          updatedAt: now,
        };
        if (cleanNote) {
          updated.reviewNote = cleanNote;
        } else {
          delete updated.reviewNote;
        }
        return updated;
      });
      localStorage.setItem(STORAGE_KEYS.MERCHANT_VERIFICATIONS, JSON.stringify(next));
      return next;
    });

    setShops((prev) => {
      const next = prev.map((s) =>
        s.shopId === target.shopId
          ? {
              ...s,
              verificationStatus: decision,
              ...(decision === 'approved' ? { status: 'approved' as const } : {}),
              updatedAt: now,
            }
          : s
      );
      if (!isCloudAdmin) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_SHOPS, JSON.stringify(next));
      }
      return next;
    });

    await recordAuditEntry({
      action: decision === 'approved' ? 'approve_merchant_documents' : 'reject_merchant_documents',
      targetType: 'verification',
      targetId: target.shopId,
      targetLabel: `${target.shopName} (${target.licenseNumber})`,
      reason: cleanNote,
    });
  };

  const recordAuditEntry = async (params: {
    action: string;
    targetType: AdminAuditTargetType;
    targetId: string;
    targetLabel: string;
    reason?: string;
  }) => {
    const now = new Date().toISOString();
    const log: AdminAuditLog = {
      logId: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      adminUid: firebaseUser?.uid ?? 'preview-admin',
      adminEmail: firebaseUser?.email || userProfile?.email || 'admin@hawasagebeya.et',
      action: params.action.trim().slice(0, 80),
      targetType: params.targetType,
      targetId: params.targetId.trim().slice(0, 128) || 'global',
      targetLabel: params.targetLabel.trim().slice(0, 140) || 'Item',
      ...(params.reason?.trim() ? { reason: params.reason.trim().slice(0, 300) } : {}),
      createdAt: now,
    };

    if (isCloudAdmin) {
      try {
        await recordAdminAuditLogInFirestore(log);
      } catch (err) {
        console.warn('Could not persist admin audit log:', err);
      }
    }

    setAdminAuditLogs((prev) => {
      const next = [log, ...prev.filter((l) => l.logId !== log.logId)].slice(0, 120);
      localStorage.setItem(STORAGE_KEYS.ADMIN_AUDIT, JSON.stringify(next));
      return next;
    });
  };

  const moderateShopGovernance = async ({
    shopId,
    status,
    featured,
    reason,
  }: {
    shopId: string;
    status?: 'approved' | 'suspended' | 'pending';
    featured?: boolean;
    reason?: string;
  }) => {
    const target = shops.find((s) => s.shopId === shopId);
    if (!target) return;
    const cleanReason = reason?.trim().slice(0, 300);
    const nextSuspensionReason =
      status === 'suspended' ? cleanReason || target.suspensionReason : status === 'approved' ? '' : undefined;

    if (isCloudAdmin) {
      await moderateShopGovernanceInFirestore(shopId, {
        ...(status ? { status } : {}),
        ...(typeof featured === 'boolean' ? { featured } : {}),
        ...(nextSuspensionReason !== undefined ? { suspensionReason: nextSuspensionReason } : {}),
      });
    }

    const now = new Date().toISOString();
    setShops((prev) => {
      const next = prev.map((s) => {
        if (s.shopId !== shopId) return s;
        const updated: Shop = {
          ...s,
          ...(status ? { status } : {}),
          ...(typeof featured === 'boolean' ? { featured } : {}),
          updatedAt: now,
        };
        if (nextSuspensionReason === '') {
          delete updated.suspensionReason;
        } else if (nextSuspensionReason) {
          updated.suspensionReason = nextSuspensionReason;
        }
        return updated;
      });
      localStorage.setItem(STORAGE_KEYS.LOCAL_SHOPS, JSON.stringify(next));
      return next;
    });

    const actionName =
      status === 'suspended'
        ? 'suspend_shop'
        : status === 'approved'
        ? 'approve_shop'
        : typeof featured === 'boolean'
        ? featured
          ? 'feature_shop'
          : 'unfeature_shop'
        : 'update_shop_status';

    await recordAuditEntry({
      action: actionName,
      targetType: 'shop',
      targetId: shopId,
      targetLabel: target.name,
      reason: cleanReason,
    });
  };

  const moderateShopStatus = async (
    shopId: string,
    status: 'approved' | 'suspended' | 'pending'
  ) => {
    await moderateShopGovernance({ shopId, status });
  };

  const deleteShopAsAdmin = async (shopId: string, reason: string) => {
    const target = shops.find((s) => s.shopId === shopId);
    if (!target) return;
    if (isCloudAdmin) {
      await deleteShopInFirestore(shopId);
    }
    setShops((prev) => {
      const next = prev.filter((s) => s.shopId !== shopId);
      localStorage.setItem(STORAGE_KEYS.LOCAL_SHOPS, JSON.stringify(next));
      return next;
    });
    await recordAuditEntry({
      action: 'delete_shop',
      targetType: 'shop',
      targetId: shopId,
      targetLabel: target.name,
      reason,
    });
  };

  const moderateProductGovernance = async ({
    productId,
    status,
    isAvailable,
    stock,
    reason,
  }: {
    productId: string;
    status?: 'active' | 'archived' | 'pending_review';
    isAvailable?: boolean;
    stock?: number;
    reason?: string;
  }) => {
    const target = products.find((p) => p.productId === productId);
    if (!target) return;
    const cleanReason = reason?.trim().slice(0, 300);
    const nextModReason =
      status === 'active'
        ? ''
        : cleanReason !== undefined
        ? cleanReason
        : target.moderationReason;

    if (isCloudAdmin) {
      await moderateProductGovernanceInFirestore(productId, {
        ...(status ? { status } : {}),
        ...(typeof isAvailable === 'boolean' ? { isAvailable } : {}),
        ...(typeof stock === 'number' ? { stock } : {}),
        ...(nextModReason !== undefined ? { moderationReason: nextModReason } : {}),
      });
    }

    const now = new Date().toISOString();
    setProducts((prev) => {
      const next = prev.map((p) => {
        if (p.productId !== productId) return p;
        const updated: Product = {
          ...p,
          ...(status ? { status } : {}),
          ...(typeof isAvailable === 'boolean' ? { isAvailable } : {}),
          ...(typeof stock === 'number' ? { stock: Math.max(0, Math.round(stock)) } : {}),
          updatedAt: now,
        };
        if (nextModReason === '') {
          delete updated.moderationReason;
        } else if (nextModReason) {
          updated.moderationReason = nextModReason;
        }
        return updated;
      });
      localStorage.setItem(STORAGE_KEYS.LOCAL_PRODUCTS, JSON.stringify(next));
      return next;
    });

    await recordAuditEntry({
      action:
        status === 'archived'
          ? 'takedown_product'
          : status === 'pending_review'
          ? 'flag_product'
          : status === 'active'
          ? 'approve_product'
          : 'update_product_stock',
      targetType: 'product',
      targetId: productId,
      targetLabel: target.name,
      reason: cleanReason,
    });
  };

  const moderateProductStatus = async (
    productId: string,
    status: 'active' | 'archived' | 'pending_review'
  ) => {
    await moderateProductGovernance({ productId, status });
  };

  const deleteProductAsAdmin = async (productId: string, reason: string) => {
    const target = products.find((p) => p.productId === productId);
    if (!target) return;
    if (isCloudAdmin) {
      await deleteProductInFirestore(productId);
    }
    setProducts((prev) => {
      const next = prev.filter((p) => p.productId !== productId);
      localStorage.setItem(STORAGE_KEYS.LOCAL_PRODUCTS, JSON.stringify(next));
      return next;
    });
    await recordAuditEntry({
      action: 'delete_product',
      targetType: 'product',
      targetId: productId,
      targetLabel: target.name,
      reason,
    });
  };

  const adminForceOrderAction = async ({
    orderId,
    orderStatus,
    paymentStatus,
    reason,
  }: {
    orderId: string;
    orderStatus?: OrderStatus;
    paymentStatus?: PaymentStatus;
    reason: string;
  }) => {
    const target =
      adminOrders.find((o) => o.orderId === orderId) ||
      orders.find((o) => o.orderId === orderId) ||
      sellerOrders.find((o) => o.orderId === orderId);
    if (!target) return;

    const cleanReason = reason.trim().slice(0, 300);
    if (isCloudAdmin) {
      await adminUpdateOrderInFirestore(
        orderId,
        {
          ...(orderStatus ? { orderStatus } : {}),
          ...(paymentStatus ? { paymentStatus } : {}),
          ...(cleanReason ? { adminNote: cleanReason } : {}),
          ...(orderStatus === 'rejected' && cleanReason ? { rejectionReason: cleanReason } : {}),
        },
        target.customerUid,
        target.shopName
      );
    }

    const updatedMs = Date.now();
    const updatedAt = new Date(updatedMs).toISOString();
    const applyOrderPatch = (list: Order[]) =>
      list.map((o) =>
        o.orderId === orderId
          ? {
              ...o,
              ...(orderStatus ? { orderStatus } : {}),
              ...(paymentStatus ? { paymentStatus } : {}),
              ...(cleanReason ? { adminNote: cleanReason } : {}),
              updatedAt,
            }
          : o
      );

    setAdminOrders(applyOrderPatch);
    setOrders((prev) => {
      const next = applyOrderPatch(prev);
      if (!firebaseUser) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_ORDERS, JSON.stringify(next));
      }
      return next;
    });
    setSellerOrders(applyOrderPatch);

    if (orderStatus === 'canceled' || orderStatus === 'rejected') {
      const reversalTxs: LoyaltyTransaction[] = [];
      const alreadyRefunded = loyaltyTransactions.some(
        (tx) => tx.orderId === orderId && tx.type === 'refunded'
      );
      const alreadyReversed = loyaltyTransactions.some(
        (tx) => tx.orderId === orderId && tx.type === 'reversed'
      );

      if ((target.pointsRedeemed ?? 0) > 0 && !alreadyRefunded) {
        const refundedPts = Math.round(target.pointsRedeemed!);
        reversalTxs.push({
          transactionId: `ltx-${updatedMs}-${Math.random().toString(36).slice(2, 6)}-ref`,
          customerUid: target.customerUid,
          orderId,
          shopId: target.shopId,
          shopName: target.shopName.slice(0, 120),
          type: 'refunded',
          points: refundedPts,
          orderAmountEtb: Math.round(target.totalAmount),
          description: `Admin refunded ${refundedPts} pts for order #${orderId
            .slice(-6)
            .toUpperCase()}`.slice(0, 240),
          createdAt: updatedAt,
        });
      }
      if ((target.pointsEarned ?? 0) > 0 && !alreadyReversed) {
        const reversedPts = Math.round(target.pointsEarned!);
        reversalTxs.push({
          transactionId: `ltx-${updatedMs}-${Math.random().toString(36).slice(2, 6)}-rev`,
          customerUid: target.customerUid,
          orderId,
          shopId: target.shopId,
          shopName: target.shopName.slice(0, 120),
          type: 'reversed',
          points: -reversedPts,
          orderAmountEtb: Math.round(target.totalAmount),
          description: `Admin reversed ${reversedPts} pts for order #${orderId
            .slice(-6)
            .toUpperCase()}`.slice(0, 240),
          createdAt: new Date(updatedMs + 1).toISOString(),
        });
      }

      if (reversalTxs.length > 0) {
        const nextTxList = [...[...reversalTxs].reverse(), ...loyaltyTransactions];
        const nextStats = calculateLoyaltyBalanceFromTransactions(nextTxList);
        if (firebaseUser) {
          if (target.customerUid === firebaseUser.uid || isCloudAdmin) {
            await recordLoyaltyTransactionsInFirestore(
              target.customerUid,
              reversalTxs,
              nextStats.balance,
              nextStats.lifetimeEarned
            );
          }
        } else {
          setLoyaltyTransactions(nextTxList);
          localStorage.setItem(STORAGE_KEYS.LOYALTY_TX, JSON.stringify(nextTxList));
        }
      }
    }

    await recordAuditEntry({
      action: paymentStatus === 'refunded' ? 'force_refund_order' : `force_order_${orderStatus ?? 'update'}`,
      targetType: 'order',
      targetId: orderId,
      targetLabel: `#${orderId.slice(-6).toUpperCase()} · ${target.shopName}`,
      reason: cleanReason,
    });
  };

  const adminResolveReturnRequest = async ({
    returnId,
    status,
    resolutionNote,
  }: {
    returnId: string;
    status: ReturnRequestStatus;
    resolutionNote: string;
  }) => {
    const target =
      adminReturnRequests.find((r) => r.returnId === returnId) ||
      returnRequests.find((r) => r.returnId === returnId);
    if (!target) return;

    const cleanNote = resolutionNote.trim().slice(0, 300);
    if (isCloudAdmin) {
      await adminResolveReturnRequestInFirestore(
        returnId,
        status,
        cleanNote,
        target.customerUid,
        target.orderId,
        target.productName
      );
    }

    const updatedAt = new Date().toISOString();
    const updater = (list: ReturnRequest[]) =>
      list.map((r) =>
        r.returnId === returnId
          ? { ...r, status, ...(cleanNote ? { resolutionNote: cleanNote } : {}), updatedAt }
          : r
      );

    setAdminReturnRequests(updater);
    setReturnRequests((prev) => {
      const next = updater(prev);
      if (!firebaseUser) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_RETURNS, JSON.stringify(next));
      }
      return next;
    });

    await recordAuditEntry({
      action: `resolve_return_${status}`,
      targetType: 'return_request',
      targetId: returnId,
      targetLabel: `${target.productName} (#${target.orderId.slice(-6).toUpperCase()})`,
      reason: cleanNote,
    });
  };

  const adminUpdateUserAccount = async ({
    uid,
    role,
    accountStatus,
    reason,
    resolvedUser,
  }: {
    uid: string;
    role?: UserRole;
    accountStatus?: AccountStatus;
    reason: string;
    resolvedUser?: UserProfile;
  }) => {
    const target =
      resolvedUser ||
      adminUsers.find((u) => u.uid === uid) ||
      (userProfile?.uid === uid ? userProfile : undefined);
    const updatedAt = new Date().toISOString();

    if (isCloudAdmin) {
      await updateUserGovernanceInFirestore(uid, { role, accountStatus });
    }

    setAdminUsers((prev) => {
      const exists = prev.some((u) => u.uid === uid);
      const next = exists
        ? prev.map((u) =>
            u.uid === uid
              ? {
                  ...u,
                  ...(role ? { role } : {}),
                  ...(accountStatus ? { accountStatus } : {}),
                  updatedAt,
                }
              : u
          )
        : target
          ? [
              {
                ...target,
                ...(role ? { role } : {}),
                ...(accountStatus ? { accountStatus } : {}),
                updatedAt,
              },
              ...prev,
            ]
          : prev;
      localStorage.setItem(STORAGE_KEYS.LOCAL_USERS, JSON.stringify(next));
      return next;
    });

    if (userProfile?.uid === uid) {
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              ...(role ? { role } : {}),
              ...(accountStatus ? { accountStatus } : {}),
              updatedAt,
            }
          : prev
      );
    }

    await recordAuditEntry({
      action: accountStatus === 'suspended' ? 'suspend_user' : role ? `set_role_${role}` : 'reinstate_user',
      targetType: 'user',
      targetId: uid,
      targetLabel: target?.displayName || target?.email || uid,
      reason,
    });
  };

  const adminGrantRoleByEmail = async ({
    email,
    role,
    reason,
  }: {
    email: string;
    role: UserRole;
    reason?: string;
  }): Promise<{ ok: boolean; user?: UserProfile; error?: string }> => {
    const cleanEmail = (email ?? '').trim().toLowerCase();
    if (!isEmailFormat(cleanEmail)) {
      return { ok: false, error: t('authErrorInvalidEmail') };
    }

    let target: UserProfile | null = findUserByNormalizedEmail(adminUsers, cleanEmail);
    if (!target && userProfile && (userProfile.email ?? '').trim().toLowerCase() === cleanEmail) {
      target = userProfile;
    }
    if (!target && isCloudAdmin) {
      try {
        target = await findUserByEmailInFirestore(cleanEmail);
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : t('adminGrantEmailNotFound'),
        };
      }
    }

    if (!target) {
      return { ok: false, error: t('adminGrantEmailNotFound') };
    }

    if (target.uid === firebaseUser?.uid && role !== 'admin') {
      return { ok: false, error: t('adminCannotDemoteSelf') };
    }

    if (isSuperAdminEmail(target.email) && role !== 'admin') {
      return { ok: false, error: t('adminCannotDemoteOwner') };
    }

    await adminUpdateUserAccount({
      uid: target.uid,
      role,
      reason:
        reason?.trim() ||
        (role === 'admin'
          ? `Granted admin role via email lookup (${cleanEmail})`
          : `Updated role to ${role} via email lookup (${cleanEmail})`),
      resolvedUser: target,
    });

    return {
      ok: true,
      user: {
        ...target,
        role,
        updatedAt: new Date().toISOString(),
      },
    };
  };

  const adminDeleteReview = async (reviewId: string, reason: string) => {
    const target = reviews.find((r) => r.reviewId === reviewId);
    if (!target) return;
    if (isCloudAdmin) {
      await deleteReviewInFirestore(reviewId);
    }
    setReviews((prev) => {
      const next = prev.filter((r) => r.reviewId !== reviewId);
      if (!firebaseUser) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_REVIEWS, JSON.stringify(next));
      }
      return next;
    });
    await recordAuditEntry({
      action: 'remove_review',
      targetType: 'review',
      targetId: reviewId,
      targetLabel: `${target.customerName} (${target.rating}★)`,
      reason,
    });
  };

  const updateGovernanceConfig = async (
    patch: Partial<
      Pick<
        MarketplaceGovernanceConfig,
        | 'deliveryFeeEtb'
        | 'freeDeliveryThresholdEtb'
        | 'maxOrderAmountEtb'
        | 'orderingPaused'
        | 'maintenanceBanner'
        | 'strictShopVerification'
      >
    >,
    reason?: string
  ) => {
    const now = new Date().toISOString();
    const nextConfig: MarketplaceGovernanceConfig = {
      ...governanceConfig,
      ...patch,
      configId: 'global',
      deliveryFeeEtb: Math.max(
        0,
        Math.round(patch.deliveryFeeEtb ?? governanceConfig.deliveryFeeEtb)
      ),
      freeDeliveryThresholdEtb: Math.max(
        0,
        Math.round(patch.freeDeliveryThresholdEtb ?? governanceConfig.freeDeliveryThresholdEtb)
      ),
      maxOrderAmountEtb: Math.max(
        100,
        Math.round(patch.maxOrderAmountEtb ?? governanceConfig.maxOrderAmountEtb)
      ),
      orderingPaused: patch.orderingPaused ?? governanceConfig.orderingPaused,
      strictShopVerification:
        patch.strictShopVerification ?? governanceConfig.strictShopVerification,
      maintenanceBanner:
        (patch.maintenanceBanner ?? governanceConfig.maintenanceBanner ?? '').trim().slice(0, 300),
      updatedAt: now,
      ...(firebaseUser?.uid ? { updatedByUid: firebaseUser.uid } : {}),
    };

    if (isCloudAdmin) {
      await saveMarketplaceConfigInFirestore(nextConfig);
    }

    setGovernanceConfig(nextConfig);
    setDeliveryFeeEtbState(nextConfig.deliveryFeeEtb);
    localStorage.setItem(STORAGE_KEYS.GOVERNANCE_CONFIG, JSON.stringify(nextConfig));
    localStorage.setItem(STORAGE_KEYS.DELIVERY_FEE, JSON.stringify(nextConfig.deliveryFeeEtb));

    await recordAuditEntry({
      action: patch.orderingPaused !== undefined
        ? nextConfig.orderingPaused
          ? 'pause_marketplace_ordering'
          : 'resume_marketplace_ordering'
        : 'update_governance_policy',
      targetType: 'config',
      targetId: 'global',
      targetLabel: 'Marketplace Governance Policy',
      reason,
    });
  };

  const saveCategory = async (category: Category) => {
    if (isCloudAdmin) {
      await saveCategoryInFirestore(category);
    }
    setCategories((prev) => {
      const exists = prev.some((c) => c.slug === category.slug);
      return exists
        ? prev.map((c) => (c.slug === category.slug ? category : c))
        : [...prev, category];
    });
    await recordAuditEntry({
      action: category.isActive ? 'save_category' : 'disable_category',
      targetType: 'category',
      targetId: category.slug,
      targetLabel: category.name,
    });
  };

  const submitReview = async ({
    productId,
    shopId,
    rating,
    comment,
    shopRating,
    shopComment,
  }: {
    productId: string;
    shopId: string;
    rating: number;
    comment: string;
    shopRating?: number;
    shopComment?: string;
  }) => {
    if (userProfile?.accountStatus === 'suspended') {
      throw new Error(t('governanceUserSuspended'));
    }
    const customerUid = firebaseUser?.uid ?? 'guest-local';
    const qualifyingOrder = getQualifyingPurchaseOrder(orders, productId, customerUid);
    if (!qualifyingOrder) {
      throw new Error(t('verifiedDeliveredPrompt'));
    }

    const existing = getUserProductReview(reviews, productId, customerUid);
    if (existing) {
      throw new Error('You have already reviewed this product. You can edit your existing review.');
    }

    const validationErrors = validateReviewInput({ rating, comment, shopRating, shopComment });
    const firstError = Object.values(validationErrors)[0];
    if (firstError) {
      throw new Error(firstError);
    }

    const cleanRating = Math.min(5, Math.max(1, Math.round(rating)));
    const cleanShopRating =
      shopRating != null ? Math.min(5, Math.max(1, Math.round(shopRating))) : undefined;
    const cleanShopComment = shopComment?.trim() ? shopComment.trim().slice(0, 500) : undefined;

    const review: ReviewItem = {
      reviewId: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId,
      shopId,
      orderId: qualifyingOrder.orderId,
      customerUid,
      customerName: firebaseUser?.displayName || qualifyingOrder.customerName || 'Hawassa Shopper',
      rating: cleanRating,
      comment: comment.trim(),
      ...(cleanShopRating != null ? { shopRating: cleanShopRating } : {}),
      ...(cleanShopComment ? { shopComment: cleanShopComment } : {}),
      verifiedPurchase: true,
      createdAt: new Date().toISOString(),
    };

    if (firebaseUser) {
      await submitReviewInFirestore(review);
    }

    setReviews((prev) => {
      const next = [review, ...prev.filter((r) => r.reviewId !== review.reviewId)];
      if (!firebaseUser) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_REVIEWS, JSON.stringify(next));
      }
      return next;
    });
  };

  const updateReview = async (
    reviewId: string,
    rating: number,
    comment: string,
    shopRating?: number,
    shopComment?: string
  ) => {
    const customerUid = firebaseUser?.uid ?? 'guest-local';
    const target = reviews.find((r) => r.reviewId === reviewId);
    if (!target || target.customerUid !== customerUid) {
      throw new Error('You can only edit your own product review.');
    }

    const validationErrors = validateReviewInput({ rating, comment, shopRating, shopComment });
    const firstError = Object.values(validationErrors)[0];
    if (firstError) {
      throw new Error(firstError);
    }

    const cleanRating = Math.min(5, Math.max(1, Math.round(rating)));
    const cleanComment = comment.trim();
    const cleanShopRating =
      shopRating != null ? Math.min(5, Math.max(1, Math.round(shopRating))) : undefined;
    const cleanShopComment =
      shopComment !== undefined ? shopComment.trim().slice(0, 500) : undefined;
    const updatedAt = new Date().toISOString();

    if (firebaseUser) {
      await updateReviewInFirestore(
        reviewId,
        cleanRating,
        cleanComment,
        updatedAt,
        cleanShopRating,
        cleanShopComment
      );
    }

    setReviews((prev) => {
      const next = prev.map((r) => {
        if (r.reviewId !== reviewId) return r;
        const updated: ReviewItem = {
          ...r,
          rating: cleanRating,
          comment: cleanComment,
          updatedAt,
        };
        if (cleanShopRating != null) updated.shopRating = cleanShopRating;
        if (cleanShopComment !== undefined) {
          if (cleanShopComment) updated.shopComment = cleanShopComment;
          else delete updated.shopComment;
        }
        return updated;
      });
      if (!firebaseUser) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_REVIEWS, JSON.stringify(next));
      }
      return next;
    });
  };

  const deleteReview = async (reviewId: string) => {
    const customerUid = firebaseUser?.uid ?? 'guest-local';
    const target = reviews.find((r) => r.reviewId === reviewId);
    if (!target || target.customerUid !== customerUid) {
      throw new Error('You can only delete your own product review.');
    }

    if (firebaseUser) {
      await deleteReviewInFirestore(reviewId);
    }

    setReviews((prev) => {
      const next = prev.filter((r) => r.reviewId !== reviewId);
      if (!firebaseUser) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_REVIEWS, JSON.stringify(next));
      }
      return next;
    });
  };

  const submitReturnRequest = async ({
    orderId,
    productId,
    variantLabel,
    requestType,
    reason,
    details,
    photoDataUrl,
  }: {
    orderId: string;
    productId: string;
    variantLabel?: string;
    requestType: ReturnRequestType;
    reason: ReturnRequestReason;
    details: string;
    photoDataUrl?: string;
  }): Promise<ReturnRequest> => {
    if (userProfile?.accountStatus === 'suspended') {
      throw new Error(t('governanceUserSuspended'));
    }
    const customerUid = firebaseUser?.uid ?? 'guest-local';
    const order = orders.find((o) => o.orderId === orderId);
    if (!order || order.customerUid !== customerUid || !isOrderEligibleForReturn(order)) {
      throw new Error('This order is not eligible for return or exchange.');
    }

    const orderItem = order.items.find(
      (i) => i.productId === productId && (i.variantLabel ?? '') === (variantLabel ?? '')
    );
    if (!orderItem) {
      throw new Error('Product item was not found in this order.');
    }

    const existing = getItemReturnRequest(returnRequests, orderId, productId, variantLabel);
    if (existing) {
      throw new Error('A return or exchange request has already been submitted for this item.');
    }

    const errs = validateReturnRequestInput({ requestType, reason, details, photoDataUrl });
    const firstErrKey = Object.values(errs)[0];
    if (firstErrKey) {
      throw new Error(t(firstErrKey));
    }

    const now = new Date().toISOString();
    const request: ReturnRequest = {
      returnId: `ret-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      orderId: order.orderId,
      productId: orderItem.productId,
      productName: orderItem.name.slice(0, 140),
      ...(orderItem.variantLabel ? { variantLabel: orderItem.variantLabel.slice(0, 80) } : {}),
      shopId: order.shopId,
      shopName: order.shopName.slice(0, 120),
      customerUid,
      customerName: (firebaseUser?.displayName || order.customerName || 'Hawassa Shopper')
        .trim()
        .slice(0, 100),
      requestType,
      reason,
      details: details.trim().slice(0, 600),
      ...(photoDataUrl ? { photoDataUrl } : {}),
      status: 'requested',
      createdAt: now,
      updatedAt: now,
    };

    if (firebaseUser) {
      await submitReturnRequestInFirestore(request);
    } else {
      const notif: NotificationItem = {
        notificationId: `notif-${Date.now()}`,
        userUid: 'guest-local',
        title: requestType === 'exchange' ? 'Exchange Requested' : 'Return Requested',
        message: `Your ${requestType} request for ${orderItem.name} (#${order.orderId
          .slice(-6)
          .toUpperCase()}) was submitted to ${order.shopName}.`,
        type: 'order_status',
        orderId: order.orderId,
        isRead: false,
        createdAt: now,
      };
      const nextNotifs = [notif, ...notifications];
      setNotifications(nextNotifs);
      localStorage.setItem(STORAGE_KEYS.LOCAL_NOTIFS, JSON.stringify(nextNotifs));
    }

    setReturnRequests((prev) => {
      const next = [request, ...prev.filter((r) => r.returnId !== request.returnId)];
      if (!firebaseUser) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_RETURNS, JSON.stringify(next));
      }
      return next;
    });

    setCartToast({
      id: Date.now(),
      message: t('returnSubmittedToast', { shop: order.shopName }),
    });

    return request;
  };

  const requestPushPermission = async (): Promise<PushPermissionState> => {
    const next = await requestBrowserPushPermission();
    setPushPermission(next);
    return next;
  };

  const subscribePriceAlert = async ({
    product,
    targetPrice,
    enablePush,
  }: {
    product: Product;
    targetPrice: number;
    enablePush: boolean;
  }): Promise<PriceAlert> => {
    if (userProfile?.accountStatus === 'suspended') {
      throw new Error(t('governanceUserSuspended'));
    }
    const cleanTarget = Math.round(targetPrice);
    const validation = validatePriceAlertThreshold(cleanTarget, product.price);
    if (!validation.valid) {
      throw new Error(t(validation.errorKey ?? 'priceAlertErrorLowerThanCurrent'));
    }

    let currentPerm = getPushPermissionState();
    if (enablePush && currentPerm === 'default') {
      currentPerm = await requestBrowserPushPermission();
      setPushPermission(currentPerm);
    }

    const customerUid = firebaseUser?.uid ?? 'guest-local';
    const rawId = `pa-${customerUid.slice(0, 24)}-${product.productId}`;
    const alertId = rawId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
    const existing = priceAlerts.find(
      (a) => a.productId === product.productId && a.customerUid === customerUid
    );
    const now = new Date().toISOString();
    const pushActive = Boolean(enablePush);

    const alert: PriceAlert = {
      alertId: existing?.alertId ?? alertId,
      productId: product.productId,
      productName: product.name.trim().slice(0, 140) || 'Product',
      ...(product.imageUrl ? { productImageUrl: product.imageUrl.slice(0, 500) } : {}),
      shopId: product.shopId,
      shopName: product.shopName.trim().slice(0, 120) || 'Hawassa Shop',
      customerUid,
      baselinePrice: Math.max(1, Math.round(product.price)),
      targetPrice: cleanTarget,
      pushEnabled: pushActive,
      status: 'active',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    triggeredAlertsRef.current.delete(alert.alertId);

    if (firebaseUser) {
      await savePriceAlertInFirestore(alert);
    }

    setPriceAlerts((prev) => {
      const next = [alert, ...prev.filter((a) => a.alertId !== alert.alertId)];
      if (!firebaseUser) {
        localStorage.setItem(STORAGE_KEYS.PRICE_ALERTS, JSON.stringify(next));
      }
      return next;
    });

    if (pushActive && currentPerm === 'granted') {
      void dispatchBrowserPushNotification({
        title: `${t('priceAlertTitle')} · ${alert.productName}`,
        body: t('priceAlertSavedToast', {
          name: alert.productName,
          amount: formatETB(alert.targetPrice),
        }),
        tag: `price-alert-set-${alert.productId}`,
        icon: alert.productImageUrl,
      });
    }

    setCartToast({
      id: Date.now(),
      message: t('priceAlertSavedToast', {
        name: alert.productName,
        amount: formatETB(alert.targetPrice),
      }),
    });

    return alert;
  };

  const removePriceAlert = async (alertId: string): Promise<void> => {
    if (firebaseUser) {
      await deletePriceAlertInFirestore(alertId);
    }
    triggeredAlertsRef.current.delete(alertId);
    setPriceAlerts((prev) => {
      const next = prev.filter((a) => a.alertId !== alertId);
      if (!firebaseUser) {
        localStorage.setItem(STORAGE_KEYS.PRICE_ALERTS, JSON.stringify(next));
      }
      return next;
    });
    setCartToast({
      id: Date.now(),
      message: t('priceAlertRemovedToast'),
    });
  };

  // Monitor catalog price updates and trigger push + in-app alerts when price drops below threshold
  useEffect(() => {
    if (priceAlerts.length === 0 || products.length === 0) return;

    const productById = new Map(products.map((p) => [p.productId, p]));
    const activeUid = firebaseUser?.uid ?? 'guest-local';

    for (const alert of priceAlerts) {
      if (alert.customerUid !== activeUid) continue;
      if (triggeredAlertsRef.current.has(alert.alertId)) continue;
      const liveProd = productById.get(alert.productId);
      if (!liveProd || !shouldTriggerPriceAlert(alert, liveProd.price)) continue;

      triggeredAlertsRef.current.add(alert.alertId);
      const now = new Date().toISOString();
      const triggeredAlert: PriceAlert = {
        ...alert,
        status: 'triggered',
        triggeredAt: now,
        triggeredPrice: Math.round(liveProd.price),
        updatedAt: now,
      };

      setPriceAlerts((prev) => {
        const next = prev.map((a) => (a.alertId === alert.alertId ? triggeredAlert : a));
        if (!firebaseUser) {
          localStorage.setItem(STORAGE_KEYS.PRICE_ALERTS, JSON.stringify(next));
        }
        return next;
      });

      const notifTitle = `${t('priceAlertTitle')}: ${liveProd.name}`;
      const notifBody = `${liveProd.name} at ${alert.shopName} dropped to ${formatETB(
        liveProd.price
      )} (below your ${formatETB(alert.targetPrice)} threshold).`.slice(0, 500);

      const notif: NotificationItem = {
        notificationId: `notif-pa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userUid: activeUid,
        title: notifTitle.slice(0, 140),
        message: notifBody,
        type: 'price_alert',
        productId: liveProd.productId,
        isRead: false,
        createdAt: now,
      };

      if (firebaseUser) {
        void savePriceAlertInFirestore(triggeredAlert).catch((err) => {
          console.warn('Could not persist triggered price alert:', err);
        });
        void saveNotificationInFirestore(notif).catch((err) => {
          console.warn('Could not persist price alert notification:', err);
        });
      } else {
        setNotifications((prev) => {
          const next = [notif, ...prev];
          localStorage.setItem(STORAGE_KEYS.LOCAL_NOTIFS, JSON.stringify(next));
          return next;
        });
      }

      if (alert.pushEnabled && pushPermission === 'granted') {
        void dispatchBrowserPushNotification({
          title: notifTitle,
          body: notifBody,
          tag: `price-drop-${liveProd.productId}`,
          icon: liveProd.imageUrl,
        });
      }

      setCartToast({
        id: Date.now(),
        message: t('priceAlertDropToast', {
          name: liveProd.name,
          price: formatETB(liveProd.price),
        }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, priceAlerts, firebaseUser, pushPermission]);

  const seedReviewIds = useMemo(() => new Set(SEED_REVIEWS.map((r) => r.reviewId)), []);
  const seedProductsById = useMemo(() => {
    const map: Record<string, { rating?: number; reviewCount?: number }> = {};
    for (const sp of SEED_PRODUCTS) {
      map[sp.productId] = { rating: sp.rating, reviewCount: sp.reviewCount };
    }
    return map;
  }, []);

  const enrichedProducts = useMemo(() => {
    return products.map((product) => {
      const summary = calculateProductRatingSummary(
        product,
        reviews,
        seedReviewIds,
        seedProductsById[product.productId]
      );
      return {
        ...product,
        rating: summary.reviewCount > 0 ? summary.averageRating : undefined,
        reviewCount: summary.reviewCount,
      };
    });
  }, [products, reviews, seedReviewIds, seedProductsById]);

  const seedShopsById = useMemo(() => {
    const map: Record<string, { rating?: number; reviewCount?: number }> = {};
    for (const ss of SEED_SHOPS) {
      map[ss.shopId] = { rating: ss.rating, reviewCount: ss.reviewCount };
    }
    return map;
  }, []);

  const enrichedShops = useMemo(() => {
    return shops.map((shop) => {
      const summary = calculateShopRatingSummary(
        shop,
        reviews,
        seedReviewIds,
        seedShopsById[shop.shopId]
      );
      return {
        ...shop,
        rating: summary.averageRating,
        reviewCount: summary.reviewCount,
      };
    });
  }, [shops, reviews, seedReviewIds, seedShopsById]);

  const enrichedShopsById = useMemo(() => {
    const map: Record<string, Shop> = {};
    for (const s of enrichedShops) map[s.shopId] = s;
    return map;
  }, [enrichedShops]);

  const unreadNotificationCount = notifications.filter((n) => !n.isRead).length;

  const effectiveUserCoords = useMemo<UserCoordinates>(() => {
    if (userLocation?.source === 'gps' && userLocation.coords) {
      return userLocation.coords;
    }
    if (selectedNeighborhood && selectedNeighborhood !== 'All Hawassa') {
      return getNeighborhoodCoordinates(selectedNeighborhood);
    }
    if (userLocation?.coords) {
      return userLocation.coords;
    }
    return HAWASSA_CENTER;
  }, [userLocation, selectedNeighborhood]);

  const proximityRankings = useMemo<ShopWithProximity[]>(() => {
    const eligibleShops = governanceConfig.strictShopVerification
      ? enrichedShops.filter((s) => s.status === 'approved')
      : enrichedShops.filter((s) => s.status !== 'suspended');
    return rankShopsByProximity(
      eligibleShops,
      effectiveUserCoords,
      selectedNeighborhood,
      enrichedProducts
    );
  }, [
    enrichedShops,
    enrichedProducts,
    effectiveUserCoords,
    selectedNeighborhood,
    governanceConfig.strictShopVerification,
  ]);

  const proximityByShopId = useMemo<Record<string, ShopWithProximity>>(() => {
    const map: Record<string, ShopWithProximity> = {};
    for (const item of proximityRankings) {
      map[item.shop.shopId] = item;
    }
    return map;
  }, [proximityRankings]);

  const shopDistanceById = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const item of proximityRankings) {
      map[item.shop.shopId] = item.distanceKm;
    }
    return map;
  }, [proximityRankings]);

  const nearbyDeals = useMemo<NearbyDiscountDeal[]>(
    () =>
      findNearbyDiscountedDeals({
        rankedShops: proximityRankings,
        products: enrichedProducts,
        maxDistanceKm: 2.0,
      }),
    [proximityRankings, enrichedProducts]
  );

  const triggerNearbyDiscountAlert = async (options?: {
    isTest?: boolean;
    forceNotify?: boolean;
  }): Promise<boolean> => {
    const isTest = Boolean(options?.isTest);
    const forceNotify = Boolean(options?.forceNotify);
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const activeUid = firebaseUser?.uid ?? 'guest-local';

    let deal: NearbyDiscountDeal | undefined = nearbyDeals[0];
    if (!deal && isTest) {
      const anyDiscountedDeals = findNearbyDiscountedDeals({
        rankedShops: proximityRankings,
        products: enrichedProducts,
        maxDistanceKm: 100,
      });
      deal = anyDiscountedDeals[0];
    }

    if (deal) {
      const bucketLat = Math.round(effectiveUserCoords.lat * 100);
      const bucketLng = Math.round(effectiveUserCoords.lng * 100);
      const dedupeKey = `${bucketLat}:${bucketLng}:${deal.shop.shopId}:${deal.product.productId}`;
      const lastTriggeredAt = triggeredNearbyAlertKeysRef.current.get(dedupeKey) ?? 0;
      if (!isTest && !forceNotify && nowMs - lastTriggeredAt < 15 * 60 * 1000) {
        return false;
      }
      triggeredNearbyAlertKeysRef.current.set(dedupeKey, nowMs);

      const title = t('nearbyDealPushTitle', {
        discount: deal.discountPercent,
        shop: deal.shop.name,
      }).slice(0, 140);
      const body = t('nearbyDealPushBody', {
        product: deal.product.name,
        distance: deal.distanceLabel,
        price: formatETB(deal.product.price),
      }).slice(0, 500);

      const notif: NotificationItem = {
        notificationId: `notif-nearby-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
        userUid: activeUid,
        title,
        message: body,
        type: 'promo',
        productId: deal.product.productId,
        shopId: deal.shop.shopId,
        isRead: false,
        createdAt: nowIso,
      };

      if (firebaseUser) {
        void saveNotificationInFirestore(notif).catch((err) => {
          console.warn('Could not persist nearby deal notification:', err);
        });
      } else {
        setNotifications((prev) => {
          const next = [notif, ...prev].slice(0, 40);
          localStorage.setItem(STORAGE_KEYS.LOCAL_NOTIFS, JSON.stringify(next));
          return next;
        });
      }

      const currentPerm = getPushPermissionState();
      setPushPermission(currentPerm);
      if (currentPerm === 'granted') {
        void dispatchBrowserPushNotification({
          title,
          body,
          tag: `nearby-deal-${deal.product.productId}`,
          icon: deal.product.imageUrl,
        });
      }

      setCartToast({
        id: nowMs,
        message: isTest
          ? t('nearbyTestSentToast', { distance: deal.distanceLabel })
          : t('nearbyDealToast', {
              discount: deal.discountPercent,
              shop: deal.shop.name,
              distance: deal.distanceLabel,
            }),
        actionLabel: t('nearbyViewDealBtn'),
        actionRoute: { name: 'product', productId: deal.product.productId },
      });
      return true;
    }

    // Fallback for test notification when catalog has no active discounted items
    const nearestEntry = proximityRankings[0];
    if (isTest && nearestEntry) {
      const title = t('nearbyShopPushTitle', { shop: nearestEntry.shop.name }).slice(0, 140);
      const body = t('nearbyShopPushBody', {
        shop: nearestEntry.shop.name,
        distance: nearestEntry.distanceLabel,
        neighborhood: getLocalizedNeighborhood(nearestEntry.shop.neighborhood, language),
      }).slice(0, 500);

      const notif: NotificationItem = {
        notificationId: `notif-nearby-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
        userUid: activeUid,
        title,
        message: body,
        type: 'promo',
        shopId: nearestEntry.shop.shopId,
        isRead: false,
        createdAt: nowIso,
      };

      if (firebaseUser) {
        void saveNotificationInFirestore(notif).catch(() => {});
      } else {
        setNotifications((prev) => {
          const next = [notif, ...prev].slice(0, 40);
          localStorage.setItem(STORAGE_KEYS.LOCAL_NOTIFS, JSON.stringify(next));
          return next;
        });
      }

      if (getPushPermissionState() === 'granted') {
        void dispatchBrowserPushNotification({
          title,
          body,
          tag: `nearby-shop-${nearestEntry.shop.shopId}`,
          icon: nearestEntry.shop.logoUrl,
        });
      }

      setCartToast({
        id: nowMs,
        message: t('nearbyTestSentToast', { distance: nearestEntry.distanceLabel }),
        actionLabel: t('visitShop'),
        actionRoute: { name: 'shop', shopId: nearestEntry.shop.shopId },
      });
      return true;
    }

    return false;
  };

  const toggleNearbyAlerts = async (): Promise<boolean> => {
    const nextEnabled = !nearbyAlertsEnabled;
    if (nextEnabled) {
      const perm = await requestBrowserPushPermission();
      setPushPermission(perm);
      setNearbyAlertsEnabled(true);
      localStorage.setItem(STORAGE_KEYS.NEARBY_ALERTS_ENABLED, JSON.stringify(true));
      if (perm === 'denied') {
        setCartToast({
          id: Date.now(),
          message: t('nearbyAlertsPermissionDenied'),
          actionRoute: null,
        });
      }
      await triggerNearbyDiscountAlert({ forceNotify: true });
      return true;
    }
    setNearbyAlertsEnabled(false);
    localStorage.setItem(STORAGE_KEYS.NEARBY_ALERTS_ENABLED, JSON.stringify(false));
    return false;
  };

  const detectUserLocation = async (): Promise<UserLocationState> => {
    setDetectingLocation(true);
    setLocationError(null);

    const buildFallbackLocation = (reason: string | null): UserLocationState => {
      const fallbackArea =
        selectedNeighborhood && selectedNeighborhood !== 'All Hawassa'
          ? selectedNeighborhood
          : 'Piazza';
      const fallbackLoc: UserLocationState = {
        coords: getNeighborhoodCoordinates(fallbackArea),
        label: fallbackArea,
        neighborhood: fallbackArea,
        source: 'neighborhood',
        updatedAt: new Date().toISOString(),
      };
      setUserLocation(fallbackLoc);
      localStorage.setItem(STORAGE_KEYS.USER_LOCATION, JSON.stringify(fallbackLoc));
      setLocationError(reason);
      setCartToast({
        id: Date.now(),
        message: t('locationFallbackToast', {
          neighborhood: getLocalizedNeighborhood(fallbackArea, language),
        }),
        actionRoute: null,
      });
      setDetectingLocation(false);
      return fallbackLoc;
    };

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return buildFallbackLocation('Geolocation unsupported');
    }

    return new Promise<UserLocationState>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const distFromHawassa = calculateDistanceKm(
            latitude,
            longitude,
            HAWASSA_CENTER.lat,
            HAWASSA_CENTER.lng
          );
          const insideHawassa = distFromHawassa <= 35;
          const closest = insideHawassa
            ? resolveClosestNeighborhood(latitude, longitude, HAWASSA_NEIGHBORHOODS)
            : resolveClosestNeighborhood(
                getNeighborhoodCoordinates(
                  selectedNeighborhood !== 'All Hawassa' ? selectedNeighborhood : 'Piazza'
                ).lat,
                getNeighborhoodCoordinates(
                  selectedNeighborhood !== 'All Hawassa' ? selectedNeighborhood : 'Piazza'
                ).lng,
                HAWASSA_NEIGHBORHOODS
              );

          const detectedLoc: UserLocationState = {
            coords: insideHawassa ? { lat: latitude, lng: longitude } : closest.coords,
            label: closest.neighborhood,
            neighborhood: closest.neighborhood,
            source: 'gps',
            accuracyMeters: Number.isFinite(accuracy) ? Math.round(accuracy) : undefined,
            updatedAt: new Date().toISOString(),
          };
          setUserLocation(detectedLoc);
          localStorage.setItem(STORAGE_KEYS.USER_LOCATION, JSON.stringify(detectedLoc));
          setLocationError(null);
          setDetectingLocation(false);
          setCartToast({
            id: Date.now(),
            message: t('locationDetectedToast', {
              neighborhood: getLocalizedNeighborhood(closest.neighborhood, language),
            }),
            actionRoute: null,
          });
          resolve(detectedLoc);
        },
        (err) => {
          resolve(buildFallbackLocation(err.message || 'Location permission denied'));
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000,
        }
      );
    });
  };

  useEffect(() => {
    if (!nearbyAlertsEnabled || nearbyDeals.length === 0) return;
    void triggerNearbyDiscountAlert({ isTest: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearbyAlertsEnabled, effectiveUserCoords.lat, effectiveUserCoords.lng, nearbyDeals.length]);

  const tradeChats = useMemo(() => {
    const byId = new Map<string, TradeChatThread>();
    for (const draft of Object.values(draftTradeThreads)) {
      byId.set(draft.threadId, draft);
    }
    const sourceThreads = firebaseUser
      ? [...buyerCloudChats, ...sellerCloudChats, ...(isCloudAdmin ? adminCloudChats : [])]
      : localTradeChats;
    for (const thread of sourceThreads) {
      byId.set(thread.threadId, thread);
    }
    return sortTradeChatThreads(Array.from(byId.values()));
  }, [
    firebaseUser,
    buyerCloudChats,
    sellerCloudChats,
    adminCloudChats,
    isCloudAdmin,
    localTradeChats,
    draftTradeThreads,
  ]);

  const activeTradeChatThread = useMemo(
    () => tradeChats.find((th) => th.threadId === activeTradeChatThreadId) ?? null,
    [tradeChats, activeTradeChatThreadId]
  );

  const tradeChatMessages = useMemo(() => {
    if (!activeTradeChatThreadId) return [];
    if (firebaseUser) {
      const localDrafts = localTradeMessagesByThread[activeTradeChatThreadId] ?? [];
      if (cloudActiveChatMessages.length > 0) return cloudActiveChatMessages;
      return localDrafts;
    }
    return localTradeMessagesByThread[activeTradeChatThreadId] ?? [];
  }, [firebaseUser, activeTradeChatThreadId, cloudActiveChatMessages, localTradeMessagesByThread]);

  const adminSupervisedMessages = useMemo(() => {
    if (!adminSupervisedThreadId) return [];
    if (firebaseUser && isCloudAdmin) {
      if (cloudAdminSupervisedMessages.length > 0) return cloudAdminSupervisedMessages;
    }
    return localTradeMessagesByThread[adminSupervisedThreadId] ?? [];
  }, [
    firebaseUser,
    isCloudAdmin,
    adminSupervisedThreadId,
    cloudAdminSupervisedMessages,
    localTradeMessagesByThread,
  ]);

  const supervisionAttentionCount = useMemo(
    () => countSupervisionAttentionThreads(tradeChats),
    [tradeChats]
  );

  const persistLocalChatUpdate = (
    updatedThread: TradeChatThread,
    appendedMessage?: TradeChatMessage
  ) => {
    setLocalTradeChats((prev) => {
      const next = sortTradeChatThreads([
        updatedThread,
        ...prev.filter((t) => t.threadId !== updatedThread.threadId),
      ]);
      localStorage.setItem(STORAGE_KEYS.TRADE_CHATS, JSON.stringify(next));
      return next;
    });
    if (appendedMessage) {
      setLocalTradeMessagesByThread((prev) => {
        const existing = prev[updatedThread.threadId] ?? [];
        if (existing.some((m) => m.messageId === appendedMessage.messageId)) return prev;
        const nextMap = {
          ...prev,
          [updatedThread.threadId]: [...existing, appendedMessage],
        };
        localStorage.setItem(STORAGE_KEYS.TRADE_CHAT_MESSAGES, JSON.stringify(nextMap));
        return nextMap;
      });
    }
    setDraftTradeThreads((prev) => {
      if (!prev[updatedThread.threadId]) return prev;
      const copy = { ...prev };
      delete copy[updatedThread.threadId];
      return copy;
    });
  };

  const openOrderChat = (order: Order) => {
    const threadId = buildOrderChatThreadId(order.orderId);
    const existing = tradeChats.find((th) => th.threadId === threadId);
    if (!existing) {
      const now = new Date().toISOString();
      const targetShop = enrichedShopsById[order.shopId];
      const buyerUid = order.customerUid || firebaseUser?.uid || userProfile?.uid || 'guest-customer';
      const sellerUid = targetShop?.ownerUid || 'seed-seller-1';
      const draft: TradeChatThread = {
        threadId,
        threadType: 'order',
        orderId: order.orderId,
        orderCode: formatOrderChatCode(order.orderId),
        orderTotalEtb: order.totalAmount,
        orderStatusSnapshot: order.orderStatus,
        shopId: order.shopId,
        shopName: order.shopName || targetShop?.name || 'Hawassa Shop',
        buyerUid,
        buyerName: order.customerName || userProfile?.displayName || 'Customer',
        sellerUid,
        sellerName: targetShop?.name || order.shopName || 'Merchant',
        lastMessage: '',
        lastSenderUid: buyerUid,
        lastSenderRole: 'buyer',
        lastMessageAt: now,
        supervisionStatus: 'none',
        createdAt: now,
        updatedAt: now,
      };
      setDraftTradeThreads((prev) => ({ ...prev, [threadId]: draft }));
    }
    setActiveTradeChatThreadId(threadId);
    setTradeChatModalOpen(true);
  };

  const openShopChat = (shop: Shop) => {
    const buyerUid = firebaseUser?.uid || userProfile?.uid || 'guest-customer';
    const threadId = buildShopChatThreadId(shop.shopId, buyerUid);
    const existing = tradeChats.find((th) => th.threadId === threadId);
    if (!existing) {
      const now = new Date().toISOString();
      const draft: TradeChatThread = {
        threadId,
        threadType: 'shop',
        shopId: shop.shopId,
        shopName: shop.name,
        buyerUid,
        buyerName: userProfile?.displayName || firebaseUser?.displayName || 'Customer',
        sellerUid: shop.ownerUid || 'seed-seller-1',
        sellerName: shop.name,
        lastMessage: '',
        lastSenderUid: buyerUid,
        lastSenderRole: 'buyer',
        lastMessageAt: now,
        supervisionStatus: 'none',
        createdAt: now,
        updatedAt: now,
      };
      setDraftTradeThreads((prev) => ({ ...prev, [threadId]: draft }));
    }
    setActiveTradeChatThreadId(threadId);
    setTradeChatModalOpen(true);
  };

  const openTradeChatInbox = (threadId?: string) => {
    setActiveTradeChatThreadId(threadId ?? null);
    setTradeChatModalOpen(true);
  };

  const closeTradeChatModal = () => {
    setTradeChatModalOpen(false);
  };

  const sendTradeChatMessage = async (
    threadId: string,
    body: string,
    preferredRole?: 'buyer' | 'seller'
  ) => {
    const err = validateChatMessageInput(body);
    if (err) throw new Error(err);
    const thread = tradeChats.find((th) => th.threadId === threadId);
    if (!thread) throw new Error('Conversation thread not found.');

    const now = new Date().toISOString();
    const senderUid = firebaseUser?.uid || userProfile?.uid || thread.buyerUid;
    let senderRole: TradeChatMessage['senderRole'] = preferredRole ?? 'buyer';
    if (firebaseUser) {
      if (preferredRole === 'seller' && firebaseUser.uid === thread.sellerUid) {
        senderRole = 'seller';
      } else if (preferredRole === 'buyer' && firebaseUser.uid === thread.buyerUid) {
        senderRole = 'buyer';
      } else if (firebaseUser.uid === thread.buyerUid) {
        senderRole = 'buyer';
      } else if (firebaseUser.uid === thread.sellerUid) {
        senderRole = 'seller';
      } else if (isCloudAdmin) {
        senderRole = 'admin';
      }
    }

    const senderName =
      senderRole === 'seller'
        ? thread.shopName || thread.sellerName
        : senderRole === 'admin'
        ? userProfile?.displayName || 'Marketplace Admin'
        : userProfile?.displayName || firebaseUser?.displayName || thread.buyerName;

    const cleanBody = body.trim().slice(0, 1000);
    const msg: TradeChatMessage = {
      messageId: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      threadId: thread.threadId,
      buyerUid: thread.buyerUid,
      sellerUid: thread.sellerUid,
      senderUid,
      senderName,
      senderRole,
      messageType: 'text',
      body: cleanBody,
      createdAt: now,
    };

    const recipientUid = senderRole === 'seller' ? thread.buyerUid : thread.sellerUid;
    const notif: NotificationItem | undefined =
      recipientUid && recipientUid !== senderUid && !recipientUid.startsWith('seed-')
        ? {
            notificationId: `notif-chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            userUid: recipientUid,
            title:
              thread.orderCode
                ? `New message · Order #${thread.orderCode}`
                : `New message · ${thread.shopName}`,
            message: `${senderName}: ${cleanBody.slice(0, 140)}`,
            type: 'system',
            isRead: false,
            createdAt: now,
          }
        : undefined;

    const updatedThread: TradeChatThread = {
      ...thread,
      lastMessage: cleanBody,
      lastSenderUid: senderUid,
      lastSenderRole: senderRole,
      lastMessageAt: now,
      updatedAt: now,
    };

    if (firebaseUser) {
      await sendTradeChatMessageInFirestore({
        baseThread: thread,
        message: msg,
        notification: notif,
      });
    } else {
      persistLocalChatUpdate(updatedThread, msg);
    }
  };

  const requestAdminSupervision = async (threadId: string, reason?: string) => {
    const cleanReason = (reason ?? '').trim();
    const err = validateSupervisionReason(cleanReason);
    if (err) throw new Error(err);

    const thread = tradeChats.find((th) => th.threadId === threadId);
    if (!thread) throw new Error('Conversation thread not found.');

    const now = new Date().toISOString();
    const requesterUid = firebaseUser?.uid || userProfile?.uid || thread.buyerUid;
    const requesterRole: 'buyer' | 'seller' =
      requesterUid === thread.sellerUid || activeRoleView === 'seller' ? 'seller' : 'buyer';
    const requesterLabel =
      requesterRole === 'seller'
        ? thread.shopName || thread.sellerName
        : userProfile?.displayName || firebaseUser?.displayName || thread.buyerName;

    const systemBody = cleanReason
      ? `Admin Supervision Requested by ${requesterLabel} (${requesterRole}): ${cleanReason}`
      : `Admin Supervision Requested by ${requesterLabel} (${requesterRole}). A Hawasa Gebeya moderator will review this thread shortly.`;

    const isNonParticipantAdmin =
      Boolean(firebaseUser) &&
      isCloudAdmin &&
      firebaseUser?.uid !== thread.buyerUid &&
      firebaseUser?.uid !== thread.sellerUid;

    const sysMsg: TradeChatMessage = {
      messageId: `msg-sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      threadId: thread.threadId,
      buyerUid: thread.buyerUid,
      sellerUid: thread.sellerUid,
      senderUid: requesterUid,
      senderName: 'Hawasa Gebeya Supervision',
      senderRole: 'system',
      messageType: isNonParticipantAdmin ? 'mediator_notice' : 'supervision_request',
      body: systemBody.slice(0, 1000),
      createdAt: now,
    };

    const counterpartyUid = requesterRole === 'seller' ? thread.buyerUid : thread.sellerUid;
    const counterpartyNotification: NotificationItem | undefined =
      counterpartyUid && counterpartyUid !== requesterUid && !counterpartyUid.startsWith('seed-')
        ? {
            notificationId: `notif-sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            userUid: counterpartyUid,
            title: thread.orderCode
              ? `Admin Supervision Requested · Order #${thread.orderCode}`
              : `Admin Supervision Requested · ${thread.shopName}`,
            message: systemBody.slice(0, 260),
            type: 'system',
            isRead: false,
            createdAt: now,
          }
        : undefined;

    const updatedThread: TradeChatThread = {
      ...thread,
      supervisionStatus: 'requested',
      supervisionRequestedByUid: requesterUid,
      supervisionRequestedByRole: requesterRole,
      ...(cleanReason ? { supervisionReason: cleanReason } : {}),
      supervisionRequestedAt: now,
      lastMessage: sysMsg.body,
      lastSenderUid: requesterUid,
      lastSenderRole: 'system',
      lastMessageAt: now,
      updatedAt: now,
    };

    if (firebaseUser) {
      await requestAdminSupervisionInFirestore({
        baseThread: thread,
        requesterUid,
        requesterRole,
        reason: cleanReason || undefined,
        systemMessage: sysMsg,
        counterpartyNotification,
      });
    } else {
      persistLocalChatUpdate(updatedThread, sysMsg);
    }

    setCartToast({
      id: Date.now(),
      message: t('supervisionRequestedToast'),
      actionRoute: null,
    });
  };

  const adminJoinChatMediation = async (threadId: string, introNote?: string) => {
    if (!canAccessAdmin) throw new Error('Admin privileges required.');
    const thread = tradeChats.find((th) => th.threadId === threadId);
    if (!thread) throw new Error('Conversation thread not found.');

    const now = new Date().toISOString();
    const adminUid = firebaseUser?.uid || userProfile?.uid || 'admin-mediator';
    const adminName = userProfile?.displayName || firebaseUser?.displayName || 'Hawasa Gebeya Mediator';
    const body =
      introNote?.trim() ||
      `Marketplace Admin (${adminName}) has joined this thread to supervise and mediate.`;

    const msg: TradeChatMessage = {
      messageId: `msg-med-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      threadId: thread.threadId,
      buyerUid: thread.buyerUid,
      sellerUid: thread.sellerUid,
      senderUid: adminUid,
      senderName: adminName,
      senderRole: 'admin',
      messageType: 'mediator_notice',
      body: body.slice(0, 1000),
      createdAt: now,
    };

    const notifs: NotificationItem[] = [thread.buyerUid, thread.sellerUid]
      .filter((uid) => uid && uid !== adminUid && !uid.startsWith('seed-'))
      .map((uid, idx) => ({
        notificationId: `notif-med-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        userUid: uid,
        title: thread.orderCode
          ? `Admin Mediator Joined · Order #${thread.orderCode}`
          : `Admin Mediator Joined · ${thread.shopName}`,
        message: body.slice(0, 260),
        type: 'system',
        isRead: false,
        createdAt: now,
      }));

    if (firebaseUser && isCloudAdmin) {
      await adminMediateChatInFirestore({
        thread,
        adminUid,
        adminName,
        nextStatus: 'active',
        message: msg,
        notifications: notifs,
      });
    } else {
      persistLocalChatUpdate(
        {
          ...thread,
          supervisionStatus: 'active',
          assignedAdminUid: adminUid,
          assignedAdminName: adminName,
          lastMessage: msg.body,
          lastSenderUid: adminUid,
          lastSenderRole: 'admin',
          lastMessageAt: now,
          updatedAt: now,
        },
        msg
      );
    }

    await recordAuditEntry({
      action: 'join_chat_supervision',
      targetType: 'chat_supervision',
      targetId: thread.threadId,
      targetLabel: thread.orderCode ? `Order #${thread.orderCode}` : thread.shopName,
      reason: introNote?.trim() || thread.supervisionReason,
    });
  };

  const adminSendMediatorMessage = async (threadId: string, body: string) => {
    if (!canAccessAdmin) throw new Error('Admin privileges required.');
    const err = validateChatMessageInput(body);
    if (err) throw new Error(err);
    const thread = tradeChats.find((th) => th.threadId === threadId);
    if (!thread) throw new Error('Conversation thread not found.');

    const now = new Date().toISOString();
    const adminUid = firebaseUser?.uid || userProfile?.uid || 'admin-mediator';
    const adminName = userProfile?.displayName || firebaseUser?.displayName || 'Hawasa Gebeya Mediator';
    const cleanBody = body.trim().slice(0, 1000);

    const msg: TradeChatMessage = {
      messageId: `msg-adm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      threadId: thread.threadId,
      buyerUid: thread.buyerUid,
      sellerUid: thread.sellerUid,
      senderUid: adminUid,
      senderName: adminName,
      senderRole: 'admin',
      messageType: 'text',
      body: cleanBody,
      createdAt: now,
    };

    const notifs: NotificationItem[] = [thread.buyerUid, thread.sellerUid]
      .filter((uid) => uid && uid !== adminUid && !uid.startsWith('seed-'))
      .map((uid, idx) => ({
        notificationId: `notif-adm-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        userUid: uid,
        title: thread.orderCode
          ? `Admin Mediator Message · Order #${thread.orderCode}`
          : `Admin Mediator Message · ${thread.shopName}`,
        message: `${adminName}: ${cleanBody.slice(0, 140)}`,
        type: 'system',
        isRead: false,
        createdAt: now,
      }));

    if (firebaseUser && isCloudAdmin) {
      await adminMediateChatInFirestore({
        thread,
        adminUid,
        adminName,
        nextStatus: 'active',
        message: msg,
        notifications: notifs,
      });
    } else {
      persistLocalChatUpdate(
        {
          ...thread,
          supervisionStatus: 'active',
          assignedAdminUid: adminUid,
          assignedAdminName: adminName,
          lastMessage: cleanBody,
          lastSenderUid: adminUid,
          lastSenderRole: 'admin',
          lastMessageAt: now,
          updatedAt: now,
        },
        msg
      );
    }
  };

  const adminResolveChatSupervision = async (threadId: string, resolutionNote?: string) => {
    if (!canAccessAdmin) throw new Error('Admin privileges required.');
    const thread = tradeChats.find((th) => th.threadId === threadId);
    if (!thread) throw new Error('Conversation thread not found.');

    const now = new Date().toISOString();
    const adminUid = firebaseUser?.uid || userProfile?.uid || 'admin-mediator';
    const adminName = userProfile?.displayName || firebaseUser?.displayName || 'Hawasa Gebeya Mediator';
    const cleanNote = resolutionNote?.trim().slice(0, 300);
    const body = cleanNote
      ? `Admin Supervision Marked Resolved by ${adminName}: ${cleanNote}`
      : `Admin Supervision Marked Resolved by ${adminName}.`;

    const msg: TradeChatMessage = {
      messageId: `msg-res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      threadId: thread.threadId,
      buyerUid: thread.buyerUid,
      sellerUid: thread.sellerUid,
      senderUid: adminUid,
      senderName: adminName,
      senderRole: 'system',
      messageType: 'supervision_resolved',
      body: body.slice(0, 1000),
      createdAt: now,
    };

    const notifs: NotificationItem[] = [thread.buyerUid, thread.sellerUid]
      .filter((uid) => uid && uid !== adminUid && !uid.startsWith('seed-'))
      .map((uid, idx) => ({
        notificationId: `notif-res-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        userUid: uid,
        title: thread.orderCode
          ? `Supervision Resolved · Order #${thread.orderCode}`
          : `Supervision Resolved · ${thread.shopName}`,
        message: body.slice(0, 260),
        type: 'system',
        isRead: false,
        createdAt: now,
      }));

    if (firebaseUser && isCloudAdmin) {
      await adminMediateChatInFirestore({
        thread,
        adminUid,
        adminName,
        nextStatus: 'resolved',
        message: msg,
        resolutionNote: cleanNote,
        notifications: notifs,
      });
    } else {
      persistLocalChatUpdate(
        {
          ...thread,
          supervisionStatus: 'resolved',
          assignedAdminUid: adminUid,
          assignedAdminName: adminName,
          ...(cleanNote ? { resolutionNote: cleanNote } : {}),
          resolvedAt: now,
          lastMessage: msg.body,
          lastSenderUid: adminUid,
          lastSenderRole: 'system',
          lastMessageAt: now,
          updatedAt: now,
        },
        msg
      );
    }

    await recordAuditEntry({
      action: 'resolve_chat_supervision',
      targetType: 'chat_supervision',
      targetId: thread.threadId,
      targetLabel: thread.orderCode ? `Order #${thread.orderCode}` : thread.shopName,
      reason: cleanNote,
    });
  };

  return (
    <MarketplaceContext.Provider
      value={{
        route,
        navigate,
        goBack,
        routePathString,
        firebaseUser,
        userProfile,
        activeRoleView,
        setActiveRoleView,
        canAccessSeller,
        canAccessAdmin,
        developerMode,
        setDeveloperMode,
        authLoading,
        isEmailVerified,
        needsEmailVerification,
        emailVerificationCooldown,
        emailVerificationNotice,
        clearEmailVerificationNotice,
        resendVerificationEmail,
        checkEmailVerificationStatus,
        welcomeBackNotice,
        clearWelcomeBackNotice,
        guestAccessGranted,
        isAuthGateActive,
        continueAsGuest,
        openAuthScreen,
        authError,
        clearAuthError,
        signInWithGoogle,
        signInWithEmailPassword,
        resetPasswordByEmail,
        registerWithEmailPassword,
        phoneOtpState,
        sendPhoneOtp,
        verifyPhoneOtp,
        resetPhoneOtp,
        signOutUser,
        firebaseConnected,
        language,
        setLanguage,
        themePreference,
        resolvedTheme,
        setThemePreference,
        toggleTheme,
        t,
        selectedNeighborhood,
        setSelectedNeighborhood,
        userLocation,
        effectiveUserCoords,
        detectingLocation,
        locationError,
        detectUserLocation,
        proximityRankings,
        proximityByShopId,
        shopDistanceById,
        nearbyDeals,
        nearbyAlertsEnabled,
        toggleNearbyAlerts,
        triggerNearbyDiscountAlert,
        completeOnboarding,
        shops: enrichedShops,
        shopsById: enrichedShopsById,
        products: enrichedProducts,
        categories,
        reviews,
        recentSearches,
        addRecentSearch,
        searchSession,
        setSearchSession,
        refreshCatalogFromFirestore,
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        syncCartWithLiveCatalog,
        promoCode,
        setPromoCode,
        cartToast,
        dismissCartToast,
        favorites,
        toggleFavorite,
        saveWishlistToFavorites,
        addWishlistToCart,
        shareWishlist,
        loadSharedWishlist,
        followedShops,
        toggleFollowShop,
        recentlyViewedIds,
        recordProductView,
        orders,
        sellerOrders: activeRoleView === 'seller' ? orders.filter((o) => o.shopId === activeSellerShopId).concat(sellerOrders.filter((so) => !orders.some((o) => o.orderId === so.orderId))) : sellerOrders,
        addresses,
        notifications,
        unreadNotificationCount,
        deliveryFeeEtb,
        setDeliveryFeeEtb,
        isCloudAdmin,
        governanceConfig,
        adminUsers: adminUsers.length > 0 ? adminUsers : userProfile ? [userProfile] : [],
        adminOrders: isCloudAdmin ? adminOrders : orders,
        adminReturnRequests: isCloudAdmin ? adminReturnRequests : returnRequests,
        adminAuditLogs,
        loyaltyTransactions,
        loyaltyBalance: loyaltyStats.balance,
        lifetimeLoyaltyPoints: loyaltyStats.lifetimeEarned,
        totalRedeemedLoyaltyPoints: loyaltyStats.totalRedeemed,
        redeemLoyaltyPoints,
        setRedeemLoyaltyPoints,
        placeOrder,
        verifyOrderPayment,
        paymentProviders,
        reorderFromOrder,
        updateOrderStatus,
        saveAddress,
        deleteAddress,
        markNotificationRead,
        saveSellerProduct,
        runCoffeeMigrationAsAdmin,
        saveSellerShop,
        moderateShopStatus,
        moderateShopGovernance,
        deleteShopAsAdmin,
        moderateProductStatus,
        moderateProductGovernance,
        deleteProductAsAdmin,
        adminForceOrderAction,
        adminResolveReturnRequest,
        adminUpdateUserAccount,
        adminGrantRoleByEmail,
        adminDeleteReview,
        updateGovernanceConfig,
        saveCategory,
        submitReview,
        updateReview,
        deleteReview,
        returnRequests,
        submitReturnRequest,
        priceAlerts,
        pushPermission,
        requestPushPermission,
        subscribePriceAlert,
        removePriceAlert,
        merchantVerifications,
        getShopVerification,
        submitMerchantVerification,
        adminReviewMerchantVerification,
        activeSellerShopId,
        setActiveSellerShopId,
        tradeChats,
        tradeChatModalOpen,
        activeTradeChatThreadId,
        setActiveTradeChatThreadId,
        activeTradeChatThread,
        tradeChatMessages,
        adminSupervisedThreadId,
        setAdminSupervisedThreadId,
        adminSupervisedMessages,
        supervisionAttentionCount,
        openOrderChat,
        openShopChat,
        openTradeChatInbox,
        closeTradeChatModal,
        sendTradeChatMessage,
        requestAdminSupervision,
        adminJoinChatMediation,
        adminSendMediatorMessage,
        adminResolveChatSupervision,
        chatbotOpen,
        openChatbot,
        closeChatbot,
        toggleChatbot,
      }}
    >
      {children}
    </MarketplaceContext.Provider>
  );
};

export function useMarketplace(): MarketplaceContextValue {
  const ctx = useContext(MarketplaceContext);
  if (!ctx) throw new Error('useMarketplace must be used inside MarketplaceProvider');
  return ctx;
}
