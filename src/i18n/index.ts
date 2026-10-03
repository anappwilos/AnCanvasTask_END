import { i18n } from '@lingui/core';

export interface LanguageOption {
  code: string;
  label: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export type SupportedLanguageCode = 'es' | 'en';

export const defaultLocale = 'es';

/**
 * Load messages for the requested locale and activate it in Lingui
 */
export async function dynamicActivate(locale: string) {
  try {
    const { messages } = await import(`../locales/${locale}/messages.js`);
    i18n.load(locale, messages);
    i18n.activate(locale);
    localStorage.setItem('antask_language', locale);
    document.documentElement.lang = locale;
  } catch (error) {
    console.error(`Error loading locale ${locale}:`, error);
  }
}

/**
 * Initialize language based on localStorage, navigator, or fallback to default
 */
export async function initI18n() {
  const persisted = localStorage.getItem('antask_language');
  let locale = persisted;

  if (!locale) {
    const browserLang = navigator.language.split('-')[0];
    const isSupported = SUPPORTED_LANGUAGES.some(l => l.code === browserLang);
    locale = isSupported ? browserLang : defaultLocale;
  }
  
  // ensure it's loaded before rendering
  await dynamicActivate(locale);
}

