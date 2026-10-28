import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileType,
  LoaderCircle,
  Sheet,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { toast } from "sonner"

import {
  AnalysisPage,
  PageSection,
} from "@/features/evaluations/components/analysis-layout"
import { RunNotices } from "@/features/evaluations/components/run-notices"
import { isDemoId } from "@/features/evaluations/services/evaluation-demo"
import { getEvaluationResults } from "@/features/evaluations/services/evaluation-service"
import {
  type ExportFormat,
  exportFormats,
} from "@/features/exports/model/types"
import { exportRun } from "@/features/exports/services/export-service"
import { useWorkspaces } from "@/features/workspaces/model/workspace-provider"
import { Badge } from "@/shared/ui/base/badge"
import { Button } from "@/shared/ui/base/button"
import { Skeleton } from "@/shared/ui/base/skeleton"

const formatIcons = {
  pdf: FileText,
  docx: FileType,
  xlsx: FileSpreadsheet,
  csv: Sheet,
} as const

const reportSections = [
  "overview",
  "pillars",
  "criteria",
  "alerts",
  "synthesis",
  "actions",
  "notes",
] as const

/** Ecran 22 : exports du dernier run termine (E14). */
export function ExportsScreen() {
  const { i18n, t } = useTranslation()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const { persona } = useWorkspaces()
  const queryClient = useQueryClient()
  const locale = i18n.resolvedLanguage ?? "fr"
  const results = useQuery({
    queryKey: ["evaluation", workspaceId, "results", i18n.resolvedLanguage],
    queryFn: () => getEvaluationResults(workspaceId, locale),
    enabled: Boolean(workspaceId),
  })
  const run = results.data?.run ?? null
  const demo = run ? isDemoId(run.id) : false

  const download = useMutation({
    mutationFn: (format: ExportFormat) =>
      exportRun(run?.id ?? "", format, { locale, persona }),
    onSuccess: async (_, format) => {
      /* L'export est journalise par l'API : le journal change. */
      await queryClient.invalidateQueries({ queryKey: ["audit", workspaceId] })
      toast.success(
        t("exports.done", { format: t(`exports.formats.${format}.name`) })
      )
    },
    onError: () => toast.error(t("exports.error")),
  })
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
  })

  return (
    <AnalysisPage
      banner={
        <RunNotices
          corpusChanged={results.data?.corpusChanged ?? false}
          latestRun={results.data?.latestRun ?? null}
          run={run}
          workspaceId={workspaceId}
        />
      }
      description={t("exports.description")}
      eyebrow={t("nav.sections.governance")}
      title={t("exports.title")}
    >
      {results.isPending ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : results.isError ? (
        <div className="rounded-xl border border-border p-10 text-center text-[13px]">
          <p className="text-muted-foreground">{t("exports.loadError")}</p>
          <Button
            className="mt-4"
            onClick={() => void results.refetch()}
            size="sm"
            variant="outline"
          >
            {t("exports.retry")}
          </Button>
        </div>
      ) : !run ? (
        <div className="rounded-xl border border-border p-16 text-center text-[13px] text-muted-foreground">
          {t("exports.empty")}
        </div>
      ) : (
        <>
          <PageSection title={t("exports.run.title")}>
            <dl className="grid gap-x-6 gap-y-3 rounded-xl border border-border p-5 text-[13px] sm:grid-cols-3">
              <div>
                <dt className="text-[12px] text-muted-foreground">
                  {t("exports.run.date")}
                </dt>
                <dd className="mt-1">
                  {dateFormatter.format(
                    new Date(run.completedAt ?? run.createdAt)
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted-foreground">
                  {t("exports.run.corpus")}
                </dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  {t("exports.run.documents", { count: run.corpusSize })}
                  <Badge
                    variant={
                      run.corpusLevel === "exploratoire" ? "warning" : "outline"
                    }
                  >
                    {t(`corpus.criticalMass.levels.${run.corpusLevel}`)}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted-foreground">
                  {t("exports.run.validation")}
                </dt>
                <dd className="mt-1">
                  {run.validation
                    ? t("evaluation.validation.validatedBy", {
                        name:
                          run.validation.by ??
                          t("evaluation.validation.unknownMember"),
                        date: dateFormatter.format(new Date(run.validation.at)),
                      })
                    : t("exports.run.notValidated")}
                </dd>
              </div>
            </dl>
          </PageSection>

          <PageSection
            description={t("exports.formatsDescription", {
              persona: t(`personas.${persona}.name`),
            })}
            title={t("exports.formatsTitle")}
          >
            {demo ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-3 text-[13px] text-muted-foreground">
                {t("exports.demo")}
              </div>
            ) : null}
            <ul className="grid gap-4 sm:grid-cols-2">
              {exportFormats.map((format) => {
                const Icon = formatIcons[format]
                const pending =
                  download.isPending && download.variables === format
                const failed = download.isError && download.variables === format
                return (
                  <li
                    className="flex flex-col gap-4 rounded-xl border border-border p-5"
                    key={format}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {t(`exports.formats.${format}.name`)}
                        </p>
                        <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                          {t(`exports.formats.${format}.description`)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                      {failed ? (
                        <p className="text-[12px] text-destructive">
                          {t("exports.failed")}
                        </p>
                      ) : (
                        <span />
                      )}
                      <Button
                        disabled={demo || download.isPending}
                        onClick={() => download.mutate(format)}
                        size="sm"
                        variant="outline"
                      >
                        {pending ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <Download />
                        )}
                        {pending ? t("exports.exporting") : t("exports.action")}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </PageSection>

          <PageSection title={t("exports.contents.title")}>
            <div className="flex flex-col gap-4 rounded-xl border border-border p-5 text-[13px] leading-6">
              <ol className="list-decimal pl-5">
                {reportSections.map((section) => (
                  <li key={section}>
                    {t(`exports.contents.sections.${section}`)}
                  </li>
                ))}
              </ol>
              <p className="text-muted-foreground">
                {t("exports.contents.limits")}
              </p>
              <p className="text-muted-foreground">
                {t("exports.contents.audit")}
              </p>
            </div>
          </PageSection>
        </>
      )}
    </AnalysisPage>
  )
}
