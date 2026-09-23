import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, BarChart3, FileSearch, ListChecks } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"

import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import { EvidenceDrawer } from "@/features/evaluations/components/evidence-drawer"
import { PillarResultCard } from "@/features/evaluations/components/pillar-result-card"
import { SummaryMetricCard } from "@/features/evaluations/components/summary-metric-card"
import {
  getEvaluationResults,
  listEvidences,
} from "@/features/evaluations/services/evaluation-service"
import { Button } from "@/shared/ui/base/button"
import { Skeleton } from "@/shared/ui/base/skeleton"

export function AnalysisOverviewScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const results = useQuery({
    queryKey: ["evaluation", workspaceId, "results"],
    queryFn: () => getEvaluationResults(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: (query) =>
      ["pending", "running"].includes(query.state.data?.run?.status ?? "")
        ? 5000
        : false,
  })
  const evidences = useQuery({
    queryKey: ["evaluation", workspaceId, "evidences", results.data?.run?.id],
    queryFn: () => listEvidences({ runId: results.data?.run?.id ?? "" }),
    enabled: evidenceOpen && Boolean(results.data?.run?.id),
  })

  if (results.isPending) {
    return (
      <Skeleton className="mx-auto h-[560px] w-full max-w-6xl rounded-xl" />
    )
  }
  const data = results.data
  if (!data?.run) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <CorpusPageHeader
          description={t("evaluation.analysis.description")}
          eyebrow={t("evaluation.eyebrow")}
          title={t("evaluation.analysis.title")}
        />
        <div className="mt-8 flex flex-col items-center rounded-xl border border-border px-6 py-20 text-center">
          <BarChart3 className="size-7 text-muted-foreground" />
          <p className="mt-5 text-base font-semibold">
            {t("evaluation.analysis.noRun")}
          </p>
          <p className="mt-2 max-w-lg text-[13px] leading-5 text-muted-foreground">
            {t("evaluation.analysis.noRunDescription")}
          </p>
          <Button className="mt-6" disabled>
            {t("evaluation.analysis.launch")}
          </Button>
        </div>
      </div>
    )
  }

  if (data.run.status === "pending" || data.run.status === "running") {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <CorpusPageHeader
          description={t("evaluation.analysis.runningDescription")}
          eyebrow={t("evaluation.eyebrow")}
          title={t("evaluation.analysis.running")}
        />
        <div className="mt-8 space-y-3 rounded-xl border border-border p-6">
          {[
            "classification",
            "variables",
            "layerA",
            "layerB",
            "layerC",
            "reporting",
          ].map((step, index) => (
            <div
              className="flex items-center gap-4 border-b border-border py-3 last:border-0"
              key={step}
            >
              <span className="flex size-7 items-center justify-center rounded-full border border-border text-[11px]">
                {index + 1}
              </span>
              <span className="text-sm">
                {t(`evaluation.analysis.steps.${step}`)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const average = data.layerA.length
    ? Math.round(
        data.layerA.reduce((sum, item) => sum + item.score, 0) /
          data.layerA.length
      )
    : 0
  const concluded = data.layerB.filter(
    (item) => item.status === "conclu"
  ).length
  const pendingAlerts = data.alerts.filter(
    (item) => item.status === "a_instruire"
  ).length

  return (
    <div className="mx-auto w-full max-w-6xl">
      <CorpusPageHeader
        description={t("evaluation.analysis.description")}
        eyebrow={t("evaluation.eyebrow")}
        title={t("evaluation.analysis.title")}
      />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard
          description={t("evaluation.analysis.scoreDescription")}
          icon={BarChart3}
          label={t("evaluation.analysis.averageScore")}
          onClick={() =>
            void navigate(`/workspaces/${workspaceId}/analysis/pillars`)
          }
          value={`${average}/100`}
        />
        <SummaryMetricCard
          description={t("evaluation.analysis.criteriaDescription")}
          icon={ListChecks}
          label={t("evaluation.analysis.concludedCriteria")}
          onClick={() =>
            void navigate(`/workspaces/${workspaceId}/analysis/criteria`)
          }
          value={`${concluded}/${data.layerB.length}`}
        />
        <SummaryMetricCard
          description={t("evaluation.analysis.alertsDescription")}
          icon={AlertTriangle}
          label={t("evaluation.analysis.pendingAlerts")}
          onClick={() =>
            void navigate(`/workspaces/${workspaceId}/analysis/alerts`)
          }
          value={String(pendingAlerts)}
        />
        <SummaryMetricCard
          description={t("evaluation.analysis.traceabilityDescription")}
          icon={FileSearch}
          label={t("evaluation.analysis.traceability")}
          onClick={() => setEvidenceOpen(true)}
          value={`${data.traceability}%`}
        />
      </div>
      <div className="mt-8 space-y-3">
        {data.layerA.map((score) => (
          <PillarResultCard
            alertsCount={
              data.alerts.filter(
                (alert) =>
                  alert.pillarId === score.pillarId &&
                  alert.status === "a_instruire"
              ).length
            }
            criteria={data.layerB.filter((note) =>
              score.criterionIds.includes(note.criterionId)
            )}
            key={score.id}
            onAlerts={() =>
              void navigate(`/workspaces/${workspaceId}/analysis/alerts`)
            }
            onCriterion={(criterionId) =>
              void navigate(
                `/workspaces/${workspaceId}/analysis/criteria?criterion=${criterionId}`
              )
            }
            onOpen={() =>
              void navigate(
                `/workspaces/${workspaceId}/analysis/pillars/${score.pillarId}`
              )
            }
            score={score}
          />
        ))}
      </div>
      <p className="mt-8 text-[11px] text-muted-foreground">
        {t("evaluation.analysis.runReference", {
          id: data.run.id.slice(0, 8),
          date: new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(data.run.createdAt)),
        })}
      </p>
      <EvidenceDrawer
        confidence={null}
        evidences={evidences.data ?? []}
        onOpenChange={setEvidenceOpen}
        open={evidenceOpen}
      />
    </div>
  )
}
