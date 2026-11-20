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
  Star,
  Store,
  Truck,
  UserPlus,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { EmptyState, ProductCard, ResilientImage } from '../components/SharedUI';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { isVerifiedMerchantShop } from '../utils/marketplaceLogic';
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
    language,
    t,
  } = useMarketplace();
  const shop = shopsById[shopId];
  const proximity = shop ? proximityByShopId[shop.shopId] : undefined;

  const [inShopQuery, setInShopQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

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
        actionLabel="Back to Market"
        onAction={() => navigate({ name: 'home' })}
      />
    );
  }

  const isFollowing = followedShops.includes(shop.shopId);

  const getCategoryLabel = (cat: (typeof categories)[number]) => {
    if (language === 'am') return cat.nameAm;
    if (language === 'om') return cat.nameOm;
    if (language === 'sid') return cat.nameSid || cat.name;
    return cat.name;
  };

  return (
    <div className="min-h-full bg-[#F3F6F4] dark:bg-transparent pb-8">
      <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 dark:bg-[#1C2420]/95 backdrop-blur-md border-b border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none px-3 py-2 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#0F4C44] dark:text-stone-200 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-semibold text-[#0F4C44] dark:text-stone-100 truncate">{shop.name}</span>
        <ThemeToggleButton />
      </header>

      {/* Cover Image */}
      <div className="h-36 bg-[#EBF1EE] dark:bg-[#141A17] relative">
        <ResilientImage
          src={shop.coverImageUrl}
          alt={shop.name}
          fallbackTitle={shop.name}
          className="w-full h-full object-cover"
        />
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
                <h1 className="text-lg font-display font-bold text-[#0E2421] dark:text-stone-100 truncate">{shop.name}</h1>
                {isVerifiedMerchantShop(shop) && (
                  <CheckCircle2 className="w-4 h-4 text-[#047857] dark:text-[#10B981] shrink-0" aria-label={t('verifiedMerchantLabel')} />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-[#46635E] dark:text-stone-300 tabular-nums">
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
                <span aria-hidden="true">·</span>
                <span>{getLocalizedNeighborhood(shop.neighborhood, language)}</span>
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

        <p className="text-xs text-[#46635E] dark:text-stone-300 mt-3 leading-relaxed">{shop.description}</p>

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

        <div className="mt-3 pt-3 border-t border-[#D2E0DC] dark:border-[#2A3630] space-y-1.5 text-xs text-[#2B4945] dark:text-stone-300">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#10B981] shrink-0" />
            <span>{shop.address}, {shop.city}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#10B981] shrink-0" />
            <span className="tabular-nums">{shop.phoneNumber}</span>
          </div>
          {shop.operatingHours && (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#10B981] shrink-0" />
              <span>{shop.operatingHours}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
            <div className="flex items-center gap-4 text-[11px] font-medium text-[#0F4C44] dark:text-[#10B981]">
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
                onClick={() => openShopChat(shop)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] hover:brightness-105 dark:bg-none dark:bg-[#10B981] dark:hover:bg-[#059669] text-[#FCFDFC] dark:text-[#0B1410] text-[11px] font-bold flex items-center gap-1.5 transition-all shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{t('tradeChatMessageShopBtn')}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate({ name: 'map', shopId: shop.shopId })}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#E5F2EE] dark:bg-[#10B981]/15 text-[#0F4C44] dark:text-[#10B981] border border-[#0F4C44]/25 dark:border-[#10B981]/30 text-[11px] font-semibold hover:bg-[#D5EBE4] dark:hover:bg-[#10B981]/25 flex items-center gap-1 shrink-0"
              >
                <MapPin className="w-3 h-3" />
                <span>{t('viewOnMap')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Shop Catalog + In-Shop Search & Filter */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#0F4C44] dark:text-stone-100">
            {t('productsFromShop', { shop: shop.name, count: filteredProducts.length })}
          </h2>
        </div>

        {shopProducts.length > 0 && (
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
        )}

        {filteredProducts.length === 0 ? (
          <EmptyState
            title={shopProducts.length === 0 ? 'No active products' : t('noMatchingProducts')}
            description={
              shopProducts.length === 0
                ? 'This shop has not published products yet.'
                : t('noMatchingDesc')
            }
            actionLabel={shopProducts.length > 0 ? t('resetFilters') : undefined}
            onAction={
              shopProducts.length > 0
                ? () => {
                    setInShopQuery('');
                    setSelectedCategory('all');
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.productId} product={product} />
            ))}
          </div>
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
