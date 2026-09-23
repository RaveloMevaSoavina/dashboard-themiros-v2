import { ArrowRight, FileCheck2, ShieldCheck } from "lucide-react"
import { useTranslation } from "react-i18next"

import type {
  LayerAScore,
  LayerBNote,
} from "@/features/evaluations/model/types"
import { ProgressMeter } from "@/features/evaluations/components/progress-meter"
import { Badge } from "@/shared/ui/base/badge"

export function PillarResultCard({
  score,
  criteria,
  alertsCount,
  onOpen,
  onCriterion,
  onAlerts,
}: {
  score: LayerAScore
  criteria: LayerBNote[]
  alertsCount: number
  onOpen: () => void
  onCriterion: (criterionId: string) => void
  onAlerts: () => void
}) {
  const { t } = useTranslation()
  return (
    <article className="rounded-xl border border-border p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(200px,1.4fr)_110px_130px_minmax(220px,1fr)_150px] lg:items-center">
        <button className="text-left" onClick={onOpen} type="button">
          <h3 className="font-semibold hover:underline">{score.pillarName}</h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {score.versionLabel}
          </p>
        </button>
        <button className="text-left" onClick={onOpen} type="button">
          <p className="text-2xl font-semibold tabular-nums">
            {Math.round(score.score)}
          </p>
          <ProgressMeter className="mt-2" max={100} value={score.score} />
        </button>
        <button
          className="text-left text-[13px]"
          onClick={onOpen}
          type="button"
        >
          {score.evolution ? (
            <>
              <p className="font-medium">
                {t(`evaluation.evolution.${score.evolution}`)}
              </p>
              <p className="mt-1 tabular-nums text-muted-foreground">
                {score.delta !== null && score.delta > 0 ? "+" : ""}
                {score.delta ?? 0}
              </p>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </button>
        <div className="flex flex-wrap gap-1.5">
          {criteria.map((criterion) => (
            <button
              key={criterion.id}
              onClick={() => onCriterion(criterion.criterionId)}
              type="button"
            >
              <Badge variant="outline">
                {criterion.criterionName} ·{" "}
                {criterion.note === null
                  ? t("evaluation.nonConcluded")
                  : `${criterion.note}/3`}
              </Badge>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 text-[12px]">
          <button
            className="flex items-center gap-1.5"
            onClick={onOpen}
            type="button"
          >
            <ShieldCheck className="size-4" />
            {Math.round(score.confidence * 100)}% · {score.documentsCount} docs
          </button>
          <button
            className="flex items-center gap-1.5"
            onClick={onAlerts}
            type="button"
          >
            <FileCheck2 className="size-4" /> {alertsCount}
          </button>
          <button
            aria-label={t("evaluation.openPillar")}
            onClick={onOpen}
            type="button"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </article>
  )
}
