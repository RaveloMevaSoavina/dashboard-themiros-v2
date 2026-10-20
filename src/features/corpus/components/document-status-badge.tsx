import { LoaderCircle } from "lucide-react"
import { useTranslation } from "react-i18next"

import { displayedStatus } from "@/features/corpus/model/ingestion"
import type { CorpusDocument } from "@/features/corpus/model/types"
import { Badge } from "@/shared/ui/base/badge"

export function DocumentStatusBadge({
  document,
}: {
  document: CorpusDocument
}) {
  const { t } = useTranslation()
  const status = displayedStatus(document)

  if (status === "processing") {
    return (
      <Badge
        title={t(`corpus.import.tracking.state.${document.processingState}`)}
        variant="secondary"
      >
        <LoaderCircle className="animate-spin" />
        {t("corpus.status.processing")}
      </Badge>
    )
  }
  return (
    <Badge
      variant={
        status === "conforme"
          ? "default"
          : status === "failed"
            ? "warning"
            : "outline"
      }
    >
      {t(`corpus.status.${status}`)}
    </Badge>
  )
}
