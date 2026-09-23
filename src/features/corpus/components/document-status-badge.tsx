import { useTranslation } from "react-i18next"

import type { DocumentStatus } from "@/features/corpus/model/types"
import { Badge } from "@/shared/ui/base/badge"

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const { t } = useTranslation()
  return (
    <Badge variant={status === "conforme" ? "default" : "outline"}>
      {t(`corpus.status.${status}`)}
    </Badge>
  )
}
