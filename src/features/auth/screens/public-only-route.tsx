import { Navigate, Outlet } from "react-router-dom"

import { AuthLoadingShell } from "@/features/auth/components/auth-loading-shell"
import { useAuth } from "@/features/auth/model/auth-provider"

export function PublicOnlyRoute() {
  const { isLoading, session } = useAuth()

  if (isLoading) {
    return <AuthLoadingShell variant="auth" />
  }

  if (session) {
    return <Navigate replace to="/dashboard" />
  }

  return <Outlet />
}
