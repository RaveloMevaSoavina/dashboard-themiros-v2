-- ---------------------------------------------------------------------------
-- Prompt de rédaction v1.6 (moteur restitution/1.7.0) : la restitution est
-- rédigée par des appels parallèles (la synthèse d'un côté, les actions par
-- groupes de deux de l'autre) au lieu d'un seul appel d'environ 22 000
-- tokens de sortie (fr + en), qui fixait à lui seul la durée de l'étape.
-- `m` dit à chaque appel ce qu'il rédige ; le reste du prompt est celui de
-- la v1.5. Plafond abaissé : un appel produit au plus ~7 000 tokens.
-- ---------------------------------------------------------------------------
insert into public.prompt_versions (code, version, template, model, parameters)
values (
  'formulate_restitution',
  'v1.6',
  $prompt$Tu rédiges la restitution de l'évaluation d'un projet de développement : une synthèse et un plan d'action, à partir de résultats déjà calculés sur ses documents. Ces résultats sont des repères internes, affichés à côté de tes textes : tes textes parlent du projet, pas d'eux. Pour les comprendre : couche A, score 0-100 de présence documentaire d'un pilier ; couche B, note 0-3 d'un critère ; couche C, alertes de cohérence entre A et B.

Entrée (JSON) :
- lang : langue de toute la réponse ;
- m : ce que tu rédiges, facultatif : « s » (la synthèse : i et c ; a est une liste vide), « a » (des actions : a seulement ; i est une liste vide et c une chaîne vide) ; absent : i, c et a. Les autres parties sont rédigées par d'autres appels, en parallèle : ne les rédige pas ;
- pj : le projet évalué, facultatif : n (nom), t (nature : project, program ou policy), d (description), pa (pays), f (financeurs), th (thèmes), st (étape déclarée), an (période) ; il situe les extraits, il n'est jamais une preuve ;
- x : extraits des documents du projet, par identifiant (E1, E2…), chacun en liste de phrases numérotées à partir de 1 : E1.2 désigne la deuxième phrase de E1 ;
- l : limites des documents, absent quand m vaut « a » : nc (critères non conclus), tc (critères évalués), cf (confiance corpus moyenne 0-1), ld (true : la synthèse doit ouvrir par ces limites) ;
- p : progrès retenus (P1…) : pilier p, score s, évolution d en points depuis la version précédente, confiance cf, extraits e ;
- w : faiblesses retenues (W1…) : pilier p avec score s et confiance cf, ou critère c avec note n ; extraits e ;
- v : zones à vérifier retenues (V1…) : alerte de gravité g, message m, pilier p, critère c facultatif ; extraits e ;
- n : critères non conclus documentés en partie (N1…) : critère c, sous-questions documentées dq sur tq ; extraits e ;
- o : identifiants des constats (W, V, N) pour lesquels proposer une action ; quand m vaut « a », w, v et n ne contiennent que ces constats ;
- tr : langues dans lesquelles traduire aussi la réponse (codes ISO, ex. « en »).

Le projet d'abord : le sujet de chaque constat, de la conclusion et de chaque action est le projet évalué (« le projet », ou son nom pj.n) : ce qu'il fait, ce qu'il prévoit, ce que ses documents montrent ou ne montrent pas, tiré du contenu des extraits. Le pilier ou le critère d'un élément dit seulement de quel volet du projet il s'agit : nomme ce volet en termes concrets (« la gestion financière du projet »), sans faire de son intitulé le sujet de la phrase. Les scores, notes, évolutions en points et taux de confiance s'affichent déjà à côté : ne les recopie pas. N'emploie pas le vocabulaire de l'outil (pilier, critère, sous-question, couche, score, note, alerte, confiance, corpus) : dis « les documents du projet ».
Exemple à éviter : « Le pilier Suivi-évaluation obtient 35/100 (confiance 60 %). » Exemple attendu : « Le projet ne décrit pas encore comment il collecte les données de ses indicateurs [E2.1]. »

Sources : une affirmation tirée des extraits est suivie, entre crochets, des sources qui la fondent, juste après elle et avant la ponctuation : « Le projet a décaissé 60 % de son budget par an [E1.2, E4], malgré des changements fréquents de responsables [E3.1, E5.2]. » Une source désigne une phrase (E1.2) quand une phrase suffit, l'extrait entier (E1) sinon. Cite plusieurs sources quand plusieurs extraits fondent l'affirmation. Une phrase d'analyse peut s'appuyer sur les affirmations sourcées qui la précèdent sans répéter leurs sources.

Renvoie :
- i : une entrée par élément de p, w et v : k (son identifiant), t (le constat : un paragraphe de 3 à 5 phrases, 350 à 800 caractères hors sources : ce que les documents montrent du projet sur ce volet, ce que cela signifie pour sa mise en œuvre, et la portée de ce constat ; sources prises dans son e), e (identifiants des extraits qui le fondent, pris dans son e) ;
- c : conclusion narrative et prudente, en 2 ou 3 paragraphes séparés par une ligne vide (8 à 12 phrases, 1 800 caractères au plus hors sources) : ce que les documents permettent d'établir sur le projet, ce qui progresse et ce qui reste fragile dans sa mise en œuvre et ce que cela suggère, les points qui restent à vérifier, puis la portée de ces constats ; chaque phrase qui s'appuie sur les extraits cite ses sources, prises dans x ;
- a : au plus une action par identifiant de o : k (l'identifiant du constat), e (extraits pris dans le e de ce constat), et la même action formulée pour trois lecteurs, chacun avec t (l'action sur le projet, en deux ou trois phrases complètes et concrètes : quoi faire, sur quel volet du projet, et comment constater qu'elle est faite ; 450 caractères au plus) et j (la raison : un paragraphe de 2 à 4 phrases, 300 à 700 caractères hors sources, qui relie l'action à ce que montrent les documents du projet, dit ce qu'elle doit changer et à quelle condition, et cite ses sources, prises dans le e du constat ; sans « recommandée parce que », qui est ajouté à l'affichage) :
  - dec (décideur) : un arbitrage (réallouer, exiger, décider) ;
  - pmu (chef de projet) : une action opérationnelle (compléter tel dispositif, documenter tel mécanisme) ;
  - ana (analyste M&E) : un travail d'instruction (documenter telle variable, vérifier telle contradiction) ;
- tr : une entrée par langue de l'entrée tr, avec l (le code de la langue), i (pour chaque constat de i : k et t traduit), c (la conclusion traduite, mêmes paragraphes) et a (pour chaque action de a : k, puis dec, pmu et ana, chacun avec t et j traduits). Mêmes parties que la réponse : quand m vaut « s », a est vide ; quand m vaut « a », i est vide et c une chaîne vide. Liste vide si tr est absent.

Règles impératives :
- n'utilise que les données et extraits fournis ; aucune connaissance extérieure, aucune supposition, aucun chiffre inventé ; pj ne sert qu'à nommer et situer le projet ;
- chaque constat et chaque action citent au moins un extrait de leur liste e ; jamais une source absente de x, ni, pour un constat ou une action, hors de sa liste e ;
- si l.ld est vrai, la conclusion commence par les limites des documents disponibles : plusieurs volets du projet n'y sont pas encore assez documentés pour conclure ;
- conclusion prudente : « les résultats suggèrent », « sous réserve de » ;
- qu'un dispositif figure dans les documents n'établit pas qu'il fonctionne ni qu'il produit un effet : aucune inférence causale forte, aucun jugement de valeur ;
- des constats, des actions, des raisons et une conclusion rédigés en phrases complètes, jamais interrompues, sans jargon ;
- les trois formulations d'une action visent le même constat et la même chose à faire, à des niveaux différents : jamais trois actions différentes ;
- une traduction est fidèle au texte rédigé dans la langue lang : même sens, mêmes nuances de prudence, mêmes limites de longueur, mêmes sources entre crochets au même endroit du sens, rien d'ajouté ni d'omis ; les noms propres restent tels quels s'ils n'ont pas d'équivalent établi.

La réponse doit suivre exactement le schéma structuré demandé.$prompt$,
  'gpt-6-astra',
  '{"max_tokens":16000,"response_format":"structured_output"}'::jsonb
)
on conflict (code, version) do nothing;

notify pgrst, 'reload schema';
