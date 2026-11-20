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
  LayoutGrid,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Plus,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Sprout,
  Star,
  Store,
  Truck,
  UtensilsCrossed,
  X,
  XCircle,
} from 'lucide-react';
import type { OrderStatus, Product, Shop } from '../types';
import {
  calculateDiscountPercent,
  formatETB,
  isVerifiedMerchantShop,
} from '../utils/marketplaceLogic';
import {
  getShopAvailabilityStatus,
  inferShopMainCategory,
  resolveShopCallablePhone,
} from '../utils/shopDirectory';
import { getLocalizedNeighborhood } from '../constants/translations';
import { useMarketplace } from '../context/MarketplaceContext';

export const SHOP_DIR_CATEGORY_TRANSLATION_KEYS: Record<string, string> = {
  coffee: 'shopDirCatCoffee',
  electronics: 'shopDirCatElectronics',
  'clothing-fashion': 'shopDirCatClothing',
  groceries: 'shopDirCatGroceries',
  'beauty-cosmetics': 'shopDirCatBeauty',
  'home-living': 'shopDirCatHomeFurniture',
  agriculture: 'shopDirCatAgriculture',
  other: 'shopDirCatOther',
};

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
    case 'Sprout':
      return <Sprout className={className} />;
    case 'Store':
      return <Store className={className} />;
    case 'LayoutGrid':
      return <LayoutGrid className={className} />;
    default:
      return <Package className={className} />;
  }
};

export interface CategoryCardTheme {
  surface: string;
  border: string;
  selectedBorder: string;
  iconBox: string;
  selectedIconBox: string;
  glow: string;
  arrow: string;
  accentBar: string;
  activeText: string;
}

