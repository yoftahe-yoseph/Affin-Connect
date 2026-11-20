import React from 'react';
import {
  Bell,
  CheckCircle2,
  Home,
  LayoutGrid,
  LogIn,
  LogOut,
  MapPin,
  MessageSquare,
  ShieldCheck,
  ShoppingBag,
  Store,
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
import { ThemeToggleButton } from './ThemeToggleButton';
import { AffinChatbotFloatingButton, AffinChatbotPopup } from './AffinChatbotPopup';
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
    openChatbot,
    t,
  } = useMarketplace();

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const isFullPageAuth = authLoading || isAuthGateActive || route.name === 'onboarding';
  const showBottomTabs = !isFullPageAuth;
  const showDesktopSidebar = !isFullPageAuth;

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

  if (isFullPageAuth) {
    return (
      <div className="min-h-dvh w-full bg-[#F3F6F4] dark:bg-[#031719] text-[#0E2421] dark:text-[#F5FAFA] flex flex-col">
        <div id="hg-phone-recaptcha-container" className="sr-only" aria-hidden="true" />
        <main className="flex-1 flex flex-col">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4ECE9] dark:bg-[#0E1310] text-[#0E2421] dark:text-[#F5FAFA] flex flex-col md:flex-row items-center md:items-stretch justify-center md:gap-8 md:p-6 lg:p-8 transition-colors">
      <div id="hg-phone-recaptcha-container" className="sr-only" aria-hidden="true" />
      {/* Android / Expo Mobile Viewport Frame */}
      <div
        className="w-full md:w-[404px] md:max-w-[404px] h-dvh md:h-[824px] md:rounded-[40px] md:border-[7px] md:border-[#0F4C44]/85 dark:md:border-[#142624] md:shadow-[0_24px_60px_-20px_rgba(15,76,68,0.28)] dark:md:shadow-2xl flex flex-col overflow-hidden relative shrink-0 bg-[#F3F6F4] dark:bg-[#031719] transition-colors"
      >
        {/* Android Status Bar (visible on desktop simulator frame) */}
        <div
          className="hidden md:flex items-center justify-between px-6 pt-2.5 pb-1.5 text-[11px] font-semibold border-b shrink-0 select-none bg-[#0F4C44] dark:bg-[#031719] text-[#E6F4F0] dark:text-[#A9C0BD] border-[#0B3B35] dark:border-white/10"
        >
          <span className="tabular-nums">12:50</span>
          <div className="w-16 h-3.5 bg-[#082E29] dark:bg-[#020E0F] border border-white/15 dark:border-white/10 rounded-full" aria-hidden="true" />
          <div className="flex items-center gap-1.5">
            {firebaseConnected ? (
              <Wifi className="w-3.5 h-3.5 text-[#6EE7B7] dark:text-[#00D68F]" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-[#FDE68A] dark:text-[#F59E0B]" />
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

        {/* Main Scrollable Screen Area + Floating Chatbot Trigger */}
        <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden bg-[#F3F6F4] dark:bg-[#031719]">
          <main className="flex-1 overflow-y-auto overflow-x-hidden mobile-scroll flex flex-col bg-[#F3F6F4] dark:bg-[#031719]">
            {children}
          </main>
          <AffinChatbotFloatingButton />
        </div>

        {/* Cart Feedback Toast */}
        {cartToast && showBottomTabs && route.name !== 'cart' && route.name !== 'checkout' && (
          <div
            role="status"
            aria-live="polite"
            className="mx-3 mb-2 px-3 py-2.5 rounded-xl bg-[#FCFDFC] dark:bg-[#1C2420] border border-[#D2E0DC] dark:border-[#2A3630] text-[#0E2421] dark:text-white shadow-[0_6px_20px_-6px_rgba(15,76,68,0.18)] dark:shadow-lg flex items-center justify-between gap-2 shrink-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-[#047857] dark:text-[#10B981] shrink-0" />
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
                className="p-1 text-[#4B6B67] hover:text-[#0C2624] dark:text-stone-400 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Bottom Tab Navigation (Safe-area-aware 4-Tab Mobile Bar: Home, Shops, Cart, More) */}
        {showBottomTabs && (
          <nav
            aria-label="Primary Marketplace Navigation"
            className="backdrop-blur-md border-t px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] grid grid-cols-4 gap-1 items-center shrink-0 bg-[#FCFDFC]/96 dark:bg-[#041D1F]/95 border-[#D2E0DC] dark:border-white/10 shadow-[0_-4px_14px_-8px_rgba(15,76,68,0.12)] dark:shadow-none"
          >
            <button
              type="button"
              onClick={() => {
                setActiveRoleView('customer');
                navigate({ name: 'home' });
              }}
              aria-label={t('navHome')}
              aria-current={route.name === 'home' ? 'page' : undefined}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
                route.name === 'home'
                  ? 'bg-[#E5F2EE] dark:bg-[#00D68F]/15 text-[#0F4C44] dark:text-[#00D68F] font-semibold'
                  : 'text-[#46635E] dark:text-[#A9C0BD] hover:text-[#0F4C44] dark:hover:text-[#F5FAFA]'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] leading-none truncate max-w-full px-1">{t('navHome')}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate({ name: 'shops' })}
              aria-label={t('discoverShopsTitle')}
              aria-current={route.name === 'shops' || route.name === 'map' || route.name === 'shop' ? 'page' : undefined}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
                route.name === 'shops' || route.name === 'map' || route.name === 'shop'
                  ? 'bg-[#E5F2EE] dark:bg-[#00D68F]/15 text-[#0F4C44] dark:text-[#00D68F] font-semibold'
                  : 'text-[#46635E] dark:text-[#A9C0BD] hover:text-[#0F4C44] dark:hover:text-[#F5FAFA]'
              }`}
            >
              <Store className="w-5 h-5" />
              <span className="text-[10px] leading-none truncate max-w-full px-1">{t('discoverShopsNavLabel')}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate({ name: 'cart' })}
              aria-label={t('cart')}
              aria-current={route.name === 'cart' || route.name === 'checkout' ? 'page' : undefined}
              className={`min-h-[48px] relative flex flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
                route.name === 'cart' || route.name === 'checkout'
                  ? 'bg-[#E5F2EE] dark:bg-[#00D68F]/15 text-[#0F4C44] dark:text-[#00D68F] font-semibold'
                  : 'text-[#46635E] dark:text-[#A9C0BD] hover:text-[#0F4C44] dark:hover:text-[#F5FAFA]'
              }`}
            >
              <div className="relative">
                <ShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#0F4C44] dark:bg-[#00D68F] text-[#FCFDFC] dark:text-[#031719] text-[10px] font-bold flex items-center justify-center tabular-nums shadow-xs">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-none truncate max-w-full px-1">{t('navCart')}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate({ name: 'profile' })}
              aria-label={t('navMore')}
              aria-current={
                route.name === 'profile' ||
                route.name === 'orders' ||
                route.name === 'favorites' ||
                route.name === 'notifications' ||
                route.name === 'loyalty' ||
                route.name === 'seller' ||
                route.name === 'admin'
                  ? 'page'
                  : undefined
              }
              className={`min-h-[48px] relative flex flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
                route.name === 'profile' ||
                route.name === 'orders' ||
                route.name === 'favorites' ||
                route.name === 'notifications' ||
                route.name === 'loyalty' ||
                route.name === 'seller' ||
                route.name === 'admin'
                  ? 'bg-[#E5F2EE] dark:bg-[#00D68F]/15 text-[#0F4C44] dark:text-[#00D68F] font-semibold'
                  : 'text-[#46635E] dark:text-[#A9C0BD] hover:text-[#0F4C44] dark:hover:text-[#F5FAFA]'
              }`}
            >
              <div className="relative">
                <LayoutGrid className="w-5 h-5" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#047857] dark:bg-[#00D68F]" />
                )}
              </div>
              <span className="text-[10px] leading-none truncate max-w-full px-1">{t('navMore')}</span>
            </button>
          </nav>
        )}

        {/* Android Gesture Home Pill (desktop simulator frame only) */}
        <div className="hidden md:flex justify-center py-1.5 shrink-0 bg-[#FCFDFC] dark:bg-[#031719]">
          <div className="w-28 h-1 rounded-full bg-[#0F4C44]/25 dark:bg-white/25" aria-hidden="true" />
        </div>

        {/* Floating Affin Connect Chatbot Popup */}
        <AffinChatbotPopup />
      </div>

      {/* Desktop Companion Panel: Functional Simulator Controls & Role Switcher */}
      {showDesktopSidebar && (
        <aside className="hidden md:flex flex-col w-80 lg:w-96 max-h-[824px] bg-[#FCFDFC] dark:bg-[#1C2420] rounded-3xl border border-[#D2E0DC] dark:border-[#2A3630] border-t-4 border-t-[#0F4C44] dark:border-t-[#10B981]/50 p-6 shadow-[0_14px_38px_-16px_rgba(15,76,68,0.16)] dark:shadow-sm justify-between gap-6 overflow-y-auto">
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#D2E0DC] dark:border-[#2A3630]">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={BRAND_ASSETS.logo}
                alt="Affin Connect"
                className="w-11 h-11 rounded-xl object-cover border border-[#0F4C44]/25 dark:border-[#2A3630] shrink-0"
              />
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-[#0F4C44] dark:text-stone-100 leading-tight truncate">{t('appName')}</h1>
                <p className="text-xs text-[#46635E] dark:text-stone-400 truncate">{t('tagline')}</p>
              </div>
            </div>
            <ThemeToggleButton variant="button" />
          </div>

          {(canAccessAdmin || developerMode) && (
            <>
              {/* Active Route Indicator */}
              <div>
                <div className="text-[11px] font-semibold text-[#46635E] dark:text-stone-400 mb-1.5">
                  {t('activeRouterPath')}
                </div>
                <div className="px-3 py-2 rounded-xl bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] text-xs font-mono text-[#0F4C44] dark:text-[#10B981] truncate">
                  {routePathString}
                </div>
              </div>

              {/* Role Perspective Switcher */}
              <div>
                <div className="text-[11px] font-semibold text-[#46635E] dark:text-stone-400 mb-2">
                  {t('workspacePerspective')}
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] rounded-xl">
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
                          ? 'bg-[#0F4C44] dark:bg-[#10B981]/15 text-[#FCFDFC] dark:text-[#10B981] shadow-xs'
                          : 'text-[#46635E] dark:text-stone-400 hover:text-[#0F4C44] dark:hover:text-stone-100'
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
                  className="mt-2.5 w-full min-h-[40px] px-3 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] hover:from-[#0B3B35] hover:to-[#0F4C44] text-[#FCFDFC] text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <ShieldCheck className="w-4 h-4 text-[#FDE68A] shrink-0" />
                  <span>{t('openAdminConsole')}</span>
                </button>
              </div>
            </>
          )}

          {/* Language Switcher */}
          <div>
            <div className="block text-[11px] font-semibold text-[#46635E] dark:text-stone-400 mb-1.5">
              {t('selectLanguage')}
            </div>
            <LanguageSwitcher variant="segmented" />
          </div>

          {/* Hawassa Neighborhood Selector */}
          <div>
            <label
              htmlFor="sim-neighborhood"
              className="block text-[11px] font-semibold text-[#46635E] dark:text-stone-400 mb-1.5"
            >
              {t('selectNeighborhood')}
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-[#0F4C44] dark:text-[#10B981] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="sim-neighborhood"
                value={selectedNeighborhood}
                onChange={(e) => setSelectedNeighborhood(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-xs font-medium text-[#0E2421] dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#0F4C44]/10 dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
              >
                <option value="All Hawassa" className="bg-[#FCFDFC] dark:bg-[#1C2420] text-[#0E2421] dark:text-stone-100">{t('allHawassaAreas')}</option>
                {HAWASSA_NEIGHBORHOODS.map((n) => (
                  <option key={n} value={n} className="bg-[#FCFDFC] dark:bg-[#1C2420] text-[#0E2421] dark:text-stone-100">
                    {getLocalizedNeighborhood(n, language)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Actions (Admin or Developer / Demo Mode only) */}
          {(canAccessAdmin || developerMode) && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-[#46635E] dark:text-stone-400">{t('quickShortcuts')}</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => navigate({ name: 'notifications' })}
                  className="px-3 py-2 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4]/70 dark:bg-transparent text-xs font-medium text-[#0E2421] dark:text-stone-200 hover:bg-[#E7F1ED] dark:hover:bg-[#141A17] flex items-center justify-between gap-1.5 transition-colors"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Bell className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B] shrink-0" />
                    <span className="truncate">{t('notifications')}</span>
                  </span>
                  <span className="tabular-nums font-bold text-[#0F4C44] dark:text-[#10B981]">
                    {unreadNotificationCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'onboarding' })}
                  className="px-3 py-2 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4]/70 dark:bg-transparent text-xs font-medium text-[#0E2421] dark:text-stone-200 hover:bg-[#E7F1ED] dark:hover:bg-[#141A17] text-left truncate transition-colors"
                >
                  {t('viewOnboarding')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'map' })}
                  className="px-3 py-2 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4]/70 dark:bg-transparent text-xs font-medium text-[#0E2421] dark:text-stone-200 hover:bg-[#E7F1ED] dark:hover:bg-[#141A17] flex items-center gap-1.5 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#10B981] shrink-0" />
                  <span className="truncate">{t('hawassaMap')}</span>
                </button>
                <button
                  type="button"
                  onClick={openChatbot}
                  className="px-3 py-2 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4]/70 dark:bg-transparent text-xs font-medium text-[#0E2421] dark:text-stone-200 hover:bg-[#E7F1ED] dark:hover:bg-[#141A17] flex items-center gap-1.5 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B] shrink-0" />
                  <span className="truncate">{t('aiConcierge')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'video' })}
                  className="col-span-2 px-3 py-2 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4]/70 dark:bg-transparent text-xs font-medium text-[#0E2421] dark:text-stone-200 hover:bg-[#E7F1ED] dark:hover:bg-[#141A17] flex items-center gap-1.5 transition-colors"
                >
                  <Video className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#10B981] shrink-0" />
                  <span className="truncate">{t('videoStudio')}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Firebase Auth Card */}
        <div className="pt-4 border-t border-[#D2E0DC] dark:border-[#2A3630]">
          {firebaseUser ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#0E2421] dark:text-stone-100 truncate">
                  {firebaseUser.displayName || firebaseUser.phoneNumber || firebaseUser.email}
                </div>
                {(firebaseUser.phoneNumber || firebaseUser.email) && (
                  <div className="text-[11px] text-[#46635E] dark:text-stone-400 truncate">
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
                className="px-3 py-2 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-transparent text-xs font-medium text-[#0F4C44] dark:text-stone-200 hover:bg-[#E7F1ED] dark:hover:bg-[#141A17] flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('signOut')}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-[#46635E] dark:text-stone-400 leading-relaxed">
                {t('guestBannerDesc')}
              </p>
              <button
                type="button"
                onClick={openAuthScreen}
                className="w-full min-h-[42px] px-4 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] hover:from-[#0B3B35] hover:to-[#0F4C44] dark:from-[#10B981] dark:to-[#10B981] dark:hover:from-[#059669] dark:hover:to-[#059669] text-[#FCFDFC] dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
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
