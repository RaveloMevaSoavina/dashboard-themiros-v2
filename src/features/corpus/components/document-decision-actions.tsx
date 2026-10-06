import { useMutation, useQueryClient } from "@tanstack/react-query"
import { RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { canAddAnyway, canCancel } from "@/features/corpus/model/ingestion"
import type { CorpusDocument } from "@/features/corpus/model/types"
import {
  decideDocument,
  IngestionRequestError,
  retryDocumentIngestion,
} from "@/features/corpus/services/corpus-service"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/base/button"

/**
 * Les trois options imposées pour un document ambigu ou rejeté (US-8.6,
 * US-8.7) : « Ajouter quand même », « Vérifier », « Annuler ». Un échec de
 * traitement propose une relance.
 */
export function DocumentDecisionActions({
  document,
  onVerify,
  className,
}: {
  document: CorpusDocument
  onVerify?: () => void
  className?: string
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["corpus", document.workspaceId],
    })
  const onError = (error: Error) =>
    toast.error(
      error instanceof IngestionRequestError
        ? t(`corpus.requestErrors.${error.code}`, {
            defaultValue: t("corpus.errors.update"),
          })
        : t("corpus.errors.update")
    )

  const decision = useMutation({
    mutationFn: (value: "add_anyway" | "cancel") =>
      decideDocument(document.id, value),
    onSuccess: async () => {
      await refresh()
      toast.success(t("corpus.review.decisionSaved"))
    },
    onError,
  })
  const retry = useMutation({
    mutationFn: () => retryDocumentIngestion(document.id),
    onSuccess: refresh,
    onError,
  })

  const addAnyway = canAddAnyway(document)
  const cancel = canCancel(document) && document.status === "a_verifier"
  const failed = document.processingState === "failed"
  if (!addAnyway && !cancel && !failed) return null

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {failed ? (
        <Button
          disabled={retry.isPending}
          onClick={() => retry.mutate()}
          size="sm"
          variant="outline"
        >
          <RotateCcw /> {t("corpus.import.retry")}
        </Button>
      ) : null}
      {addAnyway ? (
        <Button
          disabled={decision.isPending}
          onClick={() => decision.mutate("add_anyway")}
          size="sm"
        >
          {t("corpus.import.decision.addAnyway")}
        </Button>
      ) : null}
      {addAnyway && onVerify ? (
        <Button onClick={onVerify} size="sm" variant="outline">
          {t("corpus.import.decision.verify")}
        </Button>
      ) : null}
      {cancel ? (
        <Button
          disabled={decision.isPending}
          onClick={() => decision.mutate("cancel")}
          size="sm"
          variant="ghost"
        >
          {t("corpus.import.decision.cancel")}
        </Button>
      ) : null}
    </div>
  )
}
