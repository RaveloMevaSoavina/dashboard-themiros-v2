import { useQuery } from "@tanstack/react-query"
import { BarChart3 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"

import {
  AnalysisPage,
  PageSection,
} from "@/features/evaluations/components/analysis-layout"
import { LayerBanner } from "@/features/evaluations/components/layer-banner"
import {
  PillarLayoutToggle,
  pillarGridClassName,
  usePillarLayout,
} from "@/features/evaluations/components/pillar-layout-toggle"
import { PillarResultCard } from "@/features/evaluations/components/pillar-result-card"
import {
  getEvaluationResults,
  getWorkspacePillars,
} from "@/features/evaluations/services/evaluation-service"
import { Skeleton } from "@/shared/ui/base/skeleton"

/** Ecran 15 (liste) : une carte par pilier note, ouvrant son detail. */
export function LayerAScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const [layout, changeLayout] = usePillarLayout()
  const analysisPath = `/workspaces/${workspaceId}/analysis`
  const results = useQuery({
    queryKey: ["evaluation", workspaceId, "results"],
    queryFn: () => getEvaluationResults(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const pillars = useQuery({
    queryKey: ["evaluation", workspaceId, "pillars"],
    queryFn: () => getWorkspacePillars(workspaceId),
    enabled: Boolean(workspaceId),
  })

  if (results.isPending)
    return <Skeleton className="mx-auto h-96 w-full max-w-6xl" />
  const data = results.data
  const scores = data?.layerA ?? []

  return (
    <AnalysisPage
      banner={
        <LayerBanner
          description={t("evaluation.layerA.bannerDescription")}
          title={t("evaluation.layerA.bannerTitle")}
        />
      }
      description={t("evaluation.layerA.description")}
      eyebrow={t("evaluation.eyebrow")}
      title={t("evaluation.layerA.title")}
    >
      {scores.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-border px-6 py-16 text-center">
          <BarChart3 className="size-7 text-muted-foreground" />
          <p className="mt-5 text-sm font-semibold">
            {t("evaluation.analysis.noRun")}
          </p>
          <p className="mt-2 max-w-lg text-[13px] leading-5 text-muted-foreground">
            {t("evaluation.analysis.noRunDescription")}
          </p>
        </div>
      ) : (
        <PageSection
          action={<PillarLayoutToggle onChange={changeLayout} value={layout} />}
          description={t("evaluation.layerA.summary", { count: scores.length })}
          title={t("evaluation.layerA.listTitle")}
        >
          <div className={pillarGridClassName(layout)}>
            {scores.map((score) => (
              <PillarResultCard
                alertsCount={
                  data?.alerts.filter(
                    (alert) =>
                      alert.pillarId === score.pillarId &&
                      alert.status === "a_instruire"
                  ).length ?? 0
                }
                criteria={(data?.layerB ?? []).filter((note) =>
                  score.criterionIds.includes(note.criterionId)
                )}
                description={
                  pillars.data?.find((pillar) => pillar.id === score.pillarId)
                    ?.description
                }
                key={score.id}
                layout={layout}
                onAlerts={() =>
                  void navigate(
                    `${analysisPath}/alerts?pillar=${score.pillarId}`
                  )
                }
                onCriterion={(criterionId) =>
                  void navigate(
                    `${analysisPath}/pillars/${score.pillarId}?criterion=${criterionId}`
                  )
                }
                onOpen={() =>
                  void navigate(`${analysisPath}/pillars/${score.pillarId}`)
                }
                score={score}
              />
            ))}
          </div>
        </PageSection>
      )}
    </AnalysisPage>
  )
}
