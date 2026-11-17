import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { LANGUAGE_OPTIONS } from '../constants/translations';
import type { SupportedLanguage } from '../types';

export interface LanguageSwitcherProps {
  variant?: 'compact' | 'segmented' | 'cards';
  tone?: 'default' | 'obsidian';
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'segmented',
  tone = 'default',
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
    const isObsidian = tone === 'obsidian';
    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={t('selectLanguage')}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          className={`min-h-[44px] px-3 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            isObsidian
              ? 'bg-[#072427]/80 backdrop-blur-md border-[#00C8D7]/25 hover:border-[#00D68F]/60 hover:bg-[#0B3034]/90 text-[#F5FAFA] focus-visible:outline-2 focus-visible:outline-[#00D68F]'
              : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] hover:bg-[#ECFDF5] dark:hover:bg-[#10B981]/10 text-stone-800 dark:text-stone-100 focus-visible:outline-2 focus-visible:outline-[#047857] dark:focus-visible:outline-[#10B981]'
          }`}
        >
          <Globe
            className={`w-4 h-4 shrink-0 ${
              isObsidian ? 'text-[#00D68F]' : 'text-[#047857] dark:text-[#10B981]'
            }`}
          />
          <span className="tabular-nums">{activeOption.shortLabel}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              isObsidian ? 'text-[#89AFB2]' : 'text-stone-500 dark:text-stone-400'
            } ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {menuOpen && (
          <div
            role="listbox"
            aria-label={t('selectLanguage')}
            className={`absolute right-0 mt-2 w-56 rounded-2xl border shadow-2xl p-1.5 z-50 space-y-0.5 ${
              isObsidian
                ? 'bg-[#051F22]/95 backdrop-blur-xl border-[#00C8D7]/25 shadow-black/60'
                : 'bg-white dark:bg-[#1C2420] border-[#E7E5E4] dark:border-[#2A3630] shadow-lg'
            }`}
          >
            <div
              className={`px-2.5 py-1.5 text-[11px] font-semibold border-b mb-1 ${
                isObsidian
                  ? 'text-[#89AFB2] border-[#00C8D7]/15'
                  : 'text-stone-500 dark:text-stone-400 border-[#E7E5E4] dark:border-[#2A3630]'
              }`}
            >
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
                  className={`w-full min-h-[44px] px-2.5 py-2 rounded-xl text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    selected
                      ? isObsidian
                        ? 'bg-[#00D68F]/15 text-[#00D68F]'
                        : 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981]'
                      : isObsidian
                        ? 'text-[#F5FAFA] hover:bg-[#0B3034]/80'
                        : 'text-stone-800 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight">{option.label}</div>
                    <div
                      className={`text-[11px] truncate mt-0.5 ${
                        isObsidian ? 'text-[#89AFB2]' : 'text-stone-500 dark:text-stone-400'
                      }`}
                    >
                      {option.nativeSubtitle}
                    </div>
                  </div>
                  {selected && (
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        isObsidian
                          ? 'bg-[#00D68F] text-[#031719]'
                          : 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410]'
                      }`}
                    >
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
    const isObsidian = tone === 'obsidian';
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
              className={`w-full min-h-[56px] p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                isObsidian
                  ? active
                    ? 'border-[#00D68F] bg-[#00D68F]/14 focus-visible:outline-2 focus-visible:outline-[#00C8D7]'
                    : 'border-[#123E42] bg-[#021113]/75 hover:border-[#00C8D7]/50 focus-visible:outline-2 focus-visible:outline-[#00C8D7]'
                  : active
                    ? 'border-[#047857] dark:border-[#10B981] bg-[#ECFDF5] dark:bg-[#10B981]/15 focus-visible:outline-2 focus-visible:outline-[#047857] dark:focus-visible:outline-[#10B981]'
                    : 'border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#1C2420] hover:bg-[#FAF8F5] dark:hover:bg-[#141A17] focus-visible:outline-2 focus-visible:outline-[#047857] dark:focus-visible:outline-[#10B981]'
              }`}
            >
              <div className="min-w-0">
                <div
                  className={`text-sm font-bold flex items-center gap-2 ${
                    isObsidian ? 'text-[#F5FAFA]' : 'text-stone-900 dark:text-stone-100'
                  }`}
                >
                  <span>{option.label}</span>
                  <span
                    className={`text-[11px] font-medium ${
                      isObsidian ? 'text-[#89AFB2]' : 'text-stone-400 dark:text-stone-500'
                    }`}
                  >
                    {option.shortLabel}
                  </span>
                </div>
                <div
                  className={`text-xs mt-0.5 ${
                    isObsidian ? 'text-[#89AFB2]' : 'text-stone-500 dark:text-stone-400'
                  }`}
                >
                  {option.nativeSubtitle}
                </div>
              </div>
              {active && (
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    isObsidian
                      ? 'bg-[#00D68F] text-[#031719]'
                      : 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410]'
                  }`}
                >
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
