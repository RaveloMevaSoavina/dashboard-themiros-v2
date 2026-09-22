import type {
  CriterionApplicability,
  EvaluationCycle,
  InstrumentModule,
  ReferenceLocale,
} from "@/features/evaluation-frameworks/model/types"

export type ApproachStatus = "proposed" | "modified" | "confirmed"
export type ComplexityClass = "simple" | "complique" | "complexe"
export type EvaluationNature =
  | "auto_evaluation"
  | "interne"
  | "externe_independante"
  | "conjointe"

export type RecommendedMethods = {
  engine: string[]
  off_engine: string[]
}

export type Approach = {
  id: string
  workspace_id: string
  version: number
  status: ApproachStatus
  ref_framework_id: string
  cycle: EvaluationCycle
  instrument_module: InstrumentModule
  instrument_subtype: string
  complexity_score: number
  complexity_class: ComplexityClass
  complexity_factors: Record<string, number>
  method_family: string
  recommended_methods: RecommendedMethods
  evaluation_nature: EvaluationNature
  questionnaire_answers: Record<string, unknown>
  justifications: Record<string, unknown>
  manual_overrides: Record<string, unknown>
  locale: ReferenceLocale
  created_by: string
  confirmed_by: string | null
  confirmed_at: string | null
  created_at: string
  updated_at: string
}

export type ApproachCriterion = {
  id: string
  approach_id: string
  ref_criterion_id: string
  applicability: CriterionApplicability
  weight: number
  source: "cycle" | "framework" | "nature" | "manual"
  manual_override: boolean
  created_at: string
  updated_at: string
}

export type ApproachEvent = {
  id: string
  approach_id: string
  workspace_id: string
  event_type: string
  actor_id: string | null
  previous_state: Record<string, unknown> | null
  next_state: Record<string, unknown> | null
  metadata: Record<string, unknown>
  created_at: string
}
