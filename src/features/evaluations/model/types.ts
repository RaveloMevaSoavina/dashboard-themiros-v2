import type {
  CriterionApplicability,
  ObservableVariable,
} from "@/features/evaluation-frameworks/model/types"
import type { Persona } from "@/features/workspaces/model/types"

export type EvaluationPillar = {
  id: string
  name: string
  description: string
  weight: number
  origin: "referential" | "new"
  criteria: string[]
  variables: ObservableVariable[]
  /** Langue du nom et de la description affiches. */
  locale?: string
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
  expectedEvidence: string | null
  active: boolean
  origin: "referential" | "user"
}

export type AnalysisRun = {
  id: string
  status: "pending" | "running" | "completed" | "failed"
  corpusSize: number
  corpusLevel: "exploratoire" | "standard" | "defendable"
  createdAt: string
  completedAt: string | null
  errorCode: string | null
  errorMessage: string | null
}

/** Étapes nommées du pipeline (US-13.1), dans l'ordre d'exécution. */
export const runStepNames = [
  "classification",
  "variables",
  "layer_a",
  "layer_b",
  "layer_c",
  "restitution",
] as const

export type RunStepName = (typeof runStepNames)[number]

export type RunStep = {
  name: RunStepName
  /** `skipped` : étape non disponible dans ce moteur, ou non atteinte. */
  status: "pending" | "running" | "completed" | "failed" | "skipped"
  summary: Record<string, unknown> | null
  errorMessage: string | null
}

/** Raisons pour lesquelles une analyse ne peut pas être lancée (US-12.2). */
export const launchBlockers = [
  "FRAMEWORK_NOT_VALIDATED",
  "CRITERIA_NOT_CONFIRMED",
  "RUN_ALREADY_ACTIVE",
  "INSUFFICIENT_CORPUS",
  "CORPUS_NOT_READY",
] as const

export type LaunchBlocker = (typeof launchBlockers)[number]

export type LaunchCheck = {
  /** `null` : le lancement est possible. */
  blocker: LaunchBlocker | null
  detail: string | null
  corpusSize: number
  minimumDocuments: number
  corpusLevel: AnalysisRun["corpusLevel"] | null
}

export type LayerAScore = {
  id: string
  pillarId: string
  pillarName: string
  criterionIds: string[]
  /** `null` : aucune variable renseignée pour ce pilier et cette version. */
  score: number | null
  delta: number | null
  evolution: "renforce" | "maintenu" | "affaibli" | null
  confidence: number
  documentsCount: number
  versionLabel: string
  /** Rang de la version de programme : la plus récente a le plus grand. */
  versionOrder: number
}

export type IntermediateVariable = {
  id: string
  pillarId: string
  code: string
  label: string
  /** Ce que la variable observe, tel que défini dans le cadre. */
  description: string
  /** Poids de la variable dans le score du pilier (%). */
  weight: number | null
  /** 1 (présent), 0,5 (partiel) ; `null` si non renseignée. */
  value: number | null
  state: "present" | "partiel" | "absent" | "non_renseigne"
  documentsCount: number
  confidence: number | null
  versionLabel: string
  versionOrder: number
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
  /** `false` : ecart publie sans qualification par l'IA (gravite et
      message par defaut de la regle). */
  qualified: boolean
  status: "a_instruire" | "instruite"
  instructionComment: string | null
  pillarId: string | null
  pillarName: string | null
  criterionId: string | null
  criterionName: string | null
}

export type Evidence = {
  id: string
  documentId: string | null
  documentName: string | null
  storagePath: string | null
  page: number | null
  section: string | null
  excerpt: string
  pillarName: string | null
  criterionName: string | null
  variableCode: string | null
}

/** Ce qui fonde une puce de synthese ou une action, et ou la verifier. */
export type RestitutionOrigin = {
  type: "pillar" | "criterion" | "alert"
  id: string
  /** Pilier ou critere ; pour une alerte, son critere, sinon son pilier. */
  name: string | null
  /** Pilier de l'alerte : filtre de l'ecran des alertes. */
  pillarId: string | null
}

export type SynthesisSection = "progres" | "faiblesse" | "a_verifier"

export type SynthesisItem = {
  id: string
  section: SynthesisSection
  position: number
  text: string
  origin: RestitutionOrigin
}

export type ActionProjection = {
  text: string
  /** Raison, affichee apres « Recommandee parce que ». */
  justification: string
}

/** Action commune aux trois personas, reformulee pour chacun (RG-11.4). */
export type RunAction = {
  id: string
  position: number
  origin: RestitutionOrigin
  projections: Partial<Record<Persona, ActionProjection>>
}

export type Restitution = {
  /** `null` : conclusion non redigee (IA indisponible). */
  conclusion: string | null
  limits: {
    notConcluded: number
    criteria: number
    confidence: number
    /** La synthese ouvre par les limites du corpus (RG-11.1). */
    leads: boolean
  }
  /** `false` : libelles factuels, sans redaction par l'IA ni plan. */
  qualified: boolean
  items: SynthesisItem[]
  actions: RunAction[]
}

export type EvaluationResults = {
  /** Dernier run terminé : ses résultats sont ceux affichés. */
  run: AnalysisRun | null
  /** Run le plus récent, quel que soit son statut (en cours, échoué…). */
  latestRun: AnalysisRun | null
  layerA: LayerAScore[]
  layerB: LayerBNote[]
  alerts: LayerCAlert[]
  traceability: number
  /** Couches calculées par le moteur du run (B et C : sprints suivants). */
  layers: { b: boolean; c: boolean }
  /** Résumé de l'étape `layer_c` : écarts détectés par les règles et
      écarts infirmés par l'IA. `null` sans résumé (démonstration, ancien run). */
  layerCSummary: { detected: number; infirmed: number } | null
  /** Un document est entré au corpus ou en est sorti depuis le run (CA-6.2). */
  corpusChanged: boolean
}
