import { useQuery } from "@tanstack/react-query"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"
import { useNavigate, useParams } from "react-router-dom"

import { useAuth } from "@/features/auth/model/auth-provider"
import {
  defaultPersona,
  isPersona,
  type Persona,
  type Workspace,
} from "@/features/workspaces/model/types"
import { listWorkspaces } from "@/features/workspaces/services/workspace-service"

const lastWorkspaceStorageKey = "themiros-last-workspace"
const personaStorageKey = "themiros-persona"

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
  /** Persona de lecture conserve localement (absent du schema SQL). */
  persona: Persona
  selectWorkspace: (workspaceId: string) => void
  setPersona: (persona: Persona) => void
  refetch: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined
)

function readStoredPersona(): Persona {
  try {
    const stored = window.localStorage.getItem(personaStorageKey)

    return isPersona(stored) ? stored : defaultPersona
  } catch {
    return defaultPersona
  }
}

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
  const [persona, setLocalPersona] = useState(readStoredPersona)

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

  const setPersona = useCallback((nextPersona: Persona) => {
    writeStorage(personaStorageKey, nextPersona)
    setLocalPersona(nextPersona)
  }, [])

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspace,
      navigationWorkspaceId,
      isLoading: workspacesQuery.isPending,
      error: workspacesQuery.error,
      persona,
      selectWorkspace,
      setPersona,
      refetch: () => {
        void workspacesQuery.refetch()
      },
    }),
    [
      activeWorkspace,
      navigationWorkspaceId,
      persona,
      selectWorkspace,
      setPersona,
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
