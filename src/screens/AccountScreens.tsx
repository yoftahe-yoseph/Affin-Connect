import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  Bell,
  BellRing,
  Check,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  Heart,
  HelpCircle,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  PackageCheck,
  Phone,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import {
  CategoryIcon,
  EmptyState,
  getCategoryCardTheme,
  ProductCard,
  ResilientImage,
} from '../components/SharedUI';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { AuthSignInPanel } from '../components/AuthSignInPanel';
import { getLocalizedNeighborhood, LANGUAGE_OPTIONS } from '../constants/translations';
import {
  buildSocialShareUrls,
  formatETB,
  HAWASSA_NEIGHBORHOODS,
  validateAddressInput,
} from '../utils/marketplaceLogic';
import type { SharedWishlist } from '../types';

export const CategoriesScreen: React.FC = () => {
  const { goBack, navigate, categories, products, language, t } = useMarketplace();

  return (
    <div className="min-h-full bg-[#F3F6F4] dark:bg-[#031719] text-[#0E2421] dark:text-[#F5FAFA] pb-8 transition-colors">
      <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 dark:bg-[#031719]/92 backdrop-blur-md border-b border-[#D2E0DC] dark:border-white/10 shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#0F4C44] dark:text-[#F5FAFA] hover:bg-[#EBF1EE] dark:hover:bg-[#092825] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-display font-bold text-[#0F4C44] dark:text-[#F5FAFA]">{t('categories')}</h1>
        <ThemeToggleButton />
      </header>

      <div className="p-4 grid grid-cols-2 gap-3">
        {categories
          .filter((c) => c.isActive)
          .map((cat, idx) => {
            const count = products.filter(
              (p) => p.category === cat.slug && p.status === 'active'
            ).length;
            const theme = getCategoryCardTheme(cat.slug, idx);
            const label =
              language === 'am'
                ? cat.nameAm
                : language === 'om'
                ? cat.nameOm
                : language === 'sid'
                ? cat.nameSid || cat.name
                : cat.name;
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => navigate({ name: 'search', initialCategory: cat.slug })}
                className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${theme.surface} border ${theme.border} shadow-sm dark:shadow-lg dark:shadow-black/25 p-4 text-left flex flex-col justify-between gap-4 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857] dark:focus-visible:ring-[#00D68F]`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute -top-6 -right-6 w-24 h-24 rounded-full blur-xl opacity-75 group-hover:opacity-100 transition-opacity pointer-events-none ${theme.glow}`}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/60 dark:via-white/25 to-transparent pointer-events-none"
                />

                <div className="relative z-10 w-full flex items-start justify-between gap-2">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${theme.iconBox}`}
                  >
                    <CategoryIcon iconName={cat.iconName} className="w-5 h-5" />
                  </div>
                  <ArrowUpRight
                    aria-hidden="true"
                    className={`w-4 h-4 opacity-65 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 ${theme.arrow}`}
                  />
                </div>

                <div className="relative z-10 space-y-1.5">
                  <div className="text-xs font-bold text-[#0C2624] dark:text-[#F5FAFA] leading-snug">{label}</div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      aria-hidden="true"
                      className={`h-0.5 w-7 group-hover:w-11 rounded-full bg-gradient-to-r ${theme.accentBar} transition-all duration-200`}
                    />
                    <span className="text-[11px] font-medium text-[#4B6B67] dark:text-[#A9C0BD] tabular-nums">
                      {count === 1
                        ? t('listingCount', { count })
                        : t('listingsCount', { count })}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
};

export const FavoritesScreen: React.FC = () => {
  const {
    goBack,
    navigate,
    favorites,
    products,
    followedShops,
    toggleFollowShop,
    shareWishlist,
    shops,
    language,
    t,
  } = useMarketplace();
  const [tab, setTab] = useState<'products' | 'shops'>('products');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [wishlistTitle, setWishlistTitle] = useState('');
  const [shareResult, setShareResult] = useState<{
    wishlist: SharedWishlist;
    shareUrl: string;
  } | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const favProducts = products.filter(
    (p) => favorites.includes(p.productId) && p.status === 'active'
  );
  const followedShopList = shops.filter(
    (s) => followedShops.includes(s.shopId) && s.status === 'approved'
  );

  const generateOrUpdateShare = async (customTitle?: string) => {
    setShareLoading(true);
    setShareError(null);
    try {
      const nextTitle = (customTitle ?? wishlistTitle).trim() || t('wishlistDefaultTitle');
      const result = await shareWishlist(nextTitle);
      setShareResult(result);
      setWishlistTitle(result.wishlist.title);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not create share link.');
    } finally {
      setShareLoading(false);
    }
  };

  const handleOpenShareModal = () => {
    const initialTitle = wishlistTitle.trim() || t('wishlistDefaultTitle');
    setWishlistTitle(initialTitle);
    setCopiedLink(false);
    setShareModalOpen(true);
    void generateOrUpdateShare(initialTitle);
  };

  const handleCopyLink = async () => {
    if (!shareResult?.shareUrl) return;
    try {
      await navigator.clipboard?.writeText(shareResult.shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2400);
    } catch {
      setCopiedLink(false);
    }
  };

  const handleNativeShare = async () => {
    if (!shareResult || typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      return;
    }
    try {
      await navigator.share({
        title: shareResult.wishlist.title,
        text: `${shareResult.wishlist.title} (${favProducts.length} ${
          favProducts.length === 1 ? t('itemSingle') : t('itemPlural')
        })`,
        url: shareResult.shareUrl,
      });
    } catch {
      // User canceled native share sheet
    }
  };

  const socialUrls = shareResult
    ? buildSocialShareUrls(
        shareResult.shareUrl,
        shareResult.wishlist.title,
        favProducts.length
      )
    : null;

  const supportsNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="min-h-full bg-[#F3F6F4] dark:bg-transparent pb-6">
      <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 dark:bg-[#1C2420] backdrop-blur-md border-b border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none px-3 pt-2 pb-2.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#0F4C44] dark:text-stone-300 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-display font-bold text-[#0F4C44] dark:text-stone-100">{t('savedFavorites')}</h1>
          <div className="w-11" />
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] rounded-xl">
          <button
            type="button"
            onClick={() => setTab('products')}
            className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'products'
                ? 'bg-[#0F4C44] dark:bg-[#10B981]/15 text-[#FCFDFC] dark:text-[#10B981] shadow-xs'
                : 'text-[#46635E] dark:text-stone-400 hover:text-[#0E2421] dark:hover:text-stone-100'
            }`}
          >
            {t('savedProductsTab')} ({favProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('shops')}
            className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'shops'
                ? 'bg-[#0F4C44] dark:bg-[#10B981]/15 text-[#FCFDFC] dark:text-[#10B981] shadow-xs'
                : 'text-[#46635E] dark:text-stone-400 hover:text-[#0E2421] dark:hover:text-stone-100'
            }`}
          >
            {t('followedShopsTab')} ({followedShopList.length})
          </button>
        </div>
      </header>

      <div className="p-4">
        {tab === 'products' ? (
          favProducts.length === 0 ? (
            <EmptyState
              icon={<Heart className="w-6 h-6" />}
              title="No saved items yet"
              description="Tap the heart icon on any product in Hawasa Gebeya to save it here."
              actionLabel="Explore Products"
              onAction={() => navigate({ name: 'home' })}
            />
          ) : (
            <div className="space-y-3">
              <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#0E2421] dark:text-stone-100 truncate">
                    {t('shareWishlistModalTitle')}
                  </div>
                  <p className="text-[11px] text-[#46635E] dark:text-stone-400 mt-0.5 line-clamp-2">
                    {t('shareWishlistDesc')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenShareModal}
                  className="min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] hover:brightness-105 dark:bg-none dark:bg-[#10B981] dark:hover:bg-[#059669] text-[#FCFDFC] dark:text-[#0B1410] text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4 shrink-0" />
                  <span>{t('shareWishlist')}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {favProducts.map((p) => (
                  <ProductCard key={p.productId} product={p} />
                ))}
              </div>
            </div>
          )
        ) : followedShopList.length === 0 ? (
          <EmptyState
            icon={<Store className="w-6 h-6" />}
            title={t('noFollowedShops')}
            description={t('noFollowedShopsDesc')}
            actionLabel={t('browseMarketplace')}
            onAction={() => navigate({ name: 'home' })}
          />
        ) : (
          <div className="space-y-3">
            {followedShopList.map((shop) => (
              <div
                key={shop.shopId}
                className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none hover:shadow-md transition-all p-3.5 flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => navigate({ name: 'shop', shopId: shop.shopId })}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#F3F6F4] dark:bg-[#141A17] shrink-0 border border-[#D2E0DC] dark:border-[#2A3630]">
                    <ResilientImage src={shop.logoUrl} alt={shop.name} fallbackTitle={shop.name} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#0E2421] dark:text-stone-100 truncate">{shop.name}</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#46635E] dark:text-stone-400 mt-0.5 tabular-nums">
                      <span>{getLocalizedNeighborhood(shop.neighborhood, language)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="flex items-center gap-0.5 text-[#0E2421] dark:text-stone-300 font-medium">
                        <Star className="w-3 h-3 fill-[#D97706] text-[#D97706] dark:fill-[#F59E0B] dark:text-[#F59E0B]" />
                        {shop.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => toggleFollowShop(shop.shopId)}
                  className="px-3 py-1.5 rounded-xl bg-[#0F4C44] hover:bg-[#047857] dark:bg-[#10B981] dark:hover:bg-[#059669] text-[#FCFDFC] dark:text-[#0B1410] text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors"
                >
                  <Check className="w-3 h-3" />
                  <span>{t('followingShop')}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {shareModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-wishlist-title"
          className="fixed inset-0 z-50 bg-stone-950/50 dark:bg-black/75 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full max-w-md bg-[#FCFDFC] dark:bg-[#1C2420] rounded-t-3xl sm:rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] p-4 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <h2
                id="share-wishlist-title"
                className="text-sm font-display font-bold text-[#0F4C44] dark:text-stone-100"
              >
                {t('shareWishlistModalTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                aria-label="Close"
                className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#46635E] dark:text-stone-400 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#46635E] dark:text-stone-300 leading-relaxed">{t('shareWishlistDesc')}</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void generateOrUpdateShare(wishlistTitle);
              }}
              className="space-y-1.5"
            >
              <label
                htmlFor="wishlist-title-input"
                className="block text-[11px] font-semibold text-[#0E2421] dark:text-stone-300"
              >
                {t('wishlistNameLabel')}
              </label>
              <div className="flex gap-2">
                <input
                  id="wishlist-title-input"
                  type="text"
                  maxLength={120}
                  value={wishlistTitle}
                  onChange={(e) => setWishlistTitle(e.target.value)}
                  placeholder={t('wishlistDefaultTitle')}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100 placeholder:text-[#5E7B76] dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
                />
                <button
                  type="submit"
                  disabled={shareLoading}
                  className="min-h-[44px] px-3.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-transparent text-xs font-semibold text-[#0E2421] dark:text-stone-200 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17] shrink-0 whitespace-nowrap disabled:opacity-50"
                >
                  {t('save')}
                </button>
              </div>
            </form>

            {shareError && <p className="text-xs text-rose-600 dark:text-rose-400">{shareError}</p>}

            {shareLoading && !shareResult ? (
              <div className="py-4 text-center text-xs text-stone-500 dark:text-stone-400">
                {t('generatingLink')}
              </div>
            ) : (
              shareResult &&
              socialUrls && (
                <>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="wishlist-share-url"
                      className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300"
                    >
                      {t('wishlistUniqueLink')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="wishlist-share-url"
                        type="text"
                        readOnly
                        value={shareResult.shareUrl}
                        onFocus={(e) => e.currentTarget.select()}
                        className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-200 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="min-h-[44px] px-3.5 rounded-xl bg-[#0F4C44] dark:bg-[#2A3630] text-[#FCFDFC] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#047857] dark:hover:bg-[#34423B] shrink-0 whitespace-nowrap"
                      >
                        {copiedLink ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#10B981]" />
                            <span>{t('linkCopied')}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{t('copyWishlistLink')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-[#0E2421] dark:text-stone-300">
                      {t('shareOnSocial')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={socialUrls.whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] px-3 rounded-xl border border-[#0F4C44]/25 dark:border-[#10B981]/30 bg-[#E5F2EE] dark:bg-[#10B981]/15 text-[#0F4C44] dark:text-[#10B981] text-xs font-semibold flex items-center justify-between hover:bg-[#D5EBE4] dark:hover:bg-[#10B981]/25 transition-colors"
                      >
                        <span>WhatsApp</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                      <a
                        href={socialUrls.telegram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] px-3 rounded-xl border border-[#D2E0DC] dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/50 text-sky-900 dark:text-sky-300 text-xs font-semibold flex items-center justify-between hover:bg-sky-100/70 dark:hover:bg-sky-950/80 transition-colors"
                      >
                        <span>Telegram</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                      <a
                        href={socialUrls.x}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-[#0E2421] dark:text-stone-100 text-xs font-semibold flex items-center justify-between hover:bg-[#EBF1EE] dark:hover:bg-[#2A3630] transition-colors"
                      >
                        <span>X (Twitter)</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                      <a
                        href={socialUrls.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] px-3 rounded-xl border border-[#D2E0DC] dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/50 text-blue-900 dark:text-blue-300 text-xs font-semibold flex items-center justify-between hover:bg-blue-100/70 dark:hover:bg-blue-950/80 transition-colors"
                      >
                        <span>Facebook</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    {supportsNativeShare && (
                      <button
                        type="button"
                        onClick={handleNativeShare}
                        className="min-h-[44px] w-full px-4 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] hover:brightness-105 dark:bg-none dark:bg-[#10B981] dark:hover:bg-[#059669] text-[#FCFDFC] dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                      >
                        <Share2 className="w-4 h-4 shrink-0" />
                        <span>{t('shareViaDevice')}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShareModalOpen(false);
                        navigate({
                          name: 'shared_wishlist',
                          shareId: shareResult.wishlist.shareId,
                          fallbackProductIds: shareResult.wishlist.productIds,
                        });
                      }}
                      className="min-h-[44px] w-full px-4 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-transparent text-xs font-semibold text-[#0E2421] dark:text-stone-200 flex items-center justify-center gap-2 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17] transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 shrink-0" />
                      <span>{t('previewSharedWishlist')}</span>
                    </button>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const NotificationsScreen: React.FC = () => {
  const {
    goBack,
    navigate,
    notifications,
    markNotificationRead,
    priceAlerts,
    removePriceAlert,
    products,
    nearbyAlertsEnabled,
    toggleNearbyAlerts,
    triggerNearbyDiscountAlert,
    nearbyDeals,
    pushPermission,
    t,
  } = useMarketplace();

  return (
    <div className="min-h-full bg-[#F3F6F4] dark:bg-transparent pb-6">
      <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 dark:bg-[#1C2420] backdrop-blur-md border-b border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none px-3 py-2 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#0F4C44] dark:text-stone-300 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-display font-bold text-[#0F4C44] dark:text-stone-100">{t('notifications')}</h1>
        <div className="w-11" />
      </header>

      <div className="p-4 space-y-4">
        <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-[#0F4C44] dark:text-stone-100 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#10B981] shrink-0" />
                <span>{t('nearbyDealsAlertTitle')}</span>
              </h2>
              <p className="text-[11px] text-[#46635E] dark:text-stone-400 mt-0.5 leading-relaxed">
                {t('nearbyDealsAlertDesc')}
              </p>
              <div className="text-[11px] font-medium text-[#047857] dark:text-[#10B981] mt-1 tabular-nums">
                {t('nearbyActiveDealsCount', { count: nearbyDeals.length })}
                {pushPermission === 'denied' ? ` · ${t('nearbyAlertsPermissionDenied')}` : ''}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void toggleNearbyAlerts()}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                nearbyAlertsEnabled
                  ? 'bg-[#E5F2EE] dark:bg-[#10B981]/15 border-[#0F4C44]/30 dark:border-[#10B981]/40 text-[#0F4C44] dark:text-[#10B981]'
                  : 'bg-[#0F4C44] hover:bg-[#047857] dark:bg-[#10B981] dark:hover:bg-[#059669] border-[#0F4C44] text-[#FCFDFC] dark:text-[#0B1410]'
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
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-[11px] font-semibold text-[#0E2421] dark:text-stone-200 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B] shrink-0" />
              <span>{t('testNearbyAlertBtn')}</span>
            </button>
          </div>
        </section>

        {priceAlerts.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981]" />
                <span>{t('priceAlertsSectionTitle')}</span>
              </h2>
              <span className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                {priceAlerts.length}
              </span>
            </div>

            <div className="space-y-2">
              {priceAlerts.map((alert) => {
                const liveProd = products.find((p) => p.productId === alert.productId);
                const currentPrice = liveProd?.price ?? alert.baselinePrice;
                const triggered = alert.status === 'triggered';
                return (
                  <div
                    key={alert.alertId}
                    className={`rounded-2xl border p-3 flex items-center justify-between gap-2.5 shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none ${
                      triggered
                        ? 'bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border-[#FDE68A] dark:border-[#F59E0B]/30'
                        : 'bg-[#FCFDFC] dark:bg-[#1C2420] border-[#D2E0DC] dark:border-[#2A3630]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => navigate({ name: 'product', productId: alert.productId })}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                    >
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] shrink-0">
                        <ResilientImage
                          src={alert.productImageUrl ?? liveProd?.imageUrl ?? ''}
                          alt={alert.productName}
                          fallbackTitle={alert.productName}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#0E2421] dark:text-stone-100 truncate">
                          {alert.productName}
                        </div>
                        <div className="text-[11px] text-[#46635E] dark:text-stone-400 mt-0.5 flex items-center gap-1.5 flex-wrap tabular-nums">
                          <span>{t('priceAlertTargetShort', { amount: formatETB(alert.targetPrice) })}</span>
                          <span aria-hidden="true">·</span>
                          <span className={triggered ? 'font-bold text-[#92400E] dark:text-[#F59E0B]' : 'text-[#0F4C44] dark:text-[#10B981] font-semibold'}>
                            {triggered ? `${formatETB(currentPrice)} (${t('priceAlertTriggeredBadge')})` : formatETB(currentPrice)}
                          </span>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void removePriceAlert(alert.alertId)}
                      aria-label={t('priceAlertRemoveBtn')}
                      className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#5E7B76] dark:text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17] shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="space-y-2.5">
          {notifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="w-6 h-6" />}
              title="You are all caught up"
              description="Order status updates and price drop alerts will appear here."
            />
          ) : (
            notifications.map((n) => (
              <button
                key={n.notificationId}
                type="button"
                onClick={() => {
                  markNotificationRead(n.notificationId);
                  if (n.orderId) navigate({ name: 'orders', selectedOrderId: n.orderId });
                  else if (n.productId) navigate({ name: 'product', productId: n.productId });
                  else if (n.shopId) navigate({ name: 'shop', shopId: n.shopId });
                }}
                className={`w-full p-3.5 rounded-2xl border text-left shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none transition-colors ${
                  n.isRead
                    ? 'bg-[#FCFDFC] dark:bg-[#1C2420] border-[#D2E0DC] dark:border-[#2A3630]'
                    : n.type === 'price_alert'
                    ? 'bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border-[#FDE68A] dark:border-[#F59E0B]/30'
                    : 'bg-[#E5F2EE] dark:bg-[#10B981]/10 border-[#0F4C44]/25 dark:border-[#10B981]/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100">{n.title}</span>
                  {!n.isRead && (
                    <span className={`text-[10px] font-bold ${
                      n.type === 'price_alert'
                        ? 'text-[#D97706] dark:text-[#F59E0B]'
                        : 'text-[#047857] dark:text-[#10B981]'
                    }`}>
                      New
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-300 mt-1 leading-relaxed">{n.message}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const ProfileScreen: React.FC<{ section?: 'main' | 'addresses' | 'settings' | 'help' }> = ({
  section = 'main',
}) => {
  const {
    navigate,
    firebaseUser,
    userProfile,
    needsEmailVerification,
    openAuthScreen,
    signOutUser,
    language,
    addresses,
    saveAddress,
    deleteAddress,
    favorites,
    loyaltyBalance,
    unreadNotificationCount,
    setActiveRoleView,
    canAccessSeller,
    canAccessAdmin,
    developerMode,
    setDeveloperMode,
    nearbyAlertsEnabled,
    toggleNearbyAlerts,
    triggerNearbyDiscountAlert,
    nearbyDeals,
    pushPermission,
    openTradeChatInbox,
    tradeChats,
    openChatbot,
    t,
  } = useMarketplace();
  const activeLanguageLabel =
    LANGUAGE_OPTIONS.find((opt) => opt.code === language)?.label ?? language.toUpperCase();

  const [subView, setSubView] = useState<'main' | 'addresses' | 'settings' | 'help'>(section);
  useEffect(() => {
    setSubView(section);
  }, [section]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [label, setLabel] = useState('Home');
  const [recipientName, setRecipientName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState<string>(HAWASSA_NEIGHBORHOODS[0]);
  const [streetOrLandmark, setStreetOrLandmark] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateAddressInput({
      label,
      recipientName,
      phoneNumber,
      neighborhood,
      streetOrLandmark,
    });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    await saveAddress({
      label: label.trim(),
      recipientName: recipientName.trim(),
      phoneNumber: phoneNumber.trim(),
      city: 'Hawassa',
      neighborhood,
      streetOrLandmark: streetOrLandmark.trim(),
      isDefault: addresses.length === 0,
    });
    setRecipientName('');
    setPhoneNumber('');
    setStreetOrLandmark('');
    setShowAddForm(false);
  };

  if (subView === 'addresses') {
    return (
      <div className="min-h-full bg-[#F3F6F4] dark:bg-transparent pb-6">
        <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 dark:bg-[#1C2420] backdrop-blur-md border-b border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none px-3 py-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSubView('main')}
            aria-label="Back to account"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#0F4C44] dark:text-stone-300 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-display font-bold text-[#0F4C44] dark:text-stone-100">Saved Addresses</h1>
          <button
            type="button"
            onClick={() => setShowAddForm((s) => !s)}
            className="text-xs font-semibold text-[#0F4C44] dark:text-[#10B981] px-2"
          >
            {showAddForm ? 'Close' : '+ Add'}
          </button>
        </header>

        <div className="p-4 space-y-3">
          {showAddForm && (
            <form
              onSubmit={handleAddAddress}
              className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-2.5"
            >
              <h2 className="text-xs font-bold text-[#0F4C44] dark:text-stone-100">New Hawassa Address</h2>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label (Home, Office)"
                className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100 placeholder:text-[#5E7B76] dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
              />
              {errors.label && <p className="text-[11px] text-rose-600 dark:text-rose-400">{errors.label}</p>}

              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Recipient Name"
                className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100 placeholder:text-[#5E7B76] dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
              />
              {errors.recipientName && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">{errors.recipientName}</p>
              )}

              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Phone (e.g. 0911234567)"
                className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100 placeholder:text-[#5E7B76] dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
              />
              {errors.phoneNumber && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">{errors.phoneNumber}</p>
              )}

              <select
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] text-xs bg-[#F3F6F4] dark:bg-[#141A17] text-[#0E2421] dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
              >
                {HAWASSA_NEIGHBORHOODS.map((n) => (
                  <option key={n} value={n} className="bg-[#FCFDFC] dark:bg-[#1C2420] text-[#0E2421] dark:text-stone-100">
                    {getLocalizedNeighborhood(n, language)}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={streetOrLandmark}
                onChange={(e) => setStreetOrLandmark(e.target.value)}
                placeholder="Street or Landmark"
                className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100 placeholder:text-[#5E7B76] dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
              />
              {errors.streetOrLandmark && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">{errors.streetOrLandmark}</p>
              )}

              <button
                type="submit"
                className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] hover:brightness-105 dark:bg-none dark:bg-[#10B981] dark:hover:bg-[#059669] text-[#FCFDFC] dark:text-[#0B1410] text-xs font-semibold transition-all"
              >
                Save Address
              </button>
            </form>
          )}

          {addresses.map((addr) => (
            <div
              key={addr.addressId}
              className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 flex items-start justify-between gap-3"
            >
              <div>
                <div className="text-xs font-bold text-[#0E2421] dark:text-stone-100">
                  {addr.label} · {getLocalizedNeighborhood(addr.neighborhood, language)}
                </div>
                <div className="text-xs text-[#46635E] dark:text-stone-300 mt-0.5">{addr.streetOrLandmark}</div>
                <div className="text-[11px] text-[#5E7B76] dark:text-stone-400 mt-1 tabular-nums">
                  {addr.recipientName} · {addr.phoneNumber}
                </div>
              </div>
              <button
                type="button"
                onClick={() => deleteAddress(addr.addressId)}
                aria-label={`Delete address ${addr.label}`}
                className="p-2 text-[#5E7B76] dark:text-stone-500 hover:text-rose-600 dark:hover:text-rose-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (subView === 'settings') {
    return (
      <div className="min-h-full bg-[#F3F6F4] dark:bg-transparent pb-6">
        <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 dark:bg-[#1C2420] backdrop-blur-md border-b border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none px-3 py-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSubView('main')}
            aria-label="Back to account"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#0F4C44] dark:text-stone-300 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-display font-bold text-[#0F4C44] dark:text-stone-100">{t('languageSettings')}</h1>
          <div className="w-11" />
        </header>

        <div className="p-4 space-y-3">
          <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-3">
            <div>
              <h2 className="text-xs font-bold text-[#0F4C44] dark:text-stone-100">{t('displayLanguage')}</h2>
              <p className="text-[11px] text-[#46635E] dark:text-stone-400 mt-0.5 leading-relaxed">
                {t('languageSwitchHint')}
              </p>
            </div>
            <LanguageSwitcher variant="cards" />
          </div>

          <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-3">
            <div>
              <h2 className="text-xs font-bold text-[#0F4C44] dark:text-stone-100 flex items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#10B981]" />
                <span>{t('nearbyDealsAlertTitle')}</span>
              </h2>
              <p className="text-[11px] text-[#46635E] dark:text-stone-400 mt-0.5 leading-relaxed">
                {t('nearbyDealsAlertDesc')}
              </p>
              {pushPermission === 'denied' && (
                <p className="text-[11px] text-[#C2410C] dark:text-[#FB923C] mt-1">
                  {t('nearbyAlertsPermissionDenied')}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void toggleNearbyAlerts()}
                className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  nearbyAlertsEnabled
                    ? 'bg-[#E5F2EE] dark:bg-[#10B981]/15 border-[#0F4C44]/30 dark:border-[#10B981]/40 text-[#0F4C44] dark:text-[#10B981]'
                    : 'bg-[#0F4C44] hover:bg-[#047857] dark:bg-[#10B981] dark:hover:bg-[#059669] border-[#0F4C44] text-[#FCFDFC] dark:text-[#0B1410]'
                }`}
              >
                <BellRing className="w-4 h-4 shrink-0" />
                <span>
                  {nearbyAlertsEnabled ? t('nearbyAlertsDisableBtn') : t('enableNearbyAlertsBtn')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void triggerNearbyDiscountAlert({ isTest: true, forceNotify: true })}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-xs font-semibold text-[#0E2421] dark:text-stone-200 flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B] shrink-0" />
                <span>{t('testNearbyAlertBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (subView === 'help') {
    return (
      <div className="min-h-full bg-[#F3F6F4] dark:bg-transparent pb-6">
        <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 dark:bg-[#1C2420] backdrop-blur-md border-b border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none px-3 py-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSubView('main')}
            aria-label="Back to account"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#0F4C44] dark:text-stone-300 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-display font-bold text-[#0F4C44] dark:text-stone-100">Help & Support</h1>
          <div className="w-11" />
        </header>

        <div className="p-4 space-y-3 text-xs text-[#46635E] dark:text-stone-300 leading-relaxed">
          <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-2">
            <h2 className="font-bold text-[#0F4C44] dark:text-stone-100">Affin Connect · Support Local Business</h2>
            <p>
              Every order is fulfilled directly by verified local merchants in Hawassa (Piazza,
              Menhariya, Gebeya Dar, Datto, Tabor, Arab Sefer).
            </p>
            <p>
              You can pay via Telebirr, CBE Birr, Chapa (Card / Mobile Money), Cash on Delivery, or
              directly at the shop counter during pickup. Every Hawassa order generates a 4-digit
              Delivery Confirmation PIN to protect handoff.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F3F6F4] dark:bg-transparent pb-8">
      <header className="bg-[#FCFDFC]/95 dark:bg-[#1C2420] backdrop-blur-md border-b border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none px-4 py-4 flex items-center justify-between gap-2">
        <h1 className="text-base font-display font-bold text-[#0F4C44] dark:text-stone-100">{t('accountAndPortals')}</h1>
        {(canAccessAdmin || developerMode) && (
          <button
            type="button"
            onClick={() => {
              setActiveRoleView('admin');
              navigate({ name: 'admin', tab: 'users' });
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] hover:brightness-105 text-[#FCFDFC] text-[11px] font-semibold flex items-center gap-1.5 shadow-xs transition-all shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#FDE68A]" />
            <span>{t('adminViewQuickBtn')}</span>
          </button>
        )}
      </header>

      <div className="p-4 space-y-4">
        {/* Prominent One-Click Admin Governance Console CTA at Top of Account Tab */}
        {(canAccessAdmin || developerMode) && (
          <section className="rounded-2xl bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#0F766E] p-4 text-white shadow-md border border-[#10B981]/30 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-[#FDE68A]" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold tracking-tight text-white">
                    {t('openAdminConsole')}
                  </div>
                  <p className="text-[11px] text-emerald-50/90 mt-0.5 leading-relaxed">
                    {t('openAdminConsoleDesc')}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveRoleView('admin');
                  navigate({ name: 'admin', tab: 'users' });
                }}
                className="flex-1 min-h-[42px] px-4 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#141A17] hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{t('openAdminConsole')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveRoleView('admin');
                  navigate({ name: 'admin', tab: 'overview' });
                }}
                className="min-h-[42px] px-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-[11px] font-semibold shrink-0 transition-colors"
              >
                {t('adminGovernanceOverview')}
              </button>
            </div>
          </section>
        )}

        {/* User Auth Card */}
        <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4">
          {firebaseUser ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#0E2421] dark:text-stone-100 truncate">
                  {firebaseUser.displayName || userProfile?.displayName || 'Hawassa Shopper'}
                </div>
                <div className="text-xs text-[#46635E] dark:text-stone-400 truncate flex items-center gap-1.5 mt-0.5">
                  {firebaseUser.phoneNumber && !firebaseUser.email && (
                    <Phone className="w-3 h-3 text-[#0F4C44] dark:text-[#10B981] shrink-0" />
                  )}
                  <span className="truncate">
                    {firebaseUser.email || firebaseUser.phoneNumber || userProfile?.phoneNumber}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-[11px] font-semibold text-[#0F4C44] dark:text-[#10B981] capitalize">
                    Role: {userProfile?.role ?? 'customer'} · {t('cloudSynced')}
                  </span>
                  {needsEmailVerification ? (
                    <button
                      type="button"
                      onClick={openAuthScreen}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFFBEB] dark:bg-[#2A2418] border border-[#FDE68A] dark:border-[#78350F] text-[10px] font-semibold text-[#B45309] dark:text-[#FBBF24] hover:bg-[#FEF3C7] dark:hover:bg-[#3A301F] transition-colors cursor-pointer"
                    >
                      <Mail className="w-3 h-3" />
                      <span>{t('emailVerifyUnverifiedAccountBadge')}</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#E5F2EE] dark:bg-[#10B981]/15 border border-[#0F4C44]/25 dark:border-[#10B981]/30 text-[10px] font-semibold text-[#0F4C44] dark:text-[#10B981]">
                      <ShieldCheck className="w-3 h-3" />
                      <span>
                        {firebaseUser.phoneNumber && !firebaseUser.email
                          ? t('phoneAuthVerifiedBadge')
                          : firebaseUser.providerData?.some((p) => p.providerId === 'google.com')
                            ? t('googleVerifiedBadge')
                            : t('emailVerifiedBadge')}
                      </span>
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={signOutUser}
                className="px-3 py-2 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-transparent text-xs font-semibold text-[#0E2421] dark:text-stone-200 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17] flex items-center gap-1.5 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('signOut')}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-bold text-[#0F4C44] dark:text-stone-100">{t('guestSession')}</div>
                <p className="text-xs text-[#46635E] dark:text-stone-400 mt-0.5 leading-relaxed">
                  {t('guestSessionDesc')}
                </p>
              </div>
              <AuthSignInPanel variant="card" />
            </div>
          )}
        </section>

        {/* Quick Language Switcher Card */}
        <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs font-bold text-[#0F4C44] dark:text-stone-100">
              <Globe className="w-4 h-4 text-[#0F4C44] dark:text-[#10B981]" />
              <span>{t('selectLanguage')}</span>
            </span>
            <span className="text-[11px] font-semibold text-[#047857] dark:text-[#10B981]">
              {activeLanguageLabel}
            </span>
          </div>
          <LanguageSwitcher variant="segmented" />
        </section>

        {/* Customer Links */}
        <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none divide-y divide-[#D2E0DC]/75 dark:divide-[#2A3630] overflow-hidden">
          <button
            type="button"
            onClick={() => navigate({ name: 'orders' })}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F3F6F4] dark:hover:bg-[#141A17] text-left transition-colors"
          >
            <span className="flex items-center gap-3 text-xs font-semibold text-[#0E2421] dark:text-stone-200">
              <PackageCheck className="w-4 h-4 text-[#0F4C44] dark:text-[#10B981]" />
              {t('orders')}
            </span>
            <ChevronRight className="w-4 h-4 text-[#5E7B76] dark:text-stone-500" />
          </button>

          <button
            type="button"
            onClick={() => openTradeChatInbox()}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F3F6F4] dark:hover:bg-[#141A17] text-left transition-colors"
          >
            <span className="flex items-center gap-3 text-xs font-semibold text-[#0E2421] dark:text-stone-200 min-w-0">
              <MessageSquare className="w-4 h-4 text-[#0F4C44] dark:text-[#10B981] shrink-0" />
              <span className="min-w-0">
                <span className="block">{t('profileTradeInboxTitle')}</span>
                <span className="block text-[10px] font-normal text-[#46635E] dark:text-stone-400 truncate">
                  {t('profileTradeInboxDesc')}
                </span>
              </span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-[#0F4C44] dark:text-[#10B981] tabular-nums">
                {tradeChats.length}
              </span>
              <ChevronRight className="w-4 h-4 text-[#5E7B76] dark:text-stone-500" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate({ name: 'loyalty' })}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F3F6F4] dark:hover:bg-[#141A17] text-left transition-colors"
          >
            <span className="flex items-center gap-3 text-xs font-semibold text-[#0E2421] dark:text-stone-200">
              <Award className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B]" />
              {t('loyaltyProfileRow')}
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-[#0F4C44] dark:text-[#10B981] tabular-nums">
                {t('loyaltyPointsShort', { points: loyaltyBalance })}
              </span>
              <ChevronRight className="w-4 h-4 text-[#5E7B76] dark:text-stone-500" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate({ name: 'favorites' })}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F3F6F4] dark:hover:bg-[#141A17] text-left transition-colors"
          >
            <span className="flex items-center gap-3 text-xs font-semibold text-[#0E2421] dark:text-stone-200">
              <Heart className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              {t('savedFavorites')} ({favorites.length})
            </span>
            <ChevronRight className="w-4 h-4 text-[#5E7B76] dark:text-stone-500" />
          </button>

          <button
            type="button"
            onClick={() => navigate({ name: 'notifications' })}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F3F6F4] dark:hover:bg-[#141A17] text-left transition-colors"
          >
            <span className="flex items-center gap-3 text-xs font-semibold text-[#0E2421] dark:text-stone-200">
              <Bell className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B]" />
              {t('notifications')} ({t('unreadCount', { count: unreadNotificationCount })})
            </span>
            <ChevronRight className="w-4 h-4 text-[#5E7B76] dark:text-stone-500" />
          </button>

          <button
            type="button"
            onClick={() => setSubView('addresses')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F3F6F4] dark:hover:bg-[#141A17] text-left transition-colors"
          >
            <span className="flex items-center gap-3 text-xs font-semibold text-[#0E2421] dark:text-stone-200">
              <MapPin className="w-4 h-4 text-[#0F4C44] dark:text-[#10B981]" />
              {t('deliveryAddresses')} ({addresses.length})
            </span>
            <ChevronRight className="w-4 h-4 text-[#5E7B76] dark:text-stone-500" />
          </button>

          <button
            type="button"
            onClick={() => setSubView('settings')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F3F6F4] dark:hover:bg-[#141A17] text-left transition-colors"
          >
            <span className="flex items-center gap-3 text-xs font-semibold text-[#0E2421] dark:text-stone-200">
              <Globe className="w-4 h-4 text-[#0F4C44] dark:text-[#10B981]" />
              {t('languageSettings')} ({activeLanguageLabel})
            </span>
            <ChevronRight className="w-4 h-4 text-[#5E7B76] dark:text-stone-500" />
          </button>

          <button
            type="button"
            onClick={() => setSubView('help')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F3F6F4] dark:hover:bg-[#141A17] text-left transition-colors"
          >
            <span className="flex items-center gap-3 text-xs font-semibold text-[#0E2421] dark:text-stone-200">
              <HelpCircle className="w-4 h-4 text-[#46635E] dark:text-stone-400" />
              {t('helpAndSupport')}
            </span>
            <ChevronRight className="w-4 h-4 text-[#5E7B76] dark:text-stone-500" />
          </button>
        </section>

        {/* Merchant & Admin Portals (Strict Role-Based Access) */}
        {(canAccessSeller || canAccessAdmin) && (
          <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none divide-y divide-[#D2E0DC]/75 dark:divide-[#2A3630] overflow-hidden">
            {canAccessSeller && (
              <button
                type="button"
                onClick={() => {
                  setActiveRoleView('seller');
                  navigate({ name: 'seller', tab: 'dashboard' });
                }}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F3F6F4] dark:hover:bg-[#141A17] text-left transition-colors"
              >
                <span className="flex items-center gap-3 text-xs font-semibold text-[#0E2421] dark:text-stone-100">
                  <Store className="w-4 h-4 text-[#0F4C44] dark:text-[#10B981]" />
                  {t('sellerPortalRow')}
                </span>
                <ChevronRight className="w-4 h-4 text-[#5E7B76] dark:text-stone-500" />
              </button>
            )}

            {canAccessAdmin && (
              <button
                type="button"
                onClick={() => {
                  setActiveRoleView('admin');
                  navigate({ name: 'admin', tab: 'shops' });
                }}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F3F6F4] dark:hover:bg-[#141A17] text-left transition-colors"
              >
                <span className="flex items-center gap-3 text-xs font-semibold text-[#0E2421] dark:text-stone-200">
                  <ShieldCheck className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B]" />
                  {t('adminDashboard')}
                </span>
                <ChevronRight className="w-4 h-4 text-[#5E7B76] dark:text-stone-500" />
              </button>
            )}
          </section>
        )}

        {/* Nearby Deal & Shop Alerts Toggle */}
        <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <BellRing className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#0E2421] dark:text-stone-200">
                  {t('nearbyDealsAlertTitle')}
                </div>
                <p className="text-[11px] text-[#46635E] dark:text-stone-400 mt-0.5 leading-relaxed">
                  {t('nearbyActiveDealsCount', { count: nearbyDeals.length })}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={nearbyAlertsEnabled}
              aria-label={t('enableNearbyAlertsBtn')}
              onClick={() => void toggleNearbyAlerts()}
              className={`min-h-[36px] px-3 rounded-xl border text-[11px] font-bold shrink-0 transition-colors ${
                nearbyAlertsEnabled
                  ? 'bg-[#0F4C44] dark:bg-[#10B981] text-[#FCFDFC] dark:text-[#0B1410] border-[#0F4C44] dark:border-[#10B981]'
                  : 'bg-[#F3F6F4] dark:bg-[#141A17] text-[#0E2421] dark:text-stone-300 border-[#D2E0DC] dark:border-[#2A3630]'
              }`}
            >
              {nearbyAlertsEnabled ? t('developerDemoModeEnabled') : t('enableNearbyAlertsBtn')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void triggerNearbyDiscountAlert({ isTest: true, forceNotify: true })}
            className="w-full min-h-[38px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-[11px] font-semibold text-[#0E2421] dark:text-stone-200 flex items-center justify-center gap-1.5 hover:border-[#0F4C44]/40 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B]" />
            <span>{t('testNearbyAlertBtn')}</span>
          </button>
        </section>

        {/* Discreet Developer / Demo Mode Toggle */}
        <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <Code2 className="w-4 h-4 text-[#46635E] dark:text-stone-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#0E2421] dark:text-stone-200">
                  {t('developerDemoMode')}
                </div>
                <p className="text-[11px] text-[#46635E] dark:text-stone-400 mt-0.5 leading-relaxed">
                  {t('developerDemoModeDesc')}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={developerMode}
              aria-label={t('developerDemoMode')}
              onClick={() => setDeveloperMode(!developerMode)}
              className={`min-h-[36px] px-3 rounded-xl border text-[11px] font-bold shrink-0 transition-colors ${
                developerMode
                  ? 'bg-[#0F4C44] dark:bg-[#10B981] text-[#FCFDFC] dark:text-[#0B1410] border-[#0F4C44] dark:border-[#10B981]'
                  : 'bg-[#F3F6F4] dark:bg-[#141A17] text-[#46635E] dark:text-stone-300 border-[#D2E0DC] dark:border-[#2A3630]'
              }`}
            >
              {developerMode ? t('developerDemoModeEnabled') : t('developerDemoModeDisabled')}
            </button>
          </div>
        </section>

        {/* Smart Discovery & Studio */}
        <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none divide-y divide-[#D2E0DC]/75 dark:divide-[#2A3630] overflow-hidden">
          <button
            type="button"
            onClick={() => navigate({ name: 'map' })}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F3F6F4] dark:hover:bg-[#141A17] text-left transition-colors"
          >
            <span className="flex items-center gap-3 text-xs font-semibold text-[#0E2421] dark:text-stone-200">
              <MapPin className="w-4 h-4 text-[#0F4C44] dark:text-[#10B981]" />
              {t('mapFinderRow')}
            </span>
            <ChevronRight className="w-4 h-4 text-[#5E7B76] dark:text-stone-500" />
          </button>

          <button
            type="button"
            onClick={openChatbot}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F3F6F4] dark:hover:bg-[#141A17] text-left transition-colors"
          >
            <span className="flex items-center gap-3 text-xs font-semibold text-[#0E2421] dark:text-stone-200">
              <MessageSquare className="w-4 h-4 text-[#047857] dark:text-[#00D68F]" />
              {t('aiConciergeRow')}
            </span>
            <ChevronRight className="w-4 h-4 text-[#5E7B76] dark:text-stone-500" />
          </button>

          <button
            type="button"
            onClick={() => navigate({ name: 'video' })}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F3F6F4] dark:hover:bg-[#141A17] text-left transition-colors"
          >
            <span className="flex items-center gap-3 text-xs font-semibold text-[#0E2421] dark:text-stone-200">
              <Video className="w-4 h-4 text-[#0F4C44] dark:text-[#10B981]" />
              {t('videoStudio')}
            </span>
            <ChevronRight className="w-4 h-4 text-[#5E7B76] dark:text-stone-500" />
          </button>
        </section>
      </div>
    </div>
  );
};
