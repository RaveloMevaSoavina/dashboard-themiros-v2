export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled"
export type InvoiceStatus = "issued" | "paid" | "void"
export type BillingSource = "manual" | "stripe"
export type BillingCycle = "annual" | "one_off"

export type BillingOrganization = {
  id: string
  name: string
  billingEmail: string | null
  billingAddress: string | null
  vatNumber: string | null
  hasStripeCustomer: boolean
}

export type BillingSubscription = {
  id: string
  planCode: string
  planName: string
  billingCycle: BillingCycle
  status: SubscriptionStatus
  source: BillingSource
  priceEur: number
  /** `null` : volume non plafonné (sur mesure). */
  evaluationsIncluded: number | null
  evaluationsUsed: number
  startsOn: string
  endsOn: string
  autoRenew: boolean
  cancelAtPeriodEnd: boolean
}

export type BillingPlan = {
  code: string
  name: string
  billingCycle: BillingCycle
  /** Prix catalogue HT ; `null` : sur devis. */
  listPriceEur: number | null
  evaluationsIncluded: number | null
  selfServe: boolean
}

export type BillingInvoice = {
  id: string
  number: string
  label: string
  amountEur: number
  vatRate: number
  taxEur: number
  totalEur: number
  status: InvoiceStatus
  overdue: boolean
  issuedOn: string
  dueOn: string | null
  paidOn: string | null
  source: BillingSource
}

export type OrganizationBilling = {
  organization: BillingOrganization
  /** Abonnement en cours, à défaut le dernier résilié ; `null` : aucun. */
  subscription: BillingSubscription | null
  plans: BillingPlan[]
  invoices: BillingInvoice[]
}

/** Réponse brute de la fonction SQL `organization_billing()`. */
export type OrganizationBillingRow = {
  organization: {
    id: string
    name: string
    billing_email: string | null
    billing_address: string | null
    vat_number: string | null
    has_stripe_customer: boolean
  }
  subscription: {
    id: string
    plan_code: string
    plan_name: string
    billing_cycle: BillingCycle
    status: SubscriptionStatus
    source: BillingSource
    price_eur: number | string
    evaluations_included: number | null
    evaluations_used: number | string
    starts_on: string
    ends_on: string
    auto_renew: boolean
    cancel_at_period_end: boolean
  } | null
  plans: {
    code: string
    name: string
    billing_cycle: BillingCycle
    list_price_eur: number | string | null
    evaluations_included: number | null
    self_serve: boolean
  }[]
  invoices: {
    id: string
    number: string
    label: string
    amount_eur: number | string
    vat_rate: number | string
    tax_eur: number | string
    total_eur: number | string
    status: InvoiceStatus
    overdue: boolean
    issued_on: string
    due_on: string | null
    paid_on: string | null
    source: BillingSource
  }[]
}

export type BillingBanner =
  | "checkoutPending"
  | "checkoutCanceled"
  | "pastDue"
  | "endsSoon"
