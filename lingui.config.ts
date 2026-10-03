import type { LinguiConfig } from '@lingui/conf';
import { formatter } from '@lingui/format-json';

const config: LinguiConfig = {
  locales: ['es', 'en'],
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
};

export default config;
