import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  ChevronDown,
  LayoutGrid,
  MapPin,
  Search,
  Sparkles,
  Store,
  Truck,
  User,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { BRAND_ASSETS, SEED_CATEGORIES } from '../data/seedData';
import { CategoryIcon, ShopCard } from '../components/SharedUI';
import { getLocalizedNeighborhood } from '../constants/translations';
import {
  buildHomeCategories,
  filterShopsForDirectory,
  HAWASSA_NEIGHBORHOODS,
} from '../utils/marketplaceLogic';

const SHOPS_CATEGORY_SLUGS = [
  'clothing-fashion',
  'electronics',
  'home-living',
  'groceries',
  'food-spices',
  'beauty-cosmetics',
  'sports',
] as const;

const SHOPS_CATEGORY_LABEL_KEYS: Record<string, string> = {
  'clothing-fashion': 'homeCategoryFashion',
  electronics: 'homeCategoryElectronics',
  'home-living': 'homeCategoryHomeLiving',
  groceries: 'homeCategoryGroceries',
  'food-spices': 'homeCategoryFoodDrinks',
  'beauty-cosmetics': 'homeCategoryBeautyHealth',
  sports: 'homeCategorySports',
};

const SHOPS_CATEGORY_ICON_OVERRIDES: Record<string, string> = {
  groceries: 'ShoppingBasket',
  'food-spices': 'UtensilsCrossed',
  'beauty-cosmetics': 'HeartPulse',
  sports: 'Dumbbell',
};

