import type {
  IngestionSettings,
  IngestionSettingsValues,
} from "@/features/corpus/model/ingestion-settings"
import { toRequestError } from "@/features/corpus/services/corpus-service"
import { supabase } from "@/shared/lib/supabase"

type SettingsRow = {
  version: number
  workspace_id: string | null
  conformity_threshold: number
  ambiguous_threshold: number
  bonus_country: number
  bonus_financier: number
  bonus_theme: number
  bonus_language: number
  malus_off_topic: number
  malus_other_country: number
  language_confidence_threshold: number | string
  exploitable_page_min_chars: number
  off_topic_keywords: string[] | null
  max_file_size_bytes: number | string
  max_files_per_batch: number
  note: string | null
  created_at: string
}

function toSettings(row: SettingsRow): IngestionSettings {
  return {
    version: row.version,
    workspaceId: row.workspace_id,
    conformityThreshold: row.conformity_threshold,
    ambiguousThreshold: row.ambiguous_threshold,
    bonusCountry: row.bonus_country,
    bonusFinancier: row.bonus_financier,
    bonusTheme: row.bonus_theme,
    bonusLanguage: row.bonus_language,
    malusOffTopic: row.malus_off_topic,
    malusOtherCountry: row.malus_other_country,
    languageConfidenceThreshold: Number(row.language_confidence_threshold),
    exploitablePageMinChars: row.exploitable_page_min_chars,
    offTopicKeywords: row.off_topic_keywords ?? [],
    maxFileSizeBytes: Number(row.max_file_size_bytes),
    maxFilesPerBatch: row.max_files_per_batch,
    note: row.note,
    createdAt: row.created_at,
  }
}

function toRow(values: IngestionSettingsValues) {
  return {
    conformity_threshold: values.conformityThreshold,
    ambiguous_threshold: values.ambiguousThreshold,
    bonus_country: values.bonusCountry,
    bonus_financier: values.bonusFinancier,
    bonus_theme: values.bonusTheme,
    bonus_language: values.bonusLanguage,
    malus_off_topic: values.malusOffTopic,
    malus_other_country: values.malusOtherCountry,
    language_confidence_threshold: values.languageConfidenceThreshold,
    exploitable_page_min_chars: values.exploitablePageMinChars,
    off_topic_keywords: values.offTopicKeywords,
    max_file_size_bytes: values.maxFileSizeBytes,
    max_files_per_batch: values.maxFilesPerBatch,
  }
}

export type WorkspaceIngestionSettings = {
  /** Paramètres appliqués aux prochains contrôles de l'espace. */
  current: IngestionSettings
  /** Valeurs par défaut de la plateforme. */
  defaults: IngestionSettings
  /** Versions propres à l'espace, de la plus récente à la plus ancienne. */
  history: IngestionSettings[]
}

export async function getIngestionSettings(
  workspaceId: string
): Promise<WorkspaceIngestionSettings | null> {
  const { data, error } = await supabase
    .from("ingestion_settings")
    .select("*")
    .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
    .order("version", { ascending: false })
    .limit(50)

  if (error) throw error
  const rows = ((data ?? []) as SettingsRow[]).map(toSettings)
  const defaults = rows.find((row) => row.workspaceId === null)
  if (!defaults) return null
  const history = rows.filter((row) => row.workspaceId === workspaceId)
  return { current: history.at(0) ?? defaults, defaults, history }
}

/**
 * Crée une nouvelle version des paramètres de l'espace ; les documents sans
 * décision humaine sont requalifiés si les règles de décision changent.
 */
export async function updateIngestionSettings(
  workspaceId: string,
  values: IngestionSettingsValues,
  options: { note?: string; requalify: boolean }
): Promise<{ version: number; changed: boolean; requalified: number }> {
  const { data, error } = await supabase.rpc("update_ingestion_settings", {
    p_workspace_id: workspaceId,
    p_values: toRow(values),
    p_note: options.note?.trim() || null,
    p_requalify: options.requalify,
  })
  if (error) throw toRequestError(error)
  return data as { version: number; changed: boolean; requalified: number }
}
