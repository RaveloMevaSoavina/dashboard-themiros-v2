import type { LucideIcon } from "lucide-react"

export function SummaryMetricCard({
  icon: Icon,
  label,
  value,
  description,
  onClick,
}: {
  icon: LucideIcon
  label: string
  value: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      className="rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/50"
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-4 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">{description}</p>
    </button>
  )
}
