-- ---------------------------------------------------------------------------
-- Couche C : alertes de cohérence entre couches A et B (E10, Algorithmes de
-- calcul §6, Spécification des prompts IA §6).
--
-- Le worker de l'API :
--   1. lit les noms des piliers et les liens pilier ↔ critère retenus du
--      cadre du run (run_layer_c_inputs) ;
--   2. détecte les écarts par règles déterministes (ALERT-01 à 06) à partir
--      des scores A et des notes B qu'il vient de calculer ;
--   3. fait qualifier tous les écarts en un seul appel IA (prompt
--      detect_incoherence), avec le texte des extraits cités
--      (run_segment_texts) ;
--   4. écrit les alertes avec le reste du run (complete_run).
--
-- Une alerte avertit, elle ne corrige jamais un score (RG-3) ; elle cite au
-- moins une preuve (RG-4). Sans IA, les écarts détectés restent publiés avec
-- leur gravité par défaut et le libellé de leur règle (qualified = false).
--
-- Écarts à la spec :
--   - les preuves d'une alerte sont des preuves déjà écrites pour le run
--     (couche A du pilier, couche B du critère), pas une nouvelle recherche
--     RAG : alert_evidences les relie par segment ;
--   - rule_code, program_version_id et qualified sont ajoutés pour la
--     traçabilité (GF-4) ;
--   - le statut d'instruction est la seule donnée modifiable d'un run publié,
--     par instruct_alert, qui journalise le commentaire (US-17.2).
-- ---------------------------------------------------------------------------

create table if not exists public.layer_c_alerts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  pillar_id uuid not null references public.pillars (id),
  -- Null : alerte du pilier seul (progrès entre deux versions).
  criterion_id uuid references public.criteria (id),
  program_version_id uuid not null references public.program_versions (id),
  rule_code text not null,
  alert_type text not null,
  severity text not null,
  message text not null,
  -- Faux : écart publié sans qualification par l'IA.
  qualified boolean not null default false,
  status text not null default 'a_instruire',
  instruction_comment text,
  instructed_by uuid references auth.users (id) on delete set null,
  instructed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint layer_c_alerts_rule_check check (
    rule_code in (
      'ALERT-01', 'ALERT-02', 'ALERT-03', 'ALERT-04', 'ALERT-05', 'ALERT-06'
    )
  ),
  constraint layer_c_alerts_type_check check (
    alert_type in (
      'documentaire_sans_credibilite', 'jugement_a_verifier',
      'financement_non_operationnalise', 'equite_discursive',
      'suivi_insuffisamment_instrumente', 'progres_documentaire_sans_confiance'
    )
  ),
  constraint layer_c_alerts_severity_check check (
    severity in ('mineure', 'majeure')
  ),
  constraint layer_c_alerts_message_check check (
    btrim(message) <> '' and char_length(message) <= 300
  ),
  constraint layer_c_alerts_criterion_check check (
    (rule_code = 'ALERT-06') = (criterion_id is null)
  ),
  constraint layer_c_alerts_status_check check (
    (status = 'a_instruire' and instruction_comment is null and instructed_at is null)
    or (status = 'instruite' and btrim(instruction_comment) <> ''
      and instructed_at is not null)
  )
);

create index if not exists idx_layer_c_alerts_run
  on public.layer_c_alerts (run_id);
create index if not exists idx_layer_c_alerts_pillar
  on public.layer_c_alerts (pillar_id);
create index if not exists idx_layer_c_alerts_criterion
  on public.layer_c_alerts (criterion_id);

