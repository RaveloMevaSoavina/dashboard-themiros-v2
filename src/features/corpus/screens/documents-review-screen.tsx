import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileSearch, Plus, RotateCcw } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import { DocumentsTable } from "@/features/corpus/components/documents-table"
import type {
  DocumentCategory,
  DocumentStatus,
} from "@/features/corpus/model/types"
import {
  listDocuments,
  updateDocumentCategory,
} from "@/features/corpus/services/corpus-service"
import { Button } from "@/shared/ui/base/button"
import { Skeleton } from "@/shared/ui/base/skeleton"

export function DocumentsReviewScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const [status, setStatus] = useState<DocumentStatus | "all">("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] =
    useState<DocumentCategory>("principal")
  const documents = useQuery({
    queryKey: ["corpus", workspaceId, "documents"],
    queryFn: () => listDocuments(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const filtered = useMemo(
    () =>
      status === "all"
        ? (documents.data ?? [])
        : (documents.data ?? []).filter(
            (document) => document.status === status
          ),
    [documents.data, status]
  )
  const bulkUpdate = useMutation({
    mutationFn: () =>
      Promise.all(
        Array.from(selectedIds, (id) =>
          updateDocumentCategory(id, bulkCategory)
        )
      ),
    onSuccess: async () => {
      setSelectedIds(new Set())
      await queryClient.invalidateQueries({ queryKey: ["corpus", workspaceId] })
      toast.success(t("corpus.review.bulkSuccess"))
    },
    onError: () => toast.error(t("corpus.errors.update")),
  })

  return (
    <div className="mx-auto w-full max-w-6xl">
      <CorpusPageHeader
        action={
          <Button
            onClick={() =>
              void navigate(`/workspaces/${workspaceId}/corpus/import`)
            }
          >
            <Plus /> {t("corpus.review.add")}
          </Button>
        }
        description={t("corpus.review.description")}
        eyebrow={t("corpus.eyebrow")}
        title={t("corpus.review.title")}
      />
      <div className="mt-7 flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          {t("corpus.review.count", { count: filtered.length })}
        </p>
        <select
          aria-label={t("corpus.review.filter")}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          onChange={(event) =>
            setStatus(event.target.value as DocumentStatus | "all")
          }
          value={status}
        >
          <option value="all">{t("corpus.review.all")}</option>
          {(
            [
              "conforme",
              "a_verifier",
              "rejete",
              "integre_decision_humaine",
              "non_classe",
            ] as const
          ).map((value) => (
            <option key={value} value={value}>
              {t(`corpus.status.${value}`)}
            </option>
          ))}
        </select>
      </div>

      {selectedIds.size > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
          <p className="mr-auto text-[13px]">
            {t("corpus.review.selected", { count: selectedIds.size })}
          </p>
          <select
            aria-label={t("corpus.table.category")}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
            onChange={(event) =>
              setBulkCategory(event.target.value as DocumentCategory)
            }
            value={bulkCategory}
          >
            <option value="principal">{t("corpus.category.principal")}</option>
            <option value="complementaire">
              {t("corpus.category.complementaire")}
            </option>
            <option value="autre">{t("corpus.category.autre")}</option>
          </select>
          <Button
            disabled={bulkUpdate.isPending}
            onClick={() => bulkUpdate.mutate()}
            size="sm"
          >
            {t("corpus.review.apply")}
          </Button>
        </div>
      ) : null}

      {documents.isPending ? (
        <Skeleton className="mt-4 h-72 rounded-xl" />
      ) : documents.isError ? (
        <div className="mt-4 rounded-xl border border-border p-6">
          <p className="text-sm">{t("corpus.errors.load")}</p>
          <Button
            className="mt-4"
            onClick={() => void documents.refetch()}
            variant="outline"
          >
            <RotateCcw /> {t("workspaces.error.retry")}
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-xl border border-border px-6 py-16 text-center">
          <FileSearch className="size-6 text-muted-foreground" />
          <p className="mt-4 text-sm font-semibold">
            {t("corpus.review.emptyTitle")}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {t("corpus.review.emptyDescription")}
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <DocumentsTable
            documents={filtered}
            onSelectionChange={setSelectedIds}
            selectedIds={selectedIds}
            workspaceId={workspaceId}
          />
        </div>
      )}
    </div>
  )
}
