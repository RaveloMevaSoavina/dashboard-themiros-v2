import { ChevronDown, Cpu, UserRound } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import {
  auditChanges,
  formatAuditValue,
} from "@/features/audit/model/audit-log"
import type { AuditEvent } from "@/features/audit/model/types"
import { cn } from "@/shared/lib/utils"
import { Badge } from "@/shared/ui/base/badge"
import { Button } from "@/shared/ui/base/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/base/collapsible"

/** Libelle d'une operation ; les operations documentaires gardent celui du corpus. */
export function useOperationLabel() {
  const { t } = useTranslation()
  return (operation: string) =>
    t(`audit.operations.${operation}`, {
      defaultValue: t(`corpus.events.${operation}`, {
        defaultValue: operation,
      }),
    })
}

const shortId = (id: string) => id.slice(0, 8)

function AuditValue({ value }: { value: unknown }) {
  const text = formatAuditValue(value)
  return (
    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-5">
      {text}
    </pre>
  )
}

/**
 * Un evenement du journal (US-21.2) : horodatage, acteur, operation, objet,
 * run associe ; valeurs avant/apres et metadonnees au depli.
 */
export function AuditEventItem({
  event,
  dateFormatter,
  workspaceId,
}: {
  event: AuditEvent
  dateFormatter: Intl.DateTimeFormat
  workspaceId: string
}) {
  const { t } = useTranslation()
  const operationLabel = useOperationLabel()
  const changes = auditChanges(event.before, event.after)
  const metadata = Object.entries(event.metadata ?? {})
  const hasDetails = changes.length > 0 || metadata.length > 0
  const objectLabel = t(`audit.objects.${event.objectType}`, {
    defaultValue: event.objectType,
  })
  /* Un document supprime n'a plus de fiche a ouvrir. */
  const documentPath =
    event.objectType === "document" &&
    event.objectId &&
    event.operation !== "document_deleted"
      ? `/workspaces/${workspaceId}/corpus/documents/${event.objectId}`
      : null

  const header = (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
      <time
        className="w-40 shrink-0 pt-0.5 text-[12px] tabular-nums text-muted-foreground"
        dateTime={event.createdAt}
      >
        {dateFormatter.format(new Date(event.createdAt))}
      </time>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-medium">
            {operationLabel(event.operation)}
          </p>
          {event.failed ? (
            <Badge variant="warning">{t("audit.failed")}</Badge>
          ) : null}
          <Badge variant="outline">
            {t(`audit.categories.${event.category}`)}
          </Badge>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            {event.actorType === "engine" ? (
              <Cpu className="size-3.5" />
            ) : (
              <UserRound className="size-3.5" />
            )}
            {event.actorType === "engine"
              ? t("audit.engine")
              : (event.actorName ?? t("audit.deletedUser"))}
          </span>
          <span>
            {objectLabel}
            {event.objectId ? (
              documentPath ? (
                <>
                  {" "}
                  <Link
                    className="font-mono underline-offset-2 hover:text-foreground hover:underline"
                    to={documentPath}
                  >
                    {shortId(event.objectId)}
                  </Link>
                </>
              ) : (
                <span className="font-mono"> {shortId(event.objectId)}</span>
              )
            ) : null}
          </span>
          {event.runId ? (
            <span>
              {t("audit.run")}{" "}
              <span className="font-mono">{shortId(event.runId)}</span>
              {event.runEngineVersion
                ? ` · ${t("audit.engineVersion", { version: event.runEngineVersion })}`
                : null}
            </span>
          ) : null}
        </div>
      </div>
      {hasDetails ? (
        <CollapsibleTrigger asChild>
          <Button className="-my-1 shrink-0" size="sm" variant="ghost">
            {t("audit.details")}
            <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
      ) : null}
    </div>
  )

  if (!hasDetails) return <li className="p-4">{header}</li>

  return (
    <li>
      <Collapsible className="group">
        <div className="p-4">{header}</div>
        <CollapsibleContent className="flex flex-col gap-5 px-4 pb-5 sm:pl-50">
          {changes.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="w-40 px-3 py-2 font-medium">
                      {t("audit.field")}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t("audit.before")}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t("audit.after")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {changes.map((change) => (
                    <tr
                      className={cn(
                        "align-top",
                        !change.changed && "text-muted-foreground"
                      )}
                      key={change.field}
                    >
                      <td className="px-3 py-2 font-mono">{change.field}</td>
                      <td className="px-3 py-2">
                        <AuditValue value={change.before} />
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2",
                          change.changed && "font-medium"
                        )}
                      >
                        <AuditValue value={change.after} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {metadata.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("audit.metadata")}
              </p>
              <dl className="mt-2 grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[12px]">
                {metadata.map(([key, value]) => (
                  <div className="contents" key={key}>
                    <dt className="font-mono text-muted-foreground">{key}</dt>
                    <dd className="min-w-0">
                      <AuditValue value={value} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}
