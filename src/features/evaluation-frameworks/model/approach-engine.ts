import type {
  ComplexityClass,
  EvaluationNature,
  RecommendedMethods,
} from "@/features/evaluation-frameworks/model/approach-types"
import type {
  CriterionApplicability,
  EvaluationCycle,
  InstrumentModule,
  ReferenceFramework,
} from "@/features/evaluation-frameworks/model/types"
import type {
  ObjectType,
  Persona,
  WorkspaceStage,
} from "@/features/workspaces/model/types"

export type GeographicScale = "local" | "national" | "multi_country"
export type ActorCount = "one" | "two_to_three" | "four_plus"
export type BudgetRange = "under_5m" | "between_5m_50m" | "over_50m" | "unknown"
export type KnowledgeAnswer = "yes" | "no" | "unknown"
export type MonitoringDataAvailability = "yes" | "partial" | "no"
export type ObjectRelation =
  | "pilot"
  | "finance"
  | "mandated_evaluator"
  | "partner"
export type EvaluationPurpose =
  | "accountability"
  | "learning_steering"
  | "funding_decision"

export type ApproachQuestionnaire = {
  scale: GeographicScale
  actors: ActorCount
  budget: BudgetRange
  baseline: KnowledgeAnswer
  comparisonGroup: KnowledgeAnswer
  monitoringData: MonitoringDataAvailability
  relation: ObjectRelation
  purpose: EvaluationPurpose
}

export type ApproachFingerprint = {
  objectType: ObjectType
  financierCode: string
  financierCount: number
  themes: string[]
  stage: WorkspaceStage
  startYear: number
  endYear: number
  versionLabels: string[]
}

export type CriterionRule = {
  id: string
  code: string
  defaultWeight: number | null
  applicabilityByCycle: Record<EvaluationCycle, CriterionApplicability>
}

export type ApproachOverrides = Partial<{
  frameworkCode: string
  cycle: EvaluationCycle
  instrumentSubtype: string
  complexityClass: ComplexityClass
  evaluationNature: EvaluationNature
  recommendedMethods: RecommendedMethods
}>

export type RuleJustification = {
  rule: string
  inputs: Record<string, unknown>
  result: unknown
  overridden?: boolean
}

export type ComputedApproachCriterion = {
  refCriterionId: string
  code: string
  applicability: CriterionApplicability
  weight: number
  source: "cycle" | "framework" | "nature"
}

export type ComputedApproach = {
  framework: ReferenceFramework
  cycle: EvaluationCycle
  cycleProgression: number
  instrumentModule: InstrumentModule
  instrumentSubtype: string
  complexityScore: number
  complexityClass: ComplexityClass
  complexityFactors: Record<string, number>
  evaluationNature: EvaluationNature
  recommendedMethods: RecommendedMethods
  criteria: ComputedApproachCriterion[]
  questionnaire: ApproachQuestionnaire
  justifications: Record<string, RuleJustification>
  warnings: string[]
}

export type ComputeApproachInput = {
  fingerprint: ApproachFingerprint
  questionnaire: ApproachQuestionnaire
  persona: Persona
  frameworks: ReferenceFramework[]
  criteria: CriterionRule[]
  currentYear: number
  overrides?: ApproachOverrides
}

const evaluationCycles: EvaluationCycle[] = [
  "ex_ante",
  "en_cours",
  "mi_parcours",
  "finale",
  "ex_post",
]

const applicabilityValues: CriterionApplicability[] = [
  "obligatoire",
  "optionnel",
  "prospectif",
  "non_applicable",
]

function unique(values: string[]) {
  return [...new Set(values)]
}

function roundWeight(value: number) {
  return Math.round(value * 10_000) / 10_000
}

function readFrameworkCriterionOverride(
  framework: ReferenceFramework,
  criterionCode: string
) {
  const value = framework.activated_criteria[criterionCode]

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const override = value as Record<string, unknown>
  const status = applicabilityValues.includes(
    override.status as CriterionApplicability
  )
    ? (override.status as CriterionApplicability)
    : override.enabled === false
      ? "non_applicable"
      : undefined
  const weight =
    typeof override.weight === "number" && override.weight >= 0
      ? override.weight
      : undefined

  return status === undefined && weight === undefined
    ? null
    : { status, weight }
}

export function deriveQuestionnaireDefaults(
  persona: Persona
): Pick<ApproachQuestionnaire, "relation" | "purpose"> {
  if (persona === "decideur") {
    return { relation: "finance", purpose: "funding_decision" }
  }

  if (persona === "analyste") {
    return {
      relation: "mandated_evaluator",
      purpose: "learning_steering",
    }
  }

  return { relation: "pilot", purpose: "accountability" }
}

