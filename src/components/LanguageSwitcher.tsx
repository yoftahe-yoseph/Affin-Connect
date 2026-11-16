import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { LANGUAGE_OPTIONS } from '../constants/translations';
import type { SupportedLanguage } from '../types';

export interface LanguageSwitcherProps {
  variant?: 'compact' | 'segmented' | 'cards';
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'segmented',
  className = '',
}) => {
  const { language, setLanguage, t } = useMarketplace();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeOption =
    LANGUAGE_OPTIONS.find((opt) => opt.code === language) ?? LANGUAGE_OPTIONS[0];

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleSelect = (code: SupportedLanguage) => {
    setLanguage(code);
    setMenuOpen(false);
  };

  if (variant === 'compact') {
    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={t('selectLanguage')}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          className="min-h-[44px] px-2.5 rounded-xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] hover:bg-[#ECFDF5] dark:hover:bg-[#10B981]/10 text-stone-800 dark:text-stone-100 flex items-center gap-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#047857] dark:focus-visible:outline-[#10B981]"
        >
          <Globe className="w-4 h-4 text-[#047857] dark:text-[#10B981] shrink-0" />
          <span className="tabular-nums">{activeOption.shortLabel}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-stone-500 dark:text-stone-400 transition-transform ${
              menuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {menuOpen && (
          <div
            role="listbox"
            aria-label={t('selectLanguage')}
            className="absolute right-0 mt-1.5 w-56 rounded-2xl bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] shadow-lg p-1.5 z-50 space-y-0.5"
          >
            <div className="px-2.5 py-1.5 text-[11px] font-semibold text-stone-500 dark:text-stone-400 border-b border-[#E7E5E4] dark:border-[#2A3630] mb-1">
              {t('selectLanguage')}
            </div>
            {LANGUAGE_OPTIONS.map((option) => {
              const selected = language === option.code;
              return (
                <button
                  key={option.code}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => handleSelect(option.code)}
                  className={`w-full min-h-[44px] px-2.5 py-2 rounded-xl text-left flex items-center justify-between gap-2 transition-colors ${
                    selected
                      ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981]'
                      : 'text-stone-800 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight">{option.label}</div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                      {option.nativeSubtitle}
                    </div>
                  </div>
                  {selected && (
                    <span className="w-5 h-5 rounded-full bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div
        role="radiogroup"
        aria-label={t('selectLanguage')}
        className={`space-y-2.5 ${className}`}
      >
        {LANGUAGE_OPTIONS.map((option) => {
          const active = language === option.code;
          return (
            <button
              key={option.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handleSelect(option.code)}
              className={`w-full min-h-[56px] p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-colors focus-visible:outline-2 focus-visible:outline-[#047857] dark:focus-visible:outline-[#10B981] ${
                active
                  ? 'border-[#047857] dark:border-[#10B981] bg-[#ECFDF5] dark:bg-[#10B981]/15'
                  : 'border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#1C2420] hover:bg-[#FAF8F5] dark:hover:bg-[#141A17]'
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>{option.label}</span>
                  <span className="text-[11px] font-medium text-stone-400 dark:text-stone-500">
                    {option.shortLabel}
                  </span>
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{option.nativeSubtitle}</div>
              </div>
              {active && (
                <div className="w-6 h-6 rounded-full bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
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
      aria-label={t('selectLanguage')}
      className={`grid grid-cols-2 gap-1.5 ${className}`}
    >
      {LANGUAGE_OPTIONS.map((option) => {
        const active = language === option.code;
        return (
          <button
            key={option.code}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => handleSelect(option.code)}
            className={`min-h-[40px] py-2 px-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#047857] dark:focus-visible:outline-[#10B981] ${
              active
                ? 'bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] border-[#047857] dark:border-[#10B981]'
                : 'bg-[#FAF8F5] dark:bg-[#141A17] text-stone-700 dark:text-stone-300 border-[#E7E5E4] dark:border-[#2A3630] hover:bg-[#ECFDF5] dark:hover:bg-[#10B981]/10'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
