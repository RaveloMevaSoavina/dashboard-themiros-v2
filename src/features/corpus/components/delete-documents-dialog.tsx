import { useMutation, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import type { CorpusDocument } from "@/features/corpus/model/types"
import { deleteDocument } from "@/features/corpus/services/corpus-service"
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

const listedNames = 5

/**
 * Confirmation de la suppression définitive d'un ou plusieurs documents :
 * fichier retiré du bucket, texte, segments et index supprimés.
 */
export function DeleteDocumentsDialog({
  documents,
  workspaceId,
  onClose,
  onDeleted,
}: {
  documents: CorpusDocument[] | null
  workspaceId: string
  onClose: () => void
  onDeleted?: (ids: string[]) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const items = documents ?? []
  const inCorpus = items.filter(
    (document) =>
      document.status === "conforme" ||
      document.status === "integre_decision_humaine"
  ).length

  const removal = useMutation({
    mutationFn: async (targets: CorpusDocument[]) => {
      const results = await Promise.allSettled(targets.map(deleteDocument))
      return targets.filter(
        (_, index) => results[index]?.status === "fulfilled"
      )
    },
    onSuccess: async (deleted, targets) => {
      const failed = targets.length - deleted.length
      if (deleted.length > 0) {
        // Avant le rafraîchissement : une fiche ouverte quitte la page au
        // lieu de recharger un document qui n'existe plus.
        onDeleted?.(deleted.map((document) => document.id))
        toast.success(t("corpus.delete.success", { count: deleted.length }))
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["corpus", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["workspaces", "list"] }),
      ])
      // Les documents non supprimés restent dans la liste : on peut relancer.
      if (failed > 0) {
        toast.error(t("corpus.delete.partial", { count: failed }))
      }
      onClose()
    },
  })

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open && !removal.isPending) onClose()
      }}
      open={documents !== null && documents.length > 0}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("corpus.delete.title", { count: items.length })}
          </DialogTitle>
          <DialogDescription>
            {t("corpus.delete.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3 pb-5">
          <ul className="space-y-1 rounded-lg border border-border px-3 py-2 text-[13px]">
            {items.slice(0, listedNames).map((document) => (
              <li className="truncate" key={document.id}>
                {document.filename}
              </li>
            ))}
            {items.length > listedNames ? (
              <li className="text-muted-foreground">
                {t("corpus.delete.more", {
                  count: items.length - listedNames,
                })}
              </li>
            ) : null}
          </ul>
          {inCorpus > 0 ? (
            <p className="text-[12px] leading-5">
              {t("corpus.delete.corpusWarning", { count: inCorpus })}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            disabled={removal.isPending}
            onClick={onClose}
            variant="outline"
          >
            {t("corpus.delete.cancel")}
          </Button>
          <Button
            disabled={removal.isPending}
            onClick={() => removal.mutate(items)}
            variant="destructive"
          >
            {removal.isPending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Trash2 />
            )}
            {t("corpus.delete.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
