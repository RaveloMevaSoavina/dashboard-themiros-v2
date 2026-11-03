import { useQuery } from "@tanstack/react-query"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react"
import { useNavigate, useParams } from "react-router-dom"

import { useAuth } from "@/features/auth/model/auth-provider"
import {
  type Persona,
  personaFromProfileRole,
  type Workspace,
} from "@/features/workspaces/model/types"
import {
  getWorkspaceAccountContext,
  listWorkspaces,
} from "@/features/workspaces/services/workspace-service"

const lastWorkspaceStorageKey = "themiros-last-workspace"

export const workspacesQueryKey = ["workspaces", "list"] as const

type WorkspaceContextValue = {
  workspaces: Workspace[]
  /** Espace ouvert, ou `null` sur les ecrans hors espace (liste, profil). */
  activeWorkspace: Workspace | null
  /**
   * Identifiant vers lequel pointe la navigation laterale quand aucun
   * espace n'est ouvert : dernier espace utilise, a defaut le premier
   * disponible. Le dashboard n'est pas rendu quand la liste est vide.
   */
  navigationWorkspaceId: string
  isLoading: boolean
  error: Error | null
  /** Persona de lecture impose par le role du compte (`profiles.role`). */
  persona: Persona
  selectWorkspace: (workspaceId: string) => void
  refetch: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined
)

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Stockage indisponible (mode prive) : la preference reste en memoire.
  }
}

export function readLastWorkspaceId() {
  try {
    return window.localStorage.getItem(lastWorkspaceStorageKey)
  } catch {
    return null
  }
}

type WorkspaceProviderProps = {
  children: ReactNode
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { workspaceId } = useParams<{ workspaceId?: string }>()
  const userId = session?.user.id ?? ""

  const accountQuery = useQuery({
    queryKey: ["workspaces", "creation-context", userId],
    queryFn: () => getWorkspaceAccountContext(userId),
    enabled: Boolean(userId),
  })

  const persona = personaFromProfileRole(accountQuery.data?.role ?? null)

  const workspacesQuery = useQuery({
    queryKey: workspacesQueryKey,
    queryFn: listWorkspaces,
    enabled: Boolean(session),
  })

  const workspaces = useMemo(
    () => workspacesQuery.data ?? [],
    [workspacesQuery.data]
  )

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId) ?? null,
    [workspaceId, workspaces]
  )

  const lastWorkspaceId = readLastWorkspaceId()
  const navigationWorkspaceId =
    activeWorkspace?.id ??
    workspaces.find((workspace) => workspace.id === lastWorkspaceId)?.id ??
    workspaces.at(0)?.id ??
    ""

  const selectWorkspace = useCallback(
    (nextWorkspaceId: string) => {
      writeStorage(lastWorkspaceStorageKey, nextWorkspaceId)
      void navigate(`/workspaces/${nextWorkspaceId}`)
    },
    [navigate]
  )

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspace,
      navigationWorkspaceId,
      // Le persona conditionne la navigation : on attend le profil pour ne
      // pas afficher brievement les entrees d'un autre role.
      isLoading: workspacesQuery.isPending || accountQuery.isPending,
      error: workspacesQuery.error ?? accountQuery.error,
      persona,
      selectWorkspace,
      refetch: () => {
        void workspacesQuery.refetch()
      },
    }),
    [
      accountQuery.error,
      accountQuery.isPending,
      activeWorkspace,
      navigationWorkspaceId,
      persona,
      selectWorkspace,
      workspaces,
      workspacesQuery,
    ]
  )

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspaces() {
  const context = useContext(WorkspaceContext)

  if (!context) {
    throw new Error("useWorkspaces must be used within WorkspaceProvider")
  }

  return context
}
