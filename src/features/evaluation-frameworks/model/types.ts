import type { WorkspaceLanguage } from "@/features/workspaces/model/types"

export type ReferenceLocale = WorkspaceLanguage

export type EvaluationCycle =
  | "ex_ante"
  | "en_cours"
  | "mi_parcours"
  | "finale"
  | "ex_post"

export type InstrumentModule = "M1" | "M2" | "M3"

export type CriterionApplicability =
  | "obligatoire"
  | "optionnel"
  | "prospectif"
  | "non_applicable"

export type ReferenceFramework = {
  id: string
  financier_code: string
  code: string
  version: string
  label: string
  source: string
  year: number
  activated_criteria: Record<string, unknown>
  specific_angles: string[]
}

export type ObservableVariable = {
  code: string
  label: string
  description: string
}

export type ReferencePillar = {
  id: string
  module: InstrumentModule
  code: string
  version: string
  name: string
  description: string
  criteria_codes: string[]
  observable_variables: ObservableVariable[]
  applicable_cycles: EvaluationCycle[]
  default_weight: number
}

export type ReferenceCriterion = {
  id: string
  code: string
  version: string
  label: string
  description: string
  is_oecd_dac: boolean
  applicability: CriterionApplicability
  default_weight: number
}
