import { useTranslation } from "react-i18next"

import {
  type DocumentCategory,
  documentCategories,
} from "@/features/corpus/model/types"
import { cn } from "@/shared/lib/utils"

/** RG-4.3 : une seule catégorie documentaire, sans sous-catégories. */
export function DocumentCategoryField({
  value,
  onChange,
  label,
  description,
  disabled = false,
}: {
  value: DocumentCategory
  onChange: (value: DocumentCategory) => void
  label?: string
  description?: string
  disabled?: boolean
}) {
  const { t } = useTranslation()

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">
        {label ?? t("corpus.import.category")}
      </legend>
      {description ? (
        <p className="text-[11px] leading-4 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {documentCategories.map((category) => (
        <label
          className={cn(
            "flex cursor-pointer gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/40 has-disabled:cursor-not-allowed has-disabled:opacity-60",
            value === category && "border-foreground bg-muted/40"
          )}
          key={category}
        >
          <input
            checked={value === category}
            className="mt-0.5 size-4 accent-foreground"
            name="document-category"
            onChange={() => onChange(category)}
            type="radio"
            value={category}
          />
          <span>
            <span className="block text-[13px] font-medium">
              {t(`corpus.category.${category}`)}
            </span>
            <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
              {t(`corpus.import.categoryHint.${category}`)}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}
