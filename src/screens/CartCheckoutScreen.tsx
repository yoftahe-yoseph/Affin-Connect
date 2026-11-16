import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  CreditCard,
  History,
  KeyRound,
  Lock,
  MapPin,
  Minus,
  Phone,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Truck,
  Wallet,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { EmptyState, ResilientImage } from '../components/SharedUI';
import { getLocalizedNeighborhood } from '../constants/translations';
import {
  calculateCartSummary,
  calculateMaxRedeemablePoints,
  ETHIOPIAN_PAYMENT_CONFIG,
  formatETB,
  FREE_DELIVERY_THRESHOLD_ETB,
  generateChapaTransactionRef,
  getCartItemKey,
  getCartItemUnitPrice,
  getNeighborhoodDeliveryEstimate,
  HAWASSA_NEIGHBORHOODS,
  isElectronicPaymentMethod,
  LOYALTY_ETB_PER_POINT_REDEEMED,
  LOYALTY_MIN_REDEEM_POINTS,
  PROMO_CODES,
  validateAddressInput,
  validateGatewayReferenceLive,
  validateOrderAgainstGovernance,
  validatePaymentReference,
} from '../utils/marketplaceLogic';
import type { PaymentMethod } from '../types';

export const CartScreen: React.FC = () => {
  const {
    navigate,
    cart,
    shopsById,
    updateCartQuantity,
    removeFromCart,
    favorites,
    toggleFavorite,
    promoCode,
    setPromoCode,
    deliveryFeeEtb,
    loyaltyBalance,
    redeemLoyaltyPoints,
    governanceConfig,
    userProfile,
    t,
  } = useMarketplace();

  const [promoDraft, setPromoDraft] = useState(promoCode);

  const summary = useMemo(
    () =>
      calculateCartSummary(
        cart,
        'delivery',
        deliveryFeeEtb,
        promoCode,
        redeemLoyaltyPoints,
        loyaltyBalance,
        governanceConfig.freeDeliveryThresholdEtb
      ),
    [
      cart,
      deliveryFeeEtb,
      promoCode,
      redeemLoyaltyPoints,
      loyaltyBalance,
      governanceConfig.freeDeliveryThresholdEtb,
    ]
  );

  // Group items by shop to handle single-shop-per-order clarity
  const groupedByShop = useMemo(() => {
    const map: Record<string, typeof cart> = {};
    for (const item of cart) {
      if (!map[item.shopId]) map[item.shopId] = [];
      map[item.shopId].push(item);
    }
    return Object.entries(map);
  }, [cart]);

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    setPromoCode(promoDraft);
  };

  return (
    <div className="flex flex-col min-h-full pb-6">
      <header className="sticky top-0 z-20 bg-white dark:bg-[#1C2420] border-b border-[#E7E5E4] dark:border-[#2A3630] px-4 py-3 flex items-center justify-between">
        <h1 className="text-base font-display font-bold text-stone-900 dark:text-stone-100">{t('cart')}</h1>
        <span className="text-xs font-medium text-stone-500 dark:text-stone-400 tabular-nums">
          {summary.itemCount} {summary.itemCount === 1 ? t('itemSingle') : t('itemPlural')}
        </span>
      </header>

      {cart.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-6 h-6" />}
          title={t('cartEmpty')}
          description={t('cartEmptyDesc')}
          actionLabel={t('startShopping')}
          onAction={() => navigate({ name: 'home' })}
        />
      ) : (
        <div className="p-4 space-y-4">
          {(governanceConfig.orderingPaused || userProfile?.accountStatus === 'suspended') && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">
                {userProfile?.accountStatus === 'suspended'
                  ? t('governanceUserSuspended')
                  : governanceConfig.maintenanceBanner?.trim() || t('governanceOrderingPaused')}
              </span>
            </div>
          )}
          {summary.hasMultipleShops && (
            <div className="p-3.5 rounded-2xl bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#FDE68A] dark:border-[#F59E0B]/30 flex items-start gap-2.5 text-xs text-amber-950 dark:text-amber-100">
              <AlertTriangle className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">{t('multipleShopsTitle')}</div>
                <p className="text-[11px] text-amber-900 dark:text-amber-200 mt-0.5 leading-relaxed">
                  {t('multipleShopsDesc')}
                </p>
              </div>
            </div>
          )}

          {/* Promo / Voucher Code Card */}
          <section className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-stone-900 dark:text-stone-100">
                <Tag className="w-3.5 h-3.5 text-[#C2410C] dark:text-[#FB923C]" />
                <span>{t('promoCodeTitle')}</span>
              </span>
              {summary.promoCode && (
                <button
                  type="button"
                  onClick={() => {
                    setPromoCode('');
                    setPromoDraft('');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 hover:underline"
                >
                  <X className="w-3 h-3" />
                  <span>{t('removeCode')}</span>
                </button>
              )}
            </div>

            <form onSubmit={handleApplyPromo} className="flex gap-2">
              <input
                type="text"
                value={promoDraft}
                onChange={(e) => setPromoDraft(e.target.value.toUpperCase())}
                placeholder={t('promoPlaceholder')}
                aria-label={t('promoCodeTitle')}
                className="flex-1 min-h-[40px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-xs font-mono uppercase text-stone-900 dark:text-stone-100 placeholder:normal-case placeholder:font-sans dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
              />
              <button
                type="submit"
                className="px-4 min-h-[40px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold shrink-0 transition-colors"
              >
                {t('applyCode')}
              </button>
            </form>

            {promoCode && summary.promoErrorKey && (
              <p className="text-[11px] font-medium text-rose-700 dark:text-rose-400">
                {t(summary.promoErrorKey, {
                  amount: formatETB(summary.promoMinSubtotal ?? 0),
                })}
              </p>
            )}
            {summary.promoCode && !summary.promoErrorKey && (
              <p className="text-[11px] font-semibold text-[#C2410C] dark:text-[#FB923C] bg-[#FFF7ED] dark:bg-[#C2410C]/20 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{t('promoApplied', { code: summary.promoCode })}</span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
              <span className="text-stone-500 dark:text-stone-400 font-medium">{t('availableCodes')}</span>
              {PROMO_CODES.map((rule) => (
                <button
                  key={rule.code}
                  type="button"
                  onClick={() => {
                    setPromoDraft(rule.code);
                    setPromoCode(rule.code);
                  }}
                  title={t(rule.summaryKey)}
                  className={`px-2 py-0.5 rounded-md border font-mono text-[10px] font-semibold transition-colors ${
                    summary.promoCode === rule.code
                      ? 'bg-[#FFF7ED] dark:bg-[#C2410C]/20 text-[#C2410C] dark:text-[#FB923C] border-[#C2410C]/40 dark:border-[#FB923C]/40'
                      : 'bg-[#FAF8F5] dark:bg-[#141A17] text-stone-700 dark:text-stone-200 border-[#E7E5E4] dark:border-[#2A3630] hover:border-[#C2410C]/50 dark:hover:border-[#FB923C]/50'
                  }`}
                >
                  {rule.code}
                </button>
              ))}
            </div>
          </section>

          {groupedByShop.map(([shopId, shopItems]) => {
            const shop = shopsById[shopId];
            const shopSummary = calculateCartSummary(
              shopItems,
              'delivery',
              deliveryFeeEtb,
              promoCode,
              redeemLoyaltyPoints,
              loyaltyBalance,
              governanceConfig.freeDeliveryThresholdEtb
            );
            const shopGov = validateOrderAgainstGovernance({
              config: governanceConfig,
              userProfile,
              shop,
              totalAmount: shopSummary.totalAmount,
            });
            const thresholdDenom = Math.max(
              1,
              governanceConfig.freeDeliveryThresholdEtb || FREE_DELIVERY_THRESHOLD_ETB
            );
            const progressPct = Math.min(
              100,
              Math.round((shopSummary.subtotal / thresholdDenom) * 100)
            );
            return (
              <section
                key={shopId}
                className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm overflow-hidden"
              >
                <div className="px-4 py-3 bg-[#FAF8F5] dark:bg-[#141A17]/70 border-b border-[#E7E5E4] dark:border-[#2A3630] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => navigate({ name: 'shop', shopId })}
                    className="flex items-center gap-2 text-xs font-bold text-[#047857] dark:text-[#10B981] hover:underline"
                  >
                    <Store className="w-4 h-4 shrink-0" />
                    <span>{shop?.name ?? 'Local Shop'}</span>
                  </button>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400">{shop?.neighborhood}</span>
                </div>

                {/* Free Hawassa Delivery Progress Bar */}
                <div className="px-4 py-2.5 bg-[#ECFDF5]/60 dark:bg-[#10B981]/10 border-b border-[#E7E5E4] dark:border-[#2A3630] space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1.5 font-medium text-stone-900 dark:text-stone-100">
                      <Truck className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981] shrink-0" />
                      <span>
                        {shopSummary.freeDeliveryUnlocked
                          ? t('freeDeliveryUnlocked')
                          : t('addMoreForFreeDelivery', {
                              amount: formatETB(shopSummary.amountToFreeDelivery),
                            })}
                      </span>
                    </span>
                    <span className="tabular-nums font-semibold text-[#047857] dark:text-[#10B981] shrink-0">
                      {progressPct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#E7E5E4] dark:bg-[#2A3630] overflow-hidden">
                    <div
                      className="h-full bg-[#047857] dark:bg-[#10B981] rounded-full transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="divide-y divide-[#E7E5E4]/80 dark:divide-[#2A3630]">
                  {shopItems.map((item) => {
                    const { product, quantity, variantId, variantLabel } = item;
                    const itemKey = getCartItemKey(product.productId, variantId);
                    const unitPrice = getCartItemUnitPrice(item);
                    const maxStock =
                      variantId && product.variants
                        ? product.variants.find((v) => v.id === variantId)?.stock ?? product.stock
                        : product.stock;

                    return (
                      <div key={itemKey} className="p-3.5 flex gap-3">
                        <button
                          type="button"
                          onClick={() => navigate({ name: 'product', productId: product.productId })}
                          className="w-16 h-16 rounded-xl overflow-hidden bg-[#FAF8F5] dark:bg-[#141A17] shrink-0 border border-[#E7E5E4] dark:border-[#2A3630]"
                        >
                          <ResilientImage
                            src={product.imageUrl}
                            alt={product.name}
                            fallbackTitle={product.name}
                          />
                        </button>

                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-xs font-semibold text-stone-900 dark:text-stone-100 line-clamp-2">
                                {product.name}
                              </h3>
                              {variantLabel && (
                                <div className="text-[11px] text-[#047857] dark:text-[#10B981] font-medium mt-0.5">
                                  {variantLabel}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromCart(product.productId, variantId)}
                              aria-label={`Remove ${product.name} from cart`}
                              className="p-1.5 text-stone-400 dark:text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                              {formatETB(unitPrice * quantity)}
                            </span>

                            <div className="flex items-center gap-1 border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] rounded-lg p-0.5">
                              <button
                                type="button"
                                aria-label={`Decrease quantity of ${product.name}`}
                                onClick={() =>
                                  updateCartQuantity(product.productId, quantity - 1, variantId)
                                }
                                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-[#1C2420] text-stone-700 dark:text-stone-200"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center text-xs font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                                {quantity}
                              </span>
                              <button
                                type="button"
                                aria-label={`Increase quantity of ${product.name}`}
                                onClick={() =>
                                  updateCartQuantity(product.productId, quantity + 1, variantId)
                                }
                                disabled={quantity >= maxStock}
                                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-[#1C2420] text-stone-700 dark:text-stone-200 disabled:text-stone-300 dark:disabled:text-stone-600"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-1.5 flex justify-start">
                            <button
                              type="button"
                              onClick={() => {
                                if (!favorites.includes(product.productId)) {
                                  toggleFavorite(product.productId);
                                }
                                removeFromCart(product.productId, variantId);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 dark:text-stone-400 hover:text-[#047857] dark:hover:text-[#10B981] transition-colors"
                            >
                              <Bookmark className="w-3 h-3" />
                              <span>{t('saveForLater')}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Shop Subtotal & Checkout Action */}
                <div className="p-3.5 bg-[#FAF8F5] dark:bg-[#141A17]/60 border-t border-[#E7E5E4] dark:border-[#2A3630] space-y-2">
                  <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-300">
                    <span>{t('shopSubtotal')}</span>
                    <span className="font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                      {formatETB(shopSummary.subtotal)}
                    </span>
                  </div>
                  {shopSummary.promoDiscountAmount > 0 && shopSummary.promoCode && (
                    <div className="flex items-center justify-between text-xs text-[#C2410C] dark:text-[#FB923C] font-semibold">
                      <span>{t('promoDiscountLabel', { code: shopSummary.promoCode })}</span>
                      <span className="tabular-nums">-{formatETB(shopSummary.promoDiscountAmount)}</span>
                    </div>
                  )}
                  {shopSummary.loyaltyDiscountAmount > 0 && (
                    <div className="flex items-center justify-between text-xs text-[#047857] dark:text-[#10B981] font-medium">
                      <span>{t('loyaltyDiscountLine', { points: shopSummary.loyaltyPointsApplied })}</span>
                      <span className="tabular-nums">-{formatETB(shopSummary.loyaltyDiscountAmount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-300">
                    <span>{t('deliveryFee')}</span>
                    <span className="tabular-nums font-medium">
                      {shopSummary.deliveryFee === 0 ? (
                        <span className="text-[#047857] dark:text-[#10B981] font-semibold">{t('free')}</span>
                      ) : (
                        formatETB(shopSummary.deliveryFee)
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-stone-900 dark:text-stone-100 pt-1.5 border-t border-[#E7E5E4] dark:border-[#2A3630]">
                    <span>{t('total')}</span>
                    <span className="tabular-nums text-[#047857] dark:text-[#10B981]">
                      {formatETB(shopSummary.totalAmount)}
                    </span>
                  </div>
                  {shopSummary.pointsToEarn > 0 && (
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#D97706] dark:text-[#F59E0B] font-semibold pt-0.5">
                      <span className="flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('loyaltyEarnEstimate', { points: shopSummary.pointsToEarn })}</span>
                      </span>
                      {loyaltyBalance >= LOYALTY_MIN_REDEEM_POINTS && (
                        <button
                          type="button"
                          onClick={() => navigate({ name: 'loyalty' })}
                          className="underline font-semibold shrink-0"
                        >
                          {t('loyaltyPointsShort', { points: loyaltyBalance })}
                        </button>
                      )}
                    </div>
                  )}

                  {shopSummary.hasStockIssues && (
                    <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">
                      {shopSummary.stockIssues[0]}
                    </p>
                  )}
                  {!shopGov.allowed && (
                    <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">
                      {shopGov.customMessage ||
                        t(shopGov.errorKey ?? 'governanceOrderingPaused', {
                          limit: formatETB(governanceConfig.maxOrderAmountEtb),
                        })}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={shopSummary.hasStockIssues || !shopGov.allowed}
                    onClick={() => {
                      localStorage.setItem('hg_checkout_shop_id', shopId);
                      navigate({ name: 'checkout' });
                    }}
                    className="w-full min-h-[44px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] disabled:bg-stone-300 dark:disabled:bg-[#2A3630] dark:disabled:text-stone-500 text-white dark:text-[#0B1410] text-xs font-semibold transition-colors"
                  >
                    {groupedByShop.length > 1
                      ? `Checkout ${shop?.name ?? 'Shop'} (${formatETB(shopSummary.totalAmount)})`
                      : `${t('checkout')} · ${formatETB(shopSummary.totalAmount)}`}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

type CheckoutStep = 1 | 2 | 3;

export const CheckoutScreen: React.FC = () => {
  const {
    goBack,
    navigate,
    cart,
    shopsById,
    proximityByShopId,
    addresses,
    saveAddress,
    placeOrder,
    deliveryFeeEtb,
    promoCode,
    setPromoCode,
    loyaltyBalance,
    redeemLoyaltyPoints,
    setRedeemLoyaltyPoints,
    governanceConfig,
    firebaseUser,
    userProfile,
    language,
    t,
  } = useMarketplace();

  const [selectedShopId, setSelectedShopId] = useState<string>(
    () => localStorage.getItem('hg_checkout_shop_id') || cart[0]?.shopId || ''
  );

  const groupedShopIds = useMemo(() => {
    const seen: string[] = [];
    for (const item of cart) {
      if (!seen.includes(item.shopId)) seen.push(item.shopId);
    }
    return seen;
  }, [cart]);

  const effectiveShopId =
    selectedShopId && cart.some((c) => c.shopId === selectedShopId)
      ? selectedShopId
      : cart[0]?.shopId || '';

  const shopItems = cart.filter((c) => c.shopId === effectiveShopId);
  const shop = shopsById[effectiveShopId];
  const otherShopIds = groupedShopIds.filter((id) => id !== effectiveShopId);

  const [activeStep, setActiveStep] = useState<CheckoutStep>(1);
  const [step1Confirmed, setStep1Confirmed] = useState<boolean>(false);
  const [step2Confirmed, setStep2Confirmed] = useState<boolean>(false);

  const [fulfillmentMethod, setFulfillmentMethod] = useState<'delivery' | 'pickup'>(
    shop?.deliveryAvailable === false && shop?.pickupAvailable ? 'pickup' : 'delivery'
  );
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    addresses.find((a) => a.isDefault)?.addressId || addresses[0]?.addressId || ''
  );
  const [showNewAddressForm, setShowNewAddressForm] = useState(addresses.length === 0);
  const [promoDraft, setPromoDraft] = useState(promoCode);

  // New Address Form State
  const [addrLabel, setAddrLabel] = useState('Home');
  const [recipientName, setRecipientName] = useState(
    firebaseUser?.displayName || userProfile?.displayName || ''
  );
  const [phoneNumber, setPhoneNumber] = useState(
    firebaseUser?.phoneNumber || userProfile?.phoneNumber || ''
  );
  const [neighborhood, setNeighborhood] = useState<string>(HAWASSA_NEIGHBORHOODS[0]);
  const [streetOrLandmark, setStreetOrLandmark] = useState('');
  const [addrErrors, setAddrErrors] = useState<Record<string, string>>({});

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_on_delivery');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentRefError, setPaymentRefError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Interactive Chapa Popup Simulator State
  const [chapaModalOpen, setChapaModalOpen] = useState(false);
  const [chapaChannel, setChapaChannel] = useState<'card' | 'telebirr' | 'amole'>('card');
  const [chapaAccountInput, setChapaAccountInput] = useState('4821');
  const [chapaAuthorizing, setChapaAuthorizing] = useState(false);
  const [chapaAuthorizedRef, setChapaAuthorizedRef] = useState<string | null>(null);

  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
    if (defaultAddr && (!selectedAddressId || !addresses.some((a) => a.addressId === selectedAddressId))) {
      setSelectedAddressId(defaultAddr.addressId);
    }
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    if (!shop) return;
    if (fulfillmentMethod === 'delivery' && !shop.deliveryAvailable && shop.pickupAvailable) {
      setFulfillmentMethod('pickup');
      if (paymentMethod === 'cash_on_delivery') setPaymentMethod('pay_at_pickup');
    } else if (fulfillmentMethod === 'pickup' && !shop.pickupAvailable && shop.deliveryAvailable) {
      setFulfillmentMethod('delivery');
      if (paymentMethod === 'pay_at_pickup') setPaymentMethod('cash_on_delivery');
    }
  }, [shop, fulfillmentMethod, paymentMethod]);

  if (shopItems.length === 0 || !shop) {
    return (
      <EmptyState
        title="Checkout unavailable"
        description="Your cart for this shop is empty."
        actionLabel="Return to Cart"
        onAction={() => navigate({ name: 'cart' })}
      />
    );
  }

  const summary = calculateCartSummary(
    shopItems,
    fulfillmentMethod,
    deliveryFeeEtb,
    promoCode,
    redeemLoyaltyPoints,
    loyaltyBalance,
    governanceConfig.freeDeliveryThresholdEtb
  );
  const checkoutGov = validateOrderAgainstGovernance({
    config: governanceConfig,
    userProfile,
    shop,
    totalAmount: summary.totalAmount,
  });
  const subtotalAfterPromo = Math.max(0, summary.subtotal - summary.promoDiscountAmount);
  const maxRedeemablePoints = calculateMaxRedeemablePoints(loyaltyBalance, subtotalAfterPromo);
  const activeAddress = addresses.find((a) => a.addressId === selectedAddressId) || addresses[0];

  const isStep1Valid = fulfillmentMethod === 'pickup' || Boolean(activeAddress);
  const liveRefStatus = validateGatewayReferenceLive(paymentMethod, paymentReference);
  const isStep3Valid = !isElectronicPaymentMethod(paymentMethod) || liveRefStatus.valid;

  const totalSavingsEtb = summary.promoDiscountAmount + summary.loyaltyDiscountAmount;
  const shopProximity = proximityByShopId[shop.shopId];
  const etaEstimate = getNeighborhoodDeliveryEstimate(
    fulfillmentMethod === 'delivery'
      ? activeAddress?.neighborhood ?? shop.neighborhood
      : shop.neighborhood
  );

  const handleCopyText = async (value: string, key: string) => {
    try {
      await navigator.clipboard?.writeText(value);
    } catch {
      // Ignore clipboard failures in restricted preview contexts
    }
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateAddressInput({
      label: addrLabel,
      recipientName,
      phoneNumber,
      neighborhood,
      streetOrLandmark,
    });
    if (Object.keys(errs).length > 0) {
      setAddrErrors(errs);
      return;
    }
    setAddrErrors({});
    await saveAddress({
      label: addrLabel.trim(),
      recipientName: recipientName.trim(),
      phoneNumber: phoneNumber.trim(),
      city: 'Hawassa',
      neighborhood,
      streetOrLandmark: streetOrLandmark.trim(),
      isDefault: true,
    });
    setShowNewAddressForm(false);
    setSubmitError(null);
  };

  const handleContinueStep1 = () => {
    setSubmitError(null);
    if (!isStep1Valid) {
      setShowNewAddressForm(true);
      setSubmitError(t('checkoutSelectAddressPrompt'));
      return;
    }
    setStep1Confirmed(true);
    setActiveStep(2);
  };

  const handleContinueStep2 = () => {
    setSubmitError(null);
    setStep1Confirmed(isStep1Valid);
    setStep2Confirmed(true);
    setActiveStep(3);
  };

  const handleAuthorizeChapa = () => {
    setChapaAuthorizing(true);
    setTimeout(() => {
      const ref = generateChapaTransactionRef();
      setPaymentReference(ref);
      setChapaAuthorizedRef(ref);
      setPaymentRefError(null);
      setSubmitError(null);
      setChapaAuthorizing(false);
      setChapaModalOpen(false);
    }, 450);
  };

  const handleConfirmOrder = async () => {
    setSubmitError(null);
    setPaymentRefError(null);

    if (fulfillmentMethod === 'delivery' && !activeAddress) {
      setActiveStep(1);
      setShowNewAddressForm(true);
      setSubmitError(t('checkoutSelectAddressPrompt'));
      return;
    }

    const refCheck = validatePaymentReference(paymentMethod, paymentReference);
    if (!refCheck.valid) {
      const msg = t(refCheck.errorKey ?? 'paymentReferenceInvalidError');
      setActiveStep(3);
      setPaymentRefError(msg);
      setSubmitError(msg);
      return;
    }

    setSubmitting(true);
    try {
      const order = await placeOrder({
        shopId: shop.shopId,
        fulfillmentMethod,
        deliveryAddress: fulfillmentMethod === 'delivery' ? activeAddress : undefined,
        paymentMethod,
        paymentReference: refCheck.normalizedRef || undefined,
        notes,
        promoCode: summary.promoCode ?? undefined,
        pointsToRedeem: summary.loyaltyPointsApplied,
      });

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion) {
        try {
          confetti({
            particleCount: 70,
            spread: 68,
            origin: { y: 0.72 },
            colors: ['#047857', '#10B981', '#D97706', '#F59E0B', '#FAF8F5'],
          });
        } catch {
          // ignore if canvas unsupported
        }
      }

      navigate({ name: 'order_confirmation', orderId: order.orderId });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to place order.');
    } finally {
      setSubmitting(false);
    }
  };

  const liveRefFeedbackText = (() => {
    if (!liveRefStatus.valid) return null;
    switch (liveRefStatus.detectedKind) {
      case 'trx':
        return t('paymentLiveRefValidTrx');
      case 'phone':
        return t('paymentLiveRefValidPhone');
      case 'numeric10':
        return t('paymentLiveRefValidNumeric10');
      case 'chapa':
        return t('paymentLiveRefValidChapa');
      default:
        return t('paymentLiveRefValidCustom');
    }
  })();

  const step1SummaryText =
    fulfillmentMethod === 'pickup'
      ? `${t('pickupShort')} · ${shop.name} (${getLocalizedNeighborhood(shop.neighborhood, language)})`
      : activeAddress
        ? `${activeAddress.label} · ${getLocalizedNeighborhood(activeAddress.neighborhood, language)} · ${activeAddress.phoneNumber}`
        : t('checkoutSelectAddressPrompt');

  const step2SummaryText = `${summary.itemCount} ${
    summary.itemCount === 1 ? t('itemSingle') : t('itemPlural')
  } · ${shop.name} · ${formatETB(summary.totalAmount)}`;

  const selectedPaymentDisplayLabel = (() => {
    switch (paymentMethod) {
      case 'telebirr':
        return t('telebirr');
      case 'cbe_birr':
        return t('cbeBirr');
      case 'chapa':
        return t('chapa');
      case 'pay_at_pickup':
        return t('payAtPickup');
      default:
        return t('cashOnDelivery');
    }
  })();

  const step3SummaryText = isElectronicPaymentMethod(paymentMethod)
    ? `${selectedPaymentDisplayLabel}${
        liveRefStatus.valid ? ` · ${liveRefStatus.normalizedRef}` : ''
      }`
    : `${selectedPaymentDisplayLabel} · 4-Digit PIN`;

  const stepHeaderButtonClass = (step: CheckoutStep) =>
    `w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-colors ${
      activeStep === step
        ? 'bg-[#FAF8F5] dark:bg-[#141A17]/80 border-b border-[#E7E5E4] dark:border-[#2A3630]'
        : 'hover:bg-[#FAF8F5]/70 dark:hover:bg-[#141A17]/40'
    }`;

  const thresholdDenom = Math.max(
    1,
    governanceConfig.freeDeliveryThresholdEtb || FREE_DELIVERY_THRESHOLD_ETB
  );
  const freeDeliveryProgressPct = Math.min(
    100,
    Math.round((summary.subtotal / thresholdDenom) * 100)
  );

  return (
    <div className="flex flex-col min-h-full bg-[#FAF8F5] dark:bg-[#141A17]">
      {/* Top Sticky Header & Stepper Progress Strip */}
      <header className="sticky top-0 z-20 bg-white dark:bg-[#1C2420] border-b border-[#E7E5E4] dark:border-[#2A3630]">
        <div className="px-3 py-2 flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center min-w-0 px-2">
            <h1 className="text-sm font-display font-bold text-stone-900 dark:text-stone-100 truncate">
              {t('checkoutTitle')} · {shop.name}
            </h1>
            <p className="text-[11px] font-medium text-[#047857] dark:text-[#10B981] flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3 shrink-0" />
              <span className="truncate">{t('escrowBadgeTitle')}</span>
            </p>
          </div>
          <div className="w-11" />
        </div>

        {/* Interactive 3-Step Progress Strip */}
        <div className="px-3 pb-2.5 grid grid-cols-3 gap-1.5">
          {(
            [
              {
                step: 1 as CheckoutStep,
                label: t('checkoutProgressStep1'),
                done: step1Confirmed && isStep1Valid,
              },
              {
                step: 2 as CheckoutStep,
                label: t('checkoutProgressStep2'),
                done: step2Confirmed,
              },
              {
                step: 3 as CheckoutStep,
                label: t('checkoutProgressStep3'),
                done: activeStep === 3 && isStep3Valid && step2Confirmed,
              },
            ] as const
          ).map((item) => {
            const isActive = activeStep === item.step;
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => setActiveStep(item.step)}
                className={`min-h-[44px] px-2 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  isActive
                    ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 border-[#047857] dark:border-[#10B981] text-[#047857] dark:text-[#10B981]'
                    : item.done
                      ? 'bg-white dark:bg-[#1C2420] border-[#047857]/30 dark:border-[#10B981]/30 text-stone-800 dark:text-stone-100'
                      : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] text-stone-500 dark:text-stone-400'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold tabular-nums shrink-0 ${
                    item.done && !isActive
                      ? 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410]'
                      : isActive
                        ? 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410]'
                        : 'bg-stone-200 dark:bg-[#2A3630] text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {item.done && !isActive ? <Check className="w-3 h-3" /> : item.step}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="p-4 space-y-3.5 pb-6 flex-1">
        {/* Governance or Submit Banner */}
        {!checkoutGov.allowed && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {checkoutGov.customMessage ||
                t(checkoutGov.errorKey ?? 'governanceOrderingPaused', {
                  limit: formatETB(governanceConfig.maxOrderAmountEtb),
                })}
            </span>
          </div>
        )}

        {submitError && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {/* ============================================================
            STEP 1: SHIPPING ADDRESS & HAWASSA NEIGHBORHOOD VERIFICATION
            ============================================================ */}
        <section
          data-testid="checkout-step-1"
          className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm overflow-hidden"
        >
          <button
            type="button"
            aria-expanded={activeStep === 1}
            onClick={() => setActiveStep(1)}
            className={stepHeaderButtonClass(1)}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums shrink-0 ${
                  step1Confirmed && isStep1Valid && activeStep !== 1
                    ? 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410]'
                    : 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] border border-[#047857]/30 dark:border-[#10B981]/30'
                }`}
              >
                {step1Confirmed && isStep1Valid && activeStep !== 1 ? (
                  <Check className="w-4 h-4" />
                ) : (
                  '1'
                )}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <span className="truncate">{t('checkoutStep1Title')}</span>
                  {step1Confirmed && isStep1Valid && activeStep !== 1 && (
                    <span className="text-[10px] font-semibold text-[#047857] dark:text-[#10B981] shrink-0">
                      · {t('checkoutStepComplete')}
                    </span>
                  )}
                </div>
                {activeStep !== 1 && (
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                    {step1SummaryText}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#047857] dark:text-[#10B981] shrink-0">
              {activeStep !== 1 && <span>{t('checkoutEditStep')}</span>}
              {activeStep === 1 ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {activeStep === 1 && (
            <div className="p-4 space-y-4">
              {/* Fulfillment Toggle */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  {t('fulfillment')}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={!shop.deliveryAvailable}
                    onClick={() => {
                      setFulfillmentMethod('delivery');
                      if (paymentMethod === 'pay_at_pickup') setPaymentMethod('cash_on_delivery');
                    }}
                    className={`p-3 rounded-xl border text-left transition-colors min-h-[44px] ${
                      fulfillmentMethod === 'delivery'
                        ? 'border-[#047857] dark:border-[#10B981] bg-[#ECFDF5] dark:bg-[#10B981]/15'
                        : 'border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] disabled:opacity-40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <Truck className="w-4 h-4 text-[#047857] dark:text-[#10B981]" />
                      {fulfillmentMethod === 'delivery' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981]" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {t('deliveryShort')}
                    </div>
                    <div className="text-[11px] text-stone-600 dark:text-stone-300 tabular-nums mt-0.5">
                      {summary.freeDeliveryUnlocked ? t('free') : formatETB(deliveryFeeEtb)} ·{' '}
                      {getNeighborhoodDeliveryEstimate(
                        activeAddress?.neighborhood ?? shop.neighborhood
                      ).label}
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={!shop.pickupAvailable}
                    onClick={() => {
                      setFulfillmentMethod('pickup');
                      if (paymentMethod === 'cash_on_delivery') setPaymentMethod('pay_at_pickup');
                    }}
                    className={`p-3 rounded-xl border text-left transition-colors min-h-[44px] ${
                      fulfillmentMethod === 'pickup'
                        ? 'border-[#047857] dark:border-[#10B981] bg-[#ECFDF5] dark:bg-[#10B981]/15'
                        : 'border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] disabled:opacity-40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <Store className="w-4 h-4 text-[#047857] dark:text-[#10B981]" />
                      {fulfillmentMethod === 'pickup' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981]" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {t('pickupShort')}
                    </div>
                    <div className="text-[11px] text-[#047857] dark:text-[#10B981] font-medium mt-0.5">
                      {t('free')} · {getLocalizedNeighborhood(shop.neighborhood, language)}
                    </div>
                  </button>
                </div>
              </div>

              {/* Delivery Address Book or Pickup Location */}
              {fulfillmentMethod === 'delivery' ? (
                <div className="space-y-3 pt-1 border-t border-[#E7E5E4] dark:border-[#2A3630]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {t('deliveryAddressSection')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNewAddressForm((s) => !s)}
                      className="min-h-[36px] px-2.5 text-xs font-semibold text-[#047857] dark:text-[#10B981] hover:underline"
                    >
                      {showNewAddressForm ? t('cancel') : `+ ${t('addNewAddress')}`}
                    </button>
                  </div>

                  {!showNewAddressForm && addresses.length > 0 && (
                    <div className="space-y-2">
                      {addresses.map((addr) => {
                        const isSelected = activeAddress?.addressId === addr.addressId;
                        return (
                          <button
                            key={addr.addressId}
                            type="button"
                            onClick={() => {
                              setSelectedAddressId(addr.addressId);
                              setSubmitError(null);
                            }}
                            className={`w-full p-3 rounded-xl border text-left transition-colors ${
                              isSelected
                                ? 'border-[#047857] dark:border-[#10B981] bg-[#ECFDF5]/70 dark:bg-[#10B981]/15'
                                : 'border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] hover:bg-white dark:hover:bg-[#1C2420]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs font-bold text-stone-900 dark:text-stone-100">
                              <span className="flex items-center gap-1.5 min-w-0">
                                <MapPin className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981] shrink-0" />
                                <span className="truncate">
                                  {addr.label} ·{' '}
                                  {getLocalizedNeighborhood(addr.neighborhood, language)}
                                </span>
                              </span>
                              <span className="text-[11px] font-medium text-stone-600 dark:text-stone-300 tabular-nums shrink-0">
                                {addr.phoneNumber}
                              </span>
                            </div>
                            <div className="text-xs text-stone-600 dark:text-stone-300 mt-1 pl-5">
                              {addr.streetOrLandmark}
                            </div>
                            <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 pl-5 flex items-center justify-between">
                              <span>{addr.recipientName}</span>
                              {isSelected && (
                                <span className="text-[#047857] dark:text-[#10B981] font-semibold">
                                  {t('checkoutAddressVerifiedBadge')}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {showNewAddressForm && (
                    <form onSubmit={handleSaveNewAddress} className="space-y-2.5 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label
                            htmlFor="addr-label"
                            className="block text-[11px] font-medium text-stone-600 dark:text-stone-300 mb-1"
                          >
                            Label
                          </label>
                          <input
                            id="addr-label"
                            type="text"
                            value={addrLabel}
                            onChange={(e) => setAddrLabel(e.target.value)}
                            placeholder="Home / Office"
                            className="w-full min-h-[42px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                          />
                          {addrErrors.label && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                              {addrErrors.label}
                            </p>
                          )}
                        </div>
                        <div>
                          <label
                            htmlFor="addr-neighborhood"
                            className="block text-[11px] font-medium text-stone-600 dark:text-stone-300 mb-1"
                          >
                            {t('neighborhood')}
                          </label>
                          <select
                            id="addr-neighborhood"
                            value={neighborhood}
                            onChange={(e) => setNeighborhood(e.target.value)}
                            className="w-full min-h-[42px] px-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] text-xs bg-[#FAF8F5] dark:bg-[#141A17] text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                          >
                            {HAWASSA_NEIGHBORHOODS.map((n) => (
                              <option key={n} value={n}>
                                {getLocalizedNeighborhood(n, language)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="addr-name"
                          className="block text-[11px] font-medium text-stone-600 dark:text-stone-300 mb-1"
                        >
                          Recipient Full Name
                        </label>
                        <input
                          id="addr-name"
                          type="text"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="e.g. Selamawit Bekele"
                          className="w-full min-h-[42px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                        />
                        {addrErrors.recipientName && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                            {addrErrors.recipientName}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="addr-phone"
                          className="block text-[11px] font-medium text-stone-600 dark:text-stone-300 mb-1"
                        >
                          Ethiopian Phone Number (+251)
                        </label>
                        <input
                          id="addr-phone"
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="+251 911 234 567"
                          className="w-full min-h-[42px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                        />
                        <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                          {t('checkoutPhonePrefixHint')}
                        </p>
                        {addrErrors.phoneNumber && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                            {addrErrors.phoneNumber}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="addr-landmark"
                          className="block text-[11px] font-medium text-stone-600 dark:text-stone-300 mb-1"
                        >
                          Street or Hawassa Landmark
                        </label>
                        <input
                          id="addr-landmark"
                          type="text"
                          value={streetOrLandmark}
                          onChange={(e) => setStreetOrLandmark(e.target.value)}
                          placeholder="e.g. Near Menhariya Bus Station, Blue Gate"
                          className="w-full min-h-[42px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                        />
                        {addrErrors.streetOrLandmark && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                            {addrErrors.streetOrLandmark}
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="w-full min-h-[44px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold transition-colors"
                      >
                        Save Hawassa Address
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#ECFDF5]/60 dark:bg-[#10B981]/10 border border-[#047857]/25 dark:border-[#10B981]/30 flex items-start gap-2.5 text-xs">
                  <MapPin className="w-4 h-4 text-[#047857] dark:text-[#10B981] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-bold text-stone-900 dark:text-stone-100">{shop.name}</div>
                    <div className="text-stone-600 dark:text-stone-300 mt-0.5">
                      {shop.address}, {getLocalizedNeighborhood(shop.neighborhood, language)}, Hawassa
                    </div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
                      Tel: {shop.phoneNumber}
                      {shopProximity ? ` · ${shopProximity.distanceLabel}` : ''}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleContinueStep1}
                className="w-full min-h-[44px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold transition-colors"
              >
                {t('checkoutContinueStep2')}
              </button>
            </div>
          )}
        </section>

        {/* ============================================================
            STEP 2: ORDER REVIEW & SELLER BREAKDOWN
            ============================================================ */}
        <section
          data-testid="checkout-step-2"
          className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm overflow-hidden"
        >
          <button
            type="button"
            aria-expanded={activeStep === 2}
            onClick={() => setActiveStep(2)}
            className={stepHeaderButtonClass(2)}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums shrink-0 ${
                  step2Confirmed && activeStep !== 2
                    ? 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410]'
                    : 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] border border-[#047857]/30 dark:border-[#10B981]/30'
                }`}
              >
                {step2Confirmed && activeStep !== 2 ? <Check className="w-4 h-4" /> : '2'}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <span className="truncate">{t('checkoutStep2Title')}</span>
                  {step2Confirmed && activeStep !== 2 && (
                    <span className="text-[10px] font-semibold text-[#047857] dark:text-[#10B981] shrink-0">
                      · {t('checkoutStepComplete')}
                    </span>
                  )}
                </div>
                {activeStep !== 2 && (
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5 tabular-nums">
                    {step2SummaryText}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#047857] dark:text-[#10B981] shrink-0">
              {activeStep !== 2 && <span>{t('checkoutEditStep')}</span>}
              {activeStep === 2 ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {activeStep === 2 && (
            <div className="p-4 space-y-4">
              {/* Multi-shop switch notice when buyer has multiple shops in cart */}
              {otherShopIds.length > 0 && (
                <div className="p-2.5 rounded-xl bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#FDE68A] dark:border-[#F59E0B]/30 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="font-semibold text-amber-900 dark:text-amber-200">
                    {t('checkoutSwitchShopNotice')}
                  </span>
                  {otherShopIds.map((otherId) => {
                    const otherShop = shopsById[otherId];
                    return (
                      <button
                        key={otherId}
                        type="button"
                        onClick={() => {
                          localStorage.setItem('hg_checkout_shop_id', otherId);
                          setSelectedShopId(otherId);
                        }}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-[#1C2420] border border-[#FDE68A] dark:border-[#F59E0B]/40 font-semibold text-[#92400E] dark:text-[#F59E0B] hover:bg-amber-50 dark:hover:bg-[#F59E0B]/20"
                      >
                        {t('checkoutSwitchShopBtn', { shop: otherShop?.name ?? 'Shop' })}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Seller Breakdown Header */}
              <div className="rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17]/70 overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-[#E7E5E4] dark:border-[#2A3630] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Store className="w-4 h-4 text-[#047857] dark:text-[#10B981] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                        {shop.name}
                      </div>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                        {t('checkoutSellerBreakdownLabel')} ·{' '}
                        {getLocalizedNeighborhood(shop.neighborhood, language)}
                        {shopProximity ? ` · ${shopProximity.distanceLabel}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-stone-500 dark:text-stone-400">
                      {t('checkoutEstimatedArrivalLabel')}
                    </div>
                    <div className="text-[11px] font-bold text-[#047857] dark:text-[#10B981] tabular-nums">
                      {fulfillmentMethod === 'delivery' ? etaEstimate.label : t('pickupEtaLabel')}
                    </div>
                  </div>
                </div>

                {/* Free Delivery Progress */}
                {fulfillmentMethod === 'delivery' && (
                  <div className="px-3.5 py-2 bg-[#ECFDF5]/50 dark:bg-[#10B981]/10 border-b border-[#E7E5E4] dark:border-[#2A3630] space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-stone-800 dark:text-stone-200">
                        {summary.freeDeliveryUnlocked
                          ? t('freeDeliveryUnlocked')
                          : t('addMoreForFreeDelivery', {
                              amount: formatETB(summary.amountToFreeDelivery),
                            })}
                      </span>
                      <span className="font-bold text-[#047857] dark:text-[#10B981] tabular-nums">
                        {freeDeliveryProgressPct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#E7E5E4] dark:bg-[#2A3630] overflow-hidden">
                      <div
                        className="h-full bg-[#047857] dark:bg-[#10B981] rounded-full transition-all duration-300"
                        style={{ width: `${freeDeliveryProgressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Itemized Shop Products */}
                <div className="divide-y divide-[#E7E5E4]/80 dark:divide-[#2A3630]">
                  {shopItems.map((item) => {
                    const unitPrice = getCartItemUnitPrice(item);
                    return (
                      <div
                        key={getCartItemKey(item.product.productId, item.variantId)}
                        className="px-3.5 py-2.5 flex items-center gap-3 bg-white dark:bg-[#1C2420]"
                      >
                        <div className="w-11 h-11 rounded-lg overflow-hidden bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] shrink-0">
                          <ResilientImage
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            fallbackTitle={item.product.name}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                            {item.product.name}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                            {item.quantity} × {formatETB(unitPrice)}
                            {item.variantLabel ? ` · ${item.variantLabel}` : ''}
                          </div>
                        </div>
                        <div className="text-xs font-bold text-stone-900 dark:text-stone-100 tabular-nums shrink-0">
                          {formatETB(unitPrice * item.quantity)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Promo Code Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="checkout-promo"
                    className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5"
                  >
                    <Tag className="w-3.5 h-3.5 text-[#C2410C] dark:text-[#FB923C]" />
                    <span>{t('promoCodeTitle')}</span>
                  </label>
                  {summary.promoCode && (
                    <button
                      type="button"
                      onClick={() => {
                        setPromoCode('');
                        setPromoDraft('');
                      }}
                      className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 hover:underline"
                    >
                      {t('removeCode')}
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    id="checkout-promo"
                    type="text"
                    value={promoDraft}
                    onChange={(e) => setPromoDraft(e.target.value.toUpperCase())}
                    placeholder={t('promoPlaceholder')}
                    className="flex-1 min-h-[42px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-xs font-mono uppercase text-stone-900 dark:text-stone-100 placeholder:normal-case placeholder:font-sans dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                  />
                  <button
                    type="button"
                    onClick={() => setPromoCode(promoDraft)}
                    className="px-4 min-h-[42px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold shrink-0 transition-colors"
                  >
                    {t('applyCode')}
                  </button>
                </div>
                {promoCode && summary.promoErrorKey && (
                  <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">
                    {t(summary.promoErrorKey, { amount: formatETB(summary.promoMinSubtotal ?? 0) })}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
                  <span className="text-stone-500 dark:text-stone-400">{t('availableCodes')}</span>
                  {PROMO_CODES.map((rule) => (
                    <button
                      key={rule.code}
                      type="button"
                      onClick={() => {
                        setPromoDraft(rule.code);
                        setPromoCode(rule.code);
                      }}
                      className={`px-2 py-0.5 rounded-md border font-mono text-[10px] font-semibold transition-colors ${
                        summary.promoCode === rule.code
                          ? 'bg-[#FFF7ED] dark:bg-[#C2410C]/20 text-[#C2410C] dark:text-[#FB923C] border-[#C2410C]/40 dark:border-[#FB923C]/40'
                          : 'bg-[#FAF8F5] dark:bg-[#141A17] text-stone-700 dark:text-stone-200 border-[#E7E5E4] dark:border-[#2A3630]'
                      }`}
                    >
                      {rule.code}
                    </button>
                  ))}
                </div>
              </div>

              {/* Redeem Hawasa Rewards Points */}
              <div className="pt-2 border-t border-[#E7E5E4] dark:border-[#2A3630] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-stone-900 dark:text-stone-100">
                    <Award className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B]" />
                    <span>{t('loyaltyRedeemSection')}</span>
                  </span>
                  <span className="text-[11px] font-medium text-stone-600 dark:text-stone-300 tabular-nums">
                    {t('loyaltyBalanceSummary', {
                      points: loyaltyBalance,
                      amount: formatETB(loyaltyBalance * LOYALTY_ETB_PER_POINT_REDEEMED),
                    })}
                  </span>
                </div>

                {maxRedeemablePoints >= LOYALTY_MIN_REDEEM_POINTS ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setRedeemLoyaltyPoints(
                            summary.loyaltyPointsApplied > 0 ? 0 : maxRedeemablePoints
                          )
                        }
                        className={`flex-1 min-h-[40px] px-3 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                          summary.loyaltyPointsApplied > 0
                            ? 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410]'
                            : 'border border-[#047857] dark:border-[#10B981] text-[#047857] dark:text-[#10B981] hover:bg-[#ECFDF5] dark:hover:bg-[#10B981]/15'
                        }`}
                      >
                        {summary.loyaltyPointsApplied > 0
                          ? t('loyaltyUsingPoints', {
                              points: summary.loyaltyPointsApplied,
                              amount: formatETB(summary.loyaltyDiscountAmount),
                            })
                          : t('loyaltyUsePointsBtn', {
                              points: maxRedeemablePoints,
                              amount: formatETB(
                                maxRedeemablePoints * LOYALTY_ETB_PER_POINT_REDEEMED
                              ),
                            })}
                      </button>
                      {summary.loyaltyPointsApplied > 0 && (
                        <button
                          type="button"
                          onClick={() => setRedeemLoyaltyPoints(0)}
                          className="min-h-[40px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17] whitespace-nowrap"
                        >
                          {t('loyaltyClearPoints')}
                        </button>
                      )}
                    </div>

                    {maxRedeemablePoints > LOYALTY_MIN_REDEEM_POINTS && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[10, 50, 100]
                          .filter((preset) => preset < maxRedeemablePoints)
                          .map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setRedeemLoyaltyPoints(preset)}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold tabular-nums transition-colors ${
                                summary.loyaltyPointsApplied === preset
                                  ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] border-[#047857]/40 dark:border-[#10B981]/40'
                                  : 'bg-[#FAF8F5] dark:bg-[#141A17] text-stone-700 dark:text-stone-200 border-[#E7E5E4] dark:border-[#2A3630]'
                              }`}
                            >
                              {t('loyaltyPointsShort', { points: preset })}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    {loyaltyBalance < LOYALTY_MIN_REDEEM_POINTS
                      ? t('loyaltyMinHint')
                      : t('loyaltyErrorOrderTooLow')}
                  </p>
                )}
              </div>

              {/* Optional Buyer Notes */}
              <div>
                <label
                  htmlFor="order-notes"
                  className="block text-xs font-bold text-stone-900 dark:text-stone-100 mb-1.5"
                >
                  {t('checkoutBuyerNotesOptional')}
                </label>
                <input
                  id="order-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('orderNotesPlaceholder')}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                />
              </div>

              {/* Itemized Price Breakdown */}
              <div className="pt-2 border-t border-[#E7E5E4] dark:border-[#2A3630] space-y-1.5 text-xs">
                <div className="flex justify-between text-stone-600 dark:text-stone-300">
                  <span>
                    {t('subtotal')} ({summary.itemCount}{' '}
                    {summary.itemCount === 1 ? t('itemSingle') : t('itemPlural')})
                  </span>
                  <span className="tabular-nums font-medium">{formatETB(summary.subtotal)}</span>
                </div>
                {summary.promoDiscountAmount > 0 && summary.promoCode && (
                  <div className="flex justify-between text-[#C2410C] dark:text-[#FB923C] font-semibold">
                    <span>{t('promoDiscountLabel', { code: summary.promoCode })}</span>
                    <span className="tabular-nums">-{formatETB(summary.promoDiscountAmount)}</span>
                  </div>
                )}
                {summary.loyaltyDiscountAmount > 0 && (
                  <div className="flex justify-between text-[#047857] dark:text-[#10B981] font-medium">
                    <span>
                      {t('loyaltyDiscountLine', { points: summary.loyaltyPointsApplied })}
                    </span>
                    <span className="tabular-nums">
                      -{formatETB(summary.loyaltyDiscountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-stone-600 dark:text-stone-300">
                  <span>{t('deliveryFee')}</span>
                  <span className="tabular-nums font-medium">
                    {summary.deliveryFee === 0 ? (
                      <span className="text-[#047857] dark:text-[#10B981] font-semibold">
                        {t('free')}
                      </span>
                    ) : (
                      formatETB(summary.deliveryFee)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-stone-900 dark:text-stone-100 pt-2 border-t border-[#E7E5E4] dark:border-[#2A3630]">
                  <span>{t('total')}</span>
                  <span className="tabular-nums text-[#047857] dark:text-[#10B981]">
                    {formatETB(summary.totalAmount)}
                  </span>
                </div>
                {summary.pointsToEarn > 0 && (
                  <div className="flex justify-between text-[11px] font-semibold text-[#D97706] dark:text-[#F59E0B] pt-0.5">
                    <span>{t('loyaltyEarnedLine')}</span>
                    <span className="tabular-nums">
                      +{t('loyaltyPointsShort', { points: summary.pointsToEarn })}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleContinueStep2}
                className="w-full min-h-[44px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold transition-colors"
              >
                {t('checkoutContinueStep3')}
              </button>
            </div>
          )}
        </section>

        {/* ============================================================
            STEP 3: SECURE PAYMENT METHOD SELECTOR & ESCROW PROTECTION
            ============================================================ */}
        <section
          data-testid="checkout-step-3"
          className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm overflow-hidden"
        >
          <button
            type="button"
            aria-expanded={activeStep === 3}
            onClick={() => setActiveStep(3)}
            className={stepHeaderButtonClass(3)}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums shrink-0 ${
                  activeStep !== 3 && isStep3Valid && step2Confirmed
                    ? 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410]'
                    : 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] border border-[#047857]/30 dark:border-[#10B981]/30'
                }`}
              >
                3
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                  {t('checkoutStep3Title')}
                </div>
                {activeStep !== 3 && (
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                    {step3SummaryText}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#047857] dark:text-[#10B981] shrink-0">
              {activeStep !== 3 && <span>{t('checkoutEditStep')}</span>}
              {activeStep === 3 ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {activeStep === 3 && (
            <div className="p-4 space-y-4">
              {/* Official Alibaba/AliExpress-style Escrow Protection Guarantee */}
              <div className="p-3.5 rounded-xl bg-[#ECFDF5]/80 dark:bg-[#10B981]/10 border border-[#047857]/30 dark:border-[#10B981]/30 space-y-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#065F46] dark:text-[#10B981]">
                      {t('escrowBadgeTitle')}
                    </div>
                    <p className="text-[11px] text-stone-700 dark:text-stone-200 mt-0.5 leading-relaxed">
                      {t('escrowGuaranteeDesc')}
                    </p>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-[#047857]/15 dark:border-[#10B981]/20 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-[#047857] dark:text-[#10B981]">
                  <span>{t('escrowMilestoneCheckout')}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t('escrowMilestoneHeld')}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t('escrowMilestonePinRelease')}</span>
                </div>
              </div>

              {/* Branded Interactive Payment Cards */}
              <div className="space-y-2.5">
                {/* 1. Telebirr */}
                <div
                  className={`rounded-xl border transition-colors ${
                    paymentMethod === 'telebirr'
                      ? 'border-[#047857] dark:border-[#10B981] bg-[#ECFDF5]/50 dark:bg-[#10B981]/10'
                      : 'border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('telebirr');
                      setPaymentRefError(null);
                      setSubmitError(null);
                    }}
                    className="w-full p-3.5 flex items-center justify-between gap-3 text-left min-h-[44px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#0284C7] text-white flex items-center justify-center font-display font-extrabold text-[11px] shrink-0">
                        TB
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                          {t('telebirr')}
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                          {t('telebirrCardTagline')}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        paymentMethod === 'telebirr'
                          ? 'border-[#047857] dark:border-[#10B981]'
                          : 'border-stone-300 dark:border-stone-600'
                      }`}
                    >
                      {paymentMethod === 'telebirr' && (
                        <span className="w-2 h-2 rounded-full bg-[#047857] dark:bg-[#10B981]" />
                      )}
                    </span>
                  </button>

                  {paymentMethod === 'telebirr' && (
                    <div className="px-3.5 pb-3.5 pt-2 border-t border-[#047857]/20 dark:border-[#10B981]/25 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2.5 rounded-lg bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-stone-500 dark:text-stone-400">
                              {t('paymentMerchantShortcode')}
                            </div>
                            <div className="font-mono font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-0.5">
                              {ETHIOPIAN_PAYMENT_CONFIG.telebirr.shortcode}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                ETHIOPIAN_PAYMENT_CONFIG.telebirr.shortcode,
                                'tb-code'
                              )
                            }
                            aria-label={t('paymentCopyShortcode')}
                            className="p-1.5 rounded-md border border-[#E7E5E4] dark:border-[#2A3630] text-[#047857] dark:text-[#10B981] hover:bg-[#ECFDF5] dark:hover:bg-[#10B981]/15 shrink-0"
                          >
                            {copiedKey === 'tb-code' ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630]">
                          <div className="text-stone-500 dark:text-stone-400">
                            {t('paymentAmountDue')}
                          </div>
                          <div className="font-bold text-[#047857] dark:text-[#10B981] tabular-nums mt-0.5">
                            {formatETB(summary.totalAmount)}
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] text-stone-600 dark:text-stone-300 flex items-center justify-between">
                        <span>{ETHIOPIAN_PAYMENT_CONFIG.telebirr.accountName}</span>
                        <span className="font-mono tabular-nums">
                          {ETHIOPIAN_PAYMENT_CONFIG.telebirr.merchantPhone}
                        </span>
                      </div>

                      {/* Live-Validated Telebirr Reference Input */}
                      <div className="space-y-1">
                        <label
                          htmlFor="payment-reference-input"
                          className="block text-[11px] font-semibold text-stone-700 dark:text-stone-200"
                        >
                          {t('paymentReferenceLabel')}
                        </label>
                        <input
                          id="payment-reference-input"
                          type="text"
                          maxLength={40}
                          value={paymentReference}
                          onChange={(e) => {
                            setPaymentReference(e.target.value.toUpperCase());
                            setPaymentRefError(null);
                            setSubmitError(null);
                          }}
                          placeholder="e.g. TRX8492019 or +251911223344"
                          className="w-full min-h-[42px] px-3 rounded-xl border border-[#047857]/40 dark:border-[#10B981]/40 bg-white dark:bg-[#1C2420] text-xs font-mono uppercase text-stone-900 dark:text-stone-100 placeholder:normal-case placeholder:font-sans placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                        />
                        {liveRefStatus.valid ? (
                          <p className="text-[11px] font-semibold text-[#047857] dark:text-[#10B981] flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {liveRefFeedbackText} ·{' '}
                              <span className="font-mono">{liveRefStatus.normalizedRef}</span>
                            </span>
                          </p>
                        ) : paymentReference.trim().length > 0 ? (
                          <p className="text-[11px] font-medium text-rose-700 dark:text-rose-400">
                            {t('paymentReferenceInvalidError')}
                          </p>
                        ) : (
                          <p className="text-[10px] text-stone-500 dark:text-stone-400 leading-relaxed">
                            {t('paymentLiveRefFormatGuide')}
                          </p>
                        )}
                        {paymentRefError && !liveRefStatus.valid && (
                          <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                            {paymentRefError}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. CBE Birr */}
                <div
                  className={`rounded-xl border transition-colors ${
                    paymentMethod === 'cbe_birr'
                      ? 'border-[#047857] dark:border-[#10B981] bg-[#ECFDF5]/50 dark:bg-[#10B981]/10'
                      : 'border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('cbe_birr');
                      setPaymentRefError(null);
                      setSubmitError(null);
                    }}
                    className="w-full p-3.5 flex items-center justify-between gap-3 text-left min-h-[44px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#6D28D9] text-white flex items-center justify-center font-display font-extrabold text-[11px] shrink-0">
                        CBE
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                          {t('cbeBirr')}
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                          {t('cbeBirrCardTagline')}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        paymentMethod === 'cbe_birr'
                          ? 'border-[#047857] dark:border-[#10B981]'
                          : 'border-stone-300 dark:border-stone-600'
                      }`}
                    >
                      {paymentMethod === 'cbe_birr' && (
                        <span className="w-2 h-2 rounded-full bg-[#047857] dark:bg-[#10B981]" />
                      )}
                    </span>
                  </button>

                  {paymentMethod === 'cbe_birr' && (
                    <div className="px-3.5 pb-3.5 pt-2 border-t border-[#047857]/20 dark:border-[#10B981]/25 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2.5 rounded-lg bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-stone-500 dark:text-stone-400">
                              {t('paymentMerchantShortcode')}
                            </div>
                            <div className="font-mono font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-0.5">
                              {ETHIOPIAN_PAYMENT_CONFIG.cbe_birr.shortcode}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                ETHIOPIAN_PAYMENT_CONFIG.cbe_birr.shortcode,
                                'cbe-code'
                              )
                            }
                            aria-label={t('paymentCopyShortcode')}
                            className="p-1.5 rounded-md border border-[#E7E5E4] dark:border-[#2A3630] text-[#047857] dark:text-[#10B981] hover:bg-[#ECFDF5] dark:hover:bg-[#10B981]/15 shrink-0"
                          >
                            {copiedKey === 'cbe-code' ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630]">
                          <div className="text-stone-500 dark:text-stone-400">
                            {t('paymentAmountDue')}
                          </div>
                          <div className="font-bold text-[#047857] dark:text-[#10B981] tabular-nums mt-0.5">
                            {formatETB(summary.totalAmount)}
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] text-stone-600 dark:text-stone-300 flex items-center justify-between">
                        <span>{ETHIOPIAN_PAYMENT_CONFIG.cbe_birr.accountName}</span>
                        <span className="font-mono tabular-nums">
                          {ETHIOPIAN_PAYMENT_CONFIG.cbe_birr.merchantPhone}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="payment-reference-input"
                          className="block text-[11px] font-semibold text-stone-700 dark:text-stone-200"
                        >
                          {t('paymentReferenceLabel')}
                        </label>
                        <input
                          id="payment-reference-input"
                          type="text"
                          maxLength={40}
                          value={paymentReference}
                          onChange={(e) => {
                            setPaymentReference(e.target.value.toUpperCase());
                            setPaymentRefError(null);
                            setSubmitError(null);
                          }}
                          placeholder={`e.g. ${ETHIOPIAN_PAYMENT_CONFIG.cbe_birr.exampleRef} or 1234567890`}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-[#047857]/40 dark:border-[#10B981]/40 bg-white dark:bg-[#1C2420] text-xs font-mono uppercase text-stone-900 dark:text-stone-100 placeholder:normal-case placeholder:font-sans placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                        />
                        {liveRefStatus.valid ? (
                          <p className="text-[11px] font-semibold text-[#047857] dark:text-[#10B981] flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {liveRefFeedbackText} ·{' '}
                              <span className="font-mono">{liveRefStatus.normalizedRef}</span>
                            </span>
                          </p>
                        ) : paymentReference.trim().length > 0 ? (
                          <p className="text-[11px] font-medium text-rose-700 dark:text-rose-400">
                            {t('paymentReferenceInvalidError')}
                          </p>
                        ) : (
                          <p className="text-[10px] text-stone-500 dark:text-stone-400 leading-relaxed">
                            {t('paymentLiveRefFormatGuide')}
                          </p>
                        )}
                        {paymentRefError && !liveRefStatus.valid && (
                          <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                            {paymentRefError}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Chapa Secured Card / Mobile Money Gateway */}
                <div
                  className={`rounded-xl border transition-colors ${
                    paymentMethod === 'chapa'
                      ? 'border-[#047857] dark:border-[#10B981] bg-[#ECFDF5]/50 dark:bg-[#10B981]/10'
                      : 'border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('chapa');
                      setPaymentRefError(null);
                      setSubmitError(null);
                    }}
                    className="w-full p-3.5 flex items-center justify-between gap-3 text-left min-h-[44px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#047857] text-white flex items-center justify-center shrink-0">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                          {t('chapa')}
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                          {t('chapaCardTagline')}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        paymentMethod === 'chapa'
                          ? 'border-[#047857] dark:border-[#10B981]'
                          : 'border-stone-300 dark:border-stone-600'
                      }`}
                    >
                      {paymentMethod === 'chapa' && (
                        <span className="w-2 h-2 rounded-full bg-[#047857] dark:bg-[#10B981]" />
                      )}
                    </span>
                  </button>

                  {paymentMethod === 'chapa' && (
                    <div className="px-3.5 pb-3.5 pt-2 border-t border-[#047857]/20 dark:border-[#10B981]/25 space-y-2.5">
                      {chapaAuthorizedRef && paymentReference === chapaAuthorizedRef && (
                        <div className="p-2.5 rounded-lg bg-white dark:bg-[#1C2420] border border-[#047857]/30 dark:border-[#10B981]/30 flex items-center justify-between gap-2 text-[11px]">
                          <span className="flex items-center gap-1.5 font-semibold text-[#047857] dark:text-[#10B981]">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>{t('chapaAuthorizedStatus')}</span>
                          </span>
                          <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                            {chapaAuthorizedRef}
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        data-testid="open-chapa-popup-btn"
                        onClick={() => setChapaModalOpen(true)}
                        className="w-full min-h-[44px] px-3 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {chapaAuthorizedRef && paymentReference === chapaAuthorizedRef
                            ? t('chapaReopenPopupBtn')
                            : t('chapaOpenPopupBtn')}
                        </span>
                      </button>

                      <div className="space-y-1">
                        <label
                          htmlFor="payment-reference-input"
                          className="block text-[11px] font-semibold text-stone-700 dark:text-stone-200"
                        >
                          {t('paymentReferenceLabel')}
                        </label>
                        <input
                          id="payment-reference-input"
                          type="text"
                          maxLength={40}
                          value={paymentReference}
                          onChange={(e) => {
                            setPaymentReference(e.target.value.toUpperCase());
                            setPaymentRefError(null);
                            setSubmitError(null);
                          }}
                          placeholder={`e.g. ${ETHIOPIAN_PAYMENT_CONFIG.chapa.exampleRef}`}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-[#047857]/40 dark:border-[#10B981]/40 bg-white dark:bg-[#1C2420] text-xs font-mono uppercase text-stone-900 dark:text-stone-100 placeholder:normal-case placeholder:font-sans placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                        />
                        {liveRefStatus.valid ? (
                          <p className="text-[11px] font-semibold text-[#047857] dark:text-[#10B981] flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {liveRefFeedbackText} ·{' '}
                              <span className="font-mono">{liveRefStatus.normalizedRef}</span>
                            </span>
                          </p>
                        ) : paymentReference.trim().length > 0 ? (
                          <p className="text-[11px] font-medium text-rose-700 dark:text-rose-400">
                            {t('paymentReferenceInvalidError')}
                          </p>
                        ) : null}
                        {paymentRefError && !liveRefStatus.valid && (
                          <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                            {paymentRefError}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Cash on Delivery or Pay at Pickup */}
                {fulfillmentMethod === 'delivery' ? (
                  <div
                    className={`rounded-xl border transition-colors ${
                      paymentMethod === 'cash_on_delivery'
                        ? 'border-[#047857] dark:border-[#10B981] bg-[#ECFDF5]/50 dark:bg-[#10B981]/10'
                        : 'border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('cash_on_delivery');
                        setPaymentRefError(null);
                        setSubmitError(null);
                      }}
                      className="w-full p-3.5 flex items-center justify-between gap-3 text-left min-h-[44px]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[#D97706] text-white flex items-center justify-center shrink-0">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                            {t('cashOnDelivery')}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                            {t('codCardTagline')}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          paymentMethod === 'cash_on_delivery'
                            ? 'border-[#047857] dark:border-[#10B981]'
                            : 'border-stone-300 dark:border-stone-600'
                        }`}
                      >
                        {paymentMethod === 'cash_on_delivery' && (
                          <span className="w-2 h-2 rounded-full bg-[#047857] dark:bg-[#10B981]" />
                        )}
                      </span>
                    </button>

                    {paymentMethod === 'cash_on_delivery' && (
                      <div className="px-3.5 pb-3.5 pt-2 border-t border-[#047857]/20 dark:border-[#10B981]/25">
                        <div className="p-2.5 rounded-lg bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#FDE68A] dark:border-[#F59E0B]/30 flex items-start gap-2 text-[11px]">
                          <KeyRound className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B] shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-[#92400E] dark:text-[#F59E0B]">
                              {t('codPinHandshakeTitle')}
                            </div>
                            <p className="text-amber-900/90 dark:text-amber-200 mt-0.5 leading-relaxed">
                              {t('codPinHandshakeNote')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className={`rounded-xl border transition-colors ${
                      paymentMethod === 'pay_at_pickup'
                        ? 'border-[#047857] dark:border-[#10B981] bg-[#ECFDF5]/50 dark:bg-[#10B981]/10'
                        : 'border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('pay_at_pickup');
                        setPaymentRefError(null);
                        setSubmitError(null);
                      }}
                      className="w-full p-3.5 flex items-center justify-between gap-3 text-left min-h-[44px]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[#D97706] text-white flex items-center justify-center shrink-0">
                          <Store className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                            {t('payAtPickup')}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                            {t('pickupPayCardTagline')}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          paymentMethod === 'pay_at_pickup'
                            ? 'border-[#047857] dark:border-[#10B981]'
                            : 'border-stone-300 dark:border-stone-600'
                        }`}
                      >
                        {paymentMethod === 'pay_at_pickup' && (
                          <span className="w-2 h-2 rounded-full bg-[#047857] dark:bg-[#10B981]" />
                        )}
                      </span>
                    </button>

                    {paymentMethod === 'pay_at_pickup' && (
                      <div className="px-3.5 pb-3.5 pt-2 border-t border-[#047857]/20 dark:border-[#10B981]/25">
                        <div className="p-2.5 rounded-lg bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#FDE68A] dark:border-[#F59E0B]/30 flex items-start gap-2 text-[11px]">
                          <KeyRound className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B] shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-[#92400E] dark:text-[#F59E0B]">
                              {t('codPinHandshakeTitle')}
                            </div>
                            <p className="text-amber-900/90 dark:text-amber-200 mt-0.5 leading-relaxed">
                              {t('codPinHandshakeNote')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* High-Contrast Sticky Bottom Summary Bar */}
      <div className="sticky bottom-0 z-20 bg-white dark:bg-[#1C2420] border-t border-[#E7E5E4] dark:border-[#2A3630] px-4 py-3 mt-auto shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
                {t('total')}
              </span>
              <span className="text-base font-display font-extrabold text-[#047857] dark:text-[#10B981] tabular-nums">
                {formatETB(summary.totalAmount)}
              </span>
            </div>
            <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums truncate">
              {summary.itemCount} {summary.itemCount === 1 ? t('itemSingle') : t('itemPlural')} ·{' '}
              {summary.deliveryFee === 0 ? t('free') : `${t('deliveryFee')} ${formatETB(summary.deliveryFee)}`}
              {totalSavingsEtb > 0 ? (
                <span className="text-[#C2410C] dark:text-[#FB923C] font-semibold">
                  {' '}
                  · {t('totalSavingsLine', { amount: formatETB(totalSavingsEtb) })}
                </span>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            disabled={submitting || !checkoutGov.allowed}
            onClick={handleConfirmOrder}
            className="min-h-[48px] px-4 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] disabled:opacity-60 text-white dark:text-[#0B1410] text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-sm"
          >
            <Lock className="w-4 h-4 shrink-0" />
            <span>{submitting ? t('submittingOrder') : t('placeSecureOrderBtn')}</span>
          </button>
        </div>
      </div>

      {/* Interactive Secured Chapa Checkout Popup Simulator Modal */}
      {chapaModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="chapa-modal-title"
          className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3"
        >
          <div className="w-full max-w-sm bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-xl overflow-hidden">
            <div className="px-4 py-3.5 bg-[#047857] text-white flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div id="chapa-modal-title" className="text-sm font-display font-bold flex items-center gap-1.5">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>{t('chapaModalTitle')}</span>
                </div>
                <div className="text-[11px] text-emerald-100 truncate">{t('chapaModalSubtitle')}</div>
              </div>
              <button
                type="button"
                aria-label={t('close')}
                onClick={() => setChapaModalOpen(false)}
                className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center hover:bg-white/15 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5">
              <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] flex items-center justify-between">
                <div className="text-xs text-stone-600 dark:text-stone-300">
                  {ETHIOPIAN_PAYMENT_CONFIG.chapa.accountName}
                </div>
                <div className="text-base font-display font-extrabold text-[#047857] dark:text-[#10B981] tabular-nums">
                  {formatETB(summary.totalAmount)}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-stone-700 dark:text-stone-200">
                  {t('chapaModalChannelLabel')}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'card', label: t('chapaChannelCard'), icon: CreditCard },
                      { id: 'telebirr', label: t('chapaChannelTelebirr'), icon: Phone },
                      { id: 'amole', label: t('chapaChannelAmole'), icon: Wallet },
                    ] as const
                  ).map((ch) => {
                    const Icon = ch.icon;
                    const selected = chapaChannel === ch.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => {
                          setChapaChannel(ch.id);
                          setChapaAccountInput(ch.id === 'card' ? '4821' : '0911223344');
                        }}
                        className={`p-2 rounded-xl border text-[11px] font-semibold flex flex-col items-center gap-1 transition-colors min-h-[44px] ${
                          selected
                            ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 border-[#047857] dark:border-[#10B981] text-[#047857] dark:text-[#10B981]'
                            : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="truncate max-w-full">{ch.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="chapa-account-input"
                  className="block text-[11px] font-semibold text-stone-700 dark:text-stone-200 mb-1"
                >
                  {t('chapaModalAccountLabel')}
                </label>
                <input
                  id="chapa-account-input"
                  type="text"
                  value={chapaAccountInput}
                  onChange={(e) => setChapaAccountInput(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-xs font-mono text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                />
              </div>

              <button
                type="button"
                disabled={chapaAuthorizing || chapaAccountInput.trim().length < 4}
                onClick={handleAuthorizeChapa}
                className="w-full min-h-[46px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] disabled:opacity-60 text-white dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  {chapaAuthorizing
                    ? t('chapaModalAuthorizing')
                    : t('chapaModalAuthorizeBtn', { amount: formatETB(summary.totalAmount) })}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const OrderConfirmationScreen: React.FC<{ orderId: string }> = ({ orderId }) => {
  const { navigate, orders, t } = useMarketplace();
  const order = orders.find((o) => o.orderId === orderId);
  const [copied, setCopied] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    if (confettiFiredRef.current) return;
    confettiFiredRef.current = true;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    try {
      confetti({
        particleCount: 55,
        spread: 60,
        origin: { y: 0.35 },
        colors: ['#047857', '#10B981', '#D97706', '#F59E0B', '#FAF8F5'],
      });
    } catch {
      // ignore if canvas unsupported
    }
  }, [orderId]);

  const handleCopyPin = async () => {
    if (!order?.deliveryPin) return;
    try {
      await navigator.clipboard?.writeText(order.deliveryPin);
    } catch {
      // Ignore clipboard failures in restricted preview contexts
    }
    setPinCopied(true);
    setTimeout(() => setPinCopied(false), 2000);
  };

  const handleCopyReceipt = async () => {
    if (!order) return;
    const lines = [
      `Hawasa Gebeya Receipt #${order.orderId.slice(-6).toUpperCase()}`,
      `Shop: ${order.shopName}`,
      `Date: ${new Date(order.createdAt).toLocaleString()}`,
      '---',
      ...order.items.map(
        (i) =>
          `${i.quantity}x ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ''} - ${formatETB(
            i.price * i.quantity
          )}`
      ),
      '---',
      `Subtotal: ${formatETB(order.subtotal)}`,
      ...(order.promoDiscountAmount
        ? [`Promo (${order.promoCode ?? 'Promo'}): -${formatETB(order.promoDiscountAmount)}`]
        : order.discountAmount && !order.pointsDiscountAmount
          ? [`Discount (${order.promoCode ?? 'Promo'}): -${formatETB(order.discountAmount)}`]
          : []),
      ...(order.pointsDiscountAmount
        ? [`Loyalty Points (${order.pointsRedeemed ?? 0} pts): -${formatETB(order.pointsDiscountAmount)}`]
        : []),
      `Delivery: ${order.deliveryFee === 0 ? 'Free' : formatETB(order.deliveryFee)}`,
      `Total: ${formatETB(order.totalAmount)}`,
      ...(order.pointsEarned ? [`Rewards Earned: +${order.pointsEarned} pts`] : []),
    ];
    try {
      await navigator.clipboard?.writeText(lines.join('\n'));
    } catch {
      // Clipboard may be restricted in headless contexts; show confirmation badge
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const promoDiscount =
    order?.promoDiscountAmount ??
    (order && !order.pointsDiscountAmount ? order.discountAmount ?? 0 : 0);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-5 text-center bg-[#FAF8F5] dark:bg-[#141A17] min-h-full">
      <div className="w-16 h-16 rounded-2xl bg-[#ECFDF5] dark:bg-[#10B981]/15 border border-[#047857]/25 dark:border-[#10B981]/30 text-[#047857] dark:text-[#10B981] flex items-center justify-center mb-3.5 shadow-sm">
        <Sparkles className="w-8 h-8" />
      </div>
      <h1 className="text-lg font-display font-bold text-stone-900 dark:text-stone-100">
        {t('orderSuccessEscrowTitle')}
      </h1>
      <p className="text-xs text-stone-600 dark:text-stone-300 mt-1.5 max-w-[300px] leading-relaxed">
        {t('orderSuccessSubtitlePin')}
      </p>

      {order && (
        <div className="w-full mt-5 p-4 rounded-2xl bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm text-left space-y-2.5 text-xs">
          {/* Escrow Protected Banner */}
          <div className="p-2.5 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/10 border border-[#047857]/25 dark:border-[#10B981]/30 flex items-center gap-2 text-[11px] font-semibold text-[#047857] dark:text-[#10B981]">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{t('escrowActiveOrderStatus')}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-stone-500 dark:text-stone-400">{t('orderReference')}</span>
            <span className="font-mono font-bold text-stone-900 dark:text-stone-100 tabular-nums">
              #{order.orderId.slice(-6).toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500 dark:text-stone-400">{t('shopLabel')}</span>
            <span className="font-semibold text-stone-900 dark:text-stone-100">{order.shopName}</span>
          </div>
          {promoDiscount > 0 && (
            <div className="flex justify-between text-[#C2410C] dark:text-[#FB923C] font-semibold">
              <span>
                {t('discountLabel')}
                {order.promoCode ? ` (${order.promoCode})` : ''}
              </span>
              <span className="tabular-nums">-{formatETB(promoDiscount)}</span>
            </div>
          )}
          {order.pointsDiscountAmount != null && order.pointsDiscountAmount > 0 && (
            <div className="flex justify-between text-[#047857] dark:text-[#10B981] font-medium">
              <span>{t('loyaltyDiscountLine', { points: order.pointsRedeemed ?? 0 })}</span>
              <span className="tabular-nums">-{formatETB(order.pointsDiscountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-stone-500 dark:text-stone-400">{t('total')}</span>
            <span className="font-bold text-[#047857] dark:text-[#10B981] tabular-nums">
              {formatETB(order.totalAmount)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-stone-500 dark:text-stone-400 shrink-0">{t('paymentMethod')}</span>
            <span className="font-semibold capitalize text-right text-stone-900 dark:text-stone-100">
              {order.paymentMethod.replace(/_/g, ' ')}
              {order.paymentReference ? ` · ${order.paymentReference}` : ''}
            </span>
          </div>
          {order.deliveryEtaLabel && (
            <div className="flex justify-between items-center text-stone-600 dark:text-stone-300">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981] shrink-0" />
                <span>{t('deliveryEtaPrefix')}</span>
              </span>
              <span className="font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                {order.deliveryEtaLabel}
              </span>
            </div>
          )}

          {/* Prominent Copyable 4-Digit Delivery PIN */}
          {order.deliveryPin && (
            <div className="p-3.5 rounded-xl bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#FDE68A] dark:border-[#F59E0B]/30 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-bold text-[#92400E] dark:text-[#F59E0B]">
                  <KeyRound className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('deliveryPinTitle')}</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyPin}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-[#1C2420] border border-[#FDE68A] dark:border-[#F59E0B]/40 text-[11px] font-semibold text-[#92400E] dark:text-[#F59E0B] hover:bg-amber-50 dark:hover:bg-[#F59E0B]/20"
                >
                  {pinCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{pinCopied ? t('pinCopiedLabel') : t('copyPinBtn')}</span>
                </button>
              </div>
              <div
                data-testid="confirmation-delivery-pin"
                className="py-1.5 px-3 rounded-lg bg-white dark:bg-[#1C2420] border border-[#FDE68A] dark:border-[#F59E0B]/30 text-center font-mono text-xl font-extrabold tracking-[0.35em] text-stone-950 dark:text-[#F59E0B] tabular-nums"
              >
                {order.deliveryPin}
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
                {t('deliveryPinShareHint')}
              </p>
            </div>
          )}

          {order.pointsEarned != null && order.pointsEarned > 0 && (
            <div className="pt-2 border-t border-[#E7E5E4] dark:border-[#2A3630] flex items-center justify-between gap-2 text-[#D97706] dark:text-[#F59E0B] font-semibold">
              <span className="flex items-center gap-1.5">
                <Award className="w-4 h-4 shrink-0" />
                <span>{t('loyaltyEarnedConfirmation', { points: order.pointsEarned })}</span>
              </span>
              <button
                type="button"
                onClick={() => navigate({ name: 'loyalty' })}
                className="text-[11px] underline shrink-0"
              >
                {t('loyaltyViewRewards')}
              </button>
            </div>
          )}

          <div className="pt-2 border-t border-[#E7E5E4] dark:border-[#2A3630] flex justify-end">
            <button
              type="button"
              onClick={handleCopyReceipt}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-[11px] font-semibold text-stone-700 dark:text-stone-200 hover:bg-white dark:hover:bg-[#1C2420] transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981]" />
                  <span className="text-[#047857] dark:text-[#10B981]">{t('receiptCopied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('copyReceipt')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Quick Action Hub Buttons */}
      <div className="w-full mt-5 space-y-2.5">
        <button
          type="button"
          onClick={() => navigate({ name: 'orders', selectedOrderId: orderId, initialTab: 'active' })}
          className="w-full min-h-[48px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <Truck className="w-4 h-4 shrink-0" />
          <span>{t('trackOrderLiveBtn')}</span>
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate({ name: 'orders', initialTab: 'history' })}
            className="min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#1C2420] text-stone-700 dark:text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17] transition-colors"
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('viewPurchaseHistoryBtn')}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate({ name: 'home' })}
            className="min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#1C2420] text-stone-700 dark:text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17] transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('continueShopping')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
