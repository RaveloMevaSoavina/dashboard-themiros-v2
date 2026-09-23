import type {
  CriterionApplicability,
  ObservableVariable,
} from "@/features/evaluation-frameworks/model/types"

export type EvaluationPillar = {
  id: string
  name: string
  description: string
  weight: number
  origin: "referential" | "new"
  criteria: string[]
  variables: ObservableVariable[]
}

export type EvaluationCriterion = {
  id: string
  code: string
  name: string
  definition: string
  applicability: CriterionApplicability
  weight: number
  questions: EvaluationQuestion[]
}

export type EvaluationQuestion = {
  id: string
  code: string
  text: string
  layer: "A" | "B" | "A_B"
  expectedEvidence: string | null
  active: boolean
  origin: "referential" | "user"
}

export type AnalysisRun = {
  id: string
  status: "pending" | "running" | "completed" | "failed"
  corpusSize: number
  corpusLevel: "exploratoire" | "standard" | "approfondie"
  createdAt: string
  completedAt: string | null
  errorMessage: string | null
}

export type LayerAScore = {
  id: string
  pillarId: string
  pillarName: string
  criterionIds: string[]
  score: number
  delta: number | null
  evolution: "renforce" | "maintenu" | "affaibli" | null
  confidence: number
  documentsCount: number
  versionLabel: string
}

export type IntermediateVariable = {
  id: string
  pillarId: string
  code: string
  label: string
  state: "present" | "partiel" | "absent" | "non_renseigne"
  documentsCount: number
  confidence: number | null
  versionLabel: string
}

export type LayerBNote = {
  id: string
  criterionId: string
  criterionName: string
  note: number | null
  status: "conclu" | "non_conclu"
  documented: number
  total: number
  justification: string | null
  ambiguous: boolean
  answers: SubAnswer[]
}

export type SubAnswer = {
  id: string
  questionId: string
  text: string
  status: "documentee" | "non_documentee"
}

export type LayerCAlert = {
  id: string
  type: string
  severity: "mineure" | "majeure"
  message: string
  status: "a_instruire" | "instruite"
  instructionComment: string | null
  pillarId: string | null
  pillarName: string | null
  criterionId: string | null
  criterionName: string | null
}

export type Evidence = {
  id: string
  documentId: string
  documentName: string | null
  storagePath: string | null
  page: number | null
  section: string | null
  excerpt: string
  pillarName: string | null
  criterionName: string | null
  variableCode: string | null
}

export type EvaluationResults = {
  run: AnalysisRun | null
  layerA: LayerAScore[]
  layerB: LayerBNote[]
  alerts: LayerCAlert[]
  traceability: number
}
