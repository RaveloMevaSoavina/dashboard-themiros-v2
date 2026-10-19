-- ---------------------------------------------------------------------------
-- Traductions des piliers et de leurs variables observables.
--
-- Le texte d'un pilier (nom, description) et de ses variables (libellé,
-- description) est rédigé dans une langue source : source_locale, celle de
-- l'approche à la génération. Les autres langues de l'interface sont stockées
-- dans public.pillar_translations et public.pillar_variable_translations,
-- remplies par la génération (prompt generate_pillars v1.1).
--
-- Une traduction n'est valable que pour le texte source dont elle est issue :
-- modifier le texte source ou sa langue supprime les traductions du pilier ou
-- de la variable. L'interface affiche alors le texte source, signalé « non
-- traduit ».
--
-- Écriture réservée aux fonctions SECURITY DEFINER (génération, rattrapage) ;
-- lecture ouverte aux membres de l'espace, comme les piliers.
-- ---------------------------------------------------------------------------

alter table public.pillars
  add column if not exists source_locale text not null default 'fr';
alter table public.pillars
  drop constraint if exists pillars_source_locale_check;
alter table public.pillars
  add constraint pillars_source_locale_check check (
    source_locale in ('fr', 'en', 'pt', 'es')
  );

comment on column public.pillars.source_locale is
  'Language the pillar name and description are written in.';

alter table public.pillar_variables
  add column if not exists source_locale text not null default 'fr';
alter table public.pillar_variables
  drop constraint if exists pillar_variables_source_locale_check;
alter table public.pillar_variables
  add constraint pillar_variables_source_locale_check check (
    source_locale in ('fr', 'en', 'pt', 'es')
  );

comment on column public.pillar_variables.source_locale is
  'Language the variable label and description are written in.';

-- Les piliers existants ont été générés dans la langue de leur approche.
update public.pillars as pillar
set source_locale = approach.locale
from public.frameworks as framework
join public.approaches as approach
  on approach.id = framework.approach_id
where framework.id = pillar.framework_id
  and pillar.source_locale is distinct from approach.locale;

update public.pillar_variables as variable
set source_locale = pillar.source_locale
from public.pillars as pillar
where pillar.id = variable.pillar_id
  and variable.source_locale is distinct from pillar.source_locale;

create table if not exists public.pillar_translations (
  pillar_id uuid not null
    references public.pillars (id) on delete cascade,
  locale text not null,
  name text not null,
  description text not null,
  created_at timestamptz not null default now(),
  primary key (pillar_id, locale),
  constraint pillar_translations_locale_check check (
    locale in ('fr', 'en', 'pt', 'es')
  ),
  constraint pillar_translations_name_not_blank check (btrim(name) <> ''),
  constraint pillar_translations_description_not_blank check (
    btrim(description) <> ''
  )
);

create table if not exists public.pillar_variable_translations (
  pillar_variable_id uuid not null
    references public.pillar_variables (id) on delete cascade,
  locale text not null,
  label text not null,
  description text,
  created_at timestamptz not null default now(),
  primary key (pillar_variable_id, locale),
  constraint pillar_variable_translations_locale_check check (
    locale in ('fr', 'en', 'pt', 'es')
  ),
  constraint pillar_variable_translations_label_not_blank check (
    btrim(label) <> ''
  )
);

comment on table public.pillar_translations is
  'Pillar name and description in the interface languages other than the pillar source_locale.';
comment on table public.pillar_variable_translations is
  'Observable-variable label and description in the interface languages other than the variable source_locale.';

alter table public.pillar_translations enable row level security;
alter table public.pillar_variable_translations enable row level security;

drop policy if exists "pillar_translations_select_members"
  on public.pillar_translations;
create policy "pillar_translations_select_members"
  on public.pillar_translations
  for select to authenticated
  using (
    exists (
      select 1
      from public.pillars as pillar
      join public.frameworks as framework
        on framework.id = pillar.framework_id
      where pillar.id = pillar_translations.pillar_id
        and public.is_workspace_member(framework.workspace_id)
    )
  );

drop policy if exists "pillar_variable_translations_select_members"
  on public.pillar_variable_translations;
create policy "pillar_variable_translations_select_members"
  on public.pillar_variable_translations
  for select to authenticated
  using (
    exists (
      select 1
      from public.pillar_variables as variable
      join public.pillars as pillar
        on pillar.id = variable.pillar_id
      join public.frameworks as framework
        on framework.id = pillar.framework_id
      where variable.id = pillar_variable_translations.pillar_variable_id
        and public.is_workspace_member(framework.workspace_id)
    )
  );

