import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, BarChart3, FileSearch, ListChecks } from "lucide-react"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import {
  CriteriaCoveragePanel,
  PriorityPillarsPanel,
} from "@/features/evaluations/components/analysis-insights"
import {
  AnalysisPage,
  PageSection,
} from "@/features/evaluations/components/analysis-layout"
import { EvidenceDrawer } from "@/features/evaluations/components/evidence-drawer"
import {
  PillarLayoutToggle,
  pillarGridClassName,
  usePillarLayout,
} from "@/features/evaluations/components/pillar-layout-toggle"
import {
  PillarResultCard,
  UnscoredPillarCard,
} from "@/features/evaluations/components/pillar-result-card"
import { SummaryMetricCard } from "@/features/evaluations/components/summary-metric-card"
import {
  getEvaluationResults,
  getWorkspacePillars,
  listEvidences,
} from "@/features/evaluations/services/evaluation-service"
import { Button } from "@/shared/ui/base/button"
import { Skeleton } from "@/shared/ui/base/skeleton"

export function AnalysisOverviewScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [layout, changeLayout] = usePillarLayout()
  const analysisPath = `/workspaces/${workspaceId}/analysis`
  const results = useQuery({
    queryKey: ["evaluation", workspaceId, "results"],
    queryFn: () => getEvaluationResults(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: (query) =>
      ["pending", "running"].includes(query.state.data?.run?.status ?? "")
        ? 5000
        : false,
  })
  /* Meme cle que l'ecran du cadre : les piliers sont partages en cache. */
  const pillars = useQuery({
    queryKey: ["evaluation", workspaceId, "pillars"],
    queryFn: () => getWorkspacePillars(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const evidences = useQuery({
    queryKey: ["evaluation", workspaceId, "evidences", results.data?.run?.id],
    queryFn: () => listEvidences({ runId: results.data?.run?.id ?? "" }),
    enabled: evidenceOpen && Boolean(results.data?.run?.id),
  })

  if (results.isPending || pillars.isPending) {
    return (
      <Skeleton className="mx-auto h-[560px] w-full max-w-6xl rounded-xl" />
    )
  }
  const data = results.data
  const unscoredPillars = pillars.data ?? []
  const descriptionOf = (pillarId: string) =>
    unscoredPillars.find((pillar) => pillar.id === pillarId)?.description
  const pillarSection = (cards: ReactNode) => (
    <PageSection
      action={<PillarLayoutToggle onChange={changeLayout} value={layout} />}
      description={t("evaluation.analysis.pillarsDescription")}
      title={t("evaluation.layerA.title")}
    >
      <div className={pillarGridClassName(layout)}>{cards}</div>
    </PageSection>
  )
  /* Le lancement d'un run n'est pas encore branche cote backend. */
  const notifyLaunchSoon = () => toast.info(t("evaluation.analysis.launchSoon"))
  const unscoredGrid = pillarSection(
    unscoredPillars.map((pillar) => (
      <UnscoredPillarCard key={pillar.id} layout={layout} pillar={pillar} />
    ))
  )
  const header = {
    description: t("evaluation.analysis.description"),
    eyebrow: t("evaluation.eyebrow"),
    title: t("evaluation.analysis.title"),
  }
  if (!data?.run) {
    return (
      <AnalysisPage {...header}>
        {unscoredPillars.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border p-5">
              <BarChart3 className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {t("evaluation.analysis.noRun")}
                </p>
                <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                  {t("evaluation.analysis.noRunDescription")}
                </p>
              </div>
              <Button onClick={notifyLaunchSoon}>
                {t("evaluation.analysis.launch")}
              </Button>
            </div>
            {unscoredGrid}
          </>
        ) : (
          <div className="flex flex-col items-center rounded-xl border border-border px-6 py-20 text-center">
            <BarChart3 className="size-7 text-muted-foreground" />
            <p className="mt-5 text-base font-semibold">
              {t("evaluation.analysis.noRun")}
            </p>
            <p className="mt-2 max-w-lg text-[13px] leading-5 text-muted-foreground">
              {t("evaluation.analysis.noRunDescription")}
            </p>
            <Button className="mt-6" onClick={notifyLaunchSoon}>
              {t("evaluation.analysis.launch")}
            </Button>
          </div>
        )}
      </AnalysisPage>
    )
  }

  if (data.run.status === "pending" || data.run.status === "running") {
    return (
      <AnalysisPage
        description={t("evaluation.analysis.runningDescription")}
        eyebrow={t("evaluation.eyebrow")}
        title={t("evaluation.analysis.running")}
      >
        <div className="divide-y divide-border rounded-xl border border-border">
          {[
            "classification",
            "variables",
            "layerA",
            "layerB",
            "layerC",
            "reporting",
          ].map((step, index) => (
            <div className="flex items-center gap-4 px-5 py-4" key={step}>
              <span className="flex size-7 items-center justify-center rounded-full border border-border text-[11px]">
                {index + 1}
              </span>
              <span className="text-sm">
                {t(`evaluation.analysis.steps.${step}`)}
              </span>
            </div>
          ))}
        </div>
      </AnalysisPage>
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

  /* Pyramide inversee : indicateurs cles, puis les piliers, puis les
     lectures transversales qui orientent vers le detail. */
  return (
    <AnalysisPage
      {...header}
      actions={
        <p className="text-[11px] text-muted-foreground">
          {t("evaluation.analysis.runReference", {
            id: data.run.id.slice(0, 8),
            date: new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(data.run.createdAt)),
          })}
        </p>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard
          description={t("evaluation.analysis.scoreDescription")}
          icon={BarChart3}
          label={t("evaluation.analysis.averageScore")}
          onClick={() => void navigate(`${analysisPath}/pillars`)}
          value={`${average}/100`}
        />
        <SummaryMetricCard
          description={t("evaluation.analysis.criteriaDescription")}
          icon={ListChecks}
          label={t("evaluation.analysis.concludedCriteria")}
          onClick={() => void navigate(`${analysisPath}/criteria`)}
          value={`${concluded}/${data.layerB.length}`}
        />
        <SummaryMetricCard
          description={t("evaluation.analysis.alertsDescription")}
          icon={AlertTriangle}
          label={t("evaluation.analysis.pendingAlerts")}
          onClick={() => void navigate(`${analysisPath}/alerts`)}
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
      {data.layerA.length === 0
        ? unscoredGrid
        : pillarSection(
            data.layerA.map((score) => (
              <PillarResultCard
                alertsCount={
                  data.alerts.filter(
                    (alert) =>
                      alert.pillarId === score.pillarId &&
                      alert.status === "a_instruire"
                  ).length
                }
                description={descriptionOf(score.pillarId)}
                key={score.id}
                layout={layout}
                onAlerts={() =>
                  void navigate(
                    `${analysisPath}/alerts?pillar=${score.pillarId}`
                  )
                }
                onOpen={() =>
                  void navigate(`${analysisPath}/pillars/${score.pillarId}`)
                }
                score={score}
              />
            ))
          )}
      {data.layerA.length > 0 ? (
        <div className="grid items-stretch gap-x-6 gap-y-10 lg:grid-cols-2">
          <PriorityPillarsPanel
            notes={data.layerB}
            onOpenPillar={(pillarId) =>
              void navigate(`${analysisPath}/pillars/${pillarId}`)
            }
            scores={data.layerA}
          />
          <CriteriaCoveragePanel
            notes={data.layerB}
            onOpenCriterion={(criterionId) =>
              void navigate(`${analysisPath}/criteria?criterion=${criterionId}`)
            }
          />
        </div>
      ) : null}
      <EvidenceDrawer
        confidence={null}
        evidences={evidences.data ?? []}
        onOpenChange={setEvidenceOpen}
        open={evidenceOpen}
      />
    </AnalysisPage>
  )
}
