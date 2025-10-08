import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

type Locale = 'en' | 'ar';

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, options?: { [key: string]: string | number }) => string;
}

export const LocaleContext = createContext<LocaleContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    return (localStorage.getItem('locale') as Locale) || 'en';
  });

  const [translations, setTranslations] = useState<{ [key in Locale]?: any }>({});

  useEffect(() => {
    const fetchTranslations = async () => {
      try {
        const [enResponse, arResponse] = await Promise.all([
          fetch('/k.a-cockpit/locales/en.json'),
          fetch('/k.a-cockpit/locales/ar.json')
        ]);
        if (!enResponse.ok || !arResponse.ok) {
            throw new Error(`Failed to fetch locale files: ${enResponse.statusText} & ${arResponse.statusText}`);
        }
        const enData = await enResponse.json();
        const arData = await arResponse.json();
        setTranslations({ en: enData, ar: arData });
      } catch (error) {
        console.error("Failed to load translation files:", error);
      }
    };
    fetchTranslations();
  }, []); // Run only once on mount

  useEffect(() => {
    localStorage.setItem('locale', locale);
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
  };

  const t = useCallback((key: string, options?: { [key: string]: string | number }) => {
    let text = translations[locale]?.[key] || translations['en']?.[key] || key;
    if (options) {
      Object.keys(options).forEach(optKey => {
        text = text.replace(`{{${optKey}}}`, String(options[optKey]));
      });
    }
    return text;
  }, [locale, translations]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = () => useContext(LocaleContext);
