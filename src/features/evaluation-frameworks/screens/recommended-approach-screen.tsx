import { useMutation, useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ListFilter,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/base/sheet"

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

function persistenceErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === "object") {
    const payload = error as Record<string, unknown>
    return [payload.message, payload.details, payload.hint, payload.code]
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0
      )
      .join(" · ")
  }

  return fallback
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
  const [adjustedFields, setAdjustedFields] = useState<
    Set<keyof ApproachQuestionnaire>
  >(new Set())
  const [selectedJustification, setSelectedJustification] =
    useState("framework")
  const [isWhyOpen, setIsWhyOpen] = useState(false)
  const [isContextOpen, setIsContextOpen] = useState(false)
  const [showExcludedCriteria, setShowExcludedCriteria] = useState(false)
  const [showRuleDetails, setShowRuleDetails] = useState(false)
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
      void navigate(`/workspaces/${workspaceId}/approach/generation`)
    },
    onError: (error) => {
      toast.error(t("approach.confirmationError"), {
        description: persistenceErrorMessage(error, t("approach.unknownError")),
      })
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
  const activeCriteria = approach.criteria
    .filter((criterion) => criterion.applicability !== "non_applicable")
    .sort((first, second) => second.weight - first.weight)
  const excludedCriteria = approach.criteria.filter(
    (criterion) => criterion.applicability === "non_applicable"
  )
  const visibleCriteria = showExcludedCriteria
    ? [...activeCriteria, ...excludedCriteria]
    : activeCriteria
  const totalCriteriaWeight = approach.criteria.reduce(
    (total, criterion) => total + criterion.weight,
    0
  )
  const cards = [
    {
      key: "framework",
      label: t("approach.cards.framework"),
      value: approach.framework.label,
      detail: approach.framework.version,
      rationale: t("approach.rationales.framework", {
        financier: fingerprint?.financierCode ?? "OTHER",
      }),
    },
    {
      key: "cycle",
      label: t("approach.cards.cycle"),
      value: t(`approach.cycles.${approach.cycle}`),
      detail: `${Math.round(approach.cycleProgression * 100)} %`,
      rationale: t("approach.rationales.cycle", {
        stage: t(`workspaces.creation.stages.${fingerprint?.stage}`),
        startYear: fingerprint?.startYear,
        endYear: fingerprint?.endYear,
      }),
    },
    {
      key: "instrument",
      label: t("approach.cards.instrument"),
      value: t(`approach.instruments.${approach.instrumentSubtype}`),
      detail: approach.instrumentModule,
      rationale: t("approach.rationales.instrument", {
        scale: t(`approach.options.${questionnaire.scale}`),
        actors: t(`approach.options.${questionnaire.actors}`),
        count: fingerprint?.themes.length ?? 0,
      }),
    },
    {
      key: "complexity",
      label: t("approach.cards.complexity"),
      value: t(`approach.complexity.${approach.complexityClass}`),
      detail: `${approach.complexityScore}/10`,
      rationale: t("approach.rationales.complexity", {
        score: approach.complexityScore,
      }),
    },
    {
      key: "nature",
      label: t("approach.cards.nature"),
      value: t(`approach.nature.${approach.evaluationNature}`),
      detail: t("approach.deterministic"),
      rationale: t("approach.rationales.nature", {
        relation: t(`approach.options.${questionnaire.relation}`),
      }),
    },
    {
      key: "method",
      label: t("approach.cards.method"),
      value: approach.recommendedMethods.engine
        .map((method) =>
          t(`approach.methods.${method}`, { defaultValue: humanize(method) })
        )
        .join(", "),
      detail:
        approach.recommendedMethods.off_engine.length > 0
          ? t("approach.externalMethods", {
              count: approach.recommendedMethods.off_engine.length,
            })
          : t("approach.engineOnly"),
      rationale: t("approach.rationales.method", {
        complexity: t(
          `approach.complexity.${approach.complexityClass}`
        ).toLocaleLowerCase(),
        cycle: t(`approach.cycles.${approach.cycle}`).toLocaleLowerCase(),
      }),
    },
  ]
  const justification = approach.justifications[selectedJustification]
  const selectedCard = cards.find((card) => card.key === selectedJustification)

  function formatInputValue(key: string, value: unknown) {
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

    if (
      [
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
      ].includes(value)
    ) {
      return t(`approach.options.${value}`)
    }

    if (cycleValues.includes(value as EvaluationCycle)) {
      return t(`approach.cycles.${value}`)
    }

    if (["simple", "complique", "complexe"].includes(value)) {
      return t(`approach.complexity.${value}`)
    }

    if (
      [
        "design",
        "pre_launch",
        "implementation",
        "mid_term",
        "closing",
        "post_closure",
        "cross_cutting",
      ].includes(value)
    ) {
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

  function wasCardRecomputed(key: string) {
    const dependencies: Record<string, (keyof ApproachQuestionnaire)[]> = {
      framework: [],
      cycle: [],
      instrument: ["scale", "actors"],
      complexity: ["scale", "actors", "budget"],
      nature: ["relation"],
      method: [
        "scale",
        "actors",
        "budget",
        "baseline",
        "comparisonGroup",
        "monitoringData",
        "purpose",
      ],
    }

    return (dependencies[key] ?? []).some((field) => adjustedFields.has(field))
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("approach.eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {t("approach.title")}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            {t("approach.description", {
              workspace: workspaceQuery.data?.name,
            })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
          <CheckCircle2 className="size-4" />
          {t("approach.recomputed")}
        </div>
      </header>

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

      <section>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="mt-2 text-lg font-semibold">
              {t("approach.recommendationsTitle")}
            </h2>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
              {t("approach.recommendationsDescription")}
            </p>
          </div>
          <Button
            className="shrink-0"
            onClick={() => {
              setIsWhyOpen(false)
              setIsContextOpen(true)
            }}
            variant="outline"
          >
            <ListFilter />
            {t("approach.contextFilter")}
            {adjustedFields.size > 0 ? (
              <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[10px] leading-none text-background">
                {adjustedFields.size}
              </span>
            ) : null}
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <button
              aria-pressed={isWhyOpen && selectedJustification === card.key}
              className={cn(
                "group flex min-h-48 flex-col rounded-xl border p-5 text-left transition-colors hover:bg-muted/40",
                isWhyOpen && selectedJustification === card.key
                  ? "border-foreground bg-muted/30"
                  : "border-border"
              )}
              key={card.key}
              onClick={() => {
                setIsContextOpen(false)
                setSelectedJustification(card.key)
                setShowRuleDetails(false)
                setIsWhyOpen(true)
              }}
              type="button"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {wasCardRecomputed(card.key)
                    ? t("approach.recalculated")
                    : t("approach.recommended")}
                </span>
              </span>
              <span className="mt-4 block text-base font-semibold first-letter:uppercase">
                {card.value}
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {card.detail}
              </span>
              <span className="mt-auto block border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
                {card.rationale}
              </span>
              <span className="mt-3 text-[11px] font-medium underline-offset-4 group-hover:underline">
                {t("approach.seeWhy")}
              </span>
            </button>
          ))}
        </div>
      </section>

      <Sheet onOpenChange={setIsWhyOpen} open={isWhyOpen}>
        <SheetContent className="w-full sm:max-w-lg!">
          <SheetHeader className="border-b border-border pr-12">
            <SheetTitle>{t("approach.whyTitle")}</SheetTitle>
            <SheetDescription>{selectedCard?.label}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 pb-8 sm:px-6">
            <div className="border-b border-border py-6">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("approach.recommendationRationale")}
              </p>
              <p className="mt-3 text-sm leading-6">
                {selectedCard?.rationale}
              </p>
              <button
                aria-expanded={showRuleDetails}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                onClick={() => setShowRuleDetails((current) => !current)}
                type="button"
              >
                {t("approach.ruleApplied", { rule: justification?.rule })}
                <ChevronDown
                  className={cn(
                    "size-3 transition-transform",
                    showRuleDetails && "rotate-180"
                  )}
                />
              </button>

              {showRuleDetails ? (
                <div className="mt-4 rounded-lg border border-amber-400/60 bg-amber-300/20 p-4 text-amber-950 shadow-[0_0_24px_rgba(251,191,36,0.16)] dark:text-amber-100">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                    {t("approach.ruleExplanation")}
                  </p>
                  <p className="mt-2 text-xs leading-5">
                    {t(`approach.ruleDescriptions.${selectedJustification}`)}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="py-6">
              <p className="text-xs font-semibold">
                {t("approach.inputsUsed")}
              </p>
              <dl className="mt-4 divide-y divide-border">
                {Object.entries(justification?.inputs ?? {}).map(
                  ([key, value]) => (
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
                        {formatInputValue(key, value)}
                      </dd>
                    </div>
                  )
                )}
              </dl>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet onOpenChange={setIsContextOpen} open={isContextOpen}>
        <SheetContent className="w-full sm:max-w-md!">
          <SheetHeader className="border-b border-border pr-12">
            <SheetTitle className="flex items-center gap-2">
              <ListFilter className="size-4" />
              {t("approach.questionnaireTitle")}
            </SheetTitle>
            <SheetDescription>
              {t("approach.questionnaireDescription")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 pb-6 sm:px-6">
            <div className="flex items-center gap-2 border-b border-border py-4 text-[11px] text-muted-foreground">
              <CheckCircle2 className="size-3.5" />
              {t("approach.liveUpdate")}
            </div>

            <div className="grid gap-5 py-5">
              {questionnaireFields.map(([field, options]) => (
                <label className="space-y-2" key={field}>
                  <span className="flex items-center justify-between gap-2 text-xs font-medium">
                    {t(`approach.fields.${field}`)}
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {adjustedFields.has(field)
                        ? t("approach.adjusted")
                        : t("approach.proposed")}
                    </span>
                  </span>
                  <select
                    className={selectClassName}
                    onChange={(event) => {
                      setQuestionnaire((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                      setAdjustedFields((current) => {
                        const next = new Set(current)
                        next.add(field)
                        return next
                      })
                    }}
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
          </div>

          <div className="border-t border-border p-4">
            <Button className="w-full" onClick={() => setIsContextOpen(false)}>
              {t("approach.viewRecommendations")}
              <ArrowRight />
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <section className="rounded-xl border border-border p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border">
              <Scale className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">
                {t("approach.criteriaTitle")}
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                {t("approach.criteriaDescription")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-border px-2.5 py-1">
              {t("approach.activeCriteria", { count: activeCriteria.length })}
            </span>
            <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
              {t("approach.totalWeight", {
                weight: totalCriteriaWeight.toFixed(0),
              })}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCriteria.map((criterion) => {
            const isNotApplicable = criterion.applicability === "non_applicable"

            return (
              <article
                className={cn(
                  "flex min-h-44 flex-col rounded-lg border border-border p-4",
                  isNotApplicable && "bg-muted/20 text-muted-foreground"
                )}
                key={criterion.code}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold">
                    {referenceCriteria.get(criterion.code)?.label ??
                      humanize(criterion.code)}
                  </h3>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      criterion.applicability === "obligatoire" &&
                        "border-foreground bg-foreground text-background",
                      criterion.applicability === "prospectif" &&
                        "border-dashed"
                    )}
                  >
                    {t(`approach.applicability.${criterion.applicability}`)}
                  </span>
                </div>

                <p className="mt-2 text-[11px] text-muted-foreground">
                  {t("approach.criterionSource", {
                    source: t(`approach.sources.${criterion.source}`),
                  })}
                </p>

                <div className="mt-auto pt-6">
                  <div className="flex items-end justify-between gap-3">
                    <span className="text-[11px] text-muted-foreground">
                      {t("approach.weightLabel")}
                    </span>
                    <span className="text-lg font-semibold tracking-tight">
                      {criterion.weight.toFixed(1)} %
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full bg-foreground",
                        isNotApplicable && "bg-muted-foreground/30"
                      )}
                      style={{ width: `${criterion.weight}%` }}
                    />
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {excludedCriteria.length > 0 ? (
          <div className="mt-4 border-t border-border pt-4">
            <Button
              aria-expanded={showExcludedCriteria}
              className="w-full justify-between sm:w-auto"
              onClick={() => setShowExcludedCriteria((current) => !current)}
              variant="ghost"
            >
              {showExcludedCriteria
                ? t("approach.hideExcludedCriteria")
                : t("approach.showExcludedCriteria", {
                    count: excludedCriteria.length,
                  })}
              <ChevronDown
                className={cn(
                  "transition-transform",
                  showExcludedCriteria && "rotate-180"
                )}
              />
            </Button>
          </div>
        ) : null}
      </section>

      <footer className="flex flex-col justify-between gap-5 border-t border-border pt-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold">{t("approach.readyTitle")}</p>
          <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
            {t("approach.confirmationHelp")}
          </p>
        </div>
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
      </footer>
    </div>
  )
}
