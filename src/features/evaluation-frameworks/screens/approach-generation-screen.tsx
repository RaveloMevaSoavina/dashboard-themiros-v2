import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"

import { processPillarGeneration } from "@/features/workspaces/services/pillar-generation-api"
import {
  getLatestPillarGenerationJob,
  getPillarGenerationJob,
  type PillarGenerationJob,
} from "@/features/workspaces/services/workspace-service"
import { Button } from "@/shared/ui/base/button"

export function ApproachGenerationScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const startedJobId = useRef<string | null>(null)
  const latestJob = useQuery({
    queryKey: ["workspaces", workspaceId, "pillar-generation", "latest"],
    queryFn: () => getLatestPillarGenerationJob(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const jobId = latestJob.data?.id ?? null
  const job = useQuery({
    queryKey: ["workspaces", "pillar-generation", jobId],
    queryFn: () => getPillarGenerationJob(jobId ?? ""),
    enabled: Boolean(jobId),
    initialData: latestJob.data ?? undefined,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "completed" || status === "failed" ? false : 1500
    },
  })
  const processing = useMutation({
    mutationFn: processPillarGeneration,
    onSettled: async (_data, _error, processedJob) => {
      await queryClient.invalidateQueries({
        queryKey: ["workspaces", "pillar-generation", processedJob.id],
      })
    },
  })

  useEffect(() => {
    const currentJob = job.data
    if (
      currentJob?.status === "queued" &&
      startedJobId.current !== currentJob.id &&
      !processing.isPending
    ) {
      startedJobId.current = currentJob.id
      processing.mutate(currentJob)
    }
  }, [job.data, processing])

  const retry = (currentJob: PillarGenerationJob) => {
    startedJobId.current = currentJob.id
    processing.mutate(currentJob)
  }
  const status = job.data?.status
  const missingJob = !latestJob.isPending && latestJob.data === null
  const failed =
    latestJob.isError || job.isError || status === "failed" || missingJob
  const completed = status === "completed"

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("approach.generation.eyebrow")}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {t("approach.generation.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] leading-6 text-muted-foreground">
          {t("approach.generation.description")}
        </p>
      </header>

      <section className="mt-8 rounded-xl border border-border p-6 sm:p-8">
        <div className="flex flex-col items-center py-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-border">
            {completed ? (
              <CheckCircle2 className="size-6" />
            ) : failed ? (
              <AlertTriangle className="size-6" />
            ) : (
              <Sparkles className="size-6" />
            )}
          </div>

          <h2 className="mt-5 text-lg font-semibold">
            {completed
              ? t("approach.generation.completed")
              : failed
                ? t("approach.generation.failed")
                : t("approach.generation.running")}
          </h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            {failed
              ? job.data?.error_message ||
                (missingJob
                  ? t("approach.generation.missingJob")
                  : t("approach.generation.failedHelp"))
              : completed
                ? t("approach.generation.completedHelp")
                : t("approach.generation.runningHelp")}
          </p>

          {!failed && !completed ? (
            <div className="mt-7 flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {status === "running"
                ? t("approach.generation.statusRunning")
                : t("approach.generation.statusQueued")}
            </div>
          ) : null}

          {failed && job.data ? (
            <Button
              className="mt-7"
              disabled={processing.isPending}
              onClick={() => retry(job.data)}
              variant="outline"
            >
              <RotateCcw />
              {t("approach.generation.retry")}
            </Button>
          ) : null}

          {missingJob ? (
            <Button
              className="mt-7"
              onClick={() =>
                void navigate(`/workspaces/${workspaceId}/approach`)
              }
              variant="outline"
            >
              {t("approach.generation.backToApproach")}
            </Button>
          ) : null}

          {completed ? (
            <Button
              className="mt-7"
              onClick={() =>
                void navigate(`/workspaces/${workspaceId}/approach/pillars`)
              }
            >
              {t("approach.generation.reviewPillars")}
              <ArrowRight />
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  )
}
