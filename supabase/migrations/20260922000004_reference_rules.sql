alter table public.ref_frameworks
  add column if not exists financier_code text,
  add column if not exists financier_aliases text[] not null default '{}'::text[];

update public.ref_frameworks
set
  financier_code = case code
    when 'GCF_IEU_2026' then 'GCF'
    when 'AFD_CAD_2026' then 'AFD'
    when 'WB_ICR_IEG_2026' then 'WB'
    when 'FIDA_IOE_2026_09' then 'FIDA'
    when 'PNUD_UNEG_2026' then 'PNUD'
    when 'UE_BETTER_REG_2026' then 'UE'
    when 'FEM_2026' then 'FEM'
    when 'AF_CAD_2026' then 'AF'
    when 'THEMIROS_DEFAULT_2026' then 'OTHER'
    else coalesce(financier_code, 'OTHER')
  end,
  financier_aliases = case code
    when 'GCF_IEU_2026' then array[
      'GCF', 'Green Climate Fund', 'Fonds vert pour le climat'
    ]
    when 'AFD_CAD_2026' then array[
      'AFD', 'Agence française de développement',
      'Agence francaise de developpement'
    ]
    when 'WB_ICR_IEG_2026' then array[
      'WB', 'World Bank', 'Banque mondiale'
    ]
    when 'FIDA_IOE_2026_09' then array[
      'FIDA', 'IFAD', 'Fonds international de développement agricole',
      'Fonds international de developpement agricole'
    ]
    when 'PNUD_UNEG_2026' then array[
      'PNUD', 'UNDP',
      'Programme des Nations unies pour le développement',
      'Programme des Nations unies pour le developpement'
    ]
    when 'UE_BETTER_REG_2026' then array[
      'UE', 'EU', 'Union européenne', 'Union europeenne',
      'European Union'
    ]
    when 'FEM_2026' then array[
      'FEM', 'GEF', 'Fonds pour l''environnement mondial',
      'Global Environment Facility'
    ]
    when 'AF_CAD_2026' then array[
      'AF', 'Adaptation Fund', 'Fonds d''adaptation'
    ]
    when 'THEMIROS_DEFAULT_2026' then array[
      'OTHER', 'AUTRE', 'OTHER / UNKNOWN', 'AUTRE / NON RENSEIGNÉ',
      'AUTRE / NON RENSEIGNE'
    ]
    else financier_aliases
  end;

alter table public.ref_frameworks
  alter column financier_code set not null,
  drop constraint if exists ref_frameworks_financier_code_not_blank,
  add constraint ref_frameworks_financier_code_not_blank check (
    btrim(financier_code) <> ''
  );

create index if not exists idx_ref_frameworks_financier_code
  on public.ref_frameworks (financier_code, year desc);

comment on column public.ref_frameworks.financier_code is
  'Stable code used to map a workspace principal financier to this framework.';

comment on column public.ref_frameworks.financier_aliases is
  'Accepted localized names and acronyms for deterministic financier matching.';

create or replace function public.resolve_financier_code(financier_name text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select framework.financier_code
      from public.ref_frameworks as framework
      where lower(btrim(framework.financier_code)) = lower(btrim($1))
        or exists (
          select 1
          from unnest(framework.financier_aliases) as financier_alias(value)
          where lower(btrim(financier_alias.value)) = lower(btrim($1))
        )
      order by framework.year desc, framework.created_at desc
      limit 1
    ),
    'OTHER'
  );
$$;

revoke all on function public.resolve_financier_code(text) from public;
grant execute on function public.resolve_financier_code(text)
  to authenticated, service_role;

