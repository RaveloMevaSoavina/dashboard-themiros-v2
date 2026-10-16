-- ---------------------------------------------------------------------------
-- Dérivation des sous-questions évaluatives par critère (étape 2, F6).
--
-- Quand le cadre est généré, chaque critère applicable reçoit les questions du
-- référentiel (public.ref_questions) dont l'applicabilité couvre :
--   - le cycle de l'approche ;
--   - son module d'instrument (M1, M2, M3) ;
--   - son sous-type, si la question est restreinte (C-08, multi-pays).
-- Un critère non applicable ne reçoit aucune question (RG-4.7.2).
--
-- Le texte est celui de la langue de l'approche, avec repli sur l'anglais puis
-- le français. ref_question_id conserve l'identifiant du référentiel
-- (RG-3b.4). Les questions sont créées actives, dans l'ordre de leur code ;
-- l'utilisateur les désactive, complète ou réordonne tant que le cadre est en
-- brouillon (seul statut ouvert en écriture sur public.sub_questions).
--
-- Les angles spécifiques des cadres financeurs ne sont que des libellés, sans
-- texte de question ni critère de rattachement : ils ne sont pas dérivés ici.
-- ---------------------------------------------------------------------------

create or replace function public.seed_framework_sub_questions(
  target_framework_id uuid
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.sub_questions (
    criterion_id,
    ref_question_id,
    text,
    layer,
    expected_evidence,
    status,
    order_index,
    origin
  )
  select
    criterion.id,
    question.id,
    coalesce(
      requested_translation.text,
      english_translation.text,
      french_translation.text,
      question.text
    ),
    question.layer,
    coalesce(
      requested_translation.expected_evidence,
      english_translation.expected_evidence,
      french_translation.expected_evidence,
      question.expected_evidence
    ),
    'active',
    row_number() over (
      partition by criterion.id
      order by question.code
    ),
    'referential'
  from public.frameworks as framework
  join public.approaches as approach
    on approach.id = framework.approach_id
  join public.criteria as criterion
    on criterion.framework_id = framework.id
    and criterion.applicability <> 'non_applicable'
  join public.approach_criteria as approach_criterion
    on approach_criterion.approach_id = approach.id
  join public.ref_criteria as reference
    on reference.id = approach_criterion.ref_criterion_id
    and reference.code = criterion.code
  join public.ref_questions as question
    on question.criterion_code = reference.code
    and question.version = reference.version
    and approach.cycle::text = any(question.applicable_cycles)
    and approach.instrument_module::text = any(question.applicable_modules)
    and (
      question.applicable_subtypes is null
      or approach.instrument_subtype = any(question.applicable_subtypes)
    )
  left join public.ref_question_translations as requested_translation
    on requested_translation.question_id = question.id
    and requested_translation.locale = approach.locale
  left join public.ref_question_translations as english_translation
    on english_translation.question_id = question.id
    and english_translation.locale = 'en'
  left join public.ref_question_translations as french_translation
    on french_translation.question_id = question.id
    and french_translation.locale = 'fr'
  where framework.id = target_framework_id
    and not exists (
      select 1
      from public.sub_questions as existing
      where existing.criterion_id = criterion.id
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

comment on function public.seed_framework_sub_questions(uuid) is
  'Derives the active reference sub-questions of every applicable criterion of a framework from its approach cycle, module and subtype. Skips criteria that already have sub-questions.';

-- Appelée uniquement depuis persist_generated_pillars (SECURITY DEFINER) et
-- par cette migration.
revoke execute on function public.seed_framework_sub_questions(uuid)
  from public, anon, authenticated;

-- Identique à 20260928000001, plus la dérivation des sous-questions juste
-- après la création des critères.
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
  next_version integer;
  pillar_record record;
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

  perform 1
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
      origin
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
      end
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
      order_index
    )
    select
      target_pillar_id,
      variable.value ->> 'code',
      variable.value ->> 'label',
      nullif(variable.value ->> 'description', ''),
      round(100.0 / variable_count, 2),
      variable.ordinality
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

-- Rattrapage : les cadres en brouillon déjà générés n'ont aucune sous-question.
-- Les cadres validés ou remplacés sont figés (RG-3.2) et ne sont pas modifiés.
do $$
declare
  framework_record record;
  seeded_count integer := 0;
begin
  for framework_record in
    select framework.id
    from public.frameworks as framework
    where framework.status = 'draft'
  loop
    seeded_count := seeded_count
      + public.seed_framework_sub_questions(framework_record.id);
  end loop;

  raise notice 'Seeded % sub-questions on existing draft frameworks',
    seeded_count;
end
$$;
