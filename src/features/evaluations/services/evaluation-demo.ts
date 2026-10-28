import type {
  AnalysisRun,
  EvaluationCriterion,
  EvaluationPillar,
  EvaluationResults,
  Evidence,
  IntermediateVariable,
  LayerAScore,
  LayerBNote,
  LayerCAlert,
  Restitution,
  RunAction,
  SubAnswer,
  SynthesisItem,
} from "@/features/evaluations/model/types"

/**
 * Mode demonstration des resultats d'analyse (`VITE_EVALUATION_DEMO=true`).
 * Tant qu'aucun run n'est branche cote backend, il remplace les couches
 * A, B et C et la restitution par des donnees fictives. Les piliers et criteres du cadre sont
 * repris s'ils existent, sinon un cadre fictif prend le relais. Rien n'est
 * ecrit en base : l'instruction d'une alerte et la validation du run vivent
 * en memoire.
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
  restitution: Restitution
  /** Preuves citees par une alerte, une puce de synthese ou une action. */
  linkedEvidenceIds: Map<string, string[]>
}

const datasets = new Map<string, DemoDataset>()
const validations = new Map<string, AnalysisRun["validation"]>()

/** Run fictif de l'espace, terminé depuis peu. */
export function demoRun(workspaceId: string): AnalysisRun {
  const id = `${demoRunPrefix}${workspaceId}`
  return {
    id,
    status: "completed",
    corpusSize: 14,
    corpusLevel: "standard",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    errorCode: null,
    errorMessage: null,
    validation: validations.get(id) ?? null,
  }
}

