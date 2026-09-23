export const documentCategories = [
  "principal",
  "complementaire",
  "autre",
] as const

export const documentStatuses = [
  "conforme",
  "a_verifier",
  "rejete",
  "integre_decision_humaine",
  "non_classe",
] as const

export type DocumentCategory = (typeof documentCategories)[number]
export type DocumentStatus = (typeof documentStatuses)[number]

export type CorpusDocument = {
  id: string
  workspaceId: string
  filename: string
  storagePath: string
  fileSize: number
  mimeType: string
  category: DocumentCategory
  language: string | null
  country: string | null
  relevanceScore: number | null
  status: DocumentStatus
  statusReason: string | null
  exploitablePages: number | null
  totalPages: number | null
  integratedByHuman: boolean
  createdAt: string
  version: { id: string; label: string; year: number } | null
}

export type ProgramVersion = {
  id: string
  label: string
  year: number
}

export type DocumentEvent = {
  id: string
  type: string
  message: string | null
  createdAt: string
}

export type CorpusThreshold = {
  type: "exploratoire" | "standard" | "approfondie"
  minimum: number
  recommended: number
}
