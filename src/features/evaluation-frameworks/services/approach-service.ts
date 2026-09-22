import type {
  Approach,
  ApproachCriterion,
  ApproachEvent,
} from "@/features/evaluation-frameworks/model/approach-types"
import { supabase } from "@/shared/lib/supabase"

const approachSelect = `
  id,
  workspace_id,
  version,
  status,
  ref_framework_id,
  cycle,
  instrument_module,
  instrument_subtype,
  complexity_score,
  complexity_class,
  complexity_factors,
  method_family,
  recommended_methods,
  evaluation_nature,
  questionnaire_answers,
  justifications,
  manual_overrides,
  locale,
  created_by,
  confirmed_by,
  confirmed_at,
  created_at,
  updated_at
`

export async function getApproach(approachId: string): Promise<Approach> {
  const { data, error } = await supabase
    .from("approaches")
    .select(approachSelect)
    .eq("id", approachId)
    .single()

  if (error) {
    throw error
  }

  return data as Approach
}

export async function getLatestWorkspaceApproach(
  workspaceId: string
): Promise<Approach | null> {
  const { data, error } = await supabase
    .from("approaches")
    .select(approachSelect)
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data as Approach | null
}

export async function listApproachCriteria(
  approachId: string
): Promise<ApproachCriterion[]> {
  const { data, error } = await supabase
    .from("approach_criteria")
    .select(
      "id, approach_id, ref_criterion_id, applicability, weight, source, manual_override, created_at, updated_at"
    )
    .eq("approach_id", approachId)
    .order("created_at")

  if (error) {
    throw error
  }

  return (data ?? []) as ApproachCriterion[]
}

export async function listApproachEvents(
  approachId: string
): Promise<ApproachEvent[]> {
  const { data, error } = await supabase
    .from("approach_events")
    .select(
      "id, approach_id, workspace_id, event_type, actor_id, previous_state, next_state, metadata, created_at"
    )
    .eq("approach_id", approachId)
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as ApproachEvent[]
}
