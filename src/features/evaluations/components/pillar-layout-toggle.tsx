import { LayoutGrid, LayoutList } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import type { PillarCardLayout } from "@/features/evaluations/components/pillar-result-card"
import { Button } from "@/shared/ui/base/button"

const layoutStorageKey = "themiros.analysis.pillarLayout"

function readStoredLayout(): PillarCardLayout {
  try {
    return localStorage.getItem(layoutStorageKey) === "horizontal"
      ? "horizontal"
      : "vertical"
  } catch {
    return "vertical"
  }
}

/** Disposition des cartes de pilier, partagee entre les ecrans d'analyse. */
export function usePillarLayout() {
  const [layout, setLayout] = useState<PillarCardLayout>(readStoredLayout)
  const changeLayout = (next: PillarCardLayout) => {
    setLayout(next)
    try {
      localStorage.setItem(layoutStorageKey, next)
    } catch {
      /* Stockage indisponible : le choix vaut pour la session en cours. */
    }
  }
  return [layout, changeLayout] as const
}

export function pillarGridClassName(layout: PillarCardLayout) {
  return layout === "horizontal"
    ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3"
    : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
}

export function PillarLayoutToggle({
  value,
  onChange,
}: {
  value: PillarCardLayout
  onChange: (layout: PillarCardLayout) => void
}) {
  const { t } = useTranslation()
  return (
    <fieldset className="m-0 flex gap-1 rounded-lg border border-border p-0.5">
      <legend className="sr-only">
        {t("evaluation.analysis.layout.label")}
      </legend>
      {(
        [
          ["vertical", LayoutGrid],
          ["horizontal", LayoutList],
        ] as const
      ).map(([layout, Icon]) => (
        <Button
          aria-pressed={value === layout}
          key={layout}
          onClick={() => onChange(layout)}
          size="sm"
          variant={value === layout ? "secondary" : "ghost"}
        >
          <Icon /> {t(`evaluation.analysis.layout.${layout}`)}
        </Button>
      ))}
    </fieldset>
  )
}
