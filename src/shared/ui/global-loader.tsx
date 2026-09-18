import { useEffect, useState } from "react"

import { BrandMark } from "@/shared/ui/brand-mark"

type GlobalLoaderProps = {
  eyebrow?: string
  message: string
  steps?: string[]
  submessage?: string
}

export function GlobalLoader({
  eyebrow = "Themiros",
  message,
  steps = [
    "Préparation de l'espace de travail...",
    "Chargement de l'organisation...",
    "Vérification des accès...",
    "Synchronisation des modules...",
  ],
  submessage,
}: GlobalLoaderProps) {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    if (steps.length <= 1) {
      return
    }

    const intervalId = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % steps.length)
    }, 1400)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [steps])

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-24">
      <section className="w-full max-w-xl">
        <div className="flex flex-col items-center gap-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </p>

          <div className="relative">
            <div className="absolute inset-[-12px] rounded-[1.4rem] border border-border animate-[loader-orbit_2.4s_ease-in-out_infinite]" />
            <div className="absolute inset-[-22px] rounded-[1.8rem] border border-border animate-[loader-orbit_2.4s_ease-in-out_infinite] [animation-delay:220ms]" />
            <BrandMark className="relative z-10" size={44} />
          </div>

          <h1 className="text-xl font-semibold tracking-tight">{message}</h1>

          <div className="flex min-h-10 items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
            <p className="text-[12px] text-muted-foreground transition-opacity duration-300">
              {steps[activeStep]}
            </p>
          </div>

          {submessage ? (
            <p className="max-w-lg text-[13px] leading-6 text-muted-foreground">
              {submessage}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  )
}
