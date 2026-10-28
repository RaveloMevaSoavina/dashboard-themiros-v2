import type {
  AiUsage,
  AiUsageByRun,
  AiUsageBySource,
} from "@/features/usage/model/types"
import { supabase } from "@/shared/lib/supabase"

type UsageRow = {
  total: {
    calls: number
    completion_tokens: number
    embedding_tokens: number
    total_tokens: number
    cost_eur: number | string
    since: string | null
  }
  sources: {
    source: AiUsageBySource["source"]
    kind: AiUsageBySource["kind"]
    models: string | null
    calls: number
    input_tokens: number | null
    output_tokens: number | null
    total_tokens: number
    cost_eur: number | string
    last_at: string
  }[]
  runs: {
    run_id: string
    created_at: string
    status: AiUsageByRun["status"]
    calls: number
    completion_tokens: number
    embedding_tokens: number
    cost_eur: number | string
  }[]
}

/**
 * Consommation IA de l'espace (registre `ai_usage`) : tokens factures par
 * OpenAI et cout calcule par l'API, au total, par source et par run.
 */
export async function getWorkspaceAiUsage(
  workspaceId: string
): Promise<AiUsage> {
  const { data, error } = await supabase.rpc("workspace_ai_usage", {
    p_workspace_id: workspaceId,
  })
  if (error) throw error
  const row = data as UsageRow
  return {
    total: {
      calls: Number(row.total.calls),
      completionTokens: Number(row.total.completion_tokens),
      embeddingTokens: Number(row.total.embedding_tokens),
      totalTokens: Number(row.total.total_tokens),
      costEur: Number(row.total.cost_eur),
      since: row.total.since,
    },
    sources: row.sources.map((source) => ({
      source: source.source,
      kind: source.kind,
      models: source.models,
      calls: Number(source.calls),
      inputTokens:
        source.input_tokens === null ? null : Number(source.input_tokens),
      outputTokens:
        source.output_tokens === null ? null : Number(source.output_tokens),
      totalTokens: Number(source.total_tokens),
      costEur: Number(source.cost_eur),
      lastAt: source.last_at,
    })),
    runs: row.runs.map((run) => ({
      runId: run.run_id,
      createdAt: run.created_at,
      status: run.status,
      calls: Number(run.calls),
      completionTokens: Number(run.completion_tokens),
      embeddingTokens: Number(run.embedding_tokens),
      costEur: Number(run.cost_eur),
    })),
  }
}
