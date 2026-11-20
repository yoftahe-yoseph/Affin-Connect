import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Bell,
  Bookmark,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  CreditCard,
  Download,
  FileText,
  History,
  KeyRound,
  Lock,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  Store,
  Tag,
  Trash2,
  Truck,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { BRAND_ASSETS } from '../data/seedData';
import { EmptyState, ResilientImage } from '../components/SharedUI';
import { OrderReceiptModal } from '../components/OrderReceiptModal';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { getLocalizedNeighborhood } from '../constants/translations';
import {
  calculateCartSummary,
  calculateMaxRedeemablePoints,
  canNavigateToCheckoutStep,
  ETHIOPIAN_PAYMENT_CONFIG,
  formatETB,
  formatOrderReference,
  formatPaymentMethodDisplay,
  FREE_DELIVERY_THRESHOLD_ETB,
  getCartItemKey,
  getCartItemUnitPrice,
  getNeighborhoodDeliveryEstimate,
  getTailwindWidthClass,
  HAWASSA_NEIGHBORHOODS,
  isElectronicPaymentMethod,
  LOYALTY_ETB_PER_POINT_REDEEMED,
  LOYALTY_MIN_REDEEM_POINTS,
  PROMO_CODES,
  reconcileCartWithCatalog,
  validateAddressInput,
  validateGatewayReferenceLive,
  validateOrderAgainstGovernance,
  validatePaymentReference,
} from '../utils/marketplaceLogic';
import { downloadReceiptPdf } from '../utils/receiptPdf';
import type { PaymentMethod } from '../types';

function getProgressWidthClass(pct: number): string {
  const clamped = Math.max(0, Math.min(100, pct));
  if (clamped >= 100) return 'w-full';
  if (clamped >= 90) return 'w-[90%]';
  if (clamped >= 80) return 'w-[80%]';
  if (clamped >= 70) return 'w-[70%]';
  if (clamped >= 60) return 'w-[60%]';
  if (clamped >= 50) return 'w-[50%]';
  if (clamped >= 40) return 'w-[40%]';
  if (clamped >= 30) return 'w-[30%]';
  if (clamped >= 20) return 'w-[20%]';
  if (clamped > 0) return 'w-[10%]';
  return 'w-0';
}

