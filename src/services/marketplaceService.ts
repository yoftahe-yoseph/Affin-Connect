import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { SEED_CATEGORIES, SEED_PRODUCTS, SEED_REVIEWS, SEED_SHOPS } from '../data/seedData';
import { MAX_IMAGE_UPLOAD_DATA_URL_LENGTH } from '../utils/imageUpload';
import type {
  AccountStatus,
  AdminAuditLog,
  Category,
  CustomerAddress,
  LoyaltyTransaction,
  MarketplaceGovernanceConfig,
  MerchantVerification,
  NotificationItem,
  Order,
  OrderStatus,
  PaymentStatus,
  PriceAlert,
  Product,
  ReturnRequest,
  ReturnRequestStatus,
  ReviewItem,
  SharedWishlist,
  Shop,
  TradeChatMessage,
  TradeChatThread,
  UserProfile,
  UserRole,
} from '../types';

export async function seedCatalogToFirestore(isAdminUser: boolean): Promise<{ seeded: boolean; count: number }> {
  try {
    const existingShopsSnap = await getDocs(collection(db, 'shops'));
    if (!existingShopsSnap.empty) {
      return { seeded: false, count: existingShopsSnap.size };
    }

    const batch = writeBatch(db);
    for (const shop of SEED_SHOPS) {
      batch.set(doc(db, 'shops', shop.shopId), shop);
    }
    for (const prod of SEED_PRODUCTS) {
      batch.set(doc(db, 'products', prod.productId), prod);
    }
    if (isAdminUser) {
      for (const cat of SEED_CATEGORIES) {
        batch.set(doc(db, 'categories', cat.slug), cat);
      }
    }
    await batch.commit();
    return { seeded: true, count: SEED_SHOPS.length + SEED_PRODUCTS.length };
  } catch (error) {
    console.warn('Firestore auto-seed skipped or deferred:', error);
    return { seeded: false, count: 0 };
  }
}

export function subscribeToShops(
  onUpdate: (shops: Shop[]) => void,
  onFallback?: () => void
): Unsubscribe {
  const seedShopById = new Map(SEED_SHOPS.map((s) => [s.shopId, s]));
  return onSnapshot(
    collection(db, 'shops'),
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate(SEED_SHOPS);
        onFallback?.();
      } else {
        const list = snapshot.docs.map((d) => {
          const data = d.data() as Shop;
          const seed = seedShopById.get(data.shopId);
          return seed
            ? {
                ...data,
                traderType: data.traderType ?? seed.traderType,
              }
            : data;
        });
        onUpdate(list);
      }
    },
    (error) => {
      console.warn('Shops listener fallback to local catalog:', error.message);
      onUpdate(SEED_SHOPS);
    }
  );
}

export function subscribeToProducts(
  onUpdate: (products: Product[]) => void
): Unsubscribe {
  const seedById = new Map(SEED_PRODUCTS.map((sp) => [sp.productId, sp]));
  return onSnapshot(
    collection(db, 'products'),
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate(SEED_PRODUCTS);
      } else {
        const list = snapshot.docs.map((d) => {
          const data = d.data() as Product;
          const seed = seedById.get(data.productId);
          return seed
            ? {
                ...data,
                category:
                  seed.category === 'coffee' && data.category === 'groceries'
                    ? 'coffee'
                    : data.category,
                variants: data.variants ?? seed.variants,
                additionalImages: data.additionalImages ?? seed.additionalImages,
                coffeeDetails: data.coffeeDetails ?? seed.coffeeDetails,
              }
            : data;
        });
        onUpdate(list);
      }
    },
    (error) => {
      console.warn('Products listener fallback to local catalog:', error.message);
      onUpdate(SEED_PRODUCTS);
    }
  );
}

export async function fetchCatalogSnapshotFromFirestore(): Promise<{
  shops: Shop[];
  products: Product[];
}> {
  const seedShopById = new Map(SEED_SHOPS.map((s) => [s.shopId, s]));
  const seedById = new Map(SEED_PRODUCTS.map((sp) => [sp.productId, sp]));
  const [shopsSnap, productsSnap] = await Promise.all([
    getDocs(collection(db, 'shops')),
    getDocs(collection(db, 'products')),
  ]);

  const shops = shopsSnap.empty
    ? SEED_SHOPS
    : shopsSnap.docs.map((d) => {
        const data = d.data() as Shop;
        const seed = seedShopById.get(data.shopId);
        return seed
          ? {
              ...data,
              traderType: data.traderType ?? seed.traderType,
            }
          : data;
      });

  const products = productsSnap.empty
    ? SEED_PRODUCTS
    : productsSnap.docs.map((d) => {
        const data = d.data() as Product;
        const seed = seedById.get(data.productId);
        return seed
          ? {
              ...data,
              category:
                seed.category === 'coffee' && data.category === 'groceries'
                  ? 'coffee'
                  : data.category,
              variants: data.variants ?? seed.variants,
              additionalImages: data.additionalImages ?? seed.additionalImages,
              coffeeDetails: data.coffeeDetails ?? seed.coffeeDetails,
            }
          : data;
      });

  return { shops, products };
}

export function subscribeToCategories(
  onUpdate: (categories: Category[]) => void
): Unsubscribe {
  const seedBySlug = new Map(SEED_CATEGORIES.map((c) => [c.slug, c]));
  return onSnapshot(
    query(collection(db, 'categories'), orderBy('displayOrder', 'asc')),
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate(SEED_CATEGORIES);
      } else {
        const cloudCategories = snapshot.docs.map((d) => {
          const raw = d.data() as Category;
          const seed = seedBySlug.get(raw.slug);
          return {
            ...seed,
            ...raw,
            nameAm: raw.nameAm || seed?.nameAm || raw.name,
            nameOm: raw.nameOm || seed?.nameOm || raw.name,
            nameSid: raw.nameSid || seed?.nameSid || raw.name,
          };
        });
        const cloudSlugs = new Set(cloudCategories.map((c) => c.slug));
        const merged = [
          ...cloudCategories,
          ...SEED_CATEGORIES.filter((seed) => !cloudSlugs.has(seed.slug)),
        ].sort((a, b) => a.displayOrder - b.displayOrder);
        onUpdate(merged);
      }
    },
    () => {
      onUpdate(SEED_CATEGORIES);
    }
  );
}

