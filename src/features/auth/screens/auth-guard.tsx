import { Navigate, Outlet, useLocation } from "react-router-dom"

import { AuthLoadingShell } from "@/features/auth/components/auth-loading-shell"
import { useAuth } from "@/features/auth/model/auth-provider"

export function AuthGuard() {
  const { isLoading, session } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <AuthLoadingShell variant="app" />
  }

  if (!session) {
    return <Navigate replace state={{ from: location }} to="/login" />
  }

  return <Outlet />
}
