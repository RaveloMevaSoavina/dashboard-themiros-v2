import type { ExportFormat } from "@/features/exports/model/types"
import type { Persona } from "@/features/workspaces/model/types"
import { apiDownload } from "@/shared/lib/api"
import { supabase } from "@/shared/lib/supabase"

/**
 * Rapport d'un run termine, produit par l'API (catalogue §9) puis
 * telecharge. L'API journalise l'export ; le plan d'action est redige pour
 * le role de lecture courant.
 */
export async function exportRun(
  runId: string,
  format: ExportFormat,
  options: { locale: string; persona: Persona }
) {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const accessToken = data.session?.access_token
  if (!accessToken) throw new Error("NOT_AUTHENTICATED")

  const { blob, filename } = await apiDownload(
    `/api/v1/exports/${runId}/${format}`,
    {
      method: "POST",
      accessToken,
      fallbackName: `themiros-${runId.slice(0, 8)}.${format}`,
      body: JSON.stringify({
        locale: options.locale === "en" ? "en" : "fr",
        persona: options.persona,
      }),
    }
  )
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
  return filename
}
