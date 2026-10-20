import assert from "node:assert/strict"
import test from "node:test"
import { resources } from "../../../shared/i18n/resources.ts"
import {
  assessCriticalMass,
  defaultCriticalMassSettings,
  evaluateCriticalMass,
} from "./critical-mass.ts"
import type { DocumentStatus } from "./types.ts"

function documents(
  scores: (number | null)[],
  status: DocumentStatus = "conforme"
) {
  return scores.map((relevanceScore, index) => ({
    id: `doc-${index}`,
    status,
    relevanceScore,
  }))
}

test("sous le plancher exploratoire, aucun niveau n'est atteint", () => {
  const status = evaluateCriticalMass(
    documents([80, 80, 80, 80]),
    defaultCriticalMassSettings
  )
  assert.equal(status.counted, 4)
  assert.equal(status.floor, null)
})

test("les planchers 5 / 10 / 20 donnent le niveau de volume", () => {
  const floorFor = (count: number) =>
    evaluateCriticalMass(
      documents(Array(count).fill(80)),
      defaultCriticalMassSettings
    ).floor
  assert.equal(floorFor(5), "exploratoire")
  assert.equal(floorFor(9), "exploratoire")
  assert.equal(floorFor(10), "standard")
  assert.equal(floorFor(20), "defendable")
})

test("seuls les documents conformes ou intégrés sur décision humaine comptent", () => {
  const status = evaluateCriticalMass(
    [
      ...documents([80, 80, 80]),
      ...documents([55, 50], "integre_decision_humaine"),
      ...documents([20, 20, 20], "rejete"),
      ...documents([50], "a_verifier"),
    ],
    defaultCriticalMassSettings
  )
  assert.equal(status.counted, 5)
  assert.equal(status.floor, "exploratoire")
  assert.equal(status.meanRelevance, (80 * 3 + 55 + 50) / 5)
})

test("au-delà de 30 documents, les moins pertinents en excès sont proposés", () => {
  const scores = [...Array(29).fill(90), 72, 71, 70]
  const status = evaluateCriticalMass(
    documents(scores),
    defaultCriticalMassSettings
  )
  assert.deepEqual(status.warnings, ["corpus_volumineux"])
  assert.deepEqual(
    status.removalCandidates.map((document) => document.relevanceScore),
    [70, 71]
  )
})

test("exactement 30 documents ne déclenchent pas l'avertissement", () => {
  const status = evaluateCriticalMass(
    documents(Array(30).fill(80)),
    defaultCriticalMassSettings
  )
  assert.deepEqual(status.warnings, [])
  assert.deepEqual(status.removalCandidates, [])
})

test("sous 60 de pertinence moyenne, les documents sous 60 sont proposés", () => {
  const status = evaluateCriticalMass(
    [
      ...documents([75, 72]),
      ...documents([45, 50, 55, 62], "integre_decision_humaine"),
    ],
    defaultCriticalMassSettings
  )
  assert.ok((status.meanRelevance ?? 100) < 60)
  assert.deepEqual(status.warnings, ["pertinence_faible"])
  assert.deepEqual(
    status.removalCandidates.map((document) => document.relevanceScore),
    [45, 50, 55]
  )
})

test("les deux déclencheurs se cumulent sans doublon", () => {
  const scores = [...Array(25).fill(50), ...Array(10).fill(75)]
  const status = evaluateCriticalMass(
    documents(scores, "integre_decision_humaine"),
    defaultCriticalMassSettings
  )
  assert.deepEqual(status.warnings, ["corpus_volumineux", "pertinence_faible"])
  assert.equal(status.removalCandidates.length, 25)
})

test("un document sans score compte mais n'est jamais proposé au retrait", () => {
  const status = evaluateCriticalMass(
    documents([null, 40, 45, 50, 52], "integre_decision_humaine"),
    defaultCriticalMassSettings
  )
  assert.equal(status.counted, 5)
  assert.equal(status.meanRelevance, (40 + 45 + 50 + 52) / 4)
  assert.ok(
    status.removalCandidates.every(
      (document) => document.relevanceScore !== null
    )
  )
})

test("les paramètres de l'espace remplacent ceux de la note", () => {
  const status = evaluateCriticalMass(documents(Array(12).fill(65)), {
    ...defaultCriticalMassSettings,
    standardMinDocuments: 12,
    defensibleMinDocuments: 15,
    saturationDocumentCap: 15,
    saturationMinMeanRelevance: 70,
  })
  assert.equal(status.floor, "standard")
  assert.deepEqual(status.warnings, ["pertinence_faible"])
})

const pillar = (id: string, sources: number) => ({ id, label: id, sources })
const variable = (id: string, sources: number) => ({
  id,
  label: id,
  sources,
  pillarId: "p",
})

test("sans couverture calculée, le niveau s'arrête à Exploratoire", () => {
  for (const state of ["no_framework", "pending", "failed"] as const) {
    const result = assessCriticalMass(
      25,
      { state },
      defaultCriticalMassSettings
    )
    assert.equal(result.level, "exploratoire")
    assert.equal(result.gaps, null)
    assert.deepEqual(result.conditions.standard.coverage, { state: "unknown" })
  }
  assert.equal(
    assessCriticalMass(4, { state: "pending" }, defaultCriticalMassSettings)
      .level,
    null
  )
})

