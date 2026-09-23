import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CircleAlert,
  CirclePlus,
  LoaderCircle,
  Save,
  Trash2,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { WorkspaceThemesField } from "@/features/workspaces/components/workspace-themes-field"
import type {
  Workspace,
  WorkspaceDetails,
  WorkspaceLanguage,
  WorkspaceStage,
} from "@/features/workspaces/model/types"
import {
  useWorkspaces,
  workspacesQueryKey,
} from "@/features/workspaces/model/workspace-provider"
import {
  deleteWorkspace,
  getWorkspaceDetails,
  updateWorkspace,
} from "@/features/workspaces/services/workspace-service"
import { countryCodes } from "@/shared/data/country-codes"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/base/button"
import { Input } from "@/shared/ui/base/input"
import { Label } from "@/shared/ui/base/label"
import { Skeleton } from "@/shared/ui/base/skeleton"

const languages: WorkspaceLanguage[] = ["fr", "en", "pt", "es"]
const stages: WorkspaceStage[] = [
  "design",
  "pre_launch",
  "implementation",
  "mid_term",
  "closing",
  "post_closure",
  "cross_cutting",
]
const selectClassName =
  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

type EditableFinancier = {
  id: string
  code?: string
  name: string
  principal: boolean
}

export function WorkspaceSettingsScreen() {
  const { t } = useTranslation()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const { activeWorkspace } = useWorkspaces()

  const details = useQuery({
    queryKey: ["workspaces", "details", workspaceId],
    queryFn: () => getWorkspaceDetails(workspaceId),
    enabled: Boolean(workspaceId),
  })

  if (details.isPending) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (details.isError || !details.data) {
    return (
      <div className="mx-auto w-full max-w-4xl rounded-xl border border-border p-6">
        <p className="text-sm font-semibold">
          {t("workspaces.settings.loadError")}
        </p>
        <Button
          className="mt-4"
          onClick={() => void details.refetch()}
          variant="outline"
        >
          {t("workspaces.error.retry")}
        </Button>
      </div>
    )
  }

  return (
    <WorkspaceSettingsForm
      canManage={activeWorkspace?.role === "admin"}
      details={details.data}
    />
  )
}

