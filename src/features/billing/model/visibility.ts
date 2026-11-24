/*
 * Page « Facturation » (administrateurs de l'organisation) : activée par
 * VITE_BILLING_ENABLED=true, une fois la migration Stripe appliquée et l'API
 * configurée. Désactivée, ni route ni entrée dans le menu du compte.
 */
export const BILLING_PAGE_ENABLED =
  import.meta.env.VITE_BILLING_ENABLED === "true"