export function subscribeToReviews(
  onUpdate: (reviews: ReviewItem[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'reviews'),
    (snapshot) => {
      const cloudReviews = snapshot.docs.map((d) => d.data() as ReviewItem);
      const cloudIds = new Set(cloudReviews.map((r) => r.reviewId));
      const merged = [
        ...cloudReviews,
        ...SEED_REVIEWS.filter((sr) => !cloudIds.has(sr.reviewId)),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(merged);
    },
    (error) => {
      console.warn('Reviews listener fallback to seed reviews:', error.message);
      onUpdate(SEED_REVIEWS);
    }
  );
}

export function subscribeToUserOrders(
  uid: string,
  onUpdate: (orders: Order[]) => void
): Unsubscribe {
  const q = query(collection(db, 'orders'), where('customerUid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => d.data() as Order)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn('User orders listener notice:', error.message);
      onUpdate([]);
    }
  );
}

export function subscribeToShopOrders(
  shopId: string,
  onUpdate: (orders: Order[]) => void,
  shopOwnerUid?: string
): Unsubscribe {
  const q = shopOwnerUid
    ? query(collection(db, 'orders'), where('shopOwnerUid', '==', shopOwnerUid))
    : query(collection(db, 'orders'), where('shopId', '==', shopId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => d.data() as Order)
        .filter((o) => o.shopId === shopId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn('Shop orders listener notice:', error.message);
      onUpdate([]);
    }
  );
}

export function subscribeToUserAddresses(
  uid: string,
  onUpdate: (addresses: CustomerAddress[]) => void
): Unsubscribe {
  const q = query(collection(db, 'addresses'), where('customerUid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as CustomerAddress);
      onUpdate(list);
    },
    (error) => {
      console.warn('Addresses listener notice:', error.message);
      onUpdate([]);
    }
  );
}

export function subscribeToUserNotifications(
  uid: string,
  onUpdate: (notifications: NotificationItem[]) => void
): Unsubscribe {
  const q = query(collection(db, 'notifications'), where('userUid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => d.data() as NotificationItem)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn('Notifications listener notice:', error.message);
      onUpdate([]);
    }
  );
}

export function subscribeToUserLoyaltyTransactions(
  uid: string,
  onUpdate: (transactions: LoyaltyTransaction[]) => void
): Unsubscribe {
  const q = query(collection(db, 'loyalty_transactions'), where('customerUid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => d.data() as LoyaltyTransaction)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn('Loyalty transactions listener notice:', error.message);
      onUpdate([]);
    }
  );
}

export async function createOrderInFirestore(order: Order): Promise<void> {
  try {
    await setDoc(doc(db, 'orders', order.orderId), order);

    // Create notification for the customer
    const notif: NotificationItem = {
      notificationId: `notif-${Date.now()}`,
      userUid: order.customerUid,
      title: 'Order Placed',
      message: `Your order #${order.orderId.slice(-6).toUpperCase()} at ${order.shopName} (${order.totalAmount.toLocaleString()} ETB) is awaiting shop confirmation.`,
      type: 'order_status',
      orderId: order.orderId,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'notifications', notif.notificationId), notif);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `orders/${order.orderId}`);
  }
}

export async function saveOrderWithLoyaltyInFirestore(
  order: Order,
  loyaltyTransactions: LoyaltyTransaction[],
  nextBalance: number,
  nextLifetime: number
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'orders', order.orderId), order);

    for (const tx of loyaltyTransactions) {
      const sanitizedTx: LoyaltyTransaction = {
        ...tx,
        shopName: tx.shopName.trim().slice(0, 120) || 'Hawassa Shop',
        points: Math.round(tx.points),
        orderAmountEtb: Math.max(0, Math.round(tx.orderAmountEtb)),
        description: tx.description.trim().slice(0, 240) || 'Loyalty update',
      };
      batch.set(doc(db, 'loyalty_transactions', sanitizedTx.transactionId), sanitizedTx);
    }

    batch.set(
      doc(db, 'users', order.customerUid),
      {
        loyaltyPoints: Math.max(0, Math.round(nextBalance)),
        lifetimeLoyaltyPoints: Math.max(0, Math.round(nextLifetime)),
        updatedAt: order.updatedAt,
      },
      { merge: true }
    );

    const earnedNote =
      order.pointsEarned && order.pointsEarned > 0
        ? ` You earned +${order.pointsEarned} Hawasa Rewards pts.`
        : '';
    const notif: NotificationItem = {
      notificationId: `notif-${Date.now()}`,
      userUid: order.customerUid,
      title: 'Order Placed',
      message: `Your order #${order.orderId.slice(-6).toUpperCase()} at ${order.shopName} (${order.totalAmount.toLocaleString()} ETB) is awaiting shop confirmation.${earnedNote}`,
      type: 'order_status',
      orderId: order.orderId,
      isRead: false,
      createdAt: order.createdAt,
    };
    batch.set(doc(db, 'notifications', notif.notificationId), notif);

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `orders/${order.orderId}`);
  }
}

export async function recordLoyaltyTransactionsInFirestore(
  uid: string,
  loyaltyTransactions: LoyaltyTransaction[],
  nextBalance: number,
  nextLifetime: number
): Promise<void> {
  if (loyaltyTransactions.length === 0) return;
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const tx of loyaltyTransactions) {
      const sanitizedTx: LoyaltyTransaction = {
        ...tx,
        shopName: tx.shopName.trim().slice(0, 120) || 'Hawassa Shop',
        points: Math.round(tx.points),
        orderAmountEtb: Math.max(0, Math.round(tx.orderAmountEtb)),
        description: tx.description.trim().slice(0, 240) || 'Loyalty update',
      };
      batch.set(doc(db, 'loyalty_transactions', sanitizedTx.transactionId), sanitizedTx);
    }
    batch.set(
      doc(db, 'users', uid),
      {
        loyaltyPoints: Math.max(0, Math.round(nextBalance)),
        lifetimeLoyaltyPoints: Math.max(0, Math.round(nextLifetime)),
        updatedAt: now,
      },
      { merge: true }
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'loyalty_transactions');
  }
}

