import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';

export interface ThemeToggleButtonProps {
  variant?: 'icon' | 'button';
  className?: string;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({
  variant = 'icon',
  className = '',
}) => {
  const { resolvedTheme, toggleTheme, t } = useMarketplace();
  const isDark = resolvedTheme === 'dark';
  const targetLabel = isDark ? t('themeLight') : t('themeDark');
  const ariaLabel = isDark
    ? `Switch to ${t('themeLight')} mode`
    : `Switch to ${t('themeDark')} mode`;

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={ariaLabel}
        aria-pressed={!isDark}
        title={ariaLabel}
        className={`min-h-[40px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] hover:bg-[#E7F1ED] dark:hover:bg-[#1C2420] hover:border-[#0F4C44]/50 dark:hover:border-[#00D68F]/50 text-[#0F4C44] dark:text-stone-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer shadow-[0_1px_4px_rgba(15,76,68,0.06)] dark:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C44] dark:focus-visible:ring-[#00D68F] ${className}`}
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-[#F59E0B] shrink-0" />
        ) : (
          <Moon className="w-4 h-4 text-[#0F4C44] shrink-0" />
        )}
        <span>{targetLabel}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={ariaLabel}
      aria-pressed={!isDark}
      title={ariaLabel}
      className={`min-w-[40px] min-h-[40px] rounded-xl bg-[#FCFDFC] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/55 dark:hover:border-[#00D68F]/50 flex items-center justify-center text-[#0F4C44] dark:text-[#F59E0B] hover:bg-[#E7F1ED] dark:hover:bg-[#0C332F] shadow-[0_1px_4px_rgba(15,76,68,0.06)] dark:shadow-none active:scale-95 transition-all shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C44] dark:focus-visible:ring-[#00D68F] ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
};
