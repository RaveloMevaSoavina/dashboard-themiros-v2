import { useQuery } from "@tanstack/react-query"
import { Eye } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"

import {
  AnalysisPage,
  PageSection,
} from "@/features/evaluations/components/analysis-layout"
import { CorpusLimits } from "@/features/evaluations/components/corpus-limits"
import { EvidenceDrawer } from "@/features/evaluations/components/evidence-drawer"
import { LayerBanner } from "@/features/evaluations/components/layer-banner"
import { OriginBadge } from "@/features/evaluations/components/origin-badge"
import { RunNotices } from "@/features/evaluations/components/run-notices"
import { StaleResult } from "@/features/evaluations/components/stale-result"
import {
  getEvaluationResults,
  getRunRestitution,
  listActionEvidences,
} from "@/features/evaluations/services/evaluation-service"
import { PersonaSwitcher } from "@/features/workspaces/components/persona-switcher"
import { useWorkspaces } from "@/features/workspaces/model/workspace-provider"
import { Button } from "@/shared/ui/base/button"
import { Skeleton } from "@/shared/ui/base/skeleton"

/**
 * Plan d'action du persona actif. Les trois projections d'une action sont
 * chargees ensemble : la bascule de persona change la formulation, jamais
 * l'action, son origine ni ses preuves (RG-11.4, CA-11.2).
 */
export function ActionPlanScreen() {
  const { i18n, t } = useTranslation()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const { persona } = useWorkspaces()
  const locale = i18n.resolvedLanguage ?? "fr"
  const [selected, setSelected] = useState<string | null>(null)
  const results = useQuery({
    queryKey: ["evaluation", workspaceId, "results", i18n.resolvedLanguage],
    queryFn: () => getEvaluationResults(workspaceId, locale),
    enabled: Boolean(workspaceId),
  })
  const runId = results.data?.run?.id
  const restitution = useQuery({
    queryKey: ["evaluation", workspaceId, "restitution", runId, locale],
    queryFn: () => getRunRestitution(runId ?? "", locale),
    enabled: Boolean(runId),
  })
  const evidences = useQuery({
    queryKey: ["evaluation", "action-evidences", selected, locale],
    queryFn: () => listActionEvidences(selected ?? "", locale),
    enabled: Boolean(selected),
  })
  const data = restitution.data
  const stale = results.data?.corpusChanged ?? false
  const actions = (data?.actions ?? []).flatMap((action) => {
    const projection = action.projections[persona]
    return projection ? [{ ...action, projection }] : []
  })

  return (
    <AnalysisPage
      actions={<PersonaSwitcher />}
      banner={
        <>
          <LayerBanner
            description={t(`evaluation.actionPlan.register.${persona}`)}
            title={t("evaluation.actionPlan.bannerTitle", {
              persona: t(`personas.${persona}.name`),
            })}
          />
          <RunNotices
            corpusChanged={stale}
            latestRun={results.data?.latestRun ?? null}
            run={results.data?.run ?? null}
            workspaceId={workspaceId}
          />
        </>
      }
      description={t("evaluation.actionPlan.description")}
      eyebrow={t("evaluation.eyebrow")}
      title={t("evaluation.actionPlan.title")}
    >
      {results.isPending || (runId && restitution.isPending) ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : !data ? (
        <div className="rounded-xl border border-border p-16 text-center text-[13px] text-muted-foreground">
          {runId
            ? t("evaluation.restitution.notComputed")
            : t("evaluation.synthesis.empty")}
        </div>
      ) : (
        <StaleResult className="gap-10" stale={stale}>
          {data.limits.leads ? <CorpusLimits limits={data.limits} /> : null}
          <PageSection
            description={t("evaluation.actionPlan.listDescription")}
            title={t("evaluation.actionPlan.listTitle", {
              count: actions.length,
            })}
          >
            {actions.length === 0 ? (
              <div className="rounded-xl border border-border p-12 text-center text-[13px] text-muted-foreground">
                {t(`evaluation.actionPlan.empty.${data.status}`)}
              </div>
            ) : (
              <ol className="flex flex-col gap-3">
                {actions.map((action) => (
                  <li
                    className="flex gap-4 rounded-xl border border-border p-5"
                    key={action.id}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-[12px] font-semibold">
                      {action.position}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <div>
                        <p className="text-sm font-medium leading-6">
                          {action.projection.text}
                        </p>
                        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                          {t("evaluation.actionPlan.because", {
                            reason: action.projection.justification,
                          })}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <OriginBadge
                          origin={action.origin}
                          workspaceId={workspaceId}
                        />
                        <Button
                          onClick={() => setSelected(action.id)}
                          size="sm"
                          variant="ghost"
                        >
                          <Eye /> {t("evaluation.viewEvidence")}
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </PageSection>
        </StaleResult>
      )}
      <EvidenceDrawer
        confidence={null}
        evidences={evidences.data ?? []}
        onOpenChange={(open) => !open && setSelected(null)}
        open={Boolean(selected)}
      />
    </AnalysisPage>
  )
}
