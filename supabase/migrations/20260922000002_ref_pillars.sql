do $$
begin
  create type public.instrument_module as enum ('M1', 'M2', 'M3');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.ref_pillars (
  id uuid primary key default gen_random_uuid(),
  module public.instrument_module not null,
  code text not null,
  name text not null,
  description text not null,
  criteria_codes text[] not null,
  observable_variables jsonb not null,
  applicable_cycles text[] not null,
  default_weight numeric(5, 2) not null,
  version text not null,
  created_at timestamptz not null default now(),
  constraint ref_pillars_module_code_version_unique
    unique (module, code, version),
  constraint ref_pillars_code_not_blank check (btrim(code) <> ''),
  constraint ref_pillars_name_not_blank check (btrim(name) <> ''),
  constraint ref_pillars_description_not_blank check (btrim(description) <> ''),
  constraint ref_pillars_version_not_blank check (btrim(version) <> ''),
  constraint ref_pillars_criteria_not_empty check (
    cardinality(criteria_codes) > 0
  ),
  constraint ref_pillars_criteria_codes_check check (
    criteria_codes <@ array[
      'pertinence',
      'coherence',
      'efficacite',
      'efficience',
      'impact',
      'durabilite',
      'equite',
      'gestion_adaptative'
    ]::text[]
  ),
  constraint ref_pillars_observable_variables_array_check check (
    jsonb_typeof(observable_variables) = 'array'
    and jsonb_array_length(observable_variables) > 0
  ),
  constraint ref_pillars_cycles_not_empty check (
    cardinality(applicable_cycles) > 0
  ),
  constraint ref_pillars_applicable_cycles_check check (
    applicable_cycles <@ array[
      'ex_ante',
      'en_cours',
      'mi_parcours',
      'finale',
      'ex_post'
    ]::text[]
  ),
  constraint ref_pillars_default_weight_check check (
    default_weight > 0 and default_weight <= 100
  )
);

create index if not exists idx_ref_pillars_module_code
  on public.ref_pillars (module, code);

alter table public.ref_pillars enable row level security;

drop policy if exists "ref_pillars_select_authenticated"
  on public.ref_pillars;
create policy "ref_pillars_select_authenticated"
  on public.ref_pillars
  for select
  to authenticated
  using (true);

comment on table public.ref_pillars is
  'Versioned reference pillars used as contextual generation inputs by module.';

comment on column public.ref_pillars.criteria_codes is
  'Evaluation criterion codes that a generated pillar may inherit.';

comment on column public.ref_pillars.observable_variables is
  'JSON array of observable variable definitions with code, label and description.';

