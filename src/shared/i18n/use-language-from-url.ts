import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useSearchParams } from "react-router-dom"

import {
  languageQueryParam,
  type SupportedLanguage,
  supportedLanguages,
} from "@/shared/i18n/resources"

/** Seule route ou `?lang=` est pris en compte. */
const languageAwarePath = "/login"

function isSupported(value: string): value is SupportedLanguage {
  return (supportedLanguages as readonly string[]).includes(value)
}

/**
 * Applique la langue passee dans l'URL (`/login?lang=en`), puis retire le
 * parametre.
 *
 * Seul `/login` porte la langue : c'est la page d'entree, la seule dont on
 * partage l'URL avant d'avoir un choix enregistre. Une fois appliquee, la
 * langue vit dans localStorage (voir la config i18next), donc les autres
 * routes en heritent sans avoir a la trainer dans leur URL.
 *
 * Le parametre est consomme puis efface : l'URL reste propre et un
 * changement de langue ultérieur dans l'app n'est pas ecrase par une
 * valeur obsolete restee dans la barre d'adresse.
 */
export function useLanguageFromUrl() {
  const { i18n } = useTranslation()
  const { pathname } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get(languageQueryParam)

  useEffect(() => {
    if (pathname !== languageAwarePath || !requested) {
      return
    }

    const normalized = requested.trim().toLowerCase().split("-")[0]

    // Une valeur non supportee est ignoree : on garde la langue courante
    // plutot que de retomber sur le fallback.
    if (isSupported(normalized) && normalized !== i18n.resolvedLanguage) {
      void i18n.changeLanguage(normalized)
    }

    const next = new URLSearchParams(searchParams)
    next.delete(languageQueryParam)
    setSearchParams(next, { replace: true })
  }, [i18n, pathname, requested, searchParams, setSearchParams])
}