export async function updateOrderStatusInFirestore(
  orderId: string,
  newStatus: OrderStatus,
  customerUid: string,
  shopName: string,
  rejectionReason?: string,
  paymentStatus?: PaymentStatus
): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      orderStatus: newStatus,
      updatedAt: new Date().toISOString(),
    };
    if (rejectionReason) {
      payload.rejectionReason = rejectionReason;
    }
    if (paymentStatus) {
      payload.paymentStatus = paymentStatus;
    }
    await updateDoc(doc(db, 'orders', orderId), payload);

    const notif: NotificationItem = {
      notificationId: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userUid: customerUid,
      title: `Order ${newStatus.replace(/_/g, ' ')}`,
      message: rejectionReason
        ? `${shopName} rejected order #${orderId.slice(-6).toUpperCase()}: ${rejectionReason}`
        : `${shopName} updated your order #${orderId.slice(-6).toUpperCase()} to "${newStatus.replace(/_/g, ' ')}".`,
      type: 'order_status',
      orderId,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'notifications', notif.notificationId), notif);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
  }
}

export async function updateOrderPaymentInFirestore(
  orderId: string,
  paymentStatus: PaymentStatus,
  paymentReference?: string
): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      paymentStatus,
      updatedAt: new Date().toISOString(),
    };
    if (paymentReference) {
      payload.paymentReference = paymentReference;
    }
    await updateDoc(doc(db, 'orders', orderId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
  }
}

export async function saveAddressInFirestore(address: CustomerAddress): Promise<void> {
  try {
    await setDoc(doc(db, 'addresses', address.addressId), address);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `addresses/${address.addressId}`);
  }
}

export async function deleteAddressInFirestore(addressId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'addresses', addressId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `addresses/${addressId}`);
  }
}

function stripUndefinedProps<T extends object>(record: T): T {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const nested = stripUndefinedProps(value as Record<string, unknown>);
      if (Object.keys(nested).length > 0) {
        clean[key] = nested;
      }
    } else {
      clean[key] = value;
    }
  }
  return clean as T;
}

export interface CoffeeMigrationApiSummary {
  dryRun: boolean;
  scanned: number;
  alreadyCategorized: number;
  eligible: number;
  updated: number;
  skipped: number;
  ambiguous: number;
  failed: { productId: string; error: string }[];
  changes: {
    productId: string;
    name: string;
    previousCategory: string;
    nextCategory: string;
    reason: string;
  }[];
}

export class ProductCategorizationApiError extends Error {
  code: string;
  status: number;
  categorization?: import('../utils/coffeeCategorizer').CoffeeCategorizationResult;

  constructor(
    message: string,
    code: string,
    status: number,
    categorization?: import('../utils/coffeeCategorizer').CoffeeCategorizationResult
  ) {
    super(message);
    this.name = 'ProductCategorizationApiError';
    this.code = code;
    this.status = status;
    this.categorization = categorization;
  }
}

export async function saveProductViaBackendApi(
  product: Product,
  idToken: string,
  options: {
    mode: 'create' | 'update';
    categoryConfirmed?: boolean;
    confirmedCategory?: string;
  }
): Promise<{
  product: Product;
  categorization: import('../utils/coffeeCategorizer').CoffeeCategorizationResult;
}> {
  const endpoint =
    options.mode === 'update'
      ? `/api/products/${encodeURIComponent(product.productId)}`
      : '/api/products';
  const method = options.mode === 'update' ? 'PUT' : 'POST';

  const cleanProduct = stripUndefinedProps(product);
  const res = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      ...cleanProduct,
      ...(options.categoryConfirmed ? { categoryConfirmed: true } : {}),
      ...(options.confirmedCategory ? { confirmedCategory: options.confirmedCategory } : {}),
    }),
  });

  let data: {
    product?: Product;
    categorization?: import('../utils/coffeeCategorizer').CoffeeCategorizationResult;
    code?: string;
    error?: string;
  } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    // ignore malformed JSON
  }

  if (!res.ok || !data.product || !data.categorization) {
    throw new ProductCategorizationApiError(
      data.error || `Unable to save product (HTTP ${res.status}).`,
      data.code || 'PRODUCT_SAVE_FAILED',
      res.status,
      data.categorization
    );
  }

  return {
    product: data.product,
    categorization: data.categorization,
  };
}

export async function runCoffeeProductMigrationViaApi(
  idToken: string,
  dryRun: boolean = false
): Promise<CoffeeMigrationApiSummary> {
  const res = await fetch('/api/products/migrate-coffee', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ dryRun }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<CoffeeMigrationApiSummary> & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `Coffee migration failed (HTTP ${res.status}).`);
  }
  return {
    dryRun: Boolean(data.dryRun),
    scanned: data.scanned ?? 0,
    alreadyCategorized: data.alreadyCategorized ?? 0,
    eligible: data.eligible ?? 0,
    updated: data.updated ?? 0,
    skipped: data.skipped ?? 0,
    ambiguous: data.ambiguous ?? 0,
    failed: data.failed ?? [],
    changes: data.changes ?? [],
  };
}

export async function saveProductInFirestore(product: Product): Promise<void> {
  try {
    const cleanProduct = stripUndefinedProps(product);
    await setDoc(doc(db, 'products', cleanProduct.productId), cleanProduct);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `products/${product.productId}`);
  }
}

export async function saveShopInFirestore(shop: Shop): Promise<void> {
  try {
    const cleanShop = stripUndefinedProps(shop);
    await setDoc(doc(db, 'shops', cleanShop.shopId), cleanShop);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `shops/${shop.shopId}`);
  }
}

