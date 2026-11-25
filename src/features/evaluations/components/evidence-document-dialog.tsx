import { useQuery } from "@tanstack/react-query"
import { ExternalLink, FileText, FileWarning, RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { getDocumentUrl } from "@/features/corpus/services/corpus-service"
import type { Evidence, Span } from "@/features/evaluations/model/types"
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
 * surligne ; un DOCX ou un XLSX s'ouvre tel quel dans un onglet. `spans` :
 * phrases citees par un texte de l'IA, seules surlignees.
 */
export function useEvidenceDocument() {
  const [viewing, setViewing] = useState<{
    evidence: Evidence
    spans: Span[]
  } | null>(null)
  function open(evidence: Evidence, spans: Span[] = []) {
    if (evidence.isPdf) setViewing({ evidence, spans })
    else void openEvidenceDocument(evidence)
  }
  const dialog = (
    <EvidenceDocumentDialog
      evidence={viewing?.evidence ?? null}
      onOpenChange={(next) => {
        if (!next) setViewing(null)
      }}
      spans={viewing?.spans}
    />
  )
  return { open, dialog }
}

/** PDF surligne d'une preuve : requete, URL blob et page citee. */
function useHighlightedPdf(evidence: Evidence | null, spans: Span[]) {
  const pdf = useQuery({
    queryKey: ["evidence-document", evidence?.id, spans],
    queryFn: () => getHighlightedDocument(evidence?.id ?? "", spans),
    enabled: Boolean(evidence?.isPdf),
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
  return { pdf, url, page }
}

/** Ligne de contexte du document : page, section, surlignage absent. */
function documentCaption(
  evidence: Evidence | null,
  page: number | null,
  highlighted: boolean | undefined,
  t: (key: string) => string
) {
  return (
    [
      page ? `${t("evaluation.evidence.page")} ${page}` : null,
      evidence?.section,
      highlighted === false
        ? t("evaluation.evidence.viewer.notHighlighted")
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || "—"
  )
}

/** Corps du lecteur : PDF dans un cadre, erreur avec repli, ou chargement. */
function PdfFrame({
  evidence,
  viewer,
}: {
  evidence: Evidence | null
  viewer: ReturnType<typeof useHighlightedPdf>
}) {
  const { t } = useTranslation()
  const { pdf, url, page } = viewer
  if (pdf.isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-border bg-popover px-8 text-center">
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
    )
  }
  if (!url) return <Skeleton className="size-full rounded-xl" />
  return (
    <iframe
      className="size-full rounded-xl border border-border bg-muted"
      key={url}
      src={page ? `${url}#page=${page}` : url}
      title={evidence?.documentName ?? t("evaluation.evidence.title")}
    />
  )
}

/** PDF source d'une preuve, le passage cite surligne, ouvert a sa page. */
export function EvidenceDocumentDialog({
  evidence,
  spans = [],
  onOpenChange,
}: {
  /** Preuve dont on lit le document ; `null` ferme la fenetre. */
  evidence: Evidence | null
  /** Phrases a surligner ; vide : celles de la preuve, sinon l'extrait. */
  spans?: Span[]
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const viewer = useHighlightedPdf(evidence, spans)

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(evidence)}>
      <DialogContent className="h-[calc(100dvh-2rem)] max-w-6xl gap-3 p-0 sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="truncate">
            {evidence?.documentName ?? t("evaluation.evidence.unavailable")}
          </DialogTitle>
          <DialogDescription>
            {documentCaption(
              evidence,
              viewer.page,
              viewer.pdf.data?.highlighted,
              t
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 px-5 pb-5">
          <PdfFrame evidence={evidence} viewer={viewer} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Document d'une preuve affiche a cote du drawer, dans la zone floutee
 * (grands ecrans) : PDF surligne a la page citee ; DOCX ou XLSX, un renvoi
 * vers le fichier d'origine. Un clic dans la marge floutee ferme le drawer.
 */
export function EvidenceDocumentPanel({
  evidence,
  spans = [],
  onDismiss,
}: {
  evidence: Evidence | null
  spans?: Span[]
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  const viewer = useHighlightedPdf(evidence, spans)

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: marge cliquable, la fermeture clavier passe par Echap
    // biome-ignore lint/a11y/useKeyWithClickEvents: idem
    <div
      className="hidden min-w-0 flex-1 p-6 lg:flex"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
    >
      {evidence ? (
        <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border border-border bg-popover p-4 shadow-lg">
          <div className="min-w-0 px-1">
            <p className="truncate text-sm font-medium">
              {evidence.documentName ?? t("evaluation.evidence.unavailable")}
            </p>
            <p className="truncate text-[12px] text-muted-foreground">
              {documentCaption(
                evidence,
                viewer.page,
                viewer.pdf.data?.highlighted,
                t
              )}
            </p>
          </div>
          <div className="min-h-0 flex-1">
            {evidence.isPdf ? (
              <PdfFrame evidence={evidence} viewer={viewer} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-border px-8 text-center">
                <FileText className="size-7 text-muted-foreground" />
                <p className="mt-4 text-sm font-semibold">
                  {t("evaluation.evidence.viewer.notPdf")}
                </p>
                {evidence.storagePath ? (
                  <Button
                    className="mt-4"
                    onClick={() => void openEvidenceDocument(evidence)}
                    variant="outline"
                  >
                    <ExternalLink /> {t("evaluation.evidence.viewer.original")}
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Ecran assez large pour lire le document a cote du drawer (`lg`). */
export function isWideScreen() {
  return window.matchMedia("(min-width: 64rem)").matches
}

/**
 * Document affiche a gauche d'un drawer de preuves : par defaut celui de
 * `fallback`, ou la preuve choisie (`show`) jusqu'au changement de
 * `resetKey`. Sur petit ecran, `show` ouvre la fenetre ou l'onglet habituels.
 */
export function useDrawerDocument(fallback: Evidence | null, resetKey: string) {
  const viewer = useEvidenceDocument()
  const [focus, setFocus] = useState<{
    evidence: Evidence
    spans: Span[]
  } | null>(null)
  const [key, setKey] = useState(resetKey)
  if (key !== resetKey) {
    setKey(resetKey)
    setFocus(null)
  }
  function show(evidence: Evidence, spans: Span[] = []) {
    if (!isWideScreen()) return viewer.open(evidence, spans)
    setFocus({ evidence, spans })
    if (!evidence.isPdf) viewer.open(evidence)
  }
  return {
    show,
    evidence: focus?.evidence ?? fallback,
    spans: focus?.spans ?? [],
    dialog: viewer.dialog,
  }
}
