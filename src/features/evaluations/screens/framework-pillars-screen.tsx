import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, LoaderCircle, Plus, RotateCcw } from "lucide-react"
import { type FormEvent, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { toast } from "sonner"

import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import type { EvaluationCycle } from "@/features/evaluation-frameworks/model/types"
import { listReferencePillars } from "@/features/evaluation-frameworks/services/reference-service"
import { PillarCard } from "@/features/evaluations/components/pillar-card"
import type { EvaluationPillar } from "@/features/evaluations/model/types"
import {
  getWorkspacePillars,
  saveFrameworkPillars,
} from "@/features/evaluations/services/evaluation-service"
import type { WorkspaceStage } from "@/features/workspaces/model/types"
import { getWorkspaceDetails } from "@/features/workspaces/services/workspace-service"
import { Button } from "@/shared/ui/base/button"
import { Input } from "@/shared/ui/base/input"
import { Label } from "@/shared/ui/base/label"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/base/sheet"
import { Skeleton } from "@/shared/ui/base/skeleton"

function toCycle(stage: WorkspaceStage): EvaluationCycle {
  if (stage === "design" || stage === "pre_launch") return "ex_ante"
  if (stage === "mid_term") return "mi_parcours"
  if (stage === "closing") return "finale"
  if (stage === "post_closure") return "ex_post"
  return "en_cours"
}

type FrameworkPillarsScreenProps = {
  onValidated?: () => void
}

const WEIGHT_TOLERANCE = 0.01

export function FrameworkPillarsScreen({
  onValidated,
}: FrameworkPillarsScreenProps = {}) {
  const { i18n, t } = useTranslation()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const queryClient = useQueryClient()
  const details = useQuery({
    queryKey: ["workspaces", "details", workspaceId],
    queryFn: () => getWorkspaceDetails(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const generated = useQuery({
    queryKey: ["evaluation", workspaceId, "pillars"],
    queryFn: () => getWorkspacePillars(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const cycle = details.data ? toCycle(details.data.stage) : "en_cours"
  const references = useQuery({
    queryKey: ["reference-pillars", cycle, i18n.resolvedLanguage],
    queryFn: () =>
      listReferencePillars(
        "M2",
        cycle,
        i18n.resolvedLanguage === "en" ? "en" : "fr"
      ),
    enabled: Boolean(details.data),
  })
  const sourcePillars = useMemo<EvaluationPillar[]>(() => {
    if ((generated.data?.length ?? 0) > 0) return generated.data ?? []
    return (references.data ?? []).map((pillar) => ({
      id: pillar.id,
      name: pillar.name,
      description: pillar.description,
      weight: Number(pillar.default_weight),
      origin: "referential",
      criteria: pillar.criteria_codes,
      variables: pillar.observable_variables,
    }))
  }, [generated.data, references.data])
  const [pillars, setPillars] = useState<EvaluationPillar[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newWeight, setNewWeight] = useState(1)
  const [newVariables, setNewVariables] = useState("")
  const [newCriteria, setNewCriteria] = useState<string[]>([])
  useEffect(() => setPillars(sourcePillars), [sourcePillars])
  const total = pillars.reduce((sum, pillar) => sum + pillar.weight, 0)
  const displayedTotal = Math.round((total + Number.EPSILON) * 100) / 100
  const hasValidTotal = Math.abs(total - 100) <= WEIGHT_TOLERANCE
  const loading =
    details.isPending || generated.isPending || references.isPending
  const failed = details.isError || generated.isError || references.isError
  const criteriaOptions = useMemo(
    () => [...new Set(pillars.flatMap((pillar) => pillar.criteria))].sort(),
    [pillars]
  )
  const parsedVariables = newVariables
    .split("\n")
    .map((variable) => variable.trim())
    .filter(Boolean)
  const canAddPillar =
    newName.trim().length > 0 &&
    newDescription.trim().length > 0 &&
    newWeight > 0 &&
    newWeight <= 100 &&
    parsedVariables.length > 0 &&
    newCriteria.length > 0

  function openAddPillar() {
    setNewWeight(Math.max(1, Math.min(100, 100 - total)))
    setIsAddOpen(true)
  }

  function addPillar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canAddPillar) return
    const id = crypto.randomUUID()
    const codePrefix = id.replaceAll("-", "").slice(0, 8)
    setPillars((current) => [
      ...current,
      {
        id,
        name: newName.trim(),
        description: newDescription.trim(),
        weight: newWeight,
        origin: "new",
        criteria: newCriteria,
        variables: parsedVariables.map((label, index) => ({
          code: `manual_${codePrefix}_${index + 1}`,
          label,
          description: "",
        })),
      },
    ])
    setNewName("")
    setNewDescription("")
    setNewWeight(1)
    setNewVariables("")
    setNewCriteria([])
    setIsAddOpen(false)
  }
  const validation = useMutation({
    mutationFn: () =>
      saveFrameworkPillars(
        workspaceId,
        pillars,
        (generated.data ?? []).map((pillar) => pillar.id)
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["evaluation", workspaceId, "pillars"],
        }),
        queryClient.invalidateQueries({ queryKey: ["workspaces", "list"] }),
      ])
      toast.success(t("evaluation.framework.validated"))
      onValidated?.()
    },
    onError: () => toast.error(t("evaluation.framework.validationError")),
  })

  return (
    <div className="mx-auto w-full max-w-5xl">
      <CorpusPageHeader
        description={t("evaluation.framework.description")}
        eyebrow={t("evaluation.eyebrow")}
        title={t("evaluation.framework.title")}
      />
      {loading ? (
        <div className="mt-8 space-y-4">
          {[1, 2, 3].map((item) => (
            <Skeleton className="h-64 rounded-xl" key={item} />
          ))}
        </div>
      ) : failed ? (
        <div className="mt-8 rounded-xl border border-border p-6">
          <p className="text-sm">{t("evaluation.loadError")}</p>
          <Button
            className="mt-4"
            onClick={() => void generated.refetch()}
            variant="outline"
          >
            <RotateCcw /> {t("workspaces.error.retry")}
          </Button>
        </div>
      ) : (
        <>
          {(generated.data?.length ?? 0) === 0 ? (
            <div className="mt-7 flex gap-3 rounded-xl border border-border p-4 text-[13px] text-muted-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {t("evaluation.framework.templateNotice")}
            </div>
          ) : null}
          <div className="sticky top-4 z-10 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-background/95 p-4 backdrop-blur">
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                {t("evaluation.framework.totalWeight")}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {displayedTotal}%
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={
                  (generated.data?.length ?? 0) === 0 || pillars.length >= 8
                }
                onClick={openAddPillar}
                variant="outline"
              >
                <Plus /> {t("evaluation.framework.add")}
              </Button>
              <Button
                disabled={
                  !hasValidTotal ||
                  (generated.data?.length ?? 0) === 0 ||
                  validation.isPending
                }
                onClick={() => validation.mutate()}
              >
                {validation.isPending ? (
                  <LoaderCircle className="animate-spin" />
                ) : null}
                {t("evaluation.framework.validate")}
              </Button>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pillars.map((pillar) => (
              <PillarCard
                canRemove={pillars.length > 4}
                editable={(generated.data?.length ?? 0) > 0}
                key={pillar.id}
                onChange={(next) =>
                  setPillars((current) =>
                    current.map((item) => (item.id === next.id ? next : item))
                  )
                }
                onRemove={() =>
                  setPillars((current) =>
                    current.filter((item) => item.id !== pillar.id)
                  )
                }
                pillar={pillar}
              />
            ))}
          </div>
          <Sheet onOpenChange={setIsAddOpen} open={isAddOpen}>
            <SheetContent className="w-full sm:max-w-lg!">
              <form className="flex h-full flex-col" onSubmit={addPillar}>
                <SheetHeader className="border-b border-border pr-12">
                  <SheetTitle>{t("evaluation.framework.addTitle")}</SheetTitle>
                  <SheetDescription>
                    {t("evaluation.framework.addDescription")}
                  </SheetDescription>
                </SheetHeader>
                <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
                  <div className="space-y-2">
                    <Label htmlFor="new-pillar-name">
                      {t("evaluation.framework.pillarName")}
                    </Label>
                    <Input
                      autoFocus
                      id="new-pillar-name"
                      maxLength={80}
                      onChange={(event) => setNewName(event.target.value)}
                      required
                      value={newName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-pillar-description">
                      {t("evaluation.framework.pillarDescription")}
                    </Label>
                    <textarea
                      className="min-h-28 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      id="new-pillar-description"
                      maxLength={200}
                      onChange={(event) =>
                        setNewDescription(event.target.value)
                      }
                      required
                      value={newDescription}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-pillar-weight">
                      {t("evaluation.framework.weightPercent")}
                    </Label>
                    <Input
                      id="new-pillar-weight"
                      max={100}
                      min={1}
                      onChange={(event) =>
                        setNewWeight(Number(event.target.value))
                      }
                      required
                      type="number"
                      value={newWeight}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("evaluation.framework.weightHint")}
                    </p>
                  </div>
                  <fieldset className="space-y-3">
                    <legend className="text-sm font-medium">
                      {t("evaluation.framework.criteria")}
                    </legend>
                    <div className="grid grid-cols-2 gap-2">
                      {criteriaOptions.map((criterion) => (
                        <Label
                          className="rounded-lg border border-border px-3 py-2.5 font-normal"
                          key={criterion}
                        >
                          <input
                            checked={newCriteria.includes(criterion)}
                            className="size-4 accent-foreground"
                            onChange={(event) =>
                              setNewCriteria((current) =>
                                event.target.checked
                                  ? [...current, criterion]
                                  : current.filter((item) => item !== criterion)
                              )
                            }
                            type="checkbox"
                          />
                          {criterion}
                        </Label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("evaluation.framework.criteriaHint")}
                    </p>
                  </fieldset>
                  <div className="space-y-2">
                    <Label htmlFor="new-pillar-variables">
                      {t("evaluation.framework.variables")}
                    </Label>
                    <textarea
                      className="min-h-32 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      id="new-pillar-variables"
                      onChange={(event) => setNewVariables(event.target.value)}
                      placeholder={t(
                        "evaluation.framework.variablesPlaceholder"
                      )}
                      required
                      value={newVariables}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("evaluation.framework.variablesHint")}
                    </p>
                  </div>
                </div>
                <SheetFooter className="border-t border-border sm:flex-row sm:justify-end">
                  <SheetClose asChild>
                    <Button type="button" variant="outline">
                      {t("evaluation.framework.cancel")}
                    </Button>
                  </SheetClose>
                  <Button disabled={!canAddPillar} type="submit">
                    <Plus /> {t("evaluation.framework.addAction")}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  )
}
