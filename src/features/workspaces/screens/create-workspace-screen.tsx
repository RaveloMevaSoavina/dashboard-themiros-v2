import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CircleAlert,
  CirclePlus,
  Landmark,
  Layers2,
  LoaderCircle,
  LogOut,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { useAuth } from "@/features/auth/model/auth-provider"
import type {
  ObjectType,
  Workspace,
  WorkspaceLanguage,
  WorkspaceStage,
} from "@/features/workspaces/model/types"
import {
  useWorkspaces,
  workspacesQueryKey,
} from "@/features/workspaces/model/workspace-provider"
import {
  createWorkspace,
  enqueuePillarGeneration,
  getPillarGenerationJob,
  getWorkspaceAccountContext,
} from "@/features/workspaces/services/workspace-service"
import { countryCodes } from "@/shared/data/country-codes"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/base/button"
import { Input } from "@/shared/ui/base/input"
import { Label } from "@/shared/ui/base/label"
import { BrandMark } from "@/shared/ui/brand-mark"

const totalSteps = 3
const currentYear = new Date().getFullYear()
const languages: WorkspaceLanguage[] = ["fr", "en", "pt", "es"]
const stages: WorkspaceStage[] = [
  "design",
  "startup",
  "implementation",
  "closing",
  "closed",
]
const themeOptions = ["agriculture", "water", "nature", "gender", "energy"]
const moduleOptions: ObjectType[] = ["program", "project", "policy"]
const moduleIcons = {
  program: Layers2,
  project: BriefcaseBusiness,
  policy: Landmark,
} satisfies Record<ObjectType, typeof Layers2>

type EditableFinancier = {
  id: string
  name: string
  principal: boolean
}

type EditableVersion = {
  id: string
  label: string
  year: string
}

