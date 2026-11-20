export type UserRole = 'customer' | 'seller' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'pending';
export type SupportedLanguage = 'en' | 'am' | 'om' | 'sid';
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  photoURL?: string;
  role: UserRole;
  accountStatus: AccountStatus;
  preferredLanguage: SupportedLanguage;
  preferredTheme?: ThemePreference;
  neighborhood?: string;
  shopId?: string;
  loyaltyPoints?: number;
  lifetimeLoyaltyPoints?: number;
  favoriteShopIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export type DocumentVerificationStatus =
  | 'unverified'
  | 'pending_review'
  | 'approved'
  | 'rejected';

export type TraderType = 'general' | 'coffee';

export type CoffeeRoastLevel = 'light' | 'medium' | 'medium_dark' | 'dark';
export type CoffeeProcessMethod = 'washed' | 'natural' | 'honey' | 'anaerobic';
export type CoffeeBeanForm = 'whole_bean' | 'ground';

export interface CoffeeProductDetails {
  origin?: string;
  brand?: string;
  roastLevel?: CoffeeRoastLevel;
  processingMethod?: CoffeeProcessMethod;
  beanForm?: CoffeeBeanForm;
  packageWeight?: string;
  roastDate?: string;
}

export type ShopAvailabilityStatus = 'active' | 'temporarily_closed' | 'inactive';

export type PreferredContactMethod = 'phone' | 'chat' | 'both';

