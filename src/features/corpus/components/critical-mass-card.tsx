import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Circle,
  CircleDashed,
  Trash2,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import {
  assessCriticalMass,
  type CoverageItem,
  type CriticalMassLevel,
  type CriticalMassSettingsValues,
  type CriticalMassStatus,
  evaluateCriticalMass,
  type FrameworkCoverage,
  type LevelConditions,
  type LevelGaps,
} from "@/features/corpus/model/critical-mass"
import type { CorpusDocument } from "@/features/corpus/model/types"
import { useCriticalMassSettings } from "@/features/corpus/model/use-critical-mass-settings"
import { getCriticalMassCoverage } from "@/features/corpus/services/critical-mass-coverage-service"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/base/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/base/collapsible"

const listedCandidates = 10
const listedVariables = 8
/** La jauge se lit de bas en haut : on monte d'un niveau à l'autre. */
const ladder: CriticalMassLevel[] = ["defendable", "standard", "exploratoire"]
const rank: Record<CriticalMassLevel, number> = {
  exploratoire: 0,
  standard: 1,
  defendable: 2,
}

/**
 * Jauge unique de masse critique : échelle verticale des trois niveaux, avec
 * les conditions de chacun (plancher, couverture du cadre, RG-5.5), la liste
 * exacte des manques pour le niveau suivant (RG-5.6) et le garde-fou
 * anti-saturation (RG-5.7).
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
  const level = assessment.level

  return (
    <section
      aria-labelledby="critical-mass-title"
      className="@container/mass rounded-xl border border-border bg-card"
    >
      <header className="border-b border-border px-5 py-4">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          id="critical-mass-title"
        >
          {t("corpus.criticalMass.title")}
        </p>
        <p className="mt-1.5 text-lg font-semibold tracking-tight">
          {level
            ? t(`corpus.criticalMass.levels.${level}`)
            : t("corpus.criticalMass.blockedTitle")}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {[
            level ? t(`corpus.criticalMass.scope.${level}`) : null,
            t("corpus.criticalMass.counted", { count: status.counted }),
            status.meanRelevance === null
              ? null
              : t("corpus.criticalMass.meanRelevance", {
                  mean: Math.round(status.meanRelevance),
                }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      {/* Échelle et détails côte à côte dès que la carte est assez large. */}
      <div className="grid grid-cols-1 gap-6 p-5 @2xl/mass:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <ol aria-label={t("corpus.criticalMass.ladder")}>
          {ladder.map((rung, index) => (
            <Rung
              conditions={assessment.conditions[rung]}
              counted={status.counted}
              isLast={index === ladder.length - 1}
              key={rung}
              level={rung}
              reached={level !== null && rank[level] >= rank[rung]}
              settings={settings}
              target={
                level === null
                  ? rung === "exploratoire"
                  : rank[rung] === rank[level] + 1
              }
            />
          ))}
        </ol>

        <div className="min-w-0 space-y-5">
          {level === null ? (
            <p className="text-[12px] leading-5">
              {t("corpus.criticalMass.blocked", {
                count: status.counted,
                minimum: settings.exploratoryMinDocuments,
              })}
            </p>
          ) : level === "exploratoire" ? (
            <p className="text-[12px] leading-5">
              {t("corpus.criticalMass.exploratoryWarning", {
                count: status.counted,
              })}
            </p>
          ) : null}

          {level !== null && frameworkCoverage.state !== "ready" ? (
            <p className="text-[11px] leading-5 text-muted-foreground">
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
          ) : level === "defendable" ? (
            <p className="flex gap-2 text-[12px] leading-5">
              <Check aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {t("corpus.criticalMass.complete")}
            </p>
          ) : null}

          {status.warnings.length > 0 ? (
            <Saturation
              onRemove={onRemove}
              settings={settings}
              status={status}
              workspaceId={workspaceId}
            />
          ) : null}
        </div>
      </div>
    </section>
  )
}

