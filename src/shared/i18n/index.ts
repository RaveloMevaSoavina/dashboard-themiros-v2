import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"

import {
  defaultNamespace,
  fallbackLanguage,
  languageStorageKey,
  resources,
  supportedLanguages,
} from "@/shared/i18n/resources"

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: fallbackLanguage,
    supportedLngs: [...supportedLanguages],
    defaultNS: defaultNamespace,
    ns: [defaultNamespace],
    detection: {
      caches: ["localStorage"],
      lookupLocalStorage: languageStorageKey,
      order: ["localStorage", "navigator", "htmlTag"],
    },
    interpolation: {
      escapeValue: false,
    },
  })

export { i18n }
