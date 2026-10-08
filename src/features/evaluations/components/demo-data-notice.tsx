import { FlaskConical } from "lucide-react"
import { useTranslation } from "react-i18next"

import { isEvaluationDemo } from "@/features/evaluations/services/evaluation-demo"

/** Signale que les resultats affiches sont fictifs (mode demonstration). */
export function DemoDataNotice() {
  const { t } = useTranslation()
  if (!isEvaluationDemo) return null
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-[13px]">
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <p className="leading-5">
        <span className="font-semibold">{t("evaluation.demo.title")}</span>{" "}
        <span className="text-muted-foreground">
          {t("evaluation.demo.description")}
        </span>
      </p>
    </div>
  )
}