export const CATEGORY_CARD_THEMES: Record<string, CategoryCardTheme> = {
  'clothing-fashion': {
    surface: 'from-rose-50/90 via-[#FCFDFC] to-[#FCFDFC] dark:from-[#3A1624] dark:via-[#22101A] dark:to-[#0B1719]',
    border: 'border-[#E6D4DA] hover:border-rose-400 dark:border-[#FB7185]/35 dark:hover:border-[#FB7185]/80',
    selectedBorder: 'border-rose-500 ring-2 ring-rose-500/25 dark:border-[#FB7185] dark:ring-[#FB7185]/35',
    iconBox: 'bg-rose-100/90 text-rose-700 dark:bg-[#F43F5E]/20 dark:text-[#FDA4AF]',
    selectedIconBox: 'bg-rose-600 text-white dark:bg-[#F43F5E] dark:text-white',
    glow: 'bg-rose-300/30 dark:bg-[#FB7185]/25',
    arrow: 'text-rose-600 dark:text-[#FDA4AF]',
    accentBar: 'from-rose-500 to-pink-400 dark:from-[#F43F5E] dark:to-[#FB7185]',
    activeText: 'text-rose-700 dark:text-[#FDA4AF]',
  },
  electronics: {
    surface: 'from-sky-50/90 via-[#FCFDFC] to-[#FCFDFC] dark:from-[#0F2742] dark:via-[#0B1C30] dark:to-[#06161B]',
    border: 'border-[#CEDEE6] hover:border-sky-400 dark:border-[#38BDF8]/35 dark:hover:border-[#38BDF8]/80',
    selectedBorder: 'border-sky-500 ring-2 ring-sky-500/25 dark:border-[#38BDF8] dark:ring-[#38BDF8]/35',
    iconBox: 'bg-sky-100/90 text-sky-700 dark:bg-[#0EA5E9]/20 dark:text-[#7DD3FC]',
    selectedIconBox: 'bg-sky-600 text-white dark:bg-[#0EA5E9] dark:text-[#031719]',
    glow: 'bg-sky-300/30 dark:bg-[#38BDF8]/25',
    arrow: 'text-sky-600 dark:text-[#7DD3FC]',
    accentBar: 'from-sky-500 to-cyan-400 dark:from-[#0EA5E9] dark:to-[#38BDF8]',
    activeText: 'text-sky-700 dark:text-[#7DD3FC]',
  },
  'home-living': {
    surface: 'from-amber-50/90 via-[#FCFDFC] to-[#FCFDFC] dark:from-[#3B260F] dark:via-[#24180B] dark:to-[#0C1717]',
    border: 'border-[#E6DCCB] hover:border-amber-400 dark:border-[#FBBF24]/35 dark:hover:border-[#FBBF24]/80',
    selectedBorder: 'border-amber-500 ring-2 ring-amber-500/25 dark:border-[#FBBF24] dark:ring-[#FBBF24]/35',
    iconBox: 'bg-amber-100/90 text-amber-800 dark:bg-[#F59E0B]/20 dark:text-[#FDE68A]',
    selectedIconBox: 'bg-amber-600 text-white dark:bg-[#F59E0B] dark:text-[#031719]',
    glow: 'bg-amber-300/30 dark:bg-[#FBBF24]/25',
    arrow: 'text-amber-700 dark:text-[#FDE68A]',
    accentBar: 'from-amber-500 to-yellow-400 dark:from-[#F59E0B] dark:to-[#FBBF24]',
    activeText: 'text-amber-800 dark:text-[#FDE68A]',
  },
  groceries: {
    surface: 'from-emerald-50/90 via-[#FCFDFC] to-[#FCFDFC] dark:from-[#0D3426] dark:via-[#09241B] dark:to-[#051817]',
    border: 'border-[#CCE0D8] hover:border-[#0F4C44]/60 dark:border-[#34D399]/35 dark:hover:border-[#34D399]/80',
    selectedBorder: 'border-[#0F4C44] ring-2 ring-[#0F4C44]/25 dark:border-[#34D399] dark:ring-[#34D399]/35',
    iconBox: 'bg-[#E2F1EC] text-[#0F4C44] dark:bg-[#10B981]/20 dark:text-[#6EE7B7]',
    selectedIconBox: 'bg-[#0F4C44] text-[#FCFDFC] dark:bg-[#10B981] dark:text-[#031719]',
    glow: 'bg-emerald-300/30 dark:bg-[#34D399]/25',
    arrow: 'text-[#0F4C44] dark:text-[#6EE7B7]',
    accentBar: 'from-[#0F4C44] to-[#047857] dark:from-[#10B981] dark:to-[#34D399]',
    activeText: 'text-[#0F4C44] dark:text-[#6EE7B7]',
  },
  'food-spices': {
    surface: 'from-orange-50/90 via-[#FCFDFC] to-[#FCFDFC] dark:from-[#3C1C10] dark:via-[#26130C] dark:to-[#0C1617]',
    border: 'border-[#E6D6CC] hover:border-orange-400 dark:border-[#FB923C]/35 dark:hover:border-[#FB923C]/80',
    selectedBorder: 'border-orange-500 ring-2 ring-orange-500/25 dark:border-[#FB923C] dark:ring-[#FB923C]/35',
    iconBox: 'bg-orange-100/90 text-orange-800 dark:bg-[#F97316]/20 dark:text-[#FDBA74]',
    selectedIconBox: 'bg-orange-600 text-white dark:bg-[#F97316] dark:text-[#031719]',
    glow: 'bg-orange-300/30 dark:bg-[#FB923C]/25',
    arrow: 'text-orange-700 dark:text-[#FDBA74]',
    accentBar: 'from-orange-500 to-amber-400 dark:from-[#F97316] dark:to-[#FB923C]',
    activeText: 'text-orange-800 dark:text-[#FDBA74]',
  },
  'beauty-cosmetics': {
    surface: 'from-purple-50/90 via-[#FCFDFC] to-[#FCFDFC] dark:from-[#2C1842] dark:via-[#1C112B] dark:to-[#0A161B]',
    border: 'border-[#DDD3E6] hover:border-purple-400 dark:border-[#C084FC]/35 dark:hover:border-[#C084FC]/80',
    selectedBorder: 'border-purple-500 ring-2 ring-purple-500/25 dark:border-[#C084FC] dark:ring-[#C084FC]/35',
    iconBox: 'bg-purple-100/90 text-purple-700 dark:bg-[#A855F7]/20 dark:text-[#E9D5FF]',
    selectedIconBox: 'bg-purple-600 text-white dark:bg-[#A855F7] dark:text-white',
    glow: 'bg-purple-300/30 dark:bg-[#C084FC]/25',
    arrow: 'text-purple-600 dark:text-[#E9D5FF]',
    accentBar: 'from-purple-500 to-fuchsia-400 dark:from-[#A855F7] dark:to-[#C084FC]',
    activeText: 'text-purple-700 dark:text-[#E9D5FF]',
  },
  sports: {
    surface: 'from-teal-50/90 via-[#FCFDFC] to-[#FCFDFC] dark:from-[#0D303A] dark:via-[#092129] dark:to-[#05161B]',
    border: 'border-[#C9DFE0] hover:border-[#0F4C44]/60 dark:border-[#22D3EE]/35 dark:hover:border-[#22D3EE]/80',
    selectedBorder: 'border-[#0F4C44] ring-2 ring-[#0F4C44]/25 dark:border-[#22D3EE] dark:ring-[#22D3EE]/35',
    iconBox: 'bg-teal-100/90 text-[#0F4C44] dark:bg-[#06B6D4]/20 dark:text-[#A5F3FC]',
    selectedIconBox: 'bg-[#0F4C44] text-[#FCFDFC] dark:bg-[#06B6D4] dark:text-[#031719]',
    glow: 'bg-teal-300/30 dark:bg-[#22D3EE]/25',
    arrow: 'text-[#0F4C44] dark:text-[#A5F3FC]',
    accentBar: 'from-[#0F4C44] to-teal-500 dark:from-[#06B6D4] dark:to-[#22D3EE]',
    activeText: 'text-[#0F4C44] dark:text-[#A5F3FC]',
  },
  automotive: {
    surface: 'from-indigo-50/90 via-[#FCFDFC] to-[#FCFDFC] dark:from-[#1B2244] dark:via-[#131830] dark:to-[#08151B]',
    border: 'border-[#D2D6E8] hover:border-indigo-400 dark:border-[#818CF8]/35 dark:hover:border-[#818CF8]/80',
    selectedBorder: 'border-indigo-500 ring-2 ring-indigo-500/25 dark:border-[#818CF8] dark:ring-[#818CF8]/35',
    iconBox: 'bg-indigo-100/90 text-indigo-700 dark:bg-[#6366F1]/20 dark:text-[#C7D2FE]',
    selectedIconBox: 'bg-indigo-600 text-white dark:bg-[#6366F1] dark:text-white',
    glow: 'bg-indigo-300/30 dark:bg-[#818CF8]/25',
    arrow: 'text-indigo-600 dark:text-[#C7D2FE]',
    accentBar: 'from-indigo-500 to-blue-400 dark:from-[#6366F1] dark:to-[#818CF8]',
    activeText: 'text-indigo-700 dark:text-[#C7D2FE]',
  },
  'coffee-honey': {
    surface: 'from-amber-50/90 via-[#FCFDFC] to-[#FCFDFC] dark:from-[#3B2112] dark:via-[#26160C] dark:to-[#0B1617]',
    border: 'border-[#E6D9C6] hover:border-amber-500 dark:border-[#F59E0B]/35 dark:hover:border-[#F59E0B]/80',
    selectedBorder: 'border-amber-600 ring-2 ring-amber-500/25 dark:border-[#F59E0B] dark:ring-[#F59E0B]/35',
    iconBox: 'bg-amber-100/90 text-amber-900 dark:bg-[#D97706]/25 dark:text-[#FCD34D]',
    selectedIconBox: 'bg-amber-700 text-white dark:bg-[#D97706] dark:text-white',
    glow: 'bg-amber-300/30 dark:bg-[#F59E0B]/25',
    arrow: 'text-amber-800 dark:text-[#FCD34D]',
    accentBar: 'from-amber-600 to-yellow-500 dark:from-[#D97706] dark:to-[#FBBF24]',
    activeText: 'text-amber-900 dark:text-[#FCD34D]',
  },
  coffee: {
    surface: 'from-amber-50/90 via-[#FCFDFC] to-[#FCFDFC] dark:from-[#3B2112] dark:via-[#26160C] dark:to-[#0B1617]',
    border: 'border-[#E6D9C6] hover:border-amber-600 dark:border-[#C68B59]/40 dark:hover:border-[#C68B59]/85',
    selectedBorder: 'border-amber-700 ring-2 ring-amber-600/25 dark:border-[#C68B59] dark:ring-[#C68B59]/35',
    iconBox: 'bg-amber-100/90 text-amber-900 dark:bg-[#C68B59]/25 dark:text-[#FCD34D]',
    selectedIconBox: 'bg-amber-800 text-white dark:bg-[#C68B59] dark:text-[#1F120E]',
    glow: 'bg-amber-300/30 dark:bg-[#C68B59]/25',
    arrow: 'text-amber-800 dark:text-[#FCD34D]',
    accentBar: 'from-amber-700 to-amber-500 dark:from-[#C68B59] dark:to-[#FBBF24]',
    activeText: 'text-amber-900 dark:text-[#FCD34D]',
  },
  clothing: {
    surface: 'from-rose-50/90 via-[#FCFDFC] to-[#FCFDFC] dark:from-[#3A1624] dark:via-[#22101A] dark:to-[#0B1719]',
    border: 'border-[#E6D4DA] hover:border-rose-400 dark:border-[#FB7185]/35 dark:hover:border-[#FB7185]/80',
    selectedBorder: 'border-rose-500 ring-2 ring-rose-500/25 dark:border-[#FB7185] dark:ring-[#FB7185]/35',
    iconBox: 'bg-rose-100/90 text-rose-700 dark:bg-[#F43F5E]/20 dark:text-[#FDA4AF]',
    selectedIconBox: 'bg-rose-600 text-white dark:bg-[#F43F5E] dark:text-white',
    glow: 'bg-rose-300/30 dark:bg-[#FB7185]/25',
    arrow: 'text-rose-600 dark:text-[#FDA4AF]',
    accentBar: 'from-rose-500 to-pink-400 dark:from-[#F43F5E] dark:to-[#FB7185]',
    activeText: 'text-rose-700 dark:text-[#FDA4AF]',
  },
  beauty: {
    surface: 'from-purple-50/90 via-[#FCFDFC] to-[#FCFDFC] dark:from-[#2C1842] dark:via-[#1C112B] dark:to-[#0A161B]',
    border: 'border-[#DDD3E6] hover:border-purple-400 dark:border-[#C084FC]/35 dark:hover:border-[#C084FC]/80',
    selectedBorder: 'border-purple-500 ring-2 ring-purple-500/25 dark:border-[#C084FC] dark:ring-[#C084FC]/35',
    iconBox: 'bg-purple-100/90 text-purple-700 dark:bg-[#A855F7]/20 dark:text-[#E9D5FF]',
    selectedIconBox: 'bg-purple-600 text-white dark:bg-[#A855F7] dark:text-white',
    glow: 'bg-purple-300/30 dark:bg-[#C084FC]/25',
    arrow: 'text-purple-600 dark:text-[#E9D5FF]',
    accentBar: 'from-purple-500 to-fuchsia-400 dark:from-[#A855F7] dark:to-[#C084FC]',
    activeText: 'text-purple-700 dark:text-[#E9D5FF]',
  },
  'home-furniture': {
    surface: 'from-amber-50/90 via-[#FCFDFC] to-[#FCFDFC] dark:from-[#3B260F] dark:via-[#24180B] dark:to-[#0C1717]',
    border: 'border-[#E6DCCB] hover:border-amber-400 dark:border-[#FBBF24]/35 dark:hover:border-[#FBBF24]/80',
    selectedBorder: 'border-amber-500 ring-2 ring-amber-500/25 dark:border-[#FBBF24] dark:ring-[#FBBF24]/35',
    iconBox: 'bg-amber-100/90 text-amber-800 dark:bg-[#F59E0B]/20 dark:text-[#FDE68A]',
    selectedIconBox: 'bg-amber-600 text-white dark:bg-[#F59E0B] dark:text-[#031719]',
    glow: 'bg-amber-300/30 dark:bg-[#FBBF24]/25',
    arrow: 'text-amber-700 dark:text-[#FDE68A]',
    accentBar: 'from-amber-500 to-yellow-400 dark:from-[#F59E0B] dark:to-[#FBBF24]',
    activeText: 'text-amber-800 dark:text-[#FDE68A]',
  },
  agriculture: {
    surface: 'from-lime-50/90 via-[#FCFDFC] to-[#FCFDFC] dark:from-[#12331E] dark:via-[#0B2316] dark:to-[#051817]',
    border: 'border-[#CFE0CB] hover:border-emerald-600 dark:border-[#4ADE80]/35 dark:hover:border-[#4ADE80]/80',
    selectedBorder: 'border-emerald-700 ring-2 ring-emerald-600/25 dark:border-[#4ADE80] dark:ring-[#4ADE80]/35',
    iconBox: 'bg-emerald-100/90 text-emerald-800 dark:bg-[#22C55E]/20 dark:text-[#86EFAC]',
    selectedIconBox: 'bg-emerald-700 text-white dark:bg-[#22C55E] dark:text-[#031719]',
    glow: 'bg-emerald-300/30 dark:bg-[#4ADE80]/25',
    arrow: 'text-emerald-700 dark:text-[#86EFAC]',
    accentBar: 'from-emerald-600 to-lime-500 dark:from-[#22C55E] dark:to-[#4ADE80]',
    activeText: 'text-emerald-800 dark:text-[#86EFAC]',
  },
  other: {
    surface: 'from-teal-50/90 via-[#FCFDFC] to-[#FCFDFC] dark:from-[#0D303A] dark:via-[#092129] dark:to-[#05161B]',
    border: 'border-[#C9DFE0] hover:border-[#0F4C44]/60 dark:border-[#22D3EE]/35 dark:hover:border-[#22D3EE]/80',
    selectedBorder: 'border-[#0F4C44] ring-2 ring-[#0F4C44]/25 dark:border-[#22D3EE] dark:ring-[#22D3EE]/35',
    iconBox: 'bg-teal-100/90 text-[#0F4C44] dark:bg-[#06B6D4]/20 dark:text-[#A5F3FC]',
    selectedIconBox: 'bg-[#0F4C44] text-[#FCFDFC] dark:bg-[#06B6D4] dark:text-[#031719]',
    glow: 'bg-teal-300/30 dark:bg-[#22D3EE]/25',
    arrow: 'text-[#0F4C44] dark:text-[#A5F3FC]',
    accentBar: 'from-[#0F4C44] to-teal-500 dark:from-[#06B6D4] dark:to-[#22D3EE]',
    activeText: 'text-[#0F4C44] dark:text-[#A5F3FC]',
  },
};