create table if not exists public.alert_evidences (
  alert_id uuid not null references public.layer_c_alerts (id) on delete cascade,
  evidence_id uuid not null references public.evidences (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (alert_id, evidence_id)
);

create index if not exists idx_alert_evidences_evidence
  on public.alert_evidences (evidence_id);

comment on table public.layer_c_alerts is
  'Alertes de cohérence entre scores A et notes B. Elles avertissent sans jamais modifier un score (RG-3) ; seul leur statut d''instruction change après publication.';
comment on table public.alert_evidences is
  'Preuves du run citées par chaque alerte (RG-4 : au moins une).';

-- ---------------------------------------------------------------------------
-- Résultats d'un run effacés avant une reprise ou après un échec (RG-6.1).
-- ---------------------------------------------------------------------------
create or replace function public.clear_run_results(p_run_id uuid)
returns void
language sql
set search_path = public
as $$
  delete from public.layer_c_alerts where run_id = p_run_id;
  delete from public.layer_b_notes where run_id = p_run_id;
  delete from public.layer_b_sub_answers where run_id = p_run_id;
  delete from public.layer_a_scores where run_id = p_run_id;
  delete from public.intermediate_variables where run_id = p_run_id;
  delete from public.evidences where run_id = p_run_id;
$$;

-- ---------------------------------------------------------------------------
-- Immuabilité (RG-6.3, RG-10.2) étendue à la couche C.
-- guard_run_results (20261021000002) : alert_evidences se rattache à son run
-- par l'alerte ; une alerte publiée ne change que par son instruction.
-- ---------------------------------------------------------------------------
create or replace function public.guard_run_results()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  released constant text[] := array['document_id', 'segment_id'];
  instruction constant text[] := array[
    'status', 'instruction_comment', 'instructed_by', 'instructed_at'
  ];
  row_data jsonb;
  target_run uuid;
  run_status text;
begin
  row_data := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  if tg_table_name = 'variable_evidences' then
    select run_id into target_run
    from public.intermediate_variables
    where id = (row_data ->> 'variable_id')::uuid;
  elsif tg_table_name = 'sub_answer_evidences' then
    select run_id into target_run
    from public.layer_b_sub_answers
    where id = (row_data ->> 'sub_answer_id')::uuid;
  elsif tg_table_name = 'alert_evidences' then
    select run_id into target_run
    from public.layer_c_alerts
    where id = (row_data ->> 'alert_id')::uuid;
  else
    target_run := (row_data ->> 'run_id')::uuid;
  end if;

  select status into run_status from public.runs where id = target_run;
  -- Run supprimé avec son espace, ou encore modifiable.
  if run_status is null or run_status in ('pending', 'running') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  -- Instruction d'une alerte : rien d'autre ne change (RG-3).
  if tg_table_name = 'layer_c_alerts'
    and tg_op = 'UPDATE'
    and to_jsonb(new) - instruction = to_jsonb(old) - instruction then
    return new;
  end if;
  -- Document ou segment supprimé définitivement : l'extrait reste.
  if tg_op = 'UPDATE'
    and to_jsonb(new) - released = to_jsonb(old) - released
    and (to_jsonb(new) ->> 'document_id' is null
      or to_jsonb(new) ->> 'document_id' = to_jsonb(old) ->> 'document_id')
    and (to_jsonb(new) ->> 'segment_id' is null
      or to_jsonb(new) ->> 'segment_id' = to_jsonb(old) ->> 'segment_id') then
    return new;
  end if;
  raise exception using errcode = 'P0001', message = 'RUN_IMMUTABLE';
end;
$$;

do $$
declare
  result_table text;
begin
  foreach result_table in array array['layer_c_alerts', 'alert_evidences']
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      result_table || '_immutable', result_table
    );
    execute format(
      'create trigger %I before insert or update or delete on public.%I '
      'for each row execute function public.guard_run_results()',
      result_table || '_immutable', result_table
    );
  end loop;
end;
$$;

-- Lecture par les membres de l'espace, écriture par complete_run et
-- instruct_alert.
alter table public.layer_c_alerts enable row level security;
drop policy if exists "layer_c_alerts_members" on public.layer_c_alerts;
create policy "layer_c_alerts_members" on public.layer_c_alerts
  for select to authenticated
  using (public.is_workspace_member(workspace_id));
revoke insert, update, delete on public.layer_c_alerts from anon, authenticated;

