import { useQuery } from "@tanstack/react-query"
import { ExternalLink, FileWarning, RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { getDocumentUrl } from "@/features/corpus/services/corpus-service"
import type { Evidence } from "@/features/evaluations/model/types"
import { getHighlightedDocument } from "@/features/evaluations/services/evidence-document-service"
import { Button } from "@/shared/ui/base/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/base/dialog"
import { Skeleton } from "@/shared/ui/base/skeleton"

/** Ouvre le fichier source d'une preuve dans un onglet, a la page citee. */
export async function openEvidenceDocument(evidence: Evidence) {
  if (!evidence.storagePath) return
  const url = await getDocumentUrl(evidence.storagePath)
  window.open(
    evidence.page ? `${url}#page=${evidence.page}` : url,
    "_blank",
    "noopener,noreferrer"
  )
}

/**
 * Ouvre le document d'une preuve : un PDF s'affiche dans l'app, le passage
 * surligne ; un DOCX ou un XLSX s'ouvre tel quel dans un onglet.
 */
export function useEvidenceDocument() {
  const [viewing, setViewing] = useState<Evidence | null>(null)
  function open(evidence: Evidence) {
    if (evidence.isPdf) setViewing(evidence)
    else void openEvidenceDocument(evidence)
  }
  const dialog = (
    <EvidenceDocumentDialog
      evidence={viewing}
      onOpenChange={(next) => {
        if (!next) setViewing(null)
      }}
    />
  )
  return { open, dialog }
}

/** PDF source d'une preuve, le passage cite surligne, ouvert a sa page. */
export function EvidenceDocumentDialog({
  evidence,
  onOpenChange,
}: {
  /** Preuve dont on lit le document ; `null` ferme la fenetre. */
  evidence: Evidence | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const pdf = useQuery({
    queryKey: ["evidence-document", evidence?.id],
    queryFn: () => getHighlightedDocument(evidence?.id ?? ""),
    enabled: Boolean(evidence),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 5 * 60 * 1000,
    retry: false,
  })
  const [url, setUrl] = useState<string | null>(null)
  const blob = pdf.data?.blob
  useEffect(() => {
    if (!blob) return
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => {
      URL.revokeObjectURL(next)
      setUrl(null)
    }
  }, [blob])

  const page = pdf.data?.page ?? evidence?.page ?? null

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(evidence)}>
      <DialogContent className="h-[calc(100dvh-2rem)] max-w-6xl gap-3 p-0 sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="truncate">
            {evidence?.documentName ?? t("evaluation.evidence.unavailable")}
          </DialogTitle>
          <DialogDescription>
            {[
              page ? `${t("evaluation.evidence.page")} ${page}` : null,
              evidence?.section,
              pdf.data && !pdf.data.highlighted
                ? t("evaluation.evidence.viewer.notHighlighted")
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 px-5 pb-5">
          {pdf.isError ? (
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-border px-8 text-center">
              <FileWarning className="size-7 text-muted-foreground" />
              <p className="mt-4 text-sm font-semibold">
                {t("evaluation.evidence.viewer.error")}
              </p>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => void pdf.refetch()} variant="outline">
                  <RotateCcw /> {t("workspaces.error.retry")}
                </Button>
                {evidence?.storagePath ? (
                  <Button
                    onClick={() => void openEvidenceDocument(evidence)}
                    variant="outline"
                  >
                    <ExternalLink /> {t("evaluation.evidence.viewer.original")}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : url ? (
            <iframe
              className="size-full rounded-xl border border-border bg-muted"
              key={url}
              src={page ? `${url}#page=${page}` : url}
              title={evidence?.documentName ?? t("evaluation.evidence.title")}
            />
          ) : (
            <Skeleton className="size-full rounded-xl" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
