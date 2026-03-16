"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Language, translations } from "@/lib/i18n";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("carveo-lang") as Language | null;
    if (saved === "en" || saved === "de") setLanguage(saved);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("carveo-lang", language);
    document.dir = "ltr";
  }, [language, mounted]);

  const t = (key: string): string => {
    const langData = translations[language] || translations.en;
    return (langData as Record<string, string>)[key] ?? (translations.en as Record<string, string>)[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
};
