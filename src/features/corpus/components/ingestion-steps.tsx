import { Check, LoaderCircle } from "lucide-react"
import { useTranslation } from "react-i18next"

import { ingestionSteps } from "@/features/corpus/model/ingestion"
import { cn } from "@/shared/lib/utils"

/**
 * Progression d'un fichier dans le pipeline : `completed` étapes terminées,
 * la suivante est en cours si `running`, sinon en attente.
 */
export function IngestionSteps({
  completed,
  running = false,
}: {
  completed: number
  running?: boolean
}) {
  const { t } = useTranslation()

  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px]">
      {ingestionSteps.map((step, index) => {
        const done = index < completed
        const active = running && index === completed
        return (
          <li className="flex items-center gap-1.5" key={step}>
            {index > 0 ? (
              <span
                aria-hidden
                className={cn("h-px w-3 bg-border", done && "bg-foreground")}
              />
            ) : null}
            <span
              className={cn(
                "flex items-center gap-1 text-muted-foreground",
                (done || active) && "text-foreground"
              )}
            >
              {done ? (
                <Check className="size-3" />
              ) : active ? (
                <LoaderCircle className="size-3 animate-spin" />
              ) : (
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-muted-foreground/40"
                />
              )}
              {t(`corpus.import.steps.${step}`)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
