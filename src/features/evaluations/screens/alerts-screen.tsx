import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Eye, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import {
  AnalysisPage,
  PageSection,
} from "@/features/evaluations/components/analysis-layout"
import { EvidenceDrawer } from "@/features/evaluations/components/evidence-drawer"
import { LayerBanner } from "@/features/evaluations/components/layer-banner"
import type { LayerCAlert } from "@/features/evaluations/model/types"
import {
  getEvaluationResults,
  instructAlert,
  listAlertEvidences,
} from "@/features/evaluations/services/evaluation-service"
import { Badge } from "@/shared/ui/base/badge"
import { Button } from "@/shared/ui/base/button"
import { Input } from "@/shared/ui/base/input"
import { Skeleton } from "@/shared/ui/base/skeleton"

export function AlertsScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const pillarFilter = searchParams.get("pillar")
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<LayerCAlert | null>(null)
  const [commentByAlert, setCommentByAlert] = useState<Record<string, string>>(
    {}
  )
  const results = useQuery({
    queryKey: ["evaluation", workspaceId, "results"],
    queryFn: () => getEvaluationResults(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const evidences = useQuery({
    queryKey: ["evaluation", "alert-evidences", selected?.id],
    queryFn: () => listAlertEvidences(selected?.id ?? ""),
    enabled: Boolean(selected),
  })
  const instruction = useMutation({
    mutationFn: (alert: LayerCAlert) =>
      instructAlert(alert.id, commentByAlert[alert.id] ?? ""),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["evaluation", workspaceId],
      })
      toast.success(t("evaluation.alerts.saved"))
    },
    onError: () => toast.error(t("evaluation.alerts.saveError")),
  })
  const analysisPath = `/workspaces/${workspaceId}/analysis`
  /* Le filtre pilier retient aussi les alertes portees par ses criteres,
     comme le detail du pilier. */
  const filteredScore = pillarFilter
    ? results.data?.layerA.find((score) => score.pillarId === pillarFilter)
    : null
  const alerts = (results.data?.alerts ?? []).filter(
    (alert) =>
      !pillarFilter ||
      alert.pillarId === pillarFilter ||
      (alert.criterionId !== null &&
        (filteredScore?.criterionIds.includes(alert.criterionId) ?? false))
  )

  /* A instruire d'abord, majeures en tete ; les alertes instruites
     suivent, a titre d'historique. */
  const bySeverity = (left: LayerCAlert, right: LayerCAlert) =>
    Number(right.severity === "majeure") - Number(left.severity === "majeure")
  const pending = alerts
    .filter((alert) => alert.status === "a_instruire")
    .sort(bySeverity)
  const instructed = alerts
    .filter((alert) => alert.status === "instruite")
    .sort(bySeverity)
  const renderAlert = (alert: LayerCAlert) => (
    <article className="rounded-xl border border-border p-5" key={alert.id}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant={alert.severity === "majeure" ? "default" : "outline"}>
            {t(`evaluation.severity.${alert.severity}`)}
          </Badge>
          {alert.pillarId ? (
            <button
              onClick={() =>
                void navigate(`${analysisPath}/pillars/${alert.pillarId}`)
              }
              type="button"
            >
              <Badge className="hover:bg-muted" variant="secondary">
                {alert.pillarName ?? alert.type}
              </Badge>
            </button>
          ) : null}
          {alert.criterionId ? (
            <button
              onClick={() =>
                void navigate(
                  `${analysisPath}/criteria?criterion=${alert.criterionId}`
                )
              }
              type="button"
            >
              <Badge className="hover:bg-muted" variant="secondary">
                {alert.criterionName ?? alert.type}
              </Badge>
            </button>
          ) : null}
          {!alert.pillarId && !alert.criterionId ? (
            <Badge variant="secondary">{alert.type}</Badge>
          ) : null}
        </div>
        <Badge variant="outline">
          {t(`evaluation.alertStatus.${alert.status}`)}
        </Badge>
      </div>
      <p className="mt-4 text-sm leading-6">{alert.message}</p>
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button onClick={() => setSelected(alert)} size="sm" variant="outline">
          <Eye /> {t("evaluation.viewEvidence")}
        </Button>
        {alert.status === "a_instruire" ? (
          <>
            <Input
              className="min-w-60 flex-1"
              onChange={(event) =>
                setCommentByAlert((current) => ({
                  ...current,
                  [alert.id]: event.target.value,
                }))
              }
              placeholder={t("evaluation.alerts.comment")}
              value={commentByAlert[alert.id] ?? ""}
            />
            <Button
              disabled={
                !commentByAlert[alert.id]?.trim() || instruction.isPending
              }
              onClick={() => instruction.mutate(alert)}
              size="sm"
            >
              <CheckCircle2 /> {t("evaluation.alerts.markInstructed")}
            </Button>
          </>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            {alert.instructionComment}
          </p>
        )}
      </div>
    </article>
  )

  return (
    <AnalysisPage
      actions={
        pillarFilter ? (
          <Button
            onClick={() => setSearchParams({}, { replace: true })}
            size="sm"
            variant="outline"
          >
            <X /> {t("evaluation.alerts.showAll")}
          </Button>
        ) : null
      }
      banner={
        <LayerBanner
          description={t("evaluation.alerts.bannerDescription")}
          title={t("evaluation.alerts.bannerTitle")}
        />
      }
      description={
        pillarFilter
          ? t("evaluation.alerts.filtered", {
              name: filteredScore?.pillarName ?? "—",
            })
          : t("evaluation.alerts.description")
      }
      eyebrow={t("evaluation.eyebrow")}
      title={t("evaluation.alerts.title")}
    >
      {results.isPending ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border border-border p-16 text-center text-[13px] text-muted-foreground">
          {t("evaluation.alerts.empty")}
        </div>
      ) : (
        <>
          <PageSection
            description={t("evaluation.alerts.pendingDescription")}
            title={t("evaluation.alerts.pendingTitle", {
              count: pending.length,
            })}
          >
            {pending.length === 0 ? (
              <div className="rounded-xl border border-border p-6 text-[13px] text-muted-foreground">
                {t("evaluation.alerts.nonePending")}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pending.map(renderAlert)}
              </div>
            )}
          </PageSection>
          {instructed.length > 0 ? (
            <PageSection
              title={t("evaluation.alerts.instructedTitle", {
                count: instructed.length,
              })}
            >
              <div className="flex flex-col gap-3">
                {instructed.map(renderAlert)}
              </div>
            </PageSection>
          ) : null}
        </>
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
