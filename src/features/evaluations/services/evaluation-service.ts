import type {
  AnalysisRun,
  EvaluationResults,
  Evidence,
  IntermediateVariable,
  LayerAScore,
  LayerBNote,
  LayerCAlert,
  SubAnswer,
  EvaluationCriterion,
  EvaluationPillar,
} from "@/features/evaluations/model/types"
import { supabase } from "@/shared/lib/supabase"

type PillarRow = {
  id: string
  name: string
  description: string
  weight: number
  origin: "referential" | "new"
  pillar_criteria: { criteria: { code: string } | null }[]
  pillar_variables: {
    code: string
    label: string
    description: string | null
  }[]
}

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
    layer: "A" | "B" | "A_B"
    expected_evidence: string | null
    status: "active" | "inactive"
    origin: "referential" | "user"
    ref_question_id: string | null
  }[]
}

type ScoreRow = {
  id: string
  pillar_id: string
  score: number
  delta: number | null
  evolution_label: LayerAScore["evolution"]
  corpus_confidence: number
  documents_count: number
  pillars: {
    name: string
    pillar_criteria: { criterion_id: string }[]
  } | null
  program_versions: { label: string } | null
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
  status: LayerCAlert["status"]
  instruction_comment: string | null
  pillar_id: string | null
  criterion_id: string | null
  pillars: { name: string } | null
  criteria: { name: string } | null
}

type VariableRow = {
  id: string
  pillar_id: string
  variable_code: string
  state: IntermediateVariable["state"]
  documents_count: number
  corpus_confidence: number | null
  program_versions: { label: string } | null
  pillars: { pillar_variables: { code: string; label: string }[] } | null
}

type AnswerRow = {
  id: string
  sub_question_id: string
  status: SubAnswer["status"]
  sub_questions: { text: string } | null
}

type EvidenceRow = {
  id: string
  document_id: string
  page_number: number | null
  section_title: string | null
  excerpt: string
  variable_code: string | null
  documents: { original_filename: string; storage_path: string } | null
  pillars: { name: string } | null
  criteria: { name: string } | null
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

export async function getWorkspacePillars(
  workspaceId: string
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
      "id, name, description, weight, origin, pillar_variables(code, label, description), pillar_criteria(criteria(code))"
    )
    .eq("framework_id", framework.id)
    .order("order_index")
  if (error) {
    if (isMissingRelation(error)) return []
    throw error
  }
  return ((data ?? []) as unknown as PillarRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    weight: Number(row.weight),
    origin: row.origin,
    criteria: (row.pillar_criteria ?? []).map(
      (item) => item.criteria?.code ?? "—"
    ),
    variables: (row.pillar_variables ?? []).map((variable) => ({
      code: variable.code,
      label: variable.label,
      description: variable.description ?? "",
    })),
  }))
}

export async function getWorkspaceCriteria(
  workspaceId: string
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
      "id, code, name, definition, applicability, weight, sub_questions(id, text, layer, expected_evidence, status, origin, ref_question_id)"
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
      code: question.ref_question_id ?? question.id,
      text: question.text,
      layer: question.layer,
      expectedEvidence: question.expected_evidence,
      active: question.status === "active",
      origin: question.origin,
    })),
  }))
}

export async function saveFrameworkPillars(
  workspaceId: string,
  pillars: EvaluationPillar[],
  originalIds: string[]
) {
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
      .map((pillar, index) =>
        supabase
          .from("pillars")
          .update({
            name: pillar.name.trim(),
            weight: pillar.weight,
            order_index: index + 1,
          })
          .eq("id", pillar.id)
          .eq("framework_id", framework.id)
      )
  )
  const updateError = updateResults.find((result) => result.error)?.error
  if (updateError) throw updateError

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

export async function getLatestRun(
  workspaceId: string
): Promise<AnalysisRun | null> {
  const { data, error } = await supabase
    .from("runs")
    .select(
      "id, status, corpus_size, corpus_seuil, created_at, completed_at, error_message"
    )
    .eq("workspace_id", workspaceId)
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
    errorMessage: data.error_message,
  }
}

