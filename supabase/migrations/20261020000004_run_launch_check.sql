-- ---------------------------------------------------------------------------
-- Conditions de lancement d'une analyse, partagées par le bouton « Lancer
-- l'analyse » (infobulle, US-12.2) et par create_run : une seule règle.
-- create_run (20261020000002) est réécrite pour appliquer run_launch_check.
-- ---------------------------------------------------------------------------

create or replace function public.run_launch_check(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  framework public.frameworks;
  approach public.approaches;
  settings public.critical_mass_settings;
  incomplete_criteria text[];
  pending_documents integer;
  counted integer;
  level text;
  blocker text;
  detail text;
begin
  if auth.uid() is null or not public.is_workspace_member(p_workspace_id) then
    raise exception using errcode = '42501', message = 'WORKSPACE_MEMBER_REQUIRED';
  end if;

  select * into framework from public.frameworks
  where id = public.workspace_validated_framework(p_workspace_id);
  select * into approach from public.approaches where id = framework.approach_id;
  -- RG-3b.2 : au moins 3 sous-questions actives par critère obligatoire.
  select array_agg(criterion.code order by criterion.code)
  into incomplete_criteria
  from public.criteria as criterion
  where criterion.framework_id = framework.id
    and criterion.applicability = 'obligatoire'
    and (
      select count(*) from public.sub_questions as question
      where question.criterion_id = criterion.id and question.status = 'active'
    ) < 3;
  -- Corpus : documents conformes ou intégrés sur décision humaine (RG-4.1),
  -- tous indexés (sinon leurs segments manqueraient au calcul).
  select count(*), count(*) filter (where indexed_at is null)
  into counted, pending_documents
  from public.documents
  where workspace_id = p_workspace_id
    and deleted_at is null
    and public.document_is_eligible(status);
  settings := public.current_critical_mass_settings(p_workspace_id);
  level := public.critical_mass_level(
    counted, public.critical_mass_coverage(p_workspace_id), settings
  );

  if framework.id is null then
    blocker := 'FRAMEWORK_NOT_VALIDATED';
  elsif approach.status is distinct from 'confirmed' or incomplete_criteria is not null then
    blocker := 'CRITERIA_NOT_CONFIRMED';
    detail := array_to_string(incomplete_criteria, ', ');
  elsif exists (
    select 1 from public.runs
    where workspace_id = p_workspace_id and status in ('pending', 'running')
  ) then
    blocker := 'RUN_ALREADY_ACTIVE';
  elsif level is null then
    blocker := 'INSUFFICIENT_CORPUS';
    detail := format('%s/%s', counted, settings.exploratory_min_documents);
  elsif pending_documents > 0 then
    blocker := 'CORPUS_NOT_READY';
    detail := pending_documents::text;
  end if;

  return jsonb_build_object(
    'code', blocker,
    'detail', detail,
    'corpus_size', counted,
    'minimum_documents', settings.exploratory_min_documents,
    'corpus_seuil', level,
    'framework_id', framework.id,
    'approach_id', approach.id
  );
end;
$$;

-- create_run (20261020000002) applique désormais run_launch_check.
create or replace function public.create_run(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  checked jsonb;
  settings public.critical_mass_settings;
  sole_version uuid;
  created public.runs;
begin
  if actor is null or not public.is_workspace_member(p_workspace_id) then
    raise exception using errcode = '42501', message = 'WORKSPACE_MEMBER_REQUIRED';
  end if;
  perform pg_advisory_xact_lock(hashtext('runs:' || p_workspace_id::text));

  checked := public.run_launch_check(p_workspace_id);
  if checked ->> 'code' is not null then
    raise exception using errcode = 'P0001', message = checked ->> 'code',
      detail = coalesce(checked ->> 'detail', '');
  end if;
  settings := public.current_critical_mass_settings(p_workspace_id);

  insert into public.runs (
    workspace_id, framework_id, approach_id, corpus_size, corpus_seuil,
    rules_applied, created_by
  )
  values (
    p_workspace_id, (checked ->> 'framework_id')::uuid,
    (checked ->> 'approach_id')::uuid, (checked ->> 'corpus_size')::integer,
    checked ->> 'corpus_seuil',
    jsonb_build_object(
      'critical_mass_settings',
      to_jsonb(settings) - array['workspace_id', 'note', 'created_by', 'created_at'],
      'pillars', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'pillar_id', pillar.id,
          'weight', pillar.weight,
          'variables', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'code', variable.code, 'weight', variable.weight
            ) order by variable.order_index), '[]'::jsonb)
            from public.pillar_variables as variable
            where variable.pillar_id = pillar.id
          )
        ) order by pillar.order_index), '[]'::jsonb)
        from public.pillars as pillar
        where pillar.framework_id = (checked ->> 'framework_id')::uuid
      )
    ),
    actor
  )
  returning * into created;

  insert into public.run_steps (run_id, workspace_id, step_name, position)
  select created.id, p_workspace_id, step.name, step.position
  from unnest(array[
    'classification', 'variables', 'layer_a', 'layer_b', 'layer_c',
    'restitution'
  ]) with ordinality as step (name, position);

  -- Un document sans version est rattaché à la version unique de l'espace,
  -- s'il n'en a qu'une.
  select case when count(*) = 1 then (array_agg(id))[1] end
  into sole_version
  from public.program_versions
  where workspace_id = p_workspace_id;

  insert into public.run_documents (
    run_id, workspace_id, document_id, program_version_id, original_filename,
    file_hash, status, relevance_score
  )
  select
    created.id, p_workspace_id, document.id,
    coalesce(document_version.program_version_id, sole_version),
    document.original_filename, document.file_hash, document.status,
    document.relevance_score
  from public.documents as document
  left join public.document_versions as document_version
    on document_version.document_id = document.id
  where document.workspace_id = p_workspace_id
    and document.deleted_at is null
    and public.document_is_eligible(document.status);

  insert into public.audit_events (
    workspace_id, run_id, actor_type, actor_user_id, operation, object_type,
    object_id, after_value
  )
  values (
    p_workspace_id, created.id, 'human', actor, 'run_created', 'run',
    created.id,
    jsonb_build_object(
      'framework_id', created.framework_id,
      'corpus_size', created.corpus_size,
      'corpus_seuil', created.corpus_seuil
    )
  );

  return jsonb_build_object(
    'run_id', created.id,
    'status', created.status,
    'corpus_size', created.corpus_size,
    'corpus_seuil', created.corpus_seuil,
    'created_at', created.created_at
  );
end;
$$;

revoke execute on function public.run_launch_check(uuid) from public, anon;
grant execute on function public.run_launch_check(uuid) to authenticated;

notify pgrst, 'reload schema';
