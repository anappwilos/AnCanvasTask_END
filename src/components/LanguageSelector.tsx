import React, { useState, useRef, useEffect } from 'react';
import { useLingui } from '@lingui/react';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { SUPPORTED_LANGUAGES, SupportedLanguageCode, dynamicActivate } from '../i18n';

interface LanguageSelectorProps {
  variant?: 'compact' | 'full';
  className?: string;
  onLanguageChange?: (lang: SupportedLanguageCode) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'compact',
  className = '',
  onLanguageChange,
}) => {
  const { i18n } = useLingui();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLangCode = i18n.locale || 'es';
  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLangCode) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectLanguage = async (code: SupportedLanguageCode) => {
    await dynamicActivate(code);
    setIsOpen(false);
    if (onLanguageChange) {
      onLanguageChange(code);
    }
  };

  return (
    <div id="div-languageselector-1" className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--surface)] hover:bg-[var(--surface-container-high)] border border-[var(--outline)] text-xs font-sans text-[var(--on-surface)] transition-colors cursor-pointer select-none"
        title={`${i18n._(msg`Idioma`)}: ${currentLang.label}`}
        aria-label={i18n._(msg`Idioma`)}
        aria-expanded={isOpen}
      >
        <span className="text-[13px] leading-none" role="img" aria-hidden="true">
          {currentLang.flag}
        </span>
        <span className="font-semibold text-[11px] uppercase tracking-wider text-[var(--on-surface)]">
          {currentLang.code}
        </span>
        <span className="material-symbols-outlined text-[13px] text-[var(--on-surface-variant)] transition-transform duration-150">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1 w-36 bg-[var(--surface-container)] border border-[var(--outline)] rounded-lg shadow-xl py-1 z-50 animate-fade-in"
          role="menu"
          aria-orientation="vertical"
        >
          <div id="div-languageselector-2" className="px-2.5 py-1 text-[10px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider border-b border-[var(--outline)] mb-1">
            {i18n._(msg`Idioma`)}
          </div>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = lang.code === currentLang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelectLanguage(lang.code as SupportedLanguageCode)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--primary-container)]/30 text-[var(--primary)] font-semibold'
                    : 'text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]'
                }`}
                role="menuitem"
              >
                <div id="div-languageselector-3" className="flex items-center gap-2">
                  <span className="text-[13px] leading-none">{lang.flag}</span>
                  <span className="text-xs">{lang.label}</span>
                </div>
                {isSelected && (
                  <span className="material-symbols-outlined text-[14px] text-[var(--primary)]">
                    check
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
