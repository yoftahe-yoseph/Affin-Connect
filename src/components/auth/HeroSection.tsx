import React, { useState } from 'react';
import { MapPin, ShieldCheck, Store, Truck } from 'lucide-react';
import { BRAND_ASSETS } from '../../data/seedData';
import { getLocalizedNeighborhood } from '../../constants/translations';
import { useMarketplace } from '../../context/MarketplaceContext';
import { HAWASSA_NEIGHBORHOODS } from '../../utils/marketplaceLogic';

export const TrustIndicators: React.FC = () => {
  const { t } = useMarketplace();

  const items = [
    {
      id: 'verified',
      Icon: ShieldCheck,
      label: t('authTrustVerified'),
    },
    {
      id: 'delivery',
      Icon: Truck,
      label: t('authTrustDelivery'),
    },
    {
      id: 'local',
      Icon: Store,
      label: t('authTrustSupportLocal'),
    },
  ] as const;

  return (
    <ul
      aria-label="Affin Connect marketplace guarantees"
      className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-2.5"
    >
      {items.map(({ id, Icon, label }) => (
        <li
          key={id}
          className="flex items-center gap-2.5 px-3.5 py-2.5 sm:py-3 rounded-xl bg-[#062326]/70 backdrop-blur-md border border-[#00C8D7]/15 text-[#DCEFEF]"
        >
          <span className="w-8 h-8 rounded-lg bg-[#00D68F]/12 border border-[#00D68F]/25 flex items-center justify-center text-[#00D68F] shrink-0">
            <Icon className="w-4 h-4" />
          </span>
          <span className="text-xs font-semibold leading-snug">{label}</span>
        </li>
      ))}
    </ul>
  );
};

export const HeroSection: React.FC = () => {
  const { selectedNeighborhood, setSelectedNeighborhood, needsEmailVerification, language, t } =
    useMarketplace();
  const [bannerFailed, setBannerFailed] = useState(false);

  return (
    <section
      aria-labelledby="auth-hero-headline"
      className="flex flex-col justify-center space-y-5 lg:space-y-6"
    >
      {/* Lake Hawassa Photographic Showcase (Hidden on smallest screens so Sign-In appears fast) */}
      <div className="hidden md:block relative overflow-hidden rounded-3xl border border-[#00C8D7]/20 bg-[#051F22] shadow-2xl shadow-black/40 aspect-[16/8.2]">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-[#031719] via-[#063237] to-[#08444A]"
        />
        {!bannerFailed && (
          <img
            src={BRAND_ASSETS.banner}
            alt="Hawassa Sidama Marketplace"
            referrerPolicy="no-referrer"
            onError={() => setBannerFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-[center_42%] opacity-35 mix-blend-luminosity scale-[1.02]"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-tr from-[#031719] via-[#031719]/80 to-[#00C8D7]/15"
        />

        {/* Subtle Lake Hawassa Shoreline Wave Accent */}
        <svg
          aria-hidden="true"
          viewBox="0 0 800 120"
          preserveAspectRatio="none"
          className="absolute bottom-0 inset-x-0 w-full h-16 opacity-35 pointer-events-none"
        >
          <path
            d="M0 78 Q 160 40, 340 74 T 680 62 T 800 72 L 800 120 L 0 120 Z"
            fill="none"
            stroke="#00C8D7"
            strokeWidth="1.5"
          />
          <path
            d="M0 95 Q 200 65, 420 92 T 800 84"
            fill="none"
            stroke="#00D68F"
            strokeOpacity="0.6"
            strokeWidth="1"
          />
        </svg>

        <div className="relative z-10 h-full p-6 lg:p-7 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold tracking-wide text-[#00D68F]">
              {t('location')}
            </span>
            <span className="text-xs font-medium text-[#9AC2C4]">Sidama Region</span>
          </div>

          <div className="space-y-2.5 max-w-xl">
            <h1
              id="auth-hero-headline"
              className="font-display text-3xl lg:text-4xl font-bold tracking-tight text-[#F5FAFA] leading-[1.15] text-balance"
            >
              {t('authHeroHeadline')}
            </h1>
            <p className="text-sm lg:text-[15px] text-[#A7C4C5] leading-relaxed max-w-lg">
              {t('authScreenSubtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Compact Mobile Hero Copy */}
      <div className="md:hidden space-y-2 pt-1">
        <h1
          id="auth-hero-headline-mobile"
          className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#F5FAFA] leading-tight text-balance"
        >
          {t('authHeroHeadline')}
        </h1>
        <p className="text-xs sm:text-sm text-[#A7C4C5] leading-relaxed">
          {t('authScreenSubtitle')}
        </p>
      </div>

      {/* Three Trust Indicators */}
      <TrustIndicators />

      {/* Preserved Hawassa Neighborhood Quick Selector */}
      {!needsEmailVerification && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#062326]/75 backdrop-blur-md border border-[#00C8D7]/18">
          <div className="w-9 h-9 rounded-xl bg-[#00C8D7]/12 border border-[#00C8D7]/25 text-[#00C8D7] flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <label
              htmlFor="auth-screen-neighborhood"
              className="block text-[11px] font-semibold text-[#89AFB2] leading-none mb-1.5"
            >
              {t('selectNeighborhood')}
            </label>
            <select
              id="auth-screen-neighborhood"
              value={selectedNeighborhood}
              onChange={(e) => setSelectedNeighborhood(e.target.value)}
              className="w-full bg-transparent text-xs sm:text-sm font-semibold text-[#F5FAFA] focus:outline-none cursor-pointer"
            >
              <option value="All Hawassa" className="bg-[#052023] text-[#F5FAFA]">
                {t('allHawassaAreas')}
              </option>
              {HAWASSA_NEIGHBORHOODS.map((n) => (
                <option key={n} value={n} className="bg-[#052023] text-[#F5FAFA]">
                  {getLocalizedNeighborhood(n, language)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </section>
  );
};
