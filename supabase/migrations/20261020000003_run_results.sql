-- ---------------------------------------------------------------------------
-- Moteur de la couche A : entrées figées d'un run et écriture des résultats.
--
-- Le worker de l'API lit les entrées (run_inputs), calcule variables, scores
-- et confiances (app/modules/runs/domain.py), puis écrit tout en une
-- transaction (complete_run). Les preuves sont construites ici à partir des
-- segments : le worker ne transporte que leurs identifiants.
--
-- Tant que la classification du corpus pour le cadre du run n'est pas
-- terminée (sondes en cours de vectorisation), le run est remis en file avec
-- un délai (defer_run) plutôt qu'échoué.
-- ---------------------------------------------------------------------------

create or replace function public.run_inputs(
  p_run_id uuid,
  p_lease_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.runs;
  job public.framework_classifications;
  pending boolean;
  classification_state text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  target := public.assert_run_lease(p_run_id, p_lease_token);

  -- Les classifications en base sont celles du dernier cadre validé : un
  -- cadre revalidé depuis le lancement rend le run incalculable.
  if public.workspace_validated_framework(target.workspace_id)
    is distinct from target.framework_id then
    classification_state := 'framework_changed';
  else
    select * into job from public.framework_classifications
    where framework_id = target.framework_id;
    select exists (
      select 1 from public.framework_probe_texts(target.framework_id) as current_probe
      where not exists (
        select 1 from public.pillar_probe_embeddings as probe
        where probe.pillar_id = current_probe.pillar_id
          and probe.pillar_variable_id is not distinct from current_probe.pillar_variable_id
          and probe.source_hash = current_probe.source_hash
      )
    ) into pending;
    classification_state := case
      when not pending then 'ready'
      when job.status = 'failed' and job.attempts >= 5 then 'failed'
      else 'pending'
    end;
  end if;

  return jsonb_build_object(
    'state', classification_state,
    'created_at', target.created_at,
    'versions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', version.id,
        'label', version.label,
        'order_index', version.order_index
      ) order by version.order_index)
      from public.program_versions as version
      where version.workspace_id = target.workspace_id
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'document_id', run_document.document_id,
        'program_version_id', run_document.program_version_id
      ))
      from public.run_documents as run_document
      where run_document.run_id = p_run_id
        and run_document.document_id is not null
    ), '[]'::jsonb),
    'pillars', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pillar.id,
        'weight', pillar.weight,
        'variables', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', variable.id,
            'code', variable.code,
            'weight', variable.weight
          ) order by variable.order_index), '[]'::jsonb)
          from public.pillar_variables as variable
          where variable.pillar_id = pillar.id
        )
      ) order by pillar.order_index)
      from public.pillars as pillar
      where pillar.framework_id = target.framework_id
    ), '[]'::jsonb),
    'segments', (
      select jsonb_build_object(
        'published', count(*),
        'classified', count(*) filter (where exists (
          select 1 from public.segment_classifications as classification
          where classification.segment_id = segment.id
            and classification.framework_id = target.framework_id
        )),
        'low_confidence', count(*) filter (where exists (
          select 1 from public.segment_classifications as classification
          where classification.segment_id = segment.id
            and classification.framework_id = target.framework_id
            and classification.is_low_confidence
        ))
      )
      from public.segments as segment
      where segment.published
        and segment.document_id in (
          select document_id from public.run_documents where run_id = p_run_id
        )
    ),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'segment_id', match.segment_id,
        'document_id', match.document_id,
        'pillar_variable_id', match.pillar_variable_id,
        'similarity', match.similarity
      ))
      from public.segment_variable_matches as match
      where match.framework_id = target.framework_id
        and match.document_id in (
          select document_id from public.run_documents where run_id = p_run_id
        )
    ), '[]'::jsonb)
  );
end;
$$;

