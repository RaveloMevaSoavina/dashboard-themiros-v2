import { Check, Loader2, Minus, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  type RunStep,
  type RunStepName,
  runStepNames,
} from "@/features/evaluations/model/types"
import { cn } from "@/shared/lib/utils"

/** Clés i18n historiques des étapes (`evaluation.analysis.steps.*`). */
const stepLabelKey: Record<RunStepName, string> = {
  classification: "classification",
  variables: "variables",
  layer_a: "layerA",
  layer_b: "layerB",
  layer_c: "layerC",
  restitution: "reporting",
}

function StepIcon({ step, index }: { step: RunStep; index: number }) {
  const base =
    "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px]"
  if (step.status === "completed")
    return (
      <span
        className={cn(base, "border-foreground bg-foreground text-background")}
      >
        <Check className="size-4" />
      </span>
    )
  if (step.status === "running")
    return (
      <span className={cn(base, "border-foreground")}>
        <Loader2 className="size-4 animate-spin" />
      </span>
    )
  if (step.status === "failed")
    return (
      <span className={cn(base, "border-destructive text-destructive")}>
        <X className="size-4" />
      </span>
    )
  if (step.status === "skipped")
    return (
      <span
        className={cn(
          base,
          "border-dashed border-border text-muted-foreground"
        )}
      >
        <Minus className="size-4" />
      </span>
    )
  return <span className={cn(base, "border-border")}>{index + 1}</span>
}

/**
 * Étapes nommées du pipeline et leur état (US-13.1). Sans étapes connues
 * (run tout juste créé), elles s'affichent en attente.
 */
export function RunProgress({ steps }: { steps: RunStep[] }) {
  const { t } = useTranslation()
  const rows: RunStep[] = runStepNames.map(
    (name) =>
      steps.find((step) => step.name === name) ?? {
        name,
        status: "pending",
        summary: null,
        errorMessage: null,
      }
  )
  return (
    <ol className="divide-y divide-border rounded-xl border border-border">
      {rows.map((step, index) => {
        const waiting =
          step.name === "classification" &&
          step.status === "pending" &&
          Boolean(step.summary?.waiting)
        return (
          <li className="flex items-center gap-4 px-5 py-4" key={step.name}>
            <StepIcon index={index} step={step} />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm",
                  step.status === "skipped" && "text-muted-foreground"
                )}
              >
                {t(`evaluation.analysis.steps.${stepLabelKey[step.name]}`)}
              </p>
              {waiting || step.status === "skipped" || step.errorMessage ? (
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {step.errorMessage ??
                    (waiting
                      ? t("evaluation.run.waitingClassification")
                      : step.summary?.reason === "not_available"
                        ? t("evaluation.run.stepNotAvailable")
                        : t("evaluation.run.stepNotReached"))}
                </p>
              ) : null}
            </div>
            <span className="shrink-0 text-[12px] text-muted-foreground">
              {t(`evaluation.run.stepStatus.${step.status}`)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
