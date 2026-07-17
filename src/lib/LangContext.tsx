'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Language } from './i18n';
import { getTranslations, getDirection } from './i18n';

interface LangContextType {
  language: Language;
  setLanguage: (l: Language) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const LangContext = createContext<LangContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (k) => k,
  dir: 'ltr',
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('spms_lang') as Language | null;
    if (saved && ['en', 'ku', 'ar'].includes(saved)) setLanguageState(saved);
  }, []);

  const setLanguage = (l: Language) => {
    setLanguageState(l);
    localStorage.setItem('spms_lang', l);
  };

  const translations = getTranslations(language);
  const t = (key: string) => translations[key] || key;
  const dir = getDirection(language);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  return (
    <LangContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
