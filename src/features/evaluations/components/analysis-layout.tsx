import { ArrowLeft } from "lucide-react"
import type { ReactNode } from "react"

import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import { DemoDataNotice } from "@/features/evaluations/components/demo-data-notice"
import { cn } from "@/shared/lib/utils"

/**
 * Gabarit commun aux ecrans d'analyse, lus du general au detail :
 * retour, en-tete (titre, contexte, actions), bandeau de couche, puis les
 * sections empilees avec un rythme vertical unique.
 */
export function AnalysisPage({
  eyebrow,
  title,
  description,
  actions,
  back,
  banner,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
  back?: { label: string; onClick: () => void }
  banner?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-6xl pb-10">
      <DemoDataNotice />
      {back ? (
        <button
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          onClick={back.onClick}
          type="button"
        >
          <ArrowLeft className="size-4" /> {back.label}
        </button>
      ) : null}
      <CorpusPageHeader
        action={actions}
        description={description}
        eyebrow={eyebrow}
        title={title}
      />
      <div className="mt-8 flex flex-col gap-10">
        {banner}
        {children}
      </div>
    </div>
  )
}

/** Section titree : l'en-tete reste hors du bloc, le contenu dessous. */
export function PageSection({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex min-h-8 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Liste encadree : une seule bordure, lignes separees par des filets. */
export const listPanelClassName =
  "divide-y divide-border overflow-hidden rounded-xl border border-border"

/** Ligne cliquable d'une liste encadree. */
export const listRowClassName =
  "block w-full p-4 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
