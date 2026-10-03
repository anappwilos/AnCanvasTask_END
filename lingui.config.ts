import type { LinguiConfig } from '@lingui/conf';
import { formatter } from '@lingui/format-json';

const config: LinguiConfig = {
  locales: ['es', 'en', 'zh', 'hi', 'fr', 'ar', 'bn', 'pt', 'ru', 'ur'],
  sourceLocale: 'es',
  fallbackLocales: {
    default: 'es'
  },
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src/**'],
      exclude: ['**/node_modules/**', '**/dist/**'],
    },
  ],
  format: formatter({ style: 'minimal' }),
  compileNamespace: 'es',
};

export default config;
