import {
  ChevronsUpDown,
  Languages,
  LogOut,
  Moon,
  Sun,
  UserRound,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { useAuth } from "@/features/auth/model/auth-provider"
import { type Theme, useTheme } from "@/shared/theme/theme-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/base/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/shared/ui/base/sidebar"

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
}

export function AccountMenu() {
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const { isMobile } = useSidebar()
  const { session, signOut } = useAuth()
  const { theme, setTheme } = useTheme()

  const metadata = session?.user.user_metadata
  const email = session?.user.email ?? ""
  const accountName =
    metadata?.full_name ??
    metadata?.name ??
    metadata?.display_name ??
    email.split("@")[0]
  const name = accountName || t("account.fallbackName")
  const avatarUrl = metadata?.avatar_url ?? metadata?.picture

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              size="lg"
              tooltip={name}
            >
              <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[11px] font-semibold ring-1 ring-border">
                {avatarUrl ? (
                  <img
                    alt=""
                    className="size-full object-cover"
                    src={avatarUrl}
                  />
                ) : (
                  initials(name)
                )}
              </span>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-[13px] font-semibold">
                  {name}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {email}
                </span>
              </span>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60"
            side={isMobile ? "top" : "right"}
          >
            <DropdownMenuLabel className="normal-case tracking-normal">
              <span className="block truncate text-[13px] text-foreground">
                {name}
              </span>
              <span className="block truncate text-[11px] font-normal text-muted-foreground">
                {email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() => {
                void navigate("/profile")
              }}
            >
              <UserRound />
              {t("account.profile")}
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                {theme === "dark" ? <Moon /> : <Sun />}
                {t("account.theme.label")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  onValueChange={(value) => {
                    setTheme(value as Theme)
                  }}
                  value={theme}
                >
                  <DropdownMenuRadioItem value="dark">
                    <Moon />
                    {t("account.theme.dark")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="light">
                    <Sun />
                    {t("account.theme.light")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <Languages />
                {t("account.language.label")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  onValueChange={(value) => {
                    void i18n.changeLanguage(value)
                  }}
                  value={i18n.resolvedLanguage ?? "fr"}
                >
                  <DropdownMenuRadioItem value="fr">
                    Français
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="en">
                    English
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                void signOut()
              }}
            >
              <LogOut />
              {t("auth.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