export const CartScreen: React.FC = () => {
  const {
    navigate,
    cart,
    products,
    shopsById,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    syncCartWithLiveCatalog,
    favorites,
    toggleFavorite,
    promoCode,
    setPromoCode,
    deliveryFeeEtb,
    loyaltyBalance,
    redeemLoyaltyPoints,
    governanceConfig,
    firebaseUser,
    userProfile,
    unreadNotificationCount,
    language,
    t,
  } = useMarketplace();

  const [promoDraft, setPromoDraft] = useState(promoCode);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [cartFeedback, setCartFeedback] = useState<string | null>(null);
  const [isProceedingShopId, setIsProceedingShopId] = useState<string | null>(null);

  useEffect(() => {
    if (!cartFeedback) return;
    const timer = setTimeout(() => setCartFeedback(null), 3200);
    return () => clearTimeout(timer);
  }, [cartFeedback]);

  const cartReconciliation = useMemo(
    () =>
      reconcileCartWithCatalog(
        cart,
        products,
        shopsById,
        governanceConfig.strictShopVerification
      ),
    [cart, products, shopsById, governanceConfig.strictShopVerification]
  );

  const summary = useMemo(
    () =>
      calculateCartSummary(
        cartReconciliation.reconciledCart,
        'delivery',
        deliveryFeeEtb,
        promoCode,
        redeemLoyaltyPoints,
        loyaltyBalance,
        governanceConfig.freeDeliveryThresholdEtb
      ),
    [
      cartReconciliation.reconciledCart,
      deliveryFeeEtb,
      promoCode,
      redeemLoyaltyPoints,
      loyaltyBalance,
      governanceConfig.freeDeliveryThresholdEtb,
    ]
  );

  // Group reconciled entries by shop to preserve single-shop-per-order clarity
  const groupedByShop = useMemo(() => {
    const map: Record<string, typeof cartReconciliation.entries> = {};
    for (const entry of cartReconciliation.entries) {
      const shopId = entry.item.shopId;
      if (!map[shopId]) map[shopId] = [];
      map[shopId].push(entry);
    }
    return Object.entries(map);
  }, [cartReconciliation.entries]);

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    setPromoCode(promoDraft);
  };

  const handleConfirmClearCart = () => {
    clearCart();
    setClearConfirmOpen(false);
    setCartFeedback(t('cartClearedToast'));
  };

  const handleProceedToCheckout = (shopId: string) => {
    if (isProceedingShopId) return;
    setIsProceedingShopId(shopId);
    syncCartWithLiveCatalog(shopId);
    localStorage.setItem('hg_checkout_shop_id', shopId);
    navigate({ name: 'checkout' });
  };

  const displayName =
    userProfile?.displayName ||
    firebaseUser?.displayName ||
    firebaseUser?.email?.split('@')[0] ||
    '';

  const avatarInitials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const freeDeliveryThreshold = Math.max(0, governanceConfig.freeDeliveryThresholdEtb ?? 0);

  return (
    <div className="min-h-full bg-[#F3F6F4] dark:bg-[#031719] text-[#0E2421] dark:text-[#F5FAFA] pb-8 flex flex-col">
      {/* Compact Sticky Safe-Area Header */}
      <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 dark:bg-[#031719]/92 backdrop-blur-md border-b border-[#D2E0DC] dark:border-white/10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#EBF1EE] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] shrink-0 shadow-xs">
              <img
                src={BRAND_ASSETS.logo}
                alt="Affin Connect"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-display font-bold tracking-tight text-[#0F4C44] dark:text-[#F5FAFA] truncate">
                Affin Connect
              </div>
              <p className="text-[11px] text-[#46635E] dark:text-[#A9C0BD] truncate">
                {t('authHeaderSubtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggleButton />

            <button
              type="button"
              onClick={() => navigate({ name: 'notifications' })}
              aria-label={t('notifications')}
              className="relative min-w-[44px] min-h-[44px] rounded-xl bg-[#F3F6F4] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/50 dark:hover:border-[#00D68F]/50 flex items-center justify-center text-[#0E2421] dark:text-[#F5FAFA] transition-colors"
            >
              <Bell className="w-5 h-5 text-[#0F4C44] dark:text-[#00D68F]" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#0F4C44] dark:bg-[#00D68F] text-[#FCFDFC] dark:text-[#031719] text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate({ name: 'profile' })}
              aria-label={t('openProfileAria')}
              className="min-w-[44px] min-h-[44px] rounded-full p-0.5 bg-gradient-to-br from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] flex items-center justify-center shadow-md shadow-[#0F4C44]/20 dark:shadow-[#00D68F]/20 active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#FCFDFC] dark:bg-[#061D1B] flex items-center justify-center text-xs font-bold text-[#0F4C44] dark:text-[#F5FAFA]">
                {firebaseUser?.photoURL ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt={displayName || 'Profile'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : avatarInitials ? (
                  <span>{avatarInitials}</span>
                ) : (
                  <User className="w-4 h-4 text-[#0F4C44] dark:text-[#00D68F]" />
                )}
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Cart Heading Bar */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] flex items-center justify-center text-[#0F4C44] dark:text-[#00D68F] shrink-0 shadow-xs dark:shadow-none">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-display font-bold text-[#0F4C44] dark:text-[#F5FAFA] leading-tight flex items-center gap-2">
              <span>{t('myCartTitle')}</span>
              <span className="px-2 py-0.5 rounded-full bg-[#E5F2EE] dark:bg-[#092825] border border-[#0F4C44]/25 dark:border-[#14443F] text-[#0F4C44] dark:text-[#00D68F] text-xs font-bold tabular-nums">
                {summary.itemCount}
              </span>
            </h1>
            <p className="text-[11px] text-[#46635E] dark:text-[#A9C0BD] tabular-nums">
              {summary.itemCount} {summary.itemCount === 1 ? t('itemSingle') : t('itemPlural')}
            </p>
          </div>
        </div>

        {cart.length > 0 && (
          <button
            type="button"
            onClick={() => setClearConfirmOpen(true)}
            className="min-h-[44px] px-3 rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-rose-300 dark:border-rose-500/35 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>{t('clearCartBtn')}</span>
          </button>
        )}
      </div>

      {/* Inline Feedback Notice */}
      {cartFeedback && (
        <div
          role="status"
          aria-live="polite"
          className="mx-4 mt-2 px-3.5 py-2.5 rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#0F4C44]/35 dark:border-[#00D68F]/40 text-xs text-[#0E2421] dark:text-[#F5FAFA] flex items-center gap-2 shadow-sm"
        >
          <CheckCircle2 className="w-4 h-4 text-[#0F4C44] dark:text-[#00D68F] shrink-0" />
          <span>{cartFeedback}</span>
        </div>
      )}

      {cart.length === 0 ? (
        <div className="px-4 py-6 flex-1 flex flex-col justify-center">
          <div className="rounded-3xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] p-6 text-center shadow-[0_6px_22px_-8px_rgba(15,76,68,0.12)] dark:shadow-lg dark:shadow-black/25 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#E5F2EE] dark:bg-[#031719] border border-[#0F4C44]/18 dark:border-[#14443F] flex items-center justify-center text-[#0F4C44] dark:text-[#00D68F]">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 max-w-xs mx-auto">
              <h2 className="text-base font-display font-bold text-[#0F4C44] dark:text-[#F5FAFA]">
                {t('cartEmptySpecialTitle')}
              </h2>
              <p className="text-xs text-[#46635E] dark:text-[#A9C0BD] leading-relaxed">
                {t('cartEmptySpecialDesc')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate({ name: 'home' })}
              className="w-full min-h-[48px] px-5 rounded-2xl bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 text-[#FCFDFC] dark:text-[#031719] text-sm font-bold inline-flex items-center justify-center gap-2 shadow-lg shadow-[#0F4C44]/20 dark:shadow-[#00D68F]/20 active:scale-[0.99] transition-all"
            >
              <span>{t('startShopping')}</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 pt-2 space-y-4">
          {(governanceConfig.orderingPaused || userProfile?.accountStatus === 'suspended') && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/40 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">
                {userProfile?.accountStatus === 'suspended'
                  ? t('governanceUserSuspended')
                  : governanceConfig.maintenanceBanner?.trim() || t('governanceOrderingPaused')}
              </span>
            </div>
          )}

          {summary.hasMultipleShops && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-[#F59E0B]/15 border border-amber-300 dark:border-[#F59E0B]/40 flex items-start gap-2.5 text-xs text-amber-900 dark:text-[#FDE68A]">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-[#F59E0B] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">{t('multipleShopsTitle')}</div>
                <p className="text-[11px] text-amber-800/90 dark:text-[#FDE68A]/85 mt-0.5 leading-relaxed">
                  {t('multipleShopsDesc')}
                </p>
              </div>
            </div>
          )}

          {cartReconciliation.hasBlockingIssues && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/40 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{t('removeUnavailableHint')}</span>
            </div>
          )}

          {/* Promo / Voucher Code Card */}
          <section className="bg-[#FCFDFC] dark:bg-[#092825] rounded-2xl border border-[#D2E0DC] dark:border-[#14443F] p-4 space-y-2.5 shadow-[0_2px_10px_-3px_rgba(15,76,68,0.08)] dark:shadow-none">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#0F4C44] dark:text-[#F5FAFA]">
                <Tag className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#00D68F]" />
                <span>{t('promoCodeTitle')}</span>
              </span>
              {summary.promoCode && (
                <button
                  type="button"
                  onClick={() => {
                    setPromoCode('');
                    setPromoDraft('');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline min-h-[32px]"
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
                className="flex-1 min-h-[44px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#14443F] bg-[#F3F6F4] dark:bg-[#031719] text-xs font-mono uppercase text-[#0E2421] dark:text-[#F5FAFA] placeholder:normal-case placeholder:font-sans placeholder:text-[#46635E]/65 dark:placeholder:text-[#A9C0BD]/60 focus:outline-none focus:ring-2 focus:ring-[#0F4C44]/25 dark:focus:ring-[#00D68F]/25 focus:border-[#0F4C44] dark:focus:border-[#00D68F]"
              />
              <button
                type="submit"
                className="px-4 min-h-[44px] rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 text-[#FCFDFC] dark:text-[#031719] text-xs font-bold shrink-0 transition-all"
              >
                {t('applyCode')}
              </button>
            </form>

            {promoCode && summary.promoErrorKey && (
              <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                {t(summary.promoErrorKey, {
                  amount: formatETB(summary.promoMinSubtotal ?? 0),
                })}
              </p>
            )}
            {summary.promoCode && !summary.promoErrorKey && (
              <p className="text-[11px] font-semibold text-[#047857] dark:text-[#00D68F] bg-[#ECFDF5] dark:bg-[#00D68F]/10 border border-[#047857]/30 dark:border-[#00D68F]/30 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{t('promoApplied', { code: summary.promoCode })}</span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
              <span className="text-[#4B6B67] dark:text-[#A9C0BD] font-medium">
                {t('availableCodes')}
              </span>
              {PROMO_CODES.map((rule) => (
                <button
                  key={rule.code}
                  type="button"
                  onClick={() => {
                    setPromoDraft(rule.code);
                    setPromoCode(rule.code);
                  }}
                  title={t(rule.summaryKey)}
                  className={`px-2 py-1 rounded-lg border font-mono text-[10px] font-semibold transition-colors ${
                    summary.promoCode === rule.code
                      ? 'bg-[#ECFDF5] dark:bg-[#00D68F]/15 text-[#047857] dark:text-[#00D68F] border-[#047857]/50 dark:border-[#00D68F]/50'
                      : 'bg-[#F3F6F4] dark:bg-[#031719] text-[#46635E] dark:text-[#A9C0BD] border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/45 dark:hover:border-[#00D68F]/45 hover:text-[#0E2421] dark:hover:text-[#F5FAFA]'
                  }`}
                >
                  {rule.code}
                </button>
              ))}
            </div>
          </section>

          {groupedByShop.map(([shopId, shopEntries]) => {
            const shop = shopsById[shopId];
            const reconciledShopItems = shopEntries.map((e) => e.reconciledItem);
            const shopSummary = calculateCartSummary(
              reconciledShopItems,
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
            const shopHasBlockingIssues =
              shopEntries.some((e) => e.isUnavailable || e.exceedsStock) ||
              shopSummary.hasStockIssues;

            const thresholdDenom = Math.max(
              1,
              governanceConfig.freeDeliveryThresholdEtb || FREE_DELIVERY_THRESHOLD_ETB
            );
            const progressPct = Math.min(
              100,
              Math.round((shopSummary.subtotal / thresholdDenom) * 100)
            );
            const progressWidthClass = getProgressWidthClass(progressPct);

            return (
              <div key={shopId} className="space-y-3">
                {/* Shop Product Cards Container */}
                <section className="bg-[#FCFDFC] dark:bg-[#092825] rounded-2xl border border-[#D2E0DC] dark:border-[#14443F] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-md dark:shadow-black/20 overflow-hidden">
                  <div className="px-4 py-3 bg-[#E7F1ED] dark:bg-[#061D1B] border-b border-[#D2E0DC] dark:border-[#14443F] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => navigate({ name: 'shop', shopId })}
                      className="flex items-center gap-2 text-xs font-bold text-[#0F4C44] dark:text-[#00D68F] hover:underline min-w-0"
                    >
                      <Store className="w-4 h-4 shrink-0" />
                      <span className="truncate">{shop?.name ?? 'Hawassa Shop'}</span>
                    </button>
                    {shop?.neighborhood && (
                      <span className="text-[11px] text-[#46635E] dark:text-[#A9C0BD] shrink-0">
                        {getLocalizedNeighborhood(shop.neighborhood, language)}
                      </span>
                    )}
                  </div>

                  {/* Real Free Delivery Progress Bar (when configured) */}
                  {freeDeliveryThreshold > 0 && (
                    <div className="px-4 py-2.5 bg-[#F3F6F4] dark:bg-[#031719]/65 border-b border-[#D2E0DC] dark:border-[#14443F] space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="flex items-center gap-1.5 font-medium text-[#0C2624] dark:text-[#F5FAFA]">
                          <Truck className="w-3.5 h-3.5 text-[#047857] dark:text-[#00D68F] shrink-0" />
                          <span>
                            {shopSummary.freeDeliveryUnlocked
                              ? t('freeDeliveryUnlocked')
                              : t('addMoreForFreeDelivery', {
                                  amount: formatETB(shopSummary.amountToFreeDelivery),
                                })}
                          </span>
                        </span>
                        <span className="tabular-nums font-bold text-[#047857] dark:text-[#00D68F] shrink-0">
                          {progressPct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#DCEAE6] dark:bg-[#031719] overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r from-[#047857] to-[#0D9488] dark:from-[#00D68F] dark:to-[#00C8D7] rounded-full transition-all duration-300 ${progressWidthClass}`}
                        />
                      </div>
                    </div>
                  )}

                  <div className="divide-y divide-[#D5E6E2] dark:divide-[#14443F]">
                    {shopEntries.map((entry) => {
                      const {
                        item,
                        snapshotUnitPrice,
                        liveUnitPrice,
                        priceChanged,
                        availableStock,
                        isUnavailable,
                        exceedsStock,
                      } = entry;
                      const { product, quantity, variantId, variantLabel } = item;
                      const itemKey = getCartItemKey(product.productId, variantId);
                      const lineSubtotal = liveUnitPrice * quantity;
                      const canDecrement = quantity > 1 && !isUnavailable;
                      const canIncrement = !isUnavailable && quantity < availableStock;

                      return (
                        <article
                          key={itemKey}
                          className={`p-3.5 space-y-2.5 ${
                            isUnavailable ? 'bg-rose-50/60 dark:bg-rose-950/25' : ''
                          }`}
                        >
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                navigate({ name: 'product', productId: product.productId })
                              }
                              aria-label={product.name}
                              className="w-20 h-20 rounded-xl overflow-hidden bg-[#EDF5F3] dark:bg-[#061D1B] shrink-0 border border-[#D5E6E2] dark:border-[#14443F] hover:border-[#047857]/50 dark:hover:border-[#00D68F]/50 transition-colors"
                            >
                              <ResilientImage
                                src={product.imageUrl}
                                alt={product.name}
                                fallbackTitle={product.name}
                                darkSurface
                              />
                            </button>

                            <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigate({ name: 'product', productId: product.productId })
                                    }
                                    className="text-left text-xs sm:text-sm font-semibold text-[#0C2624] dark:text-[#F5FAFA] hover:text-[#047857] dark:hover:text-[#00D68F] transition-colors break-words leading-snug"
                                  >
                                    {product.name}
                                  </button>
                                  {variantLabel && (
                                    <div className="text-[11px] text-[#0F766E] dark:text-[#00C8D7] font-medium mt-0.5 break-words">
                                      {variantLabel}
                                    </div>
                                  )}
                                  <div className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] mt-1 tabular-nums">
                                    {t('unitPriceLabel')}:{' '}
                                    <span className="font-semibold text-[#0C2624] dark:text-[#F5FAFA]">
                                      {formatETB(liveUnitPrice)}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeFromCart(product.productId, variantId)}
                                  aria-label={`${t('removeItemBtn')} ${product.name}`}
                                  className="min-w-[40px] min-h-[40px] -mt-1 -mr-1 rounded-xl flex items-center justify-center text-[#4B6B67] dark:text-[#A9C0BD] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 shrink-0 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-1">
                                <div className="text-sm font-display font-bold text-[#047857] dark:text-[#00D68F] tabular-nums">
                                  {formatETB(lineSubtotal)}
                                </div>

                                <div className="flex items-center gap-1 border border-[#D2E0DC] dark:border-[#14443F] bg-[#F3F6F4] dark:bg-[#031719] rounded-xl p-0.5">
                                  <button
                                    type="button"
                                    aria-label={`Decrease quantity of ${product.name}`}
                                    disabled={!canDecrement}
                                    onClick={() =>
                                      updateCartQuantity(product.productId, quantity - 1, variantId)
                                    }
                                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-[#092825] text-[#0C2624] dark:text-[#F5FAFA] disabled:opacity-35 disabled:pointer-events-none transition-colors"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="w-7 text-center text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA] tabular-nums">
                                    {quantity}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={`Increase quantity of ${product.name}`}
                                    disabled={!canIncrement}
                                    onClick={() =>
                                      updateCartQuantity(product.productId, quantity + 1, variantId)
                                    }
                                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-[#092825] text-[#0C2624] dark:text-[#F5FAFA] disabled:opacity-35 disabled:pointer-events-none transition-colors"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Status Alerts for Availability, Stock Limit, or Price Updates */}
                          {isUnavailable && (
                            <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/40 flex items-center justify-between gap-2 text-[11px] text-rose-800 dark:text-rose-200">
                              <span className="font-semibold flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                <span>{t('itemUnavailableLabel')}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFromCart(product.productId, variantId)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 dark:bg-rose-500/25 hover:bg-rose-700 dark:hover:bg-rose-500/40 text-white dark:text-rose-100 font-bold shrink-0"
                              >
                                {t('removeItemBtn')}
                              </button>
                            </div>
                          )}

                          {!isUnavailable && exceedsStock && (
                            <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-[#F59E0B]/15 border border-amber-300 dark:border-[#F59E0B]/40 flex items-center justify-between gap-2 text-[11px] text-amber-900 dark:text-[#FDE68A]">
                              <span className="font-medium flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-[#F59E0B] shrink-0" />
                                <span>
                                  {t('stockLimitReached', { stock: availableStock })}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateCartQuantity(product.productId, availableStock, variantId)
                                }
                                className="px-2.5 py-1 rounded-lg bg-amber-500 dark:bg-[#F59E0B] text-white dark:text-[#031719] font-bold shrink-0 tabular-nums"
                              >
                                {availableStock}
                              </button>
                            </div>
                          )}

                          {priceChanged && (
                            <div className="px-3 py-2 rounded-xl bg-teal-50 dark:bg-[#00C8D7]/15 border border-teal-300 dark:border-[#00C8D7]/40 flex items-center justify-between gap-2 text-[11px] text-[#0C2624] dark:text-[#F5FAFA]">
                              <span>
                                {t('priceUpdatedLabel', {
                                  oldPrice: formatETB(snapshotUnitPrice),
                                  newPrice: formatETB(liveUnitPrice),
                                })}
                              </span>
                              <button
                                type="button"
                                onClick={() => syncCartWithLiveCatalog(shopId)}
                                className="px-2.5 py-1 rounded-lg bg-[#0F766E] dark:bg-[#00C8D7] text-white dark:text-[#031719] font-bold shrink-0"
                              >
                                {t('syncLivePriceBtn')}
                              </button>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (!favorites.includes(product.productId)) {
                                  toggleFavorite(product.productId);
                                }
                                removeFromCart(product.productId, variantId);
                              }}
                              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#4B6B67] dark:text-[#A9C0BD] hover:text-[#047857] dark:hover:text-[#00D68F] transition-colors min-h-[32px]"
                            >
                              <Bookmark className="w-3.5 h-3.5" />
                              <span>{t('saveForLater')}</span>
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                {/* Separate Order Summary Card */}
                <section className="bg-[#FCFDFC] dark:bg-[#092825] rounded-2xl border border-[#D2E0DC] dark:border-[#14443F] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-md dark:shadow-black/20 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#D2E0DC] dark:border-[#14443F]">
                    <h2 className="text-sm font-display font-bold text-[#0F4C44] dark:text-[#F5FAFA]">
                      {t('orderSummary')}
                    </h2>
                    {groupedByShop.length > 1 && (
                      <span className="text-[11px] font-semibold text-[#047857] dark:text-[#00D68F] truncate">
                        {shop?.name ?? 'Hawassa Shop'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[#4B6B67] dark:text-[#A9C0BD]">
                      <span>{t('shopSubtotal')}</span>
                      <span className="font-semibold text-[#0C2624] dark:text-[#F5FAFA] tabular-nums">
                        {formatETB(shopSummary.subtotal)}
                      </span>
                    </div>

                    {shopSummary.promoDiscountAmount > 0 && shopSummary.promoCode && (
                      <div className="flex items-center justify-between text-[#047857] dark:text-[#00D68F] font-semibold">
                        <span>{t('promoDiscountLabel', { code: shopSummary.promoCode })}</span>
                        <span className="tabular-nums">
                          -{formatETB(shopSummary.promoDiscountAmount)}
                        </span>
                      </div>
                    )}

                    {shopSummary.loyaltyDiscountAmount > 0 && (
                      <div className="flex items-center justify-between text-[#047857] dark:text-[#00D68F] font-medium">
                        <span>
                          {t('loyaltyDiscountLine', { points: shopSummary.loyaltyPointsApplied })}
                        </span>
                        <span className="tabular-nums">
                          -{formatETB(shopSummary.loyaltyDiscountAmount)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[#4B6B67] dark:text-[#A9C0BD]">
                      <span>{t('deliveryFee')}</span>
                      <span className="tabular-nums font-medium text-[#0C2624] dark:text-[#F5FAFA]">
                        {shopSummary.deliveryFee === 0 ? (
                          <span className="text-[#047857] dark:text-[#00D68F] font-bold">
                            {t('free')}
                          </span>
                        ) : (
                          formatETB(shopSummary.deliveryFee)
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm font-bold text-[#0C2624] dark:text-[#F5FAFA] pt-2.5 border-t border-[#D5E6E2] dark:border-[#14443F]">
                      <span>{t('totalPayableLabel')}</span>
                      <span className="text-base font-display font-extrabold text-[#047857] dark:text-[#00D68F] tabular-nums">
                        {formatETB(shopSummary.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {shopSummary.pointsToEarn > 0 && (
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#047857] dark:text-[#00D68F] font-semibold bg-[#ECFDF5] dark:bg-[#00D68F]/10 border border-[#047857]/25 dark:border-[#00D68F]/25 rounded-xl px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('loyaltyEarnEstimate', { points: shopSummary.pointsToEarn })}</span>
                      </span>
                      {loyaltyBalance >= LOYALTY_MIN_REDEEM_POINTS && (
                        <button
                          type="button"
                          onClick={() => navigate({ name: 'loyalty' })}
                          className="underline font-semibold shrink-0 hover:text-[#0F766E] dark:hover:text-[#00C8D7]"
                        >
                          {t('loyaltyPointsShort', { points: loyaltyBalance })}
                        </button>
                      )}
                    </div>
                  )}

                  {shopHasBlockingIssues && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                      {shopSummary.stockIssues[0] ?? t('removeUnavailableHint')}
                    </p>
                  )}

                  {!shopGov.allowed && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                      {shopGov.customMessage ||
                        t(shopGov.errorKey ?? 'governanceOrderingPaused', {
                          limit: formatETB(governanceConfig.maxOrderAmountEtb),
                        })}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={
                      isProceedingShopId === shopId || shopHasBlockingIssues || !shopGov.allowed
                    }
                    onClick={() => handleProceedToCheckout(shopId)}
                    className="w-full min-h-[48px] px-4 rounded-2xl bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 text-[#FCFDFC] dark:text-[#031719] text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#0F4C44]/20 dark:shadow-[#00D68F]/20 active:scale-[0.99] transition-all disabled:opacity-45 disabled:pointer-events-none"
                  >
                    <span>
                      {groupedByShop.length > 1
                        ? `${t('proceedToCheckoutArrow')} · ${shop?.name ?? 'Shop'}`
                        : t('proceedToCheckoutArrow')}
                    </span>
                  </button>
                </section>
              </div>
            );
          })}

          {/* Delivery Promotion Banner */}
          <section className="rounded-2xl bg-gradient-to-br from-[#E6F1ED] via-[#FCFDFC] to-[#F3F6F4] dark:from-[#092825] dark:to-[#061D1B] border border-[#0F4C44]/22 dark:border-[#14443F] p-4 flex items-center justify-between gap-3 shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-md dark:shadow-black/20">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#FCFDFC] dark:bg-[#031719] border border-[#D2E0DC] dark:border-[#14443F] flex items-center justify-center text-[#0F4C44] dark:text-[#00D68F] shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-display font-bold text-[#0F4C44] dark:text-[#F5FAFA]">
                  {t('cartPromoBannerTitle')}
                </h3>
                <p className="text-[11px] text-[#46635E] dark:text-[#A9C0BD] mt-0.5 leading-relaxed">
                  {freeDeliveryThreshold > 0
                    ? t('freeDeliveryAbove', { amount: formatETB(freeDeliveryThreshold) })
                    : t('shopsDeliveryDesc')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate({ name: 'home' })}
              className="min-h-[40px] px-3.5 rounded-xl bg-[#0F4C44] dark:bg-[#031719] border border-[#0F4C44] dark:border-[#00D68F]/40 hover:bg-[#047857] dark:hover:bg-[#00D68F] dark:hover:text-[#031719] text-[#FCFDFC] dark:text-[#00D68F] text-xs font-bold shrink-0 transition-colors"
            >
              {t('shopMore')}
            </button>
          </section>
        </div>
      )}

      {/* In-App Clear Cart Confirmation Modal */}
      {clearConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-cart-modal-title"
          className="fixed inset-0 z-50 bg-black/50 dark:bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/35 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2
                  id="clear-cart-modal-title"
                  className="text-sm font-display font-bold text-[#0C2624] dark:text-[#F5FAFA]"
                >
                  {t('clearCartConfirmTitle')}
                </h2>
                <p className="text-xs text-[#4B6B67] dark:text-[#A9C0BD] mt-1 leading-relaxed">
                  {t('clearCartConfirmDesc', { count: summary.itemCount })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setClearConfirmOpen(false)}
                className="min-h-[44px] px-4 rounded-xl bg-[#EDF5F3] dark:bg-[#031719] border border-[#D5E6E2] dark:border-[#14443F] hover:border-[#047857]/50 dark:hover:border-[#00D68F]/50 text-xs font-semibold text-[#0C2624] dark:text-[#F5FAFA] transition-colors"
              >
                {t('keepItemsBtn')}
              </button>
              <button
                type="button"
                onClick={handleConfirmClearCart}
                className="min-h-[44px] px-4 rounded-xl bg-rose-600 dark:bg-rose-500 hover:bg-rose-700 dark:hover:bg-rose-600 text-xs font-bold text-white transition-colors"
              >
                {t('confirmClearCartBtn')}
              </button>
            </div>
          </div>
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
    products,
    shopsById,
    proximityByShopId,
    addresses,
    saveAddress,
    placeOrder,
    paymentProviders,
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

  const rawShopItems = cart.filter((c) => c.shopId === effectiveShopId);
  const shopCheckoutReconciliation = useMemo(
    () =>
      reconcileCartWithCatalog(
        rawShopItems,
        products,
        shopsById,
        governanceConfig.strictShopVerification
      ),
    [rawShopItems, products, shopsById, governanceConfig.strictShopVerification]
  );
  const shopItems = shopCheckoutReconciliation.reconciledCart;
  const shop = shopsById[effectiveShopId];
  const otherShopIds = groupedShopIds.filter((id) => id !== effectiveShopId);

  const [activeStep, setActiveStep] = useState<CheckoutStep>(1);
  const [step2Confirmed, setStep2Confirmed] = useState<boolean>(false);

  const [fulfillmentMethod, setFulfillmentMethod] = useState<'delivery' | 'pickup'>(
    shop?.deliveryAvailable === false && shop?.pickupAvailable ? 'pickup' : 'delivery'
  );
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    addresses.find((a) => a.isDefault)?.addressId || addresses[0]?.addressId || ''
  );
  const [showNewAddressForm, setShowNewAddressForm] = useState(addresses.length === 0);
  const [promoDraft, setPromoDraft] = useState(promoCode);
  const [promoFeedback, setPromoFeedback] = useState<string | null>(null);

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
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const checkoutSessionKeyRef = useRef<string>(
    `chk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  useEffect(() => {
    const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
    if (
      defaultAddr &&
      (!selectedAddressId || !addresses.some((a) => a.addressId === selectedAddressId))
    ) {
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

  const shopProximity = proximityByShopId[shop.shopId];
  const etaEstimate = getNeighborhoodDeliveryEstimate(
    fulfillmentMethod === 'delivery'
      ? activeAddress?.neighborhood ?? shop.neighborhood
      : shop.neighborhood
  );

  const thresholdDenom = Math.max(
    1,
    governanceConfig.freeDeliveryThresholdEtb || FREE_DELIVERY_THRESHOLD_ETB
  );
  const freeDeliveryProgressPct = Math.min(
    100,
    Math.round((summary.subtotal / thresholdDenom) * 100)
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

  const handleStepSelect = (targetStep: CheckoutStep) => {
    if (
      canNavigateToCheckoutStep({
        targetStep,
        isStep1Valid,
        step2Confirmed,
      })
    ) {
      setSubmitError(null);
      setActiveStep(targetStep);
      return;
    }
    if (targetStep >= 2 && !isStep1Valid) {
      setShowNewAddressForm(true);
      setSubmitError(t('checkoutSelectAddressPrompt'));
    }
  };

  const handleContinueStep1 = () => {
    setSubmitError(null);
    if (!isStep1Valid) {
      setShowNewAddressForm(true);
      setSubmitError(t('checkoutSelectAddressPrompt'));
      return;
    }
    setActiveStep(2);
  };

  const handleContinueStep2 = () => {
    setSubmitError(null);
    if (!isStep1Valid) {
      setActiveStep(1);
      setShowNewAddressForm(true);
      setSubmitError(t('checkoutSelectAddressPrompt'));
      return;
    }
    setStep2Confirmed(true);
    setActiveStep(3);
  };

  const handleApplyPromo = () => {
    const clean = promoDraft.trim().toUpperCase();
    setPromoCode(clean);
    if (!clean) {
      setPromoFeedback(null);
      return;
    }
    const nextSummary = calculateCartSummary(
      shopItems,
      fulfillmentMethod,
      deliveryFeeEtb,
      clean,
      redeemLoyaltyPoints,
      loyaltyBalance,
      governanceConfig.freeDeliveryThresholdEtb
    );
    if (nextSummary.promoCode) {
      setPromoFeedback(t('promoCodeAppliedFeedback', { code: nextSummary.promoCode }));
    } else {
      setPromoFeedback(null);
    }
  };

  const handleConfirmOrder = async () => {
    if (submitting) return;
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
        idempotencyKey: checkoutSessionKeyRef.current,
      });

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

  const selectedProviderKey: 'telebirr' | 'cbe_birr' | 'chapa' | null =
    paymentMethod === 'telebirr' || paymentMethod === 'telebirr_sandbox'
      ? 'telebirr'
      : paymentMethod === 'cbe_birr' || paymentMethod === 'cbe_birr_sandbox'
        ? 'cbe_birr'
        : paymentMethod === 'chapa'
          ? 'chapa'
          : null;

  const selectedProviderStatus = selectedProviderKey
    ? paymentProviders?.[selectedProviderKey]
    : undefined;

  const totalDiscountShown = summary.promoDiscountAmount + summary.loyaltyDiscountAmount;

  return (
    <div className="flex flex-col min-h-full bg-[#F3F6F4] dark:bg-[#031719] text-[#0E2421] dark:text-[#F5FAFA]">
      {/* Unified Affin Connect Brand Header + Slim 3-Step Horizontal Progress */}
      <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 dark:bg-[#031719]/95 backdrop-blur-md border-b border-[#D2E0DC] dark:border-[#14443F]/80 shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none">
        <div className="px-3 pt-2.5 pb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => (activeStep > 1 ? setActiveStep((activeStep - 1) as CheckoutStep) : goBack())}
            aria-label="Go back"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#0F4C44] dark:text-[#F5FAFA] hover:bg-[#EBF1EE] dark:hover:bg-[#092825] transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <img
              src={BRAND_ASSETS.logo}
              alt="Affin Connect"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-xl object-cover border border-[#0F4C44]/30 dark:border-[#00C8D7]/35 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-display font-extrabold tracking-tight leading-none truncate">
                <span className="text-[#0F4C44] dark:text-[#F5FAFA]">Affin </span>
                <span className="text-[#047857] dark:text-[#00D68F]">Connect</span>
              </div>
              <div className="text-[10px] text-[#46635E] dark:text-[#A9C0BD] truncate mt-0.5">
                {t('checkoutTagline')}
              </div>
            </div>
          </div>

          <ThemeToggleButton />
        </div>

        {/* Slim Segmented 3-Step Indicator */}
        <nav aria-label="Checkout progress" className="px-4 pb-3 pt-1">
          <div className="flex items-center">
            {(
              [
                {
                  step: 1 as CheckoutStep,
                  label: t('checkoutStepShipping'),
                  done: activeStep > 1 && isStep1Valid,
                },
                {
                  step: 2 as CheckoutStep,
                  label: t('checkoutStepReview'),
                  done: activeStep > 2 && step2Confirmed,
                },
                {
                  step: 3 as CheckoutStep,
                  label: t('checkoutStepPayment'),
                  done: activeStep === 3 && isStep3Valid && step2Confirmed,
                },
              ] as const
            ).map((item, idx) => {
              const isActive = activeStep === item.step;
              const reachable = canNavigateToCheckoutStep({
                targetStep: item.step,
                isStep1Valid,
                step2Confirmed,
              });
              return (
                <React.Fragment key={item.step}>
                  <button
                    type="button"
                    disabled={!reachable && !isActive}
                    onClick={() => handleStepSelect(item.step)}
                    className="flex flex-col items-center gap-1 min-w-[58px] disabled:opacity-55 transition-opacity"
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold tabular-nums transition-all ${
                        isActive
                          ? 'bg-gradient-to-br from-[#047857] to-[#0D9488] dark:from-[#00D68F] dark:to-[#00C8D7] text-white dark:text-[#031719] shadow-md shadow-[#047857]/20 dark:shadow-[#00D68F]/25'
                          : item.done
                            ? 'bg-[#047857] dark:bg-[#00D68F] text-white dark:text-[#031719]'
                            : 'bg-[#EDF5F3] dark:bg-[#092825] border border-[#D5E6E2] dark:border-[#14443F] text-[#4B6B67] dark:text-[#A9C0BD]'
                      }`}
                    >
                      {item.done && !isActive ? <Check className="w-3.5 h-3.5 stroke-[2.7]" /> : item.step}
                    </span>
                    <span
                      className={`text-[10px] font-bold tracking-tight ${
                        isActive || item.done
                          ? 'text-[#047857] dark:text-[#00D68F]'
                          : 'text-[#4B6B67] dark:text-[#A9C0BD]'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                  {idx < 2 && (
                    <div
                      className={`flex-1 h-0.5 -mt-4 mx-1.5 rounded-full transition-colors ${
                        activeStep > item.step
                          ? 'bg-[#047857] dark:bg-[#00D68F]'
                          : 'bg-[#D5E6E2] dark:bg-[#14443F]'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </nav>
      </header>

      <div className="p-4 space-y-3.5 flex-1">
        {/* Governance / Availability / Error Alerts */}
        {shopCheckoutReconciliation.hasBlockingIssues && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <span>{t('removeUnavailableHint')}</span>
          </div>
        )}

        {!checkoutGov.allowed && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <span>
              {checkoutGov.customMessage ||
                t(checkoutGov.errorKey ?? 'governanceOrderingPaused', {
                  limit: formatETB(governanceConfig.maxOrderAmountEtb),
                })}
            </span>
          </div>
        )}

        {submitError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <span>{submitError}</span>
          </div>
        )}

        {/* ============================================================
            STEP 1: SHIPPING & FULFILLMENT
            ============================================================ */}
        {activeStep === 1 && (
          <section data-testid="checkout-step-1" className="space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#047857] dark:text-[#00D68F] shrink-0" />
                <h2 className="text-sm font-display font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                  {t('checkoutStep1Title')}
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-[#4B6B67] dark:text-[#A9C0BD] truncate">
                {shop.name}
              </span>
            </div>

            {/* Fulfillment Segmented Selector */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={!shop.deliveryAvailable}
                onClick={() => {
                  setFulfillmentMethod('delivery');
                  if (paymentMethod === 'pay_at_pickup') setPaymentMethod('cash_on_delivery');
                }}
                className={`p-3 rounded-2xl border text-left transition-all min-h-[44px] ${
                  fulfillmentMethod === 'delivery'
                    ? 'border-[#047857] dark:border-[#00D68F] bg-[#ECFDF5] dark:bg-[#102F2B] shadow-md shadow-[#047857]/10 dark:shadow-[#00D68F]/10'
                    : 'border-[#D2E0DC] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#092825] opacity-85 disabled:opacity-40'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <Truck className="w-4 h-4 text-[#047857] dark:text-[#00D68F]" />
                  {fulfillmentMethod === 'delivery' && (
                    <CheckCircle2 className="w-4 h-4 text-[#047857] dark:text-[#00D68F]" />
                  )}
                </div>
                <div className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                  {t('deliveryShort')}
                </div>
                <div className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] tabular-nums mt-0.5">
                  {summary.freeDeliveryUnlocked ? t('free') : formatETB(deliveryFeeEtb)} ·{' '}
                  {etaEstimate.label}
                </div>
              </button>

              <button
                type="button"
                disabled={!shop.pickupAvailable}
                onClick={() => {
                  setFulfillmentMethod('pickup');
                  if (paymentMethod === 'cash_on_delivery') setPaymentMethod('pay_at_pickup');
                }}
                className={`p-3 rounded-2xl border text-left transition-all min-h-[44px] ${
                  fulfillmentMethod === 'pickup'
                    ? 'border-[#047857] dark:border-[#00D68F] bg-[#ECFDF5] dark:bg-[#102F2B] shadow-md shadow-[#047857]/10 dark:shadow-[#00D68F]/10'
                    : 'border-[#D2E0DC] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#092825] opacity-85 disabled:opacity-40'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <Store className="w-4 h-4 text-[#0F766E] dark:text-[#00C8D7]" />
                  {fulfillmentMethod === 'pickup' && (
                    <CheckCircle2 className="w-4 h-4 text-[#047857] dark:text-[#00D68F]" />
                  )}
                </div>
                <div className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                  {t('pickupShort')}
                </div>
                <div className="text-[11px] text-[#047857] dark:text-[#00D68F] font-semibold mt-0.5">
                  {t('free')} · {getLocalizedNeighborhood(shop.neighborhood, language)}
                </div>
              </button>
            </div>

            {fulfillmentMethod === 'delivery' ? (
              <div className="rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] p-3.5 space-y-3 shadow-xs dark:shadow-none">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                    {t('deliveryAddressSection')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNewAddressForm((s) => !s)}
                    className="min-h-[34px] px-2.5 rounded-lg text-xs font-bold text-[#047857] dark:text-[#00D68F] hover:bg-[#ECFDF5] dark:hover:bg-[#102F2B] transition-colors"
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
                          className={`w-full p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-[#047857] dark:border-[#00D68F] bg-[#ECFDF5] dark:bg-[#102F2B]'
                              : 'border-[#D2E0DC] dark:border-[#14443F] bg-[#F3F6F4] dark:bg-[#031719]/60 hover:border-[#047857]/45 dark:hover:border-[#00D68F]/45'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                            <span className="flex items-center gap-1.5 min-w-0">
                              <MapPin className="w-3.5 h-3.5 text-[#047857] dark:text-[#00D68F] shrink-0" />
                              <span className="truncate">
                                {addr.label} · {getLocalizedNeighborhood(addr.neighborhood, language)}
                              </span>
                            </span>
                            <span className="text-[11px] font-medium text-[#4B6B67] dark:text-[#A9C0BD] tabular-nums shrink-0">
                              {addr.phoneNumber}
                            </span>
                          </div>
                          <div className="text-xs text-[#4B6B67] dark:text-[#A9C0BD] mt-1 pl-5">
                            {addr.streetOrLandmark}
                          </div>
                          <div className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] mt-0.5 pl-5 flex items-center justify-between">
                            <span>{addr.recipientName}</span>
                            {isSelected && (
                              <span className="text-[#047857] dark:text-[#00D68F] font-semibold">
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
                  <form onSubmit={handleSaveNewAddress} className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label
                          htmlFor="addr-label"
                          className="block text-[11px] font-medium text-[#4B6B67] dark:text-[#A9C0BD] mb-1"
                        >
                          Label
                        </label>
                        <input
                          id="addr-label"
                          type="text"
                          value={addrLabel}
                          onChange={(e) => setAddrLabel(e.target.value)}
                          placeholder="Home / Office"
                          className="w-full min-h-[42px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#14443F] bg-[#F3F6F4] dark:bg-[#031719] text-xs text-[#0C2624] dark:text-[#F5FAFA] placeholder:text-[#4B6B67]/60 dark:placeholder:text-[#A9C0BD]/50 focus:outline-none focus:border-[#047857] dark:focus:border-[#00D68F]"
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
                          className="block text-[11px] font-medium text-[#4B6B67] dark:text-[#A9C0BD] mb-1"
                        >
                          {t('neighborhood')}
                        </label>
                        <select
                          id="addr-neighborhood"
                          value={neighborhood}
                          onChange={(e) => setNeighborhood(e.target.value)}
                          className="w-full min-h-[42px] px-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#14443F] text-xs bg-[#F3F6F4] dark:bg-[#031719] text-[#0C2624] dark:text-[#F5FAFA] focus:outline-none focus:border-[#047857] dark:focus:border-[#00D68F]"
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
                        className="block text-[11px] font-medium text-[#4B6B67] dark:text-[#A9C0BD] mb-1"
                      >
                        Recipient Full Name
                      </label>
                      <input
                        id="addr-name"
                        type="text"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="e.g. Selamawit Bekele"
                        className="w-full min-h-[42px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#14443F] bg-[#F3F6F4] dark:bg-[#031719] text-xs text-[#0C2624] dark:text-[#F5FAFA] placeholder:text-[#4B6B67]/60 dark:placeholder:text-[#A9C0BD]/50 focus:outline-none focus:border-[#047857] dark:focus:border-[#00D68F]"
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
                        className="block text-[11px] font-medium text-[#4B6B67] dark:text-[#A9C0BD] mb-1"
                      >
                        Ethiopian Phone Number (+251)
                      </label>
                      <input
                        id="addr-phone"
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+251 911 234 567"
                        className="w-full min-h-[42px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#14443F] bg-[#F3F6F4] dark:bg-[#031719] text-xs text-[#0C2624] dark:text-[#F5FAFA] placeholder:text-[#4B6B67]/60 dark:placeholder:text-[#A9C0BD]/50 focus:outline-none focus:border-[#047857] dark:focus:border-[#00D68F]"
                      />
                      {addrErrors.phoneNumber && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                          {addrErrors.phoneNumber}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="addr-landmark"
                        className="block text-[11px] font-medium text-[#4B6B67] dark:text-[#A9C0BD] mb-1"
                      >
                        Street or Hawassa Landmark
                      </label>
                      <input
                        id="addr-landmark"
                        type="text"
                        value={streetOrLandmark}
                        onChange={(e) => setStreetOrLandmark(e.target.value)}
                        placeholder="e.g. Near Menhariya Bus Station, Blue Gate"
                        className="w-full min-h-[42px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#14443F] bg-[#F3F6F4] dark:bg-[#031719] text-xs text-[#0C2624] dark:text-[#F5FAFA] placeholder:text-[#4B6B67]/60 dark:placeholder:text-[#A9C0BD]/50 focus:outline-none focus:border-[#047857] dark:focus:border-[#00D68F]"
                      />
                      {addrErrors.streetOrLandmark && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                          {addrErrors.streetOrLandmark}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="w-full min-h-[44px] rounded-xl bg-[#ECFDF5] dark:bg-[#102F2B] border border-[#047857]/50 dark:border-[#00D68F]/50 hover:bg-[#047857] dark:hover:bg-[#00D68F] hover:text-white dark:hover:text-[#031719] text-[#047857] dark:text-[#00D68F] text-xs font-bold transition-colors"
                    >
                      Save Hawassa Address
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] flex items-start gap-2.5 text-xs">
                <Store className="w-4 h-4 text-[#047857] dark:text-[#00D68F] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-bold text-[#0C2624] dark:text-[#F5FAFA]">{shop.name}</div>
                  <div className="text-[#4B6B67] dark:text-[#A9C0BD] mt-0.5">
                    {shop.address}, {getLocalizedNeighborhood(shop.neighborhood, language)}, Hawassa
                  </div>
                  <div className="text-[11px] text-[#047857] dark:text-[#00D68F] mt-0.5 tabular-nums">
                    Tel: {shop.phoneNumber}
                    {shopProximity ? ` · ${shopProximity.distanceLabel}` : ''}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ============================================================
            STEP 2: COMPACT ORDER REVIEW (PANEL 1 REFERENCE)
            ============================================================ */}
        {activeStep === 2 && (
          <section data-testid="checkout-step-2" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[#047857] dark:text-[#00D68F] shrink-0" />
                <h2 className="text-sm font-display font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                  {t('checkoutStepReview')} · {t('checkoutStep2Title')}
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-[#047857] dark:text-[#00D68F] tabular-nums">
                {fulfillmentMethod === 'delivery' ? etaEstimate.label : t('pickupEtaLabel')}
              </span>
            </div>

            {otherShopIds.length > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-[#092825] border border-amber-300 dark:border-[#FFB547]/35 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-semibold text-amber-800 dark:text-[#FFB547]">
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
                      className="px-2 py-1 rounded-lg bg-[#FCFDFC] dark:bg-[#031719] border border-[#D2E0DC] dark:border-[#14443F] font-semibold text-[#0C2624] dark:text-[#F5FAFA] hover:border-[#047857]/50 dark:hover:border-[#00D68F]/50"
                    >
                      {t('checkoutSwitchShopBtn', { shop: otherShop?.name ?? 'Shop' })}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Compact Product Rows & Financial Breakdown Card */}
            <div className="rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] overflow-hidden shadow-xs dark:shadow-none">
              {/* Compact Item List */}
              <div className="divide-y divide-[#D5E6E2] dark:divide-[#14443F]/75">
                {shopItems.map((item) => {
                  const unitPrice = getCartItemUnitPrice(item);
                  return (
                    <div
                      key={getCartItemKey(item.product.productId, item.variantId)}
                      className="p-3 flex items-center gap-3"
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#EDF5F3] dark:bg-[#031719] border border-[#D2E0DC] dark:border-[#14443F] shrink-0">
                        <ResilientImage
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          fallbackTitle={item.product.name}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA] truncate">
                          {item.product.name}
                        </div>
                        <div className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] truncate mt-0.5">
                          {shop.name}
                          {item.variantLabel ? ` · ${item.variantLabel}` : ''}
                        </div>
                        <div className="text-xs font-bold text-[#047857] dark:text-[#00D68F] tabular-nums mt-0.5">
                          {formatETB(unitPrice)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] tabular-nums">
                          ×{item.quantity}
                        </div>
                        <div className="text-xs font-extrabold text-[#0C2624] dark:text-[#F5FAFA] tabular-nums mt-0.5">
                          {formatETB(unitPrice * item.quantity)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Free Delivery Slim Bar */}
              {fulfillmentMethod === 'delivery' && (
                <div className="px-3.5 py-2 bg-[#ECFDF5] dark:bg-[#102F2B]/70 border-t border-[#D2E0DC] dark:border-[#14443F] space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#4B6B67] dark:text-[#A9C0BD]">
                      {summary.freeDeliveryUnlocked
                        ? t('freeDeliveryUnlocked')
                        : t('addMoreForFreeDelivery', {
                            amount: formatETB(summary.amountToFreeDelivery),
                          })}
                    </span>
                    <span className="font-bold text-[#047857] dark:text-[#00D68F] tabular-nums">
                      {freeDeliveryProgressPct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#DCEAE6] dark:bg-[#031719] overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r from-[#047857] to-[#0D9488] dark:from-[#00D68F] dark:to-[#00C8D7] rounded-full transition-all duration-300 ${getTailwindWidthClass(
                        freeDeliveryProgressPct
                      )}`}
                    />
                  </div>
                </div>
              )}

              {/* Subtotal / Delivery / Discount Summary */}
              <div className="p-3.5 border-t border-[#D2E0DC] dark:border-[#14443F] space-y-2 text-xs">
                <div className="flex items-center justify-between text-[#4B6B67] dark:text-[#A9C0BD]">
                  <span>{t('subtotal')}</span>
                  <span className="font-bold text-[#0C2624] dark:text-[#F5FAFA] tabular-nums">
                    {formatETB(summary.subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#4B6B67] dark:text-[#A9C0BD]">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#047857] dark:text-[#00D68F]" />
                    <span>{t('deliveryFee')}</span>
                  </span>
                  <span className="font-bold text-[#0C2624] dark:text-[#F5FAFA] tabular-nums">
                    {summary.deliveryFee === 0 ? (
                      <span className="text-[#047857] dark:text-[#00D68F]">{t('free')}</span>
                    ) : (
                      formatETB(summary.deliveryFee)
                    )}
                  </span>
                </div>
                {totalDiscountShown > 0 && (
                  <div className="flex items-center justify-between text-[#047857] dark:text-[#00D68F] font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      <span>
                        {t('discountLabel')}
                        {summary.promoCode ? ` (${summary.promoCode})` : ''}
                      </span>
                    </span>
                    <span className="tabular-nums">-{formatETB(totalDiscountShown)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Compact Loyalty Points Toggle Card */}
            <div className="rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-[#FFB547]/15 border border-amber-300 dark:border-[#FFB547]/30 flex items-center justify-center text-amber-600 dark:text-[#FFB547] shrink-0">
                  <Star className="w-4 h-4 fill-amber-500 dark:fill-[#FFB547]" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA] truncate">
                    {t('loyaltyToggleUsePoints', {
                      points:
                        maxRedeemablePoints >= LOYALTY_MIN_REDEEM_POINTS
                          ? maxRedeemablePoints
                          : loyaltyBalance,
                    })}
                  </div>
                  <div className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] truncate">
                    {maxRedeemablePoints >= LOYALTY_MIN_REDEEM_POINTS
                      ? t('loyaltyDiscountPreview', {
                          amount: formatETB(maxRedeemablePoints * LOYALTY_ETB_PER_POINT_REDEEMED),
                        })
                      : t('loyaltyMinHint')}
                  </div>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={summary.loyaltyPointsApplied > 0}
                aria-label={t('loyaltyRedeemSection')}
                disabled={maxRedeemablePoints < LOYALTY_MIN_REDEEM_POINTS}
                onClick={() =>
                  setRedeemLoyaltyPoints(
                    summary.loyaltyPointsApplied > 0 ? 0 : maxRedeemablePoints
                  )
                }
                className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 disabled:opacity-40 ${
                  summary.loyaltyPointsApplied > 0
                    ? 'bg-[#047857] dark:bg-[#00D68F]'
                    : 'bg-[#C4DBD6] dark:bg-[#14443F]'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                    summary.loyaltyPointsApplied > 0 ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Highlighted Total Payable Row */}
            <div className="px-1 flex items-center justify-between">
              <span className="text-sm font-display font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                {t('totalPayableLabel')}
              </span>
              <span className="text-lg font-display font-extrabold text-[#047857] dark:text-[#00D68F] tabular-nums">
                {formatETB(summary.totalAmount)}
              </span>
            </div>

            {/* Compact Promo Code Inline Input + Apply CTA */}
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 text-[#4B6B67] dark:text-[#A9C0BD] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="checkout-promo"
                    type="text"
                    value={promoDraft}
                    onChange={(e) => {
                      setPromoDraft(e.target.value.toUpperCase());
                      setPromoFeedback(null);
                    }}
                    placeholder={t('promoCodeTitle')}
                    className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-[#D2E0DC] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#092825] text-xs font-mono uppercase text-[#0C2624] dark:text-[#F5FAFA] placeholder:normal-case placeholder:font-sans placeholder:text-[#4B6B67]/65 dark:placeholder:text-[#A9C0BD]/70 focus:outline-none focus:border-[#047857] dark:focus:border-[#00D68F]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="px-4 min-h-[42px] rounded-xl bg-gradient-to-r from-[#047857] to-[#0D9488] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 text-white dark:text-[#031719] text-xs font-extrabold shrink-0 transition-all"
                >
                  {t('applyCode')}
                </button>
              </div>
              {promoFeedback && summary.promoCode && (
                <p className="text-[11px] font-semibold text-[#047857] dark:text-[#00D68F] px-1">
                  {promoFeedback}
                </p>
              )}
              {promoCode && summary.promoErrorKey && (
                <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 px-1">
                  {t(summary.promoErrorKey, { amount: formatETB(summary.promoMinSubtotal ?? 0) })}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 px-0.5 text-[10px]">
                <span className="text-[#4B6B67] dark:text-[#A9C0BD]">{t('availableCodes')}</span>
                {PROMO_CODES.map((rule) => (
                  <button
                    key={rule.code}
                    type="button"
                    onClick={() => {
                      setPromoDraft(rule.code);
                      setPromoCode(rule.code);
                      setPromoFeedback(null);
                    }}
                    className={`px-2 py-0.5 rounded-md border font-mono font-semibold transition-colors ${
                      summary.promoCode === rule.code
                        ? 'bg-[#ECFDF5] dark:bg-[#00D68F]/15 text-[#047857] dark:text-[#00D68F] border-[#047857]/50 dark:border-[#00D68F]/50'
                        : 'bg-[#FCFDFC] dark:bg-[#092825] text-[#4B6B67] dark:text-[#A9C0BD] border-[#D2E0DC] dark:border-[#14443F] hover:text-[#0C2624] dark:hover:text-[#F5FAFA]'
                    }`}
                  >
                    {rule.code}
                  </button>
                ))}
              </div>
            </div>

            {/* Compact Buyer Note */}
            <div className="rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] p-3 space-y-1">
              <label
                htmlFor="order-notes"
                className="flex items-center gap-1.5 text-[11px] font-semibold text-[#4B6B67] dark:text-[#A9C0BD]"
              >
                <FileText className="w-3.5 h-3.5 text-[#047857] dark:text-[#00D68F]" />
                <span>{t('checkoutBuyerNotesOptional')}</span>
              </label>
              <input
                id="order-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('orderNotesPlaceholder')}
                className="w-full bg-transparent text-xs text-[#0C2624] dark:text-[#F5FAFA] placeholder:text-[#4B6B67]/60 dark:placeholder:text-[#A9C0BD]/60 focus:outline-none"
              />
            </div>
          </section>
        )}

        {/* ============================================================
            STEP 3: PAYMENT SELECTION (PANEL 2 REFERENCE)
            ============================================================ */}
        {activeStep === 3 && (
          <section data-testid="checkout-step-3" className="space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#047857] dark:text-[#00D68F] shrink-0" />
                <h2 className="text-sm font-display font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                  {t('selectPaymentMethodTitle')}
                </h2>
              </div>
              <p className="text-xs text-[#4B6B67] dark:text-[#A9C0BD] mt-0.5">
                {t('selectPaymentMethodSubtitle')}
              </p>
            </div>

            <div className="space-y-2.5">
              {/* 1. Telebirr */}
              <div
                className={`rounded-2xl border transition-all ${
                  paymentMethod === 'telebirr'
                    ? 'border-[#047857] dark:border-[#00D68F] bg-[#ECFDF5] dark:bg-[#102F2B]'
                    : 'border-[#D2E0DC] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#092825]'
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
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        paymentMethod === 'telebirr'
                          ? 'border-[#047857] dark:border-[#00D68F]'
                          : 'border-[#4B6B67]/50 dark:border-[#A9C0BD]/60'
                      }`}
                    >
                      {paymentMethod === 'telebirr' && (
                        <span className="w-2 h-2 rounded-full bg-[#047857] dark:bg-[#00D68F]" />
                      )}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-[#0284C7] text-white flex items-center justify-center font-display font-extrabold text-[11px] shrink-0">
                      TB
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                          {t('telebirr')}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#047857] dark:bg-[#00D68F] text-white dark:text-[#031719] text-[10px] font-extrabold">
                          {t('popularBadge')}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] truncate mt-0.5">
                        {t('payWithTelebirrDesc')}
                      </div>
                    </div>
                  </div>
                </button>

                {paymentMethod === 'telebirr' && (
                  <div className="px-3.5 pb-3.5 pt-2.5 border-t border-[#D2E0DC] dark:border-[#14443F] space-y-2.5">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 rounded-xl bg-[#FCFDFC] dark:bg-[#031719] border border-[#D2E0DC] dark:border-[#14443F] flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[#4B6B67] dark:text-[#A9C0BD]">
                            {t('paymentMerchantShortcode')}
                          </div>
                          <div className="font-mono font-bold text-[#0C2624] dark:text-[#F5FAFA] tabular-nums mt-0.5">
                            {ETHIOPIAN_PAYMENT_CONFIG.telebirr.shortcode}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(ETHIOPIAN_PAYMENT_CONFIG.telebirr.shortcode, 'tb-code')
                          }
                          aria-label={t('paymentCopyShortcode')}
                          className="p-1.5 rounded-lg border border-[#D2E0DC] dark:border-[#14443F] text-[#047857] dark:text-[#00D68F] hover:bg-[#ECFDF5] dark:hover:bg-[#102F2B] shrink-0"
                        >
                          {copiedKey === 'tb-code' ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#FCFDFC] dark:bg-[#031719] border border-[#D2E0DC] dark:border-[#14443F]">
                        <div className="text-[#4B6B67] dark:text-[#A9C0BD]">
                          {t('paymentAmountDue')}
                        </div>
                        <div className="font-bold text-[#047857] dark:text-[#00D68F] tabular-nums mt-0.5">
                          {formatETB(summary.totalAmount)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="payment-reference-input"
                        className="block text-[11px] font-semibold text-[#0C2624] dark:text-[#F5FAFA]"
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
                        className="w-full min-h-[42px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#031719] text-xs font-mono uppercase text-[#0C2624] dark:text-[#F5FAFA] placeholder:normal-case placeholder:font-sans placeholder:text-[#4B6B67]/60 dark:placeholder:text-[#A9C0BD]/60 focus:outline-none focus:border-[#047857] dark:focus:border-[#00D68F]"
                      />
                      {liveRefStatus.valid ? (
                        <p className="text-[11px] font-semibold text-[#047857] dark:text-[#00D68F] flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {liveRefFeedbackText} ·{' '}
                            <span className="font-mono">{liveRefStatus.normalizedRef}</span>
                          </span>
                        </p>
                      ) : paymentReference.trim().length > 0 ? (
                        <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                          {t('paymentReferenceInvalidError')}
                        </p>
                      ) : (
                        <p className="text-[10px] text-[#4B6B67] dark:text-[#A9C0BD]">
                          {t('paymentLiveRefFormatGuide')}
                        </p>
                      )}
                      {paymentRefError && !liveRefStatus.valid && (
                        <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                          {paymentRefError}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. CBE */}
              <div
                className={`rounded-2xl border transition-all ${
                  paymentMethod === 'cbe_birr'
                    ? 'border-[#047857] dark:border-[#00D68F] bg-[#ECFDF5] dark:bg-[#102F2B]'
                    : 'border-[#D2E0DC] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#092825]'
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
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        paymentMethod === 'cbe_birr'
                          ? 'border-[#047857] dark:border-[#00D68F]'
                          : 'border-[#4B6B67]/50 dark:border-[#A9C0BD]/60'
                      }`}
                    >
                      {paymentMethod === 'cbe_birr' && (
                        <span className="w-2 h-2 rounded-full bg-[#047857] dark:bg-[#00D68F]" />
                      )}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-[#6D28D9] text-white flex items-center justify-center font-display font-extrabold text-[11px] shrink-0">
                      CBE
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                        {t('cbeFullTitle')}
                      </div>
                      <div className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] truncate mt-0.5">
                        {t('payWithCbeDesc')}
                      </div>
                    </div>
                  </div>
                </button>

                {paymentMethod === 'cbe_birr' && (
                  <div className="px-3.5 pb-3.5 pt-2.5 border-t border-[#D2E0DC] dark:border-[#14443F] space-y-2.5">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 rounded-xl bg-[#FCFDFC] dark:bg-[#031719] border border-[#D2E0DC] dark:border-[#14443F] flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[#4B6B67] dark:text-[#A9C0BD]">
                            {t('paymentMerchantShortcode')}
                          </div>
                          <div className="font-mono font-bold text-[#0C2624] dark:text-[#F5FAFA] tabular-nums mt-0.5">
                            {ETHIOPIAN_PAYMENT_CONFIG.cbe_birr.shortcode}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(ETHIOPIAN_PAYMENT_CONFIG.cbe_birr.shortcode, 'cbe-code')
                          }
                          aria-label={t('paymentCopyShortcode')}
                          className="p-1.5 rounded-lg border border-[#D2E0DC] dark:border-[#14443F] text-[#047857] dark:text-[#00D68F] hover:bg-[#ECFDF5] dark:hover:bg-[#102F2B] shrink-0"
                        >
                          {copiedKey === 'cbe-code' ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#FCFDFC] dark:bg-[#031719] border border-[#D2E0DC] dark:border-[#14443F]">
                        <div className="text-[#4B6B67] dark:text-[#A9C0BD]">
                          {t('paymentAmountDue')}
                        </div>
                        <div className="font-bold text-[#047857] dark:text-[#00D68F] tabular-nums mt-0.5">
                          {formatETB(summary.totalAmount)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="payment-reference-input"
                        className="block text-[11px] font-semibold text-[#0C2624] dark:text-[#F5FAFA]"
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
                        className="w-full min-h-[42px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#031719] text-xs font-mono uppercase text-[#0C2624] dark:text-[#F5FAFA] placeholder:normal-case placeholder:font-sans placeholder:text-[#4B6B67]/60 dark:placeholder:text-[#A9C0BD]/60 focus:outline-none focus:border-[#047857] dark:focus:border-[#00D68F]"
                      />
                      {liveRefStatus.valid ? (
                        <p className="text-[11px] font-semibold text-[#047857] dark:text-[#00D68F] flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {liveRefFeedbackText} ·{' '}
                            <span className="font-mono">{liveRefStatus.normalizedRef}</span>
                          </span>
                        </p>
                      ) : paymentReference.trim().length > 0 ? (
                        <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                          {t('paymentReferenceInvalidError')}
                        </p>
                      ) : (
                        <p className="text-[10px] text-[#4B6B67] dark:text-[#A9C0BD]">
                          {t('paymentLiveRefFormatGuide')}
                        </p>
                      )}
                      {paymentRefError && !liveRefStatus.valid && (
                        <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                          {paymentRefError}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Chapa */}
              <div
                className={`rounded-2xl border transition-all ${
                  paymentMethod === 'chapa'
                    ? 'border-[#047857] dark:border-[#00D68F] bg-[#ECFDF5] dark:bg-[#102F2B]'
                    : 'border-[#D2E0DC] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#092825]'
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
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        paymentMethod === 'chapa'
                          ? 'border-[#047857] dark:border-[#00D68F]'
                          : 'border-[#4B6B67]/50 dark:border-[#A9C0BD]/60'
                      }`}
                    >
                      {paymentMethod === 'chapa' && (
                        <span className="w-2 h-2 rounded-full bg-[#047857] dark:bg-[#00D68F]" />
                      )}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-[#047857] text-white flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                        {t('chapa')}
                      </div>
                      <div className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] truncate mt-0.5">
                        {t('payWithChapaDesc')}
                      </div>
                    </div>
                  </div>
                </button>

                {paymentMethod === 'chapa' && (
                  <div className="px-3.5 pb-3.5 pt-2.5 border-t border-[#D2E0DC] dark:border-[#14443F] space-y-2.5">
                    <div className="space-y-1">
                      <label
                        htmlFor="payment-reference-input"
                        className="block text-[11px] font-semibold text-[#0C2624] dark:text-[#F5FAFA]"
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
                        className="w-full min-h-[42px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#031719] text-xs font-mono uppercase text-[#0C2624] dark:text-[#F5FAFA] placeholder:normal-case placeholder:font-sans placeholder:text-[#4B6B67]/60 dark:placeholder:text-[#A9C0BD]/60 focus:outline-none focus:border-[#047857] dark:focus:border-[#00D68F]"
                      />
                      {liveRefStatus.valid ? (
                        <p className="text-[11px] font-semibold text-[#047857] dark:text-[#00D68F] flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {liveRefFeedbackText} ·{' '}
                            <span className="font-mono">{liveRefStatus.normalizedRef}</span>
                          </span>
                        </p>
                      ) : paymentReference.trim().length > 0 ? (
                        <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                          {t('paymentReferenceInvalidError')}
                        </p>
                      ) : null}
                      {paymentRefError && !liveRefStatus.valid && (
                        <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
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
                  className={`rounded-2xl border transition-all ${
                    paymentMethod === 'cash_on_delivery'
                      ? 'border-[#047857] dark:border-[#00D68F] bg-[#ECFDF5] dark:bg-[#102F2B]'
                      : 'border-[#D2E0DC] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#092825]'
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
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          paymentMethod === 'cash_on_delivery'
                            ? 'border-[#047857] dark:border-[#00D68F]'
                            : 'border-[#4B6B67]/50 dark:border-[#A9C0BD]/60'
                        }`}
                      >
                        {paymentMethod === 'cash_on_delivery' && (
                          <span className="w-2 h-2 rounded-full bg-[#047857] dark:bg-[#00D68F]" />
                        )}
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] dark:bg-[#00D68F]/15 border border-[#047857]/30 dark:border-[#00D68F]/35 text-[#047857] dark:text-[#00D68F] flex items-center justify-center shrink-0">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                          {t('cashOnDelivery')}
                        </div>
                        <div className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] truncate mt-0.5">
                          {t('payOnDeliveryDesc')}
                        </div>
                      </div>
                    </div>
                  </button>
                  {paymentMethod === 'cash_on_delivery' && (
                    <div className="px-3.5 pb-3 pt-2 border-t border-[#D2E0DC] dark:border-[#14443F] flex items-start gap-2 text-[11px] text-amber-800 dark:text-[#FFB547]">
                      <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{t('codPinHandshakeNote')}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={`rounded-2xl border transition-all ${
                    paymentMethod === 'pay_at_pickup'
                      ? 'border-[#047857] dark:border-[#00D68F] bg-[#ECFDF5] dark:bg-[#102F2B]'
                      : 'border-[#D2E0DC] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#092825]'
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
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          paymentMethod === 'pay_at_pickup'
                            ? 'border-[#047857] dark:border-[#00D68F]'
                            : 'border-[#4B6B67]/50 dark:border-[#A9C0BD]/60'
                        }`}
                      >
                        {paymentMethod === 'pay_at_pickup' && (
                          <span className="w-2 h-2 rounded-full bg-[#047857] dark:bg-[#00D68F]" />
                        )}
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-[#00C8D7]/15 border border-teal-300 dark:border-[#00C8D7]/35 text-[#0F766E] dark:text-[#00C8D7] flex items-center justify-center shrink-0">
                        <Store className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                          {t('payAtPickup')}
                        </div>
                        <div className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] truncate mt-0.5">
                          {t('payAtPickupDesc')}
                        </div>
                      </div>
                    </div>
                  </button>
                  {paymentMethod === 'pay_at_pickup' && (
                    <div className="px-3.5 pb-3 pt-2 border-t border-[#D2E0DC] dark:border-[#14443F] flex items-start gap-2 text-[11px] text-amber-800 dark:text-[#FFB547]">
                      <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{t('codPinHandshakeNote')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Honest Provider Configuration Notice (when electronic gateway is selected and unconfigured) */}
            {selectedProviderKey && selectedProviderStatus && !selectedProviderStatus.configured && (
              <div
                data-testid="provider-unconfigured-notice"
                className="p-3 rounded-xl bg-amber-50 dark:bg-[#FFB547]/10 border border-amber-300 dark:border-[#FFB547]/35 text-[11px] text-amber-900 dark:text-[#FFB547] space-y-1"
              >
                <p className="font-semibold leading-relaxed">{t('providerPendingSetupNotice')}</p>
                {selectedProviderStatus.missingEnvVars.length > 0 && (
                  <p className="text-[10px] font-mono opacity-85 break-all">
                    {t('providerMissingEnvLabel', {
                      vars: selectedProviderStatus.missingEnvVars.join(', '),
                    })}
                  </p>
                )}
              </div>
            )}

            {/* Security Trust Banner */}
            <div className="p-3 rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] flex items-center gap-2.5 text-xs text-[#4B6B67] dark:text-[#A9C0BD]">
              <Lock className="w-4 h-4 text-[#047857] dark:text-[#00D68F] shrink-0" />
              <span className="leading-snug">{t('checkoutSecurityBanner')}</span>
            </div>
          </section>
        )}
      </div>

      {/* Sticky Compact Action Footer */}
      <footer className="sticky bottom-0 z-20 bg-[#FCFDFC]/95 dark:bg-[#031719]/95 backdrop-blur-md border-t border-[#D2E0DC] dark:border-[#14443F]/80 shadow-[0_-4px_14px_-6px_rgba(15,76,68,0.1)] dark:shadow-none px-4 py-3 mt-auto">
        {activeStep === 1 && (
          <button
            type="button"
            onClick={handleContinueStep1}
            className="w-full min-h-[46px] px-4 rounded-xl bg-gradient-to-r from-[#047857] to-[#0D9488] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 text-white dark:text-[#031719] text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#047857]/20 dark:shadow-[#00D68F]/20 transition-all"
          >
            <span>{t('checkoutContinueStep2')}</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        )}

        {activeStep === 2 && (
          <button
            type="button"
            onClick={handleContinueStep2}
            className="w-full min-h-[46px] px-4 rounded-xl bg-gradient-to-r from-[#047857] to-[#0D9488] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 text-white dark:text-[#031719] text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#047857]/20 dark:shadow-[#00D68F]/20 transition-all"
          >
            <span>{t('continueToPaymentBtn')}</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        )}

        {activeStep === 3 && (
          <button
            type="button"
            disabled={
              submitting || !checkoutGov.allowed || shopCheckoutReconciliation.hasBlockingIssues
            }
            onClick={handleConfirmOrder}
            className="w-full min-h-[46px] px-4 rounded-xl bg-gradient-to-r from-[#047857] to-[#0D9488] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 disabled:opacity-55 text-white dark:text-[#031719] text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#047857]/20 dark:shadow-[#00D68F]/20 transition-all"
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              {submitting
                ? t('submittingOrder')
                : `${t('paySecurelyBtn')} · ${formatETB(summary.totalAmount)}`}
            </span>
          </button>
        )}
      </footer>
    </div>
  );
};

export const OrderConfirmationScreen: React.FC<{ orderId: string }> = ({ orderId }) => {
  const { navigate, orders, shopsById, verifyOrderPayment, t } = useMarketplace();
  const order = orders.find((o) => o.orderId === orderId);
  const shop = order ? shopsById[order.shopId] : undefined;

  const [refCopied, setRefCopied] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
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
        origin: { y: 0.25 },
        colors: ['#00D68F', '#00C8D7', '#FFB547', '#F5FAFA'],
      });
    } catch {
      // ignore if canvas unsupported
    }
  }, [orderId]);

  const isPaid = order?.paymentStatus === 'paid';
  const isPendingElectronic = Boolean(
    order && !isPaid && isElectronicPaymentMethod(order.paymentMethod)
  );
  const orderRef = formatOrderReference(order?.orderId || orderId);

  const handleCopyRef = async () => {
    try {
      await navigator.clipboard?.writeText(orderRef);
    } catch {
      // Ignore clipboard failures
    }
    setRefCopied(true);
    setTimeout(() => setRefCopied(false), 1800);
  };

  const handleCopyPin = async () => {
    if (!order?.deliveryPin) return;
    try {
      await navigator.clipboard?.writeText(order.deliveryPin);
    } catch {
      // Ignore clipboard failures
    }
    setPinCopied(true);
    setTimeout(() => setPinCopied(false), 1800);
  };

  const handleVerifyNow = async () => {
    if (!order || verifyingPayment) return;
    setVerifyingPayment(true);
    setVerifyNotice(null);
    try {
      const res = await verifyOrderPayment(order.orderId);
      setVerifyNotice(
        res.verifiedPaid
          ? t('paymentVerifiedNowMsg')
          : res.message || t('paymentStillPendingMsg')
      );
    } finally {
      setVerifyingPayment(false);
    }
  };

  const headline = isPaid
    ? t('paymentConfirmedHeadline')
    : isPendingElectronic
      ? t('orderPendingHeadline')
      : t('orderConfirmedHeadline');

  const subtitle = isPaid
    ? t('paymentVerifiedSubtitle')
    : isPendingElectronic
      ? t('orderPendingVerificationSubtitle')
      : t('orderPlacedSubtitle');

  return (
    <div className="flex-1 flex flex-col justify-between bg-[#F3F6F4] dark:bg-[#031719] text-[#0E2421] dark:text-[#F5FAFA] min-h-full">
      <div className="px-4 pt-6 pb-4 space-y-4">
        {/* Hero Check + Truthful Confirmation Headline */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] text-[#FCFDFC] dark:text-[#031719] flex items-center justify-center shadow-xl shadow-[#0F4C44]/22 dark:shadow-[#00D68F]/25">
            {isPendingElectronic ? (
              <Clock className="w-8 h-8 stroke-[2.5]" />
            ) : (
              <Check className="w-8 h-8 stroke-[3]" />
            )}
          </div>
          <h1 className="text-xl font-display font-extrabold tracking-tight text-[#0F4C44] dark:text-[#F5FAFA]">
            {headline}
          </h1>
          <p className="text-xs text-[#46635E] dark:text-[#A9C0BD] max-w-[300px] mx-auto leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* High-Contrast Ivory Order Summary Card */}
        {order && (
          <div className="rounded-2xl bg-[#FCFDFC] text-slate-900 border border-[#D2E0DC] dark:border-transparent p-4 shadow-[0_6px_20px_-6px_rgba(15,76,68,0.12)] dark:shadow-2xl space-y-3">
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200/80">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-500">
                  {t('orderReference')}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    data-testid="confirmation-order-ref"
                    className="font-mono text-sm font-extrabold text-slate-900 tabular-nums"
                  >
                    {orderRef}
                  </span>
                  {refCopied && <Check className="w-3.5 h-3.5 text-[#047857]" />}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyRef}
                aria-label={t('copyReceipt')}
                className="min-w-[36px] min-h-[36px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
              >
                {refCopied ? <Check className="w-4 h-4 text-[#047857]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Store className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span>{t('shopLabel')}</span>
                </span>
                <span className="font-bold text-slate-900 text-right truncate">
                  {order.shopName}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-slate-500 font-medium">{t('receiptTotalAmountLabel')}</span>
                <span className="text-base font-display font-extrabold text-[#047857] dark:text-[#00A870] tabular-nums">
                  {formatETB(order.totalAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">{t('paymentMethod')}</span>
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span>{formatPaymentMethodDisplay(order.paymentMethod)}</span>
                  <span
                    data-testid="confirmation-payment-status"
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      order.paymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {order.paymentStatus}
                  </span>
                </span>
              </div>

              {order.deliveryEtaLabel && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <span>{t('estimatedDeliveryLabel')}</span>
                  </span>
                  <span className="font-bold text-[#047857] dark:text-[#00A870] tabular-nums">
                    {order.deliveryEtaLabel}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verify Pending Electronic Payment Action */}
        {order && isPendingElectronic && (
          <div className="rounded-2xl bg-amber-50 dark:bg-[#092825] border border-amber-300 dark:border-[#FFB547]/40 p-3 space-y-2">
            <button
              type="button"
              disabled={verifyingPayment}
              onClick={handleVerifyNow}
              className="w-full min-h-[40px] px-3 rounded-xl bg-amber-100 dark:bg-[#FFB547]/15 border border-amber-300 dark:border-[#FFB547]/45 text-amber-900 dark:text-[#FFB547] text-xs font-bold flex items-center justify-center gap-2 hover:bg-amber-200/70 dark:hover:bg-[#FFB547]/20 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifyingPayment ? 'animate-spin' : ''}`} />
              <span>
                {verifyingPayment ? t('checkingPaymentStatus') : t('checkPaymentStatusBtn')}
              </span>
            </button>
            {verifyNotice && (
              <p className="text-[11px] text-amber-800 dark:text-[#FFB547] text-center font-medium">
                {verifyNotice}
              </p>
            )}
          </div>
        )}

        {/* Preserved Delivery Handshake PIN & Escrow Guard */}
        {order?.deliveryPin && (
          <div className="rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] p-3.5 space-y-2 shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-[#FFB547]">
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>{t('deliveryPinTitle')}</span>
              </span>
              <button
                type="button"
                onClick={handleCopyPin}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EDF5F3] dark:bg-[#031719] border border-[#D5E6E2] dark:border-[#14443F] text-[11px] font-semibold text-[#047857] dark:text-[#00D68F]"
              >
                {pinCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{pinCopied ? t('pinCopiedLabel') : t('copyPinBtn')}</span>
              </button>
            </div>
            <div
              data-testid="confirmation-delivery-pin"
              className="py-1.5 px-3 rounded-xl bg-amber-50 dark:bg-[#031719] border border-amber-200 dark:border-[#14443F] text-center font-mono text-lg font-extrabold tracking-[0.35em] text-amber-800 dark:text-[#FFB547] tabular-nums"
            >
              {order.deliveryPin}
            </div>
            <p className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] leading-snug">
              {t('deliveryPinShareHint')}
            </p>
          </div>
        )}

        {/* Compact Action Stack */}
        <div className="space-y-2 pt-1">
          {order && (
            <button
              type="button"
              data-testid="confirmation-download-pdf-btn"
              onClick={() => downloadReceiptPdf(order, shop)}
              className="w-full min-h-[46px] px-4 rounded-xl bg-gradient-to-r from-[#047857] to-[#0D9488] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 text-white dark:text-[#031719] text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#047857]/20 dark:shadow-[#00D68F]/20 transition-all"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>{t('downloadPdfReceiptBtn')}</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            {order && (
              <button
                type="button"
                data-testid="confirmation-view-receipt-btn"
                onClick={() => setReceiptModalOpen(true)}
                className="min-h-[44px] px-3 rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/50 dark:hover:border-[#00D68F]/50 text-[#0E2421] dark:text-[#F5FAFA] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-[0_2px_8px_-3px_rgba(15,76,68,0.08)] dark:shadow-none"
              >
                <FileText className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#00D68F] shrink-0" />
                <span className="truncate">{t('viewReceiptBtn')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate({ name: 'orders', selectedOrderId: orderId, initialTab: 'active' })}
              className={`${
                order ? '' : 'col-span-2'
              } min-h-[44px] px-3 rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/50 dark:hover:border-[#00D68F]/50 text-[#0E2421] dark:text-[#F5FAFA] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-[0_2px_8px_-3px_rgba(15,76,68,0.08)] dark:shadow-none`}
            >
              <Truck className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#00D68F] shrink-0" />
              <span className="truncate">{t('trackOrderBtn')}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate({ name: 'home' })}
            className="w-full min-h-[44px] px-4 rounded-xl bg-[#FCFDFC]/90 dark:bg-[#092825]/60 border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/40 dark:hover:border-[#00D68F]/40 text-[#0E2421] dark:text-[#F5FAFA] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#46635E] dark:text-[#A9C0BD] shrink-0" />
            <span>{t('continueShopping')}</span>
          </button>
        </div>
      </div>

      {/* Bottom Lake Hawassa Cityscape Strip */}
      <div className="relative h-24 w-full overflow-hidden border-t border-[#D5E6E2] dark:border-[#14443F]/60 mt-2">
        <img
          src={BRAND_ASSETS.banner}
          alt="Lake Hawassa"
          className="w-full h-full object-cover opacity-70 dark:opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#031719]/85 via-[#031719]/35 to-transparent dark:from-[#031719] dark:via-[#031719]/40" />
        <div className="absolute inset-x-0 bottom-2 text-center text-[11px] font-bold tracking-wide text-[#F5FAFA]/95">
          {t('shopSupportProsper')}
        </div>
      </div>

      {receiptModalOpen && order && (
        <OrderReceiptModal
          order={order}
          shop={shop}
          onClose={() => setReceiptModalOpen(false)}
        />
      )}
    </div>
  );
};