export async function updateShopStatusInFirestore(
  shopId: string,
  status: 'approved' | 'suspended' | 'pending'
): Promise<void> {
  try {
    await updateDoc(doc(db, 'shops', shopId), {
      status,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `shops/${shopId}`);
  }
}

export async function submitReviewInFirestore(review: ReviewItem): Promise<void> {
  try {
    const payload: ReviewItem = {
      ...review,
      comment: review.comment.trim().slice(0, 500),
      ...(review.shopRating != null ? { shopRating: review.shopRating } : {}),
      ...(review.shopComment?.trim() ? { shopComment: review.shopComment.trim().slice(0, 500) } : {}),
    };
    await setDoc(doc(db, 'reviews', review.reviewId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `reviews/${review.reviewId}`);
  }
}

export async function updateReviewInFirestore(
  reviewId: string,
  rating: number,
  comment: string,
  updatedAt: string,
  shopRating?: number,
  shopComment?: string
): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      rating,
      comment: comment.trim().slice(0, 500),
      updatedAt,
    };
    if (shopRating != null) {
      payload.shopRating = shopRating;
    }
    if (shopComment !== undefined) {
      const cleanShopComment = shopComment.trim().slice(0, 500);
      payload.shopComment = cleanShopComment || deleteField();
    }
    await updateDoc(doc(db, 'reviews', reviewId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `reviews/${reviewId}`);
  }
}

export async function deleteReviewInFirestore(reviewId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'reviews', reviewId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `reviews/${reviewId}`);
  }
}

export async function markNotificationReadInFirestore(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function saveUserProfileInFirestore(profile: UserProfile): Promise<void> {
  try {
    const normalizedProfile: UserProfile = {
      ...profile,
      email: profile.email ? profile.email.trim().toLowerCase() : '',
    };
    await setDoc(doc(db, 'users', normalizedProfile.uid), normalizedProfile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
  }
}

export async function saveCategoryInFirestore(category: Category): Promise<void> {
  try {
    await setDoc(doc(db, 'categories', category.slug), category);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `categories/${category.slug}`);
  }
}

export async function saveSharedWishlistInFirestore(wishlist: SharedWishlist): Promise<void> {
  try {
    const sanitized: SharedWishlist = {
      ...wishlist,
      ownerName: wishlist.ownerName.trim().slice(0, 100) || 'Hawassa Shopper',
      title: wishlist.title.trim().slice(0, 120) || 'My Hawassa Favorites',
      productIds: wishlist.productIds.slice(0, 50),
    };
    await setDoc(doc(db, 'shared_wishlists', sanitized.shareId), sanitized);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `shared_wishlists/${wishlist.shareId}`);
  }
}

export async function getSharedWishlistFromFirestore(
  shareId: string
): Promise<SharedWishlist | null> {
  try {
    const snap = await getDoc(doc(db, 'shared_wishlists', shareId));
    if (!snap.exists()) return null;
    return snap.data() as SharedWishlist;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `shared_wishlists/${shareId}`);
  }
}

export function subscribeToUserReturnRequests(
  uid: string,
  onUpdate: (requests: ReturnRequest[]) => void
): Unsubscribe {
  const q = query(collection(db, 'return_requests'), where('customerUid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => d.data() as ReturnRequest)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn('Return requests listener notice:', error.message);
      onUpdate([]);
    }
  );
}

export async function submitReturnRequestInFirestore(
  request: ReturnRequest
): Promise<void> {
  try {
    if (request.photoDataUrl && request.photoDataUrl.length > MAX_IMAGE_UPLOAD_DATA_URL_LENGTH) {
      throw new Error('Damage photo exceeds 150 KB safe limit.');
    }
    const sanitized: ReturnRequest = {
      returnId: request.returnId.trim().slice(0, 128),
      orderId: request.orderId.trim().slice(0, 128),
      productId: request.productId.trim().slice(0, 128),
      productName: request.productName.trim().slice(0, 140) || 'Product',
      ...(request.variantLabel ? { variantLabel: request.variantLabel.trim().slice(0, 80) } : {}),
      shopId: request.shopId.trim().slice(0, 128),
      shopName: request.shopName.trim().slice(0, 120) || 'Hawassa Shop',
      customerUid: request.customerUid.trim().slice(0, 128),
      customerName: request.customerName.trim().slice(0, 100) || 'Hawassa Shopper',
      requestType: request.requestType,
      reason: request.reason,
      details: request.details.trim().slice(0, 600),
      ...(request.photoDataUrl ? { photoDataUrl: request.photoDataUrl } : {}),
      status: 'requested',
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };

    await setDoc(doc(db, 'return_requests', sanitized.returnId), sanitized);

    const notif: NotificationItem = {
      notificationId: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userUid: sanitized.customerUid,
      title: sanitized.requestType === 'exchange' ? 'Exchange Requested' : 'Return Requested',
      message: `Your ${sanitized.requestType} request for ${sanitized.productName} (#${sanitized.orderId
        .slice(-6)
        .toUpperCase()}) has been sent to ${sanitized.shopName}.`.slice(0, 500),
      type: 'order_status',
      orderId: sanitized.orderId,
      isRead: false,
      createdAt: sanitized.createdAt,
    };
    await setDoc(doc(db, 'notifications', notif.notificationId), notif);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `return_requests/${request.returnId}`);
  }
}

export function subscribeToUserPriceAlerts(
  uid: string,
  onUpdate: (alerts: PriceAlert[]) => void
): Unsubscribe {
  const q = query(collection(db, 'price_alerts'), where('customerUid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => d.data() as PriceAlert)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn('Price alerts listener notice:', error.message);
      onUpdate([]);
    }
  );
}

export async function savePriceAlertInFirestore(alert: PriceAlert): Promise<void> {
  try {
    const sanitized: PriceAlert = {
      alertId: alert.alertId.trim().slice(0, 128),
      productId: alert.productId.trim().slice(0, 128),
      productName: alert.productName.trim().slice(0, 140) || 'Product',
      ...(alert.productImageUrl
        ? { productImageUrl: alert.productImageUrl.trim().slice(0, 500) }
        : {}),
      shopId: alert.shopId.trim().slice(0, 128),
      shopName: alert.shopName.trim().slice(0, 120) || 'Hawassa Shop',
      customerUid: alert.customerUid.trim().slice(0, 128),
      baselinePrice: Math.max(1, Math.round(alert.baselinePrice)),
      targetPrice: Math.max(1, Math.round(alert.targetPrice)),
      pushEnabled: Boolean(alert.pushEnabled),
      status: alert.status,
      ...(alert.triggeredAt ? { triggeredAt: alert.triggeredAt } : {}),
      ...(alert.triggeredPrice != null
        ? { triggeredPrice: Math.max(0, Math.round(alert.triggeredPrice)) }
        : {}),
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    };
    await setDoc(doc(db, 'price_alerts', sanitized.alertId), sanitized);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `price_alerts/${alert.alertId}`);
  }
}

