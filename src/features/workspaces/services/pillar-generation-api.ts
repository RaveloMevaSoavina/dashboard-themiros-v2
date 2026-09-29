import type { PillarGenerationJob } from "@/features/workspaces/services/workspace-service"
import { apiRequest } from "@/shared/lib/api"
import { supabase } from "@/shared/lib/supabase"

type GeneratedPillarsResponse = {
  pillars: unknown[]
  rationale: string
  prompt_version: string
  tokens_used: number
  cost_eur: string | number
}

export async function processPillarGeneration(job: PillarGenerationJob) {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  const accessToken = data.session?.access_token
  if (!accessToken) {
    throw new Error("Missing Supabase access token")
  }

  return apiRequest<GeneratedPillarsResponse>(
    "/api/v1/frameworks/generate-pillars",
    {
      method: "POST",
      accessToken,
      body: JSON.stringify({
        workspace_id: job.workspace_id,
        approach_id: job.approach_id,
        job_id: job.id,
      }),
    }
  )
}