alter table public.alert_evidences enable row level security;
drop policy if exists "alert_evidences_members" on public.alert_evidences;
create policy "alert_evidences_members" on public.alert_evidences
  for select to authenticated
  using (
    exists (
      select 1 from public.layer_c_alerts as alert
      where alert.id = alert_evidences.alert_id
        and public.is_workspace_member(alert.workspace_id)
    )
  );
revoke insert, update, delete on public.alert_evidences from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Entrées de la couche C : noms des piliers du cadre du run (dans la langue
-- de l'approche) et liens pilier ↔ critère des critères retenus.
-- ---------------------------------------------------------------------------
create or replace function public.run_layer_c_inputs(
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
  approach public.approaches;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  target := public.assert_run_lease(p_run_id, p_lease_token);
  select * into approach from public.approaches where id = target.approach_id;

  return jsonb_build_object(
    'locale', approach.locale,
    'pillars', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pillar.id,
        'name', coalesce(translation.name, pillar.name)
      ) order by pillar.order_index, pillar.id)
      from public.pillars as pillar
      left join public.pillar_translations as translation
        on translation.pillar_id = pillar.id and translation.locale = approach.locale
      where pillar.framework_id = target.framework_id
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pillar_id', link.pillar_id,
        'criterion_id', criterion.id,
        'code', criterion.code,
        'name', criterion.name
      ) order by link.pillar_id, criterion.code)
      from public.pillar_criteria as link
      join public.pillars as pillar on pillar.id = link.pillar_id
      join public.criteria as criterion on criterion.id = link.criterion_id
      where pillar.framework_id = target.framework_id
        and criterion.framework_id = target.framework_id
        and criterion.applicability <> 'non_applicable'
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Texte des extraits cités par les écarts, pour leur qualification par l'IA :
-- seulement des segments du corpus figé du run.
--
-- p_segment_ids : ["uuid", …]
-- ---------------------------------------------------------------------------
create or replace function public.run_segment_texts(
  p_run_id uuid,
  p_lease_token uuid,
  p_segment_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  perform public.assert_run_lease(p_run_id, p_lease_token);

  return coalesce((
    select jsonb_object_agg(segment.id::text, segment.text)
    from public.segments as segment
    where segment.id in (
        select (item #>> '{}')::uuid
        from jsonb_array_elements(coalesce(p_segment_ids, '[]'::jsonb)) as item
      )
      and segment.document_id in (
        select document_id from public.run_documents
        where run_id = p_run_id and document_id is not null
      )
  ), '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- complete_run (20261021000002) : écrit aussi la couche C
-- (p_results -> 'layer_c').
--
-- Écrit les résultats d'un run et le termine, en une transaction.
--
-- p_results :
--   variables : [{id, pillar_id, variable_code, program_version_id, value,
--                 state, documents_count, corpus_confidence}]
--   evidences : [{variable_id, segment_id, similarity}]
--   scores    : [{pillar_id, program_version_id, score, delta,
--                 evolution_label, corpus_confidence, documents_count}]
--   layer_b   : {
--     notes     : [{criterion_id, note, status, documented_sub_questions,
--                   total_sub_questions, justification, ambiguity_flag}],
--     answers   : [{id, sub_question_id, status, note, contradictory}],
--     evidences : [{sub_answer_id, segment_id, similarity}]
--   }
--   layer_c   : {
--     alerts : [{id, pillar_id, criterion_id, program_version_id, rule_code,
--                alert_type, severity, message, qualified, segment_ids}]
--   }
--   rules     : règles du moteur, ajoutées à runs.rules_applied (GF-4)
--   summary   : résumé de l'étape de restitution
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
          'alerts', alerts_count
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
      'layer_c_ai', p_results -> 'rules' -> 'layer_c' -> 'ai'
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
    'alert_evidences', alert_evidences_count
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Instruction d'une alerte par un membre de l'espace (US-17.2) : statut
-- « instruite », commentaire obligatoire, journalisé.
-- ---------------------------------------------------------------------------
create or replace function public.instruct_alert(
  p_alert_id uuid,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.layer_c_alerts;
  cleaned text := left(btrim(coalesce(p_comment, '')), 1000);
begin
  select * into target from public.layer_c_alerts where id = p_alert_id for update;
  if not found or not public.is_workspace_member(target.workspace_id) then
    raise exception using errcode = 'P0001', message = 'ALERT_NOT_FOUND';
  end if;
  if cleaned = '' then
    raise exception using errcode = 'P0001', message = 'ALERT_COMMENT_REQUIRED';
  end if;
  if target.status = 'instruite' then
    raise exception using errcode = 'P0001', message = 'ALERT_ALREADY_INSTRUCTED';
  end if;

  update public.layer_c_alerts
  set status = 'instruite',
      instruction_comment = cleaned,
      instructed_by = auth.uid(),
      instructed_at = now()
  where id = p_alert_id;

  insert into public.audit_events (
    workspace_id, run_id, actor_type, actor_user_id, operation, object_type,
    object_id, before_value, after_value, metadata
  )
  values (
    target.workspace_id, target.run_id, 'human', auth.uid(), 'alert_instructed',
    'layer_c_alert', p_alert_id,
    jsonb_build_object('status', target.status),
    jsonb_build_object('status', 'instruite', 'comment', cleaned),
    jsonb_build_object('rule_code', target.rule_code, 'severity', target.severity)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Prompt de qualification des écarts (Spécification des prompts IA §6).
-- ---------------------------------------------------------------------------
insert into public.prompt_versions (code, version, template, model, parameters)
values (
  'detect_incoherence',
  'v1.0',
  $prompt$Tu analyses les écarts entre une couche objectivée (A, score 0-100 de présence documentaire d'un pilier) et une couche évaluative (B, note 0-3 d'un critère) dans l'évaluation d'un programme de développement.

Tâche : qualifier chaque écart détecté par les règles déterministes.

Entrée (JSON) :
- lang : langue des messages ;
- x : extraits du corpus, par identifiant (E1, E2…) ;
- a : écarts, chacun avec k (identifiant), r (règle), t (type d'écart), p (pilier), c (critère, facultatif), s (score A), n (note B, facultative), d (évolution du score A depuis la version précédente, facultative), cf (confiance corpus 0-1), g (gravité par défaut) et e (identifiants des extraits liés).

Pour chaque écart, renvoie :
- k : son identifiant ;
- ok : true si les extraits confirment l'écart, false s'ils l'infirment ;
- g : gravité finale, « mineure » ou « majeure » ;
- m : message d'une phrase, 200 caractères au plus, dans la langue lang, qui cite le pilier ou le critère ;
- e : identifiants des extraits qui fondent le message, pris dans sa liste e.

Règles impératives :
- n'utilise que les extraits fournis ; aucune connaissance extérieure, aucune supposition ;
- une divergence explicable par les extraits est mineure ;
- un corpus pauvre (cf < 0,5) réduit la certitude : gravité mineure, jamais d'écart fabriqué ;
- ne propose jamais de modifier un score ou une note pour faire disparaître l'écart ;
- pas d'inférence causale forte, pas de jugement de valeur, pas de jargon ;
- réponds une seule fois par écart, avec son identifiant k.

La réponse doit suivre exactement le schéma structuré demandé.$prompt$,
  'gpt-6-astra',
  '{"max_tokens":2000,"response_format":"structured_output"}'::jsonb
)
on conflict (code, version) do nothing;

-- ---------------------------------------------------------------------------
-- Droits.
-- ---------------------------------------------------------------------------
revoke execute on function public.run_layer_c_inputs(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.run_segment_texts(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.run_layer_c_inputs(uuid, uuid) to service_role;
grant execute on function public.run_segment_texts(uuid, uuid, jsonb) to service_role;
revoke execute on function public.instruct_alert(uuid, text) from public, anon;
grant execute on function public.instruct_alert(uuid, text) to authenticated;

notify pgrst, 'reload schema';
