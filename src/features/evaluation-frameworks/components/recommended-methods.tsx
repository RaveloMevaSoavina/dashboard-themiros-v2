import { Layers, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"

import { coreMethodsForCycle } from "@/features/evaluation-frameworks/model/approach-engine"
import type { RecommendedMethods as RecommendedMethodsValue } from "@/features/evaluation-frameworks/model/approach-types"
import type { EvaluationCycle } from "@/features/evaluation-frameworks/model/types"
import { cn } from "@/shared/lib/utils"

function humanize(value: string) {
  return value.replaceAll("_", " ")
}

function useMethodGroups(
  cycle: EvaluationCycle,
  methods: RecommendedMethodsValue
) {
  const { t } = useTranslation()
  const methodLabel = (method: string) =>
    t(`approach.methods.${method}`, { defaultValue: humanize(method) })
  const cycleCoreMethods = coreMethodsForCycle(cycle)

  return {
    t,
    methodLabel,
    coreMethods: methods.engine.filter((method) =>
      cycleCoreMethods.includes(method)
    ),
    addedMethods: methods.engine.filter(
      (method) => !cycleCoreMethods.includes(method)
    ),
    offEngineMethods: methods.off_engine,
  }
}

/**
 * Resume compact pour une carte : les methodes ajoutees selon le contexte en
 * valeur principale, le socle et les methodes hors moteur en lignes
 * secondaires. Uniquement des <span> pour pouvoir etre place dans un <button>.
 */
export function RecommendedMethodsSummary({
  className,
  cycle,
  methods,
}: {
  className?: string
  cycle: EvaluationCycle
  methods: RecommendedMethodsValue
}) {
  const { t, methodLabel, coreMethods, addedMethods, offEngineMethods } =
    useMethodGroups(cycle, methods)
  const addedText = addedMethods.map(methodLabel).join(", ")
  const coreText = coreMethods.map(methodLabel).join(" · ")
  const offEngineText = offEngineMethods.map(methodLabel).join(", ")

  return (
    <span className={cn("block", className)}>
      <span className="flex items-start gap-1.5 text-sm font-semibold">
        {addedMethods.length > 0 ? (
          <Plus className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        ) : null}
        <span className="line-clamp-2" title={addedText}>
          {addedMethods.length > 0
            ? addedText
            : t("approach.methodGroups.coreOnly")}
        </span>
      </span>
      <span className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-muted-foreground">
        <span className="shrink-0 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium leading-none text-background">
          {t("approach.methodGroups.coreBadge")}
        </span>
        <span className="line-clamp-2" title={coreText}>
          {coreText}
        </span>
      </span>
      {offEngineMethods.length > 0 ? (
        <span className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-4 text-muted-foreground">
          <span className="shrink-0 rounded border border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium leading-none">
            {t("approach.methodGroups.offEngineBadge")}
          </span>
          <span className="line-clamp-1" title={offEngineText}>
            {offEngineText}
          </span>
        </span>
      ) : null}
    </span>
  )
}

/**
 * Detail complet des methodes recommandees : le socle du cycle, toujours
 * applique, est separe des methodes ajoutees selon le contexte (dont celles
 * hors moteur).
 */
export function RecommendedMethods({
  className,
  cycle,
  methods,
}: {
  className?: string
  cycle: EvaluationCycle
  methods: RecommendedMethodsValue
}) {
  const { t, methodLabel, coreMethods, addedMethods, offEngineMethods } =
    useMethodGroups(cycle, methods)
  const addedCount = addedMethods.length + offEngineMethods.length

  return (
    <span className={cn("grid gap-4", className)}>
      <span className="block">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold">
          <Layers className="size-3.5" />
          {t("approach.methodGroups.core", { count: coreMethods.length })}
          <span className="font-normal text-muted-foreground">
            · {t("approach.methodGroups.coreHint")}
          </span>
        </span>
        <span className="mt-3 flex flex-wrap gap-2">
          {coreMethods.map((method) => (
            <span
              className="rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background"
              key={method}
            >
              {methodLabel(method)}
            </span>
          ))}
        </span>
      </span>

      <span className="block border-t border-dashed border-border pt-4">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold">
          <Plus className="size-3.5" />
          {t("approach.methodGroups.added", { count: addedCount })}
          <span className="font-normal text-muted-foreground">
            · {t("approach.methodGroups.addedHint")}
          </span>
        </span>
        {addedCount === 0 ? (
          <span className="mt-3 block text-xs text-muted-foreground">
            {t("approach.methodGroups.noAdded")}
          </span>
        ) : (
          <span className="mt-3 flex flex-wrap gap-2">
            {addedMethods.map((method) => (
              <span
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium"
                key={method}
              >
                <Plus className="size-3 text-muted-foreground" />
                {methodLabel(method)}
              </span>
            ))}
            {offEngineMethods.map((method) => (
              <span
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground"
                key={method}
              >
                {methodLabel(method)}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none">
                  {t("approach.methodGroups.offEngine")}
                </span>
              </span>
            ))}
          </span>
        )}
      </span>
    </span>
  )
}

/**
 * Variante en une ligne d'etiquettes, pour un bandeau : socle en etiquettes
 * pleines, puis methodes ajoutees et hors moteur apres un separateur.
 */
export function RecommendedMethodsInline({
  className,
  cycle,
  methods,
}: {
  className?: string
  cycle: EvaluationCycle
  methods: RecommendedMethodsValue
}) {
  const { t, methodLabel, coreMethods, addedMethods, offEngineMethods } =
    useMethodGroups(cycle, methods)

  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {coreMethods.map((method) => (
        <span
          className="rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background"
          key={method}
        >
          {methodLabel(method)}
        </span>
      ))}
      {addedMethods.length + offEngineMethods.length > 0 ? (
        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      ) : null}
      {addedMethods.map((method) => (
        <span
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium"
          key={method}
        >
          <Plus className="size-3 text-muted-foreground" />
          {methodLabel(method)}
        </span>
      ))}
      {offEngineMethods.map((method) => (
        <span
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground"
          key={method}
        >
          {methodLabel(method)}
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none">
            {t("approach.methodGroups.offEngine")}
          </span>
        </span>
      ))}
    </span>
  )
}
