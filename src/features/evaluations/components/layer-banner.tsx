export function LayerBanner({
  layer,
  title,
  description,
}: {
  layer: "A" | "B" | "C"
  title: string
  description: string
}) {
  return (
    <div className="flex gap-4 rounded-xl border border-border p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-background">
        {layer}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  )
}
