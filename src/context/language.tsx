import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "../i18n";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [lang, setLangState] = useState<Lang>((i18n.language?.startsWith("en") ? "en" : "fr") as Lang);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang: (next) => {
        setLangState(next);
        void i18n.changeLanguage(next);
      },
    }),
    [lang, i18n],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
