import type {
  CartItem,
  DocumentVerificationStatus,
  LoyaltyTransaction,
  MarketplaceGovernanceConfig,
  MerchantVerification,
  NearbyDiscountDeal,
  Order,
  OrderStatus,
  PaymentMethod,
  PriceAlert,
  Product,
  ResolvedTheme,
  ReturnRequest,
  ReturnRequestReason,
  ReturnRequestType,
  ReviewItem,
  Shop,
  ShopWithProximity,
  ThemePreference,
  TradeChatThread,
  UserCoordinates,
  UserProfile,
  UserRole,
} from '../types';
import {
  getNeighborhoodCoordinates,
  getShopCoordinates,
  HAWASSA_CENTER,
  normalizeNeighborhoodKey,
  resolveClosestNeighborhood,
} from './hawassaCoordinates';
import {
  MAX_IMAGE_FILE_BYTES,
  MAX_IMAGE_UPLOAD_DATA_URL_LENGTH,
  estimateDataUrlByteSize,
  validateImagePayloadSize,
} from './imageUpload';

export {
  MAX_IMAGE_FILE_BYTES,
  MAX_IMAGE_UPLOAD_DATA_URL_LENGTH,
  estimateDataUrlByteSize,
  validateImagePayloadSize,
  getNeighborhoodCoordinates,
  getShopCoordinates,
  HAWASSA_CENTER,
  normalizeNeighborhoodKey,
  resolveClosestNeighborhood,
};

export const HAWASSA_NEIGHBORHOODS = [
  'Piazza',
  'Menhariya',
  'Gebeya Dar',
  'Datto',
  'Arab Sefer',
  'Tabor',
  'Bilo',
  'Atote',
] as const;

export const DEFAULT_HAWASSA_DELIVERY_FEE_ETB = 80;
export const FREE_DELIVERY_THRESHOLD_ETB = 2000;
export const DEFAULT_MAX_ORDER_AMOUNT_ETB = 100_000;

export const DEFAULT_GOVERNANCE_CONFIG: MarketplaceGovernanceConfig = {
  configId: 'global',
  deliveryFeeEtb: DEFAULT_HAWASSA_DELIVERY_FEE_ETB,
  freeDeliveryThresholdEtb: FREE_DELIVERY_THRESHOLD_ETB,
  maxOrderAmountEtb: DEFAULT_MAX_ORDER_AMOUNT_ETB,
  orderingPaused: false,
  maintenanceBanner: '',
  strictShopVerification: true,
  updatedAt: '2026-11-10T08:00:00.000Z',
};

export const LOYALTY_ETB_PER_POINT_EARNED = 20;
export const LOYALTY_ETB_PER_POINT_REDEEMED = 1;
export const LOYALTY_MIN_REDEEM_POINTS = 10;

export type LoyaltyTierId = 'starter' | 'regular' | 'vip';

export function calculateEarnedLoyaltyPoints(netMerchandiseEtb: number): number {
  if (!Number.isFinite(netMerchandiseEtb) || netMerchandiseEtb < LOYALTY_ETB_PER_POINT_EARNED) {
    return 0;
  }
  return Math.floor(netMerchandiseEtb / LOYALTY_ETB_PER_POINT_EARNED);
}

export function calculateMaxRedeemablePoints(
  availablePoints: number,
  subtotalAfterPromoEtb: number
): number {
  if (!Number.isFinite(availablePoints) || !Number.isFinite(subtotalAfterPromoEtb)) return 0;
  const maxByOrder = Math.floor(Math.max(0, subtotalAfterPromoEtb) / LOYALTY_ETB_PER_POINT_REDEEMED);
  return Math.max(0, Math.min(Math.floor(availablePoints), maxByOrder));
}

export function validateLoyaltyRedemption(
  requestedPoints: number,
  availablePoints: number,
  subtotalAfterPromoEtb: number
): {
  valid: boolean;
  appliedPoints: number;
  discountAmount: number;
  errorKey?: string;
} {
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
      errorKey: 'loyaltyErrorMinPoints',
    };
  }
  const maxRedeemable = calculateMaxRedeemablePoints(safeAvailable, subtotalAfterPromoEtb);
  if (maxRedeemable < LOYALTY_MIN_REDEEM_POINTS) {
    return {
      valid: false,
      appliedPoints: 0,
      discountAmount: 0,
      errorKey: 'loyaltyErrorOrderTooLow',
    };
  }
  const appliedPoints = Math.min(cleanRequested, maxRedeemable);
  return {
    valid: true,
    appliedPoints,
    discountAmount: appliedPoints * LOYALTY_ETB_PER_POINT_REDEEMED,
  };
}

export function getLoyaltyTier(lifetimePoints: number): {
  tier: LoyaltyTierId;
  nextTierPoints: number | null;
} {
  const pts = Math.max(0, Math.floor(lifetimePoints));
  if (pts >= 500) return { tier: 'vip', nextTierPoints: null };
  if (pts >= 150) return { tier: 'regular', nextTierPoints: 500 };
  return { tier: 'starter', nextTierPoints: 150 };
}

export function calculateLoyaltyBalanceFromTransactions(transactions: LoyaltyTransaction[]): {
  balance: number;
  lifetimeEarned: number;
  totalRedeemed: number;
} {
  let balance = 0;
  let lifetimeEarned = 0;
  let totalRedeemed = 0;

  for (const tx of transactions) {
    balance += tx.points;
    if (tx.type === 'earned') {
      lifetimeEarned += Math.max(0, tx.points);
    } else if (tx.type === 'reversed') {
      lifetimeEarned = Math.max(0, lifetimeEarned - Math.abs(tx.points));
    } else if (tx.type === 'redeemed') {
      totalRedeemed += Math.abs(tx.points);
    } else if (tx.type === 'refunded') {
      totalRedeemed = Math.max(0, totalRedeemed - Math.abs(tx.points));
    }
  }

  return {
    balance: Math.max(0, balance),
    lifetimeEarned: Math.max(0, lifetimeEarned),
    totalRedeemed: Math.max(0, totalRedeemed),
  };
}

export interface PromoCodeRule {
  code: string;
  type: 'percent' | 'flat' | 'free_delivery';
  value: number;
  maxDiscount?: number;
  minSubtotal: number;
  summaryKey: string;
}

export const PROMO_CODES: PromoCodeRule[] = [
  {
    code: 'HAWASSA10',
    type: 'percent',
    value: 10,
    maxDiscount: 500,
    minSubtotal: 300,
    summaryKey: 'promoDescHawassa10',
  },
  {
    code: 'SIDAMA150',
    type: 'flat',
    value: 150,
    minSubtotal: 1000,
    summaryKey: 'promoDescSidama150',
  },
  {
    code: 'FREEDEL',
    type: 'free_delivery',
    value: 0,
    minSubtotal: 0,
    summaryKey: 'promoDescFreedel',
  },
];

export interface PromoValidationResult {
  valid: boolean;
  normalizedCode: string;
  discountAmount: number;
  waivesDelivery: boolean;
  errorKey?: string;
  minSubtotal?: number;
}

