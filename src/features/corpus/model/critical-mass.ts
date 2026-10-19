import type { DocumentStatus } from "@/features/corpus/model/types"

/** Paramètres de la masse critique (note de décision §5, RG-5.4). */
export type CriticalMassSettingsValues = {
  exploratoryMinDocuments: number
  standardMinDocuments: number
  defensibleMinDocuments: number
  minIndependentSources: number
  defensibleVariableCoveragePct: number
  saturationDocumentCap: number
  saturationMinMeanRelevance: number
}

export type CriticalMassSettings = CriticalMassSettingsValues & {
  version: number
  /** `null` : valeurs par défaut de la plateforme. */
  workspaceId: string | null
  note: string | null
  createdAt: string
}

/** Valeurs de la note de décision, utilisées avant chargement. */
export const defaultCriticalMassSettings: CriticalMassSettingsValues = {
  exploratoryMinDocuments: 5,
  standardMinDocuments: 10,
  defensibleMinDocuments: 20,
  minIndependentSources: 2,
  defensibleVariableCoveragePct: 80,
  saturationDocumentCap: 30,
  saturationMinMeanRelevance: 60,
}

export const criticalMassLevels = [
  "exploratoire",
  "standard",
  "defendable",
] as const

export type CriticalMassLevel = (typeof criticalMassLevels)[number]

/** RG-5.7 : deux déclencheurs, deux libellés. */
export type SaturationWarning = "corpus_volumineux" | "pertinence_faible"

type MassDocument = {
  id: string
  status: DocumentStatus
  relevanceScore: number | null
}

export type CriticalMassStatus<T extends MassDocument> = {
  /** Documents conformes ou intégrés sur décision humaine (RG-5.1). */
  counted: number
  /** Plus haut plancher de volume atteint ; la couverture n'est pas évaluée. */
  floor: CriticalMassLevel | null
  floors: Record<CriticalMassLevel, number>
  /** Moyenne des scores connus des documents comptés. */
  meanRelevance: number | null
  warnings: SaturationWarning[]
  /** Documents comptés les moins pertinents, du plus faible au plus fort. */
  removalCandidates: T[]
}

export function countsInCriticalMass(status: DocumentStatus) {
  return status === "conforme" || status === "integre_decision_humaine"
}

/**
 * Plancher de volume et garde-fou anti-saturation (RG-5.7).
 *
 * Proposés au retrait : les documents sous la pertinence moyenne minimale
 * quand elle n'est pas atteinte, et les moins pertinents au-delà du plafond
 * quand il est dépassé. Un document sans score n'est jamais proposé.
 */
export function evaluateCriticalMass<T extends MassDocument>(
  documents: readonly T[],
  settings: CriticalMassSettingsValues
): CriticalMassStatus<T> {
  const counted = documents.filter((document) =>
    countsInCriticalMass(document.status)
  )
  const floors: Record<CriticalMassLevel, number> = {
    exploratoire: settings.exploratoryMinDocuments,
    standard: settings.standardMinDocuments,
    defendable: settings.defensibleMinDocuments,
  }
  const floor =
    [...criticalMassLevels]
      .reverse()
      .find((level) => counted.length >= floors[level]) ?? null

  const scored = counted
    .filter((document) => document.relevanceScore !== null)
    .sort(
      (left, right) => (left.relevanceScore ?? 0) - (right.relevanceScore ?? 0)
    )
  const meanRelevance =
    scored.length === 0
      ? null
      : scored.reduce(
          (sum, document) => sum + (document.relevanceScore ?? 0),
          0
        ) / scored.length

  const overCap = counted.length > settings.saturationDocumentCap
  const lowRelevance =
    meanRelevance !== null &&
    meanRelevance < settings.saturationMinMeanRelevance
  const warnings: SaturationWarning[] = []
  if (overCap) warnings.push("corpus_volumineux")
  if (lowRelevance) warnings.push("pertinence_faible")

  const excess = overCap ? counted.length - settings.saturationDocumentCap : 0
  const removalCandidates = scored.filter(
    (document, index) =>
      index < excess ||
      (lowRelevance &&
        (document.relevanceScore ?? 0) < settings.saturationMinMeanRelevance)
  )

  return {
    counted: counted.length,
    floor,
    floors,
    meanRelevance,
    warnings,
    removalCandidates,
  }
}

