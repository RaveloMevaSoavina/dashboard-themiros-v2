import type { ObservableVariable } from "@/features/evaluation-frameworks/model/types"
import { layerAvailable } from "@/features/evaluations/model/layer-a"
import {
  type AnalysisRun,
  type EvaluationCriterion,
  type EvaluationPillar,
  type EvaluationResults,
  type Evidence,
  type IntermediateVariable,
  type LaunchBlocker,
  type LaunchCheck,
  type LayerAScore,
  type LayerBNote,
  type LayerCAlert,
  launchBlockers,
  type Restitution,
  type RestitutionOrigin,
  type RunAction,
  type RunStep,
  type SubAnswer,
  type SynthesisItem,
} from "@/features/evaluations/model/types"
import {
  countDemoPendingAlerts,
  demoFixturePillars,
  demoRun,
  getDemoRestitution,
  getDemoResults,
  instructDemoAlert,
  isDemoId,
  isEvaluationDemo,
  listDemoEvidences,
  listDemoLinkedEvidences,
  listDemoSubAnswers,
  listDemoVariables,
} from "@/features/evaluations/services/evaluation-demo"
import { isPersona } from "@/features/workspaces/model/types"
import { supabase } from "@/shared/lib/supabase"

export type PillarTextRow = {
  name: string
  description: string
  source_locale: string
  pillar_translations: {
    locale: string
    name: string
    description: string
  }[]
}

export type VariableTextRow = {
  code: string
  label: string
  description: string | null
  source_locale: string
  pillar_variable_translations: {
    locale: string
    label: string
    description: string | null
  }[]
}

type PillarRow = PillarTextRow & {
  id: string
  weight: number
  origin: "referential" | "new"
  pillar_criteria: { criteria: { code: string } | null }[]
  pillar_variables: VariableTextRow[]
}

type RefQuestionRow = {
  code: string
  ref_question_translations: {
    locale: string
    text: string
    expected_evidence: string | null
  }[]
} | null

type CriterionRow = {
  id: string
  code: string
  name: string
  definition: string
  applicability: EvaluationCriterion["applicability"]
  weight: number
  sub_questions: {
    id: string
    text: string
    expected_evidence: string | null
    status: "active" | "inactive"
    origin: "referential" | "user"
    ref_question_id: string | null
    ref_questions: RefQuestionRow
  }[]
}

type ScoreRow = {
  id: string
  pillar_id: string
  score: number | null
  delta: number | null
  evolution_label: LayerAScore["evolution"]
  corpus_confidence: number
  documents_count: number
  pillars:
    | (PillarTextRow & {
        pillar_criteria: { criterion_id: string }[]
      })
    | null
  program_versions: { label: string; order_index: number } | null
}

type NoteRow = {
  id: string
  criterion_id: string
  note: number | null
  status: LayerBNote["status"]
  documented_sub_questions: number
  total_sub_questions: number
  justification: string | null
  ambiguity_flag: boolean
  criteria: { name: string } | null
}

type AlertRow = {
  id: string
  alert_type: string
  severity: LayerCAlert["severity"]
  message: string
  qualified: boolean
  status: LayerCAlert["status"]
  instruction_comment: string | null
  pillar_id: string | null
  criterion_id: string | null
  pillars: PillarTextRow | null
  criteria: { name: string } | null
}

type VariableRow = {
  id: string
  pillar_id: string
  variable_code: string
  value: number | null
  state: IntermediateVariable["state"]
  documents_count: number
  corpus_confidence: number | null
  program_versions: { label: string; order_index: number } | null
  pillars: {
    pillar_variables: (VariableTextRow & { weight: number | null })[]
  } | null
}

type AnswerRow = {
  id: string
  sub_question_id: string
  status: SubAnswer["status"]
  sub_questions: {
    text: string
    origin: "referential" | "user"
    ref_questions: RefQuestionRow
  } | null
}

type EvidenceRow = {
  id: string
  document_id: string | null
  page_number: number | null
  section_title: string | null
  excerpt: string
  variable_code: string | null
  documents: { original_filename: string; storage_path: string } | null
  pillars: PillarTextRow | null
  criteria: { name: string } | null
}

