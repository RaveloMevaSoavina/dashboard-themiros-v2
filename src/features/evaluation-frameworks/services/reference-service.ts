import type {
  EvaluationCycle,
  InstrumentModule,
  ReferenceCriterion,
  ReferenceFramework,
  ReferenceLocale,
  ReferencePillar,
} from "@/features/evaluation-frameworks/model/types"
import { supabase } from "@/shared/lib/supabase"

export async function listReferenceFrameworks(
  locale: ReferenceLocale
): Promise<ReferenceFramework[]> {
  const { data, error } = await supabase.rpc("get_localized_ref_frameworks", {
    requested_locale: locale,
  })

  if (error) {
    throw error
  }

  return (data ?? []) as ReferenceFramework[]
}

export async function listReferencePillars(
  module: InstrumentModule,
  cycle: EvaluationCycle,
  locale: ReferenceLocale
): Promise<ReferencePillar[]> {
  const { data, error } = await supabase.rpc("get_localized_ref_pillars", {
    requested_module: module,
    requested_cycle: cycle,
    requested_locale: locale,
  })

  if (error) {
    throw error
  }

  return (data ?? []) as ReferencePillar[]
}

export async function listReferenceCriteria(
  cycle: EvaluationCycle,
  locale: ReferenceLocale
): Promise<ReferenceCriterion[]> {
  const { data, error } = await supabase.rpc("get_localized_ref_criteria", {
    requested_cycle: cycle,
    requested_locale: locale,
  })

  if (error) {
    throw error
  }

  return (data ?? []) as ReferenceCriterion[]
}
