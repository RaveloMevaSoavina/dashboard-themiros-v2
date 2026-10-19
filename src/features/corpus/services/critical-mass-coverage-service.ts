import type { FrameworkCoverage } from "@/features/corpus/model/critical-mass"
import {
  localizePillar,
  localizeVariable,
  type PillarTextRow,
  pillarTextSelect,
  type VariableTextRow,
  variableTextSelect,
} from "@/features/evaluations/services/evaluation-service"
import { supabase } from "@/shared/lib/supabase"

type CoverageResponse = {
  state: "no_framework" | "pending" | "failed" | "ready"
  framework_id?: string
  pillars?: { pillar_id: string; sources: number }[]
  variables?: {
    pillar_variable_id: string
    pillar_id: string
    sources: number
  }[]
}

type PillarRow = PillarTextRow & {
  id: string
  pillar_variables: (VariableTextRow & { id: string })[] | null
}

/**
 * Couverture du cadre validé (RG-5.5) : sources indépendantes par pilier et
 * par variable, avec les libellés dans la langue de l'interface.
 */
export async function getCriticalMassCoverage(
  workspaceId: string,
  locale: string
): Promise<FrameworkCoverage> {
  const { data, error } = await supabase.rpc("critical_mass_coverage", {
    p_workspace_id: workspaceId,
  })
  if (error) throw error
  const coverage = data as CoverageResponse
  if (coverage.state !== "ready" || !coverage.framework_id) {
    return { state: coverage.state === "ready" ? "pending" : coverage.state }
  }

  const { data: rows, error: pillarsError } = await supabase
    .from("pillars")
    .select(
      `id, ${pillarTextSelect}, pillar_variables(id, ${variableTextSelect})`
    )
    .eq("framework_id", coverage.framework_id)
  if (pillarsError) throw pillarsError
  const pillars = new Map<string, string>()
  const variables = new Map<string, string>()
  for (const row of (rows ?? []) as unknown as PillarRow[]) {
    pillars.set(row.id, localizePillar(row, locale).name)
    for (const variable of row.pillar_variables ?? []) {
      variables.set(variable.id, localizeVariable(variable, locale).label)
    }
  }

  return {
    state: "ready",
    pillars: (coverage.pillars ?? []).map((pillar) => ({
      id: pillar.pillar_id,
      label: pillars.get(pillar.pillar_id) ?? "—",
      sources: pillar.sources,
    })),
    variables: (coverage.variables ?? []).map((variable) => ({
      id: variable.pillar_variable_id,
      pillarId: variable.pillar_id,
      label: variables.get(variable.pillar_variable_id) ?? "—",
      sources: variable.sources,
    })),
  }
}