/** Origine d'une puce ou d'une action : pilier, critere ou alerte. */
type OriginRow = {
  pillar_id: string | null
  criterion_id: string | null
  alert_id: string | null
  pillars: PillarTextRow | null
  criteria: { name: string } | null
  layer_c_alerts: {
    pillar_id: string
    pillars: PillarTextRow | null
    criteria: { name: string } | null
  } | null
}

type SynthesisRow = {
  conclusion: string | null
  limits: {
    not_concluded?: number
    criteria?: number
    confidence?: number
    leads?: boolean
  }
  status: Restitution["status"]
}

type SynthesisItemRow = OriginRow & {
  id: string
  section: SynthesisItem["section"]
  position: number
  text: string
}

type ActionRow = OriginRow & {
  id: string
  position: number
  origin_type: RestitutionOrigin["type"]
  run_action_projections: {
    persona: string
    text: string
    justification: string
  }[]
}

type EvidenceCoverageRow = {
  pillar_id: string | null
  criterion_id: string | null
}

function isMissingRelation(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST200" ||
    error.code === "PGRST205" ||
    error.message?.includes("schema cache") === true
  )
}

export const pillarTextSelect =
  "name, description, source_locale, pillar_translations(locale, name, description)"
export const variableTextSelect =
  "code, label, description, source_locale, pillar_variable_translations(locale, label, description)"

/*
 * Un pilier et ses variables sont rediges dans leur langue source (celle de
 * l'approche, ou celle de la derniere modification) ; les autres langues de
 * l'interface viennent des traductions produites a la generation. Sans
 * traduction, le texte source s'affiche, avec sa langue : l'ecran le signale.
 */
export function localizePillar(row: PillarTextRow, locale: string) {
  const translation =
    row.source_locale === locale
      ? undefined
      : row.pillar_translations?.find((item) => item.locale === locale)
  return translation
    ? { name: translation.name, description: translation.description, locale }
    : {
        name: row.name,
        description: row.description,
        locale: row.source_locale,
      }
}

export function localizeVariable(
  row: VariableTextRow,
  locale: string
): ObservableVariable {
  const translation =
    row.source_locale === locale
      ? undefined
      : row.pillar_variable_translations?.find((item) => item.locale === locale)
  return translation
    ? {
        code: row.code,
        label: translation.label,
        description: translation.description ?? "",
        locale,
      }
    : {
        code: row.code,
        label: row.label,
        description: row.description ?? "",
        locale: row.source_locale,
      }
}

export async function getWorkspacePillars(
  workspaceId: string,
  locale: string
): Promise<EvaluationPillar[]> {
  const pillars = await fetchWorkspacePillars(workspaceId, locale)
  /* Demonstration sans cadre : les cartes gardent un nom et une description. */
  return isEvaluationDemo && pillars.length === 0
    ? demoFixturePillars()
    : pillars
}

async function fetchWorkspacePillars(
  workspaceId: string,
  locale: string
): Promise<EvaluationPillar[]> {
  const { data: framework, error: frameworkError } = await supabase
    .from("frameworks")
    .select("id")
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (frameworkError) {
    if (isMissingRelation(frameworkError)) return []
    throw frameworkError
  }
  if (!framework) return []
  const { data, error } = await supabase
    .from("pillars")
    .select(
      `id, ${pillarTextSelect}, weight, origin, pillar_variables(${variableTextSelect}), pillar_criteria(criteria(code))`
    )
    .eq("framework_id", framework.id)
    .order("order_index")
  if (error) {
    if (isMissingRelation(error)) return []
    throw error
  }
  return ((data ?? []) as unknown as PillarRow[]).map((row) => ({
    id: row.id,
    ...localizePillar(row, locale),
    weight: Number(row.weight),
    origin: row.origin,
    criteria: (row.pillar_criteria ?? []).map(
      (item) => item.criteria?.code ?? "—"
    ),
    variables: (row.pillar_variables ?? []).map((variable) =>
      localizeVariable(variable, locale)
    ),
  }))
}

const refQuestionSelect =
  "ref_questions(code, ref_question_translations(locale, text, expected_evidence))"

/*
 * Le texte d'une sous-question est copie a la generation du cadre, dans la
 * langue de l'approche. Une question du referentiel est relue dans la langue
 * de l'interface, avec le meme repli que la derivation (anglais, puis
 * francais) ; a defaut, et pour les questions propres, le texte copie fait foi.
 */