function WorkspaceSettingsForm({
  canManage,
  details,
}: {
  canManage: boolean
  details: WorkspaceDetails
}) {
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState(details.name)
  const [targetCountry, setTargetCountry] = useState(details.targetCountry)
  const [financiers, setFinanciers] = useState<EditableFinancier[]>(() =>
    (details.financiers.length > 0
      ? details.financiers
      : [{ name: "", principal: true }]
    ).map((financier) => ({ ...financier, id: crypto.randomUUID() }))
  )
  const [themes, setThemes] = useState(details.themes)
  const [expectedLanguages, setExpectedLanguages] = useState(
    details.expectedLanguages
  )
  const [stage, setStage] = useState(details.stage)
  const [startYear, setStartYear] = useState(String(details.startYear))
  const [endYear, setEndYear] = useState(String(details.endYear))
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

  const countryOptions = useMemo(() => {
    const locale = i18n.resolvedLanguage ?? i18n.language
    const displayNames = new Intl.DisplayNames([locale], { type: "region" })
    const collator = new Intl.Collator(locale)

    return countryCodes
      .map((code) => ({ code, label: displayNames.of(code) ?? code }))
      .sort((first, second) => collator.compare(first.label, second.label))
  }, [i18n.language, i18n.resolvedLanguage])

  const save = useMutation({
    mutationFn: () =>
      updateWorkspace(details.id, {
        name,
        targetCountry,
        financiers: financiers.map(({ id: _id, ...financier }) => financier),
        themes,
        expectedLanguages,
        stage,
        startYear: Number(startYear),
        endYear: Number(endYear),
      }),
    onSuccess: async () => {
      queryClient.setQueryData<Workspace[]>(workspacesQueryKey, (current) =>
        current?.map((workspace) =>
          workspace.id === details.id
            ? {
                ...workspace,
                name: name.trim(),
                updatedAt: new Date().toISOString(),
              }
            : workspace
        )
      )
      await queryClient.invalidateQueries({
        queryKey: ["workspaces", "details", details.id],
      })
      toast.success(t("workspaces.settings.saveSuccess"))
    },
    onError: () => toast.error(t("workspaces.settings.saveError")),
  })

  const removal = useMutation({
    mutationFn: () => deleteWorkspace(details.id),
    onSuccess: async () => {
      queryClient.setQueryData<Workspace[]>(workspacesQueryKey, (current) =>
        current?.filter((workspace) => workspace.id !== details.id)
      )
      await queryClient.invalidateQueries({ queryKey: workspacesQueryKey })
      toast.success(t("workspaces.settings.deleteSuccess"))
      void navigate("/workspaces", { replace: true })
    },
    onError: () => toast.error(t("workspaces.settings.deleteError")),
  })

  function validate() {
    const start = Number(startYear)
    const end = Number(endYear)

    if (
      !name.trim() ||
      !targetCountry ||
      financiers.some((financier) => !financier.name.trim()) ||
      themes.length === 0 ||
      expectedLanguages.length === 0 ||
      !start ||
      !end ||
      end < start
    ) {
      return t("workspaces.settings.validation")
    }

    return null
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const error = validate()
    setValidationError(error)
    if (!error) save.mutate()
  }

  function removeFinancier(id: string) {
    setFinanciers((current) => {
      const remaining = current.filter((financier) => financier.id !== id)
      if (remaining.length > 0 && !remaining.some((item) => item.principal)) {
        remaining[0] = { ...remaining[0], principal: true }
      }
      return remaining
    })
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("workspaces.settings.eyebrow")}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {t("workspaces.settings.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted-foreground">
          {t("workspaces.settings.description")}
        </p>
      </div>

      {!canManage ? (
        <div className="mt-6 flex gap-3 rounded-xl border border-border p-4 text-[13px] text-muted-foreground">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {t("workspaces.settings.adminOnly")}
        </div>
      ) : null}

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <fieldset
          className="space-y-6 disabled:opacity-70"
          disabled={!canManage || save.isPending}
        >
          <SettingsSection
            description={t("workspaces.settings.identityDescription")}
            title={t("workspaces.settings.identityTitle")}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("workspaces.creation.nameLabel")}>
                <Input
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </Field>
              <Field label={t("workspaces.creation.organizationLabel")}>
                <Input disabled value={details.organization ?? "—"} />
              </Field>
              <Field label={t("workspaces.creation.objectTypeLabel")}>
                <Input
                  disabled
                  value={t(`workspaces.objectType.${details.objectType}`)}
                />
              </Field>
              <Field label={t("workspaces.creation.countryLabel")}>
                <select
                  className={selectClassName}
                  onChange={(event) => setTargetCountry(event.target.value)}
                  value={targetCountry}
                >
                  <option disabled value="">
                    {t("workspaces.creation.countryPlaceholder")}
                  </option>
                  {countryOptions.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </SettingsSection>

          <SettingsSection
            description={t("workspaces.settings.scopeDescription")}
            title={t("workspaces.settings.scopeTitle")}
          >
            <Field label={t("workspaces.creation.financiersLabel")}>
              <div className="space-y-2">
                {financiers.map((financier) => (
                  <div className="flex items-center gap-2" key={financier.id}>
                    <input
                      aria-label={t("workspaces.creation.principal")}
                      checked={financier.principal}
                      className="size-4 accent-foreground"
                      name="principal-financier"
                      onChange={() =>
                        setFinanciers((current) =>
                          current.map((item) => ({
                            ...item,
                            principal: item.id === financier.id,
                          }))
                        )
                      }
                      type="radio"
                    />
                    <Input
                      onChange={(event) =>
                        setFinanciers((current) =>
                          current.map((item) =>
                            item.id === financier.id
                              ? { ...item, name: event.target.value }
                              : item
                          )
                        )
                      }
                      value={financier.name}
                    />
                    {financiers.length > 1 ? (
                      <Button
                        aria-label={t("workspaces.creation.remove")}
                        onClick={() => removeFinancier(financier.id)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                ))}
                <Button
                  onClick={() =>
                    setFinanciers((current) => [
                      ...current,
                      { id: crypto.randomUUID(), name: "", principal: false },
                    ])
                  }
                  type="button"
                  variant="outline"
                >
                  <CirclePlus />
                  {t("workspaces.creation.addFinancier")}
                </Button>
              </div>
            </Field>

            <WorkspaceThemesField onChange={setThemes} themes={themes} />
            <ChoiceGroup
              label={t("workspaces.creation.languagesLabel")}
              options={languages}
              selected={expectedLanguages}
              getLabel={(language) =>
                t(`workspaces.creation.languages.${language}`)
              }
              onToggle={(language) =>
                setExpectedLanguages((current) =>
                  current.includes(language)
                    ? current.filter((item) => item !== language)
                    : [...current, language]
                )
              }
            />
          </SettingsSection>

          <SettingsSection
            description={t("workspaces.settings.cycleDescription")}
            title={t("workspaces.settings.cycleTitle")}
          >
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label={t("workspaces.creation.stageLabel")}>
                <select
                  className={selectClassName}
                  onChange={(event) =>
                    setStage(event.target.value as WorkspaceStage)
                  }
                  value={stage}
                >
                  {stages.map((option) => (
                    <option key={option} value={option}>
                      {t(`workspaces.creation.stages.${option}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("workspaces.creation.startYearLabel")}>
                <Input
                  max={2100}
                  min={1900}
                  onChange={(event) => setStartYear(event.target.value)}
                  type="number"
                  value={startYear}
                />
              </Field>
              <Field label={t("workspaces.creation.endYearLabel")}>
                <Input
                  max={2100}
                  min={1900}
                  onChange={(event) => setEndYear(event.target.value)}
                  type="number"
                  value={endYear}
                />
              </Field>
            </div>
          </SettingsSection>
        </fieldset>

        {validationError ? (
          <p className="text-[13px]" role="alert">
            {validationError}
          </p>
        ) : null}

        {canManage ? (
          <div className="flex justify-end">
            <Button disabled={save.isPending} size="lg" type="submit">
              {save.isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Save />
              )}
              {save.isPending
                ? t("workspaces.settings.saving")
                : t("workspaces.settings.save")}
            </Button>
          </div>
        ) : null}
      </form>

      {canManage ? (
        <section className="mt-12 rounded-xl border border-red-500/40 bg-red-500/5 p-6">
          <h2 className="text-base font-semibold text-red-500">
            {t("workspaces.settings.dangerTitle")}
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-red-500/75">
            {t("workspaces.settings.dangerDescription")}
          </p>
          {showDeleteConfirmation ? (
            <div className="mt-5 max-w-lg space-y-3">
              <Label
                className="text-red-500"
                htmlFor="delete-workspace-confirmation"
              >
                {t("workspaces.settings.deleteConfirmation", {
                  name: details.name,
                })}
              </Label>
              <Input
                autoComplete="off"
                className="border-red-500/40 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                id="delete-workspace-confirmation"
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                value={deleteConfirmation}
              />
              <div className="flex gap-2">
                <Button
                  className="bg-red-600 text-white hover:bg-red-700 focus-visible:border-red-500 focus-visible:ring-red-500/30"
                  disabled={
                    deleteConfirmation !== details.name || removal.isPending
                  }
                  onClick={() => removal.mutate()}
                  type="button"
                  variant="destructive"
                >
                  {removal.isPending ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Trash2 />
                  )}
                  {t("workspaces.settings.deleteAction")}
                </Button>
                <Button
                  onClick={() => {
                    setShowDeleteConfirmation(false)
                    setDeleteConfirmation("")
                  }}
                  type="button"
                  variant="ghost"
                >
                  {t("workspaces.settings.cancelDelete")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="mt-5 bg-red-600 text-white hover:bg-red-700 focus-visible:border-red-500 focus-visible:ring-red-500/30"
              onClick={() => setShowDeleteConfirmation(true)}
              type="button"
              variant="destructive"
            >
              <Trash2 />
              {t("workspaces.settings.deleteAction")}
            </Button>
          )}
        </section>
      ) : null}
    </div>
  )
}

function SettingsSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode
  description: string
  title: string
}) {
  return (
    <section className="rounded-xl border border-border p-5 sm:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
        {description}
      </p>
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  )
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-medium">{label}</p>
      {children}
    </div>
  )
}

function ChoiceGroup<T extends string>({
  getLabel,
  label,
  onToggle,
  options,
  selected,
}: {
  getLabel: (option: T) => string
  label: string
  onToggle: (option: T) => void
  options: readonly T[]
  selected: readonly T[]
}) {
  return (
    <fieldset>
      <legend className="text-[13px] font-medium">{label}</legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option)
          return (
            <button
              aria-pressed={isSelected}
              className={cn(
                "rounded-lg border px-3 py-2 text-[12px] transition-colors",
                isSelected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted"
              )}
              key={option}
              onClick={() => onToggle(option)}
              type="button"
            >
              {getLabel(option)}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