export const ShopsScreen: React.FC<{
  initialCategory?: string;
  showAll?: boolean;
}> = ({ initialCategory, showAll = false }) => {
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
    proximityRankings,
    unreadNotificationCount,
    categories,
    shops,
    products,
    governanceConfig,
  } = useMarketplace();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    showAll ? 'all' : initialCategory || 'all'
  );
  const [heroBannerFailed, setHeroBannerFailed] = useState(false);
  const shopsGridRef = useRef<HTMLElement | null>(null);

  const shopCategories = useMemo(() => {
    const ordered = buildHomeCategories(categories, SEED_CATEGORIES);
    const bySlug = new Map(ordered.map((c) => [c.slug, c]));
    return SHOPS_CATEGORY_SLUGS.map((slug) => bySlug.get(slug)).filter(
      (cat): cat is NonNullable<typeof cat> => Boolean(cat)
    );
  }, [categories]);

  const filteredShops = useMemo(() => {
    const base = filterShopsForDirectory(shops, products, {
      searchQuery,
      categorySlug: selectedCategory,
      neighborhood: selectedNeighborhood,
      strictShopVerification: governanceConfig.strictShopVerification,
    });

    if (userLocation?.source === 'gps' && proximityRankings.length > 0) {
      const rankIndex = new Map<string, number>(
        proximityRankings.map((entry, idx) => [entry.shop.shopId, idx])
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
  }, [
    shops,
    products,
    searchQuery,
    selectedCategory,
    selectedNeighborhood,
    governanceConfig.strictShopVerification,
    userLocation?.source,
    proximityRankings,
  ]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedCategory !== 'all' ||
    selectedNeighborhood !== 'All Hawassa';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    if (selectedNeighborhood !== 'All Hawassa') {
      setSelectedNeighborhood('All Hawassa');
    }
  };

  const scrollToShops = () => {
    shopsGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getCategoryLabel = (cat: (typeof shopCategories)[number]) => {
    const key = SHOPS_CATEGORY_LABEL_KEYS[cat.slug];
    if (key) return t(key);
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
      {/* Compact Sticky Safe-Area Header */}
      <header className="sticky top-0 z-20 bg-[#031719]/92 backdrop-blur-md border-b border-white/10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#092825] border border-[#00D68F]/35 shrink-0 shadow-md shadow-[#00D68F]/10">
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
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#092825] flex items-center justify-center text-xs font-bold text-[#F5FAFA]">
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

        {/* Shop Search & Location Selector */}
        <div className="mt-3 flex items-center gap-2">
          <div
            role="search"
            className="flex-1 min-w-0 relative flex items-center rounded-2xl bg-[#092825] border border-[#14443F] focus-within:border-[#00D68F] focus-within:ring-2 focus-within:ring-[#00D68F]/20 transition-all"
          >
            <Search className="w-4 h-4 text-[#00D68F] ml-3 shrink-0 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('shopsSearchPlaceholder')}
              aria-label={t('shopsSearchPlaceholder')}
              className="w-full min-h-[44px] bg-transparent px-2.5 text-xs text-[#F5FAFA] placeholder:text-[#A9C0BD] focus:outline-none"
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
          </div>

          <div className="relative inline-flex items-center rounded-2xl bg-[#092825] border border-[#14443F] hover:border-[#00D68F]/45 px-2.5 min-h-[44px] max-w-[132px] shrink-0">
            <MapPin className="w-3.5 h-3.5 text-[#00D68F] mr-1.5 shrink-0 pointer-events-none" />
            <select
              aria-label={t('selectNeighborhood')}
              value={selectedNeighborhood}
              onChange={(e) => setSelectedNeighborhood(e.target.value)}
              className="appearance-none bg-transparent text-[11px] font-semibold text-[#F5FAFA] pr-4 truncate focus:outline-none cursor-pointer max-w-[82px]"
            >
              <option value="All Hawassa" className="bg-[#092825] text-[#F5FAFA]">
                {t('shopsLocationLabel')}
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
      </header>

      <div className="px-4 pt-4 space-y-6">
        {/* Hero Banner */}
        <section className="relative rounded-2xl overflow-hidden border border-[#14443F] bg-gradient-to-br from-[#083833] via-[#092825] to-[#031719] shadow-xl shadow-black/35">
          {!heroBannerFailed ? (
            <img
              src={BRAND_ASSETS.banner}
              alt="Hawassa local shops"
              referrerPolicy="no-referrer"
              onError={() => setHeroBannerFailed(true)}
              className="absolute inset-0 w-full h-full object-cover object-[center_40%] opacity-50"
            />
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 400 220"
              className="absolute inset-0 w-full h-full opacity-35"
              preserveAspectRatio="none"
            >
              <path
                d="M0 150 Q 95 110, 200 145 T 400 130 L 400 220 L 0 220 Z"
                fill="#00D68F"
                fillOpacity="0.18"
              />
              <path
                d="M0 175 Q 110 140, 220 172 T 400 165 L 400 220 L 0 220 Z"
                fill="#00C8D7"
                fillOpacity="0.14"
              />
            </svg>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#031719] via-[#031719]/75 to-[#031719]/35" />

          <div className="relative p-4 pt-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#031719]/80 border border-[#00D68F]/35 text-[11px] font-semibold text-[#00D68F] backdrop-blur-xs">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>{t('homeLocationBadge')}</span>
              </span>

              <button
                type="button"
                onClick={() => navigate({ name: 'map' })}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#031719]/80 border border-[#00C8D7]/35 hover:border-[#00D68F] text-[11px] font-semibold text-[#00C8D7] hover:text-[#00D68F] backdrop-blur-xs transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{t('hawassaMapView')}</span>
              </button>
            </div>

            <div className="space-y-1.5 pt-0.5">
              <h2 className="text-xl font-display font-bold text-[#F5FAFA] leading-tight text-balance">
                {t('shopsHeroTitle')}
              </h2>
              <p className="text-xs text-[#A9C0BD] leading-relaxed max-w-[300px]">
                {t('shopsHeroDesc')}
              </p>
            </div>

            <div className="pt-1 flex items-center gap-2.5">
              <button
                type="button"
                onClick={scrollToShops}
                className="min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-[#00D68F] to-[#00C8D7] hover:brightness-105 text-[#031719] text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-[#00D68F]/25 active:scale-[0.98] transition-all"
              >
                <span>{t('exploreShops')}</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        </section>

        {/* Horizontally Scrollable Shop Categories */}
        <section aria-labelledby="shops-categories-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="shops-categories-heading" className="text-sm font-bold text-[#F5FAFA]">
              {t('categories')}
            </h2>
            {selectedCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="min-h-[36px] px-1 text-xs font-semibold text-[#00D68F] hover:text-[#00C8D7] transition-colors"
              >
                {t('all')}
              </button>
            )}
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-1 mobile-scroll">
            {shopCategories.map((cat) => {
              const isSelected = selectedCategory === cat.slug;
              const iconKey = SHOPS_CATEGORY_ICON_OVERRIDES[cat.slug] ?? cat.iconName;
              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() =>
                    setSelectedCategory((prev) => (prev === cat.slug ? 'all' : cat.slug))
                  }
                  aria-pressed={isSelected}
                  className={`shrink-0 w-[86px] min-h-[44px] rounded-2xl border px-2 py-2.5 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-[#0D3531] border-[#00D68F] shadow-md shadow-[#00D68F]/15'
                      : 'bg-[#092825] border-[#123E39] hover:border-[#00D68F]/45'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-[#00D68F] border-[#00D68F] text-[#031719]'
                        : 'bg-[#051C1A] border-[#00D68F]/20 text-[#00D68F]'
                    }`}
                  >
                    <CategoryIcon iconName={iconKey} className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[11px] font-medium text-center line-clamp-2 leading-tight ${
                      isSelected ? 'text-[#00D68F] font-semibold' : 'text-[#F5FAFA]'
                    }`}
                  >
                    {getCategoryLabel(cat)}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => navigate({ name: 'categories' })}
              className="shrink-0 w-[86px] min-h-[44px] rounded-2xl bg-[#092825] border border-[#123E39] hover:border-[#00C8D7]/50 px-2 py-2.5 flex flex-col items-center justify-center gap-2 transition-all active:scale-95"
            >
              <div className="w-10 h-10 rounded-xl bg-[#051C1A] border border-[#00C8D7]/25 flex items-center justify-center text-[#00C8D7]">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-medium text-[#F5FAFA] text-center line-clamp-2 leading-tight">
                {t('shopsCategoryMore')}
              </span>
            </button>
          </div>
        </section>

        {/* Nearby Shops Section */}
        <section ref={shopsGridRef} aria-labelledby="nearby-shops-heading">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <h2 id="nearby-shops-heading" className="text-sm font-bold text-[#F5FAFA] truncate">
                {t('nearbyShopsTitle')}
              </h2>
              <span className="px-2 py-0.5 rounded-lg bg-[#092825] border border-[#14443F] text-[11px] font-semibold text-[#00D68F] tabular-nums shrink-0">
                {filteredShops.length}
              </span>
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[36px] px-1 text-xs font-semibold text-[#00D68F] hover:text-[#00C8D7] transition-colors shrink-0"
            >
              {t('viewAll')}
            </button>
          </div>

          {authLoading && filteredShops.length === 0 ? (
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-56 rounded-2xl bg-[#092825] border border-[#123E39] animate-pulse"
                />
              ))}
            </div>
          ) : filteredShops.length === 0 ? (
            <div className="rounded-2xl bg-[#092825] border border-[#123E39] py-10 px-5 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-[#051C1A] border border-[#00D68F]/25 text-[#00D68F] flex items-center justify-center mb-3">
                <Store className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-[#F5FAFA]">
                {t('noMatchingShopsTitle')}
              </h3>
              <p className="text-xs text-[#A9C0BD] mt-1 max-w-[260px] leading-relaxed">
                {t('noMatchingShopsDesc')}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-4 px-5 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-[#00D68F] to-[#00C8D7] hover:brightness-105 text-[#031719] text-xs font-bold transition-all"
                >
                  {t('showAllShops')}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
              {filteredShops.map((shop) => (
                <ShopCard
                  key={shop.shopId}
                  shop={shop}
                  variant="emeraldDark"
                  fullWidth
                  showFavorite
                  showDistance={userLocation?.source === 'gps'}
                  highlightNearest={userLocation?.source === 'gps'}
                />
              ))}
            </div>
          )}
        </section>

        {/* Fast & Reliable Delivery Promotional Banner */}
        <section className="rounded-2xl bg-gradient-to-r from-[#092825] via-[#0B3530] to-[#072320] border border-[#00D68F]/30 p-4 shadow-lg shadow-black/25 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#00D68F]">
              <Truck className="w-3.5 h-3.5 shrink-0" />
              <span>{t('homeLocationBadge')}</span>
            </div>
            <h2 className="text-sm font-display font-bold text-[#F5FAFA] leading-snug">
              {t('shopsDeliveryTitle')}
            </h2>
            <p className="text-[11px] text-[#A9C0BD] leading-relaxed">
              {t('shopsDeliveryDesc')}
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => navigate({ name: 'profile', section: 'help' })}
                className="min-h-[40px] px-4 rounded-xl bg-gradient-to-r from-[#00D68F] to-[#00C8D7] hover:brightness-105 text-[#031719] text-xs font-bold inline-flex items-center gap-1.5 shadow-sm shadow-[#00D68F]/20 active:scale-[0.98] transition-all"
              >
                <span>{t('learnMore')}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-[#051C1A] border border-[#00D68F]/30 flex items-center justify-center text-[#00D68F] shrink-0 shadow-md">
            <Truck className="w-7 h-7" />
          </div>
        </section>
      </div>
    </div>
  );
};
