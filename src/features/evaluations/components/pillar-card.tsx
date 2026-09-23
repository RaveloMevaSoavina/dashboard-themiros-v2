import { GripVertical, Minus, Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { EvaluationPillar } from "@/features/evaluations/model/types"
import { Badge } from "@/shared/ui/base/badge"
import { Button } from "@/shared/ui/base/button"
import { Input } from "@/shared/ui/base/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/base/tooltip"

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
    <article className="flex h-full rounded-xl border border-border p-5">
      <div className="flex h-full w-full items-start gap-3">
        {editable ? (
          <GripVertical className="mt-2 size-4 text-muted-foreground" />
        ) : null}
        <div className="flex h-full min-w-0 flex-1 flex-col">
          <div className="flex min-h-10 items-start justify-between gap-3">
            {editable ? (
              <Input
                aria-label={t("evaluation.framework.pillarName")}
                className="h-10 max-w-xl text-sm font-semibold"
                onChange={(event) =>
                  onChange?.({ ...pillar, name: event.target.value })
                }
                value={pillar.name}
              />
            ) : (
              <h2 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5">
                {pillar.name}
              </h2>
            )}
            {pillar.origin === "new" ? (
              <Badge variant="outline">{t("evaluation.framework.new")}</Badge>
            ) : null}
          </div>
          <p className="mt-3 line-clamp-2 h-10 text-[13px] leading-5 text-muted-foreground">
            {pillar.description}
          </p>
          <div className="mt-3 flex h-6 flex-nowrap items-center gap-1.5 overflow-hidden">
            {pillar.criteria.slice(0, 2).map((criterion) => (
              <Badge key={criterion} variant="default">
                {criterion}
              </Badge>
            ))}
            {pillar.criteria.length > 2 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline">
                    {t("evaluation.framework.otherCriteria", {
                      count: pillar.criteria.length - 2,
                    })}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6}>
                  <ul className="flex flex-col gap-1 py-0.5">
                    {pillar.criteria.slice(2).map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <div className="mt-3 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t("evaluation.framework.variables")}
            </p>
            <ul className="mt-2 grid gap-1.5 text-[13px]">
              {pillar.variables.map((variable) => (
                <li className="flex gap-2" key={variable.code}>
                  <span aria-hidden="true">·</span>
                  <span>{variable.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <footer className="mt-auto pt-5">
            <div className="flex items-center gap-2 border-t border-border pt-4">
              <span className="text-[13px]">
                {t("evaluation.framework.weight")}
              </span>
              <div className="ml-auto flex items-center rounded-lg border border-border">
                <Button
                  aria-label={t("evaluation.framework.decreaseWeight")}
                  disabled={!editable || pillar.weight <= 0}
                  onClick={() =>
                    onChange?.({
                      ...pillar,
                      weight: Math.max(0, pillar.weight - 1),
                    })
                  }
                  size="icon-sm"
                  variant="ghost"
                >
                  <Minus />
                </Button>
                <label className="flex items-center border-x border-border px-1">
                  <span className="sr-only">
                    {t("evaluation.framework.weight")}
                  </span>
                  <input
                    className="h-7 w-10 bg-transparent text-center text-[13px] font-semibold tabular-nums outline-none disabled:opacity-70"
                    disabled={!editable}
                    max={100}
                    min={0}
                    onChange={(event) =>
                      onChange?.({
                        ...pillar,
                        weight: Math.min(
                          100,
                          Math.max(0, Number(event.target.value))
                        ),
                      })
                    }
                    type="number"
                    value={pillar.weight}
                  />
                  <span className="pr-1 text-[12px] text-muted-foreground">
                    %
                  </span>
                </label>
                <Button
                  aria-label={t("evaluation.framework.increaseWeight")}
                  disabled={!editable || pillar.weight >= 100}
                  onClick={() =>
                    onChange?.({
                      ...pillar,
                      weight: Math.min(100, pillar.weight + 1),
                    })
                  }
                  size="icon-sm"
                  variant="ghost"
                >
                  <Plus />
                </Button>
              </div>
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
          </footer>
        </div>
      </div>
    </article>
  )
}
