import { Outlet } from "react-router-dom"

import { AuthLoadingShell } from "@/features/auth/components/auth-loading-shell"
import { useAuth } from "@/features/auth/model/auth-provider"
import { NavigateKeepingLanguage } from "@/shared/i18n/navigate-keeping-language"

export function PublicOnlyRoute() {
  const { isLoading, session } = useAuth()

  if (isLoading) {
    return <AuthLoadingShell variant="auth" />
  }

  if (session) {
    return <NavigateKeepingLanguage to="/dashboard" />
  }

  return <Outlet />
}