export async function deletePriceAlertInFirestore(alertId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'price_alerts', alertId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `price_alerts/${alertId}`);
  }
}

export async function saveNotificationInFirestore(notification: NotificationItem): Promise<void> {
  try {
    await setDoc(doc(db, 'notifications', notification.notificationId), notification);
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `notifications/${notification.notificationId}`
    );
  }
}

export function subscribeToMarketplaceConfig(
  onUpdate: (config: MarketplaceGovernanceConfig | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'marketplace_config', 'global'),
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as MarketplaceGovernanceConfig);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.warn('Marketplace config listener fallback:', error.message);
      onUpdate(null);
    }
  );
}

export async function saveMarketplaceConfigInFirestore(
  config: MarketplaceGovernanceConfig
): Promise<void> {
  try {
    const cleanBanner = config.maintenanceBanner?.trim().slice(0, 300);
    const payload: MarketplaceGovernanceConfig = {
      configId: config.configId.trim().slice(0, 128) || 'global',
      deliveryFeeEtb: Math.min(50000, Math.max(0, Math.round(config.deliveryFeeEtb))),
      freeDeliveryThresholdEtb: Math.min(
        1000000,
        Math.max(0, Math.round(config.freeDeliveryThresholdEtb))
      ),
      maxOrderAmountEtb: Math.min(10000000, Math.max(100, Math.round(config.maxOrderAmountEtb))),
      orderingPaused: Boolean(config.orderingPaused),
      ...(cleanBanner ? { maintenanceBanner: cleanBanner } : {}),
      strictShopVerification: Boolean(config.strictShopVerification),
      updatedAt: config.updatedAt,
      ...(config.updatedByUid ? { updatedByUid: config.updatedByUid.slice(0, 128) } : {}),
    };
    await setDoc(doc(db, 'marketplace_config', payload.configId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `marketplace_config/${config.configId}`);
  }
}

export function subscribeToAllUsersForAdmin(
  onUpdate: (users: UserProfile[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users'),
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => d.data() as UserProfile)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn('Admin users listener notice:', error.message);
      onUpdate([]);
    }
  );
}

export async function findUserByEmailInFirestore(
  email: string
): Promise<UserProfile | null> {
  const cleanEmail = (email ?? '').trim().toLowerCase();
  if (!cleanEmail) return null;
  try {
    const exactSnap = await getDocs(
      query(collection(db, 'users'), where('email', '==', cleanEmail))
    );
    if (!exactSnap.empty) {
      return exactSnap.docs[0].data() as UserProfile;
    }
    const allSnap = await getDocs(collection(db, 'users'));
    for (const docSnap of allSnap.docs) {
      const data = docSnap.data() as UserProfile;
      if ((data.email ?? '').trim().toLowerCase() === cleanEmail) {
        return data;
      }
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users?email=${cleanEmail}`);
  }
}

export async function updateUserGovernanceInFirestore(
  uid: string,
  patch: { role?: UserRole; accountStatus?: AccountStatus }
): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (patch.role) payload.role = patch.role;
    if (patch.accountStatus) payload.accountStatus = patch.accountStatus;
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export function subscribeToAllOrdersForAdmin(
  onUpdate: (orders: Order[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'orders'),
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => d.data() as Order)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn('Admin orders listener notice:', error.message);
      onUpdate([]);
    }
  );
}

export async function adminUpdateOrderInFirestore(
  orderId: string,
  patch: {
    orderStatus?: OrderStatus;
    paymentStatus?: PaymentStatus;
    adminNote?: string;
    rejectionReason?: string;
  },
  customerUid: string,
  shopName: string
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      updatedAt: now,
    };
    if (patch.orderStatus) payload.orderStatus = patch.orderStatus;
    if (patch.paymentStatus) payload.paymentStatus = patch.paymentStatus;
    if (patch.adminNote !== undefined) {
      payload.adminNote = patch.adminNote.trim().slice(0, 300) || deleteField();
    }
    if (patch.rejectionReason !== undefined) {
      payload.rejectionReason = patch.rejectionReason.trim().slice(0, 300) || deleteField();
    }

    await updateDoc(doc(db, 'orders', orderId), payload);

    const statusLabel = (patch.orderStatus ?? 'updated').replace(/_/g, ' ');
    const reasonText = patch.adminNote?.trim() || patch.rejectionReason?.trim() || '';
    const notif: NotificationItem = {
      notificationId: `notif-adm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userUid: customerUid,
      title: `Marketplace Admin: Order ${statusLabel}`,
      message: `Hawasa Gebeya Admin updated order #${orderId.slice(-6).toUpperCase()} (${shopName})${
        patch.paymentStatus === 'refunded' ? ' · Refunded' : ''
      }${reasonText ? `: ${reasonText}` : '.'}`.slice(0, 500),
      type: 'order_status',
      orderId,
      isRead: false,
      createdAt: now,
    };
    await setDoc(doc(db, 'notifications', notif.notificationId), notif);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
  }
}

export function subscribeToAllReturnRequestsForAdmin(
  onUpdate: (requests: ReturnRequest[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'return_requests'),
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => d.data() as ReturnRequest)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn('Admin return requests listener notice:', error.message);
      onUpdate([]);
    }
  );
}