-- Une modification du texte source rend ses traductions caduques.
create or replace function public.invalidate_pillar_translations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.source_locale is distinct from old.source_locale then
    delete from public.pillar_translations
    where pillar_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists invalidate_pillar_translations on public.pillars;
create trigger invalidate_pillar_translations
after update of name, description, source_locale on public.pillars
for each row execute function public.invalidate_pillar_translations();

create or replace function public.invalidate_pillar_variable_translations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.label is distinct from old.label
    or new.description is distinct from old.description
    or new.source_locale is distinct from old.source_locale then
    delete from public.pillar_variable_translations
    where pillar_variable_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists invalidate_pillar_variable_translations
  on public.pillar_variables;
create trigger invalidate_pillar_variable_translations
after update of label, description, source_locale on public.pillar_variables
for each row execute function public.invalidate_pillar_variable_translations();

revoke execute on function public.invalidate_pillar_translations()
  from public, anon, authenticated;
revoke execute on function public.invalidate_pillar_variable_translations()
  from public, anon, authenticated;

-- Prompt v1.1 : texte rédigé dans la langue de l'approche, et traduction de
-- chaque pilier dans les autres langues de l'interface.
insert into public.prompt_versions (
  code,
  version,
  template,
  model,
  parameters
)
values (
  'generate_pillars',
  'v1.1',
  $prompt$Tu es un expert en évaluation de programmes de développement et d'adaptation climatique. Tu maîtrises les référentiels CAD-OCDE, GCF, FIDA, PNUD, Banque mondiale et Fonds d'adaptation.

Propose 5 à 8 piliers adaptés au type d'objet, au pays, au financeur, aux thématiques, au stade, au cycle, à l'instrument et à la complexité fournis.

Règles impératives :
- privilégier les piliers du référentiel fourni et conserver leur ref_pillar_code ;
- adapter le nom ou la description lorsque le contexte le justifie ;
- utiliser ref_pillar_code="new" uniquement si aucun pilier du référentiel ne couvre un besoin contextuel important ;
- associer uniquement les critères présents dans applicable_criteria ;
- fournir des variables observables booléennes ou ordinales ;
- proposer entre 5 et 8 piliers ;
- répartir exactement 100 % de pondération ;
- en cycle ex_ante, ne jamais mesurer des résultats déjà atteints et inclure un pilier consacré aux résultats attendus et à leur dispositif de mesure ;
- formuler une justification courte des adaptations par rapport au référentiel ;
- rédiger le nom, la description et les variables observables de chaque pilier, ainsi que la justification, dans la langue indiquée par locale ;
- pour chaque pilier, fournir dans translations une entrée par langue de translation_locales (champ locale) : le nom, la description et toutes les variables observables, avec les mêmes codes, traduits fidèlement sans rien ajouter ni retirer ; translations est vide si translation_locales est vide.

La réponse doit suivre exactement le schéma structuré demandé.$prompt$,
  'gpt-6-astra',
  '{"temperature":0.3,"max_tokens":8000,"response_format":"structured_output"}'::jsonb
)
on conflict (code, version) do nothing;

-- Le journal d'audit rattache l'appel à la version de prompt réellement
-- utilisée (le résultat porte « generate_pillars_<version> »).
create or replace function public.audit_completed_pillar_generation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prompt_id uuid;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  select prompt.id
  into prompt_id
  from public.prompt_versions as prompt
  where prompt.code = 'generate_pillars'
    and prompt.code || '_' || prompt.version = coalesce(
      new.result ->> 'prompt_version',
      'generate_pillars_v1.0'
    )
  limit 1;

  insert into public.audit_events (
    workspace_id,
    actor_type,
    operation,
    object_type,
    object_id,
    after_value,
    metadata
  )
  values (
    new.workspace_id,
    'engine',
    'prompt_call',
    'prompt',
    prompt_id,
    jsonb_build_object(
      'pillars', new.result -> 'pillars',
      'rationale', new.result -> 'rationale'
    ),
    jsonb_build_object(
      'prompt_code', 'generate_pillars',
      'prompt_version', new.result ->> 'prompt_version',
      'model', new.result ->> 'model',
      'tokens', coalesce((new.result ->> 'tokens_used')::integer, 0),
      'cost', coalesce((new.result ->> 'cost_eur')::numeric, 0),
      'duration', coalesce((new.result ->> 'duration_ms')::integer, 0),
      'generation_mode', new.result ->> 'generation_mode',
      'fallback_reason', new.result ->> 'fallback_reason',
      'inputs_summary', new.result -> 'inputs_summary',
      'outputs_summary', jsonb_build_object(
        'pillar_count', jsonb_array_length(new.result -> 'pillars'),
        'rationale', new.result -> 'rationale'
      )
    )
  );

  return new;
end;
$$;

