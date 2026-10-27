import { periodBounds } from "@/features/audit/model/audit-log"
import type {
  AuditActor,
  AuditCategory,
  AuditCursor,
  AuditEvent,
  AuditFilters,
} from "@/features/audit/model/types"
import { supabase } from "@/shared/lib/supabase"

type AuditEventRow = {
  id: string
  created_at: string
  operation: string
  category: AuditCategory
  failed: boolean
  actor_type: "human" | "engine"
  actor_user_id: string | null
  actor_name: string | null
  object_type: string
  object_id: string | null
  run_id: string | null
  run_engine_version: string | null
  before_value: Record<string, unknown> | null
  after_value: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

export const auditPageSize = 50
/* L'export relit le journal par grandes pages, borne haute de la fonction. */
const exportPageSize = 500

/**
 * Liste chronologique filtree, du plus recent au plus ancien (US-21.1).
 * Les noms d'acteurs, la famille et l'echec sont resolus en base
 * (list_audit_events).
 */
export async function listAuditEvents(
  workspaceId: string,
  filters: AuditFilters,
  cursor: AuditCursor | null = null,
  limit = auditPageSize
): Promise<AuditEvent[]> {
  const period = periodBounds(filters)
  const { data, error } = await supabase.rpc("list_audit_events", {
    p_workspace_id: workspaceId,
    p_category: filters.category,
    p_actor: filters.actor,
    p_from: period.from,
    p_to: period.to,
    p_failures_only: filters.failuresOnly,
    p_before_created_at: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
    p_limit: limit,
  })
  if (error) throw error
  return ((data ?? []) as AuditEventRow[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    operation: row.operation,
    category: row.category,
    failed: row.failed,
    actorType: row.actor_type,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    objectType: row.object_type,
    objectId: row.object_id,
    runId: row.run_id,
    runEngineVersion: row.run_engine_version,
    before: row.before_value,
    after: row.after_value,
    metadata: row.metadata,
  }))
}

/** Tous les evenements qui repondent aux filtres, pour l'export (US-21.5). */
export async function listAllAuditEvents(
  workspaceId: string,
  filters: AuditFilters
): Promise<AuditEvent[]> {
  const events: AuditEvent[] = []
  let cursor: AuditCursor | null = null
  for (;;) {
    const page = await listAuditEvents(
      workspaceId,
      filters,
      cursor,
      exportPageSize
    )
    events.push(...page)
    const last = page.at(-1)
    if (!last || page.length < exportPageSize) return events
    cursor = { id: last.id, createdAt: last.createdAt }
  }
}

/** Acteurs humains presents dans le journal, pour le filtre « acteur ». */
export async function listAuditActors(
  workspaceId: string
): Promise<AuditActor[]> {
  const { data, error } = await supabase.rpc("list_audit_actors", {
    p_workspace_id: workspaceId,
  })
  if (error) throw error
  return (
    (data ?? []) as { actor_user_id: string; actor_name: string | null }[]
  ).map((row) => ({ id: row.actor_user_id, name: row.actor_name }))
}

/**
 * L'export du journal est lui-meme une operation tracee : il entre au
 * journal avec les filtres appliques et le nombre de lignes emportees.
 */
export async function recordAuditExport(
  workspaceId: string,
  filters: AuditFilters,
  count: number
) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session.session?.user.id
  if (!userId) throw new Error("NOT_AUTHENTICATED")
  const { error } = await supabase.from("audit_events").insert({
    workspace_id: workspaceId,
    actor_type: "human",
    actor_user_id: userId,
    operation: "audit_log_exported",
    object_type: "audit_log",
    metadata: { format: "csv", count, filters },
  })
  if (error) throw error
}
