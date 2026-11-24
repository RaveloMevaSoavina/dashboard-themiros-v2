import { ExternalLink } from "lucide-react"
import { useTranslation } from "react-i18next"

import { quotaRatio } from "@/features/billing/model/billing"
import { billingFormatters } from "@/features/billing/model/format"
import type { BillingSubscription } from "@/features/billing/model/types"
import { Badge } from "@/shared/ui/base/badge"
import { Button } from "@/shared/ui/base/button"

export function CurrentPlanCard({
  subscription,
  canOpenPortal,
  openingPortal,
  onOpenPortal,
}: {
  subscription: BillingSubscription | null
  canOpenPortal: boolean
  openingPortal: boolean
  onOpenPortal: () => void
}) {
  const { i18n, t } = useTranslation()
  const format = billingFormatters(i18n.resolvedLanguage ?? "fr")

  if (!subscription) {
    return (
      <section className="rounded-xl border border-border p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t("billing.plan.title")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("billing.plan.none")}
        </p>
      </section>
    )
  }

  const ratio = quotaRatio(
    subscription.evaluationsUsed,
    subscription.evaluationsIncluded
  )

  return (
    <section className="rounded-xl border border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t("billing.plan.title")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              {subscription.planName}
            </h2>
            <Badge
              variant={
                subscription.status === "past_due" ? "warning" : "outline"
              }
            >
              {t(`billing.status.${subscription.status}`)}
            </Badge>
            <Badge variant="secondary">
              {t(`billing.source.${subscription.source}`)}
            </Badge>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t("billing.plan.period", {
              start: format.date(subscription.startsOn),
              end: format.date(subscription.endsOn),
            })}
            {" · "}
            {t("billing.plan.price", {
              amount: format.euros(subscription.priceEur),
            })}
            {subscription.status !== "canceled"
              ? ` · ${
                  subscription.cancelAtPeriodEnd || !subscription.autoRenew
                    ? t("billing.plan.noRenewal")
                    : t("billing.plan.renewal")
                }`
              : null}
          </p>
        </div>
        {canOpenPortal ? (
          <Button
            disabled={openingPortal}
            onClick={onOpenPortal}
            size="sm"
            variant="outline"
          >
            <ExternalLink />
            {t("billing.plan.manage")}
          </Button>
        ) : null}
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="font-medium">{t("billing.quota.title")}</span>
          <span className="tabular-nums text-muted-foreground">
            {subscription.evaluationsIncluded === null
              ? t("billing.quota.unlimited", {
                  used: subscription.evaluationsUsed,
                })
              : t("billing.quota.usage", {
                  used: subscription.evaluationsUsed,
                  included: subscription.evaluationsIncluded,
                })}
          </span>
        </div>
        {ratio !== null ? (
          <div
            aria-label={t("billing.quota.title")}
            aria-valuemax={subscription.evaluationsIncluded ?? undefined}
            aria-valuemin={0}
            aria-valuenow={subscription.evaluationsUsed}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-foreground transition-[width]"
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </div>
        ) : null}
        <p className="mt-2 text-[12px] text-muted-foreground">
          {t("billing.quota.hint")}
        </p>
      </div>
    </section>
  )
}