export async function adminResolveReturnRequestInFirestore(
  returnId: string,
  status: ReturnRequestStatus,
  resolutionNote: string,
  customerUid: string,
  orderId: string,
  productName: string
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const cleanNote = resolutionNote.trim().slice(0, 300);
    const payload: Record<string, unknown> = {
      status,
      updatedAt: now,
    };
    if (cleanNote) {
      payload.resolutionNote = cleanNote;
    }
    await updateDoc(doc(db, 'return_requests', returnId), payload);

    const notif: NotificationItem = {
      notificationId: `notif-ret-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userUid: customerUid,
      title: `Return ${status}`,
      message: `Admin marked your return for ${productName} (#${orderId
        .slice(-6)
        .toUpperCase()}) as ${status}${cleanNote ? `: ${cleanNote}` : '.'}`.slice(0, 500),
      type: 'order_status',
      orderId,
      isRead: false,
      createdAt: now,
    };
    await setDoc(doc(db, 'notifications', notif.notificationId), notif);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `return_requests/${returnId}`);
  }
}

export async function moderateShopGovernanceInFirestore(
  shopId: string,
  patch: {
    status?: 'pending' | 'approved' | 'suspended';
    featured?: boolean;
    suspensionReason?: string;
  }
): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (patch.status) payload.status = patch.status;
    if (typeof patch.featured === 'boolean') payload.featured = patch.featured;
    if (patch.suspensionReason !== undefined) {
      const clean = patch.suspensionReason.trim().slice(0, 300);
      payload.suspensionReason = clean || deleteField();
    }
    await updateDoc(doc(db, 'shops', shopId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `shops/${shopId}`);
  }
}

export async function deleteShopInFirestore(shopId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shops', shopId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `shops/${shopId}`);
  }
}

export async function moderateProductGovernanceInFirestore(
  productId: string,
  patch: {
    status?: 'active' | 'archived' | 'pending_review';
    isAvailable?: boolean;
    stock?: number;
    moderationReason?: string;
  }
): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (patch.status) payload.status = patch.status;
    if (typeof patch.isAvailable === 'boolean') payload.isAvailable = patch.isAvailable;
    if (typeof patch.stock === 'number' && Number.isFinite(patch.stock)) {
      payload.stock = Math.max(0, Math.round(patch.stock));
    }
    if (patch.moderationReason !== undefined) {
      const clean = patch.moderationReason.trim().slice(0, 300);
      payload.moderationReason = clean || deleteField();
    }
    await updateDoc(doc(db, 'products', productId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `products/${productId}`);
  }
}

export async function deleteProductInFirestore(productId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
  }
}

export function subscribeToAdminAuditLogs(
  onUpdate: (logs: AdminAuditLog[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'admin_audit_logs'),
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => d.data() as AdminAuditLog)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn('Admin audit logs listener notice:', error.message);
      onUpdate([]);
    }
  );
}

export async function recordAdminAuditLogInFirestore(log: AdminAuditLog): Promise<void> {
  try {
    const cleanReason = log.reason?.trim().slice(0, 300);
    const sanitized: AdminAuditLog = {
      logId: log.logId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128),
      adminUid: log.adminUid.slice(0, 128),
      adminEmail: log.adminEmail.trim().slice(0, 150) || 'admin@hawasagebeya.et',
      action: log.action.trim().slice(0, 80) || 'admin_action',
      targetType: log.targetType,
      targetId: log.targetId.trim().slice(0, 128) || 'unknown',
      targetLabel: log.targetLabel.trim().slice(0, 140) || 'Item',
      ...(cleanReason ? { reason: cleanReason } : {}),
      createdAt: log.createdAt,
    };
    await setDoc(doc(db, 'admin_audit_logs', sanitized.logId), sanitized);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `admin_audit_logs/${log.logId}`);
  }
}

export function subscribeToOwnerVerifications(
  ownerUid: string,
  onUpdate: (verifications: MerchantVerification[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'merchant_verifications'),
    where('ownerUid', '==', ownerUid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => d.data() as MerchantVerification)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn('Owner verifications listener notice:', error.message);
      onUpdate([]);
    }
  );
}

export function subscribeToAllVerificationsForAdmin(
  onUpdate: (verifications: MerchantVerification[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'merchant_verifications'),
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => d.data() as MerchantVerification)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn('Admin verifications listener notice:', error.message);
      onUpdate([]);
    }
  );
}

export async function submitMerchantVerificationInFirestore(
  verification: MerchantVerification,
  updateShopDocStatus: boolean
): Promise<void> {
  try {
    if (verification.licenseImageDataUrl.length > MAX_IMAGE_UPLOAD_DATA_URL_LENGTH) {
      throw new Error('Business license image exceeds 150 KB safe limit.');
    }
    const cleanTin = verification.tinNumber?.trim().slice(0, 30);
    const cleanExpiry = verification.expiryDate?.trim().slice(0, 30);
    const cleanFileName = verification.documentFileName?.trim().slice(0, 120);

    const sanitized: MerchantVerification = {
      verificationId: verification.verificationId.trim().slice(0, 128),
      shopId: verification.shopId.trim().slice(0, 128),
      shopName: verification.shopName.trim().slice(0, 120) || 'Hawassa Shop',
      ownerUid: verification.ownerUid.trim().slice(0, 128),
      businessLegalName: verification.businessLegalName.trim().slice(0, 140),
      licenseNumber: verification.licenseNumber.trim().slice(0, 60),
      ...(cleanTin ? { tinNumber: cleanTin } : {}),
      issuingAuthority: verification.issuingAuthority.trim().slice(0, 140),
      ...(cleanExpiry ? { expiryDate: cleanExpiry } : {}),
      licenseImageDataUrl: verification.licenseImageDataUrl,
      ...(cleanFileName ? { documentFileName: cleanFileName } : {}),
      status: 'pending_review',
      submittedAt: verification.submittedAt,
      updatedAt: verification.updatedAt,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'merchant_verifications', sanitized.verificationId), sanitized);
    if (updateShopDocStatus) {
      batch.update(doc(db, 'shops', sanitized.shopId), {
        verificationStatus: 'pending_review',
        updatedAt: sanitized.updatedAt,
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `merchant_verifications/${verification.verificationId}`
    );
  }
}

export async function reviewMerchantVerificationInFirestore(params: {
  verification: MerchantVerification;
  decision: 'approved' | 'rejected';
  reviewNote?: string;
  reviewerUid: string;
}): Promise<void> {
  try {
    const now = new Date().toISOString();
    const cleanNote = params.reviewNote?.trim().slice(0, 300);
    const batch = writeBatch(db);

    batch.update(doc(db, 'merchant_verifications', params.verification.verificationId), {
      status: params.decision,
      reviewedAt: now,
      reviewedByUid: params.reviewerUid.slice(0, 128),
      updatedAt: now,
      ...(cleanNote ? { reviewNote: cleanNote } : { reviewNote: deleteField() }),
    });

    batch.update(doc(db, 'shops', params.verification.shopId), {
      verificationStatus: params.decision,
      ...(params.decision === 'approved' ? { status: 'approved' } : {}),
      updatedAt: now,
    });

    const notif: NotificationItem = {
      notificationId: `notif-ver-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userUid: params.verification.ownerUid,
      title:
        params.decision === 'approved'
          ? 'Business License Approved'
          : 'Business License Needs Attention',
      message:
        params.decision === 'approved'
          ? `Your business license for ${params.verification.shopName} has been approved. You can now list products on Hawasa Gebeya.`
          : `Document verification for ${params.verification.shopName} was declined${
              cleanNote ? `: ${cleanNote}` : '. Please re-upload a clear business license.'
            }`.slice(0, 500),
      type: 'seller_approval',
      isRead: false,
      createdAt: now,
    };
    batch.set(doc(db, 'notifications', notif.notificationId), notif);

    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `merchant_verifications/${params.verification.verificationId}`
    );
  }
}

