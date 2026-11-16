import React from 'react';
import {
  Bell,
  CheckCircle2,
  Home,
  LogIn,
  LogOut,
  MapPin,
  MessageSquare,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  User,
  Video,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { getLocalizedNeighborhood } from '../constants/translations';
import { HAWASSA_NEIGHBORHOODS } from '../utils/marketplaceLogic';
import { BRAND_ASSETS } from '../data/seedData';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import type { UserRole } from '../types';

export const MobileSimulatorShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    route,
    navigate,
    routePathString,
    cart,
    unreadNotificationCount,
    firebaseUser,
    authLoading,
    isAuthGateActive,
    openAuthScreen,
    signOutUser,
    firebaseConnected,
    selectedNeighborhood,
    setSelectedNeighborhood,
    activeRoleView,
    setActiveRoleView,
    canAccessAdmin,
    developerMode,
    supervisionAttentionCount,
    language,
    cartToast,
    dismissCartToast,
    t,
  } = useMarketplace();

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const showBottomTabs = !authLoading && !isAuthGateActive && route.name !== 'onboarding';
  const showDesktopSidebar = !authLoading && !isAuthGateActive && route.name !== 'onboarding';

  const handleRoleSwitch = (role: UserRole) => {
    setActiveRoleView(role);
    if (role === 'customer') {
      navigate({ name: 'home' });
    } else if (role === 'seller') {
      navigate({ name: 'seller', tab: 'dashboard' });
    } else {
      navigate({ name: 'admin', tab: 'overview' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F3EFE9] dark:bg-[#0E1310] text-stone-900 dark:text-stone-100 flex flex-col md:flex-row items-center md:items-stretch justify-center md:gap-8 md:p-6 lg:p-8 transition-colors">
      <div id="hg-phone-recaptcha-container" className="sr-only" aria-hidden="true" />
      {/* Android / Expo Mobile Viewport Frame */}
      <div className="w-full md:w-[404px] md:max-w-[404px] h-dvh md:h-[824px] bg-[#FAF8F5] dark:bg-[#141A17] md:rounded-[40px] md:border-[7px] md:border-stone-900 dark:md:border-[#232D28] md:shadow-2xl flex flex-col overflow-hidden relative shrink-0">
        {/* Android Status Bar (visible on desktop simulator frame) */}
        <div className="hidden md:flex items-center justify-between px-6 pt-2.5 pb-1.5 bg-white dark:bg-[#1C2420] text-[11px] font-semibold text-stone-700 dark:text-stone-300 border-b border-[#E7E5E4] dark:border-[#2A3630] shrink-0 select-none">
          <span className="tabular-nums">12:50</span>
          <div className="w-16 h-3.5 bg-stone-900 dark:bg-[#0E1310] rounded-full" aria-hidden="true" />
          <div className="flex items-center gap-1.5">
            {firebaseConnected ? (
              <Wifi className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981]" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B]" />
            )}
            <span className="tabular-nums">5G</span>
          </div>
        </div>

        {/* Quick One-Click Admin Governance Bar (only for authenticated Admins or Developer Mode) */}
        {showBottomTabs && (canAccessAdmin || developerMode) && route.name !== 'admin' && (
          <div className="px-3 py-1.5 bg-[#064E3B] text-white flex items-center justify-between gap-2 shrink-0 border-b border-[#10B981]/30">
            <span className="text-[11px] font-semibold flex items-center gap-1.5 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-[#FDE68A] shrink-0" />
              <span className="truncate">{t('adminTitle')}</span>
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {supervisionAttentionCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveRoleView('admin');
                    navigate({ name: 'admin', tab: 'supervision' });
                  }}
                  className="px-2 py-1 rounded-lg bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] text-[10px] font-bold shrink-0 transition-colors tabular-nums"
                >
                  {t('adminSupervisionTab')} ({supervisionAttentionCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setActiveRoleView('admin');
                  navigate({ name: 'admin', tab: 'users' });
                }}
                className="px-2.5 py-1 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-[#141A17] hover:text-white text-[10px] font-bold shrink-0 transition-colors"
              >
                {t('openAdminConsole')}
              </button>
            </div>
          </div>
        )}

        {/* Main Scrollable Screen Area */}
        <main className="flex-1 overflow-y-auto mobile-scroll bg-[#FAF8F5] dark:bg-[#141A17] flex flex-col">
          {children}
        </main>

        {/* Cart Feedback Toast */}
        {cartToast && showBottomTabs && route.name !== 'cart' && route.name !== 'checkout' && (
          <div
            role="status"
            aria-live="polite"
            className="mx-3 mb-2 px-3 py-2.5 rounded-xl bg-[#1C2420] border border-[#2A3630] text-white shadow-lg flex items-center justify-between gap-2 shrink-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
              <span className="text-xs font-medium truncate">{cartToast.message}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {cartToast.actionRoute !== null && (
                <button
                  type="button"
                  onClick={() => {
                    const target = cartToast.actionRoute ?? { name: 'cart' };
                    dismissCartToast();
                    navigate(target);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#F59E0B] text-[#141A17] text-[11px] font-bold whitespace-nowrap hover:bg-[#D97706] hover:text-white transition-colors"
                >
                  {cartToast.actionLabel ?? t('viewCart')}
                </button>
              )}
              <button
                type="button"
                onClick={dismissCartToast}
                aria-label="Dismiss"
                className="p-1 text-stone-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Bottom Tab Navigation (Expo Router Customer / Role Tabs) */}
        {showBottomTabs && (
          <nav
            aria-label="Primary Marketplace Navigation"
            className="bg-white/95 dark:bg-[#1C2420]/95 backdrop-blur-md border-t border-[#E7E5E4] dark:border-[#2A3630] px-2 py-1.5 grid grid-cols-5 gap-1 items-center shrink-0"
          >
            <button
              type="button"
              onClick={() => {
                setActiveRoleView('customer');
                navigate({ name: 'home' });
              }}
              aria-label={t('navHome')}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                route.name === 'home'
                  ? 'bg-[#ECFDF5] text-[#047857] dark:bg-[#10B981]/15 dark:text-[#10B981] font-semibold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] leading-none truncate max-w-full px-1">{t('navHome')}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate({ name: 'search' })}
              aria-label={t('navSearch')}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                route.name === 'search' || route.name === 'categories'
                  ? 'bg-[#ECFDF5] text-[#047857] dark:bg-[#10B981]/15 dark:text-[#10B981] font-semibold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <Search className="w-5 h-5" />
              <span className="text-[10px] leading-none truncate max-w-full px-1">{t('navSearch')}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate({ name: 'cart' })}
              aria-label={t('cart')}
              className={`min-h-[48px] relative flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                route.name === 'cart' || route.name === 'checkout'
                  ? 'bg-[#ECFDF5] text-[#047857] dark:bg-[#10B981]/15 dark:text-[#10B981] font-semibold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <div className="relative">
                <ShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#D97706] text-white dark:bg-[#F59E0B] dark:text-[#141A17] text-[10px] font-bold flex items-center justify-center tabular-nums shadow-xs">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-none truncate max-w-full px-1">{t('navCart')}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate({ name: 'orders' })}
              aria-label={t('orders')}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                route.name === 'orders'
                  ? 'bg-[#ECFDF5] text-[#047857] dark:bg-[#10B981]/15 dark:text-[#10B981] font-semibold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <PackageCheck className="w-5 h-5" />
              <span className="text-[10px] leading-none truncate max-w-full px-1">{t('navOrders')}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate({ name: 'profile' })}
              aria-label={t('accountAndPortals')}
              className={`min-h-[48px] relative flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                route.name === 'profile' || route.name === 'seller' || route.name === 'admin'
                  ? 'bg-[#ECFDF5] text-[#047857] dark:bg-[#10B981]/15 dark:text-[#10B981] font-semibold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <div className="relative">
                <User className="w-5 h-5" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#D97706] dark:bg-[#F59E0B]" />
                )}
              </div>
              <span className="text-[10px] leading-none truncate max-w-full px-1">{t('navAccount')}</span>
            </button>
          </nav>
        )}

        {/* Android Gesture Home Pill (desktop simulator frame only) */}
        <div className="hidden md:flex justify-center py-1.5 bg-white dark:bg-[#1C2420] shrink-0">
          <div className="w-28 h-1 rounded-full bg-stone-300 dark:bg-[#2A3630]" aria-hidden="true" />
        </div>
      </div>

      {/* Desktop Companion Panel: Functional Simulator Controls & Role Switcher */}
      {showDesktopSidebar && (
        <aside className="hidden md:flex flex-col w-80 lg:w-96 max-h-[824px] bg-white dark:bg-[#1C2420] rounded-3xl border border-[#E7E5E4] dark:border-[#2A3630] p-6 shadow-sm justify-between gap-6 overflow-y-auto">
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-[#E7E5E4] dark:border-[#2A3630]">
            <img
              src={BRAND_ASSETS.logo}
              alt="Affin Connect"
              className="w-11 h-11 rounded-xl object-cover border border-[#E7E5E4] dark:border-[#2A3630]"
            />
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 leading-tight">{t('appName')}</h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{t('tagline')}</p>
            </div>
          </div>

          {(canAccessAdmin || developerMode) && (
            <>
              {/* Active Route Indicator */}
              <div>
                <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5">
                  {t('activeRouterPath')}
                </div>
                <div className="px-3 py-2 rounded-xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] text-xs font-mono text-[#047857] dark:text-[#10B981] truncate">
                  {routePathString}
                </div>
              </div>

              {/* Role Perspective Switcher */}
              <div>
                <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-2">
                  {t('workspacePerspective')}
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] rounded-xl">
                  {(
                    [
                      { id: 'customer', label: t('roleCustomer'), Icon: ShoppingBag },
                      { id: 'seller', label: t('roleSeller'), Icon: Store },
                      { id: 'admin', label: t('roleAdmin'), Icon: ShieldCheck },
                    ] as const
                  ).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleRoleSwitch(id)}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                        activeRoleView === id
                          ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] shadow-xs'
                          : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveRoleView('admin');
                    navigate({ name: 'admin', tab: 'users' });
                  }}
                  className="mt-2.5 w-full min-h-[40px] px-3 rounded-xl bg-gradient-to-r from-[#047857] to-[#059669] hover:from-[#065F46] hover:to-[#047857] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <ShieldCheck className="w-4 h-4 text-[#FDE68A] shrink-0" />
                  <span>{t('openAdminConsole')}</span>
                </button>
              </div>
            </>
          )}

          {/* Language Switcher */}
          <div>
            <div className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5">
              {t('selectLanguage')}
            </div>
            <LanguageSwitcher variant="segmented" />
          </div>

          {/* Theme Switcher */}
          <div>
            <div className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5">
              {t('themePreferenceLabel')}
            </div>
            <ThemeSwitcher variant="segmented" />
          </div>

          {/* Hawassa Neighborhood Selector */}
          <div>
            <label
              htmlFor="sim-neighborhood"
              className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5"
            >
              {t('selectNeighborhood')}
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-[#047857] dark:text-[#10B981] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="sim-neighborhood"
                value={selectedNeighborhood}
                onChange={(e) => setSelectedNeighborhood(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-xs font-medium text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
              >
                <option value="All Hawassa" className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100">{t('allHawassaAreas')}</option>
                {HAWASSA_NEIGHBORHOODS.map((n) => (
                  <option key={n} value={n} className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100">
                    {getLocalizedNeighborhood(n, language)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Actions (Admin or Developer / Demo Mode only) */}
          {(canAccessAdmin || developerMode) && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">{t('quickShortcuts')}</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => navigate({ name: 'notifications' })}
                  className="px-3 py-2 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17] flex items-center justify-between gap-1.5"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Bell className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B] shrink-0" />
                    <span className="truncate">{t('notifications')}</span>
                  </span>
                  <span className="tabular-nums font-bold text-[#047857] dark:text-[#10B981]">
                    {unreadNotificationCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'onboarding' })}
                  className="px-3 py-2 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17] text-left truncate"
                >
                  {t('viewOnboarding')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'map' })}
                  className="px-3 py-2 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17] flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981] shrink-0" />
                  <span className="truncate">{t('hawassaMap')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'chat' })}
                  className="px-3 py-2 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17] flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B] shrink-0" />
                  <span className="truncate">{t('aiConcierge')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'video' })}
                  className="col-span-2 px-3 py-2 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17] flex items-center gap-1.5"
                >
                  <Video className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981] shrink-0" />
                  <span className="truncate">{t('videoStudio')}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Firebase Auth Card */}
        <div className="pt-4 border-t border-[#E7E5E4] dark:border-[#2A3630]">
          {firebaseUser ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                  {firebaseUser.displayName || firebaseUser.phoneNumber || firebaseUser.email}
                </div>
                {(firebaseUser.phoneNumber || firebaseUser.email) && (
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                    {firebaseUser.phoneNumber || firebaseUser.email}
                  </div>
                )}
                <div className="text-[11px] text-[#047857] dark:text-[#10B981] font-medium">
                  {t('cloudSynced')}
                </div>
              </div>
              <button
                type="button"
                onClick={signOutUser}
                className="px-3 py-2 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17] flex items-center gap-1.5 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('signOut')}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                {t('guestBannerDesc')}
              </p>
              <button
                type="button"
                onClick={openAuthScreen}
                className="w-full min-h-[42px] px-4 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span>{t('openSignInScreen')}</span>
              </button>
            </div>
          )}
        </div>
      </aside>
      )}
    </div>
  );
};
