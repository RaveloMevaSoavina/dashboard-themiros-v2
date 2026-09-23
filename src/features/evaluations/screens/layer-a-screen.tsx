import { useQuery } from "@tanstack/react-query"
import { Eye, FileSearch } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"

import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import { EvidenceDrawer } from "@/features/evaluations/components/evidence-drawer"
import { LayerBanner } from "@/features/evaluations/components/layer-banner"
import { ProgressMeter } from "@/features/evaluations/components/progress-meter"
import type { IntermediateVariable } from "@/features/evaluations/model/types"
import {
  getEvaluationResults,
  listEvidences,
  listIntermediateVariables,
} from "@/features/evaluations/services/evaluation-service"
import { Button } from "@/shared/ui/base/button"
import { Skeleton } from "@/shared/ui/base/skeleton"

export function LayerAScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { workspaceId = "", pillarId } = useParams<{
    workspaceId: string
    pillarId?: string
  }>()
  const [selectedVariable, setSelectedVariable] =
    useState<IntermediateVariable | null>(null)
  const results = useQuery({
    queryKey: ["evaluation", workspaceId, "results"],
    queryFn: () => getEvaluationResults(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const activeScore = pillarId
    ? results.data?.layerA.find((item) => item.pillarId === pillarId)
    : null
  const variables = useQuery({
    queryKey: ["evaluation", results.data?.run?.id, "variables", pillarId],
    queryFn: () =>
      listIntermediateVariables(results.data?.run?.id ?? "", pillarId ?? ""),
    enabled: Boolean(results.data?.run?.id && pillarId),
  })
  const evidences = useQuery({
    queryKey: [
      "evaluation",
      results.data?.run?.id,
      "evidences",
      selectedVariable?.id,
    ],
    queryFn: () =>
      listEvidences({
        runId: results.data?.run?.id ?? "",
        pillarId,
        variableCode: selectedVariable?.code,
      }),
    enabled: Boolean(selectedVariable && results.data?.run?.id),
  })

  if (results.isPending)
    return <Skeleton className="mx-auto h-96 w-full max-w-5xl" />
  if (!pillarId) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <CorpusPageHeader
          description={t("evaluation.layerA.description")}
          eyebrow={t("evaluation.eyebrow")}
          title={t("evaluation.layerA.title")}
        />
        <LayerBanner
          description={t("evaluation.layerA.bannerDescription")}
          layer="A"
          title={t("evaluation.layerA.bannerTitle")}
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {results.data?.layerA.map((score) => (
            <button
              className="rounded-xl border border-border p-5 text-left hover:bg-muted/40"
              key={score.id}
              onClick={() =>
                void navigate(
                  `/workspaces/${workspaceId}/analysis/pillars/${score.pillarId}`
                )
              }
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">{score.pillarName}</h2>
                <span className="text-xl font-semibold">
                  {Math.round(score.score)}
                </span>
              </div>
              <ProgressMeter className="mt-4" max={100} value={score.score} />
              <p className="mt-3 text-[12px] text-muted-foreground">
                {Math.round(score.confidence * 100)}% · {score.documentsCount}{" "}
                docs
              </p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <CorpusPageHeader
        action={
          <Button
            onClick={() =>
              void navigate(`/workspaces/${workspaceId}/analysis/pillars`)
            }
            variant="outline"
          >
            {t("evaluation.back")}
          </Button>
        }
        description={activeScore?.versionLabel ?? ""}
        eyebrow={t("evaluation.layerA.title")}
        title={activeScore?.pillarName ?? t("evaluation.layerA.title")}
      />
      <div className="mt-7">
        <LayerBanner
          description={t("evaluation.layerA.bannerDescription")}
          layer="A"
          title={t("evaluation.layerA.bannerTitle")}
        />
      </div>
      {activeScore ? (
        <section className="mt-6 rounded-xl border border-border p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                {t("evaluation.layerA.objectiveScore")}
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {Math.round(activeScore.score)}/100
              </p>
            </div>
            <p className="text-[13px] text-muted-foreground">
              {Math.round(activeScore.confidence * 100)}% ·{" "}
              {activeScore.documentsCount} docs
            </p>
          </div>
          <ProgressMeter className="mt-5" max={100} value={activeScore.score} />
        </section>
      ) : null}
      <section className="mt-6">
        <h2 className="text-base font-semibold">
          {t("evaluation.layerA.variables")}
        </h2>
        {variables.isPending ? (
          <Skeleton className="mt-4 h-52" />
        ) : (
          <div className="mt-4 divide-y divide-border rounded-xl border border-border">
            {(variables.data ?? []).map((variable) => (
              <div
                className="grid items-center gap-4 p-4 sm:grid-cols-[1fr_130px_120px_auto]"
                key={variable.id}
              >
                <div>
                  <p className="text-sm font-medium">{variable.label}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {variable.versionLabel}
                  </p>
                </div>
                <span className="text-[13px]">
                  {t(`evaluation.variableState.${variable.state}`)}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {variable.documentsCount} docs
                </span>
                <Button
                  disabled={variable.state === "non_renseigne"}
                  onClick={() => setSelectedVariable(variable)}
                  size="sm"
                  variant="outline"
                >
                  <Eye /> {t("evaluation.viewEvidence")}
                </Button>
              </div>
            ))}
            {(variables.data?.length ?? 0) === 0 ? (
              <div className="flex items-center gap-3 p-6 text-[13px] text-muted-foreground">
                <FileSearch className="size-4" />{" "}
                {t("evaluation.layerA.noVariables")}
              </div>
            ) : null}
          </div>
        )}
      </section>
      <EvidenceDrawer
        confidence={selectedVariable?.confidence ?? null}
        evidences={evidences.data ?? []}
        onOpenChange={(open) => !open && setSelectedVariable(null)}
        open={Boolean(selectedVariable)}
      />
    </div>
  )
}