export function computeFramework(
  financierCode: string,
  frameworks: ReferenceFramework[],
  overrideCode?: string
) {
  const requestedCode = overrideCode?.trim()
  const matchingFrameworks = frameworks.filter((framework) =>
    requestedCode
      ? framework.code === requestedCode
      : framework.financier_code === financierCode
  )
  const fallbackFrameworks = frameworks.filter(
    (framework) => framework.financier_code === "OTHER"
  )
  const candidates =
    matchingFrameworks.length > 0 ? matchingFrameworks : fallbackFrameworks

  if (requestedCode && matchingFrameworks.length === 0) {
    throw new Error(`Unknown reference framework override: ${requestedCode}`)
  }

  const framework = [...candidates].sort(
    (first, second) =>
      second.year - first.year || second.version.localeCompare(first.version)
  )[0]

  if (!framework) {
    throw new Error("No reference framework is available")
  }

  return framework
}

function computeProgression(
  startYear: number,
  endYear: number,
  currentYear: number
) {
  if (endYear === startYear) {
    return currentYear < startYear ? 0 : 1
  }

  return Math.max(
    0,
    Math.min(1, (currentYear - startYear) / (endYear - startYear))
  )
}

export function computeCycle(
  fingerprint: ApproachFingerprint,
  currentYear: number,
  override?: EvaluationCycle
) {
  const progression = computeProgression(
    fingerprint.startYear,
    fingerprint.endYear,
    currentYear
  )
  let cycle: EvaluationCycle

  if (fingerprint.stage === "design" || fingerprint.startYear > currentYear) {
    cycle = "ex_ante"
  } else if (fingerprint.stage === "startup" || progression < 0.25) {
    cycle = "en_cours"
  } else if (fingerprint.stage === "implementation" && progression <= 0.75) {
    cycle = "mi_parcours"
  } else if (
    fingerprint.stage === "implementation" ||
    fingerprint.stage === "closing"
  ) {
    cycle = "finale"
  } else if (
    fingerprint.stage === "closed" &&
    fingerprint.endYear < currentYear - 1
  ) {
    cycle = "ex_post"
  } else {
    cycle = "finale"
  }

  return { cycle: override ?? cycle, progression }
}

export function computeInstrument(
  objectType: ObjectType,
  questionnaire: ApproachQuestionnaire,
  themeCount: number,
  overrideSubtype?: string
) {
  let module: InstrumentModule
  let subtype: string

  if (objectType === "program") {
    module = "M2"

    if (questionnaire.actors === "four_plus") {
      subtype = "programme_multi_acteurs"
    } else if (questionnaire.scale === "multi_country") {
      subtype = "programme_regional_multi_pays"
    } else if (questionnaire.scale === "national" && themeCount >= 2) {
      subtype = "programme_national_multisectoriel"
    } else {
      subtype = "programme_national_sectoriel"
    }
  } else if (objectType === "project") {
    module = "M3"
    subtype = "projet_operationnel"
  } else {
    module = "M1"
    subtype = "strategie_plan"
  }

  return { module, subtype: overrideSubtype ?? subtype }
}

export function computeComplexity(
  objectType: ObjectType,
  questionnaire: ApproachQuestionnaire,
  themeCount: number,
  overrideClass?: ComplexityClass
) {
  const factors = {
    scale:
      questionnaire.scale === "local"
        ? 0
        : questionnaire.scale === "national"
          ? 1
          : 2,
    actors:
      questionnaire.actors === "one"
        ? 0
        : questionnaire.actors === "two_to_three"
          ? 1
          : 2,
    themes: themeCount <= 1 ? 0 : themeCount <= 3 ? 1 : 2,
    objectType: objectType === "project" ? 0 : objectType === "program" ? 1 : 2,
    budget:
      questionnaire.budget === "under_5m"
        ? 0
        : questionnaire.budget === "over_50m"
          ? 2
          : 1,
  }
  const score = Object.values(factors).reduce((sum, value) => sum + value, 0)
  const computedClass: ComplexityClass =
    score <= 3 ? "simple" : score <= 6 ? "complique" : "complexe"

  return { score, factors, complexityClass: overrideClass ?? computedClass }
}

export function computeNature(
  relation: ObjectRelation,
  persona: Persona,
  financierCount: number,
  override?: EvaluationNature
) {
  let nature: EvaluationNature

  if (
    relation === "partner" ||
    (relation === "finance" && financierCount > 1)
  ) {
    nature = "conjointe"
  } else if (relation === "mandated_evaluator") {
    nature = "externe_independante"
  } else if (relation === "finance") {
    nature = "interne"
  } else if (persona === "analyste") {
    nature = "interne"
  } else {
    nature = "auto_evaluation"
  }

  return override ?? nature
}

