import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Heart, ShoppingBag } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { EmptyState, ProductCard } from '../components/SharedUI';
import { formatETB } from '../utils/marketplaceLogic';
import type { Product, SharedWishlist } from '../types';

export const SharedWishlistScreen: React.FC<{
  shareId: string;
  fallbackProductIds?: string[];
}> = ({ shareId, fallbackProductIds }) => {
  const {
    goBack,
    navigate,
    products,
    favorites,
    loadSharedWishlist,
    saveWishlistToFavorites,
    addWishlistToCart,
    t,
  } = useMarketplace();

  const [wishlist, setWishlist] = useState<SharedWishlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedAll, setSavedAll] = useState(false);

  const fallbackKey = fallbackProductIds?.join(',') ?? '';

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSavedAll(false);

    loadSharedWishlist(shareId, fallbackProductIds)
      .then((result) => {
        if (!active) return;
        setWishlist(result);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setWishlist(null);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [shareId, fallbackKey]);

  const matchedProducts = useMemo(() => {
    if (!wishlist) return [];
    const byId = new Map(
      products
        .filter((p) => p.status === 'active')
        .map((p) => [p.productId, p])
    );
    return wishlist.productIds
      .map((id) => byId.get(id))
      .filter((p): p is Product => Boolean(p));
  }, [wishlist, products]);

  const availableProducts = useMemo(
    () => matchedProducts.filter((p) => p.isAvailable && p.stock > 0),
    [matchedProducts]
  );

  const estimatedTotal = useMemo(
    () => matchedProducts.reduce((sum, p) => sum + p.price, 0),
    [matchedProducts]
  );

  const allAlreadySaved =
    matchedProducts.length > 0 &&
    matchedProducts.every((p) => favorites.includes(p.productId));

  const handleAddAllToCart = () => {
    if (availableProducts.length === 0) return;
    const added = addWishlistToCart(availableProducts.map((p) => p.productId));
    if (added > 0) {
      navigate({ name: 'cart' });
    }
  };

  const handleSaveAllFavorites = () => {
    if (matchedProducts.length === 0) return;
    saveWishlistToFavorites(matchedProducts.map((p) => p.productId));
    setSavedAll(true);
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.location.search.includes('wishlist=')) {
      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, '', cleanUrl);
    }
    goBack();
  };

  return (
    <div className="pb-8">
      <header className="sticky top-0 z-20 bg-white dark:bg-[#1C2420] border-b border-[#E7E5E4] dark:border-[#2A3630] px-3 py-2 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Go back"
          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-display font-bold text-stone-900 dark:text-stone-100">
          {t('sharedWishlistTitle')}
        </h1>
        <div className="w-11" />
      </header>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-32 rounded-2xl bg-[#E7E5E4]/70 dark:bg-[#2A3630] animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-52 rounded-2xl bg-[#E7E5E4]/70 dark:bg-[#2A3630] animate-pulse" />
              <div className="h-52 rounded-2xl bg-[#E7E5E4]/70 dark:bg-[#2A3630] animate-pulse" />
            </div>
          </div>
        ) : !wishlist || matchedProducts.length === 0 ? (
          <EmptyState
            icon={<Heart className="w-6 h-6" />}
            title={t('wishlistNotFoundTitle')}
            description={t('wishlistNotFoundDesc')}
            actionLabel={t('browseMarketplace')}
            onAction={() => navigate({ name: 'home' })}
          />
        ) : (
          <>
            <section className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm p-4 space-y-3">
              <div>
                <h2 className="text-base font-display font-bold text-stone-900 dark:text-stone-100">
                  {wishlist.title}
                </h2>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-600 dark:text-stone-300 mt-1 tabular-nums">
                  <span>{t('sharedByLabel', { name: wishlist.ownerName })}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {matchedProducts.length}{' '}
                    {matchedProducts.length === 1 ? t('itemSingle') : t('itemPlural')}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-stone-900 dark:text-stone-100">
                    {t('estimatedTotalLabel')}: {formatETB(estimatedTotal)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  disabled={availableProducts.length === 0}
                  onClick={handleAddAllToCart}
                  className="min-h-[44px] flex-1 px-4 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-2 disabled:bg-stone-200 dark:disabled:bg-[#2A3630] disabled:text-stone-400 dark:disabled:text-stone-500 transition-colors whitespace-nowrap"
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  <span>{t('addAllToCart', { count: availableProducts.length })}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAllFavorites}
                  className={`min-h-[44px] flex-1 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                    savedAll || allAlreadySaved
                      ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 border-[#047857]/30 dark:border-[#10B981]/40 text-[#047857] dark:text-[#10B981]'
                      : 'bg-white dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] text-stone-800 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#1C2420]'
                  }`}
                >
                  {savedAll || allAlreadySaved ? (
                    <>
                      <Check className="w-4 h-4 shrink-0 text-[#047857] dark:text-[#10B981]" />
                      <span>{t('savedAllFavorites')}</span>
                    </>
                  ) : (
                    <>
                      <Heart className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                      <span>{t('saveAllFavorites')}</span>
                    </>
                  )}
                </button>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
              {matchedProducts.map((product) => (
                <ProductCard key={product.productId} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