const selectClassName =
  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function CreateWorkspaceScreen() {
  const { i18n, t } = useTranslation()
  const queryClient = useQueryClient()
  const { session, signOut } = useAuth()
  const { workspaces, selectWorkspace } = useWorkspaces()
  const [step, setStep] = useState(1)
  const [isConfigurationComplete, setIsConfigurationComplete] = useState(false)
  const [createdWorkspace, setCreatedWorkspace] = useState<Workspace | null>(
    null
  )
  const [generationJobId, setGenerationJobId] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [targetCountry, setTargetCountry] = useState("")
  const [financiers, setFinanciers] = useState<EditableFinancier[]>([
    { id: "financier-1", name: "", principal: true },
  ])
  const [themes, setThemes] = useState<string[]>([])
  const [expectedLanguages, setExpectedLanguages] = useState<
    WorkspaceLanguage[]
  >(["fr", "en"])
  const [stage, setStage] = useState<WorkspaceStage>("implementation")
  const [startYear, setStartYear] = useState(String(currentYear))
  const [endYear, setEndYear] = useState(String(currentYear))
  const [versions, setVersions] = useState<EditableVersion[]>([
    { id: "version-1", label: "", year: String(currentYear) },
  ])
  const countryOptions = useMemo(() => {
    const locale = i18n.resolvedLanguage ?? i18n.language
    const displayNames = new Intl.DisplayNames([locale], { type: "region" })
    const collator = new Intl.Collator(locale)

    return countryCodes
      .map((code) => ({ code, label: displayNames.of(code) ?? code }))
      .sort((first, second) => collator.compare(first.label, second.label))
  }, [i18n.language, i18n.resolvedLanguage])

  const accountContext = useQuery({
    queryKey: ["workspaces", "creation-context", session?.user.id],
    queryFn: () => getWorkspaceAccountContext(session?.user.id ?? ""),
    enabled: Boolean(session?.user.id),
  })

  const generation = useMutation({
    mutationFn: enqueuePillarGeneration,
    onSuccess: (job) => {
      setGenerationJobId(job.id)
    },
    onError: () => {
      toast.error(t("workspaces.creation.generation.error"))
    },
  })

  const generationJob = useQuery({
    queryKey: ["workspaces", "pillar-generation", generationJobId],
    queryFn: () => getPillarGenerationJob(generationJobId ?? ""),
    enabled: Boolean(generationJobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "completed" || status === "failed" ? false : 1500
    },
  })

  const creation = useMutation({
    mutationFn: async () => {
      if (!session?.user.id) {
        throw new Error("Missing authenticated user")
      }

      return createWorkspace(
        {
          name,
          objectType: "program",
          targetCountry,
          financiers: financiers.map(({ name: financierName, principal }) => ({
            name: financierName,
            principal,
          })),
          themes,
          expectedLanguages,
          stage,
          startYear: Number(startYear),
          endYear: Number(endYear),
          versions: versions.map((version) => ({
            label: version.label,
            year: Number(version.year),
          })),
        },
        session.user.id
      )
    },
    onSuccess: (workspace) => {
      queryClient.setQueryData<Workspace[]>(workspacesQueryKey, (current) => [
        workspace,
        ...(current ?? []).filter((item) => item.id !== workspace.id),
      ])
      setCreatedWorkspace(workspace)
      generation.mutate(workspace.id)
      void queryClient.invalidateQueries({ queryKey: workspacesQueryKey })
    },
    onError: () => {
      toast.error(t("workspaces.creation.error"))
    },
  })

  const isFirstWorkspace = workspaces.length === 0

  function validateStep(targetStep: number) {
    if (targetStep === 1 && !name.trim()) {
      return t("workspaces.creation.validation.identity")
    }

    if (targetStep === 1 && !accountContext.data?.organizationId) {
      return t("workspaces.creation.validation.organizationMissing")
    }

    if (
      targetStep === 2 &&
      (!targetCountry.trim() ||
        financiers.some((financier) => !financier.name.trim()) ||
        themes.length === 0 ||
        expectedLanguages.length === 0)
    ) {
      return t("workspaces.creation.validation.fingerprint")
    }

    const start = Number(startYear)
    const end = Number(endYear)
    const invalidVersions = versions.some(
      (version) => !version.label.trim() || !Number(version.year)
    )

    if (
      targetStep === 3 &&
      (!start ||
        !end ||
        end < start ||
        (stage === "closed" && end >= currentYear) ||
        versions.length === 0 ||
        invalidVersions)
    ) {
      return t("workspaces.creation.validation.timeline")
    }

    return null
  }

  function goToNextStep() {
    const error = validateStep(step)
    setValidationError(error)

    if (!error) {
      setStep((current) => Math.min(current + 1, totalSteps))
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (step < totalSteps) {
      goToNextStep()
      return
    }

    const error = validateStep(3)
    setValidationError(error)

    if (!error) {
      setIsConfigurationComplete(true)
    }
  }

  function launchGeneration() {
    if (createdWorkspace) {
      setGenerationJobId(null)
      generation.mutate(createdWorkspace.id)
      return
    }

    creation.mutate()
  }

  function updateFinancier(id: string, value: string) {
    setFinanciers((current) =>
      current.map((financier) =>
        financier.id === id ? { ...financier, name: value } : financier
      )
    )
  }

  function setPrincipalFinancier(id: string) {
    setFinanciers((current) =>
      current.map((financier) => ({
        ...financier,
        principal: financier.id === id,
      }))
    )
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

  function updateVersion(id: string, field: "label" | "year", value: string) {
    setVersions((current) =>
      current.map((version) =>
        version.id === id ? { ...version, [field]: value } : version
      )
    )
  }

  return (
    <main className="min-h-svh bg-background">
      <header className="flex h-[62px] items-center justify-between border-b border-border px-4 sm:px-6 lg:px-8">
        <Link
          className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          to={isFirstWorkspace ? "/workspaces/new" : "/workspaces"}
        >
          <BrandMark size={30} />
          <span className="text-sm font-semibold tracking-tight">
            {t("brand.name")}
          </span>
        </Link>

        {isFirstWorkspace ? (
          <Button onClick={() => void signOut()} variant="ghost">
            <LogOut />
            {t("auth.logout")}
          </Button>
        ) : (
          <Button asChild variant="ghost">
            <Link to="/workspaces">
              <ArrowLeft />
              {t("workspaces.creation.back")}
            </Link>
          </Button>
        )}
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-5 lg:px-6 lg:py-16">
        {isConfigurationComplete ? (
          <GenerationReview
            createdWorkspace={createdWorkspace}
            endYear={endYear}
            expectedLanguages={expectedLanguages}
            financiers={financiers}
            generationError={
              creation.isError ||
              generation.isError ||
              generationJob.isError ||
              generationJob.data?.status === "failed"
            }
            generationStatus={generationJob.data?.status ?? null}
            isCreating={creation.isPending}
            isEnqueuing={generation.isPending}
            name={name}
            onEdit={() => {
              setIsConfigurationComplete(false)
              setStep(3)
            }}
            onLaunch={launchGeneration}
            onOpenWorkspace={() => {
              if (createdWorkspace) {
                selectWorkspace(createdWorkspace.id)
              }
            }}
            stage={stage}
            startYear={startYear}
            targetCountry={targetCountry}
            themes={themes}
            versions={versions}
          />
        ) : (
          <>
            <ol
              aria-label={t("workspaces.creation.progressLabel")}
              className="mb-12 grid grid-cols-3"
            >
              {[1, 2, 3].map((item) => (
                <li className="relative flex flex-col items-center" key={item}>
                  {item < totalSteps ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute left-1/2 top-3.5 h-px w-full bg-border",
                        item < step && "bg-foreground"
                      )}
                    />
                  ) : null}
                  <button
                    aria-current={item === step ? "step" : undefined}
                    className="relative z-10 flex flex-col items-center gap-2.5 bg-background px-3 outline-none focus-visible:rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50"
                    disabled={item >= step}
                    onClick={() => {
                      setValidationError(null)
                      setStep(item)
                    }}
                    type="button"
                  >
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full border bg-background text-[12px] font-semibold",
                        item < step &&
                          "border-foreground bg-foreground text-background",
                        item === step && "border-foreground",
                        item > step && "border-border text-muted-foreground"
                      )}
                    >
                      {item < step ? <Check className="size-3.5" /> : item}
                    </span>
                    <span
                      className={cn(
                        "text-center text-[12px] sm:text-[13px]",
                        item === step
                          ? "font-semibold"
                          : "text-muted-foreground"
                      )}
                    >
                      {t(`workspaces.creation.steps.${item}.label`)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] xl:gap-10">
              <section>
                <div className="flex size-10 items-center justify-center rounded-xl border border-border">
                  <Layers2 className="size-5" />
                </div>
                <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {isFirstWorkspace
                    ? t("workspaces.creation.onboardingEyebrow")
                    : t("workspaces.creation.eyebrow")}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                  {t(`workspaces.creation.steps.${step}.title`)}
                </h1>
                <p className="mt-4 max-w-sm text-[14px] leading-6 text-muted-foreground">
                  {t(`workspaces.creation.steps.${step}.description`)}
                </p>

                <div className="mt-7 max-w-sm border-l border-border pl-4">
                  <p className="text-[12px] font-semibold">
                    {t(`workspaces.creation.steps.${step}.whyTitle`)}
                  </p>
                  <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
                    {t(`workspaces.creation.steps.${step}.why`)}
                  </p>
                  <ul className="mt-4 space-y-2 text-[12px] leading-5 text-muted-foreground">
                    {[1, 2, 3].map((point) => (
                      <li className="flex gap-2" key={point}>
                        <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                        <span>
                          {t(
                            `workspaces.creation.steps.${step}.points.${point}`
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="rounded-xl border border-border p-6 sm:p-8">
                <form onSubmit={handleSubmit}>
                  {step === 1 ? (
                    <div className="space-y-6">
                      <Field
                        help={t("workspaces.creation.nameHelp")}
                        id="workspace-name"
                        label={t("workspaces.creation.nameLabel")}
                      >
                        <Input
                          autoFocus
                          className="h-10"
                          disabled={creation.isPending}
                          id="workspace-name"
                          maxLength={120}
                          onChange={(event) => setName(event.target.value)}
                          placeholder={t("workspaces.creation.namePlaceholder")}
                          value={name}
                        />
                      </Field>

                      <fieldset>
                        <legend className="text-sm font-medium">
                          {t("workspaces.creation.objectTypeLabel")}
                        </legend>
                        <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">
                          {t("workspaces.creation.objectTypeHelp")}
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          {moduleOptions.map((module) => {
                            const isAvailable = module === "program"
                            const ModuleIcon = moduleIcons[module]

                            return (
                              <button
                                aria-pressed={isAvailable}
                                className={cn(
                                  "relative min-h-28 rounded-xl border p-4 text-left transition-colors",
                                  isAvailable
                                    ? "border-foreground bg-muted/40"
                                    : "cursor-not-allowed border-border opacity-50"
                                )}
                                disabled={!isAvailable}
                                key={module}
                                type="button"
                              >
                                <span className="flex items-center gap-2 pr-5">
                                  <span
                                    className={cn(
                                      "flex size-7 shrink-0 items-center justify-center rounded-md border",
                                      isAvailable
                                        ? "border-foreground/15 bg-background text-foreground"
                                        : "border-border bg-muted text-muted-foreground"
                                    )}
                                  >
                                    <ModuleIcon
                                      aria-hidden="true"
                                      className="size-3.5"
                                    />
                                  </span>
                                  <span className="text-[13px] font-semibold">
                                    {t(
                                      `workspaces.creation.modules.${module}.name`
                                    )}
                                  </span>
                                </span>
                                <span className="mt-2 block text-[11px] leading-4 text-muted-foreground">
                                  {t(
                                    `workspaces.creation.modules.${module}.description`
                                  )}
                                </span>
                                {!isAvailable ? (
                                  <span className="mt-3 inline-flex rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    {t("workspaces.creation.comingSoon")}
                                  </span>
                                ) : (
                                  <Check className="absolute right-3 top-3 size-3.5" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </fieldset>
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="space-y-7">
                      <Field
                        id="workspace-country"
                        label={t("workspaces.creation.countryLabel")}
                      >
                        <select
                          className={selectClassName}
                          id="workspace-country"
                          onChange={(event) =>
                            setTargetCountry(event.target.value)
                          }
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

                      <fieldset>
                        <legend className="text-sm font-medium">
                          {t("workspaces.creation.financiersLabel")}
                        </legend>
                        <p className="mt-1.5 text-[12px] text-muted-foreground">
                          {t("workspaces.creation.financiersHelp")}
                        </p>
                        <div className="mt-3 space-y-3">
                          {financiers.map((financier) => (
                            <div
                              className="flex items-center gap-2"
                              key={financier.id}
                            >
                              <input
                                aria-label={t("workspaces.creation.principal")}
                                checked={financier.principal}
                                className="size-4 accent-foreground"
                                name="principal-financier"
                                onChange={() =>
                                  setPrincipalFinancier(financier.id)
                                }
                                type="radio"
                              />
                              <Input
                                className="h-10"
                                onChange={(event) =>
                                  updateFinancier(
                                    financier.id,
                                    event.target.value
                                  )
                                }
                                placeholder={t(
                                  "workspaces.creation.financierPlaceholder"
                                )}
                                value={financier.name}
                              />
                              {financiers.length > 1 ? (
                                <Button
                                  aria-label={t("workspaces.creation.remove")}
                                  onClick={() => removeFinancier(financier.id)}
                                  size="icon-lg"
                                  type="button"
                                  variant="ghost"
                                >
                                  <Trash2 />
                                </Button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        <Button
                          className="mt-3"
                          onClick={() =>
                            setFinanciers((current) => [
                              ...current,
                              {
                                id: crypto.randomUUID(),
                                name: "",
                                principal: false,
                              },
                            ])
                          }
                          type="button"
                          variant="outline"
                        >
                          <CirclePlus />
                          {t("workspaces.creation.addFinancier")}
                        </Button>
                      </fieldset>

                      <fieldset>
                        <legend className="text-sm font-medium">
                          {t("workspaces.creation.themesLabel")}
                        </legend>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {themeOptions.map((theme) => {
                            const selected = themes.includes(theme)
                            return (
                              <button
                                aria-pressed={selected}
                                className={cn(
                                  "rounded-lg border px-3 py-2 text-[12px] transition-colors",
                                  selected
                                    ? "border-foreground bg-foreground text-background"
                                    : "border-border hover:bg-muted"
                                )}
                                key={theme}
                                onClick={() =>
                                  setThemes((current) =>
                                    selected
                                      ? current.filter((item) => item !== theme)
                                      : [...current, theme]
                                  )
                                }
                                type="button"
                              >
                                {t(`workspaces.creation.themes.${theme}`)}
                              </button>
                            )
                          })}
                        </div>
                      </fieldset>

                      <fieldset>
                        <legend className="text-sm font-medium">
                          {t("workspaces.creation.languagesLabel")}
                        </legend>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {languages.map((language) => (
                            <label
                              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-[12px]"
                              key={language}
                            >
                              <input
                                checked={expectedLanguages.includes(language)}
                                className="size-4 accent-foreground"
                                onChange={(event) =>
                                  setExpectedLanguages((current) =>
                                    event.target.checked
                                      ? [...current, language]
                                      : current.filter(
                                          (item) => item !== language
                                        )
                                  )
                                }
                                type="checkbox"
                              />
                              {t(`workspaces.creation.languages.${language}`)}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="space-y-7">
                      <Field
                        id="workspace-stage"
                        label={t("workspaces.creation.stageLabel")}
                      >
                        <select
                          className={selectClassName}
                          id="workspace-stage"
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

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          id="workspace-start-year"
                          label={t("workspaces.creation.startYearLabel")}
                        >
                          <Input
                            className="h-10"
                            id="workspace-start-year"
                            inputMode="numeric"
                            max={2100}
                            min={1900}
                            onChange={(event) =>
                              setStartYear(event.target.value)
                            }
                            type="number"
                            value={startYear}
                          />
                        </Field>
                        <Field
                          id="workspace-end-year"
                          label={t("workspaces.creation.endYearLabel")}
                        >
                          <Input
                            className="h-10"
                            id="workspace-end-year"
                            inputMode="numeric"
                            max={2100}
                            min={1900}
                            onChange={(event) => setEndYear(event.target.value)}
                            type="number"
                            value={endYear}
                          />
                        </Field>
                      </div>

                      <fieldset>
                        <legend className="text-sm font-medium">
                          {t("workspaces.creation.versionsLabel")}
                        </legend>
                        <p className="mt-1.5 text-[12px] text-muted-foreground">
                          {t("workspaces.creation.versionsHelp")}
                        </p>
                        <div className="mt-3 space-y-3">
                          {versions.map((version) => (
                            <div
                              className="grid grid-cols-[1fr_100px_auto] gap-2"
                              key={version.id}
                            >
                              <Input
                                className="h-10"
                                onChange={(event) =>
                                  updateVersion(
                                    version.id,
                                    "label",
                                    event.target.value
                                  )
                                }
                                placeholder={t(
                                  "workspaces.creation.versionPlaceholder"
                                )}
                                value={version.label}
                              />
                              <Input
                                aria-label={t(
                                  "workspaces.creation.versionYear"
                                )}
                                className="h-10"
                                max={2100}
                                min={1900}
                                onChange={(event) =>
                                  updateVersion(
                                    version.id,
                                    "year",
                                    event.target.value
                                  )
                                }
                                type="number"
                                value={version.year}
                              />
                              {versions.length > 1 ? (
                                <Button
                                  aria-label={t("workspaces.creation.remove")}
                                  onClick={() =>
                                    setVersions((current) =>
                                      current.filter(
                                        (item) => item.id !== version.id
                                      )
                                    )
                                  }
                                  size="icon-lg"
                                  type="button"
                                  variant="ghost"
                                >
                                  <Trash2 />
                                </Button>
                              ) : (
                                <span className="size-9" />
                              )}
                            </div>
                          ))}
                        </div>
                        <Button
                          className="mt-3"
                          onClick={() =>
                            setVersions((current) => [
                              ...current,
                              {
                                id: crypto.randomUUID(),
                                label: "",
                                year: String(currentYear),
                              },
                            ])
                          }
                          type="button"
                          variant="outline"
                        >
                          <CirclePlus />
                          {t("workspaces.creation.addVersion")}
                        </Button>
                      </fieldset>
                    </div>
                  ) : null}

                  {validationError ? (
                    <p className="mt-6 text-[13px]" role="alert">
                      {validationError}
                    </p>
                  ) : null}
                  {creation.isError ? (
                    <p className="mt-6 text-[13px]" role="alert">
                      {t("workspaces.creation.error")}
                    </p>
                  ) : null}

                  <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
                    <div>
                      {step > 1 ? (
                        <Button
                          onClick={() => {
                            setValidationError(null)
                            setStep((current) => current - 1)
                          }}
                          type="button"
                          variant="ghost"
                        >
                          <ArrowLeft />
                          {t("workspaces.creation.previous")}
                        </Button>
                      ) : !isFirstWorkspace ? (
                        <Button asChild variant="outline">
                          <Link to="/workspaces">
                            {t("workspaces.creation.cancel")}
                          </Link>
                        </Button>
                      ) : null}
                    </div>

                    <Button
                      className="min-w-36"
                      disabled={creation.isPending || accountContext.isPending}
                      size="lg"
                      type="submit"
                    >
                      {creation.isPending ? (
                        <LoaderCircle className="animate-spin" />
                      ) : step < totalSteps ? (
                        <ArrowRight />
                      ) : null}
                      {creation.isPending
                        ? t("workspaces.creation.submitting")
                        : step < totalSteps
                          ? t("workspaces.creation.next")
                          : t("workspaces.creation.submit")}
                    </Button>
                  </div>
                </form>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

type GenerationStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | null

type GenerationReviewProps = {
  createdWorkspace: Workspace | null
  endYear: string
  expectedLanguages: WorkspaceLanguage[]
  financiers: EditableFinancier[]
  generationError: boolean
  generationStatus: GenerationStatus
  isCreating: boolean
  isEnqueuing: boolean
  name: string
  onEdit: () => void
  onLaunch: () => void
  onOpenWorkspace: () => void
  stage: WorkspaceStage
  startYear: string
  targetCountry: string
  themes: string[]
  versions: EditableVersion[]
}

function GenerationReview({
  createdWorkspace,
  endYear,
  expectedLanguages,
  financiers,
  generationError,
  generationStatus,
  isCreating,
  isEnqueuing,
  name,
  onEdit,
  onLaunch,
  onOpenWorkspace,
  stage,
  startYear,
  targetCountry,
  themes,
  versions,
}: GenerationReviewProps) {
  const { i18n, t } = useTranslation()
  const isComplete = generationStatus === "completed"
  const isRunning =
    isCreating ||
    isEnqueuing ||
    generationStatus === "queued" ||
    generationStatus === "running"
  const targetCountryLabel =
    new Intl.DisplayNames(
      [i18n.resolvedLanguage ?? i18n.language],
      { type: "region" }
    ).of(targetCountry) ?? targetCountry
  const processIndex = isComplete
    ? 4
    : generationStatus === "running"
      ? 3
      : createdWorkspace
        ? 2
        : isCreating
          ? 0
          : generationError
            ? 0
            : -1
  const processSteps = ["workspace", "fingerprint", "queue", "pillars"]
  const principalFinancier = financiers.find((item) => item.principal)

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] xl:gap-10">
      <section className="animate-in order-2 fade-in slide-in-from-right-6 duration-500">
        <div className="flex size-11 items-center justify-center rounded-xl border border-border">
          <Sparkles className="size-5" />
        </div>
        <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("workspaces.creation.generation.eyebrow")}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {isComplete
            ? t("workspaces.creation.generation.completeTitle")
            : t("workspaces.creation.generation.title")}
        </h1>
        <p className="mt-4 max-w-md text-[14px] leading-6 text-muted-foreground">
          {isComplete
            ? t("workspaces.creation.generation.completeDescription")
            : t("workspaces.creation.generation.description")}
        </p>

        <div className="mt-8 max-w-lg rounded-xl border border-border p-5">
          <ol className="space-y-5">
            {processSteps.map((processStep, index) => {
              const isStepComplete = index < processIndex
              const isStepActive = index === processIndex && !generationError
              const isStepError = index === processIndex && generationError

              return (
                <li className="flex items-start gap-3" key={processStep}>
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px]",
                      isStepComplete &&
                        "border-foreground bg-foreground text-background",
                      isStepActive && "border-foreground",
                      isStepError && "border-foreground",
                      index > processIndex &&
                        "border-border text-muted-foreground"
                    )}
                  >
                    {isStepComplete ? (
                      <Check className="size-3.5" />
                    ) : isStepActive ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : isStepError ? (
                      <CircleAlert className="size-3.5" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <div className="pt-0.5">
                    <p
                      className={cn(
                        "text-[13px]",
                        (isStepActive || isStepComplete || isStepError) &&
                          "font-semibold"
                      )}
                    >
                      {t(
                        `workspaces.creation.generation.steps.${processStep}.title`
                      )}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                      {t(
                        `workspaces.creation.generation.steps.${processStep}.description`
                      )}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>

        {generationError ? (
          <p className="mt-5 max-w-lg text-[13px]" role="alert">
            {t("workspaces.creation.generation.error")}
          </p>
        ) : null}

        <div className="mt-6 max-w-lg">
          {isComplete ? (
            <Button className="w-full" onClick={onOpenWorkspace} size="lg">
              <ArrowRight />
              {t("workspaces.creation.generation.openWorkspace")}
            </Button>
          ) : (
            <Button
              className="w-full"
              disabled={isRunning}
              onClick={onLaunch}
              size="lg"
            >
              {isRunning ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              {generationError
                ? t("workspaces.creation.generation.retry")
                : isRunning
                  ? t("workspaces.creation.generation.running")
                  : t("workspaces.creation.generation.launch")}
            </Button>
          )}
        </div>
      </section>

      <section className="animate-in order-1 fade-in slide-in-from-left-6 rounded-xl border border-border p-6 duration-500 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("workspaces.creation.summary.eyebrow")}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              {name}
            </h2>
          </div>
          {!createdWorkspace && !isRunning ? (
            <Button
              aria-label={t("workspaces.creation.generation.edit")}
              className="rounded-full border border-border"
              onClick={onEdit}
              size="icon"
              title={t("workspaces.creation.generation.edit")}
              variant="ghost"
            >
              <Pencil />
            </Button>
          ) : null}
        </div>

        <div className="mt-7 grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <SummaryItem
            label={t("workspaces.creation.objectTypeLabel")}
            value={t("workspaces.objectType.program")}
          />
          <SummaryItem
            label={t("workspaces.creation.countryLabel")}
            value={targetCountryLabel}
          />
          <SummaryItem
            label={t("workspaces.creation.summary.mainFinancier")}
            value={principalFinancier?.name ?? "—"}
          />
          <SummaryItem
            label={t("workspaces.creation.stageLabel")}
            value={t(`workspaces.creation.stages.${stage}`)}
          />
          <SummaryItem
            label={t("workspaces.creation.summary.period")}
            value={`${startYear} — ${endYear}`}
          />
          <SummaryItem
            label={t("workspaces.creation.languagesLabel")}
            value={expectedLanguages
              .map((language) => t(`workspaces.creation.languages.${language}`))
              .join(", ")}
          />
        </div>

        <div className="mt-7 border-t border-border pt-6">
          <SummaryList
            items={financiers.map((financier) =>
              financier.principal
                ? `${financier.name} · ${t("workspaces.creation.summary.principal")}`
                : financier.name
            )}
            label={t("workspaces.creation.financiersLabel")}
          />
          <div className="mt-6">
            <SummaryList
              items={themes.map((theme) =>
                t(`workspaces.creation.themes.${theme}`)
              )}
              label={t("workspaces.creation.themesLabel")}
            />
          </div>
          <div className="mt-6">
            <SummaryList
              items={versions.map(
                (version) => `${version.label} · ${version.year}`
              )}
              label={t("workspaces.creation.versionsLabel")}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-[13px] font-medium">{value}</p>
    </div>
  )
}

function SummaryList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            className="rounded-md border border-border px-2 py-1 text-[11px]"
            key={item}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

type FieldProps = {
  children: React.ReactNode
  help?: string
  id: string
  label: string
}

function Field({ children, help, id, label }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help ? (
        <p className="text-[12px] leading-5 text-muted-foreground">{help}</p>
      ) : null}
    </div>
  )
}