export interface Shop {
  shopId: string;
  ownerUid: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  coverImageUrl: string;
  phoneNumber: string;
  businessPhoneNumber?: string;
  publishBusinessPhone?: boolean;
  preferredContactMethod?: PreferredContactMethod;
  mainCategory?: string;
  productTypes?: string[];
  region?: string;
  city: string;
  subCity?: string;
  neighborhood: string;
  address: string;
  latitude?: number;
  longitude?: number;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  status: 'pending' | 'approved' | 'suspended';
  verificationStatus?: DocumentVerificationStatus;
  availabilityStatus?: ShopAvailabilityStatus;
  isPublished?: boolean;
  traderType?: TraderType;
  rating: number;
  reviewCount: number;
  featured?: boolean;
  operatingHours?: string;
  suspensionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicShopDirectoryItem {
  shopId: string;
  ownerUid: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  coverImageUrl: string;
  mainCategory: string;
  productTypes: string[];
  region: string;
  city: string;
  subCity?: string;
  neighborhood: string;
  address: string;
  latitude?: number;
  longitude?: number;
  operatingHours?: string;
  phoneNumber: string | null;
  telHref: string | null;
  preferredContactMethod: PreferredContactMethod;
  availabilityStatus: ShopAvailabilityStatus;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  traderType?: TraderType;
  verified: boolean;
  rating: number;
  reviewCount: number;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantVerification {
  verificationId: string;
  shopId: string;
  shopName: string;
  ownerUid: string;
  businessLegalName: string;
  licenseNumber: string;
  tinNumber?: string;
  issuingAuthority: string;
  expiryDate?: string;
  licenseImageDataUrl: string;
  documentFileName?: string;
  status: 'pending_review' | 'approved' | 'rejected';
  reviewNote?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedByUid?: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  label: string;
  price: number;
  previousPrice?: number;
  stock?: number;
}

export interface Product {
  productId: string;
  shopId: string;
  shopName: string;
  name: string;
  description: string;
  category: string;
  productType?: string;
  price: number; // In Ethiopian Birr (ETB)
  previousPrice?: number;
  stock: number;
  isAvailable: boolean;
  imageUrl: string;
  additionalImages?: string[];
  variants?: ProductVariant[];
  coffeeDetails?: CoffeeProductDetails;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  status: 'active' | 'archived' | 'pending_review';
  moderationReason?: string;
  rating?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  slug: string;
  name: string;
  nameAm: string;
  nameOm: string;
  nameSid?: string;
  iconName: string;
  displayOrder: number;
  isActive: boolean;
  itemCount?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  shopId: string;
  variantId?: string;
  variantLabel?: string;
  unitPrice?: number;
}

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'canceled';

export type PaymentMethod =
  | 'telebirr'
  | 'cbe_birr'
  | 'chapa'
  | 'cash_on_delivery'
  | 'pay_at_pickup'
  | 'telebirr_sandbox'
  | 'cbe_birr_sandbox';

export type PaymentStatus = 'pending' | 'paid' | 'refunded';

export interface OrderItemSnapshot {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  variantLabel?: string;
}

export interface Order {
  orderId: string;
  customerUid: string;
  customerName: string;
  customerPhone: string;
  shopId: string;
  shopOwnerUid?: string;
  shopName: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  discountAmount?: number;
  promoCode?: string;
  promoDiscountAmount?: number;
  pointsRedeemed?: number;
  pointsDiscountAmount?: number;
  pointsEarned?: number;
  deliveryFee: number;
  totalAmount: number;
  currency: 'ETB';
  fulfillmentMethod: 'delivery' | 'pickup';
  deliveryAddress?: string;
  neighborhood?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  verifiedPaid?: boolean;
  paymentReference?: string;
  deliveryPin?: string;
  deliveryEtaLabel?: string;
  orderStatus: OrderStatus;
  rejectionReason?: string;
  sellerNotes?: string;
  adminNote?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  addressId: string;
  customerUid: string;
  label: string; // e.g. "Home", "Office", "Shop"
  recipientName: string;
  phoneNumber: string;
  city: string;
  neighborhood: string;
  streetOrLandmark: string;
  additionalInstructions?: string;
  isDefault: boolean;
  createdAt: string;
}

export interface NotificationItem {
  notificationId: string;
  userUid: string;
  title: string;
  message: string;
  type: 'order_status' | 'seller_approval' | 'promo' | 'price_alert' | 'system';
  orderId?: string;
  productId?: string;
  shopId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface UserCoordinates {
  lat: number;
  lng: number;
}

export interface UserLocationState {
  coords: UserCoordinates;
  label: string;
  neighborhood: string;
  source: 'gps' | 'neighborhood' | 'default';
  accuracyMeters?: number;
  updatedAt: string;
}

export interface ShopWithProximity {
  shop: Shop;
  distanceKm: number;
  distanceLabel: string;
  estimatedWalkMinutes: number;
  estimatedBajajMinutes: number;
  isNearestForUser: boolean;
  discountedProductsCount: number;
  bestDiscountPercent: number;
}

export interface NearbyDiscountDeal {
  shop: Shop;
  product: Product;
  distanceKm: number;
  distanceLabel: string;
  discountPercent: number;
}

export interface ReviewItem {
  reviewId: string;
  productId: string;
  shopId: string;
  orderId?: string;
  customerUid: string;
  customerName: string;
  rating: number;
  comment: string;
  shopRating?: number;
  shopComment?: string;
  verifiedPurchase?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type LoyaltyTransactionType = 'earned' | 'redeemed' | 'refunded' | 'reversed';

export interface LoyaltyTransaction {
  transactionId: string;
  customerUid: string;
  orderId: string;
  shopId: string;
  shopName: string;
  type: LoyaltyTransactionType;
  points: number;
  orderAmountEtb: number;
  description: string;
  createdAt: string;
}

export interface SharedWishlist {
  shareId: string;
  ownerUid: string;
  ownerName: string;
  title: string;
  productIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type ReturnRequestType = 'return' | 'exchange';

export type ReturnRequestReason =
  | 'damaged_item'
  | 'wrong_item'
  | 'quality_issue'
  | 'size_or_fit'
  | 'missing_parts'
  | 'changed_mind';

export type ReturnRequestStatus = 'requested' | 'approved' | 'rejected' | 'completed';

export interface ReturnRequest {
  returnId: string;
  orderId: string;
  productId: string;
  productName: string;
  variantLabel?: string;
  shopId: string;
  shopName: string;
  customerUid: string;
  customerName: string;
  requestType: ReturnRequestType;
  reason: ReturnRequestReason;
  details: string;
  photoDataUrl?: string;
  status: ReturnRequestStatus;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export type PriceAlertStatus = 'active' | 'triggered' | 'paused';
export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface PriceAlert {
  alertId: string;
  productId: string;
  productName: string;
  productImageUrl?: string;
  shopId: string;
  shopName: string;
  customerUid: string;
  baselinePrice: number;
  targetPrice: number;
  pushEnabled: boolean;
  status: PriceAlertStatus;
  triggeredAt?: string;
  triggeredPrice?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceGovernanceConfig {
  configId: string;
  deliveryFeeEtb: number;
  freeDeliveryThresholdEtb: number;
  maxOrderAmountEtb: number;
  orderingPaused: boolean;
  maintenanceBanner?: string;
  strictShopVerification: boolean;
  updatedAt: string;
  updatedByUid?: string;
}

export type AdminAuditTargetType =
  | 'shop'
  | 'verification'
  | 'product'
  | 'order'
  | 'return_request'
  | 'chat_supervision'
  | 'user'
  | 'review'
  | 'category'
  | 'config';

export interface AdminAuditLog {
  logId: string;
  adminUid: string;
  adminEmail: string;
  action: string;
  targetType: AdminAuditTargetType;
  targetId: string;
  targetLabel: string;
  reason?: string;
  createdAt: string;
}

export type ChatSenderRole = 'buyer' | 'seller' | 'admin' | 'system';

export type ChatSupervisionStatus = 'none' | 'requested' | 'active' | 'resolved';

export type TradeChatMessageType =
  | 'text'
  | 'supervision_request'
  | 'mediator_notice'
  | 'supervision_resolved';

export interface TradeChatThread {
  threadId: string;
  threadType: 'order' | 'shop';
  orderId?: string;
  orderCode?: string;
  orderTotalEtb?: number;
  orderStatusSnapshot?: OrderStatus;
  shopId: string;
  shopName: string;
  buyerUid: string;
  buyerName: string;
  sellerUid: string;
  sellerName: string;
  lastMessage: string;
  lastSenderUid: string;
  lastSenderRole: ChatSenderRole;
  lastMessageAt: string;
  supervisionStatus: ChatSupervisionStatus;
  supervisionRequestedByUid?: string;
  supervisionRequestedByRole?: 'buyer' | 'seller';
  supervisionReason?: string;
  supervisionRequestedAt?: string;
  assignedAdminUid?: string;
  assignedAdminName?: string;
  resolutionNote?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TradeChatMessage {
  messageId: string;
  threadId: string;
  buyerUid: string;
  sellerUid: string;
  senderUid: string;
  senderName: string;
  senderRole: ChatSenderRole;
  messageType: TradeChatMessageType;
  body: string;
  createdAt: string;
}
