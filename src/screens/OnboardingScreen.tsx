import React from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { AuthSignInPanel } from '../components/AuthSignInPanel';
import { LoginHeader } from '../components/auth/LoginHeader';
import { HeroSection } from '../components/auth/HeroSection';
import { LoginFooter } from '../components/auth/LoginFooter';
import { getLocalizedNeighborhood } from '../constants/translations';
import { HAWASSA_NEIGHBORHOODS } from '../utils/marketplaceLogic';

const AtmosphericBackdrop: React.FC = () => (
  <div aria-hidden="true" className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {/* Deep Obsidian Night Base */}
    <div className="absolute inset-0 bg-gradient-to-br from-[#021113] via-[#031B1E] to-[#05292E]" />
    {/* Soft Cyan-Teal Lake Hawassa Glow */}
    <div className="hidden sm:block absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-[#00C8D7]/12 blur-[120px]" />
    {/* Soft Emerald Accent Glow */}
    <div className="hidden sm:block absolute top-1/4 -right-32 w-[480px] h-[480px] rounded-full bg-[#00D68F]/10 blur-[130px]" />
    {/* Bottom Horizon Glow */}
    <div className="hidden md:block absolute -bottom-48 left-1/3 w-[640px] h-[360px] rounded-full bg-[#008899]/10 blur-[140px]" />
  </div>
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
      <div className="min-h-dvh w-full overflow-x-hidden bg-[#031719] text-[#F5FAFA] relative flex flex-col justify-between">
        <AtmosphericBackdrop />
        <LoginHeader />

        <main className="relative z-10 flex-1 flex items-center justify-center w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          <div className="w-full rounded-3xl bg-[#062326]/78 backdrop-blur-xl border border-[#00C8D7]/22 shadow-2xl shadow-black/50 p-5 sm:p-7 space-y-6">
            <div className="p-4 rounded-2xl bg-[#00D68F]/10 border border-[#00D68F]/25 space-y-2">
              <div className="flex items-center gap-2.5 text-sm sm:text-base font-bold text-[#00D68F]">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>
                  {welcomeBackNotice
                    ? t('welcomeBackSubtitle', { name: welcomeBackNotice.displayName })
                    : t('onboardingSignedInTitle')}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#CBE3E4] leading-relaxed">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-[#CBE3E4]">
                  {t('selectLanguage')}
                </div>
                <LanguageSwitcher variant="cards" tone="obsidian" />
              </div>

              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-[#CBE3E4]">
                  {t('selectNeighborhood')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedNeighborhood('All Hawassa')}
                    className={`col-span-2 min-h-[44px] p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      selectedNeighborhood === 'All Hawassa'
                        ? 'border-[#00D68F] bg-[#00D68F]/15 text-[#F5FAFA] shadow-sm shadow-[#00D68F]/10'
                        : 'border-[#123E42] bg-[#021113]/75 text-[#B4CFD1] hover:border-[#00C8D7]/45 hover:text-[#F5FAFA]'
                    }`}
                  >
                    <span>{t('allHawassaAreas')}</span>
                    {selectedNeighborhood === 'All Hawassa' && (
                      <Check className="w-4 h-4 text-[#00D68F]" />
                    )}
                  </button>
                  {HAWASSA_NEIGHBORHOODS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSelectedNeighborhood(n)}
                      className={`min-h-[44px] p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        selectedNeighborhood === n
                          ? 'border-[#00D68F] bg-[#00D68F]/15 text-[#F5FAFA] shadow-sm shadow-[#00D68F]/10'
                          : 'border-[#123E42] bg-[#021113]/75 text-[#B4CFD1] hover:border-[#00C8D7]/45 hover:text-[#F5FAFA]'
                      }`}
                    >
                      <span className="truncate">{getLocalizedNeighborhood(n, language)}</span>
                      {selectedNeighborhood === n && (
                        <Check className="w-4 h-4 text-[#00D68F] shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={completeOnboarding}
              className="w-full min-h-[50px] rounded-xl bg-gradient-to-r from-[#00D68F] to-[#00C8D7] hover:brightness-105 text-[#031719] text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-[#00D68F]/20 cursor-pointer"
            >
              <span>{t('startExploring')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </main>

        <LoginFooter />
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#031719] text-[#F5FAFA] relative flex flex-col justify-between">
      <AtmosphericBackdrop />

      {/* Top Responsive Header */}
      <LoginHeader />

      {/* Main Responsive Split Container (Desktop 1024-1440px split, Mobile 360-768px stacked) */}
      <div className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-5 sm:py-8 lg:py-10 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 items-center">
          {/* Hero Section + Neighborhood & Trust */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-5">
            <HeroSection />

            {!needsEmailVerification && (
              <div className="hidden lg:flex items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={continueAsGuest}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#072427]/80 border border-[#00C8D7]/25 hover:border-[#00D68F]/55 hover:bg-[#0B3034] text-[#D7ECEC] hover:text-white text-xs font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#00D68F]"
                >
                  <span>{t('browseAsGuest')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#00D68F]" />
                </button>
              </div>
            )}
          </div>

          {/* Prominent Authentication Card */}
          <div className="lg:col-span-6 xl:col-span-5 w-full max-w-[460px] mx-auto lg:ml-auto lg:mr-0 space-y-4">
            <section
              aria-label="Account authentication"
              className="w-full rounded-3xl bg-[#062326]/78 backdrop-blur-xl border border-[#00C8D7]/22 shadow-2xl shadow-black/50 p-4 sm:p-6"
            >
              <AuthSignInPanel
                variant="glass"
                defaultTab="signin"
                onSuccess={completeOnboarding}
              />
            </section>

            {/* Mobile / Tablet Browse as Guest Action */}
            {!needsEmailVerification && (
              <div className="flex lg:hidden flex-col items-center">
                <button
                  type="button"
                  onClick={continueAsGuest}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#072427]/80 border border-[#00C8D7]/25 hover:border-[#00D68F]/55 text-[#D7ECEC] hover:text-white text-xs font-semibold transition-all duration-200 cursor-pointer"
                >
                  <span>{t('browseAsGuest')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#00D68F]" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subtle Hawassa Shoreline & Cityscape Footer */}
      <LoginFooter />
    </div>
  );
};
