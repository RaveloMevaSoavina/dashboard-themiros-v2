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
      account: {
        fallbackName: "Mon compte",
        profile: "Profil",
        email: "Adresse e-mail",
        theme: {
          label: "Thème",
          dark: "Sombre",
          light: "Clair",
        },
        language: { label: "Langue" },
      },
      nav: {
        open: "Ouvrir la navigation",
        close: "Fermer la navigation",
        sections: {
          corpus: "Corpus",
          evaluation: "Évaluation",
          governance: "Gouvernance",
        },
        items: {
          workspaces: "Espaces de travail",
          corpus: "Corpus",
          import: "Import documentaire",
          documents: "Revue documentaire",
          inventory: "Masse critique",
          framework: "Cadre d'évaluation",
          pillars: "Piliers",
          criteria: "Critères et questions",
          analysis: "Analyse",
          overview: "Comparatif général",
          layerA: "Couche A · Piliers",
          layerB: "Couche B · Critères",
          layerC: "Couche C · Alertes",
          plan: "Restitution",
          synthesis: "Synthèse",
          actions: "Plan d'action",
          audit: "Journal d'audit",
          exports: "Exports",
          settings: "Paramètres",
          general: "Général",
          fingerprint: "Empreinte sémantique",
          versions: "Versions du programme",
        },
      },
      personas: {
        label: "Rôle de lecture",
        decideur: {
          name: "Décideur",
          description: "Analyse, plan d'action et exports uniquement.",
        },
        pmu: {
          name: "Chef de projet / PMU",
          description: "Pilotage complet de l'espace et du corpus.",
        },
        analyste: {
          name: "Analyste M&E / IA",
          description: "Tout le détail : critères, variables, journal.",
        },
      },
      workspaces: {
        eyebrow: "Tableau de bord",
        title: "Espaces de travail",
        create: "Créer un espace",
        objectType: {
          programme: "Programme",
        },
        framework: {
          draft: "Cadre non validé",
          validated: "Cadre validé",
        },
        card: {
          documents_one: "{{count}} document",
          documents_other: "{{count}} documents",
          noRun: "Aucune analyse",
          noOrganization: "Organisation non renseignée",
        },
        switcher: {
          label: "Vos espaces",
          none: "Aucun espace ouvert",
          selectPrompt: "Choisir un espace",
          manage: "Gérer les espaces",
        },
        empty: {
          title: "Aucun espace de travail",
          description: "Créez un espace pour lancer votre première évaluation.",
          action: "Créer votre premier espace",
        },
        error: {
          description:
            "Le chargement de vos espaces a échoué. Réessayez dans un instant.",
          retry: "Réessayer",
        },
      },
      placeholder: {
        description: "Cet écran arrive dans un prochain sprint.",
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
      account: {
        fallbackName: "My account",
        profile: "Profile",
        email: "Email address",
        theme: {
          label: "Theme",
          dark: "Dark",
          light: "Light",
        },
        language: { label: "Language" },
      },
      nav: {
        open: "Open navigation",
        close: "Close navigation",
        sections: {
          corpus: "Corpus",
          evaluation: "Evaluation",
          governance: "Governance",
        },
        items: {
          workspaces: "Workspaces",
          corpus: "Corpus",
          import: "Document import",
          documents: "Document review",
          inventory: "Critical mass",
          framework: "Evaluation framework",
          pillars: "Pillars",
          criteria: "Criteria and questions",
          analysis: "Analysis",
          overview: "General comparison",
          layerA: "Layer A · Pillars",
          layerB: "Layer B · Criteria",
          layerC: "Layer C · Alerts",
          plan: "Reporting",
          synthesis: "Synthesis",
          actions: "Action plan",
          audit: "Audit log",
          exports: "Exports",
          settings: "Settings",
          general: "General",
          fingerprint: "Semantic fingerprint",
          versions: "Programme versions",
        },
      },
      personas: {
        label: "Reading role",
        decideur: {
          name: "Decision maker",
          description: "Analysis, action plan and exports only.",
        },
        pmu: {
          name: "Project manager / PMU",
          description: "Full control of the workspace and corpus.",
        },
        analyste: {
          name: "M&E / AI analyst",
          description: "Full detail: criteria, variables, audit log.",
        },
      },
      workspaces: {
        eyebrow: "Dashboard",
        title: "Workspaces",
        create: "Create workspace",
        objectType: {
          programme: "Programme",
        },
        framework: {
          draft: "Framework not validated",
          validated: "Framework validated",
        },
        card: {
          documents_one: "{{count}} document",
          documents_other: "{{count}} documents",
          noRun: "No analysis yet",
          noOrganization: "No organization set",
        },
        switcher: {
          label: "Your workspaces",
          none: "No workspace open",
          selectPrompt: "Select a workspace",
          manage: "Manage workspaces",
        },
        empty: {
          title: "No workspace yet",
          description: "Create a workspace to start your first evaluation.",
          action: "Create your first workspace",
        },
        error: {
          description:
            "We could not load your workspaces. Please try again in a moment.",
          retry: "Retry",
        },
      },
      placeholder: {
        description: "This screen is coming in an upcoming sprint.",
      },
      footer: {
        legalNotice: "Legal notice",
        privacyPolicy: "Privacy policy",
        copyright: "All rights reserved.",
      },
    },
  },
} as const
