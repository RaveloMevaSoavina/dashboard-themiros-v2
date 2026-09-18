import type { Session } from "@supabase/supabase-js"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createContext,
  type ReactNode,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { getSession, signOut } from "@/features/auth/services/auth-service"
import { supabase } from "@/shared/lib/supabase"

type AuthContextValue = {
  isLoading: boolean
  session: Session | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [isSessionBootstrapping, setIsSessionBootstrapping] = useState(true)

  const sessionQuery = useQuery({
    queryKey: ["auth", "session"],
    queryFn: getSession,
  })

  useEffect(() => {
    if (sessionQuery.isFetched) {
      startTransition(() => {
        setSession(sessionQuery.data ?? null)
        setIsSessionBootstrapping(false)
      })
    }
  }, [sessionQuery.data, sessionQuery.isFetched])

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      startTransition(() => {
        setSession(nextSession)
        setIsSessionBootstrapping(false)
      })

      queryClient.setQueryData(["auth", "session"], nextSession)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [queryClient])

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      startTransition(() => {
        setSession(null)
      })

      await queryClient.invalidateQueries({ queryKey: ["auth", "session"] })
    },
  })

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading: isSessionBootstrapping || sessionQuery.isLoading,
      session,
      signOut: async () => {
        await signOutMutation.mutateAsync()
      },
    }),
    [isSessionBootstrapping, session, sessionQuery.isLoading, signOutMutation]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }

  return context
}
