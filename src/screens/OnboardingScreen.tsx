import React from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Smartphone,
  Truck,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { AuthSignInPanel } from '../components/AuthSignInPanel';
import { BRAND_ASSETS } from '../data/seedData';
import { getLocalizedNeighborhood } from '../constants/translations';
import { HAWASSA_NEIGHBORHOODS } from '../utils/marketplaceLogic';

const EthiopianTibebPattern: React.FC = () => (
  <svg
    aria-hidden="true"
    className="absolute inset-0 w-full h-full opacity-[0.14] pointer-events-none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <pattern id="hg-tibeb-pattern" width="28" height="28" patternUnits="userSpaceOnUse">
        <path
          d="M14 2L26 14L14 26L2 14Z"
          fill="none"
          stroke="#FDE68A"
          strokeWidth="1.25"
        />
        <path
          d="M14 7L21 14L14 21L7 14Z"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="0.9"
        />
        <circle cx="14" cy="14" r="1.5" fill="#FDE68A" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#hg-tibeb-pattern)" />
  </svg>
);

export const OnboardingScreen: React.FC = () => {
  const {
    firebaseUser,
    needsEmailVerification,
    welcomeBackNotice,
    selectedNeighborhood,
    setSelectedNeighborhood,
    completeOnboarding,
    continueAsGuest,
    language,
    t,
  } = useMarketplace();

  if (firebaseUser && !needsEmailVerification) {
    return (
      <div className="flex-1 flex flex-col justify-between bg-[#FAF8F5] dark:bg-[#141A17] p-5 min-h-full transition-colors">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={BRAND_ASSETS.logo}
              alt="Affin Connect Logo"
              className="w-9 h-9 rounded-xl object-cover border border-[#E7E5E4] dark:border-[#2A3630] shrink-0"
            />
            <span className="font-display font-bold text-base text-[#047857] dark:text-[#10B981] truncate">
              {t('appName')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <LanguageSwitcher variant="compact" />
            <ThemeSwitcher variant="compact" />
          </div>
        </div>

        <div className="my-auto py-5 space-y-5">
          <div className="p-4 rounded-2xl bg-[#ECFDF5] dark:bg-[#10B981]/10 border border-[#047857]/30 dark:border-[#10B981]/30 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[#047857] dark:text-[#10B981]">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>
                {welcomeBackNotice
                  ? t('welcomeBackSubtitle', { name: welcomeBackNotice.displayName })
                  : t('onboardingSignedInTitle')}
              </span>
            </div>
            <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
              {welcomeBackNotice
                ? t('welcomeBackBannerDetail', {
                    neighborhood: getLocalizedNeighborhood(
                      welcomeBackNotice.neighborhood,
                      language
                    ),
                    email: welcomeBackNotice.email,
                  })
                : t('onboardingSignedInDesc', {
                    identity:
                      firebaseUser.displayName ||
                      firebaseUser.phoneNumber ||
                      firebaseUser.email ||
                      'Hawassa Shopper',
                  })}
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold text-stone-800 dark:text-stone-200">
              {t('selectLanguage')}
            </div>
            <LanguageSwitcher variant="cards" />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold text-stone-800 dark:text-stone-200">
              {t('selectNeighborhood')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedNeighborhood('All Hawassa')}
                className={`col-span-2 p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                  selectedNeighborhood === 'All Hawassa'
                    ? 'border-[#047857] dark:border-[#10B981] bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] shadow-sm'
                    : 'border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#1C2420] text-stone-800 dark:text-stone-200'
                }`}
              >
                <span>{t('allHawassaAreas')}</span>
                {selectedNeighborhood === 'All Hawassa' && (
                  <Check className="w-4 h-4 text-[#047857] dark:text-[#10B981]" />
                )}
              </button>
              {HAWASSA_NEIGHBORHOODS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSelectedNeighborhood(n)}
                  className={`p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                    selectedNeighborhood === n
                      ? 'border-[#047857] dark:border-[#10B981] bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] shadow-sm'
                      : 'border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#1C2420] text-stone-800 dark:text-stone-200'
                  }`}
                >
                  <span>{getLocalizedNeighborhood(n, language)}</span>
                  {selectedNeighborhood === n && (
                    <Check className="w-4 h-4 text-[#047857] dark:text-[#10B981]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={completeOnboarding}
          className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-[#047857] via-[#059669] to-[#0D9488] hover:from-[#065F46] hover:to-[#047857] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-emerald-900/20"
        >
          <span>{t('startExploring')}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-between bg-[#FAF8F5] dark:bg-[#141A17] px-4 py-4 min-h-full transition-colors">
      {/* Top Bar: Language & Dark Mode Quick Controls */}
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display font-bold text-sm text-[#047857] dark:text-[#10B981] truncate">
            {t('appName')}
          </span>
          <span className="text-stone-300 dark:text-stone-600" aria-hidden="true">
            ·
          </span>
          <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 truncate">
            {t('location')}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <LanguageSwitcher variant="compact" />
          <ThemeSwitcher variant="compact" />
        </div>
      </div>

      {/* Main Centered Stack */}
      <div className="my-auto space-y-3.5">
        {/* Sidama / Hawassa Sunrise Hero Banner Card */}
        <section
          aria-label={t('authScreenTitle')}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#D97706] p-4 text-white shadow-lg shadow-emerald-950/15"
        >
          <EthiopianTibebPattern />
          <div
            aria-hidden="true"
            className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-[#FBBF24]/25 blur-2xl pointer-events-none"
          />

          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-3">
              {/* Glowing Brand Emblem */}
              <div className="relative shrink-0">
                <div
                  aria-hidden="true"
                  className="absolute -inset-1 rounded-2xl bg-[#FDE68A]/35 blur-sm"
                />
                <img
                  src={BRAND_ASSETS.logo}
                  alt="Affin Connect"
                  className="relative w-12 h-12 rounded-2xl object-cover ring-2 ring-[#FDE68A]/70 shadow-lg shadow-amber-500/25"
                />
              </div>

              <div className="min-w-0">
                <h1 className="text-lg font-display font-bold text-white leading-tight text-balance">
                  {t('authScreenTitle')}
                </h1>
                <p className="text-[11px] text-emerald-50/90 mt-1 leading-relaxed">
                  {t('authScreenSubtitle')}
                </p>
              </div>
            </div>

            {/* Floating Trust Badges */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-xs border border-white/25 text-[10px] font-semibold text-white">
                <ShieldCheck className="w-3 h-3 text-[#FDE68A] shrink-0" />
                <span>{t('trustBadgeVerifiedMerchants')}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-xs border border-white/25 text-[10px] font-semibold text-white">
                <Smartphone className="w-3 h-3 text-[#FDE68A] shrink-0" />
                <span>{t('trustBadgeLocalPayments')}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-xs border border-white/25 text-[10px] font-semibold text-white">
                <Truck className="w-3 h-3 text-[#FDE68A] shrink-0" />
                <span>{t('trustBadgeSameDayDelivery')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Initial Hawassa Neighborhood Quick Selector */}
        {!needsEmailVerification && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-[#FFFBEB] dark:bg-[#2A2418] border border-[#FDE68A] dark:border-[#78350F] text-[#D97706] dark:text-[#FBBF24] flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <label
                htmlFor="auth-screen-neighborhood"
                className="block text-[10px] font-semibold text-stone-500 dark:text-stone-400 leading-none mb-1"
              >
                {t('selectNeighborhood')}
              </label>
              <select
                id="auth-screen-neighborhood"
                value={selectedNeighborhood}
                onChange={(e) => setSelectedNeighborhood(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-stone-900 dark:text-stone-100 focus:outline-none cursor-pointer"
              >
                <option
                  value="All Hawassa"
                  className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100"
                >
                  {t('allHawassaAreas')}
                </option>
                {HAWASSA_NEIGHBORHOODS.map((n) => (
                  <option
                    key={n}
                    value={n}
                    className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100"
                  >
                    {getLocalizedNeighborhood(n, language)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Elevated Authentication Panel */}
        <section
          aria-label="Account authentication"
          className="p-4 rounded-2xl bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm"
        >
          <AuthSignInPanel
            variant="onboarding"
            defaultTab="signin"
            onSuccess={completeOnboarding}
          />
        </section>
      </div>

      {/* Warm Honey Amber Browse as Guest Pill CTA */}
      {!needsEmailVerification && (
        <div className="pt-3.5 pb-1 flex flex-col items-center">
          <button
            type="button"
            onClick={continueAsGuest}
            className="inline-flex items-center justify-center gap-2 min-h-[42px] px-5 rounded-full bg-[#FFFBEB] dark:bg-[#2A2418] text-[#B45309] dark:text-[#FBBF24] border border-[#FDE68A] dark:border-[#78350F] hover:bg-[#FEF3C7] dark:hover:bg-[#3A301F] text-xs font-semibold shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer"
          >
            <span>{t('browseAsGuest')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
