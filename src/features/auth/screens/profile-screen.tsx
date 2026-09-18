import { useTranslation } from "react-i18next"

import { useAuth } from "@/features/auth/model/auth-provider"

export function ProfileScreen() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const metadata = session?.user.user_metadata
  const email = session?.user.email ?? ""
  const accountName =
    metadata?.full_name ??
    metadata?.name ??
    metadata?.display_name ??
    email.split("@")[0]
  const name = accountName || t("account.fallbackName")

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {t("account.profile")}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{name}</h1>
      <div className="mt-8 rounded-xl border border-border p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t("account.email")}
        </p>
        <p className="mt-2 text-sm">{email}</p>
      </div>
    </div>
  )
}
