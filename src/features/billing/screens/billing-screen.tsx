import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { BillingContactForm } from "@/features/billing/components/billing-contact-form"
import { CurrentPlanCard } from "@/features/billing/components/current-plan-card"
import { InvoicesTable } from "@/features/billing/components/invoices-table"
import { PlanPicker } from "@/features/billing/components/plan-picker"
import {
  billingBanner,
  canChoosePlan,
  hasLiveStripeSubscription,
  planOptions,
} from "@/features/billing/model/billing"
import {
  billingErrorMessage,
  billingFormatters,
} from "@/features/billing/model/format"
import type { BillingInvoice } from "@/features/billing/model/types"
import {
  createCheckoutSession,
  createPortalSession,
  downloadInvoicePdf,
  getOrganizationBilling,
} from "@/features/billing/services/billing-service"
import { CorpusPageHeader } from "@/features/corpus/components/corpus-page-header"
import { useWorkspaces } from "@/features/workspaces/model/workspace-provider"
import { Skeleton } from "@/shared/ui/base/skeleton"

export const billingQueryKey = ["billing", "organization"] as const

/* Le webhook Stripe suit de peu le retour de Checkout : la page relit
   l'abonnement toutes les 2 s, 30 s au plus. */
const checkoutPollMs = 2_000
const checkoutPollLimitMs = 30_000

/**
 * Facturation de l'organisation, ouverte depuis le menu du compte et
 * réservée à ses administrateurs : offre et quota, souscription en ligne
 * (Stripe Checkout), portail de paiement, factures et coordonnées.
 */
export function BillingScreen() {
  const { i18n, t } = useTranslation()
  const format = billingFormatters(i18n.resolvedLanguage ?? "fr")
  const { isOrganizationAdmin, isLoading: accountLoading } = useWorkspaces()
  const [searchParams, setSearchParams] = useSearchParams()
  const checkout = searchParams.get("checkout")
  const [pollStartedAt] = useState(() => Date.now())

  const billing = useQuery({
    queryKey: billingQueryKey,
    queryFn: getOrganizationBilling,
    enabled: isOrganizationAdmin,
    refetchInterval: (query) => {
      const data = query.state.data
      const waiting =
        checkout === "success" &&
        (data === undefined || !hasLiveStripeSubscription(data))
      return waiting && Date.now() - pollStartedAt < checkoutPollLimitMs
        ? checkoutPollMs
        : false
    },
  })

  const data = billing.data
  const activated =
    checkout === "success" &&
    data !== undefined &&
    hasLiveStripeSubscription(data)

  // Abonnement visible : le paramètre de retour n'a plus d'objet.
  useEffect(() => {
    if (activated) {
      toast.success(t("billing.banner.activated"))
      setSearchParams({}, { replace: true })
    }
  }, [activated, setSearchParams, t])

  const redirect = (url: string) => {
    window.location.assign(url)
  }

  const subscribe = useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: redirect,
    onError: (error) => toast.error(billingErrorMessage(t, error)),
  })
  const portal = useMutation({
    mutationFn: createPortalSession,
    onSuccess: redirect,
    onError: (error) => toast.error(billingErrorMessage(t, error)),
  })
  const download = useMutation({
    mutationFn: (invoice: BillingInvoice) =>
      downloadInvoicePdf(invoice.id, invoice.number),
    onError: (error) => toast.error(billingErrorMessage(t, error)),
  })

  const header = (
    <CorpusPageHeader
      description={t("billing.description")}
      eyebrow={data?.organization.name ?? t("billing.eyebrow")}
      title={t("billing.title")}
    />
  )

  if (!accountLoading && !isOrganizationAdmin) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        {header}
        <p className="mt-8 rounded-xl border border-border p-5 text-sm text-muted-foreground">
          {t("billing.errors.ORGANIZATION_ADMIN_REQUIRED")}
        </p>
      </div>
    )
  }

  const banner = data ? billingBanner(data, checkout) : null
  const pollExpired = Date.now() - pollStartedAt >= checkoutPollLimitMs
  const options = data ? planOptions(data) : null

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      {header}

      {banner ? (
        <div
          className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-sm"
          role="status"
        >
          {banner === "checkoutPending" && pollExpired
            ? t("billing.banner.checkoutSlow")
            : t(`billing.banner.${banner}`, {
                date: format.date(data?.subscription?.endsOn ?? null),
              })}
        </div>
      ) : null}

      <div className="mt-8 grid gap-8">
        {billing.isPending ? (
          <>
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </>
        ) : billing.isError ? (
          <p className="rounded-xl border border-border p-5 text-sm text-muted-foreground">
            {billingErrorMessage(t, billing.error)}
          </p>
        ) : data && options ? (
          <>
            <CurrentPlanCard
              canOpenPortal={data.organization.hasStripeCustomer}
              onOpenPortal={() => {
                portal.mutate()
              }}
              openingPortal={portal.isPending}
              subscription={data.subscription}
            />
            {canChoosePlan(data) ? (
              <PlanPicker
                onRequest={options.onRequest}
                onSubscribe={(planCode) => {
                  subscribe.mutate(planCode)
                }}
                pendingPlan={
                  subscribe.isPending ? (subscribe.variables ?? null) : null
                }
                selfServe={options.selfServe}
              />
            ) : null}
            <InvoicesTable
              downloading={
                download.isPending ? (download.variables?.id ?? null) : null
              }
              invoices={data.invoices}
              onDownload={(invoice) => {
                download.mutate(invoice)
              }}
            />
            <BillingContactForm organization={data.organization} />
          </>
        ) : null}
      </div>
    </div>
  )
}