export function validatePromoCode(
  rawCode: string,
  subtotal: number,
  fulfillmentMethod: 'delivery' | 'pickup'
): PromoValidationResult {
  const normalizedCode = rawCode.trim().toUpperCase();
  if (!normalizedCode) {
    return { valid: false, normalizedCode: '', discountAmount: 0, waivesDelivery: false };
  }

  const rule = PROMO_CODES.find((p) => p.code === normalizedCode);
  if (!rule) {
    return {
      valid: false,
      normalizedCode,
      discountAmount: 0,
      waivesDelivery: false,
      errorKey: 'promoErrorInvalid',
    };
  }

  if (subtotal < rule.minSubtotal) {
    return {
      valid: false,
      normalizedCode,
      discountAmount: 0,
      waivesDelivery: false,
      errorKey: 'promoErrorMinSubtotal',
      minSubtotal: rule.minSubtotal,
    };
  }

  if (rule.type === 'free_delivery') {
    if (fulfillmentMethod === 'pickup') {
      return {
        valid: false,
        normalizedCode,
        discountAmount: 0,
        waivesDelivery: false,
        errorKey: 'promoErrorDeliveryOnly',
      };
    }
    return {
      valid: true,
      normalizedCode,
      discountAmount: 0,
      waivesDelivery: true,
    };
  }

  const rawDiscount =
    rule.type === 'percent' ? Math.round((subtotal * rule.value) / 100) : rule.value;
  const capped = rule.maxDiscount != null ? Math.min(rawDiscount, rule.maxDiscount) : rawDiscount;
  return {
    valid: true,
    normalizedCode,
    discountAmount: Math.min(subtotal, Math.max(0, capped)),
    waivesDelivery: false,
  };
}

export function formatETB(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return `ETB ${safe.toLocaleString('en-US')}`;
}

export interface CartSummary {
  itemCount: number;
  subtotal: number;
  promoDiscountAmount: number;
  loyaltyPointsApplied: number;
  loyaltyDiscountAmount: number;
  loyaltyErrorKey?: string;
  pointsToEarn: number;
  discountAmount: number;
  promoCode: string | null;
  promoErrorKey?: string;
  promoMinSubtotal?: number;
  deliveryFee: number;
  freeDeliveryUnlocked: boolean;
  amountToFreeDelivery: number;
  totalAmount: number;
  shopIds: string[];
  hasMultipleShops: boolean;
  primaryShopId: string | null;
  hasStockIssues: boolean;
  stockIssues: string[];
}

export function getCartItemUnitPrice(item: CartItem): number {
  if (typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice) && item.unitPrice > 0) {
    return item.unitPrice;
  }
  if (item.variantId && item.product.variants) {
    const matched = item.product.variants.find((v) => v.id === item.variantId);
    if (matched) return matched.price;
  }
  return item.product.price;
}

export function getCartItemKey(productId: string, variantId?: string): string {
  return variantId ? `${productId}::${variantId}` : productId;
}

export function calculateCartSummary(
  items: CartItem[],
  fulfillmentMethod: 'delivery' | 'pickup',
  deliveryFeePerOrder: number = DEFAULT_HAWASSA_DELIVERY_FEE_ETB,
  promoCode?: string,
  loyaltyPointsToRedeem: number = 0,
  availableLoyaltyPoints: number = 0,
  freeDeliveryThresholdEtb: number = FREE_DELIVERY_THRESHOLD_ETB
): CartSummary {
  const shopIds = Array.from(new Set(items.map((item) => item.shopId)));
  const stockIssues: string[] = [];

  let subtotal = 0;
  let itemCount = 0;

  for (const item of items) {
    const qty = Math.max(0, Math.floor(item.quantity));
    if (qty <= 0) continue;
    itemCount += qty;
    subtotal += getCartItemUnitPrice(item) * qty;

    const variantStock =
      item.variantId && item.product.variants
        ? item.product.variants.find((v) => v.id === item.variantId)?.stock ?? item.product.stock
        : item.product.stock;

    if (!item.product.isAvailable || item.product.status !== 'active') {
      stockIssues.push(`${item.product.name} is currently unavailable.`);
    } else if (qty > variantStock) {
      stockIssues.push(`Only ${variantStock} left in stock for ${item.product.name}.`);
    }
  }

  const promoResult = promoCode
    ? validatePromoCode(promoCode, subtotal, fulfillmentMethod)
    : null;

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
  const freeDeliveryUnlocked =
    fulfillmentMethod === 'delivery' &&
    items.length > 0 &&
    (freeDeliveryByThreshold || Boolean(promoResult?.valid && promoResult.waivesDelivery));

  const deliveryFee =
    items.length > 0 && fulfillmentMethod === 'delivery' && !freeDeliveryUnlocked
      ? deliveryFeePerOrder
      : 0;

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
    promoErrorKey: promoResult && !promoResult.valid ? promoResult.errorKey : undefined,
    promoMinSubtotal: promoResult?.minSubtotal,
    deliveryFee,
    freeDeliveryUnlocked,
    amountToFreeDelivery,
    totalAmount: netMerchandise + deliveryFee,
    shopIds,
    hasMultipleShops: shopIds.length > 1,
    primaryShopId: shopIds[0] ?? null,
    hasStockIssues: stockIssues.length > 0,
    stockIssues,
  };
}

export function getRelatedProducts(
  currentProduct: Product,
  allProducts: Product[],
  limit: number = 4
): Product[] {
  return allProducts
    .filter((p) => p.status === 'active' && p.productId !== currentProduct.productId)
    .sort((a, b) => {
      const aScore =
        (a.category === currentProduct.category ? 2 : 0) +
        (a.shopId === currentProduct.shopId ? 1 : 0);
      const bScore =
        (b.category === currentProduct.category ? 2 : 0) +
        (b.shopId === currentProduct.shopId ? 1 : 0);
      if (bScore !== aScore) return bScore - aScore;
      return (b.rating ?? 0) - (a.rating ?? 0);
    })
    .slice(0, limit);
}

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['accepted', 'rejected', 'canceled'],
  accepted: ['preparing', 'canceled'],
  preparing: ['ready_for_pickup', 'out_for_delivery', 'canceled'],
  ready_for_pickup: ['delivered', 'canceled'],
  out_for_delivery: ['delivered'],
  delivered: [],
  rejected: [],
  canceled: [],
};

export function canTransitionOrderStatus(
  current: OrderStatus,
  next: OrderStatus,
  actor: 'customer' | 'seller' | 'admin'
): { allowed: boolean; reason?: string } {
  if (current === next) {
    return { allowed: false, reason: 'Order is already in this status.' };
  }

  if (actor === 'customer') {
    if (next === 'canceled' && (current === 'pending' || current === 'accepted')) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Customers can only cancel pending or newly accepted orders.' };
  }

  const allowedNext = VALID_ORDER_TRANSITIONS[current] ?? [];
  if (!allowedNext.includes(next)) {
    return {
      allowed: false,
      reason: `Cannot transition order from ${current} to ${next}.`,
    };
  }

  return { allowed: true };
}

export interface ProductFilterOptions {
  searchQuery?: string;
  category?: string;
  shopId?: string;
  neighborhood?: string;
  neighborhoods?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  minShopRating?: number | null;
  inStockOnly?: boolean;
  deliveryOnly?: boolean;
  pickupOnly?: boolean;
  strictShopVerification?: boolean;
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'nearest';
  shopDistanceById?: Record<string, number>;
}

