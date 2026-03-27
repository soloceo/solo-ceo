import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import zh from "./zh";
import en from "./en";

export type Lang = "zh" | "en";
type Translations = typeof zh;
type TKey = keyof Translations;

const STORAGE_KEY = "APP_LANGUAGE";
const dictionaries: Record<Lang, Translations> = { zh, en };

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<I18nCtx>(null!);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en" ? "en" : "zh";
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
    window.dispatchEvent(new CustomEvent("language-changed", { detail: l }));
  }, []);

  const t = useCallback(
    (key: TKey, vars?: Record<string, string | number>) => {
      let str = dictionaries[lang][key] ?? dictionaries.zh[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return str;
    },
    [lang],
  );

  const ctx = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={ctx}>{children}</LanguageContext.Provider>;
}

export function useT() {
  return useContext(LanguageContext);
}