function buildDataset(
  workspaceId: string,
  sourcePillars: EvaluationPillar[],
  sourceCriteria: EvaluationCriterion[]
): DemoDataset {
  const useFixture = sourcePillars.length === 0
  const pillars = useFixture ? fixturePillars : sourcePillars
  const criteria = useFixture ? fixtureCriteria : sourceCriteria
  const criterionByCode = new Map(criteria.map((item) => [item.code, item]))
  const run = demoRun(workspaceId)

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
      versionOrder: 1,
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
          description: variable.description,
          weight: Number((100 / pillar.variables.length).toFixed(2)),
          value: state === "present" ? 1 : state === "partiel" ? 0.5 : null,
          state,
          documentsCount:
            state === "non_renseigne" ? 0 : 1 + ((variableIndex + 1) % 4),
          confidence: state === "non_renseigne" ? null : score.confidence,
          versionLabel: score.versionLabel,
          versionOrder: score.versionOrder,
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
          isPdf: false,
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
  const byScore = [...layerA].sort(
    (left, right) => (left.score ?? 0) - (right.score ?? 0)
  )
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
          qualified: true,
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
          qualified: true,
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
          qualified: true,
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
          qualified: true,
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
  const linkedEvidenceIds = new Map(
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

  /* Restitution : memes regles que le moteur, sur les resultats fictifs. */
  const pillarEvidenceIds = (pillarId: string) =>
    evidences
      .filter(
        (evidence) => evidence.pillarId === pillarId && !evidence.criterionId
      )
      .slice(0, 3)
      .map((evidence) => evidence.id)
  const criterionEvidenceIds = (criterionId: string) =>
    evidences
      .filter((evidence) => evidence.criterionId === criterionId)
      .slice(0, 3)
      .map((evidence) => evidence.id)
  const progresses = layerA
    .filter((score) => score.evolution === "renforce" && (score.delta ?? 0) > 0)
    .sort((left, right) => (right.delta ?? 0) - (left.delta ?? 0))
    .slice(0, 3)
  const weakCriteria = layerB.filter(
    (note) => note.status === "conclu" && note.note !== null && note.note <= 1
  )
  const weakPillars = layerA
    .filter((score) => score.score !== null && score.score < 50)
    .sort((left, right) => (left.score ?? 0) - (right.score ?? 0))
  const toVerify = alerts
    .filter((alert) => alert.status === "a_instruire")
    .sort(
      (left, right) =>
        Number(right.severity === "majeure") -
        Number(left.severity === "majeure")
    )
    .slice(0, 3)
  const items: SynthesisItem[] = [
    ...progresses.map((score, index) => ({
      id: `demo-item-progres-${index}`,
      section: "progres" as const,
      position: index + 1,
      text: `${score.pillarName} : le dispositif est mieux documenté (${score.score}/100, +${score.delta} points).`,
      origin: {
        type: "pillar" as const,
        id: score.pillarId,
        name: score.pillarName,
        pillarId: score.pillarId,
      },
    })),
    ...[
      ...weakCriteria.map((note) => ({
        text: `${note.criterionName} : appréciation faible (${note.note}/3), les preuves portent sur l'existence plus que sur la mise en œuvre.`,
        origin: {
          type: "criterion" as const,
          id: note.criterionId,
          name: note.criterionName,
          pillarId: null,
        },
      })),
      ...weakPillars.map((score) => ({
        text: `${score.pillarName} : présence documentaire limitée (${score.score}/100).`,
        origin: {
          type: "pillar" as const,
          id: score.pillarId,
          name: score.pillarName,
          pillarId: score.pillarId,
        },
      })),
    ]
      .slice(0, 3)
      .map((item, index) => ({
        ...item,
        id: `demo-item-faiblesse-${index}`,
        section: "faiblesse" as const,
        position: index + 1,
      })),
    ...toVerify.map((alert, index) => ({
      id: `demo-item-a_verifier-${index}`,
      section: "a_verifier" as const,
      position: index + 1,
      text: alert.message,
      origin: {
        type: "alert" as const,
        id: alert.id,
        name: alert.criterionName ?? alert.pillarName,
        pillarId: alert.pillarId,
      },
    })),
  ]
  const originEvidenceIds = (origin: SynthesisItem["origin"]) =>
    origin.type === "alert"
      ? (linkedEvidenceIds.get(origin.id) ?? [])
      : origin.type === "criterion"
        ? criterionEvidenceIds(origin.id)
        : pillarEvidenceIds(origin.id)
  const actions: RunAction[] = items
    .filter((item) => item.section !== "progres")
    .map((item, index) => {
      const name = item.origin.name ?? "—"
      const alert = item.origin.type === "alert"
      return {
        id: `demo-action-${index}`,
        position: index + 1,
        origin: item.origin,
        projections: {
          decideur: {
            text: alert
              ? `Exiger de l'équipe projet une note d'explication sur l'écart relevé pour « ${name} » avant la prochaine revue. La décision sur la suite du financement de ce volet attendra que l'alerte soit instruite.`
              : `Conditionner la prochaine tranche à un plan de renforcement de « ${name} », assorti d'indicateurs vérifiables et d'une échéance. Le comité de pilotage en examinera l'avancement à la revue suivante.`,
            justification: alert
              ? "la couche objectivée et la couche évaluative divergent sur ce point, et l'alerte de cohérence n'a pas encore été instruite : arbitrer avant, ce serait décider sur un constat contesté"
              : `« ${name} » reste faiblement étayé dans le corpus : les documents décrivent le dispositif prévu, mais apportent peu d'éléments sur sa mise en œuvre et ses premiers résultats`,
          },
          pmu: {
            text: alert
              ? `Rassembler les pièces qui expliquent l'écart sur « ${name} » (rapports d'activité, comptes rendus, données de suivi) et les verser au corpus. Signaler ensuite les points qui restent sans justification.`
              : `Documenter la mise en œuvre effective de « ${name} » dans le prochain rapport : activités réalisées, bénéficiaires touchés et difficultés rencontrées, avec les pièces justificatives correspondantes.`,
            justification: alert
              ? "l'alerte ne pourra être instruite qu'avec les documents de terrain : ce sont eux qui diront si l'écart vient d'un manque de documentation ou d'un réel décalage"
              : `les extraits disponibles sur « ${name} » portent surtout sur les intentions du programme ; sans trace de la mise en œuvre, l'appréciation reste fragile`,
          },
          analyste: {
            text: alert
              ? `Confronter les extraits contradictoires sur « ${name} », qualifier l'origine de l'écart (documentation, calendrier ou résultat), puis instruire l'alerte avec un commentaire argumenté.`
              : `Rechercher des preuves de résultats pour « ${name} » dans les rapports annuels et les données de suivi, puis compléter les variables encore non renseignées avant la prochaine analyse.`,
            justification: alert
              ? "les deux couches lisent les mêmes documents de façon opposée : seule une lecture croisée des extraits permet de dire laquelle reflète la situation"
              : `plusieurs variables de « ${name} » restent non renseignées, ce qui pèse à la fois sur le score objectivé et sur la confiance du corpus`,
          },
        },
      }
    })
  for (const item of items)
    linkedEvidenceIds.set(item.id, originEvidenceIds(item.origin))
  for (const action of actions)
    linkedEvidenceIds.set(action.id, originEvidenceIds(action.origin))
  const notConcluded = layerB.filter(
    (note) => note.status === "non_conclu"
  ).length
  const confidence =
    layerA.length === 0
      ? 0
      : Number(
          (
            layerA.reduce((total, score) => total + score.confidence, 0) /
            layerA.length
          ).toFixed(2)
        )
  const leads = notConcluded >= 2 || confidence < 0.5
  const restitution: Restitution = {
    conclusion: [
      `${
        leads
          ? `Sous réserve d'un corpus encore incomplet (${notConcluded} critères non conclus sur ${layerB.length}), les`
          : "Les"
      } résultats suggèrent un dispositif mieux documenté qu'à la version précédente. Les documents décrivent plus précisément les objectifs, les mécanismes prévus et les responsabilités, ce qui renforce la présence documentaire de plusieurs piliers.`,
      "Cette progression porte toutefois davantage sur la description du dispositif que sur sa mise en œuvre effective, qui n'est pas encore établie par le corpus. Les faiblesses relevées concernent surtout des volets où les rapports restent peu détaillés sur les activités réalisées et leurs premiers résultats.",
      "Les écarts de cohérence signalés entre les couches doivent être instruits avant toute conclusion ferme. Compléter le corpus avec des rapports de suivi et des données de terrain permettrait de confirmer ou de nuancer ces constats lors d'une prochaine analyse.",
    ].join("\n\n"),
    limits: {
      notConcluded,
      criteria: layerB.length,
      confidence,
      leads,
    },
    status: "completed",
    items,
    actions,
  }

  return {
    results: {
      run,
      latestRun: run,
      layerA,
      layerB,
      alerts,
      traceability: 87,
      layers: { b: true, c: true },
      layerCSummary: null,
      corpusChanged: false,
    },
    variables,
    answers,
    evidences,
    restitution,
    linkedEvidenceIds,
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

export function countDemoPendingAlerts(workspaceId: string) {
  return (
    datasets
      .get(workspaceId)
      ?.results.alerts.filter((alert) => alert.status === "a_instruire")
      .length ?? 0
  )
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

export function getDemoRestitution(runId: string): Restitution | null {
  const restitution = datasetForRun(runId)?.restitution
  return restitution ? structuredClone(restitution) : null
}

export function listDemoLinkedEvidences(id: string): Evidence[] {
  for (const dataset of datasets.values()) {
    const ids = dataset.linkedEvidenceIds.get(id)
    if (ids) {
      return dataset.evidences
        .filter((evidence) => ids.includes(evidence.id))
        .map(toEvidence)
    }
  }
  return []
}

export function validateDemoRun(runId: string) {
  const validation = {
    by: "Utilisateur de démonstration",
    at: new Date().toISOString(),
  }
  validations.set(runId, validation)
  const run = datasetForRun(runId)?.results.run
  if (run) run.validation = validation
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
