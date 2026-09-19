import { FileStack, History } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { Workspace } from "@/features/workspaces/model/types"
import { Badge } from "@/shared/ui/base/badge"

type WorkspaceCardProps = {
  workspace: Workspace
  onOpen: (workspaceId: string) => void
}

export function WorkspaceCard({ workspace, onOpen }: WorkspaceCardProps) {
  const { i18n, t } = useTranslation()

  const lastRunLabel = workspace.lastRunAt
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage, {
        dateStyle: "medium",
      }).format(new Date(workspace.lastRunAt))
    : t("workspaces.card.noRun")

  return (
    <button
      className="flex w-full flex-col gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={() => {
        onOpen(workspace.id)
      }}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{workspace.name}</p>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {workspace.organization ?? t("workspaces.card.noOrganization")}
          </p>
        </div>
        {workspace.frameworkStatus === "draft" ? (
          <Badge variant="warning">{t("workspaces.framework.draft")}</Badge>
        ) : (
          <Badge variant="outline">
            {t(`workspaces.framework.${workspace.frameworkStatus}`)}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <FileStack className="size-3.5" />
          {t("workspaces.card.documents", { count: workspace.documentCount })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <History className="size-3.5" />
          {lastRunLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {t(`workspaces.objectType.${workspace.objectType}`)}
        </span>
      </div>
    </button>
  )
}
