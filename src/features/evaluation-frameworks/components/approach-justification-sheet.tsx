import type { TFunction } from "i18next"
import { ChevronDown, PencilLine } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { RecommendedMethods } from "@/features/evaluation-frameworks/components/recommended-methods"
import type { RecommendedMethods as RecommendedMethodsValue } from "@/features/evaluation-frameworks/model/approach-types"
import type { EvaluationCycle } from "@/features/evaluation-frameworks/model/types"
import { cn } from "@/shared/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/base/sheet"

export type ApproachJustification = {
  rule?: string
  inputs: Record<string, unknown>
  overridden?: boolean
}

const cycleValues = ["ex_ante", "en_cours", "mi_parcours", "finale", "ex_post"]
const optionValues = [
  "local",
  "national",
  "multi_country",
  "one",
  "two_to_three",
  "four_plus",
  "under_5m",
  "between_5m_50m",
  "over_50m",
  "unknown",
  "yes",
  "no",
  "partial",
  "pilot",
  "finance",
  "mandated_evaluator",
  "partner",
  "accountability",
  "learning_steering",
  "funding_decision",
]
const stageValues = [
  "design",
  "pre_launch",
  "implementation",
  "mid_term",
  "closing",
  "post_closure",
  "cross_cutting",
]

function humanize(value: string) {
  return value.replaceAll("_", " ")
}

/**
 * Lit une justification persistee (jsonb `approaches.justifications`) sans
 * presumer de sa forme : les anciennes versions peuvent ne pas en contenir.
 */
export function readApproachJustification(
  value: unknown
): ApproachJustification | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }

  const record = value as Record<string, unknown>
  const inputs =
    record.inputs &&
    typeof record.inputs === "object" &&
    !Array.isArray(record.inputs)
      ? (record.inputs as Record<string, unknown>)
      : {}

  return {
    rule: typeof record.rule === "string" ? record.rule : undefined,
    inputs,
    overridden: record.overridden === true,
  }
}

function formatInputValue(t: TFunction, key: string, value: unknown) {
  if (typeof value === "number") {
    if (key === "progression") {
      return `${Math.round(value * 100)} %`
    }

    if (["scale", "actors", "themes", "objectType", "budget"].includes(key)) {
      return t("approach.points", { count: value })
    }

    return String(value)
  }

  if (typeof value !== "string") {
    return String(value)
  }

  if (optionValues.includes(value)) {
    return t(`approach.options.${value}`)
  }

  if (cycleValues.includes(value)) {
    return t(`approach.cycles.${value}`)
  }

  if (["simple", "complique", "complexe"].includes(value)) {
    return t(`approach.complexity.${value}`)
  }

  if (stageValues.includes(value)) {
    return t(`workspaces.creation.stages.${value}`)
  }

  if (["program", "project", "policy"].includes(value)) {
    return t(`workspaces.objectType.${value}`)
  }

  if (["decideur", "pmu", "analyste"].includes(value)) {
    return t(`personas.${value}.name`)
  }

  return humanize(value)
}

/**
 * Drawer « Pourquoi ce résultat ? » d'une dimension de l'approche : la
 * justification lisible, la regle metier appliquee et les elements pris en
 * compte par le moteur.
 */
export function ApproachJustificationSheet({
  open,
  onOpenChange,
  dimension,
  label,
  rationale,
  justification,
  cycle,
  methods,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Cle de la dimension (framework, cycle, instrument, complexity, nature, method). */
  dimension: string
  label?: string
  rationale?: string
  justification?: ApproachJustification
  cycle: EvaluationCycle
  methods: RecommendedMethodsValue
}) {
  const { t } = useTranslation()

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full sm:max-w-lg!">
        <SheetHeader className="border-b border-border pr-12">
          <SheetTitle>{t("approach.whyTitle")}</SheetTitle>
          <SheetDescription>{label}</SheetDescription>
        </SheetHeader>
        <JustificationBody
          cycle={cycle}
          dimension={dimension}
          justification={justification}
          key={dimension}
          methods={methods}
          rationale={rationale}
        />
      </SheetContent>
    </Sheet>
  )
}

function JustificationBody({
  dimension,
  rationale,
  justification,
  cycle,
  methods,
}: {
  dimension: string
  rationale?: string
  justification?: ApproachJustification
  cycle: EvaluationCycle
  methods: RecommendedMethodsValue
}) {
  const { t } = useTranslation()
  const [showRuleDetails, setShowRuleDetails] = useState(false)
  const inputs = Object.entries(justification?.inputs ?? {})

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-8 sm:px-6">
      <div className="border-b border-border py-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("approach.recommendationRationale")}
        </p>
        <p className="mt-3 text-sm leading-6">
          {justification ? rationale : t("approach.justificationUnavailable")}
        </p>
        {justification?.overridden ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <PencilLine className="size-3.5" />
            {t("approach.overridden")}
          </p>
        ) : null}
        <div>
          <button
            aria-expanded={showRuleDetails}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            onClick={() => setShowRuleDetails((current) => !current)}
            type="button"
          >
            {justification?.rule
              ? t("approach.ruleApplied", { rule: justification.rule })
              : t("approach.ruleExplanation")}
            <ChevronDown
              className={cn(
                "size-3 transition-transform",
                showRuleDetails && "rotate-180"
              )}
            />
          </button>
        </div>

        {showRuleDetails ? (
          <div className="mt-4 rounded-lg border border-amber-400/60 bg-amber-300/20 p-4 text-amber-950 shadow-[0_0_24px_rgba(251,191,36,0.16)] dark:text-amber-100">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">
              {t("approach.ruleExplanation")}
            </p>
            <p className="mt-2 text-xs leading-5">
              {t(`approach.ruleDescriptions.${dimension}`)}
            </p>
          </div>
        ) : null}
      </div>

      {dimension === "method" ? (
        <div className="border-b border-border py-6">
          <RecommendedMethods cycle={cycle} methods={methods} />
        </div>
      ) : null}

      {inputs.length > 0 ? (
        <div className="py-6">
          <p className="text-xs font-semibold">{t("approach.inputsUsed")}</p>
          <dl className="mt-4 divide-y divide-border">
            {inputs.map(([key, value]) => (
              <div
                className="flex justify-between gap-6 py-3 text-xs"
                key={key}
              >
                <dt className="text-muted-foreground">
                  {t(`approach.inputLabels.${key}`, {
                    defaultValue: humanize(key),
                  })}
                </dt>
                <dd className="text-right font-medium">
                  {formatInputValue(t, key, value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  )
}
