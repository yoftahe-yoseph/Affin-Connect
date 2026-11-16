import React, { useState } from 'react';
import {
  Bell,
  BellRing,
  ChevronDown,
  Loader2,
  MapPin,
  MessageSquare,
  Navigation,
  Search,
  Sparkles,
  Video,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { BRAND_ASSETS } from '../data/seedData';
import { CategoryIcon, ProductCard, ShopCard } from '../components/SharedUI';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { getLocalizedNeighborhood } from '../constants/translations';
import { filterAndSortProducts, HAWASSA_NEIGHBORHOODS } from '../utils/marketplaceLogic';

export const HomeScreen: React.FC = () => {
  const {
    navigate,
    t,
    language,
    selectedNeighborhood,
    setSelectedNeighborhood,
    userLocation,
    detectingLocation,
    detectUserLocation,
    proximityRankings,
    shopDistanceById,
    nearbyDeals,
    nearbyAlertsEnabled,
    toggleNearbyAlerts,
    triggerNearbyDiscountAlert,
    unreadNotificationCount,
    categories,
    shops,
    shopsById,
    products,
    governanceConfig,
  } = useMarketplace();

  const [productSort, setProductSort] = useState<'newest' | 'nearest'>(() =>
    userLocation?.source === 'gps' ? 'nearest' : 'newest'
  );
  const [togglingAlerts, setTogglingAlerts] = useState(false);

  const approvedShops = governanceConfig.strictShopVerification
    ? shops.filter((s) => s.status === 'approved')
    : shops.filter((s) => s.status !== 'suspended');

  const activeProducts = filterAndSortProducts(products, shopsById, {
    neighborhood: selectedNeighborhood === 'All Hawassa' ? 'all' : selectedNeighborhood,
    strictShopVerification: governanceConfig.strictShopVerification,
    sortBy: productSort,
    shopDistanceById,
  });

  const displayProducts =
    activeProducts.length > 0
      ? activeProducts
      : filterAndSortProducts(products, shopsById, {
          strictShopVerification: governanceConfig.strictShopVerification,
          sortBy: productSort,
          shopDistanceById,
        });

  const handleDetectLocation = async () => {
    await detectUserLocation();
    setProductSort('nearest');
  };

  const handleToggleAlerts = async () => {
    setTogglingAlerts(true);
    try {
      await toggleNearbyAlerts();
    } finally {
      setTogglingAlerts(false);
    }
  };

  const locationSummary =
    userLocation?.source === 'gps'
      ? t('liveGpsLabel', {
          neighborhood: getLocalizedNeighborhood(userLocation.neighborhood, language),
        })
      : selectedNeighborhood !== 'All Hawassa'
      ? t('locationUsingNeighborhood', {
          neighborhood: getLocalizedNeighborhood(selectedNeighborhood, language),
        })
      : t('locationUsingCenter');

  const getCategoryLabel = (cat: (typeof categories)[number]) => {
    if (language === 'am') return cat.nameAm;
    if (language === 'om') return cat.nameOm;
    if (language === 'sid') return cat.nameSid || cat.name;
    return cat.name;
  };

  return (
    <div className="pb-6">
      {/* Compact Sticky App Header */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#1C2420]/95 backdrop-blur-md border-b border-[#E7E5E4] dark:border-[#2A3630] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={BRAND_ASSETS.logo}
              alt="Affin Connect"
              className="w-9 h-9 rounded-xl object-cover border border-[#E7E5E4] dark:border-[#2A3630] shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-display font-bold text-[#047857] dark:text-[#10B981] truncate">
                {t('appName')}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-stone-600 dark:text-stone-400">
                <MapPin className="w-3 h-3 text-[#047857] dark:text-[#10B981] shrink-0" />
                <select
                  aria-label="Filter by Hawassa Neighborhood"
                  value={selectedNeighborhood}
                  onChange={(e) => setSelectedNeighborhood(e.target.value)}
                  className="appearance-none bg-transparent font-medium text-stone-700 dark:text-stone-300 focus:outline-none pr-1 truncate cursor-pointer"
                >
                  <option value="All Hawassa" className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100">{t('hawassaAllAreas')}</option>
                  {HAWASSA_NEIGHBORHOODS.map((n) => (
                    <option key={n} value={n} className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100">
                      Hawassa · {getLocalizedNeighborhood(n, language)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-stone-400 dark:text-stone-500 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeSwitcher variant="compact" />
            <LanguageSwitcher variant="compact" />

            <button
              type="button"
              onClick={() => navigate({ name: 'notifications' })}
              aria-label={t('notifications')}
              className="relative min-w-[44px] min-h-[44px] rounded-xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] hover:bg-[#ECFDF5] dark:hover:bg-[#10B981]/10 flex items-center justify-center text-stone-700 dark:text-stone-200 transition-colors shrink-0"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#D97706] text-white dark:bg-[#F59E0B] dark:text-[#141A17] text-[10px] font-bold flex items-center justify-center tabular-nums shadow-xs">
                  {unreadNotificationCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search Bar Trigger */}
        <button
          type="button"
          onClick={() => navigate({ name: 'search' })}
          className="mt-2.5 w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] hover:border-[#047857]/40 dark:hover:border-[#10B981]/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ECFDF5] dark:focus-visible:ring-[#10B981]/20 focus-visible:border-[#047857] dark:focus-visible:border-[#10B981] text-left flex items-center gap-2.5 text-stone-500 dark:text-stone-400 transition-all"
        >
          <Search className="w-4 h-4 text-[#047857] dark:text-[#10B981] shrink-0" />
          <span className="text-xs truncate">{t('searchPlaceholder')}</span>
        </button>
      </header>

      <div className="px-4 pt-3.5 space-y-5">
        {governanceConfig.orderingPaused && (
          <div className="p-3 rounded-2xl bg-[#FFF7ED] dark:bg-[#C2410C]/20 border border-[#C2410C]/20 dark:border-[#FB923C]/30 text-xs text-[#C2410C] dark:text-[#FB923C] font-medium">
            {governanceConfig.maintenanceBanner?.trim() || t('governanceOrderingPaused')}
          </div>
        )}

        {/* Neighborhood Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 mobile-scroll" aria-label={t('selectNeighborhood')}>
          <button
            type="button"
            onClick={() => setSelectedNeighborhood('All Hawassa')}
            className={`px-3 py-1.5 rounded-xl text-xs whitespace-nowrap shrink-0 border transition-colors ${
              selectedNeighborhood === 'All Hawassa'
                ? 'bg-[#ECFDF5] text-[#047857] border-[#047857]/30 dark:bg-[#10B981]/15 dark:text-[#10B981] dark:border-[#10B981]/30 font-semibold'
                : 'bg-white dark:bg-[#1C2420] text-stone-600 dark:text-stone-300 border-[#E7E5E4] dark:border-[#2A3630] hover:border-[#047857]/30 dark:hover:border-[#10B981]/30'
            }`}
          >
            {t('allHawassaAreas')}
          </button>
          {HAWASSA_NEIGHBORHOODS.map((n) => {
            const active = selectedNeighborhood === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setSelectedNeighborhood(n)}
                className={`px-3 py-1.5 rounded-xl text-xs whitespace-nowrap shrink-0 border transition-colors ${
                  active
                    ? 'bg-[#ECFDF5] text-[#047857] border-[#047857]/30 dark:bg-[#10B981]/15 dark:text-[#10B981] dark:border-[#10B981]/30 font-semibold'
                    : 'bg-white dark:bg-[#1C2420] text-stone-600 dark:text-stone-300 border-[#E7E5E4] dark:border-[#2A3630] hover:border-[#047857]/30 dark:hover:border-[#10B981]/30'
                }`}
              >
                {getLocalizedNeighborhood(n, language)}
              </button>
            );
          })}
        </div>

        {/* One-Tap GPS Location & Nearby Discount Alerts Bar */}
        <section className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[#047857] dark:text-[#10B981] flex items-center gap-1.5 truncate">
                <Navigation className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{locationSummary}</span>
              </div>
              <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
                {t('nearbyActiveDealsCount', { count: nearbyDeals.length })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={detectingLocation}
              className="min-h-[44px] px-3.5 rounded-xl bg-gradient-to-r from-[#047857] to-[#059669] hover:from-[#065F46] hover:to-[#047857] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-xs transition-all disabled:opacity-70"
            >
              {detectingLocation ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Navigation className="w-4 h-4 shrink-0" />
              )}
              <span>{detectingLocation ? t('detectingLocation') : t('detectMyLocation')}</span>
            </button>
          </div>

          <div className="pt-2.5 border-t border-[#E7E5E4]/80 dark:border-[#2A3630] flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleToggleAlerts}
              disabled={togglingAlerts}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                nearbyAlertsEnabled
                  ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 border-[#047857]/30 dark:border-[#10B981]/40 text-[#047857] dark:text-[#10B981]'
                  : 'bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border-[#FDE68A] dark:border-[#F59E0B]/30 text-[#92400E] dark:text-[#F59E0B] hover:bg-[#FEF3C7] dark:hover:bg-[#F59E0B]/20'
              }`}
            >
              <BellRing className="w-3.5 h-3.5 shrink-0" />
              <span>
                {nearbyAlertsEnabled ? t('nearbyAlertsEnabledBadge') : t('enableNearbyAlertsBtn')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void triggerNearbyDiscountAlert({ isTest: true, forceNotify: true })}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] hover:border-[#047857]/40 dark:hover:border-[#10B981]/40 text-[11px] font-semibold text-stone-700 dark:text-stone-200 flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B] shrink-0" />
              <span>{t('testNearbyAlertBtn')}</span>
            </button>
          </div>
        </section>

        {/* Nearest Shops For You Carousel */}
        {proximityRankings.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#047857] dark:text-[#10B981]" />
                <span>{t('nearestShopsForYou')}</span>
              </h2>
              <button
                type="button"
                onClick={() => navigate({ name: 'map' })}
                className="text-xs font-semibold text-[#047857] dark:text-[#10B981] hover:underline py-1"
              >
                {t('liveMap')}
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 mobile-scroll">
              {proximityRankings.map((item) => (
                <ShopCard
                  key={`nearest-${item.shop.shopId}`}
                  shop={item.shop}
                  highlightNearest={item.isNearestForUser}
                />
              ))}
            </div>
          </section>
        )}

        {/* Hero Marketplace Banner */}
        <section className="relative rounded-2xl overflow-hidden bg-[#065F46] dark:bg-[#1C2420] text-white shadow-sm border border-[#E7E5E4] dark:border-[#2A3630]">
          <img
            src={BRAND_ASSETS.banner}
            alt="Hawassa Local Marketplace"
            className="w-full h-48 object-cover object-[center_42%] opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 flex flex-col justify-end">
            <h2 className="text-lg font-display font-bold leading-snug text-balance">
              {t('heroTitle')}
            </h2>
            <p className="text-xs text-stone-200 mt-0.5">
              {t('heroSubtitle')}
            </p>
          </div>
        </section>

        {/* Smart Hawassa Tools Strip */}
        <section className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => navigate({ name: 'map' })}
            className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] p-3 flex flex-col items-start gap-1.5 shadow-sm hover:shadow-md hover:border-[#047857]/40 dark:hover:border-[#10B981]/40 transition-all text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-tight">{t('liveMap')}</div>
            <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-tight">{t('shopsAndPlaces')}</div>
          </button>

          <button
            type="button"
            onClick={() => navigate({ name: 'chat' })}
            className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] p-3 flex flex-col items-start gap-1.5 shadow-sm hover:shadow-md hover:border-[#047857]/40 dark:hover:border-[#10B981]/40 transition-all text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-[#FFF7ED] dark:bg-[#F59E0B]/15 text-[#D97706] dark:text-[#F59E0B] flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-tight">{t('aiConcierge')}</div>
            <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-tight">{t('shopAssistant')}</div>
          </button>

          <button
            type="button"
            onClick={() => navigate({ name: 'video' })}
            className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] p-3 flex flex-col items-start gap-1.5 shadow-sm hover:shadow-md hover:border-[#047857]/40 dark:hover:border-[#10B981]/40 transition-all text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] flex items-center justify-center">
              <Video className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-tight">{t('videoStudioShort')}</div>
            <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-tight">{t('photoReels')}</div>
          </button>
        </section>

        {/* Categories Horizontal Strip */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">{t('categories')}</h2>
            <button
              type="button"
              onClick={() => navigate({ name: 'categories' })}
              className="text-xs font-semibold text-[#047857] dark:text-[#10B981] hover:underline py-1"
            >
              {t('viewAll')}
            </button>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 mobile-scroll">
            {categories
              .filter((c) => c.isActive)
              .map((cat) => (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => navigate({ name: 'search', initialCategory: cat.slug })}
                  className="shrink-0 w-20 flex flex-col items-center gap-1.5 group"
                >
                  <div className="w-13 h-13 rounded-2xl bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] shadow-xs flex items-center justify-center text-[#047857] dark:text-[#10B981] group-hover:bg-[#ECFDF5] dark:group-hover:bg-[#10B981]/15 group-hover:border-[#047857]/40 dark:group-hover:border-[#10B981]/40 transition-all">
                    <CategoryIcon iconName={cat.iconName} className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium text-stone-700 dark:text-stone-300 text-center line-clamp-2 leading-tight">
                    {getCategoryLabel(cat)}
                  </span>
                </button>
              ))}
          </div>
        </section>

        {/* Featured Shops in Hawassa */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">{t('featuredShops')}</h2>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
              {t('verifiedCount', { count: approvedShops.length })}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 mobile-scroll">
            {approvedShops.map((shop) => (
              <ShopCard key={shop.shopId} shop={shop} />
            ))}
          </div>
        </section>

        {/* Popular Products Grid with Nearest-First Sort Toggle */}
        <section>
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">{t('popularProducts')}</h2>
              {selectedNeighborhood !== 'All Hawassa' && activeProducts.length === 0 && (
                <p className="text-[11px] text-[#C2410C] dark:text-[#FB923C] mt-0.5">
                  {t('noNeighborhoodListings', {
                    neighborhood: getLocalizedNeighborhood(selectedNeighborhood, language),
                  })}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setProductSort((prev) => (prev === 'nearest' ? 'newest' : 'nearest'))}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                  productSort === 'nearest'
                    ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] border-[#047857]/30 dark:border-[#10B981]/40'
                    : 'bg-white dark:bg-[#1C2420] text-stone-600 dark:text-stone-300 border-[#E7E5E4] dark:border-[#2A3630] hover:border-[#047857]/30'
                }`}
              >
                <Navigation className="w-3 h-3 shrink-0" />
                <span>{t('sortByNearestFirst')}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate({ name: 'search' })}
                className="text-xs font-semibold text-[#047857] dark:text-[#10B981] hover:underline py-1"
              >
                {t('viewAll')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {displayProducts.map((product) => (
              <ProductCard key={product.productId} product={product} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
