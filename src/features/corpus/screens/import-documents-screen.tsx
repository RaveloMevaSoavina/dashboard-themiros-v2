import { useQuery, useQueryClient } from "@tanstack/react-query"
import { FileText, Lock, RotateCcw, Trash2, Upload, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import { DeleteDocumentsDialog } from "@/features/corpus/components/delete-documents-dialog"
import { DocumentDecisionActions } from "@/features/corpus/components/document-decision-actions"
import { DocumentStatusBadge } from "@/features/corpus/components/document-status-badge"
import { DocumentStatusMessage } from "@/features/corpus/components/document-status-message"
import {
  type BatchFile,
  formatFileSize,
  ImportConfirmDialog,
} from "@/features/corpus/components/import-confirm-dialog"
import { IngestionSteps } from "@/features/corpus/components/ingestion-steps"
import {
  ingestionProgress,
  isAwaitingQualification,
  isQualificationPending,
} from "@/features/corpus/model/ingestion"
import { formatSizeLimit } from "@/features/corpus/model/ingestion-settings"
import type {
  CorpusDocument,
  DocumentCategory,
} from "@/features/corpus/model/types"
import { useIngestionSettings } from "@/features/corpus/model/use-ingestion-settings"
import {
  findDocumentsByHash,
  hashFile,
  IngestionRequestError,
  listDocuments,
  listProgramVersions,
  recordDuplicateDetected,
  uploadDocument,
} from "@/features/corpus/services/corpus-service"
import { useWorkspaces } from "@/features/workspaces/model/workspace-provider"
import { getWorkspaceDetails } from "@/features/workspaces/services/workspace-service"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/base/button"

/** Fichier confirmé : il garde les métadonnées validées dans la modale. */
type UploadItem = {
  id: string
  file: File
  hash: string
  category: DocumentCategory
  versionId?: string
  allowDuplicate: boolean
  state: "uploading" | "error"
  errorMessage?: string
}

const acceptedExtensions = ["pdf", "docx", "xlsx"]

function isSupported(file: File) {
  return acceptedExtensions.includes(
    file.name.split(".").pop()?.toLowerCase() ?? ""
  )
}

function trackingStorageKey(workspaceId: string) {
  return `corpus-import:${workspaceId}`
}

/* US-8.11 : les fichiers chargés restent suivis si l'on quitte la vue. */
function readTrackedIds(workspaceId: string) {
  try {
    const value = sessionStorage.getItem(trackingStorageKey(workspaceId))
    return new Set<string>(value ? (JSON.parse(value) as string[]) : [])
  } catch {
    return new Set<string>()
  }
}

function writeTrackedIds(workspaceId: string, ids: ReadonlySet<string>) {
  try {
    sessionStorage.setItem(
      trackingStorageKey(workspaceId),
      JSON.stringify(Array.from(ids))
    )
  } catch {
    // Le suivi reste disponible en mémoire pour la session courante.
  }
}

export function ImportDocumentsScreen() {
  const { i18n, t } = useTranslation()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { activeWorkspace } = useWorkspaces()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [batch, setBatch] = useState<BatchFile[] | null>(null)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [category, setCategory] = useState<DocumentCategory>("principal")
  const [versionId, setVersionId] = useState("")
  const [deleting, setDeleting] = useState<CorpusDocument[] | null>(null)
  const [trackedIds, setTrackedIds] = useState(() =>
    readTrackedIds(workspaceId)
  )
  const locale = i18n.resolvedLanguage ?? i18n.language
  /* Seuils et limites de l'espace (RG-5.4), pas des constantes du front. */
  const { settings: ingestionSettings } = useIngestionSettings(workspaceId)

  useEffect(() => {
    writeTrackedIds(workspaceId, trackedIds)
  }, [trackedIds, workspaceId])

  const details = useQuery({
    queryKey: ["workspaces", "details", workspaceId],
    queryFn: () => getWorkspaceDetails(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const versions = useQuery({
    queryKey: ["program-versions", workspaceId],
    queryFn: () => listProgramVersions(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const documents = useQuery({
    queryKey: ["corpus", workspaceId, "documents"],
    queryFn: () => listDocuments(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: (query) =>
      query.state.data?.some(isAwaitingQualification) ? 5000 : false,
  })

  /* Le cadre doit être validé avant toute ingestion (US-6.6). */
  const locked = activeWorkspace?.frameworkStatus === "draft"
  /* US-8.4 : la version n'est demandée qu'en mode comparatif. */
  const comparative = (versions.data?.length ?? 0) > 1
  const countryName = useMemo(() => {
    const code = details.data?.targetCountry
    if (!code) return null
    try {
      return (
        new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code
      )
    } catch {
      return code
    }
  }, [details.data?.targetCountry, locale])
  const tracked = useMemo(
    () =>
      (documents.data ?? []).filter(
        (document) =>
          trackedIds.has(document.id) || isAwaitingQualification(document)
      ),
    [documents.data, trackedIds]
  )

  async function addFiles(items: FileList | File[]) {
    if (locked) return
    const candidates = Array.from(items)
    const supported = candidates.filter(isSupported)
    if (supported.length !== candidates.length) {
      toast.error(t("corpus.import.invalidFormat"))
    }
    const room = ingestionSettings.maxFilesPerBatch - (batch?.length ?? 0)
    if (supported.length > room) {
      toast.error(
        t("corpus.import.tooManyFiles", {
          count: ingestionSettings.maxFilesPerBatch,
        })
      )
    }
    const accepted = supported.slice(0, Math.max(room, 0))
    if (accepted.length === 0) return

    const added: BatchFile[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      state:
        file.size > ingestionSettings.maxFileSizeBytes
          ? "too_large"
          : "checking",
    }))
    const entries = added.filter((entry) => entry.state === "checking")
    /* Chaque ajout ouvre la modale de confirmation des métadonnées. */
    setBatch((current) => [...(current ?? []), ...added])
    if (entries.length === 0) return

    try {
      const hashed = await Promise.all(
        entries.map(async (entry) => ({
          ...entry,
          hash: await hashFile(entry.file),
        }))
      )
      const existing = await findDocumentsByHash(
        workspaceId,
        hashed.map((entry) => entry.hash)
      )
      /* Un fichier déjà présent dans le lot ou en cours de chargement est
         aussi un doublon. */
      const queued = new Map<string, string>()
      for (const entry of [...(batch ?? []), ...uploads]) {
        if (entry.hash && entry.state !== "duplicate") {
          queued.set(entry.hash, entry.file.name)
        }
      }
      const resolved = hashed.map((entry) => {
        const duplicate = existing.get(entry.hash)
        const duplicateOf = duplicate?.filename ?? queued.get(entry.hash)
        if (!duplicateOf) queued.set(entry.hash, entry.file.name)
        if (duplicate) {
          /* Garde-fou §3.3 : jamais de suppression, la décision revient à
             l'utilisateur ; la détection est journalisée (§11.1). */
          void recordDuplicateDetected(duplicate, {
            filename: entry.file.name,
            hash: entry.hash,
          }).catch(() => undefined)
        }
        return {
          ...entry,
          state: duplicateOf ? ("duplicate" as const) : ("ready" as const),
          duplicateOf,
        }
      })
      setBatch(
        (current) =>
          current?.map(
            (entry) => resolved.find((item) => item.id === entry.id) ?? entry
          ) ?? null
      )
    } catch {
      setBatch(
        (current) =>
          current?.map((entry) =>
            entries.some((item) => item.id === entry.id)
              ? { ...entry, state: "error" as const }
              : entry
          ) ?? null
      )
    }
  }

  function describeUploadError(error: unknown) {
    if (error instanceof IngestionRequestError) {
      return t(`corpus.requestErrors.${error.code}`, {
        defaultValue: t("corpus.import.errors.upload"),
      })
    }
    const info = error as { statusCode?: string } | null
    if (info?.statusCode === "413") return t("corpus.import.errors.tooLarge")
    return t("corpus.import.errors.upload")
  }

  async function uploadItems(items: UploadItem[]) {
    const results = await Promise.allSettled(
      items.map(async (item) => {
        try {
          const { documentId } = await uploadDocument({
            workspaceId,
            file: item.file,
            hash: item.hash,
            category: item.category,
            allowDuplicate: item.allowDuplicate,
            ...(item.versionId ? { versionId: item.versionId } : {}),
          })
          setUploads((current) =>
            current.filter((entry) => entry.id !== item.id)
          )
          setTrackedIds((current) => new Set(current).add(documentId))
        } catch (error) {
          setUploads((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    state: "error",
                    errorMessage: describeUploadError(error),
                  }
                : entry
            )
          )
          throw error
        }
      })
    )
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["corpus", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["workspaces", "list"] }),
    ])
    if (results.some((result) => result.status === "rejected")) {
      toast.error(t("corpus.import.failure"))
    } else {
      toast.success(t("corpus.import.success"))
    }
  }

  function confirmBatch() {
    const items: UploadItem[] = (batch ?? []).flatMap((entry) =>
      (entry.state === "ready" ||
        (entry.state === "duplicate" && entry.allowDuplicate)) &&
      entry.hash
        ? [
            {
              id: entry.id,
              file: entry.file,
              hash: entry.hash,
              category: entry.category ?? category,
              allowDuplicate: entry.state === "duplicate",
              ...(comparative && versionId ? { versionId } : {}),
              state: "uploading" as const,
            },
          ]
        : []
    )
    setBatch(null)
    setUploads((current) => [...current, ...items])
    void uploadItems(items)
  }

  function retryUpload(item: UploadItem) {
    const next = {
      ...item,
      state: "uploading" as const,
      errorMessage: undefined,
    }
    setUploads((current) =>
      current.map((entry) => (entry.id === item.id ? next : entry))
    )
    void uploadItems([next])
  }

  function openDocument(document: CorpusDocument) {
    void navigate(`/workspaces/${workspaceId}/corpus/documents/${document.id}`)
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <CorpusPageHeader
        description={t("corpus.import.description")}
        eyebrow={t("corpus.eyebrow")}
        title={t("corpus.import.title")}
      />

      {locked ? (
        <div className="mt-6 flex flex-wrap items-start gap-4 rounded-xl border border-border bg-muted/40 p-4">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {t("corpus.import.lock.title")}
            </p>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
              {t("corpus.import.lock.description")}
            </p>
          </div>
          <Button
            onClick={() =>
              void navigate(`/workspaces/${workspaceId}/framework/pillars`)
            }
            size="sm"
            variant="outline"
          >
            {t("corpus.import.lock.action")}
          </Button>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <section>
            <button
              className={cn(
                "flex min-h-56 w-full flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
                isDragging && "bg-muted ring-2 ring-ring/30"
              )}
              disabled={locked}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                void addFiles(event.dataTransfer.files)
              }}
              type="button"
            >
              <Upload className="size-7 text-muted-foreground" />
              <span className="mt-5 text-sm font-semibold">
                {t("corpus.import.dropTitle")}
              </span>
              <span className="mt-2 text-[13px] text-muted-foreground">
                {t("corpus.import.dropDescription")}
              </span>
            </button>
            <input
              accept=".pdf,.docx,.xlsx"
              className="hidden"
              multiple
              onChange={(event) => {
                if (event.target.files) void addFiles(event.target.files)
                event.target.value = ""
              }}
              ref={inputRef}
              type="file"
            />
          </section>

          {uploads.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold">
                {t("corpus.import.uploads.title", { count: uploads.length })}
              </h2>
              <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
                {uploads.map((item) => (
                  <li
                    className="flex items-start gap-3 px-4 py-3"
                    key={item.id}
                  >
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">
                        {item.file.name}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-[11px] leading-4 text-muted-foreground",
                          item.state === "error" && "text-foreground"
                        )}
                      >
                        {formatFileSize(item.file.size, locale)} ·{" "}
                        {t(`corpus.category.${item.category}`)} ·{" "}
                        {item.state === "error"
                          ? item.errorMessage
                          : t("corpus.import.state.uploading")}
                      </p>
                      {item.state === "uploading" ? (
                        <div className="mt-2">
                          <IngestionSteps completed={0} running />
                        </div>
                      ) : null}
                    </div>
                    {item.state === "error" ? (
                      <div className="flex items-center gap-1">
                        <Button
                          onClick={() => retryUpload(item)}
                          size="sm"
                          variant="outline"
                        >
                          <RotateCcw /> {t("corpus.import.retry")}
                        </Button>
                        <Button
                          aria-label={t("corpus.import.remove", {
                            name: item.file.name,
                          })}
                          onClick={() =>
                            setUploads((current) =>
                              current.filter((entry) => entry.id !== item.id)
                            )
                          }
                          size="icon-xs"
                          variant="ghost"
                        >
                          <X />
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {tracked.length > 0 ? (
            <section>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">
                    {t("corpus.import.tracking.title")}
                  </h2>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {t("corpus.import.tracking.description")}
                  </p>
                </div>
                <Button
                  onClick={() =>
                    void navigate(`/workspaces/${workspaceId}/corpus/documents`)
                  }
                  size="sm"
                  variant="outline"
                >
                  {t("corpus.import.openReview")}
                </Button>
              </div>
              <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
                {tracked.map((document) => {
                  const awaiting = isQualificationPending(document)
                  const failed = document.processingState === "failed"
                  const progress = ingestionProgress(document)
                  return (
                    <li className="px-4 py-3" key={document.id}>
                      <div className="flex flex-wrap items-start gap-3">
                        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <button
                            className="block max-w-full truncate text-left text-[13px] font-medium hover:underline"
                            onClick={() => openDocument(document)}
                            type="button"
                          >
                            {document.filename}
                          </button>
                          <div className="mt-1.5">
                            <IngestionSteps
                              completed={progress.completed}
                              running={progress.running}
                            />
                          </div>
                        </div>
                        {awaiting || failed ? (
                          <span
                            className={cn(
                              "text-[11px] text-muted-foreground",
                              failed && "font-medium text-foreground"
                            )}
                          >
                            {t(
                              `corpus.import.tracking.state.${document.processingState}`
                            )}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            {document.relevanceScore !== null ? (
                              <span className="text-[12px] tabular-nums text-muted-foreground">
                                {t("corpus.import.tracking.score", {
                                  score: document.relevanceScore,
                                })}
                              </span>
                            ) : null}
                            <DocumentStatusBadge status={document.status} />
                          </div>
                        )}
                        <Button
                          aria-label={t("corpus.delete.actionFor", {
                            name: document.filename,
                          })}
                          onClick={() => setDeleting([document])}
                          size="icon-xs"
                          title={t("corpus.delete.action")}
                          variant="ghost"
                        >
                          <Trash2 />
                        </Button>
                      </div>

                      {!awaiting ? (
                        <DocumentStatusMessage
                          className="mt-2 ml-7"
                          document={document}
                        />
                      ) : null}
                      <DocumentDecisionActions
                        className="mt-2 ml-7"
                        document={document}
                        onVerify={() => openDocument(document)}
                      />
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          {documents.isError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
              <p className="text-[13px]">{t("corpus.errors.load")}</p>
              <Button
                onClick={() => void documents.refetch()}
                size="sm"
                variant="outline"
              >
                <RotateCcw /> {t("workspaces.error.retry")}
              </Button>
            </div>
          ) : null}
        </div>

        <aside className="h-fit rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold">
            {t("corpus.import.engine.title")}
          </h2>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
            {t("corpus.import.engine.description")}
          </p>
          <dl className="mt-3 space-y-2 text-[12px]">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="tabular-nums text-muted-foreground">
                ≥ {ingestionSettings.conformityThreshold}
              </dt>
              <dd className="text-right">
                {t("corpus.import.engine.accepted")}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="tabular-nums text-muted-foreground">
                {ingestionSettings.ambiguousThreshold}–
                {ingestionSettings.conformityThreshold - 1}
              </dt>
              <dd className="text-right">
                {t("corpus.import.engine.ambiguous")}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="tabular-nums text-muted-foreground">
                &lt; {ingestionSettings.ambiguousThreshold}
              </dt>
              <dd className="text-right">
                {t("corpus.import.engine.rejected")}
              </dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-border pt-3 text-[11px] leading-4 text-muted-foreground">
            {t("corpus.import.engine.limits", {
              size: formatSizeLimit(ingestionSettings.maxFileSizeBytes, locale),
              count: ingestionSettings.maxFilesPerBatch,
            })}
          </p>
        </aside>
      </div>

      <DeleteDocumentsDialog
        documents={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(ids) =>
          setTrackedIds((current) => {
            const next = new Set(current)
            for (const id of ids) next.delete(id)
            return next
          })
        }
        workspaceId={workspaceId}
      />

      <ImportConfirmDialog
        category={category}
        comparative={comparative}
        countryCode={details.data?.targetCountry ?? ""}
        countryName={countryName}
        expectedLanguages={details.data?.expectedLanguages ?? []}
        maxFileSizeBytes={ingestionSettings.maxFileSizeBytes}
        files={batch}
        onCancel={() => setBatch(null)}
        onCategoryChange={setCategory}
        onConfirm={confirmBatch}
        onAllowDuplicate={(id, allow) =>
          setBatch(
            (current) =>
              current?.map((entry) =>
                entry.id === id ? { ...entry, allowDuplicate: allow } : entry
              ) ?? null
          )
        }
        onFileCategoryChange={(id, value) =>
          setBatch(
            (current) =>
              current?.map((entry) =>
                entry.id === id ? { ...entry, category: value } : entry
              ) ?? null
          )
        }
        onRemove={(id) =>
          setBatch((current) => {
            const next = current?.filter((entry) => entry.id !== id) ?? []
            return next.length > 0 ? next : null
          })
        }
        onVersionChange={setVersionId}
        versionId={versionId}
        versions={versions.data ?? []}
      />
    </div>
  )
}
