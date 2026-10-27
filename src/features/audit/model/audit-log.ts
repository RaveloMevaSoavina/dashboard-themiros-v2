import type { AuditFilters } from "./types.ts"

export type AuditChange = {
  field: string
  before: unknown
  after: unknown
  changed: boolean
}

/**
 * Valeurs avant/apres champ par champ. L'ancienne valeur reste lisible meme
 * quand le champ disparait (CA-13.1) ; les champs modifies passent devant.
 */
export function auditChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): AuditChange[] {
  const fields = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])
  return Array.from(fields, (field) => {
    const previous = before?.[field] ?? null
    const next = after?.[field] ?? null
    return {
      field,
      before: previous,
      after: next,
      changed: JSON.stringify(previous) !== JSON.stringify(next),
    }
  }).sort((left, right) => Number(right.changed) - Number(left.changed))
}

/** Valeur JSON en texte lisible ; null s'affiche comme absente. */
export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return JSON.stringify(value, null, 2)
}

/**
 * Bornes de la periode en instants : du debut du premier jour au debut du
 * lendemain du dernier (borne de fin exclusive), dans le fuseau du lecteur.
 */
export function periodBounds(filters: Pick<AuditFilters, "from" | "to">): {
  from: string | null
  to: string | null
} {
  const startOf = (day: string) => new Date(`${day}T00:00:00`)
  let to: string | null = null
  if (filters.to) {
    const end = startOf(filters.to)
    end.setDate(end.getDate() + 1)
    to = end.toISOString()
  }
  return {
    from: filters.from ? startOf(filters.from).toISOString() : null,
    to,
  }
}

/* Une cellule commencant par ces signes serait lue comme une formule par
   le tableur : un nom de fichier charge ne doit rien executer. */
const formulaPrefix = /^[=+\-@\t\r]/

function csvCell(value: string): string {
  const safe = formulaPrefix.test(value) ? `'${value}` : value
  return /[";\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

/**
 * CSV lisible par un tableur francophone : point-virgule et marque d'ordre
 * des octets, pour que les accents et les colonnes s'ouvrent sans import.
 */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return `﻿${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`
}
