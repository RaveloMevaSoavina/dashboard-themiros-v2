import { ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { NavLink, useLocation } from "react-router-dom"

import { AccountMenu } from "@/features/dashboard/components/account-menu"
import {
  type NavItem,
  sectionsForPersona,
} from "@/features/dashboard/model/navigation"
import { WorkspaceSwitcher } from "@/features/workspaces/components/workspace-switcher"
import { useWorkspaces } from "@/features/workspaces/model/workspace-provider"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/base/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/shared/ui/base/sidebar"
import { BrandMark } from "@/shared/ui/brand-mark"

export function DashboardSidebar() {
  const { t } = useTranslation()
  const { navigationWorkspaceId, persona } = useWorkspaces()
  const { pathname } = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()

  const sections = sectionsForPersona(persona)

  /* Sur mobile la barre est un tiroir superpose : le choix d'une entree
     doit le refermer, alors qu'en desktop elle reste ouverte. */
  const closeOnMobile = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const renderItem = (item: NavItem, workspaceId: string) => {
    const basePath = `/workspaces/${workspaceId}/${item.segment}`
    const label = t(`nav.items.${item.labelKey}`)
    const children = item.children ?? []

    if (children.length === 0) {
      return (
        <SidebarMenuItem key={item.segment}>
          <SidebarMenuButton
            asChild
            isActive={pathname === basePath}
            tooltip={label}
          >
            <NavLink onClick={closeOnMobile} to={basePath}>
              <item.icon />
              <span>{label}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    }

    /* Le groupe s'ouvre des qu'une de ses routes est active, pour que la
       position courante reste visible apres un rechargement. */
    const isGroupActive = pathname.startsWith(basePath)

    return (
      <Collapsible
        asChild
        className="group/collapsible"
        defaultOpen={isGroupActive}
        key={item.segment}
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            {/* En mode icone, le clic ouvre la barre plutot qu'un sous-menu
                invisible : shadcn gere ce repli via le tooltip. */}
            <SidebarMenuButton isActive={isGroupActive} tooltip={label}>
              <item.icon />
              <span>{label}</span>
              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <SidebarMenuSub>
              {children.map((child) => {
                const childPath = `${basePath}/${child.segment}`

                return (
                  <SidebarMenuSubItem key={child.segment}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={pathname === childPath}
                    >
                      <NavLink onClick={closeOnMobile} to={childPath}>
                        <span>{t(`nav.items.${child.labelKey}`)}</span>
                      </NavLink>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    )
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <NavLink onClick={closeOnMobile} to="/workspaces">
                <BrandMark className="size-8! shrink-0" size={32} />
                <span className="text-base font-semibold leading-none tracking-tight">
                  {t("brand.name")}
                </span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <WorkspaceSwitcher />
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.titleKey}>
            <SidebarGroupLabel>
              {t(`nav.sections.${section.titleKey}`)}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) =>
                  renderItem(item, navigationWorkspaceId)
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator className="ml-0 mr-2" />

      <SidebarFooter>
        <AccountMenu />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
