import { Navigate, useParams } from "react-router-dom"

import { useWorkspaces } from "@/features/workspaces/model/workspace-provider"

/**
 * `/workspaces/:workspaceId` n'a pas d'ecran propre : on ouvre l'espace
 * sur la vue Analyse, conformement a US-1.1.
 */
export function WorkspaceRedirect() {
  const { workspaceId } = useParams<{ workspaceId: string }>()

  return <Navigate replace to={`/workspaces/${workspaceId}/analysis`} />
}

/**
 * `/workspaces` n'affiche plus de liste : on ouvre directement le premier
 * espace. Le layout d'acces a deja renvoye vers /welcome un compte sans
 * espace.
 */
export function FirstWorkspaceRedirect() {
  const { workspaces } = useWorkspaces()
  const firstWorkspace = workspaces.at(0)

  return (
    <Navigate
      replace
      to={firstWorkspace ? `/workspaces/${firstWorkspace.id}` : "/welcome"}
    />
  )
}

/**
 * Le cadre d'evaluation vit desormais sous Parametres : les anciens liens
 * `/framework/...` (favoris, historique) y sont rediriges.
 */
export function LegacyFrameworkRedirect() {
  const { workspaceId, section = "pillars" } = useParams<{
    workspaceId: string
    section?: string
  }>()

  return (
    <Navigate replace to={`/workspaces/${workspaceId}/settings/${section}`} />
  )
}
