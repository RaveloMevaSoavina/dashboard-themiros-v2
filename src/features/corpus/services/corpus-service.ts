import type {
  CorpusDocument,
  CorpusThreshold,
  DocumentCategory,
  DocumentEvent,
  DocumentStatus,
  ProgramVersion,
} from "@/features/corpus/model/types"
import { supabase } from "@/shared/lib/supabase"

type DocumentRow = {
  id: string
  workspace_id: string
  original_filename: string
  storage_path: string
  file_size_bytes: number
  mime_type: string
  category: DocumentCategory
  detected_language: string | null
  detected_country: string | null
  relevance_score: number | null
  status: DocumentStatus
  status_reason: string | null
  exploitable_pages: number | null
  total_pages: number | null
  integrated_by_human: boolean
  created_at: string
  document_versions?: {
    program_versions: ProgramVersion | null
  }[]
}

const documentSelect = `
  id, workspace_id, original_filename, storage_path, file_size_bytes,
  mime_type, category, detected_language, detected_country, relevance_score,
  status, status_reason, exploitable_pages, total_pages,
  integrated_by_human, created_at,
  document_versions (program_versions (id, label, year))
`

function toDocument(row: DocumentRow): CorpusDocument {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    filename: row.original_filename,
    storagePath: row.storage_path,
    fileSize: Number(row.file_size_bytes),
    mimeType: row.mime_type,
    category: row.category,
    language: row.detected_language,
    country: row.detected_country,
    relevanceScore: row.relevance_score,
    status: row.status,
    statusReason: row.status_reason,
    exploitablePages: row.exploitable_pages,
    totalPages: row.total_pages,
    integratedByHuman: row.integrated_by_human,
    createdAt: row.created_at,
    version: row.document_versions?.at(0)?.program_versions ?? null,
  }
}

export async function listDocuments(workspaceId: string) {
  const { data, error } = await supabase
    .from("documents")
    .select(documentSelect)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) throw error
  return ((data ?? []) as unknown as DocumentRow[]).map(toDocument)
}

export async function getDocument(workspaceId: string, documentId: string) {
  const { data, error } = await supabase
    .from("documents")
    .select(documentSelect)
    .eq("workspace_id", workspaceId)
    .eq("id", documentId)
    .is("deleted_at", null)
    .single()

  if (error) throw error
  return toDocument(data as unknown as DocumentRow)
}

export async function listProgramVersions(
  workspaceId: string
): Promise<ProgramVersion[]> {
  const { data, error } = await supabase
    .from("program_versions")
    .select("id, label, year")
    .eq("workspace_id", workspaceId)
    .order("order_index")

  if (error) throw error
  return (data ?? []) as ProgramVersion[]
}

export async function listCorpusThresholds(): Promise<CorpusThreshold[]> {
  const { data, error } = await supabase
    .from("corpus_thresholds")
    .select("analysis_type, minimum_documents, recommended_documents")
    .order("minimum_documents")

  if (error) throw error
  return (data ?? []).map((row) => ({
    type: row.analysis_type as CorpusThreshold["type"],
    minimum: row.minimum_documents,
    recommended: row.recommended_documents,
  }))
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

export async function uploadDocument(input: {
  workspaceId: string
  file: File
  category: DocumentCategory
  country: string
  versionId?: string
}) {
  const hash = await sha256(input.file)
  const documentId = crypto.randomUUID()
  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]+/g, "-")
  const storagePath = `${input.workspaceId}/${documentId}/${safeName}`
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, input.file, { contentType: input.file.type })

  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from("documents")
    .insert({
      id: documentId,
      workspace_id: input.workspaceId,
      original_filename: input.file.name,
      storage_path: storagePath,
      file_hash: hash,
      file_size_bytes: input.file.size,
      mime_type: input.file.type || "application/octet-stream",
      category: input.category,
      detected_country: input.country || null,
      status: "a_verifier",
      status_reason: "Traitement documentaire en attente",
    })
    .select(documentSelect)
    .single()

  if (error) {
    await supabase.storage.from("documents").remove([storagePath])
    throw error
  }

  if (input.versionId) {
    const { error: versionError } = await supabase
      .from("document_versions")
      .insert({ document_id: documentId, program_version_id: input.versionId })
    if (versionError) {
      await supabase.from("documents").delete().eq("id", documentId)
      await supabase.storage.from("documents").remove([storagePath])
      throw versionError
    }
  }

  await addDocumentEvent(documentId, "document_uploaded", input.file.name, {
    category: input.category,
    size: input.file.size,
  })

  return toDocument(data as unknown as DocumentRow)
}

async function addDocumentEvent(
  documentId: string,
  eventType: string,
  message: string,
  metadata: Record<string, unknown> = {}
) {
  const { data } = await supabase.auth.getUser()
  const { error } = await supabase.from("document_events").insert({
    document_id: documentId,
    event_type: eventType,
    message,
    actor_id: data.user?.id ?? null,
    metadata,
  })
  if (error) throw error
}

export async function updateDocumentCategory(
  documentId: string,
  category: DocumentCategory
) {
  const { error } = await supabase
    .from("documents")
    .update({ category })
    .eq("id", documentId)
  if (error) throw error
  await addDocumentEvent(documentId, "metadata_corrected", category)
}

export async function decideDocument(
  documentId: string,
  decision: "integrate" | "verify" | "reject"
) {
  const { data } = await supabase.auth.getUser()
  const now = new Date().toISOString()
  const values =
    decision === "integrate"
      ? {
          status: "integre_decision_humaine" as const,
          status_reason: "Intégré sur décision humaine",
          integrated_by_human: true,
          integrated_by_user_id: data.user?.id ?? null,
          integrated_at: now,
        }
      : decision === "reject"
        ? {
            status: "rejete" as const,
            status_reason: "Écarté lors de la revue documentaire",
            integrated_by_human: false,
          }
        : {
            status: "a_verifier" as const,
            status_reason: "Vérification manuelle demandée",
            integrated_by_human: false,
          }

  const { error } = await supabase
    .from("documents")
    .update(values)
    .eq("id", documentId)
  if (error) throw error
  await addDocumentEvent(
    documentId,
    `document_${decision}`,
    values.status_reason
  )
}

export async function listDocumentEvents(
  documentId: string
): Promise<DocumentEvent[]> {
  const { data, error } = await supabase
    .from("document_events")
    .select("id, event_type, message, created_at")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.event_type,
    message: row.message,
    createdAt: row.created_at,
  }))
}

export async function getDocumentUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}
