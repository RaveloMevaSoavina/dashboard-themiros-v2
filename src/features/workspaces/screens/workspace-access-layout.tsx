import { RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useWorkspaces } from "@/features/workspaces/model/workspace-provider"
import { Button } from "@/shared/ui/base/button"
import { GlobalLoader } from "@/shared/ui/global-loader"

export function WorkspaceAccessLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const { workspaces, isLoading, error, refetch } = useWorkspaces()

  if (isLoading) {
    return (
      <GlobalLoader
        eyebrow={t("workspaces.access.loadingEyebrow")}
        message={t("workspaces.access.loadingTitle")}
        submessage={t("workspaces.access.loadingDescription")}
      />
    )
  }

  if (error) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-6 py-24">
        <section className="w-full max-w-md rounded-xl border border-border p-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            {t("workspaces.error.title")}
          </h1>
          <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
            {t("workspaces.error.description")}
          </p>
          <Button className="mt-6" onClick={refetch} size="lg">
            <RotateCcw />
            {t("workspaces.error.retry")}
          </Button>
        </section>
      </main>
    )
  }

  if (workspaces.length === 0 && location.pathname !== "/workspaces/new") {
    return <Navigate replace to="/workspaces/new" />
  }

  return <Outlet />
}
