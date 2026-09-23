import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, LoaderCircle, Plus, RotateCcw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { toast } from "sonner"

import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import { PillarCard } from "@/features/evaluations/components/pillar-card"
import type { EvaluationPillar } from "@/features/evaluations/model/types"
import {
  getWorkspacePillars,
  saveFrameworkPillars,
} from "@/features/evaluations/services/evaluation-service"
import type { EvaluationCycle } from "@/features/evaluation-frameworks/model/types"
import { listReferencePillars } from "@/features/evaluation-frameworks/services/reference-service"
import type { WorkspaceStage } from "@/features/workspaces/model/types"
import { getWorkspaceDetails } from "@/features/workspaces/services/workspace-service"
import { Button } from "@/shared/ui/base/button"
import { Skeleton } from "@/shared/ui/base/skeleton"

function toCycle(stage: WorkspaceStage): EvaluationCycle {
  if (stage === "design" || stage === "pre_launch") return "ex_ante"
  if (stage === "mid_term") return "mi_parcours"
  if (stage === "closing") return "finale"
  if (stage === "post_closure") return "ex_post"
  return "en_cours"
}

export function FrameworkPillarsScreen() {
  const { i18n, t } = useTranslation()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const queryClient = useQueryClient()
  const details = useQuery({
    queryKey: ["workspaces", "details", workspaceId],
    queryFn: () => getWorkspaceDetails(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const generated = useQuery({
    queryKey: ["evaluation", workspaceId, "pillars"],
    queryFn: () => getWorkspacePillars(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const cycle = details.data ? toCycle(details.data.stage) : "en_cours"
  const references = useQuery({
    queryKey: ["reference-pillars", cycle, i18n.resolvedLanguage],
    queryFn: () =>
      listReferencePillars(
        "M2",
        cycle,
        i18n.resolvedLanguage === "en" ? "en" : "fr"
      ),
    enabled: Boolean(details.data),
  })
  const sourcePillars = useMemo<EvaluationPillar[]>(() => {
    if ((generated.data?.length ?? 0) > 0) return generated.data ?? []
    return (references.data ?? []).map((pillar) => ({
      id: pillar.id,
      name: pillar.name,
      description: pillar.description,
      weight: Number(pillar.default_weight),
      origin: "referential",
      criteria: pillar.criteria_codes,
      variables: pillar.observable_variables,
    }))
  }, [generated.data, references.data])
  const [pillars, setPillars] = useState<EvaluationPillar[]>([])
  useEffect(() => setPillars(sourcePillars), [sourcePillars])
  const total = pillars.reduce((sum, pillar) => sum + pillar.weight, 0)
  const loading =
    details.isPending || generated.isPending || references.isPending
  const failed = details.isError || generated.isError || references.isError
  const validation = useMutation({
    mutationFn: () =>
      saveFrameworkPillars(
        workspaceId,
        pillars,
        (generated.data ?? []).map((pillar) => pillar.id)
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["evaluation", workspaceId, "pillars"],
        }),
        queryClient.invalidateQueries({ queryKey: ["workspaces", "list"] }),
      ])
      toast.success(t("evaluation.framework.validated"))
    },
    onError: () => toast.error(t("evaluation.framework.validationError")),
  })

  return (
    <div className="mx-auto w-full max-w-5xl">
      <CorpusPageHeader
        description={t("evaluation.framework.description")}
        eyebrow={t("evaluation.eyebrow")}
        title={t("evaluation.framework.title")}
      />
      {loading ? (
        <div className="mt-8 space-y-4">
          {[1, 2, 3].map((item) => (
            <Skeleton className="h-64 rounded-xl" key={item} />
          ))}
        </div>
      ) : failed ? (
        <div className="mt-8 rounded-xl border border-border p-6">
          <p className="text-sm">{t("evaluation.loadError")}</p>
          <Button
            className="mt-4"
            onClick={() => void generated.refetch()}
            variant="outline"
          >
            <RotateCcw /> {t("workspaces.error.retry")}
          </Button>
        </div>
      ) : (
        <>
          {(generated.data?.length ?? 0) === 0 ? (
            <div className="mt-7 flex gap-3 rounded-xl border border-border p-4 text-[13px] text-muted-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {t("evaluation.framework.templateNotice")}
            </div>
          ) : null}
          <div className="sticky top-4 z-10 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-background/95 p-4 backdrop-blur">
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                {t("evaluation.framework.totalWeight")}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {total}%
              </p>
            </div>
            <div className="flex gap-2">
              <Button disabled variant="outline">
                <Plus /> {t("evaluation.framework.add")}
              </Button>
              <Button
                disabled={
                  total !== 100 ||
                  (generated.data?.length ?? 0) === 0 ||
                  validation.isPending
                }
                onClick={() => validation.mutate()}
              >
                {validation.isPending ? (
                  <LoaderCircle className="animate-spin" />
                ) : null}
                {t("evaluation.framework.validate")}
              </Button>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {pillars.map((pillar) => (
              <PillarCard
                canRemove={pillars.length > 4}
                editable={(generated.data?.length ?? 0) > 0}
                key={pillar.id}
                onChange={(next) =>
                  setPillars((current) =>
                    current.map((item) => (item.id === next.id ? next : item))
                  )
                }
                onRemove={() =>
                  setPillars((current) =>
                    current.filter((item) => item.id !== pillar.id)
                  )
                }
                pillar={pillar}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
