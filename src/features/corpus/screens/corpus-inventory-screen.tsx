import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, FilePlus2, LockKeyhole, RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"

import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import { DocumentsTable } from "@/features/corpus/components/documents-table"
import {
  listCorpusThresholds,
  listDocuments,
} from "@/features/corpus/services/corpus-service"
import { Button } from "@/shared/ui/base/button"
import { Skeleton } from "@/shared/ui/base/skeleton"

export function CorpusInventoryScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const documents = useQuery({
    queryKey: ["corpus", workspaceId, "documents"],
    queryFn: () => listDocuments(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const thresholds = useQuery({
    queryKey: ["corpus", "thresholds"],
    queryFn: listCorpusThresholds,
  })

  const included =
    documents.data?.filter((document) =>
      ["conforme", "integre_decision_humaine"].includes(document.status)
    ).length ?? 0
  const exploratory = thresholds.data?.find(
    (item) => item.type === "exploratoire"
  )
  const standard = thresholds.data?.find((item) => item.type === "standard")
  const deep = thresholds.data?.find((item) => item.type === "approfondie")
  const level =
    deep && included >= deep.minimum
      ? "approfondie"
      : standard && included >= standard.minimum
        ? "standard"
        : exploratory && included >= exploratory.minimum
          ? "exploratoire"
          : "insufficient"
  const next =
    level === "insufficient"
      ? exploratory
      : level === "exploratoire"
        ? standard
        : level === "standard"
          ? deep
          : null
  const progressMax = deep?.minimum ?? 1
  const loading = documents.isPending || thresholds.isPending
  const failed = documents.isError || thresholds.isError

  return (
    <div className="mx-auto w-full max-w-6xl">
      <CorpusPageHeader
        action={
          <Button
            onClick={() =>
              void navigate(`/workspaces/${workspaceId}/corpus/import`)
            }
          >
            <FilePlus2 /> {t("corpus.inventory.add")}
          </Button>
        }
        description={t("corpus.inventory.description")}
        eyebrow={t("corpus.eyebrow")}
        title={t("corpus.inventory.title")}
      />

      {loading ? (
        <>
          <Skeleton className="mt-8 h-48 rounded-xl" />
          <Skeleton className="mt-6 h-72 rounded-xl" />
        </>
      ) : failed || !exploratory || !standard || !deep ? (
        <div className="mt-8 rounded-xl border border-border p-6">
          <p className="text-sm">{t("corpus.errors.load")}</p>
          <Button
            className="mt-4"
            onClick={() => {
              void documents.refetch()
              void thresholds.refetch()
            }}
            variant="outline"
          >
            <RotateCcw /> {t("workspaces.error.retry")}
          </Button>
        </div>
      ) : (
        <>
          <section className="mt-8 rounded-xl border border-border p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {t("corpus.inventory.mass")}
                </p>
                <p className="mt-3 text-4xl font-semibold tabular-nums">
                  {included}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {t("corpus.inventory.included", { count: included })}
                </p>
              </div>
              <div className="rounded-lg border border-border px-4 py-3 text-right">
                <p className="text-[11px] text-muted-foreground">
                  {t("corpus.inventory.level")}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {t(`corpus.level.${level}`)}
                </p>
              </div>
            </div>
            <div className="mt-7 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-[width]"
                style={{
                  width: `${Math.min(100, (included / progressMax) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 text-[11px] text-muted-foreground">
              <span>
                {t("corpus.level.exploratoire")} · {exploratory.minimum}
              </span>
              <span className="text-center">
                {t("corpus.level.standard")} · {standard.minimum}
              </span>
              <span className="text-right">
                {t("corpus.level.approfondie")} · {deep.minimum}
              </span>
            </div>
            {next ? (
              <p className="mt-5 text-[13px] text-muted-foreground">
                {t("corpus.inventory.next", {
                  count: Math.max(0, next.minimum - included),
                  level: t(`corpus.level.${next.type}`),
                })}
              </p>
            ) : null}
          </section>

          {level === "insufficient" ? (
            <div className="mt-5 flex gap-3 rounded-xl border border-border p-4 text-[13px] leading-5">
              <LockKeyhole className="mt-0.5 size-4 shrink-0" />
              {t("corpus.inventory.blocked", {
                count: included,
                threshold: exploratory.minimum,
              })}
            </div>
          ) : level === "exploratoire" ? (
            <div className="mt-5 flex gap-3 rounded-xl border border-border p-4 text-[13px] leading-5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {t("corpus.inventory.warning", {
                count: included,
                remaining: standard.minimum - included,
              })}
            </div>
          ) : null}

          <section className="mt-8">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">
                  {t("corpus.inventory.documents")}
                </h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {t("corpus.inventory.documentsDescription", {
                    count: documents.data?.length ?? 0,
                  })}
                </p>
              </div>
            </div>
            {(documents.data?.length ?? 0) > 0 ? (
              <DocumentsTable
                documents={documents.data ?? []}
                editable={false}
                workspaceId={workspaceId}
              />
            ) : (
              <div className="rounded-xl border border-border px-6 py-16 text-center text-[13px] text-muted-foreground">
                {t("corpus.inventory.empty")}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
