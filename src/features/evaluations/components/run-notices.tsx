import { AlertTriangle, FileWarning, RefreshCw } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { LaunchAnalysisButton } from "@/features/evaluations/components/launch-analysis-button"
import type { AnalysisRun } from "@/features/evaluations/model/types"
import { cn } from "@/shared/lib/utils"

/* Gravite d'un bandeau, sur le code couleur des scores. */
const tones = {
  danger: "border-score-low/40 bg-score-low/5 [&_[data-icon]]:text-score-low",
  warning: "border-score-mid/40 bg-score-mid/5 [&_[data-icon]]:text-score-mid",
  info: "border-border bg-muted/30 [&_[data-icon]]:text-muted-foreground",
}

function Notice({
  icon,
  title,
  children,
  action,
  tone,
}: {
  tone: keyof typeof tones
  icon: ReactNode
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 text-[13px]",
        tones[tone]
      )}
      role={tone === "info" ? "status" : "alert"}
    >
      <span className="mt-0.5 shrink-0" data-icon>
        {icon}
      </span>
      <div className="min-w-0 flex-1 leading-5">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-muted-foreground">{children}</p>
      </div>
      {action}
    </div>
  )
}

/**
 * Bandeaux d'un run, au-dessus de ses résultats : corpus exploratoire
 * (CA-2, permanent), échec du dernier lancement (RG-6.1) et corpus modifié
 * depuis le calcul (CA-6.2).
 */
export function RunNotices({
  workspaceId,
  run,
  latestRun,
  corpusChanged,
}: {
  workspaceId: string
  run: AnalysisRun | null
  latestRun: AnalysisRun | null
  corpusChanged: boolean
}) {
  const { t } = useTranslation()
  const failed = latestRun?.status === "failed" ? latestRun : null
  return (
    <>
      {failed ? (
        <Notice
          action={
            <LaunchAnalysisButton
              label={t("evaluation.run.relaunch")}
              variant="outline"
              workspaceId={workspaceId}
            />
          }
          icon={<FileWarning className="size-4" />}
          tone="danger"
          title={t("evaluation.run.failedTitle")}
        >
          {failed.errorMessage ?? t("evaluation.run.failedDescription")}
          {run ? ` ${t("evaluation.run.previousResults")}` : null}
        </Notice>
      ) : null}
      {run && corpusChanged && !failed ? (
        <Notice
          action={
            <LaunchAnalysisButton
              label={t("evaluation.run.relaunch")}
              variant="outline"
              workspaceId={workspaceId}
            />
          }
          icon={<RefreshCw className="size-4" />}
          tone="info"
          title={t("evaluation.run.corpusChangedTitle")}
        >
          {t("evaluation.run.corpusChanged")}
        </Notice>
      ) : null}
      {run?.corpusLevel === "exploratoire" ? (
        <Notice
          icon={<AlertTriangle className="size-4" />}
          tone="warning"
          title={t("evaluation.run.exploratoryTitle")}
        >
          {t("corpus.criticalMass.exploratoryWarning", {
            count: run.corpusSize,
          })}
        </Notice>
      ) : null}
    </>
  )
}
