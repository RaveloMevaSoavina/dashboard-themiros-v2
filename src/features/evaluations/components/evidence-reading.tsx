import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  type CitationSources,
  Interpretation,
} from "@/features/evaluations/components/cited-text"
import { citedPassage, cleanText } from "@/features/evaluations/model/passages"
import type { Evidence, Span } from "@/features/evaluations/model/types"
import { cn } from "@/shared/lib/utils"

/**
 * Lecture d'une preuve : d'abord ce que le segment etablit sur le projet
 * (interpretation de l'IA, en paragraphe), l'extrait brut au second plan,
 * replie derriere « Voir l'extrait source » : passage cite, puis extrait
 * complet. Les marqueurs de l'interpretation (« [Source 1] ») ouvrent le
 * document a la phrase qui la fonde, surlignee (`onOpen`). Sans
 * interpretation (preuve que l'IA n'a pas lue, run anterieur), l'extrait
 * nettoye, replie a quelques lignes ; « Interpretation indisponible » si
 * le run en attendait une (`interpretationExpected`).
 */
export function EvidenceReading({
  evidence,
  size = "base",
  interpretationExpected = false,
  onOpen,
}: {
  evidence: Evidence
  size?: "base" | "sm"
  /** L'IA a lu les segments de ce run : une interpretation est attendue. */
  interpretationExpected?: boolean
  /** Ouvre le document de la preuve, ces phrases surlignees. */
  onOpen?: (spans: Span[]) => void
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const passage = citedPassage(evidence.excerpt, evidence.spans)
  const excerpt = cleanText(evidence.excerpt)
  const text = size === "sm" ? "text-[13px] leading-6" : "text-[14px] leading-7"
  const label =
    "text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
  // L'extrait complet n'apporte rien quand le passage cite est tout l'extrait.
  const foldable = !passage || passage !== excerpt
  // Repli au-dela de quatre lignes environ.
  const long = excerpt.length > 280
  // Les sources d'une interpretation sont des phrases de la preuve elle-meme.
  const sources: CitationSources = {
    evidence: (id) => (id === evidence.id && onOpen ? evidence : undefined),
    open: (citation) => onOpen?.(citation.spans),
  }

  const interpreted = Boolean(evidence.interpretation?.trim())
  const toggle = (
    <button
      aria-expanded={sourceOpen}
      className="flex items-center gap-1 self-start text-[12px] text-muted-foreground hover:text-foreground hover:underline"
      onClick={() => setSourceOpen((current) => !current)}
      type="button"
    >
      {sourceOpen ? (
        <ChevronUp className="size-3.5" />
      ) : (
        <ChevronDown className="size-3.5" />
      )}
      {sourceOpen
        ? t("evaluation.evidence.hideSource")
        : t("evaluation.evidence.showSource")}
    </button>
  )

  return (
    <div className="flex flex-col gap-3">
      {interpreted ? (
        <div>
          <p className={label}>{t("evaluation.evidence.interpretation")}</p>
          <Interpretation
            citations={evidence.interpretationCitations}
            className={cn("mt-2", text)}
            sources={sources}
            text={evidence.interpretation}
          />
        </div>
      ) : (
        <Interpretation
          citations={undefined}
          expected={interpretationExpected}
          sources={sources}
          text={null}
        />
      )}
      {interpreted ? toggle : null}
      {interpreted && !sourceOpen ? null : (
        <SourceExcerpt
          excerpt={excerpt}
          expanded={expanded}
          foldable={foldable}
          label={label}
          labelled={Boolean(passage) || interpreted}
          long={long}
          onToggle={() => setExpanded((current) => !current)}
          passage={passage}
          text={text}
        />
      )}
    </div>
  )
}

/** Extrait brut d'une preuve : passage cite, puis extrait complet replie. */
function SourceExcerpt({
  passage,
  excerpt,
  foldable,
  long,
  expanded,
  labelled,
  label,
  text,
  onToggle,
}: {
  passage: string | null
  excerpt: string
  foldable: boolean
  long: boolean
  expanded: boolean
  labelled: boolean
  label: string
  text: string
  onToggle: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      {passage ? (
        <div>
          <p className={label}>{t("evaluation.evidence.citedPassage")}</p>
          <blockquote
            className={cn("mt-2 border-l-2 border-foreground pl-4", text)}
          >
            {passage}
          </blockquote>
        </div>
      ) : null}
      {foldable ? (
        <div>
          {labelled ? (
            <p className={label}>{t("evaluation.evidence.fullExcerpt")}</p>
          ) : null}
          <blockquote
            className={cn(
              "mt-2 border-l-2 border-border pl-4 text-muted-foreground",
              text,
              long && !expanded && "line-clamp-4"
            )}
          >
            {excerpt}
          </blockquote>
          {long ? (
            <button
              className="mt-1 flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground hover:underline"
              onClick={onToggle}
              type="button"
            >
              {expanded ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
              {expanded
                ? t("evaluation.evidence.collapseExcerpt")
                : t("evaluation.evidence.expandExcerpt")}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
