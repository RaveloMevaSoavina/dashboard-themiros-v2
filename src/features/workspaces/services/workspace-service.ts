import type {
  CriteriaStatus,
  FrameworkStatus,
  MemberRole,
  ObjectType,
  Persona,
  Workspace,
} from "@/features/workspaces/model/types"
import { supabase } from "@/shared/lib/supabase"

/**
 * Forme brute renvoyee par PostgREST : `workspace_members` est la table
 * racine (elle porte le persona et sert de filtre RLS naturel), l'espace
 * arrive en relation imbriquee.
 */
type WorkspaceMemberRow = {
  persona: Persona
  role: MemberRole
  workspaces: {
    id: string
    name: string
    organization: string | null
    object_type: ObjectType
    framework_status: FrameworkStatus
    criteria_status: CriteriaStatus
    updated_at: string
    deleted_at: string | null
    documents: { count: number }[]
    runs: { created_at: string }[]
  } | null
}

const workspaceSelect = `
  persona,
  role,
  workspaces (
    id,
    name,
    organization,
    object_type,
    framework_status,
    criteria_status,
    updated_at,
    deleted_at,
    documents (count),
    runs (created_at)
  )
`

function toWorkspace(row: WorkspaceMemberRow): Workspace | null {
  const workspace = row.workspaces

  if (!workspace || workspace.deleted_at) {
    return null
  }

  /* `runs` est trie par date decroissante cote requete : le premier
     element est donc la derniere analyse lancee. */
  const lastRun = workspace.runs.at(0)

  return {
    id: workspace.id,
    name: workspace.name,
    organization: workspace.organization,
    objectType: workspace.object_type,
    frameworkStatus: workspace.framework_status,
    criteriaStatus: workspace.criteria_status,
    persona: row.persona,
    role: row.role,
    documentCount: workspace.documents.at(0)?.count ?? 0,
    lastRunAt: lastRun?.created_at ?? null,
    updatedAt: workspace.updated_at,
  }
}

export async function listWorkspaces() {
  const { data, error } = await supabase
    .from("workspace_members")
    .select(workspaceSelect)
    .is("workspaces.deleted_at", null)
    .order("created_at", {
      ascending: false,
      foreignTable: "workspaces.runs",
    })
    .limit(1, { foreignTable: "workspaces.runs" })

  if (error) {
    throw error
  }

  return ((data ?? []) as unknown as WorkspaceMemberRow[])
    .map(toWorkspace)
    .filter((workspace): workspace is Workspace => workspace !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function updatePersona(workspaceId: string, persona: Persona) {
  const { error } = await supabase
    .from("workspace_members")
    .update({ persona })
    .eq("workspace_id", workspaceId)

  if (error) {
    throw error
  }
}