-- claim_run (20261020000002) : un run différé par defer_run reste en file
-- sans être repris avant son délai (locked_until).
create or replace function public.claim_run(
  p_worker_id text,
  p_engine_version text,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  stale uuid;
  claimed public.runs;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;

  for stale in
    select id from public.runs
    where status = 'running' and locked_until < now() and attempts >= 3
    for update skip locked
  loop
    perform public.close_failed_run(
      stale, null, 'RUN_LEASE_EXPIRED',
      'Le worker a perdu le run à chacune de ses 3 tentatives.'
    );
  end loop;

  select * into claimed from public.runs
  where (status = 'pending' and (locked_until is null or locked_until < now()))
    or (status = 'running' and locked_until < now())
  order by created_at
  limit 1
  for update skip locked;
  if not found then
    return null;
  end if;

  delete from public.layer_a_scores where run_id = claimed.id;
  delete from public.intermediate_variables where run_id = claimed.id;
  delete from public.evidences where run_id = claimed.id;
  update public.run_steps
  set status = 'pending', started_at = null, completed_at = null,
      output_summary = null, error_message = null
  where run_id = claimed.id;

  update public.runs
  set status = 'running',
      attempts = attempts + 1,
      lease_token = gen_random_uuid(),
      locked_by = p_worker_id,
      locked_until = now() + make_interval(secs => p_lease_seconds),
      engine_version = p_engine_version,
      started_at = coalesce(started_at, now())
  where id = claimed.id
  returning * into claimed;

  return jsonb_build_object(
    'run_id', claimed.id,
    'workspace_id', claimed.workspace_id,
    'framework_id', claimed.framework_id,
    'lease_token', claimed.lease_token,
    'attempts', claimed.attempts,
    'rules_applied', claimed.rules_applied
  );
end;
$$;

-- Remet un run en file, sans compter de tentative : la classification du
-- corpus n'est pas encore prête.
create or replace function public.defer_run(
  p_run_id uuid,
  p_lease_token uuid,
  p_delay_seconds integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  perform public.assert_run_lease(p_run_id, p_lease_token);

  update public.run_steps
  set status = 'pending', started_at = null, completed_at = null,
      output_summary = case
        when step_name = 'classification'
          then jsonb_build_object('waiting', left(p_reason, 80))
      end,
      error_message = null
  where run_id = p_run_id;

  update public.runs
  set status = 'pending',
      attempts = greatest(attempts - 1, 0),
      lease_token = null,
      locked_by = null,
      locked_until = now() + make_interval(secs => p_delay_seconds)
  where id = p_run_id;
end;
$$;

-- Écrit les résultats d'un run et le termine, en une transaction.
--
-- p_results :
--   variables : [{id, pillar_id, variable_code, program_version_id, value,
--                 state, documents_count, corpus_confidence}]
--   evidences : [{variable_id, segment_id, similarity}]
--   scores    : [{pillar_id, program_version_id, score, delta,
--                 evolution_label, corpus_confidence, documents_count}]
--   rules     : règles du moteur, ajoutées à runs.rules_applied (GF-4)
--   summary   : résumé de l'étape de restitution
create or replace function public.complete_run(
  p_run_id uuid,
  p_lease_token uuid,
  p_results jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.runs;
  variables_count integer;
  evidences_count integer;
  scores_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  target := public.assert_run_lease(p_run_id, p_lease_token);
  if p_results is null or jsonb_typeof(p_results) <> 'object' then
    raise exception using errcode = 'P0001', message = 'RUN_RESULTS_INVALID';
  end if;

  begin
    insert into public.intermediate_variables (
      id, run_id, workspace_id, pillar_id, variable_code, program_version_id,
      value, state, documents_count, corpus_confidence
    )
    select
      (item ->> 'id')::uuid, p_run_id, target.workspace_id,
      (item ->> 'pillar_id')::uuid, item ->> 'variable_code',
      (item ->> 'program_version_id')::uuid, (item ->> 'value')::numeric,
      item ->> 'state', coalesce((item ->> 'documents_count')::integer, 0),
      (item ->> 'corpus_confidence')::numeric
    from jsonb_array_elements(coalesce(p_results -> 'variables', '[]')) as item;
    get diagnostics variables_count = row_count;

    -- Extrait, page et section viennent du segment, qui doit appartenir au
    -- corpus du run.
    with source as (
      select
        gen_random_uuid() as evidence_id,
        (item ->> 'variable_id')::uuid as variable_id,
        (item ->> 'segment_id')::uuid as segment_id,
        (item ->> 'similarity')::numeric as similarity
      from jsonb_array_elements(coalesce(p_results -> 'evidences', '[]')) as item
    ),
    inserted as (
      insert into public.evidences (
        id, run_id, workspace_id, document_id, segment_id, page_number,
        section_title, excerpt, pillar_id, variable_code, similarity
      )
      select
        source.evidence_id, p_run_id, target.workspace_id, segment.document_id,
        segment.id, segment.page_number, segment.section_title, segment.text,
        variable.pillar_id, variable.variable_code, round(source.similarity, 4)
      from source
      join public.intermediate_variables as variable
        on variable.id = source.variable_id and variable.run_id = p_run_id
      join public.segments as segment on segment.id = source.segment_id
      where exists (
        select 1 from public.run_documents as run_document
        where run_document.run_id = p_run_id
          and run_document.document_id = segment.document_id
      )
      returning id
    )
    insert into public.variable_evidences (variable_id, evidence_id)
    select source.variable_id, source.evidence_id
    from source
    join inserted on inserted.id = source.evidence_id;
    get diagnostics evidences_count = row_count;

    insert into public.layer_a_scores (
      run_id, workspace_id, pillar_id, program_version_id, score, delta,
      evolution_label, corpus_confidence, documents_count
    )
    select
      p_run_id, target.workspace_id, (item ->> 'pillar_id')::uuid,
      (item ->> 'program_version_id')::uuid, (item ->> 'score')::numeric,
      (item ->> 'delta')::numeric, item ->> 'evolution_label',
      (item ->> 'corpus_confidence')::numeric,
      (item ->> 'documents_count')::integer
    from jsonb_array_elements(coalesce(p_results -> 'scores', '[]')) as item;
    get diagnostics scores_count = row_count;
  exception
    when check_violation or not_null_violation or foreign_key_violation
      or unique_violation or invalid_text_representation
      or numeric_value_out_of_range then
      raise exception using errcode = 'P0001', message = 'RUN_RESULTS_INVALID',
        detail = sqlerrm;
  end;

  -- Piliers du cadre du run, versions de son espace.
  if exists (
    select 1
    from (
      select pillar_id, program_version_id from public.intermediate_variables
      where run_id = p_run_id
      union all
      select pillar_id, program_version_id from public.layer_a_scores
      where run_id = p_run_id
    ) as result
    left join public.pillars as pillar
      on pillar.id = result.pillar_id and pillar.framework_id = target.framework_id
    left join public.program_versions as version
      on version.id = result.program_version_id
      and version.workspace_id = target.workspace_id
    where pillar.id is null or version.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'RUN_RESULTS_INVALID',
      detail = 'pillar or program version outside the run';
  end if;

  update public.run_steps
  set status = case when step_name = 'restitution' then 'completed' else 'skipped' end,
      started_at = coalesce(started_at, now()),
      completed_at = now(),
      output_summary = case
        when step_name = 'restitution' then jsonb_build_object(
          'variables', variables_count,
          'evidences', evidences_count,
          'scores', scores_count
        ) || coalesce(p_results -> 'summary', '{}'::jsonb)
        else output_summary
      end
  where run_id = p_run_id
    and (step_name = 'restitution' or status in ('pending', 'running'));

  update public.runs
  set status = 'completed',
      completed_at = now(),
      lease_token = null,
      locked_by = null,
      locked_until = null,
      rules_applied = rules_applied
        || jsonb_build_object('engine', coalesce(p_results -> 'rules', '{}'::jsonb))
  where id = p_run_id;

  insert into public.audit_events (
    workspace_id, run_id, actor_type, operation, object_type, object_id,
    metadata
  )
  values (
    target.workspace_id, p_run_id, 'engine', 'run_completed', 'run', p_run_id,
    jsonb_build_object(
      'engine_version', target.engine_version,
      'variables', variables_count,
      'evidences', evidences_count,
      'scores', scores_count
    )
  );

  return jsonb_build_object(
    'variables', variables_count,
    'evidences', evidences_count,
    'scores', scores_count
  );
end;
$$;

revoke execute on function public.run_inputs(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.defer_run(uuid, uuid, integer, text)
  from public, anon, authenticated;
revoke execute on function public.complete_run(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.run_inputs(uuid, uuid) to service_role;
grant execute on function public.defer_run(uuid, uuid, integer, text) to service_role;
grant execute on function public.complete_run(uuid, uuid, jsonb) to service_role;

notify pgrst, 'reload schema';
