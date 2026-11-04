import type { Span } from "@/features/evaluations/model/types"

/** Marqueur de sources dans un texte redige par l'IA : « ⟦1,2⟧ ». */
export const CITATION_MARKER = /⟦(\d+(?:,\d+)*)⟧/g

const HYPHENATED = /([\p{L}\p{N}])-[^\S\n]*\n\s*([\p{L}\p{N}])/gu

/**
 * Texte d'un PDF rendu lisible : cesures de fin de ligne recollees, retours
 * a la ligne et espaces multiples ramenes a un espace (comme `clean` cote
 * API, `app/modules/evidences/passages.py`).
 */
export function cleanText(text: string): string {
  return text.replace(HYPHENATED, "$1$2").split(/\s+/).filter(Boolean).join(" ")
}

function merge(spans: Span[]): Span[] {
  const sorted = spans
    .filter(([start, end]) => end > start)
    .map(([start, end]) => [start, end] as Span)
    .sort((left, right) => left[0] - right[0])
  const merged: Span[] = []
  for (const [start, end] of sorted) {
    const last = merged.at(-1)
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }
  return merged
}

/**
 * Phrases citees d'un extrait, nettoyees, « … » entre deux passages
 * disjoints ; `null` sans phrase citee valable.
 */
export function citedPassage(
  excerpt: string,
  spans: Span[] | null | undefined
): string | null {
  // Positions en caracteres Unicode (Python), pas en unites UTF-16.
  const characters = Array.from(excerpt)
  const parts = merge(spans ?? [])
    .filter(([start, end]) => start >= 0 && end <= characters.length)
    .map(([start, end]) => cleanText(characters.slice(start, end).join("")))
    .filter(Boolean)
  return parts.length ? parts.join(" … ") : null
}
