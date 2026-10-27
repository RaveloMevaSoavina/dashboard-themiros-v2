import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { Download, LoaderCircle, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import {
  AuditEventItem,
  useOperationLabel,
} from "@/features/audit/components/audit-event-item"
import { formatAuditValue, toCsv } from "@/features/audit/model/audit-log"
import {
  type AuditCategory,
  type AuditFilters,
  auditCategories,
} from "@/features/audit/model/types"
import {
  auditPageSize,
  listAllAuditEvents,
  listAuditActors,
  listAuditEvents,
  recordAuditExport,
} from "@/features/audit/services/audit-service"
import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import { Button } from "@/shared/ui/base/button"
import { Input } from "@/shared/ui/base/input"
import { Label } from "@/shared/ui/base/label"
import { Skeleton } from "@/shared/ui/base/skeleton"

const selectClassName =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm"

/* Les filtres vivent dans l'URL : un journal filtre se partage tel quel. */
function filtersFrom(params: URLSearchParams): AuditFilters {
  const category = params.get("type")
  return {
    category: auditCategories.includes(category as AuditCategory)
      ? (category as AuditCategory)
      : null,
    actor: params.get("actor"),
    from: params.get("from"),
    to: params.get("to"),
    failuresOnly: params.get("failures") === "1",
  }
}

/** Ecran 21 : journal d'audit de l'espace, en ajout seul (E13). */
export function AuditLogScreen() {
  const { i18n, t } = useTranslation()
  const operationLabel = useOperationLabel()
  const queryClient = useQueryClient()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = filtersFrom(searchParams)
  const filtered =
    filters.category !== null ||
    filters.actor !== null ||
    filters.from !== null ||
    filters.to !== null ||
    filters.failuresOnly

  const events = useInfiniteQuery({
    queryKey: ["audit", workspaceId, "events", filters],
    queryFn: ({ pageParam }) =>
      listAuditEvents(workspaceId, filters, pageParam),
    initialPageParam: null as { id: string; createdAt: string } | null,
    getNextPageParam: (lastPage) => {
      const last = lastPage.at(-1)
      return last && lastPage.length === auditPageSize
        ? { id: last.id, createdAt: last.createdAt }
        : undefined
    },
    enabled: Boolean(workspaceId),
  })
  const actors = useQuery({
    queryKey: ["audit", workspaceId, "actors"],
    queryFn: () => listAuditActors(workspaceId),
    enabled: Boolean(workspaceId),
  })

  const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "fr", {
    dateStyle: "medium",
    timeStyle: "medium",
  })
  const actorLabel = (actorType: string, name: string | null) =>
    actorType === "engine"
      ? t("audit.engine")
      : (name ?? t("audit.deletedUser"))

  const exportLog = useMutation({
    mutationFn: async () => {
      const all = await listAllAuditEvents(workspaceId, filters)
      const json = (value: unknown) =>
        value === null ? "" : formatAuditValue(value)
      const csv = toCsv([
        [
          t("audit.csv.createdAt"),
          t("audit.csv.category"),
          t("audit.csv.operationCode"),
          t("audit.csv.operation"),
          t("audit.csv.outcome"),
          t("audit.csv.actorType"),
          t("audit.csv.actor"),
          t("audit.csv.objectType"),
          t("audit.csv.objectId"),
          t("audit.csv.runId"),
          t("audit.csv.engineVersion"),
          t("audit.before"),
          t("audit.after"),
          t("audit.metadata"),
          t("audit.csv.eventId"),
        ],
        ...all.map((event) => [
          event.createdAt,
          t(`audit.categories.${event.category}`),
          event.operation,
          operationLabel(event.operation),
          event.failed ? t("audit.failed") : t("audit.succeeded"),
          event.actorType,
          actorLabel(event.actorType, event.actorName),
          event.objectType,
          event.objectId ?? "",
          event.runId ?? "",
          event.runEngineVersion ?? "",
          json(event.before),
          json(event.after),
          json(event.metadata),
          event.id,
        ]),
      ])
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" })
      )
      const link = document.createElement("a")
      link.href = url
      link.download = `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      await recordAuditExport(workspaceId, filters, all.length)
      return all.length
    },
    onSuccess: async (count) => {
      await queryClient.invalidateQueries({ queryKey: ["audit", workspaceId] })
      toast.success(t("audit.exportDone", { count }))
    },
    onError: () => toast.error(t("audit.exportError")),
  })

  const setFilter = (key: string, value: string | null) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true }
    )
  const items = events.data?.pages.flat() ?? []

  return (
    <div className="mx-auto w-full max-w-6xl pb-10">
      <CorpusPageHeader
        action={
          <Button
            disabled={exportLog.isPending || items.length === 0}
            onClick={() => exportLog.mutate()}
            variant="outline"
          >
            {exportLog.isPending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Download />
            )}
            {exportLog.isPending ? t("audit.exporting") : t("audit.export")}
          </Button>
        }
        description={t("audit.description")}
        eyebrow={t("nav.sections.governance")}
        title={t("audit.title")}
      />

      <div className="mt-8 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-type">{t("audit.filters.type")}</Label>
          <select
            className={selectClassName}
            id="audit-type"
            onChange={(event) => setFilter("type", event.target.value || null)}
            value={filters.category ?? ""}
          >
            <option value="">{t("audit.filters.allTypes")}</option>
            {auditCategories.map((category) => (
              <option key={category} value={category}>
                {t(`audit.categories.${category}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-actor">{t("audit.filters.actor")}</Label>
          <select
            className={selectClassName}
            id="audit-actor"
            onChange={(event) => setFilter("actor", event.target.value || null)}
            value={filters.actor ?? ""}
          >
            <option value="">{t("audit.filters.allActors")}</option>
            <option value="engine">{t("audit.engine")}</option>
            {(actors.data ?? []).map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name ?? t("audit.deletedUser")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-from">{t("audit.filters.from")}</Label>
          <Input
            className="w-40"
            id="audit-from"
            max={filters.to ?? undefined}
            onChange={(event) => setFilter("from", event.target.value || null)}
            type="date"
            value={filters.from ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-to">{t("audit.filters.to")}</Label>
          <Input
            className="w-40"
            id="audit-to"
            min={filters.from ?? undefined}
            onChange={(event) => setFilter("to", event.target.value || null)}
            type="date"
            value={filters.to ?? ""}
          />
        </div>
        <label className="flex h-8 items-center gap-2 text-sm">
          <input
            checked={filters.failuresOnly}
            onChange={(event) =>
              setFilter("failures", event.target.checked ? "1" : null)
            }
            type="checkbox"
          />
          {t("audit.filters.failuresOnly")}
        </label>
        {filtered ? (
          <Button
            onClick={() => setSearchParams({}, { replace: true })}
            size="sm"
            variant="ghost"
          >
            <X /> {t("audit.filters.reset")}
          </Button>
        ) : null}
      </div>

      <p className="mt-6 text-[12px] text-muted-foreground">
        {t("audit.appendOnly")}
      </p>

      <div className="mt-3">
        {events.isPending ? (
          <Skeleton className="h-80 rounded-xl" />
        ) : events.isError ? (
          <div className="rounded-xl border border-border p-10 text-center text-[13px]">
            <p className="text-muted-foreground">{t("audit.loadError")}</p>
            <Button
              className="mt-4"
              onClick={() => void events.refetch()}
              size="sm"
              variant="outline"
            >
              {t("audit.retry")}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-border p-16 text-center text-[13px] text-muted-foreground">
            {filtered ? t("audit.emptyFiltered") : t("audit.empty")}
          </div>
        ) : (
          <>
            <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {items.map((event) => (
                <AuditEventItem
                  dateFormatter={dateFormatter}
                  event={event}
                  key={event.id}
                  workspaceId={workspaceId}
                />
              ))}
            </ol>
            <div className="mt-4 flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
              <p>{t("audit.count", { count: items.length })}</p>
              {events.hasNextPage ? (
                <Button
                  disabled={events.isFetchingNextPage}
                  onClick={() => void events.fetchNextPage()}
                  size="sm"
                  variant="outline"
                >
                  {events.isFetchingNextPage ? (
                    <LoaderCircle className="animate-spin" />
                  ) : null}
                  {t("audit.loadMore")}
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