export function filterAndSortProducts(
  products: Product[],
  shopsById: Record<string, Shop>,
  filters: ProductFilterOptions
): Product[] {
  const q = (filters.searchQuery ?? '').trim().toLowerCase();
  const enforceVerifiedShop = filters.strictShopVerification !== false;

  const rawMin =
    filters.minPrice != null && Number.isFinite(filters.minPrice) ? filters.minPrice : null;
  const rawMax =
    filters.maxPrice != null && Number.isFinite(filters.maxPrice) ? filters.maxPrice : null;
  const effectiveMin =
    rawMin != null && rawMax != null ? Math.min(rawMin, rawMax) : rawMin;
  const effectiveMax =
    rawMin != null && rawMax != null ? Math.max(rawMin, rawMax) : rawMax;

  const allowedNeighborhoodKeys = new Set<string>(
    (filters.neighborhoods ?? [])
      .map((n) => normalizeNeighborhoodKey(n))
      .filter((k) => Boolean(k) && k !== 'all')
  );
  if (filters.neighborhood && filters.neighborhood !== 'all') {
    allowedNeighborhoodKeys.add(normalizeNeighborhoodKey(filters.neighborhood));
  }

  const filtered = products.filter((p) => {
    if (p.status !== 'active') return false;

    const shop = shopsById[p.shopId];
    if (shop?.status === 'suspended') return false;
    if (enforceVerifiedShop && shop && shop.status !== 'approved') return false;

    if (filters.category && filters.category !== 'all' && p.category !== filters.category) {
      return false;
    }

    if (filters.shopId && p.shopId !== filters.shopId) {
      return false;
    }

    if (allowedNeighborhoodKeys.size > 0) {
      const shopAreaKey = shop ? normalizeNeighborhoodKey(shop.neighborhood) : '';
      if (!shop || !allowedNeighborhoodKeys.has(shopAreaKey)) {
        return false;
      }
    }

    if (filters.minShopRating != null && Number.isFinite(filters.minShopRating) && filters.minShopRating > 0) {
      const shopRating = shop?.rating ?? 0;
      if (shopRating < filters.minShopRating) {
        return false;
      }
    }

    if (effectiveMin != null && p.price < effectiveMin) {
      return false;
    }

    if (effectiveMax != null && p.price > effectiveMax) {
      return false;
    }

    if (filters.inStockOnly && (!p.isAvailable || p.stock <= 0)) {
      return false;
    }

    if (filters.deliveryOnly && (!p.deliveryAvailable || (shop && !shop.deliveryAvailable))) {
      return false;
    }

    if (filters.pickupOnly && (!p.pickupAvailable || (shop && !shop.pickupAvailable))) {
      return false;
    }

    if (q) {
      const haystack = `${p.name} ${p.description} ${p.shopName} ${p.category} ${
        shop?.neighborhood ?? ''
      }`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const sorted = [...filtered];
  switch (filters.sortBy) {
    case 'nearest': {
      const distMap = filters.shopDistanceById ?? {};
      sorted.sort((a, b) => {
        const da = distMap[a.shopId] ?? Number.POSITIVE_INFINITY;
        const db = distMap[b.shopId] ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      break;
    }
    case 'price_asc':
      sorted.sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      sorted.sort((a, b) => b.price - a.price);
      break;
    case 'rating':
      sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case 'newest':
    default:
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
  }

  return sorted;
}

export function getPriceRangeBounds(products: Product[]): { min: number; max: number } {
  const activePrices = products
    .filter((p) => p.status === 'active' && Number.isFinite(p.price) && p.price >= 0)
    .map((p) => p.price);
  if (activePrices.length === 0) return { min: 0, max: 10000 };
  const rawMin = Math.min(...activePrices);
  const rawMax = Math.max(...activePrices);
  return {
    min: Math.max(0, Math.floor(rawMin / 50) * 50),
    max: Math.max(500, Math.ceil(rawMax / 100) * 100),
  };
}

export function getNeighborhoodAvailabilityStats(
  products: Product[],
  shopsById: Record<string, Shop>,
  strictShopVerification = true
): Record<string, { shopCount: number; productCount: number }> {
  const stats: Record<string, { shopCount: number; productCount: number }> = {};
  const shopsSeenPerArea: Record<string, Set<string>> = {};

  for (const area of HAWASSA_NEIGHBORHOODS) {
    const key = normalizeNeighborhoodKey(area);
    stats[area] = { shopCount: 0, productCount: 0 };
    shopsSeenPerArea[key] = new Set();
  }

  for (const product of products) {
    if (product.status !== 'active') continue;
    const shop = shopsById[product.shopId];
    if (!shop || shop.status === 'suspended') continue;
    if (strictShopVerification && shop.status !== 'approved') continue;

    const areaKey = normalizeNeighborhoodKey(shop.neighborhood);
    const canonicalArea =
      HAWASSA_NEIGHBORHOODS.find((n) => normalizeNeighborhoodKey(n) === areaKey) ??
      shop.neighborhood;

    if (!stats[canonicalArea]) {
      stats[canonicalArea] = { shopCount: 0, productCount: 0 };
    }
    if (!shopsSeenPerArea[areaKey]) {
      shopsSeenPerArea[areaKey] = new Set();
    }
    shopsSeenPerArea[areaKey].add(shop.shopId);
    stats[canonicalArea].productCount += 1;
    stats[canonicalArea].shopCount = shopsSeenPerArea[areaKey].size;
  }

  return stats;
}

export function countActiveSearchFilters(filters: {
  neighborhoods?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  minShopRating?: number | null;
  inStockOnly?: boolean;
  deliveryOnly?: boolean;
  pickupOnly?: boolean;
  sortBy?: ProductFilterOptions['sortBy'];
}): number {
  let count = 0;
  if (filters.neighborhoods && filters.neighborhoods.length > 0) count += 1;
  if (filters.minPrice != null || filters.maxPrice != null) count += 1;
  if (filters.minShopRating != null && filters.minShopRating > 0) count += 1;
  if (filters.inStockOnly) count += 1;
  if (filters.deliveryOnly) count += 1;
  if (filters.pickupOnly) count += 1;
  if (filters.sortBy && filters.sortBy !== 'newest') count += 1;
  return count;
}

export interface ProductInputValidation {
  name: string;
  price: number;
  stock: number;
  category: string;
  description: string;
}

export function validateProductInput(input: ProductInputValidation): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.name || input.name.trim().length < 3) {
    errors.name = 'Product name must be at least 3 characters.';
  } else if (input.name.trim().length > 140) {
    errors.name = 'Product name must be under 140 characters.';
  }

  if (!Number.isFinite(input.price) || input.price <= 0) {
    errors.price = 'Price must be greater than ETB 0.';
  }

  if (!Number.isFinite(input.stock) || input.stock < 0 || !Number.isInteger(input.stock)) {
    errors.stock = 'Stock must be a whole number (0 or greater).';
  }

  if (!input.category || input.category.trim().length === 0) {
    errors.category = 'Please choose a product category.';
  }

  if (!input.description || input.description.trim().length < 10) {
    errors.description = 'Description must be at least 10 characters.';
  }

  return errors;
}

export interface AddressInputValidation {
  label: string;
  recipientName: string;
  phoneNumber: string;
  neighborhood: string;
  streetOrLandmark: string;
}

export function validateAddressInput(input: AddressInputValidation): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.label || input.label.trim().length < 2) {
    errors.label = 'Address label is required (e.g., Home, Office).';
  }
  if (!input.recipientName || input.recipientName.trim().length < 2) {
    errors.recipientName = 'Recipient full name is required.';
  }
  const cleanPhone = (input.phoneNumber ?? '').replace(/[\s\-().]/g, '');
  if (!/^((\+251|0)[79]\d{8}|\+[1-9]\d{7,14})$/.test(cleanPhone)) {
    errors.phoneNumber = 'Enter a valid phone number (e.g. 0911234567 or +251911234567).';
  }
  if (!input.neighborhood || input.neighborhood.trim().length === 0) {
    errors.neighborhood = 'Select a Hawassa neighborhood.';
  }
  if (!input.streetOrLandmark || input.streetOrLandmark.trim().length < 4) {
    errors.streetOrLandmark = 'Enter a street name or local landmark in Hawassa.';
  }

  return errors;
}

export function getQualifyingPurchaseOrder(
  orders: Order[],
  productId: string,
  customerUid: string
): Order | null {
  const matching = orders.filter(
    (order) =>
      order.customerUid === customerUid &&
      order.orderStatus === 'delivered' &&
      order.items.some((item) => item.productId === productId)
  );
  if (matching.length === 0) return null;

  const sorted = [...matching].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return sorted[0];
}

export function getUserProductReview(
  reviews: ReviewItem[],
  productId: string,
  customerUid: string
): ReviewItem | null {
  return (
    reviews.find(
      (rev) => rev.productId === productId && rev.customerUid === customerUid
    ) ?? null
  );
}

export function validateReviewInput(input: {
  rating: number;
  comment: string;
  shopRating?: number;
  shopComment?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    errors.rating = 'Please select a star rating between 1 and 5.';
  }
  const cleanComment = (input.comment ?? '').trim();
  if (cleanComment.length < 3) {
    errors.comment = 'Please write at least 3 characters in your review comment.';
  } else if (cleanComment.length > 500) {
    errors.comment = 'Review comment must be 500 characters or fewer.';
  }
  if (
    input.shopRating != null &&
    (!Number.isInteger(input.shopRating) || input.shopRating < 1 || input.shopRating > 5)
  ) {
    errors.shopRating = 'Please select a shop rating between 1 and 5.';
  }
  if (input.shopComment != null && input.shopComment.trim().length > 500) {
    errors.shopComment = 'Shop review must be 500 characters or fewer.';
  }
  return errors;
}

export interface ProductRatingSummary {
  averageRating: number;
  reviewCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export function calculateProductRatingSummary(
  product: Product,
  allReviews: ReviewItem[],
  seedReviewIds: ReadonlySet<string> = new Set(),
  seedBaseline?: { rating?: number; reviewCount?: number }
): ProductRatingSummary {
  const productReviews = allReviews.filter((r) => r.productId === product.productId);
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const rev of productReviews) {
    const star = Math.min(5, Math.max(1, Math.round(rev.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[star] += 1;
  }

  if (productReviews.length === 0) {
    return {
      averageRating: product.rating ?? 0,
      reviewCount: product.reviewCount ?? 0,
      distribution,
    };
  }

  const baseCount = seedBaseline?.reviewCount ?? 0;
  const seedReviewCountForProd = productReviews.filter((r) =>
    seedReviewIds.has(r.reviewId)
  ).length;

  if (baseCount > seedReviewCountForProd) {
    const addedReviews = productReviews.filter((r) => !seedReviewIds.has(r.reviewId));
    const baseSum = (seedBaseline?.rating ?? 5) * baseCount;
    const addedSum = addedReviews.reduce((sum, r) => sum + r.rating, 0);
    const totalCount = baseCount + addedReviews.length;
    return {
      averageRating: Number(((baseSum + addedSum) / totalCount).toFixed(1)),
      reviewCount: totalCount,
      distribution,
    };
  }

  const totalSum = productReviews.reduce((sum, r) => sum + r.rating, 0);
  return {
    averageRating: Number((totalSum / productReviews.length).toFixed(1)),
    reviewCount: productReviews.length,
    distribution,
  };
}

export function calculateShopRatingSummary(
  shop: Shop,
  allReviews: ReviewItem[],
  seedReviewIds: ReadonlySet<string> = new Set(),
  seedBaseline?: { rating?: number; reviewCount?: number }
): { averageRating: number; reviewCount: number } {
  const shopReviews = allReviews.filter((r) => r.shopId === shop.shopId);
  if (shopReviews.length === 0) {
    return {
      averageRating: shop.rating ?? 0,
      reviewCount: shop.reviewCount ?? 0,
    };
  }

  const baseCount = seedBaseline?.reviewCount ?? 0;
  const seedReviewCountForShop = shopReviews.filter((r) =>
    seedReviewIds.has(r.reviewId)
  ).length;

  if (baseCount > seedReviewCountForShop) {
    const addedReviews = shopReviews.filter((r) => !seedReviewIds.has(r.reviewId));
    const baseSum = (seedBaseline?.rating ?? 5) * baseCount;
    const addedSum = addedReviews.reduce((sum, r) => sum + (r.shopRating ?? r.rating), 0);
    const totalCount = baseCount + addedReviews.length;
    return {
      averageRating: Number(((baseSum + addedSum) / totalCount).toFixed(1)),
      reviewCount: totalCount,
    };
  }

  const totalSum = shopReviews.reduce((sum, r) => sum + (r.shopRating ?? r.rating), 0);
  return {
    averageRating: Number((totalSum / shopReviews.length).toFixed(1)),
    reviewCount: shopReviews.length,
  };
}

export const MAX_SHARED_WISHLIST_ITEMS = 50;

export function sanitizeWishlistProductIds(productIds: string[]): string[] {
  const unique = Array.from(
    new Set(
      productIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id))
    )
  );
  return unique.slice(0, MAX_SHARED_WISHLIST_ITEMS);
}

export function buildWishlistShareUrl(
  origin: string,
  shareId: string,
  fallbackProductIds?: string[]
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const cleanId = encodeURIComponent(shareId.trim());
  const base = `${cleanOrigin}/?wishlist=${cleanId}`;
  if (!fallbackProductIds || fallbackProductIds.length === 0) {
    return base;
  }
  const safeIds = sanitizeWishlistProductIds(fallbackProductIds).slice(0, 20);
  return safeIds.length > 0 ? `${base}&items=${encodeURIComponent(safeIds.join(','))}` : base;
}

export function parseSharedWishlistFallbackIds(search: string): string[] {
  try {
    const params = new URLSearchParams(search);
    const raw = params.get('items');
    if (!raw) return [];
    return sanitizeWishlistProductIds(raw.split(','));
  } catch {
    return [];
  }
}

export function buildSocialShareUrls(shareUrl: string, title: string, itemCount: number): {
  whatsapp: string;
  telegram: string;
  x: string;
  facebook: string;
} {
  const shareCopy = `${title} (${itemCount} items on Hawasa Gebeya)`;
  const fullText = `${shareCopy} ${shareUrl}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(fullText)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareCopy)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareCopy)}&url=${encodeURIComponent(shareUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
  };
}

export const MAX_RETURN_PHOTO_DATA_URL_LENGTH = MAX_IMAGE_UPLOAD_DATA_URL_LENGTH;

export function validateImageDataUrlSize(dataUrl: string): boolean {
  if (!dataUrl || typeof dataUrl !== 'string') return false;
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
    return false;
  }
  return validateImagePayloadSize(
    dataUrl,
    MAX_IMAGE_FILE_BYTES,
    MAX_IMAGE_UPLOAD_DATA_URL_LENGTH
  ).valid;
}

export function validateProductImageUrl(url: string): boolean {
  const clean = (url ?? '').trim();
  if (!clean) return false;
  if (clean.startsWith('data:image/')) {
    return validateImageDataUrlSize(clean);
  }
  return clean.length <= 2048 && (clean.startsWith('https://') || clean.startsWith('/'));
}

export const RETURN_REASON_OPTIONS: {
  value: ReturnRequestReason;
  labelKey: string;
}[] = [
  { value: 'damaged_item', labelKey: 'returnReasonDamaged' },
  { value: 'wrong_item', labelKey: 'returnReasonWrongItem' },
  { value: 'quality_issue', labelKey: 'returnReasonQuality' },
  { value: 'size_or_fit', labelKey: 'returnReasonSizeFit' },
  { value: 'missing_parts', labelKey: 'returnReasonMissing' },
  { value: 'changed_mind', labelKey: 'returnReasonChangedMind' },
];

export function isOrderEligibleForReturn(order: Order): boolean {
  return order.orderStatus !== 'canceled' && order.orderStatus !== 'rejected';
}

export function getItemReturnRequest(
  returnRequests: ReturnRequest[],
  orderId: string,
  productId: string,
  variantLabel?: string
): ReturnRequest | null {
  return (
    returnRequests.find(
      (req) =>
        req.orderId === orderId &&
        req.productId === productId &&
        (req.variantLabel ?? '') === (variantLabel ?? '')
    ) ?? null
  );
}

export function validateReturnRequestInput(input: {
  requestType: ReturnRequestType;
  reason: ReturnRequestReason;
  details: string;
  photoDataUrl?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (input.requestType !== 'return' && input.requestType !== 'exchange') {
    errors.requestType = 'Select return or exchange.';
  }

  const validReasons = new Set(RETURN_REASON_OPTIONS.map((o) => o.value));
  if (!validReasons.has(input.reason)) {
    errors.reason = 'Please choose a valid return reason.';
  }

  const cleanDetails = (input.details ?? '').trim();
  if (cleanDetails.length < 5 || cleanDetails.length > 600) {
    errors.details = 'returnErrorDetails';
  }

  if (input.reason === 'damaged_item' && !input.photoDataUrl) {
    errors.photoDataUrl = 'returnErrorPhotoRequired';
  } else if (input.photoDataUrl && !validateImageDataUrlSize(input.photoDataUrl)) {
    errors.photoDataUrl = 'Image exceeds 350 KB limit or format is invalid.';
  }

  return errors;
}

export function isValidThemePreference(val: unknown): val is ThemePreference {
  return val === 'light' || val === 'dark' || val === 'system';
}

export function resolveThemePreference(
  preference: ThemePreference,
  systemPrefersDark: boolean
): ResolvedTheme {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
}

export const MIN_PRICE_ALERT_ETB = 1;

export function calculateThresholdFromPercent(currentPrice: number, percentDrop: number): number {
  if (!Number.isFinite(currentPrice) || currentPrice <= 1) return MIN_PRICE_ALERT_ETB;
  const raw = Math.round(currentPrice * (1 - percentDrop / 100));
  return Math.max(MIN_PRICE_ALERT_ETB, Math.min(Math.round(currentPrice) - 1, raw));
}

export function calculateDiscountPercent(targetPrice: number, currentPrice: number): number {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !Number.isFinite(targetPrice)) {
    return 0;
  }
  if (targetPrice >= currentPrice) return 0;
  return Math.max(1, Math.round(((currentPrice - targetPrice) / currentPrice) * 100));
}

export function validatePriceAlertThreshold(
  targetPrice: number,
  currentPrice: number
): { valid: boolean; errorKey?: string } {
  if (!Number.isFinite(targetPrice) || targetPrice < MIN_PRICE_ALERT_ETB) {
    return { valid: false, errorKey: 'priceAlertErrorMin' };
  }
  if (!Number.isFinite(currentPrice) || currentPrice <= MIN_PRICE_ALERT_ETB) {
    return { valid: false, errorKey: 'priceAlertErrorLowerThanCurrent' };
  }
  if (Math.round(targetPrice) >= Math.round(currentPrice)) {
    return { valid: false, errorKey: 'priceAlertErrorLowerThanCurrent' };
  }
  return { valid: true };
}

export function shouldTriggerPriceAlert(alert: PriceAlert, currentPrice: number): boolean {
  if (alert.status !== 'active') return false;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return false;
  return currentPrice < alert.targetPrice;
}

export function getProductPriceAlert(
  alerts: PriceAlert[],
  productId: string,
  customerUid: string
): PriceAlert | null {
  return (
    alerts.find(
      (a) => a.productId === productId && a.customerUid === customerUid
    ) ?? null
  );
}

export function validateOrderAgainstGovernance(params: {
  config: MarketplaceGovernanceConfig;
  userProfile: UserProfile | null;
  shop?: Shop;
  totalAmount: number;
}): { allowed: boolean; errorKey?: string; customMessage?: string } {
  if (params.userProfile?.accountStatus === 'suspended') {
    return { allowed: false, errorKey: 'governanceUserSuspended' };
  }
  if (params.config.orderingPaused) {
    return {
      allowed: false,
      errorKey: 'governanceOrderingPaused',
      customMessage: params.config.maintenanceBanner?.trim() || undefined,
    };
  }
  if (
    !params.shop ||
    params.shop.status === 'suspended' ||
    (params.config.strictShopVerification && params.shop.status !== 'approved')
  ) {
    return { allowed: false, errorKey: 'governanceShopUnavailable' };
  }
  if (params.totalAmount > params.config.maxOrderAmountEtb) {
    return { allowed: false, errorKey: 'governanceMaxOrderExceeded' };
  }
  return { allowed: true };
}

export const MAX_LICENSE_IMAGE_DATA_URL_LENGTH = MAX_IMAGE_UPLOAD_DATA_URL_LENGTH;

export const HAWASSA_ISSUING_AUTHORITIES = [
  'Hawassa City Trade & Market Development Bureau',
  'Sidama Regional Trade & Industry Bureau',
  'Ethiopian Ministry of Trade & Regional Integration',
  'Hawassa Sub-City Micro & Small Enterprise Office',
] as const;

export function getEffectiveShopVerificationStatus(
  shop?: Shop | null,
  verification?: MerchantVerification | null
): DocumentVerificationStatus {
  if (verification?.status) return verification.status;
  if (shop?.verificationStatus) return shop.verificationStatus;
  if (shop?.status === 'approved') return 'approved';
  return 'unverified';
}

export function canShopListProducts(
  shop?: Shop | null,
  verification?: MerchantVerification | null
): boolean {
  if (!shop || shop.status === 'suspended') return false;
  const docStatus = getEffectiveShopVerificationStatus(shop, verification);
  return docStatus === 'approved' && shop.status === 'approved';
}

export function validateMerchantVerificationInput(input: {
  businessLegalName: string;
  licenseNumber: string;
  tinNumber?: string;
  issuingAuthority: string;
  expiryDate?: string;
  licenseImageDataUrl?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  const legalName = (input.businessLegalName ?? '').trim();
  if (legalName.length < 3 || legalName.length > 140) {
    errors.businessLegalName = 'docVerifyErrorLegalName';
  }

  const licenseNo = (input.licenseNumber ?? '').trim();
  if (licenseNo.length < 4 || licenseNo.length > 60 || !/^[a-zA-Z0-9/_-]+$/.test(licenseNo)) {
    errors.licenseNumber = 'docVerifyErrorLicenseNumber';
  }

  const tin = (input.tinNumber ?? '').trim();
  if (tin.length > 0 && (tin.length < 5 || tin.length > 30 || !/^[a-zA-Z0-9-]+$/.test(tin))) {
    errors.tinNumber = 'docVerifyErrorTinNumber';
  }

  const authority = (input.issuingAuthority ?? '').trim();
  if (authority.length < 3 || authority.length > 140) {
    errors.issuingAuthority = 'docVerifyErrorAuthority';
  }

  const expiry = (input.expiryDate ?? '').trim();
  if (expiry.length > 30) {
    errors.expiryDate = 'docVerifyErrorExpiry';
  }

  const imgUrl = input.licenseImageDataUrl ?? '';
  if (!imgUrl || !validateImageDataUrlSize(imgUrl)) {
    errors.licenseImageDataUrl = 'docVerifyErrorImageRequired';
  }

  return errors;
}

export function normalizePhoneToE164(raw: string): {
  valid: boolean;
  e164: string;
  errorKey?: string;
} {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return { valid: false, e164: '', errorKey: 'phoneAuthErrorInvalid' };
  }

  // Strip spaces, dashes, dots, parentheses while preserving a leading '+'
  const cleaned = trimmed.replace(/[\s\-().]/g, '');

  let candidate = cleaned;
  if (candidate.startsWith('00')) {
    candidate = `+${candidate.slice(2)}`;
  } else if (/^0[79]\d{8}$/.test(candidate)) {
    // Ethiopian local 10-digit mobile number (09XXXXXXXX or 07XXXXXXXX)
    candidate = `+251${candidate.slice(1)}`;
  } else if (/^[79]\d{8}$/.test(candidate)) {
    // Ethiopian 9-digit mobile without leading 0
    candidate = `+251${candidate}`;
  } else if (/^251[79]\d{8}$/.test(candidate)) {
    candidate = `+${candidate}`;
  } else if (!candidate.startsWith('+') && /^\d{8,15}$/.test(candidate)) {
    candidate = `+${candidate}`;
  }

  if (/^\+[1-9]\d{7,14}$/.test(candidate)) {
    return { valid: true, e164: candidate };
  }

  return { valid: false, e164: '', errorKey: 'phoneAuthErrorInvalid' };
}

export function isValidOtpCode(code: string): boolean {
  return /^\d{6}$/.test((code ?? '').trim());
}

export interface EthiopianPaymentChannelInfo {
  method: 'telebirr' | 'cbe_birr' | 'chapa';
  shortcode: string;
  merchantPhone: string;
  accountName: string;
  exampleRef: string;
}

export const ETHIOPIAN_PAYMENT_CONFIG: Record<
  'telebirr' | 'cbe_birr' | 'chapa',
  EthiopianPaymentChannelInfo
> = {
  telebirr: {
    method: 'telebirr',
    shortcode: '894210',
    merchantPhone: '+251 911 224 466',
    accountName: 'Hawasa Gebeya Marketplace',
    exampleRef: 'TB849201K',
  },
  cbe_birr: {
    method: 'cbe_birr',
    shortcode: '518040',
    merchantPhone: '+251 911 224 466',
    accountName: 'Hawasa Gebeya PLC',
    exampleRef: 'FT26319HWS',
  },
  chapa: {
    method: 'chapa',
    shortcode: 'CHAPA-HWS-01',
    merchantPhone: '+251 911 224 466',
    accountName: 'Hawasa Gebeya Checkout',
    exampleRef: 'CHP904128',
  },
};

export function isElectronicPaymentMethod(method: PaymentMethod): boolean {
  return (
    method === 'telebirr' ||
    method === 'cbe_birr' ||
    method === 'chapa' ||
    method === 'telebirr_sandbox' ||
    method === 'cbe_birr_sandbox'
  );
}

export interface GatewayReferenceValidationResult {
  valid: boolean;
  isEmpty: boolean;
  normalizedRef: string;
  detectedKind: 'trx' | 'numeric10' | 'phone' | 'chapa' | 'custom' | 'invalid' | 'none';
  errorKey?: string;
}

export function validateGatewayReferenceLive(
  method: PaymentMethod,
  ref?: string
): GatewayReferenceValidationResult {
  if (!isElectronicPaymentMethod(method)) {
    return {
      valid: true,
      isEmpty: true,
      normalizedRef: '',
      detectedKind: 'none',
    };
  }

  const trimmed = (ref ?? '').trim();
  if (!trimmed) {
    return {
      valid: false,
      isEmpty: true,
      normalizedRef: '',
      detectedKind: 'invalid',
      errorKey: 'paymentReferenceInvalidError',
    };
  }

  // Detect Ethiopian phone references such as +251911223344, 0911223344, 0711223344
  const phoneCleaned = trimmed.replace(/[\s\-().]/g, '');
  if (/^(\+?251|0)[79]\d{8}$/.test(phoneCleaned)) {
    const phoneCheck = normalizePhoneToE164(trimmed);
    if (phoneCheck.valid && /^\+251[79]\d{8}$/.test(phoneCheck.e164)) {
      return {
        valid: true,
        isEmpty: false,
        normalizedRef: phoneCheck.e164.slice(1), // e.g. 251911223344 (passes 5-40 alnum Firestore rule)
        detectedKind: 'phone',
      };
    }
  }

  const upperCompact = trimmed.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z0-9_-]{5,40}$/.test(upperCompact)) {
    return {
      valid: false,
      isEmpty: false,
      normalizedRef: upperCompact,
      detectedKind: 'invalid',
      errorKey: 'paymentReferenceInvalidError',
    };
  }

  if (/^(CHAPA-|CHP)[A-Z0-9_-]{2,35}$/.test(upperCompact)) {
    return {
      valid: true,
      isEmpty: false,
      normalizedRef: upperCompact,
      detectedKind: 'chapa',
    };
  }

  if (/^(TRX|TB|FT)[A-Z0-9_-]{2,37}$/.test(upperCompact)) {
    return {
      valid: true,
      isEmpty: false,
      normalizedRef: upperCompact,
      detectedKind: 'trx',
    };
  }

  if (/^\d{10}$/.test(upperCompact)) {
    return {
      valid: true,
      isEmpty: false,
      normalizedRef: upperCompact,
      detectedKind: 'numeric10',
    };
  }

  return {
    valid: true,
    isEmpty: false,
    normalizedRef: upperCompact,
    detectedKind: 'custom',
  };
}

export function generateChapaTransactionRef(): string {
  const tsPart = String(Date.now()).slice(-6);
  const randPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CHAPA-${tsPart}-${randPart}`;
}

export function validatePaymentReference(
  method: PaymentMethod,
  ref?: string
): { valid: boolean; normalizedRef: string; errorKey?: string } {
  const live = validateGatewayReferenceLive(method, ref);
  if (live.valid) {
    return { valid: true, normalizedRef: live.normalizedRef };
  }
  return {
    valid: false,
    normalizedRef: live.normalizedRef,
    errorKey: live.errorKey ?? 'paymentReferenceInvalidError',
  };
}

export function generateDeliveryPin(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return String(num);
}

export function verifyDeliveryPin(
  expectedPin?: string,
  enteredPin?: string
): { valid: boolean; errorKey?: string } {
  const cleanEntered = (enteredPin ?? '').trim();
  const cleanExpected = (expectedPin ?? '').trim();
  if (!/^\d{4}$/.test(cleanEntered) || !cleanExpected || cleanEntered !== cleanExpected) {
    return { valid: false, errorKey: 'deliveryPinInvalidError' };
  }
  return { valid: true };
}

export function getNeighborhoodDeliveryEstimate(neighborhood?: string): {
  minMinutes: number;
  maxMinutes: number;
  label: string;
} {
  const map: Record<string, { minMinutes: number; maxMinutes: number }> = {
    Piazza: { minMinutes: 20, maxMinutes: 35 },
    'Gebeya Dar': { minMinutes: 20, maxMinutes: 35 },
    Menhariya: { minMinutes: 25, maxMinutes: 40 },
    Atote: { minMinutes: 30, maxMinutes: 45 },
    'Arab Sefer': { minMinutes: 30, maxMinutes: 45 },
    Tabor: { minMinutes: 35, maxMinutes: 50 },
    Datto: { minMinutes: 40, maxMinutes: 60 },
    Bilo: { minMinutes: 40, maxMinutes: 60 },
  };
  const found = neighborhood ? map[neighborhood] : undefined;
  const minMinutes = found?.minMinutes ?? 30;
  const maxMinutes = found?.maxMinutes ?? 50;
  return {
    minMinutes,
    maxMinutes,
    label: `${minMinutes}–${maxMinutes} min`,
  };
}

export function isEmailFormat(raw: string): boolean {
  const clean = (raw ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean);
}

export function validateEmailSignInInput(input: {
  emailOrPhone: string;
  password: string;
}): {
  valid: boolean;
  mode: 'email' | 'phone_redirect' | 'invalid';
  normalizedEmail?: string;
  normalizedPhone?: string;
  errors: Record<string, string>;
} {
  const cleanId = (input.emailOrPhone ?? '').trim();
  const cleanPassword = input.password ?? '';
  const errors: Record<string, string> = {};

  if (!cleanId) {
    errors.emailOrPhone = 'authErrorInvalidEmail';
    if (cleanPassword.length < 6) {
      errors.password = 'authErrorPasswordLength';
    }
    return { valid: false, mode: 'invalid', errors };
  }

  if (cleanId.includes('@')) {
    if (!isEmailFormat(cleanId)) {
      errors.emailOrPhone = 'authErrorInvalidEmail';
    }
    if (cleanPassword.length < 6) {
      errors.password = 'authErrorPasswordLength';
    }
    return {
      valid: Object.keys(errors).length === 0,
      mode: Object.keys(errors).length === 0 ? 'email' : 'invalid',
      normalizedEmail: cleanId.toLowerCase(),
      errors,
    };
  }

  const phoneCheck = normalizePhoneToE164(cleanId);
  if (phoneCheck.valid) {
    return {
      valid: false,
      mode: 'phone_redirect',
      normalizedPhone: phoneCheck.e164,
      errors: { emailOrPhone: 'authSignInPhoneUseOtpHint' },
    };
  }

  errors.emailOrPhone = 'authErrorInvalidEmail';
  if (cleanPassword.length < 6) {
    errors.password = 'authErrorPasswordLength';
  }
  return { valid: false, mode: 'invalid', errors };
}

export function validateRegistrationInput(input: {
  fullName: string;
  email: string;
  phoneNumber: string;
  neighborhood: string;
  accountType: 'customer' | 'seller';
  password: string;
}): {
  valid: boolean;
  normalizedName: string;
  normalizedEmail: string;
  normalizedPhone: string;
  normalizedNeighborhood: string;
  errors: Record<string, string>;
} {
  const normalizedName = (input.fullName ?? '').trim().slice(0, 100);
  const normalizedEmail = (input.email ?? '').trim().toLowerCase();
  const phoneCheck = normalizePhoneToE164(input.phoneNumber ?? '');
  const normalizedNeighborhood = (input.neighborhood ?? '').trim() || 'Piazza';
  const password = input.password ?? '';
  const errors: Record<string, string> = {};

  if (normalizedName.length < 2) {
    errors.fullName = 'authErrorFullName';
  }
  if (!isEmailFormat(normalizedEmail)) {
    errors.email = 'authErrorInvalidEmail';
  }
  if (!phoneCheck.valid) {
    errors.phoneNumber = phoneCheck.errorKey || 'phoneAuthErrorInvalid';
  }
  if (password.length < 6 || password.length > 128) {
    errors.password = 'authErrorPasswordLength';
  }

  return {
    valid: Object.keys(errors).length === 0,
    normalizedName,
    normalizedEmail,
    normalizedPhone: phoneCheck.e164,
    normalizedNeighborhood,
    errors,
  };
}

export function isUserPendingEmailVerification(
  input: {
    email?: string | null;
    emailVerified?: boolean;
    phoneNumber?: string | null;
    providerIds?: (string | null | undefined)[];
  } | null
): boolean {
  if (!input || !input.email || input.emailVerified) return false;
  const providers = (input.providerIds ?? []).filter((p): p is string => Boolean(p));
  if (providers.includes('password')) return true;
  if (providers.length === 0 && !input.phoneNumber) return true;
  return false;
}

export function isReturningGoogleSignIn(input: {
  isNewUser?: boolean | null;
  creationTime?: string | null;
  lastSignInTime?: string | null;
  hadExistingProfileDoc?: boolean;
}): boolean {
  if (input.hadExistingProfileDoc === true) return true;
  if (input.isNewUser === false) return true;
  if (input.isNewUser === true) return false;
  if (input.creationTime && input.lastSignInTime) {
    if (input.creationTime === input.lastSignInTime) return false;
    const createdMs = Date.parse(input.creationTime);
    const lastSignInMs = Date.parse(input.lastSignInTime);
    if (Number.isFinite(createdMs) && Number.isFinite(lastSignInMs)) {
      return Math.abs(lastSignInMs - createdMs) >= 2000;
    }
    return true;
  }
  return false;
}

export const SUPER_ADMIN_EMAIL = 'yoftaheyoseph5@gmail.com';

export function isSuperAdminEmail(email?: string | null): boolean {
  return (email ?? '').trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

export type AdminUserRoleFilter = 'all' | UserRole;

export function filterAdminUsers(
  users: UserProfile[],
  search: string,
  roleFilter: AdminUserRoleFilter
): UserProfile[] {
  const q = (search ?? '').trim().toLowerCase();
  const normalizedPhoneDigits = q.replace(/[\s\-().]/g, '');
  const altEthiopianQuery = /^0[79]\d*$/.test(normalizedPhoneDigits)
    ? `+251${normalizedPhoneDigits.slice(1)}`
    : null;
  return users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (q) {
      const haystack = `${u.displayName ?? ''} ${u.email ?? ''} ${u.phoneNumber ?? ''} ${u.uid ?? ''}`.toLowerCase();
      if (!haystack.includes(q) && (!altEthiopianQuery || !haystack.includes(altEthiopianQuery))) {
        return false;
      }
    }
    return true;
  });
}

export function findUserByNormalizedEmail(
  users: UserProfile[],
  email: string
): UserProfile | null {
  const clean = (email ?? '').trim().toLowerCase();
  if (!isEmailFormat(clean)) return null;
  return users.find((u) => (u.email ?? '').trim().toLowerCase() === clean) ?? null;
}

export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return 0;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const a =
    sinLat * sinLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  const rawKm = 6371 * c;
  return Number(rawKm.toFixed(2));
}

