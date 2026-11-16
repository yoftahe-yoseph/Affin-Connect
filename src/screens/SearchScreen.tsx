import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  MapPin,
  PackageCheck,
  Search,
  SlidersHorizontal,
  Star,
  Store,
  Truck,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { EmptyState, ProductCard, ResilientImage } from '../components/SharedUI';
import { getLocalizedNeighborhood } from '../constants/translations';
import {
  countActiveSearchFilters,
  filterAndSortProducts,
  formatETB,
  getNeighborhoodAvailabilityStats,
  getPriceRangeBounds,
  HAWASSA_NEIGHBORHOODS,
  type ProductFilterOptions,
} from '../utils/marketplaceLogic';
import type { Product } from '../types';

type SearchSortOption = NonNullable<ProductFilterOptions['sortBy']>;

export const SearchScreen: React.FC<{ initialQuery?: string; initialCategory?: string }> = ({
  initialQuery = '',
  initialCategory = 'all',
}) => {
  const {
    goBack,
    navigate,
    products,
    shopsById,
    categories,
    recentSearches,
    addRecentSearch,
    recentlyViewedIds,
    shopDistanceById,
    language,
    governanceConfig,
    t,
  } = useMarketplace();

  const getCategoryLabel = (cat: (typeof categories)[number]) => {
    if (language === 'am') return cat.nameAm;
    if (language === 'om') return cat.nameOm;
    if (language === 'sid') return cat.nameSid || cat.name;
    return cat.name;
  };

  // Committed query & filter state
  const [queryText, setQueryText] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [minShopRating, setMinShopRating] = useState<number | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [pickupOnly, setPickupOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SearchSortOption>('newest');

  // Filter drawer visibility & staged draft state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [draftNeighborhoods, setDraftNeighborhoods] = useState<string[]>([]);
  const [draftMinPrice, setDraftMinPrice] = useState<string>('');
  const [draftMaxPrice, setDraftMaxPrice] = useState<string>('');
  const [draftMinShopRating, setDraftMinShopRating] = useState<number | null>(null);
  const [draftInStockOnly, setDraftInStockOnly] = useState(false);
  const [draftDeliveryOnly, setDraftDeliveryOnly] = useState(false);
  const [draftPickupOnly, setDraftPickupOnly] = useState(false);
  const [draftSortBy, setDraftSortBy] = useState<SearchSortOption>('newest');

  const parsePriceValue = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const priceBounds = useMemo(() => getPriceRangeBounds(products), [products]);

  const neighborhoodStats = useMemo(
    () =>
      getNeighborhoodAvailabilityStats(
        products,
        shopsById,
        governanceConfig.strictShopVerification
      ),
    [products, shopsById, governanceConfig.strictShopVerification]
  );

  const committedMinPrice = parsePriceValue(minPrice);
  const committedMaxPrice = parsePriceValue(maxPrice);

  const results = useMemo(() => {
    return filterAndSortProducts(products, shopsById, {
      searchQuery: queryText,
      category,
      neighborhoods: selectedNeighborhoods,
      minPrice: committedMinPrice,
      maxPrice: committedMaxPrice,
      minShopRating,
      inStockOnly,
      deliveryOnly,
      pickupOnly,
      strictShopVerification: governanceConfig.strictShopVerification,
      sortBy,
      shopDistanceById,
    });
  }, [
    products,
    shopsById,
    queryText,
    category,
    selectedNeighborhoods,
    committedMinPrice,
    committedMaxPrice,
    minShopRating,
    inStockOnly,
    deliveryOnly,
    pickupOnly,
    governanceConfig.strictShopVerification,
    sortBy,
    shopDistanceById,
  ]);

  const draftMinParsed = parsePriceValue(draftMinPrice);
  const draftMaxParsed = parsePriceValue(draftMaxPrice);

  const draftResultsCount = useMemo(() => {
    if (!isDrawerOpen) return results.length;
    return filterAndSortProducts(products, shopsById, {
      searchQuery: queryText,
      category,
      neighborhoods: draftNeighborhoods,
      minPrice: draftMinParsed,
      maxPrice: draftMaxParsed,
      minShopRating: draftMinShopRating,
      inStockOnly: draftInStockOnly,
      deliveryOnly: draftDeliveryOnly,
      pickupOnly: draftPickupOnly,
      strictShopVerification: governanceConfig.strictShopVerification,
      sortBy: draftSortBy,
      shopDistanceById,
    }).length;
  }, [
    isDrawerOpen,
    results.length,
    products,
    shopsById,
    queryText,
    category,
    draftNeighborhoods,
    draftMinParsed,
    draftMaxParsed,
    draftMinShopRating,
    draftInStockOnly,
    draftDeliveryOnly,
    draftPickupOnly,
    governanceConfig.strictShopVerification,
    draftSortBy,
    shopDistanceById,
  ]);

  const activeFilterCount = useMemo(
    () =>
      countActiveSearchFilters({
        neighborhoods: selectedNeighborhoods,
        minPrice: committedMinPrice,
        maxPrice: committedMaxPrice,
        minShopRating,
        inStockOnly,
        deliveryOnly,
        pickupOnly,
        sortBy,
      }),
    [
      selectedNeighborhoods,
      committedMinPrice,
      committedMaxPrice,
      minShopRating,
      inStockOnly,
      deliveryOnly,
      pickupOnly,
      sortBy,
    ]
  );

  const openFilterDrawer = () => {
    setDraftNeighborhoods([...selectedNeighborhoods]);
    setDraftMinPrice(minPrice);
    setDraftMaxPrice(maxPrice);
    setDraftMinShopRating(minShopRating);
    setDraftInStockOnly(inStockOnly);
    setDraftDeliveryOnly(deliveryOnly);
    setDraftPickupOnly(pickupOnly);
    setDraftSortBy(sortBy);
    setIsDrawerOpen(true);
  };

  const applyDraftFilters = () => {
    setSelectedNeighborhoods([...draftNeighborhoods]);
    setMinPrice(draftMinPrice);
    setMaxPrice(draftMaxPrice);
    setMinShopRating(draftMinShopRating);
    setInStockOnly(draftInStockOnly);
    setDeliveryOnly(draftDeliveryOnly);
    setPickupOnly(draftPickupOnly);
    setSortBy(draftSortBy);
    setIsDrawerOpen(false);
  };

  const clearDraftFilters = () => {
    setDraftNeighborhoods([]);
    setDraftMinPrice('');
    setDraftMaxPrice('');
    setDraftMinShopRating(null);
    setDraftInStockOnly(false);
    setDraftDeliveryOnly(false);
    setDraftPickupOnly(false);
    setDraftSortBy('newest');
  };

  const resetAllFilters = (clearQueryAndCategory = false) => {
    if (clearQueryAndCategory) {
      setQueryText('');
      setCategory('all');
    }
    setSelectedNeighborhoods([]);
    setMinPrice('');
    setMaxPrice('');
    setMinShopRating(null);
    setInStockOnly(false);
    setDeliveryOnly(false);
    setPickupOnly(false);
    setSortBy('newest');
  };

  const toggleDraftNeighborhood = (area: string) => {
    setDraftNeighborhoods((prev) =>
      prev.includes(area) ? prev.filter((item) => item !== area) : [...prev, area]
    );
  };

  useEffect(() => {
    if (!isDrawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDrawerOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (queryText.trim()) addRecentSearch(queryText.trim());
  };

  const sortOptions: { value: SearchSortOption; label: string }[] = [
    { value: 'newest', label: t('sortNewest') },
    { value: 'nearest', label: t('filterSortNearest') },
    { value: 'rating', label: t('sortRating') },
    { value: 'price_asc', label: t('sortPriceAsc') },
    { value: 'price_desc', label: t('sortPriceDesc') },
  ];

  const ratingOptions: { value: number | null; label: string }[] = [
    { value: null, label: t('filterRatingAny') },
    { value: 4, label: t('filterRating4Plus') },
    { value: 4.5, label: t('filterRating45Plus') },
    { value: 4.8, label: t('filterRating48Plus') },
  ];

  const pricePresets: { min: string; max: string; label: string }[] = [
    { min: '', max: '500', label: t('filterPriceUnder500') },
    { min: '500', max: '2000', label: t('filterPrice500To2000') },
    { min: '2000', max: '5000', label: t('filterPrice2000To5000') },
    { min: '5000', max: '', label: t('filterPriceOver5000') },
  ];

  const sliderMinVal = Math.min(
    priceBounds.max,
    Math.max(priceBounds.min, draftMinParsed ?? priceBounds.min)
  );
  const sliderMaxVal = Math.max(
    sliderMinVal,
    Math.min(priceBounds.max, draftMaxParsed ?? priceBounds.max)
  );
  const sliderSpan = Math.max(1, priceBounds.max - priceBounds.min);
  const leftPct = Math.round(((sliderMinVal - priceBounds.min) / sliderSpan) * 100);
  const rightPct = Math.round(((priceBounds.max - sliderMaxVal) / sliderSpan) * 100);

  const getSortChipLabel = (value: SearchSortOption): string => {
    const match = sortOptions.find((opt) => opt.value === value);
    return match ? match.label : value;
  };

  const hasAnyResettableFilter =
    category !== 'all' || Boolean(queryText) || activeFilterCount > 0;

  return (
    <div className="flex flex-col min-h-full pb-6">
      {/* Top Search Header */}
      <header className="sticky top-0 z-20 bg-white dark:bg-[#1C2420] border-b border-[#E7E5E4] dark:border-[#2A3630] px-3 py-2.5 space-y-2.5">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17] shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-[#047857] dark:text-[#10B981] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label="Search Hawasa Gebeya"
              className="w-full min-h-[44px] pl-9 pr-8 rounded-xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-500 dark:placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981] transition-all"
            />
            {queryText && (
              <button
                type="button"
                onClick={() => setQueryText('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={openFilterDrawer}
            aria-label={t('filterDrawerTitle')}
            aria-expanded={isDrawerOpen}
            className={`relative min-w-[44px] min-h-[44px] px-2.5 rounded-xl border flex items-center justify-center gap-1.5 shrink-0 transition-colors ${
              isDrawerOpen || activeFilterCount > 0
                ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] border-[#047857]/40 dark:border-[#10B981]/40 font-semibold'
                : 'bg-[#FAF8F5] dark:bg-[#141A17] text-stone-700 dark:text-stone-200 border-[#E7E5E4] dark:border-[#2A3630] hover:bg-[#ECFDF5]/60 dark:hover:bg-[#10B981]/10'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-md bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#141A17] text-[10px] font-bold tabular-nums flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </form>

        {/* Category Segmented Strip */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 mobile-scroll">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs whitespace-nowrap shrink-0 border transition-colors ${
              category === 'all'
                ? 'bg-[#ECFDF5] text-[#047857] border-[#047857]/30 dark:bg-[#10B981]/15 dark:text-[#10B981] dark:border-[#10B981]/30 font-semibold'
                : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] text-stone-700 dark:text-stone-300 hover:border-[#047857]/30'
            }`}
          >
            {t('all')}
          </button>
          {categories
            .filter((c) => c.isActive)
            .map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => setCategory(cat.slug)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs whitespace-nowrap shrink-0 border transition-colors ${
                  category === cat.slug
                    ? 'bg-[#ECFDF5] text-[#047857] border-[#047857]/30 dark:bg-[#10B981]/15 dark:text-[#10B981] dark:border-[#10B981]/30 font-semibold'
                    : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] text-stone-700 dark:text-stone-300 hover:border-[#047857]/30'
                }`}
              >
                {getCategoryLabel(cat)}
              </button>
            ))}
        </div>

        {/* Active Dismissible Filter Bar */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5 pb-1 mobile-scroll">
            {(committedMinPrice != null || committedMaxPrice != null) && (
              <button
                type="button"
                onClick={() => {
                  setMinPrice('');
                  setMaxPrice('');
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/15 border border-[#047857]/30 dark:border-[#10B981]/30 text-[11px] font-semibold text-[#047857] dark:text-[#10B981] whitespace-nowrap shrink-0 tabular-nums"
              >
                <span>
                  {committedMinPrice != null && committedMaxPrice != null
                    ? `${formatETB(committedMinPrice)} – ${formatETB(committedMaxPrice)}`
                    : committedMinPrice != null
                    ? `≥ ${formatETB(committedMinPrice)}`
                    : `≤ ${formatETB(committedMaxPrice ?? 0)}`}
                </span>
                <X className="w-3 h-3" />
              </button>
            )}

            {minShopRating != null && (
              <button
                type="button"
                onClick={() => setMinShopRating(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-[#F59E0B]/15 border border-[#D97706]/30 dark:border-[#F59E0B]/30 text-[11px] font-semibold text-[#B45309] dark:text-[#F59E0B] whitespace-nowrap shrink-0 tabular-nums"
              >
                <Star className="w-3 h-3 fill-current" />
                <span>{minShopRating.toFixed(1)}+</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {selectedNeighborhoods.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() =>
                  setSelectedNeighborhoods((prev) => prev.filter((item) => item !== area))
                }
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#047857]/30 dark:border-[#10B981]/30 text-[11px] font-semibold text-stone-800 dark:text-stone-200 whitespace-nowrap shrink-0"
              >
                <MapPin className="w-3 h-3 text-[#047857] dark:text-[#10B981]" />
                <span>{getLocalizedNeighborhood(area, language)}</span>
                <X className="w-3 h-3 text-stone-500 dark:text-stone-400" />
              </button>
            ))}

            {inStockOnly && (
              <button
                type="button"
                onClick={() => setInStockOnly(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] text-[11px] font-medium text-stone-700 dark:text-stone-200 whitespace-nowrap shrink-0"
              >
                <span>{t('inStockOnly')}</span>
                <X className="w-3 h-3 text-stone-500" />
              </button>
            )}

            {deliveryOnly && (
              <button
                type="button"
                onClick={() => setDeliveryOnly(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] text-[11px] font-medium text-stone-700 dark:text-stone-200 whitespace-nowrap shrink-0"
              >
                <span>{t('deliveryAvailable')}</span>
                <X className="w-3 h-3 text-stone-500" />
              </button>
            )}

            {pickupOnly && (
              <button
                type="button"
                onClick={() => setPickupOnly(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] text-[11px] font-medium text-stone-700 dark:text-stone-200 whitespace-nowrap shrink-0"
              >
                <span>{t('filterPickupReady')}</span>
                <X className="w-3 h-3 text-stone-500" />
              </button>
            )}

            {sortBy !== 'newest' && (
              <button
                type="button"
                onClick={() => setSortBy('newest')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] text-[11px] font-medium text-stone-700 dark:text-stone-200 whitespace-nowrap shrink-0"
              >
                <span>{getSortChipLabel(sortBy)}</span>
                <X className="w-3 h-3 text-stone-500" />
              </button>
            )}

            <button
              type="button"
              onClick={() => resetAllFilters(false)}
              className="px-2.5 py-1.5 text-[11px] font-semibold text-[#047857] dark:text-[#10B981] hover:underline whitespace-nowrap shrink-0"
            >
              {t('filterClearAllBtn')}
            </button>
          </div>
        )}
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Recent Searches */}
        {!queryText && recentSearches.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5">
              {t('recentSearches')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setQueryText(term)}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] text-xs text-stone-700 dark:text-stone-200 hover:border-[#047857]/40 dark:hover:border-[#10B981]/40 shadow-xs"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recently Viewed Products */}
        {!queryText &&
          (() => {
            const recentlyViewedProducts = recentlyViewedIds
              .map((id) => products.find((p) => p.productId === id && p.status === 'active'))
              .filter((p): p is Product => Boolean(p));
            if (recentlyViewedProducts.length === 0) return null;
            return (
              <div>
                <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-2">
                  {t('recentlyViewed')}
                </div>
                <div className="flex gap-2.5 overflow-x-auto pb-1 mobile-scroll">
                  {recentlyViewedProducts.map((item) => (
                    <button
                      key={item.productId}
                      type="button"
                      onClick={() => navigate({ name: 'product', productId: item.productId })}
                      className="w-32 shrink-0 bg-white dark:bg-[#1C2420] rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] overflow-hidden text-left shadow-sm hover:shadow-md hover:border-[#047857]/40 dark:hover:border-[#10B981]/40 transition-all"
                    >
                      <div className="aspect-[4/3] bg-[#FAF8F5] dark:bg-[#141A17]">
                        <ResilientImage
                          src={item.imageUrl}
                          alt={item.name}
                          fallbackTitle={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2">
                        <div className="text-[11px] font-semibold text-stone-900 dark:text-stone-100 line-clamp-1">
                          {item.name}
                        </div>
                        <div className="text-[11px] font-bold text-[#047857] dark:text-[#10B981] tabular-nums mt-0.5">
                          {formatETB(item.price)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

        <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <span className="tabular-nums font-medium">{t('productsFound', { count: results.length })}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openFilterDrawer}
              className="inline-flex items-center gap-1 text-[#047857] dark:text-[#10B981] font-semibold hover:underline"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{t('filterDrawerTitle')}</span>
            </button>
            {hasAnyResettableFilter && (
              <button
                type="button"
                onClick={() => resetAllFilters(true)}
                className="text-stone-600 dark:text-stone-300 font-semibold hover:underline"
              >
                {t('resetFilters')}
              </button>
            )}
          </div>
        </div>

        {results.length === 0 ? (
          <EmptyState
            title={t('noMatchingProducts')}
            description={t('noMatchingDesc')}
            actionLabel={t('showAllProducts')}
            onAction={() => resetAllFilters(true)}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {results.map((product) => (
              <ProductCard key={product.productId} product={product} />
            ))}
          </div>
        )}
      </div>

      {/* Refined Slide-Over / Bottom-Sheet Filter Drawer */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-black/60 backdrop-blur-xs"
          onClick={() => setIsDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="filter-drawer-heading"
        >
          <div
            className="w-full sm:max-w-md max-h-[90vh] sm:max-h-full sm:h-full bg-[#FAF8F5] dark:bg-[#141A17] border-t sm:border-t-0 sm:border-l border-[#E7E5E4] dark:border-[#2A3630] rounded-t-2xl sm:rounded-none flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="bg-white dark:bg-[#1C2420] border-b border-[#E7E5E4] dark:border-[#2A3630] px-4 py-3.5 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h2
                  id="filter-drawer-heading"
                  className="text-base font-bold text-stone-900 dark:text-stone-100 leading-tight"
                >
                  {t('filterDrawerTitle')}
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-snug">
                  {t('filterDrawerSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close filter drawer"
                className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Filter Sections */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {/* 1. Sort By */}
              <section className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] p-3.5 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                  {t('sortBy')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {sortOptions.map((option) => {
                    const active = draftSortBy === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDraftSortBy(option.value)}
                        className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold text-left flex items-center justify-between gap-2 transition-colors ${
                          active
                            ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 border-[#047857] dark:border-[#10B981] text-[#047857] dark:text-[#10B981]'
                            : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] text-stone-700 dark:text-stone-200 hover:border-[#047857]/40'
                        }`}
                      >
                        <span className="leading-tight">{option.label}</span>
                        {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 2. Price Range (ETB) */}
              <section className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                    {t('filterPriceRangeTitle')}
                  </h3>
                  <span className="text-[11px] font-semibold text-[#047857] dark:text-[#10B981] tabular-nums">
                    {formatETB(sliderMinVal)} – {formatETB(sliderMaxVal)}
                  </span>
                </div>

                {/* Numeric Min / Max ETB Inputs */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor="drawer-min-price"
                      className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-1"
                    >
                      {t('filterMinPriceLabel')}
                    </label>
                    <input
                      id="drawer-min-price"
                      type="number"
                      min={0}
                      placeholder={String(priceBounds.min)}
                      value={draftMinPrice}
                      onChange={(e) => setDraftMinPrice(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-xs font-semibold tabular-nums text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#047857]/25 focus:border-[#047857]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="drawer-max-price"
                      className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-1"
                    >
                      {t('filterMaxPriceLabel')}
                    </label>
                    <input
                      id="drawer-max-price"
                      type="number"
                      min={0}
                      placeholder={String(priceBounds.max)}
                      value={draftMaxPrice}
                      onChange={(e) => setDraftMaxPrice(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-xs font-semibold tabular-nums text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#047857]/25 focus:border-[#047857]"
                    />
                  </div>
                </div>

                {/* Synchronized Range Track & Sliders */}
                <div className="space-y-2 pt-1">
                  <div className="relative h-2 rounded-lg bg-[#E7E5E4] dark:bg-[#2A3630] overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 bg-[#047857] dark:bg-[#10B981]"
                      style={{ left: `${leftPct}%`, right: `${rightPct}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="range"
                      aria-label={t('filterMinPriceLabel')}
                      min={priceBounds.min}
                      max={priceBounds.max}
                      step={50}
                      value={sliderMinVal}
                      onChange={(e) => {
                        const nextMin = Number(e.target.value);
                        setDraftMinPrice(nextMin <= priceBounds.min ? '' : String(nextMin));
                        if (draftMaxParsed != null && nextMin > draftMaxParsed) {
                          setDraftMaxPrice(String(nextMin));
                        }
                      }}
                      className="w-full accent-[#047857] dark:accent-[#10B981] cursor-pointer"
                    />
                    <input
                      type="range"
                      aria-label={t('filterMaxPriceLabel')}
                      min={priceBounds.min}
                      max={priceBounds.max}
                      step={50}
                      value={sliderMaxVal}
                      onChange={(e) => {
                        const nextMax = Number(e.target.value);
                        setDraftMaxPrice(nextMax >= priceBounds.max ? '' : String(nextMax));
                        if (draftMinParsed != null && nextMax < draftMinParsed) {
                          setDraftMinPrice(String(nextMax));
                        }
                      }}
                      className="w-full accent-[#047857] dark:accent-[#10B981] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Quick ETB Presets */}
                <div className="grid grid-cols-2 gap-2">
                  {pricePresets.map((preset) => {
                    const isSelected =
                      draftMinPrice === preset.min && draftMaxPrice === preset.max;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setDraftMinPrice('');
                            setDraftMaxPrice('');
                          } else {
                            setDraftMinPrice(preset.min);
                            setDraftMaxPrice(preset.max);
                          }
                        }}
                        className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold tabular-nums transition-colors ${
                          isSelected
                            ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 border-[#047857] dark:border-[#10B981] text-[#047857] dark:text-[#10B981]'
                            : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] text-stone-700 dark:text-stone-200 hover:border-[#047857]/40'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 3. Minimum Shop Rating */}
              <section className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] p-3.5 space-y-2.5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                    {t('filterShopRatingTitle')}
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    {t('filterShopRatingHint')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ratingOptions.map((opt) => {
                    const active = draftMinShopRating === opt.value;
                    return (
                      <button
                        key={String(opt.value ?? 'any')}
                        type="button"
                        onClick={() => setDraftMinShopRating(opt.value)}
                        className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 tabular-nums transition-colors ${
                          active
                            ? 'bg-amber-50 dark:bg-[#F59E0B]/15 border-[#D97706] dark:border-[#F59E0B] text-[#B45309] dark:text-[#F59E0B]'
                            : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] text-stone-700 dark:text-stone-200 hover:border-[#D97706]/40'
                        }`}
                      >
                        {opt.value != null && <Star className="w-3.5 h-3.5 fill-current shrink-0" />}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 4. Hawassa Neighborhood Availability */}
              <section className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                      {t('filterNeighborhoodAvailabilityTitle')}
                    </h3>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                      {t('filterSelectAreasHint')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraftNeighborhoods([])}
                    className={`min-h-[36px] px-2.5 py-1 rounded-xl border text-[11px] font-semibold shrink-0 transition-colors ${
                      draftNeighborhoods.length === 0
                        ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 border-[#047857] dark:border-[#10B981] text-[#047857] dark:text-[#10B981]'
                        : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] text-stone-700 dark:text-stone-200'
                    }`}
                  >
                    {t('allHawassa')}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {HAWASSA_NEIGHBORHOODS.map((area) => {
                    const active = draftNeighborhoods.includes(area);
                    const stats = neighborhoodStats[area] ?? { shopCount: 0, productCount: 0 };
                    const hasInventory = stats.productCount > 0;
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => toggleDraftNeighborhood(area)}
                        className={`min-h-[48px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                          active
                            ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 border-[#047857] dark:border-[#10B981]'
                            : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] hover:border-[#047857]/40'
                        }`}
                      >
                        <div className="min-w-0">
                          <div
                            className={`text-xs font-semibold truncate ${
                              active
                                ? 'text-[#047857] dark:text-[#10B981]'
                                : hasInventory
                                ? 'text-stone-900 dark:text-stone-100'
                                : 'text-stone-500 dark:text-stone-400'
                            }`}
                          >
                            {getLocalizedNeighborhood(area, language)}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                            {t('filterNeighborhoodStats', {
                              shops: stats.shopCount,
                              products: stats.productCount,
                            })}
                          </div>
                        </div>
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                            active
                              ? 'bg-[#047857] dark:bg-[#10B981] border-[#047857] dark:border-[#10B981] text-white dark:text-[#141A17]'
                              : 'border-stone-300 dark:border-stone-600 bg-white dark:bg-[#1C2420]'
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 5. Stock & Handoff Availability */}
              <section className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] p-3.5 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                  {t('filterFulfillmentTitle')}
                </h3>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setDraftInStockOnly((v) => !v)}
                    className={`w-full min-h-[44px] px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold transition-colors ${
                      draftInStockOnly
                        ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 border-[#047857] dark:border-[#10B981] text-[#047857] dark:text-[#10B981]'
                        : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] text-stone-700 dark:text-stone-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <PackageCheck className="w-4 h-4 shrink-0" />
                      <span>{t('inStockOnly')}</span>
                    </span>
                    {draftInStockOnly && <Check className="w-4 h-4 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDraftDeliveryOnly((v) => !v)}
                    className={`w-full min-h-[44px] px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold transition-colors ${
                      draftDeliveryOnly
                        ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 border-[#047857] dark:border-[#10B981] text-[#047857] dark:text-[#10B981]'
                        : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] text-stone-700 dark:text-stone-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Truck className="w-4 h-4 shrink-0" />
                      <span>{t('deliveryAvailable')}</span>
                    </span>
                    {draftDeliveryOnly && <Check className="w-4 h-4 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDraftPickupOnly((v) => !v)}
                    className={`w-full min-h-[44px] px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold transition-colors ${
                      draftPickupOnly
                        ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 border-[#047857] dark:border-[#10B981] text-[#047857] dark:text-[#10B981]'
                        : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] text-stone-700 dark:text-stone-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Store className="w-4 h-4 shrink-0" />
                      <span>{t('filterPickupReady')}</span>
                    </span>
                    {draftPickupOnly && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                </div>
              </section>
            </div>

            {/* Sticky Drawer Footer */}
            <div className="bg-white dark:bg-[#1C2420] border-t border-[#E7E5E4] dark:border-[#2A3630] px-4 py-3 flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={clearDraftFilters}
                className="min-h-[44px] px-4 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#1C2420] shrink-0"
              >
                {t('filterClearAllBtn')}
              </button>
              <button
                type="button"
                onClick={applyDraftFilters}
                className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#141A17] text-xs font-bold tabular-nums shadow-sm hover:opacity-95 transition-opacity"
              >
                {t('filterApplyResultsBtn', { count: draftResultsCount })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

