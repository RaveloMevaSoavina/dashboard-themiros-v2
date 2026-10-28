import { apiDownload } from "@/shared/lib/api"
import { supabase } from "@/shared/lib/supabase"

export type HighlightedDocument = {
  blob: Blob
  /** Page ou commence le passage, a defaut la page citee. */
  page: number | null
  /** Faux quand le passage n'a pas ete retrouve (page scannee, tableau). */
  highlighted: boolean
}

/**
 * PDF source d'une preuve, le passage cite surligne par l'API. L'API ne lit
 * le fichier qu'apres avoir lu la preuve au nom de l'utilisateur (RLS).
 */
export async function getHighlightedDocument(
  evidenceId: string
): Promise<HighlightedDocument> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const accessToken = data.session?.access_token
  if (!accessToken) throw new Error("NOT_AUTHENTICATED")

  const { blob, headers } = await apiDownload(
    `/api/v1/evidences/${evidenceId}/document`,
    { method: "GET", accessToken, fallbackName: "document.pdf" }
  )
  const page = Number(headers.get("X-Evidence-Page"))
  return {
    blob,
    page: Number.isInteger(page) && page > 0 ? page : null,
    highlighted: headers.get("X-Evidence-Highlighted") === "true",
  }
}
