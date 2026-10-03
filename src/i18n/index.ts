import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import es from './locales/es.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import zh from './locales/zh.json';
import hi from './locales/hi.json';
import ar from './locales/ar.json';
import bn from './locales/bn.json';
import ru from './locales/ru.json';
import ur from './locales/ur.json';

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
  { code: 'zh', label: '中文 (Chinese)', flag: '🇨🇳' },
  { code: 'hi', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'ar', label: 'العربية (Arabic)', flag: '🇸🇦' },
  { code: 'bn', label: 'বাংলা (Bengali)', flag: '🇧🇩' },
  { code: 'ru', label: 'Русский (Russian)', flag: '🇷🇺' },
  { code: 'ur', label: 'اردو (Urdu)', flag: '🇵🇰' },
];

export type SupportedLanguageCode = 'es' | 'en' | 'fr' | 'pt' | 'zh' | 'hi' | 'ar' | 'bn' | 'ru' | 'ur';

const resources = {
  es: { translation: es },
  en: { translation: en },
  fr: { translation: fr },
  pt: { translation: pt },
  zh: { translation: zh },
  hi: { translation: hi },
  ar: { translation: ar },
  bn: { translation: bn },
  ru: { translation: ru },
  ur: { translation: ur },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    supportedLngs: ['es', 'en', 'fr', 'pt', 'zh', 'hi', 'ar', 'bn', 'ru', 'ur'],
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
