import type { TFunction } from "i18next"

import { ApiError } from "@/shared/lib/api"

export function billingFormatters(locale: string) {
  const currency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium" })
  return {
    euros: (value: number) => currency.format(value),
    /* Dates SQL (AAAA-MM-JJ) lues à midi : pas de décalage de fuseau. */
    date: (value: string | null) =>
      value ? dates.format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "—",
  }
}

/** Message d'une erreur de l'API ou de la base, par son code métier. */
export function billingErrorMessage(t: TFunction, error: unknown) {
  // ApiError de l'API ; erreur PostgREST (objet `{ message }`) de la base.
  const code =
    error instanceof ApiError
      ? error.code
      : typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : ""
  return t(`billing.errors.${code}`, {
    defaultValue: t("billing.errors.default"),
  })
}