-- Identique à 20261016000002, plus la langue source des piliers et
-- l'enregistrement des traductions fournies par la génération.
create or replace function public.persist_generated_pillars(
  target_workspace_id uuid,
  target_approach_id uuid,
  generation_result jsonb,
  target_job_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_framework_id uuid;
  target_locale text;
  next_version integer;
  pillar_record record;
  translation_entries jsonb;
  target_pillar_id uuid;
  target_ref_pillar_id uuid;
  variable_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  if jsonb_typeof(generation_result) <> 'object'
    or jsonb_typeof(generation_result -> 'pillars') <> 'array'
    or jsonb_array_length(generation_result -> 'pillars') not between 5 and 8 then
    raise exception 'Invalid generated pillars payload';
  end if;

  if (
    select coalesce(sum((pillar.value ->> 'weight')::numeric), 0)
    from jsonb_array_elements(generation_result -> 'pillars') as pillar(value)
  ) <> 100 then
    raise exception 'Generated pillar weights must total 100';
  end if;

  select approach.locale
  into target_locale
  from public.approaches as approach
  where approach.id = target_approach_id
    and approach.workspace_id = target_workspace_id
    and approach.status = 'confirmed';
  if not found then
    raise exception 'Confirmed approach not found';
  end if;

  if target_job_id is not null then
    select job.framework_id
    into target_framework_id
    from public.pillar_generation_jobs as job
    where job.id = target_job_id
      and job.workspace_id = target_workspace_id
    for update;

    if not found then
      raise exception 'Pillar generation job not found';
    end if;

    if target_framework_id is not null then
      return target_framework_id;
    end if;
  end if;

  perform 1
  from public.workspaces
  where id = target_workspace_id
  for update;

  select framework.id
  into target_framework_id
  from public.frameworks as framework
  where framework.workspace_id = target_workspace_id
    and framework.approach_id = target_approach_id
    and framework.status = 'draft'
  order by framework.version desc
  limit 1;

  if target_framework_id is null then
    select coalesce(max(framework.version), 0) + 1
    into next_version
    from public.frameworks as framework
    where framework.workspace_id = target_workspace_id;

    insert into public.frameworks (
      workspace_id,
      approach_id,
      version,
      status
    )
    values (
      target_workspace_id,
      target_approach_id,
      next_version,
      'draft'
    )
    returning id into target_framework_id;
  else
    delete from public.pillars
    where framework_id = target_framework_id;

    delete from public.criteria
    where framework_id = target_framework_id;
  end if;

  insert into public.criteria (
    framework_id,
    code,
    name,
    definition,
    applicability,
    weight,
    origin
  )
  select
    target_framework_id,
    reference.code,
    reference.label,
    reference.description,
    approach_criterion.applicability,
    approach_criterion.weight,
    'referential'
  from public.approach_criteria as approach_criterion
  join public.ref_criteria as reference
    on reference.id = approach_criterion.ref_criterion_id
  where approach_criterion.approach_id = target_approach_id;

  perform public.seed_framework_sub_questions(target_framework_id);

  for pillar_record in
    select value, ordinality
    from jsonb_array_elements(generation_result -> 'pillars')
      with ordinality
  loop
    if jsonb_typeof(pillar_record.value -> 'observable_variables') <> 'array'
      or jsonb_array_length(
        pillar_record.value -> 'observable_variables'
      ) = 0 then
      raise exception 'Every pillar must contain observable variables';
    end if;

    target_ref_pillar_id := null;
    if pillar_record.value ->> 'ref_pillar_code' <> 'new' then
      select reference.id
      into target_ref_pillar_id
      from public.ref_pillars as reference
      where reference.code = pillar_record.value ->> 'ref_pillar_code'
      order by reference.created_at desc
      limit 1;
    end if;

    insert into public.pillars (
      framework_id,
      ref_pillar_id,
      name,
      description,
      weight,
      order_index,
      origin,
      source_locale
    )
    values (
      target_framework_id,
      target_ref_pillar_id,
      pillar_record.value ->> 'name',
      pillar_record.value ->> 'description',
      (pillar_record.value ->> 'weight')::numeric,
      pillar_record.ordinality,
      case
        when target_ref_pillar_id is null then 'new'
        else 'referential'
      end,
      target_locale
    )
    returning id into target_pillar_id;

    variable_count := jsonb_array_length(
      pillar_record.value -> 'observable_variables'
    );

    insert into public.pillar_variables (
      pillar_id,
      code,
      label,
      description,
      weight,
      order_index,
      source_locale
    )
    select
      target_pillar_id,
      variable.value ->> 'code',
      variable.value ->> 'label',
      nullif(variable.value ->> 'description', ''),
      round(100.0 / variable_count, 2),
      variable.ordinality,
      target_locale
    from jsonb_array_elements(pillar_record.value -> 'observable_variables')
      with ordinality as variable(value, ordinality);

    insert into public.pillar_criteria (pillar_id, criterion_id)
    select target_pillar_id, criterion.id
    from public.criteria as criterion
    where criterion.framework_id = target_framework_id
      and criterion.code in (
        select jsonb_array_elements_text(
          pillar_record.value -> 'criteria_codes'
        )
      );

    -- Traductions facultatives : une entrée incomplète est ignorée, le
    -- pilier s'affiche alors dans sa langue source.
    translation_entries := case
      when jsonb_typeof(pillar_record.value -> 'translations') = 'array'
        then pillar_record.value -> 'translations'
      else '[]'::jsonb
    end;

    insert into public.pillar_translations (
      pillar_id,
      locale,
      name,
      description
    )
    select
      target_pillar_id,
      translation.value ->> 'locale',
      btrim(translation.value ->> 'name'),
      btrim(translation.value ->> 'description')
    from jsonb_array_elements(translation_entries) as translation(value)
    where translation.value ->> 'locale' in ('fr', 'en', 'pt', 'es')
      and translation.value ->> 'locale' <> target_locale
      and coalesce(btrim(translation.value ->> 'name'), '') <> ''
      and coalesce(btrim(translation.value ->> 'description'), '') <> ''
    on conflict (pillar_id, locale) do nothing;

    insert into public.pillar_variable_translations (
      pillar_variable_id,
      locale,
      label,
      description
    )
    select
      variable.id,
      translation.value ->> 'locale',
      btrim(variable_translation.value ->> 'label'),
      nullif(btrim(variable_translation.value ->> 'description'), '')
    from jsonb_array_elements(translation_entries) as translation(value)
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(translation.value -> 'observable_variables') = 'array'
          then translation.value -> 'observable_variables'
        else '[]'::jsonb
      end
    ) as variable_translation(value)
    join public.pillar_variables as variable
      on variable.pillar_id = target_pillar_id
      and variable.code = variable_translation.value ->> 'code'
    where translation.value ->> 'locale' in ('fr', 'en', 'pt', 'es')
      and translation.value ->> 'locale' <> target_locale
      and coalesce(btrim(variable_translation.value ->> 'label'), '') <> ''
    on conflict (pillar_variable_id, locale) do nothing;
  end loop;

  if target_job_id is not null then
    update public.pillar_generation_jobs
    set
      approach_id = target_approach_id,
      framework_id = target_framework_id,
      status = 'completed',
      result = generation_result,
      error_message = null,
      started_at = coalesce(started_at, now()),
      completed_at = now()
    where id = target_job_id;
  end if;

  return target_framework_id;
