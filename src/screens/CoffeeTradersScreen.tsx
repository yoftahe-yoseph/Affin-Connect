import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Check,
  Coffee,
  Flame,
  Heart,
  MapPin,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  Store,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { ResilientImage } from '../components/SharedUI';
import { getLocalizedNeighborhood } from '../constants/translations';
import {
  COFFEE_BEAN_FORMS,
  COFFEE_ROAST_LEVELS,
  extractCoffeeFilterOptions,
  filterCoffeeProducts,
  formatCoffeeBeanForm,
  formatCoffeeProcessMethod,
  formatCoffeeRoastLevel,
  formatETB,
  getCoffeeTraderListings,
  getProductCoffeeOrigin,
  isCoffeeProduct,
  isVerifiedMerchantShop,
} from '../utils/marketplaceLogic';
import type { CoffeeBeanForm, CoffeeRoastLevel, Product } from '../types';

export const CoffeeTradersScreen: React.FC<{ initialShopId?: string }> = ({
  initialShopId,
}) => {
  const {
    navigate,
    t,
    language,
    shops,
    shopsById,
    products,
    cart,
    favorites,
    toggleFavorite,
    addToCart,
    authLoading,
    canAccessSeller,
    governanceConfig,
    refreshCatalogFromFirestore,
  } = useMarketplace();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedRoast, setSelectedRoast] = useState<CoffeeRoastLevel | 'all'>('all');
  const [selectedWeight, setSelectedWeight] = useState<string>('all');
  const [selectedBeanForm, setSelectedBeanForm] = useState<CoffeeBeanForm | 'all'>('all');
  const [selectedShopId, setSelectedShopId] = useState<string>(initialShopId || 'all');
  const [minPriceInput, setMinPriceInput] = useState<string>('');
  const [maxPriceInput, setMaxPriceInput] = useState<string>('');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'rating' | 'newest'>(
    'featured'
  );
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  const cartCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  // Base set of real active coffee products (unfiltered) to power real filter dropdowns
  const allActiveCoffeeProducts = useMemo(
    () =>
      products.filter((p) => {
        if (p.status !== 'active' || !isCoffeeProduct(p)) return false;
        const shop = shopsById[p.shopId];
        if (shop?.status === 'suspended') return false;
        if (governanceConfig.strictShopVerification && shop && shop.status !== 'approved') {
          return false;
        }
        return true;
      }),
    [products, shopsById, governanceConfig.strictShopVerification]
  );

  const filterOptions = useMemo(
    () => extractCoffeeFilterOptions(allActiveCoffeeProducts, shopsById),
    [allActiveCoffeeProducts, shopsById]
  );

  const coffeeTraders = useMemo(
    () =>
      getCoffeeTraderListings(shops, products, {
        strictShopVerification: governanceConfig.strictShopVerification,
        searchQuery,
      }),
    [shops, products, governanceConfig.strictShopVerification, searchQuery]
  );

  const allCoffeeTradersCount = useMemo(
    () =>
      getCoffeeTraderListings(shops, products, {
        strictShopVerification: governanceConfig.strictShopVerification,
      }).length,
    [shops, products, governanceConfig.strictShopVerification]
  );

  const parsePrice = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const filteredCoffeeProducts = useMemo(
    () =>
      filterCoffeeProducts(products, shopsById, {
        searchQuery,
        origin: selectedOrigin,
        brand: selectedBrand,
        roastLevel: selectedRoast,
        packageWeight: selectedWeight,
        beanForm: selectedBeanForm,
        shopId: selectedShopId,
        minPrice: parsePrice(minPriceInput),
        maxPrice: parsePrice(maxPriceInput),
        sortBy,
        strictShopVerification: governanceConfig.strictShopVerification,
      }),
    [
      products,
      shopsById,
      searchQuery,
      selectedOrigin,
      selectedBrand,
      selectedRoast,
      selectedWeight,
      selectedBeanForm,
      selectedShopId,
      minPriceInput,
      maxPriceInput,
      sortBy,
      governanceConfig.strictShopVerification,
    ]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedOrigin !== 'all') count += 1;
    if (selectedBrand !== 'all') count += 1;
    if (selectedRoast !== 'all') count += 1;
    if (selectedWeight !== 'all') count += 1;
    if (selectedBeanForm !== 'all') count += 1;
    if (selectedShopId !== 'all') count += 1;
    if (minPriceInput.trim() || maxPriceInput.trim()) count += 1;
    if (sortBy !== 'featured') count += 1;
    return count;
  }, [
    selectedOrigin,
    selectedBrand,
    selectedRoast,
    selectedWeight,
    selectedBeanForm,
    selectedShopId,
    minPriceInput,
    maxPriceInput,
    sortBy,
  ]);

  const hasAnyFiltersOrSearch = activeFilterCount > 0 || searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedOrigin('all');
    setSelectedBrand('all');
    setSelectedRoast('all');
    setSelectedWeight('all');
    setSelectedBeanForm('all');
    setSelectedShopId('all');
    setMinPriceInput('');
    setMaxPriceInput('');
    setSortBy('featured');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      await refreshCatalogFromFirestore();
    } catch (err) {
      setRefreshError(
        err instanceof Error ? err.message : t('coffeeLoadErrorTitle')
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleQuickAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (!product.isAvailable || product.stock <= 0) return;
    addToCart(product, 1);
    setRecentlyAddedId(product.productId);
    window.setTimeout(() => {
      setRecentlyAddedId((curr) => (curr === product.productId ? null : curr));
    }, 1500);
  };

  const selectedShopObj =
    selectedShopId !== 'all' ? shopsById[selectedShopId] : undefined;

  return (
    <div className="min-h-full bg-[#031719] text-[#F8F4EE] pb-10">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-20 bg-[#1B110E]/95 backdrop-blur-md border-b border-[#C68B59]/25 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate({ name: 'home' })}
            aria-label={t('coffeeBackToMarketplace')}
            className="min-h-[42px] px-2.5 rounded-xl bg-[#4B2E24]/70 border border-[#C68B59]/35 hover:border-[#C68B59] text-[#F8F4EE] flex items-center gap-1.5 text-xs font-semibold transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-[#C68B59] shrink-0" />
            <span className="hidden xs:inline sm:inline">{t('coffeeBackToMarketplace')}</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C68B59] to-[#8C5530] text-[#1B110E] flex items-center justify-center shadow-sm shrink-0">
              <Coffee className="w-4 h-4 stroke-[2.25]" />
            </div>
            <h1 className="text-sm font-display font-bold text-[#F8F4EE] truncate">
              {t('coffeeTradersTitle')}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh coffee marketplace"
              className="min-w-[40px] min-h-[40px] rounded-xl bg-[#2A1A15] border border-[#C68B59]/25 hover:border-[#C68B59]/60 text-[#F8F4EE] flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 text-[#C68B59] ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>

            <button
              type="button"
              onClick={() => navigate({ name: 'cart' })}
              aria-label={t('cart')}
              className="relative min-w-[40px] min-h-[40px] rounded-xl bg-[#2A1A15] border border-[#C68B59]/25 hover:border-[#00D68F]/60 text-[#F8F4EE] flex items-center justify-center transition-colors"
            >
              <ShoppingBag className="w-4 h-4 text-[#00D68F]" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#00D68F] text-[#031719] text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-5">
        {/* Warm Ethiopian Coffee Editorial Banner */}
        <section
          aria-label={t('coffeeTradersHeroTitle')}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4B2E24] via-[#311D17] to-[#1A100D] border border-[#C68B59]/40 p-4 shadow-lg shadow-black/35"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full bg-[#C68B59]/20 blur-2xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#F8F4EE]/30 to-transparent"
          />

          <div className="relative z-10 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#C68B59]">
                  <Coffee className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('coffeeTradersBadge')}</span>
                </div>
                <h2 className="text-base font-display font-bold text-[#F8F4EE] leading-snug">
                  {t('coffeeTradersHeroTitle')}
                </h2>
                <p className="text-xs text-[#F8F4EE]/80 leading-relaxed">
                  {t('coffeeTradersHeroSubtitle')}
                </p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1.5 text-[11px] font-semibold tabular-nums">
                <span className="px-2.5 py-1 rounded-lg bg-[#1A100D]/70 border border-[#C68B59]/35 text-[#F8F4EE]">
                  {t('coffeeTradersCountLabel', { count: allCoffeeTradersCount })}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#C68B59]/15 border border-[#C68B59]/35 text-[#F3D9BF]">
                  {t('coffeeLotsCountLabel', { count: allActiveCoffeeProducts.length })}
                </span>
              </div>
            </div>

            {/* Coffee Search Input */}
            <div className="relative">
              <Search
                aria-hidden="true"
                className="w-4 h-4 text-[#C68B59] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('coffeeSearchPlaceholder')}
                aria-label={t('coffeeSearchPlaceholder')}
                className="w-full min-h-[44px] pl-10 pr-9 rounded-xl bg-[#160D0A]/90 border border-[#C68B59]/35 text-xs text-[#F8F4EE] placeholder:text-[#D5C3B3]/65 focus:outline-none focus:border-[#C68B59] focus:ring-2 focus:ring-[#C68B59]/25 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear coffee search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#D5C3B3] hover:text-[#F8F4EE]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Error Banner */}
        {refreshError && (
          <div
            role="alert"
            className="rounded-2xl bg-rose-950/60 border border-rose-500/40 p-3.5 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-rose-100">
                  {t('coffeeLoadErrorTitle')}
                </div>
                <p className="text-[11px] text-rose-200/85 truncate">{refreshError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="min-h-[36px] px-3 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-100 text-[11px] font-semibold shrink-0 hover:bg-rose-500/30"
            >
              {t('coffeeLoadErrorRetry')}
            </button>
          </div>
        )}

        {/* Section 1: Coffee Traders Directory */}
        <section aria-labelledby="coffee-traders-dir-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2
              id="coffee-traders-dir-heading"
              className="text-sm font-bold text-[#F8F4EE] flex items-center gap-1.5"
            >
              <Store className="w-4 h-4 text-[#C68B59] shrink-0" />
              <span>{t('coffeeTradersDirectoryTitle')}</span>
            </h2>
            {selectedShopObj && (
              <button
                type="button"
                onClick={() => setSelectedShopId('all')}
                className="text-[11px] font-semibold text-[#C68B59] hover:text-[#F8F4EE] flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>{t('coffeeFilterAll')}</span>
              </button>
            )}
          </div>

          {authLoading && coffeeTraders.length === 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-1 mobile-scroll">
              {Array.from({ length: 2 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-64 h-40 rounded-2xl bg-[#241612] border border-[#C68B59]/20 animate-pulse shrink-0"
                />
              ))}
            </div>
          ) : coffeeTraders.length === 0 ? (
            <div className="rounded-2xl bg-[#1F1410] border border-[#C68B59]/25 p-5 text-center space-y-2">
              <Coffee className="w-6 h-6 text-[#C68B59] mx-auto" />
              <div className="text-xs font-bold text-[#F8F4EE]">
                {allCoffeeTradersCount === 0
                  ? t('coffeeEmptyNoCatalogTitle')
                  : t('coffeeEmptyTitle')}
              </div>
              <p className="text-[11px] text-[#D5C3B3] leading-relaxed">
                {allCoffeeTradersCount === 0
                  ? t('coffeeEmptyNoCatalogDesc')
                  : t('coffeeEmptyDesc')}
              </p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1.5 mobile-scroll">
              {coffeeTraders.map((listing) => {
                const { shop, coffeeProducts, minPrice, origins, isVerified } = listing;
                const isSelected = selectedShopId === shop.shopId;
                return (
                  <article
                    key={shop.shopId}
                    className={`w-[272px] shrink-0 rounded-2xl p-3.5 border transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#4B2E24] to-[#281812] border-[#C68B59] shadow-lg shadow-black/40'
                        : 'bg-gradient-to-br from-[#271813] to-[#170F0C] border-[#C68B59]/25 hover:border-[#C68B59]/60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#120B09] border border-[#C68B59]/35 shrink-0">
                        <ResilientImage
                          src={shop.logoUrl}
                          alt={shop.name}
                          fallbackTitle={shop.name}
                          darkSurface
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1">
                          <h3 className="text-xs font-bold text-[#F8F4EE] truncate">
                            {shop.name}
                          </h3>
                          {isVerified && (
                            <BadgeCheck
                              className="w-3.5 h-3.5 text-[#00D68F] shrink-0"
                              aria-label={t('verifiedMerchantLabel')}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#D5C3B3] truncate">
                          <MapPin className="w-3 h-3 text-[#C68B59] shrink-0" />
                          <span className="truncate">
                            {getLocalizedNeighborhood(shop.neighborhood, language)}, {shop.city}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] tabular-nums">
                          {shop.reviewCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[#F8F4EE] font-semibold">
                              <Star className="w-3 h-3 fill-[#C68B59] text-[#C68B59]" />
                              {shop.rating.toFixed(1)}
                              <span className="text-[#D5C3B3] font-normal">
                                ({shop.reviewCount})
                              </span>
                            </span>
                          )}
                          {minPrice !== null && (
                            <span className="text-[#00D68F] font-semibold">
                              {t('coffeeFromPrice', { price: formatETB(minPrice) })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {origins.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {origins.slice(0, 3).map((origin) => (
                          <span
                            key={origin}
                            className="px-2 py-0.5 rounded-md bg-[#4B2E24]/70 border border-[#C68B59]/30 text-[10px] font-medium text-[#F3D9BF]"
                          >
                            {origin}
                          </span>
                        ))}
                        <span className="px-2 py-0.5 rounded-md bg-[#092825]/80 border border-[#14443F] text-[10px] font-medium text-[#A9C0BD] tabular-nums">
                          {t('coffeeLotsCountLabel', { count: coffeeProducts.length })}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedShopId((curr) =>
                            curr === shop.shopId ? 'all' : shop.shopId
                          )
                        }
                        className={`min-h-[36px] px-2.5 rounded-xl text-[11px] font-semibold transition-colors ${
                          isSelected
                            ? 'bg-[#C68B59] text-[#1B110E]'
                            : 'bg-[#4B2E24]/80 hover:bg-[#4B2E24] text-[#F8F4EE] border border-[#C68B59]/35'
                        }`}
                      >
                        {isSelected ? t('coffeeFilterAll') : t('coffeeFilterByTrader')}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate({ name: 'shop', shopId: shop.shopId })}
                        className="min-h-[36px] px-2.5 rounded-xl bg-[#092825] hover:bg-[#0D3833] border border-[#14443F] text-[#F5FAFA] text-[11px] font-semibold transition-colors"
                      >
                        {t('coffeeVisitTrader')}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 2: Quick Filter Bar & Expandable Coffee Filters */}
        <section aria-label={t('coffeeFiltersButton')} className="space-y-2.5">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mobile-scroll">
            <button
              type="button"
              onClick={() => setFiltersExpanded((v) => !v)}
              aria-expanded={filtersExpanded}
              className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
                filtersExpanded || activeFilterCount > 0
                  ? 'bg-[#4B2E24] border-[#C68B59] text-[#F8F4EE]'
                  : 'bg-[#1D120E] border-[#C68B59]/30 text-[#D5C3B3] hover:text-[#F8F4EE]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#C68B59]" />
              <span>{t('coffeeFiltersButton')}</span>
              {activeFilterCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#C68B59] text-[#1B110E] text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Quick Bean Form Toggle Buttons */}
            {COFFEE_BEAN_FORMS.map((form) => {
              const active = selectedBeanForm === form.value;
              return (
                <button
                  key={form.value}
                  type="button"
                  onClick={() =>
                    setSelectedBeanForm((curr) =>
                      curr === form.value ? 'all' : form.value
                    )
                  }
                  className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold shrink-0 transition-colors ${
                    active
                      ? 'bg-[#C68B59] border-[#C68B59] text-[#1B110E]'
                      : 'bg-[#1D120E] border-[#C68B59]/25 text-[#D5C3B3] hover:border-[#C68B59]/60'
                  }`}
                >
                  {form.value === 'whole_bean' ? t('coffeeWholeBeans') : t('coffeeGround')}
                </button>
              );
            })}

            {/* Quick Origin Filter Buttons (Real Origins from Live Data) */}
            {filterOptions.origins.slice(0, 4).map((origin) => {
              const active = selectedOrigin === origin;
              return (
                <button
                  key={origin}
                  type="button"
                  onClick={() =>
                    setSelectedOrigin((curr) => (curr === origin ? 'all' : origin))
                  }
                  className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold shrink-0 transition-colors ${
                    active
                      ? 'bg-[#C68B59] border-[#C68B59] text-[#1B110E]'
                      : 'bg-[#1D120E] border-[#C68B59]/25 text-[#D5C3B3] hover:border-[#C68B59]/60'
                  }`}
                >
                  {origin}
                </button>
              );
            })}

            {hasAnyFiltersOrSearch && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[38px] px-3 rounded-xl border border-rose-500/35 bg-rose-950/40 text-rose-200 text-xs font-semibold flex items-center gap-1 shrink-0 hover:bg-rose-950/70"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('coffeeResetFilters')}</span>
              </button>
            )}
          </div>

          {/* Expandable Full Filter Panel */}
          {filtersExpanded && (
            <div className="rounded-2xl bg-[#1D120E] border border-[#C68B59]/35 p-3.5 space-y-3 shadow-lg shadow-black/30">
              <div className="grid grid-cols-2 gap-2.5">
                {/* Origin */}
                <label className="space-y-1 text-[11px] font-semibold text-[#D5C3B3]">
                  <span>{t('coffeeFilterOrigin')}</span>
                  <select
                    value={selectedOrigin}
                    onChange={(e) => setSelectedOrigin(e.target.value)}
                    className="w-full min-h-[40px] px-2.5 rounded-xl bg-[#120B09] border border-[#C68B59]/30 text-xs text-[#F8F4EE] focus:outline-none focus:border-[#C68B59]"
                  >
                    <option value="all">{t('coffeeFilterAll')}</option>
                    {filterOptions.origins.map((origin) => (
                      <option key={origin} value={origin}>
                        {origin}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Brand */}
                <label className="space-y-1 text-[11px] font-semibold text-[#D5C3B3]">
                  <span>{t('coffeeFilterBrand')}</span>
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="w-full min-h-[40px] px-2.5 rounded-xl bg-[#120B09] border border-[#C68B59]/30 text-xs text-[#F8F4EE] focus:outline-none focus:border-[#C68B59]"
                  >
                    <option value="all">{t('coffeeFilterAll')}</option>
                    {filterOptions.brands.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Roast Level */}
                <label className="space-y-1 text-[11px] font-semibold text-[#D5C3B3]">
                  <span>{t('coffeeFilterRoast')}</span>
                  <select
                    value={selectedRoast}
                    onChange={(e) =>
                      setSelectedRoast(e.target.value as CoffeeRoastLevel | 'all')
                    }
                    className="w-full min-h-[40px] px-2.5 rounded-xl bg-[#120B09] border border-[#C68B59]/30 text-xs text-[#F8F4EE] focus:outline-none focus:border-[#C68B59]"
                  >
                    <option value="all">{t('coffeeFilterAll')}</option>
                    {COFFEE_ROAST_LEVELS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Package Size */}
                <label className="space-y-1 text-[11px] font-semibold text-[#D5C3B3]">
                  <span>{t('coffeeFilterWeight')}</span>
                  <select
                    value={selectedWeight}
                    onChange={(e) => setSelectedWeight(e.target.value)}
                    className="w-full min-h-[40px] px-2.5 rounded-xl bg-[#120B09] border border-[#C68B59]/30 text-xs text-[#F8F4EE] focus:outline-none focus:border-[#C68B59]"
                  >
                    <option value="all">{t('coffeeFilterAll')}</option>
                    {filterOptions.weights.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Bean Form */}
                <label className="space-y-1 text-[11px] font-semibold text-[#D5C3B3]">
                  <span>{t('coffeeFilterForm')}</span>
                  <select
                    value={selectedBeanForm}
                    onChange={(e) =>
                      setSelectedBeanForm(e.target.value as CoffeeBeanForm | 'all')
                    }
                    className="w-full min-h-[40px] px-2.5 rounded-xl bg-[#120B09] border border-[#C68B59]/30 text-xs text-[#F8F4EE] focus:outline-none focus:border-[#C68B59]"
                  >
                    <option value="all">{t('coffeeFilterAll')}</option>
                    {COFFEE_BEAN_FORMS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.value === 'whole_bean'
                          ? t('coffeeWholeBeans')
                          : t('coffeeGround')}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Seller */}
                <label className="space-y-1 text-[11px] font-semibold text-[#D5C3B3]">
                  <span>{t('coffeeFilterSeller')}</span>
                  <select
                    value={selectedShopId}
                    onChange={(e) => setSelectedShopId(e.target.value)}
                    className="w-full min-h-[40px] px-2.5 rounded-xl bg-[#120B09] border border-[#C68B59]/30 text-xs text-[#F8F4EE] focus:outline-none focus:border-[#C68B59]"
                  >
                    <option value="all">{t('coffeeFilterAll')}</option>
                    {filterOptions.sellers.map((s) => (
                      <option key={s.shopId} value={s.shopId}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Price Range + Sort */}
              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1 text-[11px] font-semibold text-[#D5C3B3]">
                  <span>Min ETB</span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={minPriceInput}
                    onChange={(e) => setMinPriceInput(e.target.value)}
                    placeholder="0"
                    className="w-full min-h-[40px] px-2.5 rounded-xl bg-[#120B09] border border-[#C68B59]/30 text-xs tabular-nums text-[#F8F4EE] focus:outline-none focus:border-[#C68B59]"
                  />
                </label>
                <label className="space-y-1 text-[11px] font-semibold text-[#D5C3B3]">
                  <span>Max ETB</span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={maxPriceInput}
                    onChange={(e) => setMaxPriceInput(e.target.value)}
                    placeholder="5000"
                    className="w-full min-h-[40px] px-2.5 rounded-xl bg-[#120B09] border border-[#C68B59]/30 text-xs tabular-nums text-[#F8F4EE] focus:outline-none focus:border-[#C68B59]"
                  />
                </label>
                <label className="space-y-1 text-[11px] font-semibold text-[#D5C3B3]">
                  <span>Sort</span>
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(
                        e.target.value as
                          | 'featured'
                          | 'price_asc'
                          | 'price_desc'
                          | 'rating'
                          | 'newest'
                      )
                    }
                    className="w-full min-h-[40px] px-2 rounded-xl bg-[#120B09] border border-[#C68B59]/30 text-xs text-[#F8F4EE] focus:outline-none focus:border-[#C68B59]"
                  >
                    <option value="featured">Featured</option>
                    <option value="price_asc">Price ↑</option>
                    <option value="price_desc">Price ↓</option>
                    <option value="rating">Top Rated</option>
                    <option value="newest">Newest</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </section>

        {/* Section 3: Coffee Products Grid */}
        <section aria-labelledby="coffee-products-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2
              id="coffee-products-heading"
              className="text-sm font-bold text-[#F8F4EE] truncate"
            >
              {selectedShopObj
                ? t('coffeeShowingTrader', { name: selectedShopObj.name })
                : t('coffeeProductsSectionTitle')}
            </h2>
            <span className="text-[11px] font-semibold text-[#C68B59] tabular-nums shrink-0">
              {filteredCoffeeProducts.length}
            </span>
          </div>

          {authLoading && filteredCoffeeProducts.length === 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-64 rounded-2xl bg-[#1F1410] border border-[#C68B59]/20 animate-pulse"
                />
              ))}
            </div>
          ) : filteredCoffeeProducts.length === 0 ? (
            <div className="rounded-2xl bg-[#1D120E] border border-[#C68B59]/30 p-6 text-center space-y-3">
              <Coffee className="w-7 h-7 text-[#C68B59] mx-auto" />
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-[#F8F4EE]">
                  {allActiveCoffeeProducts.length === 0
                    ? t('coffeeEmptyNoCatalogTitle')
                    : t('coffeeEmptyTitle')}
                </h3>
                <p className="text-[11px] text-[#D5C3B3] leading-relaxed">
                  {allActiveCoffeeProducts.length === 0
                    ? t('coffeeEmptyNoCatalogDesc')
                    : t('coffeeEmptyDesc')}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {hasAnyFiltersOrSearch && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="min-h-[40px] px-4 rounded-xl bg-[#C68B59] text-[#1B110E] text-xs font-bold"
                  >
                    {t('coffeeResetFilters')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate({ name: 'home' })}
                  className="min-h-[40px] px-4 rounded-xl bg-[#092825] border border-[#14443F] text-[#F5FAFA] text-xs font-semibold"
                >
                  {t('coffeeBackToMarketplace')}
                </button>
                {canAccessSeller && allActiveCoffeeProducts.length === 0 && (
                  <button
                    type="button"
                    onClick={() => navigate({ name: 'seller', tab: 'products' })}
                    className="min-h-[40px] px-4 rounded-xl bg-[#4B2E24] border border-[#C68B59]/40 text-[#F8F4EE] text-xs font-semibold"
                  >
                    {t('sellerPortalShort')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredCoffeeProducts.map((product) => {
                const shop = shopsById[product.shopId];
                const isVerified = shop ? isVerifiedMerchantShop(shop) : false;
                const isFav = favorites.includes(product.productId);
                const unavailable = !product.isAvailable || product.stock <= 0;
                const origin = getProductCoffeeOrigin(product);
                const roastLabel = formatCoffeeRoastLevel(product.coffeeDetails?.roastLevel);
                const processLabel = formatCoffeeProcessMethod(
                  product.coffeeDetails?.processingMethod
                );
                const formLabel = formatCoffeeBeanForm(product.coffeeDetails?.beanForm);
                const weightLabel = product.coffeeDetails?.packageWeight;
                const roastDate = product.coffeeDetails?.roastDate;
                const justAdded = recentlyAddedId === product.productId;

                return (
                  <article
                    key={product.productId}
                    onClick={() =>
                      navigate({ name: 'product', productId: product.productId })
                    }
                    className="group cursor-pointer rounded-2xl bg-gradient-to-b from-[#231611] to-[#130D0B] border border-[#C68B59]/25 hover:border-[#C68B59]/65 overflow-hidden flex flex-col shadow-md shadow-black/30 transition-all"
                  >
                    {/* Product Image */}
                    <div className="relative aspect-[4/3] bg-[#0F0907] overflow-hidden">
                      <ResilientImage
                        src={product.imageUrl}
                        alt={product.name}
                        fallbackTitle={product.name}
                        darkSurface
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />

                      {origin && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[#1B110E]/85 backdrop-blur-sm border border-[#C68B59]/40 text-[10px] font-semibold text-[#F8F4EE] max-w-[70%] truncate">
                          {origin}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(product.productId);
                        }}
                        aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-[#1B110E]/80 backdrop-blur-sm border border-white/15 flex items-center justify-center text-[#F8F4EE] hover:border-[#C68B59]"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            isFav ? 'fill-rose-500 text-rose-500' : 'text-[#F8F4EE]'
                          }`}
                        />
                      </button>

                      {unavailable && (
                        <div className="absolute inset-0 bg-[#140B09]/75 flex items-center justify-center p-2">
                          <span className="px-2.5 py-1 rounded-lg bg-[#2A1713] border border-rose-500/40 text-rose-200 text-[10px] font-bold">
                            {t('coffeeUnavailableLabel')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
                      <div className="space-y-1.5">
                        <h3 className="text-xs font-bold text-[#F8F4EE] leading-snug line-clamp-2">
                          {product.name}
                        </h3>

                        {/* Trader name + verification ONLY when verified */}
                        <div className="flex items-center gap-1 text-[10px] text-[#D5C3B3] truncate">
                          <span className="truncate">{shop?.name ?? product.shopName}</span>
                          {isVerified && (
                            <BadgeCheck
                              className="w-3 h-3 text-[#00D68F] shrink-0"
                              aria-label={t('verifiedMerchantLabel')}
                            />
                          )}
                        </div>

                        {/* Real Coffee Specs (Roast, Form, Weight, Process) */}
                        {(roastLabel || formLabel || weightLabel || processLabel) && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {roastLabel && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#4B2E24]/75 text-[9.5px] font-medium text-[#F3D9BF]">
                                <Flame className="w-2.5 h-2.5 text-[#C68B59]" />
                                {roastLabel.replace(' Roast', '')}
                              </span>
                            )}
                            {formLabel && (
                              <span className="px-1.5 py-0.5 rounded bg-[#2B1B15] border border-[#C68B59]/25 text-[9.5px] font-medium text-[#D5C3B3]">
                                {formLabel === 'Whole Beans'
                                  ? t('coffeeWholeBeans')
                                  : t('coffeeGround')}
                              </span>
                            )}
                            {weightLabel && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#2B1B15] border border-[#C68B59]/25 text-[9.5px] font-medium text-[#D5C3B3] tabular-nums">
                                <Package className="w-2.5 h-2.5 text-[#C68B59]" />
                                {weightLabel}
                              </span>
                            )}
                          </div>
                        )}

                        {roastDate && (
                          <div className="flex items-center gap-1 text-[9.5px] text-[#D5C3B3]/80 tabular-nums">
                            <Calendar className="w-2.5 h-2.5 text-[#C68B59]" />
                            <span>
                              {t('coffeeRoastDate')}: {roastDate}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Price & Cart Button */}
                      <div className="space-y-2 pt-1 border-t border-[#C68B59]/15">
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-xs font-bold text-[#00D68F] tabular-nums">
                            {formatETB(product.price)}
                          </span>
                          {product.previousPrice && product.previousPrice > product.price && (
                            <span className="text-[10px] text-[#D5C3B3]/60 line-through tabular-nums">
                              {formatETB(product.previousPrice)}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={unavailable}
                          onClick={(e) => handleQuickAddToCart(e, product)}
                          aria-label={`${t('addToCart')} ${product.name}`}
                          className="w-full min-h-[34px] px-2.5 rounded-xl bg-gradient-to-r from-[#00D68F] to-[#00C8D7] hover:brightness-105 disabled:from-[#261915] disabled:to-[#261915] disabled:text-[#A9C0BD]/60 text-[#031719] text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                        >
                          {unavailable ? (
                            <span>{t('outOfStock')}</span>
                          ) : justAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>{t('addedToCart')}</span>
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span>{t('addToCart')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Bottom Return to Main Marketplace Footer Action */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => navigate({ name: 'home' })}
            className="w-full min-h-[44px] px-4 rounded-2xl bg-[#092825] hover:bg-[#0C3531] border border-[#14443F] text-[#F5FAFA] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#00D68F]" />
            <span>{t('coffeeBackToMarketplace')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