function localizeSubQuestion(
  question: {
    text: string
    expected_evidence?: string | null
    origin: "referential" | "user"
    ref_questions: RefQuestionRow
  },
  locale: string
) {
  const translations =
    question.origin === "referential"
      ? (question.ref_questions?.ref_question_translations ?? [])
      : []
  const translation = [locale, "en", "fr"]
    .map((candidate) => translations.find((item) => item.locale === candidate))
    .find((item) => item !== undefined)

  return {
    text: translation?.text ?? question.text,
    expectedEvidence: translation
      ? translation.expected_evidence
      : (question.expected_evidence ?? null),
  }
}

export async function getWorkspaceCriteria(
  workspaceId: string,
  locale: string
): Promise<EvaluationCriterion[]> {
  const { data: framework, error: frameworkError } = await supabase
    .from("frameworks")
    .select("id")
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (frameworkError) {
    if (isMissingRelation(frameworkError)) return []
    throw frameworkError
  }
  if (!framework) return []
  const { data, error } = await supabase
    .from("criteria")
    .select(
      `id, code, name, definition, applicability, weight, sub_questions(id, text, expected_evidence, status, origin, ref_question_id, ${refQuestionSelect})`
    )
    .eq("framework_id", framework.id)
  if (error) {
    if (isMissingRelation(error)) return []
    throw error
  }
  return ((data ?? []) as unknown as CriterionRow[]).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    definition: row.definition,
    applicability: row.applicability,
    weight: Number(row.weight),
    questions: (row.sub_questions ?? []).map((question) => ({
      id: question.id,
      code: question.ref_questions?.code ?? question.id,
      ...localizeSubQuestion(question, locale),
      active: question.status === "active",
      origin: question.origin,
    })),
  }))
}

export async function saveFrameworkPillars(
  workspaceId: string,
  pillars: EvaluationPillar[],
  originals: EvaluationPillar[]
) {
  const originalById = new Map(originals.map((pillar) => [pillar.id, pillar]))
  const originalIds = [...originalById.keys()]
  const { data: framework, error: frameworkError } = await supabase
    .from("frameworks")
    .select("id")
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .single()
  if (frameworkError) throw frameworkError

  const updateResults = await Promise.all(
    pillars
      .filter((pillar) => originalIds.includes(pillar.id))
      .map((pillar, index) => {
        /*
         * Le nom affiche peut etre une traduction : le texte source n'est
         * reecrit que si l'utilisateur l'a modifie. Le texte affiche devient
         * alors le texte source, dans sa langue ; les traductions du pilier
         * sont supprimees en base (« non traduit » dans les autres langues).
         */
        const renamed = pillar.name.trim() !== originalById.get(pillar.id)?.name
        return supabase
          .from("pillars")
          .update({
            weight: pillar.weight,
            order_index: index + 1,
            ...(renamed
              ? {
                  name: pillar.name.trim(),
                  description: pillar.description,
                  ...(pillar.locale ? { source_locale: pillar.locale } : {}),
                }
              : {}),
          })
          .eq("id", pillar.id)
          .eq("framework_id", framework.id)
      })
  )
  const updateError = updateResults.find((result) => result.error)?.error
  if (updateError) throw updateError

  const newPillars = pillars.filter(
    (pillar) => !originalIds.includes(pillar.id)
  )
  if (newPillars.length > 0) {
    const { error: insertError } = await supabase.from("pillars").upsert(
      newPillars.map((pillar) => ({
        id: pillar.id,
        framework_id: framework.id,
        ref_pillar_id: null,
        name: pillar.name.trim(),
        description: pillar.description.trim(),
        weight: pillar.weight,
        order_index: pillars.findIndex((item) => item.id === pillar.id) + 1,
        origin: "new" as const,
        ...(pillar.locale ? { source_locale: pillar.locale } : {}),
      })),
      { onConflict: "id" }
    )
    if (insertError) throw insertError

    const variableRows = newPillars.flatMap((pillar) => {
      const variableWeight = Number(
        (100 / Math.max(1, pillar.variables.length)).toFixed(2)
      )
      return pillar.variables.map((variable, index) => ({
        pillar_id: pillar.id,
        code: variable.code,
        label: variable.label.trim(),
        description: variable.description.trim() || null,
        weight: variableWeight,
        order_index: index + 1,
        ...(pillar.locale ? { source_locale: pillar.locale } : {}),
      }))
    })
    if (variableRows.length > 0) {
      const { error: variablesError } = await supabase
        .from("pillar_variables")
        .upsert(variableRows, { onConflict: "pillar_id,code" })
      if (variablesError) throw variablesError
    }

    const criterionCodes = [
      ...new Set(newPillars.flatMap((pillar) => pillar.criteria)),
    ]
    if (criterionCodes.length > 0) {
      const { data: criteria, error: criteriaError } = await supabase
        .from("criteria")
        .select("id, code")
        .eq("framework_id", framework.id)
        .in("code", criterionCodes)
      if (criteriaError) throw criteriaError

      const criterionIdByCode = new Map(
        (criteria ?? []).map((criterion) => [criterion.code, criterion.id])
      )
      const links = newPillars.flatMap((pillar) =>
        pillar.criteria.flatMap((code) => {
          const criterionId = criterionIdByCode.get(code)
          return criterionId
            ? [{ pillar_id: pillar.id, criterion_id: criterionId }]
            : []
        })
      )
      if (links.length > 0) {
        const { error: linksError } = await supabase
          .from("pillar_criteria")
          .upsert(links, { onConflict: "pillar_id,criterion_id" })
        if (linksError) throw linksError
      }
    }
  }

  const removedIds = originalIds.filter(
    (id) => !pillars.some((pillar) => pillar.id === id)
  )
  if (removedIds.length > 0) {
    const { error } = await supabase
      .from("pillars")
      .delete()
      .eq("framework_id", framework.id)
      .in("id", removedIds)
    if (error) throw error
  }

  const { data: userData } = await supabase.auth.getUser()
  const { error: validationError } = await supabase
    .from("frameworks")
    .update({
      status: "validated",
      validated_by: userData.user?.id ?? null,
      validated_at: new Date().toISOString(),
    })
    .eq("id", framework.id)
  if (validationError) throw validationError

  const { error: workspaceError } = await supabase
    .from("workspaces")
    .update({ pillar_framework_status: "validated" })
    .eq("id", workspaceId)
  if (workspaceError) throw workspaceError
}

