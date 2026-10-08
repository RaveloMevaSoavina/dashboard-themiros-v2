import type {
  EvaluationCriterion,
  EvaluationPillar,
  EvaluationResults,
  Evidence,
  IntermediateVariable,
  LayerAScore,
  LayerBNote,
  LayerCAlert,
  SubAnswer,
} from "@/features/evaluations/model/types"

/**
 * Mode demonstration des resultats d'analyse (`VITE_EVALUATION_DEMO=true`).
 * Tant qu'aucun run n'est branche cote backend, il remplace les couches
 * A, B et C par des donnees fictives. Les piliers et criteres du cadre sont
 * repris s'ils existent, sinon un cadre fictif prend le relais. Rien n'est
 * ecrit en base : l'instruction d'une alerte vit en memoire.
 */
export const isEvaluationDemo = import.meta.env.VITE_EVALUATION_DEMO === "true"

const demoRunPrefix = "demo-run-"

export function isDemoId(id: string) {
  return id.startsWith("demo-")
}

/* ---------------------------------------------------------------------- */
/* Cadre fictif, utilise quand l'espace n'a pas encore de cadre valide.   */
/* ---------------------------------------------------------------------- */

const fixtureCriteria: EvaluationCriterion[] = [
  ["PERT", "Pertinence"],
  ["COH", "Cohérence"],
  ["EFFI", "Efficacité"],
  ["EFFE", "Efficience"],
  ["IMP", "Impact"],
  ["DUR", "Durabilité"],
  ["GA", "Gestion adaptative"],
  ["EQ", "Équité"],
].map(([code, name]) => ({
  id: `demo-criterion-${code}`,
  code,
  name,
  definition: "",
  applicability: "obligatoire" as const,
  weight: 12.5,
  questions: [],
}))

const fixturePillars: EvaluationPillar[] = [
  {
    id: "demo-pillar-gov",
    name: "Gouvernance",
    description:
      "Structures de pilotage, répartition des responsabilités et coordination du cadre de politique.",
    criteria: ["COH", "EFFI", "DUR"],
    variables: [
      ["GOV_ROLES", "Rôles et responsabilités"],
      ["GOV_COORD", "Coordination interministérielle"],
      ["GOV_TRANSP", "Transparence et participation"],
    ],
  },
  {
    id: "demo-pillar-align",
    name: "Alignement CDN & PNA",
    description:
      "Cohérence entre la politique évaluée et les références climatiques nationales et sectorielles.",
    criteria: ["PERT", "IMP"],
    variables: [
      ["ALI_SECT", "Alignement sectoriel"],
      ["ALI_PRIO", "Priorisation"],
      ["ALI_CIBLE", "Ciblage climatique"],
    ],
  },
  {
    id: "demo-pillar-reg",
    name: "Cadre réglementaire",
    description:
      "Solidité de la base réglementaire, adoption des textes et capacité réelle de mise en œuvre.",
    criteria: ["COH"],
    variables: [
      ["REG_TEXT", "Textes adoptés"],
      ["REG_APPL", "Application"],
      ["REG_CONF", "Conformité"],
    ],
  },
  {
    id: "demo-pillar-fin",
    name: "Finance durable",
    description:
      "Capacité à mobiliser des financements stables, prévisibles et alignés sur les priorités.",
    criteria: ["EFFI", "EFFE", "IMP", "DUR"],
    variables: [
      ["FIN_BUDG", "Budgétisation verte"],
      ["FIN_DIV", "Diversification des sources"],
      ["FIN_PREV", "Prévisibilité"],
    ],
  },
  {
    id: "demo-pillar-me",
    name: "Suivi et évaluation",
    description:
      "Dispositif de suivi, qualité des données et usage des retours pour la gestion adaptative.",
    criteria: ["EFFI", "IMP", "DUR", "GA"],
    variables: [
      ["ME_IND", "Indicateurs complets"],
      ["ME_DATA", "Qualité des données"],
      ["ME_LEARN", "Boucle d'apprentissage"],
    ],
  },
  {
    id: "demo-pillar-equity",
    name: "Participation équitable",
    description:
      "Inclusion des groupes vulnérables et répartition équitable des bénéfices de la politique.",
    criteria: ["EQ", "PERT"],
    variables: [
      ["EQ_GENRE", "Prise en compte du genre"],
      ["EQ_TERR", "Équité territoriale"],
      ["EQ_CONS", "Consultation des parties prenantes"],
    ],
  },
].map((pillar) => ({
  ...pillar,
  weight: Number((100 / 6).toFixed(2)),
  origin: "referential" as const,
  variables: pillar.variables.map(([code, label]) => ({
    code,
    label,
    description: "",
  })),
}))

