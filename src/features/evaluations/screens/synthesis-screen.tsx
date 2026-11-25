import { useQuery } from "@tanstack/react-query"
import {
  ArrowDown,
  CircleAlert,
  Eye,
  type LucideIcon,
  Quote,
  SearchCheck,
  TrendingUp,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"

import {
  AnalysisPage,
  listPanelClassName,
} from "@/features/evaluations/components/analysis-layout"
import {
  CitedText,
  useCitationSources,
} from "@/features/evaluations/components/cited-text"
import { CorpusLimits } from "@/features/evaluations/components/corpus-limits"
import { EvidenceDrawer } from "@/features/evaluations/components/evidence-drawer"
import { LayerBanner } from "@/features/evaluations/components/layer-banner"
import { OriginBadge } from "@/features/evaluations/components/origin-badge"
import { RunNotices } from "@/features/evaluations/components/run-notices"
import { RunValidation } from "@/features/evaluations/components/run-validation"
import { StaleResult } from "@/features/evaluations/components/stale-result"
import type { SynthesisSection } from "@/features/evaluations/model/types"
import {
  getEvaluationResults,
  getRunRestitution,
  listSynthesisItemEvidences,
} from "@/features/evaluations/services/evaluation-service"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/base/button"
import { Skeleton } from "@/shared/ui/base/skeleton"

const sections: SynthesisSection[] = ["progres", "faiblesse", "a_verifier"]

/* Code couleur partage avec les scores : vert, rouge, ambre. */
const sectionMeta: Record<
  SynthesisSection,
  { icon: LucideIcon; text: string; soft: string; border: string }
> = {
  progres: {
    icon: TrendingUp,
    text: "text-score-high",
    soft: "bg-score-high/10",
    border: "border-l-score-high",
  },
  faiblesse: {
    icon: CircleAlert,
    text: "text-score-low",
    soft: "bg-score-low/10",
    border: "border-l-score-low",
  },
  a_verifier: {
    icon: SearchCheck,
    text: "text-score-mid",
    soft: "bg-score-mid/10",
    border: "border-l-score-mid",
  },
}

export function SynthesisScreen() {
  const { i18n, t } = useTranslation()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const locale = i18n.resolvedLanguage ?? "fr"
  const [selected, setSelected] = useState<string | null>(null)
  const results = useQuery({
    queryKey: ["evaluation", workspaceId, "results", i18n.resolvedLanguage],
    queryFn: () => getEvaluationResults(workspaceId, locale),
    enabled: Boolean(workspaceId),
  })
  const runId = results.data?.run?.id
  const restitution = useQuery({
    queryKey: ["evaluation", workspaceId, "restitution", runId, locale],
    queryFn: () => getRunRestitution(runId ?? "", locale),
    enabled: Boolean(runId),
  })
  const evidences = useQuery({
    queryKey: ["evaluation", "synthesis-evidences", selected, locale],
    queryFn: () => listSynthesisItemEvidences(selected ?? "", locale),
    enabled: Boolean(selected),
  })
  const data = restitution.data
  const stale = results.data?.corpusChanged ?? false
  const run = results.data?.run
  /* Sources citees dans les constats et la conclusion (prompt v1.3). */
  const cited = useCitationSources(
    [
      data?.conclusionCitations,
      ...(data?.items.map((item) => item.citations) ?? []),
    ],
    locale
  )

  /* GF-6 : la validation humaine clôt la lecture des résultats. */
  return (
    <AnalysisPage
      actions={
        run ? (
          <RunValidation
            pendingAlerts={
              results.data?.alerts.filter(
                (alert) => alert.status === "a_instruire"
              ).length ?? 0
            }
            run={run}
            stale={stale}
            workspaceId={workspaceId}
          />
        ) : null
      }
      banner={
        <>
          <LayerBanner
            description={t("evaluation.synthesis.bannerDescription")}
            title={t("evaluation.synthesis.bannerTitle")}
          />
          <RunNotices
            corpusChanged={stale}
            latestRun={results.data?.latestRun ?? null}
            run={results.data?.run ?? null}
            workspaceId={workspaceId}
          />
        </>
      }
      description={t("evaluation.synthesis.description")}
      eyebrow={t("evaluation.eyebrow")}
      title={t("evaluation.synthesis.title")}
    >
      {results.isPending || (runId && restitution.isPending) ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : !data ? (
        <div className="rounded-xl border border-border p-16 text-center text-[13px] text-muted-foreground">
          {runId
            ? t("evaluation.restitution.notComputed")
            : t("evaluation.synthesis.empty")}
        </div>
      ) : (
        <StaleResult className="gap-8" stale={stale}>
          {data.limits.leads ? <CorpusLimits limits={data.limits} /> : null}
          {data.status === "completed" ? null : (
            <div className="rounded-xl border border-dashed border-border px-4 py-3 text-[13px] text-muted-foreground">
              {t(`evaluation.synthesis.notice.${data.status}`)}
            </div>
          )}
          {/* Lecture du general au detail : le message cle d'abord. */}
          <section className="relative overflow-hidden rounded-2xl border border-border bg-muted/30 p-6 sm:p-8">
            <div className="mb-4 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              <Quote className="size-4" />
              {t("evaluation.synthesis.conclusionTitle")}
            </div>
            <div className="flex max-w-[72ch] flex-col gap-4 text-[15px] leading-7">
              {/* Conclusion narrative : un paragraphe par bloc (prompt v1.1). */}
              {data.conclusion?.split(/\n\s*\n/).map((paragraph) => (
                <p key={paragraph}>
                  <CitedText
                    citations={data.conclusionCitations}
                    sources={cited.sources}
                    text={paragraph}
                  />
                </p>
              )) ?? (
                <span className="text-sm text-muted-foreground">
                  {t(`evaluation.synthesis.noConclusion.${data.status}`)}
                </span>
              )}
            </div>
          </section>

          {/* Vue d'ensemble : un compteur par section, ancre vers le detail. */}
          <nav className="grid gap-3 sm:grid-cols-3">
            {sections.map((section) => {
              const meta = sectionMeta[section]
              const count = data.items.filter(
                (item) => item.section === section
              ).length
              return (
                <a
                  className="group flex items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-muted/40"
                  href={`#synthesis-${section}`}
                  key={section}
                  onClick={(event) => {
                    event.preventDefault()
                    document
                      .getElementById(`synthesis-${section}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }}
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg",
                      meta.soft
                    )}
                  >
                    <meta.icon className={cn("size-5", meta.text)} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-2xl font-semibold tabular-nums leading-none">
                      {count}
                    </span>
                    <span className="mt-1 block truncate text-[13px] text-muted-foreground">
                      {t(`evaluation.synthesis.sections.${section}`)}
                    </span>
                  </span>
                  <ArrowDown className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              )
            })}
          </nav>

          {/* Detail : sections pleine largeur, lignes numerotees lisibles. */}
          {sections.map((section) => {
            const meta = sectionMeta[section]
            const items = data.items.filter((item) => item.section === section)
            return (
              <section
                className="scroll-mt-6 flex flex-col gap-3"
                id={`synthesis-${section}`}
                key={section}
              >
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <meta.icon className={cn("size-4", meta.text)} />
                  {t(`evaluation.synthesis.sections.${section}`)}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[12px] font-medium tabular-nums text-muted-foreground">
                    {items.length}
                  </span>
                </h2>
                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-5 text-[13px] text-muted-foreground">
                    {t(`evaluation.synthesis.none.${section}`)}
                  </div>
                ) : (
                  <ol
                    className={cn(
                      listPanelClassName,
                      "border-l-[3px]",
                      meta.border
                    )}
                  >
                    {items.map((item, index) => (
                      <li
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:gap-4 sm:p-5"
                        key={item.id}
                      >
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums",
                            meta.soft,
                            meta.text
                          )}
                        >
                          {index + 1}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-3">
                          <p className="max-w-[80ch] text-sm leading-6">
                            <CitedText
                              citations={item.citations}
                              sources={cited.sources}
                              text={item.text}
                            />
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <OriginBadge
                              origin={item.origin}
                              workspaceId={workspaceId}
                            />
                            <Button
                              className="ml-auto"
                              onClick={() => setSelected(item.id)}
                              size="sm"
                              variant="ghost"
                            >
                              <Eye /> {t("evaluation.viewEvidence")}
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )
          })}
        </StaleResult>
      )}
      <EvidenceDrawer
        confidence={null}
        evidences={evidences.data ?? []}
        interpretationExpected={results.data?.run?.ai?.reading ?? false}
        onOpenChange={(open) => !open && setSelected(null)}
        open={Boolean(selected)}
      />
      {cited.dialog}
    </AnalysisPage>
  )
}
