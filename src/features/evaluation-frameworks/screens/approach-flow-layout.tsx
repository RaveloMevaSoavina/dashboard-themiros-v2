import { ArrowLeft, Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, Outlet, useLocation } from "react-router-dom"

import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/base/button"
import { BrandMark } from "@/shared/ui/brand-mark"

const steps = ["approach", "generation", "pillars"] as const

export function ApproachFlowLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const currentStep = pathname.endsWith("/generation")
    ? 1
    : pathname.endsWith("/pillars")
      ? 2
      : 0

  return (
    <main className="min-h-svh bg-background">
      <header className="flex h-[62px] items-center justify-between border-b border-border px-4 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-2.5" to="/workspaces">
          <BrandMark size={30} />
          <span className="text-sm font-semibold tracking-tight">
            {t("brand.name")}
          </span>
        </Link>
        <Button asChild variant="ghost">
          <Link to="/workspaces">
            <ArrowLeft />
            {t("approach.flow.exit")}
          </Link>
        </Button>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <ol
          aria-label={t("approach.flow.progress")}
          className="mb-10 grid grid-cols-3"
        >
          {steps.map((step, index) => (
            <li
              className={cn(
                "flex items-center border-b-2 pb-3 text-xs text-muted-foreground",
                index <= currentStep && "border-foreground text-foreground",
                index > currentStep && "border-border"
              )}
              key={step}
            >
              <span
                className={cn(
                  "mr-2 flex size-6 items-center justify-center rounded-full border text-[11px]",
                  index < currentStep &&
                    "border-foreground bg-foreground text-background"
                )}
              >
                {index < currentStep ? (
                  <Check className="size-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="hidden font-medium sm:inline">
                {t(`approach.flow.steps.${step}`)}
              </span>
            </li>
          ))}
        </ol>

        <Outlet />
      </div>
    </main>
  )
}