/**
 * Run le plus récent de l'espace ; avec `completed`, le dernier run terminé,
 * dont les résultats sont affichés pendant qu'un autre tourne ou après un
 * échec (RG-6.1).
 */
export async function getLatestRun(
  workspaceId: string,
  { completed = false }: { completed?: boolean } = {}
): Promise<AnalysisRun | null> {
  if (isEvaluationDemo) return demoRun(workspaceId)
  let query = supabase
    .from("runs")
    .select(
      "id, status, corpus_size, corpus_seuil, created_at, completed_at, error_code, error_message"
    )
    .eq("workspace_id", workspaceId)
  if (completed) query = query.eq("status", "completed")
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    if (isMissingRelation(error)) return null
    throw error
  }
  if (!data) return null
  return {
    id: data.id,
    status: data.status as AnalysisRun["status"],
    corpusSize: data.corpus_size,
    corpusLevel: data.corpus_seuil as AnalysisRun["corpusLevel"],
    createdAt: data.created_at,
    completedAt: data.completed_at,
    errorCode: data.error_code,
    errorMessage: data.error_message,
  }
}

export async function listRunSteps(runId: string): Promise<RunStep[]> {
  if (isDemoId(runId)) return []
  const { data, error } = await supabase
    .from("run_steps")
    .select("step_name, status, output_summary, error_message")
    .eq("run_id", runId)
    .order("position")
  if (error) {
    if (isMissingRelation(error)) return []
    throw error
  }
  return (data ?? []).map((row) => ({
    name: row.step_name as RunStep["name"],
    status: row.status as RunStep["status"],
    summary: row.output_summary as RunStep["summary"],
    errorMessage: row.error_message,
  }))
}