end;
$$;

revoke execute on function public.persist_generated_pillars(uuid, uuid, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.persist_generated_pillars(uuid, uuid, jsonb, uuid)
  to service_role;

-- Rattrapage des piliers existants. Un pilier ou une variable dont le texte
-- source est resté celui du référentiel reçoit les traductions du référentiel.
-- Les textes adaptés par l'IA ou saisis par l'utilisateur restent sans
-- traduction (« non traduit ») jusqu'à une nouvelle génération du cadre.
insert into public.pillar_translations (
  pillar_id,
  locale,
  name,
  description
)
select
  pillar.id,
  translation.locale,
  translation.name,
  translation.description
from public.pillars as pillar
join public.ref_pillar_translations as source_text
  on source_text.pillar_id = pillar.ref_pillar_id
  and source_text.locale = pillar.source_locale
  and source_text.name = pillar.name
  and source_text.description = pillar.description
join public.ref_pillar_translations as translation
  on translation.pillar_id = pillar.ref_pillar_id
  and translation.locale <> pillar.source_locale
on conflict (pillar_id, locale) do nothing;

insert into public.pillar_variable_translations (
  pillar_variable_id,
  locale,
  label,
  description
)
select
  variable.id,
  translation.locale,
  translation.variable_translations -> variable.code ->> 'label',
  nullif(translation.variable_translations -> variable.code ->> 'description', '')
from public.pillar_variables as variable
join public.pillars as pillar
  on pillar.id = variable.pillar_id
join public.ref_pillar_translations as source_text
  on source_text.pillar_id = pillar.ref_pillar_id
  and source_text.locale = variable.source_locale
  and source_text.variable_translations -> variable.code ->> 'label'
    = variable.label
join public.ref_pillar_translations as translation
  on translation.pillar_id = pillar.ref_pillar_id
  and translation.locale <> variable.source_locale
where coalesce(
    btrim(translation.variable_translations -> variable.code ->> 'label'),
    ''
  ) <> ''
on conflict (pillar_variable_id, locale) do nothing;
