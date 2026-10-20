import assert from "node:assert/strict"
import test from "node:test"
import { averageScore, latestVersionScores, layerAvailable } from "./layer-a.ts"
import type { LayerAScore, RunStep } from "./types.ts"

function score(
  pillarId: string,
  versionOrder: number,
  value: number | null
): LayerAScore {
  return {
    id: `${pillarId}-${versionOrder}`,
    pillarId,
    pillarName: pillarId,
    criterionIds: [],
    score: value,
    delta: null,
    evolution: null,
    confidence: 0.5,
    documentsCount: 2,
    versionLabel: `Version ${versionOrder}`,
    versionOrder,
  }
}

const scores = [
  score("budget", 2, 80),
  score("budget", 1, 50),
  score("genre", 1, null),
  score("genre", 2, 40),
]

test("la vue d'ensemble lit la version la plus récente de chaque pilier", () => {
  assert.deepEqual(
    latestVersionScores(scores).map((item) => item.id),
    ["budget-2", "genre-2"]
  )
})

test("la moyenne ignore les piliers sans score", () => {
  assert.equal(averageScore([score("a", 1, 80), score("b", 1, null)]), 80)
  assert.equal(averageScore([score("a", 1, null)]), null)
})

test("une couche sautée par le moteur n'est pas disponible", () => {
  const steps: RunStep[] = [
    { name: "layer_b", status: "skipped", summary: null, errorMessage: null },
    { name: "layer_c", status: "completed", summary: null, errorMessage: null },
  ]
  assert.equal(layerAvailable(steps, "layer_b"), false)
  assert.equal(layerAvailable(steps, "layer_c"), true)
  assert.equal(layerAvailable([], "layer_b"), true)
})
