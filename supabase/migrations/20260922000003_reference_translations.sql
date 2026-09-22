create table if not exists public.ref_framework_translations (
  framework_id uuid not null
    references public.ref_frameworks (id) on delete cascade,
  locale text not null,
  label text not null,
  specific_angles jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (framework_id, locale),
  constraint ref_framework_translations_locale_check check (
    locale in ('fr', 'en', 'pt', 'es')
  ),
  constraint ref_framework_translations_label_not_blank check (
    btrim(label) <> ''
  ),
  constraint ref_framework_translations_angles_array_check check (
    jsonb_typeof(specific_angles) = 'array'
  )
);

create index if not exists idx_ref_framework_translations_locale
  on public.ref_framework_translations (locale);

alter table public.ref_framework_translations enable row level security;

drop policy if exists "ref_framework_translations_select_authenticated"
  on public.ref_framework_translations;
create policy "ref_framework_translations_select_authenticated"
  on public.ref_framework_translations
  for select
  to authenticated
  using (true);

create table if not exists public.ref_pillar_translations (
  pillar_id uuid not null
    references public.ref_pillars (id) on delete cascade,
  locale text not null,
  name text not null,
  description text not null,
  variable_translations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (pillar_id, locale),
  constraint ref_pillar_translations_locale_check check (
    locale in ('fr', 'en', 'pt', 'es')
  ),
  constraint ref_pillar_translations_name_not_blank check (
    btrim(name) <> ''
  ),
  constraint ref_pillar_translations_description_not_blank check (
    btrim(description) <> ''
  ),
  constraint ref_pillar_translations_variables_object_check check (
    jsonb_typeof(variable_translations) = 'object'
  )
);

create index if not exists idx_ref_pillar_translations_locale
  on public.ref_pillar_translations (locale);

alter table public.ref_pillar_translations enable row level security;

drop policy if exists "ref_pillar_translations_select_authenticated"
  on public.ref_pillar_translations;
create policy "ref_pillar_translations_select_authenticated"
  on public.ref_pillar_translations
  for select
  to authenticated
  using (true);

comment on table public.ref_framework_translations is
  'Localized labels and evaluation angles for versioned reference frameworks.';

comment on table public.ref_pillar_translations is
  'Localized pillar content and observable-variable labels keyed by stable variable code.';

-- French translations are derived from the canonical seed data.
insert into public.ref_framework_translations (
  framework_id,
  locale,
  label,
  specific_angles
)
select
  id,
  'fr',
  label,
  specific_angles
from public.ref_frameworks
on conflict (framework_id, locale) do nothing;

insert into public.ref_pillar_translations (
  pillar_id,
  locale,
  name,
  description,
  variable_translations
)
select
  pillar.id,
  'fr',
  pillar.name,
  pillar.description,
  coalesce(variables.translations, '{}'::jsonb)
from public.ref_pillars as pillar
left join lateral (
  select jsonb_object_agg(
    variable ->> 'code',
    jsonb_build_object(
      'label', variable ->> 'label',
      'description', variable ->> 'description'
    )
  ) as translations
  from jsonb_array_elements(pillar.observable_variables) as variable
) as variables on true
on conflict (pillar_id, locale) do nothing;

-- English framework translations.
insert into public.ref_framework_translations (
  framework_id,
  locale,
  label,
  specific_angles
)
select
  framework.id,
  'en',
  translation.label,
  translation.specific_angles
from (
  values
    (
      'GCF_IEU_2026',
      '2026',
      'GCF investment criteria and IEU',
      '["Paradigm shift", "Country ownership", "Sustainable development", "Beneficiary needs"]'::jsonb
    ),
    (
      'AFD_CAD_2026',
      '2026',
      'OECD-DAC criteria and AFD policy',
      '["Additionality", "Climate co-benefits"]'::jsonb
    ),
    (
      'WB_ICR_IEG_2026',
      '2026',
      'World Bank ICR / IEG framework',
      '["Borrower performance", "World Bank performance"]'::jsonb
    ),
    (
      'FIDA_IOE_2026_09',
      '2026-09',
      'IFAD IOE Evaluation Manual',
      '["Innovation and scaling up", "Environment and natural-resource management", "Climate-change adaptation", "Partner performance"]'::jsonb
    ),
    (
      'PNUD_UNEG_2026',
      '2026',
      'UNDP policy and UNEG standards',
      '["Human rights", "Leave no one behind"]'::jsonb
    ),
    (
      'UE_BETTER_REG_2026',
      '2026',
      'Better Regulation and OECD-DAC (DG INTPA)',
      '["European Union added value"]'::jsonb
    ),
    (
      'FEM_2026',
      '2026',
      'GEF Evaluation Policy',
      '["Global environmental results"]'::jsonb
    ),
    (
      'AF_CAD_2026',
      '2026',
      'Adaptation Fund results framework',
      '["Resilience", "Vulnerability reduction"]'::jsonb
    ),
    (
      'THEMIROS_DEFAULT_2026',
      '2026',
      'Themiros reference framework',
      '[]'::jsonb
    )
) as translation(code, version, label, specific_angles)
join public.ref_frameworks as framework
  on framework.code = translation.code
  and framework.version = translation.version
on conflict (framework_id, locale) do nothing;

-- English pillar and observable-variable translations.
insert into public.ref_pillar_translations (
  pillar_id,
  locale,
  name,
  description,
  variable_translations
)
select
  pillar.id,
  'en',
  translation.name,
  translation.description,
  translation.variable_translations
