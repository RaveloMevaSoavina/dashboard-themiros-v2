import {
  ChevronDown,
  Copy,
  FileText,
  Languages,
  LoaderCircle,
  MapPin,
  X,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { DocumentCategoryField } from "@/features/corpus/components/document-category-field"
import { formatSizeLimit } from "@/features/corpus/model/ingestion-settings"
import {
  type DocumentCategory,
  documentCategories,
  type ProgramVersion,
} from "@/features/corpus/model/types"
import type { WorkspaceLanguage } from "@/features/workspaces/model/types"
import { cn } from "@/shared/lib/utils"
import { Badge } from "@/shared/ui/base/badge"
import { Button } from "@/shared/ui/base/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/base/dialog"
import { Label } from "@/shared/ui/base/label"

export type BatchFile = {
  id: string
  file: File
  state: "checking" | "ready" | "duplicate" | "too_large" | "error"
  hash?: string
  duplicateOf?: string
  /** Catégorie propre au fichier ; à défaut, la catégorie commune. */
  category?: DocumentCategory
  /** §3.3 : un doublon n'est chargé que sur décision de l'utilisateur. */
  allowDuplicate?: boolean
}

const selectClassName =
  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

export function formatFileSize(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: value >= 1_000_000 ? "megabyte" : "kilobyte",
    maximumFractionDigits: 1,
  }).format(value / (value >= 1_000_000 ? 1_000_000 : 1_000))
}

/**
 * Confirmation d'un lot ajouté : les métadonnées communes (RG-4.4) sont
 * relues et validées avant chaque chargement.
 */
