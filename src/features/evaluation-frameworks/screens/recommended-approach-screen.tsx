import { useMutation, useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  Scale,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import {
  type ApproachFingerprint,
  type ApproachQuestionnaire,
  type CriterionRule,
  computeApproach,
  computeCycle,
  deriveQuestionnaireDefaults,
} from "@/features/evaluation-frameworks/model/approach-engine"
import type {
  EvaluationCycle,
  ReferenceLocale,
} from "@/features/evaluation-frameworks/model/types"
import { saveAndConfirmApproach } from "@/features/evaluation-frameworks/services/approach-service"
import {
  listReferenceCriteria,
  listReferenceFrameworks,
} from "@/features/evaluation-frameworks/services/reference-service"
import { useWorkspaces } from "@/features/workspaces/model/workspace-provider"
import { getWorkspaceApproachContext } from "@/features/workspaces/services/workspace-service"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/base/button"

const currentYear = new Date().getFullYear()
const selectClassName =
  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const questionnaireFields = [
  ["scale", ["local", "national", "multi_country"]],
  ["actors", ["one", "two_to_three", "four_plus"]],
  ["budget", ["under_5m", "between_5m_50m", "over_50m", "unknown"]],
  ["baseline", ["yes", "no", "unknown"]],
  ["comparisonGroup", ["yes", "no", "unknown"]],
  ["monitoringData", ["yes", "partial", "no"]],
  ["relation", ["pilot", "finance", "mandated_evaluator", "partner"]],
  ["purpose", ["accountability", "learning_steering", "funding_decision"]],
] as const

const cycleValues: EvaluationCycle[] = [
  "ex_ante",
  "en_cours",
  "mi_parcours",
  "finale",
  "ex_post",
]

function toCriterionRule(
  criterion: Awaited<ReturnType<typeof listReferenceCriteria>>[number],
  cycle: EvaluationCycle
): CriterionRule {
  const applicabilityByCycle = Object.fromEntries(
    cycleValues.map((value) => [
      value,
      value === cycle ? criterion.applicability : "non_applicable",
    ])
  ) as CriterionRule["applicabilityByCycle"]

  return {
    id: criterion.id,
    code: criterion.code,
    defaultWeight: criterion.default_weight,
    applicabilityByCycle,
  }
}

function humanize(value: string) {
  return value.replaceAll("_", " ")
}

export function RecommendedApproachScreen() {
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const { persona } = useWorkspaces()
  const defaults = deriveQuestionnaireDefaults(persona)
  const [questionnaire, setQuestionnaire] = useState<ApproachQuestionnaire>({
    scale: "national",
    actors: "two_to_three",
    budget: "unknown",
    baseline: "unknown",
    comparisonGroup: "unknown",
    monitoringData: "partial",
    ...defaults,
  })
  const [selectedJustification, setSelectedJustification] =
    useState("framework")
  const locale = (
    ["fr", "en", "pt", "es"].includes(i18n.resolvedLanguage ?? "fr")
      ? i18n.resolvedLanguage
      : "fr"
  ) as ReferenceLocale

  const workspaceQuery = useQuery({
    queryKey: ["workspaces", workspaceId, "approach-context"],
    queryFn: () => getWorkspaceApproachContext(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const frameworksQuery = useQuery({
    queryKey: ["reference-frameworks", locale],
    queryFn: () => listReferenceFrameworks(locale),
  })

  const fingerprint = useMemo<ApproachFingerprint | null>(() => {
    const workspace = workspaceQuery.data

    if (!workspace) {
      return null
    }

    const mainFinancier =
      workspace.financiers.find((financier) => financier.principal) ??
      workspace.financiers.at(0)

    return {
      objectType: workspace.objectType,
      financierCode: mainFinancier?.code ?? "OTHER",
      financierCount: workspace.financiers.length,
      themes: workspace.themes,
      stage: workspace.stage,
      startYear: workspace.startYear,
      endYear: workspace.endYear,
      versionLabels: workspace.versions.map((version) => version.label),
    }
  }, [workspaceQuery.data])

  const cycle = fingerprint
    ? computeCycle(fingerprint, currentYear).cycle
    : null
  const criteriaQuery = useQuery({
    queryKey: ["reference-criteria", cycle, locale],
    queryFn: () => listReferenceCriteria(cycle ?? "ex_ante", locale),
    enabled: cycle !== null,
  })

  const approach = useMemo(() => {
    if (
      !fingerprint ||
      !cycle ||
      !frameworksQuery.data?.length ||
      !criteriaQuery.data
    ) {
      return null
    }

    return computeApproach({
      fingerprint,
      questionnaire,
      persona,
      frameworks: frameworksQuery.data,
      criteria: criteriaQuery.data.map((criterion) =>
        toCriterionRule(criterion, cycle)
      ),
      currentYear,
    })
  }, [
    criteriaQuery.data,
    cycle,
    fingerprint,
    frameworksQuery.data,
    persona,
    questionnaire,
  ])
  const confirmation = useMutation({
    mutationFn: async () => {
      if (!approach) {
        throw new Error("The approach has not been computed")
      }

      return saveAndConfirmApproach(workspaceId, locale, approach)
    },
    onSuccess: () => {
      toast.success(t("approach.confirmationSuccess"))
      void navigate(`/workspaces/${workspaceId}/framework/pillars`)
    },
    onError: () => {
      toast.error(t("approach.confirmationError"))
    },
  })

  if (
    workspaceQuery.isPending ||
    frameworksQuery.isPending ||
    criteriaQuery.isPending
  ) {
    return (
      <div className="flex min-h-80 items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        {t("approach.loading")}
      </div>
    )
  }

  if (
    workspaceQuery.isError ||
    frameworksQuery.isError ||
    criteriaQuery.isError ||
    !approach
  ) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border p-8 text-center">
        <AlertTriangle className="mx-auto size-6" />
        <h1 className="mt-4 text-lg font-semibold">{t("approach.error")}</h1>
        <Button
          className="mt-5"
          onClick={() => {
            void workspaceQuery.refetch()
            void frameworksQuery.refetch()
            void criteriaQuery.refetch()
          }}
          variant="outline"
        >
          <RefreshCw />
          {t("approach.retry")}
        </Button>
      </div>
    )
  }

  const referenceCriteria = new Map(
    (criteriaQuery.data ?? []).map((criterion) => [criterion.code, criterion])
  )
  const cards = [
    {
      key: "framework",
      label: t("approach.cards.framework"),
      value: approach.framework.label,
      detail: approach.framework.version,
    },
    {
      key: "cycle",
      label: t("approach.cards.cycle"),
      value: t(`approach.cycles.${approach.cycle}`),
      detail: `${Math.round(approach.cycleProgression * 100)} %`,
    },
    {
      key: "instrument",
      label: t("approach.cards.instrument"),
      value: humanize(approach.instrumentSubtype),
      detail: approach.instrumentModule,
    },
    {
      key: "complexity",
      label: t("approach.cards.complexity"),
      value: t(`approach.complexity.${approach.complexityClass}`),
      detail: `${approach.complexityScore}/10`,
    },
    {
      key: "nature",
      label: t("approach.cards.nature"),
      value: t(`approach.nature.${approach.evaluationNature}`),
      detail: t("approach.deterministic"),
    },
    {
      key: "method",
      label: t("approach.cards.method"),
      value: approach.recommendedMethods.engine.map(humanize).join(", "),
      detail:
        approach.recommendedMethods.off_engine.length > 0
          ? t("approach.externalMethods", {
              count: approach.recommendedMethods.off_engine.length,
            })
          : t("approach.engineOnly"),
    },
  ]
  const justification = approach.justifications[selectedJustification]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("approach.eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {t("approach.title")}
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-6 text-muted-foreground">
            {t("approach.description", {
              workspace: workspaceQuery.data?.name,
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
          <CheckCircle2 className="size-4" />
          {t("approach.recomputed")}
        </div>
      </header>

      <section className="rounded-xl border border-border p-5 sm:p-6">
        <h2 className="text-sm font-semibold">
          {t("approach.questionnaireTitle")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("approach.questionnaireDescription")}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {questionnaireFields.map(([field, options]) => (
            <label className="space-y-2" key={field}>
              <span className="text-xs font-medium">
                {t(`approach.fields.${field}`)}
              </span>
              <select
                className={selectClassName}
                onChange={(event) =>
                  setQuestionnaire((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }))
                }
                value={questionnaire[field]}
              >
                {options.map((option) => (
                  <option key={option} value={option}>
                    {t(`approach.options.${option}`)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      {approach.warnings.length > 0 ? (
        <section className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{t("approach.warnings")}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {approach.warnings.map((warning) => (
                  <li key={warning}>{t(`approach.warningCodes.${warning}`)}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <button
            className={cn(
              "rounded-xl border p-5 text-left transition-colors hover:bg-muted/40",
              selectedJustification === card.key
                ? "border-foreground bg-muted/30"
                : "border-border"
            )}
            key={card.key}
            onClick={() => setSelectedJustification(card.key)}
            type="button"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {card.label}
            </span>
            <span className="mt-3 block text-sm font-semibold capitalize">
              {card.value}
            </span>
            <span className="mt-2 block text-xs text-muted-foreground">
              {card.detail}
            </span>
          </button>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-xl border border-border p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Scale className="size-4" />
            <h2 className="text-sm font-semibold">
              {t("approach.criteriaTitle")}
            </h2>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("approach.criteriaDescription")}
          </p>
          <div className="mt-5 divide-y divide-border">
            {approach.criteria.map((criterion) => (
              <div
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 text-xs"
                key={criterion.code}
              >
                <div>
                  <p className="font-medium">
                    {referenceCriteria.get(criterion.code)?.label ??
                      humanize(criterion.code)}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {t(`approach.applicability.${criterion.applicability}`)} ·{" "}
                    {t(`approach.sources.${criterion.source}`)}
                  </p>
                </div>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${criterion.weight}%` }}
                  />
                </div>
                <span className="w-14 text-right font-semibold">
                  {criterion.weight.toFixed(1)} %
                </span>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-xl border border-border p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("approach.whyTitle")}
          </p>
          <p className="mt-3 text-sm font-semibold">{justification?.rule}</p>
          <pre className="mt-4 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-[11px] leading-5">
            {JSON.stringify(justification?.inputs ?? {}, null, 2)}
          </pre>
        </aside>
      </section>

      <footer className="flex flex-col items-end gap-2 border-t border-border pt-6">
        <Button
          disabled={confirmation.isPending}
          onClick={() => confirmation.mutate()}
          size="lg"
        >
          {confirmation.isPending ? (
            <LoaderCircle className="animate-spin" />
          ) : null}
          {confirmation.isPending
            ? t("approach.confirming")
            : t("approach.confirm")}
          <ArrowRight />
        </Button>
        <p className="text-xs text-muted-foreground">
          {t("approach.confirmationHelp")}
        </p>
      </footer>
    </div>
  )
}
