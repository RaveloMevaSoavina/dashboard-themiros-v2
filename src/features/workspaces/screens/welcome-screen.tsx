import {
  ArrowRight,
  CalendarRange,
  LogOut,
  ScanSearch,
  Tag,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { useAuth } from "@/features/auth/model/auth-provider"
import { Button } from "@/shared/ui/base/button"
import { BrandMark } from "@/shared/ui/brand-mark"

/** Les trois etapes du parcours de creation, presentees en apercu. */
const creationSteps = [
  { key: "1", icon: Tag },
  { key: "2", icon: ScanSearch },
  { key: "3", icon: CalendarRange },
] as const

/** Entree en cascade : chaque bloc apparait apres le precedent. */
const reveal =
  "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-700 motion-reduce:animate-none"

/**
 * Ecran d'accueil des comptes sans espace de travail : point d'entree
 * unique avant le parcours de creation du premier espace.
 */
export function WelcomeScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session, signOut } = useAuth()

  return (
    <main className="relative isolate flex min-h-svh flex-col overflow-hidden bg-background">
      {/* Trame de fond : filets de la charte, estompes vers les bords. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[56px_56px] opacity-40 mask-[radial-gradient(ellipse_60%_50%_at_50%_38%,black,transparent)]"
      />

      <header className="flex h-[62px] items-center justify-between border-b border-border bg-background/70 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <BrandMark size={30} />
          <span className="text-sm font-semibold tracking-tight">
            {t("brand.name")}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {session?.user.email ? (
            <span className="hidden text-[12px] text-muted-foreground sm:inline">
              {session.user.email}
            </span>
          ) : null}
          <Button onClick={() => void signOut()} variant="ghost">
            <LogOut />
            {t("auth.logout")}
          </Button>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 sm:py-24">
        <div className="flex w-full max-w-3xl flex-col items-center text-center">
          <div className={`relative -mt-6 ${reveal}`}>
            <div className="absolute inset-[-14px] rounded-[1.6rem] border border-border animate-[loader-orbit_3.2s_ease-in-out_infinite] motion-reduce:animate-none" />
            <div className="absolute inset-[-28px] rounded-[2.1rem] border border-border animate-[loader-orbit_3.2s_ease-in-out_infinite] [animation-delay:320ms] motion-reduce:animate-none" />
            <BrandMark className="relative z-10" size={64} />
          </div>

          <p
            className={`mt-20 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground ${reveal} [animation-delay:120ms]`}
          >
            {t("workspaces.welcome.eyebrow")}
          </p>

          <h1
            className={`mt-4 text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl ${reveal} [animation-delay:200ms]`}
          >
            {t("workspaces.welcome.title", { brand: t("brand.name") })}
          </h1>

          <p
            className={`mt-5 max-w-xl text-balance text-[15px] leading-7 text-muted-foreground ${reveal} [animation-delay:280ms]`}
          >
            {t("workspaces.welcome.description")}
          </p>

          <ol className="mt-10 grid w-full gap-3 text-left sm:grid-cols-3">
            {creationSteps.map(({ key, icon: Icon }, index) => (
              <li
                className={`rounded-xl border border-border bg-background/80 p-5 backdrop-blur-sm transition-colors hover:bg-muted ${reveal}`}
                key={key}
                style={{ animationDelay: `${360 + index * 90}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-8 items-center justify-center rounded-lg border border-border">
                    <Icon className="size-4" />
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {`0${key}`}
                  </span>
                </div>
                <p className="mt-4 text-[13px] font-semibold">
                  {t(`workspaces.creation.steps.${key}.label`)}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                  {t(`workspaces.welcome.steps.${key}`)}
                </p>
              </li>
            ))}
          </ol>

          <div
            className={`mt-10 flex flex-col items-center gap-3 ${reveal} [animation-delay:640ms]`}
          >
            <Button
              className="group h-11 px-5 text-[14px]"
              onClick={() => {
                void navigate("/workspaces/new")
              }}
              size="lg"
            >
              {t("workspaces.welcome.action")}
              <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>
            <p className="text-[12px] text-muted-foreground">
              {t("workspaces.welcome.hint")}
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
