import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"

import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import type { AiUsageBySource } from "@/features/usage/model/types"
import { getWorkspaceAiUsage } from "@/features/usage/services/ai-usage-service"
import { useWorkspaces } from "@/features/workspaces/model/workspace-provider"
import { Skeleton } from "@/shared/ui/base/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/base/table"

/* Le detail entree / sortie manque pour les generations anterieures au
   suivi : un total partiel serait trompeur, la cellule reste vide. */
function hasSplit(source: AiUsageBySource) {
  return (
    source.kind === "embedding" ||
    (source.inputTokens ?? 0) + (source.outputTokens ?? 0) ===
      source.totalTokens
  )
}

/**
 * Consommation IA de l'espace, ouverte depuis le menu du compte : tokens
 * factures par OpenAI (chiffres de l'API) et cout calcule avec les tarifs
 * configures cote API.
 */
export function AiUsageScreen() {
  const { i18n, t } = useTranslation()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const { workspaces } = useWorkspaces()
  const workspace = workspaces.find((item) => item.id === workspaceId)
  const locale = i18n.resolvedLanguage ?? "fr"
  const usage = useQuery({
    queryKey: ["usage", workspaceId],
    queryFn: () => getWorkspaceAiUsage(workspaceId),
    enabled: Boolean(workspaceId),
  })

  const tokens = new Intl.NumberFormat(locale)
  const euros = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: value > 0 && value < 1 ? 4 : 2,
    }).format(value)
  const dates = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  })

  const data = usage.data
  const partial = data?.sources.some((source) => !hasSplit(source)) ?? false
  const unpriced =
    data !== undefined && data.total.totalTokens > 0 && data.total.costEur === 0

  return (
    <div className="mx-auto w-full max-w-6xl pb-10">
      <CorpusPageHeader
        description={
          data?.total.since
            ? t("usage.descriptionSince", {
                date: dates.format(new Date(data.total.since)),
              })
            : t("usage.description")
        }
        eyebrow={workspace?.name ?? t("usage.eyebrow")}
        title={t("usage.title")}
      />

      <div className="mt-8">
        {usage.isPending ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : usage.isError || !data ? (
          <p className="text-[13px] text-muted-foreground">
            {t("usage.loadError")}
          </p>
        ) : data.total.calls === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            {t("usage.empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            <dl className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: t("usage.total.cost"),
                  value: euros(data.total.costEur),
                  hint: t("usage.total.calls", { count: data.total.calls }),
                },
                {
                  label: t("usage.total.completion"),
                  value: tokens.format(data.total.completionTokens),
                  hint: t("usage.total.completionHint"),
                },
                {
                  label: t("usage.total.embedding"),
                  value: tokens.format(data.total.embeddingTokens),
                  hint: t("usage.total.embeddingHint"),
                },
              ].map((metric) => (
                <div
                  className="rounded-xl border border-border p-4"
                  key={metric.label}
                >
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {metric.label}
                  </dt>
                  <dd className="mt-3 text-2xl font-semibold tabular-nums">
                    {metric.value}
                  </dd>
                  <dd className="mt-1 text-[12px] text-muted-foreground">
                    {metric.hint}
                  </dd>
                </div>
              ))}
            </dl>

            {unpriced ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-[12px] leading-5 text-muted-foreground">
                {t("usage.unpriced")}
              </p>
            ) : null}

            <div>
              <h3 className="text-sm font-semibold">{t("usage.bySource")}</h3>
              <div className="mt-3 overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("usage.columns.source")}</TableHead>
                      <TableHead>{t("usage.columns.model")}</TableHead>
                      <TableHead className="text-right">
                        {t("usage.columns.calls")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("usage.columns.input")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("usage.columns.output")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("usage.columns.cost")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="tabular-nums">
                    {data.sources.map((source) => {
                      const split = hasSplit(source)
                      return (
                        <TableRow key={`${source.source}-${source.kind}`}>
                          <TableCell>
                            {t(`usage.sources.${source.source}`)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {source.models ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {tokens.format(source.calls)}
                          </TableCell>
                          <TableCell className="text-right">
                            {split
                              ? tokens.format(source.inputTokens ?? 0)
                              : tokens.format(source.totalTokens)}
                          </TableCell>
                          <TableCell className="text-right">
                            {source.kind === "embedding" || !split
                              ? "—"
                              : tokens.format(source.outputTokens ?? 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {euros(source.costEur)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {partial ? (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  {t("usage.partialSplit")}
                </p>
              ) : null}
            </div>

            {data.runs.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold">{t("usage.byRun")}</h3>
                <div className="mt-3 overflow-hidden rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("usage.columns.run")}</TableHead>
                        <TableHead>{t("usage.columns.status")}</TableHead>
                        <TableHead className="text-right">
                          {t("usage.columns.completion")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("usage.columns.embedding")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("usage.columns.cost")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="tabular-nums">
                      {data.runs.map((run) => (
                        <TableRow key={run.runId}>
                          <TableCell>
                            {dates.format(new Date(run.createdAt))}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {t(`evaluation.run.stepStatus.${run.status}`)}
                          </TableCell>
                          <TableCell className="text-right">
                            {tokens.format(run.completionTokens)}
                          </TableCell>
                          <TableCell className="text-right">
                            {tokens.format(run.embeddingTokens)}
                          </TableCell>
                          <TableCell className="text-right">
                            {euros(run.costEur)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            <p className="text-[12px] leading-5 text-muted-foreground">
              {t("usage.note")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
