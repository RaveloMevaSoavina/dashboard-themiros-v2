import type {
  BillingBanner,
  BillingPlan,
  OrganizationBilling,
  OrganizationBillingRow,
} from "@/features/billing/model/types"

/* PostgREST renvoie les `numeric` en chaînes : tout passe en nombre ici. */
export function toOrganizationBilling(
  row: OrganizationBillingRow
): OrganizationBilling {
  const subscription = row.subscription
  return {
    organization: {
      id: row.organization.id,
      name: row.organization.name,
      billingEmail: row.organization.billing_email,
      billingAddress: row.organization.billing_address,
      vatNumber: row.organization.vat_number,
      hasStripeCustomer: row.organization.has_stripe_customer,
    },
    subscription: subscription
      ? {
          id: subscription.id,
          planCode: subscription.plan_code,
          planName: subscription.plan_name,
          billingCycle: subscription.billing_cycle,
          status: subscription.status,
          source: subscription.source,
          priceEur: Number(subscription.price_eur),
          evaluationsIncluded: subscription.evaluations_included,
          evaluationsUsed: Number(subscription.evaluations_used),
          startsOn: subscription.starts_on,
          endsOn: subscription.ends_on,
          autoRenew: subscription.auto_renew,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        }
      : null,
    plans: row.plans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      billingCycle: plan.billing_cycle,
      listPriceEur:
        plan.list_price_eur === null ? null : Number(plan.list_price_eur),
      evaluationsIncluded: plan.evaluations_included,
      selfServe: plan.self_serve,
    })),
    invoices: row.invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      label: invoice.label,
      amountEur: Number(invoice.amount_eur),
      vatRate: Number(invoice.vat_rate),
      taxEur: Number(invoice.tax_eur),
      totalEur: Number(invoice.total_eur),
      status: invoice.status,
      overdue: invoice.overdue,
      issuedOn: invoice.issued_on,
      dueOn: invoice.due_on,
      paidOn: invoice.paid_on,
      source: invoice.source,
    })),
  }
}

/** L'abonnement en ligne est actif : le retour de Checkout est confirmé. */
export function hasLiveStripeSubscription(billing: OrganizationBilling) {
  const subscription = billing.subscription
  return (
    subscription !== null &&
    subscription.source === "stripe" &&
    subscription.status !== "canceled"
  )
}

/**
 * Offres proposées à la souscription : sans abonnement, après une
 * résiliation, ou pendant un pilote. Un contrat en cours se modifie depuis
 * le portail (Stripe) ou avec l'équipe (contrat négocié).
 */
export function canChoosePlan(billing: OrganizationBilling) {
  const subscription = billing.subscription
  return (
    subscription === null ||
    subscription.status === "canceled" ||
    (subscription.source === "manual" && subscription.status === "trialing")
  )
}

export function planOptions(billing: OrganizationBilling): {
  selfServe: BillingPlan[]
  onRequest: BillingPlan[]
} {
  const annual = billing.plans.filter((plan) => plan.billingCycle === "annual")
  return {
    selfServe: annual.filter((plan) => plan.selfServe),
    onRequest: annual.filter((plan) => !plan.selfServe),
  }
}

/** Part du quota consommée, entre 0 et 1 ; `null` si non plafonné. */
export function quotaRatio(used: number, included: number | null) {
  if (included === null) return null
  if (included <= 0) return used > 0 ? 1 : 0
  return Math.min(1, used / included)
}

/**
 * Bandeau en tête de page. Le retour de Checkout précède souvent le
 * webhook : tant que l'abonnement n'apparaît pas, la page patiente.
 */
export function billingBanner(
  billing: OrganizationBilling,
  checkout: string | null
): BillingBanner | null {
  if (checkout === "success" && !hasLiveStripeSubscription(billing)) {
    return "checkoutPending"
  }
  if (checkout === "canceled") return "checkoutCanceled"
  const subscription = billing.subscription
  if (subscription?.status === "past_due") return "pastDue"
  if (subscription?.cancelAtPeriodEnd && subscription.status !== "canceled") {
    return "endsSoon"
  }
  return null
}
