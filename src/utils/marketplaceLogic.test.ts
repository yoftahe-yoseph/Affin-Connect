import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLocalizedNeighborhood,
  LANGUAGE_OPTIONS,
  NEIGHBORHOOD_TRANSLATIONS,
  translations,
} from '../constants/translations';
import {
  buildProductGalleryImages,
  buildShopSlug,
  buildSocialShareUrls,
  buildWishlistShareUrl,
  clampProductQuantity,
  deriveProductBadges,
  formatETB,
  FREE_DELIVERY_THRESHOLD_ETB,
  calculateCartSummary,
  calculateDistanceKm,
  calculateEarnedLoyaltyPoints,
  calculateLoyaltyBalanceFromTransactions,
  calculateMaxRedeemablePoints,
  calculateProductRatingSummary,
  calculateShopRatingSummary,
  canTransitionOrderStatus,
  estimateTravelMinutes,
  filterAdminUsers,
  filterAndSortProducts,
  findNearbyDiscountedDeals,
  findUserByNormalizedEmail,
  formatProximityDistance,
  generateChapaTransactionRef,
  generateDeliveryPin,
  getCartItemKey,
  getCartItemUnitPrice,
  getItemReturnRequest,
  getLoyaltyTier,
  getNeighborhoodCoordinates,
  getNeighborhoodDeliveryEstimate,
  getQualifyingPurchaseOrder,
  getRelatedProducts,
  getUserProductReview,
  HAWASSA_NEIGHBORHOODS,
  isElectronicPaymentMethod,
  isEmailFormat,
  isOrderEligibleForReturn,
  isReturningGoogleSignIn,
  isSuperAdminEmail,
  isUserPendingEmailVerification,
  isValidThemePreference,
  MAX_IMAGE_FILE_BYTES,
  MAX_SHARED_WISHLIST_ITEMS,
  parseSharedWishlistFallbackIds,
  rankShopsByProximity,
  resolveClosestNeighborhood,
  resolveThemePreference,
  sanitizeWishlistProductIds,
  SUPER_ADMIN_EMAIL,
  validateEmailSignInInput,
  validateGatewayReferenceLive,
  validateImageDataUrlSize,
  validatePaymentReference,
  validateProductImageUrl,
  validateProductInput,
  validateShopInput,
  validateRegistrationInput,
  validateAddToCartRequest,
  validateAddressInput,
  validateLoyaltyRedemption,
  validatePromoCode,
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
  getPriceRangeBounds,
  getNeighborhoodAvailabilityStats,
  countActiveSearchFilters,
  buildHomeCategories,
  HOME_CATEGORY_ORDER,
  isVerifiedMerchantShop,
  toggleUniqueId,
  mergeUniqueIds,
  filterShopsForDirectory,
  filterShopsForSearch,
  reconcileCartWithCatalog,
  resolveInitialOrderPaymentStatus,
  canNavigateToCheckoutStep,
  formatReceiptNumber,
  formatOrderReference,
  formatPaymentMethodDisplay,
  buildFinancialReceiptData,
  getTailwindWidthClass,
  resolveSellerManagedShops,
  resolveActiveSellerShopId,
  formatFriendlyErrorMessage,
} from './marketplaceLogic';
import {
  buildWelcomeBackEmail,
  isValidEmailAddress,
} from '../server/welcomeBackEmail';
import type { CartItem, LoyaltyTransaction, Order, Product, ReturnRequest, ReviewItem, Shop } from '../types';

const sampleShop: Shop = {
  shopId: 'shop-1',
  ownerUid: 'seller-1',
  name: 'Sidama Heritage Roasters',
  slug: 'sidama-heritage',
  description: 'Authentic Sidama coffee in Piazza',
  logoUrl: '/logo.jpg',
  coverImageUrl: '/cover.jpg',
  phoneNumber: '+251911000001',
  city: 'Hawassa',
  neighborhood: 'Piazza',
  address: 'Near Gabriel Church, Piazza',
  deliveryAvailable: true,
  pickupAvailable: true,
  status: 'approved',
  rating: 4.8,
  reviewCount: 24,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const sampleProductA: Product = {
  productId: 'prod-a',
  shopId: 'shop-1',
  shopName: 'Sidama Heritage Roasters',
  name: 'Sidama Washed Specialty Coffee 500g',
  description: 'Single-origin organic Sidama coffee beans',
  category: 'groceries',
  price: 650,
  stock: 10,
  isAvailable: true,
  imageUrl: '/coffee.jpg',
  pickupAvailable: true,
  deliveryAvailable: true,
  status: 'active',
  rating: 4.9,
  createdAt: '2026-02-01T10:00:00Z',
  updatedAt: '2026-02-01T10:00:00Z',
};

const sampleProductB: Product = {
  productId: 'prod-b',
  shopId: 'shop-2',
  shopName: 'Tabor Handloom',
  name: 'Habesha Cotton Netela',
  description: 'Handwoven cotton netela with emerald tibeb',
  category: 'clothing-fashion',
  price: 1850,
  stock: 3,
  isAvailable: true,
  imageUrl: '/netela.jpg',
  pickupAvailable: true,
  deliveryAvailable: false,
  status: 'active',
  rating: 4.7,
  createdAt: '2026-02-05T10:00:00Z',
  updatedAt: '2026-02-05T10:00:00Z',
};

test('formatETB formats whole Birr amounts cleanly', () => {
  assert.equal(formatETB(1250), 'ETB 1,250');
  assert.equal(formatETB(0), 'ETB 0');
  assert.equal(formatETB(-50), 'ETB 0');
});

test('calculateCartSummary computes delivery vs pickup totals and detects multi-shop carts', () => {
  const singleShopCart: CartItem[] = [
    { product: sampleProductA, quantity: 2, shopId: 'shop-1' },
  ];

  const deliverySummary = calculateCartSummary(singleShopCart, 'delivery', 80);
  assert.equal(deliverySummary.subtotal, 1300);
  assert.equal(deliverySummary.deliveryFee, 80);
  assert.equal(deliverySummary.totalAmount, 1380);
  assert.equal(deliverySummary.hasMultipleShops, false);
  assert.equal(deliverySummary.hasStockIssues, false);

  const pickupSummary = calculateCartSummary(singleShopCart, 'pickup', 80);
  assert.equal(pickupSummary.deliveryFee, 0);
  assert.equal(pickupSummary.totalAmount, 1300);

  const multiShopCart: CartItem[] = [
    { product: sampleProductA, quantity: 1, shopId: 'shop-1' },
    { product: sampleProductB, quantity: 5, shopId: 'shop-2' }, // exceeds stock of 3
  ];
  const multiSummary = calculateCartSummary(multiShopCart, 'delivery', 80);
  assert.equal(multiSummary.hasMultipleShops, true);
  assert.equal(multiSummary.hasStockIssues, true);
  assert.equal(multiSummary.stockIssues.length, 1);
});

test('canTransitionOrderStatus enforces valid state machine and role boundaries', () => {
  assert.equal(canTransitionOrderStatus('pending', 'accepted', 'seller').allowed, true);
  assert.equal(canTransitionOrderStatus('pending', 'delivered', 'seller').allowed, false);
  assert.equal(canTransitionOrderStatus('delivered', 'canceled', 'seller').allowed, false);
  assert.equal(canTransitionOrderStatus('pending', 'canceled', 'customer').allowed, true);
  assert.equal(canTransitionOrderStatus('out_for_delivery', 'canceled', 'customer').allowed, false);
  assert.equal(canTransitionOrderStatus('pending', 'accepted', 'customer').allowed, false);
});

test('filterAndSortProducts filters by search query, neighborhood, delivery, and sorts by price', () => {
  const shopsMap: Record<string, Shop> = {
    'shop-1': sampleShop,
    'shop-2': { ...sampleShop, shopId: 'shop-2', name: 'Tabor Handloom', neighborhood: 'Tabor' },
  };
  const products = [sampleProductA, sampleProductB];

  const coffeeResults = filterAndSortProducts(products, shopsMap, { searchQuery: 'coffee' });
  assert.equal(coffeeResults.length, 1);
  assert.equal(coffeeResults[0].productId, 'prod-a');

  const piazzaResults = filterAndSortProducts(products, shopsMap, { neighborhood: 'Piazza' });
  assert.equal(piazzaResults.length, 1);

  const sortedDesc = filterAndSortProducts(products, shopsMap, { sortBy: 'price_desc' });
  assert.equal(sortedDesc[0].productId, 'prod-b');
  assert.equal(sortedDesc[1].productId, 'prod-a');
});

test('validateProductInput and validateAddressInput catch invalid fields', () => {
  const invalidProd = validateProductInput({
    name: 'A',
    price: 0,
    stock: -1,
    category: '',
    description: 'short',
  });
  assert.ok(invalidProd.name);
  assert.ok(invalidProd.price);
  assert.ok(invalidProd.stock);
  assert.ok(invalidProd.category);
  assert.ok(invalidProd.description);

  const validProd = validateProductInput({
    name: 'Ethiopian Honey 1kg',
    price: 950,
    stock: 15,
    category: 'groceries',
    description: 'Pure wildflower honey harvested in Sidama hills.',
  });
  assert.equal(Object.keys(validProd).length, 0);

  const badAddr = validateAddressInput({
    label: '',
    recipientName: 'Abebe',
    phoneNumber: '12345',
    neighborhood: 'Piazza',
    streetOrLandmark: 'Hi',
  });
  assert.ok(badAddr.label);
  assert.ok(badAddr.phoneNumber);
  assert.ok(badAddr.streetOrLandmark);

  const goodAddr = validateAddressInput({
    label: 'Home',
    recipientName: 'Abebe Bikila',
    phoneNumber: '0911223344',
    neighborhood: 'Menhariya',
    streetOrLandmark: 'Behind Hawassa Bus Station, Blue Gate',
  });
  assert.equal(Object.keys(goodAddr).length, 0);
});

test('getQualifyingPurchaseOrder enforces buyer ownership, product match, and excludes canceled/rejected orders', () => {
  const baseOrder: Order = {
    orderId: 'ord-1',
    customerUid: 'buyer-1',
    customerName: 'Selam',
    customerPhone: '0911000001',
    shopId: 'shop-1',
    shopName: 'Sidama Heritage Roasters',
    items: [
      {
        productId: 'prod-a',
        name: 'Sidama Coffee',
        price: 650,
        quantity: 1,
        imageUrl: '/coffee.jpg',
      },
    ],
    subtotal: 650,
    deliveryFee: 80,
    totalAmount: 730,
    currency: 'ETB',
    fulfillmentMethod: 'delivery',
    paymentMethod: 'cash_on_delivery',
    paymentStatus: 'pending',
    orderStatus: 'canceled',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  };

  assert.equal(getQualifyingPurchaseOrder([baseOrder], 'prod-a', 'buyer-1'), null);
  assert.equal(
    getQualifyingPurchaseOrder([{ ...baseOrder, orderStatus: 'pending' }], 'prod-a', 'buyer-1'),
    null
  );
  assert.equal(
    getQualifyingPurchaseOrder([{ ...baseOrder, orderStatus: 'preparing' }], 'prod-a', 'buyer-1'),
    null
  );
  assert.equal(
    getQualifyingPurchaseOrder(
      [{ ...baseOrder, orderStatus: 'out_for_delivery' }],
      'prod-a',
      'buyer-1'
    ),
    null
  );

  const deliveredOrder: Order = { ...baseOrder, orderId: 'ord-2', orderStatus: 'delivered' };
  assert.equal(
    getQualifyingPurchaseOrder([baseOrder, deliveredOrder], 'prod-a', 'buyer-1')?.orderId,
    'ord-2'
  );
  assert.equal(getQualifyingPurchaseOrder([deliveredOrder], 'prod-b', 'buyer-1'), null);
  assert.equal(getQualifyingPurchaseOrder([deliveredOrder], 'prod-a', 'buyer-2'), null);
});

test('validateReviewInput, getUserProductReview, and calculateProductRatingSummary work accurately', () => {
  assert.ok(validateReviewInput({ rating: 0, comment: 'Good' }).rating);
  assert.ok(validateReviewInput({ rating: 5, comment: 'Hi' }).comment);
  assert.equal(
    Object.keys(validateReviewInput({ rating: 5, comment: 'Fresh roast and quick Hawassa delivery!' })).length,
    0
  );

  const r1: ReviewItem = {
    reviewId: 'rev-seed-1',
    productId: 'prod-a',
    shopId: 'shop-1',
    customerUid: 'cust-1',
    customerName: 'Dawit',
    rating: 5,
    comment: 'Great coffee',
    verifiedPurchase: true,
    createdAt: '2026-03-01T10:00:00Z',
  };
  const r2: ReviewItem = {
    reviewId: 'rev-user-2',
    productId: 'prod-a',
    shopId: 'shop-1',
    orderId: 'ord-2',
    customerUid: 'buyer-1',
    customerName: 'Selam',
    rating: 3,
    comment: 'Decent aroma, took 2 hours.',
    verifiedPurchase: true,
    createdAt: '2026-03-02T10:00:00Z',
  };

  assert.equal(getUserProductReview([r1, r2], 'prod-a', 'buyer-1')?.reviewId, 'rev-user-2');
  assert.equal(getUserProductReview([r1, r2], 'prod-a', 'other-buyer'), null);

  const summary = calculateProductRatingSummary(
    sampleProductA,
    [r1, r2],
    new Set(['rev-seed-1']),
    { rating: 5.0, reviewCount: 3 }
  );
  // (5.0 * 3 + 3) / 4 = 18 / 4 = 4.5
  assert.equal(summary.reviewCount, 4);
  assert.equal(summary.averageRating, 4.5);
  assert.equal(summary.distribution[5], 1);
  assert.equal(summary.distribution[3], 1);
});

test('LANGUAGE_OPTIONS, translations, and neighborhoods cover en, am, om, and sid with full key parity', () => {
  assert.deepEqual(
    LANGUAGE_OPTIONS.map((opt) => opt.code),
    ['en', 'am', 'om', 'sid']
  );

  const enKeys = Object.keys(translations.en).sort();
  const amKeys = Object.keys(translations.am).sort();
  const omKeys = Object.keys(translations.om).sort();
  const sidKeys = Object.keys(translations.sid).sort();

  assert.deepEqual(amKeys, enKeys);
  assert.deepEqual(omKeys, enKeys);
  assert.deepEqual(sidKeys, enKeys);

  for (const key of enKeys) {
    assert.ok(translations.en[key].trim().length > 0, `Missing en value for ${key}`);
    assert.ok(translations.am[key].trim().length > 0, `Missing am value for ${key}`);
    assert.ok(translations.om[key].trim().length > 0, `Missing om value for ${key}`);
    assert.ok(translations.sid[key].trim().length > 0, `Missing sid value for ${key}`);
  }

  const enNeighborhoods = Object.keys(NEIGHBORHOOD_TRANSLATIONS.en).sort();
  assert.deepEqual(Object.keys(NEIGHBORHOOD_TRANSLATIONS.am).sort(), enNeighborhoods);
  assert.deepEqual(Object.keys(NEIGHBORHOOD_TRANSLATIONS.om).sort(), enNeighborhoods);
  assert.deepEqual(Object.keys(NEIGHBORHOOD_TRANSLATIONS.sid).sort(), enNeighborhoods);
  assert.equal(getLocalizedNeighborhood('Gebeya Dar', 'sid'), 'Dikko Qarqara');
  assert.equal(getLocalizedNeighborhood('All Hawassa', 'sid'), 'Hawaasa Baala');
});

test('validatePromoCode enforces percentage caps, minimum subtotals, and delivery-only rules', () => {
  const hawassa10 = validatePromoCode('hawassa10', 1200, 'delivery');
  assert.equal(hawassa10.valid, true);
  assert.equal(hawassa10.normalizedCode, 'HAWASSA10');
  assert.equal(hawassa10.discountAmount, 120);

  const cappedHawassa10 = validatePromoCode('HAWASSA10', 8000, 'delivery');
  assert.equal(cappedHawassa10.valid, true);
  assert.equal(cappedHawassa10.discountAmount, 500);

  const tooLow = validatePromoCode('SIDAMA150', 600, 'delivery');
  assert.equal(tooLow.valid, false);
  assert.equal(tooLow.errorKey, 'promoErrorMinSubtotal');
  assert.equal(tooLow.minSubtotal, 1000);

  const freedelPickup = validatePromoCode('FREEDEL', 500, 'pickup');
  assert.equal(freedelPickup.valid, false);
  assert.equal(freedelPickup.errorKey, 'promoErrorDeliveryOnly');

  const freedelDelivery = validatePromoCode('FREEDEL', 500, 'delivery');
  assert.equal(freedelDelivery.valid, true);
  assert.equal(freedelDelivery.waivesDelivery, true);

  const invalid = validatePromoCode('UNKNOWN99', 2000, 'delivery');
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errorKey, 'promoErrorInvalid');
});

