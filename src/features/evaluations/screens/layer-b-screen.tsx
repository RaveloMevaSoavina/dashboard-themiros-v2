import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, Eye } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams, useSearchParams } from "react-router-dom"

import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import { EvidenceDrawer } from "@/features/evaluations/components/evidence-drawer"
import { LayerBanner } from "@/features/evaluations/components/layer-banner"
import { ProgressMeter } from "@/features/evaluations/components/progress-meter"
import type { LayerBNote } from "@/features/evaluations/model/types"
import {
  getEvaluationResults,
  listEvidences,
  listSubAnswers,
} from "@/features/evaluations/services/evaluation-service"
import { Badge } from "@/shared/ui/base/badge"
import { Button } from "@/shared/ui/base/button"
import { Skeleton } from "@/shared/ui/base/skeleton"

function CriterionResultCard({
  note,
  runId,
  onEvidence,
}: {
  note: LayerBNote
  runId: string
  onEvidence: (note: LayerBNote) => void
}) {
  const { t } = useTranslation()
  const answers = useQuery({
    queryKey: ["evaluation", runId, "answers", note.criterionId],
    queryFn: () => listSubAnswers(runId, note.criterionId),
  })
  const percentage =
    note.total === 0 ? 0 : Math.round((note.documented / note.total) * 100)
  return (
    <article className="rounded-xl border border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h2 className="text-base font-semibold">{note.criterionName}</h2>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {note.documented}/{note.total} · {percentage}%{" "}
            {t("evaluation.layerB.documented")}
          </p>
        </div>
        <button
          className="text-right"
          onClick={() => onEvidence(note)}
          type="button"
        >
          {note.status === "non_conclu" ? (
            <Badge variant="warning">{t("evaluation.nonConcluded")}</Badge>
          ) : (
            <p className="text-2xl font-semibold tabular-nums">{note.note}/3</p>
          )}
        </button>
      </div>
      <ProgressMeter
        className="mt-4"
        max={note.total}
        value={note.documented}
      />
      {note.ambiguous ? (
        <button
          className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground hover:underline"
          onClick={() => onEvidence(note)}
          type="button"
        >
          <AlertTriangle className="size-4" />{" "}
          {t("evaluation.layerB.ambiguous")}
        </button>
      ) : null}
      {note.justification ? (
        <p className="mt-4 text-[13px] leading-5 text-muted-foreground">
          {note.justification}
        </p>
      ) : null}
      <div className="mt-5 divide-y divide-border border-t border-border">
        {(answers.data ?? []).map((answer) => (
          <div
            className="flex items-center justify-between gap-4 py-3"
            key={answer.id}
          >
            <div>
              <p className="text-[13px]">{answer.text}</p>
              <Badge className="mt-2" variant="outline">
                {t(`evaluation.answerStatus.${answer.status}`)}
              </Badge>
            </div>
            <Button
              disabled={answer.status === "non_documentee"}
              onClick={() => onEvidence(note)}
              size="sm"
              variant="ghost"
            >
              <Eye /> {t("evaluation.viewEvidence")}
            </Button>
          </div>
        ))}
      </div>
    </article>
  )
}

export function LayerBScreen() {
  const { t } = useTranslation()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const [searchParams] = useSearchParams()
  const filterId = searchParams.get("criterion")
  const [selected, setSelected] = useState<LayerBNote | null>(null)
  const results = useQuery({
    queryKey: ["evaluation", workspaceId, "results"],
    queryFn: () => getEvaluationResults(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const evidences = useQuery({
    queryKey: [
      "evaluation",
      results.data?.run?.id,
      "criterion-evidences",
      selected?.criterionId,
    ],
    queryFn: () =>
      listEvidences({
        runId: results.data?.run?.id ?? "",
        criterionId: selected?.criterionId,
      }),
    enabled: Boolean(selected && results.data?.run?.id),
  })
  const notes = filterId
    ? (results.data?.layerB.filter((item) => item.criterionId === filterId) ??
      [])
    : (results.data?.layerB ?? [])

  return (
    <div className="mx-auto w-full max-w-5xl">
      <CorpusPageHeader
        description={t("evaluation.layerB.description")}
        eyebrow={t("evaluation.eyebrow")}
        title={t("evaluation.layerB.title")}
      />
      <div className="mt-7">
        <LayerBanner
          description={t("evaluation.layerB.bannerDescription")}
          layer="B"
          title={t("evaluation.layerB.bannerTitle")}
        />
      </div>
      {results.isPending ? (
        <Skeleton className="mt-6 h-96" />
      ) : (
        <div className="mt-6 space-y-4">
          {notes.map((note) => (
            <CriterionResultCard
              key={note.id}
              note={note}
              onEvidence={setSelected}
              runId={results.data?.run?.id ?? ""}
            />
          ))}
          {notes.length === 0 ? (
            <div className="rounded-xl border border-border p-12 text-center text-[13px] text-muted-foreground">
              {t("evaluation.layerB.empty")}
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
