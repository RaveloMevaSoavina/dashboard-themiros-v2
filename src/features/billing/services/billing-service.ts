import { toOrganizationBilling } from "@/features/billing/model/billing"
import type {
  OrganizationBilling,
  OrganizationBillingRow,
} from "@/features/billing/model/types"
import { apiDownload, apiRequest } from "@/shared/lib/api"
import { supabase } from "@/shared/lib/supabase"

async function accessToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error("NOT_AUTHENTICATED")
  return token
}

/**
 * Offre, quota et factures de l'organisation. La fonction SQL refuse les
 * comptes qui ne sont pas administrateurs (ORGANIZATION_ADMIN_REQUIRED).
 */
export async function getOrganizationBilling(): Promise<OrganizationBilling> {
  const { data, error } = await supabase.rpc("organization_billing")
  if (error) throw error
  return toOrganizationBilling(data as OrganizationBillingRow)
}

export async function updateBillingContact(contact: {
  billingEmail: string
  billingAddress: string
  vatNumber: string
}) {
  await apiRequest<{ saved: boolean }>("/api/v1/billing/contact", {
    method: "POST",
    accessToken: await accessToken(),
    body: JSON.stringify({
      billing_email: contact.billingEmail.trim() || null,
      billing_address: contact.billingAddress.trim() || null,
      vat_number: contact.vatNumber.trim() || null,
    }),
  })
}

/** Page Stripe Checkout de l'offre : le navigateur y est redirigé. */
export async function createCheckoutSession(planCode: string) {
  const { url } = await apiRequest<{ url: string }>(
    "/api/v1/billing/checkout-session",
    {
      method: "POST",
      accessToken: await accessToken(),
      body: JSON.stringify({ plan_code: planCode }),
    }
  )
  return url
}

/** Portail Stripe : moyen de paiement, factures, résiliation. */
export async function createPortalSession() {
  const { url } = await apiRequest<{ url: string }>(
    "/api/v1/billing/portal-session",
    { method: "POST", accessToken: await accessToken() }
  )
  return url
}

export async function downloadInvoicePdf(invoiceId: string, number: string) {
  const { blob, filename } = await apiDownload(
    `/api/v1/billing/invoices/${invoiceId}/pdf`,
    {
      method: "GET",
      accessToken: await accessToken(),
      fallbackName: `${number}.pdf`,
    }
  )
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
