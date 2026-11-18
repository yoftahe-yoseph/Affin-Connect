import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  ChevronDown,
  Loader2,
  MapPin,
  Navigation,
  Search,
  Sparkles,
  Store,
  User,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { BRAND_ASSETS, SEED_CATEGORIES } from '../data/seedData';
import { CategoryIcon, EmptyState, ProductCard, ShopCard } from '../components/SharedUI';
import { getLocalizedNeighborhood } from '../constants/translations';
import {
  buildHomeCategories,
  filterAndSortProducts,
  HAWASSA_NEIGHBORHOODS,
} from '../utils/marketplaceLogic';

const HOME_CATEGORY_LABEL_KEYS: Record<string, string> = {
  'clothing-fashion': 'homeCategoryFashion',
  electronics: 'homeCategoryElectronics',
  'home-living': 'homeCategoryHomeLiving',
  groceries: 'homeCategoryGroceries',
  'food-spices': 'homeCategoryFoodDrinks',
  'beauty-cosmetics': 'homeCategoryBeautyHealth',
  sports: 'homeCategorySports',
  automotive: 'homeCategoryAutomotive',
};

const HOME_CATEGORY_ICON_OVERRIDES: Record<string, string> = {
  groceries: 'ShoppingBasket',
  'food-spices': 'UtensilsCrossed',
  'beauty-cosmetics': 'HeartPulse',
  sports: 'Dumbbell',
  automotive: 'Car',
};

