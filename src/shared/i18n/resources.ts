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
      company: { name: "EvoranQ" },
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
          policy: "Politique publique",
          program: "Programme",
          project: "Projet",
        },
        framework: {
          draft: "Cadre non validé",
          validated: "Cadre validé",
          locked: "Cadre verrouillé",
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
        access: {
          loadingEyebrow: "Espaces de travail",
          loadingTitle: "Vérification de vos espaces...",
          loadingDescription:
            "Nous préparons l'environnement associé à votre compte.",
        },
        creation: {
          eyebrow: "Nouvel espace",
          onboardingEyebrow: "Bienvenue sur Themiros",
          title: "Créer un espace de travail",
          onboardingTitle: "Configurez votre premier espace",
          description:
            "Renseignez les informations principales de l'évaluation. Vous pourrez les modifier plus tard dans les paramètres.",
          progressLabel: "Progression de la création de l'espace",
          steps: {
            1: {
              label: "Identité",
              title: "Identifiez l'espace",
              description:
                "Donnez un nom clair à l'évaluation. L'organisation est automatiquement celle liée à votre compte.",
              whyTitle: "Pourquoi cette étape ?",
              why: "L'identité de l'espace permet à votre équipe de retrouver rapidement l'évaluation, sans dupliquer les informations déjà portées par votre compte.",
              points: {
                1: "L'organisation est récupérée automatiquement depuis votre compte.",
                2: "Le nom sera visible dans la navigation, les exports et le journal.",
                3: "Le type Programme reste verrouillé pendant le MVP.",
              },
            },
            2: {
              label: "Périmètre",
              title: "Déclarez le périmètre",
              description:
                "Ces informations servent à contrôler automatiquement la pertinence des documents chargés.",
              whyTitle: "Comment ces données seront-elles utilisées ?",
              why: "Elles constituent l'empreinte sémantique de l'évaluation. Chaque document importé sera comparé à ce périmètre avant d'intégrer le corpus.",
              points: {
                1: "Le pays aide à détecter les documents hors périmètre géographique.",
                2: "Le financeur principal oriente le cadre méthodologique recommandé.",
                3: "Les thématiques et langues améliorent le contrôle de pertinence.",
              },
            },
            3: {
              label: "Cycle et versions",
              title: "Précisez le calendrier",
              description:
                "Le stade, les années et les versions permettent d'adapter l'approche d'évaluation.",
              whyTitle: "Quel impact sur l'évaluation ?",
              why: "Le cycle du programme détermine les questions pertinentes et évite d'évaluer un programme en conception comme un programme déjà clôturé.",
              points: {
                1: "Le stade et les années alimentent l'approche recommandée.",
                2: "Chaque version peut être rattachée aux documents correspondants.",
                3: "Deux versions ou plus activent automatiquement le mode comparatif.",
              },
            },
          },
          nameLabel: "Nom de l'espace",
          namePlaceholder: "Ex. Programme Santé 2026",
          nameHelp:
            "Choisissez un nom facile à identifier par les membres de votre équipe.",
          organizationLabel: "Organisation",
          organizationPlaceholder: "Ex. Ministère de la Santé",
          organizationHelp:
            "L'espace sera rattaché à l'organisation de votre compte.",
          organizationAutomatic:
            "Cette organisation provient de votre compte et sera appliquée automatiquement.",
          organizationMissing: "Aucune organisation rattachée",
          objectTypeLabel: "Type d'objet évalué",
          objectTypeHelp:
            "Choisissez le module adapté à l'objet que vous souhaitez évaluer.",
          modules: {
            program: {
              name: "Programme",
              description: "Évaluer un programme et ses différentes versions.",
            },
            project: {
              name: "Projet",
              description: "Évaluer un projet délimité dans le temps.",
            },
            policy: {
              name: "Politique",
              description: "Évaluer une politique publique ou une stratégie.",
            },
          },
          comingSoon: "À venir",
          countryLabel: "Pays cible",
          countryPlaceholder: "Sélectionnez un pays",
          financiersLabel: "Financeurs ou cadres de référence",
          financiersHelp:
            "Sélectionnez le bouton radio du financeur principal.",
          financierPlaceholder: "Ex. FIDA, AFD, Banque mondiale",
          principal: "Définir comme financeur principal",
          addFinancier: "Ajouter un financeur",
          remove: "Supprimer",
          themesLabel: "Thématiques principales",
          themes: {
            agriculture: "Agriculture",
            water: "Eau",
            nature: "Solutions fondées sur la nature",
            gender: "Genre",
            energy: "Énergie",
          },
          languagesLabel: "Langues attendues",
          languages: {
            fr: "Français",
            en: "Anglais",
            pt: "Portugais",
            es: "Espagnol",
          },
          stageLabel: "Stade déclaré",
          stages: {
            design: "Conception",
            startup: "Démarrage",
            implementation: "Mise en œuvre",
            closing: "Clôture",
            closed: "Clos",
          },
          startYearLabel: "Année de début",
          endYearLabel: "Année de fin",
          versionsLabel: "Versions du programme",
          versionsHelp:
            "Ajoutez au moins une version. Deux versions activent le mode comparatif.",
          versionPlaceholder: "Ex. ProDoc initial",
          versionYear: "Année de la version",
          addVersion: "Ajouter une version",
          previous: "Précédent",
          next: "Continuer",
          validation: {
            identity: "Renseignez le nom de l'espace.",
            organizationMissing:
              "Votre compte doit être rattaché à une organisation avant de créer un espace.",
            fingerprint:
              "Renseignez le pays, les financeurs, une thématique et une langue au minimum.",
            timeline:
              "Vérifiez le stade, les années et chaque version du programme.",
          },
          summary: {
            eyebrow: "Récapitulatif",
            mainFinancier: "Financeur principal",
            principal: "principal",
            period: "Période",
          },
          generation: {
            eyebrow: "Préparation du cadre",
            title: "Tout est prêt pour la génération",
            description:
              "Vérifiez le récapitulatif, puis lancez la préparation du cadre. Le moteur construira des piliers adaptés au contexte déclaré.",
            completeTitle: "Les piliers sont prêts",
            completeDescription:
              "Le cadre initial a été généré. Vous pouvez maintenant ouvrir l'espace pour vérifier et ajuster les piliers proposés.",
            launch: "Lancer la génération",
            running: "Génération en cours...",
            retry: "Réessayer",
            edit: "Modifier les informations",
            openWorkspace: "Ouvrir l'espace",
            error:
              "La génération n'a pas abouti. Vous pouvez la relancer sans perdre les informations saisies.",
            steps: {
              workspace: {
                title: "Création de l'espace",
                description:
                  "Enregistrement du workspace et de ses paramètres.",
              },
              fingerprint: {
                title: "Consolidation de l'empreinte",
                description:
                  "Pays, financeurs, thématiques, langues et cycle sont structurés.",
              },
              queue: {
                title: "Préparation de la génération",
                description:
                  "Le contexte est transmis au moteur de génération.",
              },
              pillars: {
                title: "Génération des piliers",
                description:
                  "Le moteur prépare 5 à 8 piliers adaptés à votre programme.",
              },
            },
          },
          optional: "(facultatif)",
          submit: "Créer l'espace",
          submitting: "Création...",
          cancel: "Annuler",
          back: "Retour aux espaces",
          success: "Espace de travail créé.",
          error:
            "Impossible de créer l'espace. Vérifiez les informations et réessayez.",
        },
        error: {
          title: "Vos espaces sont indisponibles",
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
      company: { name: "EvoranQ" },
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
          policy: "Policy",
          program: "Programme",
          project: "Project",
        },
        framework: {
          draft: "Framework not validated",
          validated: "Framework validated",
          locked: "Framework locked",
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
        access: {
          loadingEyebrow: "Workspaces",
          loadingTitle: "Checking your workspaces...",
          loadingDescription:
            "We are preparing the environment linked to your account.",
        },
        creation: {
          eyebrow: "New workspace",
          onboardingEyebrow: "Welcome to Themiros",
          title: "Create a workspace",
          onboardingTitle: "Set up your first workspace",
          description:
            "Enter the main evaluation details. You can change them later in settings.",
          progressLabel: "Workspace creation progress",
          steps: {
            1: {
              label: "Identity",
              title: "Identify the workspace",
              description:
                "Give the evaluation a clear name. The organization is automatically inherited from your account.",
              whyTitle: "Why this step?",
              why: "The workspace identity helps your team find the evaluation without duplicating information already held by your account.",
              points: {
                1: "The organization is retrieved automatically from your account.",
                2: "The name appears in navigation, exports and the audit log.",
                3: "Programme remains the only object type available in the MVP.",
              },
            },
            2: {
              label: "Scope",
              title: "Define the scope",
              description:
                "This information is used to automatically check the relevance of uploaded documents.",
              whyTitle: "How will this information be used?",
              why: "It forms the evaluation's semantic fingerprint. Every imported document is compared with this scope before entering the corpus.",
              points: {
                1: "The country helps detect documents outside the geographical scope.",
                2: "The main funder guides the recommended methodological framework.",
                3: "Themes and languages improve relevance checks.",
              },
            },
            3: {
              label: "Cycle and versions",
              title: "Set the timeline",
              description:
                "The stage, years and versions help tailor the evaluation approach.",
              whyTitle: "How does this affect the evaluation?",
              why: "The programme cycle determines which questions are relevant and prevents a programme in design from being assessed like a closed programme.",
              points: {
                1: "The stage and years inform the recommended approach.",
                2: "Each version can be linked to its corresponding documents.",
                3: "Two or more versions automatically enable comparison mode.",
              },
            },
          },
          nameLabel: "Workspace name",
          namePlaceholder: "E.g. Health Programme 2026",
          nameHelp: "Choose a name that your team members can easily identify.",
          organizationLabel: "Organization",
          organizationPlaceholder: "E.g. Ministry of Health",
          organizationHelp:
            "The workspace will be linked to your account organization.",
          organizationAutomatic:
            "This organization comes from your account and is applied automatically.",
          organizationMissing: "No organization linked",
          objectTypeLabel: "Evaluated object type",
          objectTypeHelp:
            "Choose the module that matches the object to assess.",
          modules: {
            program: {
              name: "Programme",
              description: "Assess a programme and its different versions.",
            },
            project: {
              name: "Project",
              description: "Assess a project with a defined timeline.",
            },
            policy: {
              name: "Policy",
              description: "Assess a public policy or strategy.",
            },
          },
          comingSoon: "Coming soon",
          countryLabel: "Target country",
          countryPlaceholder: "Select a country",
          financiersLabel: "Funders or reference frameworks",
          financiersHelp: "Use the radio button to select the main funder.",
          financierPlaceholder: "E.g. IFAD, AFD, World Bank",
          principal: "Set as main funder",
          addFinancier: "Add a funder",
          remove: "Remove",
          themesLabel: "Main themes",
          themes: {
            agriculture: "Agriculture",
            water: "Water",
            nature: "Nature-based solutions",
            gender: "Gender",
            energy: "Energy",
          },
          languagesLabel: "Expected languages",
          languages: {
            fr: "French",
            en: "English",
            pt: "Portuguese",
            es: "Spanish",
          },
          stageLabel: "Declared stage",
          stages: {
            design: "Design",
            startup: "Start-up",
            implementation: "Implementation",
            closing: "Closing",
            closed: "Closed",
          },
          startYearLabel: "Start year",
          endYearLabel: "End year",
          versionsLabel: "Programme versions",
          versionsHelp:
            "Add at least one version. Two versions enable comparison mode.",
          versionPlaceholder: "E.g. Initial programme document",
          versionYear: "Version year",
          addVersion: "Add a version",
          previous: "Previous",
          next: "Continue",
          validation: {
            identity: "Enter the workspace name.",
            organizationMissing:
              "Your account must be linked to an organization before creating a workspace.",
            fingerprint:
              "Enter the country, funders, at least one theme and one language.",
            timeline: "Check the stage, years and every programme version.",
          },
          summary: {
            eyebrow: "Summary",
            mainFinancier: "Main funder",
            principal: "main",
            period: "Period",
          },
          generation: {
            eyebrow: "Framework preparation",
            title: "Everything is ready for generation",
            description:
              "Review the summary, then start preparing the framework. The engine will build pillars tailored to the declared context.",
            completeTitle: "The pillars are ready",
            completeDescription:
              "The initial framework has been generated. You can now open the workspace to review and adjust the proposed pillars.",
            launch: "Start generation",
            running: "Generating...",
            retry: "Try again",
            edit: "Edit information",
            openWorkspace: "Open workspace",
            error:
              "Generation did not complete. You can restart it without losing the entered information.",
            steps: {
              workspace: {
                title: "Workspace creation",
                description: "Saving the workspace and its settings.",
              },
              fingerprint: {
                title: "Semantic fingerprint consolidation",
                description:
                  "Country, funders, themes, languages and cycle are structured.",
              },
              queue: {
                title: "Generation preparation",
                description: "The context is passed to the generation engine.",
              },
              pillars: {
                title: "Pillar generation",
                description:
                  "The engine prepares 5 to 8 pillars tailored to your programme.",
              },
            },
          },
          optional: "(optional)",
          submit: "Create workspace",
          submitting: "Creating...",
          cancel: "Cancel",
          back: "Back to workspaces",
          success: "Workspace created.",
          error:
            "Unable to create the workspace. Check the details and try again.",
        },
        error: {
          title: "Your workspaces are unavailable",
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
