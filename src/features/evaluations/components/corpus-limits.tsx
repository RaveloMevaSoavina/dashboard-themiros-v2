import { AlertTriangle } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { Restitution } from "@/features/evaluations/model/types"

/** Limites du corpus, en ouverture de la synthese (RG-11.1, US-18.3). */
export function CorpusLimits({ limits }: { limits: Restitution["limits"] }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border px-4 py-3 text-[13px]">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 leading-5">
        <p className="font-semibold">
          {t("evaluation.restitution.limitsTitle")}
        </p>
        <p className="mt-0.5 text-muted-foreground">
          {t("evaluation.restitution.limits", {
            count: limits.notConcluded,
            criteria: limits.criteria,
            confidence: Math.round(limits.confidence * 100),
          })}
        </p>
      </div>
    </div>
  )
}
