import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"

import {
  defaultNamespace,
  fallbackLanguage,
  languageQueryParam,
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
      // `?lang=` d'abord : une URL partagee impose sa langue, meme si le
      // visiteur avait deja choisi autre chose. Le choix est ensuite
      // persiste, donc il survit a la navigation interne.
      order: ["querystring", "localStorage", "navigator", "htmlTag"],
      lookupQuerystring: languageQueryParam,
      lookupLocalStorage: languageStorageKey,
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
  })

export { i18n }
