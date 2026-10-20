import type { LayerAScore, RunStep } from "@/features/evaluations/model/types"

/**
 * Un score par pilier : celui de la version de programme la plus récente.
 * Le run en produit un par pilier et par version (mode comparatif) ; la
 * vue d'ensemble lit la dernière version et son évolution.
 */
export function latestVersionScores(scores: readonly LayerAScore[]) {
  const latest = new Map<string, LayerAScore>()
  for (const score of scores) {
    const current = latest.get(score.pillarId)
    if (!current || score.versionOrder > current.versionOrder) {
      latest.set(score.pillarId, score)
    }
  }
  return [...latest.values()]
}

/** Scores d'un pilier, de la version la plus ancienne à la plus récente. */
export function pillarVersionScores(
  scores: readonly LayerAScore[],
  pillarId: string
) {
  return scores
    .filter((score) => score.pillarId === pillarId)
    .sort((left, right) => left.versionOrder - right.versionOrder)
}

/** Moyenne des scores calculés ; `null` si aucun pilier n'a de score. */
export function averageScore(scores: readonly LayerAScore[]) {
  const values = scores.flatMap((score) =>
    score.score === null ? [] : [score.score]
  )
  if (values.length === 0) return null
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length
  )
}

/**
 * Une couche est disponible si le moteur du run l'a calculée : une étape
 * `skipped` signale une couche pas encore livrée. Sans étapes (mode
 * démonstration), toutes les couches sont considérées disponibles.
 */
export function layerAvailable(
  steps: readonly RunStep[],
  name: "layer_b" | "layer_c"
) {
  const step = steps.find((item) => item.name === name)
  return step?.status !== "skipped"
}
