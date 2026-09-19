import { useTranslation } from "react-i18next"

import { PersonaSwitcher } from "@/features/workspaces/components/persona-switcher"
import { useWorkspaces } from "@/features/workspaces/model/workspace-provider"
import { Badge } from "@/shared/ui/base/badge"
import { SidebarTrigger } from "@/shared/ui/base/sidebar"

export function DashboardTopbar() {
  const { t } = useTranslation()
  const { activeWorkspace } = useWorkspaces()

  return (
    <header className="sticky top-0 z-20 flex h-[62px] shrink-0 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur-sm sm:px-6">
      <SidebarTrigger className="-ml-1" />

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="truncate text-[13px] font-semibold">
          {activeWorkspace?.name ?? t("workspaces.title")}
        </span>
        {/* US-1.1 : le cadre non valide doit se signaler partout. */}
        {activeWorkspace && activeWorkspace.frameworkStatus === "draft" ? (
          <Badge variant="warning">{t("workspaces.framework.draft")}</Badge>
        ) : null}
      </div>

      <PersonaSwitcher />
    </header>
  )
}
