create or replace function public.save_approach_proposal(
  target_workspace_id uuid,
  target_ref_framework_id uuid,
  target_cycle public.evaluation_cycle,
  target_instrument_module public.instrument_module,
  target_instrument_subtype text,
  target_complexity_score integer,
  target_complexity_class public.complexity_class,
  target_complexity_factors jsonb,
  target_recommended_methods jsonb,
  target_evaluation_nature public.evaluation_nature,
  target_questionnaire_answers jsonb,
  target_justifications jsonb,
  target_locale text,
  target_criteria jsonb
)
returns public.approaches
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_approach public.approaches%rowtype;
  next_version integer;
  active_weight numeric;
begin
  if auth.uid() is null
    or not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Only a workspace administrator can save an approach';
  end if;

  if jsonb_typeof(target_criteria) <> 'array'
    or jsonb_array_length(target_criteria) = 0 then
    raise exception 'At least one criterion is required';
  end if;

  if not exists (
    select 1
    from public.ref_frameworks
    where id = target_ref_framework_id
  ) then
    raise exception 'Unknown reference framework';
  end if;

  select coalesce(sum((criterion.value ->> 'weight')::numeric), 0)
  into active_weight
  from jsonb_array_elements(target_criteria) as criterion(value)
  where criterion.value ->> 'applicability' <> 'non_applicable';

  if abs(active_weight - 100) > 0.01 then
    raise exception 'Active criterion weights must total 100, got %', active_weight;
  end if;

  select *
  into saved_approach
  from public.approaches
  where workspace_id = target_workspace_id
    and status in ('proposed', 'modified')
  for update;

  if saved_approach.id is null then
    select coalesce(max(version), 0) + 1
    into next_version
    from public.approaches
    where workspace_id = target_workspace_id;

    insert into public.approaches (
      workspace_id,
      version,
      status,
      ref_framework_id,
      cycle,
      instrument_module,
      instrument_subtype,
      complexity_score,
      complexity_class,
      complexity_factors,
      recommended_methods,
      evaluation_nature,
      questionnaire_answers,
      justifications,
      locale,
      created_by
    )
    values (
      target_workspace_id,
      next_version,
      'proposed',
      target_ref_framework_id,
      target_cycle,
      target_instrument_module,
      target_instrument_subtype,
      target_complexity_score,
      target_complexity_class,
      target_complexity_factors,
      target_recommended_methods,
      target_evaluation_nature,
      target_questionnaire_answers,
      target_justifications,
      target_locale,
      auth.uid()
    )
    returning * into saved_approach;
  else
    update public.approaches
    set
      status = 'modified',
      ref_framework_id = target_ref_framework_id,
      cycle = target_cycle,
      instrument_module = target_instrument_module,
      instrument_subtype = target_instrument_subtype,
      complexity_score = target_complexity_score,
      complexity_class = target_complexity_class,
      complexity_factors = target_complexity_factors,
      recommended_methods = target_recommended_methods,
      evaluation_nature = target_evaluation_nature,
      questionnaire_answers = target_questionnaire_answers,
      justifications = target_justifications,
      locale = target_locale
    where id = saved_approach.id
    returning * into saved_approach;

    delete from public.approach_criteria
    where approach_id = saved_approach.id;
  end if;

  insert into public.approach_criteria (
    approach_id,
    ref_criterion_id,
    applicability,
    weight,
    source
  )
  select
    saved_approach.id,
    (criterion.value ->> 'refCriterionId')::uuid,
    (criterion.value ->> 'applicability')::public.criterion_applicability,
    (criterion.value ->> 'weight')::numeric,
    criterion.value ->> 'source'
  from jsonb_array_elements(target_criteria) as criterion(value)
  join public.ref_criteria as reference
    on reference.id = (criterion.value ->> 'refCriterionId')::uuid
  join public.ref_cycle_criteria as cycle_rule
    on cycle_rule.criterion_id = reference.id
    and cycle_rule.cycle = target_cycle::text;

  if (
    select count(*)
    from public.approach_criteria
    where approach_id = saved_approach.id
  ) <> jsonb_array_length(target_criteria) then
    raise exception 'One or more criteria are invalid for the selected cycle';
  end if;

  return saved_approach;
end;
$$;

revoke all on function public.save_approach_proposal(
  uuid,
  uuid,
  public.evaluation_cycle,
  public.instrument_module,
  text,
  integer,
  public.complexity_class,
  jsonb,
  jsonb,
  public.evaluation_nature,
  jsonb,
  jsonb,
  text,
  jsonb
) from public;

grant execute on function public.save_approach_proposal(
  uuid,
  uuid,
  public.evaluation_cycle,
  public.instrument_module,
  text,
  integer,
  public.complexity_class,
  jsonb,
  jsonb,
  public.evaluation_nature,
  jsonb,
  jsonb,
  text,
  jsonb
) to authenticated, service_role;

create or replace function public.confirm_approach_and_generate(
  target_approach_id uuid
)
returns public.approaches
language plpgsql
security definer
set search_path = public
as $$
declare
  confirmed_approach public.approaches%rowtype;
  active_weight numeric;
begin
  select *
  into confirmed_approach
  from public.approaches
  where id = target_approach_id
  for update;

  if confirmed_approach.id is null then
    raise exception 'Approach not found';
  end if;

  if auth.uid() is null
    or not public.is_workspace_admin(confirmed_approach.workspace_id) then
    raise exception 'Only a workspace administrator can confirm an approach';
  end if;

  if confirmed_approach.status = 'confirmed' then
    return confirmed_approach;
  end if;

  select coalesce(sum(weight), 0)
  into active_weight
  from public.approach_criteria
  where approach_id = target_approach_id
    and applicability <> 'non_applicable';

  if abs(active_weight - 100) > 0.01 then
    raise exception 'Active criterion weights must total 100, got %', active_weight;
  end if;

  update public.approaches
  set
    status = 'confirmed',
    confirmed_by = auth.uid(),
    confirmed_at = now()
  where id = target_approach_id
  returning * into confirmed_approach;

  if to_regprocedure('public.enqueue_pillar_generation(uuid)') is null then
    raise exception 'Pillar generation queue is not installed';
  end if;

  execute 'select public.enqueue_pillar_generation($1)'
  using confirmed_approach.workspace_id;

  return confirmed_approach;
end;
$$;

revoke all on function public.confirm_approach_and_generate(uuid) from public;
grant execute on function public.confirm_approach_and_generate(uuid)
  to authenticated, service_role;

comment on function public.save_approach_proposal(
  uuid,
  uuid,
  public.evaluation_cycle,
  public.instrument_module,
  text,
  integer,
  public.complexity_class,
  jsonb,
  jsonb,
  public.evaluation_nature,
  jsonb,
  jsonb,
  text,
  jsonb
) is 'Atomically saves a versioned approach proposal and its validated criteria.';

comment on function public.confirm_approach_and_generate(uuid) is
  'Confirms an approach and enqueues pillar generation in the same transaction.';
