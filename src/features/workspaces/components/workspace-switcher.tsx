import { Check, ChevronsUpDown, Layers2, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { useWorkspaces } from "@/features/workspaces/model/workspace-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/base/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/shared/ui/base/sidebar"

/** Initiales affichees dans la pastille, ex. « Programme Sante » -> « PS ». */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
}

export function WorkspaceSwitcher() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isMobile } = useSidebar()
  const { workspaces, activeWorkspace, isLoading, selectWorkspace } =
    useWorkspaces()

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="bg-sidebar-accent text-sidebar-accent-foreground"
              size="lg"
              tooltip={activeWorkspace?.name ?? t("workspaces.switcher.none")}
            >
              <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md">
                <Layers2 />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[13px] font-semibold">
                  {activeWorkspace?.name ?? t("workspaces.switcher.none")}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {activeWorkspace?.organization ??
                    t("workspaces.switcher.selectPrompt")}
                </span>
              </span>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-64"
            side={isMobile ? "bottom" : "right"}
          >
            <DropdownMenuLabel>
              {t("workspaces.switcher.label")}
            </DropdownMenuLabel>

            {workspaces.length === 0 ? (
              <p className="px-2 py-3 text-[12px] text-muted-foreground">
                {t("workspaces.empty.title")}
              </p>
            ) : (
              workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onSelect={() => {
                    selectWorkspace(workspace.id)
                  }}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] font-semibold ring-1 ring-border">
                    {initials(workspace.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {workspace.name}
                  </span>
                  {workspace.id === activeWorkspace?.id ? (
                    <Check className="size-4 text-foreground" />
                  ) : null}
                </DropdownMenuItem>
              ))
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() => {
                void navigate("/workspaces/new")
              }}
            >
              <Plus />
              {t("workspaces.create")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
