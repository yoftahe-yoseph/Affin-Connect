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
          className="flex items-center gap-2.5 px-3.5 py-2.5 sm:py-3 rounded-xl bg-[#062326]/70 backdrop-blur-md border border-[#00C8D7]/15 text-[#F5FAFA]"
        >
          <span className="w-8 h-8 rounded-lg bg-[#00D68F]/12 border border-[#00D68F]/25 flex items-center justify-center text-[#00D68F] shrink-0">
            <Icon className="w-4 h-4" />
          </span>
          <span className="text-xs font-semibold leading-snug text-[#E5F5F5]">{label}</span>
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
      {/* Lake Hawassa Atmospheric Backdrop Showcase (full on tablet/desktop, slim/omitted on compact mobile) */}
      <div className="hidden md:block relative overflow-hidden rounded-3xl border border-[#00C8D7]/20 bg-[#051F22] shadow-2xl shadow-black/40 aspect-[16/8.2]">
        {/* Layered abstract teal/emerald + wave SVG guaranteed fallback & atmosphere */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-[#031719] via-[#063237] to-[#042428]"
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
          className="absolute inset-0 bg-gradient-to-tr from-[#031719] via-[#031719]/75 to-[#00D68F]/15"
        />

        {/* Delicate Lake Hawassa contour & horizon waves */}
        <svg
          aria-hidden="true"
          viewBox="0 0 800 320"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 w-full h-3/4 opacity-45 pointer-events-none"
        >
          <defs>
            <linearGradient id="ac-wave-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00D68F" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#00C8D7" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#00D68F" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <path
            d="M0 215 Q 160 155 340 205 T 680 190 T 800 205 L 800 320 L 0 320 Z"
            fill="#031719"
            fillOpacity="0.55"
          />
          <path
            d="M0 215 Q 160 155 340 205 T 680 190 T 800 205"
            fill="none"
            stroke="url(#ac-wave-grad-1)"
            strokeWidth="2"
          />
          <path
            d="M0 248 Q 210 210 420 245 T 800 232"
            fill="none"
            stroke="#00C8D7"
            strokeOpacity="0.32"
            strokeWidth="1.5"
          />
          <path
            d="M0 278 Q 260 250 510 276 T 800 264"
            fill="none"
            stroke="#00D68F"
            strokeOpacity="0.22"
            strokeWidth="1.2"
          />
        </svg>

        <div className="relative z-10 h-full p-6 lg:p-7 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium tracking-wide text-[#00D68F]">
              {t('location')}
            </span>
            <span className="text-xs font-medium text-[#89AFB2]">Sidama Region</span>
          </div>

          <div className="space-y-2.5 max-w-xl">
            <h1
              id="auth-hero-headline"
              className="font-display text-3xl lg:text-4xl font-bold tracking-tight text-[#F5FAFA] leading-[1.15] text-balance"
            >
              {t('authHeroHeadline')}
            </h1>
            <p className="text-sm lg:text-[15px] text-[#B3CFD1] leading-relaxed max-w-lg">
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
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#062326]/75 backdrop-blur-md border border-[#00C8D7]/20 shadow-lg shadow-black/25">
          <div className="w-9 h-9 rounded-xl bg-[#00D68F]/12 border border-[#00D68F]/30 text-[#00D68F] flex items-center justify-center shrink-0">
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
              <option value="All Hawassa" className="bg-[#051F22] text-[#F5FAFA]">
                {t('allHawassaAreas')}
              </option>
              {HAWASSA_NEIGHBORHOODS.map((n) => (
                <option key={n} value={n} className="bg-[#051F22] text-[#F5FAFA]">
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
