import { FileCheck2, Info, ShieldCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ScoreGauge } from "@/features/evaluations/components/score-gauge"
import { withoutMarkers } from "@/features/evaluations/model/passages"
import type {
  EvaluationPillar,
  LayerAScore,
  LayerBNote,
} from "@/features/evaluations/model/types"
import { cn } from "@/shared/lib/utils"
import { Badge } from "@/shared/ui/base/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/base/tooltip"

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

/* Le titre reserve deux lignes et le texte trois : d'une carte a l'autre,
   la jauge et les blocs suivants tombent a la meme hauteur. Le texte est
   l'interpretation du pilier quand l'IA l'a redigee ; la description du cadre
   passe alors dans l'infobulle (i). Sans interpretation, la description reste
   dans la carte. */
function PillarHeading({
  name,
  description,
  interpretation,
  disabled = false,
}: {
  name: string
  description?: string
  /** Interpretation du pilier, marqueurs de sources compris. */
  interpretation?: string | null
  /** Pilier pas encore note : le titre s'estompe comme le reste de la carte. */
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const reading = interpretation?.trim() ? withoutMarkers(interpretation) : null
  const text = reading ?? description
  const info = reading && description?.trim() ? description : null
  return (
    <div className="min-w-0">
      <div className="flex items-start gap-1.5">
        <h3
          className={cn(
            "line-clamp-2 min-h-10 flex-1 text-sm leading-5 font-semibold",
            disabled && "text-muted-foreground"
          )}
          title={name}
        >
          {name}
        </h3>
        {info ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label={t("evaluation.analysis.pillarDescription")}
                className={`${aboveOverlay} mt-0.5 shrink-0 rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50`}
                onClick={(event) => event.stopPropagation()}
                type="button"
              >
                <Info className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              <p className="max-w-72 leading-5">{info}</p>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <p
        className="mt-1 line-clamp-3 min-h-15 text-[12px] leading-5 text-muted-foreground"
        title={text}
      >
        {text}
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
  const notComputed =
    score.score === null ? (
      <span className="text-[12px] text-muted-foreground">
        {t("evaluation.analysis.notComputed")}
      </span>
    ) : null
  const header = (
    <PillarHeading
      description={description}
      interpretation={score.interpretation}
      name={score.pillarName}
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
          {notComputed}
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
        {notComputed}
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
