import assert from "node:assert/strict"
import test from "node:test"
import {
  type ApproachQuestionnaire,
  type ComputeApproachInput,
  type CriterionRule,
  computeApproach,
  computeComplexity,
  computeCycle,
  computeFramework,
  computeInstrument,
  computeMethods,
  computeNature,
} from "./approach-engine.ts"
import type { ReferenceFramework } from "./types.ts"

const frameworks: ReferenceFramework[] = [
  {
    id: "framework-fida",
    financier_code: "FIDA",
    code: "FIDA_IOE_2026_09",
    version: "2026-09",
    label: "FIDA (IOE)",
    source: "IOE",
    year: 2026,
    activated_criteria: {
      pertinence: { weight: 10 },
      coherence: { weight: 15 },
      efficacite: { weight: 15 },
      efficience: { weight: 10 },
      impact: { weight: 15 },
      durabilite: { weight: 15 },
      equite: { weight: 15 },
      gestion_adaptative: { weight: 15 },
    },
    specific_angles: [],
  },
  {
    id: "framework-default",
    financier_code: "OTHER",
    code: "THEMIROS_DEFAULT_2026",
    version: "2026",
    label: "Themiros",
    source: "Themiros",
    year: 2026,
    activated_criteria: {},
    specific_angles: [],
  },
]

const criteria: CriterionRule[] = [
  ["pertinence", "obligatoire", "obligatoire"],
  ["coherence", "obligatoire", "obligatoire"],
  ["efficacite", "prospectif", "obligatoire"],
  ["efficience", "prospectif", "obligatoire"],
  ["impact", "prospectif", "optionnel"],
  ["durabilite", "prospectif", "obligatoire"],
  ["equite", "obligatoire", "obligatoire"],
  ["gestion_adaptative", "optionnel", "obligatoire"],
].map(([code, exAnte, midTerm], index) => ({
  id: `criterion-${index + 1}`,
  code,
  defaultWeight: null,
  applicabilityByCycle: {
    ex_ante: exAnte,
    en_cours: code === "impact" ? "non_applicable" : "optionnel",
    mi_parcours: midTerm,
    finale: midTerm,
    ex_post: "obligatoire",
  },
})) as CriterionRule[]

const questionnaire: ApproachQuestionnaire = {
  scale: "national",
  actors: "two_to_three",
  budget: "unknown",
  baseline: "yes",
  comparisonGroup: "unknown",
  monitoringData: "partial",
  relation: "pilot",
  purpose: "accountability",
}

const recipeInput: ComputeApproachInput = {
  fingerprint: {
    objectType: "program",
    financierCode: "FIDA",
    financierCount: 1,
    themes: ["agriculture", "water"],
    stage: "implementation",
    startYear: 2022,
    endYear: 2028,
    versionLabels: ["ProDoc 2022", "Revue mi-parcours 2025"],
  },
  questionnaire,
  persona: "pmu",
  frameworks,
  criteria,
  currentYear: 2026,
}

test("computes the documented FIDA mid-term recipe deterministically", () => {
  const first = computeApproach(recipeInput)
  const second = computeApproach(recipeInput)

  assert.deepEqual(first, second)
  assert.equal(first.framework.code, "FIDA_IOE_2026_09")
  assert.equal(first.cycle, "en_cours")
  assert.equal(first.cycleProgression, 4 / 6)
  assert.equal(first.instrumentModule, "M2")
  assert.equal(first.instrumentSubtype, "programme_national_multisectoriel")
  assert.equal(first.complexityScore, 5)
  assert.equal(first.complexityClass, "complique")
  assert.equal(first.evaluationNature, "auto_evaluation")
  assert.ok(first.recommendedMethods.engine.includes("realist_evaluation"))
  assert.ok(first.recommendedMethods.engine.includes("process_evaluation"))
  assert.equal(
    first.criteria.find((criterion) => criterion.code === "impact")
      ?.applicability,
    "non_applicable"
  )
  assert.equal(
    first.criteria.reduce((sum, criterion) => sum + criterion.weight, 0),
    100
  )
  assert.equal(
    first.criteria.find((criterion) => criterion.code === "pertinence")
      ?.source,
    "framework"
  )
  assert.equal(
    first.criteria.find((criterion) => criterion.code === "efficacite")
      ?.source,
    "nature"
  )
  assert.ok(
    (first.criteria.find((criterion) => criterion.code === "efficacite")
      ?.weight ?? 0) >
      (first.criteria.find((criterion) => criterion.code === "efficience")
        ?.weight ?? 0)
  )
})

test("uses the default framework for an unknown financier", () => {
  assert.equal(
    computeFramework("UNKNOWN", frameworks).code,
    "THEMIROS_DEFAULT_2026"
  )
})

