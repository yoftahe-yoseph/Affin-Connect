import React from 'react';
import { useMarketplace } from '../../context/MarketplaceContext';

export const LoginFooter: React.FC = () => {
  const { t } = useMarketplace();

  return (
    <footer className="w-full relative z-10 pt-3 sm:pt-5 pb-5 px-4">
      <div className="max-w-7xl mx-auto flex flex-col items-center">
        {/* Subtle decorative Hawassa cityscape & lakeside line art */}
        <svg
          aria-hidden="true"
          viewBox="0 0 1200 74"
          preserveAspectRatio="none"
          className="hidden sm:block w-full max-w-4xl h-12 sm:h-14 text-[#00C8D7] opacity-30 pointer-events-none select-none"
        >
          <defs>
            <linearGradient id="ac-skyline-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00C8D7" stopOpacity="0.1" />
              <stop offset="30%" stopColor="#00D68F" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#00C8D7" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#00D68F" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          {/* Distant Mount Tabor ridge & Hawassa skyline silhouettes */}
          <path
            d="M0 64 H165 L178 44 H210 L218 54 H260 L272 28 H305 L312 48 H365 Q395 16 425 48 H470 L482 34 H518 L528 52 H578 Q605 24 632 52 H675 L692 20 L718 20 L728 46 H778 L790 36 H824 L834 55 H890 Q940 30 1005 56 L1045 64 H1200"
            fill="none"
            stroke="url(#ac-skyline-stroke)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Subtle Lake Hawassa reflection lines */}
          <path
            d="M120 69 H1080"
            fill="none"
            stroke="#00D68F"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
        </svg>

        <p className="text-xs font-medium tracking-[0.14em] text-[#7CA3A6] text-center mt-2">
          {t('authFooterTagline')}
        </p>
      </div>
    </footer>
  );
};