export function computeMethods(
  complexity: ComplexityClass,
  cycle: EvaluationCycle,
  questionnaire: ApproachQuestionnaire,
  override?: RecommendedMethods
): RecommendedMethods {
  if (override) {
    return {
      engine: unique(override.engine),
      off_engine: unique(override.off_engine),
    }
  }

  const engine = ["contribution_analysis", "process_tracing", "coherence_check"]
  const offEngine: string[] = []
  const counterfactualPossible =
    questionnaire.baseline === "yes" &&
    questionnaire.comparisonGroup === "yes" &&
    questionnaire.monitoringData === "yes"
  const hasMonitoringData = questionnaire.monitoringData !== "no"

  if (cycle === "ex_ante") {
    return {
      engine: [
        "intervention_logic_analysis",
        "evaluability_assessment",
        "forecast_economic_analysis",
        "coherence_check",
      ],
      off_engine: [],
    }
  }

  if (counterfactualPossible) {
    if (complexity === "simple") {
      offEngine.push("difference_in_differences", "propensity_score_matching")
    } else if (complexity === "complique") {
      offEngine.push("quasi_experimental_by_component")
      engine.push("realist_evaluation")
    } else {
      offEngine.push("synthetic_control")
      engine.push("realist_evaluation")
    }
  } else if (hasMonitoringData) {
    if (complexity === "simple") {
      engine.push("before_after_indicator_comparison")
    } else {
      engine.push("realist_evaluation")
    }

    if (complexity === "complexe") {
      engine.push("outcome_harvesting")
    }
  } else if (complexity === "complexe") {
    engine.push("outcome_harvesting")
  }

  if (cycle === "en_cours" || cycle === "mi_parcours") {
    engine.push("process_evaluation")
  }

  if (cycle === "ex_post") {
    engine.push("sustainability_assessment")
  }

  if (questionnaire.purpose === "learning_steering") {
    engine.push("realist_evaluation")
  }

  return { engine: unique(engine), off_engine: unique(offEngine) }
}

function natureAccents(nature: EvaluationNature) {
  if (nature === "auto_evaluation") {
    return new Set(["gestion_adaptative", "efficacite"])
  }

  if (nature === "interne") {
    return new Set(["efficacite", "efficience", "durabilite"])
  }

  if (nature === "conjointe") {
    return new Set(["coherence"])
  }

  return new Set<string>()
}

export function computeCriteria(
  cycle: EvaluationCycle,
  nature: EvaluationNature,
  framework: ReferenceFramework,
  criterionRules: CriterionRule[]
): ComputedApproachCriterion[] {
  const accents = natureAccents(nature)
  const prepared = criterionRules.map((criterion) => {
    const cycleApplicability = criterion.applicabilityByCycle[cycle]
    const frameworkOverride = readFrameworkCriterionOverride(
      framework,
      criterion.code
    )
    const applicability =
      cycleApplicability === "non_applicable"
        ? cycleApplicability
        : (frameworkOverride?.status ?? cycleApplicability)
    const accented = accents.has(criterion.code)
    const baseWeight =
      applicability === "non_applicable"
        ? 0
        : (frameworkOverride?.weight ?? criterion.defaultWeight ?? 0) +
          (accented ? 5 : 0)

    return {
      refCriterionId: criterion.id,
      code: criterion.code,
      applicability,
      baseWeight,
      source: frameworkOverride
        ? ("framework" as const)
        : accented
          ? ("nature" as const)
          : ("cycle" as const),
    }
  })
  const active = prepared.filter(
    (criterion) => criterion.applicability !== "non_applicable"
  )
  const positiveTotal = active.reduce(
    (sum, criterion) => sum + criterion.baseWeight,
    0
  )
  const equalWeight = active.length > 0 ? 100 / active.length : 0
  let allocated = 0
  const lastActiveIndex = active.length - 1

  return prepared.map((criterion) => {
    if (criterion.applicability === "non_applicable") {
      return { ...criterion, weight: 0 }
    }

    const activeIndex = active.findIndex(
      (activeCriterion) => activeCriterion.code === criterion.code
    )
    const unroundedWeight =
      positiveTotal > 0
        ? (criterion.baseWeight / positiveTotal) * 100
        : equalWeight
    const weight =
      activeIndex === lastActiveIndex
        ? roundWeight(100 - allocated)
        : roundWeight(unroundedWeight)
    allocated += weight

    return {
      refCriterionId: criterion.refCriterionId,
      code: criterion.code,
      applicability: criterion.applicability,
      weight,
      source: criterion.source,
    }
  })
}

