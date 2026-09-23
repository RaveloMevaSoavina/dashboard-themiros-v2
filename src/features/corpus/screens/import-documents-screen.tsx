import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, FileText, LoaderCircle, Upload, X } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import type { DocumentCategory } from "@/features/corpus/model/types"
import {
  listProgramVersions,
  uploadDocument,
} from "@/features/corpus/services/corpus-service"
import { getWorkspaceDetails } from "@/features/workspaces/services/workspace-service"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/base/button"
import { Label } from "@/shared/ui/base/label"

type PendingFile = {
  id: string
  file: File
  state: "ready" | "uploading" | "complete" | "error"
}

const acceptedExtensions = ["pdf", "docx", "xlsx"]
const selectClassName =
  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

export function ImportDocumentsScreen() {
  const { t } = useTranslation()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<PendingFile[]>([])
  const [category, setCategory] = useState<DocumentCategory>("principal")
  const [versionId, setVersionId] = useState("")

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
  const comparative = (versions.data?.length ?? 0) > 1

  function addFiles(items: FileList | File[]) {
    const candidates = Array.from(items)
    const valid = candidates.filter((file) =>
      acceptedExtensions.includes(
        file.name.split(".").pop()?.toLowerCase() ?? ""
      )
    )
    if (valid.length !== candidates.length) {
      toast.error(t("corpus.import.invalidFormat"))
    }
    setFiles((current) => [
      ...current,
      ...valid.map((file) => ({
        id: crypto.randomUUID(),
        file,
        state: "ready" as const,
      })),
    ])
  }

  const upload = useMutation({
    mutationFn: async () => {
      const pending = files.filter((item) => item.state !== "complete")
      const results = await Promise.allSettled(
        pending.map(async (item) => {
          setFiles((current) =>
            current.map((entry) =>
              entry.id === item.id ? { ...entry, state: "uploading" } : entry
            )
          )
          try {
            await uploadDocument({
              workspaceId,
              file: item.file,
              category,
              country: details.data?.targetCountry ?? "",
              ...(comparative && versionId ? { versionId } : {}),
            })
            setFiles((current) =>
              current.map((entry) =>
                entry.id === item.id ? { ...entry, state: "complete" } : entry
              )
            )
          } catch (error) {
            setFiles((current) =>
              current.map((entry) =>
                entry.id === item.id ? { ...entry, state: "error" } : entry
              )
            )
            throw error
          }
        })
      )

      if (results.some((result) => result.status === "rejected")) {
        throw new Error("At least one document upload failed")
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["corpus", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["workspaces", "list"] }),
      ])
      toast.success(t("corpus.import.success"))
    },
    onError: () => toast.error(t("corpus.import.failure")),
  })

  const allComplete =
    files.length > 0 && files.every((item) => item.state === "complete")
  const canUpload =
    files.some((item) => item.state !== "complete") &&
    (!comparative || Boolean(versionId)) &&
    !upload.isPending

  return (
    <div className="mx-auto w-full max-w-5xl">
      <CorpusPageHeader
        description={t("corpus.import.description")}
        eyebrow={t("corpus.eyebrow")}
        title={t("corpus.import.title")}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <section>
          <button
            className={cn(
              "flex min-h-64 w-full flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center transition-colors hover:bg-muted/40",
              isDragging && "bg-muted ring-2 ring-ring/30"
            )}
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
              addFiles(event.dataTransfer.files)
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
            onChange={(event) =>
              event.target.files && addFiles(event.target.files)
            }
            ref={inputRef}
            type="file"
          />

          {files.length > 0 ? (
            <div className="mt-4 divide-y divide-border rounded-xl border border-border">
              {files.map((item) => (
                <div
                  className="flex items-center gap-3 px-4 py-3"
                  key={item.id}
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {item.file.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t(`corpus.import.state.${item.state}`)}
                    </p>
                  </div>
                  {item.state === "uploading" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : item.state === "complete" ? (
                    <Check className="size-4" />
                  ) : (
                    <Button
                      aria-label={t("corpus.import.remove")}
                      onClick={() =>
                        setFiles((current) =>
                          current.filter((entry) => entry.id !== item.id)
                        )
                      }
                      size="icon-xs"
                      variant="ghost"
                    >
                      <X />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <aside className="h-fit space-y-5 rounded-xl border border-border p-5">
          <div>
            <Label htmlFor="document-category">
              {t("corpus.import.category")}
            </Label>
            <select
              className={cn(selectClassName, "mt-2")}
              id="document-category"
              onChange={(event) =>
                setCategory(event.target.value as DocumentCategory)
              }
              value={category}
            >
              <option value="principal">
                {t("corpus.category.principal")}
              </option>
              <option value="complementaire">
                {t("corpus.category.complementaire")}
              </option>
              <option value="autre">{t("corpus.category.autre")}</option>
            </select>
          </div>
          <div>
            <Label>{t("corpus.import.country")}</Label>
            <div className="mt-2 rounded-lg border border-border px-3 py-2.5 text-sm text-muted-foreground">
              {details.data?.targetCountry || "—"}
            </div>
          </div>
          {comparative ? (
            <div>
              <Label htmlFor="document-version">
                {t("corpus.import.version")}
              </Label>
              <select
                className={cn(selectClassName, "mt-2")}
                id="document-version"
                onChange={(event) => setVersionId(event.target.value)}
                value={versionId}
              >
                <option value="">{t("corpus.import.selectVersion")}</option>
                {versions.data?.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.label} · {version.year}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <Button
            className="w-full"
            disabled={!canUpload}
            onClick={() => upload.mutate()}
            size="lg"
          >
            {upload.isPending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Upload />
            )}
            {t("corpus.import.submit")}
          </Button>
          {allComplete ? (
            <Button
              className="w-full"
              onClick={() =>
                void navigate(`/workspaces/${workspaceId}/corpus/documents`)
              }
              variant="outline"
            >
              {t("corpus.import.openReview")}
            </Button>
          ) : null}
          <p className="text-[11px] leading-5 text-muted-foreground">
            {t("corpus.import.processingNote")}
          </p>
        </aside>
      </div>
    </div>
  )
}
