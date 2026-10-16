-- ---------------------------------------------------------------------------
-- Référentiel des sous-questions évaluatives par critère (étape 1).
--
-- Source : « Complément au dossier de traduction produit », §6 « Référentiel
-- des questions évaluatives par critère » (100 sous-questions, 8 critères).
-- Les identifiants (P-01, C-08…) sont ceux du document : ils sont stables et
-- portent la comparabilité entre espaces (RG-3b.4).
--
-- Correspondance des colonnes du document :
--   Cycles  EA/EC/MP/FI/EP -> ex_ante/en_cours/mi_parcours/finale/ex_post ;
--           « Tous » -> les cinq cycles.
--   Modules 1/2/3 -> M1/M2/M3 ; « Tous » -> M1, M2, M3 ;
--           « MP× » (sous-type multi-pays) -> M2 restreint au sous-type
--           programme_regional_multi_pays (colonne applicable_subtypes).
--   Couche  A / B / A+B -> 'A' / 'B' / 'A_B'.
--
-- Cette migration ne crée pas les sous-questions des évaluations
-- (public.sub_questions) : le filtrage par cycle, module et sous-type lors de
-- la génération du cadre relève de l'étape suivante.
-- ---------------------------------------------------------------------------

alter table public.ref_questions
  add column if not exists applicable_subtypes text[];

comment on column public.ref_questions.applicable_subtypes is
  'Instrument subtypes the question is restricted to; null means every subtype of the applicable modules.';

alter table public.ref_questions
  drop constraint if exists ref_questions_cycles_check;
alter table public.ref_questions
  add constraint ref_questions_cycles_check check (
    cardinality(applicable_cycles) > 0
    and applicable_cycles <@ array[
      'ex_ante',
      'en_cours',
      'mi_parcours',
      'finale',
      'ex_post'
    ]::text[]
  );

alter table public.ref_questions
  drop constraint if exists ref_questions_modules_check;
alter table public.ref_questions
  add constraint ref_questions_modules_check check (
    cardinality(applicable_modules) > 0
    and applicable_modules <@ array['M1', 'M2', 'M3']::text[]
  );

alter table public.ref_questions
  drop constraint if exists ref_questions_subtypes_not_empty;
alter table public.ref_questions
  add constraint ref_questions_subtypes_not_empty check (
    applicable_subtypes is null or cardinality(applicable_subtypes) > 0
  );

create table if not exists public.ref_question_translations (
  question_id uuid not null
    references public.ref_questions (id) on delete cascade,
  locale text not null,
  text text not null,
  expected_evidence text,
  created_at timestamptz not null default now(),
  primary key (question_id, locale),
  constraint ref_question_translations_locale_check check (
    locale in ('fr', 'en', 'pt', 'es')
  ),
  constraint ref_question_translations_text_not_blank check (
    btrim(text) <> ''
  )
);

create index if not exists idx_ref_question_translations_locale
  on public.ref_question_translations (locale);

alter table public.ref_question_translations enable row level security;

drop policy if exists "ref_question_translations_select_authenticated"
  on public.ref_question_translations;
create policy "ref_question_translations_select_authenticated"
  on public.ref_question_translations
  for select
  to authenticated
  using (true);

comment on table public.ref_question_translations is
  'Localized sub-question text and expected evidence for versioned reference questions.';

-- Données canoniques (français), version alignée sur ref_criteria.
insert into public.ref_questions (
  code,
  criterion_code,
  text,
  applicable_cycles,
  applicable_modules,
  applicable_subtypes,
  layer,
  expected_evidence,
  version
)
select
  question.code,
  question.criterion_code,
  question.text,
  question.applicable_cycles,
  question.applicable_modules,
  question.applicable_subtypes,
  question.layer,
  question.expected_evidence,
  '2026-09'
