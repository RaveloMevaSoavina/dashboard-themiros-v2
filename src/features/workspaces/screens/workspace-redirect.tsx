import { Navigate, useParams } from "react-router-dom"

/**
 * `/workspaces/:workspaceId` n'a pas d'ecran propre : on ouvre l'espace
 * sur la vue Analyse, conformement a US-1.1.
 */
export function WorkspaceRedirect() {
  const { workspaceId } = useParams<{ workspaceId: string }>()

  return <Navigate replace to={`/workspaces/${workspaceId}/analysis`} />
}
