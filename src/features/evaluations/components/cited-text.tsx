import { useQuery } from "@tanstack/react-query"
import { Fragment, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { useEvidenceDocument } from "@/features/evaluations/components/evidence-document-dialog"
import { CITATION_MARKER } from "@/features/evaluations/model/passages"
import type { Citation, Evidence } from "@/features/evaluations/model/types"
import { listEvidencesByIds } from "@/features/evaluations/services/evaluation-service"
import { cn } from "@/shared/lib/utils"

/** Preuves des sources citees et ouverture de leur document surligne. */
export type CitationSources = {
  evidence: (id: string | null) => Evidence | undefined
  open: (citation: Citation) => void
}

/**
 * Charge en une requete les preuves de toutes les sources citees par les
 * textes d'un ecran. `dialog` affiche le document ouvert depuis une source,
 * ses phrases citees surlignees.
 */
export function useCitationSources(
  citations: (Citation[] | undefined)[],
  locale: string
): { sources: CitationSources; dialog: ReactNode } {
  const ids = [
    ...new Set(
      citations.flatMap((list) =>
        (list ?? []).flatMap((citation) =>
          citation.evidenceId ? [citation.evidenceId] : []
        )
      )
    ),
  ].sort()
  const evidences = useQuery({
    queryKey: ["evaluation", "cited-evidences", ids, locale],
    queryFn: () => listEvidencesByIds(ids, locale),
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  })
  const viewer = useEvidenceDocument()
  const byId = new Map(
    (evidences.data ?? []).map((evidence) => [evidence.id, evidence])
  )
  return {
    sources: {
      evidence: (id) => (id ? byId.get(id) : undefined),
      open: (citation) => {
        const evidence = citation.evidenceId
          ? byId.get(citation.evidenceId)
          : undefined
        if (evidence) viewer.open(evidence, citation.spans)
      },
    },
    dialog: viewer.dialog,
  }
}

/**
 * Texte redige par l'IA, ses marqueurs « ⟦1,2⟧ » rendus en liens
 * « [Source 1, Source 2] » qui ouvrent le document a la phrase citee. Un
 * texte sans marqueur (run anterieur) s'affiche tel quel.
 */
export function CitedText({
  text,
  citations,
  sources,
}: {
  text: string
  citations: Citation[] | undefined
  sources: CitationSources
}) {
  const parts: ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(CITATION_MARKER)) {
    const index = match.index ?? 0
    parts.push(text.slice(cursor, index))
    const numbers = match[1].split(",").map(Number)
    parts.push(
      <SourceLinks
        citations={citations ?? []}
        key={`${index}-${match[1]}`}
        numbers={numbers}
        sources={sources}
      />
    )
    cursor = index + match[0].length
  }
  parts.push(text.slice(cursor))
  return <>{parts}</>
}

function SourceLinks({
  numbers,
  citations,
  sources,
}: {
  numbers: number[]
  citations: Citation[]
  sources: CitationSources
}) {
  const { t } = useTranslation()
  return (
    <span className="whitespace-nowrap text-[0.85em] text-muted-foreground">
      {" ["}
      {numbers.map((number, position) => {
        const citation = citations[number - 1]
        const evidence = sources.evidence(citation?.evidenceId ?? null)
        const label = t("evaluation.citations.source", { number })
        const title = evidence
          ? [
              evidence.documentName,
              evidence.page
                ? `${t("evaluation.evidence.page")} ${evidence.page}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : t("evaluation.citations.unavailable")
        return (
          <Fragment key={number}>
            {position > 0 ? ", " : null}
            {citation && evidence ? (
              <button
                className={cn(
                  "font-medium text-foreground underline decoration-dotted underline-offset-2",
                  "rounded-sm hover:decoration-solid focus-visible:outline-2 focus-visible:outline-ring"
                )}
                onClick={() => sources.open(citation)}
                title={title}
                type="button"
              >
                {label}
              </button>
            ) : (
              <span title={title}>{label}</span>
            )}
          </Fragment>
        )
      })}
      {"]"}
    </span>
  )
}
