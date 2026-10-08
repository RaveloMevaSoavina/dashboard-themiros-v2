import { FileCheck2, ShieldCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ScoreGauge } from "@/features/evaluations/components/score-gauge"
import type {
  EvaluationPillar,
  LayerAScore,
  LayerBNote,
} from "@/features/evaluations/model/types"
import { cn } from "@/shared/lib/utils"
import { Badge } from "@/shared/ui/base/badge"

/** `vertical` : jauge centree sous le titre ; `horizontal` : jauge a gauche. */
export type PillarCardLayout = "vertical" | "horizontal"

/* Toute la carte ouvre le detail du pilier via un bouton etire en fond ;
   les controles internes passent au-dessus (`relative z-10`) pour rester
   cliquables independamment. */
const cardClassName =
  "relative isolate rounded-xl border border-border p-5 transition-colors hover:bg-muted/40"
const overlayClassName =
  "absolute inset-0 z-[1] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
const aboveOverlay = "relative z-10"

/* Titre et description reservent toujours deux lignes chacun : d'une carte a
   l'autre, la jauge et les blocs suivants tombent a la meme hauteur. */
function PillarHeading({
  name,
  versionLabel,
  description,
  disabled = false,
}: {
  name: string
  versionLabel?: string
  description?: string
  /** Pilier pas encore note : le titre s'estompe comme le reste de la carte. */
  disabled?: boolean
}) {
  return (
    <div className="min-w-0">
      <h3
        className={cn(
          "line-clamp-2 min-h-10 text-sm leading-5 font-semibold",
          disabled && "text-muted-foreground"
        )}
        title={name}
      >
        {name}
      </h3>
      {versionLabel ? (
        <p className="mt-1 truncate text-[12px] leading-5 text-muted-foreground">
          {versionLabel}
        </p>
      ) : null}
      <p
        className="mt-1 line-clamp-2 min-h-10 text-[12px] leading-5 text-muted-foreground"
        title={description}
      >
        {description}
      </p>
    </div>
  )
}

export function PillarResultCard({
  score,
  criteria = [],
  alertsCount,
  description,
  layout = "vertical",
  onOpen,
  onCriterion,
  onAlerts,
}: {
  score: LayerAScore
  /** Etiquettes de criteres ; omises, la carte n'en affiche aucune. */
  criteria?: LayerBNote[]
  alertsCount: number
  /** Description du pilier dans le cadre ; absente des resultats du run. */
  description?: string
  layout?: PillarCardLayout
  /** Clic sur la carte : ouvre le detail du pilier. */
  onOpen: () => void
  onCriterion?: (criterionId: string) => void
  onAlerts: () => void
}) {
  const { t } = useTranslation()
  const evolution = (
    <span className="text-[12px] tabular-nums text-muted-foreground">
      {score.evolution ? (
        <>
          {t(`evaluation.evolution.${score.evolution}`)} ·{" "}
          {score.delta !== null && score.delta > 0 ? "+" : ""}
          {score.delta ?? 0}
        </>
      ) : (
        "—"
      )}
    </span>
  )
  const header = (
    <PillarHeading
      description={description}
      name={score.pillarName}
      versionLabel={score.versionLabel}
    />
  )
  const criteriaBadges =
    criteria.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {criteria.map((criterion) => (
          <button
            className={aboveOverlay}
            key={criterion.id}
            onClick={() => onCriterion?.(criterion.criterionId)}
            type="button"
          >
            <Badge variant="default">
              {criterion.criterionName} ·{" "}
              {criterion.note === null
                ? t("evaluation.nonConcluded")
                : `${criterion.note}/3`}
            </Badge>
          </button>
        ))}
      </div>
    ) : null
  const stats = (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="flex items-center gap-1.5">
        <ShieldCheck className="size-4" />
        {Math.round(score.confidence * 100)}% · {score.documentsCount} docs
      </span>
      <button
        className={`${aboveOverlay} flex items-center gap-1.5`}
        onClick={onAlerts}
        type="button"
      >
        <FileCheck2 className="size-4" /> {alertsCount}
      </button>
    </div>
  )

  const overlay = (
    <button
      aria-label={t("evaluation.pillar.open", { name: score.pillarName })}
      className={overlayClassName}
      onClick={onOpen}
      type="button"
    />
  )

  if (layout === "horizontal") {
    return (
      <article className={`${cardClassName} flex h-full items-center gap-5`}>
        {overlay}
        <ScoreGauge
          className="w-20 shrink-0"
          label={score.pillarName}
          max={100}
          size="sm"
          value={score.score}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {header}
          {evolution}
          {criteriaBadges}
          {stats}
        </div>
      </article>
    )
  }

  return (
    <article className={`${cardClassName} flex h-full flex-col`}>
      {overlay}
      {header}
      <div className="mt-5 flex flex-col items-center gap-3">
        <ScoreGauge label={score.pillarName} max={100} value={score.score} />
        {evolution}
      </div>
      {criteriaBadges ? <div className="mt-5">{criteriaBadges}</div> : null}
      <div className="mt-auto pt-5">
        <div className="border-t border-border pt-4">{stats}</div>
      </div>
    </article>
  )
}

/** Pilier du cadre que le dernier run n'a pas encore note. */
export function UnscoredPillarCard({
  pillar,
  layout = "vertical",
}: {
  pillar: EvaluationPillar
  layout?: PillarCardLayout
}) {
  const { t } = useTranslation()
  const text = (
    <PillarHeading
      description={pillar.description}
      disabled
      name={pillar.name}
    />
  )
  const notScored = (
    <span className="text-[12px] text-muted-foreground">
      {t("evaluation.analysis.notScored")}
    </span>
  )

  if (layout === "horizontal") {
    return (
      <article className="flex h-full items-center gap-5 rounded-xl border border-border p-5">
        <ScoreGauge
          className="w-20 shrink-0"
          label={pillar.name}
          max={100}
          size="sm"
          value={null}
        />
        <div className="min-w-0 flex-1">
          {text}
          <div className="mt-3">{notScored}</div>
        </div>
      </article>
    )
  }

  return (
    <article className="flex h-full flex-col rounded-xl border border-border p-5">
      {text}
      <div className="mt-5 flex flex-col items-center gap-3">
        <ScoreGauge label={pillar.name} max={100} value={null} />
        {notScored}
      </div>
    </article>
  )
}
