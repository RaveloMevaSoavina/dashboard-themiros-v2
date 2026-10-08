import { ExternalLink, FileText, FileWarning, RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"

import { getDocumentUrl } from "@/features/corpus/services/corpus-service"
import type { Evidence, LayerAScore } from "@/features/evaluations/model/types"
import { Button } from "@/shared/ui/base/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/base/sheet"
import { Skeleton } from "@/shared/ui/base/skeleton"

/** Ouvre le document source d'une preuve, a la page citee si connue. */
export async function openEvidenceDocument(evidence: Evidence) {
  if (!evidence.storagePath) return
  const url = await getDocumentUrl(evidence.storagePath)
  window.open(
    evidence.page ? `${url}#page=${evidence.page}` : url,
    "_blank",
    "noopener,noreferrer"
  )
}

/** Toutes les preuves qui fondent la note d'un pilier, listees d'un bloc. */
export function PillarEvidenceDrawer({
  score,
  evidences,
  isLoading,
  isError,
  onRetry,
  onOpenChange,
}: {
  /** Pilier dont on lit les preuves ; `null` ferme le drawer. */
  score: LayerAScore | null
  evidences: Evidence[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()

  return (
    <Sheet onOpenChange={onOpenChange} open={Boolean(score)}>
      <SheetContent className="w-full sm:max-w-xl!">
        <SheetHeader className="border-b border-border pr-12">
          <SheetTitle>{score?.pillarName}</SheetTitle>
          <SheetDescription>
            {score
              ? t("evaluation.evidence.pillarSummary", {
                  count: evidences.length,
                  score: Math.round(score.score),
                  confidence: Math.round(score.confidence * 100),
                })
              : null}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <FileWarning className="size-7 text-muted-foreground" />
            <p className="mt-4 text-sm font-semibold">
              {t("evaluation.evidence.loadError")}
            </p>
            <Button className="mt-4" onClick={onRetry} variant="outline">
              <RotateCcw /> {t("workspaces.error.retry")}
            </Button>
          </div>
        ) : evidences.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <FileWarning className="size-7 text-muted-foreground" />
            <p className="mt-4 text-sm font-semibold">
              {t("evaluation.evidence.noneForScore")}
            </p>
          </div>
        ) : (
          <ol className="flex-1 space-y-3 overflow-y-auto p-5">
            {evidences.map((evidence, index) => (
              <li
                className="rounded-xl border border-border p-4"
                key={evidence.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">
                        {evidence.documentName ??
                          t("evaluation.evidence.unavailable")}
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {[
                          evidence.page
                            ? `${t("evaluation.evidence.page")} ${evidence.page}`
                            : null,
                          evidence.section,
                          evidence.criterionName ?? evidence.variableCode,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {index + 1}/{evidences.length}
                  </span>
                </div>
                <blockquote className="mt-3 border-l-2 border-foreground pl-4 text-[13px] leading-6">
                  {evidence.excerpt}
                </blockquote>
                <Button
                  className="mt-3"
                  disabled={!evidence.storagePath}
                  onClick={() => void openEvidenceDocument(evidence)}
                  size="sm"
                  variant="outline"
                >
                  <ExternalLink /> {t("evaluation.evidence.openDocument")}
                </Button>
              </li>
            ))}
          </ol>
        )}
      </SheetContent>
    </Sheet>
  )
}
