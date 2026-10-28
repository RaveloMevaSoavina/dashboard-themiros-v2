/** Sources du registre `ai_usage`, dans l'ordre du parcours d'un espace. */
export const aiUsageSources = [
  "pillar_generation",
  "ingestion",
  "classification",
  "layer_b_search",
  "layer_b",
  "layer_c",
  "restitution",
] as const

export type AiUsageSource = (typeof aiUsageSources)[number]

export type AiUsageBySource = {
  source: AiUsageSource
  kind: "completion" | "embedding"
  models: string | null
  calls: number
  /** `null` : detail entree / sortie inconnu (generations anciennes). */
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number
  costEur: number
  lastAt: string
}

export type AiUsageByRun = {
  runId: string
  createdAt: string
  status: "pending" | "running" | "completed" | "failed"
  calls: number
  completionTokens: number
  embeddingTokens: number
  costEur: number
}

export type AiUsage = {
  total: {
    calls: number
    completionTokens: number
    embeddingTokens: number
    totalTokens: number
    costEur: number
    /** Premiere consommation enregistree ; `null` sans consommation. */
    since: string | null
  }
  sources: AiUsageBySource[]
  runs: AiUsageByRun[]
}
