
import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'de', 'it', 'zh', 'ja', 'pt', 'fr', 'es'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export default getRequestConfig(async ({ locale }) => {
  // If locale is missing or invalid (e.g. next-intl routing not configured),
  // gracefully fall back to English instead of calling notFound()
  const safeLocale: Locale = locale && locales.includes(locale as Locale)
    ? (locale as Locale)
    : defaultLocale;

  return {
    locale: safeLocale,
    messages: (await import(`../../translations/${safeLocale}.json`)).default
  };
});