/** Sources indépendantes (documents distincts) d'un pilier ou d'une variable. */
export type CoverageItem = { id: string; label: string; sources: number }

export type FrameworkCoverage =
  | { state: "no_framework" | "pending" | "failed" }
  | {
      state: "ready"
      pillars: CoverageItem[]
      variables: (CoverageItem & { pillarId: string })[]
    }

/** RG-5.6 : ce qui manque pour atteindre le niveau suivant, nommément. */
export type LevelGaps = {
  target: Exclude<CriticalMassLevel, "exploratoire">
  /** Plancher non atteint : documents conformes requis et comptés. */
  floor: { required: number; counted: number } | null
  /** Piliers sous le nombre de sources requis (Standard et Défendable). */
  pillars: CoverageItem[]
  /** Variables à couvrir en plus pour atteindre la part requise. */
  variablesNeeded: number
  /** Variables sous le nombre de sources requis, les plus proches d'abord. */
  variables: CoverageItem[]
}

export type CriticalMassAssessment = {
  /** Niveau atteint : plancher ET condition de couverture. */
  level: CriticalMassLevel | null
  /** `null` au niveau Défendable, ou tant que la couverture est inconnue. */
  gaps: LevelGaps | null
}

/**
 * Niveau de masse critique (note de décision §3) : Exploratoire sur le seul
 * plancher ; Standard si tous les piliers ont assez de sources
 * indépendantes ; Défendable si, en plus, assez de variables en ont. Les
 * conditions se cumulent. Sans couverture calculée, le niveau s'arrête à
 * Exploratoire.
 */
export function assessCriticalMass(
  counted: number,
  coverage: FrameworkCoverage,
  settings: CriticalMassSettingsValues
): CriticalMassAssessment {
  const floors: Record<CriticalMassLevel, number> = {
    exploratoire: settings.exploratoryMinDocuments,
    standard: settings.standardMinDocuments,
    defendable: settings.defensibleMinDocuments,
  }
  if (counted < floors.exploratoire) return { level: null, gaps: null }
  if (coverage.state !== "ready") return { level: "exploratoire", gaps: null }

  const minimum = settings.minIndependentSources
  const weakPillars = coverage.pillars.filter((item) => item.sources < minimum)
  const coveredVariables = coverage.variables.filter(
    (item) => item.sources >= minimum
  ).length
  const requiredVariables = Math.ceil(
    (coverage.variables.length * settings.defensibleVariableCoveragePct) / 100
  )
  const standardCoverage =
    coverage.pillars.length > 0 && weakPillars.length === 0
  const defensibleCoverage =
    standardCoverage &&
    coverage.variables.length > 0 &&
    coveredVariables >= requiredVariables

  const level: CriticalMassLevel =
    counted >= floors.defendable && defensibleCoverage
      ? "defendable"
      : counted >= floors.standard && standardCoverage
        ? "standard"
        : "exploratoire"
  if (level === "defendable") return { level, gaps: null }

  const target = level === "standard" ? "defendable" : "standard"
  return {
    level,
    gaps: {
      target,
      floor:
        counted < floors[target] ? { required: floors[target], counted } : null,
      pillars: weakPillars,
      variablesNeeded:
        target === "defendable"
          ? Math.max(
              0,
              (coverage.variables.length > 0 ? requiredVariables : 1) -
                coveredVariables
            )
          : 0,
      variables:
        target === "defendable"
          ? coverage.variables
              .filter((item) => item.sources < minimum)
              .sort((left, right) => right.sources - left.sources)
          : [],
    },
  }
}
