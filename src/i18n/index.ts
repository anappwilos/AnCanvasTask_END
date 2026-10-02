import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import es from './locales/es.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';

export interface LanguageOption {
  code: string;
  label: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
];

export type SupportedLanguageCode = 'es' | 'en' | 'fr' | 'pt';

const resources = {
  es: { translation: es },
  en: { translation: en },
  fr: { translation: fr },
  pt: { translation: pt },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    supportedLngs: ['es', 'en', 'fr', 'pt'],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'antask_language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
