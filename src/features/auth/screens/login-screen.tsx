import { useMutation } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { signInWithPassword } from "@/features/auth/services/auth-service"
import { Button } from "@/shared/ui/base/button"
import { Input } from "@/shared/ui/base/input"
import { Label } from "@/shared/ui/base/label"
import { BrandMark } from "@/shared/ui/brand-mark"

export function LoginScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const signInMutation = useMutation({
    mutationFn: async () => signInWithPassword(email, password),
  })

  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? "/dashboard"

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    try {
      await signInMutation.mutateAsync()
      toast.success(t("auth.login.success"))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("auth.login.failure")
      setErrorMessage(message)
      toast.error(message)
      return
    }

    void navigate(redirectTo, { replace: true })
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-24">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandMark size={30} />
          <h1 className="text-[15px] font-semibold tracking-tight">
            {t("brand.name")}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {t("auth.login.description")}
          </p>
        </div>

        <form
          className="mt-10 space-y-5"
          onSubmit={(event) => {
            void handleSubmit(event)
          }}
        >
          <div className="space-y-2">
            <Label
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              htmlFor="email"
            >
              {t("auth.login.emailLabel")}
            </Label>
            <Input
              autoComplete="email"
              className="h-10"
              id="email"
              onChange={(event) => {
                setEmail(event.target.value)
              }}
              placeholder={t("auth.login.emailPlaceholder")}
              required
              type="email"
              value={email}
            />
          </div>
          <div className="space-y-2">
            <Label
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              htmlFor="password"
            >
              {t("auth.login.passwordLabel")}
            </Label>
            <Input
              autoComplete="current-password"
              className="h-10"
              id="password"
              onChange={(event) => {
                setPassword(event.target.value)
              }}
              placeholder={t("auth.login.passwordPlaceholder")}
              required
              type="password"
              value={password}
            />
          </div>
          {errorMessage ? (
            <p className="text-[13px] text-foreground">{errorMessage}</p>
          ) : null}
          <Button
            className="h-10 w-full text-[13px]"
            disabled={signInMutation.isPending}
            size="lg"
            type="submit"
          >
            {signInMutation.isPending ? (
              <span className="flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                <span>{t("auth.login.submit")}</span>
              </span>
            ) : (
              t("auth.login.submit")
            )}
          </Button>
          <div className="flex justify-center">
            <button
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              type="button"
            >
              {t("auth.login.forgotPassword")}
            </button>
          </div>
        </form>
      </div>

      <p className="absolute bottom-6 text-[12px] text-muted-foreground">
        Copyright &copy; 2026 {t("brand.name")}. {t("footer.copyright")}
      </p>
    </main>
  )
}
