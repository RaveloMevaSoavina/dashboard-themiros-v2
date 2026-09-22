import type { ComputedApproach } from "@/features/evaluation-frameworks/model/approach-engine"
import type {
  Approach,
  ApproachCriterion,
  ApproachEvent,
} from "@/features/evaluation-frameworks/model/approach-types"
import type { ReferenceLocale } from "@/features/evaluation-frameworks/model/types"
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

export async function saveAndConfirmApproach(
  workspaceId: string,
  locale: ReferenceLocale,
  approach: ComputedApproach
): Promise<Approach> {
  const { data: proposal, error: proposalError } = await supabase.rpc(
    "save_approach_proposal",
    {
      target_workspace_id: workspaceId,
      target_ref_framework_id: approach.framework.id,
      target_cycle: approach.cycle,
      target_instrument_module: approach.instrumentModule,
      target_instrument_subtype: approach.instrumentSubtype,
      target_complexity_score: approach.complexityScore,
      target_complexity_class: approach.complexityClass,
      target_complexity_factors: approach.complexityFactors,
      target_recommended_methods: approach.recommendedMethods,
      target_evaluation_nature: approach.evaluationNature,
      target_questionnaire_answers: approach.questionnaire,
      target_justifications: approach.justifications,
      target_locale: locale,
      target_criteria: approach.criteria,
    }
  )

  if (proposalError) {
    throw proposalError
  }

  const savedProposal = proposal as Approach
  const { data: confirmed, error: confirmationError } = await supabase.rpc(
    "confirm_approach_and_generate",
    { target_approach_id: savedProposal.id }
  )

  if (confirmationError) {
    throw confirmationError
  }

  return confirmed as Approach
}

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
