import { useQuery } from "@tanstack/react-query"
import { AlertCircle, ArrowRight, FileText, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"

import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import { RecommendedMethodsSummary } from "@/features/evaluation-frameworks/components/recommended-methods"
import type { ReferenceLocale } from "@/features/evaluation-frameworks/model/types"
import {
  getLatestWorkspaceApproach,
  listApproachCriteria,
} from "@/features/evaluation-frameworks/services/approach-service"
import {
  listReferenceCriteria,
  listReferenceFrameworks,
} from "@/features/evaluation-frameworks/services/reference-service"
import { ProgressMeter } from "@/features/evaluations/components/progress-meter"
import { Badge } from "@/shared/ui/base/badge"
import { Button } from "@/shared/ui/base/button"
import { Skeleton } from "@/shared/ui/base/skeleton"

const questionnaireFields = [
  "scale",
  "actors",
  "budget",
  "baseline",
  "comparisonGroup",
  "monitoringData",
  "relation",
  "purpose",
] as const

function humanize(value: string) {
  return value.replaceAll("_", " ")
}

/**
 * Brief du cadre : relecture de l'approche retenue pour l'espace (derniere
 * version enregistree), avec les criteres et ponderations qui en decoulent.
 */
export function FrameworkBriefScreen() {
  const { i18n, t } = useTranslation()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const locale = (
    ["fr", "en", "pt", "es"].includes(i18n.resolvedLanguage ?? "fr")
      ? i18n.resolvedLanguage
      : "fr"
  ) as ReferenceLocale

  const approachQuery = useQuery({
    queryKey: ["approaches", workspaceId, "latest"],
    queryFn: () => getLatestWorkspaceApproach(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const approach = approachQuery.data ?? null
  const criteriaQuery = useQuery({
    queryKey: ["approaches", approach?.id, "criteria"],
    queryFn: () => listApproachCriteria(approach?.id ?? ""),
    enabled: Boolean(approach),
  })
  const frameworksQuery = useQuery({
    queryKey: ["reference-frameworks", locale],
    queryFn: () => listReferenceFrameworks(locale),
    enabled: Boolean(approach),
  })
  const referenceCriteriaQuery = useQuery({
    queryKey: ["reference-criteria", approach?.cycle, locale],
    queryFn: () => listReferenceCriteria(approach?.cycle ?? "ex_ante", locale),
    enabled: Boolean(approach),
  })

  const isPending =
    approachQuery.isPending ||
    (approach !== null &&
      (criteriaQuery.isPending ||
        frameworksQuery.isPending ||
        referenceCriteriaQuery.isPending))
  const isError =
    approachQuery.isError ||
    criteriaQuery.isError ||
    frameworksQuery.isError ||
    referenceCriteriaQuery.isError

  const header = (
    <CorpusPageHeader
      action={
        approach ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {t("evaluation.brief.version", { version: approach.version })}
            </Badge>
            <Badge
              variant={approach.status === "confirmed" ? "default" : "outline"}
            >
              {t(`evaluation.brief.status.${approach.status}`)}
            </Badge>
          </div>
        ) : undefined
      }
      description={t("evaluation.brief.description")}
      eyebrow={t("evaluation.eyebrow")}
      title={t("evaluation.brief.title")}
    />
  )

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        {header}
        <Skeleton className="mt-8 h-[520px] rounded-xl" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        {header}
        <div className="mt-8 flex flex-col items-center rounded-xl border border-border px-6 py-16 text-center">
          <AlertCircle className="size-7 text-muted-foreground" />
          <p className="mt-4 text-sm font-semibold">
            {t("evaluation.loadError")}
          </p>
          <Button
            className="mt-5"
            onClick={() => {
              void approachQuery.refetch()
              void criteriaQuery.refetch()
              void frameworksQuery.refetch()
              void referenceCriteriaQuery.refetch()
            }}
            variant="outline"
          >
            <RefreshCw />
            {t("approach.retry")}
          </Button>
        </div>
      </div>
    )
  }

  if (!approach) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        {header}
        <div className="mt-8 flex flex-col items-center rounded-xl border border-border px-6 py-16 text-center">
          <FileText className="size-7 text-muted-foreground" />
          <p className="mt-4 text-sm font-semibold">
            {t("evaluation.brief.empty")}
          </p>
          <p className="mt-2 max-w-lg text-[13px] text-muted-foreground">
            {t("evaluation.brief.emptyDescription")}
          </p>
          <Button asChild className="mt-5">
            <Link to={`/workspaces/${workspaceId}/approach`}>
              {t("evaluation.brief.configure")}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const framework = frameworksQuery.data?.find(
    (item) => item.id === approach.ref_framework_id
  )
  const referenceCriteria = new Map(
    (referenceCriteriaQuery.data ?? []).map((criterion) => [
      criterion.id,
      criterion,
    ])
  )
  const activeCriteria = (criteriaQuery.data ?? [])
    .filter((criterion) => criterion.applicability !== "non_applicable")
    .sort((first, second) => Number(second.weight) - Number(first.weight))
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "long" })

  const cards = [
    {
      key: "framework",
      value: framework?.label ?? humanize(approach.ref_framework_id),
      detail: framework?.version,
    },
    {
      key: "cycle",
      value: t(`approach.cycles.${approach.cycle}`),
    },
    {
      key: "instrument",
      value: t(`approach.instruments.${approach.instrument_subtype}`, {
        defaultValue: humanize(approach.instrument_subtype),
      }),
      detail: approach.instrument_module,
    },
    {
      key: "complexity",
      value: t(`approach.complexity.${approach.complexity_class}`),
      detail: `${approach.complexity_score}/10`,
    },
    {
      key: "nature",
      value: t(`approach.nature.${approach.evaluation_nature}`),
    },
  ]
  const answers = questionnaireFields.filter(
    (field) => typeof approach.questionnaire_answers[field] === "string"
  )

  return (
    <div className="mx-auto w-full max-w-5xl">
      {header}

      <p className="mt-4 text-[12px] text-muted-foreground">
        {approach.confirmed_at
          ? t("evaluation.brief.confirmedAt", {
              date: dateFormatter.format(new Date(approach.confirmed_at)),
            })
          : t("evaluation.brief.updatedAt", {
              date: dateFormatter.format(new Date(approach.updated_at)),
            })}
      </p>

      <section className="mt-8">
        <h2 className="text-base font-semibold">
          {t("evaluation.brief.approachTitle")}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <article
              className="flex flex-col rounded-xl border border-border p-5"
              key={card.key}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`approach.cards.${card.key}`)}
              </span>
              <span className="mt-3 text-sm font-semibold first-letter:uppercase">
                {card.value}
              </span>
              {card.detail ? (
                <span className="mt-1 text-[12px] text-muted-foreground">
                  {card.detail}
                </span>
              ) : null}
            </article>
          ))}
          <article className="flex flex-col rounded-xl border border-border p-5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("approach.cards.method")}
            </span>
            <RecommendedMethodsSummary
              className="mt-3"
              cycle={approach.cycle}
              methods={approach.recommended_methods}
            />
          </article>
        </div>
      </section>

      {answers.length > 0 ? (
        <section className="mt-8 rounded-xl border border-border p-5">
          <h2 className="text-base font-semibold">
            {t("approach.questionnaireTitle")}
          </h2>
          <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
            {answers.map((field) => (
              <div
                className="flex justify-between gap-6 border-b border-border py-3 text-[13px]"
                key={field}
              >
                <dt className="text-muted-foreground">
                  {t(`approach.fields.${field}`)}
                </dt>
                <dd className="text-right font-medium">
                  {t(
                    `approach.options.${String(approach.questionnaire_answers[field])}`
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-base font-semibold">
            {t("evaluation.brief.criteriaTitle")}
          </h2>
          <span className="text-[12px] text-muted-foreground">
            {t("approach.activeCriteria", { count: activeCriteria.length })}
          </span>
        </div>
        <div className="mt-4 divide-y divide-border rounded-xl border border-border">
          {activeCriteria.map((criterion) => {
            const reference = referenceCriteria.get(criterion.ref_criterion_id)
            const weight = Number(criterion.weight)

            return (
              <div className="p-4" key={criterion.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">
                      {reference?.label ?? humanize(criterion.ref_criterion_id)}
                    </span>
                    <Badge variant="outline">
                      {t(`evaluation.applicability.${criterion.applicability}`)}
                    </Badge>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {weight.toFixed(1)} %
                  </span>
                </div>
                <ProgressMeter className="mt-3" max={100} value={weight} />
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
