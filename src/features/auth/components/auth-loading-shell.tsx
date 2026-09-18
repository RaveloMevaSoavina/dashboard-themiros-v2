import { GlobalLoader } from "@/shared/ui/global-loader"

type AuthLoadingShellProps = {
  variant?: "app" | "auth"
}

export function AuthLoadingShell({ variant = "app" }: AuthLoadingShellProps) {
  if (variant === "auth") {
    return (
      <GlobalLoader
        eyebrow="Authentification"
        message="Préparation de l'accès sécurisé"
        submessage="Nous restaurons votre session avant d'ouvrir la connexion."
      />
    )
  }

  return (
    <GlobalLoader
      eyebrow="Espace de travail"
      message="Chargement de votre environnement..."
      submessage="Nous synchronisons votre profil et vos accès avant d'ouvrir l'application."
    />
  )
}
