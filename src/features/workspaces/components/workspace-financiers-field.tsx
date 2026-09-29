import { CirclePlus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { WorkspaceFinancierInput } from "@/features/workspaces/model/types"
import { Button } from "@/shared/ui/base/button"
import { Input } from "@/shared/ui/base/input"

export type EditableWorkspaceFinancier = WorkspaceFinancierInput & {
  id: string
}

const financierCodes = [
  "GCF",
  "AFD",
  "WB",
  "FIDA",
  "PNUD",
  "UE",
  "FEM",
  "AF",
  "OTHER",
] as const

const selectClassName =
  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function WorkspaceFinanciersField({
  financiers,
  onChange,
}: {
  financiers: EditableWorkspaceFinancier[]
  onChange: (financiers: EditableWorkspaceFinancier[]) => void
}) {
  const { t } = useTranslation()

  function updateSelection(id: string, code: string) {
    onChange(
      financiers.map((financier) =>
        financier.id === id
          ? {
              ...financier,
              code: code || undefined,
              name:
                code === "OTHER" || !code
                  ? ""
                  : t(`workspaces.creation.financierOptions.${code}`),
            }
          : financier
      )
    )
  }

  function setPrincipal(id: string) {
    onChange(
      financiers.map((financier) => ({
        ...financier,
        principal: financier.id === id,
      }))
    )
  }

  function remove(id: string) {
    const remaining = financiers.filter((financier) => financier.id !== id)

    if (remaining.length > 0 && !remaining.some((item) => item.principal)) {
      remaining[0] = { ...remaining[0], principal: true }
    }

    onChange(remaining)
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium">
        {t("workspaces.creation.financiersLabel")}
      </legend>
      <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">
        {t("workspaces.creation.financiersHelp")}
      </p>

      <div className="mt-3 space-y-3">
        {financiers.map((financier) => {
          const selectedCode = financier.code ?? (financier.name ? "OTHER" : "")

          return (
            <div
              className="rounded-lg border border-border p-3"
              key={financier.id}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {financier.principal
                    ? t("workspaces.creation.mainFinancier")
                    : t("workspaces.creation.coFinancier")}
                </span>
                {financiers.length > 1 ? (
                  <Button
                    aria-label={t("workspaces.creation.remove")}
                    onClick={() => remove(financier.id)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>

              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                <input
                  aria-label={t("workspaces.creation.principal")}
                  checked={financier.principal}
                  className="size-4 accent-foreground"
                  name="principal-financier"
                  onChange={() => setPrincipal(financier.id)}
                  type="radio"
                />
                <select
                  aria-label={t("workspaces.creation.financierSelectLabel")}
                  className={selectClassName}
                  onChange={(event) =>
                    updateSelection(financier.id, event.target.value)
                  }
                  value={selectedCode}
                >
                  <option disabled value="">
                    {t("workspaces.creation.financierPlaceholder")}
                  </option>
                  {financierCodes.map((code) => {
                    const alreadySelected = financiers.some(
                      (item) => item.id !== financier.id && item.code === code
                    )

                    return (
                      <option
                        disabled={code !== "OTHER" && alreadySelected}
                        key={code}
                        value={code}
                      >
                        {t(`workspaces.creation.financierOptions.${code}`)}
                      </option>
                    )
                  })}
                </select>
              </div>

              {selectedCode === "OTHER" ? (
                <Input
                  aria-label={t("workspaces.creation.otherFinancierLabel")}
                  className="mt-3 h-10"
                  onChange={(event) =>
                    onChange(
                      financiers.map((item) =>
                        item.id === financier.id
                          ? { ...item, name: event.target.value }
                          : item
                      )
                    )
                  }
                  placeholder={t(
                    "workspaces.creation.otherFinancierPlaceholder"
                  )}
                  value={financier.name}
                />
              ) : null}
            </div>
          )
        })}
      </div>

      <Button
        className="mt-3"
        onClick={() =>
          onChange([
            ...financiers,
            {
              id: crypto.randomUUID(),
              name: "",
              principal: false,
            },
          ])
        }
        type="button"
        variant="outline"
      >
        <CirclePlus />
        {t("workspaces.creation.addCoFinancier")}
      </Button>
    </fieldset>
  )
}
