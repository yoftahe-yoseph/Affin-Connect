import React, { useState } from 'react';
import { Store } from 'lucide-react';
import { BRAND_ASSETS } from '../../data/seedData';
import { useMarketplace } from '../../context/MarketplaceContext';
import { LanguageSwitcher } from '../LanguageSwitcher';

export const LoginHeader: React.FC = () => {
  const { t } = useMarketplace();
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <header className="w-full relative z-20 border-b border-[#00C8D7]/10 bg-[#031719]/65 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-3.5 sm:py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div
              aria-hidden="true"
              className="absolute -inset-0.5 rounded-xl bg-gradient-to-br from-[#00D68F]/40 to-[#00C8D7]/35 blur-[2px]"
            />
            {logoFailed ? (
              <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#072427] border border-[#00C8D7]/30 flex items-center justify-center text-[#00D68F]">
                <Store className="w-5 h-5" />
              </div>
            ) : (
              <img
                src={BRAND_ASSETS.logo}
                alt={t('appName')}
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
                className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover border border-[#00C8D7]/35 shadow-lg shadow-black/40"
              />
            )}
          </div>

          <div className="min-w-0">
            <div className="font-display text-base sm:text-lg font-bold tracking-tight text-[#F5FAFA] truncate leading-tight">
              {t('appName')}
            </div>
            <p className="text-[11px] sm:text-xs font-medium text-[#89AFB2] truncate mt-0.5">
              {t('authHeaderSubtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <LanguageSwitcher variant="compact" tone="obsidian" />
        </div>
      </div>
    </header>
  );
};