export function ImportConfirmDialog({
  files,
  category,
  onCategoryChange,
  versionId,
  onVersionChange,
  versions,
  comparative,
  countryCode,
  countryName,
  expectedLanguages,
  maxFileSizeBytes,
  onFileCategoryChange,
  onAllowDuplicate,
  onRemove,
  onCancel,
  onConfirm,
}: {
  files: BatchFile[] | null
  category: DocumentCategory
  onCategoryChange: (value: DocumentCategory) => void
  versionId: string
  onVersionChange: (value: string) => void
  versions: ProgramVersion[]
  comparative: boolean
  countryCode: string
  countryName: string | null
  expectedLanguages: WorkspaceLanguage[]
  maxFileSizeBytes: number
  onFileCategoryChange: (
    id: string,
    value: DocumentCategory | undefined
  ) => void
  onAllowDuplicate: (id: string, allow: boolean) => void
  onRemove: (id: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const { i18n, t } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const isUploadable = (item: BatchFile) =>
    item.state === "ready" ||
    (item.state === "duplicate" && Boolean(item.allowDuplicate))
  const ready = files?.filter(isUploadable) ?? []
  const checking = files?.some((item) => item.state === "checking") ?? false
  const missingVersion = comparative && !versionId
  const canConfirm = ready.length > 0 && !checking && !missingVersion

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
      open={files !== null}
    >
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("corpus.import.confirm.title")}</DialogTitle>
          <DialogDescription>
            {t("corpus.import.confirm.description")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-6 pb-5 md:grid-cols-2 md:gap-8">
          <section className="min-w-0">
            <h3 className="text-sm font-semibold">
              {t("corpus.import.confirm.files", {
                count: files?.length ?? 0,
              })}
            </h3>
            <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
              {t("corpus.import.confirm.filesDescription")}
            </p>
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
              {files?.map((item) => (
                <li
                  className="flex items-start gap-3 px-3 py-2.5"
                  key={item.id}
                >
                  {item.state === "duplicate" ? (
                    <Copy className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {item.file.name}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-[11px] leading-4 text-muted-foreground",
                        item.state !== "ready" &&
                          item.state !== "checking" &&
                          "text-foreground"
                      )}
                    >
                      {formatFileSize(item.file.size, locale)} ·{" "}
                      {item.state === "duplicate"
                        ? t(
                            item.allowDuplicate
                              ? "corpus.import.duplicateAllowed"
                              : "corpus.import.duplicate",
                            { name: item.duplicateOf }
                          )
                        : item.state === "too_large"
                          ? t("corpus.import.fileTooLarge", {
                              max: formatSizeLimit(maxFileSizeBytes, locale),
                            })
                          : item.state === "error"
                            ? t("corpus.import.errors.check")
                            : t(`corpus.import.state.${item.state}`)}
                    </p>
                    {item.state === "duplicate" ? (
                      <Button
                        className="mt-2"
                        onClick={() =>
                          onAllowDuplicate(item.id, !item.allowDuplicate)
                        }
                        size="xs"
                        variant="outline"
                      >
                        {item.allowDuplicate
                          ? t("corpus.import.duplicateSkip")
                          : t("corpus.import.duplicateUpload")}
                      </Button>
                    ) : null}
                    {isUploadable(item) ? (
                      <div className="relative mt-2 w-full">
                        <select
                          aria-label={t("corpus.import.fileCategory", {
                            name: item.file.name,
                          })}
                          className={cn(
                            "h-8 w-full appearance-none truncate rounded-lg border border-input bg-background pr-9 pl-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            item.category && "border-foreground font-medium"
                          )}
                          onChange={(event) =>
                            onFileCategoryChange(
                              item.id,
                              (event.target.value || undefined) as
                                | DocumentCategory
                                | undefined
                            )
                          }
                          value={item.category ?? ""}
                        >
                          <option value="">
                            {t("corpus.import.commonCategoryOption", {
                              category: t(`corpus.category.${category}`),
                            })}
                          </option>
                          {documentCategories.map((value) => (
                            <option key={value} value={value}>
                              {t(`corpus.category.${value}`)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          aria-hidden
                          className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                        />
                      </div>
                    ) : null}
                  </div>
                  {item.state === "checking" ? (
                    <LoaderCircle className="mt-0.5 size-4 animate-spin" />
                  ) : (
                    <Button
                      aria-label={t("corpus.import.remove", {
                        name: item.file.name,
                      })}
                      onClick={() => onRemove(item.id)}
                      size="icon-xs"
                      variant="ghost"
                    >
                      <X />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="min-w-0 space-y-4 md:border-l md:border-border md:pl-8">
            <div>
              <h3 className="text-sm font-semibold">
                {t("corpus.import.metadata.title")}
              </h3>
              <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                {t("corpus.import.metadata.description")}
              </p>
            </div>

            <DocumentCategoryField
              description={t("corpus.import.commonCategoryHint")}
              label={t("corpus.import.commonCategory")}
              onChange={onCategoryChange}
              value={category}
            />

            {comparative ? (
              <div>
                <Label htmlFor="document-version">
                  {t("corpus.import.version")}
                </Label>
                <select
                  className={cn(selectClassName, "mt-2")}
                  id="document-version"
                  onChange={(event) => onVersionChange(event.target.value)}
                  value={versionId}
                >
                  <option value="">{t("corpus.import.selectVersion")}</option>
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.label} · {version.year}
                    </option>
                  ))}
                </select>
                <p
                  className={cn(
                    "mt-1.5 text-[11px] leading-4 text-muted-foreground",
                    missingVersion && ready.length > 0 && "text-foreground"
                  )}
                >
                  {missingVersion && ready.length > 0
                    ? t("corpus.import.versionRequired")
                    : t("corpus.import.versionHint")}
                </p>
              </div>
            ) : null}

            <div className="grid gap-3 rounded-lg bg-muted/40 p-3">
              <div className="flex gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[13px] font-medium">
                    {t("corpus.import.country")}
                  </p>
                  <p className="text-[13px]">
                    {countryName ?? "—"}
                    {countryCode ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {countryCode}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                    {t("corpus.import.countryHint")}
                  </p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <Languages className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[13px] font-medium">
                    {t("corpus.import.language")}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                    {t("corpus.import.languageHint")}
                  </p>
                  {expectedLanguages.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {expectedLanguages.map((language) => (
                        <Badge key={language} variant="outline">
                          {t(`workspaces.creation.languages.${language}`)}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </DialogBody>

        <DialogFooter>
          <Button onClick={onCancel} variant="outline">
            {t("corpus.import.confirm.cancel")}
          </Button>
          <Button disabled={!canConfirm} onClick={onConfirm}>
            {checking ? <LoaderCircle className="animate-spin" /> : null}
            {t("corpus.import.submitCount", { count: ready.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
