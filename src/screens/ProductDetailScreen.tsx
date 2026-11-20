import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Bell,
  BellOff,
  BellRing,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  FileText,
  Heart,
  Leaf,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  Minus,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Trash2,
  TrendingDown,
  Truck,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { ProductCard, ResilientImage } from '../components/SharedUI';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { SEED_PRODUCTS, SEED_REVIEWS } from '../data/seedData';
import { getLocalizedNeighborhood } from '../constants/translations';
import {
  buildProductGalleryImages,
  calculateDiscountPercent,
  calculateProductRatingSummary,
  calculateThresholdFromPercent,
  clampProductQuantity,
  deriveProductBadges,
  formatCoffeeBeanForm,
  formatCoffeeProcessMethod,
  formatCoffeeRoastLevel,
  formatETB,
  getCartItemKey,
  getProductPriceAlert,
  getQualifyingPurchaseOrder,
  getRelatedProducts,
  getUserProductReview,
  validateAddToCartRequest,
  validatePriceAlertThreshold,
  validateReviewInput,
} from '../utils/marketplaceLogic';

const STAR_LABEL_KEYS: Record<number, string> = {
  1: 'starPoor',
  2: 'starFair',
  3: 'starGood',
  4: 'starVeryGood',
  5: 'starExcellent',
};

function getBarWidthClass(pct: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  if (clamped >= 95) return 'w-full';
  if (clamped >= 85) return 'w-[90%]';
  if (clamped >= 75) return 'w-[80%]';
  if (clamped >= 65) return 'w-[70%]';
  if (clamped >= 55) return 'w-[60%]';
  if (clamped >= 45) return 'w-[50%]';
  if (clamped >= 35) return 'w-[40%]';
  if (clamped >= 25) return 'w-[30%]';
  if (clamped >= 15) return 'w-[20%]';
  if (clamped > 0) return 'w-[10%]';
  return 'w-0';
}

function formatReviewDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export const ProductDetailScreen: React.FC<{ productId: string }> = ({ productId }) => {
  const {
    goBack,
    navigate,
    products,
    shopsById,
    proximityByShopId,
    categories,
    reviews,
    orders,
    cart,
    firebaseUser,
    authLoading,
    favorites,
    toggleFavorite,
    addToCart,
    submitReview,
    updateReview,
    deleteReview,
    recordProductView,
    refreshCatalogFromFirestore,
    priceAlerts,
    pushPermission,
    requestPushPermission,
    subscribePriceAlert,
    removePriceAlert,
    openShopChat,
    governanceConfig,
    language,
    t,
  } = useMarketplace();

  const product = products.find((p) => p.productId === productId);
  const currentUid = firebaseUser?.uid ?? 'guest-local';

  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [cartFeedbackError, setCartFeedbackError] = useState<string | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [showStickyPurchaseBar, setShowStickyPurchaseBar] = useState(false);

  const galleryRef = useRef<HTMLDivElement | null>(null);
  const cardPurchaseRef = useRef<HTMLDivElement | null>(null);
  const reviewsSectionRef = useRef<HTMLElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Price Alert Modal state
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertTargetInput, setAlertTargetInput] = useState('');
  const [alertPushEnabled, setAlertPushEnabled] = useState(true);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [savingAlert, setSavingAlert] = useState(false);

  // New review form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [shopRating, setShopRating] = useState(5);
  const [shopComment, setShopComment] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Edit existing review state
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState('');
  const [editShopRating, setEditShopRating] = useState(5);
  const [editShopComment, setEditShopComment] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Star filter
  const [starFilter, setStarFilter] = useState<number | null>(null);

  const seedReviewIds = useMemo(() => new Set(SEED_REVIEWS.map((r) => r.reviewId)), []);

  useEffect(() => {
    setSelectedImageIdx(0);
    setQuantity(1);
    setAddedFeedback(false);
    setCartFeedbackError(null);
    setOptionsMenuOpen(false);
    setCatalogError(null);
    if (galleryRef.current) {
      galleryRef.current.scrollTo({ left: 0, behavior: 'auto' });
    }
    if (product) {
      recordProductView(product.productId);
      if (product.variants && product.variants.length > 0) {
        const defaultVariant =
          product.variants.find((v) => v.price === product.price) ?? product.variants[0];
        setSelectedVariantId(defaultVariant.id);
      } else {
        setSelectedVariantId(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // Keep sticky bottom controls reachable when scrolling below the product card
  useEffect(() => {
    const el = cardPurchaseRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyPurchaseBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [productId, product]);

  const handleRetryLoadProduct = async () => {
    setIsRefreshingCatalog(true);
    setCatalogError(null);
    try {
      await refreshCatalogFromFirestore();
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : t('searchErrorTitle')
      );
    } finally {
      setIsRefreshingCatalog(false);
    }
  };

  const relatedProducts = useMemo(
    () => (product ? getRelatedProducts(product, products, 4) : []),
    [product, products]
  );

  if (authLoading || isRefreshingCatalog) {
    return (
      <div
        className="min-h-full bg-[#F3F6F4] dark:bg-[#031719] text-[#0E2421] dark:text-[#F5FAFA] p-4 space-y-4"
        aria-busy="true"
        aria-label={t('loadingProductLabel')}
      >
        <div className="flex items-center justify-between pt-[max(0.25rem,env(safe-area-inset-top))]">
          <div className="w-11 h-11 rounded-full bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] animate-pulse" />
          <div className="w-11 h-11 rounded-full bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] animate-pulse" />
        </div>
        <div className="flex justify-center gap-2 py-1">
          <div className="w-3 h-3 rounded-full bg-[#0F4C44]/35 dark:bg-[#00D68F]/40 animate-pulse" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#D2E0DC] dark:bg-[#14443F] animate-pulse" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#D2E0DC] dark:bg-[#14443F] animate-pulse" />
        </div>
        <div className="rounded-[26px] bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] overflow-hidden animate-pulse">
          <div className="aspect-[4/3] bg-[#E8EFEA] dark:bg-[#061D1B]" />
          <div className="p-5 space-y-4">
            <div className="h-7 w-3/4 rounded-lg bg-[#E8EFEA] dark:bg-[#061D1B]" />
            <div className="h-4 w-1/2 rounded-lg bg-[#E8EFEA] dark:bg-[#061D1B]" />
            <div className="h-8 w-2/5 rounded-lg bg-[#E8EFEA] dark:bg-[#061D1B]" />
            <div className="space-y-2 pt-2">
              <div className="h-4 w-full rounded bg-[#E8EFEA] dark:bg-[#061D1B]" />
              <div className="h-4 w-5/6 rounded bg-[#E8EFEA] dark:bg-[#061D1B]" />
            </div>
            <div className="flex items-center gap-3 pt-4 border-t border-[#D2E0DC] dark:border-[#14443F]">
              <div className="h-12 w-32 rounded-full bg-[#E8EFEA] dark:bg-[#061D1B]" />
              <div className="h-12 flex-1 rounded-full bg-[#0F4C44]/20 dark:bg-[#00D68F]/25" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-full bg-[#F3F6F4] dark:bg-[#031719] text-[#0E2421] dark:text-[#F5FAFA] p-4 flex flex-col">
        <header className="pt-[max(0.25rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="min-w-[44px] min-h-[44px] rounded-full bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] text-[#0F4C44] dark:text-[#F5FAFA] flex items-center justify-center hover:border-[#0F4C44]/60 dark:hover:border-[#00D68F]/60 transition-colors shadow-xs dark:shadow-none"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <ThemeToggleButton className="rounded-full" />
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm p-6 rounded-[26px] bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] text-center space-y-3 shadow-[0_6px_24px_-8px_rgba(15,76,68,0.14)] dark:shadow-xl dark:shadow-black/35">
            <div className="w-12 h-12 rounded-2xl bg-[#E5F2EE] dark:bg-[#031719] border border-[#0F4C44]/20 dark:border-[#14443F] text-[#0F4C44] dark:text-[#00D68F] flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h1 className="text-base font-display font-bold text-[#0E2421] dark:text-[#F5FAFA]">
              Product not found
            </h1>
            <p className="text-xs text-[#46635E] dark:text-[#A9C0BD] leading-relaxed">
              {catalogError ??
                'This item may have been archived, removed by the merchant, or is still syncing.'}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleRetryLoadProduct}
                className="w-full min-h-[44px] rounded-full bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] text-[#FCFDFC] dark:text-[#031719] text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-[#0F4C44]/20 dark:shadow-[#00D68F]/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{t('retryLoadBtn')}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate({ name: 'home' })}
                className="w-full min-h-[44px] rounded-full bg-[#EBF1EE] dark:bg-[#031719] border border-[#D2E0DC] dark:border-[#14443F] text-[#0E2421] dark:text-[#F5FAFA] text-xs font-semibold hover:border-[#0F4C44]/50 dark:hover:border-[#00D68F]/50 transition-colors"
              >
                {t('backToHome')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const shop = shopsById[product.shopId];
  const proximity = shop ? proximityByShopId[shop.shopId] : undefined;
  const isFav = favorites.includes(product.productId);
  const productReviews = reviews.filter((r) => r.productId === product.productId);
  const filteredReviews =
    starFilter == null
      ? productReviews
      : productReviews.filter((r) => Math.round(r.rating) === starFilter);

  const seedBaseline = SEED_PRODUCTS.find((p) => p.productId === product.productId);
  const ratingSummary = calculateProductRatingSummary(
    product,
    reviews,
    seedReviewIds,
    seedBaseline
      ? { rating: seedBaseline.rating, reviewCount: seedBaseline.reviewCount }
      : undefined
  );

  const qualifyingOrder = getQualifyingPurchaseOrder(orders, product.productId, currentUid);
  const existingUserReview = getUserProductReview(reviews, product.productId, currentUid);
  const hasActiveUndeliveredOrder =
    !qualifyingOrder &&
    orders.some(
      (o) =>
        o.customerUid === currentUid &&
        !['delivered', 'canceled', 'rejected'].includes(o.orderStatus) &&
        o.items.some((i) => i.productId === product.productId)
    );
  const hasOnlyCanceledOrRejected =
    !qualifyingOrder &&
    !hasActiveUndeliveredOrder &&
    orders.some(
      (o) =>
        o.customerUid === currentUid &&
        (o.orderStatus === 'canceled' || o.orderStatus === 'rejected') &&
        o.items.some((i) => i.productId === product.productId)
    );

  const productCat = categories.find((c) => c.slug === product.category);
  const categoryLabel = productCat
    ? language === 'am'
      ? productCat.nameAm
      : language === 'om'
      ? productCat.nameOm
      : language === 'sid'
      ? productCat.nameSid || productCat.name
      : productCat.name
    : product.category.replace('-', ' ');

  const activeVariant =
    product.variants?.find((v) => v.id === selectedVariantId) ??
    product.variants?.[0] ??
    undefined;
  const activePrice = activeVariant?.price ?? product.price;
  const activePreviousPrice = activeVariant?.previousPrice ?? product.previousPrice;
  const activeStock = Math.max(0, activeVariant?.stock ?? product.stock ?? 0);

  const activeCartKey = getCartItemKey(product.productId, activeVariant?.id);
  const existingCartQty = cart.reduce(
    (sum, item) =>
      getCartItemKey(item.product.productId, item.variantId) === activeCartKey
        ? sum + item.quantity
        : sum,
    0
  );
  const cartTotalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const galleryImages = buildProductGalleryImages(product);
  const badges = deriveProductBadges(product, shop);
  const hasAnyOverlayBadges = badges.isOrganic || badges.isVerified || badges.hasFastDelivery;

  const shopUnavailable =
    !shop ||
    shop.status === 'suspended' ||
    (governanceConfig.strictShopVerification && shop.status !== 'approved');
  const outOfStock =
    !product.isAvailable || product.status !== 'active' || activeStock <= 0 || shopUnavailable;
  const hasDiscount = activePreviousPrice != null && activePreviousPrice > activePrice;
  const discountPct = hasDiscount
    ? calculateDiscountPercent(activePrice, activePreviousPrice!)
    : 0;
  const existingPriceAlert = getProductPriceAlert(priceAlerts, product.productId, currentUid);

  const scrollToGalleryIndex = (idx: number) => {
    const safeIdx = Math.max(0, Math.min(idx, Math.max(0, galleryImages.length - 1)));
    setSelectedImageIdx(safeIdx);
    const container = galleryRef.current;
    if (container) {
      container.scrollTo({
        left: safeIdx * container.clientWidth,
        behavior: 'smooth',
      });
    }
  };

  const handleGalleryScroll = () => {
    const container = galleryRef.current;
    if (!container || container.clientWidth <= 0) return;
    const nextIdx = Math.round(container.scrollLeft / container.clientWidth);
    if (nextIdx !== selectedImageIdx && nextIdx >= 0 && nextIdx < galleryImages.length) {
      setSelectedImageIdx(nextIdx);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current == null || galleryImages.length <= 1) return;
    const endX = e.changedTouches[0]?.clientX;
    if (typeof endX !== 'number') return;
    const delta = touchStartXRef.current - endX;
    touchStartXRef.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta > 0 && selectedImageIdx < galleryImages.length - 1) {
      scrollToGalleryIndex(selectedImageIdx + 1);
    } else if (delta < 0 && selectedImageIdx > 0) {
      scrollToGalleryIndex(selectedImageIdx - 1);
    }
  };

  const handleDecreaseQty = () => {
    setCartFeedbackError(null);
    setQuantity((q) => clampProductQuantity(q - 1, activeStock));
  };

  const handleIncreaseQty = () => {
    setCartFeedbackError(null);
    if (activeStock <= 0) return;
    if (quantity >= activeStock) {
      setCartFeedbackError(t('stockLimitReached', { count: activeStock }));
      return;
    }
    setQuantity((q) => clampProductQuantity(q + 1, activeStock));
  };

  const handleAddToCart = () => {
    setCartFeedbackError(null);
    const validation = validateAddToCartRequest({
      product,
      shop,
      variant: activeVariant,
      quantity,
      existingCartQty,
      strictShopVerification: governanceConfig.strictShopVerification,
    });

    if (!validation.allowed) {
      const errorMsg = t(validation.errorKey ?? 'productUnavailableError', {
        count:
          validation.errorKey === 'maxCartStockReached'
            ? validation.availableStock
            : Math.max(0, validation.maxAllowedToAdd),
      });
      setCartFeedbackError(errorMsg);
      if (validation.maxAllowedToAdd > 0 && quantity > validation.maxAllowedToAdd) {
        setQuantity(clampProductQuantity(validation.maxAllowedToAdd, activeStock));
      }
      return;
    }

    addToCart(product, quantity, activeVariant);
    setAddedFeedback(true);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setAddedFeedback(false), 2200);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/?product=${encodeURIComponent(product.productId)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: `${product.name} — ${formatETB(activePrice)} on Affin Connect`,
          url: shareUrl,
        });
        setOptionsMenuOpen(false);
        return;
      }
    } catch {
      // Fall back to clipboard copy
    }
    try {
      await navigator.clipboard.writeText(`${product.name} (${formatETB(activePrice)}) — ${shareUrl}`);
    } catch {
      // Clipboard blocked in non-HTTPS headless context — still show visual confirmation
    }
    setShareCopied(true);
    setOptionsMenuOpen(false);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const openPriceAlertModal = () => {
    const defaultTarget =
      existingPriceAlert && existingPriceAlert.targetPrice < product.price
        ? existingPriceAlert.targetPrice
        : calculateThresholdFromPercent(product.price, 15);
    setAlertTargetInput(String(defaultTarget));
    setAlertPushEnabled(existingPriceAlert ? existingPriceAlert.pushEnabled : true);
    setAlertError(null);
    setAlertModalOpen(true);
    setOptionsMenuOpen(false);
  };

  const handleSavePriceAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertError(null);
    const parsed = Number(alertTargetInput);
    const check = validatePriceAlertThreshold(parsed, product.price);
    if (!check.valid) {
      setAlertError(t(check.errorKey ?? 'priceAlertErrorLowerThanCurrent'));
      return;
    }

    setSavingAlert(true);
    try {
      await subscribePriceAlert({
        product,
        targetPrice: Math.round(parsed),
        enablePush: alertPushEnabled,
      });
      setAlertModalOpen(false);
    } catch (err) {
      setAlertError(err instanceof Error ? err.message : 'Could not save price alert.');
    } finally {
      setSavingAlert(false);
    }
  };

  const handleRemovePriceAlert = async () => {
    if (!existingPriceAlert) return;
    setSavingAlert(true);
    try {
      await removePriceAlert(existingPriceAlert.alertId);
      setAlertModalOpen(false);
    } catch (err) {
      setAlertError(err instanceof Error ? err.message : 'Could not remove price alert.');
    } finally {
      setSavingAlert(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError(null);
    const cleanShopComment = shopComment.trim();
    const errs = validateReviewInput({
      rating: reviewRating,
      comment: reviewComment,
      shopRating,
      shopComment: cleanShopComment || undefined,
    });
    const firstErr = Object.values(errs)[0];
    if (firstErr) {
      setReviewError(firstErr);
      return;
    }

    setSubmittingReview(true);
    try {
      await submitReview({
        productId: product.productId,
        shopId: product.shopId,
        rating: reviewRating,
        comment: reviewComment,
        shopRating,
        shopComment: cleanShopComment || undefined,
      });
      setReviewComment('');
      setShopComment('');
      setReviewRating(5);
      setShopRating(5);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Could not post your review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const startEditing = (
    revId: string,
    rating: number,
    comment: string,
    existingShopRating?: number,
    existingShopComment?: string
  ) => {
    setEditingReviewId(revId);
    setEditRating(rating);
    setEditComment(comment);
    setEditShopRating(existingShopRating ?? rating);
    setEditShopComment(existingShopComment ?? '');
    setEditError(null);
  };

  const handleEditSave = async (e: React.FormEvent, revId: string) => {
    e.preventDefault();
    setEditError(null);
    const cleanShopComment = editShopComment.trim();
    const errs = validateReviewInput({
      rating: editRating,
      comment: editComment,
      shopRating: editShopRating,
      shopComment: cleanShopComment || undefined,
    });
    const firstErr = Object.values(errs)[0];
    if (firstErr) {
      setEditError(firstErr);
      return;
    }

    setSavingEdit(true);
    try {
      await updateReview(
        revId,
        editRating,
        editComment,
        editShopRating,
        cleanShopComment || undefined
      );
      setEditingReviewId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not update your review.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteReview = async (revId: string) => {
    try {
      await deleteReview(revId);
      if (editingReviewId === revId) {
        setEditingReviewId(null);
      }
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Could not delete your review.');
    }
  };

  const renderPurchaseRow = (compactSticky = false) => (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        {/* Minus / Quantity / Plus Pill */}
        <div
          className={`flex items-center bg-[#EBF1EE] dark:bg-[#031719]/90 border border-[#D2E0DC] dark:border-[#14443F] rounded-full p-1 gap-1 shrink-0 ${
            compactSticky ? 'h-11' : 'h-12'
          }`}
        >
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={outOfStock || quantity <= 1}
            onClick={handleDecreaseQty}
            className="min-w-[40px] min-h-[40px] w-10 h-10 rounded-full bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/60 dark:hover:border-[#00D68F]/60 text-[#0F4C44] dark:text-[#F5FAFA] flex items-center justify-center transition-all active:scale-90 disabled:opacity-35 disabled:pointer-events-none"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span
            aria-live="polite"
            aria-label={t('quantity')}
            className="min-w-[28px] text-center text-sm font-bold text-[#0E2421] dark:text-[#F5FAFA] tabular-nums select-none"
          >
            {quantity}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={outOfStock || quantity >= activeStock}
            onClick={handleIncreaseQty}
            className="min-w-[40px] min-h-[40px] w-10 h-10 rounded-full bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/60 dark:hover:border-[#00D68F]/60 text-[#0F4C44] dark:text-[#F5FAFA] flex items-center justify-center transition-all active:scale-90 disabled:opacity-35 disabled:pointer-events-none"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Full-Width Emerald-to-Turquoise Gradient Add to Cart Button */}
        <button
          type="button"
          disabled={outOfStock}
          onClick={handleAddToCart}
          aria-label={
            outOfStock
              ? t('outOfStock')
              : `${t('addToCart')} ${product.name}`
          }
          className={`flex-1 ${
            compactSticky ? 'min-h-[44px]' : 'min-h-[48px]'
          } px-5 rounded-full bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 text-[#FCFDFC] dark:text-[#031719] font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0F4C44]/22 dark:shadow-[#00D68F]/25 transition-all active:scale-[0.98] disabled:from-[#E5ECE9] disabled:to-[#E5ECE9] dark:disabled:from-[#061D1B] dark:disabled:to-[#061D1B] disabled:text-[#46635E]/60 dark:disabled:text-[#A9C0BD]/60 disabled:border disabled:border-[#D2E0DC] dark:disabled:border-[#14443F] disabled:shadow-none`}
        >
          {outOfStock ? (
            <span>{t('outOfStock')}</span>
          ) : addedFeedback ? (
            <>
              <Check className="w-4 h-4 stroke-[2.5] shrink-0" />
              <span className="whitespace-nowrap">{t('addedToCart')}</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4 stroke-[2.25] shrink-0" />
              <span className="whitespace-nowrap">{t('addToCart')}</span>
            </>
          )}
        </button>
      </div>

      {/* Real-time Stock Error or Cart Success Feedback */}
      {cartFeedbackError && (
        <div
          role="alert"
          className="px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/65 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-200 text-xs font-medium flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{cartFeedbackError}</span>
        </div>
      )}

      {addedFeedback && !cartFeedbackError && !compactSticky && (
        <div
          role="status"
          aria-live="polite"
          className="px-3.5 py-2.5 rounded-xl bg-[#ECFDF5] dark:bg-[#00D68F]/15 border border-[#047857]/35 dark:border-[#00D68F]/40 text-[#047857] dark:text-[#00D68F] text-xs font-semibold flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-1.5 min-w-0 truncate">
            <Check className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {t('addedToCart')} ({cartTotalCount})
            </span>
          </span>
          <button
            type="button"
            onClick={() => navigate({ name: 'cart' })}
            className="px-2.5 py-1 rounded-lg bg-[#047857] dark:bg-[#00D68F] text-white dark:text-[#031719] text-[11px] font-bold shrink-0 whitespace-nowrap hover:brightness-105"
          >
            {t('viewCart')}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-full bg-[#F3F6F4] dark:bg-[#031719] text-[#0E2421] dark:text-[#F5FAFA] relative flex flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* Subtle Top Editorial Teal Ambient Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_rgba(15,76,68,0.12),_rgba(4,120,87,0.04)_48%,_transparent_76%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(0,214,143,0.18),_rgba(0,200,215,0.06)_45%,_transparent_75%)]"
      />

      {/* Top Navigation Row: Circular Back Button + Theme Toggle + Product Options Menu */}
      <header className="relative z-30 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-1 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="min-w-[44px] min-h-[44px] rounded-full bg-[#FCFDFC]/92 dark:bg-[#092825]/80 backdrop-blur-md border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/60 dark:hover:border-[#00D68F]/60 text-[#0F4C44] dark:text-[#F5FAFA] flex items-center justify-center shadow-[0_2px_10px_-3px_rgba(15,76,68,0.14)] dark:shadow-lg dark:shadow-black/25 transition-all active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {shareCopied && (
          <div
            role="status"
            className="px-3 py-1 rounded-full bg-[#FCFDFC]/95 dark:bg-[#092825]/95 border border-[#0F4C44]/40 dark:border-[#00D68F]/40 text-[#0F4C44] dark:text-[#00D68F] text-[11px] font-semibold shadow-md"
          >
            {t('linkCopied')}
          </div>
        )}

        <div className="flex items-center gap-2">
          <ThemeToggleButton className="rounded-full" />
          <div className="relative">
            <button
              type="button"
              onClick={() => setOptionsMenuOpen((prev) => !prev)}
              aria-label={t('productOptionsLabel')}
              aria-expanded={optionsMenuOpen}
              aria-haspopup="menu"
              className="min-w-[44px] min-h-[44px] rounded-full bg-[#FCFDFC]/92 dark:bg-[#092825]/80 backdrop-blur-md border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/60 dark:hover:border-[#00D68F]/60 text-[#0F4C44] dark:text-[#F5FAFA] flex items-center justify-center shadow-[0_2px_10px_-3px_rgba(15,76,68,0.14)] dark:shadow-lg dark:shadow-black/25 transition-all active:scale-95"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {optionsMenuOpen && (
              <>
                <div
                  aria-hidden="true"
                  onClick={() => setOptionsMenuOpen(false)}
                  className="fixed inset-0 z-30"
                />
                <div
                  role="menu"
                  aria-label={t('productOptionsLabel')}
                  className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#FCFDFC]/98 dark:bg-[#092825]/98 backdrop-blur-xl border border-[#D2E0DC] dark:border-[#14443F] shadow-[0_12px_32px_-8px_rgba(15,76,68,0.18)] dark:shadow-2xl dark:shadow-black/55 p-1.5 z-40 space-y-0.5"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleShare}
                    className="w-full min-h-[42px] px-3 rounded-xl text-left text-xs font-medium text-[#0C2624] dark:text-[#F5FAFA] hover:bg-[#EDF5F3] dark:hover:bg-[#031719]/80 flex items-center gap-2.5 transition-colors"
                  >
                    <Share2 className="w-4 h-4 text-[#047857] dark:text-[#00D68F] shrink-0" />
                    <span>{t('shareProduct')}</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      toggleFavorite(product.productId);
                      setOptionsMenuOpen(false);
                    }}
                    className="w-full min-h-[42px] px-3 rounded-xl text-left text-xs font-medium text-[#0C2624] dark:text-[#F5FAFA] hover:bg-[#EDF5F3] dark:hover:bg-[#031719]/80 flex items-center gap-2.5 transition-colors"
                  >
                    <Heart
                      className={`w-4 h-4 shrink-0 ${
                        isFav ? 'fill-rose-500 text-rose-500' : 'text-[#047857] dark:text-[#00D68F]'
                      }`}
                    />
                    <span>{isFav ? 'Remove from favorites' : 'Save to favorites'}</span>
                  </button>

                  {product.price > 1 && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={openPriceAlertModal}
                      className="w-full min-h-[42px] px-3 rounded-xl text-left text-xs font-medium text-[#0C2624] dark:text-[#F5FAFA] hover:bg-[#EDF5F3] dark:hover:bg-[#031719]/80 flex items-center gap-2.5 transition-colors"
                    >
                      <Bell className="w-4 h-4 text-[#0F766E] dark:text-[#00C8D7] shrink-0" />
                      <span>{t('priceAlertTitle')}</span>
                    </button>
                  )}

                  {shop && (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOptionsMenuOpen(false);
                          openShopChat(shop);
                        }}
                        className="w-full min-h-[42px] px-3 rounded-xl text-left text-xs font-medium text-[#0C2624] dark:text-[#F5FAFA] hover:bg-[#EDF5F3] dark:hover:bg-[#031719]/80 flex items-center gap-2.5 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4 text-[#047857] dark:text-[#00D68F] shrink-0" />
                        <span>{t('tradeChatMessageShopBtn')}</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOptionsMenuOpen(false);
                          navigate({ name: 'shop', shopId: shop.shopId });
                        }}
                        className="w-full min-h-[42px] px-3 rounded-xl text-left text-xs font-medium text-[#0C2624] dark:text-[#F5FAFA] hover:bg-[#EDF5F3] dark:hover:bg-[#031719]/80 flex items-center gap-2.5 transition-colors"
                      >
                        <Store className="w-4 h-4 text-[#047857] dark:text-[#00D68F] shrink-0" />
                        <span>{t('visitShop')}</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOptionsMenuOpen(false);
                      navigate({ name: 'cart' });
                    }}
                    className="w-full min-h-[42px] px-3 rounded-xl text-left text-xs font-medium text-[#0C2624] dark:text-[#F5FAFA] hover:bg-[#EDF5F3] dark:hover:bg-[#031719]/80 flex items-center justify-between gap-2 transition-colors border-t border-[#D5E6E2] dark:border-[#14443F] mt-1 pt-1"
                  >
                    <span className="flex items-center gap-2.5">
                      <ShoppingCart className="w-4 h-4 text-[#047857] dark:text-[#00D68F] shrink-0" />
                      <span>{t('viewCart')}</span>
                    </span>
                    {cartTotalCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#047857] dark:bg-[#00D68F] text-white dark:text-[#031719] text-[10px] font-bold tabular-nums">
                        {cartTotalCount}
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Gallery Pagination Dots (Centered Above Product Card) */}
      <div
        className="relative z-20 flex items-center justify-center gap-2 py-2"
        role="tablist"
        aria-label="Product photos"
      >
        {galleryImages.map((imgUrl, idx) => {
          const isActive = idx === selectedImageIdx;
          return (
            <button
              key={`dot-${imgUrl}-${idx}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`View photo ${idx + 1} of ${galleryImages.length}`}
              onClick={() => scrollToGalleryIndex(idx)}
              className="p-1.5 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#047857] dark:focus-visible:outline-[#00D68F] rounded-full"
            >
              <span
                className={`block rounded-full transition-all duration-200 ${
                  isActive
                    ? 'w-3 h-3 bg-[#047857] dark:bg-[#00D68F] shadow-sm shadow-[#047857]/40 dark:shadow-[#00D68F]/70'
                    : 'w-2 h-2 bg-[#C4DBD6] dark:bg-[#14443F] hover:bg-[#4B6B67]/60 dark:hover:bg-[#A9C0BD]/60'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Main Scrollable Content */}
      <div className="relative z-10 px-3.5 sm:px-4 space-y-5 flex-1">
        {/* Hero Product Card */}
        <section className="rounded-[26px] bg-[#FCFDFC] dark:bg-gradient-to-b dark:from-[#092825] dark:via-[#072220] dark:to-[#041A1C] border border-[#D2E0DC] dark:border-[#14443F] shadow-[0_6px_22px_-8px_rgba(15,76,68,0.14)] dark:shadow-2xl dark:shadow-black/45 overflow-hidden">
          {/* Swipeable Product Image Gallery */}
          <div className="relative aspect-[4/3] bg-[#E8EFEA] dark:bg-[#061D1B] overflow-hidden group">
            <div
              ref={galleryRef}
              onScroll={handleGalleryScroll}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="w-full h-full flex overflow-x-auto snap-x snap-mandatory mobile-scroll scroll-smooth"
            >
              {galleryImages.length > 0 ? (
                galleryImages.map((imgUrl, idx) => (
                  <div
                    key={`${imgUrl}-${idx}`}
                    className="w-full h-full shrink-0 snap-center relative"
                  >
                    <ResilientImage
                      src={imgUrl}
                      alt={`${product.name} ${idx + 1}`}
                      fallbackTitle={product.name}
                      darkSurface
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))
              ) : (
                <div className="w-full h-full shrink-0 flex flex-col items-center justify-center text-[#46635E] dark:text-[#A9C0BD] p-6">
                  <AlertCircle className="w-7 h-7 text-[#0F4C44]/70 dark:text-[#00D68F]/70 mb-2" />
                  <span className="text-xs font-medium">{t('imageLoadError')}</span>
                </div>
              )}
            </div>

            {/* Subtle top & bottom gradient scrims for legibility & smooth blend */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#031719]/45 dark:from-[#031719]/55 to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#FCFDFC] via-[#FCFDFC]/35 dark:from-[#092825] dark:via-[#092825]/35 to-transparent"
            />

            {/* Top-Left Product & Merchant Badges (Strictly Data-Backed) */}
            {hasAnyOverlayBadges && (
              <div className="pointer-events-none absolute top-3.5 left-3.5 flex flex-col items-start gap-1.5 z-10">
                {badges.isOrganic && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#031719]/75 backdrop-blur-md border border-[#00D68F]/25 text-[#F5FAFA] text-xs font-medium shadow-sm">
                    <Leaf className="w-3.5 h-3.5 text-[#00D68F] shrink-0" />
                    <span>{t('organicBadge')}</span>
                  </span>
                )}
                {badges.isVerified && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#031719]/75 backdrop-blur-md border border-[#00D68F]/25 text-[#F5FAFA] text-xs font-medium shadow-sm">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#00D68F] shrink-0" />
                    <span>{t('verifiedMerchantLabel')}</span>
                  </span>
                )}
                {badges.hasFastDelivery && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#031719]/75 backdrop-blur-md border border-[#00D68F]/25 text-[#F5FAFA] text-xs font-medium shadow-sm">
                    <Truck className="w-3.5 h-3.5 text-[#00D68F] shrink-0" />
                    <span>{t('fastDeliveryBadge')}</span>
                  </span>
                )}
              </div>
            )}

            {/* Top-Right Floating Favorite / Heart Button */}
            <button
              type="button"
              onClick={() => toggleFavorite(product.productId)}
              aria-pressed={isFav}
              aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
              className="absolute top-3 right-3 z-10 min-w-[44px] min-h-[44px] rounded-full bg-[#031719]/70 backdrop-blur-md border border-white/20 hover:border-[#00D68F]/60 text-[#F5FAFA] flex items-center justify-center shadow-lg transition-all active:scale-90"
            >
              <Heart
                className={`w-5 h-5 transition-transform duration-200 ${
                  isFav ? 'fill-rose-500 text-rose-500 scale-110' : 'text-[#F5FAFA]'
                }`}
              />
            </button>

            {/* Optional Prev / Next Arrow Tap Controls for Multi-Photo Desktop/Accessibility */}
            {galleryImages.length > 1 && (
              <>
                {selectedImageIdx > 0 && (
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={() => scrollToGalleryIndex(selectedImageIdx - 1)}
                    className="hidden sm:flex opacity-0 group-hover:opacity-100 focus:opacity-100 absolute left-2.5 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] rounded-full bg-[#031719]/75 border border-[#14443F] text-[#F5FAFA] items-center justify-center transition-opacity"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                {selectedImageIdx < galleryImages.length - 1 && (
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={() => scrollToGalleryIndex(selectedImageIdx + 1)}
                    className="hidden sm:flex opacity-0 group-hover:opacity-100 focus:opacity-100 absolute right-2.5 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] rounded-full bg-[#031719]/75 border border-[#14443F] text-[#F5FAFA] items-center justify-center transition-opacity"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </>
            )}

            {/* Out of Stock Overlay */}
            {outOfStock && (
              <div className="absolute inset-0 bg-[#031719]/55 dark:bg-[#031719]/65 flex items-center justify-center pointer-events-none z-10">
                <span className="px-4 py-1.5 rounded-full bg-[#FCFDFC]/95 dark:bg-[#092825]/95 border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-bold shadow-lg">
                  {t('outOfStock')}
                </span>
              </div>
            )}
          </div>

          {/* Card Content Body */}
          <div className="px-5 pt-2 pb-5 space-y-3.5">
            {/* Title, Merchant & Verified Status, Rating */}
            <div className="space-y-1.5">
              <h1 className="text-[22px] sm:text-2xl font-display font-bold text-[#0C2624] dark:text-[#F5FAFA] leading-tight tracking-tight">
                {product.name}
              </h1>

              {/* Merchant Line */}
              <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                <button
                  type="button"
                  onClick={() => shop && navigate({ name: 'shop', shopId: shop.shopId })}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4B6B67] dark:text-[#A9C0BD] hover:text-[#047857] dark:hover:text-[#00D68F] transition-colors text-left"
                >
                  <span className="truncate max-w-[240px]">
                    {shop?.name ?? product.shopName}
                  </span>
                  {badges.isVerified && (
                    <BadgeCheck
                      className="w-4 h-4 text-[#047857] dark:text-[#00D68F] shrink-0"
                      aria-label={t('verifiedMerchantLabel')}
                    />
                  )}
                </button>
                <span aria-hidden="true" className="text-[#C4DBD6] dark:text-[#14443F]">
                  ·
                </span>
                <span className="text-xs text-[#4B6B67] dark:text-[#A9C0BD]/80 capitalize">
                  {categoryLabel}
                </span>
              </div>

              {/* Rating & Review Count (Strictly When Available) */}
              {ratingSummary.reviewCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    reviewsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="inline-flex items-center gap-1.5 text-sm pt-0.5 hover:opacity-85 transition-opacity"
                >
                  <Star className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B] shrink-0" />
                  <span className="font-bold text-[#047857] dark:text-[#00D68F] tabular-nums">
                    {ratingSummary.averageRating.toFixed(1)}
                  </span>
                  <span className="text-[#4B6B67] dark:text-[#A9C0BD] tabular-nums text-xs">
                    ({t('reviewsCountLabel', { count: ratingSummary.reviewCount })})
                  </span>
                </button>
              )}
            </div>

            {/* Price, Strikethrough Original Price, Discount Pill */}
            <div className="flex items-center gap-3 flex-wrap pt-0.5">
              <span className="text-[26px] sm:text-[28px] font-display font-bold text-[#0F4C44] dark:text-[#00D68F] tabular-nums leading-none tracking-tight">
                {formatETB(activePrice)}
              </span>

              {hasDiscount && (
                <>
                  <span className="text-base text-[#46635E]/70 dark:text-[#A9C0BD]/60 line-through tabular-nums font-medium">
                    {formatETB(activePreviousPrice!)}
                  </span>
                  {discountPct > 0 && (
                    <span className="px-3 py-1 rounded-full bg-[#E5F2EE] dark:bg-[#00D68F]/15 border border-[#0F4C44]/30 dark:border-[#00D68F]/45 text-[#0F4C44] dark:text-[#00D68F] text-xs font-bold tabular-nums">
                      -{discountPct}%
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Interactive Variant / Option Selector */}
            {product.variants && product.variants.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-xs font-semibold text-[#4B6B67] dark:text-[#A9C0BD]">
                  {t('selectOption')}
                </div>
                <div
                  className="flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-label={t('selectOption')}
                >
                  {product.variants.map((variant) => {
                    const selected = variant.id === activeVariant?.id;
                    const variantStock = variant.stock ?? product.stock;
                    const variantOut = variantStock <= 0;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={variantOut}
                        onClick={() => {
                          setSelectedVariantId(variant.id);
                          setCartFeedbackError(null);
                          setQuantity((q) => clampProductQuantity(q, variantStock));
                        }}
                        className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap ${
                          selected
                            ? 'border-[#047857] dark:border-[#00D68F] bg-[#ECFDF5] dark:bg-[#00D68F]/15 text-[#047857] dark:text-[#00D68F] shadow-sm shadow-[#047857]/10 dark:shadow-[#00D68F]/10'
                            : 'border-[#D2E0DC] dark:border-[#14443F] bg-[#F3F6F4] dark:bg-[#031719]/80 text-[#0E2421] dark:text-[#F5FAFA] hover:border-[#0F4C44]/45 dark:hover:border-[#00D68F]/45 disabled:opacity-40'
                        }`}
                      >
                        {variant.label} · {formatETB(variant.price)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Product Details Section */}
            <div className="pt-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-[#ECFDF5] dark:bg-[#00D68F]/15 border border-[#047857]/30 dark:border-[#00D68F]/35 text-[#047857] dark:text-[#00D68F] flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </span>
                <h2 className="text-sm font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                  {t('productDetails')}
                </h2>
              </div>

              <p className="text-[13.5px] text-[#4B6B67] dark:text-[#A9C0BD] leading-relaxed">
                {product.description}
              </p>

              {/* Coffee-Specific Metadata (Strictly Data-Backed) */}
              {product.coffeeDetails && Object.keys(product.coffeeDetails).length > 0 && (
                <div className="mt-2.5 rounded-2xl bg-[#FAF4EC] dark:bg-gradient-to-br dark:from-[#3A221A]/85 dark:to-[#1B110E]/90 border border-[#E2CEBA] dark:border-[#C68B59]/35 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#3A221A] dark:text-[#F8F4EE]">
                    <Coffee className="w-3.5 h-3.5 text-[#9A5B2C] dark:text-[#C68B59] shrink-0" />
                    <span>{t('coffeeDetailsSectionTitle')}</span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                    {product.coffeeDetails.origin && (
                      <div>
                        <dt className="text-[#6E5144] dark:text-[#D5C3B3]/75">
                          {t('coffeeFilterOrigin')}
                        </dt>
                        <dd className="font-semibold text-[#3A221A] dark:text-[#F8F4EE]">
                          {product.coffeeDetails.origin}
                        </dd>
                      </div>
                    )}
                    {product.coffeeDetails.brand && (
                      <div>
                        <dt className="text-[#6E5144] dark:text-[#D5C3B3]/75">
                          {t('coffeeFilterBrand')}
                        </dt>
                        <dd className="font-semibold text-[#3A221A] dark:text-[#F8F4EE]">
                          {product.coffeeDetails.brand}
                        </dd>
                      </div>
                    )}
                    {product.coffeeDetails.roastLevel && (
                      <div>
                        <dt className="text-[#6E5144] dark:text-[#D5C3B3]/75">
                          {t('coffeeFilterRoast')}
                        </dt>
                        <dd className="font-semibold text-[#3A221A] dark:text-[#F8F4EE]">
                          {formatCoffeeRoastLevel(product.coffeeDetails.roastLevel)}
                        </dd>
                      </div>
                    )}
                    {product.coffeeDetails.processingMethod && (
                      <div>
                        <dt className="text-[#6E5144] dark:text-[#D5C3B3]/75">
                          {t('coffeeProcessMethod')}
                        </dt>
                        <dd className="font-semibold text-[#3A221A] dark:text-[#F8F4EE]">
                          {formatCoffeeProcessMethod(product.coffeeDetails.processingMethod)}
                        </dd>
                      </div>
                    )}
                    {product.coffeeDetails.beanForm && (
                      <div>
                        <dt className="text-[#6E5144] dark:text-[#D5C3B3]/75">
                          {t('coffeeFilterForm')}
                        </dt>
                        <dd className="font-semibold text-[#3A221A] dark:text-[#F8F4EE]">
                          {formatCoffeeBeanForm(product.coffeeDetails.beanForm)}
                        </dd>
                      </div>
                    )}
                    {product.coffeeDetails.packageWeight && (
                      <div>
                        <dt className="text-[#6E5144] dark:text-[#D5C3B3]/75">
                          {t('coffeeFilterWeight')}
                        </dt>
                        <dd className="font-semibold text-[#3A221A] dark:text-[#F8F4EE] tabular-nums">
                          {product.coffeeDetails.packageWeight}
                        </dd>
                      </div>
                    )}
                    {product.coffeeDetails.roastDate && (
                      <div className="col-span-2">
                        <dt className="text-[#6E5144] dark:text-[#D5C3B3]/75">
                          {t('coffeeRoastDate')}
                        </dt>
                        <dd className="font-semibold text-[#3A221A] dark:text-[#F8F4EE] tabular-nums">
                          {product.coffeeDetails.roastDate}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* Availability, Stock & Delivery Metadata */}
              <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="px-3 py-2.5 rounded-xl bg-[#F3F6F4] dark:bg-[#031719]/70 border border-[#D2E0DC] dark:border-[#123E39] flex items-center justify-between gap-2">
                  <span className="text-[#4B6B67] dark:text-[#A9C0BD]">{t('inStock')}</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      outOfStock
                        ? 'text-rose-600 dark:text-rose-400'
                        : activeStock <= 6
                        ? 'text-amber-600 dark:text-[#F59E0B]'
                        : 'text-[#047857] dark:text-[#00D68F]'
                    }`}
                  >
                    {outOfStock
                      ? t('outOfStock')
                      : activeStock <= 6
                      ? t('onlyLeftInStock', { count: activeStock })
                      : t('inStockCount', { count: activeStock })}
                  </span>
                </div>

                <div className="px-3 py-2.5 rounded-xl bg-[#F3F6F4] dark:bg-[#031719]/70 border border-[#D2E0DC] dark:border-[#123E39] flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[#4B6B67] dark:text-[#A9C0BD] min-w-0 truncate">
                    <Truck className="w-3.5 h-3.5 text-[#047857] dark:text-[#00D68F] shrink-0" />
                    <span className="truncate">
                      {product.deliveryAvailable ? t('hawassaDelivery') : t('pickupReady')}
                    </span>
                  </span>
                  {proximity && product.deliveryAvailable ? (
                    <span className="inline-flex items-center gap-1 text-[#0F766E] dark:text-[#00C8D7] font-semibold tabular-nums shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>~{proximity.estimatedBajajMinutes}m</span>
                    </span>
                  ) : (
                    <span className="text-[#0C2624] dark:text-[#F5FAFA] font-medium shrink-0">
                      {product.pickupAvailable ? t('pickupShort') : t('deliveryShort')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Hairline Divider & Primary Quantity + Add to Cart Row */}
            <div ref={cardPurchaseRef} className="pt-4 border-t border-[#D5E6E2] dark:border-[#14443F]/80">
              {renderPurchaseRow(false)}
            </div>
          </div>
        </section>

        {/* Price Alert Subscription Trigger */}
        {product.price > 1 && (
          <button
            type="button"
            onClick={openPriceAlertModal}
            className={`w-full min-h-[48px] px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all ${
              existingPriceAlert?.status === 'triggered'
                ? 'bg-amber-50 dark:bg-[#F59E0B]/10 border-amber-300 dark:border-[#F59E0B]/40 hover:bg-amber-100/80 dark:hover:bg-[#F59E0B]/15'
                : existingPriceAlert?.status === 'active'
                ? 'bg-[#ECFDF5] dark:bg-[#00D68F]/10 border-[#047857]/35 dark:border-[#00D68F]/40 hover:bg-[#D1FAE5]/70 dark:hover:bg-[#00D68F]/15'
                : 'bg-[#FCFDFC] dark:bg-[#092825] border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/50 dark:hover:border-[#00D68F]/50 shadow-[0_2px_10px_-3px_rgba(15,76,68,0.08)] dark:shadow-none'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  existingPriceAlert?.status === 'triggered'
                    ? 'bg-amber-100 dark:bg-[#F59E0B]/20 text-amber-700 dark:text-[#F59E0B]'
                    : existingPriceAlert?.status === 'active'
                    ? 'bg-[#0F4C44]/15 dark:bg-[#00D68F]/20 text-[#0F4C44] dark:text-[#00D68F]'
                    : 'bg-[#E5F2EE] dark:bg-[#031719] border border-[#0F4C44]/18 dark:border-[#14443F] text-[#0F4C44] dark:text-[#00C8D7]'
                }`}
              >
                {existingPriceAlert?.status === 'triggered' ? (
                  <TrendingDown className="w-4 h-4" />
                ) : existingPriceAlert?.status === 'active' ? (
                  <BellRing className="w-4 h-4" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <div
                  className={`text-xs font-bold truncate tabular-nums ${
                    existingPriceAlert?.status === 'triggered'
                      ? 'text-amber-800 dark:text-[#F59E0B]'
                      : existingPriceAlert?.status === 'active'
                      ? 'text-[#0F4C44] dark:text-[#00D68F]'
                      : 'text-[#0E2421] dark:text-[#F5FAFA]'
                  }`}
                >
                  {existingPriceAlert?.status === 'triggered'
                    ? t('priceAlertTriggeredBanner', {
                        current: formatETB(product.price),
                        target: formatETB(existingPriceAlert.targetPrice),
                      })
                    : existingPriceAlert?.status === 'active'
                    ? t('priceAlertActiveBanner', {
                        amount: formatETB(existingPriceAlert.targetPrice),
                      })
                    : t('priceAlertBannerCta')}
                </div>
                <div className="text-[11px] text-[#46635E] dark:text-[#A9C0BD] truncate">
                  {existingPriceAlert
                    ? existingPriceAlert.pushEnabled
                      ? t('priceAlertPushToggleLabel')
                      : t('notifications')
                    : t('priceAlertBannerHint')}
                </div>
              </div>
            </div>
            <span
              className={`text-xs font-semibold flex items-center gap-0.5 shrink-0 whitespace-nowrap ${
                existingPriceAlert?.status === 'triggered'
                  ? 'text-amber-700 dark:text-[#F59E0B]'
                  : 'text-[#0F4C44] dark:text-[#00D68F]'
              }`}
            >
              {existingPriceAlert && <span>{t('edit')}</span>}
              <ChevronRight className="w-4 h-4" />
            </span>
          </button>
        )}

        {/* Merchant Shop Card */}
        {shop && (
          <section className="p-4 rounded-2xl border border-[#D2E0DC] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#092825] flex items-center justify-between gap-3 shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-md dark:shadow-black/20">
            <button
              type="button"
              onClick={() => navigate({ name: 'shop', shopId: shop.shopId })}
              className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-85 transition-opacity"
            >
              <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#E8EFEA] dark:bg-[#031719] border border-[#D2E0DC] dark:border-[#14443F] shrink-0">
                <ResilientImage
                  src={shop.logoUrl}
                  alt={shop.name}
                  fallbackTitle={shop.name}
                  darkSurface
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-xs font-bold text-[#0E2421] dark:text-[#F5FAFA] truncate">
                    {shop.name}
                  </span>
                  {badges.isVerified && (
                    <BadgeCheck className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#00D68F] shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[#46635E] dark:text-[#A9C0BD] mt-0.5 truncate">
                  <MapPin className="w-3 h-3 text-[#0F4C44] dark:text-[#00D68F] shrink-0" />
                  <span className="truncate">
                    {getLocalizedNeighborhood(shop.neighborhood, language)}, Hawassa
                  </span>
                </div>
              </div>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openShopChat(shop)}
                className="min-h-[40px] px-3 rounded-xl bg-[#E5F2EE] dark:bg-[#00D68F]/15 border border-[#0F4C44]/28 dark:border-[#00D68F]/35 text-[11px] font-bold text-[#0F4C44] dark:text-[#00D68F] hover:bg-[#D5EAE3] dark:hover:bg-[#00D68F]/25 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{t('tradeChatMessageShopBtn')}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate({ name: 'shop', shopId: shop.shopId })}
                className="min-h-[40px] px-2.5 text-xs font-semibold text-[#0F4C44] dark:text-[#00C8D7] hover:text-[#047857] dark:hover:text-[#00D68F] whitespace-nowrap transition-colors"
              >
                {t('visitShop')}
              </button>
            </div>
          </section>
        )}

        {/* Verified Ratings & Customer Reviews */}
        <section
          ref={reviewsSectionRef}
          id="product-reviews-section"
          className="p-4 rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] space-y-4 shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-md dark:shadow-black/20"
        >
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#D2E0DC]/70 dark:border-transparent">
            <h2 className="text-sm font-bold text-[#0F4C44] dark:text-[#F5FAFA]">
              {t('ratingsAndReviews')}
            </h2>
            <span className="text-[11px] text-[#46635E] dark:text-[#A9C0BD] tabular-nums">
              {ratingSummary.reviewCount === 1
                ? t('ratingSingle', { count: ratingSummary.reviewCount })
                : t('ratingPlural', { count: ratingSummary.reviewCount })}
            </span>
          </div>

          {/* Rating Breakdown Box */}
          <div className="p-3.5 rounded-2xl bg-[#F3F6F4] dark:bg-[#031719]/80 border border-[#D2E0DC] dark:border-[#123E39] grid grid-cols-12 gap-3 items-center">
            <div className="col-span-5 text-center border-r border-[#D5E6E2] dark:border-[#14443F] pr-2">
              <div className="text-3xl font-display font-bold text-[#0C2624] dark:text-[#F5FAFA] tabular-nums">
                {ratingSummary.reviewCount > 0 ? ratingSummary.averageRating.toFixed(1) : '—'}
              </div>
              <div className="flex items-center justify-center gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3.5 h-3.5 ${
                      s <= Math.round(ratingSummary.averageRating)
                        ? 'fill-[#F59E0B] text-[#F59E0B]'
                        : 'text-[#C4DBD6] dark:text-[#14443F]'
                    }`}
                  />
                ))}
              </div>
              <div className="text-[10px] text-[#4B6B67] dark:text-[#A9C0BD] mt-1">
                {productReviews.length === 1
                  ? t('writtenReviewSingle', { count: productReviews.length })
                  : t('writtenReviewPlural', { count: productReviews.length })}
              </div>
            </div>

            <div className="col-span-7 space-y-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratingSummary.distribution[star as 1 | 2 | 3 | 4 | 5];
                const pct =
                  productReviews.length > 0
                    ? Math.round((count / productReviews.length) * 100)
                    : 0;
                const active = starFilter === star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setStarFilter(active ? null : star)}
                    aria-label={`Filter by ${star} star reviews`}
                    className={`w-full flex items-center gap-2 text-[11px] rounded-md px-1.5 py-0.5 transition-colors ${
                      active
                        ? 'bg-amber-100 dark:bg-[#F59E0B]/15'
                        : 'hover:bg-white dark:hover:bg-[#092825]'
                    }`}
                  >
                    <span className="w-6 text-left font-semibold text-[#0C2624] dark:text-[#F5FAFA] tabular-nums">
                      {star} ★
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-[#DCEAE6] dark:bg-[#14443F] overflow-hidden">
                      <div
                        className={`h-full bg-[#F59E0B] rounded-full transition-all ${getBarWidthClass(
                          pct
                        )}`}
                      />
                    </div>
                    <span className="w-5 text-right text-[#4B6B67] dark:text-[#A9C0BD] tabular-nums">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {starFilter != null && (
            <div className="flex items-center justify-between text-xs bg-amber-50 dark:bg-[#F59E0B]/15 border border-amber-300 dark:border-[#F59E0B]/30 rounded-xl px-3 py-2">
              <span className="font-medium text-amber-800 dark:text-[#F59E0B]">
                {t('showingStarReviews', { star: starFilter, count: filteredReviews.length })}
              </span>
              <button
                type="button"
                onClick={() => setStarFilter(null)}
                className="font-semibold text-amber-800 dark:text-[#F59E0B] hover:underline"
              >
                {t('showAll')}
              </button>
            </div>
          )}

          {/* Review Eligibility / Composer */}
          {existingUserReview ? (
            <div className="p-3 rounded-xl bg-[#ECFDF5] dark:bg-[#00D68F]/10 border border-[#047857]/30 dark:border-[#00D68F]/30 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-[#047857] dark:text-[#00D68F] font-medium">
                <BadgeCheck className="w-4 h-4 shrink-0" />
                <span>{t('youRatedProduct', { rating: existingUserReview.rating })}</span>
              </div>
              {editingReviewId !== existingUserReview.reviewId && (
                <button
                  type="button"
                  onClick={() =>
                    startEditing(
                      existingUserReview.reviewId,
                      existingUserReview.rating,
                      existingUserReview.comment,
                      existingUserReview.shopRating,
                      existingUserReview.shopComment
                    )
                  }
                  className="font-bold text-[#047857] dark:text-[#00D68F] hover:underline shrink-0"
                >
                  {t('editReview')}
                </button>
              )}
            </div>
          ) : qualifyingOrder ? (
            <form
              onSubmit={handleReviewSubmit}
              className="p-3.5 rounded-2xl border border-[#047857]/30 dark:border-[#00D68F]/30 bg-[#F3F6F4] dark:bg-[#031719]/75 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                    {t('rateAndReviewProduct')}
                  </div>
                  <div className="text-[11px] text-[#047857] dark:text-[#00D68F] flex items-center gap-1 mt-0.5">
                    <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {t('verifiedBuyerOrder', {
                        order: qualifyingOrder.orderId.slice(-6).toUpperCase(),
                      })}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-700 dark:text-[#F59E0B]">
                  {t(STAR_LABEL_KEYS[reviewRating])}
                </span>
              </div>

              <div className="flex items-center gap-1.5" role="group" aria-label="Star rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    aria-label={`Rate ${star} stars`}
                    className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#092825] transition-colors"
                  >
                    <Star
                      className={`w-6 h-6 transition-colors ${
                        star <= reviewRating
                          ? 'fill-[#F59E0B] text-[#F59E0B]'
                          : 'text-[#C4DBD6] dark:text-[#14443F]'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <div>
                <textarea
                  id="review-input"
                  rows={3}
                  maxLength={500}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder={t('reviewPlaceholder')}
                  className="w-full p-3 rounded-xl border border-[#D5E6E2] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#092825] text-xs text-[#0C2624] dark:text-[#F5FAFA] placeholder:text-[#4B6B67]/60 dark:placeholder:text-[#A9C0BD]/50 focus:outline-none focus:ring-2 focus:ring-[#047857]/25 dark:focus:ring-[#00D68F]/25 focus:border-[#047857] dark:focus:border-[#00D68F] resize-none"
                />
                <div className="flex items-center justify-between mt-1 text-[10px] text-[#4B6B67] dark:text-[#A9C0BD]">
                  <span>{t('minimumThreeChars')}</span>
                  <span className="tabular-nums">{reviewComment.trim().length}/500</span>
                </div>
              </div>

              {shop && (
                <div className="pt-2.5 border-t border-[#D5E6E2] dark:border-[#14443F] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                      {t('rateAndReviewShop')} · {shop.name}
                    </span>
                    <span className="text-[11px] font-semibold text-amber-700 dark:text-[#F59E0B]">
                      {shopRating}/5
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1"
                    role="group"
                    aria-label={t('shopRatingLabel')}
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setShopRating(star)}
                        aria-label={`Rate shop ${star} stars`}
                        className="p-1 rounded-lg hover:bg-white dark:hover:bg-[#092825] transition-colors"
                      >
                        <Star
                          className={`w-5 h-5 transition-colors ${
                            star <= shopRating
                              ? 'fill-[#F59E0B] text-[#F59E0B]'
                              : 'text-[#C4DBD6] dark:text-[#14443F]'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    id="shop-review-input"
                    rows={2}
                    maxLength={500}
                    value={shopComment}
                    onChange={(e) => setShopComment(e.target.value)}
                    placeholder={t('shopReviewPlaceholder', { shop: shop.name })}
                    className="w-full p-2.5 rounded-xl border border-[#D5E6E2] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#092825] text-xs text-[#0C2624] dark:text-[#F5FAFA] placeholder:text-[#4B6B67]/60 dark:placeholder:text-[#A9C0BD]/50 focus:outline-none focus:ring-2 focus:ring-[#047857]/25 dark:focus:ring-[#00D68F]/25 focus:border-[#047857] dark:focus:border-[#00D68F] resize-none"
                  />
                </div>
              )}

              {reviewError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-xs text-rose-800 dark:text-rose-200">
                  {reviewError}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingReview}
                className="w-full min-h-[44px] rounded-full bg-gradient-to-r from-[#047857] to-[#0D9488] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 disabled:opacity-50 text-white dark:text-[#031719] text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                {submittingReview ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('postingReview')}</span>
                  </>
                ) : (
                  <span>{t('submitVerifiedReview')}</span>
                )}
              </button>
            </form>
          ) : (
            <div className="p-3.5 rounded-2xl border border-[#D5E6E2] dark:border-[#123E39] bg-[#F3F6F4] dark:bg-[#031719]/65 space-y-2">
              <div className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-[#047857] dark:text-[#00D68F] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                    {t('verifiedBuyersOnly')}
                  </div>
                  <p className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] leading-relaxed">
                    {hasActiveUndeliveredOrder
                      ? t('verifiedDeliveredPrompt')
                      : hasOnlyCanceledOrRejected
                      ? t('verifiedBuyersCanceledPrompt')
                      : t('verifiedBuyersPrompt')}
                  </p>
                </div>
              </div>
              {!outOfStock && (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="text-[11px] font-bold text-[#047857] dark:text-[#00D68F] hover:underline pl-6"
                >
                  {t('addToCartToPurchase')}
                </button>
              )}
            </div>
          )}

          {/* Customer Review List */}
          {filteredReviews.length === 0 ? (
            <p className="text-xs text-[#4B6B67] dark:text-[#A9C0BD] py-1">
              {starFilter != null
                ? t('noStarReviewsYet', { star: starFilter })
                : t('noReviewsYet')}
            </p>
          ) : (
            <div className="space-y-2.5">
              {filteredReviews.map((rev) => {
                const isOwn = rev.customerUid === currentUid;
                const isEditing = editingReviewId === rev.reviewId;

                return (
                  <div
                    key={rev.reviewId}
                    className={`p-3.5 rounded-2xl border space-y-2 ${
                      isOwn
                        ? 'bg-[#ECFDF5] dark:bg-[#00D68F]/10 border-[#047857]/30 dark:border-[#00D68F]/35'
                        : 'bg-[#F3F6F4] dark:bg-[#031719]/75 border-[#D5E6E2] dark:border-[#123E39]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                            {rev.customerName}
                          </span>
                          {rev.verifiedPurchase !== false && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#047857] dark:text-[#00D68F]">
                              <BadgeCheck className="w-3 h-3" />
                              {t('verifiedPurchase')}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#4B6B67]/85 dark:text-[#A9C0BD]/80 mt-0.5">
                          {formatReviewDate(rev.createdAt)}
                          {rev.updatedAt && rev.updatedAt !== rev.createdAt
                            ? ` · ${t('editedTag')}`
                            : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= rev.rating
                                ? 'fill-[#F59E0B] text-[#F59E0B]'
                                : 'text-[#C4DBD6] dark:text-[#14443F]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {isEditing ? (
                      <form onSubmit={(e) => handleEditSave(e, rev.reviewId)} className="space-y-2">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setEditRating(star)}
                              aria-label={`Update rating to ${star} stars`}
                              className="p-1"
                            >
                              <Star
                                className={`w-5 h-5 ${
                                  star <= editRating
                                    ? 'fill-[#F59E0B] text-[#F59E0B]'
                                    : 'text-[#C4DBD6] dark:text-[#14443F]'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                        <textarea
                          rows={3}
                          maxLength={500}
                          value={editComment}
                          onChange={(e) => setEditComment(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-[#D5E6E2] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#092825] text-xs text-[#0C2624] dark:text-[#F5FAFA] focus:outline-none focus:ring-2 focus:ring-[#047857]/25 dark:focus:ring-[#00D68F]/25 focus:border-[#047857] dark:focus:border-[#00D68F] resize-none"
                        />
                        {shop && (
                          <div className="space-y-1.5 pt-1 border-t border-[#D5E6E2] dark:border-[#14443F]">
                            <div className="text-[11px] font-semibold text-[#4B6B67] dark:text-[#A9C0BD]">
                              {t('shopRatingLabel')} ({shop.name})
                            </div>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setEditShopRating(star)}
                                  aria-label={`Update shop rating to ${star} stars`}
                                  className="p-1"
                                >
                                  <Star
                                    className={`w-4 h-4 ${
                                      star <= editShopRating
                                        ? 'fill-[#F59E0B] text-[#F59E0B]'
                                        : 'text-[#C4DBD6] dark:text-[#14443F]'
                                    }`}
                                  />
                                </button>
                              ))}
                            </div>
                            <textarea
                              rows={2}
                              maxLength={500}
                              value={editShopComment}
                              onChange={(e) => setEditShopComment(e.target.value)}
                              placeholder={t('shopReviewPlaceholder', { shop: shop.name })}
                              className="w-full p-2 rounded-xl border border-[#D5E6E2] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#092825] text-xs text-[#0C2624] dark:text-[#F5FAFA] focus:outline-none focus:ring-2 focus:ring-[#047857]/25 dark:focus:ring-[#00D68F]/25 focus:border-[#047857] dark:focus:border-[#00D68F] resize-none"
                            />
                          </div>
                        )}
                        {editError && (
                          <div className="text-[11px] text-rose-600 dark:text-rose-300 font-medium">
                            {editError}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            disabled={savingEdit}
                            className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#047857] to-[#0D9488] dark:from-[#00D68F] dark:to-[#00C8D7] text-white dark:text-[#031719] text-[11px] font-bold disabled:opacity-50"
                          >
                            {savingEdit ? t('saving') : t('saveChanges')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingReviewId(null)}
                            className="px-3.5 py-1.5 rounded-full border border-[#D5E6E2] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#092825] text-[11px] font-semibold text-[#4B6B67] dark:text-[#A9C0BD]"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="text-xs text-[#4B6B67] dark:text-[#A9C0BD] leading-relaxed">
                          {rev.comment}
                        </p>
                        {(rev.shopRating != null || rev.shopComment) && (
                          <div className="p-2.5 rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D5E6E2] dark:border-[#14443F] text-[11px] space-y-1">
                            <div className="flex items-center justify-between gap-2 font-semibold text-[#0C2624] dark:text-[#F5FAFA]">
                              <span>{t('shopRatingLabel')}</span>
                              {rev.shopRating != null && (
                                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-[#F59E0B] tabular-nums">
                                  <Star className="w-3 h-3 fill-[#F59E0B] text-[#F59E0B]" />
                                  {rev.shopRating}/5
                                </span>
                              )}
                            </div>
                            {rev.shopComment && (
                              <p className="text-[#4B6B67] dark:text-[#A9C0BD] leading-relaxed">
                                {rev.shopComment}
                              </p>
                            )}
                          </div>
                        )}
                        {isOwn && (
                          <div className="flex items-center gap-3 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                startEditing(
                                  rev.reviewId,
                                  rev.rating,
                                  rev.comment,
                                  rev.shopRating,
                                  rev.shopComment
                                )
                              }
                              className="text-[11px] font-semibold text-[#4B6B67] dark:text-[#A9C0BD] hover:text-[#047857] dark:hover:text-[#00D68F] flex items-center gap-1"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>{t('edit')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteReview(rev.reviewId)}
                              className="text-[11px] font-semibold text-[#4B6B67] dark:text-[#A9C0BD] hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>{t('delete')}</span>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Related Products ("You May Also Like") */}
        {relatedProducts.length > 0 && (
          <section className="space-y-3 pt-1">
            <h2 className="text-sm font-bold text-[#0F4C44] dark:text-[#F5FAFA] px-1 pb-1 border-b border-[#D2E0DC]/70 dark:border-transparent">
              {t('youMayAlsoLike')}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {relatedProducts.map((rel) => (
                <ProductCard key={rel.productId} product={rel} variant="emeraldDark" />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Sticky Bottom Purchase Bar (activates automatically once user scrolls past card controls) */}
      {showStickyPurchaseBar && (
        <div className="sticky bottom-0 z-20 mt-4 bg-[#FCFDFC]/95 dark:bg-[#041D1F]/95 backdrop-blur-md border-t border-[#D2E0DC] dark:border-[#14443F] px-3.5 py-2.5 shadow-[0_-4px_16px_-6px_rgba(15,76,68,0.14)] dark:shadow-2xl dark:shadow-black/50">
          {renderPurchaseRow(true)}
        </div>
      )}

      {/* Price Alert Modal */}
      {alertModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="price-alert-modal-title"
          className="fixed inset-0 z-50 bg-black/55 dark:bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full max-w-md bg-[#FCFDFC] dark:bg-[#092825] rounded-t-3xl sm:rounded-2xl border border-[#D2E0DC] dark:border-[#14443F] p-4 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto text-[#0E2421] dark:text-[#F5FAFA]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#E5F2EE] dark:bg-[#00D68F]/15 text-[#0F4C44] dark:text-[#00D68F] flex items-center justify-center shrink-0">
                  <BellRing className="w-4 h-4" />
                </div>
                <h2
                  id="price-alert-modal-title"
                  className="text-sm font-display font-bold text-[#0F4C44] dark:text-[#F5FAFA] truncate"
                >
                  {t('priceAlertTitle')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAlertModalOpen(false)}
                aria-label="Close"
                className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#4B6B67] dark:text-[#A9C0BD] hover:bg-[#EDF5F3] dark:hover:bg-[#031719]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#4B6B67] dark:text-[#A9C0BD] leading-relaxed">
              {t('priceAlertSubtitle')}
            </p>

            {/* Product Price Snapshot */}
            <div className="p-3 rounded-xl bg-[#F3F6F4] dark:bg-[#031719]/80 border border-[#D5E6E2] dark:border-[#123E39] flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#EDF5F3] dark:bg-[#061D1B] border border-[#D5E6E2] dark:border-[#14443F] shrink-0">
                <ResilientImage
                  src={product.imageUrl}
                  alt={product.name}
                  fallbackTitle={product.name}
                  darkSurface
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA] truncate">
                  {product.name}
                </div>
                <div className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] mt-0.5 flex items-center gap-1.5 tabular-nums">
                  <span>{t('priceAlertCurrentPrice')}:</span>
                  <span className="font-bold text-[#047857] dark:text-[#00D68F]">
                    {formatETB(product.price)}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSavePriceAlert} className="space-y-4">
              {/* Target Price Input + Slider */}
              <div className="space-y-2">
                <label
                  htmlFor="price-alert-threshold-input"
                  className="block text-xs font-semibold text-[#0C2624] dark:text-[#F5FAFA]"
                >
                  {t('priceAlertTargetLabel')}
                </label>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#4B6B67] dark:text-[#A9C0BD]">
                    ETB
                  </span>
                  <input
                    id="price-alert-threshold-input"
                    type="number"
                    min={1}
                    max={Math.max(1, product.price - 1)}
                    step={1}
                    value={alertTargetInput}
                    onChange={(e) => {
                      setAlertTargetInput(e.target.value);
                      setAlertError(null);
                    }}
                    className="w-full min-h-[44px] pl-12 pr-3.5 py-2.5 rounded-xl border border-[#D5E6E2] dark:border-[#14443F] bg-[#F3F6F4] dark:bg-[#031719] text-sm font-bold text-[#0C2624] dark:text-[#F5FAFA] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#047857]/25 dark:focus:ring-[#00D68F]/25 focus:border-[#047857] dark:focus:border-[#00D68F]"
                  />
                </div>

                {product.price > 5 && (
                  <input
                    type="range"
                    aria-label={t('priceAlertTargetLabel')}
                    min={Math.max(1, Math.round(product.price * 0.25))}
                    max={Math.max(1, product.price - 1)}
                    step={Math.max(1, Math.round(product.price / 100))}
                    value={Math.min(
                      Math.max(1, Number(alertTargetInput) || 1),
                      Math.max(1, product.price - 1)
                    )}
                    onChange={(e) => {
                      setAlertTargetInput(e.target.value);
                      setAlertError(null);
                    }}
                    className="w-full accent-[#047857] dark:accent-[#00D68F] cursor-pointer"
                  />
                )}

                {(() => {
                  const numVal = Number(alertTargetInput);
                  const valid = validatePriceAlertThreshold(numVal, product.price).valid;
                  if (!valid) return null;
                  const pct = calculateDiscountPercent(numVal, product.price);
                  const savings = Math.max(0, Math.round(product.price - numVal));
                  return (
                    <p className="text-[11px] font-semibold text-[#0F766E] dark:text-[#00C8D7] tabular-nums">
                      {t('priceAlertSavingsNote', {
                        percent: pct,
                        amount: formatETB(savings),
                      })}
                    </p>
                  );
                })()}
              </div>

              {/* Quick Drop Presets */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-[#4B6B67] dark:text-[#A9C0BD]">
                  {t('priceAlertQuickDrop')}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 15, 25].map((pct) => {
                    const presetVal = calculateThresholdFromPercent(product.price, pct);
                    const isSelected = Number(alertTargetInput) === presetVal;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setAlertTargetInput(String(presetVal));
                          setAlertError(null);
                        }}
                        className={`min-h-[44px] px-2 py-1.5 rounded-xl border text-center transition-colors ${
                          isSelected
                            ? 'border-[#047857] dark:border-[#00D68F] bg-[#ECFDF5] dark:bg-[#00D68F]/15 text-[#047857] dark:text-[#00D68F]'
                            : 'border-[#D5E6E2] dark:border-[#14443F] bg-[#F3F6F4] dark:bg-[#031719] text-[#4B6B67] dark:text-[#A9C0BD] hover:border-[#047857]/40 dark:hover:border-[#00D68F]/40'
                        }`}
                      >
                        <div className="text-xs font-bold tabular-nums">-{pct}%</div>
                        <div className="text-[10px] opacity-80 tabular-nums">
                          {formatETB(presetVal)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Browser Push Notification Opt-in */}
              <div className="p-3 rounded-xl border border-[#D5E6E2] dark:border-[#14443F] bg-[#F3F6F4] dark:bg-[#031719]/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="price-alert-push-toggle"
                    className="flex items-center gap-2 text-xs font-semibold text-[#0C2624] dark:text-[#F5FAFA] cursor-pointer"
                  >
                    {alertPushEnabled ? (
                      <BellRing className="w-4 h-4 text-[#047857] dark:text-[#00D68F] shrink-0" />
                    ) : (
                      <BellOff className="w-4 h-4 text-[#4B6B67] dark:text-[#A9C0BD] shrink-0" />
                    )}
                    <span>{t('priceAlertPushToggleLabel')}</span>
                  </label>
                  <input
                    id="price-alert-push-toggle"
                    type="checkbox"
                    checked={alertPushEnabled}
                    onChange={(e) => setAlertPushEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#047857] dark:accent-[#00D68F] rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] text-[#4B6B67] dark:text-[#A9C0BD]">
                  <span className="leading-snug">
                    {pushPermission === 'granted'
                      ? t('priceAlertPushGranted')
                      : pushPermission === 'denied'
                      ? t('priceAlertPushDenied')
                      : pushPermission === 'unsupported'
                      ? t('priceAlertPushUnsupported')
                      : t('priceAlertPushPrompt')}
                  </span>
                  {pushPermission === 'default' && alertPushEnabled && (
                    <button
                      type="button"
                      onClick={() => void requestPushPermission()}
                      className="min-h-[36px] px-2.5 rounded-lg bg-[#047857] dark:bg-[#00D68F] text-white dark:text-[#031719] text-[11px] font-bold whitespace-nowrap shrink-0 hover:brightness-105"
                    >
                      {t('priceAlertEnablePushBtn')}
                    </button>
                  )}
                </div>
              </div>

              {alertError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-xs text-rose-800 dark:text-rose-200">
                  {alertError}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={savingAlert}
                  className="w-full min-h-[48px] rounded-full bg-gradient-to-r from-[#047857] to-[#0D9488] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 disabled:opacity-50 text-white dark:text-[#031719] text-xs font-bold flex items-center justify-center gap-2 transition-all"
                >
                  {savingAlert ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('priceAlertSaving')}</span>
                    </>
                  ) : (
                    <>
                      <BellRing className="w-4 h-4" />
                      <span>
                        {existingPriceAlert
                          ? t('priceAlertUpdateBtn')
                          : t('priceAlertSubscribeBtn')}
                      </span>
                    </>
                  )}
                </button>

                {existingPriceAlert && (
                  <button
                    type="button"
                    disabled={savingAlert}
                    onClick={handleRemovePriceAlert}
                    className="w-full min-h-[44px] rounded-full border border-[#D5E6E2] dark:border-[#14443F] text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('priceAlertRemoveBtn')}</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
