import { useTranslation } from "react-i18next"

import type { CorpusDocument } from "@/features/corpus/model/types"
import { cn } from "@/shared/lib/utils"

function useCountryName() {
  const { i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  return (code: unknown) => {
    if (typeof code !== "string" || !code) return "—"
    try {
      return (
        new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code
      )
    } catch {
      return code
    }
  }
}

/**
 * Motif du statut dans la langue de l'interface. Les messages imposés par la
 * spécification (pays différent, hors sujet, couverture partielle) sont
 * rendus à partir du code de motif et de ses paramètres.
 */
export function DocumentStatusMessage({
  document,
  className,
}: {
  document: CorpusDocument
  className?: string
}) {
  const { t } = useTranslation()
  const countryName = useCountryName()
  const params = document.statusReasonParams
  const code = document.statusReasonCode

  let message: string | null = null
  if (code === "country_mismatch") {
    message = t("corpus.messages.countryMismatch", {
      detected: countryName(params.detected),
      target: countryName(params.target),
    })
  } else if (code === "out_of_scope") {
    message = t("corpus.messages.outOfScope")
  } else if (code === "country_undetected") {
    message = t("corpus.messages.countryUndetected")
  } else if (code === "partial_coverage") {
    message = t("corpus.messages.partialCoverage", {
      n: params.n ?? document.exploitablePages ?? 0,
      total: params.total ?? document.totalPages ?? 0,
    })
  } else if (code === "human_add") {
    message = t("corpus.messages.humanAdd")
  } else if (code === "human_cancel") {
    message = t("corpus.messages.humanCancel")
  } else if (code === "ingestion_failed") {
    message = t(`corpus.ingestionErrors.${document.ingestionErrorCode}`, {
      defaultValue: t("corpus.ingestionErrors.default"),
    })
  } else if (code !== "pending") {
    message = document.statusReason
  }

  if (!message) return null
  return (
    <p
      className={cn(
        "rounded-lg bg-muted/50 px-3 py-2 text-[12px] leading-5",
        className
      )}
    >
      {message}
    </p>
  )
}