/** Conditions de lancement, vérifiées par la base (US-12.1, US-12.2). */
export async function getLaunchCheck(
  workspaceId: string
): Promise<LaunchCheck> {
  const { data, error } = await supabase.rpc("run_launch_check", {
    p_workspace_id: workspaceId,
  })
  if (error) throw error
  const row = data as {
    code: string | null
    detail: string | null
    corpus_size: number
    minimum_documents: number
    corpus_seuil: AnalysisRun["corpusLevel"] | null
  }
  return {
    blocker: asLaunchBlocker(row.code),
    detail: row.detail,
    corpusSize: row.corpus_size,
    minimumDocuments: row.minimum_documents,
    corpusLevel: row.corpus_seuil,
  }
}

/** Erreur de lancement refusé par la base, avec sa raison métier. */
export class LaunchRefusedError extends Error {
  readonly blocker: LaunchBlocker
  readonly detail: string | null

  constructor(blocker: LaunchBlocker, detail: string | null) {
    super(blocker)
    this.blocker = blocker
    this.detail = detail
  }
}

function asLaunchBlocker(code: string | null | undefined) {
  return launchBlockers.find((blocker) => blocker === code) ?? null
}

/** Lance une analyse : le corpus est figé et le run mis en file (US-12.3). */
export async function launchRun(workspaceId: string) {
  const { data, error } = await supabase.rpc("create_run", {
    p_workspace_id: workspaceId,
  })
  if (error) {
    const blocker = asLaunchBlocker(error.message)
    if (blocker) throw new LaunchRefusedError(blocker, error.details || null)
    throw error
  }
  return data as { run_id: string }
}

async function isCorpusChanged(runId: string) {
  const { data, error } = await supabase.rpc("run_corpus_changed", {
    p_run_id: runId,
  })
  if (error) {
    if (isMissingRelation(error)) return false
    throw error
  }
  return Boolean(data)
}

