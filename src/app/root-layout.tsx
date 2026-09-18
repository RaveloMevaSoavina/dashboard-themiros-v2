import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Outlet } from "react-router-dom"

import { useLanguageFromUrl } from "@/shared/i18n/use-language-from-url"

/**
 * Layout racine : applique la langue demandee dans l'URL et tient
 * l'attribut `lang` du document a jour pour les lecteurs d'ecran.
 */
export function RootLayout() {
  const { i18n } = useTranslation()

  useLanguageFromUrl()

  useEffect(() => {
    if (i18n.resolvedLanguage) {
      document.documentElement.lang = i18n.resolvedLanguage
    }
  }, [i18n.resolvedLanguage])

  return <Outlet />
}
