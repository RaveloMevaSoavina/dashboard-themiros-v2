import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import {
  assessCriticalMass,
  type CoverageItem,
  type CriticalMassLevel,
  criticalMassLevels,
  evaluateCriticalMass,
  type FrameworkCoverage,
  type LevelGaps,
} from "@/features/corpus/model/critical-mass"
import type { CorpusDocument } from "@/features/corpus/model/types"
import { useCriticalMassSettings } from "@/features/corpus/model/use-critical-mass-settings"
import { getCriticalMassCoverage } from "@/features/corpus/services/critical-mass-coverage-service"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/base/button"

const listedCandidates = 10
const listedVariables = 8

/**
 * Jauge unique de masse critique : niveau atteint (plancher et couverture du
 * cadre, RG-5.5), liste exacte des manques pour le niveau suivant (RG-5.6)
 * et garde-fou anti-saturation (RG-5.7).
 */
export function CriticalMassCard({
  documents,
  workspaceId,
  onRemove,
}: {
  documents: CorpusDocument[]
  workspaceId: string
  onRemove: (documents: CorpusDocument[]) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? "fr"
  const { settings } = useCriticalMassSettings(workspaceId)
  const coverage = useQuery({
    queryKey: ["corpus", workspaceId, "coverage", locale],
    queryFn: () => getCriticalMassCoverage(workspaceId, locale),
    enabled: Boolean(workspaceId),
    refetchInterval: (query) =>
      query.state.data?.state === "pending" ? 10_000 : false,
  })
  const status = evaluateCriticalMass(documents, settings)
  const frameworkCoverage: FrameworkCoverage = coverage.data ?? {
    state: "pending",
  }
  const assessment = assessCriticalMass(
    status.counted,
    frameworkCoverage,
    settings
  )
  const scale = Math.max(settings.saturationDocumentCap, status.counted)
  const position = (count: number) => `${Math.min(count / scale, 1) * 100}%`
  const listed = status.removalCandidates.slice(0, listedCandidates)
  const hidden = status.removalCandidates.length - listed.length

  return (
    <section className="mt-7 rounded-xl border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">
          {t("corpus.criticalMass.title")}
        </h2>
        <p className="text-[13px] text-muted-foreground">
          {t("corpus.criticalMass.counted", { count: status.counted })}
        </p>
      </div>

      <div className="relative mt-5 h-2 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: position(status.counted) }}
        />
        {criticalMassLevels.map((level) => (
          <span
            className="absolute -top-1 h-4 w-px bg-foreground/40"
            key={level}
            style={{ left: position(status.floors[level]) }}
          />
        ))}
      </div>
      <div className="relative mt-2 h-4 text-[11px] text-muted-foreground">
        {criticalMassLevels.map((level) => (
          <span
            className={cn(
              "absolute -translate-x-1/2 whitespace-nowrap",
              assessment.level === level && "font-semibold text-foreground"
            )}
            key={level}
            style={{ left: position(status.floors[level]) }}
          >
            {status.floors[level]}
          </span>
        ))}
      </div>

      {assessment.level === null ? (
        <p className="mt-4 text-[13px] leading-6">
          {t("corpus.criticalMass.blocked", {
            count: status.counted,
            minimum: settings.exploratoryMinDocuments,
          })}
        </p>
      ) : (
        <LevelReached level={assessment.level} />
      )}
      {assessment.level === "exploratoire" ? (
        <p className="mt-1 text-[13px] leading-6">
          {t("corpus.criticalMass.exploratoryWarning", {
            count: status.counted,
          })}
        </p>
      ) : null}
      {assessment.level !== null && frameworkCoverage.state !== "ready" ? (
        <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
          {coverage.isError
            ? t("corpus.criticalMass.coverage.error")
            : t(`corpus.criticalMass.coverage.${frameworkCoverage.state}`)}
        </p>
      ) : null}
      {assessment.gaps ? (
        <Gaps
          gaps={assessment.gaps}
          required={settings.minIndependentSources}
        />
      ) : null}

      {status.warnings.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-400/60 bg-amber-300/20 p-4 text-amber-950 dark:text-amber-100">
          {status.warnings.map((warning) => (
            <div className="flex gap-2 not-first:mt-3" key={warning}>
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-[13px] font-semibold">
                  {t(`corpus.criticalMass.warnings.${warning}.title`)}
                </p>
                <p className="mt-1 text-[12px] leading-5">
                  {t(`corpus.criticalMass.warnings.${warning}.detail`, {
                    count: status.counted,
                    cap: settings.saturationDocumentCap,
                    mean: Math.round(status.meanRelevance ?? 0),
                    minimum: settings.saturationMinMeanRelevance,
                  })}
                </p>
              </div>
            </div>
          ))}

          {listed.length > 0 ? (
            <>
              <p className="mt-4 text-[12px] font-semibold">
                {t("corpus.criticalMass.candidates")}
              </p>
              <ul className="mt-2 space-y-1 text-[12px]">
                {listed.map((document) => (
                  <li className="flex justify-between gap-3" key={document.id}>
                    <Link
                      className="truncate underline-offset-2 hover:underline"
                      to={`/workspaces/${workspaceId}/corpus/documents/${document.id}`}
                    >
                      {document.filename}
                    </Link>
                    <span className="shrink-0 tabular-nums">
                      {document.relevanceScore}/100
                    </span>
                  </li>
                ))}
              </ul>
              {hidden > 0 ? (
                <p className="mt-1 text-[12px]">
                  {t("corpus.criticalMass.moreCandidates", { count: hidden })}
                </p>
              ) : null}
              <Button
                className="mt-3"
                onClick={() => onRemove(status.removalCandidates)}
                size="sm"
                variant="outline"
              >
                <Trash2 />
                {t("corpus.criticalMass.remove", {
                  count: status.removalCandidates.length,
                })}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function LevelReached({ level }: { level: CriticalMassLevel }) {
  const { t } = useTranslation()
  return (
    <p className="mt-4 text-[13px] leading-6">
      <span className="font-semibold">
        {t("corpus.criticalMass.levelReached", {
          level: t(`corpus.criticalMass.levels.${level}`),
        })}
      </span>{" "}
      · {t(`corpus.criticalMass.scope.${level}`)}
    </p>
  )
}

/** RG-5.6 : les manques sont nommés, jamais réduits à un volume abstrait. */
function Gaps({ gaps, required }: { gaps: LevelGaps; required: number }) {
  const { t } = useTranslation()
  const describe = (item: CoverageItem) =>
    t(
      item.sources === 0
        ? "corpus.criticalMass.gaps.itemEmpty"
        : "corpus.criticalMass.gaps.itemPartial",
      {
        label: item.label,
        sources: t("corpus.criticalMass.gaps.sources", { count: item.sources }),
        required,
      }
    )
  const variables = gaps.variables.slice(0, listedVariables)
  const hiddenVariables = gaps.variables.length - variables.length

  return (
    <div className="mt-3 rounded-lg bg-muted/60 p-3 text-[12px] leading-5">
      <p className="font-semibold">
        {t("corpus.criticalMass.gaps.title", {
          level: t(`corpus.criticalMass.levels.${gaps.target}`),
        })}
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        {gaps.floor ? (
          <li>{t("corpus.criticalMass.gaps.floor", gaps.floor)}</li>
        ) : null}
        {gaps.pillars.length > 0 ? (
          <li>{gaps.pillars.map(describe).join(", ")}</li>
        ) : null}
        {gaps.variablesNeeded > 0 ? (
          <li>
            {t("corpus.criticalMass.gaps.variables", {
              count: gaps.variablesNeeded,
              list:
                variables.map(describe).join(", ") +
                (hiddenVariables > 0
                  ? t("corpus.criticalMass.gaps.moreVariables", {
                      count: hiddenVariables,
                    })
                  : ""),
            })}
          </li>
        ) : null}
      </ul>
    </div>
  )
}
