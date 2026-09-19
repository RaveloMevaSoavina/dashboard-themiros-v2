import type {
  CreateWorkspaceInput,
  FrameworkStatus,
  MemberRole,
  ObjectType,
  Workspace,
} from "@/features/workspaces/model/types"
import { supabase } from "@/shared/lib/supabase"

type WorkspaceMemberRow = {
  role: MemberRole | null
  workspaces: {
    id: string
    name: string
    kind: ObjectType
    pillar_framework_status: FrameworkStatus
    created_at: string
    organizations: { name: string } | null
    documents: { count: number }[]
  } | null
}

type CreatedWorkspaceRow = {
  id: string
  name: string
  kind: ObjectType
  pillar_framework_status: FrameworkStatus
  created_at: string
}

type ProfileWorkspaceContextRow = {
  organization_id: string | null
  role: string | null
  organizations: { name: string } | null
}

export type WorkspaceAccountContext = {
  organizationId: string | null
  organizationName: string | null
  role: string | null
}

export type PillarGenerationJob = {
  id: string
  workspace_id: string
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  error_message: string | null
}

const workspaceSelect = `
  role,
  workspaces (
    id,
    name,
    kind,
    pillar_framework_status,
    created_at,
    organizations (name),
    documents (count)
  )
`

function toWorkspace(row: WorkspaceMemberRow): Workspace | null {
  const workspace = row.workspaces

  if (!workspace) {
    return null
  }

  return {
    id: workspace.id,
    name: workspace.name,
    organization: workspace.organizations?.name ?? null,
    objectType: workspace.kind,
    frameworkStatus: workspace.pillar_framework_status,
    role: row.role ?? "member",
    documentCount: workspace.documents.at(0)?.count ?? 0,
    lastRunAt: null,
    updatedAt: workspace.created_at,
  }
}

export async function listWorkspaces() {
  const { data, error } = await supabase
    .from("workspace_members")
    .select(workspaceSelect)

  if (error) {
    throw error
  }

  return ((data ?? []) as unknown as WorkspaceMemberRow[])
    .map(toWorkspace)
    .filter((workspace): workspace is Workspace => workspace !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getWorkspaceAccountContext(
  userId: string
): Promise<WorkspaceAccountContext> {
  const { data, error } = await supabase
    .from("profiles")
    .select("organization_id, role, organizations (name)")
    .eq("id", userId)
    .single()

  if (error) {
    throw error
  }

  const profile = data as unknown as ProfileWorkspaceContextRow

  return {
    organizationId: profile.organization_id,
    organizationName: profile.organizations?.name ?? null,
    role: profile.role,
  }
}

export async function createWorkspace(
  input: CreateWorkspaceInput,
  userId: string
): Promise<Workspace> {
  const profile = await getWorkspaceAccountContext(userId)
  const organizationId = profile.organizationId

  if (!organizationId) {
    throw new Error("The authenticated account has no organization")
  }

  if (profile.role !== "admin") {
    throw new Error("Only an organization administrator can create a workspace")
  }

  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      organization_id: organizationId,
      name: input.name.trim(),
      kind: input.objectType,
      created_by: userId,
      target_country: input.targetCountry.trim(),
      expected_donor:
        input.financiers.find((financier) => financier.principal)?.name ??
        input.financiers.at(0)?.name ??
        null,
      financiers: input.financiers.map((financier) => ({
        name: financier.name.trim(),
        principal: financier.principal,
      })),
      themes: input.themes,
      expected_languages: input.expectedLanguages,
      declared_stage: input.stage,
      start_year: input.startYear,
      end_year: input.endYear,
    })
    .select("id, name, kind, pillar_framework_status, created_at")
    .single()

  if (error) {
    throw error
  }

  const workspace = data as CreatedWorkspaceRow
  const { error: membershipError } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: workspace.id,
      profile_id: userId,
      role: "admin",
    })

  if (membershipError) {
    await supabase.from("workspaces").delete().eq("id", workspace.id)
    throw membershipError
  }

  const { error: versionsError } = await supabase
    .from("program_versions")
    .insert(
      input.versions.map((version, index) => ({
        workspace_id: workspace.id,
        label: version.label.trim(),
        year: version.year,
        order_index: index + 1,
      }))
    )

  if (versionsError) {
    await supabase.from("workspaces").delete().eq("id", workspace.id)
    throw versionsError
  }

  await supabase
    .from("profiles")
    .update({ current_workspace_id: workspace.id })
    .eq("id", userId)

  return {
    id: workspace.id,
    name: workspace.name,
    organization: profile.organizationName,
    objectType: workspace.kind,
    frameworkStatus: workspace.pillar_framework_status,
    role: "admin",
    documentCount: 0,
    lastRunAt: null,
    updatedAt: workspace.created_at,
  }
}

export async function enqueuePillarGeneration(
  workspaceId: string
): Promise<PillarGenerationJob> {
  const { data, error } = await supabase.rpc("enqueue_pillar_generation", {
    target_workspace_id: workspaceId,
  })

  if (error) {
    throw error
  }

  return data as PillarGenerationJob
}

export async function getPillarGenerationJob(
  jobId: string
): Promise<PillarGenerationJob> {
  const { data, error } = await supabase
    .from("pillar_generation_jobs")
    .select("id, workspace_id, status, error_message")
    .eq("id", jobId)
    .single()

  if (error) {
    throw error
  }

  return data as PillarGenerationJob
}
