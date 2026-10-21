import { RefreshCw } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/shared/lib/utils"

/**
 * Résultat d'un run dont le corpus a changé depuis (CA-6.2) : la carte reste
 * visible mais estompée et inactive jusqu'à la prochaine analyse.
 */
export function StaleResult({
  stale,
  className,
  children,
}: {
  stale: boolean
  className?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  if (!stale) return children
  return (
    <div className={cn("relative flex flex-col", className)}>
      <div
        className="flex h-full flex-col opacity-40 grayscale select-none"
        inert
      >
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <span className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-center text-[12px] font-medium shadow-sm">
          <RefreshCw className="size-3.5 shrink-0" />
          {t("evaluation.run.staleResult")}
        </span>
      </div>
    </div>
  )
}
