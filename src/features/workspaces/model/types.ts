/**
 * Miroir des ENUM de la base (cf. « Schema de base de donnees », tables
 * `workspaces` et `workspace_members`).
 */
export const personas = ["decideur", "pmu", "analyste"] as const
export type Persona = (typeof personas)[number]

/** Persona par defaut impose par US-2.1. */
export const defaultPersona: Persona = "pmu"

export type MemberRole = "owner" | "member"
export type ObjectType = "programme"
export type FrameworkStatus = "draft" | "validated"
export type CriteriaStatus = "draft" | "confirmed"

export type Workspace = {
  id: string
  name: string
  organization: string | null
  objectType: ObjectType
  frameworkStatus: FrameworkStatus
  criteriaStatus: CriteriaStatus
  /** Persona de l'utilisateur courant sur cet espace. */
  persona: Persona
  role: MemberRole
  documentCount: number
  lastRunAt: string | null
  updatedAt: string
}

export function isPersona(value: unknown): value is Persona {
  return personas.includes(value as Persona)
}