/** Cadre de repli : evite des cartes sans description en demonstration. */
export function demoFixturePillars() {
  return fixturePillars
}

/* ---------------------------------------------------------------------- */
/* Valeurs fictives, deterministes pour un affichage stable.              */
/* ---------------------------------------------------------------------- */

const pillarScores = [78, 64, 52, 34, 71, 45, 86, 58]
const pillarDeltas: Array<[LayerAScore["evolution"], number]> = [
  ["renforce", 6],
  ["maintenu", 0],
  ["affaibli", -4],
  ["affaibli", -9],
  ["renforce", 3],
  ["maintenu", 1],
  ["renforce", 11],
  ["affaibli", -2],
]
/* Note (sur 3) et sous-questions documentees ; `null` = non conclu. */
const criterionNotes: Array<[number | null, number, number]> = [
  [2.5, 4, 4],
  [2, 3, 4],
  [null, 1, 4],
  [1.5, 3, 4],
  [3, 5, 5],
  [1, 2, 3],
  [2, 3, 3],
  [null, 1, 3],
]
const variableStates: IntermediateVariable["state"][] = [
  "present",
  "partiel",
  "absent",
  "present",
  "non_renseigne",
  "partiel",
]
const documents = [
  "Stratégie nationale climat 2024.pdf",
  "Plan national d'adaptation 2023-2030.pdf",
  "Rapport annuel de performance 2024.pdf",
  "Loi de finances 2025 - annexe climat.pdf",
  "Compte rendu comité de pilotage T3.docx",
  "Revue à mi-parcours du programme.pdf",
]
const sections = [
  "Gouvernance du dispositif",
  "Mise en œuvre",
  "Financement",
  "Suivi des résultats",
  "Leçons apprises",
]
const excerptTemplates = [
  (subject: string) =>
    `Le document précise que « ${subject} » fait l'objet d'un suivi semestriel, avec des responsabilités attribuées aux directions sectorielles et un rapport transmis au comité de pilotage.`,
  (subject: string) =>
    `Les engagements relatifs à « ${subject} » sont mentionnés, mais aucun calendrier de mise en œuvre ni budget associé n'est indiqué à ce stade.`,
  (subject: string) =>
    `Le rapport annuel confirme des progrès sur « ${subject} », tout en signalant des écarts importants entre les régions et un manque de données désagrégées.`,
  (subject: string) =>
    `La revue à mi-parcours recommande de renforcer « ${subject} » en clarifiant les mécanismes de coordination et en sécurisant les ressources pluriannuelles.`,
]
const fallbackQuestions = [
  "Les objectifs sont-ils formulés de manière mesurable ?",
  "Les responsabilités de mise en œuvre sont-elles clairement attribuées ?",
  "Des ressources dédiées sont-elles identifiées et sécurisées ?",
  "Les résultats obtenus sont-ils documentés et suivis dans le temps ?",
  "Les parties prenantes concernées ont-elles été consultées ?",
]

type DemoEvidence = Evidence & {
  pillarId: string
  criterionId: string | null
}

type DemoDataset = {
  results: EvaluationResults
  variables: Map<string, IntermediateVariable[]>
  answers: Map<string, SubAnswer[]>
  evidences: DemoEvidence[]
  alertEvidenceIds: Map<string, string[]>
}

const datasets = new Map<string, DemoDataset>()

