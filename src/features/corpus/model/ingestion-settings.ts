import type { DocumentStatus } from "@/features/corpus/model/types"

/** Paramètres du contrôle d'ingestion (RG-5.4), versionnés par espace. */
export type IngestionSettingsValues = {
  conformityThreshold: number
  ambiguousThreshold: number
  bonusCountry: number
  bonusFinancier: number
  bonusTheme: number
  bonusLanguage: number
  malusOffTopic: number
  malusOtherCountry: number
  languageConfidenceThreshold: number
  exploitablePageMinChars: number
  offTopicKeywords: string[]
  maxFileSizeBytes: number
  maxFilesPerBatch: number
}

export type IngestionSettings = IngestionSettingsValues & {
  version: number
  /** `null` : valeurs par défaut de la plateforme. */
  workspaceId: string | null
  note: string | null
  createdAt: string
}

/** Le bucket `documents` refuse tout fichier au-delà de 50 Mo. */
export const maxUploadSizeBytes = 52_428_800
export const bytesPerMegabyte = 1_048_576

/** Limite de taille affichée en Mo entiers, comme dans les paramètres. */
export function formatSizeLimit(bytes: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "megabyte",
    maximumFractionDigits: 0,
  }).format(bytes / bytesPerMegabyte)
}

/** Valeurs de la spécification d'ingestion §7, utilisées avant chargement. */
export const defaultIngestionSettings: IngestionSettingsValues = {
  conformityThreshold: 70,
  ambiguousThreshold: 40,
  bonusCountry: 10,
  bonusFinancier: 5,
  bonusTheme: 5,
  bonusLanguage: 5,
  malusOffTopic: 20,
  malusOtherCountry: 30,
  languageConfidenceThreshold: 0.7,
  exploitablePageMinChars: 100,
  offTopicKeywords: [],
  maxFileSizeBytes: maxUploadSizeBytes,
  maxFilesPerBatch: 20,
}

export const ingestionSettingsFields = Object.keys(
  defaultIngestionSettings
) as (keyof IngestionSettingsValues)[]

/** Champs qui modifient la décision des documents déjà contrôlés. */
export const scoringFields: readonly (keyof IngestionSettingsValues)[] = [
  "conformityThreshold",
  "ambiguousThreshold",
  "bonusCountry",
  "bonusFinancier",
  "bonusTheme",
  "bonusLanguage",
  "malusOffTopic",
  "malusOtherCountry",
  "languageConfidenceThreshold",
  "offTopicKeywords",
]

export function pickSettingsValues(
  settings: IngestionSettingsValues
): IngestionSettingsValues {
  return Object.fromEntries(
    ingestionSettingsFields.map((field) => [field, settings[field]])
  ) as IngestionSettingsValues
}

export function changedSettingsFields(
  previous: IngestionSettingsValues,
  next: IngestionSettingsValues
) {
  return ingestionSettingsFields.filter(
    (field) => JSON.stringify(previous[field]) !== JSON.stringify(next[field])
  )
}

/** Zone de décision d'un score selon les seuils (spec §7.5). */
export function relevanceZone(
  score: number,
  settings: Pick<
    IngestionSettingsValues,
    "conformityThreshold" | "ambiguousThreshold"
  >
): Extract<DocumentStatus, "conforme" | "a_verifier" | "rejete"> {
  if (score >= settings.conformityThreshold) return "conforme"
  if (score >= settings.ambiguousThreshold) return "a_verifier"
  return "rejete"
}
