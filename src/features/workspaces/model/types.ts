/**
 * Miroir des ENUM de la base (cf. « Schema de base de donnees », tables
 * `workspaces` et `workspace_members`).
 */
export const personas = ["decideur", "pmu", "analyste"] as const
export type Persona = (typeof personas)[number]

/** Persona par defaut impose par US-2.1. */
export const defaultPersona: Persona = "pmu"

export type MemberRole = "admin" | "member" | "viewer"
export type ObjectType = "policy" | "program" | "project"
export type FrameworkStatus = "draft" | "validated" | "locked"
export type WorkspaceStage =
  | "design"
  | "pre_launch"
  | "implementation"
  | "mid_term"
  | "closing"
  | "post_closure"
  | "cross_cutting"
export type WorkspaceLanguage = "fr" | "en" | "pt" | "es"

export type WorkspaceFinancierInput = {
  /** Stable code resolved by the database when the UI only provides a name. */
  code?: string
  name: string
  principal: boolean
}

export type ProgramVersionInput = {
  label: string
  year: number
}

export type Workspace = {
  id: string
  name: string
  organization: string | null
  objectType: ObjectType
  frameworkStatus: FrameworkStatus
  role: MemberRole
  documentCount: number
  lastRunAt: string | null
  updatedAt: string
}

export type CreateWorkspaceInput = {
  name: string
  objectType: ObjectType
  targetCountry: string
  financiers: WorkspaceFinancierInput[]
  themes: string[]
  expectedLanguages: WorkspaceLanguage[]
  stage: WorkspaceStage
  startYear: number
  endYear: number
  versions: ProgramVersionInput[]
}

export type WorkspaceDetails = {
  id: string
  name: string
  objectType: ObjectType
  organization: string | null
  targetCountry: string
  financiers: WorkspaceFinancierInput[]
  themes: string[]
  expectedLanguages: WorkspaceLanguage[]
  stage: WorkspaceStage
  startYear: number
  endYear: number
}

export type UpdateWorkspaceInput = Omit<
  WorkspaceDetails,
  "id" | "organization" | "objectType"
>

export function isPersona(value: unknown): value is Persona {
  return personas.includes(value as Persona)
}
