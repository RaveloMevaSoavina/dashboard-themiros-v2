import { CirclePlus, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/base/button"
import { Input } from "@/shared/ui/base/input"

export const predefinedWorkspaceThemes = [
  "agriculture",
  "water",
  "nature",
  "gender",
  "energy",
] as const

export function isPredefinedWorkspaceTheme(theme: string) {
  return predefinedWorkspaceThemes.some((option) => option === theme)
}

type WorkspaceThemesFieldProps = {
  themes: string[]
  onChange: (themes: string[]) => void
}

export function WorkspaceThemesField({
  themes,
  onChange,
}: WorkspaceThemesFieldProps) {
  const { t } = useTranslation()
  const [customTheme, setCustomTheme] = useState("")
  const customThemes = themes.filter(
    (theme) => !isPredefinedWorkspaceTheme(theme)
  )
  const normalizedCustomTheme = customTheme.trim()
  const isDuplicate = themes.some(
    (theme) =>
      theme.toLocaleLowerCase() === normalizedCustomTheme.toLocaleLowerCase()
  )

  function addCustomTheme() {
    if (!normalizedCustomTheme || isDuplicate) {
      return
    }

    onChange([...themes, normalizedCustomTheme])
    setCustomTheme("")
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium">
        {t("workspaces.creation.themesLabel")}
      </legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {predefinedWorkspaceThemes.map((theme) => {
          const selected = themes.includes(theme)

          return (
            <button
              aria-pressed={selected}
              className={cn(
                "rounded-lg border px-3 py-2 text-[12px] transition-colors",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted"
              )}
              key={theme}
              onClick={() =>
                onChange(
                  selected
                    ? themes.filter((item) => item !== theme)
                    : [...themes, theme]
                )
              }
              type="button"
            >
              {t(`workspaces.creation.themes.${theme}`)}
            </button>
          )
        })}
      </div>

      {customThemes.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {customThemes.map((theme) => (
            <span
              className="inline-flex items-center gap-1 rounded-lg border border-foreground bg-foreground py-1.5 pl-3 pr-1.5 text-[12px] text-background"
              key={theme}
            >
              {theme}
              <button
                aria-label={t("workspaces.creation.removeTheme", { theme })}
                className="rounded p-0.5 hover:bg-background/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/40"
                onClick={() =>
                  onChange(themes.filter((item) => item !== theme))
                }
                type="button"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex max-w-lg gap-2">
        <Input
          aria-label={t("workspaces.creation.customThemeLabel")}
          maxLength={80}
          onChange={(event) => setCustomTheme(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              addCustomTheme()
            }
          }}
          placeholder={t("workspaces.creation.customThemePlaceholder")}
          value={customTheme}
        />
        <Button
          disabled={!normalizedCustomTheme || isDuplicate}
          onClick={addCustomTheme}
          type="button"
          variant="outline"
        >
          <CirclePlus />
          {t("workspaces.creation.addTheme")}
        </Button>
      </div>
      {isDuplicate && normalizedCustomTheme ? (
        <p className="mt-2 text-[12px] text-muted-foreground">
          {t("workspaces.creation.themeAlreadyAdded")}
        </p>
      ) : null}
    </fieldset>
  )
}
