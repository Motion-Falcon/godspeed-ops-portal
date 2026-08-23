import { createContext, useContext, useEffect, useState } from "react";
import coreEn from "./locales/en.json";
import timesheetEn from "./locales/en/timesheet.json";
import reportsEn from "./locales/en/reports.json";
import coreFr from "./locales/fr.json";
import timesheetFr from "./locales/fr/timesheet.json";
import reportsFr from "./locales/fr/reports.json";
import { mergeLocale } from "./mergeLocales";

export type Language = "en" | "fr";

interface LanguageProviderProps {
  children: React.ReactNode;
  defaultLanguage?: Language;
  storageKey?: string;
}

interface LanguageProviderState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, interpolations?: Record<string, string | number>) => string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const translations: Record<Language, Record<string, any>> = {
  en: mergeLocale(coreEn, timesheetEn, reportsEn),
  fr: mergeLocale(coreFr, timesheetFr, reportsFr),
};

const initialState: LanguageProviderState = {
  language: "en",
  setLanguage: () => null,
  t: () => "",
};

const LanguageProviderContext = createContext<LanguageProviderState>(initialState);

// Helper function to get nested translation value
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getNestedValue = (obj: Record<string, any>, path: string): string | undefined => {
  const result = path.split('.').reduce((current, key) => {
    return current && typeof current === 'object' && current[key] !== undefined ? current[key] : undefined;
  }, obj);
  return typeof result === 'string' ? result : undefined;
};

// Helper function to interpolate variables in translation strings
const interpolateString = (template: string, variables: Record<string, string | number>): string => {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match;
  });
};

export function LanguageProvider({
  children,
  defaultLanguage = "en",
  storageKey = "app-language",
  ...props
}: LanguageProviderProps) {
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem(storageKey) as Language) || defaultLanguage
  );

  useEffect(() => {
    localStorage.setItem(storageKey, language);
    // Set a class or data attribute on <html> for language
    document.documentElement.setAttribute("lang", language);
  }, [language, storageKey]);

  // Translation function
  const t = (key: string, interpolations?: Record<string, string | number>): string => {
    const currentTranslations = translations[language];
    let translatedValue = getNestedValue(currentTranslations, key);

    // Fallback to English if translation is not found
    if (translatedValue === undefined && language !== "en") {
      translatedValue = getNestedValue(translations.en, key);
    }

    // If still not found, return the key itself
    if (translatedValue === undefined) {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }

    // If interpolations are provided, replace placeholders
    if (interpolations && typeof translatedValue === 'string') {
      return interpolateString(translatedValue, interpolations);
    }

    return String(translatedValue);
  };

  const value = {
    language,
    setLanguage: (lang: Language) => {
      localStorage.setItem(storageKey, lang);
      setLanguage(lang);
    },
    t,
  };

  return (
    <LanguageProviderContext.Provider {...props} value={value}>
      {children}
    </LanguageProviderContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageProviderContext);
  if (context === undefined)
    throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
}; 