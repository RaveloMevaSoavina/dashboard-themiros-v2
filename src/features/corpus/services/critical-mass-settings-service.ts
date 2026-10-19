import type { CriticalMassSettings } from "@/features/corpus/model/critical-mass"
import { supabase } from "@/shared/lib/supabase"

type SettingsRow = {
  version: number
  workspace_id: string | null
  exploratory_min_documents: number
  standard_min_documents: number
  defensible_min_documents: number
  min_independent_sources: number
  defensible_variable_coverage_pct: number
  saturation_document_cap: number
  saturation_min_mean_relevance: number
  note: string | null
  created_at: string
}

function toSettings(row: SettingsRow): CriticalMassSettings {
  return {
    version: row.version,
    workspaceId: row.workspace_id,
    exploratoryMinDocuments: row.exploratory_min_documents,
    standardMinDocuments: row.standard_min_documents,
    defensibleMinDocuments: row.defensible_min_documents,
    minIndependentSources: row.min_independent_sources,
    defensibleVariableCoveragePct: row.defensible_variable_coverage_pct,
    saturationDocumentCap: row.saturation_document_cap,
    saturationMinMeanRelevance: row.saturation_min_mean_relevance,
    note: row.note,
    createdAt: row.created_at,
  }
}

export type WorkspaceCriticalMassSettings = {
  /** Paramètres appliqués à l'espace. */
  current: CriticalMassSettings
  /** Valeurs par défaut de la plateforme. */
  defaults: CriticalMassSettings
  /** Versions propres à l'espace, de la plus récente à la plus ancienne. */
  history: CriticalMassSettings[]
}

export async function getCriticalMassSettings(
  workspaceId: string
): Promise<WorkspaceCriticalMassSettings | null> {
  const { data, error } = await supabase
    .from("critical_mass_settings")
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
