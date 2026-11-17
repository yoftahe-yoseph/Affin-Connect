import React, { useState } from 'react';
import {
  BadgeCheck,
  Car,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Dumbbell,
  Flame,
  Heart,
  HeartPulse,
  Home,
  MapPin,
  Package,
  Plus,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Truck,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';
import type { OrderStatus, Product, Shop } from '../types';
import {
  calculateDiscountPercent,
  formatETB,
  isVerifiedMerchantShop,
} from '../utils/marketplaceLogic';
import { getLocalizedNeighborhood } from '../constants/translations';
import { useMarketplace } from '../context/MarketplaceContext';

export const CategoryIcon: React.FC<{ iconName: string; className?: string }> = ({
  iconName,
  className = 'w-5 h-5',
}) => {
  switch (iconName) {
    case 'Coffee':
      return <Coffee className={className} />;
    case 'ShoppingBasket':
      return <ShoppingBasket className={className} />;
    case 'Shirt':
      return <Shirt className={className} />;
    case 'Smartphone':
      return <Smartphone className={className} />;
    case 'Flame':
      return <Flame className={className} />;
    case 'UtensilsCrossed':
      return <UtensilsCrossed className={className} />;
    case 'Home':
      return <Home className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'HeartPulse':
      return <HeartPulse className={className} />;
    case 'Dumbbell':
      return <Dumbbell className={className} />;
    case 'Car':
      return <Car className={className} />;
    default:
      return <Package className={className} />;
  }
};

export const ResilientImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  darkSurface?: boolean;
}> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackTitle,
  darkSurface = false,
}) => {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center p-3 text-center ${
          darkSurface
            ? 'bg-[#061D1B] text-[#A9C0BD]'
            : 'bg-[#FAF8F5] dark:bg-[#141A17] text-stone-500 dark:text-stone-400'
        }`}
      >
        <ShoppingBag
          className={`w-6 h-6 mb-1 ${
            darkSurface ? 'text-[#00D68F]/70' : 'text-[#047857]/60 dark:text-[#10B981]/60'
          }`}
        />
        {fallbackTitle && <span className="text-[11px] font-medium line-clamp-2">{fallbackTitle}</span>}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

export const ProductCard: React.FC<{
  product: Product;
  variant?: 'default' | 'emeraldDark';
}> = ({ product, variant = 'default' }) => {
  const { navigate, addToCart, favorites, toggleFavorite, shopsById, proximityByShopId, language, t } =
    useMarketplace();
  const [justAdded, setJustAdded] = useState(false);
  const isFav = favorites.includes(product.productId);
  const shop = shopsById[product.shopId];
  const proximity = proximityByShopId[product.shopId];
  const hasDiscount = product.previousPrice != null && product.previousPrice > product.price;
  const discountPct = hasDiscount
    ? calculateDiscountPercent(product.price, product.previousPrice!)
    : 0;
  const outOfStock = !product.isAvailable || product.stock <= 0;
  const isDarkCard = variant === 'emeraldDark';

  const handleQuickAdd = () => {
    addToCart(product, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  if (isDarkCard) {
    return (
      <article className="bg-[#092825] rounded-2xl border border-[#123E39] overflow-hidden flex flex-col shadow-lg shadow-black/25 hover:border-[#00D68F]/45 transition-all">
        <div className="relative aspect-[4/3] bg-[#061D1B] overflow-hidden">
          <button
            type="button"
            onClick={() => navigate({ name: 'product', productId: product.productId })}
            aria-label={`View ${product.name}`}
            className="w-full h-full block text-left focus-visible:outline-2 focus-visible:outline-[#00D68F]"
          >
            <ResilientImage
              src={product.imageUrl}
              alt={product.name}
              fallbackTitle={product.name}
              darkSurface
              className="w-full h-full object-cover"
            />
          </button>

          {hasDiscount && discountPct > 0 && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-[#031719]/85 border border-[#00D68F]/40 text-[#00D68F] text-[10px] font-bold tabular-nums backdrop-blur-xs">
              -{discountPct}%
            </span>
          )}

          <button
            type="button"
            onClick={() => toggleFavorite(product.productId)}
            aria-label={isFav ? `Remove ${product.name} from favorites` : `Save ${product.name} to favorites`}
            className="absolute top-1.5 right-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-[#031719]/75 backdrop-blur-xs text-[#F5FAFA] hover:text-rose-400 border border-white/10 transition-colors"
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>

          {outOfStock && (
            <div className="absolute inset-0 bg-[#031719]/70 flex items-center justify-center pointer-events-none">
              <span className="bg-[#092825] text-[#F5FAFA] text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-white/15">
                {t('outOfStock')}
              </span>
            </div>
          )}
        </div>

        <div className="p-3 flex-1 flex flex-col justify-between gap-2">
          <div>
            <div className="flex items-center gap-1 text-[11px] text-[#A9C0BD] truncate">
              <span className="truncate font-medium text-[#00C8D7]">{product.shopName}</span>
              {shop && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{getLocalizedNeighborhood(shop.neighborhood, language)}</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate({ name: 'product', productId: product.productId })}
              className="text-left mt-1 block w-full"
            >
              <h3 className="text-[13px] font-semibold text-[#F5FAFA] leading-snug line-clamp-2 hover:text-[#00D68F] transition-colors">
                {product.name}
              </h3>
            </button>

            <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px]">
              <span
                className={`font-medium tabular-nums truncate ${
                  outOfStock ? 'text-rose-300' : 'text-[#A9C0BD]'
                }`}
              >
                {outOfStock
                  ? t('outOfStock')
                  : product.stock <= 5
                    ? t('onlyLeftInStock', { count: product.stock })
                    : t('inStockCount', { count: product.stock })}
              </span>
              {product.rating != null && product.rating > 0 ? (
                <span className="inline-flex items-center gap-0.5 shrink-0 tabular-nums text-[#F5FAFA] font-medium">
                  <Star className="w-3 h-3 fill-[#F59E0B] text-[#F59E0B]" />
                  <span>{product.rating.toFixed(1)}</span>
                </span>
              ) : proximity ? (
                <span className="shrink-0 tabular-nums text-[#A9C0BD]">
                  {proximity.distanceLabel}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-end justify-between gap-2 pt-1.5 border-t border-white/10">
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-[#00D68F] tabular-nums whitespace-nowrap">
                {formatETB(product.price)}
              </div>
              {hasDiscount && (
                <div className="text-[11px] text-[#A9C0BD]/70 line-through tabular-nums whitespace-nowrap mt-0.5">
                  {formatETB(product.previousPrice!)}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={outOfStock}
              onClick={handleQuickAdd}
              aria-label={`Add ${product.name} to cart`}
              className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-95 ${
                justAdded
                  ? 'bg-[#00C8D7] text-[#031719] shadow-sm shadow-[#00C8D7]/30'
                  : 'bg-gradient-to-br from-[#00D68F] to-[#00C8D7] hover:brightness-105 text-[#031719] font-bold shadow-sm shadow-[#00D68F]/20 disabled:bg-[#0D3531] disabled:bg-none disabled:text-[#A9C0BD]/40 disabled:shadow-none'
              }`}
            >
              {justAdded ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Plus className="w-4 h-4 stroke-[2.5]" />}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all">
      <div className="relative aspect-[4/3] bg-[#FAF8F5] dark:bg-[#141A17] overflow-hidden">
        <button
          type="button"
          onClick={() => navigate({ name: 'product', productId: product.productId })}
          aria-label={`View ${product.name}`}
          className="w-full h-full block text-left focus-visible:outline-2 focus-visible:outline-[#047857] dark:focus-visible:outline-[#10B981]"
        >
          <ResilientImage
            src={product.imageUrl}
            alt={product.name}
            fallbackTitle={product.name}
            className="w-full h-full object-cover"
          />
        </button>

        <button
          type="button"
          onClick={() => toggleFavorite(product.productId)}
          aria-label={isFav ? `Remove ${product.name} from favorites` : `Save ${product.name} to favorites`}
          className="absolute top-1.5 right-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/90 dark:bg-[#1C2420]/90 backdrop-blur-xs text-stone-700 dark:text-stone-200 hover:text-rose-600 dark:hover:text-rose-400 shadow-xs transition-colors"
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-600 text-rose-600 dark:fill-rose-500 dark:text-rose-500' : ''}`} />
        </button>

        {outOfStock && (
          <div className="absolute inset-0 bg-stone-900/45 dark:bg-[#141A17]/70 flex items-center justify-center pointer-events-none">
            <span className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-[#E7E5E4] dark:border-[#2A3630]">
              {t('outOfStock')}
            </span>
          </div>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col justify-between gap-2">
        <div>
          <div className="flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400 truncate">
            <span className="truncate font-medium text-[#047857] dark:text-[#10B981]">{product.shopName}</span>
            {shop && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{getLocalizedNeighborhood(shop.neighborhood, language)}</span>
              </>
            )}
            {proximity && (
              <>
                <span aria-hidden="true">·</span>
                <span className="shrink-0 tabular-nums font-medium text-stone-600 dark:text-stone-300">
                  {proximity.distanceLabel}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate({ name: 'product', productId: product.productId })}
            className="text-left mt-0.5 block w-full"
          >
            <h3 className="text-[13px] font-semibold text-stone-900 dark:text-stone-100 leading-snug line-clamp-2 hover:text-[#047857] dark:hover:text-[#10B981]">
              {product.name}
            </h3>
          </button>
        </div>

        <div className="flex items-end justify-between gap-2 pt-1">
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-stone-900 dark:text-stone-100 tabular-nums whitespace-nowrap">
              {formatETB(product.price)}
            </div>
            {hasDiscount && (
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className="text-[11px] text-stone-400 dark:text-stone-500 line-through tabular-nums whitespace-nowrap">
                  {formatETB(product.previousPrice!)}
                </span>
                {discountPct > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-[#FFF7ED] dark:bg-[#C2410C]/20 text-[#C2410C] dark:text-[#FB923C] text-[10px] font-bold tabular-nums whitespace-nowrap">
                    -{discountPct}%
                  </span>
                )}
              </div>
            )}
            {product.rating != null && (
              <div className="flex items-center gap-1 mt-0.5 text-[11px] text-stone-600 dark:text-stone-300 tabular-nums">
                <Star className="w-3 h-3 fill-[#D97706] text-[#D97706] dark:fill-[#F59E0B] dark:text-[#F59E0B]" />
                <span>{product.rating.toFixed(1)}</span>
                {product.reviewCount ? (
                  <span className="text-stone-400 dark:text-stone-500">({product.reviewCount})</span>
                ) : null}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={outOfStock}
            onClick={handleQuickAdd}
            aria-label={`Add ${product.name} to cart`}
            className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center shrink-0 transition-colors active:scale-95 ${
              justAdded
                ? 'bg-[#065F46] dark:bg-[#059669] text-[#F59E0B]'
                : 'bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] disabled:bg-stone-200 dark:disabled:bg-[#232D28] disabled:text-stone-400 dark:disabled:text-stone-600'
            }`}
          >
            {justAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </article>
  );
};

export const ShopCard: React.FC<{
  shop: Shop;
  highlightNearest?: boolean;
  variant?: 'default' | 'emeraldDark';
  fullWidth?: boolean;
  showFavorite?: boolean;
  showDistance?: boolean;
  showDescription?: boolean;
}> = ({
  shop,
  highlightNearest = false,
  variant = 'default',
  fullWidth = false,
  showFavorite = false,
  showDistance = true,
  showDescription = false,
}) => {
  const { navigate, proximityByShopId, followedShops, toggleFollowShop, language, t } =
    useMarketplace();
  const proximity = showDistance ? proximityByShopId[shop.shopId] : undefined;
  const isNearestCard = Boolean(highlightNearest && proximity?.isNearestForUser);
  const isVerified = isVerifiedMerchantShop(shop);
  const hasRealRating = (shop.reviewCount ?? 0) > 0 || (shop.rating ?? 0) > 0;
  const isFav = followedShops.includes(shop.shopId);

  if (variant === 'emeraldDark') {
    return (
      <article
        className={`${fullWidth ? 'w-full min-w-0' : 'w-56 shrink-0'} rounded-2xl border overflow-hidden flex flex-col shadow-lg shadow-black/25 transition-all ${
          isNearestCard
            ? 'bg-[#0B302C] border-[#00D68F]/70 ring-1 ring-[#00D68F]/30'
            : 'bg-[#092825] border-[#123E39] hover:border-[#00D68F]/45'
        }`}
      >
        <div className="relative h-24 w-full bg-[#061D1B] overflow-hidden">
          <button
            type="button"
            onClick={() => navigate({ name: 'shop', shopId: shop.shopId })}
            aria-label={shop.name}
            className="w-full h-full block text-left group focus-visible:outline-2 focus-visible:outline-[#00D68F]"
          >
            <ResilientImage
              src={shop.coverImageUrl || shop.logoUrl}
              alt={shop.name}
              fallbackTitle={shop.name}
              darkSurface
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#092825] via-[#092825]/30 to-transparent" />
            <div className="absolute bottom-2 left-3 w-9 h-9 rounded-xl overflow-hidden bg-[#031719] border border-white/20 shadow-md">
              <ResilientImage src={shop.logoUrl} alt={`${shop.name} logo`} fallbackTitle={shop.name} darkSurface />
            </div>
          </button>

          {isVerified && (
            <span className="pointer-events-none absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#031719]/85 border border-[#00D68F]/40 text-[#00D68F] text-[10px] font-semibold backdrop-blur-xs">
              <BadgeCheck className="w-3 h-3 shrink-0" />
              <span>{t('verifiedMerchantLabel')}</span>
            </span>
          )}

          {showFavorite ? (
            <button
              type="button"
              onClick={() => toggleFollowShop(shop.shopId)}
              aria-pressed={isFav}
              aria-label={isFav ? t('favoriteShopRemoveAria') : t('favoriteShopAddAria')}
              className="absolute top-1.5 right-1.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full bg-[#031719]/80 backdrop-blur-xs text-[#F5FAFA] hover:text-rose-400 border border-white/15 transition-colors active:scale-95"
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
          ) : null}

          {proximity && (
            <span
              className={`pointer-events-none absolute right-2 px-2 py-0.5 rounded-lg bg-[#031719]/80 border border-white/10 text-[#F5FAFA] text-[10px] font-medium tabular-nums backdrop-blur-xs ${
                showFavorite ? 'bottom-2' : 'top-2'
              }`}
            >
              {proximity.distanceLabel}
            </span>
          )}
        </div>

        <div className="p-3 pt-2 flex-1 flex flex-col justify-between gap-2.5 min-w-0">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate({ name: 'shop', shopId: shop.shopId })}
              className="w-full text-left flex items-center gap-1 min-w-0"
            >
              <h3 className="text-[13px] font-semibold text-[#F5FAFA] truncate hover:text-[#00D68F] transition-colors">
                {shop.name}
              </h3>
              {isVerified && (
                <BadgeCheck className="w-3.5 h-3.5 text-[#00D68F] shrink-0" aria-label={t('verifiedMerchantLabel')} />
              )}
            </button>

            <div className="flex items-center justify-between gap-1.5 mt-1 text-[11px] text-[#A9C0BD] min-w-0">
              <span className="flex items-center gap-1 truncate min-w-0">
                <MapPin className="w-3 h-3 text-[#00C8D7] shrink-0" />
                <span className="truncate">{getLocalizedNeighborhood(shop.neighborhood, language)}</span>
              </span>

              {hasRealRating ? (
                <span className="flex items-center gap-0.5 font-medium text-[#F5FAFA] shrink-0 tabular-nums">
                  <Star className="w-3 h-3 fill-[#F59E0B] text-[#F59E0B]" />
                  <span>{shop.rating.toFixed(1)}</span>
                  {shop.reviewCount > 0 && (
                    <span className="text-[#A9C0BD]">({shop.reviewCount})</span>
                  )}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-[#00C8D7] shrink-0">
                  {t('newShopBadge')}
                </span>
              )}
            </div>

            {showDescription && shop.description && (
              <p className="text-[11px] text-[#A9C0BD] leading-relaxed line-clamp-2 mt-1.5">
                {shop.description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate({ name: 'shop', shopId: shop.shopId })}
            className="w-full min-h-[40px] px-3 rounded-xl bg-[#0D3531] hover:bg-gradient-to-r hover:from-[#00D68F] hover:to-[#00C8D7] text-[#00D68F] hover:text-[#031719] border border-[#00D68F]/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
          >
            <Store className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('visitShop')}</span>
          </button>
        </div>
      </article>
    );
  }

  return (
    <button
      type="button"
      onClick={() => navigate({ name: 'shop', shopId: shop.shopId })}
      className={`w-60 shrink-0 rounded-2xl border p-3 text-left flex flex-col gap-2 shadow-sm hover:shadow-md transition-all ${
        isNearestCard
          ? 'bg-[#ECFDF5]/60 dark:bg-[#10B981]/10 border-[#047857] dark:border-[#10B981] ring-2 ring-[#047857]/15 dark:ring-[#10B981]/20'
          : 'bg-white dark:bg-[#1C2420] border-[#E7E5E4] dark:border-[#2A3630] hover:border-[#047857]/40 dark:hover:border-[#10B981]/50'
      }`}
    >
      {isNearestCard && proximity && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#047857] dark:text-[#10B981] tabular-nums">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {t('nearestShopDistanceNearest', { distance: proximity.distanceLabel })}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#FAF8F5] dark:bg-[#141A17] shrink-0 border border-[#E7E5E4] dark:border-[#2A3630]">
          <ResilientImage src={shop.logoUrl} alt={shop.name} fallbackTitle={shop.name} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 min-w-0">
            <h3 className="text-[13px] font-semibold text-stone-900 dark:text-stone-100 truncate">{shop.name}</h3>
            {isVerified && (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981] shrink-0" aria-label="Verified shop" />
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5 tabular-nums">
            <MapPin className="w-3 h-3 text-[#047857] dark:text-[#10B981] shrink-0" />
            <span className="truncate">{getLocalizedNeighborhood(shop.neighborhood, language)}</span>
            {proximity && !isNearestCard && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-stone-700 dark:text-stone-200 shrink-0">
                  {proximity.distanceLabel}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-300 pt-1.5 border-t border-[#E7E5E4]/80 dark:border-[#2A3630]">
        {hasRealRating ? (
          <span className="flex items-center gap-1 font-medium tabular-nums">
            <Star className="w-3 h-3 fill-[#D97706] text-[#D97706] dark:fill-[#F59E0B] dark:text-[#F59E0B]" />
            {shop.rating.toFixed(1)} ({shop.reviewCount})
          </span>
        ) : (
          <span className="text-[10px] font-medium text-[#047857] dark:text-[#10B981]">
            {t('newShopBadge')}
          </span>
        )}
        <span className="text-[#047857] dark:text-[#10B981] font-medium whitespace-nowrap tabular-nums">
          {proximity
            ? t('bajajEtaShort', { min: proximity.estimatedBajajMinutes })
            : shop.deliveryAvailable
            ? t('deliveryPickupShort')
            : t('shopPickupShort')}
        </span>
      </div>
    </button>
  );
};

export const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const { t } = useMarketplace();
  const config: Record<
    OrderStatus,
    { label: string; colorClass: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    pending: { label: t('statusPending'), colorClass: 'text-[#D97706] dark:text-[#F59E0B]', Icon: Clock },
    accepted: { label: t('statusAccepted'), colorClass: 'text-[#047857] dark:text-[#10B981]', Icon: CheckCircle2 },
    preparing: { label: t('statusPreparing'), colorClass: 'text-[#047857] dark:text-[#10B981]', Icon: Store },
    ready_for_pickup: { label: t('statusReady'), colorClass: 'text-[#047857] dark:text-[#10B981]', Icon: ShoppingBag },
    out_for_delivery: { label: t('statusOutForDelivery'), colorClass: 'text-[#C2410C] dark:text-[#FB923C]', Icon: Truck },
    delivered: { label: t('statusDelivered'), colorClass: 'text-[#047857] dark:text-[#10B981]', Icon: CheckCircle2 },
    rejected: { label: t('statusRejected'), colorClass: 'text-rose-700 dark:text-rose-400', Icon: XCircle },
    canceled: { label: t('statusCanceled'), colorClass: 'text-stone-500 dark:text-stone-400', Icon: XCircle },
  };

  const { label, colorClass, Icon } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${colorClass}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
};

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon, title, description, actionLabel, onAction }) => (
  <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] text-stone-500 dark:text-stone-400 flex items-center justify-center mb-3 shadow-xs">
      {icon ?? <ShoppingBag className="w-6 h-6" />}
    </div>
    <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100">{title}</h3>
    <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-[260px] leading-relaxed">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-4 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold transition-colors"
      >
        {actionLabel}
      </button>
    )}
  </div>
);
