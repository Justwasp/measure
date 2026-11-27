import { useEffect, useState, type ReactNode } from 'react';
import { I18nContext } from './I18nContext';
import { TRANSLATIONS, type Locale, type TranslationDict } from './translations';

const LOCALE_STORAGE_KEY = 'measure.locale.v1';

function loadInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'en' || saved === 'ru') return saved;
  } catch {
    // Ignore storage access errors
  }
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(loadInitialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Ignore storage errors
    }
  }, [locale]);

  const setLocale = (next: Locale) => setLocaleState(next);
  const toggleLocale = () => setLocaleState((prev) => (prev === 'en' ? 'ru' : 'en'));

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        toggleLocale,
        t: TRANSLATIONS[locale] as TranslationDict,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}
