import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, BarChart3, FileSearch, ListChecks } from "lucide-react"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"

import {
  CriteriaCoveragePanel,
  PriorityPillarsPanel,
} from "@/features/evaluations/components/analysis-insights"
import {
  AnalysisPage,
  PageSection,
} from "@/features/evaluations/components/analysis-layout"
import { EvidenceDrawer } from "@/features/evaluations/components/evidence-drawer"
import { LaunchAnalysisButton } from "@/features/evaluations/components/launch-analysis-button"
import {
  PillarLayoutToggle,
  pillarGridClassName,
  usePillarLayout,
} from "@/features/evaluations/components/pillar-layout-toggle"
import {
  PillarResultCard,
  UnscoredPillarCard,
} from "@/features/evaluations/components/pillar-result-card"
import { RunNotices } from "@/features/evaluations/components/run-notices"
import { RunProgress } from "@/features/evaluations/components/run-progress"
import { RunValidationMention } from "@/features/evaluations/components/run-validation"
import { isRunActive } from "@/features/evaluations/components/run-watcher"
import { StaleResult } from "@/features/evaluations/components/stale-result"
import { SummaryMetricCard } from "@/features/evaluations/components/summary-metric-card"
import {
  averageScore,
  latestVersionScores,
} from "@/features/evaluations/model/layer-a"
import type { AnalysisRun } from "@/features/evaluations/model/types"
import {
  getEvaluationResults,
  getWorkspacePillars,
  listEvidences,
  listRunSteps,
} from "@/features/evaluations/services/evaluation-service"
import { Skeleton } from "@/shared/ui/base/skeleton"

function RunReference({ run }: { run: AnalysisRun }) {
  const { t } = useTranslation()
  return (
    <p className="text-[11px] text-muted-foreground">
      {t("evaluation.analysis.runReference", {
        id: run.id.slice(0, 8),
        date: new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(run.createdAt)),
      })}
    </p>
  )
}

