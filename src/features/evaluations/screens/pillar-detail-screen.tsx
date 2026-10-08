import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Eye,
  FileSearch,
  FileText,
  FileWarning,
  ShieldCheck,
} from "lucide-react"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"

import { sortNotes } from "@/features/evaluations/components/analysis-insights"
import {
  AnalysisPage,
  listPanelClassName,
  listRowClassName,
  PageSection,
} from "@/features/evaluations/components/analysis-layout"
import {
  CriterionNoteMeter,
  CriterionNoteValue,
} from "@/features/evaluations/components/criterion-note-meter"
import { EvidenceDrawer } from "@/features/evaluations/components/evidence-drawer"
import { LayerBanner } from "@/features/evaluations/components/layer-banner"
import {
  openEvidenceDocument,
  PillarEvidenceDrawer,
} from "@/features/evaluations/components/pillar-evidence-drawer"
import { ScoreGauge } from "@/features/evaluations/components/score-gauge"
import type {
  Evidence,
  IntermediateVariable,
  LayerAScore,
  LayerBNote,
  LayerCAlert,
} from "@/features/evaluations/model/types"
import {
  getEvaluationResults,
  getWorkspacePillars,
  listEvidences,
  listIntermediateVariables,
  listSubAnswers,
} from "@/features/evaluations/services/evaluation-service"
import { cn } from "@/shared/lib/utils"
import { Badge } from "@/shared/ui/base/badge"
import { Button } from "@/shared/ui/base/button"
import { Skeleton } from "@/shared/ui/base/skeleton"

const subTitleClassName =
  "text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"

function StatItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium">{children}</dd>
    </div>
  )
}

/** Bandeau de synthese : la jauge, puis les indicateurs qui la qualifient. */
function PillarScoreSummary({
  score,
  pendingAlerts,
  onAlerts,
}: {
  score: LayerAScore
  pendingAlerts: number
  onAlerts: () => void
}) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-6 rounded-xl border border-border p-5 sm:flex-row sm:items-center">
      <ScoreGauge
        className="mx-auto shrink-0 sm:mx-0"
        label={score.pillarName}
        max={100}
        value={score.score}
      />
      <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
        <StatItem label={t("evaluation.pillar.evolution")}>
          {score.evolution ? (
            <span className="tabular-nums">
              {t(`evaluation.evolution.${score.evolution}`)} ·{" "}
              {score.delta !== null && score.delta > 0 ? "+" : ""}
              {score.delta ?? 0}
            </span>
          ) : (
            "—"
          )}
        </StatItem>
        <StatItem label={t("evaluation.evidence.confidence")}>
          <span className="flex items-center gap-1.5 tabular-nums">
            <ShieldCheck className="size-4 shrink-0" />
            {Math.round(score.confidence * 100)}% · {score.documentsCount} docs
          </span>
        </StatItem>
        <StatItem label={t("evaluation.pillar.version")}>
          {score.versionLabel}
        </StatItem>
        <StatItem label={t("evaluation.analysis.pendingAlerts")}>
          <button
            className="flex items-center gap-1.5 tabular-nums hover:underline"
            onClick={onAlerts}
            type="button"
          >
            <AlertTriangle className="size-4 shrink-0" />
            {pendingAlerts}
          </button>
        </StatItem>
      </dl>
    </section>
  )
}

