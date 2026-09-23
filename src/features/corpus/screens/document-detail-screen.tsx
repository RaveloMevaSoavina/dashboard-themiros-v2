import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, ExternalLink, FileText, RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"

import { DocumentStatusBadge } from "@/features/corpus/components/document-status-badge"
import {
  getDocument,
  getDocumentUrl,
  listDocumentEvents,
} from "@/features/corpus/services/corpus-service"
import { Button } from "@/shared/ui/base/button"
import { Skeleton } from "@/shared/ui/base/skeleton"

export function DocumentDetailScreen() {
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const { workspaceId = "", documentId = "" } = useParams<{
    workspaceId: string
    documentId: string
  }>()
  const document = useQuery({
    queryKey: ["corpus", workspaceId, "document", documentId],
    queryFn: () => getDocument(workspaceId, documentId),
    enabled: Boolean(workspaceId && documentId),
  })
  const events = useQuery({
    queryKey: ["corpus", workspaceId, "document", documentId, "events"],
    queryFn: () => listDocumentEvents(documentId),
    enabled: Boolean(documentId),
  })

  async function openSource() {
    if (!document.data) return
    const url = await getDocumentUrl(document.data.storagePath)
    window.open(url, "_blank", "noopener,noreferrer")
  }

  if (document.isPending) {
    return (
      <Skeleton className="mx-auto h-[520px] w-full max-w-5xl rounded-xl" />
    )
  }

  if (document.isError || !document.data) {
    return (
      <div className="mx-auto max-w-5xl rounded-xl border border-border p-6">
        <p className="text-sm">{t("corpus.detail.notFound")}</p>
        <Button
          className="mt-4"
          onClick={() => void document.refetch()}
          variant="outline"
        >
          <RotateCcw /> {t("workspaces.error.retry")}
        </Button>
      </div>
    )
  }

  const item = document.data
  const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "fr", {
    dateStyle: "medium",
    timeStyle: "short",
  })
  const metadata = [
    [t("corpus.table.category"), t(`corpus.category.${item.category}`)],
    [t("corpus.table.language"), item.language?.toUpperCase() ?? "—"],
    [t("corpus.table.country"), item.country ?? "—"],
    [t("corpus.table.version"), item.version?.label ?? "—"],
    [
      t("corpus.table.score"),
      item.relevanceScore === null ? "—" : `${item.relevanceScore}/100`,
    ],
    [
      t("corpus.detail.importedAt"),
      dateFormatter.format(new Date(item.createdAt)),
    ],
  ]

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Button
        onClick={() =>
          void navigate(`/workspaces/${workspaceId}/corpus/documents`)
        }
        variant="ghost"
      >
        <ArrowLeft /> {t("corpus.detail.back")}
      </Button>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {t("corpus.detail.eyebrow")}
            </p>
            <h1 className="mt-2 break-words text-2xl font-semibold">
              {item.filename}
            </h1>
            <div className="mt-3">
              <DocumentStatusBadge status={item.status} />
            </div>
          </div>
        </div>
        <Button onClick={() => void openSource()} variant="outline">
          <ExternalLink /> {t("corpus.detail.openSource")}
        </Button>
      </div>

      {item.statusReason ? (
        <div className="mt-6 rounded-xl border border-border p-4 text-[13px] text-muted-foreground">
          {item.statusReason}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold">
            {t("corpus.detail.metadata")}
          </h2>
          <dl className="mt-5 divide-y divide-border">
            {metadata.map(([label, value]) => (
              <div
                className="grid grid-cols-2 gap-4 py-3 text-[13px]"
                key={label}
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold">
            {t("corpus.detail.coverage")}
          </h2>
          {item.totalPages === null ? (
            <p className="mt-5 text-[13px] text-muted-foreground">
              {t("corpus.detail.coveragePending")}
            </p>
          ) : (
            <>
              <p className="mt-5 text-3xl font-semibold tabular-nums">
                {item.exploitablePages ?? 0}/{item.totalPages}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {t("corpus.detail.pages")}
              </p>
            </>
          )}
          <div className="mt-7 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">{t("corpus.detail.uses")}</h3>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {t("corpus.detail.noUses")}
            </p>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold">{t("corpus.detail.history")}</h2>
        {events.isPending ? (
          <Skeleton className="mt-5 h-24" />
        ) : (events.data?.length ?? 0) === 0 ? (
          <p className="mt-5 text-[13px] text-muted-foreground">
            {t("corpus.detail.noHistory")}
          </p>
        ) : (
          <ol className="mt-5 divide-y divide-border">
            {events.data?.map((event) => (
              <li
                className="flex justify-between gap-6 py-3 text-[13px]"
                key={event.id}
              >
                <div>
                  <p className="font-medium">
                    {t(`corpus.events.${event.type}`, {
                      defaultValue: event.type,
                    })}
                  </p>
                  {event.message ? (
                    <p className="mt-1 text-muted-foreground">
                      {event.message}
                    </p>
                  ) : null}
                </div>
                <time className="shrink-0 text-[11px] text-muted-foreground">
                  {dateFormatter.format(new Date(event.createdAt))}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