export async function getEvaluationResults(
  workspaceId: string
): Promise<EvaluationResults> {
  const run = await getLatestRun(workspaceId)
  if (!run)
    return { run: null, layerA: [], layerB: [], alerts: [], traceability: 0 }

  const [scoresResult, notesResult, alertsResult, evidenceResult] =
    await Promise.all([
      supabase
        .from("layer_a_scores")
        .select(
          "id, pillar_id, score, delta, evolution_label, corpus_confidence, documents_count, pillars(name, pillar_criteria(criterion_id)), program_versions(label)"
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
          "id, alert_type, severity, message, status, instruction_comment, pillar_id, criterion_id, pillars(name), criteria(name)"
        )
        .eq("run_id", run.id),
      supabase
        .from("evidences")
        .select("pillar_id, criterion_id")
        .eq("run_id", run.id),
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
    pillarName: row.pillars?.name ?? "—",
    criterionIds:
      row.pillars?.pillar_criteria.map((item) => item.criterion_id) ?? [],
    score: Number(row.score),
    delta: row.delta === null ? null : Number(row.delta),
    evolution: row.evolution_label,
    confidence: Number(row.corpus_confidence),
    documentsCount: row.documents_count,
    versionLabel: row.program_versions?.label ?? "—",
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
    status: row.status,
    instructionComment: row.instruction_comment,
    pillarId: row.pillar_id,
    pillarName: row.pillars?.name ?? null,
    criterionId: row.criterion_id,
    criterionName: row.criteria?.name ?? null,
  }))
  const outputCount =
    layerA.length + layerB.filter((item) => item.status === "conclu").length
  const coverageRows = (evidenceResult.data ?? []) as EvidenceCoverageRow[]
  const coveredOutputs =
    layerA.filter((score) =>
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
  return { run, layerA, layerB, alerts, traceability }
}

export async function listIntermediateVariables(
  runId: string,
  pillarId: string
): Promise<IntermediateVariable[]> {
  const { data, error } = await supabase
    .from("intermediate_variables")
    .select(
      "id, pillar_id, variable_code, state, documents_count, corpus_confidence, program_versions(label), pillars(pillar_variables(code, label))"
    )
    .eq("run_id", runId)
    .eq("pillar_id", pillarId)
  if (error) {
    if (isMissingRelation(error)) return []
    throw error
  }
  return ((data ?? []) as unknown as VariableRow[]).map((row) => {
    const variables = row.pillars?.pillar_variables ?? []
    return {
      id: row.id,
      pillarId: row.pillar_id,
      code: row.variable_code,
      label:
        variables.find((variable) => variable.code === row.variable_code)
          ?.label ?? row.variable_code,
      state: row.state,
      documentsCount: row.documents_count,
      confidence:
        row.corpus_confidence === null ? null : Number(row.corpus_confidence),
      versionLabel: row.program_versions?.label ?? "—",
    }
  })
}

export async function listSubAnswers(
  runId: string,
  criterionId: string
): Promise<SubAnswer[]> {
  const { data, error } = await supabase
    .from("layer_b_sub_answers")
    .select(
      "id, sub_question_id, status, sub_questions!inner(text, criterion_id)"
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
    text: row.sub_questions?.text ?? "—",
    status: row.status,
  }))
}

export async function listEvidences(filters: {
  runId: string
  pillarId?: string
  criterionId?: string
  variableCode?: string
}): Promise<Evidence[]> {
  let query = supabase
    .from("evidences")
    .select(
      "id, document_id, page_number, section_title, excerpt, variable_code, documents(original_filename, storage_path), pillars(name), criteria(name)"
    )
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
  return ((data ?? []) as unknown as EvidenceRow[]).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    documentName: row.documents?.original_filename ?? null,
    storagePath: row.documents?.storage_path ?? null,
    page: row.page_number,
    section: row.section_title,
    excerpt: row.excerpt,
    pillarName: row.pillars?.name ?? null,
    criterionName: row.criteria?.name ?? null,
    variableCode: row.variable_code,
  }))
}

export async function listAlertEvidences(alertId: string): Promise<Evidence[]> {
  const { data, error } = await supabase
    .from("alert_evidences")
    .select(
      "evidences(id, document_id, page_number, section_title, excerpt, variable_code, documents(original_filename, storage_path), pillars(name), criteria(name))"
    )
    .eq("alert_id", alertId)
  if (error) {
    if (isMissingRelation(error)) return []
    throw error
  }
  return (
    (data ?? []) as unknown as { evidences: EvidenceRow | null }[]
  ).flatMap((row) => {
    const evidence = row.evidences
    if (!evidence) return []
    return [
      {
        id: evidence.id,
        documentId: evidence.document_id,
        documentName: evidence.documents?.original_filename ?? null,
        storagePath: evidence.documents?.storage_path ?? null,
        page: evidence.page_number,
        section: evidence.section_title,
        excerpt: evidence.excerpt,
        pillarName: evidence.pillars?.name ?? null,
        criterionName: evidence.criteria?.name ?? null,
        variableCode: evidence.variable_code,
      },
    ]
  })
}

export async function instructAlert(alertId: string, comment: string) {
  const { data } = await supabase.auth.getUser()
  const { error } = await supabase
    .from("layer_c_alerts")
    .update({
      status: "instruite",
      instruction_comment: comment.trim(),
      instructed_by: data.user?.id ?? null,
      instructed_at: new Date().toISOString(),
    })
    .eq("id", alertId)
  if (error) throw error
}
