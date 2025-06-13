
import React, { createContext, useState, useContext, useCallback, ReactNode } from 'react';
import * as localeData from './locales'; // Changed to namespace import

interface LocaleContextType {
  locale: localeData.Locale;
  setLocale: (locale: localeData.Locale) => void;
  t: (key: localeData.TranslationKey, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export const LocaleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<localeData.Locale>('hu'); // Default to Hungarian

  const setLocale = (newLocale: localeData.Locale) => {
    setLocaleState(newLocale);
  };

  const t = useCallback((key: localeData.TranslationKey, params?: Record<string, string | number>): string => {
    let translation = localeData.translations[locale]?.[key] || localeData.translations['en']?.[key] || String(key); // Fallback to English, then key itself
    if (params) {
      Object.keys(params).forEach(paramKey => {
        translation = translation.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(params[paramKey]));
      });
    }
    return translation;
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = (): LocaleContextType => {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
};
