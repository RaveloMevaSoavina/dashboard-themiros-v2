import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { Loader2, Play } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import type { LaunchBlocker } from "@/features/evaluations/model/types"
import { isEvaluationDemo } from "@/features/evaluations/services/evaluation-demo"
import {
  getLaunchCheck,
  LaunchRefusedError,
  launchRun,
} from "@/features/evaluations/services/evaluation-service"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/base/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/base/tooltip"

/** Raison lisible d'un lancement impossible (US-12.2). */
export function launchBlockerMessage(
  t: TFunction,
  blocker: LaunchBlocker,
  detail: string | null
) {
  const [count, minimum] = (detail ?? "").split("/")
  return t(`evaluation.launch.blockers.${blocker}`, {
    detail: detail ?? "",
    count: Number(count) || 0,
    minimum: Number(minimum) || 0,
    context: detail ? "detail" : undefined,
  })
}

/**
 * Bouton « Lancer l'analyse » : actif si la base accepte le lancement,
 * désactivé avec la raison en infobulle sinon. Le corpus est figé au clic ;
 * le suivi prend le relais (US-12.3).
 */
export function LaunchAnalysisButton({
  workspaceId,
  label,
  variant = "default",
  className,
}: {
  workspaceId: string
  label?: string
  variant?: "default" | "outline"
  className?: string
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const check = useQuery({
    queryKey: ["evaluation", workspaceId, "launch-check"],
    queryFn: () => getLaunchCheck(workspaceId),
    enabled: Boolean(workspaceId) && !isEvaluationDemo,
  })
  const launch = useMutation({
    mutationFn: () => launchRun(workspaceId),
    onSuccess: () => {
      toast.success(t("evaluation.run.launched"))
      void queryClient.invalidateQueries({
        queryKey: ["evaluation", workspaceId],
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof LaunchRefusedError
          ? launchBlockerMessage(t, error.blocker, error.detail)
          : t("evaluation.run.launchError")
      )
      void queryClient.invalidateQueries({
        queryKey: ["evaluation", workspaceId, "launch-check"],
      })
    },
  })

  const reason = isEvaluationDemo
    ? t("evaluation.launch.demo")
    : check.data?.blocker
      ? launchBlockerMessage(t, check.data.blocker, check.data.detail)
      : check.isError
        ? t("evaluation.launch.checkError")
        : null
  const buttonLabel = label ?? t("evaluation.analysis.launch")
  if (!reason) {
    return (
      <Button
        className={className}
        disabled={check.isPending || launch.isPending}
        onClick={() => launch.mutate()}
        variant={variant}
      >
        {launch.isPending ? <Loader2 className="animate-spin" /> : <Play />}
        {buttonLabel}
      </Button>
    )
  }
  /* Bouton bloqué : `aria-disabled` plutôt que `disabled`, pour qu'il
     reste focalisable et que l'infobulle donne la raison au survol comme
     au clavier. */
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-disabled
          className={cn("cursor-not-allowed opacity-50", className)}
          variant={variant}
        >
          <Play />
          {buttonLabel}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  )
}