export async function getEvaluationResults(
  workspaceId: string,
  locale: string
): Promise<EvaluationResults> {
  if (isEvaluationDemo) {
    const [pillars, criteria] = await Promise.all([
      fetchWorkspacePillars(workspaceId, locale).catch(() => []),
      getWorkspaceCriteria(workspaceId, locale).catch(() => []),
    ])
    return getDemoResults(workspaceId, pillars, criteria)
  }
  const [run, latestRun] = await Promise.all([
    getLatestRun(workspaceId, { completed: true }),
    getLatestRun(workspaceId),
  ])
  if (!run)
    return {
      run: null,
      latestRun,
      layerA: [],
      layerB: [],
      alerts: [],
      traceability: 0,
      layers: { b: false, c: false },
      layerCSummary: null,
      corpusChanged: false,
    }

  const [
    scoresResult,
    notesResult,
    alertsResult,
    evidenceResult,
    steps,
    corpusChanged,
  ] = await Promise.all([
    supabase
      .from("layer_a_scores")
      .select(
        `id, pillar_id, score, delta, evolution_label, corpus_confidence, documents_count, pillars(${pillarTextSelect}, pillar_criteria(criterion_id)), program_versions(label, order_index)`
      )
      .eq("run_id", run.id),
    supabase
      .from("layer_b_notes")
      .select(
        "id, criterion_id, note, status, documented_sub_questions, total_sub_questions, justification, ambiguity_flag, criteria(name)"
      )
      .eq("run_id", run.id),
    supabase
      .from("layer_c_alerts")
      .select(
        `id, alert_type, severity, message, qualified, status, instruction_comment, pillar_id, criterion_id, pillars(${pillarTextSelect}), criteria(name)`
      )
      .eq("run_id", run.id),
    supabase
      .from("evidences")
      .select("pillar_id, criterion_id")
      .eq("run_id", run.id),
    listRunSteps(run.id),
    isCorpusChanged(run.id),
  ])

  const firstError = [
    scoresResult,
    notesResult,
    alertsResult,
    evidenceResult,
  ].find((result) => result.error)?.error
  if (firstError && !isMissingRelation(firstError)) throw firstError

  const layerA: LayerAScore[] = (
    (scoresResult.data ?? []) as unknown as ScoreRow[]
  ).map((row) => ({
    id: row.id,
    pillarId: row.pillar_id,
    pillarName: row.pillars ? localizePillar(row.pillars, locale).name : "—",
    criterionIds:
      row.pillars?.pillar_criteria.map((item) => item.criterion_id) ?? [],
    score: row.score === null ? null : Number(row.score),
    delta: row.delta === null ? null : Number(row.delta),
    evolution: row.evolution_label,
    confidence: Number(row.corpus_confidence),
    documentsCount: row.documents_count,
    versionLabel: row.program_versions?.label ?? "—",
    versionOrder: row.program_versions?.order_index ?? 0,
  }))
  const layerB: LayerBNote[] = (
    (notesResult.data ?? []) as unknown as NoteRow[]
  ).map((row) => ({
    id: row.id,
    criterionId: row.criterion_id,
    criterionName: row.criteria?.name ?? "—",
    note: row.note === null ? null : Number(row.note),
    status: row.status,
    documented: row.documented_sub_questions,
    total: row.total_sub_questions,
    justification: row.justification,
    ambiguous: row.ambiguity_flag,
    answers: [],
  }))
  const alerts: LayerCAlert[] = (
    (alertsResult.data ?? []) as unknown as AlertRow[]
  ).map((row) => ({
    id: row.id,
    type: row.alert_type,
    severity: row.severity,
    message: row.message,
    qualified: row.qualified,
    status: row.status,
    instructionComment: row.instruction_comment,
    pillarId: row.pillar_id,
    pillarName: row.pillars ? localizePillar(row.pillars, locale).name : null,
    criterionId: row.criterion_id,
    criterionName: row.criteria?.name ?? null,
  }))
  /* Sorties : scores calculés et notes conclues ; un score vide n'affirme
     rien et n'a pas à être tracé. */
  const computedScores = layerA.filter((score) => score.score !== null)
  const outputCount =
    computedScores.length +
    layerB.filter((item) => item.status === "conclu").length
  const coverageRows = (evidenceResult.data ?? []) as EvidenceCoverageRow[]
  const coveredOutputs =
    computedScores.filter((score) =>
      coverageRows.some((evidence) => evidence.pillar_id === score.pillarId)
    ).length +
    layerB.filter(
      (note) =>
        note.status === "conclu" &&
        coverageRows.some(
          (evidence) => evidence.criterion_id === note.criterionId
        )
    ).length
  const traceability =
    outputCount === 0 ? 0 : Math.round((coveredOutputs / outputCount) * 100)
  return {
    run,
    latestRun,
    layerA,
    layerB,
    alerts,
    traceability,
    layers: {
      b: layerAvailable(steps, "layer_b"),
      c: layerAvailable(steps, "layer_c"),
    },
    layerCSummary: layerCSummary(steps),
    corpusChanged,
  }
}

function layerCSummary(steps: RunStep[]): EvaluationResults["layerCSummary"] {
  const summary = steps.find(
    (step) => step.name === "layer_c" && step.status === "completed"
  )?.summary
  if (typeof summary?.detected !== "number") return null
  return {
    detected: summary.detected,
    infirmed: typeof summary.infirmed === "number" ? summary.infirmed : 0,
  }
}

/** Alertes « à instruire » du run affiché : badge de navigation (RG-5). */
export async function countPendingAlerts(workspaceId: string): Promise<number> {
  if (isEvaluationDemo) return countDemoPendingAlerts(workspaceId)
  const run = await getLatestRun(workspaceId, { completed: true })
  if (!run) return 0
  const { count, error } = await supabase
    .from("layer_c_alerts")
    .select("id", { count: "exact", head: true })
    .eq("run_id", run.id)
    .eq("status", "a_instruire")
  if (error) {
    if (isMissingRelation(error)) return 0
    throw error
  }
  return count ?? 0
}

