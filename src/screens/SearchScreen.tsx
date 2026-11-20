import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Bell,
  Check,
  History,
  MapPin,
  PackageCheck,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  Store,
  Truck,
  User,
  X,
} from 'lucide-react';
import { useMarketplace, type SearchSessionState } from '../context/MarketplaceContext';
import { CategoryIcon, ProductCard, ResilientImage, ShopCard } from '../components/SharedUI';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { BRAND_ASSETS } from '../data/seedData';
import { getLocalizedNeighborhood } from '../constants/translations';
import {
  countActiveSearchFilters,
  filterAndSortProducts,
  filterShopsForSearch,
  formatETB,
  getNeighborhoodAvailabilityStats,
  getPriceRangeBounds,
  HAWASSA_NEIGHBORHOODS,
} from '../utils/marketplaceLogic';
import type { Product } from '../types';

type SearchSortOption = SearchSessionState['sortBy'];
type SearchTypeFilter = SearchSessionState['searchType'];

export const SearchScreen: React.FC<{ initialQuery?: string; initialCategory?: string }> = ({
  initialQuery = '',
  initialCategory = 'all',
}) => {
  const {
    goBack,
    navigate,
    products,
    shops,
    shopsById,
    categories,
    recentSearches,
    addRecentSearch,
    recentlyViewedIds,
    shopDistanceById,
    userLocation,
    firebaseUser,
    userProfile,
    authLoading,
    unreadNotificationCount,
    language,
    governanceConfig,
    searchSession,
    setSearchSession,
    refreshCatalogFromFirestore,
    t,
  } = useMarketplace();

  const getCategoryLabel = (cat: (typeof categories)[number]) => {
    if (language === 'am') return cat.nameAm;
    if (language === 'om') return cat.nameOm;
    if (language === 'sid') return cat.nameSid || cat.name;
    return cat.name;
  };

  // Preserve search state across Product/Shop detail navigation via searchSession
  const [queryInput, setQueryInput] = useState<string>(
    () => searchSession.queryText || initialQuery
  );
  const [debouncedQuery, setDebouncedQuery] = useState<string>(
    () => searchSession.queryText || initialQuery
  );
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const searchType = searchSession.searchType;
  const category = searchSession.category || initialCategory || 'all';
  const selectedNeighborhoods = searchSession.selectedNeighborhoods;
  const minPrice = searchSession.minPrice;
  const maxPrice = searchSession.maxPrice;
  const minShopRating = searchSession.minShopRating;
  const inStockOnly = searchSession.inStockOnly;
  const deliveryOnly = searchSession.deliveryOnly;
  const pickupOnly = searchSession.pickupOnly;
  const verifiedOnly = searchSession.verifiedOnly;
  const sortBy = searchSession.sortBy;

  // Sync local queryInput when searchSession changes externally (e.g., fresh navigation from Home)
  useEffect(() => {
    setQueryInput(searchSession.queryText);
    setDebouncedQuery(searchSession.queryText);
  }, [searchSession.queryText]);

  // Debounce live typing search and cancel stale query updates
  useEffect(() => {
    const trimmedNext = queryInput;
    if (trimmedNext === debouncedQuery) {
      setIsSearching(false);
      return;
    }

    const reqId = ++requestIdRef.current;
    setIsSearching(true);
    setSearchError(null);

    const timer = window.setTimeout(() => {
      if (requestIdRef.current !== reqId) return;
      setDebouncedQuery(trimmedNext);
      setSearchSession((prev) =>
        prev.queryText === trimmedNext ? prev : { ...prev, queryText: trimmedNext }
      );
      setIsSearching(false);
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [queryInput, debouncedQuery, setSearchSession]);

  // Filter drawer staged draft state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState<string>(category);
  const [draftNeighborhoods, setDraftNeighborhoods] = useState<string[]>([]);
  const [draftMinPrice, setDraftMinPrice] = useState<string>('');
  const [draftMaxPrice, setDraftMaxPrice] = useState<string>('');
  const [draftMinShopRating, setDraftMinShopRating] = useState<number | null>(null);
  const [draftInStockOnly, setDraftInStockOnly] = useState(false);
  const [draftDeliveryOnly, setDraftDeliveryOnly] = useState(false);
  const [draftPickupOnly, setDraftPickupOnly] = useState(false);
  const [draftVerifiedOnly, setDraftVerifiedOnly] = useState(false);
  const [draftSortBy, setDraftSortBy] = useState<SearchSortOption>('relevance');

  const parsePriceValue = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const categoryNamesBySlug = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of categories) {
      map[c.slug] = `${c.name} ${c.nameAm} ${c.nameOm} ${c.nameSid ?? ''}`;
    }
    return map;
  }, [categories]);

  const localizedNeighborhoodByArea = useMemo(() => {
    const map: Record<string, string> = {};
    for (const area of HAWASSA_NEIGHBORHOODS) {
      map[area] = getLocalizedNeighborhood(area, language);
    }
    return map;
  }, [language]);

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

  const activeFilterCount = useMemo(
    () =>
      countActiveSearchFilters({
        category,
        neighborhoods: selectedNeighborhoods,
        minPrice: committedMinPrice,
        maxPrice: committedMaxPrice,
        minShopRating,
        inStockOnly,
        deliveryOnly,
        pickupOnly,
        verifiedOnly,
        sortBy,
      }),
    [
      category,
      selectedNeighborhoods,
      committedMinPrice,
      committedMaxPrice,
      minShopRating,
      inStockOnly,
      deliveryOnly,
      pickupOnly,
      verifiedOnly,
      sortBy,
    ]
  );

  const matchingShops = useMemo(() => {
    return filterShopsForSearch(shops, products, {
      searchQuery: debouncedQuery,
      category,
      neighborhoods: selectedNeighborhoods,
      minRating: minShopRating,
      verifiedOnly,
      deliveryOnly,
      pickupOnly,
      strictShopVerification: governanceConfig.strictShopVerification,
      sortBy,
      shopDistanceById,
      categoryNamesBySlug,
      localizedNeighborhoodByArea,
    });
  }, [
    shops,
    products,
    debouncedQuery,
    category,
    selectedNeighborhoods,
    minShopRating,
    verifiedOnly,
    deliveryOnly,
    pickupOnly,
    governanceConfig.strictShopVerification,
    sortBy,
    shopDistanceById,
    categoryNamesBySlug,
    localizedNeighborhoodByArea,
  ]);

  const matchingProducts = useMemo(() => {
    return filterAndSortProducts(products, shopsById, {
      searchQuery: debouncedQuery,
      category,
      neighborhoods: selectedNeighborhoods,
      minPrice: committedMinPrice,
      maxPrice: committedMaxPrice,
      minShopRating,
      inStockOnly,
      deliveryOnly,
      pickupOnly,
      verifiedOnly,
      strictShopVerification: governanceConfig.strictShopVerification,
      sortBy,
      shopDistanceById,
      categoryNamesBySlug,
      localizedNeighborhoodByArea,
    });
  }, [
    products,
    shopsById,
    debouncedQuery,
    category,
    selectedNeighborhoods,
    committedMinPrice,
    committedMaxPrice,
    minShopRating,
    inStockOnly,
    deliveryOnly,
    pickupOnly,
    verifiedOnly,
    governanceConfig.strictShopVerification,
    sortBy,
    shopDistanceById,
    categoryNamesBySlug,
    localizedNeighborhoodByArea,
  ]);

  const totalResultCount = useMemo(() => {
    if (searchType === 'shops') return matchingShops.length;
    if (searchType === 'products') return matchingProducts.length;
    return matchingShops.length + matchingProducts.length;
  }, [searchType, matchingShops.length, matchingProducts.length]);

  const draftMinParsed = parsePriceValue(draftMinPrice);
  const draftMaxParsed = parsePriceValue(draftMaxPrice);

  const draftResultsCount = useMemo(() => {
    if (!isDrawerOpen) return totalResultCount;
    const draftShopsCount =
      searchType === 'products'
        ? 0
        : filterShopsForSearch(shops, products, {
            searchQuery: debouncedQuery,
            category: draftCategory,
            neighborhoods: draftNeighborhoods,
            minRating: draftMinShopRating,
            verifiedOnly: draftVerifiedOnly,
            deliveryOnly: draftDeliveryOnly,
            pickupOnly: draftPickupOnly,
            strictShopVerification: governanceConfig.strictShopVerification,
            sortBy: draftSortBy,
            shopDistanceById,
            categoryNamesBySlug,
            localizedNeighborhoodByArea,
          }).length;
    const draftProductsCount =
      searchType === 'shops'
        ? 0
        : filterAndSortProducts(products, shopsById, {
            searchQuery: debouncedQuery,
            category: draftCategory,
            neighborhoods: draftNeighborhoods,
            minPrice: draftMinParsed,
            maxPrice: draftMaxParsed,
            minShopRating: draftMinShopRating,
            inStockOnly: draftInStockOnly,
            deliveryOnly: draftDeliveryOnly,
            pickupOnly: draftPickupOnly,
            verifiedOnly: draftVerifiedOnly,
            strictShopVerification: governanceConfig.strictShopVerification,
            sortBy: draftSortBy,
            shopDistanceById,
            categoryNamesBySlug,
            localizedNeighborhoodByArea,
          }).length;
    return draftShopsCount + draftProductsCount;
  }, [
    isDrawerOpen,
    totalResultCount,
    searchType,
    shops,
    products,
    shopsById,
    debouncedQuery,
    draftCategory,
    draftNeighborhoods,
    draftMinParsed,
    draftMaxParsed,
    draftMinShopRating,
    draftInStockOnly,
    draftDeliveryOnly,
    draftPickupOnly,
    draftVerifiedOnly,
    governanceConfig.strictShopVerification,
    draftSortBy,
    shopDistanceById,
    categoryNamesBySlug,
    localizedNeighborhoodByArea,
  ]);

  const updateSearchState = (patch: Partial<SearchSessionState>) => {
    setSearchSession((prev) => ({ ...prev, ...patch }));
  };

  const commitQueryImmediately = (nextQuery: string, saveToRecent = false) => {
    requestIdRef.current += 1;
    setQueryInput(nextQuery);
    setDebouncedQuery(nextQuery);
    setIsSearching(false);
    setSearchError(null);
    updateSearchState({ queryText: nextQuery });
    if (saveToRecent && nextQuery.trim()) {
      addRecentSearch(nextQuery.trim());
    }
  };

  const openFilterDrawer = () => {
    setDraftCategory(category);
    setDraftNeighborhoods([...selectedNeighborhoods]);
    setDraftMinPrice(minPrice);
    setDraftMaxPrice(maxPrice);
    setDraftMinShopRating(minShopRating);
    setDraftInStockOnly(inStockOnly);
    setDraftDeliveryOnly(deliveryOnly);
    setDraftPickupOnly(pickupOnly);
    setDraftVerifiedOnly(verifiedOnly);
    setDraftSortBy(sortBy);
    setIsDrawerOpen(true);
  };

  const applyDraftFilters = () => {
    updateSearchState({
      category: draftCategory,
      selectedNeighborhoods: [...draftNeighborhoods],
      minPrice: draftMinPrice,
      maxPrice: draftMaxPrice,
      minShopRating: draftMinShopRating,
      inStockOnly: draftInStockOnly,
      deliveryOnly: draftDeliveryOnly,
      pickupOnly: draftPickupOnly,
      verifiedOnly: draftVerifiedOnly,
      sortBy: draftSortBy,
    });
    setIsDrawerOpen(false);
  };

  const clearDraftFilters = () => {
    setDraftCategory('all');
    setDraftNeighborhoods([]);
    setDraftMinPrice('');
    setDraftMaxPrice('');
    setDraftMinShopRating(null);
    setDraftInStockOnly(false);
    setDraftDeliveryOnly(false);
    setDraftPickupOnly(false);
    setDraftVerifiedOnly(false);
    setDraftSortBy('relevance');
  };

  const resetAllFilters = (clearQueryToo = false) => {
    if (clearQueryToo) {
      requestIdRef.current += 1;
      setQueryInput('');
      setDebouncedQuery('');
      setIsSearching(false);
    }
    setSearchError(null);
    setSearchSession((prev) => ({
      ...prev,
      queryText: clearQueryToo ? '' : prev.queryText,
      searchType: clearQueryToo ? 'all' : prev.searchType,
      category: 'all',
      selectedNeighborhoods: [],
      minPrice: '',
      maxPrice: '',
      minShopRating: null,
      inStockOnly: false,
      deliveryOnly: false,
      pickupOnly: false,
      verifiedOnly: false,
      sortBy: 'relevance',
    }));
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
    commitQueryImmediately(queryInput, true);
    searchInputRef.current?.blur();
  };

  const handleRetryCatalog = async () => {
    const reqId = ++requestIdRef.current;
    setIsSearching(true);
    setSearchError(null);
    try {
      await refreshCatalogFromFirestore();
      if (requestIdRef.current !== reqId) return;
    } catch {
      if (requestIdRef.current !== reqId) return;
      setSearchError(t('searchErrorDesc'));
    } finally {
      if (requestIdRef.current === reqId) {
        setIsSearching(false);
      }
    }
  };

  const sortOptions: { value: SearchSortOption; label: string }[] = [
    { value: 'relevance', label: t('sortRelevance') },
    { value: 'rating', label: t('sortRating') },
    { value: 'price_asc', label: t('sortPriceAsc') },
    { value: 'price_desc', label: t('sortPriceDesc') },
    { value: 'newest', label: t('sortNewest') },
    { value: 'nearest', label: t('filterSortNearest') },
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

  const getSortChipLabel = (value: SearchSortOption): string => {
    const match = sortOptions.find((opt) => opt.value === value);
    return match ? match.label : value;
  };

  const activeCategoryObj = categories.find((c) => c.slug === category);
  const hasCommittedQuery = debouncedQuery.trim().length > 0;
  const hasAnySearchOrFilter =
    hasCommittedQuery ||
    queryInput.trim().length > 0 ||
    activeFilterCount > 0 ||
    searchType !== 'all';

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

  const recentlyViewedProducts = useMemo(
    () =>
      recentlyViewedIds
        .map((id) => products.find((p) => p.productId === id && p.status === 'active'))
        .filter((p): p is Product => Boolean(p)),
    [recentlyViewedIds, products]
  );

  return (
    <div className="min-h-full bg-[#F3F6F4] dark:bg-[#031719] text-[#0E2421] dark:text-[#F5FAFA] pb-8 flex flex-col">
      {/* Compact Sticky Safe-Area Header */}
      <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 dark:bg-[#031719]/92 backdrop-blur-md border-b border-[#D2E0DC] dark:border-white/10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={goBack}
              aria-label="Go back"
              className="min-w-[40px] min-h-[40px] -ml-1 rounded-xl bg-[#F3F6F4] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/50 dark:hover:border-[#00D68F]/50 flex items-center justify-center text-[#0F4C44] dark:text-[#F5FAFA] shrink-0 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] shrink-0 shadow-xs">
              <img
                src={BRAND_ASSETS.logo}
                alt="Affin Connect"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-display font-bold tracking-tight text-[#0F4C44] dark:text-[#F5FAFA] truncate">
                Affin Connect
              </div>
              <p className="text-[11px] text-[#46635E] dark:text-[#A9C0BD] truncate">
                {t('authHeaderSubtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeToggleButton />

            <button
              type="button"
              onClick={() => navigate({ name: 'notifications' })}
              aria-label={t('notifications')}
              className="relative min-w-[44px] min-h-[44px] rounded-xl bg-[#F3F6F4] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/50 dark:hover:border-[#00D68F]/50 flex items-center justify-center text-[#0E2421] dark:text-[#F5FAFA] transition-colors"
            >
              <Bell className="w-5 h-5 text-[#0F4C44] dark:text-[#00D68F]" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#0F4C44] dark:bg-[#00D68F] text-[#FCFDFC] dark:text-[#031719] text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate({ name: 'profile' })}
              aria-label={t('openProfileAria')}
              className="min-w-[44px] min-h-[44px] rounded-full p-0.5 bg-gradient-to-br from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] flex items-center justify-center shadow-md shadow-[#0F4C44]/20 dark:shadow-[#00D68F]/20 active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#FCFDFC] dark:bg-[#061D1B] flex items-center justify-center text-xs font-bold text-[#0F4C44] dark:text-[#F5FAFA]">
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
      </header>

      {/* Search Bar & Search Type Controls */}
      <div className="px-4 pt-3.5 space-y-3">
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          className="relative flex items-center rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] focus-within:border-[#0F4C44] dark:focus-within:border-[#00D68F] focus-within:ring-2 focus-within:ring-[#0F4C44]/15 dark:focus-within:ring-[#00D68F]/20 shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-md dark:shadow-black/20 transition-all"
        >
          <Search className="w-4 h-4 text-[#0F4C44] dark:text-[#00D68F] ml-3.5 shrink-0 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="search"
            enterKeyHint="search"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder={t('homeSearchPlaceholder')}
            aria-label={t('homeSearchPlaceholder')}
            className="w-full min-h-[46px] bg-transparent px-2.5 text-xs sm:text-sm text-[#0C2624] dark:text-[#F5FAFA] placeholder:text-[#6B8783] dark:placeholder:text-[#A9C0BD]/70 focus:outline-none"
          />
          {queryInput && (
            <button
              type="button"
              onClick={() => {
                commitQueryImmediately('', false);
                searchInputRef.current?.focus();
              }}
              aria-label={t('searchClearSearchBtn')}
              className="min-w-[40px] min-h-[40px] mr-1 flex items-center justify-center rounded-xl text-[#4B6B67] dark:text-[#A9C0BD] hover:text-[#0C2624] dark:hover:text-[#F5FAFA] hover:bg-[#EDF5F3] dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {/* Search Type Filters (All | Shops | Products) + Outlined Filter Button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto mobile-scroll">
            {(
              [
                { id: 'all', label: t('searchTypeAll') },
                { id: 'shops', label: t('searchTypeShops') },
                { id: 'products', label: t('searchTypeProducts') },
              ] as { id: SearchTypeFilter; label: string }[]
            ).map((opt) => {
              const selected = searchType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateSearchState({ searchType: opt.id })}
                  aria-pressed={selected}
                  className={`min-h-[40px] px-3.5 rounded-xl text-xs whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                    selected
                      ? 'bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] text-[#FCFDFC] dark:text-[#031719] font-bold shadow-md shadow-[#0F4C44]/18 dark:shadow-[#00D68F]/20'
                      : 'bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] text-[#46635E] dark:text-[#A9C0BD] hover:text-[#0F4C44] dark:hover:text-[#F5FAFA] hover:border-[#0F4C44]/45 dark:hover:border-[#00D68F]/50 font-semibold shadow-xs dark:shadow-none'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={openFilterDrawer}
            aria-label={t('searchFilterBtn')}
            aria-expanded={isDrawerOpen}
            className={`min-h-[40px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
              isDrawerOpen || activeFilterCount > 0
                ? 'bg-[#E5F2EE] dark:bg-[#00D68F]/15 border-[#0F4C44] dark:border-[#00D68F] text-[#0F4C44] dark:text-[#00D68F]'
                : 'bg-[#FCFDFC] dark:bg-[#092825] border-[#0F4C44]/35 dark:border-[#00D68F]/40 hover:border-[#0F4C44] dark:hover:border-[#00D68F] text-[#0F4C44] dark:text-[#F5FAFA] shadow-xs dark:shadow-none'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#00D68F] shrink-0" />
            <span>{t('searchFilterBtn')}</span>
            {activeFilterCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-md bg-[#0F4C44] dark:bg-[#00D68F] text-[#FCFDFC] dark:text-[#031719] text-[10px] font-bold tabular-nums flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active Dismissible Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 mobile-scroll">
            {category !== 'all' && activeCategoryObj && (
              <button
                type="button"
                onClick={() => updateSearchState({ category: 'all' })}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#ECFDF5] dark:bg-[#00D68F]/15 border border-[#047857]/35 dark:border-[#00D68F]/40 text-[11px] font-semibold text-[#047857] dark:text-[#00D68F] whitespace-nowrap shrink-0"
              >
                <span>{getCategoryLabel(activeCategoryObj)}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {(committedMinPrice != null || committedMaxPrice != null) && (
              <button
                type="button"
                onClick={() => updateSearchState({ minPrice: '', maxPrice: '' })}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-teal-50 dark:bg-[#00C8D7]/15 border border-teal-300 dark:border-[#00C8D7]/40 text-[11px] font-semibold text-[#0F766E] dark:text-[#00C8D7] whitespace-nowrap shrink-0 tabular-nums"
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

            {verifiedOnly && (
              <button
                type="button"
                onClick={() => updateSearchState({ verifiedOnly: false })}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#ECFDF5] dark:bg-[#00D68F]/15 border border-[#047857]/35 dark:border-[#00D68F]/40 text-[11px] font-semibold text-[#047857] dark:text-[#00D68F] whitespace-nowrap shrink-0"
              >
                <BadgeCheck className="w-3 h-3" />
                <span>{t('verifiedMerchantLabel')}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {minShopRating != null && (
              <button
                type="button"
                onClick={() => updateSearchState({ minShopRating: null })}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-[#F59E0B]/15 border border-amber-300 dark:border-[#F59E0B]/40 text-[11px] font-semibold text-amber-800 dark:text-[#FDE68A] whitespace-nowrap shrink-0 tabular-nums"
              >
                <Star className="w-3 h-3 fill-current text-[#F59E0B]" />
                <span>{minShopRating.toFixed(1)}+</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {selectedNeighborhoods.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() =>
                  updateSearchState({
                    selectedNeighborhoods: selectedNeighborhoods.filter((item) => item !== area),
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] text-[11px] font-semibold text-[#0C2624] dark:text-[#F5FAFA] whitespace-nowrap shrink-0"
              >
                <MapPin className="w-3 h-3 text-[#047857] dark:text-[#00D68F]" />
                <span>{getLocalizedNeighborhood(area, language)}</span>
                <X className="w-3 h-3 text-[#4B6B67] dark:text-[#A9C0BD]" />
              </button>
            ))}

            {inStockOnly && (
              <button
                type="button"
                onClick={() => updateSearchState({ inStockOnly: false })}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] text-[11px] font-medium text-[#0C2624] dark:text-[#F5FAFA] whitespace-nowrap shrink-0"
              >
                <span>{t('inStockOnly')}</span>
                <X className="w-3 h-3 text-[#4B6B67] dark:text-[#A9C0BD]" />
              </button>
            )}

            {deliveryOnly && (
              <button
                type="button"
                onClick={() => updateSearchState({ deliveryOnly: false })}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] text-[11px] font-medium text-[#0C2624] dark:text-[#F5FAFA] whitespace-nowrap shrink-0"
              >
                <span>{t('deliveryAvailable')}</span>
                <X className="w-3 h-3 text-[#4B6B67] dark:text-[#A9C0BD]" />
              </button>
            )}

            {pickupOnly && (
              <button
                type="button"
                onClick={() => updateSearchState({ pickupOnly: false })}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] text-[11px] font-medium text-[#0C2624] dark:text-[#F5FAFA] whitespace-nowrap shrink-0"
              >
                <span>{t('filterPickupReady')}</span>
                <X className="w-3 h-3 text-[#4B6B67] dark:text-[#A9C0BD]" />
              </button>
            )}

            {sortBy !== 'relevance' && sortBy !== 'newest' && (
              <button
                type="button"
                onClick={() => updateSearchState({ sortBy: 'relevance' })}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] text-[11px] font-medium text-[#0C2624] dark:text-[#F5FAFA] whitespace-nowrap shrink-0"
              >
                <span>{getSortChipLabel(sortBy)}</span>
                <X className="w-3 h-3 text-[#4B6B67] dark:text-[#A9C0BD]" />
              </button>
            )}

            <button
              type="button"
              onClick={() => resetAllFilters(false)}
              className="px-2.5 py-1.5 text-[11px] font-semibold text-[#047857] dark:text-[#00D68F] hover:text-[#0F766E] dark:hover:text-[#00C8D7] whitespace-nowrap shrink-0"
            >
              {t('filterClearAllBtn')}
            </button>
          </div>
        )}
      </div>

      {/* Main Content Body */}
      <div className="px-4 pt-4 space-y-5 flex-1">
        {searchError ? (
          <div className="rounded-3xl bg-[#FCFDFC] dark:bg-[#092825] border border-rose-300 dark:border-rose-500/35 p-6 text-center space-y-3 shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-lg dark:shadow-black/25">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-display font-bold text-[#0E2421] dark:text-[#F5FAFA]">
                {t('searchErrorTitle')}
              </h2>
              <p className="text-xs text-[#46635E] dark:text-[#A9C0BD] leading-relaxed">{searchError}</p>
            </div>
            <button
              type="button"
              onClick={handleRetryCatalog}
              className="min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] text-[#FCFDFC] dark:text-[#031719] text-xs font-bold inline-flex items-center gap-2 hover:brightness-105 transition-all"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>{t('searchRetryBtn')}</span>
            </button>
          </div>
        ) : isSearching || (authLoading && products.length === 0 && shops.length === 0) ? (
          <div aria-busy="true" aria-label="Loading search results" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-44 rounded-lg bg-[#E4ECE9] dark:bg-[#092825] animate-pulse" />
              <div className="h-4 w-16 rounded-lg bg-[#E4ECE9] dark:bg-[#092825] animate-pulse" />
            </div>
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 2 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-56 h-52 shrink-0 rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] animate-pulse"
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-56 rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : !hasAnySearchOrFilter ? (
          /* Initial State */
          <div className="space-y-5">
            <section className="rounded-2xl bg-gradient-to-br from-[#E6F1ED] via-[#FCFDFC] to-[#F3F6F4] dark:from-[#092825] dark:via-[#061D1B] dark:to-[#031719] border border-[#0F4C44]/22 dark:border-[#14443F] p-4 space-y-1.5 shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none">
              <h1 className="text-lg font-display font-bold text-[#0F4C44] dark:text-[#F5FAFA] text-balance">
                {t('searchInitialTitle')}
              </h1>
              <p className="text-xs text-[#46635E] dark:text-[#A9C0BD] leading-relaxed">
                {t('searchInitialDesc')}
              </p>
            </section>

            {/* Suggested Categories */}
            <section aria-labelledby="suggested-categories-heading" className="space-y-2.5">
              <h2
                id="suggested-categories-heading"
                className="text-xs font-bold uppercase tracking-wider text-[#0F4C44] dark:text-[#A9C0BD] pb-1 border-b border-[#D2E0DC]/70 dark:border-transparent"
              >
                {t('searchSuggestedCategories')}
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {categories
                  .filter((c) => c.isActive && c.slug !== 'all')
                  .slice(0, 6)
                  .map((cat) => (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => updateSearchState({ category: cat.slug })}
                      className="min-h-[48px] px-3 py-2.5 rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/50 dark:hover:border-[#00D68F]/55 flex items-center gap-2.5 text-left transition-colors active:scale-[0.99] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.08)] dark:shadow-none"
                    >
                      <div className="w-9 h-9 rounded-xl bg-[#E5F2EE] dark:bg-[#031719] border border-[#0F4C44]/18 dark:border-[#14443F] flex items-center justify-center text-[#0F4C44] dark:text-[#00D68F] shrink-0">
                        <CategoryIcon iconName={cat.iconName} className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-[#0E2421] dark:text-[#F5FAFA] line-clamp-2 leading-tight">
                        {getCategoryLabel(cat)}
                      </span>
                    </button>
                  ))}
              </div>
            </section>

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <section aria-labelledby="recent-searches-heading" className="space-y-2.5">
                <h2
                  id="recent-searches-heading"
                  className="text-xs font-bold uppercase tracking-wider text-[#0F4C44] dark:text-[#A9C0BD] flex items-center gap-1.5"
                >
                  <History className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#00D68F]" />
                  <span>{t('recentSearches')}</span>
                </h2>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => commitQueryImmediately(term, false)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/50 dark:hover:border-[#00D68F]/55 text-xs font-medium text-[#0E2421] dark:text-[#F5FAFA] transition-colors shadow-xs dark:shadow-none"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Recently Viewed Products */}
            {recentlyViewedProducts.length > 0 && (
              <section aria-labelledby="recently-viewed-heading" className="space-y-2.5">
                <h2
                  id="recently-viewed-heading"
                  className="text-xs font-bold uppercase tracking-wider text-[#0F4C44] dark:text-[#A9C0BD]"
                >
                  {t('recentlyViewed')}
                </h2>
                <div className="flex gap-2.5 overflow-x-auto pb-1 mobile-scroll">
                  {recentlyViewedProducts.map((item) => (
                    <button
                      key={item.productId}
                      type="button"
                      onClick={() => navigate({ name: 'product', productId: item.productId })}
                      className="w-32 shrink-0 bg-[#FCFDFC] dark:bg-[#092825] rounded-2xl border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/45 dark:hover:border-[#00D68F]/50 overflow-hidden text-left transition-all shadow-[0_2px_10px_-3px_rgba(15,76,68,0.08)] dark:shadow-none"
                    >
                      <div className="aspect-[4/3] bg-[#E8EFEA] dark:bg-[#061D1B]">
                        <ResilientImage
                          src={item.imageUrl}
                          alt={item.name}
                          fallbackTitle={item.name}
                          darkSurface
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2.5">
                        <div className="text-[11px] font-semibold text-[#0E2421] dark:text-[#F5FAFA] line-clamp-1">
                          {item.name}
                        </div>
                        <div className="text-[11px] font-bold text-[#0F4C44] dark:text-[#00D68F] tabular-nums mt-0.5">
                          {formatETB(item.price)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          /* Results View */
          <div className="space-y-5">
            {/* Search Results Header */}
            <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-[#D2E0DC] dark:border-white/10">
              <div className="min-w-0">
                {hasCommittedQuery ? (
                  <h1 className="text-sm font-display font-bold text-[#0F4C44] dark:text-[#F5FAFA] break-words">
                    {t('searchShowingResultsFor', { query: debouncedQuery.trim() })}
                  </h1>
                ) : (
                  <h1 className="text-sm font-display font-bold text-[#0F4C44] dark:text-[#F5FAFA]">
                    {activeCategoryObj
                      ? getCategoryLabel(activeCategoryObj)
                      : searchType === 'shops'
                        ? t('searchShopsSectionTitle')
                        : searchType === 'products'
                          ? t('searchProductsSectionTitle')
                          : t('searchTypeAll')}
                  </h1>
                )}
                <p className="text-[11px] text-[#46635E] dark:text-[#A9C0BD] mt-0.5 tabular-nums">
                  {totalResultCount === 1
                    ? t('searchResultSingle')
                    : t('searchResultCount', { count: totalResultCount })}
                </p>
              </div>

              {(hasCommittedQuery || activeFilterCount > 0 || searchType !== 'all') && (
                <button
                  type="button"
                  onClick={() => resetAllFilters(true)}
                  className="min-h-[36px] px-2.5 rounded-lg text-xs font-semibold text-[#0F4C44] dark:text-[#00D68F] hover:text-[#047857] dark:hover:text-[#00C8D7] shrink-0 transition-colors"
                >
                  {t('searchClearSearchBtn')}
                </button>
              )}
            </div>

            {totalResultCount === 0 ? (
              /* No Results State */
              <div className="rounded-3xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] p-6 text-center space-y-4 shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#E5F2EE] dark:bg-[#031719] border border-[#0F4C44]/20 dark:border-[#14443F] flex items-center justify-center text-[#0F4C44] dark:text-[#00D68F]">
                  <Search className="w-7 h-7" />
                </div>
                <div className="space-y-1.5 max-w-xs mx-auto">
                  <h2 className="text-base font-display font-bold text-[#0E2421] dark:text-[#F5FAFA]">
                    {t('searchNoResultsTitle')}
                  </h2>
                  <p className="text-xs text-[#46635E] dark:text-[#A9C0BD] leading-relaxed">
                    {t('searchNoResultsDesc')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => resetAllFilters(true)}
                  className="min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] text-[#FCFDFC] dark:text-[#031719] text-xs font-bold inline-flex items-center justify-center gap-2 hover:brightness-105 transition-all"
                >
                  <span>{t('searchClearSearchBtn')}</span>
                </button>
              </div>
            ) : (
              <>
                {/* Shops Section */}
                {(searchType === 'all' || searchType === 'shops') && matchingShops.length > 0 && (
                  <section aria-labelledby="search-shops-heading" className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2
                        id="search-shops-heading"
                        className="text-sm font-display font-bold text-[#0C2624] dark:text-[#F5FAFA] flex items-center gap-2"
                      >
                        <Store className="w-4 h-4 text-[#047857] dark:text-[#00D68F]" />
                        <span>{t('searchShopsSectionTitle')}</span>
                        <span className="text-xs font-semibold text-[#047857] dark:text-[#00D68F] tabular-nums">
                          ({matchingShops.length})
                        </span>
                      </h2>
                      {searchType === 'all' && matchingShops.length > 2 && (
                        <button
                          type="button"
                          onClick={() => updateSearchState({ searchType: 'shops' })}
                          className="text-xs font-semibold text-[#047857] dark:text-[#00D68F] hover:text-[#0F766E] dark:hover:text-[#00C8D7] transition-colors"
                        >
                          {t('viewAll')}
                        </button>
                      )}
                    </div>

                    {searchType === 'all' ? (
                      <div className="flex gap-3 overflow-x-auto pb-1 mobile-scroll">
                        {matchingShops.map((shop) => (
                          <ShopCard
                            key={shop.shopId}
                            shop={shop}
                            variant="emeraldDark"
                            showFavorite
                            showDescription
                            showDistance={userLocation?.source === 'gps'}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
                        {matchingShops.map((shop) => (
                          <ShopCard
                            key={shop.shopId}
                            shop={shop}
                            variant="emeraldDark"
                            fullWidth
                            showFavorite
                            showDescription
                            showDistance={userLocation?.source === 'gps'}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Products Section */}
                {(searchType === 'all' || searchType === 'products') &&
                  matchingProducts.length > 0 && (
                    <section aria-labelledby="search-products-heading" className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h2
                          id="search-products-heading"
                          className="text-sm font-display font-bold text-[#0C2624] dark:text-[#F5FAFA] flex items-center gap-2"
                        >
                          <span>{t('searchProductsSectionTitle')}</span>
                          <span className="text-xs font-semibold text-[#047857] dark:text-[#00D68F] tabular-nums">
                            ({matchingProducts.length})
                          </span>
                        </h2>
                        {searchType === 'all' && matchingShops.length > 0 && (
                          <button
                            type="button"
                            onClick={() => updateSearchState({ searchType: 'products' })}
                            className="text-xs font-semibold text-[#047857] dark:text-[#00D68F] hover:text-[#0F766E] dark:hover:text-[#00C8D7] transition-colors"
                          >
                            {t('viewAll')}
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {matchingProducts.map((product) => (
                          <ProductCard
                            key={product.productId}
                            product={product}
                            variant="emeraldDark"
                          />
                        ))}
                      </div>
                    </section>
                  )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom-Sheet Advanced Filter Panel */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/55 dark:bg-black/65 backdrop-blur-xs"
          onClick={() => setIsDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="filter-drawer-heading"
        >
          <div
            className="w-full sm:max-w-md max-h-[88vh] bg-[#F3F6F4] dark:bg-[#041D1F] border-t sm:border border-[#D2E0DC] dark:border-[#14443F] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-[#B9CFC8] dark:bg-white/20" aria-hidden="true" />
            </div>

            {/* Drawer Header */}
            <div className="bg-[#FCFDFC] dark:bg-[#041D1F] border-b border-[#D2E0DC] dark:border-white/10 px-4 py-3.5 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h2
                  id="filter-drawer-heading"
                  className="text-base font-display font-bold text-[#0F4C44] dark:text-[#F5FAFA] leading-tight"
                >
                  {t('filterDrawerTitle')}
                </h2>
                <p className="text-xs text-[#46635E] dark:text-[#A9C0BD] mt-0.5 leading-snug">
                  {t('filterDrawerSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close filter drawer"
                className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center bg-[#F3F6F4] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] text-[#46635E] dark:text-[#A9C0BD] hover:text-[#0F4C44] dark:hover:text-[#F5FAFA] hover:border-[#0F4C44]/50 dark:hover:border-[#00D68F]/50 shrink-0 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Filter Sections */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* 1. Sort By */}
              <section className="bg-[#FCFDFC] dark:bg-[#092825] rounded-2xl border border-[#D2E0DC] dark:border-[#14443F] p-3.5 space-y-2.5 shadow-xs dark:shadow-none">
                <div className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">{t('sortBy')}</div>
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
                            ? 'bg-[#ECFDF5] dark:bg-[#00D68F]/15 border-[#047857] dark:border-[#00D68F] text-[#047857] dark:text-[#00D68F]'
                            : 'bg-[#F3F6F4] dark:bg-[#031719] border-[#D2E0DC] dark:border-[#14443F] text-[#4B6B67] dark:text-[#A9C0BD] hover:text-[#0C2624] dark:hover:text-[#F5FAFA] hover:border-[#047857]/45 dark:hover:border-[#00D68F]/45'
                        }`}
                      >
                        <span className="leading-tight">{option.label}</span>
                        {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 2. Category */}
              <section className="bg-[#FCFDFC] dark:bg-[#092825] rounded-2xl border border-[#D2E0DC] dark:border-[#14443F] p-3.5 space-y-2.5">
                <div className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                  {t('searchCategoryFilterTitle')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDraftCategory('all')}
                    className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold transition-colors ${
                      draftCategory === 'all'
                        ? 'bg-[#ECFDF5] dark:bg-[#00D68F]/15 border-[#047857] dark:border-[#00D68F] text-[#047857] dark:text-[#00D68F]'
                        : 'bg-[#F3F6F4] dark:bg-[#031719] border-[#D2E0DC] dark:border-[#14443F] text-[#4B6B67] dark:text-[#A9C0BD] hover:text-[#0C2624] dark:hover:text-[#F5FAFA]'
                    }`}
                  >
                    {t('all')}
                  </button>
                  {categories
                    .filter((c) => c.isActive && c.slug !== 'all')
                    .map((cat) => {
                      const active = draftCategory === cat.slug;
                      return (
                        <button
                          key={cat.slug}
                          type="button"
                          onClick={() => setDraftCategory(cat.slug)}
                          className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold transition-colors ${
                            active
                              ? 'bg-[#ECFDF5] dark:bg-[#00D68F]/15 border-[#047857] dark:border-[#00D68F] text-[#047857] dark:text-[#00D68F]'
                              : 'bg-[#F3F6F4] dark:bg-[#031719] border-[#D2E0DC] dark:border-[#14443F] text-[#4B6B67] dark:text-[#A9C0BD] hover:text-[#0C2624] dark:hover:text-[#F5FAFA]'
                          }`}
                        >
                          {getCategoryLabel(cat)}
                        </button>
                      );
                    })}
                </div>
              </section>

              {/* 3. Price Range (ETB) */}
              {searchType !== 'shops' && (
                <section className="bg-[#FCFDFC] dark:bg-[#092825] rounded-2xl border border-[#D2E0DC] dark:border-[#14443F] p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                      {t('filterPriceRangeTitle')}
                    </h3>
                    <span className="text-[11px] font-semibold text-[#047857] dark:text-[#00D68F] tabular-nums">
                      {formatETB(sliderMinVal)} – {formatETB(sliderMaxVal)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label
                        htmlFor="drawer-min-price"
                        className="block text-[11px] font-semibold text-[#4B6B67] dark:text-[#A9C0BD] mb-1"
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
                        className="w-full min-h-[44px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#14443F] bg-[#F3F6F4] dark:bg-[#031719] text-xs font-semibold tabular-nums text-[#0E2421] dark:text-[#F5FAFA] placeholder:text-[#5E7B76] dark:placeholder:text-[#A9C0BD]/50 focus:outline-none focus:ring-2 focus:ring-[#0F4C44]/20 dark:focus:ring-[#00D68F]/25 focus:border-[#0F4C44] dark:focus:border-[#00D68F]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="drawer-max-price"
                        className="block text-[11px] font-semibold text-[#4B6B67] dark:text-[#A9C0BD] mb-1"
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
                        className="w-full min-h-[44px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#14443F] bg-[#F3F6F4] dark:bg-[#031719] text-xs font-semibold tabular-nums text-[#0E2421] dark:text-[#F5FAFA] placeholder:text-[#5E7B76] dark:placeholder:text-[#A9C0BD]/50 focus:outline-none focus:ring-2 focus:ring-[#0F4C44]/20 dark:focus:ring-[#00D68F]/25 focus:border-[#0F4C44] dark:focus:border-[#00D68F]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
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
                      className="w-full accent-[#047857] dark:accent-[#00D68F] cursor-pointer"
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
                      className="w-full accent-[#047857] dark:accent-[#00D68F] cursor-pointer"
                    />
                  </div>

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
                          className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold tabular-nums transition-colors ${
                            isSelected
                              ? 'bg-[#ECFDF5] dark:bg-[#00D68F]/15 border-[#047857] dark:border-[#00D68F] text-[#047857] dark:text-[#00D68F]'
                              : 'bg-[#F3F6F4] dark:bg-[#031719] border-[#D2E0DC] dark:border-[#14443F] text-[#4B6B67] dark:text-[#A9C0BD] hover:text-[#0C2624] dark:hover:text-[#F5FAFA] hover:border-[#047857]/45 dark:hover:border-[#00D68F]/45'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 4. Merchant Verification & Rating */}
              <section className="bg-[#FCFDFC] dark:bg-[#092825] rounded-2xl border border-[#D2E0DC] dark:border-[#14443F] p-3.5 space-y-3">
                <button
                  type="button"
                  onClick={() => setDraftVerifiedOnly((v) => !v)}
                  className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 text-left transition-colors ${
                    draftVerifiedOnly
                      ? 'bg-[#ECFDF5] dark:bg-[#00D68F]/15 border-[#047857] dark:border-[#00D68F] text-[#047857] dark:text-[#00D68F]'
                      : 'bg-[#F3F6F4] dark:bg-[#031719] border-[#D2E0DC] dark:border-[#14443F] text-[#0C2624] dark:text-[#F5FAFA] hover:border-[#047857]/45 dark:hover:border-[#00D68F]/45'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BadgeCheck className="w-4 h-4 text-[#047857] dark:text-[#00D68F] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold">{t('searchVerifiedMerchantsOnly')}</div>
                      <div className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] truncate">
                        {t('searchVerifiedMerchantsHint')}
                      </div>
                    </div>
                  </div>
                  {draftVerifiedOnly && <Check className="w-4 h-4 shrink-0" />}
                </button>

                <div className="space-y-2 pt-1">
                  <div>
                    <h3 className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                      {t('filterShopRatingTitle')}
                    </h3>
                    <p className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] mt-0.5">
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
                              ? 'bg-amber-50 dark:bg-[#F59E0B]/15 border-amber-500 dark:border-[#F59E0B] text-amber-800 dark:text-[#FDE68A]'
                              : 'bg-[#F3F6F4] dark:bg-[#031719] border-[#D2E0DC] dark:border-[#14443F] text-[#4B6B67] dark:text-[#A9C0BD] hover:text-[#0C2624] dark:hover:text-[#F5FAFA] hover:border-amber-400 dark:hover:border-[#F59E0B]/45'
                          }`}
                        >
                          {opt.value != null && <Star className="w-3.5 h-3.5 fill-current text-[#F59E0B] shrink-0" />}
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* 5. Stock & Handoff Availability */}
              <section className="bg-[#FCFDFC] dark:bg-[#092825] rounded-2xl border border-[#D2E0DC] dark:border-[#14443F] p-3.5 space-y-2.5">
                <h3 className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                  {t('filterFulfillmentTitle')}
                </h3>
                <div className="space-y-2">
                  {searchType !== 'shops' && (
                    <button
                      type="button"
                      onClick={() => setDraftInStockOnly((v) => !v)}
                      className={`w-full min-h-[44px] px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold transition-colors ${
                        draftInStockOnly
                          ? 'bg-[#ECFDF5] dark:bg-[#00D68F]/15 border-[#047857] dark:border-[#00D68F] text-[#047857] dark:text-[#00D68F]'
                          : 'bg-[#F3F6F4] dark:bg-[#031719] border-[#D2E0DC] dark:border-[#14443F] text-[#4B6B67] dark:text-[#A9C0BD] hover:text-[#0C2624] dark:hover:text-[#F5FAFA]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <PackageCheck className="w-4 h-4 shrink-0" />
                        <span>{t('inStockOnly')}</span>
                      </span>
                      {draftInStockOnly && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setDraftDeliveryOnly((v) => !v)}
                    className={`w-full min-h-[44px] px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold transition-colors ${
                      draftDeliveryOnly
                        ? 'bg-[#ECFDF5] dark:bg-[#00D68F]/15 border-[#047857] dark:border-[#00D68F] text-[#047857] dark:text-[#00D68F]'
                        : 'bg-[#F3F6F4] dark:bg-[#031719] border-[#D2E0DC] dark:border-[#14443F] text-[#4B6B67] dark:text-[#A9C0BD] hover:text-[#0C2624] dark:hover:text-[#F5FAFA]'
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
                        ? 'bg-[#ECFDF5] dark:bg-[#00D68F]/15 border-[#047857] dark:border-[#00D68F] text-[#047857] dark:text-[#00D68F]'
                        : 'bg-[#F3F6F4] dark:bg-[#031719] border-[#D2E0DC] dark:border-[#14443F] text-[#4B6B67] dark:text-[#A9C0BD] hover:text-[#0C2624] dark:hover:text-[#F5FAFA]'
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

              {/* 6. Hawassa Neighborhood Availability */}
              <section className="bg-[#FCFDFC] dark:bg-[#092825] rounded-2xl border border-[#D2E0DC] dark:border-[#14443F] p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA]">
                      {t('filterNeighborhoodAvailabilityTitle')}
                    </h3>
                    <p className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] mt-0.5">
                      {t('filterSelectAreasHint')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraftNeighborhoods([])}
                    className={`min-h-[36px] px-2.5 py-1 rounded-xl border text-[11px] font-semibold shrink-0 transition-colors ${
                      draftNeighborhoods.length === 0
                        ? 'bg-[#ECFDF5] dark:bg-[#00D68F]/15 border-[#047857] dark:border-[#00D68F] text-[#047857] dark:text-[#00D68F]'
                        : 'bg-[#F3F6F4] dark:bg-[#031719] border-[#D2E0DC] dark:border-[#14443F] text-[#4B6B67] dark:text-[#A9C0BD]'
                    }`}
                  >
                    {t('allHawassa')}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {HAWASSA_NEIGHBORHOODS.map((area) => {
                    const active = draftNeighborhoods.includes(area);
                    const stats = neighborhoodStats[area] ?? { shopCount: 0, productCount: 0 };
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => toggleDraftNeighborhood(area)}
                        className={`min-h-[48px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                          active
                            ? 'bg-[#ECFDF5] dark:bg-[#00D68F]/15 border-[#047857] dark:border-[#00D68F]'
                            : 'bg-[#F3F6F4] dark:bg-[#031719] border-[#D2E0DC] dark:border-[#14443F] hover:border-[#047857]/45 dark:hover:border-[#00D68F]/45'
                        }`}
                      >
                        <div className="min-w-0">
                          <div
                            className={`text-xs font-semibold truncate ${
                              active ? 'text-[#047857] dark:text-[#00D68F]' : 'text-[#0C2624] dark:text-[#F5FAFA]'
                            }`}
                          >
                            {getLocalizedNeighborhood(area, language)}
                          </div>
                          <div className="text-[11px] text-[#4B6B67] dark:text-[#A9C0BD] tabular-nums">
                            {t('filterNeighborhoodStats', {
                              shops: stats.shopCount,
                              products: stats.productCount,
                            })}
                          </div>
                        </div>
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                            active
                              ? 'bg-[#0F4C44] dark:bg-[#00D68F] border-[#0F4C44] dark:border-[#00D68F] text-[#FCFDFC] dark:text-[#031719]'
                              : 'border-[#D2E0DC] dark:border-[#14443F] bg-[#FCFDFC] dark:bg-[#041D1F]'
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Sticky Bottom Sheet Footer */}
            <div className="bg-[#FCFDFC] dark:bg-[#041D1F] border-t border-[#D2E0DC] dark:border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={clearDraftFilters}
                className="min-h-[44px] px-4 rounded-xl border border-[#D2E0DC] dark:border-[#14443F] bg-[#F3F6F4] dark:bg-[#092825] hover:border-[#0F4C44]/50 dark:hover:border-[#00D68F]/50 text-xs font-semibold text-[#0E2421] dark:text-[#F5FAFA] shrink-0 transition-colors"
              >
                {t('searchResetFiltersBtn')}
              </button>
              <button
                type="button"
                onClick={applyDraftFilters}
                className="flex-1 min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 text-[#FCFDFC] dark:text-[#031719] text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#0F4C44]/18 dark:shadow-[#00D68F]/20 transition-all tabular-nums"
              >
                <span>{t('searchApplyFiltersBtn')}</span>
                <span>({draftResultsCount})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