insert into public.ref_pillars (
  module,
  code,
  name,
  description,
  criteria_codes,
  observable_variables,
  applicable_cycles,
  default_weight,
  version
)
values
  (
    'M2',
    'theory_of_change',
    'Théorie du changement et logique d''intervention',
    'Évalue la qualité de l''analyse du problème, de la chaîne causale, du cadre logique et des hypothèses du programme.',
    array['pertinence', 'coherence'],
    '[
      {"code":"has_theory_of_change","label":"Théorie du changement","description":"Une théorie du changement explicite est documentée."},
      {"code":"has_logframe","label":"Cadre logique","description":"Un cadre logique structuré est disponible."},
      {"code":"assumptions_documented","label":"Hypothèses documentées","description":"Les hypothèses de la chaîne causale sont explicitées."},
      {"code":"problem_analysis_present","label":"Analyse du problème","description":"Le problème et ses causes sont analysés."}
    ]'::jsonb,
    array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'],
    15.00,
    '2026-09'
  ),
  (
    'M2',
    'governance_coordination',
    'Gouvernance et coordination',
    'Évalue les responsabilités, les instances de pilotage et les mécanismes de coordination entre les partenaires.',
    array['coherence', 'efficience', 'gestion_adaptative'],
    '[
      {"code":"steering_committee_defined","label":"Comité de pilotage défini","description":"Une instance de pilotage et son mandat sont définis."},
      {"code":"roles_matrix_present","label":"Matrice des rôles","description":"Les rôles et responsabilités des acteurs sont formalisés."},
      {"code":"coordination_mechanism","label":"Mécanisme de coordination","description":"Un mécanisme opérationnel de coordination est décrit."},
      {"code":"partner_count","label":"Nombre de partenaires","description":"Le nombre de partenaires de mise en œuvre est identifiable."}
    ]'::jsonb,
    array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'],
    10.00,
    '2026-09'
  ),
  (
    'M2',
    'operational_effectiveness',
    'Efficacité opérationnelle',
    'Évalue la planification, l''avancement des activités, la production des livrables et les retards de mise en œuvre.',
    array['efficacite', 'gestion_adaptative'],
    '[
      {"code":"output_delivery_rate","label":"Taux de livraison des produits","description":"La part des produits ou livrables réalisés est mesurable."},
      {"code":"workplan_present","label":"Plan de travail","description":"Un plan de travail opérationnel est disponible."},
      {"code":"implementation_delay_months","label":"Retard de mise en œuvre","description":"Le retard de mise en œuvre peut être exprimé en mois."},
      {"code":"activities_completed_share","label":"Part des activités achevées","description":"La proportion des activités achevées est documentée."}
    ]'::jsonb,
    array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'],
    15.00,
    '2026-09'
  ),
  (
    'M2',
    'budget_resources',
    'Budget et ressources',
    'Évalue l''adéquation des ressources, les décaissements, l''absorption budgétaire, le cofinancement et les audits.',
    array['efficience'],
    '[
      {"code":"budget_total","label":"Budget total","description":"Le budget total du programme est documenté."},
      {"code":"disbursement_rate","label":"Taux de décaissement","description":"Le taux de décaissement des financements est disponible."},
      {"code":"absorption_rate","label":"Taux d''absorption","description":"Le taux d''absorption budgétaire est calculable."},
      {"code":"cofinancing_share","label":"Part de cofinancement","description":"La part du cofinancement est identifiable."},
      {"code":"audit_opinion","label":"Opinion d''audit","description":"Une opinion d''audit financier est disponible."}
    ]'::jsonb,
    array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'],
    15.00,
    '2026-09'
  ),
  (
    'M2',
    'results_impact',
    'Résultats et impact',
    'Évalue les résultats attendus ou atteints, la couverture des bénéficiaires et les éléments probants relatifs aux effets.',
    array['efficacite', 'impact'],
    '[
      {"code":"outcome_indicators_with_targets","label":"Indicateurs de résultat avec cibles","description":"Les indicateurs de résultat disposent de cibles explicites."},
      {"code":"outcome_achievement_rate","label":"Taux d''atteinte des résultats","description":"Le niveau d''atteinte des résultats est mesurable lorsque le cycle le permet."},
      {"code":"beneficiaries_reached","label":"Bénéficiaires atteints","description":"Le nombre de bénéficiaires atteints est documenté lorsque le cycle le permet."},
      {"code":"evidence_of_impact","label":"Preuves d''impact","description":"Des éléments probants relatifs aux impacts sont disponibles lorsque le cycle le permet."}
    ]'::jsonb,
    array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'],
    15.00,
    '2026-09'
  ),
  (
    'M2',
    'risks_safeguards',
    'Risques et sauvegardes',
    'Évalue l''identification des risques, les sauvegardes environnementales et sociales et les mécanismes de recours.',
    array['durabilite', 'equite'],
    '[
      {"code":"risk_register_present","label":"Registre des risques","description":"Un registre des risques est disponible et exploitable."},
      {"code":"esms_present","label":"Système de gestion environnementale et sociale","description":"Un dispositif de gestion environnementale et sociale est documenté."},
      {"code":"grievance_mechanism","label":"Mécanisme de gestion des plaintes","description":"Un mécanisme de plainte ou de recours est défini."},
      {"code":"safeguard_category","label":"Catégorie de sauvegarde","description":"La catégorie de sauvegarde du programme est renseignée."}
    ]'::jsonb,
    array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'],
    10.00,
    '2026-09'
  ),
  (
    'M2',
    'monitoring_evaluation_data',
    'Données et qualité du suivi-évaluation',
    'Évalue le dispositif de suivi-évaluation, la situation de référence, la couverture des indicateurs et les revues intermédiaires.',
    array['gestion_adaptative', 'efficacite'],
    '[
      {"code":"has_mrv_framework","label":"Cadre MRV","description":"Un cadre de mesure, reporting et vérification est défini."},
      {"code":"has_baseline","label":"Situation de référence","description":"Une situation de référence est disponible."},
      {"code":"indicator_data_coverage","label":"Couverture des données d''indicateurs","description":"La disponibilité des données couvre les indicateurs attendus."},
      {"code":"mte_conducted","label":"Évaluation à mi-parcours réalisée","description":"Une évaluation ou revue à mi-parcours a été conduite lorsque le cycle le permet."}
    ]'::jsonb,
    array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'],
    10.00,
    '2026-09'
  ),
  (
    'M2',
    'gender_inclusion',
    'Genre et inclusion',
    'Évalue la prise en compte du genre, des groupes vulnérables et la disponibilité de données désagrégées.',
    array['equite'],
    '[
      {"code":"gender_analysis_present","label":"Analyse de genre","description":"Une analyse de genre est documentée."},
      {"code":"gender_action_plan","label":"Plan d''action genre","description":"Un plan d''action relatif au genre est disponible."},
      {"code":"sex_disaggregated_data","label":"Données désagrégées par sexe","description":"Les données pertinentes sont désagrégées par sexe."},
      {"code":"vulnerable_groups_targeted","label":"Groupes vulnérables ciblés","description":"Les groupes vulnérables ciblés sont explicitement identifiés."}
    ]'::jsonb,
    array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'],
    5.00,
    '2026-09'
  ),
  (
    'M2',
    'sustainability_exit',
    'Durabilité et stratégie de sortie',
    'Évalue la stratégie de sortie, l''ancrage institutionnel, le financement récurrent et le renforcement des capacités.',
    array['durabilite'],
    '[
      {"code":"exit_strategy_present","label":"Stratégie de sortie","description":"Une stratégie de sortie est formalisée."},
      {"code":"institutional_anchoring","label":"Ancrage institutionnel","description":"L''ancrage institutionnel des acquis est documenté."},
      {"code":"recurrent_cost_financing","label":"Financement des coûts récurrents","description":"Le financement futur des coûts récurrents est prévu."},
      {"code":"capacity_building_share","label":"Part du renforcement des capacités","description":"La part des ressources consacrée au renforcement des capacités est identifiable."}
    ]'::jsonb,
    array['ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post'],
    5.00,
    '2026-09'
  )
on conflict (module, code, version) do nothing;
