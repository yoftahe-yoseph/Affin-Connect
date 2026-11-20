import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Coffee,
  MapPin,
  Search,
  Sparkles,
  Store,
  User,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { BRAND_ASSETS } from '../data/seedData';
import {
  CategoryIcon,
  DiscoverShopCard,
  getCategoryCardTheme,
} from '../components/SharedUI';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { getLocalizedNeighborhood } from '../constants/translations';
import { HAWASSA_NEIGHBORHOODS } from '../utils/marketplaceLogic';
import {
  filterAndPaginateDiscoverShops,
  normalizeShopMainCategory,
  SHOP_DIRECTORY_CATEGORIES,
} from '../utils/shopDirectory';

const SHOPS_PAGE_SIZE = 8;

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
    shops,
    products,
    governanceConfig,
  } = useMarketplace();

  const resolvedInitialCategory = useMemo(() => {
    if (showAll || !initialCategory || initialCategory === 'all') return 'all';
    return normalizeShopMainCategory(initialCategory);
  }, [initialCategory, showAll]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(resolvedInitialCategory);
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'active' | 'temporarily_closed'>('all');
  const [visibleCount, setVisibleCount] = useState<number>(SHOPS_PAGE_SIZE);
  const [heroBannerFailed, setHeroBannerFailed] = useState(false);
  const shopsGridRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setSelectedCategory(resolvedInitialCategory);
  }, [resolvedInitialCategory]);

  // Reset pagination whenever filters change
  useEffect(() => {
    setVisibleCount(SHOPS_PAGE_SIZE);
  }, [searchQuery, selectedCategory, selectedNeighborhood, availabilityFilter]);

  const shopDistanceById = useMemo(() => {
    const map: Record<string, number> = {};
    if (userLocation?.source === 'gps' && proximityRankings.length > 0) {
      for (const entry of proximityRankings) {
        map[entry.shop.shopId] = entry.distanceKm;
      }
    }
    return map;
  }, [userLocation?.source, proximityRankings]);

  const directoryResult = useMemo(
    () =>
      filterAndPaginateDiscoverShops(shops, products, {
        searchQuery,
        category: selectedCategory,
        location: selectedNeighborhood === 'All Hawassa' ? 'all' : selectedNeighborhood,
        availability: availabilityFilter,
        strictShopVerification: governanceConfig.strictShopVerification,
        sortBy: userLocation?.source === 'gps' && proximityRankings.length > 0 ? 'nearest' : 'featured',
        shopDistanceById,
        page: 1,
        pageSize: visibleCount,
      }),
    [
      shops,
      products,
      searchQuery,
      selectedCategory,
      selectedNeighborhood,
      availabilityFilter,
      governanceConfig.strictShopVerification,
      visibleCount,
      userLocation?.source,
      proximityRankings.length,
      shopDistanceById,
    ]
  );

  const visibleShops = directoryResult.items;
  const totalMatchingShops = directoryResult.total;
  const hasMoreShops = directoryResult.hasMore;

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedCategory !== 'all' ||
    availabilityFilter !== 'all' ||
    selectedNeighborhood !== 'All Hawassa';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setAvailabilityFilter('all');
    if (selectedNeighborhood !== 'All Hawassa') {
      setSelectedNeighborhood('All Hawassa');
    }
  };

  const scrollToShops = () => {
    shopsGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      {/* Compact Sticky Safe-Area Header */}
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
                {t('discoverShopsTitle')}
              </h1>
              <p className="text-[11px] text-[#46635E] dark:text-[#A9C0BD] truncate">
                Affin Connect · {t('location')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeToggleButton />

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

        {/* Shop Search & Location Selector */}
        <div className="mt-3 flex items-center gap-2">
          <div
            role="search"
            className="flex-1 min-w-0 relative flex items-center rounded-2xl bg-[#F3F6F4] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] focus-within:border-[#0F4C44] dark:focus-within:border-[#00D68F] focus-within:ring-2 focus-within:ring-[#0F4C44]/15 dark:focus-within:ring-[#00D68F]/20 transition-all"
          >
            <Search className="w-4 h-4 text-[#0F4C44] dark:text-[#00D68F] ml-3 shrink-0 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('discoverShopsSearchPlaceholder')}
              aria-label={t('discoverShopsSearchPlaceholder')}
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
          </div>

          <div className="relative inline-flex items-center rounded-2xl bg-[#F3F6F4] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/50 dark:hover:border-[#00D68F]/50 px-2.5 min-h-[44px] max-w-[132px] shrink-0">
            <MapPin className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#00D68F] mr-1.5 shrink-0 pointer-events-none" />
            <select
              aria-label={t('selectNeighborhood')}
              value={selectedNeighborhood}
              onChange={(e) => setSelectedNeighborhood(e.target.value)}
              className="appearance-none bg-transparent text-[11px] font-semibold text-[#0E2421] dark:text-[#F5FAFA] pr-4 truncate focus:outline-none cursor-pointer max-w-[82px]"
            >
              <option value="All Hawassa" className="bg-[#FCFDFC] dark:bg-[#092825] text-[#0E2421] dark:text-[#F5FAFA]">
                {t('shopsLocationLabel')}
              </option>
              {HAWASSA_NEIGHBORHOODS.map((n) => (
                <option key={n} value={n} className="bg-[#FCFDFC] dark:bg-[#092825] text-[#0E2421] dark:text-[#F5FAFA]">
                  {getLocalizedNeighborhood(n, language)}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-[#46635E] dark:text-[#A9C0BD] absolute right-2 pointer-events-none" />
          </div>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-5">
        {/* Discover Shops Editorial Hero Banner */}
        <section className="relative rounded-2xl overflow-hidden border border-[#0F4C44]/40 dark:border-[#14443F] bg-gradient-to-br from-[#0F4C44] via-[#093430] to-[#041E1F] dark:from-[#062825] dark:via-[#051F22] dark:to-[#031719] shadow-[0_14px_30px_-14px_rgba(15,76,68,0.34)] dark:shadow-lg dark:shadow-black/30">
          {!heroBannerFailed && (
            <img
              src={BRAND_ASSETS.banner}
              alt="Hawassa verified shops directory"
              referrerPolicy="no-referrer"
              onError={() => setHeroBannerFailed(true)}
              className="absolute inset-0 w-full h-full object-cover object-[center_40%] opacity-35 mix-blend-luminosity"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#031719] via-[#031719]/75 to-[#062E2B]/40" />

          <div className="relative p-4 pt-4.5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#031719]/80 backdrop-blur-xs border border-[#00D68F]/35 text-[11px] font-semibold text-[#00D68F]">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>{t('homeLocationBadge')}</span>
              </span>

              <button
                type="button"
                onClick={() => navigate({ name: 'map' })}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#031719]/80 backdrop-blur-xs border border-[#14443F] hover:border-[#00D68F]/60 text-[11px] font-semibold text-[#00C8D7] transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{t('hawassaMapView')}</span>
              </button>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-display font-bold text-[#F5FAFA] leading-tight text-balance">
                {t('discoverShopsTitle')}
              </h2>
              <p className="text-xs text-[#A9C0BD] leading-relaxed max-w-[320px]">
                {t('discoverShopsSubtitle')}
              </p>
            </div>

            <div className="pt-0.5 flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={scrollToShops}
                className="min-h-[42px] px-4.5 rounded-xl bg-gradient-to-r from-[#00D68F] to-[#00C8D7] hover:brightness-105 text-[#031719] text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-[#00D68F]/20 active:scale-[0.98] transition-all"
              >
                <span>{t('exploreShops')}</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => navigate({ name: 'seller', tab: 'shop' })}
                className="min-h-[42px] px-3.5 rounded-xl bg-[#031719]/75 hover:bg-[#092825] border border-white/15 hover:border-[#00D68F]/50 text-[#F5FAFA] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Store className="w-3.5 h-3.5 text-[#00D68F] shrink-0" />
                <span>{t('createShopProfileBtn')}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Horizontally Scrollable Shop Directory Categories */}
        <section aria-labelledby="shops-categories-heading">
          <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-[#D2E0DC]/70 dark:border-transparent">
            <h2 id="shops-categories-heading" className="text-sm font-bold text-[#0F4C44] dark:text-[#F5FAFA]">
              {t('categories')}
            </h2>
            {selectedCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="min-h-[32px] px-1 text-xs font-semibold text-[#047857] hover:text-[#0F4C44] dark:text-[#00D68F] dark:hover:text-[#00C8D7] transition-colors"
              >
                {t('shopDirCatAll')}
              </button>
            )}
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory mobile-scroll">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              aria-pressed={selectedCategory === 'all'}
              className={`snap-start shrink-0 relative overflow-hidden w-[108px] min-h-[96px] rounded-2xl bg-gradient-to-br from-[#E6F1ED] via-[#FCFDFC] to-[#FCFDFC] dark:from-[#0F2F2E] dark:via-[#092123] dark:to-[#051518] border p-2.5 flex flex-col justify-between text-left transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'border-[#0F4C44] ring-2 ring-[#0F4C44]/25 dark:border-[#00D68F] dark:ring-[#00D68F]/35'
                  : 'border-[#BFD6CE] hover:border-[#0F4C44]/60 dark:border-[#14443F] dark:hover:border-[#00D68F]/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    selectedCategory === 'all'
                      ? 'bg-[#0F4C44] text-[#FCFDFC] dark:bg-[#00D68F] dark:text-[#031719]'
                      : 'bg-[#E2F1EC] dark:bg-[#00D68F]/15 text-[#0F4C44] dark:text-[#00D68F]'
                  }`}
                >
                  <Store className="w-4.5 h-4.5" />
                </div>
                {selectedCategory === 'all' && (
                  <span className="w-4.5 h-4.5 rounded-full bg-[#0F4C44] dark:bg-[#00D68F] text-[#FCFDFC] dark:text-[#031719] flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <span
                className={`block text-[11px] font-bold leading-tight ${
                  selectedCategory === 'all'
                    ? 'text-[#0F4C44] dark:text-[#00D68F]'
                    : 'text-[#0E2421] dark:text-[#F5FAFA]'
                }`}
              >
                {t('shopDirCatAll')}
              </span>
            </button>

            {SHOP_DIRECTORY_CATEGORIES.map((cat, idx) => {
              const isSelected = selectedCategory === cat.slug;
              const theme = getCategoryCardTheme(cat.slug, idx);
              const label = t(cat.labelKey);

              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() =>
                    setSelectedCategory((prev) => (prev === cat.slug ? 'all' : cat.slug))
                  }
                  aria-pressed={isSelected}
                  className={`snap-start shrink-0 relative overflow-hidden w-[114px] min-h-[96px] rounded-2xl bg-gradient-to-br ${theme.surface} border ${
                    isSelected ? theme.selectedBorder : theme.border
                  } p-2.5 flex flex-col justify-between text-left shadow-[0_2px_10px_-4px_rgba(15,76,68,0.10)] hover:shadow-[0_8px_18px_-8px_rgba(15,76,68,0.16)] dark:shadow-lg dark:shadow-black/25 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C44] dark:focus-visible:ring-[#00D68F]`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute -top-6 -right-6 w-20 h-20 rounded-full blur-xl transition-opacity pointer-events-none ${
                      isSelected ? 'opacity-100' : 'opacity-75 group-hover:opacity-100'
                    } ${theme.glow}`}
                  />

                  <div className="relative z-10 w-full flex items-start justify-between gap-2">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105 ${
                        isSelected ? theme.selectedIconBox : theme.iconBox
                      }`}
                    >
                      <CategoryIcon iconName={cat.iconName} className="w-4.5 h-4.5" />
                    </div>
                    {isSelected ? (
                      <span
                        aria-hidden="true"
                        className={`w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 ${theme.selectedIconBox}`}
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    ) : (
                      <ArrowUpRight
                        aria-hidden="true"
                        className={`w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-all shrink-0 ${theme.arrow}`}
                      />
                    )}
                  </div>

                  <div className="relative z-10 w-full pt-2 space-y-1">
                    <span
                      className={`block text-[11px] font-bold leading-tight line-clamp-2 ${
                        isSelected ? theme.activeText : 'text-[#0E2421] dark:text-[#F5FAFA]'
                      }`}
                    >
                      {label}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`block h-0.5 rounded-full bg-gradient-to-r transition-all duration-200 ${
                        isSelected ? 'w-10' : 'w-5 group-hover:w-9'
                      } ${theme.accentBar}`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Dedicated Coffee Traders Hub Shortcut */}
        <button
          type="button"
          onClick={() => navigate({ name: 'coffee_traders' })}
          className="w-full rounded-2xl bg-gradient-to-r from-[#4B2E24] via-[#342019] to-[#1D120E] border border-[#C68B59]/40 hover:border-[#C68B59]/75 px-3.5 py-3 flex items-center justify-between gap-3 text-left shadow-md shadow-black/20 transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C68B59] to-[#8F5A32] text-[#1F120E] flex items-center justify-center shrink-0">
              <Coffee className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#F8F4EE] truncate">
                {t('coffeeTradersTitle')}
              </div>
              <div className="text-[11px] text-[#F8F4EE]/75 truncate">
                {t('coffeeTradersSubtitle')}
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#C68B59] shrink-0" />
        </button>

        {/* Verified Shop Directory Listing */}
        <section ref={shopsGridRef} aria-labelledby="discover-shops-list-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#D2E0DC]/70 dark:border-transparent flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <h2
                id="discover-shops-list-heading"
                className="text-sm font-bold text-[#0F4C44] dark:text-[#F5FAFA] truncate"
              >
                {t('discoverShopsTitle')}
              </h2>
              <span className="px-2 py-0.5 rounded-lg bg-[#E7F1ED] dark:bg-[#092825] border border-[#BFD6CE] dark:border-[#14443F] text-[11px] font-semibold text-[#0F4C44] dark:text-[#00D68F] tabular-nums shrink-0">
                {totalMatchingShops}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'all', label: t('shopFilterStatusAll') },
                  { id: 'active', label: t('shopFilterStatusActive') },
                  { id: 'temporarily_closed', label: t('shopFilterStatusTempClosed') },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAvailabilityFilter(opt.id)}
                  aria-pressed={availabilityFilter === opt.id}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                    availabilityFilter === opt.id
                      ? 'bg-[#0F4C44] dark:bg-[#00D68F] text-[#FCFDFC] dark:text-[#031719] border-[#0F4C44] dark:border-[#00D68F]'
                      : 'bg-[#FCFDFC] dark:bg-[#092825] text-[#46635E] dark:text-[#A9C0BD] border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {authLoading && visibleShops.length === 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-44 rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] animate-pulse"
                />
              ))}
            </div>
          ) : visibleShops.length === 0 ? (
            <div className="rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] py-10 px-5 text-center flex flex-col items-center justify-center shadow-[0_2px_10px_-4px_rgba(15,76,68,0.08)] dark:shadow-none">
              <div className="w-12 h-12 rounded-2xl bg-[#E7F1ED] dark:bg-[#031719] border border-[#BFD6CE] dark:border-[#14443F] text-[#0F4C44] dark:text-[#00D68F] flex items-center justify-center mb-3">
                <Store className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-[#0E2421] dark:text-[#F5FAFA]">
                {t('noMatchingShopsTitle')}
              </h3>
              <p className="text-xs text-[#46635E] dark:text-[#A9C0BD] mt-1 max-w-[260px] leading-relaxed">
                {t('noMatchingShopsDesc')}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-4 px-5 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] text-[#FCFDFC] dark:text-[#031719] text-xs font-bold transition-all"
                >
                  {t('showAllShops')}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {visibleShops.map((shop) => (
                  <DiscoverShopCard
                    key={shop.shopId}
                    shop={shop}
                    showDistance={userLocation?.source === 'gps'}
                  />
                ))}
              </div>

              {/* Pagination / Lazy Load More */}
              <div className="pt-2 flex flex-col items-center gap-2">
                <p className="text-[11px] text-[#46635E] dark:text-[#A9C0BD] tabular-nums">
                  {t('showingShopsCount', {
                    shown: visibleShops.length,
                    total: totalMatchingShops,
                  })}
                </p>
                {hasMoreShops && (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + SHOPS_PAGE_SIZE)}
                    className="min-h-[42px] px-5 rounded-xl bg-[#FCFDFC] dark:bg-[#092825] hover:bg-[#E7F1ED] dark:hover:bg-[#0D332F] border border-[#BFD6CE] dark:border-[#14443F] text-[#0F4C44] dark:text-[#00D68F] text-xs font-bold transition-colors shadow-xs"
                  >
                    {t('loadMoreShopsBtn')}
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};