test('calculateCartSummary handles variant pricing, promo discounts, and free delivery threshold', () => {
  const variantProduct: Product = {
    ...sampleProductA,
    variants: [
      { id: 'v-500g', label: '500g', price: 650, stock: 10 },
      { id: 'v-1kg', label: '1kg Family Bag', price: 1200, stock: 4 },
    ],
  };

  assert.equal(getCartItemKey('prod-a', 'v-1kg'), 'prod-a::v-1kg');
  assert.equal(getCartItemKey('prod-a'), 'prod-a');

  const variantCart: CartItem[] = [
    {
      product: variantProduct,
      quantity: 2,
      shopId: 'shop-1',
      variantId: 'v-1kg',
      variantLabel: '1kg Family Bag',
      unitPrice: 1200,
    },
  ];
  assert.equal(getCartItemUnitPrice(variantCart[0]), 1200);

  const summary = calculateCartSummary(variantCart, 'delivery', 80, 'HAWASSA10');
  assert.equal(summary.subtotal, 2400);
  assert.equal(summary.subtotal >= FREE_DELIVERY_THRESHOLD_ETB, true);
  assert.equal(summary.freeDeliveryUnlocked, true);
  assert.equal(summary.deliveryFee, 0);
  assert.equal(summary.discountAmount, 240);
  assert.equal(summary.totalAmount, 2160);
});

test('getRelatedProducts prioritizes same category and same shop while excluding current product', () => {
  const sameCategoryOtherShop: Product = {
    ...sampleProductA,
    productId: 'prod-c',
    shopId: 'shop-3',
    name: 'Yirgacheffe Beans',
  };
  const sameShopOtherCat: Product = {
    ...sampleProductB,
    productId: 'prod-d',
    shopId: 'shop-1',
    name: 'Roasted Jebena',
  };
  const related = getRelatedProducts(
    sampleProductA,
    [sampleProductA, sampleProductB, sameShopOtherCat, sameCategoryOtherShop],
    3
  );
  assert.equal(related.some((p) => p.productId === 'prod-a'), false);
  assert.equal(related[0].productId, 'prod-c');
  assert.equal(related[1].productId, 'prod-d');
});

test('loyalty point calculation, redemption limits, and tier progression work accurately', () => {
  assert.equal(calculateEarnedLoyaltyPoints(19), 0);
  assert.equal(calculateEarnedLoyaltyPoints(20), 1);
  assert.equal(calculateEarnedLoyaltyPoints(680), 34);

  assert.equal(calculateMaxRedeemablePoints(100, 75), 75);
  assert.equal(calculateMaxRedeemablePoints(40, 1950), 40);

  assert.deepEqual(validateLoyaltyRedemption(0, 50, 500), {
    valid: true,
    appliedPoints: 0,
    discountAmount: 0,
  });
  assert.equal(validateLoyaltyRedemption(5, 50, 500).errorKey, 'loyaltyErrorMinPoints');
  assert.equal(validateLoyaltyRedemption(15, 8, 500).errorKey, 'loyaltyErrorMinPoints');
  assert.equal(validateLoyaltyRedemption(20, 50, 8).errorKey, 'loyaltyErrorOrderTooLow');
  assert.deepEqual(validateLoyaltyRedemption(200, 50, 400), {
    valid: true,
    appliedPoints: 50,
    discountAmount: 50,
  });

  assert.deepEqual(getLoyaltyTier(0), { tier: 'starter', nextTierPoints: 150 });
  assert.deepEqual(getLoyaltyTier(150), { tier: 'regular', nextTierPoints: 500 });
  assert.deepEqual(getLoyaltyTier(520), { tier: 'vip', nextTierPoints: null });
});