function buildDataset(
  workspaceId: string,
  sourcePillars: EvaluationPillar[],
  sourceCriteria: EvaluationCriterion[]
): DemoDataset {
  const useFixture = sourcePillars.length === 0
  const pillars = useFixture ? fixturePillars : sourcePillars
  const criteria = useFixture ? fixtureCriteria : sourceCriteria
  const criterionByCode = new Map(criteria.map((item) => [item.code, item]))
  const runId = `${demoRunPrefix}${workspaceId}`

  /* Couche B : une note par critere rattache a au moins un pilier. */
  const linkedCodes = [...new Set(pillars.flatMap((pillar) => pillar.criteria))]
  const linkedCriteria = linkedCodes.flatMap((code) => {
    const criterion = criterionByCode.get(code)
    return criterion ? [criterion] : []
  })
  const answers = new Map<string, SubAnswer[]>()
  const layerB: LayerBNote[] = linkedCriteria.map((criterion, index) => {
    const [note, documented, total] =
      criterionNotes[index % criterionNotes.length]
    const questions =
      criterion.questions.filter((question) => question.active).length > 0
        ? criterion.questions
            .filter((question) => question.active)
            .map((question) => question.text)
        : fallbackQuestions
    const questionTexts = Array.from(
      { length: total },
      (_, position) => questions[position % questions.length]
    )
    answers.set(
      criterion.id,
      questionTexts.map((text, position) => ({
        id: `demo-answer-${criterion.id}-${position}`,
        questionId: `demo-question-${criterion.id}-${position}`,
        text,
        status: position < documented ? "documentee" : "non_documentee",
      }))
    )
    return {
      id: `demo-note-${criterion.id}`,
      criterionId: criterion.id,
      criterionName: criterion.name,
      note,
      status: note === null ? "non_conclu" : "conclu",
      documented,
      total,
      justification:
        note === null
          ? "Moins de la moitié des sous-questions disposent d'une preuve : aucune note n'est attribuée."
          : `Note établie sur ${documented} sous-questions documentées. Les preuves convergent sur l'existence du dispositif, moins sur sa mise en œuvre effective.`,
      ambiguous: index === 3,
      answers: [],
    }
  })

  /* Couche A : un score par pilier, relie a ses criteres. */
  const layerA: LayerAScore[] = pillars.map((pillar, index) => {
    const [evolution, delta] = pillarDeltas[index % pillarDeltas.length]
    return {
      id: `demo-score-${pillar.id}`,
      pillarId: pillar.id,
      pillarName: pillar.name,
      criterionIds: pillar.criteria.flatMap((code) => {
        const criterion = criterionByCode.get(code)
        return criterion ? [criterion.id] : []
      }),
      score: pillarScores[index % pillarScores.length],
      delta,
      evolution,
      confidence: 0.62 + ((index * 7) % 30) / 100,
      documentsCount: 4 + ((index * 3) % 7),
      versionLabel: "Version 2025 · référence",
    }
  })

  /* Preuves : variables du pilier puis criteres rattaches. */
  const evidences: DemoEvidence[] = []
  const variables = new Map<string, IntermediateVariable[]>()
  pillars.forEach((pillar, pillarIndex) => {
    const score = layerA[pillarIndex]
    variables.set(
      pillar.id,
      pillar.variables.map((variable, variableIndex) => {
        const state =
          variableStates[(pillarIndex + variableIndex) % variableStates.length]
        return {
          id: `demo-variable-${pillar.id}-${variable.code}`,
          pillarId: pillar.id,
          code: variable.code,
          label: variable.label,
          state,
          documentsCount:
            state === "non_renseigne" ? 0 : 1 + ((variableIndex + 1) % 4),
          confidence: state === "non_renseigne" ? null : score.confidence,
          versionLabel: score.versionLabel,
        }
      })
    )
    const subjects = [
      ...pillar.variables.map((variable) => ({
        subject: variable.label,
        variableCode: variable.code,
        criterionId: null as string | null,
      })),
      ...score.criterionIds.map((criterionId) => ({
        subject: `${
          layerB.find((note) => note.criterionId === criterionId)
            ?.criterionName ?? ""
        } · ${pillar.name}`,
        variableCode: null as string | null,
        criterionId,
      })),
    ]
    subjects.forEach((item, subjectIndex) => {
      const state = variables.get(pillar.id)?.[subjectIndex]?.state
      if (state === "non_renseigne") return
      const count = item.criterionId ? 2 : 1
      for (let position = 0; position < count; position += 1) {
        const seed = pillarIndex * 5 + subjectIndex * 3 + position
        evidences.push({
          id: `demo-evidence-${pillar.id}-${subjectIndex}-${position}`,
          documentId: `demo-document-${seed % documents.length}`,
          documentName: documents[seed % documents.length],
          storagePath: null,
          page: 3 + ((seed * 7) % 48),
          section: sections[seed % sections.length],
          excerpt: excerptTemplates[seed % excerptTemplates.length](
            item.subject
          ),
          pillarName: pillar.name,
          criterionName: item.criterionId
            ? (layerB.find((note) => note.criterionId === item.criterionId)
                ?.criterionName ?? null)
            : null,
          variableCode: item.variableCode,
          pillarId: pillar.id,
          criterionId: item.criterionId,
        })
      }
    })
  })

  /* Couche C : alertes sur le pilier le plus faible et un critere ambigu. */
  const byScore = [...layerA].sort((left, right) => left.score - right.score)
  const weakest = byScore[0]
  const secondWeakest = byScore[1] ?? weakest
  const strongest = byScore[byScore.length - 1]
  const ambiguousNote = layerB.find((note) => note.ambiguous) ?? layerB[0]
  const alertDrafts: Array<Omit<LayerCAlert, "id"> | null> = [
    weakest
      ? {
          type: "contradiction_ab",
          severity: "majeure",
          message: `Le score objectivé de « ${weakest.pillarName} » recule alors que les appréciations évaluatives de ses critères restent favorables.`,
          status: "a_instruire",
          instructionComment: null,
          pillarId: weakest.pillarId,
          pillarName: weakest.pillarName,
          criterionId: null,
          criterionName: null,
        }
      : null,
    ambiguousNote
      ? {
          type: "preuves_contradictoires",
          severity: "mineure",
          message: `Deux documents se contredisent sur « ${ambiguousNote.criterionName} » : la note reste prudente en attendant l'instruction.`,
          status: "a_instruire",
          instructionComment: null,
          pillarId: null,
          pillarName: null,
          criterionId: ambiguousNote.criterionId,
          criterionName: ambiguousNote.criterionName,
        }
      : null,
    secondWeakest
      ? {
          type: "corpus_insuffisant",
          severity: "mineure",
          message: `Le corpus mobilisé pour « ${secondWeakest.pillarName} » repose sur peu de documents récents : la certitude du score est réduite.`,
          status: "a_instruire",
          instructionComment: null,
          pillarId: secondWeakest.pillarId,
          pillarName: secondWeakest.pillarName,
          criterionId: null,
          criterionName: null,
        }
      : null,
    strongest
      ? {
          type: "contradiction_ab",
          severity: "mineure",
          message: `Progression marquée de « ${strongest.pillarName} » sans évolution équivalente des indicateurs de résultats.`,
          status: "instruite",
          instructionComment:
            "Écart expliqué par le décalage de publication du rapport de résultats 2024.",
          pillarId: strongest.pillarId,
          pillarName: strongest.pillarName,
          criterionId: null,
          criterionName: null,
        }
      : null,
  ]
  const alerts: LayerCAlert[] = alertDrafts.flatMap((draft, index) =>
    draft ? [{ ...draft, id: `demo-alert-${index}` }] : []
  )
  const alertEvidenceIds = new Map(
    alerts.map((alert) => [
      alert.id,
      evidences
        .filter((evidence) =>
          alert.criterionId
            ? evidence.criterionId === alert.criterionId
            : evidence.pillarId === alert.pillarId
        )
        .slice(0, 3)
        .map((evidence) => evidence.id),
    ])
  )

  return {
    results: {
      run: {
        id: runId,
        status: "completed",
        corpusSize: 14,
        corpusLevel: "standard",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        errorMessage: null,
      },
      layerA,
      layerB,
      alerts,
      traceability: 87,
    },
    variables,
    answers,
    evidences,
    alertEvidenceIds,
  }
}