export async function listIntermediateVariables(
  runId: string,
  pillarId: string,
  locale: string
): Promise<IntermediateVariable[]> {
  if (isDemoId(runId)) return listDemoVariables(runId, pillarId)
  const { data, error } = await supabase
    .from("intermediate_variables")
    .select(
      `id, pillar_id, variable_code, value, state, documents_count, corpus_confidence, program_versions(label, order_index), pillars(pillar_variables(${variableTextSelect}, weight))`
    )
    .eq("run_id", runId)
    .eq("pillar_id", pillarId)
  if (error) {
    if (isMissingRelation(error)) return []
    throw error
  }
  return ((data ?? []) as unknown as VariableRow[]).map((row) => {
    const variable = row.pillars?.pillar_variables?.find(
      (item) => item.code === row.variable_code
    )
    const text = variable ? localizeVariable(variable, locale) : null
    return {
      id: row.id,
      pillarId: row.pillar_id,
      code: row.variable_code,
      label: text?.label ?? row.variable_code,
      description: text?.description ?? "",
      weight: variable?.weight == null ? null : Number(variable.weight),
      value: row.value === null ? null : Number(row.value),
      state: row.state,
      documentsCount: row.documents_count,
      confidence:
        row.corpus_confidence === null ? null : Number(row.corpus_confidence),
      versionLabel: row.program_versions?.label ?? "—",
      versionOrder: row.program_versions?.order_index ?? 0,
    }
  })
}

export async function listSubAnswers(
  runId: string,
  criterionId: string,
  locale: string
): Promise<SubAnswer[]> {
  if (isDemoId(runId)) return listDemoSubAnswers(runId, criterionId)
  const { data, error } = await supabase
    .from("layer_b_sub_answers")
    .select(
      `id, sub_question_id, status, sub_questions!inner(text, criterion_id, origin, ${refQuestionSelect})`
    )
    .eq("run_id", runId)
    .eq("sub_questions.criterion_id", criterionId)
  if (error) {
    if (isMissingRelation(error)) return []
    throw error
  }
  return ((data ?? []) as unknown as AnswerRow[]).map((row) => ({
    id: row.id,
    questionId: row.sub_question_id,
    text: row.sub_questions
      ? localizeSubQuestion(row.sub_questions, locale).text
      : "—",
    status: row.status,
  }))
}

const evidenceSelect = `id, document_id, page_number, section_title, excerpt, variable_code, documents(original_filename, storage_path), pillars(${pillarTextSelect}), criteria(name)`

function toEvidence(row: EvidenceRow, locale: string): Evidence {
  return {
    id: row.id,
    documentId: row.document_id,
    documentName: row.documents?.original_filename ?? null,
    storagePath: row.documents?.storage_path ?? null,
    page: row.page_number,
    section: row.section_title,
    excerpt: row.excerpt,
    pillarName: row.pillars ? localizePillar(row.pillars, locale).name : null,
    criterionName: row.criteria?.name ?? null,
    variableCode: row.variable_code,
  }
}

export async function listEvidences(
  filters: {
    runId: string
    pillarId?: string
    criterionId?: string
    variableCode?: string
  },
  locale: string
): Promise<Evidence[]> {
  if (isDemoId(filters.runId)) return listDemoEvidences(filters)
  let query = supabase
    .from("evidences")
    .select(evidenceSelect)
    .eq("run_id", filters.runId)
  if (filters.pillarId) query = query.eq("pillar_id", filters.pillarId)
  if (filters.criterionId) query = query.eq("criterion_id", filters.criterionId)
  if (filters.variableCode)
    query = query.eq("variable_code", filters.variableCode)
  const { data, error } = await query.order("created_at")
  if (error) {
    if (isMissingRelation(error)) return []
    throw error
  }
  return ((data ?? []) as unknown as EvidenceRow[]).map((row) =>
    toEvidence(row, locale)
  )
}

/** Preuves citees par une alerte, une puce de synthese ou une action. */
async function listLinkedEvidences(
  table:
    | "alert_evidences"
    | "synthesis_item_evidences"
    | "run_action_evidences",
  column: "alert_id" | "item_id" | "action_id",
  id: string,
  locale: string
): Promise<Evidence[]> {
  if (isDemoId(id)) return listDemoLinkedEvidences(id)
  const { data, error } = await supabase
    .from(table)
    .select(`evidences(${evidenceSelect})`)
    .eq(column, id)
  if (error) {
    if (isMissingRelation(error)) return []
    throw error
  }
  return (
    (data ?? []) as unknown as { evidences: EvidenceRow | null }[]
  ).flatMap((row) => (row.evidences ? [toEvidence(row.evidences, locale)] : []))
}

export function listAlertEvidences(alertId: string, locale: string) {
  return listLinkedEvidences("alert_evidences", "alert_id", alertId, locale)
}

