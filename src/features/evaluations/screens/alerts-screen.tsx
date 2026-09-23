import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Eye } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { toast } from "sonner"

import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
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
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
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

  return (
    <div className="mx-auto w-full max-w-5xl">
      <CorpusPageHeader
        description={t("evaluation.alerts.description")}
        eyebrow={t("evaluation.eyebrow")}
        title={t("evaluation.alerts.title")}
      />
      <div className="mt-7">
        <LayerBanner
          description={t("evaluation.alerts.bannerDescription")}
          layer="C"
          title={t("evaluation.alerts.bannerTitle")}
        />
      </div>
      {results.isPending ? (
        <Skeleton className="mt-6 h-80" />
      ) : (
        <div className="mt-6 space-y-3">
          {(results.data?.alerts ?? []).map((alert) => (
            <article
              className="rounded-xl border border-border p-5"
              key={alert.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={
                      alert.severity === "majeure" ? "default" : "outline"
                    }
                  >
                    {t(`evaluation.severity.${alert.severity}`)}
                  </Badge>
                  <Badge variant="secondary">
                    {alert.pillarName ?? alert.criterionName ?? alert.type}
                  </Badge>
                </div>
                <Badge variant="outline">
                  {t(`evaluation.alertStatus.${alert.status}`)}
                </Badge>
              </div>
              <p className="mt-4 text-sm leading-6">{alert.message}</p>
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Button
                  onClick={() => setSelected(alert)}
                  size="sm"
                  variant="outline"
                >
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
                        !commentByAlert[alert.id]?.trim() ||
                        instruction.isPending
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
          ))}
          {(results.data?.alerts.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-border p-16 text-center text-[13px] text-muted-foreground">
              {t("evaluation.alerts.empty")}
            </div>
          ) : null}
        </div>
      )}
      <EvidenceDrawer
        confidence={null}
        evidences={evidences.data ?? []}
        onOpenChange={(open) => !open && setSelected(null)}
        open={Boolean(selected)}
      />
    </div>
  )
}
