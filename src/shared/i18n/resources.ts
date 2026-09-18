export const fallbackLanguage = "fr"
export const defaultNamespace = "translation"
export const languageStorageKey = "themiros-language"
/** Parametre d'URL qui impose la langue, ex. /login?lang=en */
export const languageQueryParam = "lang"
export const supportedLanguages = ["fr", "en"] as const

export type SupportedLanguage = (typeof supportedLanguages)[number]

export const resources = {
  fr: {
    translation: {
      brand: { name: "Themiros" },
      auth: {
        login: {
          description: "Connectez-vous pour accéder à votre tableau de bord.",
          emailLabel: "Adresse e-mail",
          emailPlaceholder: "vous@exemple.com",
          passwordLabel: "Mot de passe",
          passwordPlaceholder: "Votre mot de passe",
          showPassword: "Afficher le mot de passe",
          hidePassword: "Masquer le mot de passe",
          submit: "Se connecter",
          forgotPassword: "Mot de passe oublié ?",
          success: "Connexion réussie.",
          failure: "Impossible de se connecter. Vérifiez vos identifiants.",
        },
        logout: "Se déconnecter",
      },
      dashboard: {
        title: "Tableau de bord",
        welcome: "Bienvenue, {{email}}",
        description:
          "Votre espace de travail est prêt. Les modules arriveront ici.",
      },
      footer: {
        legalNotice: "Mentions légales",
        privacyPolicy: "Politique de confidentialité",
        copyright: "Tous droits réservés.",
      },
    },
  },
  en: {
    translation: {
      brand: { name: "Themiros" },
      auth: {
        login: {
          description: "Sign in to access your dashboard.",
          emailLabel: "Email address",
          emailPlaceholder: "you@example.com",
          passwordLabel: "Password",
          passwordPlaceholder: "Your password",
          showPassword: "Show password",
          hidePassword: "Hide password",
          submit: "Sign in",
          forgotPassword: "Forgot password?",
          success: "Signed in successfully.",
          failure: "Unable to sign in. Please check your credentials.",
        },
        logout: "Sign out",
      },
      dashboard: {
        title: "Dashboard",
        welcome: "Welcome, {{email}}",
        description: "Your workspace is ready. Modules will appear here.",
      },
      footer: {
        legalNotice: "Legal notice",
        privacyPolicy: "Privacy policy",
        copyright: "All rights reserved.",
      },
    },
  },
} as const
