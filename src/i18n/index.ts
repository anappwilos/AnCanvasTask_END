import { i18n } from '@lingui/core';

export * from './formatters';

export interface LanguageOption {
  code: string;
  label: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
];

export type SupportedLanguageCode = 'es' | 'en' | 'fr' | 'de' | 'pt' | 'it';

export const defaultLocale: SupportedLanguageCode = 'es';

/**
 * Load messages for the requested locale and activate it in Lingui
 */
export async function dynamicActivate(locale: string) {
  try {
    const { messages } = await import(`../locales/${locale}/messages.js`);
    i18n.load(locale, messages);
    i18n.activate(locale);
    localStorage.setItem('antask_language', locale);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  } catch (error) {
    console.error(`Error loading locale ${locale}:`, error);
  }
}

/**
 * Initialize language based on:
 * 1. user explicit persisted preference
 * 2. browser navigator language
 * 3. default locale (es)
 */
export async function initI18n() {
  const persisted = typeof localStorage !== 'undefined' ? localStorage.getItem('antask_language') : null;
  let locale = persisted;

  if (!locale) {
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'es';
    const isSupported = SUPPORTED_LANGUAGES.some((l) => l.code === browserLang);
    locale = isSupported ? browserLang : defaultLocale;
  }

  // ensure it's loaded before rendering
  await dynamicActivate(locale);
}
