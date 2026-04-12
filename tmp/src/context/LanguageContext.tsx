import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { translations, type Language } from '../translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('az');

  useEffect(() => {
    const savedCode = localStorage.getItem('app-language') as Language;
    if (savedCode && ['ru', 'az', 'tr'].includes(savedCode)) {
      setLanguageState(savedCode);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app-language', lang);
  };

  const t = (key: string): string => {
    const record = translations[key];
    if (!record) {
      console.warn(`Translation key missing: ${key}`);
      return key;
    }
    // Fallback to AZ if RU or TR is missing for some reason
    return record[language] || record['az'];
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
