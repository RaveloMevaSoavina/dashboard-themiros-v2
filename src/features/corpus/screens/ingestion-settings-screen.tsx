import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CircleAlert,
  CirclePlus,
  LoaderCircle,
  RotateCcw,
  Save,
  X,
} from "lucide-react"
import { useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { toast } from "sonner"

import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import {
  changedSettingsFields,
  type IngestionSettings,
  type IngestionSettingsValues,
  maxUploadSizeBytes,
  bytesPerMegabyte as megabyte,
  pickSettingsValues,
  relevanceZone,
  scoringFields,
} from "@/features/corpus/model/ingestion-settings"
import type { CorpusDocument } from "@/features/corpus/model/types"
import { ingestionSettingsQueryKey } from "@/features/corpus/model/use-ingestion-settings"
import {
  IngestionRequestError,
  listDocuments,
} from "@/features/corpus/services/corpus-service"
import {
  getIngestionSettings,
  updateIngestionSettings,
  type WorkspaceIngestionSettings,
} from "@/features/corpus/services/ingestion-settings-service"
import { useWorkspaces } from "@/features/workspaces/model/workspace-provider"
import { cn } from "@/shared/lib/utils"
import { Badge } from "@/shared/ui/base/badge"
import { Button } from "@/shared/ui/base/button"
import { Input } from "@/shared/ui/base/input"
import { Skeleton } from "@/shared/ui/base/skeleton"

const zones = ["conforme", "a_verifier", "rejete"] as const
type Zone = (typeof zones)[number]

/** Document dont la décision dépend encore des seuils (pas d'humain). */
function isAutomaticDecision(document: CorpusDocument) {
  return (
    document.processingState === "ready" &&
    document.relevanceScore !== null &&
    document.statusReasonCode !== "human_add" &&
    document.statusReasonCode !== "human_cancel"
  )
}

/**
 * Décision estimée avec d'autres seuils, à score constant. Un pays différent
 * ou non détecté maintient « À vérifier » au-dessus du seuil bas (§7.5).
 */
function estimateZone(
  document: CorpusDocument,
  settings: IngestionSettingsValues
): Zone {
  const score = document.relevanceScore ?? 0
  const zone = relevanceZone(score, settings)
  if (
    zone === "conforme" &&
    (document.statusReasonCode === "country_mismatch" ||
      document.statusReasonCode === "country_undetected")
  ) {
    return "a_verifier"
  }
  return zone
}

function validate(values: IngestionSettingsValues) {
  const errors = new Set<keyof IngestionSettingsValues>()
  const inRange = (
    field: keyof IngestionSettingsValues,
    min: number,
    max: number
  ) => {
    const value = values[field] as number
    if (!Number.isFinite(value) || value < min || value > max) errors.add(field)
  }
  inRange("conformityThreshold", 1, 100)
  inRange("ambiguousThreshold", 0, 99)
  if (values.ambiguousThreshold >= values.conformityThreshold) {
    errors.add("ambiguousThreshold")
  }
  for (const field of [
    "bonusCountry",
    "bonusFinancier",
    "bonusTheme",
    "bonusLanguage",
  ] as const) {
    inRange(field, 0, 50)
  }
  inRange("malusOffTopic", 0, 100)
  inRange("malusOtherCountry", 0, 100)
  inRange("languageConfidenceThreshold", 0, 1)
  inRange("exploitablePageMinChars", 0, 5000)
  inRange("maxFileSizeBytes", 1, maxUploadSizeBytes)
  inRange("maxFilesPerBatch", 1, 100)
  return errors
}

export function IngestionSettingsScreen() {
  const { t } = useTranslation()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const settings = useQuery({
    queryKey: ingestionSettingsQueryKey(workspaceId),
    queryFn: () => getIngestionSettings(workspaceId),
    enabled: Boolean(workspaceId),
  })

  return (
    <div className="mx-auto w-full max-w-6xl">
      <CorpusPageHeader
        description={t("corpus.settings.description")}
        eyebrow={t("nav.items.settings")}
        title={t("corpus.settings.title")}
      />
      {settings.isPending ? (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : settings.isError || !settings.data ? (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
          <p className="text-[13px]">{t("corpus.settings.loadError")}</p>
          <Button
            onClick={() => void settings.refetch()}
            size="sm"
            variant="outline"
          >
            <RotateCcw /> {t("workspaces.error.retry")}
          </Button>
        </div>
      ) : (
        <IngestionSettingsForm
          data={settings.data}
          key={settings.data.current.version}
          workspaceId={workspaceId}
        />
      )}
    </div>
  )
}

function IngestionSettingsForm({
  data,
  workspaceId,
}: {
  data: WorkspaceIngestionSettings
  workspaceId: string
}) {
  const { i18n, t } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const queryClient = useQueryClient()
  const { activeWorkspace } = useWorkspaces()
  const canManage = activeWorkspace?.role === "admin"
  const saved = useMemo(() => pickSettingsValues(data.current), [data])
  const [values, setValues] = useState<IngestionSettingsValues>(saved)
  const [note, setNote] = useState("")
  const [requalify, setRequalify] = useState(true)
  const [keyword, setKeyword] = useState("")

  const documents = useQuery({
    queryKey: ["corpus", workspaceId, "documents"],
    queryFn: () => listDocuments(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const automatic = useMemo(
    () => (documents.data ?? []).filter(isAutomaticDecision),
    [documents.data]
  )

  const errors = validate(values)
  const changed = changedSettingsFields(saved, values)
  const scoringChanged = changed.some((field) => scoringFields.includes(field))
  const isCustom = data.current.workspaceId !== null
  const matchesDefaults =
    changedSettingsFields(pickSettingsValues(data.defaults), values).length ===
    0

  const preview = useMemo(() => {
    const count = (settings: IngestionSettingsValues) => {
      const totals: Record<Zone, number> = {
        conforme: 0,
        a_verifier: 0,
        rejete: 0,
      }
      for (const document of automatic) {
        totals[estimateZone(document, settings)] += 1
      }
      return totals
    }
    const moved = automatic.filter(
      (document) =>
        estimateZone(document, saved) !== estimateZone(document, values)
    )
    return { before: count(saved), after: count(values), moved }
  }, [automatic, saved, values])

  const save = useMutation({
    mutationFn: () =>
      updateIngestionSettings(workspaceId, values, {
        note,
        requalify: requalify && scoringChanged,
      }),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ingestionSettingsQueryKey(workspaceId),
        }),
        queryClient.invalidateQueries({ queryKey: ["corpus", workspaceId] }),
      ])
      toast.success(
        result.requalified > 0
          ? t("corpus.settings.savedRequalify", { count: result.requalified })
          : t("corpus.settings.saved")
      )
    },
    onError: (error) =>
      toast.error(
        error instanceof IngestionRequestError
          ? t(`corpus.requestErrors.${error.code}`, {
              defaultValue: t("corpus.settings.saveError"),
            })
          : t("corpus.settings.saveError")
      ),
  })

  function update<K extends keyof IngestionSettingsValues>(
    field: K,
    value: IngestionSettingsValues[K]
  ) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function addKeyword() {
    const value = keyword.trim().toLocaleLowerCase()
    if (!value || values.offTopicKeywords.includes(value)) return
    update("offTopicKeywords", [...values.offTopicKeywords, value])
    setKeyword("")
  }

  const disabled = !canManage || save.isPending
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form
        className="min-w-0 space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (errors.size === 0 && changed.length > 0) save.mutate()
        }}
      >
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
          <Badge variant={isCustom ? "default" : "outline"}>
            {isCustom
              ? t("corpus.settings.custom")
              : t("corpus.settings.defaults")}
          </Badge>
          <span>
            {t("corpus.settings.versionInfo", {
              version: data.current.version,
              date: dateFormat.format(new Date(data.current.createdAt)),
            })}
          </span>
        </div>

        {!canManage ? (
          <div className="flex gap-3 rounded-xl border border-border p-4 text-[13px] text-muted-foreground">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {t("corpus.settings.adminOnly")}
          </div>
        ) : null}

        <fieldset className="space-y-6 disabled:opacity-70" disabled={disabled}>
          <Section
            description={t("corpus.settings.decision.description")}
            title={t("corpus.settings.decision.title")}
          >
            <ThresholdBar
              ambiguous={values.ambiguousThreshold}
              conformity={values.conformityThreshold}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <NumberField
                hint={t("corpus.settings.decision.conformityHint")}
                invalid={errors.has("conformityThreshold")}
                label={t("corpus.settings.decision.conformity")}
                max={100}
                min={1}
                onChange={(value) => update("conformityThreshold", value)}
                suffix="/ 100"
                value={values.conformityThreshold}
              />
              <NumberField
                hint={t("corpus.settings.decision.ambiguousHint")}
                invalid={errors.has("ambiguousThreshold")}
                label={t("corpus.settings.decision.ambiguous")}
                max={99}
                min={0}
                onChange={(value) => update("ambiguousThreshold", value)}
                suffix="/ 100"
                value={values.ambiguousThreshold}
              />
            </div>
            {errors.has("ambiguousThreshold") &&
            values.ambiguousThreshold >= values.conformityThreshold ? (
              <p className="text-[12px]" role="alert">
                {t("corpus.settings.decision.order")}
              </p>
            ) : null}
          </Section>

          <Section
            description={t("corpus.settings.adjustments.description")}
            title={t("corpus.settings.adjustments.title")}
          >
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {(
                [
                  ["bonusCountry", 50, "+"],
                  ["bonusFinancier", 50, "+"],
                  ["bonusTheme", 50, "+"],
                  ["bonusLanguage", 50, "+"],
                  ["malusOffTopic", 100, "−"],
                  ["malusOtherCountry", 100, "−"],
                ] as const
              ).map(([field, max, sign]) => (
                <NumberField
                  hint={t(`corpus.settings.adjustments.${field}Hint`)}
                  invalid={errors.has(field)}
                  key={field}
                  label={t(`corpus.settings.adjustments.${field}`)}
                  max={max}
                  min={0}
                  onChange={(value) => update(field, value)}
                  prefix={sign}
                  suffix={t("corpus.settings.points")}
                  value={values[field]}
                />
              ))}
            </div>
          </Section>

          <Section
            description={t("corpus.settings.keywords.description", {
              malus: values.malusOffTopic,
            })}
            title={t("corpus.settings.keywords.title")}
          >
            {values.offTopicKeywords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {values.offTopicKeywords.map((item) => (
                  <span
                    className="inline-flex items-center gap-1 rounded-lg border border-border py-1 pr-1 pl-2.5 text-[12px]"
                    key={item}
                  >
                    {item}
                    <button
                      aria-label={t("corpus.settings.keywords.remove", {
                        keyword: item,
                      })}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none"
                      disabled={disabled}
                      onClick={() =>
                        update(
                          "offTopicKeywords",
                          values.offTopicKeywords.filter(
                            (value) => value !== item
                          )
                        )
                      }
                      type="button"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                {t("corpus.settings.keywords.empty")}
              </p>
            )}
            <div className="flex max-w-lg gap-2">
              <Input
                aria-label={t("corpus.settings.keywords.add")}
                className="h-9"
                maxLength={120}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    addKeyword()
                  }
                }}
                placeholder={t("corpus.settings.keywords.placeholder")}
                value={keyword}
              />
              <Button
                disabled={!keyword.trim()}
                onClick={addKeyword}
                type="button"
                variant="outline"
              >
                <CirclePlus /> {t("corpus.settings.keywords.add")}
              </Button>
            </div>
          </Section>

          <Section
            description={t("corpus.settings.detection.description")}
            title={t("corpus.settings.detection.title")}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <NumberField
                hint={t("corpus.settings.detection.languageHint")}
                invalid={errors.has("languageConfidenceThreshold")}
                label={t("corpus.settings.detection.language")}
                max={100}
                min={0}
                onChange={(value) =>
                  update("languageConfidenceThreshold", value / 100)
                }
                suffix="%"
                value={Math.round(values.languageConfidenceThreshold * 100)}
              />
              <NumberField
                hint={t("corpus.settings.detection.pageHint")}
                invalid={errors.has("exploitablePageMinChars")}
                label={t("corpus.settings.detection.page")}
                max={5000}
                min={0}
                onChange={(value) => update("exploitablePageMinChars", value)}
                suffix={t("corpus.settings.characters")}
                value={values.exploitablePageMinChars}
              />
            </div>
          </Section>

          <Section
            description={t("corpus.settings.limits.description")}
            title={t("corpus.settings.limits.title")}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <NumberField
                hint={t("corpus.settings.limits.fileSizeHint", {
                  max: maxUploadSizeBytes / megabyte,
                })}
                invalid={errors.has("maxFileSizeBytes")}
                label={t("corpus.settings.limits.fileSize")}
                max={maxUploadSizeBytes / megabyte}
                min={1}
                onChange={(value) =>
                  update(
                    "maxFileSizeBytes",
                    Math.min(Math.round(value * megabyte), maxUploadSizeBytes)
                  )
                }
                suffix={t("corpus.settings.megabytes")}
                value={Math.round(values.maxFileSizeBytes / megabyte)}
              />
              <NumberField
                hint={t("corpus.settings.limits.filesHint")}
                invalid={errors.has("maxFilesPerBatch")}
                label={t("corpus.settings.limits.files")}
                max={100}
                min={1}
                onChange={(value) => update("maxFilesPerBatch", value)}
                suffix={t("corpus.settings.files")}
                value={values.maxFilesPerBatch}
              />
            </div>
          </Section>
        </fieldset>

        {canManage ? (
          <div className="sticky bottom-0 z-10 -mx-1 space-y-4 rounded-xl border border-border bg-background p-4 shadow-sm">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="space-y-2">
                <label
                  className="text-[13px] font-medium"
                  htmlFor="ingestion-settings-note"
                >
                  {t("corpus.settings.note")}
                </label>
                <Input
                  className="h-9"
                  disabled={save.isPending}
                  id="ingestion-settings-note"
                  maxLength={500}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t("corpus.settings.notePlaceholder")}
                  value={note}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={save.isPending || matchesDefaults}
                  onClick={() => setValues(pickSettingsValues(data.defaults))}
                  type="button"
                  variant="ghost"
                >
                  {t("corpus.settings.restoreDefaults")}
                </Button>
                <Button
                  disabled={save.isPending || changed.length === 0}
                  onClick={() => setValues(saved)}
                  type="button"
                  variant="outline"
                >
                  {t("corpus.settings.discard")}
                </Button>
                <Button
                  disabled={
                    save.isPending || changed.length === 0 || errors.size > 0
                  }
                  type="submit"
                >
                  {save.isPending ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Save />
                  )}
                  {t("corpus.settings.save")}
                </Button>
              </div>
            </div>
            {scoringChanged && automatic.length > 0 ? (
              <label className="flex items-start gap-2.5 text-[12px] leading-5">
                <input
                  checked={requalify}
                  className="mt-0.5 size-4 accent-foreground"
                  disabled={save.isPending}
                  onChange={(event) => setRequalify(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  {t("corpus.settings.requalify", { count: automatic.length })}
                  <span className="block text-muted-foreground">
                    {t("corpus.settings.requalifyHint")}
                  </span>
                </span>
              </label>
            ) : changed.length > 0 && !scoringChanged ? (
              <p className="text-[12px] text-muted-foreground">
                {t("corpus.settings.futureOnly")}
              </p>
            ) : null}
            {errors.size > 0 ? (
              <p className="text-[12px]" role="alert">
                {t("corpus.settings.invalid")}
              </p>
            ) : null}
          </div>
        ) : null}
      </form>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:h-fit">
        <section className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold">
            {t("corpus.settings.preview.title")}
          </h2>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
            {t("corpus.settings.preview.description", {
              count: automatic.length,
            })}
          </p>
          {documents.isPending ? (
            <Skeleton className="mt-4 h-24 rounded-lg" />
          ) : automatic.length === 0 ? (
            <p className="mt-4 text-[12px] text-muted-foreground">
              {t("corpus.settings.preview.empty")}
            </p>
          ) : (
            <>
              <dl className="mt-4 space-y-2 text-[12px]">
                {zones.map((zone) => {
                  const before = preview.before[zone]
                  const after = preview.after[zone]
                  return (
                    <div
                      className="flex items-baseline justify-between gap-3"
                      key={zone}
                    >
                      <dt>{t(`corpus.status.${zone}`)}</dt>
                      <dd className="tabular-nums">
                        {before === after ? (
                          after
                        ) : (
                          <>
                            <span className="text-muted-foreground line-through">
                              {before}
                            </span>{" "}
                            <span className="font-semibold">{after}</span>
                          </>
                        )}
                      </dd>
                    </div>
                  )
                })}
              </dl>
              {preview.moved.length > 0 ? (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-[12px] font-medium">
                    {t("corpus.settings.preview.moved", {
                      count: preview.moved.length,
                    })}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {preview.moved.slice(0, 6).map((document) => (
                      <li
                        className="flex items-baseline justify-between gap-3 text-[12px]"
                        key={document.id}
                      >
                        <span className="truncate">{document.filename}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {document.relevanceScore} ·{" "}
                          {t(`corpus.status.${estimateZone(document, values)}`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="mt-4 text-[11px] leading-4 text-muted-foreground">
                {t("corpus.settings.preview.caveat")}
              </p>
            </>
          )}
        </section>

        <section className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold">
            {t("corpus.settings.history.title")}
          </h2>
          <ol className="mt-3 space-y-3">
            {data.history.slice(0, 8).map((version) => (
              <HistoryItem
                date={dateFormat.format(new Date(version.createdAt))}
                key={version.version}
                note={version.note}
                version={version}
              />
            ))}
            <HistoryItem
              date={dateFormat.format(new Date(data.defaults.createdAt))}
              note={t("corpus.settings.history.defaults")}
              version={data.defaults}
            />
          </ol>
        </section>
      </aside>
    </div>
  )
}

function HistoryItem({
  date,
  note,
  version,
}: {
  date: string
  note: string | null
  version: IngestionSettings
}) {
  const { t } = useTranslation()
  return (
    <li className="text-[12px] leading-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">
          {t("corpus.settings.history.version", { version: version.version })}
        </span>
        <span className="text-muted-foreground">{date}</span>
      </div>
      <p className="text-muted-foreground">
        {t("corpus.settings.history.thresholds", {
          conformity: version.conformityThreshold,
          ambiguous: version.ambiguousThreshold,
        })}
        {note ? ` · ${note}` : ""}
      </p>
    </li>
  )
}

/** Les trois zones de décision sur l'échelle 0–100 du score (§7.5). */
function ThresholdBar({
  ambiguous,
  conformity,
}: {
  ambiguous: number
  conformity: number
}) {
  const { t } = useTranslation()
  const low = Math.min(Math.max(ambiguous, 0), 100)
  const high = Math.min(Math.max(conformity, low), 100)
  const segments = [
    { zone: "rejete", width: low, className: "bg-muted-foreground/25" },
    {
      zone: "a_verifier",
      width: high - low,
      className: "bg-muted-foreground/55",
    },
    { zone: "conforme", width: 100 - high, className: "bg-foreground" },
  ] as const

  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {segments.map((segment) => (
          <div
            className={cn("h-full transition-[width]", segment.className)}
            key={segment.zone}
            style={{ width: `${segment.width}%` }}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] leading-4">
        <p>
          <span className="font-medium">{t("corpus.status.rejete")}</span>
          <span className="block tabular-nums text-muted-foreground">
            &lt; {low}
          </span>
        </p>
        <p className="text-center">
          <span className="font-medium">{t("corpus.status.a_verifier")}</span>
          <span className="block tabular-nums text-muted-foreground">
            {low}–{Math.max(high - 1, low)}
          </span>
        </p>
        <p className="text-right">
          <span className="font-medium">{t("corpus.status.conforme")}</span>
          <span className="block tabular-nums text-muted-foreground">
            ≥ {high}
          </span>
        </p>
      </div>
    </div>
  )
}

function Section({
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
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  )
}

function NumberField({
  hint,
  invalid,
  label,
  max,
  min,
  onChange,
  prefix,
  suffix,
  value,
}: {
  hint: string
  invalid: boolean
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  prefix?: string
  suffix?: string
  value: number
}) {
  const id = useId()
  return (
    <div className="space-y-2">
      <label className="text-[13px] font-medium" htmlFor={id}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        {prefix ? (
          <span className="w-3 text-sm text-muted-foreground">{prefix}</span>
        ) : null}
        <Input
          aria-invalid={invalid}
          className="h-9 w-24 tabular-nums"
          id={id}
          inputMode="numeric"
          max={max}
          min={min}
          onChange={(event) =>
            onChange(
              event.target.value === ""
                ? Number.NaN
                : Number(event.target.value)
            )
          }
          type="number"
          value={Number.isFinite(value) ? value : ""}
        />
        {suffix ? (
          <span className="text-[12px] text-muted-foreground">{suffix}</span>
        ) : null}
      </div>
      <p className="text-[11px] leading-4 text-muted-foreground">{hint}</p>
    </div>
  )
}
