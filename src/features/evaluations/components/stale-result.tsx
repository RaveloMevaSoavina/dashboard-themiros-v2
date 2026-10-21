import type { ReactNode } from "react"

import { cn } from "@/shared/lib/utils"

/**
 * Résultat d'un run dont le corpus a changé depuis (CA-6.2) : la carte reste
 * visible mais estompée et inactive jusqu'à la prochaine analyse. Le bandeau
 * en tête de page (`RunNotices`) porte le message de relance.
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
  if (!stale) return children
  return (
    <div
      className={cn(
        "flex flex-col opacity-40 grayscale select-none",
        className
      )}
      inert
    >
      {children}
    </div>
  )
}
