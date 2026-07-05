import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { translations } from "@/lib/translations";

const LanguageContext = createContext(null);

function readStoredLang() {
  if (typeof window === "undefined") return "fr";
  return window.localStorage.getItem("mh-lang") || "fr";
}

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(readStoredLang);

  const setLang = useCallback((next) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mh-lang", next);
    }
  }, []);

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
  }, [lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLang = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
};
