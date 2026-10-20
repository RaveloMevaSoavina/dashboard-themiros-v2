import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import type { AnalysisRun } from "@/features/evaluations/model/types"
import { isEvaluationDemo } from "@/features/evaluations/services/evaluation-demo"
import { getLatestRun } from "@/features/evaluations/services/evaluation-service"
import { useWorkspaces } from "@/features/workspaces/model/workspace-provider"

export function isRunActive(run: AnalysisRun | null | undefined) {
  return run?.status === "pending" || run?.status === "running"
}

/**
 * Suit le run en cours de l'espace actif, quel que soit l'écran ouvert, et
 * notifie sa fin (US-13.2) : l'analyse continue quand on quitte l'écran de
 * suivi. Le suivi ne sonde la base que tant qu'un run est actif.
 */
export function RunWatcher() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { activeWorkspace } = useWorkspaces()
  const workspaceId = activeWorkspace?.id ?? ""
  const latest = useQuery({
    queryKey: ["evaluation", workspaceId, "latest-run"],
    queryFn: () => getLatestRun(workspaceId),
    enabled: Boolean(workspaceId) && !isEvaluationDemo,
    refetchInterval: (query) => (isRunActive(query.state.data) ? 5000 : false),
  })
  const previous = useRef<AnalysisRun | null | undefined>(undefined)

  useEffect(() => {
    const run = latest.data
    const before = previous.current
    previous.current = run
    if (!run || !before || before.id !== run.id || !isRunActive(before)) return
    if (run.status === "completed") {
      toast.success(t("evaluation.run.completedToast"), {
        action: {
          label: t("evaluation.run.open"),
          onClick: () => void navigate(`/workspaces/${workspaceId}/analysis`),
        },
      })
    } else if (run.status === "failed") {
      toast.error(t("evaluation.run.failedToast"))
    }
    if (!isRunActive(run)) {
      void queryClient.invalidateQueries({
        queryKey: ["evaluation", workspaceId],
      })
    }
  }, [latest.data, navigate, queryClient, t, workspaceId])

  return null
}
