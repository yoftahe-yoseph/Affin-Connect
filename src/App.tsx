/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { MarketplaceProvider, useMarketplace } from './context/MarketplaceContext';
import { MobileSimulatorShell } from './components/MobileSimulatorShell';
import { BuyerSellerChatModal } from './components/BuyerSellerChatModal';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SearchScreen } from './screens/SearchScreen';
import { ProductDetailScreen } from './screens/ProductDetailScreen';
import { ShopDetailScreen } from './screens/ShopDetailScreen';
import {
  CartScreen,
  CheckoutScreen,
  OrderConfirmationScreen,
} from './screens/CartCheckoutScreen';
import { OrdersScreen } from './screens/OrdersScreen';
import {
  CategoriesScreen,
  FavoritesScreen,
  NotificationsScreen,
  ProfileScreen,
} from './screens/AccountScreens';
import { LoyaltyScreen } from './screens/LoyaltyScreen';
import { SharedWishlistScreen } from './screens/SharedWishlistScreen';
import { SellerPortalScreen } from './screens/SellerPortalScreen';
import { AdminPortalScreen } from './screens/AdminPortalScreen';
import { ExploreMapScreen } from './screens/ExploreMapScreen';
import { ConciergeChatScreen } from './screens/ConciergeChatScreen';
import { VideoStudioScreen } from './screens/VideoStudioScreen';
import { BRAND_ASSETS } from './data/seedData';

const AccessRestrictedView: React.FC<{ target: 'seller' | 'admin' }> = ({ target }) => {
  const { navigate, setActiveRoleView, t } = useMarketplace();
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center min-h-full">
      <div className="w-14 h-14 rounded-2xl bg-[#FFF7ED] dark:bg-[#C2410C]/20 border border-[#C2410C]/20 dark:border-[#FB923C]/30 text-[#C2410C] dark:text-[#FB923C] flex items-center justify-center mb-4">
        <Lock className="w-6 h-6" />
      </div>
      <h1 className="text-base font-display font-bold text-stone-900 dark:text-stone-100">
        {t('accessRestrictedTitle')}
      </h1>
      <p className="text-xs text-stone-600 dark:text-stone-300 mt-1.5 max-w-[280px] leading-relaxed">
        {target === 'seller' ? t('accessRestrictedSellerDesc') : t('accessRestrictedAdminDesc')}
      </p>
      <div className="w-full max-w-[260px] mt-5 space-y-2">
        <button
          type="button"
          onClick={() => {
            setActiveRoleView('customer');
            navigate({ name: 'home' });
          }}
          className="w-full min-h-[44px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold transition-colors"
        >
          {t('backToHome')}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveRoleView('customer');
            navigate({ name: 'profile' });
          }}
          className="w-full min-h-[44px] rounded-xl bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] text-stone-700 dark:text-stone-200 text-xs font-semibold hover:bg-[#FAF8F5] dark:hover:bg-[#242E29] transition-colors"
        >
          {t('goToAccount')}
        </button>
      </div>
    </div>
  );
};

const ScreenRouter: React.FC = () => {
  const {
    route,
    authLoading,
    isAuthGateActive,
    canAccessSeller,
    canAccessAdmin,
    developerMode,
    t,
  } = useMarketplace();

  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#FAF8F5] dark:bg-[#141A17] min-h-full">
        <img
          src={BRAND_ASSETS.logo}
          alt="Affin Connect"
          className="w-14 h-14 rounded-2xl object-cover border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm mb-4"
        />
        <Loader2 className="w-5 h-5 animate-spin text-[#047857] dark:text-[#10B981] mb-2" />
        <p className="text-xs font-medium text-stone-600 dark:text-stone-300">
          {t('authCheckingSession')}
        </p>
      </div>
    );
  }

  if (isAuthGateActive) {
    return <OnboardingScreen />;
  }

  switch (route.name) {
    case 'onboarding':
      return <OnboardingScreen />;
    case 'home':
      return <HomeScreen />;
    case 'search':
      return (
        <SearchScreen
          initialQuery={route.initialQuery}
          initialCategory={route.initialCategory}
        />
      );
    case 'categories':
      return <CategoriesScreen />;
    case 'product':
      return <ProductDetailScreen productId={route.productId} />;
    case 'shop':
      return <ShopDetailScreen shopId={route.shopId} />;
    case 'cart':
      return <CartScreen />;
    case 'checkout':
      return <CheckoutScreen />;
    case 'order_confirmation':
      return <OrderConfirmationScreen orderId={route.orderId} />;
    case 'orders':
      return <OrdersScreen selectedOrderId={route.selectedOrderId} initialTab={route.initialTab} />;
    case 'favorites':
      return <FavoritesScreen />;
    case 'notifications':
      return <NotificationsScreen />;
    case 'profile':
      return <ProfileScreen section={route.section} />;
    case 'loyalty':
      return <LoyaltyScreen />;
    case 'shared_wishlist':
      return (
        <SharedWishlistScreen
          shareId={route.shareId}
          fallbackProductIds={route.fallbackProductIds}
        />
      );
    case 'seller':
      if (!canAccessSeller && !developerMode) {
        return <AccessRestrictedView target="seller" />;
      }
      return <SellerPortalScreen tab={route.tab} />;
    case 'admin':
      if (!canAccessAdmin && !developerMode) {
        return <AccessRestrictedView target="admin" />;
      }
      return <AdminPortalScreen tab={route.tab} />;
    case 'map':
      return <ExploreMapScreen initialShopId={route.shopId} />;
    case 'chat':
      return <ConciergeChatScreen />;
    case 'video':
      return <VideoStudioScreen />;
  }
};

export default function App() {
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  return (
    <MarketplaceProvider>
      {mapsQuotaExceeded && (
        <div className="bg-[#FFF7ED] dark:bg-[#1C2420] border-b border-[#D97706]/30 dark:border-[#F59E0B]/30 text-[#9A3412] dark:text-[#FCD34D] px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-[#C2410C] dark:text-[#F59E0B] hover:opacity-80"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <MobileSimulatorShell>
        <ScreenRouter />
      </MobileSimulatorShell>
      <BuyerSellerChatModal />
    </MarketplaceProvider>
  );
}