test("Standard exige 2 sources par pilier : sinon, la liste des piliers manquants", () => {
  const coverage = {
    state: "ready" as const,
    pillars: [
      pillar("Budget & absorption", 0),
      pillar("Genre & inclusion", 1),
      pillar("Suivi", 3),
    ],
    variables: [variable("v1", 2)],
  }
  const result = assessCriticalMass(12, coverage, defaultCriticalMassSettings)
  assert.equal(result.level, "exploratoire")
  assert.equal(result.gaps?.target, "standard")
  assert.equal(result.gaps?.floor, null)
  assert.deepEqual(
    result.gaps?.pillars.map((item) => [item.label, item.sources]),
    [
      ["Budget & absorption", 0],
      ["Genre & inclusion", 1],
    ]
  )
})

test("deux segments d'un même document comptent pour une seule source", () => {
  // La base compte les documents distincts : un pilier vu deux fois dans un
  // seul document arrive avec sources = 1.
  const result = assessCriticalMass(
    10,
    {
      state: "ready",
      pillars: [pillar("Budget", 1)],
      variables: [variable("v1", 1)],
    },
    defaultCriticalMassSettings
  )
  assert.equal(result.level, "exploratoire")
})

test("le plancher manquant figure dans les manques", () => {
  const result = assessCriticalMass(
    7,
    {
      state: "ready",
      pillars: [pillar("Budget", 2)],
      variables: [variable("v1", 2)],
    },
    defaultCriticalMassSettings
  )
  assert.deepEqual(result.gaps?.floor, { required: 10, counted: 7 })
  assert.deepEqual(result.gaps?.pillars, [])
})

test("Défendable exige 80 % des variables à 2 sources, en plus de Standard", () => {
  const pillars = [pillar("Budget", 3), pillar("Genre", 2)]
  const variables = [
    ...Array.from({ length: 7 }, (_, index) => variable(`ok${index}`, 2)),
    variable("une-source", 1),
    variable("aucune", 0),
    variable("autre", 0),
  ]
  const standard = assessCriticalMass(
    20,
    { state: "ready", pillars, variables },
    defaultCriticalMassSettings
  )
  assert.equal(standard.level, "standard")
  assert.equal(standard.gaps?.target, "defendable")
  assert.equal(standard.gaps?.variablesNeeded, 1)
  assert.deepEqual(
    standard.gaps?.variables.map((item) => item.label),
    ["une-source", "aucune", "autre"]
  )

  const defensible = assessCriticalMass(
    20,
    {
      state: "ready",
      pillars,
      variables: [
        ...variables.slice(0, 7),
        variable("une-source", 2),
        ...variables.slice(8),
      ],
    },
    defaultCriticalMassSettings
  )
  assert.equal(defensible.level, "defendable")
  assert.equal(defensible.gaps, null)
})

test("80 % des variables sans un pilier couvert ne donnent pas Défendable", () => {
  const result = assessCriticalMass(
    25,
    {
      state: "ready",
      pillars: [pillar("Budget", 2), pillar("Durabilité", 0)],
      variables: Array.from({ length: 5 }, (_, index) =>
        variable(`v${index}`, 2)
      ),
    },
    defaultCriticalMassSettings
  )
  assert.equal(result.level, "exploratoire")
  assert.equal(result.gaps?.target, "standard")
})

test("chaque niveau expose ses conditions pour la jauge", () => {
  const result = assessCriticalMass(
    12,
    {
      state: "ready",
      pillars: [pillar("Budget", 2), pillar("Genre", 1), pillar("Suivi", 3)],
      variables: [
        ...Array.from({ length: 6 }, (_, index) => variable(`ok${index}`, 2)),
        ...Array.from({ length: 4 }, (_, index) => variable(`ko${index}`, 0)),
      ],
    },
    defaultCriticalMassSettings
  )
  assert.deepEqual(result.conditions.exploratoire, {
    floor: { required: 5, met: true },
    coverage: null,
  })
  assert.deepEqual(result.conditions.standard, {
    floor: { required: 10, met: true },
    coverage: { state: "known", covered: 2, required: 3, total: 3, met: false },
  })
  assert.deepEqual(result.conditions.defendable, {
    floor: { required: 20, met: false },
    coverage: {
      state: "known",
      covered: 6,
      required: 8,
      total: 10,
      met: false,
    },
  })
})

test("T-11 : les messages imposés de l'étape E5 sont inchangés", () => {
  // Guide par fonctionnalité, F8 « Messages imposés » : la note de décision
  // sur la masse critique ne les modifie pas.
  const fr = resources.fr.translation.corpus.criticalMass
  assert.equal(fr.blockedTitle, "Analyse impossible")
  assert.equal(
    fr.blocked,
    "Analyse impossible. Le corpus actuel contient {{count}} document(s), soit insuffisant pour produire des résultats fiables. Themiros requiert un minimum de {{minimum}} documents pour ce type d'analyse. Ajoutez des documents pour continuer."
  )
  assert.equal(
    fr.exploratoryWarning,
    "Le corpus contient {{count}} documents. Les résultats sont indicatifs et ne doivent pas être utilisés comme base de décision formelle."
  )
  const en = resources.en.translation.corpus.criticalMass
  assert.equal(
    en.blocked,
    "Analysis not possible. The current corpus contains {{count}} document(s), which is not enough to produce reliable results. Themiros requires at least {{minimum}} documents for this type of analysis. Add documents to continue."
  )
})