function Rung({
  level,
  conditions,
  counted,
  settings,
  reached,
  target,
  isLast,
}: {
  level: CriticalMassLevel
  conditions: LevelConditions
  counted: number
  settings: CriticalMassSettingsValues
  reached: boolean
  target: boolean
  isLast: boolean
}) {
  const { t } = useTranslation()
  const coverage = conditions.coverage

  return (
    <li className={cn("relative flex gap-3", !isLast && "pb-6")}>
      {/* Le segment sous un niveau atteint est plein : on y est monté. */}
      {isLast ? null : (
        <span
          aria-hidden
          className={cn(
            "absolute top-8 bottom-1 left-[11px] w-0.5 rounded-full",
            reached ? "bg-primary" : "bg-border"
          )}
        />
      )}
      <span
        aria-hidden
        className={cn(
          "relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
          reached
            ? "bg-primary text-primary-foreground"
            : target
              ? "border-2 border-primary bg-background"
              : "border border-border bg-muted"
        )}
      >
        {reached ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold leading-5">
          {t(`corpus.criticalMass.levels.${level}`)}
          <span className="sr-only">
            {" — "}
            {reached
              ? t("corpus.criticalMass.reached")
              : t("corpus.criticalMass.notReached")}
          </span>
        </p>
        <ul className="mt-1.5 space-y-1.5 text-[11px] leading-5">
          <Condition
            label={t("corpus.criticalMass.conditions.floor", {
              count: conditions.floor.required,
            })}
            met={conditions.floor.met}
            value={`${Math.min(counted, conditions.floor.required)}/${conditions.floor.required}`}
          />
          {coverage === null ? null : (
            <Condition
              label={
                level === "standard"
                  ? t("corpus.criticalMass.conditions.pillars", {
                      count: settings.minIndependentSources,
                    })
                  : t("corpus.criticalMass.conditions.variables", {
                      count: settings.minIndependentSources,
                      pct: settings.defensibleVariableCoveragePct,
                    })
              }
              met={coverage.state === "known" ? coverage.met : null}
              value={
                coverage.state === "known"
                  ? `${Math.min(coverage.covered, coverage.required)}/${coverage.required}`
                  : t("corpus.criticalMass.conditions.pending")
              }
            />
          )}
        </ul>
      </div>
    </li>
  )
}

function Condition({
  label,
  value,
  met,
}: {
  label: string
  value: string
  /** `null` : pas encore calculable. */
  met: boolean | null
}) {
  const { t } = useTranslation()
  const Icon = met === null ? CircleDashed : met ? Check : Circle
  return (
    <li
      className={cn(
        "flex items-start gap-2",
        met ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <Icon aria-hidden className="mt-[3px] size-3.5 shrink-0" />
      <span className="min-w-0 flex-1">
        {label}
        <span className="sr-only">
          {" — "}
          {met === null
            ? t("corpus.criticalMass.conditions.pending")
            : met
              ? t("corpus.criticalMass.reached")
              : t("corpus.criticalMass.notReached")}
        </span>
      </span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </li>
  )
}

/** RG-5.6 : les manques sont nommés, jamais réduits à un volume abstrait. */
function Gaps({ gaps, required }: { gaps: LevelGaps; required: number }) {
  const { t } = useTranslation()
  const variables = gaps.variables.slice(0, listedVariables)
  const hiddenVariables = gaps.variables.length - variables.length
  const describe = (item: CoverageItem) => `${item.sources}/${required}`

  return (
    <div>
      <p className="text-[12px] font-semibold">
        {t("corpus.criticalMass.gaps.title", {
          level: t(`corpus.criticalMass.levels.${gaps.target}`),
        })}
      </p>
      {gaps.pillars.length > 0 || gaps.variablesNeeded > 0 ? (
        <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
          {t("corpus.criticalMass.gaps.caption", { count: required })}
        </p>
      ) : null}
      {gaps.floor || gaps.pillars.length > 0 ? (
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border text-[11px] leading-5">
          {gaps.floor ? (
            <GapRow
              label={t("corpus.criticalMass.gaps.floorLabel")}
              value={`${gaps.floor.counted}/${gaps.floor.required}`}
            />
          ) : null}
          {gaps.pillars.map((pillar) => (
            <GapRow
              key={pillar.id}
              label={pillar.label}
              value={describe(pillar)}
            />
          ))}
        </ul>
      ) : null}
      {gaps.variablesNeeded > 0 ? (
        <>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            {t("corpus.criticalMass.gaps.variables", {
              count: gaps.variablesNeeded,
            })}
          </p>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border text-[11px] leading-5">
            {variables.map((variable) => (
              <GapRow
                key={variable.id}
                label={variable.label}
                value={describe(variable)}
              />
            ))}
            {hiddenVariables > 0 ? (
              <li className="px-3 py-2 text-muted-foreground">
                {t("corpus.criticalMass.gaps.moreVariables", {
                  count: hiddenVariables,
                })}
              </li>
            ) : null}
          </ul>
        </>
      ) : null}
    </div>
  )
}

function GapRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 px-3 py-2">
      <span className="min-w-0 truncate" title={label}>
        {label}
      </span>
      <span className="shrink-0 text-muted-foreground tabular-nums">
        {value}
      </span>
    </li>
  )
}

function Saturation({
  status,
  settings,
  workspaceId,
  onRemove,
}: {
  status: CriticalMassStatus<CorpusDocument>
  settings: CriticalMassSettingsValues
  workspaceId: string
  onRemove: (documents: CorpusDocument[]) => void
}) {
  const { t } = useTranslation()
  const listed = status.removalCandidates.slice(0, listedCandidates)
  const hidden = status.removalCandidates.length - listed.length

  return (
    <div className="rounded-lg border border-amber-400/60 bg-amber-300/15 p-3 text-amber-950 dark:text-amber-100">
      {status.warnings.map((warning) => (
        <div className="flex gap-2 not-first:mt-3" key={warning}>
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold leading-5">
              {t(`corpus.criticalMass.warnings.${warning}.title`)}
            </p>
            <p className="mt-0.5 text-[11px] leading-5">
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
        <Collapsible className="mt-3 border-t border-amber-400/40 pt-2">
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-left text-[11px] font-semibold">
            {t("corpus.criticalMass.candidates", {
              count: status.removalCandidates.length,
            })}
            <ChevronDown
              aria-hidden
              className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 space-y-1.5 text-[11px]">
              {listed.map((document) => (
                <li className="flex justify-between gap-3" key={document.id}>
                  <Link
                    className="min-w-0 truncate underline-offset-2 hover:underline"
                    title={document.filename}
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
              <p className="mt-1 text-[11px]">
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
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  )
}
