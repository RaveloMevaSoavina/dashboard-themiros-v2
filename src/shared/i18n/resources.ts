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
          approach: "Approche d'évaluation",
          recommendedApproach: "Approche recommandée",
          pillarGeneration: "Génération des piliers",
          brief: "Brief du cadre",
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
          financiersLabel: "Financeurs",
          financiersHelp:
            "Choisissez le financeur principal qui déterminera le référentiel, puis ajoutez les cofinanceurs éventuels.",
          financierSelectLabel: "Sélectionner un financeur",
          financierPlaceholder: "Sélectionnez un financeur",
          financierOptions: {
            GCF: "Fonds vert pour le climat (GCF)",
            AFD: "Agence française de développement (AFD)",
            WB: "Banque mondiale",
            FIDA: "FIDA",
            PNUD: "PNUD",
            UE: "Union européenne",
            FEM: "Fonds pour l'environnement mondial (FEM)",
            AF: "Fonds d'adaptation",
            OTHER: "Autre financeur",
          },
          otherFinancierLabel: "Nom de l'autre financeur",
          otherFinancierPlaceholder: "Saisissez le nom du financeur",
          mainFinancier: "Financeur principal",
          coFinancier: "Cofinanceur",
          principal: "Définir comme financeur principal",
          addFinancier: "Ajouter un financeur",
          addCoFinancier: "Ajouter un cofinanceur",
          remove: "Supprimer",
          themesLabel: "Thématiques principales",
          customThemeLabel: "Autre thématique principale",
          customThemePlaceholder: "Ex. Santé, éducation, gouvernance",
          addTheme: "Ajouter",
          removeTheme: "Retirer la thématique {{theme}}",
          themeAlreadyAdded: "Cette thématique a déjà été ajoutée.",
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
          stageLabel: "Phase du cycle",
          stages: {
            design: "Conception",
            pre_launch: "Avant lancement",
            implementation: "Mise en œuvre",
            mid_term: "Mi-parcours",
            closing: "Clôture",
            post_closure: "Après clôture",
            cross_cutting: "Transversal",
          },
          stageDescriptions: {
            design:
              "Évaluation ex-ante, étude de faisabilité (appraisal), étude d'impact ou analyse d'impact de la réglementation (AIR).",
            pre_launch:
              "Évaluation de l'évaluabilité ou étude de référence (baseline).",
            implementation:
              "Suivi, évaluation formative ou de processus, ou évaluation en temps réel.",
            mid_term: "Revue ou évaluation à mi-parcours.",
            closing:
              "Évaluation finale ou rapport d'achèvement, par exemple l'ICR de la Banque mondiale.",
            post_closure:
              "Évaluation ex-post, évaluation d'impact ou évaluation de la durabilité.",
            cross_cutting:
              "Évaluation transversale couvrant plusieurs phases du cycle.",
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
            eyebrow: "Finalisation",
            title: "Votre espace est prêt à être créé",
            description:
              "Vérifiez le récapitulatif, puis créez votre espace. Vous pourrez ensuite choisir l'approche d'évaluation adaptée à votre programme.",
            completeTitle: "Votre espace est prêt",
            completeDescription:
              "L'espace a été créé. Vous pouvez maintenant poursuivre la configuration de l'évaluation.",
            launch: "Créer l'espace",
            running: "Création en cours...",
            retry: "Réessayer",
            edit: "Modifier les informations",
            openWorkspace: "Ouvrir l'espace",
            error:
              "La création de l'espace n'a pas abouti. Vous pouvez réessayer sans perdre les informations saisies.",
            steps: {
              identity: {
                title: "Informations de l'espace",
                description:
                  "Le nom et l'organisation de rattachement sont définis.",
              },
              scope: {
                title: "Périmètre de l'évaluation",
                description:
                  "Le pays, les financeurs, les thématiques et les langues sont renseignés.",
              },
              timeline: {
                title: "Cycle et versions",
                description:
                  "La phase, la période et les versions du programme sont précisées.",
              },
              workspace: {
                title: "Création de l'espace",
                description:
                  "Les informations sont enregistrées avant le choix de l'approche d'évaluation.",
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
        settings: {
          eyebrow: "Paramètres du workspace",
          title: "Informations générales",
          description:
            "Modifiez l'identité, le périmètre et le cycle de cet espace de travail.",
          identityTitle: "Identité",
          identityDescription:
            "Le nom apparaît dans la navigation, les exports et le journal.",
          scopeTitle: "Périmètre",
          scopeDescription:
            "Ces informations composent l'empreinte sémantique de l'évaluation.",
          cycleTitle: "Cycle du programme",
          cycleDescription:
            "Le calendrier permet d'adapter l'approche d'évaluation.",
          adminOnly:
            "Seuls les administrateurs peuvent modifier ou supprimer ce workspace.",
          save: "Enregistrer les modifications",
          saving: "Enregistrement...",
          saveSuccess: "Les informations du workspace ont été mises à jour.",
          saveError: "Impossible d'enregistrer les modifications.",
          loadError: "Impossible de charger les informations du workspace.",
          validation:
            "Renseignez tous les champs requis et vérifiez les années.",
          dangerTitle: "Zone de danger",
          dangerDescription:
            "La suppression est définitive et efface toutes les données associées à ce workspace.",
          deleteConfirmation:
            "Saisissez « {{name}} » pour confirmer la suppression.",
          deleteAction: "Supprimer le workspace",
          cancelDelete: "Annuler",
          deleteSuccess: "Le workspace a été supprimé.",
          deleteError: "Impossible de supprimer le workspace.",
        },
        error: {
          title: "Vos espaces sont indisponibles",
          description:
            "Le chargement de vos espaces a échoué. Réessayez dans un instant.",
          retry: "Réessayer",
        },
      },
      approach: {
        flow: {
          exit: "Quitter la configuration",
          progress: "Progression de la configuration du cadre",
          steps: {
            approach: "Approche",
            generation: "Génération",
            pillars: "Validation des piliers",
          },
        },
        eyebrow: "Moteur d'évaluation",
        title: "Approche recommandée",
        description:
          "Vérifiez la méthode d'évaluation proposée pour {{workspace}}. Elle est calculée à partir des informations de l'espace et de vos réponses, sans recours à l'IA générative.",
        loading: "Calcul de l'approche recommandée...",
        error: "L'approche ne peut pas être calculée",
        retry: "Réessayer",
        recomputed: "Calcul transparent, sans IA",
        deterministic: "Règle déterministe",
        recommendationsStep: "Étape 1",
        recommendationsTitle: "Vérifiez l'approche proposée",
        recommendationsDescription:
          "Ces six recommandations définissent la manière dont l'évaluation sera conduite. Sélectionnez une carte pour comprendre son calcul.",
        recommended: "Recommandé",
        recalculated: "Recalculé",
        seeWhy: "Voir pourquoi",
        recommendationRationale: "Justification de la recommandation",
        ruleApplied: "Règle appliquée : {{rule}}",
        ruleExplanation: "Règle métier",
        ruleDescriptions: {
          framework:
            "Le financeur principal sélectionne le référentiel actif le plus récent qui lui correspond. Si aucun référentiel n'est reconnu, le référentiel Themiros est utilisé.",
          cycle:
            "La phase déclarée détermine d'abord le cycle d'évaluation. Pour une évaluation transversale, la progression entre les années de début et de fin départage en cours, mi-parcours et finale.",
          instrument:
            "Le type d'objet, l'échelle géographique, le nombre d'acteurs et le nombre de thématiques déterminent le module et le sous-type d'instrument.",
          complexity:
            "Le score additionne cinq facteurs : échelle, acteurs, thématiques, type d'objet et budget. De 0 à 3 l'approche est simple, de 4 à 6 compliquée, et de 7 à 10 complexe.",
          nature:
            "La relation de l'utilisateur à l'objet, son rôle de lecture et le nombre de financeurs déterminent si l'évaluation est une auto-évaluation, interne, externe indépendante ou conjointe.",
          method:
            "Le moteur exécute toujours le socle : analyse de contribution, traçage de processus et contrôle de cohérence. La classe de complexité, le cycle, la finalité, la disponibilité d'une situation de référence, d'un groupe de comparaison et de données de suivi, l'échelle et le budget ajoutent des méthodes exécutées ou recommandées hors moteur.",
        },
        inputsUsed: "Éléments pris en compte",
        contextFilter: "Questions de cadrage",
        questionnaireStep: "Étape 2",
        questionnaireTitle: "Questions de cadrage",
        questionnaireDescription:
          "Précisez les conditions de l'évaluation pour affiner l'approche recommandée. Les réponses sont préremplies et chaque modification recalcule immédiatement les recommandations.",
        liveUpdate: "Recalcul automatique",
        viewRecommendations: "Voir les recommandations",
        proposed: "Proposé",
        adjusted: "Modifié",
        fields: {
          scale: "Échelle géographique",
          actors: "Nombre d'acteurs",
          budget: "Budget",
          baseline: "Situation de référence",
          comparisonGroup: "Groupe de comparaison",
          monitoringData: "Données de suivi",
          relation: "Relation à l'objet",
          purpose: "Finalité principale",
        },
        options: {
          local: "Locale",
          national: "Nationale",
          multi_country: "Multi-pays",
          one: "Un acteur",
          two_to_three: "Deux à trois",
          four_plus: "Quatre ou plus",
          under_5m: "Moins de 5 M",
          between_5m_50m: "De 5 à 50 M",
          over_50m: "Plus de 50 M",
          unknown: "Non renseigné",
          yes: "Oui",
          no: "Non",
          partial: "Partielles",
          pilot: "Pilotage",
          finance: "Financement",
          mandated_evaluator: "Évaluateur mandaté",
          partner: "Partenaire",
          accountability: "Redevabilité",
          learning_steering: "Apprentissage et pilotage",
          funding_decision: "Décision de financement",
        },
        instruments: {
          programme_multi_acteurs: "Programme multi-acteurs",
          programme_regional_multi_pays: "Programme régional multi-pays",
          programme_national_multisectoriel:
            "Programme national multisectoriel",
          programme_national_sectoriel: "Programme national sectoriel",
          projet_operationnel: "Projet opérationnel",
          strategie_plan: "Stratégie ou plan",
        },
        methods: {
          contribution_analysis: "Analyse de contribution",
          process_tracing: "Traçage de processus",
          coherence_check: "Contrôle de cohérence",
          realist_evaluation: "Évaluation réaliste",
          outcome_harvesting: "Récolte des effets",
          most_significant_change:
            "Changement le plus significatif (si témoignages au corpus)",
          difference_in_differences: "Doubles différences",
          propensity_score_matching: "Appariement sur score de propension",
          regression_discontinuity: "Régression sur discontinuité",
          synthetic_control: "Contrôle synthétique",
          instrumental_variables: "Variables instrumentales",
          interrupted_time_series: "Séries temporelles interrompues",
          randomized_controlled_trial: "Essai contrôlé randomisé",
          quasi_experimental_by_component:
            "Approche quasi expérimentale par composante",
          intervention_logic_analysis: "Analyse de la logique d'intervention",
          evaluability_assessment: "Évaluation de l'évaluabilité",
          forecast_economic_analysis: "Analyse économique prévisionnelle",
          before_after_indicator_comparison:
            "Comparaison des indicateurs avant-après",
          process_evaluation: "Évaluation de processus",
          sustainability_assessment: "Évaluation de la durabilité",
          cost_effectiveness_reading: "Lecture d'une analyse coût-efficacité",
        },
        rationales: {
          framework:
            "Cadre retenu à partir du financeur principal : {{financier}}.",
          cycle: "Phase {{stage}} et période {{startYear}}–{{endYear}}.",
          instrument:
            "Échelle {{scale}}, {{actors}} et {{count}} thématique(s).",
          complexity:
            "Score de {{score}}/10 selon l'échelle, les acteurs, les thématiques, le type d'objet et le budget.",
          nature: "Déduite de votre relation au programme : {{relation}}.",
          method:
            "Méthodes adaptées à une évaluation {{complexity}} au cycle {{cycle}}.",
        },
        inputLabels: {
          financierCode: "Financeur principal",
          stage: "Phase déclarée",
          startYear: "Année de début",
          endYear: "Année de fin",
          currentYear: "Année courante",
          progression: "Progression",
          objectType: "Type d'objet",
          scale: "Échelle",
          actors: "Acteurs",
          themeCount: "Nombre de thématiques",
          themes: "Thématiques",
          budget: "Budget",
          relation: "Relation à l'objet",
          persona: "Rôle de lecture",
          financierCount: "Nombre de financeurs",
          complexity: "Complexité",
          cycle: "Cycle",
          baseline: "Situation de référence",
          comparisonGroup: "Groupe de comparaison",
          monitoringData: "Données de suivi",
          purpose: "Finalité",
        },
        points_one: "{{count}} point",
        points_other: "{{count}} points",
        cards: {
          framework: "Référentiel",
          cycle: "Cycle",
          instrument: "Instrument",
          complexity: "Complexité",
          nature: "Nature",
          method: "Méthodes recommandées",
        },
        cycles: {
          ex_ante: "Ex ante",
          en_cours: "En cours",
          mi_parcours: "À mi-parcours",
          finale: "Finale",
          ex_post: "Ex post",
        },
        complexity: {
          simple: "Simple",
          complique: "Compliquée",
          complexe: "Complexe",
        },
        nature: {
          auto_evaluation: "Auto-évaluation",
          interne: "Évaluation interne",
          externe_independante: "Évaluation externe indépendante",
          conjointe: "Évaluation conjointe",
        },
        methodGroups: {
          core: "Socle ({{count}})",
          coreHint: "toujours appliqué",
          added: "Ajoutées ({{count}})",
          addedHint: "selon votre contexte",
          noAdded: "Aucune méthode ajoutée pour ce contexte.",
          offEngine: "hors moteur",
          coreBadge: "Socle",
          coreOnly: "Socle uniquement",
          offEngineBadge: "Hors moteur",
        },
        warnings: "Incohérences à vérifier",
        warningCodes: {
          start_year_after_end_year: "L'année de début dépasse l'année de fin.",
          post_closure_stage_with_non_past_end_year:
            "Le programme est déclaré après clôture mais sa fin n'est pas passée.",
          stage_cycle_conflict: "Le stade déclaré contredit le cycle calculé.",
          latest_version_label_cycle_conflict:
            "La dernière version semble finale, mais le cycle calculé est à mi-parcours.",
        },
        criteriaStep: "Étape 3",
        criteriaTitle: "Vérifiez les critères qui seront appliqués",
        criteriaDescription:
          "Ces critères découlent de l'approche ci-dessus. Le cycle définit leur applicabilité ; le référentiel et la nature de l'évaluation ajustent leur poids.",
        activeCriteria_one: "{{count}} critère actif",
        activeCriteria_other: "{{count}} critères actifs",
        totalWeight: "Total : {{weight}} %",
        criterionSource: "Pondération issue du : {{source}}",
        weightLabel: "Pondération",
        showExcludedCriteria_one: "Afficher {{count}} critère exclu",
        showExcludedCriteria_other: "Afficher {{count}} critères exclus",
        hideExcludedCriteria: "Masquer les critères exclus",
        applicability: {
          obligatoire: "Obligatoire",
          optionnel: "Optionnel",
          prospectif: "Prospectif",
          non_applicable: "Non applicable",
        },
        sources: {
          cycle: "cycle",
          framework: "référentiel",
          nature: "nature de l'évaluation",
        },
        whyTitle: "Pourquoi ce résultat ?",
        readyTitle: "L'approche vous convient ?",
        confirm: "Confirmer l'approche",
        confirming: "Confirmation...",
        confirmationHelp:
          "La confirmation verrouille cette version et lance la génération des piliers.",
        confirmationSuccess:
          "Approche confirmée. La génération des piliers a démarré.",
        confirmationError:
          "La confirmation a échoué. Vérifiez les migrations et réessayez.",
        unknownError: "Erreur inconnue du service de persistance.",
        generation: {
          eyebrow: "Génération du cadre",
          title: "Préparation des piliers",
          description:
            "L'approche est confirmée. Le moteur prépare maintenant 5 à 8 piliers adaptés au contexte.",
          running: "Génération en cours",
          runningHelp:
            "Vous pouvez quitter cet écran : le traitement continue.",
          statusQueued: "La demande attend le démarrage du moteur.",
          statusRunning: "Le modèle structure et contrôle les piliers.",
          completed: "Les piliers sont prêts",
          completedHelp:
            "Vous pouvez maintenant les vérifier, les ajuster et valider le cadre.",
          failed: "La génération a échoué",
          failedHelp: "Réessayez sans perdre l'approche confirmée.",
          missingJob:
            "Confirmez d'abord l'approche afin de créer une demande de génération.",
          backToApproach: "Retour à l'approche",
          retry: "Réessayer",
          reviewPillars: "Vérifier les piliers",
        },
      },
      corpus: {
        eyebrow: "Corpus documentaire",
        category: {
          principal: "Document principal",
          complementaire: "Document complémentaire",
          autre: "Autre pièce",
        },
        status: {
          conforme: "Conforme",
          a_verifier: "À vérifier",
          rejete: "Rejeté",
          integre_decision_humaine: "Intégré sur décision humaine",
          non_classe: "Non classé",
        },
        level: {
          insufficient: "Insuffisant",
          exploratoire: "Exploratoire",
          standard: "Standard",
          approfondie: "Approfondie",
        },
        table: {
          name: "Nom",
          category: "Catégorie",
          language: "Langue",
          country: "Pays",
          version: "Version",
          score: "Pertinence",
          status: "Statut",
          languageToConfirm: "À confirmer",
          languageUnexpected: "Langue non attendue",
          actions: "Actions",
        },
        actions: {
          open: "Ouvrir la fiche",
          integrate: "Ajouter quand même",
          verify: "Marquer à vérifier",
          reject: "Rejeter",
        },
        messages: {
          countryMismatch:
            "⚠ Ce document semble concerner {{detected}}, alors que ce workspace est configuré pour {{target}}. Souhaitez-vous l'ajouter quand même, vérifier le document, ou l'annuler ?",
          outOfScope:
            "⚠ Ce document ne semble pas lié au programme analysé dans ce workspace. Le moteur n'a pas identifié de contenu pertinent pour les piliers d'analyse définis. Souhaitez-vous l'ajouter quand même, vérifier, ou annuler ?",
          countryUndetected:
            "⚠ Le pays concerné par ce document n'a pas pu être détecté. Souhaitez-vous l'ajouter quand même, vérifier le document, ou l'annuler ?",
          partialCoverage:
            "ℹ Ce document a été accepté, mais seules {{n}} pages sur {{total}} contiennent du contenu exploitable pour l'analyse. Les scores refléteront cette couverture partielle.",
          humanAdd: "Intégré au corpus sur décision humaine.",
          humanCancel:
            "Annulé sur décision humaine : ce document n'alimente pas l'analyse.",
        },
        ingestionErrors: {
          default:
            "Le traitement du document a échoué. Vous pouvez le relancer.",
          CORRUPTED_FILE:
            "Le contenu du document est illisible ou corrompu : il n'a pas été intégré.",
          UNSUPPORTED_FORMAT:
            "Ce format n'est pas pris en charge : seuls les PDF, DOCX et XLSX le sont.",
          PASSWORD_PROTECTED_PDF:
            "Le PDF est protégé par un mot de passe : chargez une version sans protection.",
          NO_EXPLOITABLE_CONTENT:
            "Aucune page du document ne contient de texte exploitable.",
          FILE_INTEGRITY_ERROR:
            "Le fichier stocké ne correspond pas au document chargé. Chargez-le de nouveau.",
          DOCUMENT_FILE_NOT_FOUND:
            "Le fichier du document est introuvable dans le stockage.",
          OCR_SERVICE_UNAVAILABLE:
            "Le service de lecture des scans est indisponible. Relancez le traitement plus tard.",
          EMBEDDING_SERVICE_UNAVAILABLE:
            "L'analyse sémantique est momentanément indisponible. Relancez le traitement plus tard.",
          AI_PROVIDER_NOT_CONFIGURED:
            "L'analyse sémantique n'est pas configurée sur le serveur.",
          WORKER_TIMEOUT:
            "Le traitement a dépassé le délai autorisé. Vous pouvez le relancer.",
        },
        delete: {
          action: "Supprimer",
          actionFor: "Supprimer {{name}}",
          title_one: "Supprimer ce document ?",
          title_other: "Supprimer ces {{count}} documents ?",
          description:
            "Le fichier est supprimé définitivement du stockage, avec son texte extrait et son index. Cette action est irréversible ; elle reste tracée dans le journal d'audit.",
          more_one: "et {{count}} autre",
          more_other: "et {{count}} autres",
          corpusWarning_one:
            "Ce document fait partie du corpus : il ne sera plus utilisé par les analyses.",
          corpusWarning_other:
            "{{count}} de ces documents font partie du corpus : ils ne seront plus utilisés par les analyses.",
          cancel: "Annuler",
          confirm: "Supprimer définitivement",
          success_one: "Document supprimé.",
          success_other: "{{count}} documents supprimés.",
          partial_one: "Un document n'a pas pu être supprimé. Réessayez.",
          partial_other:
            "{{count}} documents n'ont pas pu être supprimés. Réessayez.",
        },
        requestErrors: {
          INGESTION_LOCKED:
            "L'import s'ouvre à la validation du cadre d'analyse.",
          UNSUPPORTED_FORMAT:
            "Seuls les fichiers PDF, DOCX et XLSX sont acceptés.",
          FILE_TOO_LARGE: "Le fichier dépasse la taille maximale autorisée.",
          DUPLICATE_DOCUMENT:
            "Un fichier identique est déjà présent dans ce corpus documentaire.",
          VERSION_REQUIRED:
            "Choisissez la version de rattachement du programme.",
          VERSION_NOT_FOUND: "Cette version du programme n'existe plus.",
          STORAGE_OBJECT_MISSING:
            "Le fichier n'a pas été reçu par le stockage. Réessayez.",
          INVALID_FILE_HASH: "Le fichier n'a pas pu être vérifié. Réessayez.",
          WORKSPACE_ACCESS_DENIED:
            "Vous n'avez pas accès à cet espace de travail.",
          DOCUMENT_NOT_READY: "Le document est encore en cours de traitement.",
          INVALID_TRANSITION:
            "Cette décision n'est plus possible pour ce document.",
          WORKSPACE_ADMIN_REQUIRED:
            "Seul un administrateur de l'espace peut modifier ces paramètres.",
          INVALID_SETTINGS:
            "Certaines valeurs sont hors des limites autorisées.",
          DOCUMENT_NOT_FOUND: "Ce document n'existe plus.",
        },
        errors: {
          load: "Impossible de charger le corpus documentaire.",
          update: "La modification du document a échoué.",
        },
        import: {
          title: "Import documentaire",
          description:
            "Chargez un ou plusieurs fichiers. Vous ne choisissez que la catégorie : le moteur lit chaque document, détecte sa langue et son pays, puis décide s'il a le droit d'entrer dans l'analyse.",
          lock: {
            title: "L'ingestion n'est pas encore activée",
            description:
              "Le cadre d'analyse de ce workspace n'est pas encore validé - les piliers doivent être confirmés avant de lancer une analyse. L'import de documents s'ouvre à la validation du cadre.",
            action: "Voir le cadre",
          },
          dropTitle: "Déposez vos documents ici",
          dropDescription: "PDF, DOCX ou XLSX · un ou plusieurs fichiers",
          invalidFormat: "Seuls les fichiers PDF, DOCX et XLSX sont acceptés.",
          tooManyFiles:
            "Au plus {{count}} fichiers par ajout : les fichiers en trop ont été ignorés.",
          fileTooLarge: "Dépasse la limite de {{max}}",
          confirm: {
            title: "Confirmer le chargement",
            description:
              "Vérifiez les fichiers ajoutés et les métadonnées communes qui leur seront appliquées avant de lancer le chargement.",
            files_one: "{{count}} fichier ajouté",
            files_other: "{{count}} fichiers ajoutés",
            filesDescription:
              "Chaque fichier reprend la catégorie commune ; changez-la ici pour un fichier différent. Les doublons sont signalés et ne seront pas chargés.",
            cancel: "Annuler",
          },
          uploads: {
            title_one: "{{count}} fichier en cours de chargement",
            title_other: "{{count}} fichiers en cours de chargement",
          },
          retry: "Réessayer",
          duplicate:
            "Doublon : identique à « {{name}} », déjà présent. Il ne sera pas chargé.",
          duplicateAllowed:
            "Doublon de « {{name}} » : il sera chargé sur votre décision.",
          duplicateUpload: "Charger quand même",
          duplicateSkip: "Ne pas charger",
          state: {
            checking: "Vérification du fichier…",
            ready: "Prêt à charger",
            uploading: "Chargement en cours",
          },
          errors: {
            check:
              "Le fichier n'a pas pu être vérifié. Retirez-le puis ajoutez-le de nouveau.",
            duplicate:
              "Un fichier identique est déjà présent dans ce corpus documentaire.",
            tooLarge: "Le fichier dépasse la taille maximale autorisée.",
            upload: "Le chargement a échoué. Vous pouvez réessayer.",
          },
          remove: "Retirer {{name}}",
          tracking: {
            title: "Suivi du traitement",
            description:
              "Les fichiers chargés sont conservés : vous pouvez quitter cette page et retrouver leur état ici ou dans la revue documentaire.",
            score: "Pertinence {{score}}/100",
            state: {
              pending: "En file d'attente de traitement",
              extraction: "Extraction du texte et OCR",
              detection: "Détection de la langue et du pays",
              pertinence: "Analyse de pertinence",
              indexation: "Segmentation et indexation",
              failed: "Échec du traitement",
            },
          },
          steps: {
            upload: "Chargement",
            extraction: "Extraction",
            detection: "Détection",
            pertinence: "Pertinence",
          },
          decision: {
            addAnyway: "Ajouter quand même",
            verify: "Vérifier",
            cancel: "Annuler",
          },
          metadata: {
            title: "Métadonnées communes",
            description:
              "Saisies une seule fois pour tous les fichiers du lot. Les anomalies se corrigent ensuite ligne à ligne dans la revue documentaire.",
          },
          category: "Catégorie documentaire",
          commonCategory: "Catégorie commune",
          commonCategoryHint:
            "Appliquée à tous les fichiers du lot, sauf ceux dont la catégorie a été changée.",
          commonCategoryOption: "Catégorie commune ({{category}})",
          fileCategory: "Catégorie de {{name}}",
          categoryHint: {
            principal: "ProDoc, PAR, rapport d'évaluation…",
            complementaire: "Annexes, données, budgets, MRV…",
            autre: "Toute autre pièce utile à l'analyse",
          },
          version: "Version de rattachement",
          selectVersion: "Sélectionnez une version",
          versionHint:
            "Demandée car l'espace compare plusieurs versions du programme.",
          versionRequired:
            "Choisissez la version de rattachement pour charger les fichiers.",
          country: "Pays cible",
          countryHint:
            "Pré-rempli depuis l'espace de travail et comparé au pays détecté dans chaque document.",
          language: "Langue",
          languageHint:
            "Détectée automatiquement pour chaque document. Une langue non attendue est signalée, sans bloquer l'analyse. Langues attendues :",
          submit: "Charger les documents",
          submitCount_one: "Charger {{count}} document",
          submitCount_other: "Charger {{count}} documents",
          openReview: "Ouvrir la revue documentaire",
          success:
            "Les documents ont été chargés et ajoutés à la file de traitement.",
          failure:
            "Un ou plusieurs documents n'ont pas pu être chargés. Vous pouvez les relancer.",
          engine: {
            title: "Décision du moteur",
            description:
              "Chaque document reçoit un score de pertinence de 0 à 100, calculé par rapport à l'empreinte sémantique de l'espace.",
            accepted: "Conforme, intégré au corpus",
            ambiguous: "À vérifier : ajouter, vérifier ou annuler",
            rejected: "Rejeté avec motif, non intégré",
            limits: "{{size}} max. par fichier · {{count}} fichiers par ajout",
          },
        },
        review: {
          title: "Revue documentaire",
          description:
            "Contrôlez les résultats de qualification, corrigez les anomalies et décidez quels documents alimentent le corpus.",
          add: "Ajouter des documents",
          filter: "Filtrer par statut",
          all: "Tous les statuts",
          count_one: "{{count}} document affiché",
          count_other: "{{count}} documents affichés",
          emptyTitle: "Aucun document à afficher",
          emptyDescription:
            "Ajoutez des documents ou choisissez un autre filtre de statut.",
          decisionSaved: "La décision documentaire a été enregistrée.",
          selectAll: "Sélectionner tous les documents",
          selectDocument: "Sélectionner {{name}}",
          selected_one: "{{count}} document sélectionné",
          selected_other: "{{count}} documents sélectionnés",
          apply: "Appliquer au lot",
          bulkSuccess:
            "La catégorie a été appliquée aux documents sélectionnés.",
        },
        inventory: {
          title: "Corpus et masse critique",
          description:
            "Visualisez les pièces qui nourrissent l'analyse et le niveau de fiabilité documentaire atteint.",
          add: "Ajouter des documents",
          mass: "Masse documentaire",
          included_one: "{{count}} document admissible",
          included_other: "{{count}} documents admissibles",
          level: "Niveau atteint",
          next_one:
            "Ajoutez encore {{count}} document pour atteindre le niveau {{level}}.",
          next_other:
            "Ajoutez encore {{count}} documents pour atteindre le niveau {{level}}.",
          blocked:
            "Analyse impossible. Le corpus actuel contient {{count}} document(s), soit insuffisant pour produire des résultats fiables. EvoranQ requiert un minimum de {{threshold}} documents pour ce type d'analyse. Ajoutez des documents pour continuer.",
          warning:
            "Le corpus contient {{count}} documents. Les résultats sont indicatifs et ne doivent pas être utilisés comme base de décision formelle. Pour une analyse fiable, ajoutez {{remaining}} documents supplémentaires.",
          documents: "Inventaire documentaire",
          documentsDescription_one:
            "{{count}} document chargé, tous statuts confondus.",
          documentsDescription_other:
            "{{count}} documents chargés, tous statuts confondus.",
          empty:
            "Le corpus est vide. Ajoutez vos premiers documents pour commencer.",
        },
        detail: {
          eyebrow: "Fiche document",
          back: "Retour à la revue",
          openSource: "Ouvrir le fichier",
          notFound: "Ce document est introuvable ou n'est plus accessible.",
          metadata: "Métadonnées",
          importedAt: "Chargé le",
          coverage: "Couverture exploitable",
          coveragePending:
            "La couverture sera disponible après l'extraction du document.",
          pages: "pages exploitables",
          uses: "Utilisations dans les calculs",
          noUses: "Ce document n'a encore été utilisé dans aucun calcul.",
          history: "Historique des contrôles et décisions",
          noHistory:
            "Aucun événement n'est encore enregistré pour ce document.",
        },
        events: {
          document_uploaded: "Document chargé",
          document_duplicate_detected: "Doublon détecté",
          document_extracted: "Texte extrait",
          document_language_detected: "Langue détectée",
          document_country_detected: "Pays détecté",
          document_relevance_scored: "Pertinence calculée",
          document_qualified: "Document qualifié",
          document_rejected: "Document rejeté",
          document_segmented: "Document segmenté",
          document_indexed: "Document indexé",
          document_unindexed: "Document retiré de l'index",
          document_integrated_by_human: "Intégré sur décision humaine",
          document_cancelled_by_human: "Annulé sur décision humaine",
          document_metadata_corrected: "Métadonnées corrigées",
          document_ingestion_failed: "Échec du traitement",
          document_ingestion_retried: "Traitement relancé",
          document_deleted: "Document supprimé",
          metadata_corrected: "Métadonnées corrigées",
          document_integrate: "Intégration décidée manuellement",
          document_verify: "Vérification demandée",
          document_reject: "Document rejeté",
        },
      },
      evaluation: {
        eyebrow: "Cadre et évaluation",
        loadError: "Impossible de charger les données d'évaluation.",
        back: "Retour aux piliers",
        openPillar: "Ouvrir le pilier",
        viewEvidence: "Voir la preuve",
        nonConcluded: "Non conclu",
        brief: {
          title: "Brief du cadre",
          description:
            "Retrouvez l'approche retenue pour cette évaluation : référentiel, cycle, instrument, complexité, nature, méthodes et critères appliqués.",
          version: "Version {{version}}",
          status: {
            proposed: "Proposée",
            modified: "Modifiée",
            confirmed: "Confirmée",
          },
          confirmedAt: "Approche confirmée le {{date}}",
          updatedAt: "Dernière mise à jour le {{date}}",
          approachTitle: "Approche retenue",
          criteriaTitle: "Critères appliqués",
          empty: "Aucune approche retenue",
          emptyDescription:
            "Le brief apparaîtra une fois l'approche d'évaluation confirmée pour cet espace.",
          configure: "Définir l'approche",
        },
        framework: {
          title: "Piliers du cadre",
          methodsBanner: {
            title: "Piliers dérivés des méthodes recommandées",
            meta: "Approche v{{version}} · {{cycle}}",
            link: "Voir l'approche",
          },
          description:
            "Vérifiez la structure de l'évaluation, ses variables observables et la pondération de chaque pilier.",
          templateNotice:
            "La génération personnalisée n'est pas encore disponible. Le référentiel applicable au cycle est affiché comme gabarit de secours.",
          pillarName: "Nom du pilier",
          referential: "Référentiel",
          new: "Nouveau",
          variables: "Variables observables",
          otherCriteria: "+ {{count}} autres",
          weight: "Pondération",
          decreaseWeight: "Diminuer la pondération",
          increaseWeight: "Augmenter la pondération",
          remove: "Supprimer le pilier",
          totalWeight: "Somme des pondérations",
          balanceWeights: "Équilibrer à 100 %",
          add: "Ajouter un pilier",
          addTitle: "Ajouter un pilier manuellement",
          addDescription:
            "Définissez le contenu du pilier avant de l'intégrer au cadre d'évaluation.",
          pillarDescription: "Description",
          weightPercent: "Pondération (%)",
          weightHint:
            "Après l'ajout, ajustez les pondérations pour obtenir un total de 100 %.",
          criteria: "Critères associés",
          criteriaHint: "Sélectionnez au moins un critère.",
          variablesPlaceholder:
            "Une variable par ligne\nEx. Accès effectif aux services",
          variablesHint: "Ajoutez au moins une variable, une par ligne.",
          cancel: "Annuler",
          addAction: "Ajouter au cadre",
          validate: "Valider le cadre",
          validated: "Le cadre d'évaluation a été validé.",
          validationError: "Impossible de valider le cadre.",
        },
        criteria: {
          title: "Critères et questions",
          description:
            "Consultez les critères applicables et les sous-questions retenues pour cette évaluation.",
          addQuestion: "Ajouter une question",
          empty: "Aucune grille de questions générée",
          emptyDescription:
            "Les critères et sous-questions apparaîtront après la génération puis la validation du cadre.",
          noExpectedEvidence: "Preuve attendue non précisée",
          inactive: "Non retenues ({{count}})",
          noneInactive: "Aucune question désactivée.",
          confirm: "Confirmer les critères",
        },
        applicability: {
          obligatoire: "Obligatoire",
          optionnel: "Optionnel",
          prospectif: "Prospectif",
          non_applicable: "Non applicable",
        },
        analysis: {
          title: "Comparatif général",
          description:
            "Lecture consolidée des scores objectivés, appréciations évaluatives, alertes et preuves du dernier run.",
          noRun: "Aucune analyse disponible",
          noRunDescription:
            "Un run pourra être lancé lorsque le cadre sera validé et que le corpus aura atteint la masse minimale.",
          launch: "Lancer l'analyse",
          running: "Analyse en cours",
          runningDescription:
            "Le moteur poursuit le traitement en arrière-plan. Vous pouvez quitter cet écran.",
          averageScore: "Score moyen A",
          scoreDescription: "Score objectivé sur 100",
          concludedCriteria: "Critères conclus B",
          criteriaDescription: "Critères disposant de preuves suffisantes",
          pendingAlerts: "Alertes C à instruire",
          alertsDescription: "Contradictions restant à examiner",
          traceability: "Traçabilité par preuve",
          traceabilityDescription: "Sorties reliées à des extraits sources",
          runReference: "Run {{id}} · {{date}}",
          steps: {
            classification: "Classification des segments",
            variables: "Calcul des variables intermédiaires",
            layerA: "Couche A · scores objectivés",
            layerB: "Couche B · appréciations évaluatives",
            layerC: "Couche C · alertes de cohérence",
            reporting: "Restitution et journalisation",
          },
        },
        evolution: {
          renforce: "Renforcé",
          maintenu: "Maintenu",
          affaibli: "Affaibli",
        },
        layerA: {
          title: "Couche A · Piliers",
          description: "Scores factuels par pilier et variables observables.",
          bannerTitle: "Couche A · Objectivée",
          bannerDescription:
            "Ce qui a factuellement changé, mesuré sur éléments observables. Aucun jugement.",
          objectiveScore: "Score objectivé",
          variables: "Variables observables",
          noVariables: "Aucune variable calculée pour ce pilier.",
        },
        variableState: {
          present: "Présent",
          partiel: "Partiel",
          absent: "Absent",
          non_renseigne: "Non renseigné",
        },
        layerB: {
          title: "Couche B · Critères",
          description:
            "Notes encadrées par les critères et la couverture documentaire des sous-questions.",
          bannerTitle: "Couche B · Évaluative",
          bannerDescription:
            "Appréciation encadrée par critères et sous-questions. Jamais une opinion libre.",
          documented: "documenté",
          ambiguous:
            "Preuves contradictoires — ouvrir pour examiner les deux bords",
          empty: "Aucune note évaluative n'est disponible pour ce run.",
        },
        answerStatus: {
          documentee: "Documentée",
          non_documentee: "Non documentée",
        },
        alerts: {
          title: "Alertes de cohérence",
          description:
            "Écarts détectés entre les constats factuels et les appréciations évaluatives.",
          bannerTitle: "Couche C · Cohérence",
          bannerDescription:
            "Les alertes signalent les contradictions à instruire. Elles ne modifient jamais les scores.",
          comment: "Commentaire d'instruction",
          markInstructed: "Marquer instruite",
          saved: "L'alerte a été instruite et commentée.",
          saveError: "Impossible d'enregistrer l'instruction.",
          empty: "Aucune alerte de cohérence pour ce run.",
        },
        severity: { mineure: "Mineure", majeure: "Majeure" },
        alertStatus: {
          a_instruire: "À instruire",
          instruite: "Instruite",
        },
        evidence: {
          title: "Preuves",
          position: "Preuve {{current}}/{{total}}",
          unavailable: "Preuve indisponible",
          document: "Document source",
          page: "Page",
          section: "Section",
          context: "Élément évalué",
          confidence: "Confiance corpus",
          primary: "Extrait primaire",
          previous: "Précédente",
          next: "Suivante",
          openDocument: "Ouvrir dans le document",
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
          approach: "Evaluation approach",
          recommendedApproach: "Recommended approach",
          pillarGeneration: "Pillar generation",
          brief: "Framework brief",
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
          financiersLabel: "Funders",
          financiersHelp:
            "Choose the main funder that will determine the framework, then add any co-funders.",
          financierSelectLabel: "Select a funder",
          financierPlaceholder: "Select a funder",
          financierOptions: {
            GCF: "Green Climate Fund (GCF)",
            AFD: "French Development Agency (AFD)",
            WB: "World Bank",
            FIDA: "IFAD",
            PNUD: "UNDP",
            UE: "European Union",
            FEM: "Global Environment Facility (GEF)",
            AF: "Adaptation Fund",
            OTHER: "Other funder",
          },
          otherFinancierLabel: "Other funder name",
          otherFinancierPlaceholder: "Enter the funder name",
          mainFinancier: "Main funder",
          coFinancier: "Co-funder",
          principal: "Set as main funder",
          addFinancier: "Add a funder",
          addCoFinancier: "Add a co-funder",
          remove: "Remove",
          themesLabel: "Main themes",
          customThemeLabel: "Other main theme",
          customThemePlaceholder: "E.g. Health, education, governance",
          addTheme: "Add",
          removeTheme: "Remove the {{theme}} theme",
          themeAlreadyAdded: "This theme has already been added.",
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
          stageLabel: "Cycle phase",
          stages: {
            design: "Design",
            pre_launch: "Before launch",
            implementation: "Implementation",
            mid_term: "Mid-term",
            closing: "Closing",
            post_closure: "After closing",
            cross_cutting: "Cross-cutting",
          },
          stageDescriptions: {
            design:
              "Ex-ante evaluation, feasibility study (appraisal), impact study or regulatory impact assessment (RIA).",
            pre_launch: "Evaluability assessment or baseline study.",
            implementation:
              "Monitoring, formative or process evaluation, or real-time evaluation.",
            mid_term: "Mid-term review or evaluation.",
            closing:
              "Final evaluation or completion report, such as a World Bank ICR.",
            post_closure: "Ex-post, impact or sustainability evaluation.",
            cross_cutting:
              "Cross-cutting evaluation spanning several phases of the cycle.",
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
            eyebrow: "Final step",
            title: "Your workspace is ready to be created",
            description:
              "Review the summary, then create your workspace. You can then choose the evaluation approach best suited to your programme.",
            completeTitle: "Your workspace is ready",
            completeDescription:
              "The workspace has been created. You can now continue setting up the evaluation.",
            launch: "Create workspace",
            running: "Creating workspace...",
            retry: "Try again",
            edit: "Edit information",
            openWorkspace: "Open workspace",
            error:
              "The workspace could not be created. You can try again without losing the information you entered.",
            steps: {
              identity: {
                title: "Workspace information",
                description: "The name and organization are defined.",
              },
              scope: {
                title: "Evaluation scope",
                description:
                  "The country, funders, themes and languages are provided.",
              },
              timeline: {
                title: "Cycle and versions",
                description:
                  "The programme phase, period and versions are specified.",
              },
              workspace: {
                title: "Workspace creation",
                description:
                  "The information is saved before choosing the evaluation approach.",
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
        settings: {
          eyebrow: "Workspace settings",
          title: "General information",
          description: "Edit the identity, scope and cycle of this workspace.",
          identityTitle: "Identity",
          identityDescription:
            "The name appears in navigation, exports and the audit log.",
          scopeTitle: "Scope",
          scopeDescription:
            "This information makes up the evaluation's semantic fingerprint.",
          cycleTitle: "Programme cycle",
          cycleDescription:
            "The timeline is used to tailor the evaluation approach.",
          adminOnly: "Only administrators can edit or delete this workspace.",
          save: "Save changes",
          saving: "Saving...",
          saveSuccess: "The workspace information has been updated.",
          saveError: "Unable to save the changes.",
          loadError: "Unable to load the workspace information.",
          validation: "Complete all required fields and check the years.",
          dangerTitle: "Danger zone",
          dangerDescription:
            "Deletion is permanent and removes all data associated with this workspace.",
          deleteConfirmation: "Enter “{{name}}” to confirm deletion.",
          deleteAction: "Delete workspace",
          cancelDelete: "Cancel",
          deleteSuccess: "The workspace has been deleted.",
          deleteError: "Unable to delete the workspace.",
        },
        error: {
          title: "Your workspaces are unavailable",
          description:
            "We could not load your workspaces. Please try again in a moment.",
          retry: "Retry",
        },
      },
      approach: {
        flow: {
          exit: "Exit setup",
          progress: "Framework setup progress",
          steps: {
            approach: "Approach",
            generation: "Generation",
            pillars: "Pillar validation",
          },
        },
        eyebrow: "Evaluation engine",
        title: "Recommended approach",
        description:
          "Review the evaluation method proposed for {{workspace}}. It is calculated from the workspace information and your answers, without generative AI.",
        loading: "Computing the recommended approach...",
        error: "The approach cannot be computed",
        retry: "Retry",
        recomputed: "Transparent calculation, no AI",
        deterministic: "Deterministic rule",
        recommendationsStep: "Step 1",
        recommendationsTitle: "Review the proposed approach",
        recommendationsDescription:
          "These six recommendations define how the evaluation will be conducted. Select a card to understand its calculation.",
        recommended: "Recommended",
        recalculated: "Recalculated",
        seeWhy: "See why",
        recommendationRationale: "Recommendation rationale",
        ruleApplied: "Rule applied: {{rule}}",
        ruleExplanation: "Business rule",
        ruleDescriptions: {
          framework:
            "The main funder selects the latest active framework that matches it. If no framework is recognized, the Themiros framework is used.",
          cycle:
            "The declared phase determines the evaluation cycle first. For a cross-cutting evaluation, progress between the start and end years determines ongoing, mid-term or final.",
          instrument:
            "The object type, geographic scale, number of actors and number of themes determine the instrument module and subtype.",
          complexity:
            "The score adds five factors: scale, actors, themes, object type and budget. Scores 0–3 are simple, 4–6 complicated and 7–10 complex.",
          nature:
            "The user's relationship to the object, reading role and number of funders determine whether the evaluation is self-led, internal, independent external or joint.",
          method:
            "The engine always runs the core: contribution analysis, process tracing and coherence check. The complexity class, cycle, purpose, availability of a baseline, comparison group and monitoring data, scale and budget add methods run by the engine or recommended outside it.",
        },
        inputsUsed: "Inputs used",
        contextFilter: "Scoping questions",
        questionnaireStep: "Step 2",
        questionnaireTitle: "Scoping questions",
        questionnaireDescription:
          "Specify the evaluation conditions to refine the recommended approach. Answers are prefilled and every change immediately updates the recommendations.",
        liveUpdate: "Automatic recalculation",
        viewRecommendations: "View recommendations",
        proposed: "Proposed",
        adjusted: "Changed",
        fields: {
          scale: "Geographic scale",
          actors: "Number of actors",
          budget: "Budget",
          baseline: "Baseline",
          comparisonGroup: "Comparison group",
          monitoringData: "Monitoring data",
          relation: "Relationship to the object",
          purpose: "Primary purpose",
        },
        options: {
          local: "Local",
          national: "National",
          multi_country: "Multi-country",
          one: "One actor",
          two_to_three: "Two to three",
          four_plus: "Four or more",
          under_5m: "Under 5M",
          between_5m_50m: "5M to 50M",
          over_50m: "Over 50M",
          unknown: "Unknown",
          yes: "Yes",
          no: "No",
          partial: "Partial",
          pilot: "Programme management",
          finance: "Funding",
          mandated_evaluator: "Commissioned evaluator",
          partner: "Partner",
          accountability: "Accountability",
          learning_steering: "Learning and steering",
          funding_decision: "Funding decision",
        },
        instruments: {
          programme_multi_acteurs: "Multi-stakeholder programme",
          programme_regional_multi_pays: "Regional multi-country programme",
          programme_national_multisectoriel: "National multisector programme",
          programme_national_sectoriel: "National sector programme",
          projet_operationnel: "Operational project",
          strategie_plan: "Strategy or plan",
        },
        methods: {
          contribution_analysis: "Contribution analysis",
          process_tracing: "Process tracing",
          coherence_check: "Coherence review",
          realist_evaluation: "Realist evaluation",
          outcome_harvesting: "Outcome harvesting",
          most_significant_change:
            "Most significant change (if testimonies in the corpus)",
          difference_in_differences: "Difference in differences",
          propensity_score_matching: "Propensity score matching",
          regression_discontinuity: "Regression discontinuity",
          synthetic_control: "Synthetic control",
          instrumental_variables: "Instrumental variables",
          interrupted_time_series: "Interrupted time series",
          randomized_controlled_trial: "Randomized controlled trial",
          quasi_experimental_by_component:
            "Quasi-experimental approach by component",
          intervention_logic_analysis: "Intervention logic analysis",
          evaluability_assessment: "Evaluability assessment",
          forecast_economic_analysis: "Forecast economic analysis",
          before_after_indicator_comparison:
            "Before-and-after indicator comparison",
          process_evaluation: "Process evaluation",
          sustainability_assessment: "Sustainability assessment",
          cost_effectiveness_reading: "Cost-effectiveness analysis review",
        },
        rationales: {
          framework: "Framework selected from the main funder: {{financier}}.",
          cycle: "{{stage}} phase and {{startYear}}–{{endYear}} period.",
          instrument: "{{scale}} scale, {{actors}} and {{count}} theme(s).",
          complexity:
            "Score of {{score}}/10 based on scale, actors, themes, object type and budget.",
          nature:
            "Derived from your relationship to the programme: {{relation}}.",
          method:
            "Methods suited to a {{complexity}} evaluation in the {{cycle}} cycle.",
        },
        inputLabels: {
          financierCode: "Main funder",
          stage: "Declared phase",
          startYear: "Start year",
          endYear: "End year",
          currentYear: "Current year",
          progression: "Progress",
          objectType: "Object type",
          scale: "Scale",
          actors: "Actors",
          themeCount: "Number of themes",
          themes: "Themes",
          budget: "Budget",
          relation: "Relationship to the object",
          persona: "Reading role",
          financierCount: "Number of funders",
          complexity: "Complexity",
          cycle: "Cycle",
          baseline: "Baseline",
          comparisonGroup: "Comparison group",
          monitoringData: "Monitoring data",
          purpose: "Purpose",
        },
        points_one: "{{count}} point",
        points_other: "{{count}} points",
        cards: {
          framework: "Framework",
          cycle: "Cycle",
          instrument: "Instrument",
          complexity: "Complexity",
          nature: "Nature",
          method: "Recommended methods",
        },
        cycles: {
          ex_ante: "Ex ante",
          en_cours: "Ongoing",
          mi_parcours: "Mid-term",
          finale: "Final",
          ex_post: "Ex post",
        },
        complexity: {
          simple: "Simple",
          complique: "Complicated",
          complexe: "Complex",
        },
        nature: {
          auto_evaluation: "Self-evaluation",
          interne: "Internal evaluation",
          externe_independante: "Independent external evaluation",
          conjointe: "Joint evaluation",
        },
        methodGroups: {
          core: "Core ({{count}})",
          coreHint: "always applied",
          added: "Added ({{count}})",
          addedHint: "based on your context",
          noAdded: "No method added for this context.",
          offEngine: "off-engine",
          coreBadge: "Core",
          coreOnly: "Core methods only",
          offEngineBadge: "Off-engine",
        },
        warnings: "Inconsistencies to review",
        warningCodes: {
          start_year_after_end_year: "The start year is after the end year.",
          post_closure_stage_with_non_past_end_year:
            "The programme is marked post-closure but its end date is not past.",
          stage_cycle_conflict:
            "The declared stage conflicts with the computed cycle.",
          latest_version_label_cycle_conflict:
            "The latest version looks final, but the computed cycle is mid-term.",
        },
        criteriaStep: "Step 3",
        criteriaTitle: "Review the criteria that will be applied",
        criteriaDescription:
          "These criteria follow from the approach above. The cycle determines applicability; the framework and evaluation nature adjust their weights.",
        activeCriteria_one: "{{count}} active criterion",
        activeCriteria_other: "{{count}} active criteria",
        totalWeight: "Total: {{weight}}%",
        criterionSource: "Weight derived from: {{source}}",
        weightLabel: "Weight",
        showExcludedCriteria_one: "Show {{count}} excluded criterion",
        showExcludedCriteria_other: "Show {{count}} excluded criteria",
        hideExcludedCriteria: "Hide excluded criteria",
        applicability: {
          obligatoire: "Required",
          optionnel: "Optional",
          prospectif: "Prospective",
          non_applicable: "Not applicable",
        },
        sources: {
          cycle: "cycle",
          framework: "framework",
          nature: "evaluation nature",
        },
        whyTitle: "Why this result?",
        readyTitle: "Does this approach work for you?",
        confirm: "Confirm approach",
        confirming: "Confirming...",
        confirmationHelp:
          "Confirmation locks this version and starts pillar generation.",
        confirmationSuccess:
          "Approach confirmed. Pillar generation has started.",
        confirmationError:
          "Confirmation failed. Check the migrations and try again.",
        unknownError: "Unknown persistence service error.",
        generation: {
          eyebrow: "Framework generation",
          title: "Preparing pillars",
          description:
            "The approach is confirmed. The engine is now preparing 5 to 8 contextual pillars.",
          running: "Generation in progress",
          runningHelp: "You can leave this screen; processing will continue.",
          statusQueued: "The request is waiting for the engine to start.",
          statusRunning: "The model is structuring and validating the pillars.",
          completed: "The pillars are ready",
          completedHelp:
            "You can now review, adjust and validate the framework.",
          failed: "Generation failed",
          failedHelp: "Retry without losing the confirmed approach.",
          missingJob:
            "Confirm the approach first to create a generation request.",
          backToApproach: "Back to approach",
          retry: "Retry",
          reviewPillars: "Review pillars",
        },
      },
      corpus: {
        eyebrow: "Document corpus",
        category: {
          principal: "Main document",
          complementaire: "Supporting document",
          autre: "Other item",
        },
        status: {
          conforme: "Compliant",
          a_verifier: "Needs review",
          rejete: "Rejected",
          integre_decision_humaine: "Included by human decision",
          non_classe: "Unclassified",
        },
        level: {
          insufficient: "Insufficient",
          exploratoire: "Exploratory",
          standard: "Standard",
          approfondie: "In-depth",
        },
        table: {
          name: "Name",
          category: "Category",
          language: "Language",
          country: "Country",
          version: "Version",
          score: "Relevance",
          status: "Status",
          languageToConfirm: "To confirm",
          languageUnexpected: "Unexpected language",
          actions: "Actions",
        },
        actions: {
          open: "Open details",
          integrate: "Include anyway",
          verify: "Mark for review",
          reject: "Reject",
        },
        messages: {
          countryMismatch:
            "⚠ This document seems to concern {{detected}}, while this workspace is configured for {{target}}. Do you want to add it anyway, review the document, or cancel it?",
          outOfScope:
            "⚠ This document does not seem related to the programme analysed in this workspace. The engine found no content relevant to the defined analysis pillars. Do you want to add it anyway, review it, or cancel it?",
          countryUndetected:
            "⚠ The country this document concerns could not be detected. Do you want to add it anyway, review the document, or cancel it?",
          partialCoverage:
            "ℹ This document was accepted, but only {{n}} of {{total}} pages contain content usable for the analysis. Scores will reflect this partial coverage.",
          humanAdd: "Included in the corpus by human decision.",
          humanCancel:
            "Cancelled by human decision: this document does not feed the analysis.",
        },
        ingestionErrors: {
          default: "Document processing failed. You can run it again.",
          CORRUPTED_FILE:
            "The document content is unreadable or corrupted: it was not included.",
          UNSUPPORTED_FORMAT:
            "This format is not supported: only PDF, DOCX and XLSX are.",
          PASSWORD_PROTECTED_PDF:
            "The PDF is password-protected: upload an unprotected version.",
          NO_EXPLOITABLE_CONTENT:
            "No page of the document contains usable text.",
          FILE_INTEGRITY_ERROR:
            "The stored file does not match the uploaded document. Upload it again.",
          DOCUMENT_FILE_NOT_FOUND:
            "The document file cannot be found in storage.",
          OCR_SERVICE_UNAVAILABLE:
            "The scan reading service is unavailable. Run the processing again later.",
          EMBEDDING_SERVICE_UNAVAILABLE:
            "Semantic analysis is temporarily unavailable. Run the processing again later.",
          AI_PROVIDER_NOT_CONFIGURED:
            "Semantic analysis is not configured on the server.",
          WORKER_TIMEOUT: "Processing took too long. You can run it again.",
        },
        delete: {
          action: "Delete",
          actionFor: "Delete {{name}}",
          title_one: "Delete this document?",
          title_other: "Delete these {{count}} documents?",
          description:
            "The file is permanently deleted from storage, along with its extracted text and index. This cannot be undone; it remains recorded in the audit log.",
          more_one: "and {{count}} more",
          more_other: "and {{count}} more",
          corpusWarning_one:
            "This document is part of the corpus: analyses will no longer use it.",
          corpusWarning_other:
            "{{count}} of these documents are part of the corpus: analyses will no longer use them.",
          cancel: "Cancel",
          confirm: "Delete permanently",
          success_one: "Document deleted.",
          success_other: "{{count}} documents deleted.",
          partial_one: "One document could not be deleted. Try again.",
          partial_other: "{{count}} documents could not be deleted. Try again.",
        },
        requestErrors: {
          INGESTION_LOCKED:
            "Import opens once the analysis framework is validated.",
          UNSUPPORTED_FORMAT: "Only PDF, DOCX and XLSX files are accepted.",
          FILE_TOO_LARGE: "The file exceeds the maximum allowed size.",
          DUPLICATE_DOCUMENT:
            "An identical file already exists in this corpus.",
          VERSION_REQUIRED: "Choose the programme version.",
          VERSION_NOT_FOUND: "This programme version no longer exists.",
          STORAGE_OBJECT_MISSING: "The file did not reach storage. Try again.",
          INVALID_FILE_HASH: "The file could not be checked. Try again.",
          WORKSPACE_ACCESS_DENIED: "You do not have access to this workspace.",
          DOCUMENT_NOT_READY: "The document is still being processed.",
          INVALID_TRANSITION:
            "This decision is no longer possible for this document.",
          WORKSPACE_ADMIN_REQUIRED:
            "Only a workspace administrator can change these settings.",
          INVALID_SETTINGS: "Some values are outside the allowed limits.",
          DOCUMENT_NOT_FOUND: "This document no longer exists.",
        },
        errors: {
          load: "Unable to load the document corpus.",
          update: "The document could not be updated.",
        },
        import: {
          title: "Document import",
          description:
            "Upload one or more files. You only choose the category: the engine reads each document, detects its language and country, then decides whether it may enter the analysis.",
          lock: {
            title: "Ingestion is not enabled yet",
            description:
              "The analysis framework of this workspace is not validated yet - the pillars must be confirmed before running an analysis. Document import opens once the framework is validated.",
            action: "View framework",
          },
          dropTitle: "Drop your documents here",
          dropDescription: "PDF, DOCX or XLSX · one or more files",
          invalidFormat: "Only PDF, DOCX and XLSX files are accepted.",
          tooManyFiles:
            "At most {{count}} files per upload: the extra files were ignored.",
          fileTooLarge: "Exceeds the {{max}} limit",
          confirm: {
            title: "Confirm upload",
            description:
              "Check the added files and the shared metadata applied to them before starting the upload.",
            files_one: "{{count}} file added",
            files_other: "{{count}} files added",
            filesDescription:
              "Each file uses the shared category; change it here for a different file. Duplicates are flagged and will not be uploaded.",
            cancel: "Cancel",
          },
          uploads: {
            title_one: "{{count}} file uploading",
            title_other: "{{count}} files uploading",
          },
          retry: "Retry",
          duplicate:
            "Duplicate: identical to “{{name}}”, already present. It will not be uploaded.",
          duplicateAllowed:
            "Duplicate of “{{name}}”: it will be uploaded on your decision.",
          duplicateUpload: "Upload anyway",
          duplicateSkip: "Do not upload",
          state: {
            checking: "Checking file…",
            ready: "Ready to upload",
            uploading: "Uploading",
          },
          errors: {
            check: "The file could not be checked. Remove it and add it again.",
            duplicate: "An identical file already exists in this corpus.",
            tooLarge: "The file exceeds the maximum allowed size.",
            upload: "The upload failed. You can try again.",
          },
          remove: "Remove {{name}}",
          tracking: {
            title: "Processing status",
            description:
              "Uploaded files are kept: you can leave this page and find their status here or in the document review.",
            score: "Relevance {{score}}/100",
            state: {
              pending: "Waiting for processing",
              extraction: "Text extraction and OCR",
              detection: "Language and country detection",
              pertinence: "Relevance analysis",
              indexation: "Segmentation and indexing",
              failed: "Processing failed",
            },
          },
          steps: {
            upload: "Upload",
            extraction: "Extraction",
            detection: "Detection",
            pertinence: "Relevance",
          },
          decision: {
            addAnyway: "Add anyway",
            verify: "Review",
            cancel: "Cancel",
          },
          metadata: {
            title: "Shared metadata",
            description:
              "Entered once for every file in the batch. Anomalies are then fixed row by row in the document review.",
          },
          category: "Document category",
          commonCategory: "Shared category",
          commonCategoryHint:
            "Applied to every file in the batch, except those whose category was changed.",
          commonCategoryOption: "Shared category ({{category}})",
          fileCategory: "Category of {{name}}",
          categoryHint: {
            principal: "ProDoc, PAR, evaluation report…",
            complementaire: "Annexes, data, budgets, MRV…",
            autre: "Any other item useful to the analysis",
          },
          version: "Programme version",
          selectVersion: "Select a version",
          versionHint:
            "Required because this workspace compares several programme versions.",
          versionRequired: "Choose the programme version to upload the files.",
          country: "Target country",
          countryHint:
            "Pre-filled from the workspace and compared with the country detected in each document.",
          language: "Language",
          languageHint:
            "Detected automatically for each document. An unexpected language is flagged without blocking the analysis. Expected languages:",
          submit: "Upload documents",
          submitCount_one: "Upload {{count}} document",
          submitCount_other: "Upload {{count}} documents",
          openReview: "Open document review",
          success:
            "The documents were uploaded and added to the processing queue.",
          failure:
            "One or more documents could not be uploaded. You can retry them.",
          engine: {
            title: "Engine decision",
            description:
              "Each document receives a relevance score from 0 to 100, computed against the workspace's semantic fingerprint.",
            accepted: "Compliant, included in the corpus",
            ambiguous: "Needs review: add, review or cancel",
            rejected: "Rejected with a reason, not included",
            limits: "{{size}} max. per file · {{count}} files per upload",
          },
        },
        review: {
          title: "Document review",
          description:
            "Review qualification results, fix anomalies and decide which documents feed the corpus.",
          add: "Add documents",
          filter: "Filter by status",
          all: "All statuses",
          count_one: "{{count}} document shown",
          count_other: "{{count}} documents shown",
          emptyTitle: "No documents to show",
          emptyDescription: "Add documents or select another status filter.",
          decisionSaved: "The document decision was saved.",
          selectAll: "Select all documents",
          selectDocument: "Select {{name}}",
          selected_one: "{{count}} document selected",
          selected_other: "{{count}} documents selected",
          apply: "Apply to selection",
          bulkSuccess: "The category was applied to the selected documents.",
        },
        inventory: {
          title: "Corpus and critical mass",
          description:
            "See the documents feeding the analysis and the reliability level reached by the corpus.",
          add: "Add documents",
          mass: "Document mass",
          included_one: "{{count}} eligible document",
          included_other: "{{count}} eligible documents",
          level: "Current level",
          next_one: "Add {{count}} more document to reach the {{level}} level.",
          next_other:
            "Add {{count}} more documents to reach the {{level}} level.",
          blocked:
            "Analysis is impossible. The current corpus contains {{count}} document(s), which is insufficient to produce reliable results. EvoranQ requires at least {{threshold}} documents for this analysis. Add documents to continue.",
          warning:
            "The corpus contains {{count}} documents. Results are indicative and must not be used for formal decisions. Add {{remaining}} documents for a reliable analysis.",
          documents: "Document inventory",
          documentsDescription_one:
            "{{count}} uploaded document across all statuses.",
          documentsDescription_other:
            "{{count}} uploaded documents across all statuses.",
          empty: "The corpus is empty. Add your first documents to begin.",
        },
        detail: {
          eyebrow: "Document details",
          back: "Back to review",
          openSource: "Open file",
          notFound:
            "This document could not be found or is no longer accessible.",
          metadata: "Metadata",
          importedAt: "Uploaded on",
          coverage: "Usable coverage",
          coveragePending:
            "Coverage will be available after document extraction.",
          pages: "usable pages",
          uses: "Uses in calculations",
          noUses: "This document has not been used in any calculation yet.",
          history: "Review and decision history",
          noHistory: "No events have been recorded for this document yet.",
        },
        events: {
          document_uploaded: "Document uploaded",
          document_duplicate_detected: "Duplicate detected",
          document_extracted: "Text extracted",
          document_language_detected: "Language detected",
          document_country_detected: "Country detected",
          document_relevance_scored: "Relevance scored",
          document_qualified: "Document qualified",
          document_rejected: "Document rejected",
          document_segmented: "Document segmented",
          document_indexed: "Document indexed",
          document_unindexed: "Document removed from the index",
          document_integrated_by_human: "Included by human decision",
          document_cancelled_by_human: "Cancelled by human decision",
          document_metadata_corrected: "Metadata corrected",
          document_ingestion_failed: "Processing failed",
          document_ingestion_retried: "Processing restarted",
          document_deleted: "Document deleted",
          metadata_corrected: "Metadata corrected",
          document_integrate: "Included by human decision",
          document_verify: "Review requested",
          document_reject: "Document rejected",
        },
      },
      evaluation: {
        eyebrow: "Framework and evaluation",
        loadError: "Unable to load evaluation data.",
        back: "Back to pillars",
        openPillar: "Open pillar",
        viewEvidence: "View evidence",
        nonConcluded: "Not concluded",
        brief: {
          title: "Framework brief",
          description:
            "Review the approach selected for this evaluation: framework, cycle, instrument, complexity, nature, methods and applied criteria.",
          version: "Version {{version}}",
          status: {
            proposed: "Proposed",
            modified: "Modified",
            confirmed: "Confirmed",
          },
          confirmedAt: "Approach confirmed on {{date}}",
          updatedAt: "Last updated on {{date}}",
          approachTitle: "Selected approach",
          criteriaTitle: "Applied criteria",
          empty: "No approach selected yet",
          emptyDescription:
            "The brief will appear once the evaluation approach is confirmed for this workspace.",
          configure: "Define the approach",
        },
        framework: {
          title: "Framework pillars",
          methodsBanner: {
            title: "Pillars derived from the recommended methods",
            meta: "Approach v{{version}} · {{cycle}}",
            link: "View the approach",
          },
          description:
            "Review the evaluation structure, observable variables and weight of each pillar.",
          templateNotice:
            "The tailored generation is not available yet. The cycle-specific reference framework is shown as a fallback template.",
          pillarName: "Pillar name",
          referential: "Reference",
          new: "New",
          variables: "Observable variables",
          otherCriteria: "+ {{count}} more",
          weight: "Weight",
          decreaseWeight: "Decrease weight",
          increaseWeight: "Increase weight",
          remove: "Remove pillar",
          totalWeight: "Total weight",
          balanceWeights: "Balance to 100%",
          add: "Add pillar",
          addTitle: "Add a pillar manually",
          addDescription:
            "Define the pillar content before adding it to the evaluation framework.",
          pillarDescription: "Description",
          weightPercent: "Weight (%)",
          weightHint:
            "After adding it, adjust the weights to reach a total of 100%.",
          criteria: "Related criteria",
          criteriaHint: "Select at least one criterion.",
          variablesPlaceholder:
            "One variable per line\nE.g. Effective access to services",
          variablesHint: "Add at least one variable, one per line.",
          cancel: "Cancel",
          addAction: "Add to framework",
          validate: "Validate framework",
          validated: "The evaluation framework was validated.",
          validationError: "Unable to validate the framework.",
        },
        criteria: {
          title: "Criteria and questions",
          description:
            "Review the applicable criteria and sub-questions selected for this evaluation.",
          addQuestion: "Add question",
          empty: "No question grid generated",
          emptyDescription:
            "Criteria and sub-questions will appear after the framework is generated and validated.",
          noExpectedEvidence: "Expected evidence not specified",
          inactive: "Not selected ({{count}})",
          noneInactive: "No disabled questions.",
          confirm: "Confirm criteria",
        },
        applicability: {
          obligatoire: "Required",
          optionnel: "Optional",
          prospectif: "Prospective",
          non_applicable: "Not applicable",
        },
        analysis: {
          title: "Overall comparison",
          description:
            "Consolidated view of objective scores, evaluative findings, alerts and evidence from the latest run.",
          noRun: "No analysis available",
          noRunDescription:
            "A run can start once the framework is validated and the corpus reaches the minimum mass.",
          launch: "Start analysis",
          running: "Analysis in progress",
          runningDescription:
            "Processing continues in the background. You may leave this screen.",
          averageScore: "Average A score",
          scoreDescription: "Objective score out of 100",
          concludedCriteria: "Concluded B criteria",
          criteriaDescription: "Criteria supported by sufficient evidence",
          pendingAlerts: "C alerts to review",
          alertsDescription: "Contradictions still requiring review",
          traceability: "Evidence traceability",
          traceabilityDescription: "Outputs linked to source excerpts",
          runReference: "Run {{id}} · {{date}}",
          steps: {
            classification: "Segment classification",
            variables: "Intermediate variable calculation",
            layerA: "Layer A · objective scores",
            layerB: "Layer B · evaluative findings",
            layerC: "Layer C · consistency alerts",
            reporting: "Reporting and audit logging",
          },
        },
        evolution: {
          renforce: "Strengthened",
          maintenu: "Maintained",
          affaibli: "Weakened",
        },
        layerA: {
          title: "Layer A · Pillars",
          description: "Factual scores by pillar and observable variables.",
          bannerTitle: "Layer A · Objective",
          bannerDescription:
            "What factually changed, measured through observable elements. No judgement.",
          objectiveScore: "Objective score",
          variables: "Observable variables",
          noVariables: "No variables were calculated for this pillar.",
        },
        variableState: {
          present: "Present",
          partiel: "Partial",
          absent: "Absent",
          non_renseigne: "Not documented",
        },
        layerB: {
          title: "Layer B · Criteria",
          description:
            "Criterion-based ratings and documentary coverage of sub-questions.",
          bannerTitle: "Layer B · Evaluative",
          bannerDescription:
            "Assessment framed by criteria and sub-questions. Never an unrestricted opinion.",
          documented: "documented",
          ambiguous: "Conflicting evidence — open to review both sides",
          empty: "No evaluative rating is available for this run.",
        },
        answerStatus: {
          documentee: "Documented",
          non_documentee: "Not documented",
        },
        alerts: {
          title: "Consistency alerts",
          description:
            "Gaps detected between factual findings and evaluative assessments.",
          bannerTitle: "Layer C · Consistency",
          bannerDescription:
            "Alerts flag contradictions for review. They never alter scores.",
          comment: "Review comment",
          markInstructed: "Mark reviewed",
          saved: "The alert was reviewed and commented.",
          saveError: "Unable to save the review.",
          empty: "No consistency alerts for this run.",
        },
        severity: { mineure: "Minor", majeure: "Major" },
        alertStatus: {
          a_instruire: "To review",
          instruite: "Reviewed",
        },
        evidence: {
          title: "Evidence",
          position: "Evidence {{current}}/{{total}}",
          unavailable: "Evidence unavailable",
          document: "Source document",
          page: "Page",
          section: "Section",
          context: "Evaluated element",
          confidence: "Corpus confidence",
          primary: "Primary excerpt",
          previous: "Previous",
          next: "Next",
          openDocument: "Open in document",
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
