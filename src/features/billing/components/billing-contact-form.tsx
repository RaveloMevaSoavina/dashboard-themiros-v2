import { useTranslation } from "react-i18next"

import type { BillingOrganization } from "@/features/billing/model/types"
import { Input } from "@/shared/ui/base/input"
import { Label } from "@/shared/ui/base/label"

/**
 * Coordonnées de facturation, en lecture seule : elles viennent de Stripe
 * (saisies au paiement, modifiables depuis « Gérer le paiement ») ou, sans
 * client Stripe, de l'équipe Themiros.
 */
export function BillingContactForm({
  organization,
}: {
  organization: BillingOrganization
}) {
  const { t } = useTranslation()
  const address = organization.billingAddress ?? ""

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {t("billing.contact.title")}
      </h2>
      <div className="mt-3 grid gap-4 rounded-xl border border-border p-5">
        <div className="grid gap-1.5">
          <Label htmlFor="billing-email">{t("billing.contact.email")}</Label>
          <Input
            disabled
            id="billing-email"
            readOnly
            type="email"
            value={organization.billingEmail ?? ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="billing-address">
            {t("billing.contact.address")}
          </Label>
          {/* Une ligne par élément (rue, complément, code postal et ville,
              pays) : la hauteur suit le nombre de lignes. */}
          <textarea
            className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm leading-6 outline-none disabled:opacity-50"
            disabled
            id="billing-address"
            readOnly
            rows={Math.max(3, address.split("\n").length)}
            value={address}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="billing-vat">{t("billing.contact.vat")}</Label>
          <Input
            disabled
            id="billing-vat"
            readOnly
            value={organization.vatNumber ?? ""}
          />
        </div>
        <p className="text-[12px] text-muted-foreground">
          {organization.hasStripeCustomer
            ? t("billing.contact.managedByStripe")
            : t("billing.contact.managedByTeam")}
        </p>
      </div>
    </section>
  )
}
