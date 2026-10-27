import { useMutation, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle, ShieldCheck } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import type { AnalysisRun } from "@/features/evaluations/model/types"
import {
  ValidationRefusedError,
  validateRun,
} from "@/features/evaluations/services/evaluation-service"
import { Button } from "@/shared/ui/base/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/base/dialog"

/** Mention « validé par [nom] le [date] » d'un run (GF-6). */
export function RunValidationMention({
  validation,
}: {
  validation: NonNullable<AnalysisRun["validation"]>
}) {
  const { t } = useTranslation()
  return (
    <p className="inline-flex items-center gap-1.5 text-[12px] font-medium">
      <ShieldCheck className="size-4 shrink-0" />
      {t("evaluation.validation.validatedBy", {
        name: validation.by ?? t("evaluation.validation.unknownMember"),
        date: new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(validation.at)),
      })}
    </p>
  )
}

/**
 * Validation humaine finale du run affiché (GF-6) : définitive et
 * journalisée. Impossible sur des résultats désactivés par un corpus modifié
 * (CA-6.2) ; les alertes encore à instruire sont rappelées sans bloquer.
 */
export function RunValidation({
  workspaceId,
  run,
  stale,
  pendingAlerts,
}: {
  workspaceId: string
  run: AnalysisRun
  stale: boolean
  pendingAlerts: number
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const validation = useMutation({
    mutationFn: () => validateRun(run.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["evaluation", workspaceId],
      })
      toast.success(t("evaluation.validation.saved"))
      setOpen(false)
    },
    onError: async (error) => {
      if (error instanceof ValidationRefusedError) {
        toast.error(t(`evaluation.validation.refused.${error.refusal}`))
        await queryClient.invalidateQueries({
          queryKey: ["evaluation", workspaceId],
        })
        setOpen(false)
        return
      }
      toast.error(t("evaluation.validation.saveError"))
    },
  })

  if (run.validation)
    return <RunValidationMention validation={run.validation} />
  const exploratory = run.corpusLevel === "exploratoire"
  return (
    <>
      <Button
        disabled={stale}
        onClick={() => setOpen(true)}
        title={stale ? t("evaluation.validation.staleHint") : undefined}
      >
        <ShieldCheck /> {t("evaluation.validation.action")}
      </Button>
      <Dialog
        onOpenChange={(next) => {
          if (!validation.isPending) setOpen(next)
        }}
        open={open}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("evaluation.validation.title")}</DialogTitle>
            <DialogDescription>
              {t("evaluation.validation.description")}
            </DialogDescription>
          </DialogHeader>
          {exploratory || pendingAlerts > 0 ? (
            <DialogBody className="space-y-3 pb-5 text-[13px] leading-5">
              {exploratory ? (
                <p>{t("evaluation.validation.exploratoryWarning")}</p>
              ) : null}
              {pendingAlerts > 0 ? (
                <p>
                  {t("evaluation.validation.pendingAlerts", {
                    count: pendingAlerts,
                  })}
                </p>
              ) : null}
            </DialogBody>
          ) : null}
          <DialogFooter>
            <Button
              disabled={validation.isPending}
              onClick={() => setOpen(false)}
              variant="outline"
            >
              {t("evaluation.validation.cancel")}
            </Button>
            <Button
              disabled={validation.isPending}
              onClick={() => validation.mutate()}
            >
              {validation.isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <ShieldCheck />
              )}
              {t("evaluation.validation.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
