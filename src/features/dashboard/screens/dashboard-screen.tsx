import { useTranslation } from "react-i18next"

import { useAuth } from "@/features/auth/model/auth-provider"
import { Button } from "@/shared/ui/base/button"
import { BrandMark } from "@/shared/ui/brand-mark"

export function DashboardScreen() {
  const { t } = useTranslation()
  const { session, signOut } = useAuth()

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-[62px] w-full max-w-5xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2.5">
            <BrandMark size={22} />
            <span className="text-[13px] font-semibold">{t("brand.name")}</span>
          </div>
          <Button
            className="h-9 text-[13px]"
            onClick={() => {
              void signOut()
            }}
            variant="outline"
          >
            {t("auth.logout")}
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("dashboard.title")}
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          {t("dashboard.welcome", { email: session?.user.email ?? "" })}
        </h1>
        <p className="mt-3 max-w-xl text-[13px] text-muted-foreground">
          {t("dashboard.description")}
        </p>

        <div className="mt-10 border-t border-border pt-5">
          <p className="text-[12px] text-muted-foreground">
            {session?.user.id}
          </p>
        </div>
      </main>
    </div>
  )
}
