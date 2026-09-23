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
          actions: "Actions",
        },
        actions: {
          open: "Ouvrir la fiche",
          integrate: "Ajouter quand même",
          verify: "Marquer à vérifier",
          reject: "Rejeter",
        },
        errors: {
          load: "Impossible de charger le corpus documentaire.",
          update: "La modification du document a échoué.",
        },
        import: {
          title: "Import documentaire",
          description:
            "Ajoutez plusieurs fichiers avec des métadonnées communes. Leur contenu sera ensuite qualifié avant d'alimenter l'analyse.",
          dropTitle: "Déposez vos documents ici",
          dropDescription: "PDF, DOCX ou XLSX · sélection multiple autorisée",
          invalidFormat: "Seuls les fichiers PDF, DOCX et XLSX sont acceptés.",
          category: "Catégorie commune",
          country: "Pays cible (pré-rempli)",
          version: "Version de rattachement",
          selectVersion: "Sélectionnez une version",
          submit: "Charger les documents",
          openReview: "Ouvrir la revue documentaire",
          remove: "Retirer le fichier",
          processingNote:
            "Après le chargement, les documents restent « À vérifier » jusqu'à la fin du traitement d'extraction, de détection et de pertinence.",
          success:
            "Les documents ont été chargés et ajoutés à la file de traitement.",
          failure:
            "Un ou plusieurs documents n'ont pas pu être chargés. Vous pouvez les relancer.",
          state: {
            ready: "Prêt à charger",
            uploading: "Chargement en cours",
            complete: "Chargé · traitement en attente",
            error: "Échec du chargement",
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
        framework: {
          title: "Piliers du cadre",
          description:
            "Vérifiez la structure de l'évaluation, ses variables observables et la pondération de chaque pilier.",
          templateNotice:
            "La génération personnalisée n'est pas encore disponible. Le référentiel applicable au cycle est affiché comme gabarit de secours.",
          pillarName: "Nom du pilier",
          referential: "Référentiel",
          new: "Nouveau",
          variables: "Variables observables",
          weight: "Pondération",
          remove: "Supprimer le pilier",
          totalWeight: "Somme des pondérations",
          add: "Ajouter un pilier",
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
          actions: "Actions",
        },
        actions: {
          open: "Open details",
          integrate: "Include anyway",
          verify: "Mark for review",
          reject: "Reject",
        },
        errors: {
          load: "Unable to load the document corpus.",
          update: "The document could not be updated.",
        },
        import: {
          title: "Document import",
          description:
            "Add several files with shared metadata. Their content will be qualified before it can feed the analysis.",
          dropTitle: "Drop your documents here",
          dropDescription: "PDF, DOCX or XLSX · multiple selection supported",
          invalidFormat: "Only PDF, DOCX and XLSX files are accepted.",
          category: "Shared category",
          country: "Target country (pre-filled)",
          version: "Programme version",
          selectVersion: "Select a version",
          submit: "Upload documents",
          openReview: "Open document review",
          remove: "Remove file",
          processingNote:
            "After upload, documents remain in “Needs review” until extraction, detection and relevance processing is complete.",
          success:
            "The documents were uploaded and added to the processing queue.",
          failure:
            "One or more documents could not be uploaded. You can retry them.",
          state: {
            ready: "Ready to upload",
            uploading: "Uploading",
            complete: "Uploaded · processing pending",
            error: "Upload failed",
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
        framework: {
          title: "Framework pillars",
          description:
            "Review the evaluation structure, observable variables and weight of each pillar.",
          templateNotice:
            "The tailored generation is not available yet. The cycle-specific reference framework is shown as a fallback template.",
          pillarName: "Pillar name",
          referential: "Reference",
          new: "New",
          variables: "Observable variables",
          weight: "Weight",
          remove: "Remove pillar",
          totalWeight: "Total weight",
          add: "Add pillar",
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