test('calculateLoyaltyBalanceFromTransactions reconciles earned, redeemed, refunded, and reversed entries', () => {
  const txs: LoyaltyTransaction[] = [
    {
      transactionId: 'ltx-1',
      customerUid: 'cust-1',
      orderId: 'ord-1',
      shopId: 'shop-1',
      shopName: 'Sidama Heritage Roasters',
      type: 'earned',
      points: 60,
      orderAmountEtb: 1200,
      description: 'Earned 60 pts',
      createdAt: '2026-03-01T10:00:00Z',
    },
    {
      transactionId: 'ltx-2',
      customerUid: 'cust-1',
      orderId: 'ord-2',
      shopId: 'shop-1',
      shopName: 'Sidama Heritage Roasters',
      type: 'redeemed',
      points: -25,
      orderAmountEtb: 650,
      description: 'Redeemed 25 pts',
      createdAt: '2026-03-02T10:00:00Z',
    },
    {
      transactionId: 'ltx-3',
      customerUid: 'cust-1',
      orderId: 'ord-2',
      shopId: 'shop-1',
      shopName: 'Sidama Heritage Roasters',
      type: 'earned',
      points: 31,
      orderAmountEtb: 650,
      description: 'Earned 31 pts',
      createdAt: '2026-03-02T10:00:01Z',
    },
    {
      transactionId: 'ltx-4',
      customerUid: 'cust-1',
      orderId: 'ord-2',
      shopId: 'shop-1',
      shopName: 'Sidama Heritage Roasters',
      type: 'refunded',
      points: 25,
      orderAmountEtb: 650,
      description: 'Refunded 25 pts',
      createdAt: '2026-03-02T11:00:00Z',
    },
    {
      transactionId: 'ltx-5',
      customerUid: 'cust-1',
      orderId: 'ord-2',
      shopId: 'shop-1',
      shopName: 'Sidama Heritage Roasters',
      type: 'reversed',
      points: -31,
      orderAmountEtb: 650,
      description: 'Reversed 31 pts',
      createdAt: '2026-03-02T11:00:01Z',
    },
  ];

  assert.deepEqual(calculateLoyaltyBalanceFromTransactions(txs), {
    balance: 60,
    lifetimeEarned: 60,
    totalRedeemed: 0,
  });
});

test('calculateCartSummary combines promo code and loyalty point redemption accurately', () => {
  const cart: CartItem[] = [
    { product: sampleProductA, quantity: 2, shopId: 'shop-1' }, // 1300 ETB
  ];
  // HAWASSA10 => 130 off => 1170 subtotal after promo
  // Redeem 30 pts => 30 off => 1140 net merchandise => floor(1140 / 20) = 57 pts earned
  // Delivery: subtotal 1300 < 2000 => 80 ETB => total = 1220
  const summary = calculateCartSummary(cart, 'delivery', 80, 'HAWASSA10', 30, 45);
  assert.equal(summary.subtotal, 1300);
  assert.equal(summary.promoDiscountAmount, 130);
  assert.equal(summary.loyaltyPointsApplied, 30);
  assert.equal(summary.loyaltyDiscountAmount, 30);
  assert.equal(summary.discountAmount, 160);
  assert.equal(summary.pointsToEarn, 57);
  assert.equal(summary.deliveryFee, 80);
  assert.equal(summary.totalAmount, 1220);
});

test('wishlist sharing sanitizes IDs, builds & parses share links, and encodes social share URLs', () => {
  const sanitized = sanitizeWishlistProductIds([
    ' prod-1 ',
    'prod-1',
    'invalid/id!',
    '',
    'prod_2',
    ...Array.from({ length: 60 }, (_, idx) => `item-${idx}`),
  ]);
  assert.equal(sanitized.length, MAX_SHARED_WISHLIST_ITEMS);
  assert.equal(sanitized[0], 'prod-1');
  assert.equal(sanitized[1], 'prod_2');
  assert.equal(sanitized.includes('invalid/id!'), false);

  const cloudOnlyUrl = buildWishlistShareUrl('https://hawasa.example.com/', 'wl-abc123');
  assert.equal(cloudOnlyUrl, 'https://hawasa.example.com/?wishlist=wl-abc123');

  const guestUrl = buildWishlistShareUrl('https://hawasa.example.com/', 'wl-abc123', [
    'prod-1',
    'prod_2',
  ]);
  assert.equal(
    guestUrl,
    'https://hawasa.example.com/?wishlist=wl-abc123&items=prod-1%2Cprod_2'
  );

  const parsedFallback = parseSharedWishlistFallbackIds(new URL(guestUrl).search);
  assert.deepEqual(parsedFallback, ['prod-1', 'prod_2']);
  assert.deepEqual(parseSharedWishlistFallbackIds('?wishlist=wl-abc123'), []);

  const social = buildSocialShareUrls(guestUrl, 'Coffee & Netela Picks', 2);
  assert.ok(social.whatsapp.startsWith('https://wa.me/?text='));
  assert.ok(social.whatsapp.includes(encodeURIComponent(guestUrl)));
  assert.ok(social.telegram.startsWith('https://t.me/share/url?url='));
  assert.ok(social.telegram.includes(encodeURIComponent('Coffee & Netela Picks (2 items on Hawasa Gebeya)')));
  assert.ok(social.x.startsWith('https://twitter.com/intent/tweet?text='));
  assert.ok(social.facebook.startsWith('https://www.facebook.com/sharer/sharer.php?u='));
});

test('easy returns validation, order eligibility, and item lookup enforce damage photo proof and constraints', () => {
  const sampleOrder: Order = {
    orderId: 'ord-ret-1',
    customerUid: 'cust-1',
    customerName: 'Selam',
    customerPhone: '0911000001',
    shopId: 'shop-1',
    shopName: 'Sidama Heritage Roasters',
    items: [
      {
        productId: 'prod-a',
        name: 'Sidama Coffee',
        price: 650,
        quantity: 1,
        imageUrl: '/coffee.jpg',
        variantLabel: '500g',
      },
    ],
    subtotal: 650,
    deliveryFee: 80,
    totalAmount: 730,
    currency: 'ETB',
    fulfillmentMethod: 'delivery',
    paymentMethod: 'cash_on_delivery',
    paymentStatus: 'pending',
    orderStatus: 'delivered',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  };

  assert.equal(isOrderEligibleForReturn(sampleOrder), true);
  assert.equal(isOrderEligibleForReturn({ ...sampleOrder, orderStatus: 'canceled' }), false);
  assert.equal(isOrderEligibleForReturn({ ...sampleOrder, orderStatus: 'rejected' }), false);

  // Damaged item requires photo proof and valid details
  const missingPhoto = validateReturnRequestInput({
    requestType: 'return',
    reason: 'damaged_item',
    details: 'Bag arrived torn in transit',
  });
  assert.equal(missingPhoto.photoDataUrl, 'returnErrorPhotoRequired');

  const shortDetails = validateReturnRequestInput({
    requestType: 'exchange',
    reason: 'size_or_fit',
    details: 'bad',
  });
  assert.equal(shortDetails.details, 'returnErrorDetails');

  const validSamplePhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/';
  const validDamaged = validateReturnRequestInput({
    requestType: 'return',
    reason: 'damaged_item',
    details: 'Coffee seal broken and bag ripped during delivery.',
    photoDataUrl: validSamplePhoto,
  });
  assert.equal(Object.keys(validDamaged).length, 0);

  const validExchangeNoPhoto = validateReturnRequestInput({
    requestType: 'exchange',
    reason: 'size_or_fit',
    details: 'Need a larger netela drape size if available.',
  });
  assert.equal(Object.keys(validExchangeNoPhoto).length, 0);

  const req: ReturnRequest = {
    returnId: 'ret-1',
    orderId: 'ord-ret-1',
    productId: 'prod-a',
    productName: 'Sidama Coffee',
    variantLabel: '500g',
    shopId: 'shop-1',
    shopName: 'Sidama Heritage Roasters',
    customerUid: 'cust-1',
    customerName: 'Selam',
    requestType: 'return',
    reason: 'damaged_item',
    details: 'Seal broken',
    photoDataUrl: validSamplePhoto,
    status: 'requested',
    createdAt: '2026-03-02T10:00:00Z',
    updatedAt: '2026-03-02T10:00:00Z',
  };

  assert.equal(getItemReturnRequest([req], 'ord-ret-1', 'prod-a', '500g')?.returnId, 'ret-1');
  assert.equal(getItemReturnRequest([req], 'ord-ret-1', 'prod-a', '1kg'), null);
});

test('theme validation and resolution support light, dark, and system preferences accurately', () => {
  assert.equal(isValidThemePreference('light'), true);
  assert.equal(isValidThemePreference('dark'), true);
  assert.equal(isValidThemePreference('system'), true);
  assert.equal(isValidThemePreference('midnight'), false);
  assert.equal(isValidThemePreference(null), false);

  assert.equal(resolveThemePreference('light', true), 'light');
  assert.equal(resolveThemePreference('light', false), 'light');
  assert.equal(resolveThemePreference('dark', false), 'dark');
  assert.equal(resolveThemePreference('dark', true), 'dark');
  assert.equal(resolveThemePreference('system', true), 'dark');
  assert.equal(resolveThemePreference('system', false), 'light');
});

test('Ethiopian payment methods require valid transaction references while COD/pickup allow empty', () => {
  assert.equal(isElectronicPaymentMethod('telebirr'), true);
  assert.equal(isElectronicPaymentMethod('cbe_birr'), true);
  assert.equal(isElectronicPaymentMethod('chapa'), true);
  assert.equal(isElectronicPaymentMethod('cash_on_delivery'), false);
  assert.equal(isElectronicPaymentMethod('pay_at_pickup'), false);

  assert.deepEqual(validatePaymentReference('cash_on_delivery', ''), {
    valid: true,
    normalizedRef: '',
  });
  assert.deepEqual(validatePaymentReference('pay_at_pickup', undefined), {
    valid: true,
    normalizedRef: '',
  });

  const emptyTelebirr = validatePaymentReference('telebirr', '   ');
  assert.equal(emptyTelebirr.valid, false);
  assert.equal(emptyTelebirr.errorKey, 'paymentReferenceInvalidError');

  const shortRef = validatePaymentReference('cbe_birr', 'FT12');
  assert.equal(shortRef.valid, false);

  const validTelebirr = validatePaymentReference('telebirr', ' tb849201k ');
  assert.equal(validTelebirr.valid, true);
  assert.equal(validTelebirr.normalizedRef, 'TB849201K');

  const validChapa = validatePaymentReference('chapa', 'chp-904128');
  assert.equal(validChapa.valid, true);
  assert.equal(validChapa.normalizedRef, 'CHP-904128');
});