export const HomeScreen: React.FC = () => {
  const {
    navigate,
    t,
    language,
    firebaseUser,
    userProfile,
    authLoading,
    selectedNeighborhood,
    setSelectedNeighborhood,
    userLocation,
    detectingLocation,
    detectUserLocation,
    proximityRankings,
    shopDistanceById,
    unreadNotificationCount,
    categories,
    shops,
    shopsById,
    products,
    addRecentSearch,
    governanceConfig,
  } = useMarketplace();

  const [searchQuery, setSearchQuery] = useState('');
  const [heroBannerFailed, setHeroBannerFailed] = useState(false);
  const [productSort, setProductSort] = useState<'newest' | 'nearest'>(() =>
    userLocation?.source === 'gps' ? 'nearest' : 'newest'
  );

  const approvedShops = useMemo(() => {
    const base = governanceConfig.strictShopVerification
      ? shops.filter((s) => s.status === 'approved')
      : shops.filter((s) => s.status !== 'suspended');

    if (proximityRankings.length > 0 && productSort === 'nearest') {
      const rankIndex = new Map<string, number>(
        proximityRankings.map((item, idx) => [item.shop.shopId, idx])
      );
      return [...base].sort((a, b) => {
        const ra = rankIndex.get(a.shopId) ?? Number.MAX_SAFE_INTEGER;
        const rb = rankIndex.get(b.shopId) ?? Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb;
        return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      });
    }

    return [...base].sort((a, b) => {
      if (Boolean(b.featured) !== Boolean(a.featured)) {
        return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      }
      return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
    });
  }, [governanceConfig.strictShopVerification, shops, proximityRankings, productSort]);

  const homeCategories = useMemo(
    () => buildHomeCategories(categories, SEED_CATEGORIES),
    [categories]
  );

  const activeProducts = useMemo(
    () =>
      filterAndSortProducts(products, shopsById, {
        neighborhood: selectedNeighborhood === 'All Hawassa' ? 'all' : selectedNeighborhood,
        strictShopVerification: governanceConfig.strictShopVerification,
        sortBy: productSort,
        shopDistanceById,
      }),
    [
      products,
      shopsById,
      selectedNeighborhood,
      governanceConfig.strictShopVerification,
      productSort,
      shopDistanceById,
    ]
  );

  const displayProducts = useMemo(
    () =>
      activeProducts.length > 0
        ? activeProducts
        : filterAndSortProducts(products, shopsById, {
            strictShopVerification: governanceConfig.strictShopVerification,
            sortBy: productSort,
            shopDistanceById,
          }),
    [
      activeProducts,
      products,
      shopsById,
      governanceConfig.strictShopVerification,
      productSort,
      shopDistanceById,
    ]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      addRecentSearch(trimmed);
    }
    navigate({ name: 'search', initialQuery: trimmed });
  };

  const handleDetectLocation = async () => {
    await detectUserLocation();
    setProductSort('nearest');
  };

  const getCategoryLabel = (cat: (typeof homeCategories)[number]) => {
    const homeKey = HOME_CATEGORY_LABEL_KEYS[cat.slug];
    if (homeKey) return t(homeKey);
    if (language === 'am') return cat.nameAm;
    if (language === 'om') return cat.nameOm;
    if (language === 'sid') return cat.nameSid || cat.name;
    return cat.name;
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

  return (
    <div className="min-h-full bg-[#031719] text-[#F5FAFA] pb-8">
      {/* A. Compact Sticky Mobile Header */}
      <header className="sticky top-0 z-20 bg-[#031719]/92 backdrop-blur-md border-b border-white/10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#092825] border border-[#14443F] shrink-0 shadow-sm">
              <img
                src={BRAND_ASSETS.logo}
                alt="Affin Connect"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-display font-bold tracking-tight text-[#F5FAFA] truncate">
                Affin Connect
              </h1>
              <p className="text-[11px] text-[#A9C0BD] truncate">
                {t('authHeaderSubtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate({ name: 'notifications' })}
              aria-label={t('notifications')}
              className="relative min-w-[44px] min-h-[44px] rounded-xl bg-[#092825] border border-[#14443F] hover:border-[#00D68F]/50 flex items-center justify-center text-[#F5FAFA] transition-colors"
            >
              <Bell className="w-5 h-5 text-[#00D68F]" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#00D68F] text-[#031719] text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate({ name: 'profile' })}
              aria-label={t('openProfileAria')}
              className="min-w-[44px] min-h-[44px] rounded-full p-0.5 bg-gradient-to-br from-[#00D68F] to-[#00C8D7] flex items-center justify-center shadow-md shadow-[#00D68F]/20 active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#061D1B] flex items-center justify-center text-xs font-bold text-[#F5FAFA]">
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
                  <User className="w-4 h-4 text-[#00D68F]" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* B. Full-Width Rounded Search Input */}
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          className="mt-3 relative flex items-center rounded-2xl bg-[#092825] border border-[#14443F] focus-within:border-[#00D68F] focus-within:ring-2 focus-within:ring-[#00D68F]/20 transition-all"
        >
          <Search className="w-4 h-4 text-[#00D68F] ml-3.5 shrink-0 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('homeSearchPlaceholder')}
            aria-label={t('homeSearchPlaceholder')}
            className="w-full min-h-[44px] bg-transparent px-2.5 text-xs text-[#F5FAFA] placeholder:text-[#A9C0BD]/70 focus:outline-none"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label={t('filterClearAllBtn')}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[#A9C0BD] hover:text-[#F5FAFA]"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
          <button
            type="submit"
            aria-label={t('navSearch')}
            className="mr-1.5 min-w-[36px] min-h-[36px] rounded-xl bg-[#00D68F]/15 hover:bg-[#00D68F] text-[#00D68F] hover:text-[#031719] flex items-center justify-center transition-colors shrink-0"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </header>

      <div className="px-4 pt-4 space-y-6">
        {governanceConfig.orderingPaused && (
          <div className="p-3 rounded-2xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-xs text-[#FDE68A] font-medium">
            {governanceConfig.maintenanceBanner?.trim() || t('governanceOrderingPaused')}
          </div>
        )}

        {/* C. Hero Banner */}
        <section className="relative rounded-2xl overflow-hidden border border-[#14443F] bg-gradient-to-br from-[#062825] via-[#051F22] to-[#031719] shadow-lg shadow-black/30">
          {!heroBannerFailed ? (
            <img
              src={BRAND_ASSETS.banner}
              alt="Lake Hawassa local market"
              referrerPolicy="no-referrer"
              onError={() => setHeroBannerFailed(true)}
              className="absolute inset-0 w-full h-full object-cover object-[center_40%] opacity-40 mix-blend-luminosity"
            />
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 400 220"
              className="absolute inset-0 w-full h-full opacity-45"
              preserveAspectRatio="none"
            >
              <path
                d="M0 150 Q 95 110, 200 145 T 400 130 L 400 220 L 0 220 Z"
                fill="#00D68F"
                fillOpacity="0.16"
              />
              <path
                d="M0 175 Q 110 140, 220 172 T 400 165 L 400 220 L 0 220 Z"
                fill="#00C8D7"
                fillOpacity="0.14"
              />
            </svg>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#031719] via-[#031719]/75 to-[#062E2B]/40" />

          <div className="relative p-4 pt-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#031719]/80 backdrop-blur-xs border border-[#00D68F]/35 text-[11px] font-semibold text-[#00D68F]">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{t('homeLocationBadge')}</span>
              </span>

              <div className="relative inline-flex items-center rounded-xl bg-[#031719]/80 backdrop-blur-xs border border-[#14443F] px-2.5 py-1 max-w-[175px]">
                <select
                  aria-label={t('selectNeighborhood')}
                  value={selectedNeighborhood}
                  onChange={(e) => setSelectedNeighborhood(e.target.value)}
                  className="appearance-none bg-transparent text-[11px] font-semibold text-[#F5FAFA] pr-4 truncate focus:outline-none cursor-pointer"
                >
                  <option value="All Hawassa" className="bg-[#092825] text-[#F5FAFA]">
                    {t('allHawassaAreas')}
                  </option>
                  {HAWASSA_NEIGHBORHOODS.map((n) => (
                    <option key={n} value={n} className="bg-[#092825] text-[#F5FAFA]">
                      {getLocalizedNeighborhood(n, language)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-[#A9C0BD] absolute right-2 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <h2 className="text-xl font-display font-bold text-[#F5FAFA] leading-tight text-balance">
                {t('homeHeroTitle')}
              </h2>
              <p className="text-xs text-[#A9C0BD] leading-relaxed max-w-[300px]">
                {t('homeHeroDesc')}
              </p>
            </div>

            <div className="pt-1 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => navigate({ name: 'search' })}
                className="min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-[#00D68F] to-[#00C8D7] hover:brightness-105 text-[#031719] text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-[#00D68F]/20 active:scale-[0.98] transition-all"
              >
                <span>{t('homeStartShopping')}</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        </section>

        {/* D. Categories Horizontally Scrollable Strip */}
        <section aria-labelledby="home-categories-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="home-categories-heading" className="text-sm font-bold text-[#F5FAFA]">
              {t('categories')}
            </h2>
            <button
              type="button"
              onClick={() => navigate({ name: 'categories' })}
              className="min-h-[36px] px-1 text-xs font-semibold text-[#00D68F] hover:text-[#00C8D7] transition-colors"
            >
              {t('viewAll')}
            </button>
          </div>

          {authLoading && homeCategories.length === 0 ? (
            <div className="flex gap-2.5 overflow-x-auto pb-1 mobile-scroll">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-[84px] h-[88px] rounded-2xl bg-[#092825] border border-[#14443F] animate-pulse shrink-0"
                />
              ))}
            </div>
          ) : (
            <div className="flex gap-2.5 overflow-x-auto pb-1 mobile-scroll">
              {homeCategories.map((cat) => {
                const iconKey = HOME_CATEGORY_ICON_OVERRIDES[cat.slug] ?? cat.iconName;
                return (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => navigate({ name: 'search', initialCategory: cat.slug })}
                    className="shrink-0 w-[86px] min-h-[44px] rounded-2xl bg-[#092825] border border-[#14443F] hover:border-[#00D68F]/60 px-2 py-2.5 flex flex-col items-center justify-center gap-2 group transition-all active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#031719] border border-[#14443F] flex items-center justify-center text-[#00D68F] group-hover:bg-[#00D68F]/15 transition-colors">
                      <CategoryIcon iconName={iconKey} className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-medium text-[#F5FAFA] text-center line-clamp-2 leading-tight">
                      {getCategoryLabel(cat)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* E. Featured Shops Horizontally Scrollable Cards */}
        <section aria-labelledby="home-shops-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="home-shops-heading" className="text-sm font-bold text-[#F5FAFA]">
              {t('homeFeaturedShopsTitle')}
            </h2>
            <button
              type="button"
              onClick={() => navigate({ name: 'shops' })}
              className="min-h-[36px] px-1 text-xs font-semibold text-[#00D68F] hover:text-[#00C8D7] transition-colors"
            >
              {t('viewAll')}
            </button>
          </div>

          {authLoading && approvedShops.length === 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-1 mobile-scroll">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-56 h-52 rounded-2xl bg-[#092825] border border-[#14443F] animate-pulse shrink-0"
                />
              ))}
            </div>
          ) : approvedShops.length === 0 ? (
            <div className="rounded-2xl bg-[#092825] border border-[#14443F] p-5 text-center">
              <Store className="w-6 h-6 text-[#00D68F] mx-auto mb-2" />
              <p className="text-xs text-[#A9C0BD]">{t('noFollowedShopsDesc')}</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 mobile-scroll">
              {approvedShops.map((shop) => (
                <ShopCard
                  key={shop.shopId}
                  shop={shop}
                  variant="emeraldDark"
                  highlightNearest={productSort === 'nearest'}
                />
              ))}
            </div>
          )}
        </section>

        {/* F. Popular Products 2-Column Grid */}
        <section aria-labelledby="home-products-heading">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <h2 id="home-products-heading" className="text-sm font-bold text-[#F5FAFA] truncate">
              {t('homePopularProductsTitle')}
            </h2>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (userLocation?.source === 'gps') {
                    setProductSort((prev) => (prev === 'nearest' ? 'newest' : 'nearest'));
                  } else {
                    void handleDetectLocation();
                  }
                }}
                disabled={detectingLocation}
                className={`min-h-[34px] px-2.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                  productSort === 'nearest'
                    ? 'bg-[#00D68F]/15 border-[#00D68F] text-[#00D68F]'
                    : 'bg-[#092825] border-[#14443F] text-[#A9C0BD] hover:text-[#F5FAFA] hover:border-[#00D68F]/50'
                }`}
              >
                {detectingLocation ? (
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                ) : (
                  <Navigation className="w-3 h-3 shrink-0" />
                )}
                <span>{detectingLocation ? t('detectingLocation') : t('filterSortNearest')}</span>
              </button>

              <button
                type="button"
                onClick={() => navigate({ name: 'search' })}
                className="min-h-[36px] px-1 text-xs font-semibold text-[#00D68F] hover:text-[#00C8D7] transition-colors"
              >
                {t('viewAll')}
              </button>
            </div>
          </div>

          {selectedNeighborhood !== 'All Hawassa' && (
            <div className="mb-3 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#092825] border border-[#14443F] text-[11px]">
              <span className="text-[#A9C0BD] truncate">
                {activeProducts.length === 0
                  ? t('noNeighborhoodListings', {
                      neighborhood: getLocalizedNeighborhood(selectedNeighborhood, language),
                    })
                  : t('locationUsingNeighborhood', {
                      neighborhood: getLocalizedNeighborhood(selectedNeighborhood, language),
                    })}
              </span>
              <button
                type="button"
                onClick={() => setSelectedNeighborhood('All Hawassa')}
                className="text-[#00D68F] font-semibold shrink-0 hover:underline"
              >
                {t('showAll')}
              </button>
            </div>
          )}

          {authLoading && displayProducts.length === 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-60 rounded-2xl bg-[#092825] border border-[#14443F] animate-pulse"
                />
              ))}
            </div>
          ) : displayProducts.length === 0 ? (
            <div className="rounded-2xl bg-[#092825] border border-[#14443F]">
              <EmptyState
                title={t('noMatchingProducts')}
                description={t('noMatchingDesc')}
                actionLabel={t('showAllProducts')}
                onAction={() => navigate({ name: 'search' })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {displayProducts.map((product) => (
                <ProductCard
                  key={product.productId}
                  product={product}
                  variant="emeraldDark"
                />
              ))}
            </div>
          )}
        </section>

        {/* G. Compact Local Business Banner */}
        <section className="rounded-2xl bg-gradient-to-r from-[#092825] via-[#061D1B] to-[#092825] border border-[#14443F] p-4 shadow-md shadow-black/25 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#00D68F]">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{t('homeLocationBadge')}</span>
            </div>
            <h2 className="text-sm font-display font-bold text-[#F5FAFA] leading-snug">
              {t('localBusinessTitle')}
            </h2>
            <p className="text-[11px] text-[#A9C0BD] leading-relaxed">
              {t('localBusinessDesc')}
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => navigate({ name: 'profile', section: 'help' })}
                className="min-h-[40px] px-4 rounded-xl bg-gradient-to-r from-[#00D68F] to-[#00C8D7] hover:brightness-105 text-[#031719] text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-[#00D68F]/20 active:scale-[0.98] transition-all"
              >
                <span>{t('learnMore')}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>

          <div className="w-20 h-24 rounded-2xl overflow-hidden bg-[#031719] border border-[#14443F] shrink-0 relative">
            <img
              src={BRAND_ASSETS.coffee}
              alt="Support Hawassa Local Merchants"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </section>
      </div>
    </div>
  );
};