from (
  values
    (
      'theory_of_change',
      'Theory of change and intervention logic',
      'Assesses the problem analysis, causal chain, logical framework and programme assumptions.',
      '{
        "has_theory_of_change":{"label":"Theory of change","description":"An explicit theory of change is documented."},
        "has_logframe":{"label":"Logical framework","description":"A structured logical framework is available."},
        "assumptions_documented":{"label":"Documented assumptions","description":"The causal-chain assumptions are explicit."},
        "problem_analysis_present":{"label":"Problem analysis","description":"The problem and its causes are analysed."}
      }'::jsonb
    ),
    (
      'governance_coordination',
      'Governance and coordination',
      'Assesses responsibilities, steering bodies and coordination mechanisms among partners.',
      '{
        "steering_committee_defined":{"label":"Defined steering committee","description":"A steering body and its mandate are defined."},
        "roles_matrix_present":{"label":"Roles matrix","description":"Stakeholder roles and responsibilities are formalised."},
        "coordination_mechanism":{"label":"Coordination mechanism","description":"An operational coordination mechanism is described."},
        "partner_count":{"label":"Number of partners","description":"The number of implementation partners can be identified."}
      }'::jsonb
    ),
    (
      'operational_effectiveness',
      'Operational effectiveness',
      'Assesses planning, activity progress, delivery of outputs and implementation delays.',
      '{
        "output_delivery_rate":{"label":"Output delivery rate","description":"The share of delivered outputs can be measured."},
        "workplan_present":{"label":"Work plan","description":"An operational work plan is available."},
        "implementation_delay_months":{"label":"Implementation delay","description":"The implementation delay can be expressed in months."},
        "activities_completed_share":{"label":"Share of completed activities","description":"The proportion of completed activities is documented."}
      }'::jsonb
    ),
    (
      'budget_resources',
      'Budget and resources',
      'Assesses resource adequacy, disbursement, budget absorption, co-financing and audits.',
      '{
        "budget_total":{"label":"Total budget","description":"The total programme budget is documented."},
        "disbursement_rate":{"label":"Disbursement rate","description":"The funding disbursement rate is available."},
        "absorption_rate":{"label":"Absorption rate","description":"The budget absorption rate can be calculated."},
        "cofinancing_share":{"label":"Co-financing share","description":"The co-financing share can be identified."},
        "audit_opinion":{"label":"Audit opinion","description":"A financial audit opinion is available."}
      }'::jsonb
    ),
    (
      'results_impact',
      'Results and impact',
      'Assesses expected or achieved results, beneficiary coverage and evidence relating to effects.',
      '{
        "outcome_indicators_with_targets":{"label":"Outcome indicators with targets","description":"Outcome indicators have explicit targets."},
        "outcome_achievement_rate":{"label":"Outcome achievement rate","description":"Outcome achievement can be measured when allowed by the cycle."},
        "beneficiaries_reached":{"label":"Beneficiaries reached","description":"The number of beneficiaries reached is documented when allowed by the cycle."},
        "evidence_of_impact":{"label":"Evidence of impact","description":"Evidence relating to impacts is available when allowed by the cycle."}
      }'::jsonb
    ),
    (
      'risks_safeguards',
      'Risks and safeguards',
      'Assesses risk identification, environmental and social safeguards, and grievance mechanisms.',
      '{
        "risk_register_present":{"label":"Risk register","description":"An actionable risk register is available."},
        "esms_present":{"label":"Environmental and social management system","description":"An environmental and social management system is documented."},
        "grievance_mechanism":{"label":"Grievance mechanism","description":"A grievance or redress mechanism is defined."},
        "safeguard_category":{"label":"Safeguard category","description":"The programme safeguard category is provided."}
      }'::jsonb
    ),
    (
      'monitoring_evaluation_data',
      'Monitoring, evaluation and data quality',
      'Assesses the monitoring and evaluation system, baseline, indicator coverage and mid-term reviews.',
      '{
        "has_mrv_framework":{"label":"MRV framework","description":"A measurement, reporting and verification framework is defined."},
        "has_baseline":{"label":"Baseline","description":"A baseline is available."},
        "indicator_data_coverage":{"label":"Indicator data coverage","description":"Available data cover the expected indicators."},
        "mte_conducted":{"label":"Mid-term evaluation conducted","description":"A mid-term evaluation or review was conducted when allowed by the cycle."}
      }'::jsonb
    ),
    (
      'gender_inclusion',
      'Gender and inclusion',
      'Assesses gender considerations, vulnerable groups and the availability of disaggregated data.',
      '{
        "gender_analysis_present":{"label":"Gender analysis","description":"A gender analysis is documented."},
        "gender_action_plan":{"label":"Gender action plan","description":"A gender action plan is available."},
        "sex_disaggregated_data":{"label":"Sex-disaggregated data","description":"Relevant data are disaggregated by sex."},
        "vulnerable_groups_targeted":{"label":"Targeted vulnerable groups","description":"Targeted vulnerable groups are explicitly identified."}
      }'::jsonb
    ),
    (
      'sustainability_exit',
      'Sustainability and exit strategy',
      'Assesses the exit strategy, institutional anchoring, recurrent-cost financing and capacity building.',
      '{
        "exit_strategy_present":{"label":"Exit strategy","description":"An exit strategy is formalised."},
        "institutional_anchoring":{"label":"Institutional anchoring","description":"The institutional anchoring of programme achievements is documented."},
        "recurrent_cost_financing":{"label":"Recurrent-cost financing","description":"Future financing of recurrent costs is planned."},
        "capacity_building_share":{"label":"Capacity-building share","description":"The share of resources allocated to capacity building can be identified."}
      }'::jsonb
    )
) as translation(code, name, description, variable_translations)
join public.ref_pillars as pillar
  on pillar.module = 'M2'
  and pillar.code = translation.code
  and pillar.version = '2026-09'
on conflict (pillar_id, locale) do nothing;
