import { Mail } from "lucide-react"
import { useTranslation } from "react-i18next"

import { billingFormatters } from "@/features/billing/model/format"
import type { BillingPlan } from "@/features/billing/model/types"
import { Button } from "@/shared/ui/base/button"

const contactAddress = "contact@themiros.com"

export function PlanPicker({
  selfServe,
  onRequest,
  pendingPlan,
  onSubscribe,
}: {
  selfServe: BillingPlan[]
  onRequest: BillingPlan[]
  pendingPlan: string | null
  onSubscribe: (planCode: string) => void
}) {
  const { i18n, t } = useTranslation()
  const format = billingFormatters(i18n.resolvedLanguage ?? "fr")

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {t("billing.plans.title")}
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {selfServe.map((plan) => (
          <div
            className="flex flex-col rounded-xl border border-border p-5"
            key={plan.code}
          >
            <p className="font-semibold">{plan.name}</p>
            <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight">
              {plan.listPriceEur === null
                ? t("billing.plans.onQuote")
                : t("billing.plans.perYear", {
                    amount: format.euros(plan.listPriceEur),
                  })}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {plan.evaluationsIncluded === null
                ? t("billing.plans.unlimited")
                : t("billing.plans.evaluations", {
                    count: plan.evaluationsIncluded,
                  })}
            </p>
            <Button
              className="mt-5"
              disabled={pendingPlan !== null}
              onClick={() => {
                onSubscribe(plan.code)
              }}
            >
              {pendingPlan === plan.code
                ? t("billing.plans.redirecting")
                : t("billing.plans.subscribe")}
            </Button>
          </div>
        ))}
        {onRequest.map((plan) => (
          <div
            className="flex flex-col rounded-xl border border-dashed border-border p-5"
            key={plan.code}
          >
            <p className="font-semibold">{plan.name}</p>
            <p className="mt-2 text-xl font-semibold tracking-tight">
              {t("billing.plans.onQuote")}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {t("billing.plans.bespoke")}
            </p>
            <Button asChild className="mt-5" variant="outline">
              <a
                href={`mailto:${contactAddress}?subject=${encodeURIComponent(
                  t("billing.plans.contactSubject", { plan: plan.name })
                )}`}
              >
                <Mail />
                {t("billing.plans.contact")}
              </a>
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">
        {t("billing.plans.taxNote")}
      </p>
    </section>
  )
}