from (
  values
    ('P-01', 'pertinence', 'L''analyse du problème et du contexte est-elle documentée et fondée sur des données ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Diagnostic, étude de faisabilité, document de programme'),
    ('P-02', 'pertinence', 'Les objectifs répondent-ils aux besoins et priorités des bénéficiaires finaux ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Analyse des besoins, comptes rendus de consultation'),
    ('P-03', 'pertinence', 'Les groupes cibles sont-ils identifiés, caractérisés et justifiés ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Critères de ciblage et d''éligibilité'),
    ('P-04', 'pertinence', 'L''intervention est-elle alignée sur les politiques et stratégies nationales et sectorielles ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Références aux politiques nationales'),
    ('P-05', 'pertinence', 'L''intervention est-elle alignée sur les priorités et le cadre stratégique du financeur ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Cadre stratégique du financeur, note d''approbation'),
    ('P-06', 'pertinence', 'La théorie du changement explicite-t-elle la chaîne causale et ses hypothèses ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Théorie du changement, cadre logique'),
    ('P-07', 'pertinence', 'Les hypothèses et risques critiques sont-ils identifiés et suivis ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Registre des risques, cadre logique'),
    ('P-08', 'pertinence', 'La conception tire-t-elle les leçons d''interventions antérieures ?', array['ex_ante', 'en_cours'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Section leçons apprises, évaluations antérieures'),
    ('P-09', 'pertinence', 'La pertinence a-t-elle été maintenue face aux évolutions du contexte (crises, changements politiques, climat) ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Rapports annuels, revues'),
    ('P-10', 'pertinence', 'L''intervention a-t-elle été ajustée lorsque les besoins ont changé ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Avenants, restructurations, procès-verbaux'),
    ('P-11', 'pertinence', 'La conception est-elle adaptée aux capacités des partenaires de mise en œuvre ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M2', 'M3'], null::text[], 'B', 'Analyse de capacités, arrangements de mise en œuvre'),
    ('P-12', 'pertinence', 'Les vulnérabilités climatiques ciblées sont-elles étayées par une analyse (aléas, exposition, sensibilité) ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Analyse de vulnérabilité, étude climatique'),
    ('P-13', 'pertinence', 'La demande émane-t-elle des acteurs nationaux (appropriation dès la conception) ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Lettres d''endossement, processus de formulation'),
    ('P-14', 'pertinence', 'La politique répond-elle aux engagements internationaux et aux obligations du pays ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1'], null::text[], 'B', 'Traités, cadres internationaux cités'),
    ('C-01', 'coherence', 'Les composantes sont-elles cohérentes entre elles et avec l''objectif global ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Cadre logique, document de programme'),
    ('C-02', 'coherence', 'L''intervention est-elle cohérente avec les autres interventions de la même organisation ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Portefeuille, stratégie pays du financeur'),
    ('C-03', 'coherence', 'L''intervention s''articule-t-elle avec celles d''autres bailleurs et acteurs (complémentarité, absence de doublon) ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Cartographie des acteurs et des interventions'),
    ('C-04', 'coherence', 'Des mécanismes de coordination avec les autres acteurs sont-ils prévus et fonctionnels ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Comptes rendus de coordination, protocoles'),
    ('C-05', 'coherence', 'L''intervention respecte-t-elle les normes et standards internationaux applicables (droits humains, environnement, climat) ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Sauvegardes, normes citées'),
    ('C-06', 'coherence', 'L''intervention est-elle cohérente avec le cadre juridique et institutionnel national ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Textes juridiques, arrangements institutionnels'),
    ('C-07', 'coherence', 'Les niveaux d''intervention (national, régional, local) sont-ils articulés ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Dispositif de mise en œuvre'),
    ('C-08', 'coherence', 'Les interventions dans plusieurs pays ou zones sont-elles cohérentes entre elles ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M2'], array['programme_regional_multi_pays'], 'B', 'Rapports régionaux, cadre commun'),
    ('C-09', 'coherence', 'L''intervention apporte-t-elle une valeur ajoutée par rapport à ce que les acteurs auraient fait seuls ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Justification de l''intervention (angle UE)'),
    ('C-10', 'coherence', 'Les synergies prévues avec d''autres interventions se sont-elles matérialisées ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Rapports d''avancement, revues'),
    ('C-11', 'coherence', 'La politique est-elle cohérente avec les autres politiques sectorielles et les plans nationaux ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1'], null::text[], 'B', 'Politiques et plans cités'),
    ('C-12', 'coherence', 'Les modalités de l''aide sont-elles harmonisées avec les systèmes nationaux (procédures, budget) ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M2', 'M3'], null::text[], 'B', 'Accord de financement, manuel de procédures'),
    ('E-01', 'efficacite', 'Les produits prévus ont-ils été livrés dans les quantités et la qualité attendues ?', array['en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Rapports d''avancement, cadre de résultats'),
    ('E-02', 'efficacite', 'Les effets directs sont-ils atteints ou en voie de l''être par rapport aux cibles ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Cadre de résultats, données de suivi'),
    ('E-03', 'efficacite', 'Les indicateurs d''effet disposent-ils de cibles, de valeurs de référence et de données ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A', 'Cadre de résultats'),
    ('E-04', 'efficacite', 'Les objectifs sont-ils réalistes et atteignables dans le délai imparti ?', array['ex_ante'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Document de programme, calendrier'),
    ('E-05', 'efficacite', 'Quels facteurs internes ont favorisé ou entravé l''atteinte des résultats ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Rapports, revues, évaluations'),
    ('E-06', 'efficacite', 'Quels facteurs externes ont influé sur les résultats ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Analyse de contexte, rapports'),
    ('E-07', 'efficacite', 'Les résultats varient-ils selon les groupes (sexe, âge, territoire, vulnérabilité) ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Données désagrégées'),
    ('E-08', 'efficacite', 'Les bénéficiaires atteints correspondent-ils aux cibles (nombre, profil) ?', array['en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M2', 'M3'], null::text[], 'A_B', 'Registres de bénéficiaires, rapports'),
    ('E-09', 'efficacite', 'Les retards ou écarts d''exécution ont-ils été expliqués et traités ?', array['en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Rapports d''avancement, procès-verbaux'),
    ('E-10', 'efficacite', 'La qualité des produits est-elle attestée (normes, satisfaction, contrôles) ?', array['mi_parcours', 'finale', 'ex_post'], array['M2', 'M3'], null::text[], 'B', 'Enquêtes de satisfaction, contrôles qualité'),
    ('E-11', 'efficacite', 'Les changements de comportement ou de pratiques visés sont-ils observés ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Enquêtes, études de cas'),
    ('E-12', 'efficacite', 'Les capacités institutionnelles visées ont-elles été renforcées ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Évaluations de capacités, rapports'),
    ('E-13', 'efficacite', 'Les instruments de la politique (textes, dispositifs) ont-ils été adoptés et mis en œuvre ?', array['en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1'], null::text[], 'A_B', 'Textes adoptés, rapports de mise en œuvre'),
    ('E-14', 'efficacite', 'Des résultats non prévus, positifs ou négatifs, sont-ils apparus ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Rapports, récolte des effets'),
    ('F-01', 'efficience', 'Le budget est-il réaliste et détaillé par composante et par catégorie ?', array['ex_ante'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Budget, document de programme'),
    ('F-02', 'efficience', 'Le taux de décaissement est-il conforme au calendrier prévu ?', array['en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M2', 'M3'], null::text[], 'A', 'Rapports financiers'),
    ('F-03', 'efficience', 'Le taux d''absorption des fonds est-il satisfaisant ?', array['mi_parcours', 'finale', 'ex_post'], array['M2', 'M3'], null::text[], 'A', 'Rapports financiers, audits'),
    ('F-04', 'efficience', 'Le coût par produit ou par bénéficiaire est-il raisonnable au regard de références comparables ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Rapports financiers, références sectorielles'),
    ('F-05', 'efficience', 'Les activités ont-elles été réalisées dans les délais prévus ?', array['en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Plan de travail, rapports d''avancement'),
    ('F-06', 'efficience', 'Les ressources humaines et l''organisation de gestion sont-elles adaptées au volume d''activités ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Organigramme, arrangements de gestion'),
    ('F-07', 'efficience', 'Les procédures de passation de marchés et de gestion financière ont-elles été efficaces et conformes ?', array['mi_parcours', 'finale', 'ex_post'], array['M2', 'M3'], null::text[], 'B', 'Audits, rapports de supervision'),
    ('F-08', 'efficience', 'Les coûts de gestion sont-ils proportionnés au budget total ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M2', 'M3'], null::text[], 'A', 'Budget, rapports financiers'),
    ('F-09', 'efficience', 'Des alternatives moins coûteuses ont-elles été considérées ?', array['ex_ante', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Étude de faisabilité, analyse d''options'),
    ('F-10', 'efficience', 'Une analyse coûts-bénéfices ou coût-efficacité a-t-elle été réalisée et actualisée ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Analyse économique'),
    ('F-11', 'efficience', 'Le cofinancement prévu a-t-il été mobilisé ?', array['mi_parcours', 'finale', 'ex_post'], array['M2', 'M3'], null::text[], 'A', 'Rapports financiers, conventions'),
    ('F-12', 'efficience', 'Les recommandations d''audit ont-elles été suivies d''effet ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Rapports d''audit, lettres de gestion'),
    ('F-13', 'efficience', 'Les moyens budgétaires et humains alloués à la politique sont-ils à la hauteur de ses objectifs ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1'], null::text[], 'B', 'Loi de finances, plan d''action budgétisé'),
    ('I-01', 'impact', 'Des changements de niveau supérieur (bien-être, résilience, revenus, environnement) sont-ils observés ?', array['finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Enquêtes d''impact, données de suivi'),
    ('I-02', 'impact', 'Les effets observés sont-ils plausiblement imputables à l''intervention (analyse de contribution) ?', array['finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Récit de contribution, preuves diagnostiques'),
    ('I-03', 'impact', 'Quelle est la part des facteurs externes et des autres interventions dans les effets ?', array['finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Analyse de contexte, explications rivales'),
    ('I-04', 'impact', 'Des effets négatifs ou non intentionnels sont-ils apparus ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Rapports, plaintes, récolte des effets'),
    ('I-05', 'impact', 'Les effets sont-ils répartis équitablement entre les groupes ?', array['finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Données désagrégées'),
    ('I-06', 'impact', 'L''intervention a-t-elle produit des changements systémiques ou transformationnels (normes, institutions, marchés) ?', array['finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Évaluations, études de cas'),
    ('I-07', 'impact', 'Les effets attendus sont-ils plausibles au vu de la logique d''intervention et de l''ampleur des moyens ?', array['ex_ante'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Théorie du changement, budget'),
    ('I-08', 'impact', 'Des signes précoces d''impact sont-ils documentés ?', array['mi_parcours'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Revue à mi-parcours'),
    ('I-09', 'impact', 'L''intervention a-t-elle été répliquée ou mise à l''échelle ?', array['finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Rapports, décisions d''extension'),
    ('I-10', 'impact', 'Les effets sur le climat et l''environnement (co-bénéfices, émissions, résilience) sont-ils documentés ?', array['finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Indicateurs environnementaux, rapports'),
    ('I-11', 'impact', 'Les bénéficiaires rapportent-ils des changements significatifs (changement le plus significatif) ?', array['finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Témoignages, récits collectés'),
    ('I-12', 'impact', 'La politique a-t-elle modifié les comportements des acteurs ciblés et les résultats sectoriels ?', array['finale', 'ex_post'], array['M1'], null::text[], 'B', 'Statistiques sectorielles, évaluations'),
    ('D-01', 'durabilite', 'Une stratégie de sortie ou de transfert est-elle définie et mise en œuvre ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M2', 'M3'], null::text[], 'A_B', 'Stratégie de sortie, document de programme'),
    ('D-02', 'durabilite', 'Les coûts récurrents sont-ils financés au-delà de l''intervention ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Budget national, engagements écrits'),
    ('D-03', 'durabilite', 'Les institutions nationales ou locales ont-elles les capacités pour poursuivre les activités ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Évaluations de capacités'),
    ('D-04', 'durabilite', 'L''appropriation par les bénéficiaires et les autorités est-elle démontrée ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Rapports, comptes rendus, engagements'),
    ('D-05', 'durabilite', 'Les acquis sont-ils ancrés dans des textes, budgets ou dispositifs pérennes ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Textes adoptés, lignes budgétaires'),
    ('D-06', 'durabilite', 'Les risques pour la pérennité (politiques, financiers, environnementaux, sociaux) sont-ils identifiés et atténués ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Registre des risques, stratégie de sortie'),
    ('D-07', 'durabilite', 'Les infrastructures ou équipements disposent-ils d''un dispositif d''entretien ?', array['mi_parcours', 'finale', 'ex_post'], array['M2', 'M3'], null::text[], 'B', 'Plans d''entretien, conventions'),
    ('D-08', 'durabilite', 'Les bénéfices se sont-ils maintenus après la clôture ?', array['ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Enquêtes ex-post, données de suivi'),
    ('D-09', 'durabilite', 'Les solutions sont-elles robustes aux scénarios climatiques futurs ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Analyse climatique, choix techniques'),
    ('D-10', 'durabilite', 'Les bénéfices environnementaux sont-ils durables (pas de dégradation induite) ?', array['finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Suivi environnemental'),
    ('D-11', 'durabilite', 'Les partenariats et réseaux créés perdurent-ils ?', array['finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Rapports, protocoles reconduits'),
    ('D-12', 'durabilite', 'La politique dispose-t-elle d''un ancrage institutionnel et budgétaire pérenne ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1'], null::text[], 'B', 'Textes organiques, loi de finances'),
    ('Q-01', 'equite', 'Une analyse de genre et d''inclusion a-t-elle été réalisée à la conception ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A', 'Analyse de genre'),
    ('Q-02', 'equite', 'Un plan d''action genre avec cibles et budget existe-t-il ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M2', 'M3'], null::text[], 'A', 'Plan d''action genre'),
    ('Q-03', 'equite', 'Les données sont-elles désagrégées par sexe et par groupe vulnérable ?', array['en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A', 'Cadre de résultats, rapports'),
    ('Q-04', 'equite', 'Les groupes les plus vulnérables sont-ils atteints proportionnellement à leurs besoins ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Données désagrégées, ciblage'),
    ('Q-05', 'equite', 'Les femmes et les groupes marginalisés participent-ils aux décisions ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Composition des instances, comptes rendus'),
    ('Q-06', 'equite', 'Existe-t-il un mécanisme de plaintes accessible ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M2', 'M3'], null::text[], 'A', 'Mécanisme de gestion des plaintes'),
    ('Q-07', 'equite', 'L''intervention évite-t-elle de nuire (déplacements, exclusion, charge de travail accrue) ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Sauvegardes sociales, rapports'),
    ('Q-08', 'equite', 'Les bénéfices sont-ils répartis équitablement entre territoires ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Données par zone'),
    ('Q-09', 'equite', 'Les personnes handicapées, les jeunes et les peuples autochtones sont-ils pris en compte ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Ciblage, sauvegardes'),
    ('Q-10', 'equite', 'Les inégalités structurelles sont-elles traitées (accès au foncier, au crédit, à l''information) ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Analyse de genre, composantes dédiées'),
    ('Q-11', 'equite', 'La politique prévoit-elle des mesures spécifiques pour les groupes défavorisés ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1'], null::text[], 'B', 'Dispositions du texte'),
    ('G-01', 'gestion_adaptative', 'Un système de suivi-évaluation (ou MRV) est-il défini avec indicateurs, sources, fréquence et responsables ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A', 'Plan de suivi-évaluation'),
    ('G-02', 'gestion_adaptative', 'Une situation de référence a-t-elle été établie ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A', 'Étude de référence'),
    ('G-03', 'gestion_adaptative', 'Les données de suivi sont-elles collectées régulièrement et de qualité ?', array['en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Rapports de suivi, contrôles qualité'),
    ('G-04', 'gestion_adaptative', 'Les rapports de suivi sont-ils produits dans les délais et utilisés ?', array['en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Rapports, accusés de réception, décisions'),
    ('G-05', 'gestion_adaptative', 'Les décisions de pilotage sont-elles fondées sur les données de suivi ?', array['en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Procès-verbaux de pilotage'),
    ('G-06', 'gestion_adaptative', 'Les recommandations des revues et évaluations ont-elles été mises en œuvre ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Réponse de la direction, suivi des recommandations'),
    ('G-07', 'gestion_adaptative', 'L''intervention a-t-elle été ajustée en réponse aux risques et aux évolutions du contexte ?', array['mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Avenants, plans révisés'),
    ('G-08', 'gestion_adaptative', 'Le registre des risques est-il tenu à jour ?', array['en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M2', 'M3'], null::text[], 'A', 'Registre des risques daté'),
    ('G-09', 'gestion_adaptative', 'Des boucles d''apprentissage (revues annuelles, leçons) sont-elles institutionnalisées ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'B', 'Revues annuelles, notes de leçons'),
    ('G-10', 'gestion_adaptative', 'Le comité de pilotage se réunit-il et prend-il des décisions ?', array['en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1', 'M2', 'M3'], null::text[], 'A_B', 'Procès-verbaux'),
    ('G-11', 'gestion_adaptative', 'Le budget prévoit-il des ressources dédiées au suivi-évaluation ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M2', 'M3'], null::text[], 'A', 'Budget'),
    ('G-12', 'gestion_adaptative', 'Un dispositif de suivi de la politique (observatoire, tableau de bord, rapport au parlement) existe-t-il ?', array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'], array['M1'], null::text[], 'A', 'Textes, rapports de suivi')
) as question(
  code,
  criterion_code,
  text,
  applicable_cycles,
  applicable_modules,
  applicable_subtypes,
  layer,
  expected_evidence
)
on conflict (code, version) do nothing;

-- French translations are derived from the canonical seed data.
insert into public.ref_question_translations (
  question_id,
  locale,
  text,
  expected_evidence
)
select
  question.id,
  'fr',
  question.text,
  question.expected_evidence
from public.ref_questions as question
where question.version = '2026-09'
on conflict (question_id, locale) do nothing;

-- English sub-question translations.
insert into public.ref_question_translations (
  question_id,
  locale,
  text,
  expected_evidence
)
select
  question.id,
  'en',
  translation.text,
  translation.expected_evidence
from (
  values
    ('P-01', 'Is the problem and context analysis documented and grounded in data?', 'Diagnostic, feasibility study, programme document'),
    ('P-02', 'Do the objectives respond to the needs and priorities of the final beneficiaries?', 'Needs assessment, consultation minutes'),
    ('P-03', 'Are the target groups identified, characterised and justified?', 'Targeting and eligibility criteria'),
    ('P-04', 'Is the intervention aligned with national and sectoral policies and strategies?', 'References to national policies'),
    ('P-05', 'Is the intervention aligned with the financier''s priorities and strategic framework?', 'Financier''s strategic framework, approval note'),
    ('P-06', 'Does the theory of change make the causal chain and its assumptions explicit?', 'Theory of change, logical framework'),
    ('P-07', 'Are critical assumptions and risks identified and monitored?', 'Risk register, logical framework'),
    ('P-08', 'Does the design draw on lessons from previous interventions?', 'Lessons-learned section, previous evaluations'),
    ('P-09', 'Has relevance been maintained as the context evolved (crises, political changes, climate)?', 'Annual reports, reviews'),
    ('P-10', 'Was the intervention adjusted when needs changed?', 'Amendments, restructurings, minutes'),
    ('P-11', 'Is the design suited to the capacities of the implementing partners?', 'Capacity assessment, implementation arrangements'),
    ('P-12', 'Are the targeted climate vulnerabilities supported by an analysis (hazards, exposure, sensitivity)?', 'Vulnerability assessment, climate study'),
    ('P-13', 'Does the request originate from national stakeholders (ownership from the design stage)?', 'Endorsement letters, formulation process'),
    ('P-14', 'Does the policy respond to the country''s international commitments and obligations?', 'Treaties, cited international frameworks'),
    ('C-01', 'Are the components consistent with one another and with the overall objective?', 'Logical framework, programme document'),
    ('C-02', 'Is the intervention consistent with the same organisation''s other interventions?', 'Portfolio, financier''s country strategy'),
    ('C-03', 'Does the intervention fit with those of other donors and stakeholders (complementarity, no duplication)?', 'Mapping of stakeholders and interventions'),
    ('C-04', 'Are coordination mechanisms with other stakeholders planned and functional?', 'Coordination minutes, protocols'),
    ('C-05', 'Does the intervention comply with applicable international norms and standards (human rights, environment, climate)?', 'Safeguards, cited standards'),
    ('C-06', 'Is the intervention consistent with the national legal and institutional framework?', 'Legal texts, institutional arrangements'),
    ('C-07', 'Are the levels of intervention (national, regional, local) linked together?', 'Implementation arrangements'),
    ('C-08', 'Are the interventions in several countries or areas consistent with one another?', 'Regional reports, common framework'),
    ('C-09', 'Does the intervention add value compared with what stakeholders would have done alone?', 'Rationale for the intervention (EU angle)'),
    ('C-10', 'Have the planned synergies with other interventions materialised?', 'Progress reports, reviews'),
    ('C-11', 'Is the policy consistent with other sectoral policies and national plans?', 'Cited policies and plans'),
    ('C-12', 'Are aid modalities harmonised with national systems (procedures, budget)?', 'Financing agreement, procedures manual'),
    ('E-01', 'Have the planned outputs been delivered in the expected quantity and quality?', 'Progress reports, results framework'),
    ('E-02', 'Have the outcomes been achieved, or are they on track, against the targets?', 'Results framework, monitoring data'),
    ('E-03', 'Do the outcome indicators have targets, baseline values and data?', 'Results framework'),
    ('E-04', 'Are the objectives realistic and achievable within the timeframe?', 'Programme document, timeline'),
    ('E-05', 'Which internal factors helped or hindered the achievement of results?', 'Reports, reviews, evaluations'),
    ('E-06', 'Which external factors influenced the results?', 'Context analysis, reports'),
    ('E-07', 'Do results vary across groups (sex, age, territory, vulnerability)?', 'Disaggregated data'),
    ('E-08', 'Do the beneficiaries reached match the targets (number, profile)?', 'Beneficiary registers, reports'),
    ('E-09', 'Have implementation delays or deviations been explained and addressed?', 'Progress reports, minutes'),
    ('E-10', 'Is the quality of outputs attested (standards, satisfaction, inspections)?', 'Satisfaction surveys, quality controls'),
    ('E-11', 'Are the targeted changes in behaviour or practice observed?', 'Surveys, case studies'),
    ('E-12', 'Have the targeted institutional capacities been strengthened?', 'Capacity assessments, reports'),
    ('E-13', 'Have the policy instruments (legal texts, mechanisms) been adopted and implemented?', 'Adopted texts, implementation reports'),
    ('E-14', 'Have unplanned results, positive or negative, emerged?', 'Reports, outcome harvesting'),
    ('F-01', 'Is the budget realistic and broken down by component and category?', 'Budget, programme document'),
    ('F-02', 'Is the disbursement rate in line with the planned schedule?', 'Financial reports'),
    ('F-03', 'Is the fund absorption rate satisfactory?', 'Financial reports, audits'),
    ('F-04', 'Is the cost per output or per beneficiary reasonable compared with similar benchmarks?', 'Financial reports, sectoral benchmarks'),
    ('F-05', 'Were activities carried out within the planned timeframe?', 'Work plan, progress reports'),
    ('F-06', 'Are human resources and the management set-up suited to the volume of activities?', 'Organisation chart, management arrangements'),
    ('F-07', 'Were procurement and financial management procedures effective and compliant?', 'Audits, supervision reports'),
    ('F-08', 'Are management costs proportionate to the total budget?', 'Budget, financial reports'),
    ('F-09', 'Were less costly alternatives considered?', 'Feasibility study, options analysis'),
    ('F-10', 'Has a cost-benefit or cost-effectiveness analysis been carried out and updated?', 'Economic analysis'),
    ('F-11', 'Has the planned co-financing been mobilised?', 'Financial reports, agreements'),
    ('F-12', 'Have audit recommendations been acted upon?', 'Audit reports, management letters'),
    ('F-13', 'Are the budgetary and human resources allocated to the policy commensurate with its objectives?', 'Finance act, costed action plan'),
    ('I-01', 'Are higher-level changes (well-being, resilience, income, environment) observed?', 'Impact surveys, monitoring data'),
    ('I-02', 'Can the observed effects plausibly be attributed to the intervention (contribution analysis)?', 'Contribution story, diagnostic evidence'),
    ('I-03', 'What share of the effects is due to external factors and other interventions?', 'Context analysis, rival explanations'),
    ('I-04', 'Have negative or unintended effects emerged?', 'Reports, complaints, outcome harvesting'),
    ('I-05', 'Are the effects distributed equitably across groups?', 'Disaggregated data'),
    ('I-06', 'Has the intervention produced systemic or transformational changes (norms, institutions, markets)?', 'Evaluations, case studies'),
    ('I-07', 'Are the expected effects plausible given the intervention logic and the scale of resources?', 'Theory of change, budget'),
    ('I-08', 'Are early signs of impact documented?', 'Mid-term review'),
    ('I-09', 'Has the intervention been replicated or scaled up?', 'Reports, scale-up decisions'),
    ('I-10', 'Are the effects on climate and the environment (co-benefits, emissions, resilience) documented?', 'Environmental indicators, reports'),
    ('I-11', 'Do beneficiaries report significant changes (most significant change)?', 'Testimonies, collected stories'),
    ('I-12', 'Has the policy changed the behaviour of targeted actors and sectoral outcomes?', 'Sectoral statistics, evaluations'),
    ('D-01', 'Is an exit or handover strategy defined and implemented?', 'Exit strategy, programme document'),
    ('D-02', 'Are recurrent costs financed beyond the intervention?', 'National budget, written commitments'),
    ('D-03', 'Do national or local institutions have the capacity to continue the activities?', 'Capacity assessments'),
    ('D-04', 'Is ownership by beneficiaries and authorities demonstrated?', 'Reports, minutes, commitments'),
    ('D-05', 'Are the achievements anchored in lasting legal texts, budgets or mechanisms?', 'Adopted texts, budget lines'),
    ('D-06', 'Are risks to sustainability (political, financial, environmental, social) identified and mitigated?', 'Risk register, exit strategy'),
    ('D-07', 'Do infrastructure or equipment have a maintenance arrangement?', 'Maintenance plans, agreements'),
    ('D-08', 'Have the benefits been sustained after closure?', 'Ex-post surveys, monitoring data'),
    ('D-09', 'Are the solutions robust to future climate scenarios?', 'Climate analysis, technical choices'),
    ('D-10', 'Are the environmental benefits lasting (no induced degradation)?', 'Environmental monitoring'),
    ('D-11', 'Do the partnerships and networks created endure?', 'Reports, renewed protocols'),
    ('D-12', 'Does the policy have lasting institutional and budgetary anchoring?', 'Organic laws, finance act'),
    ('Q-01', 'Was a gender and inclusion analysis carried out at the design stage?', 'Gender analysis'),
    ('Q-02', 'Is there a gender action plan with targets and a budget?', 'Gender action plan'),
    ('Q-03', 'Are data disaggregated by sex and by vulnerable group?', 'Results framework, reports'),
    ('Q-04', 'Are the most vulnerable groups reached in proportion to their needs?', 'Disaggregated data, targeting'),
    ('Q-05', 'Do women and marginalised groups take part in decision-making?', 'Composition of governing bodies, minutes'),
    ('Q-06', 'Is there an accessible grievance mechanism?', 'Grievance redress mechanism'),
    ('Q-07', 'Does the intervention do no harm (displacement, exclusion, increased workload)?', 'Social safeguards, reports'),
    ('Q-08', 'Are benefits distributed equitably across territories?', 'Data by area'),
    ('Q-09', 'Are people with disabilities, young people and indigenous peoples taken into account?', 'Targeting, safeguards'),
    ('Q-10', 'Are structural inequalities addressed (access to land, credit, information)?', 'Gender analysis, dedicated components'),
    ('Q-11', 'Does the policy provide specific measures for disadvantaged groups?', 'Provisions of the text'),
    ('G-01', 'Is a monitoring and evaluation (or MRV) system defined with indicators, sources, frequency and responsibilities?', 'Monitoring and evaluation plan'),
    ('G-02', 'Has a baseline been established?', 'Baseline study'),
    ('G-03', 'Are monitoring data collected regularly and of good quality?', 'Monitoring reports, quality controls'),
    ('G-04', 'Are monitoring reports produced on time and used?', 'Reports, acknowledgements of receipt, decisions'),
    ('G-05', 'Are steering decisions based on monitoring data?', 'Steering committee minutes'),
    ('G-06', 'Have the recommendations of reviews and evaluations been implemented?', 'Management response, recommendation tracking'),
    ('G-07', 'Was the intervention adjusted in response to risks and changes in context?', 'Amendments, revised plans'),
    ('G-08', 'Is the risk register kept up to date?', 'Dated risk register'),
    ('G-09', 'Are learning loops (annual reviews, lessons) institutionalised?', 'Annual reviews, lessons notes'),
    ('G-10', 'Does the steering committee meet and take decisions?', 'Minutes'),
    ('G-11', 'Does the budget provide dedicated resources for monitoring and evaluation?', 'Budget'),
    ('G-12', 'Is there a policy monitoring system (observatory, dashboard, report to parliament)?', 'Legal texts, monitoring reports')
) as translation(code, text, expected_evidence)
join public.ref_questions as question
  on question.code = translation.code
  and question.version = '2026-09'
on conflict (question_id, locale) do nothing;

-- Garde-fous : chaque question pointe vers un critère du référentiel, et le
-- référentiel 2026-09 est complet dans les deux langues.
do $$
declare
  orphan_codes text;
  question_count integer;
  translation_count integer;
begin
  select string_agg(question.code, ', ' order by question.code)
  into orphan_codes
  from public.ref_questions as question
  where question.version = '2026-09'
    and not exists (
      select 1
      from public.ref_criteria as criterion
      where criterion.code = question.criterion_code
        and criterion.version = question.version
    );

  if orphan_codes is not null then
    raise exception 'Reference questions without a matching criterion: %',
      orphan_codes;
  end if;

  select count(*)
  into question_count
  from public.ref_questions
  where version = '2026-09';

  select count(*)
  into translation_count
  from public.ref_question_translations as translation
  join public.ref_questions as question
    on question.id = translation.question_id
  where question.version = '2026-09'
    and translation.locale in ('fr', 'en');

  if question_count <> 100 or translation_count <> 200 then
    raise exception
      'Expected 100 reference questions and 200 translations, got % and %',
      question_count,
      translation_count;
  end if;
end
$$;
