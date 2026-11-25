import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileWarning,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  EvidenceDocumentPanel,
  useDrawerDocument,
} from "@/features/evaluations/components/evidence-document-dialog"
import { EvidenceReading } from "@/features/evaluations/components/evidence-reading"
import type { Evidence } from "@/features/evaluations/model/types"
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
  interpretationExpected = false,
  onOpenChange,
}: {
  open: boolean
  evidences: Evidence[]
  confidence: number | null
  /** L'IA a lu les segments du run : une interpretation est attendue. */
  interpretationExpected?: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (open) setIndex(0)
  }, [open])
  const evidence = evidences[index]
  // Le document affiche a gauche suit la preuve courante.
  const viewer = useDrawerDocument(evidence ?? null, `${open}:${index}`)
  function go(step: number) {
    setIndex(
      (current) => (current + step + evidences.length) % evidences.length
    )
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 sm:max-w-xl! lg:w-full! lg:max-w-none! lg:flex-row lg:border-0! lg:bg-transparent lg:shadow-none">
        <EvidenceDocumentPanel
          evidence={viewer.evidence}
          onDismiss={() => onOpenChange(false)}
          spans={viewer.spans}
        />
        <div className="flex h-full w-full shrink-0 flex-col gap-4 bg-popover lg:w-xl lg:border-l lg:border-border lg:shadow-lg">
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
                  {evidence.documentName ??
                    t("evaluation.evidence.unavailable")}
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
                  {confidence === null
                    ? "—"
                    : `${Math.round(confidence * 100)}%`}
                </dd>
              </dl>
              <div className="py-5">
                <EvidenceReading
                  evidence={evidence}
                  interpretationExpected={interpretationExpected}
                  key={evidence.id}
                  onOpen={(spans) => viewer.show(evidence, spans)}
                />
              </div>
            </div>
          )}
          <SheetFooter className="border-t border-border">
            {evidences.length > 1 ? (
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => go(-1)} variant="outline">
                  <ChevronLeft /> {t("evaluation.evidence.previous")}
                </Button>
                <Button onClick={() => go(1)} variant="outline">
                  {t("evaluation.evidence.next")} <ChevronRight />
                </Button>
              </div>
            ) : null}
            <Button
              disabled={!evidence?.storagePath}
              onClick={() => evidence && viewer.show(evidence)}
            >
              <ExternalLink /> {t("evaluation.evidence.openDocument")}
            </Button>
          </SheetFooter>
        </div>
        {viewer.dialog}
      </SheetContent>
    </Sheet>
  )
}