test("forces prospective methods for an ex-ante evaluation", () => {
  const result = computeApproach({
    ...recipeInput,
    fingerprint: {
      ...recipeInput.fingerprint,
      stage: "design",
      startYear: 2027,
    },
  })

  assert.equal(result.cycle, "ex_ante")
  assert.deepEqual(result.recommendedMethods.off_engine, [])
  assert.ok(
    result.recommendedMethods.engine.includes("evaluability_assessment")
  )
  assert.equal(
    result.criteria.find((criterion) => criterion.code === "impact")
      ?.applicability,
    "prospectif"
  )
})

test("derives a joint evaluation for multiple financiers", () => {
  assert.equal(computeNature("finance", "decideur", 2), "conjointe")
})

test("preserves explicit method overrides", () => {
  const overridden = {
    engine: ["custom_method", "custom_method"],
    off_engine: ["external_method"],
  }

  assert.deepEqual(
    computeMethods("complexe", "ex_post", questionnaire, overridden),
    {
      engine: ["custom_method"],
      off_engine: ["external_method"],
    }
  )
})

test("applies every documented cycle boundary", () => {
  const cases = [
    ["design", 2026, 2030, "ex_ante"],
    ["pre_launch", 2025, 2030, "ex_ante"],
    ["implementation", 2022, 2028, "en_cours"],
    ["mid_term", 2022, 2028, "mi_parcours"],
    ["closing", 2022, 2026, "finale"],
    ["post_closure", 2018, 2022, "ex_post"],
  ] as const

  for (const [stage, startYear, endYear, expected] of cases) {
    assert.equal(
      computeCycle(
        {
          ...recipeInput.fingerprint,
          stage,
          startYear,
          endYear,
        },
        2026
      ).cycle,
      expected
    )
  }
})

test("applies instrument priority and complexity boundaries", () => {
  const multiActorQuestionnaire: ApproachQuestionnaire = {
    ...questionnaire,
    scale: "multi_country",
    actors: "four_plus",
    budget: "over_50m",
  }

  assert.equal(
    computeInstrument("program", multiActorQuestionnaire, 4).subtype,
    "programme_multi_acteurs"
  )
  assert.deepEqual(computeComplexity("policy", multiActorQuestionnaire, 4), {
    score: 10,
    factors: {
      scale: 2,
      actors: 2,
      themes: 2,
      objectType: 2,
      budget: 2,
    },
    complexityClass: "complexe",
  })
})

test("keeps non-applicable criteria at zero", () => {
  const result = computeApproach({
    ...recipeInput,
    fingerprint: {
      ...recipeInput.fingerprint,
      stage: "implementation",
      startYear: 2026,
      endYear: 2030,
    },
  })
  const impact = result.criteria.find(
    (criterion) => criterion.code === "impact"
  )

  assert.equal(impact?.applicability, "non_applicable")
  assert.equal(impact?.weight, 0)
  assert.equal(
    result.criteria.reduce((sum, criterion) => sum + criterion.weight, 0),
    100
  )
})

const counterfactualQuestionnaire: ApproachQuestionnaire = {
  ...questionnaire,
  baseline: "yes",
  comparisonGroup: "yes",
  monitoringData: "yes",
}

test("keeps only the causal chain contribution for a complicated counterfactual", () => {
  assert.deepEqual(
    computeMethods("complique", "finale", counterfactualQuestionnaire),
    {
      engine: ["contribution_analysis", "process_tracing", "coherence_check"],
      off_engine: ["quasi_experimental_by_component"],
    }
  )
})

test("recommends synthetic control only at national or multi-country scale", () => {
  assert.deepEqual(
    computeMethods("complexe", "finale", counterfactualQuestionnaire)
      .off_engine,
    ["synthetic_control"]
  )
  assert.deepEqual(
    computeMethods("complexe", "finale", {
      ...counterfactualQuestionnaire,
      scale: "local",
    }).off_engine,
    []
  )
})

test("adds a cost-effectiveness reading to a final evaluation with a known budget", () => {
  assert.ok(
    computeMethods("simple", "finale", {
      ...questionnaire,
      budget: "under_5m",
    }).engine.includes("cost_effectiveness_reading")
  )
  assert.ok(
    !computeMethods("simple", "finale", questionnaire).engine.includes(
      "cost_effectiveness_reading"
    )
  )
})

test("adds synthetic control to an ex-post evaluation when conditions are met", () => {
  assert.deepEqual(
    computeMethods("simple", "ex_post", counterfactualQuestionnaire).off_engine,
    [
      "difference_in_differences",
      "propensity_score_matching",
      "synthetic_control",
    ]
  )
  assert.deepEqual(
    computeMethods("simple", "ex_post", {
      ...counterfactualQuestionnaire,
      scale: "local",
    }).off_engine,
    ["difference_in_differences", "propensity_score_matching"]
  )
})
