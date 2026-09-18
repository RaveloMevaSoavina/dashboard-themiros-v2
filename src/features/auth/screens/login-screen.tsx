import { useMutation } from "@tanstack/react-query"
import { Eye, EyeOff, LoaderCircle } from "lucide-react"
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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const signInMutation = useMutation({
    mutationFn: async () => signInWithPassword(email, password),
  })

  // La langue est persistee dans localStorage par i18next : inutile de la
  // reporter sur l'URL de destination.
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
        <div className="flex flex-col items-center gap-5 text-center">
          <BrandMark size={56} />
          <h1 className="text-[28px] font-semibold leading-none tracking-tight">
            {t("brand.name")}
          </h1>
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
            <div className="relative">
              <Input
                autoComplete="current-password"
                // Reserve la place du bouton pour que le texte saisi ne
                // passe jamais dessous.
                className="h-10 pr-10"
                id="password"
                onChange={(event) => {
                  setPassword(event.target.value)
                }}
                placeholder={t("auth.login.passwordPlaceholder")}
                required
                type={isPasswordVisible ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={
                  isPasswordVisible
                    ? t("auth.login.hidePassword")
                    : t("auth.login.showPassword")
                }
                aria-pressed={isPasswordVisible}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => {
                  setIsPasswordVisible((visible) => !visible)
                }}
                // `tabIndex={-1}` : au clavier on passe du mot de passe
                // directement au bouton de connexion.
                tabIndex={-1}
                type="button"
              >
                {isPasswordVisible ? (
                  <EyeOff aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Eye aria-hidden="true" className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          {errorMessage ? (
            <p className="text-[13px] text-foreground">{errorMessage}</p>
          ) : null}
          <Button
            className="h-11 w-full text-[15px] font-semibold"
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
