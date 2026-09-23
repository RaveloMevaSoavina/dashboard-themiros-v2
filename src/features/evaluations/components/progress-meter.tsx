import { cn } from "@/shared/lib/utils"

export function ProgressMeter({
  value,
  max,
  className,
  label,
}: {
  value: number
  max: number
  className?: string
  label?: string
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
        className="h-full rounded-full bg-foreground transition-[width]"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
