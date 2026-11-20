import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronRight,
  Coffee,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Sparkles,
  Store,
  User,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { BRAND_ASSETS, SEED_CATEGORIES } from '../data/seedData';
import {
  CategoryIcon,
  EmptyState,
  getCategoryCardTheme,
  ProductCard,
  ShopCard,
} from '../components/SharedUI';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { getLocalizedNeighborhood } from '../constants/translations';
import {
  buildHomeCategories,
  filterAndSortProducts,
  getCoffeeTraderListings,
  HAWASSA_NEIGHBORHOODS,
  isCoffeeProduct,
  isDedicatedCoffeeTrader,
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
    refreshCatalogFromFirestore,
  } = useMarketplace();

  const [searchQuery, setSearchQuery] = useState('');
  const [heroBannerFailed, setHeroBannerFailed] = useState(false);
  const [isRefreshingApp, setIsRefreshingApp] = useState(false);
  const [productSort, setProductSort] = useState<'newest' | 'nearest'>(() =>
    userLocation?.source === 'gps' ? 'nearest' : 'newest'
  );

  const approvedShops = useMemo(() => {
    const base = (
      governanceConfig.strictShopVerification
        ? shops.filter((s) => s.status === 'approved')
        : shops.filter((s) => s.status !== 'suspended')
    ).filter((s) => !isDedicatedCoffeeTrader(s, products));

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
  }, [governanceConfig.strictShopVerification, shops, products, proximityRankings, productSort]);

  const coffeeStats = useMemo(() => {
    const listings = getCoffeeTraderListings(shops, products, {
      strictShopVerification: governanceConfig.strictShopVerification,
    });
    const lotsCount = listings.reduce((sum, item) => sum + item.coffeeProducts.length, 0);
    return {
      tradersCount: listings.length,
      lotsCount,
    };
  }, [shops, products, governanceConfig.strictShopVerification]);

  const homeCategories = useMemo(
    () => buildHomeCategories(categories, SEED_CATEGORIES),
    [categories]
  );

  const categoryProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const product of products) {
      if (product.status !== 'active' || !product.isAvailable) continue;
      if (isCoffeeProduct(product)) continue;
      const shop = shopsById[product.shopId];
      if (!shop || shop.status === 'suspended') continue;
      if (governanceConfig.strictShopVerification && shop.status !== 'approved') continue;
      counts[product.category] = (counts[product.category] ?? 0) + 1;
    }
    return counts;
  }, [products, shopsById, governanceConfig.strictShopVerification]);

  const activeProducts = useMemo(
    () =>
      filterAndSortProducts(products, shopsById, {
        neighborhood: selectedNeighborhood === 'All Hawassa' ? 'all' : selectedNeighborhood,
        strictShopVerification: governanceConfig.strictShopVerification,
        excludeCoffee: true,
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
            excludeCoffee: true,
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

  const handleRefreshApp = async () => {
    if (isRefreshingApp) return;
    setIsRefreshingApp(true);
    try {
      await Promise.race([
        refreshCatalogFromFirestore(),
        new Promise((resolve) => setTimeout(resolve, 900)),
      ]);
    } catch {
      // Proceed with full app reload even if catalog prefetch fails
    } finally {
      window.location.reload();
    }
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
    <div className="min-h-full bg-[#F3F6F4] dark:bg-[#031719] text-[#0E2421] dark:text-[#F5FAFA] pb-8 transition-colors">
      {/* A. Compact Sticky Mobile Header */}
      <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 dark:bg-[#031719]/92 backdrop-blur-md border-b border-[#D2E0DC] dark:border-white/10 shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#FCFDFC] dark:bg-[#092825] border border-[#0F4C44]/25 dark:border-[#14443F] shrink-0 shadow-xs">
              <img
                src={BRAND_ASSETS.logo}
                alt="Affin Connect"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-display font-bold tracking-tight text-[#0F4C44] dark:text-[#F5FAFA] truncate">
                Affin Connect
              </h1>
              <p className="text-[11px] text-[#46635E] dark:text-[#A9C0BD] truncate">
                {t('authHeaderSubtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeToggleButton />

            <button
              type="button"
              onClick={handleRefreshApp}
              disabled={isRefreshingApp}
              aria-label="Refresh app"
              title="Refresh app"
              className="min-w-[40px] min-h-[40px] rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/55 dark:hover:border-[#00D68F]/50 hover:bg-[#E7F1ED] dark:hover:bg-[#0C332F] flex items-center justify-center text-[#0F4C44] dark:text-[#00C8D7] hover:text-[#047857] dark:hover:text-[#00D68F] shadow-[0_1px_4px_rgba(15,76,68,0.06)] dark:shadow-none disabled:opacity-70 active:scale-95 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshingApp ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => navigate({ name: 'notifications' })}
              aria-label={t('notifications')}
              className="relative min-w-[40px] min-h-[40px] rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/55 dark:hover:border-[#00D68F]/50 hover:bg-[#E7F1ED] dark:hover:bg-[#0C332F] flex items-center justify-center text-[#0E2421] dark:text-[#F5FAFA] shadow-[0_1px_4px_rgba(15,76,68,0.06)] dark:shadow-none transition-colors"
            >
              <Bell className="w-4 h-4 text-[#0F4C44] dark:text-[#00D68F]" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#0F4C44] dark:bg-[#00D68F] text-[#FCFDFC] dark:text-[#031719] text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate({ name: 'profile' })}
              aria-label={t('openProfileAria')}
              className="min-w-[40px] min-h-[40px] rounded-full p-0.5 bg-gradient-to-br from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] flex items-center justify-center shadow-md shadow-[#0F4C44]/20 dark:shadow-[#00D68F]/20 active:scale-95 transition-transform"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden bg-[#FCFDFC] dark:bg-[#061D1B] flex items-center justify-center text-xs font-bold text-[#0F4C44] dark:text-[#F5FAFA]">
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

        {/* B. Full-Width Rounded Search Input */}
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          className="mt-3 relative flex items-center rounded-2xl bg-[#F3F6F4] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] focus-within:border-[#0F4C44] dark:focus-within:border-[#00D68F] focus-within:ring-2 focus-within:ring-[#0F4C44]/15 dark:focus-within:ring-[#00D68F]/20 transition-all"
        >
          <Search className="w-4 h-4 text-[#0F4C44] dark:text-[#00D68F] ml-3.5 shrink-0 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('homeSearchPlaceholder')}
            aria-label={t('homeSearchPlaceholder')}
            className="w-full min-h-[44px] bg-transparent px-2.5 text-xs text-[#0E2421] dark:text-[#F5FAFA] placeholder:text-[#46635E]/75 dark:placeholder:text-[#A9C0BD]/70 focus:outline-none"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label={t('filterClearAllBtn')}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[#46635E] hover:text-[#0E2421] dark:text-[#A9C0BD] dark:hover:text-[#F5FAFA]"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
          <button
            type="submit"
            aria-label={t('navSearch')}
            className="mr-1.5 min-w-[36px] min-h-[36px] rounded-xl bg-[#0F4C44] dark:bg-[#00D68F]/15 hover:bg-[#047857] dark:hover:bg-[#00D68F] text-[#FCFDFC] dark:text-[#00D68F] hover:text-[#FCFDFC] dark:hover:text-[#031719] flex items-center justify-center transition-colors shrink-0 shadow-xs dark:shadow-none"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </header>

      <div className="px-4 pt-4 space-y-6">
        {governanceConfig.orderingPaused && (
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-[#F59E0B]/15 border border-amber-300 dark:border-[#F59E0B]/40 text-xs text-amber-900 dark:text-[#FDE68A] font-medium">
            {governanceConfig.maintenanceBanner?.trim() || t('governanceOrderingPaused')}
          </div>
        )}

        {/* C. Hero Banner */}
        <section className="relative rounded-2xl overflow-hidden border border-[#0F4C44]/40 dark:border-[#14443F] bg-gradient-to-br from-[#0F4C44] via-[#093430] to-[#041E1F] dark:from-[#062825] dark:via-[#051F22] dark:to-[#031719] shadow-[0_14px_30px_-14px_rgba(15,76,68,0.34)] dark:shadow-lg dark:shadow-black/30">
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
          <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-[#D2E0DC]/70 dark:border-transparent">
            <h2 id="home-categories-heading" className="text-sm font-bold text-[#0F4C44] dark:text-[#F5FAFA]">
              {t('categories')}
            </h2>
            <button
              type="button"
              onClick={() => navigate({ name: 'categories' })}
              className="min-h-[36px] px-1 text-xs font-semibold text-[#047857] hover:text-[#0F4C44] dark:text-[#00D68F] dark:hover:text-[#00C8D7] transition-colors"
            >
              {t('viewAll')}
            </button>
          </div>

          {authLoading && homeCategories.length === 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2.5 mobile-scroll">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-[124px] h-[112px] rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] animate-pulse shrink-0"
                />
              ))}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2.5 snap-x snap-mandatory mobile-scroll">
              {homeCategories.map((cat, idx) => {
                const iconKey = HOME_CATEGORY_ICON_OVERRIDES[cat.slug] ?? cat.iconName;
                const theme = getCategoryCardTheme(cat.slug, idx);
                const itemCount = categoryProductCounts[cat.slug] ?? 0;

                return (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => navigate({ name: 'search', initialCategory: cat.slug })}
                    className={`snap-start shrink-0 relative overflow-hidden w-[124px] min-h-[112px] rounded-2xl bg-gradient-to-br ${theme.surface} border ${theme.border} p-3 flex flex-col justify-between text-left shadow-[0_2px_10px_-4px_rgba(15,76,68,0.10)] hover:shadow-[0_8px_18px_-8px_rgba(15,76,68,0.16)] dark:shadow-lg dark:shadow-black/25 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C44] dark:focus-visible:ring-[#00D68F]`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute -top-6 -right-6 w-20 h-20 rounded-full blur-xl opacity-75 group-hover:opacity-100 transition-opacity pointer-events-none ${theme.glow}`}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-[#FCFDFC]/80 dark:via-white/25 to-transparent pointer-events-none"
                    />

                    <div className="relative z-10 w-full flex items-start justify-between gap-2">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${theme.iconBox}`}
                      >
                        <CategoryIcon iconName={iconKey} className="w-5 h-5" />
                      </div>
                      <ArrowUpRight
                        aria-hidden="true"
                        className={`w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 ${theme.arrow}`}
                      />
                    </div>

                    <div className="relative z-10 w-full pt-2.5 space-y-1.5">
                      <span className="block text-[12px] font-bold text-[#0E2421] dark:text-[#F5FAFA] leading-tight line-clamp-2">
                        {getCategoryLabel(cat)}
                      </span>
                      <div className="flex items-center justify-between gap-1.5">
                        <span
                          aria-hidden="true"
                          className={`h-0.5 w-6 group-hover:w-10 rounded-full bg-gradient-to-r ${theme.accentBar} transition-all duration-200`}
                        />
                        {itemCount > 0 && (
                          <span className="text-[10px] font-semibold tabular-nums text-[#46635E] dark:text-[#A9C0BD]">
                            {itemCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* D2. Dedicated Coffee Traders Card (Warm Ethiopian Coffee Palette) */}
        <section aria-label={t('coffeeTradersTitle')}>
          <button
            type="button"
            onClick={() => navigate({ name: 'coffee_traders' })}
            className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#4B2E24] via-[#3A221A] to-[#241510] border border-[#C68B59]/45 hover:border-[#C68B59]/80 p-3.5 text-left shadow-lg shadow-black/35 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C68B59]"
          >
            {/* Subtle warm caramel glow & top highlight */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-8 -right-6 w-28 h-28 rounded-full bg-[#C68B59]/25 blur-2xl opacity-80 group-hover:opacity-100 transition-opacity"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#F8F4EE]/35 to-transparent"
            />

            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#C68B59] to-[#8F5A32] text-[#241510] border border-[#F8F4EE]/25 shadow-md shadow-black/30 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
                  <Coffee className="w-6 h-6 stroke-[2.2]" />
                </div>

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-display font-bold text-[#F8F4EE] leading-tight">
                      {t('coffeeTradersTitle')}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#C68B59]/20 border border-[#C68B59]/40 text-[10px] font-bold uppercase tracking-wide text-[#F3D9BF]">
                      {t('coffeeTradersBadge')}
                    </span>
                  </div>
                  <p className="text-xs text-[#F8F4EE]/80 truncate">
                    {t('coffeeTradersSubtitle')}
                  </p>
                  {coffeeStats.tradersCount > 0 && (
                    <div className="flex items-center gap-2 text-[10.5px] font-semibold text-[#C68B59] tabular-nums pt-0.5">
                      <span>{t('coffeeTradersCountLabel', { count: coffeeStats.tradersCount })}</span>
                      <span aria-hidden="true" className="text-[#C68B59]/50">
                        ·
                      </span>
                      <span>{t('coffeeLotsCountLabel', { count: coffeeStats.lotsCount })}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="w-9 h-9 rounded-xl bg-[#F8F4EE]/10 border border-[#C68B59]/35 text-[#F8F4EE] flex items-center justify-center shrink-0 group-hover:bg-[#C68B59] group-hover:text-[#241510] transition-colors">
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </button>
        </section>

        {/* D3. Discover Shops Directory Card */}
        <section aria-label={t('discoverShopsTitle')}>
          <button
            type="button"
            onClick={() => navigate({ name: 'shops' })}
            className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#0F4C44] via-[#0B3B35] to-[#062825] dark:from-[#0A2E2B] dark:via-[#072322] dark:to-[#041819] border border-[#0F4C44]/50 dark:border-[#00D68F]/35 hover:border-[#047857] dark:hover:border-[#00D68F]/75 p-3.5 text-left shadow-[0_10px_24px_-12px_rgba(15,76,68,0.4)] dark:shadow-lg dark:shadow-black/30 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99]"
          >
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#FCFDFC]/12 dark:bg-[#00D68F]/15 border border-[#00D68F]/35 text-[#6EE7B7] dark:text-[#00D68F] flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
                  <Store className="w-5 h-5" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm font-display font-bold text-[#F5FAFA] leading-tight truncate">
                    {t('shopDirectoryCtaHome')}
                  </div>
                  <p className="text-xs text-[#CFE6E1] dark:text-[#A9C0BD] line-clamp-1">
                    {t('shopDirectoryCtaHomeDesc')}
                  </p>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-[#00D68F]/35 text-[#F5FAFA] flex items-center justify-center shrink-0 group-hover:bg-[#00D68F] group-hover:text-[#031719] transition-colors">
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </button>
        </section>

        {/* E. Featured Shops Horizontally Scrollable Cards */}
        <section aria-labelledby="home-shops-heading">
          <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-[#D2E0DC]/70 dark:border-transparent">
            <h2 id="home-shops-heading" className="text-sm font-bold text-[#0F4C44] dark:text-[#F5FAFA]">
              {t('homeFeaturedShopsTitle')}
            </h2>
            <button
              type="button"
              onClick={() => navigate({ name: 'shops' })}
              className="min-h-[36px] px-1 text-xs font-semibold text-[#047857] hover:text-[#0F4C44] dark:text-[#00D68F] dark:hover:text-[#00C8D7] transition-colors"
            >
              {t('discoverShopsTitle')}
            </button>
          </div>

          {authLoading && approvedShops.length === 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-1 mobile-scroll">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-56 h-52 rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] animate-pulse shrink-0"
                />
              ))}
            </div>
          ) : approvedShops.length === 0 ? (
            <div className="rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] p-5 text-center shadow-[0_2px_10px_-4px_rgba(15,76,68,0.08)] dark:shadow-none">
              <Store className="w-6 h-6 text-[#0F4C44] dark:text-[#00D68F] mx-auto mb-2" />
              <p className="text-xs text-[#46635E] dark:text-[#A9C0BD]">{t('noFollowedShopsDesc')}</p>
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
          <div className="flex items-center justify-between gap-2 mb-2.5 pb-1.5 border-b border-[#D2E0DC]/70 dark:border-transparent">
            <h2 id="home-products-heading" className="text-sm font-bold text-[#0F4C44] dark:text-[#F5FAFA] truncate">
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
                    ? 'bg-[#0F4C44] dark:bg-[#00D68F]/15 border-[#0F4C44] dark:border-[#00D68F] text-[#FCFDFC] dark:text-[#00D68F]'
                    : 'bg-[#FCFDFC] dark:bg-[#092825] border-[#D2E0DC] dark:border-[#14443F] text-[#46635E] dark:text-[#A9C0BD] hover:text-[#0F4C44] dark:hover:text-[#F5FAFA] hover:border-[#0F4C44]/50 dark:hover:border-[#00D68F]/50'
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
                className="min-h-[36px] px-1 text-xs font-semibold text-[#047857] hover:text-[#0F4C44] dark:text-[#00D68F] dark:hover:text-[#00C8D7] transition-colors"
              >
                {t('viewAll')}
              </button>
            </div>
          </div>

          {selectedNeighborhood !== 'All Hawassa' && (
            <div className="mb-3 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] text-[11px] shadow-[0_2px_8px_-4px_rgba(15,76,68,0.08)] dark:shadow-none">
              <span className="text-[#46635E] dark:text-[#A9C0BD] truncate">
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
                className="text-[#0F4C44] dark:text-[#00D68F] font-semibold shrink-0 hover:underline"
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
                  className="h-60 rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] animate-pulse"
                />
              ))}
            </div>
          ) : displayProducts.length === 0 ? (
            <div className="rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F]">
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
        <section className="rounded-2xl bg-gradient-to-br from-[#E6F1ED] via-[#FCFDFC] to-[#F3F6F4] dark:from-[#092825] dark:via-[#061D1B] dark:to-[#092825] border border-[#0F4C44]/25 dark:border-[#14443F] p-4 shadow-[0_6px_22px_-12px_rgba(15,76,68,0.18)] dark:shadow-md dark:shadow-black/25 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0F4C44] dark:text-[#00D68F]">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{t('homeLocationBadge')}</span>
            </div>
            <h2 className="text-sm font-display font-bold text-[#0E2421] dark:text-[#F5FAFA] leading-snug">
              {t('localBusinessTitle')}
            </h2>
            <p className="text-[11px] text-[#46635E] dark:text-[#A9C0BD] leading-relaxed">
              {t('localBusinessDesc')}
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => navigate({ name: 'profile', section: 'help' })}
                className="min-h-[40px] px-4 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 text-[#FCFDFC] dark:text-[#031719] text-xs font-bold inline-flex items-center gap-1.5 shadow-[0_6px_16px_-6px_rgba(15,76,68,0.35)] dark:shadow-md dark:shadow-[#00D68F]/20 active:scale-[0.98] transition-all"
              >
                <span>{t('learnMore')}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>

          <div className="w-20 h-24 rounded-2xl overflow-hidden bg-[#E8EFEA] dark:bg-[#031719] border border-[#0F4C44]/20 dark:border-[#14443F] shrink-0 relative shadow-xs">
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
