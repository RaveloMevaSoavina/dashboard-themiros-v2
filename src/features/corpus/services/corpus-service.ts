import type {
  CorpusDocument,
  DocumentCategory,
  DocumentEvent,
  DocumentStatus,
  IngestionState,
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
  status_reason_code: string | null
  status_reason_params: Record<string, unknown> | null
  processing_state: IngestionState
  language_to_confirm: boolean
  language_expected: boolean | null
  ingestion_error_code: string | null
  indexed_at: string | null
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
  status, status_reason, status_reason_code, status_reason_params,
  processing_state, language_to_confirm, language_expected,
  ingestion_error_code, indexed_at, exploitable_pages, total_pages,
  integrated_by_human, created_at,
  document_versions (program_versions (id, label, year))
`

/** Les formats acceptés par le bucket `documents` (spec §4.1). */
const mimeTypes: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

/** Erreur métier levée par une fonction Supabase (`INGESTION_LOCKED`...). */
export class IngestionRequestError extends Error {
  readonly code: string
  readonly detail: string | null

  constructor(code: string, detail: string | null = null) {
    super(code)
    this.name = "IngestionRequestError"
    this.code = code
    this.detail = detail
  }
}

export function toRequestError(error: {
  message?: string
  details?: string | null
}): Error {
  const code = error.message ?? ""
  return /^[A-Z_]+$/.test(code)
    ? new IngestionRequestError(code, error.details ?? null)
    : new Error(code || "Supabase request failed")
}

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
    statusReasonCode: row.status_reason_code,
    statusReasonParams: row.status_reason_params ?? {},
    processingState: row.processing_state,
    languageToConfirm: row.language_to_confirm,
    languageExpected: row.language_expected,
    ingestionErrorCode: row.ingestion_error_code,
    indexedAt: row.indexed_at,
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

export async function hashFile(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

export type ExistingDocument = { id: string; filename: string }

/** Spec ingestion §3.3 : un même `file_hash` dans l'espace est un doublon. */
export async function findDocumentsByHash(
  workspaceId: string,
  hashes: string[]
): Promise<Map<string, ExistingDocument>> {
  if (hashes.length === 0) return new Map()
  const { data, error } = await supabase
    .from("documents")
    .select("id, original_filename, file_hash")
    .eq("workspace_id", workspaceId)
    .in("file_hash", hashes)
    .is("deleted_at", null)

  if (error) throw error
  return new Map(
    (data ?? []).map((row) => [
      row.file_hash,
      { id: row.id, filename: row.original_filename },
    ])
  )
}

export async function recordDuplicateDetected(
  existing: ExistingDocument,
  input: { filename: string; hash: string }
) {
  const { error } = await supabase.rpc("record_duplicate_detected", {
    p_existing_document_id: existing.id,
    p_filename: input.filename,
    p_hash: input.hash,
  })
  if (error) throw toRequestError(error)
}

/**
 * Dépose le fichier dans le stockage puis l'enregistre : la fonction
 * `register_document` contrôle verrou, format, taille et doublon, journalise
 * le chargement et met le document dans la file de traitement.
 */
export async function uploadDocument(input: {
  workspaceId: string
  file: File
  hash?: string
  category: DocumentCategory
  versionId?: string
  allowDuplicate?: boolean
}): Promise<{ documentId: string; jobId: string }> {
  const hash = input.hash ?? (await hashFile(input.file))
  const documentId = crypto.randomUUID()
  const extension = input.file.name.split(".").pop()?.toLowerCase() ?? ""
  const contentType = mimeTypes[extension] ?? input.file.type
  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]+/g, "-")
  const storagePath = `${input.workspaceId}/${documentId}/${safeName}`
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, input.file, { contentType })

  if (uploadError) throw uploadError

  const { data, error } = await supabase.rpc("register_document", {
    p_document_id: documentId,
    p_workspace_id: input.workspaceId,
    p_storage_path: storagePath,
    p_original_filename: input.file.name,
    p_file_hash: hash,
    p_file_size_bytes: input.file.size,
    p_mime_type: contentType,
    p_category: input.category,
    p_program_version_id: input.versionId ?? null,
    p_allow_duplicate: input.allowDuplicate ?? false,
  })

  if (error) {
    await supabase.storage.from("documents").remove([storagePath])
    throw toRequestError(error)
  }

  const result = data as { document_id: string; job_id: string }
  return { documentId: result.document_id, jobId: result.job_id }
}

export async function updateDocumentCategory(
  documentId: string,
  category: DocumentCategory
) {
  await correctDocumentMetadata(documentId, { category })
}

/** UC15 : la correction est journalisée et relance le contrôle si besoin. */
export async function correctDocumentMetadata(
  documentId: string,
  values: {
    category?: DocumentCategory
    language?: string
    country?: string
    versionId?: string | null
  }
) {
  const { error } = await supabase.rpc("correct_document_metadata", {
    p_document_id: documentId,
    p_category: values.category ?? null,
    p_language: values.language ?? null,
    p_country: values.country ?? null,
    p_program_version_id: values.versionId ?? null,
    p_clear_version: values.versionId === null,
  })
  if (error) throw toRequestError(error)
}

/** RG-4.2 : « Ajouter quand même » ; RG-4.1 : « Annuler ». */
export async function decideDocument(
  documentId: string,
  decision: "add_anyway" | "cancel",
  reason?: string
) {
  const { error } = await supabase.rpc("decide_document", {
    p_document_id: documentId,
    p_decision: decision,
    p_reason: reason ?? null,
  })
  if (error) throw toRequestError(error)
}

/**
 * Suppression définitive : le fichier quitte d'abord le bucket, puis la
 * ligne et tout ce qui en dépend (texte, segments, index). Un échec entre
 * les deux laisse une ligne sans fichier, que l'on peut supprimer de nouveau,
 * jamais un fichier orphelin dans le stockage. Le journal d'audit est gardé.
 */
export async function deleteDocument(
  document: Pick<CorpusDocument, "id" | "storagePath">
) {
  const { error: storageError } = await supabase.storage
    .from("documents")
    .remove([document.storagePath])
  if (storageError) throw storageError

  const { error } = await supabase.rpc("delete_document", {
    p_document_id: document.id,
  })
  if (error) throw toRequestError(error)
}

export async function retryDocumentIngestion(documentId: string) {
  const { error } = await supabase.rpc("retry_document_ingestion", {
    p_document_id: documentId,
  })
  if (error) throw toRequestError(error)
}

/** Historique des contrôles, blocages, corrections et validations (US-10.3). */
export async function listDocumentEvents(
  documentId: string
): Promise<DocumentEvent[]> {
  const { data, error } = await supabase
    .from("audit_events")
    .select("id, operation, metadata, created_at")
    .eq("object_type", "document")
    .eq("object_id", documentId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>
    const message = [metadata.reason, metadata.message].find(
      (value): value is string => typeof value === "string" && value !== ""
    )
    return {
      id: row.id,
      type: row.operation,
      message: message ?? null,
      createdAt: row.created_at,
    }
  })
}

export async function getDocumentUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}
