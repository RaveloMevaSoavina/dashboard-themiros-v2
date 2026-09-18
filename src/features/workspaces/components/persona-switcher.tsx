import { ChevronsUpDown, UserRound } from "lucide-react"
import { useTranslation } from "react-i18next"

import { personas } from "@/features/workspaces/model/types"
import { useWorkspaces } from "@/features/workspaces/model/workspace-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/shared/ui/base/dropdown-menu"

/**
 * Puce « Profil » (US-2.2) : la bascule de persona ne change que la
 * projection — jamais les scores, qui restent uniques en base (RG-2.2).
 */
export function PersonaSwitcher() {
  const { t } = useTranslation()
  const { persona, setPersona } = useWorkspaces()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-[12px] outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted">
        <UserRound className="size-3.5 text-muted-foreground" />
        <span className="font-medium">{t(`personas.${persona}.name`)}</span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>{t("personas.label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            setPersona(value as (typeof personas)[number])
          }}
          value={persona}
        >
          {personas.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">
                  {t(`personas.${option}.name`)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {t(`personas.${option}.description`)}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