function sanitizeChatThreadForWrite(thread: TradeChatThread): TradeChatThread {
  const clean: TradeChatThread = {
    threadId: thread.threadId.trim().slice(0, 128),
    threadType: thread.threadType,
    ...(thread.orderId ? { orderId: thread.orderId.trim().slice(0, 128) } : {}),
    ...(thread.orderCode ? { orderCode: thread.orderCode.trim().slice(0, 24) } : {}),
    ...(typeof thread.orderTotalEtb === 'number' && Number.isFinite(thread.orderTotalEtb)
      ? { orderTotalEtb: Math.max(0, thread.orderTotalEtb) }
      : {}),
    ...(thread.orderStatusSnapshot
      ? { orderStatusSnapshot: thread.orderStatusSnapshot }
      : {}),
    shopId: thread.shopId.trim().slice(0, 128),
    shopName: (thread.shopName.trim() || 'Hawassa Shop').slice(0, 120),
    buyerUid: thread.buyerUid.trim().slice(0, 128),
    buyerName: (thread.buyerName.trim() || 'Customer').slice(0, 100),
    sellerUid: thread.sellerUid.trim().slice(0, 128),
    sellerName: (thread.sellerName.trim() || 'Seller').slice(0, 100),
    lastMessage: (thread.lastMessage ?? '').trim().slice(0, 1000),
    lastSenderUid: thread.lastSenderUid.trim().slice(0, 128),
    lastSenderRole: thread.lastSenderRole,
    lastMessageAt: thread.lastMessageAt,
    supervisionStatus: thread.supervisionStatus,
    ...(thread.supervisionRequestedByUid
      ? { supervisionRequestedByUid: thread.supervisionRequestedByUid.trim().slice(0, 128) }
      : {}),
    ...(thread.supervisionRequestedByRole
      ? { supervisionRequestedByRole: thread.supervisionRequestedByRole }
      : {}),
    ...(thread.supervisionReason?.trim()
      ? { supervisionReason: thread.supervisionReason.trim().slice(0, 300) }
      : {}),
    ...(thread.supervisionRequestedAt
      ? { supervisionRequestedAt: thread.supervisionRequestedAt }
      : {}),
    ...(thread.assignedAdminUid
      ? { assignedAdminUid: thread.assignedAdminUid.trim().slice(0, 128) }
      : {}),
    ...(thread.assignedAdminName?.trim()
      ? { assignedAdminName: thread.assignedAdminName.trim().slice(0, 100) }
      : {}),
    ...(thread.resolutionNote?.trim()
      ? { resolutionNote: thread.resolutionNote.trim().slice(0, 300) }
      : {}),
    ...(thread.resolvedAt ? { resolvedAt: thread.resolvedAt } : {}),
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
  return clean;
}

function sanitizeChatMessageForWrite(message: TradeChatMessage): TradeChatMessage {
  return {
    messageId: message.messageId.trim().slice(0, 128),
    threadId: message.threadId.trim().slice(0, 128),
    buyerUid: message.buyerUid.trim().slice(0, 128),
    sellerUid: message.sellerUid.trim().slice(0, 128),
    senderUid: message.senderUid.trim().slice(0, 128),
    senderName: (message.senderName.trim() || 'Participant').slice(0, 100),
    senderRole: message.senderRole,
    messageType: message.messageType,
    body: message.body.trim().slice(0, 1000),
    createdAt: message.createdAt,
  };
}

export function subscribeToBuyerChatThreads(
  buyerUid: string,
  onUpdate: (threads: TradeChatThread[]) => void
): Unsubscribe {
  const q = query(collection(db, 'trade_chats'), where('buyerUid', '==', buyerUid));
  return onSnapshot(
    q,
    (snapshot) => {
      onUpdate(snapshot.docs.map((d) => d.data() as TradeChatThread));
    },
    (error) => {
      console.warn('Buyer chat threads listener notice:', error.message);
      onUpdate([]);
    }
  );
}

export function subscribeToSellerChatThreads(
  sellerUid: string,
  onUpdate: (threads: TradeChatThread[]) => void
): Unsubscribe {
  const q = query(collection(db, 'trade_chats'), where('sellerUid', '==', sellerUid));
  return onSnapshot(
    q,
    (snapshot) => {
      onUpdate(snapshot.docs.map((d) => d.data() as TradeChatThread));
    },
    (error) => {
      console.warn('Seller chat threads listener notice:', error.message);
      onUpdate([]);
    }
  );
}

export function subscribeToAllChatThreadsForAdmin(
  onUpdate: (threads: TradeChatThread[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'trade_chats'),
    (snapshot) => {
      onUpdate(snapshot.docs.map((d) => d.data() as TradeChatThread));
    },
    (error) => {
      console.warn('Admin chat supervision listener notice:', error.message);
      onUpdate([]);
    }
  );
}

export function subscribeToChatMessages(
  threadId: string,
  onUpdate: (messages: TradeChatMessage[]) => void
): Unsubscribe {
  const msgsRef = collection(db, 'trade_chats', threadId, 'messages');
  return onSnapshot(
    msgsRef,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => d.data() as TradeChatMessage)
        .sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      onUpdate(list);
    },
    (error) => {
      console.warn(`Chat messages listener notice (${threadId}):`, error.message);
      onUpdate([]);
    }
  );
}

