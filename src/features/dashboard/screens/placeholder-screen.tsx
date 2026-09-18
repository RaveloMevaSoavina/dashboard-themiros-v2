import { useTranslation } from "react-i18next"

type PlaceholderScreenProps = {
  /** Cle i18n sous `nav.items.`, partagee avec la barre laterale. */
  labelKey: string
}

/**
 * Destination provisoire des entrees de navigation dont l'ecran arrive
 * dans un sprint ulterieur : la coquille reste navigable de bout en bout.
 */
export function PlaceholderScreen({ labelKey }: PlaceholderScreenProps) {
  const { t } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-5xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {t("workspaces.eyebrow")}
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        {t(`nav.items.${labelKey}`)}
      </h1>
      <p className="mt-3 max-w-xl text-[13px] text-muted-foreground">
        {t("placeholder.description")}
      </p>
    </div>
  )
}