function datasetForRun(runId: string) {
  return datasets.get(runId.slice(demoRunPrefix.length))
}

function toEvidence({ pillarId, criterionId, ...evidence }: DemoEvidence) {
  return evidence
}

/** Copie a chaque lecture : React Query detecte ainsi les changements. */
export function getDemoResults(
  workspaceId: string,
  pillars: EvaluationPillar[],
  criteria: EvaluationCriterion[]
): EvaluationResults {
  let dataset = datasets.get(workspaceId)
  if (!dataset) {
    dataset = buildDataset(workspaceId, pillars, criteria)
    datasets.set(workspaceId, dataset)
  }
  return structuredClone(dataset.results)
}

export function listDemoVariables(runId: string, pillarId: string) {
  return structuredClone(datasetForRun(runId)?.variables.get(pillarId) ?? [])
}

export function listDemoSubAnswers(runId: string, criterionId: string) {
  return structuredClone(datasetForRun(runId)?.answers.get(criterionId) ?? [])
}

export function listDemoEvidences(filters: {
  runId: string
  pillarId?: string
  criterionId?: string
  variableCode?: string
}): Evidence[] {
  return (datasetForRun(filters.runId)?.evidences ?? [])
    .filter(
      (evidence) =>
        (!filters.pillarId || evidence.pillarId === filters.pillarId) &&
        (!filters.criterionId ||
          evidence.criterionId === filters.criterionId) &&
        (!filters.variableCode ||
          evidence.variableCode === filters.variableCode)
    )
    .map(toEvidence)
}

export function listDemoAlertEvidences(alertId: string): Evidence[] {
  for (const dataset of datasets.values()) {
    const ids = dataset.alertEvidenceIds.get(alertId)
    if (ids) {
      return dataset.evidences
        .filter((evidence) => ids.includes(evidence.id))
        .map(toEvidence)
    }
  }
  return []
}

export function instructDemoAlert(alertId: string, comment: string) {
  for (const dataset of datasets.values()) {
    const alert = dataset.results.alerts.find((item) => item.id === alertId)
    if (alert) {
      alert.status = "instruite"
      alert.instructionComment = comment.trim()
    }
  }
}
