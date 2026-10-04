import React, { useState, useRef, useEffect } from 'react';
import { useLingui } from '@lingui/react';
import { msg } from '@lingui/core/macro';
import { SUPPORTED_LANGUAGES, SupportedLanguageCode, dynamicActivate } from '../i18n';

interface LanguageSelectorProps {
  className?: string;
  onLanguageChange?: (lang: SupportedLanguageCode) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  className = '',
  onLanguageChange,
}) => {
  const { i18n } = useLingui();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLangCode = (i18n.locale || 'es') as SupportedLanguageCode;
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
    <div id="div-languageselector-container" className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        id="btn-language-selector"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--surface)] hover:bg-[var(--surface-container-high)] border border-[var(--outline)] text-xs font-sans text-[var(--on-surface)] transition-colors cursor-pointer select-none"
        title={`${i18n._(msg`Idioma`)}: ${currentLang.label}`}
        aria-label={i18n._(msg`Idioma de la interfaz`)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="material-symbols-outlined text-[15px] text-[var(--on-surface-variant)]">
          translate
        </span>
        <span className="font-medium text-xs text-[var(--on-surface)]">
          {currentLang.label}
        </span>
        <span className="material-symbols-outlined text-[13px] text-[var(--on-surface-variant)] transition-transform duration-150">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {isOpen && (
        <div
          id="menu-language-options"
          className="absolute right-0 mt-1 w-36 bg-[var(--surface-container)] border border-[var(--outline)] rounded-md shadow-md py-1 z-50 animate-fade-in"
          role="menu"
          aria-orientation="vertical"
        >
          <div id="div-language-options-header" className="px-2.5 py-1 text-[10px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider border-b border-[var(--outline)] mb-1">
            {i18n._(msg`Idioma`)}
          </div>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = lang.code === currentLang.code;
            return (
              <button
                key={lang.code}
                id={`btn-lang-${lang.code}`}
                type="button"
                onClick={() => handleSelectLanguage(lang.code as SupportedLanguageCode)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--primary-container)]/30 text-[var(--primary)] font-semibold'
                    : 'text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]'
                }`}
                role="menuitem"
              >
                <span className="text-xs">{lang.label}</span>
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