test('Delivery PIN generation, handoff verification, and neighborhood ETAs work accurately', () => {
  for (let i = 0; i < 20; i += 1) {
    const pin = generateDeliveryPin();
    assert.match(pin, /^\d{4}$/);
    const num = Number(pin);
    assert.ok(num >= 1000 && num <= 9999);
  }

  assert.deepEqual(verifyDeliveryPin('4821', ' 4821 '), { valid: true });
  assert.equal(verifyDeliveryPin('4821', '4820').valid, false);
  assert.equal(verifyDeliveryPin('4821', '48').valid, false);
  assert.equal(verifyDeliveryPin(undefined, '4821').valid, false);

  assert.equal(getNeighborhoodDeliveryEstimate('Piazza').label, '20–35 min');
  assert.equal(getNeighborhoodDeliveryEstimate('Datto').label, '40–60 min');
  assert.equal(getNeighborhoodDeliveryEstimate('Unknown Zone').label, '30–50 min');
});

test('calculateShopRatingSummary incorporates shopRating updates accurately', () => {
  const seedReview: ReviewItem = {
    reviewId: 'rev-seed-s1',
    productId: 'prod-a',
    shopId: 'shop-1',
    customerUid: 'cust-seed',
    customerName: 'Dawit',
    rating: 5,
    shopRating: 5,
    comment: 'Great service',
    verifiedPurchase: true,
    createdAt: '2026-03-01T10:00:00Z',
  };
  const newReview: ReviewItem = {
    reviewId: 'rev-new-s1',
    productId: 'prod-a',
    shopId: 'shop-1',
    orderId: 'ord-delivered-1',
    customerUid: 'buyer-1',
    customerName: 'Selam',
    rating: 5,
    shopRating: 3,
    shopComment: 'Good shop overall, delivery could be faster.',
    comment: 'Coffee tasted awesome.',
    verifiedPurchase: true,
    createdAt: '2026-03-02T10:00:00Z',
  };

  const summary = calculateShopRatingSummary(
    sampleShop,
    [seedReview, newReview],
    new Set(['rev-seed-s1']),
    { rating: 5.0, reviewCount: 3 }
  );
  // (5.0 * 3 + 3) / 4 = 18 / 4 = 4.5
  assert.equal(summary.reviewCount, 4);
  assert.equal(summary.averageRating, 4.5);
});