/** Ligne de la liste maitre : note, couverture et barre en 3 segments. */
function CriterionRow({
  note,
  selected,
  onSelect,
}: {
  note: LayerBNote
  selected: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      aria-pressed={selected}
      className={cn(
        listRowClassName,
        "border-l-2",
        selected ? "border-l-foreground bg-muted/50" : "border-l-transparent"
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium">
          {note.criterionName}
        </p>
        <CriterionNoteValue className="shrink-0 text-sm" note={note.note} />
      </div>
      <CriterionNoteMeter className="mt-2.5" note={note.note} />
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {t("evaluation.pillar.questionsDocumented", {
          documented: note.documented,
          total: note.total,
        })}
        {note.ambiguous ? (
          <>
            {" · "}
            <AlertTriangle className="size-3 shrink-0" />
            {t("evaluation.pillar.ambiguous")}
          </>
        ) : null}
      </p>
    </button>
  )
}

function EvidenceExcerpt({ evidence }: { evidence: Evidence }) {
  const { t } = useTranslation()
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p
              className="truncate text-[13px] font-medium"
              title={evidence.documentName ?? undefined}
            >
              {evidence.documentName ?? t("evaluation.evidence.unavailable")}
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {[
                evidence.page
                  ? `${t("evaluation.evidence.page")} ${evidence.page}`
                  : null,
                evidence.section,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
        </div>
        <Button
          aria-label={t("evaluation.evidence.openDocument")}
          disabled={!evidence.storagePath}
          onClick={() => void openEvidenceDocument(evidence)}
          size="icon-sm"
          variant="ghost"
        >
          <ExternalLink />
        </Button>
      </div>
      <blockquote className="mt-3 border-l-2 border-foreground pl-4 text-[13px] leading-6">
        {evidence.excerpt}
      </blockquote>
    </li>
  )
}

/** Volet detail : justification, sous-questions puis preuves du critere. */
function CriterionDetail({
  note,
  runId,
  onOpenCriterion,
}: {
  note: LayerBNote
  runId: string
  onOpenCriterion: () => void
}) {
  const { t } = useTranslation()
  const answers = useQuery({
    queryKey: ["evaluation", runId, "answers", note.criterionId],
    queryFn: () => listSubAnswers(runId, note.criterionId),
  })
  const evidences = useQuery({
    queryKey: ["evaluation", runId, "criterion-evidences", note.criterionId],
    queryFn: () => listEvidences({ runId, criterionId: note.criterionId }),
  })

  return (
    <div className="flex min-w-0 flex-col gap-6 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">
            {note.criterionName}
          </h3>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            {note.status === "conclu"
              ? t("evaluation.pillar.concludedHint")
              : t("evaluation.pillar.nonConcludedHint")}
          </p>
        </div>
        <CriterionNoteValue className="shrink-0 text-xl" note={note.note} />
      </div>
      {note.justification ? (
        <p className="text-[13px] leading-6">{note.justification}</p>
      ) : null}

      <div>
        <p className={subTitleClassName}>
          {t("evaluation.pillar.subQuestions")}
        </p>
        {answers.isPending ? (
          <Skeleton className="mt-3 h-24" />
        ) : (answers.data?.length ?? 0) === 0 ? (
          <p className="mt-3 text-[13px] text-muted-foreground">
            {t("evaluation.pillar.noSubQuestions")}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {(answers.data ?? []).map((answer) => (
              <li
                className="flex items-start justify-between gap-4 py-2.5"
                key={answer.id}
              >
                <p className="text-[13px] leading-5">{answer.text}</p>
                <Badge
                  className="shrink-0"
                  variant={
                    answer.status === "documentee" ? "secondary" : "outline"
                  }
                >
                  {t(`evaluation.answerStatus.${answer.status}`)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className={subTitleClassName}>
            {t("evaluation.pillar.criterionEvidence")}
          </p>
          {evidences.data ? (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {t("evaluation.pillar.evidenceCount", {
                count: evidences.data.length,
              })}
            </span>
          ) : null}
        </div>
        {evidences.isPending ? (
          <Skeleton className="mt-3 h-36" />
        ) : evidences.isError ? (
          <p className="mt-3 text-[13px] text-muted-foreground">
            {t("evaluation.evidence.loadError")}
          </p>
        ) : (evidences.data?.length ?? 0) === 0 ? (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-dashed border-border p-4 text-[13px] text-muted-foreground">
            <FileWarning className="size-4 shrink-0" />
            {t("evaluation.pillar.noEvidence")}
          </div>
        ) : (
          <ol className="mt-3 divide-y divide-border">
            {(evidences.data ?? []).map((evidence) => (
              <EvidenceExcerpt evidence={evidence} key={evidence.id} />
            ))}
          </ol>
        )}
      </div>

      <Button
        className="self-start"
        onClick={onOpenCriterion}
        size="sm"
        variant="outline"
      >
        {t("evaluation.pillar.openCriterion")} <ChevronRight />
      </Button>
    </div>
  )
}

function VariablesSection({
  variables,
  isLoading,
  onShowEvidence,
}: {
  variables: IntermediateVariable[]
  isLoading: boolean
  onShowEvidence: (variable: IntermediateVariable) => void
}) {
  const { t } = useTranslation()
  return (
    <PageSection
      description={t("evaluation.pillar.variablesDescription")}
      title={t("evaluation.layerA.variables")}
    >
      {isLoading ? (
        <Skeleton className="h-52 rounded-xl" />
      ) : variables.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-border p-6 text-[13px] text-muted-foreground">
          <FileSearch className="size-4" /> {t("evaluation.layerA.noVariables")}
        </div>
      ) : (
        <div className={listPanelClassName}>
          {variables.map((variable) => (
            <div
              className="grid items-center gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_110px_70px_auto]"
              key={variable.id}
            >
              <p className="min-w-0 text-sm font-medium">{variable.label}</p>
              <span className="text-[13px]">
                {t(`evaluation.variableState.${variable.state}`)}
              </span>
              <span className="text-[12px] tabular-nums text-muted-foreground">
                {variable.documentsCount} docs
              </span>
              <Button
                disabled={variable.state === "non_renseigne"}
                onClick={() => onShowEvidence(variable)}
                size="sm"
                variant="outline"
              >
                <Eye /> {t("evaluation.viewEvidence")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </PageSection>
  )
}

function AlertsSection({
  alerts,
  onOpenAlerts,
}: {
  alerts: LayerCAlert[]
  onOpenAlerts: () => void
}) {
  const { t } = useTranslation()
  return (
    <PageSection
      action={
        alerts.length > 0 ? (
          <Button onClick={onOpenAlerts} size="sm" variant="ghost">
            {t("evaluation.pillar.seeAlerts")} <ChevronRight />
          </Button>
        ) : null
      }
      title={t("evaluation.pillar.alertsTitle")}
    >
      {alerts.length === 0 ? (
        <div className="rounded-xl border border-border p-5 text-[13px] text-muted-foreground">
          {t("evaluation.pillar.noAlerts")}
        </div>
      ) : (
        <div className={listPanelClassName}>
          {alerts.map((alert) => (
            <button
              className={listRowClassName}
              key={alert.id}
              onClick={onOpenAlerts}
              type="button"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant={alert.severity === "majeure" ? "default" : "outline"}
                >
                  {t(`evaluation.severity.${alert.severity}`)}
                </Badge>
                <Badge variant="outline">
                  {t(`evaluation.alertStatus.${alert.status}`)}
                </Badge>
                {alert.criterionName ? (
                  <Badge variant="secondary">{alert.criterionName}</Badge>
                ) : null}
              </div>
              <p className="mt-2 line-clamp-3 text-[13px] leading-5">
                {alert.message}
              </p>
            </button>
          ))}
        </div>
      )}
    </PageSection>
  )
}

/** Documents ayant fourni au moins une preuve au pilier (US-15.4). */
function DocumentsSection({
  evidences,
  isLoading,
}: {
  evidences: Evidence[]
  isLoading: boolean
}) {
  const { t } = useTranslation()
  const documents = [
    ...evidences
      .reduce((byDocument, evidence) => {
        const current = byDocument.get(evidence.documentId)
        byDocument.set(evidence.documentId, {
          name: evidence.documentName ?? t("evaluation.evidence.unavailable"),
          count: (current?.count ?? 0) + 1,
        })
        return byDocument
      }, new Map<string, { name: string; count: number }>())
      .entries(),
  ].sort(([, left], [, right]) => right.count - left.count)

  return (
    <PageSection
      description={t("evaluation.pillar.documentsDescription", {
        count: documents.length,
      })}
      title={t("evaluation.pillar.documentsTitle")}
    >
      {isLoading ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-border p-5 text-[13px] text-muted-foreground">
          {t("evaluation.pillar.noDocuments")}
        </div>
      ) : (
        <ul className={listPanelClassName}>
          {documents.map(([documentId, document]) => (
            <li
              className="flex items-center justify-between gap-3 px-4 py-3"
              key={documentId}
            >
              <span className="flex min-w-0 items-center gap-2 text-[13px]">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate" title={document.name}>
                  {document.name}
                </span>
              </span>
              <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                {t("evaluation.pillar.usages", { count: document.count })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PageSection>
  )
}

/**
 * Ecran 15 : detail d'un pilier, du general au particulier. Le score et
 * ses indicateurs ouvrent la page, puis les criteres en vue maitre-detail ;
 * les variables occupent la colonne principale, alertes et documents la
 * colonne laterale.
 */
export function PillarDetailScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { workspaceId = "", pillarId = "" } = useParams<{
    workspaceId: string
    pillarId: string
  }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedVariable, setSelectedVariable] =
    useState<IntermediateVariable | null>(null)
  const [allEvidenceOpen, setAllEvidenceOpen] = useState(false)
  const analysisPath = `/workspaces/${workspaceId}/analysis`

  const results = useQuery({
    queryKey: ["evaluation", workspaceId, "results"],
    queryFn: () => getEvaluationResults(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const pillars = useQuery({
    queryKey: ["evaluation", workspaceId, "pillars"],
    queryFn: () => getWorkspacePillars(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const runId = results.data?.run?.id ?? ""
  const variables = useQuery({
    queryKey: ["evaluation", runId, "variables", pillarId],
    queryFn: () => listIntermediateVariables(runId, pillarId),
    enabled: Boolean(runId && pillarId),
  })
  const pillarEvidences = useQuery({
    queryKey: ["evaluation", workspaceId, "evidences", runId, pillarId],
    queryFn: () => listEvidences({ runId, pillarId }),
    enabled: Boolean(runId && pillarId),
  })
  const variableEvidences = useQuery({
    queryKey: ["evaluation", runId, "evidences", selectedVariable?.id],
    queryFn: () =>
      listEvidences({
        runId,
        pillarId,
        variableCode: selectedVariable?.code,
      }),
    enabled: Boolean(selectedVariable && runId),
  })

  if (results.isPending)
    return <Skeleton className="mx-auto h-[560px] w-full max-w-6xl" />

  const back = {
    label: t("evaluation.back"),
    onClick: () => void navigate(`${analysisPath}/pillars`),
  }
  const banner = (
    <LayerBanner
      description={t("evaluation.layerA.bannerDescription")}
      title={t("evaluation.layerA.bannerTitle")}
    />
  )
  const data = results.data
  const score = data?.layerA.find((item) => item.pillarId === pillarId)
  const pillar = pillars.data?.find((item) => item.id === pillarId)
  if (!data || !score) {
    return (
      <AnalysisPage
        back={back}
        description={pillar?.description ?? ""}
        eyebrow={t("evaluation.layerA.title")}
        title={pillar?.name ?? t("evaluation.layerA.title")}
      >
        <div className="flex flex-col items-center rounded-xl border border-border px-6 py-16 text-center">
          <FileSearch className="size-7 text-muted-foreground" />
          <p className="mt-5 text-sm font-semibold">
            {t("evaluation.pillar.notFound")}
          </p>
          <p className="mt-2 max-w-lg text-[13px] leading-5 text-muted-foreground">
            {t("evaluation.pillar.notFoundDescription")}
          </p>
        </div>
      </AnalysisPage>
    )
  }

  const criteria = sortNotes(
    data.layerB.filter((note) => score.criterionIds.includes(note.criterionId))
  )
  const selectedCriterion =
    criteria.find(
      (note) => note.criterionId === searchParams.get("criterion")
    ) ??
    criteria[0] ??
    null
  const selectCriterion = (criterionId: string) =>
    setSearchParams({ criterion: criterionId }, { replace: true })
  const alerts = data.alerts.filter(
    (alert) =>
      alert.pillarId === pillarId ||
      (alert.criterionId !== null &&
        score.criterionIds.includes(alert.criterionId))
  )
  const openAlerts = () =>
    void navigate(`${analysisPath}/alerts?pillar=${pillarId}`)

  return (
    <AnalysisPage
      actions={
        <Button onClick={() => setAllEvidenceOpen(true)} variant="outline">
          <Eye /> {t("evaluation.pillar.allEvidence")}
        </Button>
      }
      back={back}
      banner={banner}
      description={pillar?.description ?? score.versionLabel}
      eyebrow={t("evaluation.layerA.title")}
      title={score.pillarName}
    >
      <PillarScoreSummary
        onAlerts={openAlerts}
        pendingAlerts={
          alerts.filter((alert) => alert.status === "a_instruire").length
        }
        score={score}
      />

      <PageSection
        description={t("evaluation.pillar.criteriaDescription")}
        title={t("evaluation.pillar.criteriaTitle")}
      >
        {criteria.length === 0 ? (
          <div className="rounded-xl border border-border p-10 text-center text-[13px] text-muted-foreground">
            {t("evaluation.pillar.noCriteria")}
          </div>
        ) : (
          <div className="grid overflow-hidden rounded-xl border border-border lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="divide-y divide-border border-b border-border lg:border-r lg:border-b-0">
              {criteria.map((note) => (
                <CriterionRow
                  key={note.id}
                  note={note}
                  onSelect={() => selectCriterion(note.criterionId)}
                  selected={note.criterionId === selectedCriterion?.criterionId}
                />
              ))}
            </div>
            {selectedCriterion ? (
              <CriterionDetail
                key={selectedCriterion.criterionId}
                note={selectedCriterion}
                onOpenCriterion={() =>
                  void navigate(
                    `${analysisPath}/criteria?criterion=${selectedCriterion.criterionId}`
                  )
                }
                runId={runId}
              />
            ) : null}
          </div>
        )}
      </PageSection>

      <div className="grid items-start gap-x-6 gap-y-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <VariablesSection
            isLoading={variables.isPending}
            onShowEvidence={setSelectedVariable}
            variables={variables.data ?? []}
          />
        </div>
        <aside className="flex min-w-0 flex-col gap-10">
          <AlertsSection alerts={alerts} onOpenAlerts={openAlerts} />
          <DocumentsSection
            evidences={pillarEvidences.data ?? []}
            isLoading={pillarEvidences.isPending}
          />
        </aside>
      </div>

      <EvidenceDrawer
        confidence={selectedVariable?.confidence ?? null}
        evidences={variableEvidences.data ?? []}
        onOpenChange={(open) => !open && setSelectedVariable(null)}
        open={Boolean(selectedVariable)}
      />
      <PillarEvidenceDrawer
        evidences={pillarEvidences.data ?? []}
        isError={pillarEvidences.isError}
        isLoading={pillarEvidences.isFetching && !pillarEvidences.data}
        onOpenChange={setAllEvidenceOpen}
        onRetry={() => void pillarEvidences.refetch()}
        score={allEvidenceOpen ? score : null}
      />
    </AnalysisPage>
  )
}
