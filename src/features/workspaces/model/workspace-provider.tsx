import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
  defaultPersona,
  isPersona,
  type Persona,
  type Workspace,
} from "@/features/workspaces/model/types"
import {
  listWorkspaces,
  updatePersona,
} from "@/features/workspaces/services/workspace-service"

const lastWorkspaceStorageKey = "themiros-last-workspace"
const personaStorageKey = "themiros-persona"
/* Repli tant qu'aucun espace n'existe : les ecrans sont des
   maquettes, la navigation doit rester parcourable sans donnees. */
export const previewWorkspaceId = "preview"

export const workspacesQueryKey = ["workspaces", "list"] as const

type WorkspaceContextValue = {
  workspaces: Workspace[]
  /** Espace ouvert, ou `null` sur les ecrans hors espace (liste, profil). */
  activeWorkspace: Workspace | null
  /**
   * Identifiant vers lequel pointe la navigation laterale quand aucun
   * espace n'est ouvert : dernier espace utilise, a defaut le premier
   * disponible, a defaut un identifiant de demonstration.
   */
  navigationWorkspaceId: string
  isLoading: boolean
  error: Error | null
  /** Persona de lecture : celui de l'espace ouvert, sinon la preference locale. */
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
  const queryClient = useQueryClient()
  const { workspaceId } = useParams<{ workspaceId?: string }>()

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

  const navigationWorkspaceId =
    activeWorkspace?.id ??
    readLastWorkspaceId() ??
    workspaces.at(0)?.id ??
    previewWorkspaceId

  const personaMutation = useMutation({
    mutationFn: ({
      targetWorkspaceId,
      persona,
    }: {
      targetWorkspaceId: string
      persona: Persona
    }) => updatePersona(targetWorkspaceId, persona),
    /* US-2.2 : la bascule est immediate et ne recharge rien. On applique
       donc le persona au cache avant la reponse du serveur. */
    onMutate: async ({ targetWorkspaceId, persona }) => {
      await queryClient.cancelQueries({ queryKey: workspacesQueryKey })

      const previous = queryClient.getQueryData<Workspace[]>(workspacesQueryKey)

      queryClient.setQueryData<Workspace[]>(workspacesQueryKey, (current) =>
        current?.map((workspace) =>
          workspace.id === targetWorkspaceId
            ? { ...workspace, persona }
            : workspace
        )
      )

      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(workspacesQueryKey, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: workspacesQueryKey })
    },
  })

  const selectWorkspace = useCallback(
    (nextWorkspaceId: string) => {
      writeStorage(lastWorkspaceStorageKey, nextWorkspaceId)
      void navigate(`/workspaces/${nextWorkspaceId}`)
    },
    [navigate]
  )

  const setPersona = useCallback(
    (persona: Persona) => {
      writeStorage(personaStorageKey, persona)

      if (activeWorkspace) {
        personaMutation.mutate({
          targetWorkspaceId: activeWorkspace.id,
          persona,
        })
      }
    },
    [activeWorkspace, personaMutation]
  )

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspace,
      navigationWorkspaceId,
      isLoading: workspacesQuery.isPending,
      error: workspacesQuery.error,
      persona: activeWorkspace?.persona ?? readStoredPersona(),
      selectWorkspace,
      setPersona,
      refetch: () => {
        void workspacesQuery.refetch()
      },
    }),
    [
      activeWorkspace,
      navigationWorkspaceId,
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