create or replace function public.normalize_workspace_financiers(
  financiers_input jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      case
        when jsonb_typeof(item.value) = 'object' then
          item.value || jsonb_build_object(
            'code',
            public.resolve_financier_code(
              coalesce(
                nullif(item.value ->> 'code', ''),
                item.value ->> 'name'
              )
            )
          )
        else item.value
      end
      order by item.ordinality
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(
    case
      when jsonb_typeof(financiers_input) = 'array' then financiers_input
      else '[]'::jsonb
    end
  ) with ordinality as item(value, ordinality);
$$;

revoke all on function public.normalize_workspace_financiers(jsonb) from public;
grant execute on function public.normalize_workspace_financiers(jsonb)
  to authenticated, service_role;

create or replace function public.set_workspace_financier_codes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.financiers := public.normalize_workspace_financiers(new.financiers);
  return new;
end;
$$;

drop trigger if exists normalize_workspace_financiers
  on public.workspaces;
create trigger normalize_workspace_financiers
before insert or update of financiers on public.workspaces
for each row execute function public.set_workspace_financier_codes();

update public.workspaces
set financiers = public.normalize_workspace_financiers(financiers);

do $$
begin
  create type public.criterion_applicability as enum (
    'obligatoire',
    'optionnel',
    'prospectif',
    'non_applicable'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.ref_criteria (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  description text not null,
  is_oecd_dac boolean not null,
  default_weight numeric(5, 2),
  version text not null,
  created_at timestamptz not null default now(),
  constraint ref_criteria_code_version_unique unique (code, version),
  constraint ref_criteria_code_not_blank check (btrim(code) <> ''),
  constraint ref_criteria_label_not_blank check (btrim(label) <> ''),
  constraint ref_criteria_description_not_blank check (
    btrim(description) <> ''
  ),
  constraint ref_criteria_version_not_blank check (btrim(version) <> ''),
  constraint ref_criteria_default_weight_check check (
    default_weight is null
    or (default_weight >= 0 and default_weight <= 100)
  )
);

create index if not exists idx_ref_criteria_code
  on public.ref_criteria (code);

alter table public.ref_criteria enable row level security;

drop policy if exists "ref_criteria_select_authenticated"
  on public.ref_criteria;
create policy "ref_criteria_select_authenticated"
  on public.ref_criteria
  for select
  to authenticated
  using (true);

create table if not exists public.ref_criterion_translations (
  criterion_id uuid not null
    references public.ref_criteria (id) on delete cascade,
  locale text not null,
  label text not null,
  description text not null,
  created_at timestamptz not null default now(),
  primary key (criterion_id, locale),
  constraint ref_criterion_translations_locale_check check (
    locale in ('fr', 'en', 'pt', 'es')
  ),
  constraint ref_criterion_translations_label_not_blank check (
    btrim(label) <> ''
  ),
  constraint ref_criterion_translations_description_not_blank check (
    btrim(description) <> ''
  )
);

create index if not exists idx_ref_criterion_translations_locale
  on public.ref_criterion_translations (locale);

alter table public.ref_criterion_translations enable row level security;

drop policy if exists "ref_criterion_translations_select_authenticated"
  on public.ref_criterion_translations;
create policy "ref_criterion_translations_select_authenticated"
  on public.ref_criterion_translations
  for select
  to authenticated
  using (true);

create table if not exists public.ref_cycle_criteria (
  id uuid primary key default gen_random_uuid(),
  criterion_id uuid not null
    references public.ref_criteria (id) on delete cascade,
  cycle text not null,
  applicability public.criterion_applicability not null,
  created_at timestamptz not null default now(),
  constraint ref_cycle_criteria_criterion_cycle_unique
    unique (criterion_id, cycle),
  constraint ref_cycle_criteria_cycle_check check (
    cycle in ('ex_ante', 'en_cours', 'mi_parcours', 'finale', 'ex_post')
  )
);

create index if not exists idx_ref_cycle_criteria_cycle
  on public.ref_cycle_criteria (cycle, criterion_id);

alter table public.ref_cycle_criteria enable row level security;

drop policy if exists "ref_cycle_criteria_select_authenticated"
  on public.ref_cycle_criteria;
create policy "ref_cycle_criteria_select_authenticated"
  on public.ref_cycle_criteria
  for select
  to authenticated
  using (true);

insert into public.ref_criteria (
  code,
  label,
  description,
  is_oecd_dac,
  default_weight,
  version
)
values
  (
    'pertinence',
    'Pertinence',
    'Adéquation de l''intervention aux besoins, priorités et évolutions du contexte.',
    true,
    null,
    '2026-09'
  ),
  (
    'coherence',
    'Cohérence',
    'Compatibilité de l''intervention avec les autres interventions et politiques.',
    true,
    null,
    '2026-09'
  ),
  (
    'efficacite',
    'Efficacité',
    'Degré d''atteinte ou de progression vers les objectifs et résultats attendus.',
    true,
    null,
    '2026-09'
  ),
  (
    'efficience',
    'Efficience',
    'Transformation économique et opportune des ressources en résultats.',
    true,
    null,
    '2026-09'
  ),
  (
    'impact',
    'Impact',
    'Effets significatifs de niveau supérieur, positifs ou négatifs, prévus ou imprévus.',
    true,
    null,
    '2026-09'
  ),
  (
    'durabilite',
    'Durabilité',
    'Probabilité que les bénéfices nets perdurent dans le temps.',
    true,
    null,
    '2026-09'
  ),
  (
    'equite',
    'Équité',
    'Répartition inclusive des bénéfices, risques et possibilités entre les groupes.',
    false,
    null,
    '2026-09'
  ),
  (
    'gestion_adaptative',
    'Gestion adaptative',
    'Capacité à apprendre, réviser les hypothèses et ajuster la mise en œuvre.',
    false,
    null,
    '2026-09'
  )
on conflict (code, version) do nothing;

insert into public.ref_criterion_translations (
  criterion_id,
  locale,
  label,
  description
)
select id, 'fr', label, description
from public.ref_criteria
where version = '2026-09'
on conflict (criterion_id, locale) do nothing;

insert into public.ref_criterion_translations (
  criterion_id,
  locale,
  label,
  description
)
select
  criterion.id,
  'en',
  translation.label,
  translation.description
from (
  values
    (
      'pertinence',
      'Relevance',
      'Extent to which the intervention responds to needs, priorities and changes in context.'
    ),
    (
      'coherence',
      'Coherence',
      'Compatibility of the intervention with other interventions and policies.'
    ),
    (
      'efficacite',
      'Effectiveness',
      'Extent to which objectives and expected results have been or are being achieved.'
    ),
    (
      'efficience',
      'Efficiency',
      'Extent to which resources are converted into results economically and on time.'
    ),
    (
      'impact',
      'Impact',
      'Significant higher-level effects, positive or negative, intended or unintended.'
    ),
    (
      'durabilite',
      'Sustainability',
      'Extent to which net benefits are likely to continue over time.'
    ),
    (
      'equite',
      'Equity',
      'Inclusive distribution of benefits, risks and opportunities across groups.'
    ),
    (
      'gestion_adaptative',
      'Adaptive management',
      'Capacity to learn, revise assumptions and adjust implementation.'
    )
) as translation(code, label, description)
join public.ref_criteria as criterion
  on criterion.code = translation.code
  and criterion.version = '2026-09'
on conflict (criterion_id, locale) do nothing;

insert into public.ref_cycle_criteria (
  criterion_id,
  cycle,
  applicability
)
select
  criterion.id,
  matrix.cycle,
  matrix.applicability::public.criterion_applicability
from (
  values
    ('pertinence', 'ex_ante', 'obligatoire'),
    ('pertinence', 'en_cours', 'obligatoire'),
    ('pertinence', 'mi_parcours', 'obligatoire'),
    ('pertinence', 'finale', 'obligatoire'),
    ('pertinence', 'ex_post', 'obligatoire'),
    ('coherence', 'ex_ante', 'obligatoire'),
    ('coherence', 'en_cours', 'obligatoire'),
    ('coherence', 'mi_parcours', 'obligatoire'),
    ('coherence', 'finale', 'obligatoire'),
    ('coherence', 'ex_post', 'obligatoire'),
    ('efficacite', 'ex_ante', 'prospectif'),
    ('efficacite', 'en_cours', 'optionnel'),
    ('efficacite', 'mi_parcours', 'obligatoire'),
    ('efficacite', 'finale', 'obligatoire'),
    ('efficacite', 'ex_post', 'obligatoire'),
    ('efficience', 'ex_ante', 'prospectif'),
    ('efficience', 'en_cours', 'optionnel'),
    ('efficience', 'mi_parcours', 'obligatoire'),
    ('efficience', 'finale', 'obligatoire'),
    ('efficience', 'ex_post', 'obligatoire'),
    ('impact', 'ex_ante', 'prospectif'),
    ('impact', 'en_cours', 'non_applicable'),
    ('impact', 'mi_parcours', 'optionnel'),
    ('impact', 'finale', 'optionnel'),
    ('impact', 'ex_post', 'obligatoire'),
    ('durabilite', 'ex_ante', 'prospectif'),
    ('durabilite', 'en_cours', 'optionnel'),
    ('durabilite', 'mi_parcours', 'obligatoire'),
    ('durabilite', 'finale', 'obligatoire'),
    ('durabilite', 'ex_post', 'obligatoire'),
    ('equite', 'ex_ante', 'obligatoire'),
    ('equite', 'en_cours', 'obligatoire'),
    ('equite', 'mi_parcours', 'obligatoire'),
    ('equite', 'finale', 'obligatoire'),
    ('equite', 'ex_post', 'obligatoire'),
    ('gestion_adaptative', 'ex_ante', 'optionnel'),
    ('gestion_adaptative', 'en_cours', 'obligatoire'),
    ('gestion_adaptative', 'mi_parcours', 'obligatoire'),
    ('gestion_adaptative', 'finale', 'obligatoire'),
    ('gestion_adaptative', 'ex_post', 'optionnel')
) as matrix(criterion_code, cycle, applicability)
join public.ref_criteria as criterion
  on criterion.code = matrix.criterion_code
  and criterion.version = '2026-09'
on conflict (criterion_id, cycle) do nothing;

create or replace function public.get_localized_ref_frameworks(
  requested_locale text default 'fr'
)
returns table (
  id uuid,
  financier_code text,
  code text,
  version text,
  label text,
  source text,
  year integer,
  activated_criteria jsonb,
  specific_angles jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    framework.id,
    framework.financier_code,
    framework.code,
    framework.version,
    coalesce(
      requested_translation.label,
      english_translation.label,
      french_translation.label,
      framework.label
    ),
    framework.source,
    framework.year,
    framework.activated_criteria,
    coalesce(
      requested_translation.specific_angles,
      english_translation.specific_angles,
      french_translation.specific_angles,
      framework.specific_angles
    )
  from public.ref_frameworks as framework
  left join public.ref_framework_translations as requested_translation
    on requested_translation.framework_id = framework.id
    and requested_translation.locale = requested_locale
  left join public.ref_framework_translations as english_translation
    on english_translation.framework_id = framework.id
    and english_translation.locale = 'en'
  left join public.ref_framework_translations as french_translation
    on french_translation.framework_id = framework.id
    and french_translation.locale = 'fr';
$$;

create or replace function public.get_localized_ref_pillars(
  requested_module public.instrument_module,
  requested_cycle text,
  requested_locale text default 'fr'
)
returns table (
  id uuid,
  module public.instrument_module,
  code text,
  version text,
  name text,
  description text,
  criteria_codes text[],
  observable_variables jsonb,
  applicable_cycles text[],
  default_weight numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    pillar.id,
    pillar.module,
    pillar.code,
    pillar.version,
    coalesce(
      requested_translation.name,
      english_translation.name,
      french_translation.name,
      pillar.name
    ),
    coalesce(
      requested_translation.description,
      english_translation.description,
      french_translation.description,
      pillar.description
    ),
    pillar.criteria_codes,
    coalesce(localized_variables.value, pillar.observable_variables),
    pillar.applicable_cycles,
    pillar.default_weight
  from public.ref_pillars as pillar
  left join public.ref_pillar_translations as requested_translation
    on requested_translation.pillar_id = pillar.id
    and requested_translation.locale = requested_locale
  left join public.ref_pillar_translations as english_translation
    on english_translation.pillar_id = pillar.id
    and english_translation.locale = 'en'
  left join public.ref_pillar_translations as french_translation
    on french_translation.pillar_id = pillar.id
    and french_translation.locale = 'fr'
  left join lateral (
    select jsonb_agg(
      variable.value || jsonb_build_object(
        'label',
        coalesce(
          requested_translation.variable_translations
            -> (variable.value ->> 'code') ->> 'label',
          english_translation.variable_translations
            -> (variable.value ->> 'code') ->> 'label',
          french_translation.variable_translations
            -> (variable.value ->> 'code') ->> 'label',
          variable.value ->> 'label'
        ),
        'description',
        coalesce(
          requested_translation.variable_translations
            -> (variable.value ->> 'code') ->> 'description',
          english_translation.variable_translations
            -> (variable.value ->> 'code') ->> 'description',
          french_translation.variable_translations
            -> (variable.value ->> 'code') ->> 'description',
          variable.value ->> 'description'
        )
      )
      order by variable.ordinality
    ) as value
    from jsonb_array_elements(pillar.observable_variables)
      with ordinality as variable(value, ordinality)
  ) as localized_variables on true
  where pillar.module = requested_module
    and requested_cycle = any(pillar.applicable_cycles);
$$;

create or replace function public.get_localized_ref_criteria(
  requested_cycle text,
  requested_locale text default 'fr'
)
returns table (
  id uuid,
  code text,
  version text,
  label text,
  description text,
  is_oecd_dac boolean,
  applicability public.criterion_applicability,
  default_weight numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    criterion.id,
    criterion.code,
    criterion.version,
    coalesce(
      requested_translation.label,
      english_translation.label,
      french_translation.label,
      criterion.label
    ),
    coalesce(
      requested_translation.description,
      english_translation.description,
      french_translation.description,
      criterion.description
    ),
    criterion.is_oecd_dac,
    cycle_criterion.applicability,
    coalesce(
      criterion.default_weight,
      case
        when cycle_criterion.applicability = 'non_applicable' then 0
        else 100.0 / nullif(
          count(*) filter (
            where cycle_criterion.applicability <> 'non_applicable'
          ) over (),
          0
        )
      end
    )
  from public.ref_criteria as criterion
  join public.ref_cycle_criteria as cycle_criterion
    on cycle_criterion.criterion_id = criterion.id
    and cycle_criterion.cycle = requested_cycle
  left join public.ref_criterion_translations as requested_translation
    on requested_translation.criterion_id = criterion.id
    and requested_translation.locale = requested_locale
  left join public.ref_criterion_translations as english_translation
    on english_translation.criterion_id = criterion.id
    and english_translation.locale = 'en'
  left join public.ref_criterion_translations as french_translation
    on french_translation.criterion_id = criterion.id
    and french_translation.locale = 'fr'
  where criterion.version = '2026-09'
  order by case criterion.code
    when 'pertinence' then 1
    when 'coherence' then 2
    when 'efficacite' then 3
    when 'efficience' then 4
    when 'impact' then 5
    when 'durabilite' then 6
    when 'equite' then 7
    when 'gestion_adaptative' then 8
    else 99
  end;
$$;

grant execute on function public.get_localized_ref_frameworks(text)
  to authenticated, service_role;
grant execute on function public.get_localized_ref_pillars(
  public.instrument_module,
  text,
  text
) to authenticated, service_role;
grant execute on function public.get_localized_ref_criteria(text, text)
  to authenticated, service_role;
