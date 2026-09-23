import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileWarning,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import type { Evidence } from "@/features/evaluations/model/types"
import { getDocumentUrl } from "@/features/corpus/services/corpus-service"
import { Button } from "@/shared/ui/base/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/base/sheet"

export function EvidenceDrawer({
  open,
  evidences,
  confidence,
  onOpenChange,
}: {
  open: boolean
  evidences: Evidence[]
  confidence: number | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (open) setIndex(0)
  }, [open])
  const evidence = evidences[index]

  async function openDocument() {
    if (!evidence?.storagePath) return
    const url = await getDocumentUrl(evidence.storagePath)
    window.open(
      evidence.page ? `${url}#page=${evidence.page}` : url,
      "_blank",
      "noopener,noreferrer"
    )
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full sm:max-w-xl!">
        <SheetHeader className="border-b border-border pr-12">
          <SheetTitle>{t("evaluation.evidence.title")}</SheetTitle>
          <SheetDescription>
            {evidences.length > 0
              ? t("evaluation.evidence.position", {
                  current: index + 1,
                  total: evidences.length,
                })
              : t("evaluation.evidence.unavailable")}
          </SheetDescription>
        </SheetHeader>
        {!evidence ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <FileWarning className="size-7 text-muted-foreground" />
            <p className="mt-4 text-sm font-semibold">
              {t("evaluation.evidence.unavailable")}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-border py-5 text-[13px]">
              <dt className="text-muted-foreground">
                {t("evaluation.evidence.document")}
              </dt>
              <dd>
                {evidence.documentName ?? t("evaluation.evidence.unavailable")}
              </dd>
              <dt className="text-muted-foreground">
                {t("evaluation.evidence.page")}
              </dt>
              <dd>{evidence.page ?? "—"}</dd>
              <dt className="text-muted-foreground">
                {t("evaluation.evidence.section")}
              </dt>
              <dd>{evidence.section ?? "—"}</dd>
              <dt className="text-muted-foreground">
                {t("evaluation.evidence.context")}
              </dt>
              <dd>
                {evidence.pillarName ??
                  evidence.criterionName ??
                  evidence.variableCode ??
                  "—"}
              </dd>
              <dt className="text-muted-foreground">
                {t("evaluation.evidence.confidence")}
              </dt>
              <dd>
                {confidence === null ? "—" : `${Math.round(confidence * 100)}%`}
              </dd>
            </dl>
            <div className="py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {t("evaluation.evidence.primary")}
              </p>
              <blockquote className="mt-3 border-l-2 border-foreground pl-4 text-[14px] leading-7">
                {evidence.excerpt}
              </blockquote>
            </div>
          </div>
        )}
        <SheetFooter className="border-t border-border">
          {evidences.length > 1 ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() =>
                  setIndex(
                    (current) =>
                      (current - 1 + evidences.length) % evidences.length
                  )
                }
                variant="outline"
              >
                <ChevronLeft /> {t("evaluation.evidence.previous")}
              </Button>
              <Button
                onClick={() =>
                  setIndex((current) => (current + 1) % evidences.length)
                }
                variant="outline"
              >
                {t("evaluation.evidence.next")} <ChevronRight />
              </Button>
            </div>
          ) : null}
          <Button
            disabled={!evidence?.storagePath}
            onClick={() => void openDocument()}
          >
            <ExternalLink /> {t("evaluation.evidence.openDocument")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
