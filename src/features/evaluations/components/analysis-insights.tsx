import { ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  listPanelClassName,
  listRowClassName,
  PageSection,
} from "@/features/evaluations/components/analysis-layout"
import {
  CriterionNoteMeter,
  CriterionNoteValue,
} from "@/features/evaluations/components/criterion-note-meter"
import { ProgressMeter } from "@/features/evaluations/components/progress-meter"
import {
  scoreLevel,
  scoreTextClass,
} from "@/features/evaluations/model/score-level"
import type {
  LayerAScore,
  LayerBNote,
} from "@/features/evaluations/model/types"
import { cn } from "@/shared/lib/utils"

/** Critères conclus d'abord, du mieux noté au moins bien noté. */
export function sortNotes(notes: LayerBNote[]) {
  return [...notes].sort((left, right) => {
    if (left.note === null) return right.note === null ? 0 : 1
    if (right.note === null) return -1
    return right.note - left.note
  })
}

/** Les trois piliers au score le plus faible, avec leurs critères. */
export function PriorityPillarsPanel({
  scores,
  notes,
  onOpenPillar,
}: {
  scores: LayerAScore[]
  notes: LayerBNote[]
  onOpenPillar: (pillarId: string) => void
}) {
  const { t } = useTranslation()
  const priorities = [...scores]
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)

  return (
    <PageSection
      description={t("evaluation.analysis.priorities.description")}
      title={t("evaluation.analysis.priorities.title")}
    >
      <div className={cn(listPanelClassName, "flex-1")}>
        {priorities.map((score) => {
          const criteria = notes.filter((note) =>
            score.criterionIds.includes(note.criterionId)
          )
          return (
            <button
              className={listRowClassName}
              key={score.id}
              onClick={() => onOpenPillar(score.pillarId)}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium">
                  {score.pillarName}
                </p>
                <span className="flex shrink-0 items-center gap-1">
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      scoreTextClass[scoreLevel(score.score)]
                    )}
                  >
                    {Math.round(score.score)}/100
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </span>
              </div>
              <ProgressMeter
                className="mt-2.5"
                label={score.pillarName}
                max={100}
                tone="level"
                value={score.score}
              />
              {criteria.length > 0 ? (
                <p className="mt-2.5 text-[12px] leading-5 text-muted-foreground">
                  {t("evaluation.analysis.priorities.criteria", {
                    criteria: criteria
                      .map((note) =>
                        note.note === null
                          ? `${note.criterionName} (${t("evaluation.nonConcluded")})`
                          : `${note.criterionName} (${note.note}/3)`
                      )
                      .join(" · "),
                  })}
                </p>
              ) : null}
            </button>
          )
        })}
      </div>
    </PageSection>
  )
}

/** Vue transversale : une barre par critère, tous piliers confondus. */
export function CriteriaCoveragePanel({
  notes,
  onOpenCriterion,
}: {
  notes: LayerBNote[]
  onOpenCriterion: (criterionId: string) => void
}) {
  const { t } = useTranslation()

  return (
    <PageSection
      description={t("evaluation.analysis.coverage.description")}
      title={t("evaluation.analysis.coverage.title")}
    >
      {notes.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center text-[13px] text-muted-foreground">
          {t("evaluation.layerB.empty")}
        </div>
      ) : (
        <div className={cn(listPanelClassName, "flex-1")}>
          {sortNotes(notes).map((note) => (
            <button
              className={cn(
                listRowClassName,
                "grid grid-cols-[minmax(0,1fr)_96px_auto] items-center gap-4 py-3"
              )}
              key={note.id}
              onClick={() => onOpenCriterion(note.criterionId)}
              type="button"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {note.criterionName}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t("evaluation.pillar.questionsDocumented", {
                    documented: note.documented,
                    total: note.total,
                  })}
                </p>
              </div>
              <CriterionNoteMeter note={note.note} />
              <span className="flex w-24 items-center justify-end gap-1 text-sm">
                <CriterionNoteValue note={note.note} />
                <ChevronRight className="size-4 text-muted-foreground" />
              </span>
            </button>
          ))}
        </div>
      )}
    </PageSection>
  )
}