export function listSynthesisItemEvidences(itemId: string, locale: string) {
  return listLinkedEvidences(
    "synthesis_item_evidences",
    "item_id",
    itemId,
    locale
  )
}

export function listActionEvidences(actionId: string, locale: string) {
  return listLinkedEvidences(
    "run_action_evidences",
    "action_id",
    actionId,
    locale
  )
}

const originSelect = `pillar_id, criterion_id, alert_id, pillars(${pillarTextSelect}), criteria(name), layer_c_alerts(pillar_id, pillars(${pillarTextSelect}), criteria(name))`

function toOrigin(
  type: RestitutionOrigin["type"],
  row: OriginRow,
  locale: string
): RestitutionOrigin {
  const alert = row.layer_c_alerts
  if (type === "alert")
    return {
      type,
      id: row.alert_id ?? "",
      name:
        alert?.criteria?.name ??
        (alert?.pillars ? localizePillar(alert.pillars, locale).name : null),
      pillarId: alert?.pillar_id ?? null,
    }
  if (type === "criterion")
    return {
      type,
      id: row.criterion_id ?? "",
      name: row.criteria?.name ?? null,
      pillarId: null,
    }
  return {
    type,
    id: row.pillar_id ?? "",
    name: row.pillars ? localizePillar(row.pillars, locale).name : null,
    pillarId: row.pillar_id,
  }
}

/**
 * Synthese et plan d'action du run, figes a son calcul (RG-11.3) ; les
 * trois projections persona sont chargees ensemble : changer de persona ne
 * recalcule rien (CA-11.2). `null` : run calcule avant la restitution.
 */
export async function getRunRestitution(
  runId: string,
  locale: string
): Promise<Restitution | null> {
  if (isDemoId(runId)) return getDemoRestitution(runId)
  const [synthesisResult, itemsResult, actionsResult] = await Promise.all([
    supabase
      .from("syntheses")
      .select("conclusion, limits, status")
      .eq("run_id", runId)
      .maybeSingle(),
    supabase
      .from("synthesis_items")
      .select(`id, section, position, text, ${originSelect}`)
      .eq("run_id", runId)
      .order("position"),
    supabase
      .from("run_actions")
      .select(
        `id, position, origin_type, ${originSelect}, run_action_projections(persona, text, justification)`
      )
      .eq("run_id", runId)
      .order("position"),
  ])
  const firstError = [synthesisResult, itemsResult, actionsResult].find(
    (result) => result.error
  )?.error
  if (firstError) {
    if (isMissingRelation(firstError)) return null
    throw firstError
  }
  const synthesis = synthesisResult.data as SynthesisRow | null
  if (!synthesis) return null
  const items: SynthesisItem[] = (
    (itemsResult.data ?? []) as unknown as SynthesisItemRow[]
  ).map((row) => ({
    id: row.id,
    section: row.section,
    position: row.position,
    text: row.text,
    origin: toOrigin(
      row.alert_id ? "alert" : row.criterion_id ? "criterion" : "pillar",
      row,
      locale
    ),
  }))
  const actions: RunAction[] = (
    (actionsResult.data ?? []) as unknown as ActionRow[]
  ).map((row) => ({
    id: row.id,
    position: row.position,
    origin: toOrigin(row.origin_type, row, locale),
    projections: Object.fromEntries(
      row.run_action_projections.flatMap((projection) =>
        isPersona(projection.persona)
          ? [
              [
                projection.persona,
                {
                  text: projection.text,
                  justification: projection.justification,
                },
              ],
            ]
          : []
      )
    ),
  }))
  return {
    conclusion: synthesis.conclusion,
    limits: {
      notConcluded: synthesis.limits.not_concluded ?? 0,
      criteria: synthesis.limits.criteria ?? 0,
      confidence: synthesis.limits.confidence ?? 0,
      leads: synthesis.limits.leads ?? false,
    },
    status: synthesis.status,
    items,
    actions,
  }
}

export async function instructAlert(alertId: string, comment: string) {
  if (isDemoId(alertId)) return instructDemoAlert(alertId, comment)
  /* La fonction journalise l'instruction ; le reste de l'alerte est fige. */
  const { error } = await supabase.rpc("instruct_alert", {
    p_alert_id: alertId,
    p_comment: comment.trim(),
  })
  if (error) throw error
}
