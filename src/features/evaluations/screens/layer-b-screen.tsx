import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, Eye, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  AnalysisPage,
  PageSection,
} from "@/features/evaluations/components/analysis-layout"
import {
  CitedParagraphs,
  Interpretation,
  useCitationSources,
} from "@/features/evaluations/components/cited-text"
import {
  CriterionNoteMeter,
  CriterionNoteValue,
} from "@/features/evaluations/components/criterion-note-meter"
import { EvidenceDrawer } from "@/features/evaluations/components/evidence-drawer"
import { LayerBanner } from "@/features/evaluations/components/layer-banner"
import { ProgressMeter } from "@/features/evaluations/components/progress-meter"
import { RunNotices } from "@/features/evaluations/components/run-notices"
import { StaleResult } from "@/features/evaluations/components/stale-result"
import type { LayerBNote, SubAnswer } from "@/features/evaluations/model/types"
import {
  getEvaluationResults,
  listEvidences,
  listSubAnswerEvidences,
  listSubAnswers,
} from "@/features/evaluations/services/evaluation-service"
import { Badge } from "@/shared/ui/base/badge"
import { Button } from "@/shared/ui/base/button"
import { Skeleton } from "@/shared/ui/base/skeleton"

function CriterionResultCard({
  note,
  runId,
  pillars,
  interpretationExpected,
  onEvidence,
  onPillar,
}: {
  note: LayerBNote
  runId: string
  /** L'IA a redige les reponses aux sous-questions de ce run. */
  interpretationExpected: boolean
  /** Piliers du cadre auxquels le critere est rattache. */
  pillars: { id: string; name: string }[]
  /** Sans reponse : preuves du critere entier. */
  onEvidence: (note: LayerBNote, answer?: SubAnswer) => void
  onPillar: (pillarId: string) => void
}) {
  const { i18n, t } = useTranslation()
  const answers = useQuery({
    queryKey: [
      "evaluation",
      runId,
      "answers",
      note.criterionId,
      i18n.resolvedLanguage,
    ],
    queryFn: () =>
      listSubAnswers(runId, note.criterionId, i18n.resolvedLanguage ?? "fr"),
  })
  const cited = useCitationSources(
    [
      note.citations,
      ...(answers.data ?? []).map((answer) => answer.interpretationCitations),
    ],
    i18n.resolvedLanguage ?? "fr"
  )
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
            <CriterionNoteValue className="text-2xl" note={note.note} />
          )}
        </button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] text-muted-foreground">
            {t("evaluation.layerB.note")}
          </p>
          <CriterionNoteMeter className="mt-2" note={note.note} />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">
            {t("evaluation.layerB.subQuestionsCoverage")}
          </p>
          <ProgressMeter
            className="mt-2"
            max={note.total}
            value={note.documented}
          />
        </div>
      </div>
      {note.justification ? (
        <CitedParagraphs
          citations={note.citations}
          className="mt-5 text-[13px] leading-6 text-muted-foreground"
          sources={cited.sources}
          text={note.justification}
        />
      ) : null}
      {cited.dialog}
      {note.ambiguous ? (
        <button
          className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground hover:underline"
          onClick={() => onEvidence(note)}
          type="button"
        >
          <AlertTriangle className="size-4" />{" "}
          {t("evaluation.layerB.ambiguous")}
        </button>
      ) : null}
      {(answers.data?.length ?? 0) > 0 ? (
        <div className="mt-5 divide-y divide-border border-t border-border">
          {(answers.data ?? []).map((answer) => (
            <div
              className="flex items-start justify-between gap-4 py-3"
              key={answer.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] leading-5">{answer.text}</p>
                  <Badge variant="outline">
                    {t(`evaluation.answerStatus.${answer.status}`)}
                  </Badge>
                </div>
                <Interpretation
                  citations={answer.interpretationCitations}
                  className="mt-2 text-[13px] leading-6 text-muted-foreground"
                  expected={
                    interpretationExpected && answer.status === "documentee"
                  }
                  sources={cited.sources}
                  text={answer.interpretation}
                />
              </div>
              <Button
                className="shrink-0"
                disabled={answer.status === "non_documentee"}
                onClick={() => onEvidence(note, answer)}
                size="sm"
                variant="ghost"
              >
                <Eye /> {t("evaluation.viewEvidence")}
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {pillars.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-border pt-4">
          <span className="text-[11px] text-muted-foreground">
            {t("evaluation.layerB.pillars")}
          </span>
          {pillars.map((pillar) => (
            <button
              key={pillar.id}
              onClick={() => onPillar(pillar.id)}
              type="button"
            >
              <Badge className="hover:bg-muted" variant="outline">
                {pillar.name}
              </Badge>
            </button>
          ))}
        </div>
      ) : null}
    </article>
  )
}

export function LayerBScreen() {
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const filterId = searchParams.get("criterion")
  const [selected, setSelected] = useState<{
    note: LayerBNote
    answer?: SubAnswer
  } | null>(null)
  const results = useQuery({
    queryKey: ["evaluation", workspaceId, "results", i18n.resolvedLanguage],
    queryFn: () =>
      getEvaluationResults(workspaceId, i18n.resolvedLanguage ?? "fr"),
    enabled: Boolean(workspaceId),
  })
  const runId = results.data?.run?.id ?? ""
  const locale = i18n.resolvedLanguage ?? "fr"
  const evidences = useQuery({
    queryKey: selected?.answer
      ? ["evaluation", runId, "answer-evidences", selected.answer.id, locale]
      : [
          "evaluation",
          runId,
          "criterion-evidences",
          selected?.note.criterionId,
          locale,
        ],
    queryFn: () =>
      selected?.answer
        ? listSubAnswerEvidences(
            runId,
            selected.note.criterionId,
            selected.answer.id,
            locale
          )
        : listEvidences(
            { runId, criterionId: selected?.note.criterionId },
            locale
          ),
    enabled: Boolean(selected && runId),
  })
  const notes = filterId
    ? (results.data?.layerB.filter((item) => item.criterionId === filterId) ??
      [])
    : (results.data?.layerB ?? [])

  const concludedCount = notes.filter((note) => note.status === "conclu").length

  return (
    <AnalysisPage
      banner={
        <>
          <LayerBanner
            description={t("evaluation.layerB.bannerDescription")}
            title={t("evaluation.layerB.bannerTitle")}
          />
          <RunNotices
            corpusChanged={results.data?.corpusChanged ?? false}
            latestRun={results.data?.latestRun ?? null}
            run={results.data?.run ?? null}
            workspaceId={workspaceId}
          />
        </>
      }
      description={t("evaluation.layerB.description")}
      eyebrow={t("evaluation.eyebrow")}
      title={t("evaluation.layerB.title")}
    >
      {results.isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <PageSection
          action={
            filterId ? (
              <Button
                onClick={() => setSearchParams({}, { replace: true })}
                size="sm"
                variant="outline"
              >
                <X /> {t("evaluation.layerB.showAll")}
              </Button>
            ) : null
          }
          description={
            filterId
              ? t("evaluation.layerB.filtered", {
                  name: notes[0]?.criterionName ?? "—",
                })
              : t("evaluation.layerB.summary", {
                  count: notes.length,
                  concluded: concludedCount,
                })
          }
          title={t("evaluation.layerB.listTitle")}
        >
          <div className="flex flex-col gap-4">
            {notes.map((note) => (
              <StaleResult
                key={note.id}
                stale={results.data?.corpusChanged ?? false}
              >
                <CriterionResultCard
                  interpretationExpected={
                    results.data?.run?.ai?.layerB ?? false
                  }
                  note={note}
                  onEvidence={(note, answer) => setSelected({ note, answer })}
                  onPillar={(pillarId) =>
                    void navigate(
                      `/workspaces/${workspaceId}/analysis/pillars/${pillarId}?criterion=${note.criterionId}`
                    )
                  }
                  pillars={(results.data?.layerA ?? [])
                    .filter((score) =>
                      score.criterionIds.includes(note.criterionId)
                    )
                    .map((score) => ({
                      id: score.pillarId,
                      name: score.pillarName,
                    }))}
                  runId={results.data?.run?.id ?? ""}
                />
              </StaleResult>
            ))}
            {notes.length === 0 ? (
              <div className="rounded-xl border border-border p-12 text-center text-[13px] text-muted-foreground">
                {results.data?.run && !results.data.layers.b
                  ? t("evaluation.run.layerBComingSoon")
                  : t("evaluation.layerB.empty")}
              </div>
            ) : null}
          </div>
        </PageSection>
      )}
      <EvidenceDrawer
        confidence={null}
        evidences={evidences.data ?? []}
        interpretationExpected={results.data?.run?.ai?.reading ?? false}
        onOpenChange={(open) => !open && setSelected(null)}
        open={Boolean(selected)}
      />
    </AnalysisPage>
  )
}
