import { useTranslation } from "react-i18next"

import {
  notePercentage,
  scoreFillClass,
  scoreLevel,
  scoreTextClass,
} from "@/features/evaluations/model/score-level"
import { cn } from "@/shared/lib/utils"

/**
 * Note de critere sur 3, un segment par point. Chaque segment se remplit
 * au prorata : 2,5/3 laisse le dernier a moitie vide, jamais une jauge
 * pleine pour une note partielle. `null` (non conclu) : segments vides.
 */
export function CriterionNoteMeter({
  note,
  className,
}: {
  note: number | null
  className?: string
}) {
  const { t } = useTranslation()
  const fill =
    note === null ? null : scoreFillClass[scoreLevel(notePercentage(note))]
  return (
    <div
      aria-label={
        note === null
          ? t("evaluation.nonConcluded")
          : t("evaluation.criterionNote", { note })
      }
      className={cn("grid grid-cols-3 gap-1", className)}
      role="img"
    >
      {[0, 1, 2].map((segment) => {
        const ratio =
          note === null ? 0 : Math.min(1, Math.max(0, note - segment))
        return (
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            key={segment}
          >
            <div
              className={cn("h-full rounded-full transition-[width]", fill)}
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

/** Note lisible : « 2/3 » coloree selon le niveau, ou « Non conclu ». */
export function CriterionNoteValue({
  note,
  className,
}: {
  note: number | null
  className?: string
}) {
  const { t } = useTranslation()
  if (note === null) {
    return (
      <span className={cn("text-[12px] text-muted-foreground", className)}>
        {t("evaluation.nonConcluded")}
      </span>
    )
  }
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        scoreTextClass[scoreLevel(notePercentage(note))],
        className
      )}
    >
      {note}/3
    </span>
  )
}