test('Image payload guardrails enforce < 350 KB limit and valid formats', () => {
  const smallJpeg = 'data:image/jpeg;base64,' + 'A'.repeat(128);
  assert.equal(validateImageDataUrlSize(smallJpeg), true);
  assert.equal(validateProductImageUrl(smallJpeg), true);

  // Exceeds 350 KB raw bytes (~360 KB decoded)
  const oversizedBytesBase64Length = Math.ceil(((MAX_IMAGE_FILE_BYTES + 1024) * 4) / 3);
  const hugeJpeg = 'data:image/jpeg;base64,' + 'A'.repeat(oversizedBytesBase64Length);
  assert.equal(validateImageDataUrlSize(hugeJpeg), false);
  assert.equal(validateProductImageUrl(hugeJpeg), false);

  assert.equal(validateImageDataUrlSize('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(validateProductImageUrl('https://cdn.example.com/coffee.jpg'), true);
  assert.equal(validateProductImageUrl('/images/coffee.jpg'), true);
  assert.equal(validateProductImageUrl('http://insecure.example.com/coffee.jpg'), false);
});

test('Email/Password sign-in and registration validation enforce valid fields and detect phone numbers', () => {
  assert.equal(isEmailFormat('selam@hawassa.et'), true);
  assert.equal(isEmailFormat('0911234567'), false);

  const phoneRedirect = validateEmailSignInInput({
    emailOrPhone: '0911234567',
    password: '',
  });
  assert.equal(phoneRedirect.valid, false);
  assert.equal(phoneRedirect.mode, 'phone_redirect');
  assert.equal(phoneRedirect.normalizedPhone, '+251911234567');

  const validSignIn = validateEmailSignInInput({
    emailOrPhone: ' Selam@Hawassa.et ',
    password: 'secret123',
  });
  assert.equal(validSignIn.valid, true);
  assert.equal(validSignIn.mode, 'email');
  assert.equal(validSignIn.normalizedEmail, 'selam@hawassa.et');

  const badSignIn = validateEmailSignInInput({
    emailOrPhone: 'bad@email',
    password: '123',
  });
  assert.equal(badSignIn.valid, false);
  assert.equal(badSignIn.errors.emailOrPhone, 'authErrorInvalidEmail');
  assert.equal(badSignIn.errors.password, 'authErrorPasswordLength');

  const badReg = validateRegistrationInput({
    fullName: 'A',
    email: 'nope',
    phoneNumber: '123',
    neighborhood: 'Piazza',
    accountType: 'customer',
    password: '123',
  });
  assert.equal(badReg.valid, false);
  assert.equal(badReg.errors.fullName, 'authErrorFullName');
  assert.equal(badReg.errors.email, 'authErrorInvalidEmail');
  assert.equal(badReg.errors.phoneNumber, 'phoneAuthErrorInvalid');
  assert.equal(badReg.errors.password, 'authErrorPasswordLength');

  const validSellerReg = validateRegistrationInput({
    fullName: 'Abebe Coffee Roasters',
    email: ' Abebe@Sidama.et ',
    phoneNumber: '0911 234 567',
    neighborhood: 'Tabor',
    accountType: 'seller',
    password: 'strongPassword9',
  });
  assert.equal(validSellerReg.valid, true);
  assert.equal(validSellerReg.normalizedEmail, 'abebe@sidama.et');
  assert.equal(validSellerReg.normalizedPhone, '+251911234567');
  assert.equal(validSellerReg.normalizedNeighborhood, 'Tabor');
});

test('isUserPendingEmailVerification targets unverified email/password accounts only', () => {
  assert.equal(isUserPendingEmailVerification(null), false);
  assert.equal(
    isUserPendingEmailVerification({
      email: 'selam@hawassa.et',
      emailVerified: false,
      providerIds: ['password'],
    }),
    true
  );
  assert.equal(
    isUserPendingEmailVerification({
      email: 'selam@hawassa.et',
      emailVerified: true,
      providerIds: ['password'],
    }),
    false
  );
  assert.equal(
    isUserPendingEmailVerification({
      email: 'selam@gmail.com',
      emailVerified: false,
      providerIds: ['google.com'],
    }),
    false
  );
  assert.equal(
    isUserPendingEmailVerification({
      email: null,
      emailVerified: false,
      phoneNumber: '+251911234567',
      providerIds: ['phone'],
    }),
    false
  );
  assert.equal(
    isUserPendingEmailVerification({
      email: 'newuser@hawassa.et',
      emailVerified: false,
      phoneNumber: null,
      providerIds: [],
    }),
    true
  );
});

test('isReturningGoogleSignIn distinguishes new vs returning Google logins reliably', () => {
  assert.equal(
    isReturningGoogleSignIn({
      isNewUser: false,
      creationTime: '2026-11-15T10:00:00Z',
      lastSignInTime: '2026-11-15T10:00:00Z',
    }),
    true
  );
  assert.equal(
    isReturningGoogleSignIn({
      isNewUser: true,
      creationTime: '2026-11-15T10:00:00Z',
      lastSignInTime: '2026-11-15T10:00:05Z',
    }),
    false
  );
  assert.equal(
    isReturningGoogleSignIn({
      hadExistingProfileDoc: true,
      isNewUser: true,
    }),
    true
  );
  assert.equal(
    isReturningGoogleSignIn({
      creationTime: '2026-11-10T08:00:00Z',
      lastSignInTime: '2026-11-15T09:00:00Z',
    }),
    true
  );
  assert.equal(
    isReturningGoogleSignIn({
      creationTime: '2026-11-15T09:00:00Z',
      lastSignInTime: '2026-11-15T09:00:00Z',
    }),
    false
  );
});

test('buildWelcomeBackEmail renders culturally styled HTML template with escaping and 4-language support', () => {
  assert.equal(isValidEmailAddress('abebe@hawassa.et'), true);
  assert.equal(isValidEmailAddress('not-an-email'), false);

  const renderedEn = buildWelcomeBackEmail({
    email: 'Abebe@Hawassa.et ',
    displayName: 'Abebe <Tadesse>',
    neighborhood: 'Piazza',
    language: 'en',
    loginTimestamp: '2026-11-16T05:35:00.000Z',
    appUrl: 'https://hawasagebeya.vercel.app',
  });

  assert.equal(renderedEn.normalizedEmail, 'abebe@hawassa.et');
  assert.equal(renderedEn.subject, 'Welcome back to Hawasa Gebeya, Abebe <Tadesse>!');
  assert.ok(renderedEn.html.includes('#047857'));
  assert.ok(renderedEn.html.includes('#D97706'));
  assert.ok(renderedEn.html.includes('We noticed a new sign-in to your Hawasa Gebeya account'));
  assert.ok(renderedEn.html.includes('Abebe &lt;Tadesse&gt;'));
  assert.ok(!renderedEn.html.includes('Abebe <Tadesse>'));
  assert.ok(renderedEn.html.includes('Piazza'));
  assert.ok(renderedEn.html.includes('https://hawasagebeya.vercel.app'));

  const renderedSid = buildWelcomeBackEmail({
    email: 'selam@sidama.et',
    displayName: 'Selam',
    neighborhood: 'Gebeya Dar',
    language: 'sid',
    loginTimestamp: '2026-11-16T05:35:00.000Z',
  });
  assert.ok(renderedSid.subject.includes('Hawasa Gebeyara Baxe Daggino, Selam!'));
  assert.equal(renderedSid.localizedNeighborhood, 'Dikko Qarqara');
});

test('isSuperAdminEmail, filterAdminUsers, and findUserByNormalizedEmail manage admin role lookups accurately', () => {
  assert.equal(SUPER_ADMIN_EMAIL, 'yoftaheyoseph5@gmail.com');
  assert.equal(isSuperAdminEmail('yoftaheyoseph5@gmail.com'), true);
  assert.equal(isSuperAdminEmail('  YoftaheYoseph5@Gmail.com '), true);
  assert.equal(isSuperAdminEmail('other@hawassa.et'), false);
  assert.equal(isSuperAdminEmail(null), false);

  const mockUsers = [
    {
      uid: 'u-1',
      displayName: 'Yoftahe Yoseph',
      email: 'yoftaheyoseph5@gmail.com',
      phoneNumber: '+251911000001',
      role: 'admin' as const,
      accountStatus: 'active' as const,
      preferredLanguage: 'en' as const,
      createdAt: '2026-11-01T08:00:00Z',
      updatedAt: '2026-11-01T08:00:00Z',
    },
    {
      uid: 'u-2',
      displayName: 'Abebe Coffee Merchant',
      email: 'abebe@sidama.et',
      phoneNumber: '+251922334455',
      role: 'seller' as const,
      accountStatus: 'active' as const,
      preferredLanguage: 'am' as const,
      createdAt: '2026-11-02T08:00:00Z',
      updatedAt: '2026-11-02T08:00:00Z',
    },
    {
      uid: 'u-3',
      displayName: 'Tigist Bekele',
      email: 'tigist@hawassa.et',
      phoneNumber: '+251933445566',
      role: 'customer' as const,
      accountStatus: 'suspended' as const,
      preferredLanguage: 'sid' as const,
      createdAt: '2026-11-03T08:00:00Z',
      updatedAt: '2026-11-03T08:00:00Z',
    },
  ];

  assert.equal(filterAdminUsers(mockUsers, '', 'all').length, 3);
  assert.equal(filterAdminUsers(mockUsers, '', 'admin').length, 1);
  assert.equal(filterAdminUsers(mockUsers, '', 'seller')[0].uid, 'u-2');
  assert.equal(filterAdminUsers(mockUsers, '093344', 'all')[0].uid, 'u-3');
  assert.equal(filterAdminUsers(mockUsers, 'sidama.et', 'seller')[0].uid, 'u-2');
  assert.equal(filterAdminUsers(mockUsers, 'sidama.et', 'customer').length, 0);

  assert.equal(findUserByNormalizedEmail(mockUsers, ' ABEBE@SIDAMA.ET ')?.uid, 'u-2');
  assert.equal(findUserByNormalizedEmail(mockUsers, 'not-an-email'), null);
  assert.equal(findUserByNormalizedEmail(mockUsers, 'missing@hawassa.et'), null);
});

test('calculateDistanceKm, Hawassa landmark coordinates, and resolveClosestNeighborhood compute accurate distances', () => {
  assert.equal(calculateDistanceKm(7.0504, 38.4955, 7.0504, 38.4955), 0);
  const piazza = getNeighborhoodCoordinates('Piassa');
  const menhariya = getNeighborhoodCoordinates('Menaharia');
  assert.deepEqual(piazza, getNeighborhoodCoordinates('Piazza'));
  assert.deepEqual(menhariya, getNeighborhoodCoordinates('Menhariya'));

  const piazzaToMenhariya = calculateDistanceKm(
    piazza.lat,
    piazza.lng,
    menhariya.lat,
    menhariya.lng
  );
  assert.ok(piazzaToMenhariya > 1.0 && piazzaToMenhariya < 1.8);
  assert.equal(formatProximityDistance(0.42), '0.4 km');
  assert.equal(formatProximityDistance(0.01), '0.1 km');

  const eta = estimateTravelMinutes(1.2);
  assert.ok(eta.walkMinutes >= 10 && eta.bajajMinutes >= 3);

  const lakeSide = getNeighborhoodCoordinates('Amora Gedel / Lake Side');
  const hu = getNeighborhoodCoordinates('Hawassa University Main Campus');
  assert.ok(lakeSide.lng < piazza.lng);
  assert.ok(hu.lng > piazza.lng);

  const resolved = resolveClosestNeighborhood(7.0505, 38.4954, HAWASSA_NEIGHBORHOODS);
  assert.equal(resolved.neighborhood, 'Piazza');
});

test('rankShopsByProximity, findNearbyDiscountedDeals, and nearest product sort order by Hawassa proximity', () => {
  const shopPiazza: Shop = { ...sampleShop, shopId: 'shop-piazza', neighborhood: 'Piazza' };
  const shopGebeyaDar: Shop = { ...sampleShop, shopId: 'shop-gebeya', name: 'Gebeya Dar Spices', neighborhood: 'Gebeya Dar' };
  const shopTabor: Shop = { ...sampleShop, shopId: 'shop-tabor', name: 'Tabor Store', neighborhood: 'Tabor' };

  const piazzaCoords = getNeighborhoodCoordinates('Piazza');
  const discountedInPiazza: Product = {
    ...sampleProductA,
    productId: 'prod-piazza-deal',
    shopId: 'shop-piazza',
    price: 680,
    previousPrice: 800,
    status: 'active',
    isAvailable: true,
    stock: 10,
  };
  const regularInGebeya: Product = {
    ...sampleProductB,
    productId: 'prod-gebeya-regular',
    shopId: 'shop-gebeya',
    price: 1200,
    previousPrice: undefined,
    status: 'active',
    isAvailable: true,
    stock: 5,
  };

  const ranked = rankShopsByProximity(
    [shopTabor, shopGebeyaDar, shopPiazza],
    piazzaCoords,
    'Piazza',
    [discountedInPiazza, regularInGebeya]
  );

  assert.equal(ranked[0].shop.shopId, 'shop-piazza');
  assert.equal(ranked[0].isNearestForUser, true);
  assert.equal(ranked[1].isNearestForUser, false);
  assert.equal(ranked[0].discountedProductsCount, 1);
  assert.equal(ranked[0].bestDiscountPercent, 15);
  assert.ok(ranked[0].distanceKm < ranked[1].distanceKm);

  const deals = findNearbyDiscountedDeals({
    rankedShops: ranked,
    products: [regularInGebeya, discountedInPiazza],
    maxDistanceKm: 2.0,
  });
  assert.equal(deals.length, 1);
  assert.equal(deals[0].product.productId, 'prod-piazza-deal');
  assert.equal(deals[0].discountPercent, 15);

  const distById = Object.fromEntries(ranked.map((r) => [r.shop.shopId, r.distanceKm]));
  const sortedNearest = filterAndSortProducts(
    [regularInGebeya, discountedInPiazza],
    {
      [shopPiazza.shopId]: shopPiazza,
      [shopGebeyaDar.shopId]: shopGebeyaDar,
    },
    { sortBy: 'nearest', shopDistanceById: distById }
  );
  assert.equal(sortedNearest[0].productId, 'prod-piazza-deal');
});

test('Live Ethiopian gateway validation, Chapa reference generation, and 4-language translation parity', () => {
  // Telebirr / CBE Birr live format detection
  const trxLive = validateGatewayReferenceLive('telebirr', ' trx8492019 ');
  assert.equal(trxLive.valid, true);
  assert.equal(trxLive.detectedKind, 'trx');
  assert.equal(trxLive.normalizedRef, 'TRX8492019');

  const phoneLive = validateGatewayReferenceLive('telebirr', '+251 911 223 344');
  assert.equal(phoneLive.valid, true);
  assert.equal(phoneLive.detectedKind, 'phone');
  assert.equal(phoneLive.normalizedRef, '251911223344');

  const localPhoneLive = validateGatewayReferenceLive('cbe_birr', '0911223344');
  assert.equal(localPhoneLive.valid, true);
  assert.equal(localPhoneLive.detectedKind, 'phone');
  assert.equal(localPhoneLive.normalizedRef, '251911223344');

  const tenDigitLive = validateGatewayReferenceLive('cbe_birr', '1234567890');
  assert.equal(tenDigitLive.valid, true);
  assert.equal(tenDigitLive.detectedKind, 'numeric10');

  const chapaRef = generateChapaTransactionRef();
  assert.match(chapaRef, /^CHAPA-\d{6}-[A-Z0-9]{4}$/);
  const chapaLive = validateGatewayReferenceLive('chapa', chapaRef);
  assert.equal(chapaLive.valid, true);
  assert.equal(chapaLive.detectedKind, 'chapa');
  assert.equal(validatePaymentReference('chapa', chapaRef).valid, true);

  const invalidLive = validateGatewayReferenceLive('telebirr', 'bad!@#');
  assert.equal(invalidLive.valid, false);
  assert.equal(invalidLive.detectedKind, 'invalid');

  // Ensure all 4 language dictionaries share exact key parity
  const enKeys = Object.keys(translations.en).sort();
  for (const lang of ['am', 'om', 'sid'] as const) {
    assert.deepEqual(Object.keys(translations[lang]).sort(), enKeys);
  }
});

test('Buyer-Seller Chat thread IDs, validation, sorting, and supervision attention counts', () => {
  assert.equal(buildOrderChatThreadId('ord-123456-7kwtd'), 'order-ord-123456-7kwtd');
  assert.equal(buildOrderChatThreadId('order/weird!id'), 'order-order-weird-id');
  assert.equal(buildShopChatThreadId('shop-1', 'user_abc'), 'shop-shop-1--user_abc');
  assert.equal(formatOrderChatCode('ord-7-kwtd'), '7-KWTD');
  assert.equal(formatOrderChatCode('ord-ab-123456'), '123456');

  assert.ok(validateChatMessageInput('   ') !== null);
  assert.ok(validateChatMessageInput('x'.repeat(1001)) !== null);
  assert.equal(validateChatMessageInput('When will Bajaaj arrive at Piassa?'), null);

  assert.equal(validateSupervisionReason(''), null);
  assert.ok(validateSupervisionReason('no') !== null);
  assert.equal(validateSupervisionReason('Seller did not confirm delivery PIN'), null);

  const threads = [
    {
      threadId: 'order-1',
      threadType: 'order' as const,
      orderId: 'ord-1',
      orderCode: 'ORDER1',
      shopId: 'shop-1',
      shopName: 'Shop One',
      buyerUid: 'b1',
      buyerName: 'Buyer One',
      sellerUid: 's1',
      sellerName: 'Seller One',
      lastMessage: 'Older message',
      lastSenderUid: 'b1',
      lastSenderRole: 'buyer' as const,
      lastMessageAt: '2026-04-01T10:00:00.000Z',
      supervisionStatus: 'requested' as const,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
    {
      threadId: 'order-2',
      threadType: 'order' as const,
      orderId: 'ord-2',
      orderCode: 'ORDER2',
      shopId: 'shop-1',
      shopName: 'Shop One',
      buyerUid: 'b1',
      buyerName: 'Buyer One',
      sellerUid: 's1',
      sellerName: 'Seller One',
      lastMessage: 'Newer message',
      lastSenderUid: 's1',
      lastSenderRole: 'seller' as const,
      lastMessageAt: '2026-04-02T10:00:00.000Z',
      supervisionStatus: 'resolved' as const,
      createdAt: '2026-04-02T09:00:00.000Z',
      updatedAt: '2026-04-02T10:00:00.000Z',
    },
    {
      threadId: 'shop-1--b1',
      threadType: 'shop' as const,
      shopId: 'shop-1',
      shopName: 'Shop One',
      buyerUid: 'b1',
      buyerName: 'Buyer One',
      sellerUid: 's1',
      sellerName: 'Seller One',
      lastMessage: 'Mediator joined',
      lastSenderUid: 'admin-1',
      lastSenderRole: 'admin' as const,
      lastMessageAt: '2026-04-01T15:00:00.000Z',
      supervisionStatus: 'active' as const,
      createdAt: '2026-04-01T12:00:00.000Z',
      updatedAt: '2026-04-01T15:00:00.000Z',
    },
  ];

  const sorted = sortTradeChatThreads(threads);
  assert.deepEqual(sorted.map((t) => t.threadId), ['order-2', 'shop-1--b1', 'order-1']);
  assert.equal(countSupervisionAttentionThreads(threads), 2);
});

test('Refined search filters support price ranges, minimum shop ratings, and Hawassa neighborhood availability', () => {
  const highRatedPiazzaShop: Shop = {
    ...sampleShop,
    shopId: 'shop-piazza-top',
    name: 'Piazza Coffee',
    neighborhood: 'Piazza',
    rating: 4.9,
    deliveryAvailable: true,
    pickupAvailable: true,
    status: 'approved',
  };
  const midRatedTaborShop: Shop = {
    ...sampleShop,
    shopId: 'shop-tabor-mid',
    name: 'Tabor Crafts',
    neighborhood: 'Tabor',
    rating: 4.1,
    deliveryAvailable: false,
    pickupAvailable: true,
    status: 'approved',
  };
  const lowRatedMenhariyaShop: Shop = {
    ...sampleShop,
    shopId: 'shop-men-low',
    name: 'Menhariya Market',
    neighborhood: 'Menhariya',
    rating: 3.4,
    deliveryAvailable: true,
    pickupAvailable: false,
    status: 'approved',
  };

  const p1: Product = {
    ...sampleProductA,
    productId: 'prod-1',
    shopId: 'shop-piazza-top',
    price: 900,
    stock: 8,
    isAvailable: true,
    deliveryAvailable: true,
    pickupAvailable: true,
  };
  const p2: Product = {
    ...sampleProductA,
    productId: 'prod-2',
    shopId: 'shop-tabor-mid',
    price: 2500,
    stock: 0,
    isAvailable: false,
    deliveryAvailable: false,
    pickupAvailable: true,
  };
  const p3: Product = {
    ...sampleProductA,
    productId: 'prod-3',
    shopId: 'shop-men-low',
    price: 450,
    stock: 5,
    isAvailable: true,
    deliveryAvailable: true,
    pickupAvailable: false,
  };

  const shopsMap = {
    [highRatedPiazzaShop.shopId]: highRatedPiazzaShop,
    [midRatedTaborShop.shopId]: midRatedTaborShop,
    [lowRatedMenhariyaShop.shopId]: lowRatedMenhariyaShop,
  };

  // Price range filtering (also gracefully handles inverted min/max)
  const priceFiltered = filterAndSortProducts([p1, p2, p3], shopsMap, {
    minPrice: 500,
    maxPrice: 1200,
  });
  assert.deepEqual(
    priceFiltered.map((p) => p.productId),
    ['prod-1']
  );
  const swappedBounds = filterAndSortProducts([p1, p2, p3], shopsMap, {
    minPrice: 1200,
    maxPrice: 500,
  });
  assert.deepEqual(
    swappedBounds.map((p) => p.productId),
    ['prod-1']
  );

  // Shop rating filtering
  const topShopFiltered = filterAndSortProducts([p1, p2, p3], shopsMap, {
    minShopRating: 4.5,
  });
  assert.deepEqual(
    topShopFiltered.map((p) => p.productId),
    ['prod-1']
  );

  // Multi-neighborhood + pickup availability
  const areaPickupFiltered = filterAndSortProducts([p1, p2, p3], shopsMap, {
    neighborhoods: ['Piazza', 'Tabor'],
    pickupOnly: true,
    inStockOnly: true,
  });
  assert.deepEqual(
    areaPickupFiltered.map((p) => p.productId),
    ['prod-1']
  );

  // Neighborhood stats and price bounds
  const bounds = getPriceRangeBounds([p1, p2, p3]);
  assert.equal(bounds.min, 450);
  assert.equal(bounds.max, 2500);

  const areaStats = getNeighborhoodAvailabilityStats([p1, p2, p3], shopsMap, true);
  assert.deepEqual(areaStats.Piazza, { shopCount: 1, productCount: 1 });
  assert.deepEqual(areaStats.Tabor, { shopCount: 1, productCount: 1 });

  assert.equal(
    countActiveSearchFilters({
      neighborhoods: ['Piazza'],
      minPrice: 500,
      minShopRating: 4.5,
      inStockOnly: true,
      sortBy: 'nearest',
    }),
    5
  );
});

test('buildShopSlug and validateShopInput validate virtual shop creation fields and non-ASCII names', () => {
  assert.equal(buildShopSlug('Sidama Crafts Hub!'), 'sidama-crafts-hub');
  assert.equal(buildShopSlug('ሐዋሳ ቡና', 'shop-999'), 'shop-999');

  const invalid = validateShopInput({
    name: 'Ab',
    description: 'short',
    phoneNumber: '123',
    neighborhood: '',
    address: 'Pi',
    deliveryAvailable: false,
    pickupAvailable: false,
  });
  assert.ok(invalid.name);
  assert.ok(invalid.description);
  assert.ok(invalid.phoneNumber);
  assert.ok(invalid.neighborhood);
  assert.ok(invalid.address);
  assert.ok(invalid.fulfillment);

  const valid = validateShopInput({
    name: 'Lakefront Sidama Roasters',
    description: 'Freshly roasted Grade-1 Sidama beans and tea packs.',
    phoneNumber: '0911234567',
    neighborhood: 'Piazza',
    address: 'Across from St. Gabriel Cathedral',
    deliveryAvailable: true,
    pickupAvailable: true,
  });
  assert.deepEqual(valid, {});
});

test('buildHomeCategories orders the 8 mobile home categories and merges missing seeds with Firestore overrides', () => {
  const sampleSeeds = HOME_CATEGORY_ORDER.map((slug, idx) => ({
    slug,
    name: slug,
    nameAm: slug,
    nameOm: slug,
    nameSid: slug,
    iconName: 'Package',
    displayOrder: idx + 1,
    isActive: true,
  }));
  const partialFirestoreCategories = sampleSeeds.slice(0, 6);
  const customExtra = {
    slug: 'books-stationery',
    name: 'Books',
    nameAm: 'መጽሐፍት',
    nameOm: 'Kitaabota',
    nameSid: 'Maxaaffa',
    iconName: 'Package',
    displayOrder: 20,
    isActive: true,
  };
  const ordered = buildHomeCategories([...partialFirestoreCategories, customExtra], sampleSeeds);
  assert.deepEqual(
    ordered.slice(0, 8).map((c) => c.slug),
    [...HOME_CATEGORY_ORDER]
  );
  assert.equal(ordered[8].slug, 'books-stationery');
});

test('isVerifiedMerchantShop returns true only for approved verified merchants', () => {
  assert.equal(isVerifiedMerchantShop({ status: 'approved', verificationStatus: 'approved' }), true);
  assert.equal(isVerifiedMerchantShop({ status: 'approved' }), true);
  assert.equal(isVerifiedMerchantShop({ status: 'approved', verificationStatus: 'pending_review' }), false);
  assert.equal(isVerifiedMerchantShop({ status: 'approved', verificationStatus: 'unverified' }), false);
  assert.equal(isVerifiedMerchantShop({ status: 'approved', verificationStatus: 'rejected' }), false);
  assert.equal(isVerifiedMerchantShop({ status: 'pending', verificationStatus: 'approved' }), false);
  assert.equal(isVerifiedMerchantShop({ status: 'suspended', verificationStatus: 'approved' }), false);
});

test('toggleUniqueId and mergeUniqueIds deduplicate favorite shop IDs accurately', () => {
  assert.deepEqual(toggleUniqueId(['shop-1', 'shop-1', ' '], 'shop-2'), ['shop-1', 'shop-2']);
  assert.deepEqual(toggleUniqueId(['shop-1', 'shop-2'], 'shop-1'), ['shop-2']);
  assert.deepEqual(toggleUniqueId(['shop-1'], ''), ['shop-1']);

  assert.deepEqual(
    mergeUniqueIds(['shop-2', 'shop-1'], ['shop-1', 'shop-3', '']),
    ['shop-2', 'shop-1', 'shop-3']
  );
});

test('filterShopsForDirectory filters shops by query, category, neighborhood, and verification rules', () => {
  const shopCoffee: Shop = {
    ...sampleShop,
    shopId: 'shop-1',
    name: 'Sidama Heritage Roasters',
    neighborhood: 'Piazza',
    status: 'approved',
  };
  const shopFashion: Shop = {
    ...sampleShop,
    shopId: 'shop-2',
    name: 'Tabor Handloom',
    description: 'Traditional cotton tibeb and netela',
    neighborhood: 'Tabor',
    status: 'approved',
  };
  const shopPending: Shop = {
    ...sampleShop,
    shopId: 'shop-3',
    name: 'Pending Lake Electronics',
    neighborhood: 'Menhariya',
    status: 'pending',
  };
  const shopSuspended: Shop = {
    ...sampleShop,
    shopId: 'shop-4',
    name: 'Suspended Store',
    neighborhood: 'Atote',
    status: 'suspended',
  };

  const allShops = [shopCoffee, shopFashion, shopPending, shopSuspended];
  const allProducts = [sampleProductA, sampleProductB];

  // Strict verification shows only approved shops
  assert.deepEqual(
    filterShopsForDirectory(allShops, allProducts, { strictShopVerification: true }).map((s) => s.shopId),
    ['shop-1', 'shop-2']
  );

  // Relaxed mode excludes suspended shops
  assert.deepEqual(
    filterShopsForDirectory(allShops, allProducts, { strictShopVerification: false }).map((s) => s.shopId),
    ['shop-1', 'shop-2', 'shop-3']
  );

  // Category filter inspects active products per shop
  assert.deepEqual(
    filterShopsForDirectory(allShops, allProducts, { categorySlug: 'clothing-fashion' }).map((s) => s.shopId),
    ['shop-2']
  );

  // Search matches shop name, neighborhood, and active product names
  assert.deepEqual(
    filterShopsForDirectory(allShops, allProducts, { searchQuery: 'cotton' }).map((s) => s.shopId),
    ['shop-2']
  );
  assert.deepEqual(
    filterShopsForDirectory(allShops, allProducts, { neighborhood: 'Piazza' }).map((s) => s.shopId),
    ['shop-1']
  );
});

test('reconcileCartWithCatalog detects live price changes, variant pricing, stock reductions, and unavailable products/shops', () => {
  const approvedShop: Shop = { ...sampleShop, shopId: 'shop-1', status: 'approved' };
  const suspendedShop: Shop = { ...sampleShop, shopId: 'shop-2', status: 'suspended' };

  const liveProductPriceChanged: Product = {
    ...sampleProductA,
    productId: 'prod-price',
    shopId: 'shop-1',
    price: 720,
    stock: 4,
    variants: [
      { id: 'v-1kg', label: '1kg Bag', price: 1380, stock: 2 },
    ],
  };

  const liveProductOutOfStock: Product = {
    ...sampleProductA,
    productId: 'prod-oos',
    shopId: 'shop-1',
    price: 500,
    stock: 0,
    isAvailable: false,
  };

  const liveProductSuspendedShop: Product = {
    ...sampleProductA,
    productId: 'prod-susp',
    shopId: 'shop-2',
    price: 900,
    stock: 5,
  };

  const cartItems: CartItem[] = [
    {
      product: { ...sampleProductA, productId: 'prod-price', price: 650, stock: 10 },
      quantity: 3, // exceeds live variant stock of 2
      shopId: 'shop-1',
      variantId: 'v-1kg',
      variantLabel: '1kg Bag',
      unitPrice: 1200,
    },
    {
      product: { ...sampleProductA, productId: 'prod-oos', price: 500, stock: 4 },
      quantity: 1,
      shopId: 'shop-1',
      unitPrice: 500,
    },
    {
      product: { ...sampleProductA, productId: 'prod-susp', price: 900, stock: 5 },
      quantity: 1,
      shopId: 'shop-2',
      unitPrice: 900,
    },
    {
      product: { ...sampleProductA, productId: 'prod-deleted', price: 400, stock: 2 },
      quantity: 1,
      shopId: 'shop-1',
      unitPrice: 400,
    },
  ];

  const result = reconcileCartWithCatalog(
    cartItems,
    [liveProductPriceChanged, liveProductOutOfStock, liveProductSuspendedShop],
    { 'shop-1': approvedShop, 'shop-2': suspendedShop },
    true
  );

  assert.equal(result.priceChangedCount, 1);
  assert.equal(result.stockIssueCount, 1);
  assert.equal(result.unavailableCount, 3); // prod-oos, prod-susp (suspended shop), prod-deleted
  assert.equal(result.hasBlockingIssues, true);

  const [variantEntry, oosEntry, suspEntry, deletedEntry] = result.entries;
  assert.equal(variantEntry.snapshotUnitPrice, 1200);
  assert.equal(variantEntry.liveUnitPrice, 1380);
  assert.equal(variantEntry.priceChanged, true);
  assert.equal(variantEntry.availableStock, 2);
  assert.equal(variantEntry.exceedsStock, true);
  assert.equal(variantEntry.isUnavailable, false);
  assert.equal(result.reconciledCart[0].unitPrice, 1380);

  assert.equal(oosEntry.isUnavailable, true);
  assert.equal(suspEntry.isUnavailable, true);
  assert.equal(deletedEntry.isUnavailable, true);
});

test('filterShopsForSearch filters by query, localized metadata, verification, rating, handoff, and ranks by relevance', () => {
  const shopRoasters: Shop = {
    ...sampleShop,
    shopId: 'shop-roasters',
    name: 'Coffee House Piazza',
    description: 'Freshly roasted beans and spices.',
    neighborhood: 'Piazza',
    rating: 4.9,
    reviewCount: 40,
    deliveryAvailable: true,
    pickupAvailable: true,
    status: 'approved',
    verificationStatus: 'approved',
    createdAt: '2026-02-01T00:00:00Z',
  };

  const shopPendingDocs: Shop = {
    ...sampleShop,
    shopId: 'shop-pending-docs',
    name: 'Hawassa Artisan Coffee',
    description: 'Local coffee blends near Tabor.',
    neighborhood: 'Tabor',
    rating: 4.6,
    reviewCount: 12,
    deliveryAvailable: false,
    pickupAvailable: true,
    status: 'approved',
    verificationStatus: 'pending_review',
    createdAt: '2026-03-01T00:00:00Z',
  };

  const shopDescriptionMatch: Shop = {
    ...sampleShop,
    shopId: 'shop-desc',
    name: 'Lakeview Roastery',
    description: 'Serving coffee and tea by Lake Hawassa.',
    neighborhood: 'Gebeya Dar',
    rating: 4.2,
    reviewCount: 8,
    deliveryAvailable: true,
    pickupAvailable: false,
    status: 'approved',
    verificationStatus: 'approved',
    createdAt: '2026-01-15T00:00:00Z',
  };

  const prodRoast: Product = {
    ...sampleProductA,
    productId: 'prod-roast-1',
    shopId: 'shop-roasters',
    name: 'Espresso Dark Roast',
    category: 'groceries',
  };
  const prodTabor: Product = {
    ...sampleProductB,
    productId: 'prod-tabor-1',
    shopId: 'shop-pending-docs',
    name: 'Yirga Blend',
    category: 'groceries',
  };
  const prodDescShop: Product = {
    ...sampleProductA,
    productId: 'prod-desc-1',
    shopId: 'shop-desc',
    name: 'Spiced Tea Tin',
    category: 'home-living',
  };

  const allShops = [shopDescriptionMatch, shopPendingDocs, shopRoasters];
  const allProducts = [prodRoast, prodTabor, prodDescShop];

  // Relevance: exact prefix/name match ("Coffee House Piazza") ranks ahead of substring name match ("Hawassa Artisan Coffee") and description match ("Lakeview Roastery")
  const relevanceOrder = filterShopsForSearch(allShops, allProducts, {
    searchQuery: 'coffee',
    sortBy: 'relevance',
  });
  assert.deepEqual(
    relevanceOrder.map((s) => s.shopId),
    ['shop-roasters', 'shop-pending-docs', 'shop-desc']
  );

  // verifiedOnly excludes approved shops whose document verificationStatus is pending_review
  const verifiedOnly = filterShopsForSearch(allShops, allProducts, {
    searchQuery: 'coffee',
    verifiedOnly: true,
  });
  assert.deepEqual(
    verifiedOnly.map((s) => s.shopId),
    ['shop-roasters', 'shop-desc']
  );

  // Localized neighborhood & category matching
  const localizedAreaMatch = filterShopsForSearch(allShops, allProducts, {
    searchQuery: 'Dikko Qarqara',
    localizedNeighborhoodByArea: { 'Gebeya Dar': 'Dikko Qarqara' },
  });
  assert.deepEqual(
    localizedAreaMatch.map((s) => s.shopId),
    ['shop-desc']
  );

  // Minimum rating, deliveryOnly, pickupOnly, and neighborhood filters
  assert.deepEqual(
    filterShopsForSearch(allShops, allProducts, {
      minRating: 4.5,
      pickupOnly: true,
      neighborhoods: ['Tabor'],
    }).map((s) => s.shopId),
    ['shop-pending-docs']
  );
  assert.deepEqual(
    filterShopsForSearch(allShops, allProducts, {
      deliveryOnly: true,
      category: 'home-living',
    }).map((s) => s.shopId),
    ['shop-desc']
  );
});

test('filterAndSortProducts supports relevance ranking, verifiedOnly, localized category/neighborhood matching, and active filter counts', () => {
  const verifiedShop: Shop = {
    ...sampleShop,
    shopId: 'shop-v',
    name: 'Sidama Coffee Roasters',
    neighborhood: 'Gebeya Dar',
    status: 'approved',
    verificationStatus: 'approved',
    rating: 4.8,
  };
  const unverifiedShop: Shop = {
    ...sampleShop,
    shopId: 'shop-u',
    name: 'Pending Roasters',
    neighborhood: 'Piazza',
    status: 'approved',
    verificationStatus: 'pending_review',
    rating: 4.9,
  };

  const exactProd: Product = {
    ...sampleProductA,
    productId: 'prod-exact',
    shopId: 'shop-v',
    name: 'Coffee Beans 500g',
    description: 'Single origin beans',
    category: 'groceries',
    rating: 4.6,
  };
  const descOnlyProd: Product = {
    ...sampleProductB,
    productId: 'prod-desc',
    shopId: 'shop-u',
    name: 'Clay Jebena Pot',
    description: 'Brew traditional coffee at home',
    category: 'home-living',
    rating: 5.0,
  };

  const shopsMap: Record<string, Shop> = {
    'shop-v': verifiedShop,
    'shop-u': unverifiedShop,
  };
  const products = [descOnlyProd, exactProd];

  const byRelevance = filterAndSortProducts(products, shopsMap, {
    searchQuery: 'coffee',
    sortBy: 'relevance',
  });
  assert.deepEqual(
    byRelevance.map((p) => p.productId),
    ['prod-exact', 'prod-desc']
  );

  const verifiedProducts = filterAndSortProducts(products, shopsMap, {
    searchQuery: 'coffee',
    verifiedOnly: true,
  });
  assert.deepEqual(
    verifiedProducts.map((p) => p.productId),
    ['prod-exact']
  );

  const localizedCatMatch = filterAndSortProducts(products, shopsMap, {
    searchQuery: 'መኖሪያ',
    categoryNamesBySlug: { 'home-living': 'የቤት እና መኖሪያ' },
    localizedNeighborhoodByArea: { 'Gebeya Dar': 'ገበያ ዳር' },
  });
  assert.deepEqual(
    localizedCatMatch.map((p) => p.productId),
    ['prod-desc']
  );

  assert.equal(countActiveSearchFilters({ sortBy: 'relevance', category: 'all', verifiedOnly: false }), 0);
  assert.equal(
    countActiveSearchFilters({
      category: 'groceries',
      verifiedOnly: true,
      minPrice: 100,
      sortBy: 'price_asc',
    }),
    4
  );
});

test('Product details helpers enforce data-backed badges, gallery deduplication, quantity bounds, and stock limits', () => {
  const gallery = buildProductGalleryImages({
    imageUrl: 'https://example.com/a.jpg',
    additionalImages: ['https://example.com/a.jpg', '', 'https://example.com/b.jpg'],
  });
  assert.deepEqual(gallery, ['https://example.com/a.jpg', 'https://example.com/b.jpg']);

  const verifiedShop: Shop = {
    ...sampleShop,
    shopId: 'shop-verified',
    status: 'approved',
    verificationStatus: 'approved',
    deliveryAvailable: true,
  };
  const unverifiedShop: Shop = {
    ...sampleShop,
    shopId: 'shop-unverified',
    status: 'approved',
    verificationStatus: 'pending_review',
    deliveryAvailable: false,
  };

  const organicCoffee: Product = {
    ...sampleProductA,
    name: 'Sidama Organic Coffee 250g',
    description: '100% natural highland beans.',
    deliveryAvailable: true,
  };
  assert.deepEqual(deriveProductBadges(organicCoffee, verifiedShop), {
    isOrganic: true,
    isVerified: true,
    hasFastDelivery: true,
  });

  const phoneAccessory: Product = {
    ...sampleProductB,
    name: 'USB-C Fast Charger',
    description: 'Durable braided charging cable.',
    deliveryAvailable: true,
  };
  assert.deepEqual(deriveProductBadges(phoneAccessory, unverifiedShop), {
    isOrganic: false,
    isVerified: false,
    hasFastDelivery: false,
  });

  assert.equal(clampProductQuantity(0, 10), 1);
  assert.equal(clampProductQuantity(-4, 10), 1);
  assert.equal(clampProductQuantity(15, 6), 6);
  assert.equal(clampProductQuantity(3, 0), 1);

  const validAdd = validateAddToCartRequest({
    product: { isAvailable: true, status: 'active', stock: 5 },
    shop: verifiedShop,
    quantity: 2,
    existingCartQty: 1,
  });
  assert.equal(validAdd.allowed, true);
  assert.equal(validAdd.maxAllowedToAdd, 4);

  const exceedsCartLimit = validateAddToCartRequest({
    product: { isAvailable: true, status: 'active', stock: 5 },
    shop: verifiedShop,
    quantity: 3,
    existingCartQty: 4,
  });
  assert.equal(exceedsCartLimit.allowed, false);
  assert.equal(exceedsCartLimit.errorKey, 'stockLimitReached');
  assert.equal(exceedsCartLimit.maxAllowedToAdd, 1);

  const fullInCart = validateAddToCartRequest({
    product: { isAvailable: true, status: 'active', stock: 5 },
    shop: verifiedShop,
    quantity: 1,
    existingCartQty: 5,
  });
  assert.equal(fullInCart.allowed, false);
  assert.equal(fullInCart.errorKey, 'maxCartStockReached');

  const unavailableProd = validateAddToCartRequest({
    product: { isAvailable: false, status: 'active', stock: 5 },
    shop: verifiedShop,
    quantity: 1,
    existingCartQty: 0,
  });
  assert.equal(unavailableProd.allowed, false);
  assert.equal(unavailableProd.errorKey, 'productUnavailableError');
});

test('Checkout step gating, truthful payment status resolution, receipt sanitization, and progress helpers work accurately', () => {
  // Payment status truthfulness: only verified electronic payments start as paid
  assert.equal(
    resolveInitialOrderPaymentStatus({ paymentMethod: 'telebirr', serverVerifiedPaid: false }),
    'pending'
  );
  assert.equal(
    resolveInitialOrderPaymentStatus({ paymentMethod: 'telebirr', serverVerifiedPaid: undefined }),
    'pending'
  );
  assert.equal(
    resolveInitialOrderPaymentStatus({ paymentMethod: 'cbe_birr', serverVerifiedPaid: false }),
    'pending'
  );
  assert.equal(
    resolveInitialOrderPaymentStatus({ paymentMethod: 'chapa', serverVerifiedPaid: true }),
    'paid'
  );
  assert.equal(
    resolveInitialOrderPaymentStatus({ paymentMethod: 'cash_on_delivery', serverVerifiedPaid: true }),
    'pending'
  );
  assert.equal(
    resolveInitialOrderPaymentStatus({ paymentMethod: 'pay_at_pickup', serverVerifiedPaid: true }),
    'pending'
  );

  // Checkout 3-step gating prevents skipping mandatory steps while allowing backward navigation
  assert.equal(
    canNavigateToCheckoutStep({ targetStep: 1, isStep1Valid: false, step2Confirmed: false }),
    true
  );
  assert.equal(
    canNavigateToCheckoutStep({ targetStep: 2, isStep1Valid: false, step2Confirmed: false }),
    false
  );
  assert.equal(
    canNavigateToCheckoutStep({ targetStep: 2, isStep1Valid: true, step2Confirmed: false }),
    true
  );
  assert.equal(
    canNavigateToCheckoutStep({ targetStep: 3, isStep1Valid: true, step2Confirmed: false }),
    false
  );
  assert.equal(
    canNavigateToCheckoutStep({ targetStep: 3, isStep1Valid: true, step2Confirmed: true }),
    true
  );

  // Financial receipt builder excludes sensitive PINs/OTPs and preserves accurate line totals
  const paidOrder: Order = {
    orderId: 'ord-20261118-9a4f',
    customerUid: 'buyer-1',
    customerName: 'Selamawit Bekele',
    customerPhone: '+251911223344',
    shopId: 'shop-1',
    shopName: 'Sidama Coffee House',
    neighborhood: 'Piazza',
    items: [
      {
        productId: 'prod-a',
        name: 'Sidama Coffee 250g',
        price: 170,
        quantity: 2,
        imageUrl: '/coffee.jpg',
        variantLabel: '250g Whole Bean',
      },
    ],
    subtotal: 340,
    deliveryFee: 30,
    promoCode: 'HAWASSA10',
    promoDiscountAmount: 34,
    pointsRedeemed: 20,
    pointsDiscountAmount: 20,
    discountAmount: 54,
    totalAmount: 316,
    currency: 'ETB',
    fulfillmentMethod: 'delivery',
    paymentMethod: 'telebirr',
    paymentStatus: 'paid',
    paymentReference: 'TB-VERIFIED-9012',
    deliveryPin: '4829',
    orderStatus: 'pending',
    createdAt: '2026-11-18T09:45:00.000Z',
    updatedAt: '2026-11-18T09:45:00.000Z',
  };

  assert.equal(formatReceiptNumber(paidOrder), 'AC2026111809459A4F');
  assert.equal(formatOrderReference(paidOrder.orderId), '#2611189A4F'.slice(0, 1) + '02611189A4F'.slice(-8));
  assert.equal(formatPaymentMethodDisplay('telebirr'), 'Telebirr');
  assert.equal(formatPaymentMethodDisplay('cbe_birr'), 'CBE');

  const receipt = buildFinancialReceiptData(paidOrder, sampleShop);
  assert.equal(receipt.receiptNumber, 'AC2026111809459A4F');
  assert.equal(receipt.bannerTone, 'paid');
  assert.equal(receipt.merchantName, 'Sidama Heritage Roasters');
  assert.equal(receipt.items[0].lineTotal, 340);
  assert.equal(receipt.totalDiscountAmount, 54);
  assert.equal(receipt.totalAmount, 316);
  assert.equal(receipt.paymentReference, 'TB-VERIFIED-9012');
  assert.equal('deliveryPin' in receipt, false);
  assert.equal('pin' in receipt, false);
  assert.equal(JSON.stringify(receipt).includes('4829'), false);

  const pendingReceipt = buildFinancialReceiptData({
    ...paidOrder,
    paymentStatus: 'pending',
    paymentReference: 'TB-PENDING-001',
  });
  assert.equal(pendingReceipt.bannerTone, 'pending');

  // Tailwind progress width classes
  assert.equal(getTailwindWidthClass(0), 'w-0');
  assert.equal(getTailwindWidthClass(25), 'w-1/4');
  assert.equal(getTailwindWidthClass(50), 'w-1/2');
  assert.equal(getTailwindWidthClass(75), 'w-3/4');
  assert.equal(getTailwindWidthClass(100), 'w-full');
});

test('Seller shop scoping, active seller shop resolution, and friendly error formatting prevent cross-owner product upload errors', () => {
  const seedShop: Shop = { ...sampleShop, shopId: 'shop-seed-1', ownerUid: 'seed-seller-1', name: 'Seed Shop' };
  const sellerOwnedShop: Shop = { ...sampleShop, shopId: 'shop-user-1', ownerUid: 'uid-seller-abc', name: 'Abebe Coffee' };
  const otherSellerShop: Shop = { ...sampleShop, shopId: 'shop-user-2', ownerUid: 'uid-other', name: 'Other Coffee' };
  const allShops = [seedShop, sellerOwnedShop, otherSellerShop];

  // Non-admin authenticated seller sees only their owned shops
  const sellerScoped = resolveSellerManagedShops(allShops, 'uid-seller-abc', false);
  assert.deepEqual(sellerScoped.map((s) => s.shopId), ['shop-user-1']);

  // Seller with no shops gets empty array rather than seed shop
  assert.equal(resolveSellerManagedShops(allShops, 'uid-brand-new', false).length, 0);

  // Admin supervision mode sees all shops
  assert.equal(resolveSellerManagedShops(allShops, 'uid-seller-abc', true).length, 3);

  // Active seller shop auto-switches off SEED_SHOPS[0] onto seller's own shop
  assert.equal(
    resolveActiveSellerShopId({
      shops: allShops,
      currentShopId: 'shop-seed-1',
      userUid: 'uid-seller-abc',
      isAdminMode: false,
    }),
    'shop-user-1'
  );

  // Keeps valid current owned shop if already selected
  assert.equal(
    resolveActiveSellerShopId({
      shops: allShops,
      currentShopId: 'shop-user-1',
      userUid: 'uid-seller-abc',
      isAdminMode: false,
    }),
    'shop-user-1'
  );

  // Returns empty string for seller with no owned shop yet (triggers shop creation onboarding)
  assert.equal(
    resolveActiveSellerShopId({
      shops: allShops,
      currentShopId: 'shop-seed-1',
      userUid: 'uid-brand-new',
      isAdminMode: false,
    }),
    ''
  );

  // Admin can keep inspecting any shop
  assert.equal(
    resolveActiveSellerShopId({
      shops: allShops,
      currentShopId: 'shop-seed-1',
      userUid: 'uid-admin',
      isAdminMode: true,
    }),
    'shop-seed-1'
  );

  // Friendly error parser converts raw JSON FirestoreErrorInfo into clear guidance
  const rawPermJson = JSON.stringify({
    error: '7 PERMISSION_DENIED: Missing or insufficient permissions.',
    operationType: 'write',
    path: 'products/prod-123',
  });
  const friendlyPerm = formatFriendlyErrorMessage(new Error(rawPermJson), 'Fallback');
  assert.ok(friendlyPerm.includes('Permission denied by Firestore security rules'));
  assert.equal(friendlyPerm.includes('operationType'), false);

  assert.equal(formatFriendlyErrorMessage(new Error('Plain upload error'), 'Fallback'), 'Plain upload error');
  assert.equal(formatFriendlyErrorMessage(null, 'Fallback message'), 'Fallback message');
});
