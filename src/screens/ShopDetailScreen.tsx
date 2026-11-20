import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  Share2,
  Star,
  Store,
  Tag,
  Truck,
  UserPlus,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import {
  EmptyState,
  ProductCard,
  ResilientImage,
  SHOP_DIR_CATEGORY_TRANSLATION_KEYS,
} from '../components/SharedUI';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { isVerifiedMerchantShop } from '../utils/marketplaceLogic';
import {
  buildShopShareUrl,
  getShopAvailabilityStatus,
  inferShopMainCategory,
  resolveShopCallablePhone,
} from '../utils/shopDirectory';
import { getLocalizedNeighborhood } from '../constants/translations';

export const ShopDetailScreen: React.FC<{ shopId: string }> = ({ shopId }) => {
  const {
    goBack,
    navigate,
    shopsById,
    proximityByShopId,
    products,
    categories,
    reviews,
    followedShops,
    toggleFollowShop,
    openShopChat,
    firebaseUser,
    language,
    t,
  } = useMarketplace();
  const shop = shopsById[shopId];
  const proximity = shop ? proximityByShopId[shop.shopId] : undefined;

  const [inShopQuery, setInShopQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const shopProducts = useMemo(
    () => (shop ? products.filter((p) => p.shopId === shop.shopId && p.status === 'active') : []),
    [products, shop]
  );

  const shopCategories = useMemo(() => {
    const slugs = new Set(shopProducts.map((p) => p.category));
    return categories.filter((c) => c.isActive && slugs.has(c.slug));
  }, [categories, shopProducts]);

  const filteredProducts = useMemo(() => {
    const q = inShopQuery.trim().toLowerCase();
    return shopProducts.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (q && !`${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [shopProducts, selectedCategory, inShopQuery]);

  const shopReviews = useMemo(
    () =>
      shop
        ? reviews.filter((r) => r.shopId === shop.shopId && (r.shopComment || r.shopRating || r.comment))
        : [],
    [reviews, shop]
  );

  if (!shop) {
    return (
      <EmptyState
        title="Shop not found"
        description="This Hawassa shop is unavailable or still under review."
        actionLabel={t('discoverShopsTitle')}
        onAction={() => navigate({ name: 'shops' })}
      />
    );
  }

  const isFollowing = followedShops.includes(shop.shopId);
  const isVerified = isVerifiedMerchantShop(shop);
  const availability = getShopAvailabilityStatus(shop);
  const isTempClosed = availability === 'temporarily_closed';
  const mainCategory = inferShopMainCategory(shop);
  const categoryLabel = t(SHOP_DIR_CATEGORY_TRANSLATION_KEYS[mainCategory]);
  const productTypes = (shop.productTypes ?? []).filter((item) => item.trim().length > 0);
  const callablePhone = resolveShopCallablePhone(shop);
  const isOwnShop = Boolean(firebaseUser?.uid && shop.ownerUid === firebaseUser.uid);

  const fullLocationParts = [
    shop.address,
    shop.neighborhood ? getLocalizedNeighborhood(shop.neighborhood, language) : '',
    shop.subCity,
    shop.city,
    shop.region,
  ].filter((part): part is string => Boolean(part && part.trim().length > 0));

  const preferredContactLabel =
    shop.preferredContactMethod === 'phone'
      ? t('shopPreferredContactPhone')
      : shop.preferredContactMethod === 'chat'
      ? t('shopPreferredContactChat')
      : t('shopPreferredContactBoth');

  const handleShareShop = async () => {
    const shareUrl = buildShopShareUrl(
      typeof window !== 'undefined' ? window.location.origin : 'https://affinconnect.app',
      shop.shopId
    );
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: `${shop.name} — Affin Connect`,
          text: shop.description || `Explore ${shop.name} on Affin Connect`,
          url: shareUrl,
        });
        return;
      }
    } catch {
      // Fall back to clipboard copy if share sheet is cancelled/unavailable
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareFeedback(t('shopLinkCopiedToast'));
        setTimeout(() => setShareFeedback(null), 2600);
      }
    } catch {
      setShareFeedback(shareUrl);
      setTimeout(() => setShareFeedback(null), 3500);
    }
  };

  const getCategoryLabel = (cat: (typeof categories)[number]) => {
    if (language === 'am') return cat.nameAm;
    if (language === 'om') return cat.nameOm;
    if (language === 'sid') return cat.nameSid || cat.name;
    return cat.name;
  };

  return (
    <div className="min-h-full bg-[#F3F6F4] dark:bg-transparent pb-8">
      <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 dark:bg-[#1C2420]/95 backdrop-blur-md border-b border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none px-3 py-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#0F4C44] dark:text-stone-200 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-semibold text-[#0F4C44] dark:text-stone-100 truncate">
          {shop.name}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleShareShop}
            aria-label={t('shareShopBtn')}
            title={t('shareShopBtn')}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] hover:border-[#0F4C44]/50 dark:hover:border-[#10B981]/50 flex items-center justify-center text-[#0F4C44] dark:text-[#10B981] transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <ThemeToggleButton />
        </div>
      </header>

      {shareFeedback && (
        <div
          role="status"
          aria-live="polite"
          className="mx-4 mt-3 px-3.5 py-2.5 rounded-xl bg-[#E5F2EE] dark:bg-[#10B981]/15 border border-[#0F4C44]/30 dark:border-[#10B981]/35 text-xs font-semibold text-[#0F4C44] dark:text-[#10B981] flex items-center justify-between gap-2"
        >
          <span className="truncate">{shareFeedback}</span>
          <button
            type="button"
            onClick={() => setShareFeedback(null)}
            aria-label="Dismiss"
            className="p-0.5 text-[#0F4C44] dark:text-[#10B981]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Cover Image */}
      <div className="h-36 bg-[#EBF1EE] dark:bg-[#141A17] relative">
        <ResilientImage
          src={shop.coverImageUrl || shop.logoUrl}
          alt={shop.name}
          fallbackTitle={shop.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#031719]/60 via-transparent to-transparent" />
        <div className="absolute top-3 right-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border backdrop-blur-xs shadow-sm ${
              isTempClosed
                ? 'bg-amber-50/95 dark:bg-[#2E2009]/90 border-amber-300 dark:border-amber-400/50 text-amber-800 dark:text-amber-300'
                : 'bg-[#FCFDFC]/95 dark:bg-[#031719]/85 border-[#0F4C44]/30 dark:border-[#00D68F]/45 text-[#0F4C44] dark:text-[#00D68F]'
            }`}
          >
            <span
              aria-hidden="true"
              className={`w-2 h-2 rounded-full ${
                isTempClosed ? 'bg-amber-500 dark:bg-amber-400' : 'bg-[#047857] dark:bg-[#00D68F]'
              }`}
            />
            <span>{isTempClosed ? t('shopStatusTempClosed') : t('shopStatusActive')}</span>
          </span>
        </div>
      </div>

      {/* Shop Header Info */}
      <div className="px-4 pb-4 bg-[#FCFDFC] dark:bg-[#1C2420] border-b border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.08)] dark:shadow-none">
        <div className="flex items-end justify-between gap-3 -mt-7 relative z-10">
          <div className="flex items-end gap-3 min-w-0">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#FCFDFC] dark:bg-[#1C2420] border-2 border-[#FCFDFC] dark:border-[#1C2420] shadow-md shrink-0">
              <ResilientImage src={shop.logoUrl} alt={shop.name} fallbackTitle={shop.name} />
            </div>
            <div className="pb-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg font-display font-bold text-[#0E2421] dark:text-stone-100 truncate">
                  {shop.name}
                </h1>
                {isVerified && (
                  <CheckCircle2
                    className="w-4 h-4 text-[#047857] dark:text-[#10B981] shrink-0"
                    aria-label={t('verifiedMerchantLabel')}
                  />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-[#46635E] dark:text-stone-300 tabular-nums flex-wrap">
                <span className="font-semibold text-[#0F4C44] dark:text-[#00C8D7]">
                  {categoryLabel}
                </span>
                <span aria-hidden="true">·</span>
                {(shop.reviewCount ?? 0) > 0 || (shop.rating ?? 0) > 0 ? (
                  <span className="flex items-center gap-1 font-medium">
                    <Star className="w-3.5 h-3.5 fill-[#D97706] text-[#D97706] dark:fill-[#F59E0B] dark:text-[#F59E0B]" />
                    {shop.rating.toFixed(1)} ({shop.reviewCount})
                  </span>
                ) : (
                  <span className="font-semibold text-[#047857] dark:text-[#10B981]">
                    {t('newShopBadge')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => toggleFollowShop(shop.shopId)}
            aria-pressed={isFollowing}
            className={`px-3 py-2 min-h-[38px] rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 border transition-colors ${
              isFollowing
                ? 'bg-[#0F4C44] hover:bg-[#047857] dark:bg-[#10B981] dark:hover:bg-[#059669] text-[#FCFDFC] dark:text-[#0B1410] border-[#0F4C44] dark:border-[#10B981]'
                : 'bg-[#E5F2EE] dark:bg-[#10B981]/15 text-[#0F4C44] dark:text-[#10B981] border-[#0F4C44]/25 dark:border-[#10B981]/30 hover:bg-[#D5EBE4] dark:hover:bg-[#10B981]/25'
            }`}
          >
            {isFollowing ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{t('followingShop')}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>{t('followShop')}</span>
              </>
            )}
          </button>
        </div>

        {/* Shop Description */}
        <p className="text-xs text-[#46635E] dark:text-stone-300 mt-3 leading-relaxed">
          {shop.description}
        </p>

        {/* Product Types Sold */}
        {productTypes.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0F4C44] dark:text-[#10B981]">
              <Tag className="w-3.5 h-3.5 shrink-0" />
              <span>{t('shopProductsOfferedLabel')}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {productTypes.map((typeTag) => (
                <span
                  key={typeTag}
                  className="px-2.5 py-1 rounded-lg bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] text-[11px] font-medium text-[#0E2421] dark:text-stone-200"
                >
                  {typeTag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Prominent Direct Contact Bar: Call Shop + Chat with Owner */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {callablePhone.callable && callablePhone.telHref ? (
            <a
              href={callablePhone.telHref}
              aria-label={`${t('callShopBtn')} ${shop.name}`}
              className="min-h-[44px] px-3.5 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 text-[#FCFDFC] dark:text-[#031719] text-xs font-bold flex items-center justify-center gap-2 shadow-[0_6px_16px_-6px_rgba(15,76,68,0.35)] dark:shadow-md dark:shadow-[#00D68F]/20 active:scale-[0.98] transition-all"
            >
              <Phone className="w-4 h-4 shrink-0" />
              <span>{t('callShopBtn')}</span>
            </a>
          ) : (
            <button
              type="button"
              disabled
              title={t('shopPhoneUnavailableHint')}
              className="min-h-[44px] px-3.5 rounded-xl bg-[#E8EFEA] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] text-[#5E7B76] dark:text-stone-500 text-xs font-semibold flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <Phone className="w-4 h-4 shrink-0" />
              <span className="truncate">{t('shopPhoneUnavailable')}</span>
            </button>
          )}

          <button
            type="button"
            disabled={isOwnShop}
            onClick={() => openShopChat(shop)}
            title={isOwnShop ? t('shopOwnProfileChatBlocked') : undefined}
            className="min-h-[44px] px-3.5 rounded-xl bg-[#E5F2EE] dark:bg-[#10B981]/15 hover:bg-[#D5EBE4] dark:hover:bg-[#10B981]/25 border border-[#0F4C44]/30 dark:border-[#10B981]/40 text-[#0F4C44] dark:text-[#10B981] text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-55 disabled:cursor-not-allowed"
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span>{t('chatWithOwnerBtn')}</span>
          </button>
        </div>

        {!callablePhone.callable && (
          <p className="mt-2 text-[11px] text-[#5E7B76] dark:text-stone-400">
            {t('shopPhoneUnavailableHint')}
          </p>
        )}
        {isOwnShop && (
          <p className="mt-2 text-[11px] text-[#5E7B76] dark:text-stone-400">
            {t('shopOwnProfileChatBlocked')}
          </p>
        )}

        {proximity && (
          <div
            className={`mt-3 px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 tabular-nums ${
              proximity.isNearestForUser
                ? 'bg-[#E5F2EE] dark:bg-[#10B981]/15 border-[#0F4C44]/30 dark:border-[#10B981]/40 text-[#0F4C44] dark:text-[#10B981] font-semibold'
                : 'bg-[#F3F6F4] dark:bg-[#141A17] border-[#D2E0DC] dark:border-[#2A3630] text-[#0E2421] dark:text-stone-200 font-medium'
            }`}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-[#0F4C44] dark:text-[#10B981]" />
              <span className="truncate">
                {proximity.isNearestForUser
                  ? t('shopNearestCallout')
                  : t('nearestShopDistanceAway', { distance: proximity.distanceLabel })}
              </span>
            </span>
            <span className="text-[11px] shrink-0">
              {proximity.distanceLabel} · {t('bajajEtaShort', { min: proximity.estimatedBajajMinutes })}
            </span>
          </div>
        )}

        {/* Location, Contact, Opening Hours & Directions */}
        <div className="mt-3 pt-3 border-t border-[#D2E0DC] dark:border-[#2A3630] space-y-2 text-xs text-[#2B4945] dark:text-stone-300">
          {fullLocationParts.length > 0 && (
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#10B981] shrink-0 mt-0.5" />
              <span>{fullLocationParts.join(', ')}</span>
            </div>
          )}

          {callablePhone.callable && callablePhone.displayPhone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#10B981] shrink-0" />
              <span className="tabular-nums font-medium">{callablePhone.displayPhone}</span>
              <span className="text-[10px] text-[#5E7B76] dark:text-stone-400">
                · {preferredContactLabel}
              </span>
            </div>
          )}

          {shop.operatingHours && (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#10B981] shrink-0" />
              <span>
                <strong className="font-semibold">{t('shopOpeningHoursLabel')}:</strong>{' '}
                {shop.operatingHours}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
            <div className="flex items-center gap-3.5 text-[11px] font-medium text-[#0F4C44] dark:text-[#10B981]">
              {shop.deliveryAvailable && (
                <span className="flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5" /> {t('localDelivery')}
                </span>
              )}
              {shop.pickupAvailable && (
                <span className="flex items-center gap-1">
                  <Store className="w-3.5 h-3.5" /> {t('inShopPickup')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleShareShop}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#F3F6F4] dark:bg-[#141A17] text-[#0F4C44] dark:text-stone-200 border border-[#D2E0DC] dark:border-[#2A3630] text-[11px] font-semibold hover:border-[#0F4C44]/45 flex items-center gap-1 shrink-0"
              >
                <Share2 className="w-3 h-3" />
                <span>{t('shareShopBtn')}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate({ name: 'map', shopId: shop.shopId })}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#E5F2EE] dark:bg-[#10B981]/15 text-[#0F4C44] dark:text-[#10B981] border border-[#0F4C44]/25 dark:border-[#10B981]/30 text-[11px] font-semibold hover:bg-[#D5EBE4] dark:hover:bg-[#10B981]/25 flex items-center gap-1 shrink-0"
              >
                <MapPin className="w-3 h-3" />
                <span>{t('viewOnMap')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Shop Catalog OR Direct Inquiry Experience (no empty product grid!) */}
      <div className="p-4 space-y-4">
        {shopProducts.length === 0 ? (
          <section className="rounded-2xl bg-[#FCFDFC] dark:bg-[#1C2420] border border-[#D2E0DC] dark:border-[#2A3630] p-5 text-center shadow-[0_4px_16px_-6px_rgba(15,76,68,0.10)] dark:shadow-none space-y-3">
            <div className="w-12 h-12 rounded-2xl mx-auto bg-[#E5F2EE] dark:bg-[#10B981]/15 border border-[#0F4C44]/20 dark:border-[#10B981]/30 text-[#0F4C44] dark:text-[#10B981] flex items-center justify-center">
              <Store className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-[#0E2421] dark:text-stone-100">
                {t('shopNoProductsHeadline')}
              </h2>
              <p className="text-xs text-[#46635E] dark:text-stone-300 leading-relaxed max-w-[300px] mx-auto">
                {t('shopNoProductsMessage')}
              </p>
            </div>
            <div className="pt-1 flex items-center justify-center gap-2.5 flex-wrap">
              {callablePhone.callable && callablePhone.telHref ? (
                <a
                  href={callablePhone.telHref}
                  className="min-h-[42px] px-4 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] text-[#FCFDFC] dark:text-[#031719] text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{t('callShopBtn')}</span>
                </a>
              ) : null}
              <button
                type="button"
                disabled={isOwnShop}
                onClick={() => openShopChat(shop)}
                className="min-h-[42px] px-4 rounded-xl bg-[#E5F2EE] dark:bg-[#10B981]/15 border border-[#0F4C44]/25 dark:border-[#10B981]/35 text-[#0F4C44] dark:text-[#10B981] text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-55 disabled:cursor-not-allowed"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{t('chatWithOwnerBtn')}</span>
              </button>
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#0F4C44] dark:text-stone-100">
                {t('productsFromShop', { shop: shop.name, count: filteredProducts.length })}
              </h2>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#10B981] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={inShopQuery}
                  onChange={(e) => setInShopQuery(e.target.value)}
                  placeholder={t('searchInShop')}
                  aria-label={t('searchInShop')}
                  className="w-full min-h-[40px] pl-8 pr-8 rounded-xl bg-[#FCFDFC] dark:bg-[#1C2420] border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_8px_-4px_rgba(15,76,68,0.08)] dark:shadow-none text-xs text-[#0E2421] dark:text-stone-100 placeholder:text-[#5E7B76] dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981] transition-all"
                />
                {inShopQuery && (
                  <button
                    type="button"
                    onClick={() => setInShopQuery('')}
                    aria-label="Clear in-shop search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#5E7B76] dark:text-stone-500 hover:text-[#0E2421] dark:hover:text-stone-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {shopCategories.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 mobile-scroll">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-[#0F4C44] text-[#FCFDFC] border-[#0F4C44] dark:bg-[#10B981]/15 dark:text-[#10B981] dark:border-[#10B981]/30'
                        : 'bg-[#FCFDFC] dark:bg-[#1C2420] border-[#D2E0DC] dark:border-[#2A3630] text-[#2B4945] dark:text-stone-300 hover:border-[#0F4C44]/40'
                    }`}
                  >
                    {t('all')}
                  </button>
                  {shopCategories.map((cat) => (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => setSelectedCategory(cat.slug)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                        selectedCategory === cat.slug
                          ? 'bg-[#0F4C44] text-[#FCFDFC] border-[#0F4C44] dark:bg-[#10B981]/15 dark:text-[#10B981] dark:border-[#10B981]/30'
                          : 'bg-[#FCFDFC] dark:bg-[#1C2420] border-[#D2E0DC] dark:border-[#2A3630] text-[#2B4945] dark:text-stone-300 hover:border-[#0F4C44]/40'
                      }`}
                    >
                      {getCategoryLabel(cat)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {filteredProducts.length === 0 ? (
              <EmptyState
                title={t('noMatchingProducts')}
                description={t('noMatchingDesc')}
                actionLabel={t('resetFilters')}
                onAction={() => {
                  setInShopQuery('');
                  setSelectedCategory('all');
                }}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.productId} product={product} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Verified Shop Reviews */}
        <section className="pt-4 border-t border-[#D2E0DC] dark:border-[#2A3630] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F4C44] dark:text-stone-100">
              {t('shopReviewsTitle')}
            </h2>
            {(shop.reviewCount ?? 0) > 0 || (shop.rating ?? 0) > 0 ? (
              <span className="text-xs font-semibold text-[#46635E] dark:text-stone-300 tabular-nums flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-[#D97706] text-[#D97706] dark:fill-[#F59E0B] dark:text-[#F59E0B]" />
                {shop.rating.toFixed(1)} ({shop.reviewCount})
              </span>
            ) : (
              <span className="text-xs font-semibold text-[#047857] dark:text-[#10B981]">
                {t('newShopBadge')}
              </span>
            )}
          </div>

          {shopReviews.length === 0 ? (
            <p className="text-xs text-[#46635E] dark:text-stone-400">{t('noShopReviewsYet')}</p>
          ) : (
            <div className="space-y-2.5">
              {shopReviews.map((rev) => {
                const ratingVal = rev.shopRating ?? rev.rating;
                return (
                  <div
                    key={rev.reviewId}
                    className="p-3.5 rounded-2xl bg-[#FCFDFC] dark:bg-[#1C2420] border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#0E2421] dark:text-stone-100">
                        {rev.customerName}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3 h-3 ${
                              star <= ratingVal
                                ? 'fill-[#D97706] text-[#D97706] dark:fill-[#F59E0B] dark:text-[#F59E0B]'
                                : 'text-[#C5D6D1] dark:text-stone-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-[#46635E] dark:text-stone-300 leading-relaxed">
                      {rev.shopComment || rev.comment}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
