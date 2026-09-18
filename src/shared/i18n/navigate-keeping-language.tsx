import { Navigate, useSearchParams } from "react-router-dom"

import { languageQueryParam } from "@/shared/i18n/resources"

type NavigateKeepingLanguageProps = {
  state?: unknown
  to: string
}

/**
 * Comme `<Navigate>`, mais reporte `?lang=` sur la destination.
 *
 * Sans cela, ouvrir `/?lang=en` redirigerait vers `/login` sans la query :
 * la langue serait bien appliquee au premier rendu, mais l'URL finale ne
 * la porterait plus et ne serait donc plus partageable.
 */
export function NavigateKeepingLanguage({
  state,
  to,
}: NavigateKeepingLanguageProps) {
  const [searchParams] = useSearchParams()
  const language = searchParams.get(languageQueryParam)
  const target = language
    ? `${to}?${new URLSearchParams({ [languageQueryParam]: language }).toString()}`
    : to

  return <Navigate replace state={state} to={target} />
}
