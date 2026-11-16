import React from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import type { ThemePreference } from '../types';

export interface ThemeSwitcherProps {
  variant?: 'compact' | 'segmented' | 'cards';
  className?: string;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  variant = 'segmented',
  className = '',
}) => {
  const { themePreference, resolvedTheme, setThemePreference, t } = useMarketplace();

  const options: {
    id: ThemePreference;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'light', label: t('themeLight'), Icon: Sun },
    { id: 'dark', label: t('themeDark'), Icon: Moon },
    { id: 'system', label: t('themeSystem'), Icon: Monitor },
  ];

  if (variant === 'compact') {
    const nextTheme: ThemePreference = resolvedTheme === 'dark' ? 'light' : 'dark';
    const isDark = resolvedTheme === 'dark';
    return (
      <button
        type="button"
        onClick={() => setThemePreference(nextTheme)}
        aria-label={isDark ? t('lightModeQuickToggle') : t('darkModeQuickToggle')}
        aria-pressed={isDark}
        title={isDark ? t('lightModeQuickToggle') : t('darkModeQuickToggle')}
        className={`min-w-[44px] min-h-[44px] rounded-xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] hover:bg-[#ECFDF5] dark:hover:bg-[#10B981]/10 text-stone-700 dark:text-[#F59E0B] flex items-center justify-center transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-[#047857] dark:focus-visible:outline-[#10B981] ${className}`}
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    );
  }

  if (variant === 'cards') {
    return (
      <div
        role="radiogroup"
        aria-label={t('themePreferenceLabel')}
        className={`grid grid-cols-3 gap-2 ${className}`}
      >
        {options.map(({ id, label, Icon }) => {
          const active = themePreference === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setThemePreference(id)}
              className={`min-h-[72px] p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-[#047857] dark:focus-visible:outline-[#10B981] ${
                active
                  ? 'border-[#047857] bg-[#ECFDF5] text-[#047857] dark:border-[#10B981] dark:bg-[#10B981]/15 dark:text-[#10B981]'
                  : 'border-[#E7E5E4] bg-white text-stone-700 hover:bg-[#FAF8F5] dark:border-[#2A3630] dark:bg-[#1C2420] dark:text-stone-300 dark:hover:bg-[#141A17]'
              }`}
            >
              <div className="flex items-center gap-1">
                <Icon className="w-4 h-4 shrink-0" />
                {active && <Check className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981]" />}
              </div>
              <span className="text-xs font-bold whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Default: 'segmented'
  return (
    <div
      role="radiogroup"
      aria-label={t('themePreferenceLabel')}
      className={`grid grid-cols-3 gap-1.5 ${className}`}
    >
      {options.map(({ id, label, Icon }) => {
        const active = themePreference === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setThemePreference(id)}
            className={`min-h-[40px] py-2 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#047857] dark:focus-visible:outline-[#10B981] ${
              active
                ? 'bg-[#047857] hover:bg-[#065F46] text-white border-[#047857] dark:bg-[#10B981] dark:hover:bg-[#059669] dark:text-[#0B1410] dark:border-[#10B981]'
                : 'bg-[#FAF8F5] text-stone-700 border-[#E7E5E4] hover:bg-[#ECFDF5] dark:bg-[#141A17] dark:text-stone-300 dark:border-[#2A3630] dark:hover:bg-[#10B981]/10'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
};
