import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  BellOff,
  BellRing,
  Check,
  ChevronRight,
  Heart,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  Minus,
  Pencil,
  Plus,
  Share2,
  ShoppingBag,
  Star,
  Store,
  Trash2,
  TrendingDown,
  Truck,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { EmptyState, ProductCard, ResilientImage } from '../components/SharedUI';
import { SEED_PRODUCTS, SEED_REVIEWS } from '../data/seedData';
import { getLocalizedNeighborhood } from '../constants/translations';
import {
  calculateDiscountPercent,
  calculateProductRatingSummary,
  calculateThresholdFromPercent,
  formatETB,
  getProductPriceAlert,
  getQualifyingPurchaseOrder,
  getRelatedProducts,
  getUserProductReview,
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
    categories,
    reviews,
    orders,
    firebaseUser,
    favorites,
    toggleFavorite,
    addToCart,
    submitReview,
    updateReview,
    deleteReview,
    recordProductView,
    priceAlerts,
    pushPermission,
    requestPushPermission,
    subscribePriceAlert,
    removePriceAlert,
    openShopChat,
    language,
    t,
  } = useMarketplace();

  const product = products.find((p) => p.productId === productId);
  const currentUid = firebaseUser?.uid ?? 'guest-local';

  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  // Price Alert Modal state
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertTargetInput, setAlertTargetInput] = useState('');
  const [alertPushEnabled, setAlertPushEnabled] = useState(true);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [savingAlert, setSavingAlert] = useState(false);

  useEffect(() => {
    setSelectedImageIdx(0);
    setQuantity(1);
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

  if (!product) {
    return (
      <EmptyState
        title="Product not found"
        description="This item may have been archived or removed by the seller."
        actionLabel="Back to Market"
        onAction={() => navigate({ name: 'home' })}
      />
    );
  }

  const shop = shopsById[product.shopId];
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
  const activeStock = activeVariant?.stock ?? product.stock;

  const galleryImages = Array.from(
    new Set([product.imageUrl, ...(product.additionalImages ?? [])].filter(Boolean))
  );
  const activeImageUrl = galleryImages[selectedImageIdx] ?? product.imageUrl;

  const relatedProducts = useMemo(
    () => getRelatedProducts(product, products, 4),
    [product, products]
  );

  const outOfStock = !product.isAvailable || activeStock <= 0;
  const hasDiscount = activePreviousPrice != null && activePreviousPrice > activePrice;
  const existingPriceAlert = getProductPriceAlert(priceAlerts, product.productId, currentUid);

  const openPriceAlertModal = () => {
    const defaultTarget =
      existingPriceAlert && existingPriceAlert.targetPrice < product.price
        ? existingPriceAlert.targetPrice
        : calculateThresholdFromPercent(product.price, 15);
    setAlertTargetInput(String(defaultTarget));
    setAlertPushEnabled(existingPriceAlert ? existingPriceAlert.pushEnabled : true);
    setAlertError(null);
    setAlertModalOpen(true);
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

  const handleAddToCart = () => {
    addToCart(product, quantity, activeVariant);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/?product=${encodeURIComponent(product.productId)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: `${product.name} — ${formatETB(activePrice)} on Hawasa Gebeya`,
          url: shareUrl,
        });
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
    setTimeout(() => setShareCopied(false), 2000);
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

  return (
    <div className="flex flex-col min-h-full pb-24">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#1C2420]/95 backdrop-blur-md border-b border-[#E7E5E4] dark:border-[#2A3630] px-3 py-2 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-semibold text-stone-700 dark:text-stone-200 truncate px-2">
          {t('productDetails')}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleShare}
            aria-label={t('shareProduct')}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17]"
          >
            {shareCopied ? (
              <Check className="w-4 h-4 text-[#047857] dark:text-[#10B981]" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => toggleFavorite(product.productId)}
            aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17]"
          >
            <Heart className={`w-5 h-5 ${isFav ? 'fill-rose-600 text-rose-600 dark:fill-rose-500 dark:text-rose-500' : ''}`} />
          </button>
        </div>
      </header>

      {/* Product Image + Gallery Thumbnails */}
      <div className="bg-[#FAF8F5] dark:bg-[#141A17] border-b border-[#E7E5E4] dark:border-[#2A3630]">
        <div className="aspect-[4/3] relative">
          <ResilientImage
            src={activeImageUrl}
            alt={product.name}
            fallbackTitle={product.name}
            className="w-full h-full object-cover"
          />
          {shareCopied && (
            <div className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-[#1C2420]/95 border border-[#2A3630] text-white text-[11px] font-semibold">
              {t('linkCopied')}
            </div>
          )}
        </div>
        {galleryImages.length > 1 && (
          <div className="px-4 py-2.5 bg-white dark:bg-[#1C2420] flex items-center gap-2 overflow-x-auto mobile-scroll border-t border-[#E7E5E4] dark:border-[#2A3630]">
            {galleryImages.map((imgUrl, idx) => (
              <button
                key={`${imgUrl}-${idx}`}
                type="button"
                onClick={() => setSelectedImageIdx(idx)}
                aria-label={`View photo ${idx + 1}`}
                className={`w-14 h-11 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${
                  selectedImageIdx === idx
                    ? 'border-[#047857] dark:border-[#10B981]'
                    : 'border-[#E7E5E4] dark:border-[#2A3630] opacity-70 hover:opacity-100'
                }`}
              >
                <ResilientImage src={imgUrl} alt={`${product.name} ${idx + 1}`} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Details */}
      <div className="p-4 space-y-5 bg-white dark:bg-[#1C2420] border-b border-[#E7E5E4] dark:border-[#2A3630]">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            <span className="capitalize">{categoryLabel}</span>
            <span aria-hidden="true">·</span>
            <span className={outOfStock ? 'text-rose-700 dark:text-rose-400 font-semibold' : activeStock <= 6 ? 'text-[#D97706] dark:text-[#F59E0B] font-semibold' : 'text-[#047857] dark:text-[#10B981] font-semibold'}>
              {outOfStock
                ? t('outOfStock')
                : activeStock <= 6
                ? t('onlyLeftInStock', { count: activeStock })
                : t('inStockCount', { count: activeStock })}
            </span>
          </div>

          <h1 className="text-xl font-display font-bold text-stone-900 dark:text-stone-100 mt-1 leading-snug">
            {product.name}
          </h1>

          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold text-[#047857] dark:text-[#10B981] tabular-nums">
                {formatETB(activePrice)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-sm text-stone-400 dark:text-stone-500 line-through tabular-nums">
                    {formatETB(activePreviousPrice!)}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-[#FFF7ED] dark:bg-[#C2410C]/20 text-[#C2410C] dark:text-[#FB923C] text-[11px] font-bold tabular-nums">
                    -{calculateDiscountPercent(activePrice, activePreviousPrice!)}% · {t('saveAmount', { amount: formatETB(activePreviousPrice! - activePrice) })}
                  </span>
                </>
              )}
            </div>

            {ratingSummary.reviewCount > 0 && (
              <div className="flex items-center gap-1 text-xs font-semibold text-stone-800 dark:text-stone-200 tabular-nums shrink-0">
                <Star className="w-4 h-4 fill-[#D97706] text-[#D97706] dark:fill-[#F59E0B] dark:text-[#F59E0B]" />
                <span>{ratingSummary.averageRating.toFixed(1)}</span>
                <span className="text-stone-400 dark:text-stone-500 font-normal">
                  ({ratingSummary.reviewCount})
                </span>
              </div>
            )}
          </div>

          {/* Price Alert Subscription Trigger */}
          {product.price > 1 && (
            <button
              type="button"
              onClick={openPriceAlertModal}
              className={`mt-3 w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2.5 text-left transition-colors ${
                existingPriceAlert?.status === 'triggered'
                  ? 'bg-[#FFF7ED] dark:bg-[#F59E0B]/15 border-[#D97706]/30 dark:border-[#F59E0B]/35 hover:bg-[#FFEDD5] dark:hover:bg-[#F59E0B]/20'
                  : existingPriceAlert?.status === 'active'
                  ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 border-[#047857]/25 dark:border-[#10B981]/30 hover:bg-[#D1FAE5]/70 dark:hover:bg-[#10B981]/20'
                  : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] hover:border-[#047857]/40 dark:hover:border-[#10B981]/40'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    existingPriceAlert?.status === 'triggered'
                      ? 'bg-[#D97706]/15 text-[#D97706] dark:text-[#F59E0B]'
                      : existingPriceAlert?.status === 'active'
                      ? 'bg-[#047857]/15 dark:bg-[#10B981]/20 text-[#047857] dark:text-[#10B981]'
                      : 'bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] text-stone-700 dark:text-stone-300'
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
                        ? 'text-[#C2410C] dark:text-[#F59E0B]'
                        : existingPriceAlert?.status === 'active'
                        ? 'text-[#047857] dark:text-[#10B981]'
                        : 'text-stone-900 dark:text-stone-100'
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
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
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
                    ? 'text-[#C2410C] dark:text-[#F59E0B]'
                    : 'text-[#047857] dark:text-[#10B981]'
                }`}
              >
                {existingPriceAlert && <span>{t('edit')}</span>}
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>
          )}
        </div>

        {/* Interactive Variant / Option Selector */}
        {product.variants && product.variants.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#E7E5E4] dark:border-[#2A3630]">
            <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">{t('selectOption')}</div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('selectOption')}>
              {product.variants.map((variant) => {
                const selected = variant.id === activeVariant?.id;
                const variantOut = (variant.stock ?? product.stock) <= 0;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={variantOut}
                    onClick={() => {
                      setSelectedVariantId(variant.id);
                      setQuantity((q) => Math.min(q, variant.stock ?? product.stock));
                    }}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                      selected
                        ? 'border-[#047857] dark:border-[#10B981] bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981]'
                        : 'border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-stone-700 dark:text-stone-200 hover:border-[#047857]/30 disabled:opacity-40'
                    }`}
                  >
                    {variant.label} · {formatETB(variant.price)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">{product.description}</p>

        {/* Fulfillment Capabilities */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#E7E5E4] dark:border-[#2A3630] text-xs">
          <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#047857] dark:text-[#10B981] shrink-0" />
            <span className="font-medium text-stone-800 dark:text-stone-200">
              {product.deliveryAvailable ? t('hawassaDelivery') : t('noDelivery')}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] flex items-center gap-2">
            <Store className="w-4 h-4 text-[#047857] dark:text-[#10B981] shrink-0" />
            <span className="font-medium text-stone-800 dark:text-stone-200">
              {product.pickupAvailable ? t('pickupReady') : t('deliveryOnly')}
            </span>
          </div>
        </div>

        {/* Shop Card */}
        {shop && (
          <div className="w-full p-3.5 rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate({ name: 'shop', shopId: shop.shopId })}
              className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-85 transition-opacity"
            >
              <div className="w-11 h-11 rounded-xl overflow-hidden bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] shrink-0">
                <ResilientImage src={shop.logoUrl} alt={shop.name} fallbackTitle={shop.name} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">{shop.name}</span>
                  {shop.status === 'approved' && (
                    <BadgeCheck className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981] shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                  <MapPin className="w-3 h-3 text-[#047857] dark:text-[#10B981] shrink-0" />
                  <span>{getLocalizedNeighborhood(shop.neighborhood, language)}, Hawassa</span>
                </div>
              </div>
            </button>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openShopChat(shop)}
                className="min-h-[38px] px-3 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/15 border border-[#047857]/25 dark:border-[#10B981]/30 text-[11px] font-bold text-[#047857] dark:text-[#10B981] hover:bg-[#D1FAE5] dark:hover:bg-[#10B981]/25 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{t('tradeChatMessageShopBtn')}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate({ name: 'shop', shopId: shop.shopId })}
                className="min-h-[38px] px-2.5 text-xs font-semibold text-[#047857] dark:text-[#10B981] whitespace-nowrap"
              >
                {t('visitShop')}
              </button>
            </div>
          </div>
        )}

        {/* Quantity Selector */}
        {!outOfStock && (
          <div className="flex items-center justify-between pt-2 border-t border-[#E7E5E4] dark:border-[#2A3630]">
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">{t('quantity')}</span>
            <div className="flex items-center gap-1 border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] rounded-xl p-1">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-white dark:hover:bg-[#1C2420]"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center text-sm font-bold text-stone-900 dark:text-stone-100 tabular-nums">{quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQuantity((q) => Math.min(activeStock, q + 1))}
                className="min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-white dark:hover:bg-[#1C2420]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Verified Ratings & Customer Reviews */}
        <section className="pt-4 border-t border-[#E7E5E4] dark:border-[#2A3630] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              {t('ratingsAndReviews')}
            </h2>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
              {ratingSummary.reviewCount === 1
                ? t('ratingSingle', { count: ratingSummary.reviewCount })
                : t('ratingPlural', { count: ratingSummary.reviewCount })}
            </span>
          </div>

          {/* Rating Breakdown Box */}
          <div className="p-3.5 rounded-2xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] grid grid-cols-12 gap-3 items-center">
            <div className="col-span-5 text-center border-r border-[#E7E5E4] dark:border-[#2A3630] pr-2">
              <div className="text-3xl font-display font-bold text-stone-950 dark:text-stone-50 tabular-nums">
                {ratingSummary.reviewCount > 0 ? ratingSummary.averageRating.toFixed(1) : '—'}
              </div>
              <div className="flex items-center justify-center gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3.5 h-3.5 ${
                      s <= Math.round(ratingSummary.averageRating)
                        ? 'fill-[#D97706] text-[#D97706] dark:fill-[#F59E0B] dark:text-[#F59E0B]'
                        : 'text-stone-300 dark:text-stone-600'
                    }`}
                  />
                ))}
              </div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-1">
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
                    className={`w-full flex items-center gap-2 text-[11px] rounded-md px-1 py-0.5 transition-colors ${
                      active ? 'bg-[#FFF7ED] dark:bg-[#F59E0B]/15' : 'hover:bg-white dark:hover:bg-[#1C2420]'
                    }`}
                  >
                    <span className="w-6 text-left font-semibold text-stone-700 dark:text-stone-300 tabular-nums">
                      {star} ★
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-stone-200 dark:bg-[#2A3630] overflow-hidden">
                      <div
                        className="h-full bg-[#D97706] dark:bg-[#F59E0B] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-5 text-right text-stone-500 dark:text-stone-400 tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {starFilter != null && (
            <div className="flex items-center justify-between text-xs bg-[#FFF7ED] dark:bg-[#F59E0B]/15 border border-[#D97706]/25 dark:border-[#F59E0B]/30 rounded-xl px-3 py-2">
              <span className="font-medium text-[#C2410C] dark:text-[#F59E0B]">
                {t('showingStarReviews', { star: starFilter, count: filteredReviews.length })}
              </span>
              <button
                type="button"
                onClick={() => setStarFilter(null)}
                className="font-semibold text-[#C2410C] dark:text-[#F59E0B] hover:underline"
              >
                {t('showAll')}
              </button>
            </div>
          )}

          {/* Review Eligibility / Composer */}
          {existingUserReview ? (
            <div className="p-3 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/15 border border-[#047857]/25 dark:border-[#10B981]/30 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-[#047857] dark:text-[#10B981] font-medium">
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
                  className="font-bold text-[#047857] dark:text-[#10B981] hover:underline shrink-0"
                >
                  {t('editReview')}
                </button>
              )}
            </div>
          ) : qualifyingOrder ? (
            <form
              onSubmit={handleReviewSubmit}
              className="p-3.5 rounded-2xl border border-[#047857]/25 dark:border-[#10B981]/30 bg-[#ECFDF5]/60 dark:bg-[#10B981]/10 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100">{t('rateAndReviewProduct')}</div>
                  <div className="text-[11px] text-[#047857] dark:text-[#10B981] flex items-center gap-1 mt-0.5">
                    <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {t('verifiedBuyerOrder', {
                        order: qualifyingOrder.orderId.slice(-6).toUpperCase(),
                      })}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#D97706] dark:text-[#F59E0B]">
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
                    className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#1C2420] transition-colors"
                  >
                    <Star
                      className={`w-6 h-6 transition-colors ${
                        star <= reviewRating
                          ? 'fill-[#D97706] text-[#D97706] dark:fill-[#F59E0B] dark:text-[#F59E0B]'
                          : 'text-stone-300 dark:text-stone-600'
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
                  className="w-full p-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981] resize-none"
                />
                <div className="flex items-center justify-between mt-1 text-[10px] text-stone-500 dark:text-stone-400">
                  <span>{t('minimumThreeChars')}</span>
                  <span className="tabular-nums">{reviewComment.trim().length}/500</span>
                </div>
              </div>

              {shop && (
                <div className="pt-2.5 border-t border-[#047857]/15 dark:border-[#10B981]/20 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-stone-900 dark:text-stone-100">
                      {t('rateAndReviewShop')} · {shop.name}
                    </span>
                    <span className="text-[11px] font-semibold text-[#D97706] dark:text-[#F59E0B]">
                      {shopRating}/5
                    </span>
                  </div>
                  <div className="flex items-center gap-1" role="group" aria-label={t('shopRatingLabel')}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setShopRating(star)}
                        aria-label={`Rate shop ${star} stars`}
                        className="p-1 rounded-lg hover:bg-white dark:hover:bg-[#1C2420] transition-colors"
                      >
                        <Star
                          className={`w-5 h-5 transition-colors ${
                            star <= shopRating
                              ? 'fill-[#D97706] text-[#D97706] dark:fill-[#F59E0B] dark:text-[#F59E0B]'
                              : 'text-stone-300 dark:text-stone-600'
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
                    className="w-full p-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981] resize-none"
                  />
                </div>
              )}

              {reviewError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300">
                  {reviewError}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingReview}
                className="w-full min-h-[42px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] disabled:opacity-50 text-white dark:text-[#0B1410] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
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
            <div className="p-3.5 rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] space-y-2">
              <div className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-stone-500 dark:text-stone-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    {t('verifiedBuyersOnly')}
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
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
                  className="text-[11px] font-bold text-[#047857] dark:text-[#10B981] hover:underline pl-6"
                >
                  {t('addToCartToPurchase')}
                </button>
              )}
            </div>
          )}

          {/* Customer Review List */}
          {filteredReviews.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-2">
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
                        ? 'bg-[#ECFDF5]/40 dark:bg-[#10B981]/10 border-[#047857]/25 dark:border-[#10B981]/30'
                        : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                            {rev.customerName}
                          </span>
                          {rev.verifiedPurchase !== false && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#047857] dark:text-[#10B981]">
                              <BadgeCheck className="w-3 h-3" />
                              <span>{t('verifiedPurchase')}</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
                          {formatReviewDate(rev.updatedAt || rev.createdAt)}
                          {rev.updatedAt ? ` (${t('editedTag')})` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= rev.rating
                                ? 'fill-[#D97706] text-[#D97706] dark:fill-[#F59E0B] dark:text-[#F59E0B]'
                                : 'text-stone-300 dark:text-stone-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {isEditing ? (
                      <form onSubmit={(e) => handleEditSave(e, rev.reviewId)} className="space-y-2.5 pt-1">
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
                                    ? 'fill-[#D97706] text-[#D97706] dark:fill-[#F59E0B] dark:text-[#F59E0B]'
                                    : 'text-stone-300 dark:text-stone-600'
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
                          className="w-full p-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981] resize-none"
                        />
                        {shop && (
                          <div className="space-y-1.5 pt-1 border-t border-[#E7E5E4] dark:border-[#2A3630]">
                            <div className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">
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
                                        ? 'fill-[#D97706] text-[#D97706] dark:fill-[#F59E0B] dark:text-[#F59E0B]'
                                        : 'text-stone-300 dark:text-stone-600'
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
                              className="w-full p-2 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981] resize-none"
                            />
                          </div>
                        )}
                        {editError && (
                          <div className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">{editError}</div>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            disabled={savingEdit}
                            className="px-3 py-1.5 rounded-lg bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-[11px] font-semibold disabled:opacity-50"
                          >
                            {savingEdit ? t('saving') : t('saveChanges')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingReviewId(null)}
                            className="px-3 py-1.5 rounded-lg border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#1C2420] text-[11px] font-semibold text-stone-600 dark:text-stone-300"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">{rev.comment}</p>
                        {(rev.shopRating != null || rev.shopComment) && (
                          <div className="p-2.5 rounded-xl bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] text-[11px] space-y-1">
                            <div className="flex items-center justify-between gap-2 font-semibold text-stone-800 dark:text-stone-200">
                              <span>{t('shopRatingLabel')}</span>
                              {rev.shopRating != null && (
                                <span className="inline-flex items-center gap-1 text-[#D97706] dark:text-[#F59E0B] tabular-nums">
                                  <Star className="w-3 h-3 fill-[#D97706] text-[#D97706] dark:fill-[#F59E0B] dark:text-[#F59E0B]" />
                                  {rev.shopRating}/5
                                </span>
                              )}
                            </div>
                            {rev.shopComment && (
                              <p className="text-stone-600 dark:text-stone-300 leading-relaxed">{rev.shopComment}</p>
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
                              className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 hover:text-[#047857] dark:hover:text-[#10B981] flex items-center gap-1"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>{t('edit')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteReview(rev.reviewId)}
                              className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1"
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
          <section className="pt-4 border-t border-[#E7E5E4] dark:border-[#2A3630] space-y-3">
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">{t('youMayAlsoLike')}</h2>
            <div className="grid grid-cols-2 gap-3">
              {relatedProducts.map((rel) => (
                <ProductCard key={rel.productId} product={rel} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Sticky Bottom Purchase Bar */}
      <div className="sticky bottom-0 z-20 bg-white dark:bg-[#1C2420] border-t border-[#E7E5E4] dark:border-[#2A3630] p-3 flex items-center gap-2.5 mt-auto">
        <button
          type="button"
          disabled={outOfStock}
          onClick={handleAddToCart}
          className="flex-1 min-h-[48px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] disabled:bg-stone-200 dark:disabled:bg-[#232D28] disabled:text-stone-400 dark:disabled:text-stone-600 text-white dark:text-[#0B1410] text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {addedFeedback ? (
            <>
              <Check className="w-4 h-4" />
              <span>{t('addedToCart')}</span>
            </>
          ) : (
            <>
              <ShoppingBag className="w-4 h-4" />
              <span>{t('addToCart')} · {formatETB(activePrice * quantity)}</span>
            </>
          )}
        </button>

        <button
          type="button"
          disabled={outOfStock}
          onClick={() => {
            addToCart(product, quantity, activeVariant);
            navigate({ name: 'cart' });
          }}
          className="min-h-[48px] px-4 rounded-xl bg-[#D97706] hover:bg-[#B45309] dark:bg-[#F59E0B] dark:hover:bg-[#D97706] disabled:bg-stone-200 dark:disabled:bg-[#232D28] disabled:text-stone-400 dark:disabled:text-stone-600 text-white dark:text-[#141A17] text-xs font-bold whitespace-nowrap transition-colors"
        >
          {t('buyNow')}
        </button>
      </div>

      {/* Price Alert Modal */}
      {alertModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="price-alert-modal-title"
          className="fixed inset-0 z-50 bg-stone-950/50 dark:bg-black/75 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full max-w-md bg-white dark:bg-[#1C2420] rounded-t-3xl sm:rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] p-4 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] flex items-center justify-center shrink-0">
                  <BellRing className="w-4 h-4" />
                </div>
                <h2
                  id="price-alert-modal-title"
                  className="text-sm font-display font-bold text-stone-900 dark:text-stone-100 truncate"
                >
                  {t('priceAlertTitle')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAlertModalOpen(false)}
                aria-label="Close"
                className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-stone-500 dark:text-stone-400 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              {t('priceAlertSubtitle')}
            </p>

            {/* Product Price Snapshot */}
            <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] shrink-0">
                <ResilientImage
                  src={product.imageUrl}
                  alt={product.name}
                  fallbackTitle={product.name}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                  {product.name}
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 flex items-center gap-1.5 tabular-nums">
                  <span>{t('priceAlertCurrentPrice')}:</span>
                  <span className="font-bold text-[#047857] dark:text-[#10B981]">
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
                  className="block text-xs font-semibold text-stone-800 dark:text-stone-200"
                >
                  {t('priceAlertTargetLabel')}
                </label>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500 dark:text-stone-400">
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
                    className="w-full min-h-[44px] pl-12 pr-3.5 py-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-sm font-bold text-stone-900 dark:text-stone-100 tabular-nums focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
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
                    className="w-full accent-[#047857] dark:accent-[#10B981] cursor-pointer"
                  />
                )}

                {(() => {
                  const numVal = Number(alertTargetInput);
                  const valid = validatePriceAlertThreshold(numVal, product.price).valid;
                  if (!valid) return null;
                  const pct = calculateDiscountPercent(numVal, product.price);
                  const savings = Math.max(0, Math.round(product.price - numVal));
                  return (
                    <p className="text-[11px] font-semibold text-[#C2410C] dark:text-[#FB923C] tabular-nums">
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
                <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
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
                            ? 'border-[#047857] dark:border-[#10B981] bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981]'
                            : 'border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-stone-700 dark:text-stone-300 hover:border-[#047857]/30'
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
              <div className="p-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="price-alert-push-toggle"
                    className="flex items-center gap-2 text-xs font-semibold text-stone-900 dark:text-stone-100 cursor-pointer"
                  >
                    {alertPushEnabled ? (
                      <BellRing className="w-4 h-4 text-[#047857] dark:text-[#10B981] shrink-0" />
                    ) : (
                      <BellOff className="w-4 h-4 text-stone-400 dark:text-stone-500 shrink-0" />
                    )}
                    <span>{t('priceAlertPushToggleLabel')}</span>
                  </label>
                  <input
                    id="price-alert-push-toggle"
                    type="checkbox"
                    checked={alertPushEnabled}
                    onChange={(e) => setAlertPushEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#047857] dark:accent-[#10B981] rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] text-stone-600 dark:text-stone-300">
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
                      className="min-h-[36px] px-2.5 rounded-lg bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] text-[11px] font-semibold whitespace-nowrap shrink-0 hover:bg-[#065F46] dark:hover:bg-[#059669]"
                    >
                      {t('priceAlertEnablePushBtn')}
                    </button>
                  )}
                </div>
              </div>

              {alertError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300">
                  {alertError}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={savingAlert}
                  className="w-full min-h-[48px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] disabled:opacity-50 text-white dark:text-[#0B1410] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
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
                    className="w-full min-h-[44px] rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
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
