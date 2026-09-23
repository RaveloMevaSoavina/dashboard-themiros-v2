import { GripVertical, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { EvaluationPillar } from "@/features/evaluations/model/types"
import { Badge } from "@/shared/ui/base/badge"
import { Button } from "@/shared/ui/base/button"
import { Input } from "@/shared/ui/base/input"

export function PillarCard({
  pillar,
  editable = false,
  canRemove = false,
  onChange,
  onRemove,
}: {
  pillar: EvaluationPillar
  editable?: boolean
  canRemove?: boolean
  onChange?: (pillar: EvaluationPillar) => void
  onRemove?: () => void
}) {
  const { t } = useTranslation()
  return (
    <article className="rounded-xl border border-border p-5">
      <div className="flex items-start gap-3">
        {editable ? (
          <GripVertical className="mt-2 size-4 text-muted-foreground" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            {editable ? (
              <Input
                aria-label={t("evaluation.framework.pillarName")}
                className="max-w-xl font-semibold"
                onChange={(event) =>
                  onChange?.({ ...pillar, name: event.target.value })
                }
                value={pillar.name}
              />
            ) : (
              <h2 className="text-base font-semibold">{pillar.name}</h2>
            )}
            <Badge variant="outline">
              {pillar.origin === "referential"
                ? t("evaluation.framework.referential")
                : t("evaluation.framework.new")}
            </Badge>
          </div>
          <p className="mt-3 text-[13px] leading-5 text-muted-foreground">
            {pillar.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {pillar.criteria.map((criterion) => (
              <Badge key={criterion} variant="secondary">
                {criterion}
              </Badge>
            ))}
          </div>
          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t("evaluation.framework.variables")}
            </p>
            <ul className="mt-2 grid gap-1.5 text-[13px] sm:grid-cols-2">
              {pillar.variables.map((variable) => (
                <li className="flex gap-2" key={variable.code}>
                  <span aria-hidden="true">·</span>
                  <span>{variable.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-5 flex items-center gap-4 border-t border-border pt-4">
            <label className="flex min-w-0 flex-1 items-center gap-3 text-[13px]">
              <span>{t("evaluation.framework.weight")}</span>
              <input
                className="min-w-24 flex-1 accent-foreground"
                disabled={!editable}
                max={40}
                min={0}
                onChange={(event) =>
                  onChange?.({ ...pillar, weight: Number(event.target.value) })
                }
                step={1}
                type="range"
                value={pillar.weight}
              />
              <span className="w-10 text-right font-semibold tabular-nums">
                {pillar.weight}%
              </span>
            </label>
            {editable ? (
              <Button
                aria-label={t("evaluation.framework.remove")}
                disabled={!canRemove}
                onClick={onRemove}
                size="icon-sm"
                variant="ghost"
              >
                <Trash2 />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
