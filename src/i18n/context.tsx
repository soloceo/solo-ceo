import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import zh from "./zh";

export type Lang = "zh" | "en";
type Translations = typeof zh;
type TKey = keyof Translations;

const STORAGE_KEY = "APP_LANGUAGE";

// zh is always available (default); en is lazy-loaded on demand
const dictionaries: Record<Lang, Translations> = { zh, en: zh };
let enLoaded = false;

async function loadEn(): Promise<Translations> {
  if (enLoaded) return dictionaries.en;
  const mod = await import("./en");
  dictionaries.en = mod.default;
  enLoaded = true;
  return mod.default;
}

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
  const [, forceUpdate] = useState(0);

  // Load English translations on demand
  useEffect(() => {
    if (lang === "en" && !enLoaded) {
      loadEn().then(() => forceUpdate((n) => n + 1));
    }
  }, [lang]);

  // Preload English in the background after initial render
  useEffect(() => {
    if (!enLoaded) {
      // Use requestIdleCallback if available, otherwise setTimeout
      const load = () => loadEn();
      if ('requestIdleCallback' in window) {
        (window as Record<string, any>).requestIdleCallback(load);
      } else {
        setTimeout(load, 2000);
      }
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
    window.dispatchEvent(new CustomEvent("language-changed", { detail: l }));
    if (l === "en" && !enLoaded) {
      loadEn().then(() => forceUpdate((n) => n + 1));
    }
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
