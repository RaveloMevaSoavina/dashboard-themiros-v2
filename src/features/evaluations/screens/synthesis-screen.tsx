import { useQuery } from "@tanstack/react-query"
import { Eye } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"

import {
  AnalysisPage,
  PageSection,
} from "@/features/evaluations/components/analysis-layout"
import { CorpusLimits } from "@/features/evaluations/components/corpus-limits"
import { EvidenceDrawer } from "@/features/evaluations/components/evidence-drawer"
import { LayerBanner } from "@/features/evaluations/components/layer-banner"
import { OriginBadge } from "@/features/evaluations/components/origin-badge"
import { RunNotices } from "@/features/evaluations/components/run-notices"
import { StaleResult } from "@/features/evaluations/components/stale-result"
import type { SynthesisSection } from "@/features/evaluations/model/types"
import {
  getEvaluationResults,
  getRunRestitution,
  listSynthesisItemEvidences,
} from "@/features/evaluations/services/evaluation-service"
import { Button } from "@/shared/ui/base/button"
import { Skeleton } from "@/shared/ui/base/skeleton"

const sections: SynthesisSection[] = ["progres", "faiblesse", "a_verifier"]

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

  return (
    <AnalysisPage
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
        <StaleResult className="gap-10" stale={stale}>
          {data.limits.leads ? <CorpusLimits limits={data.limits} /> : null}
          {data.qualified ? null : (
            <div className="rounded-xl border border-dashed border-border px-4 py-3 text-[13px] text-muted-foreground">
              {t("evaluation.synthesis.unqualified")}
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-3">
            {sections.map((section) => {
              const items = data.items.filter(
                (item) => item.section === section
              )
              return (
                <PageSection
                  key={section}
                  title={t(`evaluation.synthesis.sections.${section}`)}
                >
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-border p-5 text-[13px] text-muted-foreground">
                      {t(`evaluation.synthesis.none.${section}`)}
                    </div>
                  ) : (
                    <ol className="flex flex-col gap-3">
                      {items.map((item) => (
                        <li
                          className="flex flex-col gap-3 rounded-xl border border-border p-4"
                          key={item.id}
                        >
                          <p className="text-sm leading-6">{item.text}</p>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <OriginBadge
                              origin={item.origin}
                              workspaceId={workspaceId}
                            />
                            <Button
                              onClick={() => setSelected(item.id)}
                              size="sm"
                              variant="ghost"
                            >
                              <Eye /> {t("evaluation.viewEvidence")}
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </PageSection>
              )
            })}
          </div>
          <PageSection title={t("evaluation.synthesis.conclusionTitle")}>
            <div className="rounded-xl border border-border p-5 text-sm leading-7">
              {data.conclusion ?? (
                <span className="text-muted-foreground">
                  {t("evaluation.synthesis.noConclusion")}
                </span>
              )}
            </div>
          </PageSection>
        </StaleResult>
      )}
      <EvidenceDrawer
        confidence={null}
        evidences={evidences.data ?? []}
        onOpenChange={(open) => !open && setSelected(null)}
        open={Boolean(selected)}
      />
    </AnalysisPage>
  )
}
