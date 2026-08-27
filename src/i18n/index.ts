import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./fr.json";
import en from "./en.json";

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr as never },
    en: { translation: en as never },
  },
  lng: "fr",
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

export default i18n;
export type Lang = "fr" | "en";
