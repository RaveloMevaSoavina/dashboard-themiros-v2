import {
  scoreLevel,
  scoreTextClass,
} from "@/features/evaluations/model/score-level"
import { cn } from "@/shared/lib/utils"

/* Cercle de rayon 50 centre en (60, 60), demarre a midi (rotation de
   -90deg) ; `pathLength` ramene sa longueur a 100 pour doser le trait. */
const circle = { cx: 60, cy: 60, r: 50, pathLength: 100 } as const

function levelColor(percentage: number) {
  return scoreTextClass[scoreLevel(percentage)]
}

export function ScoreGauge({
  value,
  max,
  className,
  label,
  size = "default",
}: {
  /** `null` : pilier pas encore note, la jauge reste vide. */
  value: number | null
  max: number
  className?: string
  label?: string
  /** `sm` : tuile compacte, trait et chiffre reduits. */
  size?: "default" | "sm"
}) {
  const strokeWidth = size === "sm" ? 8 : 10
  const percentage =
    value === null || max <= 0
      ? 0
      : Math.min(100, Math.max(0, (value / max) * 100))
  const color = value === null ? "text-muted" : levelColor(percentage)
  return (
    <div
      aria-label={label}
      aria-valuemax={max}
      aria-valuemin={0}
      aria-valuenow={value ?? undefined}
      className={cn(
        "relative w-full max-w-28 data-[size=sm]:max-w-20",
        className
      )}
      data-size={size}
      role="progressbar"
    >
      <svg
        aria-hidden="true"
        className={cn("block w-full -rotate-90", color)}
        viewBox="0 0 120 120"
      >
        <circle
          {...circle}
          fill="none"
          stroke="currentColor"
          strokeOpacity={value === null ? 1 : 0.18}
          strokeWidth={strokeWidth}
        />
        <circle
          {...circle}
          className="transition-[stroke-dasharray] duration-500"
          fill="none"
          stroke="currentColor"
          strokeDasharray={`${percentage} 100`}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          visibility={percentage === 0 ? "hidden" : undefined}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="flex items-baseline gap-0.5">
          <span
            className={cn(
              "font-semibold leading-none tabular-nums",
              size === "sm" ? "text-lg" : "text-2xl",
              value === null ? "text-muted-foreground" : color
            )}
          >
            {value === null ? "—" : Math.round(value)}
          </span>
          {value === null ? null : (
            <span
              className={cn(
                "text-muted-foreground",
                size === "sm" ? "text-[10px]" : "text-[11px]"
              )}
            >
              /{max}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
