import { Info } from "lucide-react"

/** Note de lecture d'une couche : discrete, elle precede les bandeaux. */
export function LayerBanner({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-muted/40 px-4 py-3">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <p className="text-[13px] leading-5 text-muted-foreground">
        <span className="font-semibold text-foreground">{title}.</span>{" "}
        {description}
      </p>
    </div>
  )
}
