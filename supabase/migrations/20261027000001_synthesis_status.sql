-- ---------------------------------------------------------------------------
-- Statut de rédaction de la synthèse.
--
-- `qualified = false` couvrait trois cas que l'écran confondait en « IA
-- indisponible » ; le worker écrit désormais lequel (restitution/1.1.0) :
--   completed  : synthèse rédigée par l'IA ;
--   not_needed : aucun constat ni origine d'action retenu, aucun appel ;
--   disabled   : IA désactivée sur le worker ;
--   failed     : prompt introuvable, erreur ou réponse inexploitable.
-- ---------------------------------------------------------------------------

alter table public.syntheses add column if not exists status text;

-- Synthèses déjà écrites : statut tiré de l'usage de l'IA figé dans le run.
-- Le trigger d'immuabilité est suspendu le temps de ce rattrapage.
alter table public.syntheses disable trigger syntheses_immutable;
update public.syntheses as synthesis
set status = case
  when synthesis.qualified then 'completed'
  when run.rules_applied #>> '{engine,restitution,ai,status}' = 'not_needed'
    then 'not_needed'
  when run.rules_applied #> '{engine,restitution,ai,errors}' ? 'AI_DISABLED'
    then 'disabled'
  else 'failed'
end
from public.runs as run
where run.id = synthesis.run_id and synthesis.status is null;
alter table public.syntheses enable trigger syntheses_immutable;

alter table public.syntheses alter column status set not null;
alter table public.syntheses drop constraint if exists syntheses_status_check;
alter table public.syntheses add constraint syntheses_status_check check (
  status in ('completed', 'not_needed', 'disabled', 'failed')
);

comment on column public.syntheses.status is
  'Rédaction par l''IA : completed, not_needed (aucun constat), disabled (IA désactivée) ou failed.';

