import {
  scoreFillClass,
  scoreLevel,
} from "@/features/evaluations/model/score-level"
import { cn } from "@/shared/lib/utils"

export function ProgressMeter({
  value,
  max,
  className,
  label,
  tone = "neutral",
}: {
  value: number
  max: number
  className?: string
  label?: string
  /** `level` : barre de score, coloree selon le niveau atteint. */
  tone?: "neutral" | "level"
}) {
  const percentage =
    max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div
      aria-label={label}
      aria-valuemax={max}
      aria-valuemin={0}
      aria-valuenow={value}
      className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width]",
          tone === "level"
            ? scoreFillClass[scoreLevel(percentage)]
            : "bg-foreground"
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