export async function ensureChatThreadInFirestore(thread: TradeChatThread): Promise<void> {
  try {
    const threadRef = doc(db, 'trade_chats', thread.threadId);
    const snap = await getDoc(threadRef);
    if (!snap.exists()) {
      await setDoc(
        threadRef,
        sanitizeChatThreadForWrite({
          ...thread,
          supervisionStatus: 'none',
        })
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `trade_chats/${thread.threadId}`);
  }
}

export async function sendTradeChatMessageInFirestore(params: {
  baseThread: TradeChatThread;
  message: TradeChatMessage;
  notification?: NotificationItem;
}): Promise<void> {
  try {
    const threadRef = doc(db, 'trade_chats', params.baseThread.threadId);
    const msgRef = doc(
      db,
      'trade_chats',
      params.baseThread.threadId,
      'messages',
      params.message.messageId
    );
    const existing = await getDoc(threadRef);
    const sanitizedMsg = sanitizeChatMessageForWrite(params.message);
    const batch = writeBatch(db);

    if (!existing.exists()) {
      const newThread = sanitizeChatThreadForWrite({
        ...params.baseThread,
        supervisionStatus: 'none',
        lastMessage: sanitizedMsg.body,
        lastSenderUid: sanitizedMsg.senderUid,
        lastSenderRole: sanitizedMsg.senderRole,
        lastMessageAt: sanitizedMsg.createdAt,
        updatedAt: sanitizedMsg.createdAt,
      });
      batch.set(threadRef, newThread);
    } else {
      batch.update(threadRef, {
        lastMessage: sanitizedMsg.body,
        lastSenderUid: sanitizedMsg.senderUid,
        lastSenderRole: sanitizedMsg.senderRole,
        lastMessageAt: sanitizedMsg.createdAt,
        ...(params.baseThread.orderStatusSnapshot
          ? { orderStatusSnapshot: params.baseThread.orderStatusSnapshot }
          : {}),
        updatedAt: sanitizedMsg.createdAt,
      });
    }

    batch.set(msgRef, sanitizedMsg);
    if (params.notification && !params.notification.userUid.startsWith('seed-')) {
      batch.set(
        doc(db, 'notifications', params.notification.notificationId),
        params.notification
      );
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `trade_chats/${params.baseThread.threadId}/messages/${params.message.messageId}`
    );
  }
}

export async function requestAdminSupervisionInFirestore(params: {
  baseThread: TradeChatThread;
  requesterUid: string;
  requesterRole: 'buyer' | 'seller';
  reason?: string;
  systemMessage: TradeChatMessage;
  counterpartyNotification?: NotificationItem;
}): Promise<void> {
  try {
    const threadRef = doc(db, 'trade_chats', params.baseThread.threadId);
    const existing = await getDoc(threadRef);
    if (!existing.exists()) {
      await setDoc(
        threadRef,
        sanitizeChatThreadForWrite({
          ...params.baseThread,
          supervisionStatus: 'none',
        })
      );
    }

    const now = params.systemMessage.createdAt;
    const cleanReason = params.reason?.trim().slice(0, 300);
    const sanitizedMsg = sanitizeChatMessageForWrite(params.systemMessage);
    const batch = writeBatch(db);

    batch.update(threadRef, {
      supervisionStatus: 'requested',
      supervisionRequestedByUid: params.requesterUid.slice(0, 128),
      supervisionRequestedByRole: params.requesterRole,
      ...(cleanReason ? { supervisionReason: cleanReason } : {}),
      supervisionRequestedAt: now,
      lastMessage: sanitizedMsg.body,
      lastSenderUid: sanitizedMsg.senderUid,
      lastSenderRole: sanitizedMsg.senderRole,
      lastMessageAt: now,
      updatedAt: now,
    });

    batch.set(
      doc(
        db,
        'trade_chats',
        params.baseThread.threadId,
        'messages',
        sanitizedMsg.messageId
      ),
      sanitizedMsg
    );

    if (
      params.counterpartyNotification &&
      !params.counterpartyNotification.userUid.startsWith('seed-')
    ) {
      batch.set(
        doc(db, 'notifications', params.counterpartyNotification.notificationId),
        params.counterpartyNotification
      );
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `trade_chats/${params.baseThread.threadId}`
    );
  }
}

export async function adminMediateChatInFirestore(params: {
  thread: TradeChatThread;
  adminUid: string;
  adminName: string;
  nextStatus: 'active' | 'resolved';
  message?: TradeChatMessage;
  resolutionNote?: string;
  notifications?: NotificationItem[];
}): Promise<void> {
  try {
    const threadRef = doc(db, 'trade_chats', params.thread.threadId);
    const now = params.message?.createdAt ?? new Date().toISOString();
    const cleanNote = params.resolutionNote?.trim().slice(0, 300);
    const batch = writeBatch(db);

    const updates: Record<string, unknown> = {
      supervisionStatus: params.nextStatus,
      assignedAdminUid: params.adminUid.slice(0, 128),
      assignedAdminName: (params.adminName.trim() || 'Marketplace Admin').slice(0, 100),
      updatedAt: now,
    };

    if (params.nextStatus === 'resolved') {
      updates.resolvedAt = now;
      if (cleanNote) updates.resolutionNote = cleanNote;
    }

    if (params.message) {
      const sanitizedMsg = sanitizeChatMessageForWrite(params.message);
      updates.lastMessage = sanitizedMsg.body;
      updates.lastSenderUid = sanitizedMsg.senderUid;
      updates.lastSenderRole = sanitizedMsg.senderRole;
      updates.lastMessageAt = sanitizedMsg.createdAt;
      batch.set(
        doc(
          db,
          'trade_chats',
          params.thread.threadId,
          'messages',
          sanitizedMsg.messageId
        ),
        sanitizedMsg
      );
    }

    batch.update(threadRef, updates);

    for (const notif of params.notifications ?? []) {
      if (notif.userUid && !notif.userUid.startsWith('seed-')) {
        batch.set(doc(db, 'notifications', notif.notificationId), notif);
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `trade_chats/${params.thread.threadId}`
    );
  }
}