-- ---------------------------------------------------------------------------
-- complete_run (20261022000001) : écrit aussi le statut de la synthèse
-- (p_results -> 'restitution' -> 'synthesis' ->> 'status').
-- ---------------------------------------------------------------------------
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
  notes_count integer;
  answers_count integer;
  answer_evidences_count integer;
  alerts_count integer;
  alert_evidences_count integer;
  items_count integer := 0;
  item_evidences_count integer := 0;
  actions_count integer := 0;
  action_evidences_count integer := 0;
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

    insert into public.layer_b_notes (
      run_id, workspace_id, criterion_id, note, status,
      documented_sub_questions, total_sub_questions, justification,
      ambiguity_flag
    )
    select
      p_run_id, target.workspace_id, (item ->> 'criterion_id')::uuid,
      (item ->> 'note')::numeric, item ->> 'status',
      (item ->> 'documented_sub_questions')::integer,
      (item ->> 'total_sub_questions')::integer,
      left(nullif(btrim(item ->> 'justification'), ''), 1000),
      coalesce((item ->> 'ambiguity_flag')::boolean, false)
    from jsonb_array_elements(
      coalesce(p_results -> 'layer_b' -> 'notes', '[]')
    ) as item;
    get diagnostics notes_count = row_count;

    insert into public.layer_b_sub_answers (
      id, run_id, workspace_id, sub_question_id, status, note, contradictory
    )
    select
      (item ->> 'id')::uuid, p_run_id, target.workspace_id,
      (item ->> 'sub_question_id')::uuid, item ->> 'status',
      (item ->> 'note')::smallint,
      coalesce((item ->> 'contradictory')::boolean, false)
    from jsonb_array_elements(
      coalesce(p_results -> 'layer_b' -> 'answers', '[]')
    ) as item;
    get diagnostics answers_count = row_count;

    -- Comme pour la couche A : l'extrait vient du segment, qui doit
    -- appartenir au corpus du run ; la preuve porte le critère de la réponse.
    with source as (
      select
        gen_random_uuid() as evidence_id,
        (item ->> 'sub_answer_id')::uuid as sub_answer_id,
        (item ->> 'segment_id')::uuid as segment_id,
        (item ->> 'similarity')::numeric as similarity
      from jsonb_array_elements(
        coalesce(p_results -> 'layer_b' -> 'evidences', '[]')
      ) as item
    ),
    inserted as (
      insert into public.evidences (
        id, run_id, workspace_id, document_id, segment_id, page_number,
        section_title, excerpt, criterion_id, similarity
      )
      select
        source.evidence_id, p_run_id, target.workspace_id, segment.document_id,
        segment.id, segment.page_number, segment.section_title, segment.text,
        question.criterion_id, round(source.similarity, 4)
      from source
      join public.layer_b_sub_answers as answer
        on answer.id = source.sub_answer_id
        and answer.run_id = p_run_id
        and answer.status = 'documentee'
      join public.sub_questions as question on question.id = answer.sub_question_id
      join public.segments as segment on segment.id = source.segment_id
      where exists (
        select 1 from public.run_documents as run_document
        where run_document.run_id = p_run_id
          and run_document.document_id = segment.document_id
      )
      returning id
    )
    insert into public.sub_answer_evidences (sub_answer_id, evidence_id)
    select source.sub_answer_id, source.evidence_id
    from source
    join inserted on inserted.id = source.evidence_id;
    get diagnostics answer_evidences_count = row_count;

    insert into public.layer_c_alerts (
      id, run_id, workspace_id, pillar_id, criterion_id, program_version_id,
      rule_code, alert_type, severity, message, qualified
    )
    select
      (item ->> 'id')::uuid, p_run_id, target.workspace_id,
      (item ->> 'pillar_id')::uuid, (item ->> 'criterion_id')::uuid,
      (item ->> 'program_version_id')::uuid, item ->> 'rule_code',
      item ->> 'alert_type', item ->> 'severity',
      left(btrim(item ->> 'message'), 300),
      coalesce((item ->> 'qualified')::boolean, false)
    from jsonb_array_elements(
      coalesce(p_results -> 'layer_c' -> 'alerts', '[]')
    ) as item;
    get diagnostics alerts_count = row_count;

    -- Une alerte cite les preuves déjà écrites pour son pilier (couche A) ou
    -- son critère (couche B) : un segment cité par plusieurs variables ne
    -- compte qu'une fois.
    insert into public.alert_evidences (alert_id, evidence_id)
    select distinct on (alert.id, evidence.segment_id) alert.id, evidence.id
    from jsonb_array_elements(
      coalesce(p_results -> 'layer_c' -> 'alerts', '[]')
    ) as item
    cross join lateral jsonb_array_elements_text(
      coalesce(item -> 'segment_ids', '[]')
    ) as cited (segment_id)
    join public.layer_c_alerts as alert
      on alert.id = (item ->> 'id')::uuid and alert.run_id = p_run_id
    join public.evidences as evidence
      on evidence.run_id = p_run_id
      and evidence.segment_id = cited.segment_id::uuid
      and (evidence.pillar_id = alert.pillar_id
        or evidence.criterion_id = alert.criterion_id)
    order by alert.id, evidence.segment_id, evidence.criterion_id nulls last,
      evidence.id;
    get diagnostics alert_evidences_count = row_count;

    if jsonb_typeof(p_results -> 'restitution') = 'object' then
      insert into public.syntheses (
        run_id, workspace_id, conclusion, limits, qualified, status
      )
      select
        p_run_id, target.workspace_id,
        left(nullif(btrim(synthesis ->> 'conclusion'), ''), 800),
        coalesce(synthesis -> 'limits', '{}'::jsonb),
        coalesce((synthesis ->> 'qualified')::boolean, false),
        -- Worker antérieur : seule la qualification est connue.
        coalesce(
          synthesis ->> 'status',
          case when (synthesis ->> 'qualified')::boolean then 'completed'
            else 'failed' end
        )
      from (
        select coalesce(p_results -> 'restitution' -> 'synthesis', '{}'::jsonb)
          as synthesis
      ) as source;

      insert into public.synthesis_items (
        id, run_id, workspace_id, section, position, text, pillar_id,
        program_version_id, criterion_id, alert_id
      )
      select
        (item ->> 'id')::uuid, p_run_id, target.workspace_id,
        item ->> 'section', (item ->> 'position')::smallint,
        left(btrim(item ->> 'text'), 300), (item ->> 'pillar_id')::uuid,
        (item ->> 'program_version_id')::uuid, (item ->> 'criterion_id')::uuid,
        (item ->> 'alert_id')::uuid
      from jsonb_array_elements(
        coalesce(p_results -> 'restitution' -> 'items', '[]')
      ) as item;
      get diagnostics items_count = row_count;

      -- Une puce cite les preuves déjà écrites pour son pilier, son critère
      -- ou son alerte.
      insert into public.synthesis_item_evidences (item_id, evidence_id)
      select distinct on (item.id, evidence.segment_id) item.id, evidence.id
      from jsonb_array_elements(
        coalesce(p_results -> 'restitution' -> 'items', '[]')
      ) as source
      cross join lateral jsonb_array_elements_text(
        coalesce(source -> 'segment_ids', '[]')
      ) as cited (segment_id)
      join public.synthesis_items as item
        on item.id = (source ->> 'id')::uuid and item.run_id = p_run_id
      join public.evidences as evidence
        on evidence.run_id = p_run_id
        and evidence.segment_id = cited.segment_id::uuid
        and (evidence.pillar_id = item.pillar_id
          or evidence.criterion_id = item.criterion_id
          or exists (
            select 1 from public.alert_evidences as link
            where link.alert_id = item.alert_id
              and link.evidence_id = evidence.id
          ))
      order by item.id, evidence.segment_id, evidence.criterion_id nulls last,
        evidence.id;
      get diagnostics item_evidences_count = row_count;

      insert into public.run_actions (
        id, run_id, workspace_id, position, origin_type, pillar_id,
        program_version_id, criterion_id, alert_id
      )
      select
        (item ->> 'id')::uuid, p_run_id, target.workspace_id,
        (item ->> 'position')::smallint, item ->> 'origin_type',
        (item ->> 'pillar_id')::uuid, (item ->> 'program_version_id')::uuid,
        (item ->> 'criterion_id')::uuid, (item ->> 'alert_id')::uuid
      from jsonb_array_elements(
        coalesce(p_results -> 'restitution' -> 'actions', '[]')
      ) as item;
      get diagnostics actions_count = row_count;

      insert into public.run_action_projections (
        action_id, persona, text, justification
      )
      select
        (item ->> 'id')::uuid, projection ->> 'persona',
        left(btrim(projection ->> 'text'), 300),
        left(btrim(projection ->> 'justification'), 300)
      from jsonb_array_elements(
        coalesce(p_results -> 'restitution' -> 'actions', '[]')
      ) as item
      cross join lateral jsonb_array_elements(
        coalesce(item -> 'projections', '[]')
      ) as projection;

      insert into public.run_action_evidences (action_id, evidence_id)
      select distinct on (action.id, evidence.segment_id) action.id, evidence.id
      from jsonb_array_elements(
        coalesce(p_results -> 'restitution' -> 'actions', '[]')
      ) as source
      cross join lateral jsonb_array_elements_text(
        coalesce(source -> 'segment_ids', '[]')
      ) as cited (segment_id)
      join public.run_actions as action
        on action.id = (source ->> 'id')::uuid and action.run_id = p_run_id
      join public.evidences as evidence
        on evidence.run_id = p_run_id
        and evidence.segment_id = cited.segment_id::uuid
        and (evidence.pillar_id = action.pillar_id
          or evidence.criterion_id = action.criterion_id
          or exists (
            select 1 from public.alert_evidences as link
            where link.alert_id = action.alert_id
              and link.evidence_id = evidence.id
          ))
      order by action.id, evidence.segment_id, evidence.criterion_id nulls last,
        evidence.id;
      get diagnostics action_evidences_count = row_count;
    end if;
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
      union all
      select pillar_id, program_version_id from public.layer_c_alerts
      where run_id = p_run_id
      union all
      select pillar_id, program_version_id from public.synthesis_items
      where run_id = p_run_id and pillar_id is not null
      union all
      select pillar_id, program_version_id from public.run_actions
      where run_id = p_run_id and pillar_id is not null
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

  -- Critères et sous-questions du cadre du run ; les compteurs d'une note
  -- sont ceux de ses réponses.
  if exists (
    select 1
    from (
      select criterion_id from public.layer_b_notes where run_id = p_run_id
      union all
      select criterion_id from public.layer_c_alerts
      where run_id = p_run_id and criterion_id is not null
      union all
      select criterion_id from public.synthesis_items
      where run_id = p_run_id and criterion_id is not null
      union all
      select criterion_id from public.run_actions
      where run_id = p_run_id and criterion_id is not null
    ) as result
    left join public.criteria as criterion
      on criterion.id = result.criterion_id
      and criterion.framework_id = target.framework_id
    where criterion.id is null
  ) or exists (
    select 1
    from public.layer_b_sub_answers as answer
    left join public.sub_questions as question
      on question.id = answer.sub_question_id
    left join public.criteria as criterion
      on criterion.id = question.criterion_id
      and criterion.framework_id = target.framework_id
    where answer.run_id = p_run_id and criterion.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'RUN_RESULTS_INVALID',
      detail = 'criterion or sub-question outside the run';
  end if;
  if exists (
    select 1
    from public.layer_b_notes as note
    cross join lateral (
      select
        count(*) as total,
        count(*) filter (where answer.status = 'documentee') as documented
      from public.layer_b_sub_answers as answer
      join public.sub_questions as question on question.id = answer.sub_question_id
      where answer.run_id = p_run_id
        and question.criterion_id = note.criterion_id
    ) as counted
    where note.run_id = p_run_id
      and (note.total_sub_questions <> counted.total
        or note.documented_sub_questions <> counted.documented)
  ) then
    raise exception using errcode = 'P0001', message = 'RUN_RESULTS_INVALID',
      detail = 'layer B counts do not match the answers';
  end if;
  -- RG-4 : chaque alerte cite au moins une preuve du run.
  if exists (
    select 1 from public.layer_c_alerts as alert
    where alert.run_id = p_run_id
      and not exists (
        select 1 from public.alert_evidences as link where link.alert_id = alert.id
      )
  ) then
    raise exception using errcode = 'P0001', message = 'RUN_RESULTS_INVALID',
      detail = 'alert without evidence';
  end if;
  -- La restitution ne cite que les alertes du run.
  if exists (
    select 1
    from (
      select alert_id from public.synthesis_items
      where run_id = p_run_id and alert_id is not null
      union all
      select alert_id from public.run_actions
      where run_id = p_run_id and alert_id is not null
    ) as result
    left join public.layer_c_alerts as alert
      on alert.id = result.alert_id and alert.run_id = p_run_id
    where alert.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'RUN_RESULTS_INVALID',
      detail = 'alert outside the run';
  end if;
  -- GF-1 : chaque puce et chaque action citent au moins une preuve du run.
  if exists (
    select 1 from public.synthesis_items as item
    where item.run_id = p_run_id
      and not exists (
        select 1 from public.synthesis_item_evidences as link
        where link.item_id = item.id
      )
  ) or exists (
    select 1 from public.run_actions as action
    where action.run_id = p_run_id
      and not exists (
        select 1 from public.run_action_evidences as link
        where link.action_id = action.id
      )
  ) then
    raise exception using errcode = 'P0001', message = 'RUN_RESULTS_INVALID',
      detail = 'synthesis item or action without evidence';
  end if;
  -- RG-11.4 : chaque action a ses trois projections persona.
  if exists (
    select 1 from public.run_actions as action
    where action.run_id = p_run_id
      and (
        select count(*) from public.run_action_projections as projection
        where projection.action_id = action.id
      ) <> 3
  ) then
    raise exception using errcode = 'P0001', message = 'RUN_RESULTS_INVALID',
      detail = 'action without its three persona projections';
  end if;

  update public.run_steps
  set status = case when step_name = 'restitution' then 'completed' else 'skipped' end,
      started_at = coalesce(started_at, now()),
      completed_at = now(),
      output_summary = case
        when step_name = 'restitution' then jsonb_build_object(
          'variables', variables_count,
          'evidences', evidences_count,
          'scores', scores_count,
          'notes', notes_count,
          'sub_answers', answers_count,
          'layer_b_evidences', answer_evidences_count,
          'alerts', alerts_count,
          'synthesis_items', items_count,
          'actions', actions_count
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
      'scores', scores_count,
      'notes', notes_count,
      'sub_answers', answers_count,
      'layer_b_evidences', answer_evidences_count,
      'layer_b_ai', p_results -> 'rules' -> 'layer_b' -> 'ai',
      'alerts', alerts_count,
      'alert_evidences', alert_evidences_count,
      'layer_c_ai', p_results -> 'rules' -> 'layer_c' -> 'ai',
      'synthesis_items', items_count,
      'synthesis_item_evidences', item_evidences_count,
      'actions', actions_count,
      'action_evidences', action_evidences_count,
      'restitution_ai', p_results -> 'rules' -> 'restitution' -> 'ai'
    )
  );

  return jsonb_build_object(
    'variables', variables_count,
    'evidences', evidences_count,
    'scores', scores_count,
    'notes', notes_count,
    'sub_answers', answers_count,
    'layer_b_evidences', answer_evidences_count,
    'alerts', alerts_count,
    'alert_evidences', alert_evidences_count,
    'synthesis_items', items_count,
    'synthesis_item_evidences', item_evidences_count,
    'actions', actions_count,
    'action_evidences', action_evidences_count
  );
end;
$$;

notify pgrst, 'reload schema';
