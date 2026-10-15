import { useQuery } from "@tanstack/react-query"
import { ChevronDown, CircleHelp, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"

import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import { ProgressMeter } from "@/features/evaluations/components/progress-meter"
import type { EvaluationCriterion } from "@/features/evaluations/model/types"
import { getWorkspaceCriteria } from "@/features/evaluations/services/evaluation-service"
import { Badge } from "@/shared/ui/base/badge"
import { Button } from "@/shared/ui/base/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/base/collapsible"
import { Skeleton } from "@/shared/ui/base/skeleton"

/** Colonnes partagees par l'en-tete et les lignes de questions. */
const questionGrid =
  "grid gap-x-6 gap-y-1.5 sm:grid-cols-[40px_minmax(0,1.4fr)_minmax(0,1fr)]"

function CriterionCard({ criterion }: { criterion: EvaluationCriterion }) {
  const { t } = useTranslation()
  const active = criterion.questions.filter((item) => item.active)

  return (
    <Collapsible asChild defaultOpen>
      <article className="rounded-xl border border-border">
        <CollapsibleTrigger className="group flex w-full items-start gap-4 p-5 text-left">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{criterion.name}</h2>
              <Badge variant="outline">
                {t(`evaluation.applicability.${criterion.applicability}`)}
              </Badge>
            </div>
            <p className="mt-2 max-w-3xl text-[13px] leading-5 text-muted-foreground">
              {criterion.definition}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <div className="hidden w-32 sm:block">
              <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                <span>{t("evaluation.criteria.weight")}</span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {Math.round(criterion.weight)}%
                </span>
              </div>
              <ProgressMeter
                className="mt-1.5"
                label={t("evaluation.criteria.weight")}
                max={100}
                value={criterion.weight}
              />
            </div>
            <span className="text-sm font-semibold tabular-nums sm:hidden">
              {Math.round(criterion.weight)}%
            </span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t border-border px-5 pb-2">
          {active.length === 0 ? (
            <p className="py-4 text-[13px] text-muted-foreground">
              {t("evaluation.criteria.noActiveQuestions")}
            </p>
          ) : (
            <>
              <div
                className={`${questionGrid} hidden py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:grid`}
              >
                <span>#</span>
                <span>{t("evaluation.criteria.question")}</span>
                <span>{t("evaluation.criteria.expectedEvidence")}</span>
              </div>
              <ol className="divide-y divide-border border-border sm:border-t">
                {active.map((question, index) => (
                  <li className={`${questionGrid} py-3.5`} key={question.id}>
                    <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
                      Q{index + 1}
                    </span>
                    <p className="text-[13px] leading-5">{question.text}</p>
                    <p className="text-[12px] leading-5 text-muted-foreground">
                      <span className="font-medium sm:hidden">
                        {t("evaluation.criteria.expectedEvidence")} :{" "}
                      </span>
                      {question.expectedEvidence ??
                        t("evaluation.criteria.noExpectedEvidence")}
                    </p>
                  </li>
                ))}
              </ol>
            </>
          )}
        </CollapsibleContent>
      </article>
    </Collapsible>
  )
}

export function FrameworkCriteriaScreen() {
  const { t } = useTranslation()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const criteria = useQuery({
    queryKey: ["evaluation", workspaceId, "criteria"],
    queryFn: () => getWorkspaceCriteria(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const activeCount =
    criteria.data?.reduce(
      (sum, criterion) =>
        sum + criterion.questions.filter((item) => item.active).length,
      0
    ) ?? 0
  /* Questions ecartees, regroupees par critere pour garder leur contexte. */
  const inactiveGroups =
    criteria.data
      ?.map((criterion) => ({
        criterion,
        questions: criterion.questions.filter((item) => !item.active),
      }))
      .filter((group) => group.questions.length > 0) ?? []
  const inactiveCount = inactiveGroups.reduce(
    (sum, group) => sum + group.questions.length,
    0
  )

  return (
    <div className="mx-auto w-full max-w-5xl">
      <CorpusPageHeader
        action={
          <Button disabled>
            <Plus /> {t("evaluation.criteria.addQuestion")}
          </Button>
        }
        description={t("evaluation.criteria.description")}
        eyebrow={t("evaluation.eyebrow")}
        title={t("evaluation.criteria.title")}
      />
      {criteria.isPending ? (
        <div className="mt-8 space-y-4">
          {["a", "b", "c"].map((key) => (
            <Skeleton className="h-[220px] rounded-xl" key={key} />
          ))}
        </div>
      ) : (criteria.data?.length ?? 0) === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-xl border border-border px-6 py-16 text-center">
          <CircleHelp className="size-7 text-muted-foreground" />
          <p className="mt-4 text-sm font-semibold">
            {t("evaluation.criteria.empty")}
          </p>
          <p className="mt-2 max-w-lg text-[13px] text-muted-foreground">
            {t("evaluation.criteria.emptyDescription")}
          </p>
        </div>
      ) : (
        <>
          <p className="mt-8 text-[13px] text-muted-foreground">
            {t("evaluation.criteria.summary", {
              criteria: criteria.data?.length ?? 0,
              questions: activeCount,
            })}
          </p>
          <div className="mt-3 space-y-4">
            {criteria.data?.map((criterion) => (
              <CriterionCard criterion={criterion} key={criterion.id} />
            ))}
          </div>

          <Collapsible className="mt-5 rounded-xl border border-border">
            <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-sm font-semibold">
              {t("evaluation.criteria.inactive", { count: inactiveCount })}
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border p-4">
              {inactiveCount === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  {t("evaluation.criteria.noneInactive")}
                </p>
              ) : (
                <div className="space-y-4">
                  {inactiveGroups.map(({ criterion, questions }) => (
                    <section key={criterion.id}>
                      <h3 className="text-[12px] font-semibold text-muted-foreground">
                        {criterion.name}
                      </h3>
                      <ul className="mt-1.5 space-y-1.5 text-[13px] leading-5 text-muted-foreground">
                        {questions.map((question) => (
                          <li key={question.id}>{question.text}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="mt-6 flex justify-end">
            <Button disabled={activeCount === 0}>
              {t("evaluation.criteria.confirm")}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
