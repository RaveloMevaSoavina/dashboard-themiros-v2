import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ExternalLink, MoreHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { DocumentStatusBadge } from "@/features/corpus/components/document-status-badge"
import type {
  CorpusDocument,
  DocumentCategory,
} from "@/features/corpus/model/types"
import {
  decideDocument,
  updateDocumentCategory,
} from "@/features/corpus/services/corpus-service"
import { Button } from "@/shared/ui/base/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/base/dropdown-menu"

const selectClassName =
  "h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

function formatSize(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: value >= 1_000_000 ? "megabyte" : "kilobyte",
    maximumFractionDigits: 1,
  }).format(value / (value >= 1_000_000 ? 1_000_000 : 1_000))
}

export function DocumentsTable({
  documents,
  workspaceId,
  editable = true,
  selectedIds: controlledSelectedIds,
  onSelectionChange,
}: {
  documents: CorpusDocument[]
  workspaceId: string
  editable?: boolean
  selectedIds?: ReadonlySet<string>
  onSelectionChange?: (ids: Set<string>) => void
}) {
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const locale = i18n.resolvedLanguage ?? "fr"
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["corpus", workspaceId] })

  const categoryMutation = useMutation({
    mutationFn: ({
      id,
      category,
    }: {
      id: string
      category: DocumentCategory
    }) => updateDocumentCategory(id, category),
    onSuccess: refresh,
    onError: () => toast.error(t("corpus.errors.update")),
  })
  const decisionMutation = useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string
      decision: "integrate" | "verify" | "reject"
    }) => decideDocument(id, decision),
    onSuccess: async () => {
      await refresh()
      toast.success(t("corpus.review.decisionSaved"))
    },
    onError: () => toast.error(t("corpus.errors.update")),
  })
  const selectedIds = controlledSelectedIds ?? new Set<string>()
  const selectable = Boolean(controlledSelectedIds && onSelectionChange)
  const allSelected =
    selectable &&
    documents.length > 0 &&
    documents.every((document) => selectedIds.has(document.id))

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
        <thead className="bg-muted/50 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <tr>
            {selectable ? (
              <th className="w-10 px-3 py-3">
                <input
                  aria-label={t("corpus.review.selectAll")}
                  checked={allSelected}
                  className="size-4 accent-foreground"
                  onChange={(event) =>
                    onSelectionChange?.(
                      event.target.checked
                        ? new Set(documents.map((document) => document.id))
                        : new Set()
                    )
                  }
                  type="checkbox"
                />
              </th>
            ) : null}
            <th className="px-4 py-3">{t("corpus.table.name")}</th>
            <th className="px-3 py-3">{t("corpus.table.category")}</th>
            <th className="px-3 py-3">{t("corpus.table.language")}</th>
            <th className="px-3 py-3">{t("corpus.table.country")}</th>
            <th className="px-3 py-3">{t("corpus.table.version")}</th>
            <th className="px-3 py-3">{t("corpus.table.score")}</th>
            <th className="px-3 py-3">{t("corpus.table.status")}</th>
            <th className="px-3 py-3 text-right">
              {t("corpus.table.actions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr
              className="border-t border-border align-middle"
              key={document.id}
            >
              {selectable ? (
                <td className="px-3 py-3">
                  <input
                    aria-label={t("corpus.review.selectDocument", {
                      name: document.filename,
                    })}
                    checked={selectedIds.has(document.id)}
                    className="size-4 accent-foreground"
                    onChange={(event) => {
                      const next = new Set(selectedIds)
                      if (event.target.checked) next.add(document.id)
                      else next.delete(document.id)
                      onSelectionChange?.(next)
                    }}
                    type="checkbox"
                  />
                </td>
              ) : null}
              <td className="max-w-[260px] px-4 py-3">
                <button
                  className="block max-w-full truncate font-medium hover:underline"
                  onClick={() =>
                    void navigate(
                      `/workspaces/${workspaceId}/corpus/documents/${document.id}`
                    )
                  }
                  type="button"
                >
                  {document.filename}
                </button>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {formatSize(document.fileSize, locale)}
                </span>
              </td>
              <td className="px-3 py-3">
                {editable ? (
                  <select
                    aria-label={t("corpus.table.category")}
                    className={selectClassName}
                    disabled={categoryMutation.isPending}
                    onChange={(event) =>
                      categoryMutation.mutate({
                        id: document.id,
                        category: event.target.value as DocumentCategory,
                      })
                    }
                    value={document.category}
                  >
                    <option value="principal">
                      {t("corpus.category.principal")}
                    </option>
                    <option value="complementaire">
                      {t("corpus.category.complementaire")}
                    </option>
                    <option value="autre">{t("corpus.category.autre")}</option>
                  </select>
                ) : (
                  t(`corpus.category.${document.category}`)
                )}
              </td>
              <td className="px-3 py-3 uppercase text-muted-foreground">
                {document.language ?? "—"}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {document.country ?? "—"}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {document.version?.label ?? "—"}
              </td>
              <td className="px-3 py-3 tabular-nums">
                {document.relevanceScore === null
                  ? "—"
                  : `${document.relevanceScore}/100`}
              </td>
              <td className="px-3 py-3">
                <DocumentStatusBadge status={document.status} />
              </td>
              <td className="px-3 py-3 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={t("corpus.table.actions")}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        void navigate(
                          `/workspaces/${workspaceId}/corpus/documents/${document.id}`
                        )
                      }
                    >
                      <ExternalLink /> {t("corpus.actions.open")}
                    </DropdownMenuItem>
                    {editable ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            decisionMutation.mutate({
                              id: document.id,
                              decision: "integrate",
                            })
                          }
                        >
                          {t("corpus.actions.integrate")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            decisionMutation.mutate({
                              id: document.id,
                              decision: "verify",
                            })
                          }
                        >
                          {t("corpus.actions.verify")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            decisionMutation.mutate({
                              id: document.id,
                              decision: "reject",
                            })
                          }
                        >
                          {t("corpus.actions.reject")}
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
