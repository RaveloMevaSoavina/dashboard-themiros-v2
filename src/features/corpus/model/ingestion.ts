import type { CorpusDocument } from "@/features/corpus/model/types"

/** US-8.10 : chaque fichier montre sa progression jusqu'à la pertinence. */
export const ingestionSteps = [
  "upload",
  "extraction",
  "detection",
  "pertinence",
] as const

export type IngestionStep = (typeof ingestionSteps)[number]

/** Spec ingestion §7.5 : seuils de décision automatique par défaut. */
export const relevanceThresholds = { conforme: 70, ambigu: 40 } as const

/** Le pipeline n'a pas fini : ni prêt, ni en échec. */
export function isAwaitingQualification(document: CorpusDocument) {
  return (
    document.processingState !== "ready" &&
    document.processingState !== "failed"
  )
}

/** Étapes terminées et étape en cours, pour l'indicateur de progression. */
export function ingestionProgress(document: CorpusDocument): {
  completed: number
  running: boolean
} {
  switch (document.processingState) {
    case "pending":
      return { completed: 1, running: false }
    case "extraction":
      return { completed: 1, running: true }
    case "detection":
      return { completed: 2, running: true }
    case "pertinence":
      return { completed: 3, running: true }
    case "failed":
      return { completed: 1, running: false }
    default:
      return { completed: ingestionSteps.length, running: false }
  }
}

/** Les décisions humaines ne sont possibles qu'une fois le contrôle terminé. */
export function canDecide(document: CorpusDocument) {
  return document.processingState === "ready"
}

/** RG-4.2 et arbitrage n° 1 : « Ajouter quand même » vaut aussi pour un rejet. */
export function canAddAnyway(document: CorpusDocument) {
  return (
    canDecide(document) &&
    (document.status === "a_verifier" || document.status === "rejete")
  )
}

/** RG-4.1 : un document annulé reste dans la liste mais sort du corpus. */
export function canCancel(document: CorpusDocument) {
  return (
    canDecide(document) &&
    (document.status === "a_verifier" ||
      document.status === "conforme" ||
      document.status === "integre_decision_humaine")
  )
}
