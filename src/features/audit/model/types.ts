/** Familles d'operations, derivees en base (audit_event_category). */
export const auditCategories = [
  "framework",
  "corpus",
  "run",
  "alert",
  "ai",
  "export",
] as const

export type AuditCategory = (typeof auditCategories)[number]

/** Evenement du journal (US-21.2). */
export type AuditEvent = {
  id: string
  createdAt: string
  operation: string
  category: AuditCategory
  /** Echec journalise au meme titre qu'un succes (US-21.4). */
  failed: boolean
  actorType: "human" | "engine"
  actorUserId: string | null
  /** Nom resolu en base ; null pour le moteur ou un compte supprime. */
  actorName: string | null
  objectType: string
  objectId: string | null
  runId: string | null
  runEngineVersion: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

/** Filtres de la liste (US-21.1). Dates au format AAAA-MM-JJ, bornes incluses. */
export type AuditFilters = {
  category: AuditCategory | null
  /** "engine" ou l'identifiant d'un utilisateur. */
  actor: string | null
  from: string | null
  to: string | null
  failuresOnly: boolean
}

export type AuditActor = {
  id: string
  name: string | null
}

/** Curseur de pagination : le dernier evenement de la page precedente. */
export type AuditCursor = Pick<AuditEvent, "id" | "createdAt">