export function formatProximityDistance(distanceKm: number): string {
  const safe = Number.isFinite(distanceKm) ? Math.max(0, distanceKm) : 0;
  if (safe < 0.05) return '0.1 km';
  return `${safe.toFixed(1)} km`;
}

export function estimateTravelMinutes(distanceKm: number): {
  walkMinutes: number;
  bajajMinutes: number;
} {
  const safe = Number.isFinite(distanceKm) ? Math.max(0, distanceKm) : 0;
  const walkMinutes = Math.max(2, Math.round((safe / 4.8) * 60));
  const bajajMinutes = Math.max(2, Math.round((safe / 24) * 60) + 2);
  return { walkMinutes, bajajMinutes };
}

export function rankShopsByProximity(
  shops: Shop[],
  userCoords?: UserCoordinates | null,
  selectedNeighborhood?: string | null,
  products: Product[] = []
): ShopWithProximity[] {
  if (shops.length === 0) return [];

  const origin: UserCoordinates =
    userCoords && Number.isFinite(userCoords.lat) && Number.isFinite(userCoords.lng)
      ? userCoords
      : selectedNeighborhood && selectedNeighborhood !== 'All Hawassa'
      ? getNeighborhoodCoordinates(selectedNeighborhood)
      : HAWASSA_CENTER;

  const discountedStatsByShop = new Map<string, { count: number; bestPct: number }>();
  for (const product of products) {
    if (product.status !== 'active' || !product.isAvailable || product.stock <= 0) continue;
    if (product.previousPrice == null || product.previousPrice <= product.price) continue;
    const pct = Math.round(
      ((product.previousPrice - product.price) / product.previousPrice) * 100
    );
    const current = discountedStatsByShop.get(product.shopId) ?? { count: 0, bestPct: 0 };
    discountedStatsByShop.set(product.shopId, {
      count: current.count + 1,
      bestPct: Math.max(current.bestPct, pct),
    });
  }

  const ranked = shops
    .map((shop) => {
      const shopCoords = getShopCoordinates(shop.shopId, shop.neighborhood);
      const distanceKm = calculateDistanceKm(
        origin.lat,
        origin.lng,
        shopCoords.lat,
        shopCoords.lng
      );
      const { walkMinutes, bajajMinutes } = estimateTravelMinutes(distanceKm);
      const discountStats = discountedStatsByShop.get(shop.shopId) ?? { count: 0, bestPct: 0 };
      return {
        shop,
        distanceKm,
        distanceLabel: formatProximityDistance(distanceKm),
        estimatedWalkMinutes: walkMinutes,
        estimatedBajajMinutes: bajajMinutes,
        isNearestForUser: false,
        discountedProductsCount: discountStats.count,
        bestDiscountPercent: discountStats.bestPct,
      };
    })
    .sort((a, b) => {
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return b.shop.rating - a.shop.rating;
    });

  if (ranked.length > 0) {
    ranked[0].isNearestForUser = true;
  }

  return ranked;
}