const FALLBACK_CATEGORY_THEMES = Object.values(CATEGORY_CARD_THEMES);

export function getCategoryCardTheme(slug: string, index: number = 0): CategoryCardTheme {
  return (
    CATEGORY_CARD_THEMES[slug] ??
    FALLBACK_CATEGORY_THEMES[Math.abs(index) % FALLBACK_CATEGORY_THEMES.length]
  );
}

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
  const [loaded, setLoaded] = useState(false);

  React.useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  if (failed || !src) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center p-3 text-center ${
          darkSurface
            ? 'bg-[#E8EFEA] dark:bg-[#061D1B] text-[#46635E] dark:text-[#A9C0BD]'
            : 'bg-[#F3F6F4] dark:bg-[#141A17] text-[#46635E] dark:text-stone-500'
        }`}
      >
        <ShoppingBag
          className={`w-6 h-6 mb-1 ${darkSurface ? 'text-[#0F4C44]/60 dark:text-[#00D68F]/60' : 'opacity-60'}`}
        />
        {fallbackTitle && (
          <span className="text-[11px] font-medium line-clamp-2">{fallbackTitle}</span>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {!loaded && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 animate-pulse ${
            darkSurface ? 'bg-[#DCE7E3] dark:bg-[#092825]' : 'bg-[#E4ECE9] dark:bg-[#1C2420]'
          }`}
        />
      )}
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true);
          setLoaded(true);
        }}
        className={`${className} transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
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
      <article className="bg-[#FCFDFC] dark:bg-[#092825] rounded-2xl border border-[#D2E0DC] dark:border-[#123E39] overflow-hidden flex flex-col shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] hover:shadow-[0_8px_20px_-8px_rgba(15,76,68,0.16)] dark:shadow-md dark:shadow-black/25 hover:border-[#0F4C44]/45 dark:hover:border-[#00D68F]/50 transition-all">
        <div className="relative aspect-[4/3] bg-[#E8EFEA] dark:bg-[#061D1B] overflow-hidden">
          <button
            type="button"
            onClick={() => navigate({ name: 'product', productId: product.productId })}
            aria-label={`View ${product.name}`}
            className="w-full h-full block text-left focus-visible:outline-2 focus-visible:outline-[#0F4C44] dark:focus-visible:outline-[#00D68F]"
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
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-[#0F4C44] dark:bg-[#00D68F] text-[#FCFDFC] dark:text-[#031719] text-[10px] font-bold tabular-nums shadow-sm">
              -{discountPct}%
            </span>
          )}

          <button
            type="button"
            onClick={() => toggleFavorite(product.productId)}
            aria-label={isFav ? `Remove ${product.name} from favorites` : `Save ${product.name} to favorites`}
            className="absolute top-1.5 right-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-[#FCFDFC]/92 dark:bg-[#031719]/75 backdrop-blur-xs text-[#0E2421] dark:text-[#F5FAFA] hover:text-rose-600 dark:hover:text-rose-400 border border-[#D2E0DC] dark:border-white/10 transition-colors"
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>

          {outOfStock && (
            <div className="absolute inset-0 bg-[#0E2421]/50 dark:bg-[#031719]/75 flex items-center justify-center pointer-events-none">
              <span className="bg-[#FCFDFC] dark:bg-[#092825] text-[#0E2421] dark:text-[#F5FAFA] text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-[#D2E0DC] dark:border-[#123E39]">
                {t('outOfStock')}
              </span>
            </div>
          )}
        </div>

        <div className="p-3 flex-1 flex flex-col justify-between gap-2">
          <div>
            <div className="flex items-center gap-1 text-[11px] text-[#46635E] dark:text-[#A9C0BD] truncate">
              <span className="truncate font-semibold text-[#0F4C44] dark:text-[#00D68F]">{product.shopName}</span>
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
              <h3 className="text-[13px] font-semibold text-[#0E2421] dark:text-[#F5FAFA] leading-snug line-clamp-2 hover:text-[#0F4C44] dark:hover:text-[#00D68F] transition-colors">
                {product.name}
              </h3>
            </button>

            <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px]">
              <span
                className={`font-medium tabular-nums truncate ${
                  outOfStock ? 'text-rose-600 dark:text-rose-400' : 'text-[#46635E] dark:text-[#A9C0BD]'
                }`}
              >
                {outOfStock
                  ? t('outOfStock')
                  : product.stock <= 5
                    ? t('onlyLeftInStock', { count: product.stock })
                    : t('inStockCount', { count: product.stock })}
              </span>
              {product.rating != null && product.rating > 0 ? (
                <span className="inline-flex items-center gap-0.5 shrink-0 tabular-nums text-[#0E2421] dark:text-[#F5FAFA] font-medium">
                  <Star className="w-3 h-3 fill-[#F59E0B] text-[#F59E0B]" />
                  <span>{product.rating.toFixed(1)}</span>
                </span>
              ) : proximity ? (
                <span className="shrink-0 tabular-nums text-[#46635E] dark:text-[#A9C0BD]">
                  {proximity.distanceLabel}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-end justify-between gap-2 pt-1.5 border-t border-[#E3ECE8] dark:border-white/10">
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-[#0F4C44] dark:text-[#00D68F] tabular-nums whitespace-nowrap">
                {formatETB(product.price)}
              </div>
              {hasDiscount && (
                <div className="text-[11px] text-[#46635E]/65 dark:text-[#A9C0BD]/60 line-through tabular-nums whitespace-nowrap mt-0.5">
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
                  ? 'bg-[#047857] dark:bg-[#00C8D7] text-[#FCFDFC] dark:text-[#031719] shadow-md shadow-[#0F4C44]/25 dark:shadow-[#00C8D7]/25'
                  : 'bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 text-[#FCFDFC] dark:text-[#031719] font-bold shadow-[0_4px_12px_-4px_rgba(15,76,68,0.35)] dark:shadow-md dark:shadow-[#00D68F]/20 disabled:bg-[#EBF1EE] dark:disabled:bg-[#061D1B] disabled:from-[#EBF1EE] disabled:to-[#EBF1EE] dark:disabled:from-[#061D1B] dark:disabled:to-[#061D1B] disabled:text-[#46635E]/40 dark:disabled:text-[#A9C0BD]/40 disabled:shadow-none'
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
    <article className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] overflow-hidden flex flex-col shadow-[0_2px_10px_-3px_rgba(15,76,68,0.08)] hover:shadow-[0_8px_20px_-8px_rgba(15,76,68,0.15)] hover:border-[#0F4C44]/40 transition-all">
      <div className="relative aspect-[4/3] bg-[#E8EFEA] dark:bg-[#141A17] overflow-hidden">
        <button
          type="button"
          onClick={() => navigate({ name: 'product', productId: product.productId })}
          aria-label={`View ${product.name}`}
          className="w-full h-full block text-left focus-visible:outline-2 focus-visible:outline-[#0F4C44] dark:focus-visible:outline-[#10B981]"
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
          className="absolute top-1.5 right-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-[#FCFDFC]/92 dark:bg-[#1C2420]/90 backdrop-blur-xs text-[#0E2421] dark:text-stone-200 hover:text-rose-600 dark:hover:text-rose-400 border border-[#D2E0DC] dark:border-transparent shadow-xs transition-colors"
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-600 text-rose-600 dark:fill-rose-500 dark:text-rose-500' : ''}`} />
        </button>

        {outOfStock && (
          <div className="absolute inset-0 bg-[#0E2421]/45 dark:bg-[#141A17]/70 flex items-center justify-center pointer-events-none">
            <span className="bg-[#FCFDFC] dark:bg-[#1C2420] text-[#0E2421] dark:text-stone-100 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-[#D2E0DC] dark:border-[#2A3630]">
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
        className={`${fullWidth ? 'w-full min-w-0' : 'w-56 shrink-0'} rounded-2xl border overflow-hidden flex flex-col shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] hover:shadow-[0_8px_20px_-8px_rgba(15,76,68,0.16)] dark:shadow-md dark:shadow-black/25 transition-all ${
          isNearestCard
            ? 'bg-[#FCFDFC] dark:bg-[#092825] border-[#0F4C44] dark:border-[#00D68F] ring-1 ring-[#0F4C44]/25 dark:ring-[#00D68F]/35'
            : 'bg-[#FCFDFC] dark:bg-[#092825] border-[#D2E0DC] dark:border-[#123E39] hover:border-[#0F4C44]/45 dark:hover:border-[#00D68F]/50'
        }`}
      >
        <div className="relative h-24 w-full bg-[#E8EFEA] dark:bg-[#061D1B] overflow-hidden">
          <button
            type="button"
            onClick={() => navigate({ name: 'shop', shopId: shop.shopId })}
            aria-label={shop.name}
            className="w-full h-full block text-left group focus-visible:outline-2 focus-visible:outline-[#0F4C44] dark:focus-visible:outline-[#00D68F]"
          >
            <ResilientImage
              src={shop.coverImageUrl || shop.logoUrl}
              alt={shop.name}
              fallbackTitle={shop.name}
              darkSurface
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#031719]/75 dark:from-[#031719]/85 via-transparent to-transparent" />
            <div className="absolute bottom-2 left-3 w-9 h-9 rounded-xl overflow-hidden bg-[#FCFDFC] dark:bg-[#031719] border border-[#D2E0DC] dark:border-[#14443F] shadow-sm">
              <ResilientImage src={shop.logoUrl} alt={`${shop.name} logo`} fallbackTitle={shop.name} darkSurface />
            </div>
          </button>

          {isVerified && (
            <span className="pointer-events-none absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FCFDFC]/94 dark:bg-[#031719]/85 backdrop-blur-xs border border-[#0F4C44]/25 dark:border-[#00D68F]/35 text-[#0F4C44] dark:text-[#00D68F] text-[10px] font-semibold">
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
              className="absolute top-1.5 right-1.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full bg-[#FCFDFC]/92 dark:bg-[#031719]/80 backdrop-blur-xs text-[#0E2421] dark:text-[#F5FAFA] hover:text-rose-600 dark:hover:text-rose-400 border border-[#D2E0DC] dark:border-white/15 transition-colors active:scale-95"
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
          ) : null}

          {proximity && (
            <span
              className={`pointer-events-none absolute right-2 px-2 py-0.5 rounded-lg bg-[#FCFDFC]/94 dark:bg-[#031719]/85 backdrop-blur-xs border border-[#D2E0DC] dark:border-white/10 text-[#0E2421] dark:text-[#F5FAFA] text-[10px] font-medium tabular-nums ${
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
              <h3 className="text-[13px] font-semibold text-[#0E2421] dark:text-[#F5FAFA] truncate hover:text-[#0F4C44] dark:hover:text-[#00D68F] transition-colors">
                {shop.name}
              </h3>
              {isVerified && (
                <BadgeCheck className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#00D68F] shrink-0" aria-label={t('verifiedMerchantLabel')} />
              )}
            </button>

            <div className="flex items-center justify-between gap-1.5 mt-1 text-[11px] text-[#46635E] dark:text-[#A9C0BD] min-w-0">
              <span className="flex items-center gap-1 truncate min-w-0">
                <MapPin className="w-3 h-3 text-[#047857] dark:text-[#00D68F] shrink-0" />
                <span className="truncate">{getLocalizedNeighborhood(shop.neighborhood, language)}</span>
              </span>

              {hasRealRating ? (
                <span className="flex items-center gap-0.5 font-medium text-[#0E2421] dark:text-[#F5FAFA] shrink-0 tabular-nums">
                  <Star className="w-3 h-3 fill-[#F59E0B] text-[#F59E0B]" />
                  <span>{shop.rating.toFixed(1)}</span>
                  {shop.reviewCount > 0 && (
                    <span className="text-[#46635E] dark:text-[#A9C0BD]">({shop.reviewCount})</span>
                  )}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-[#047857] dark:text-[#00D68F] shrink-0">
                  {t('newShopBadge')}
                </span>
              )}
            </div>

            {showDescription && shop.description && (
              <p className="text-[11px] text-[#46635E] dark:text-[#A9C0BD] leading-relaxed line-clamp-2 mt-1.5">
                {shop.description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate({ name: 'shop', shopId: shop.shopId })}
            className="w-full min-h-[40px] px-3 rounded-xl bg-[#E7F1ED] dark:bg-[#031719] hover:bg-gradient-to-r hover:from-[#0F4C44] hover:to-[#047857] dark:hover:from-[#00D68F] dark:hover:to-[#00C8D7] text-[#0F4C44] dark:text-[#00D68F] hover:text-[#FCFDFC] dark:hover:text-[#031719] border border-[#BFD6CE] dark:border-[#00D68F]/35 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
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
      className={`w-60 shrink-0 rounded-2xl border p-3 text-left flex flex-col gap-2 shadow-[0_2px_10px_-3px_rgba(15,76,68,0.08)] hover:shadow-[0_8px_20px_-8px_rgba(15,76,68,0.15)] transition-all ${
        isNearestCard
          ? 'bg-[#E7F1ED]/70 dark:bg-[#10B981]/10 border-[#0F4C44] dark:border-[#10B981] ring-2 ring-[#0F4C44]/15 dark:ring-[#10B981]/20'
          : 'bg-[#FCFDFC] dark:bg-[#1C2420] border-[#D2E0DC] dark:border-[#2A3630] hover:border-[#0F4C44]/45 dark:hover:border-[#10B981]/50'
      }`}
    >
      {isNearestCard && proximity && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0F4C44] dark:text-[#10B981] tabular-nums">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {t('nearestShopDistanceNearest', { distance: proximity.distanceLabel })}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#F3F6F4] dark:bg-[#141A17] shrink-0 border border-[#D2E0DC] dark:border-[#2A3630]">
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

export const DiscoverShopCard: React.FC<{
  shop: Shop;
  showDistance?: boolean;
  isPreview?: boolean;
}> = ({ shop, showDistance = false, isPreview = false }) => {
  const {
    navigate,
    openShopChat,
    firebaseUser,
    proximityByShopId,
    language,
    t,
  } = useMarketplace();
  const [connectOpen, setConnectOpen] = useState(false);

  const proximity = showDistance ? proximityByShopId[shop.shopId] : undefined;
  const isVerified = isVerifiedMerchantShop(shop);
  const availability = getShopAvailabilityStatus(shop);
  const isTempClosed = availability === 'temporarily_closed';
  const mainCategory = inferShopMainCategory(shop);
  const categoryLabel = t(SHOP_DIR_CATEGORY_TRANSLATION_KEYS[mainCategory] || 'shopDirCatOther');
  const productTypes = (shop.productTypes ?? []).filter((item) => item.trim().length > 0);
  const visibleProductTypes = productTypes.slice(0, 3);
  const remainingTypesCount = Math.max(0, productTypes.length - visibleProductTypes.length);
  const callablePhone = resolveShopCallablePhone(shop);
  const isOwnShop = Boolean(firebaseUser?.uid && shop.ownerUid === firebaseUser.uid);

  const locationLine = [
    shop.neighborhood ? getLocalizedNeighborhood(shop.neighborhood, language) : '',
    shop.city || '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <article className="w-full min-w-0 rounded-2xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#123E39] hover:border-[#0F4C44]/50 dark:hover:border-[#00D68F]/50 shadow-[0_2px_12px_-4px_rgba(15,76,68,0.10)] hover:shadow-[0_10px_24px_-10px_rgba(15,76,68,0.18)] dark:shadow-md dark:shadow-black/25 overflow-hidden flex flex-col transition-all">
      {/* Compact Header Strip with Logo, Name, Category & Status */}
      <div className="p-3.5 pb-2.5 flex items-start gap-3">
        <button
          type="button"
          disabled={isPreview}
          onClick={() => !isPreview && navigate({ name: 'shop', shopId: shop.shopId })}
          aria-label={shop.name}
          className="w-13 h-13 rounded-2xl overflow-hidden bg-[#E8EFEA] dark:bg-[#061D1B] border border-[#D2E0DC] dark:border-[#14443F] shrink-0 shadow-xs focus-visible:outline-2 focus-visible:outline-[#0F4C44] dark:focus-visible:outline-[#00D68F]"
        >
          <ResilientImage
            src={shop.logoUrl || shop.coverImageUrl}
            alt={`${shop.name} logo`}
            fallbackTitle={shop.name}
            darkSurface
          />
        </button>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              disabled={isPreview}
              onClick={() => !isPreview && navigate({ name: 'shop', shopId: shop.shopId })}
              className="min-w-0 text-left flex items-center gap-1 group"
            >
              <h3 className="text-[14px] font-bold text-[#0E2421] dark:text-[#F5FAFA] truncate group-hover:text-[#0F4C44] dark:group-hover:text-[#00D68F] transition-colors">
                {shop.name}
              </h3>
              {isVerified && (
                <BadgeCheck
                  className="w-3.5 h-3.5 text-[#047857] dark:text-[#00D68F] shrink-0"
                  aria-label={t('verifiedMerchantLabel')}
                />
              )}
            </button>

            <span
              className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                isTempClosed
                  ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-300/80 dark:border-amber-400/35 text-amber-800 dark:text-amber-300'
                  : 'bg-[#E5F2EE] dark:bg-[#00D68F]/15 border-[#0F4C44]/20 dark:border-[#00D68F]/35 text-[#0F4C44] dark:text-[#00D68F]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full ${
                  isTempClosed ? 'bg-amber-500 dark:bg-amber-400' : 'bg-[#047857] dark:bg-[#00D68F]'
                }`}
              />
              <span>{isTempClosed ? t('shopStatusTempClosed') : t('shopStatusActive')}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            <span className="font-semibold text-[#0F4C44] dark:text-[#00C8D7]">
              {categoryLabel}
            </span>
            {locationLine && (
              <>
                <span aria-hidden="true" className="text-[#9AB5AE] dark:text-[#35635D]">·</span>
                <span className="inline-flex items-center gap-1 text-[#46635E] dark:text-[#A9C0BD] truncate">
                  <MapPin className="w-3 h-3 text-[#047857] dark:text-[#00D68F] shrink-0" />
                  <span className="truncate">{locationLine}</span>
                </span>
              </>
            )}
            {proximity && (
              <span className="text-[10px] font-medium text-[#46635E] dark:text-[#A9C0BD] tabular-nums shrink-0">
                ({proximity.distanceLabel})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Product Types & Concise Description */}
      <div className="px-3.5 pb-3 flex-1 flex flex-col justify-between gap-2.5">
        <div className="space-y-2">
          {visibleProductTypes.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {visibleProductTypes.map((typeTag) => (
                <span
                  key={typeTag}
                  className="px-2 py-0.5 rounded-md bg-[#F3F6F4] dark:bg-[#061D1B] border border-[#D2E0DC] dark:border-[#14443F] text-[10px] font-medium text-[#2B4945] dark:text-[#CFE0DD] truncate max-w-[140px]"
                >
                  {typeTag}
                </span>
              ))}
              {remainingTypesCount > 0 && (
                <span className="text-[10px] font-semibold text-[#46635E] dark:text-[#A9C0BD]">
                  +{remainingTypesCount}
                </span>
              )}
            </div>
          )}

          {shop.description && (
            <p className="text-xs text-[#46635E] dark:text-[#A9C0BD] leading-relaxed line-clamp-2">
              {shop.description}
            </p>
          )}
        </div>

        {/* Clean 2-Action Bar: View Shop + Prominent Connect with Owner */}
        <div className="pt-2.5 border-t border-[#E3ECE8] dark:border-white/10 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isPreview}
              onClick={() => !isPreview && navigate({ name: 'shop', shopId: shop.shopId })}
              className="min-h-[40px] px-2.5 rounded-xl bg-[#F3F6F4] dark:bg-[#061D1B] hover:bg-[#E7F1ED] dark:hover:bg-[#0D332F] border border-[#D2E0DC] dark:border-[#14443F] text-[#0F4C44] dark:text-[#F5FAFA] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
            >
              <Store className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t('viewShopBtn')}</span>
            </button>

            <button
              type="button"
              onClick={() => setConnectOpen((prev) => !prev)}
              aria-expanded={connectOpen}
              className="min-h-[40px] px-2.5 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 text-[#FCFDFC] dark:text-[#031719] text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-[0_4px_12px_-4px_rgba(15,76,68,0.32)] dark:shadow-md dark:shadow-[#00D68F]/20 active:scale-[0.98] transition-all"
            >
              {connectOpen ? (
                <>
                  <X className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('close')}</span>
                </>
              ) : (
                <>
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('connectWithOwnerBtn')}</span>
                </>
              )}
            </button>
          </div>

          {connectOpen && (
            <div className="p-2.5 rounded-xl bg-[#F3F6F4] dark:bg-[#061D1B] border border-[#D2E0DC] dark:border-[#14443F] space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {callablePhone.callable && callablePhone.telHref ? (
                  <a
                    href={isPreview ? undefined : callablePhone.telHref}
                    onClick={isPreview ? (e) => e.preventDefault() : undefined}
                    aria-label={`${t('callShopBtn')} ${shop.name}`}
                    className="min-h-[38px] px-2.5 rounded-xl bg-[#0F4C44] hover:bg-[#047857] dark:bg-[#00D68F] dark:hover:bg-[#00C8D7] text-[#FCFDFC] dark:text-[#031719] text-[11px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{t('callShopBtn')}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title={t('shopPhoneUnavailableHint')}
                    className="min-h-[38px] px-2.5 rounded-xl bg-[#E8EFEA] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] text-[#5E7B76] dark:text-[#7E9E9A] text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-not-allowed opacity-75"
                  >
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{t('shopPhoneUnavailable')}</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isPreview || isOwnShop}
                  onClick={() => {
                    if (!isPreview && !isOwnShop) {
                      openShopChat(shop);
                    }
                  }}
                  title={isOwnShop ? t('shopOwnProfileChatBlocked') : undefined}
                  className="min-h-[38px] px-2.5 rounded-xl bg-[#FCFDFC] dark:bg-[#092825] hover:bg-[#E7F1ED] dark:hover:bg-[#0E3531] border border-[#BFD6CE] dark:border-[#00D68F]/35 text-[#0F4C44] dark:text-[#00D68F] text-[11px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('chatWithOwnerBtn')}</span>
                </button>
              </div>
              {callablePhone.callable && callablePhone.displayPhone && (
                <div className="text-[10px] text-[#46635E] dark:text-[#A9C0BD] text-center tabular-nums">
                  {callablePhone.displayPhone}
                </div>
              )}
              {isOwnShop && (
                <div className="text-[10px] text-[#46635E] dark:text-[#A9C0BD] text-center">
                  {t('shopOwnProfileChatBlocked')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
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
    <div className="w-12 h-12 rounded-2xl bg-[#FCFDFC] dark:bg-[#1C2420] border border-[#D2E0DC] dark:border-[#2A3630] text-[#0F4C44] dark:text-stone-400 flex items-center justify-center mb-3 shadow-[0_2px_8px_-3px_rgba(15,76,68,0.12)]">
      {icon ?? <ShoppingBag className="w-6 h-6" />}
    </div>
    <h3 className="text-base font-semibold text-[#0E2421] dark:text-stone-100">{title}</h3>
    <p className="text-xs text-[#46635E] dark:text-stone-400 mt-1 max-w-[260px] leading-relaxed">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-4 px-5 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] hover:brightness-105 dark:from-[#10B981] dark:to-[#10B981] dark:hover:from-[#059669] dark:hover:to-[#059669] text-[#FCFDFC] dark:text-[#0B1410] text-xs font-semibold transition-all shadow-xs"
      >
        {actionLabel}
      </button>
    )}
  </div>
);