/** Écrans 12 à 14 : lancement, suivi du run, puis comparatif général. */
export function AnalysisOverviewScreen() {
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [layout, changeLayout] = usePillarLayout()
  const analysisPath = `/workspaces/${workspaceId}/analysis`
  const results = useQuery({
    queryKey: ["evaluation", workspaceId, "results", i18n.resolvedLanguage],
    queryFn: () =>
      getEvaluationResults(workspaceId, i18n.resolvedLanguage ?? "fr"),
    enabled: Boolean(workspaceId),
    refetchInterval: (query) =>
      isRunActive(query.state.data?.latestRun) ? 5000 : false,
  })
  const activeRun = isRunActive(results.data?.latestRun)
    ? (results.data?.latestRun ?? null)
    : null
  const steps = useQuery({
    queryKey: ["evaluation", workspaceId, "steps", activeRun?.id],
    queryFn: () => listRunSteps(activeRun?.id ?? ""),
    enabled: Boolean(activeRun),
    refetchInterval: 3000,
  })
  /* Meme cle que l'ecran du cadre : les piliers sont partages en cache. */
  const pillars = useQuery({
    queryKey: ["evaluation", workspaceId, "pillars", i18n.resolvedLanguage],
    queryFn: () =>
      getWorkspacePillars(workspaceId, i18n.resolvedLanguage ?? "fr"),
    enabled: Boolean(workspaceId),
  })
  const evidences = useQuery({
    queryKey: [
      "evaluation",
      workspaceId,
      "evidences",
      results.data?.run?.id,
      i18n.resolvedLanguage,
    ],
    queryFn: () =>
      listEvidences(
        { runId: results.data?.run?.id ?? "" },
        i18n.resolvedLanguage ?? "fr"
      ),
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
  const notices = (
    <RunNotices
      corpusChanged={data?.corpusChanged ?? false}
      latestRun={data?.latestRun ?? null}
      run={data?.run ?? null}
      workspaceId={workspaceId}
    />
  )

  /* US-13.1 à 13.3 : le suivi reste intact si l'on navigue puis revient. */
  if (activeRun) {
    return (
      <AnalysisPage
        actions={<RunReference run={activeRun} />}
        description={t("evaluation.analysis.runningDescription")}
        eyebrow={t("evaluation.eyebrow")}
        title={t("evaluation.analysis.running")}
      >
        <RunProgress steps={steps.data ?? []} />
      </AnalysisPage>
    )
  }

  if (!data?.run) {
    const launch = <LaunchAnalysisButton workspaceId={workspaceId} />
    return (
      <AnalysisPage {...header} banner={notices}>
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
              {launch}
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
            <div className="mt-6">{launch}</div>
          </div>
        )}
      </AnalysisPage>
    )
  }

  const scores = latestVersionScores(data.layerA)
  const average = averageScore(scores)
  const concluded = data.layerB.filter(
    (item) => item.status === "conclu"
  ).length
  const pendingAlerts = data.alerts.filter(
    (item) => item.status === "a_instruire"
  ).length
  const comingSoon = t("evaluation.run.comingSoon")
  /* CA-6.2 : calculés sur un corpus qui n'existe plus, les résultats sont
     désactivés jusqu'à la prochaine analyse. */
  const stale = data.corpusChanged
  /* Pyramide inversee : indicateurs cles, puis les piliers, puis les
     lectures transversales qui orientent vers le detail. */
  return (
    <AnalysisPage
      {...header}
      actions={
        <div className="flex flex-col items-end gap-2">
          <LaunchAnalysisButton
            label={t("evaluation.run.relaunch")}
            variant="outline"
            workspaceId={workspaceId}
          />
          <RunReference run={data.run} />
          {data.run.validation ? (
            <RunValidationMention validation={data.run.validation} />
          ) : null}
        </div>
      }
      banner={notices}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StaleResult stale={stale}>
          <SummaryMetricCard
            description={t("evaluation.analysis.scoreDescription")}
            icon={BarChart3}
            label={t("evaluation.analysis.averageScore")}
            onClick={() => void navigate(`${analysisPath}/pillars`)}
            value={average === null ? "—" : `${average}/100`}
          />
        </StaleResult>
        <StaleResult stale={stale}>
          <SummaryMetricCard
            description={
              data.layers.b
                ? t("evaluation.analysis.criteriaDescription")
                : comingSoon
            }
            icon={ListChecks}
            label={t("evaluation.analysis.concludedCriteria")}
            onClick={() => void navigate(`${analysisPath}/criteria`)}
            value={data.layers.b ? `${concluded}/${data.layerB.length}` : "—"}
          />
        </StaleResult>
        <StaleResult stale={stale}>
          <SummaryMetricCard
            description={
              data.layers.c
                ? t("evaluation.analysis.alertsDescription")
                : comingSoon
            }
            icon={AlertTriangle}
            label={t("evaluation.analysis.pendingAlerts")}
            onClick={() => void navigate(`${analysisPath}/alerts`)}
            value={data.layers.c ? String(pendingAlerts) : "—"}
          />
        </StaleResult>
        <StaleResult stale={stale}>
          <SummaryMetricCard
            description={t("evaluation.analysis.traceabilityDescription")}
            icon={FileSearch}
            label={t("evaluation.analysis.traceability")}
            onClick={() => setEvidenceOpen(true)}
            value={`${data.traceability}%`}
          />
        </StaleResult>
      </div>
      {scores.length === 0
        ? unscoredGrid
        : pillarSection(
            scores.map((score) => (
              <StaleResult key={score.id} stale={stale}>
                <PillarResultCard
                  alertsCount={
                    data.alerts.filter(
                      (alert) =>
                        alert.pillarId === score.pillarId &&
                        alert.status === "a_instruire"
                    ).length
                  }
                  description={descriptionOf(score.pillarId)}
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
              </StaleResult>
            ))
          )}
      {scores.length > 0 ? (
        <div className="grid items-stretch gap-x-6 gap-y-10 lg:grid-cols-2">
          <PriorityPillarsPanel
            notes={data.layerB}
            onOpenPillar={(pillarId) =>
              void navigate(`${analysisPath}/pillars/${pillarId}`)
            }
            scores={scores}
            stale={stale}
          />
          <CriteriaCoveragePanel
            available={data.layers.b}
            notes={data.layerB}
            onOpenCriterion={(criterionId) =>
              void navigate(`${analysisPath}/criteria?criterion=${criterionId}`)
            }
            stale={stale}
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
