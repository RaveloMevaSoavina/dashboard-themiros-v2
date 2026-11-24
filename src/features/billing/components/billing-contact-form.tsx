import { type FormEvent, useState } from "react"
import { useTranslation } from "react-i18next"

import type { BillingOrganization } from "@/features/billing/model/types"
import { Button } from "@/shared/ui/base/button"
import { Input } from "@/shared/ui/base/input"
import { Label } from "@/shared/ui/base/label"

type Contact = {
  billingEmail: string
  billingAddress: string
  vatNumber: string
}

/** Remonté (key) à chaque nouvelle lecture : les champs repartent des
    valeurs enregistrées. */
export function BillingContactForm({
  organization,
  saving,
  onSave,
}: {
  organization: BillingOrganization
  saving: boolean
  onSave: (contact: Contact) => void
}) {
  const { t } = useTranslation()
  const [contact, setContact] = useState<Contact>({
    billingEmail: organization.billingEmail ?? "",
    billingAddress: organization.billingAddress ?? "",
    vatNumber: organization.vatNumber ?? "",
  })

  function update(field: keyof Contact, value: string) {
    setContact((current) => ({ ...current, [field]: value }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    onSave(contact)
  }

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {t("billing.contact.title")}
      </h2>
      <form
        className="mt-3 grid gap-4 rounded-xl border border-border p-5"
        onSubmit={submit}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="billing-email">{t("billing.contact.email")}</Label>
          <Input
            autoComplete="email"
            id="billing-email"
            onChange={(event) => {
              update("billingEmail", event.target.value)
            }}
            type="email"
            value={contact.billingEmail}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="billing-address">
            {t("billing.contact.address")}
          </Label>
          <textarea
            className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            disabled={organization.hasStripeCustomer}
            id="billing-address"
            onChange={(event) => {
              update("billingAddress", event.target.value)
            }}
            value={contact.billingAddress}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="billing-vat">{t("billing.contact.vat")}</Label>
          <Input
            disabled={organization.hasStripeCustomer}
            id="billing-vat"
            onChange={(event) => {
              update("vatNumber", event.target.value)
            }}
            value={contact.vatNumber}
          />
        </div>
        {organization.hasStripeCustomer ? (
          <p className="text-[12px] text-muted-foreground">
            {t("billing.contact.managedByStripe")}
          </p>
        ) : null}
        <div>
          <Button disabled={saving} size="sm" type="submit">
            {saving ? t("billing.contact.saving") : t("billing.contact.save")}
          </Button>
        </div>
      </form>
    </section>
  )
}
