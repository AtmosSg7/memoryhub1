import React, { createContext, useContext, useState, useMemo } from "react";
import { translations } from "@/lib/translations";

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState("fr");

  const value = useMemo(() => {
    const dict = translations[lang];
    const t = (key) => {
      const parts = key.split(".");
      let cur = dict;
      for (const p of parts) {
        if (cur && typeof cur === "object" && p in cur) cur = cur[p];
        else return key;
      }
      return cur;
    };
    return { lang, setLang, t };
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLang = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
};
