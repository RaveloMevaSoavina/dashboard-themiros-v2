import { useQuery } from "@tanstack/react-query"
import { ChevronDown, CircleHelp, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"

import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import { ProgressMeter } from "@/features/evaluations/components/progress-meter"
import { getWorkspaceCriteria } from "@/features/evaluations/services/evaluation-service"
import { Badge } from "@/shared/ui/base/badge"
import { Button } from "@/shared/ui/base/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/base/collapsible"
import { Skeleton } from "@/shared/ui/base/skeleton"

export function FrameworkCriteriaScreen() {
  const { t } = useTranslation()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const criteria = useQuery({
    queryKey: ["evaluation", workspaceId, "criteria"],
    queryFn: () => getWorkspaceCriteria(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const activeQuestions =
    criteria.data?.flatMap((criterion) =>
      criterion.questions.filter((item) => item.active)
    ) ?? []
  const inactiveQuestions =
    criteria.data?.flatMap((criterion) =>
      criterion.questions.filter((item) => !item.active)
    ) ?? []

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
        <Skeleton className="mt-8 h-[520px] rounded-xl" />
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
          <div className="mt-8 space-y-4">
            {criteria.data?.map((criterion) => {
              const active = criterion.questions.filter((item) => item.active)
              return (
                <article
                  className="rounded-xl border border-border p-5"
                  key={criterion.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold">
                          {criterion.name}
                        </h2>
                        <Badge variant="outline">
                          {t(
                            `evaluation.applicability.${criterion.applicability}`
                          )}
                        </Badge>
                      </div>
                      <p className="mt-2 max-w-2xl text-[13px] text-muted-foreground">
                        {criterion.definition}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {Math.round(criterion.weight)}%
                    </span>
                  </div>
                  <ProgressMeter
                    className="mt-4"
                    max={100}
                    value={criterion.weight}
                  />
                  <div className="mt-5 divide-y divide-border border-t border-border">
                    {active.map((question) => (
                      <div
                        className="grid gap-3 py-4 sm:grid-cols-[90px_1fr_180px]"
                        key={question.id}
                      >
                        <div className="flex gap-1.5">
                          <Badge variant="secondary">{question.layer}</Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {question.code.slice(0, 8)}
                          </span>
                        </div>
                        <p className="text-[13px]">{question.text}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {question.expectedEvidence ??
                            t("evaluation.criteria.noExpectedEvidence")}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
          <Collapsible className="mt-5 rounded-xl border border-border">
            <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-sm font-semibold">
              {t("evaluation.criteria.inactive", {
                count: inactiveQuestions.length,
              })}
              <ChevronDown className="size-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border p-4 text-[13px] text-muted-foreground">
              {inactiveQuestions.length === 0
                ? t("evaluation.criteria.noneInactive")
                : inactiveQuestions.map((question) => (
                    <p key={question.id}>{question.text}</p>
                  ))}
            </CollapsibleContent>
          </Collapsible>
          <div className="mt-6 flex justify-end">
            <Button disabled={activeQuestions.length === 0}>
              {t("evaluation.criteria.confirm")}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
