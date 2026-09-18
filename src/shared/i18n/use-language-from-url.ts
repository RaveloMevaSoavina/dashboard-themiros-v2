import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import {
  languageQueryParam,
  type SupportedLanguage,
  supportedLanguages,
} from "@/shared/i18n/resources"

function isSupported(value: string): value is SupportedLanguage {
  return (supportedLanguages as readonly string[]).includes(value)
}

/**
 * Applique la langue passee dans l'URL (`?lang=en`).
 *
 * Le detecteur i18next ne lit la query qu'au premier chargement : ce hook
 * prend le relais pour la navigation interne, ou l'URL change sans que la
 * page soit rechargee. Une valeur non supportee est ignoree, ce qui laisse
 * la langue courante en place plutot que de retomber sur le fallback.
 */
export function useLanguageFromUrl() {
  const { i18n } = useTranslation()
  const [searchParams] = useSearchParams()
  const requested = searchParams.get(languageQueryParam)

  useEffect(() => {
    if (!requested) {
      return
    }

    const normalized = requested.trim().toLowerCase().split("-")[0]

    if (isSupported(normalized) && normalized !== i18n.resolvedLanguage) {
      void i18n.changeLanguage(normalized)
    }
  }, [i18n, requested])
}