function detectWarnings(
  fingerprint: ApproachFingerprint,
  currentYear: number,
  cycle: EvaluationCycle
) {
  const warnings: string[] = []

  if (fingerprint.startYear > fingerprint.endYear) {
    warnings.push("start_year_after_end_year")
  }

  if (fingerprint.stage === "closed" && fingerprint.endYear >= currentYear) {
    warnings.push("closed_stage_with_non_past_end_year")
  }

  if (
    fingerprint.stage === "implementation" &&
    (cycle === "ex_ante" || cycle === "ex_post")
  ) {
    warnings.push("stage_cycle_conflict")
  }

  const latestLabel = fingerprint.versionLabels.at(-1)?.toLowerCase() ?? ""
  const labelSuggestsFinal = /(achèvement|completion|final)/.test(latestLabel)

  if (labelSuggestsFinal && cycle === "mi_parcours") {
    warnings.push("latest_version_label_cycle_conflict")
  }

  return warnings
}

export function computeApproach(input: ComputeApproachInput): ComputedApproach {
  const overrides = input.overrides ?? {}
  const framework = computeFramework(
    input.fingerprint.financierCode,
    input.frameworks,
    overrides.frameworkCode
  )
  const cycleResult = computeCycle(
    input.fingerprint,
    input.currentYear,
    overrides.cycle
  )
  const instrument = computeInstrument(
    input.fingerprint.objectType,
    input.questionnaire,
    input.fingerprint.themes.length,
    overrides.instrumentSubtype
  )
  const complexity = computeComplexity(
    input.fingerprint.objectType,
    input.questionnaire,
    input.fingerprint.themes.length,
    overrides.complexityClass
  )
  const nature = computeNature(
    input.questionnaire.relation,
    input.persona,
    input.fingerprint.financierCount,
    overrides.evaluationNature
  )
  const methods = computeMethods(
    complexity.complexityClass,
    cycleResult.cycle,
    input.questionnaire,
    overrides.recommendedMethods
  )
  const criteria = computeCriteria(
    cycleResult.cycle,
    nature,
    framework,
    input.criteria
  )

  return {
    framework,
    cycle: cycleResult.cycle,
    cycleProgression: cycleResult.progression,
    instrumentModule: instrument.module,
    instrumentSubtype: instrument.subtype,
    complexityScore: complexity.score,
    complexityClass: complexity.complexityClass,
    complexityFactors: complexity.factors,
    evaluationNature: nature,
    recommendedMethods: methods,
    criteria,
    questionnaire: input.questionnaire,
    warnings: detectWarnings(
      input.fingerprint,
      input.currentYear,
      cycleResult.cycle
    ),
    justifications: {
      framework: {
        rule: "RG-4.1",
        inputs: { financierCode: input.fingerprint.financierCode },
        result: framework.code,
        overridden: Boolean(overrides.frameworkCode),
      },
      cycle: {
        rule: "RG-4.2",
        inputs: {
          stage: input.fingerprint.stage,
          startYear: input.fingerprint.startYear,
          endYear: input.fingerprint.endYear,
          currentYear: input.currentYear,
          progression: cycleResult.progression,
        },
        result: cycleResult.cycle,
        overridden: Boolean(overrides.cycle),
      },
      instrument: {
        rule: "RG-4.3",
        inputs: {
          objectType: input.fingerprint.objectType,
          scale: input.questionnaire.scale,
          actors: input.questionnaire.actors,
          themeCount: input.fingerprint.themes.length,
        },
        result: instrument,
        overridden: Boolean(overrides.instrumentSubtype),
      },
      complexity: {
        rule: "RG-4.4",
        inputs: complexity.factors,
        result: {
          score: complexity.score,
          class: complexity.complexityClass,
        },
        overridden: Boolean(overrides.complexityClass),
      },
      nature: {
        rule: "RG-4.6",
        inputs: {
          relation: input.questionnaire.relation,
          persona: input.persona,
          financierCount: input.fingerprint.financierCount,
        },
        result: nature,
        overridden: Boolean(overrides.evaluationNature),
      },
      method: {
        rule: "RG-4.5",
        inputs: {
          complexity: complexity.complexityClass,
          cycle: cycleResult.cycle,
          baseline: input.questionnaire.baseline,
          comparisonGroup: input.questionnaire.comparisonGroup,
          monitoringData: input.questionnaire.monitoringData,
          purpose: input.questionnaire.purpose,
        },
        result: methods,
        overridden: Boolean(overrides.recommendedMethods),
      },
      criteria: {
        rule: "RG-4.7",
        inputs: {
          cycle: cycleResult.cycle,
          frameworkCode: framework.code,
          nature,
        },
        result: criteria.map(({ code, applicability, weight }) => ({
          code,
          applicability,
          weight,
        })),
      },
    },
  }
}

export function isEvaluationCycle(value: string): value is EvaluationCycle {
  return evaluationCycles.includes(value as EvaluationCycle)
}
