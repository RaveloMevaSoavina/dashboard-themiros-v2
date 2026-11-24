import assert from "node:assert/strict"
import test from "node:test"
import {
  billingBanner,
  canChoosePlan,
  planOptions,
  quotaRatio,
  toOrganizationBilling,
} from "./billing.ts"
import type { OrganizationBilling, OrganizationBillingRow } from "./types.ts"

const row: OrganizationBillingRow = {
  organization: {
    id: "org",
    name: "Organisation cliente",
    billing_email: "compta@client.org",
    billing_address: null,
    vat_number: null,
    has_stripe_customer: true,
  },
  subscription: {
    id: "sub",
    plan_code: "essential",
    plan_name: "Essentiel",
    billing_cycle: "annual",
    status: "active",
    source: "stripe",
    price_eur: "4080.00",
    evaluations_included: 15,
    evaluations_used: "3",
    starts_on: "2026-11-23",
    ends_on: "2027-11-23",
    auto_renew: true,
    cancel_at_period_end: false,
  },
  plans: [
    {
      code: "essential",
      name: "Essentiel",
      billing_cycle: "annual",
      list_price_eur: "4080.00",
      evaluations_included: 15,
      self_serve: true,
    },
    {
      code: "bespoke",
      name: "Sur mesure",
      billing_cycle: "annual",
      list_price_eur: null,
      evaluations_included: null,
      self_serve: false,
    },
    {
      code: "pilot",
      name: "Pilote",
      billing_cycle: "one_off",
      list_price_eur: null,
      evaluations_included: null,
      self_serve: false,
    },
  ],
  invoices: [
    {
      id: "i",
      number: "THS-0001",
      label: "Abonnement",
      amount_eur: "4080.00",
      vat_rate: "20.00",
      tax_eur: "816.00",
      total_eur: "4896.00",
      status: "paid",
      overdue: false,
      issued_on: "2026-11-23",
      due_on: "2026-11-23",
      paid_on: "2026-11-23",
      source: "stripe",
    },
  ],
}

function billing(
  subscription: Partial<NonNullable<OrganizationBilling["subscription"]>> | null
): OrganizationBilling {
  const base = toOrganizationBilling(row)
  return {
    ...base,
    subscription:
      subscription === null
        ? null
        : {
            ...(base.subscription as NonNullable<typeof base.subscription>),
            ...subscription,
          },
  }
}

test("les montants et compteurs reçus en chaînes deviennent des nombres", () => {
  const value = toOrganizationBilling(row)
  assert.equal(value.subscription?.priceEur, 4080)
  assert.equal(value.subscription?.evaluationsUsed, 3)
  assert.equal(value.invoices[0]?.totalEur, 4896)
  assert.equal(value.plans[1]?.listPriceEur, null)
})

test("le retour de Checkout patiente jusqu'à l'abonnement Stripe", () => {
  assert.equal(billingBanner(billing(null), "success"), "checkoutPending")
  assert.equal(
    billingBanner(billing({ source: "manual", status: "trialing" }), "success"),
    "checkoutPending"
  )
  assert.equal(billingBanner(billing({}), "success"), null)
  assert.equal(billingBanner(billing(null), "canceled"), "checkoutCanceled")
})

test("un impayé et une résiliation programmée se signalent", () => {
  assert.equal(billingBanner(billing({ status: "past_due" }), null), "pastDue")
  assert.equal(
    billingBanner(billing({ cancelAtPeriodEnd: true }), null),
    "endsSoon"
  )
  assert.equal(
    billingBanner(
      billing({ cancelAtPeriodEnd: true, status: "canceled" }),
      null
    ),
    null
  )
})

test("les offres ne se proposent que sans contrat en cours ou pendant un pilote", () => {
  assert.equal(canChoosePlan(billing(null)), true)
  assert.equal(canChoosePlan(billing({ status: "canceled" })), true)
  assert.equal(
    canChoosePlan(billing({ source: "manual", status: "trialing" })),
    true
  )
  assert.equal(canChoosePlan(billing({})), false)
  assert.equal(canChoosePlan(billing({ source: "manual" })), false)
})

test("seules les offres annuelles sont proposées, en ligne ou sur devis", () => {
  const options = planOptions(toOrganizationBilling(row))
  assert.deepEqual(
    options.selfServe.map((plan) => plan.code),
    ["essential"]
  )
  assert.deepEqual(
    options.onRequest.map((plan) => plan.code),
    ["bespoke"]
  )
})

test("le quota consommé est borné à 100 %", () => {
  assert.equal(quotaRatio(3, 15), 0.2)
  assert.equal(quotaRatio(20, 15), 1)
  assert.equal(quotaRatio(5, null), null)
  assert.equal(quotaRatio(0, 0), 0)
})