export function findNearbyDiscountedDeals(params: {
  rankedShops: ShopWithProximity[];
  products: Product[];
  maxDistanceKm?: number;
}): NearbyDiscountDeal[] {
  const maxKm = params.maxDistanceKm ?? 2.0;
  const shopRankMap = new Map(
    params.rankedShops
      .filter((entry) => entry.shop.status !== 'suspended' && entry.distanceKm <= maxKm)
      .map((entry) => [entry.shop.shopId, entry])
  );

  const deals: NearbyDiscountDeal[] = [];
  for (const product of params.products) {
    if (product.status !== 'active' || !product.isAvailable || product.stock <= 0) continue;
    if (product.previousPrice == null || product.previousPrice <= product.price) continue;
    const entry = shopRankMap.get(product.shopId);
    if (!entry) continue;
    const discountPercent = Math.round(
      ((product.previousPrice - product.price) / product.previousPrice) * 100
    );
    if (discountPercent <= 0) continue;
    deals.push({
      shop: entry.shop,
      product,
      distanceKm: entry.distanceKm,
      distanceLabel: entry.distanceLabel,
      discountPercent,
    });
  }

  return deals.sort((a, b) => {
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    return b.discountPercent - a.discountPercent;
  });
}

function sanitizeChatIdSegment(raw: string): string {
  const cleaned = (raw ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-');
  return cleaned.length > 0 ? cleaned : 'default';
}

export function buildOrderChatThreadId(orderId: string): string {
  const segment = sanitizeChatIdSegment(orderId);
  return `order-${segment}`.slice(0, 128);
}

export function buildShopChatThreadId(shopId: string, buyerUid: string): string {
  const s = sanitizeChatIdSegment(shopId).slice(0, 56);
  const b = sanitizeChatIdSegment(buyerUid).slice(0, 60);
  return `shop-${s}--${b}`.slice(0, 128);
}

export function formatOrderChatCode(orderId?: string): string {
  const clean = (orderId ?? '').trim();
  if (!clean) return 'ORDER';
  return clean.slice(-6).toUpperCase();
}

export function validateChatMessageInput(body: string): string | null {
  const trimmed = (body ?? '').trim();
  if (trimmed.length === 0) return 'Please enter a message before sending.';
  if (trimmed.length > 1000) return 'Message cannot exceed 1000 characters.';
  return null;
}

export function validateSupervisionReason(reason: string): string | null {
  const trimmed = (reason ?? '').trim();
  if (trimmed.length > 0 && trimmed.length < 4) {
    return 'Please write at least 4 characters explaining why mediation is needed.';
  }
  if (trimmed.length > 300) {
    return 'Supervision reason cannot exceed 300 characters.';
  }
  return null;
}

export function sortTradeChatThreads(threads: TradeChatThread[]): TradeChatThread[] {
  return [...threads].sort((a, b) => {
    const tA = new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0).getTime();
    const tB = new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0).getTime();
    return tB - tA;
  });
}

export function countSupervisionAttentionThreads(threads: TradeChatThread[]): number {
  return threads.filter(
    (t) => t.supervisionStatus === 'requested' || t.supervisionStatus === 'active'
  ).length;
}
