-- ---------------------------------------------------------------------------
-- Couche B : notes évaluatives par critère (E9, Algorithmes de calcul §5,
-- Schéma de base de données §28-29).
--
-- Le worker de l'API :
--   1. lit les critères retenus du cadre du run et leurs sous-questions
--      actives (run_layer_b_inputs) ;
--   2. vectorise chaque sous-question avec le modèle des segments et retrouve
--      les segments les plus proches dans le corpus figé du run
--      (run_sub_question_matches) ;
--   3. ne soumet à l'IA que les critères dont au moins 50 % des
--      sous-questions ont des extraits, en un seul appel par run (prompt
--      grade_sub_questions) ; l'IA note chaque sous-question de 0 à 3 en
--      citant les extraits fournis, et seulement eux (GF-1) ;
--   4. écrit notes, réponses et preuves avec le reste du run (complete_run).
--
-- Sans IA disponible, aucune note n'est produite : les critères passent en
-- « non conclu » (GF-3).
--
-- Écarts à la spec :
--   - layer_b_sub_answers garde la note IA de la sous-question et le signal
--     de contradiction (journalisation GF-4) ;
--   - sub_answer_evidences relie chaque réponse à ses preuves : les preuves
--     de la couche B sont des lignes de public.evidences portant criterion_id ;
--   - workspace_id est ajouté pour les droits, comme les autres résultats.
-- ---------------------------------------------------------------------------

create table if not exists public.layer_b_notes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  criterion_id uuid not null references public.criteria (id),
  -- Null : critère non conclu.
  note numeric(3, 2),
  status text not null,
  documented_sub_questions integer not null,
  total_sub_questions integer not null,
  justification text,
  ambiguity_flag boolean not null default false,
  created_at timestamptz not null default now(),
  constraint layer_b_notes_unique unique (run_id, criterion_id),
  constraint layer_b_notes_status_check check (
    (status = 'conclu' and note between 0 and 3)
    or (status = 'non_conclu' and note is null)
  ),
  constraint layer_b_notes_counts_check check (
    total_sub_questions >= 0
    and documented_sub_questions between 0 and total_sub_questions
  ),
  -- RG-1 : une note exige au moins 50 % de sous-questions documentées.
  constraint layer_b_notes_threshold_check check (
    status <> 'conclu'
    or (total_sub_questions > 0
      and documented_sub_questions * 2 >= total_sub_questions)
  )
);

create index if not exists idx_layer_b_notes_criterion
  on public.layer_b_notes (criterion_id);

create table if not exists public.layer_b_sub_answers (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  sub_question_id uuid not null references public.sub_questions (id),
  status text not null,
  -- Note IA 0-3 de la sous-question ; null sans notation (IA indisponible,
  -- ou critère non soumis faute de 50 % de sous-questions documentées).
  note smallint,
  contradictory boolean not null default false,
  created_at timestamptz not null default now(),
  constraint layer_b_sub_answers_unique unique (run_id, sub_question_id),
  constraint layer_b_sub_answers_status_check check (
    status in ('documentee', 'non_documentee')
  ),
  constraint layer_b_sub_answers_note_check check (
    note is null or (status = 'documentee' and note between 0 and 3)
  ),
  constraint layer_b_sub_answers_contradictory_check check (
    not contradictory or note is not null
  )
);

create index if not exists idx_layer_b_sub_answers_question
  on public.layer_b_sub_answers (sub_question_id);

create table if not exists public.sub_answer_evidences (
  sub_answer_id uuid not null
    references public.layer_b_sub_answers (id) on delete cascade,
  evidence_id uuid not null references public.evidences (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sub_answer_id, evidence_id)
);

create index if not exists idx_sub_answer_evidences_evidence
  on public.sub_answer_evidences (evidence_id);

comment on table public.layer_b_notes is
  'Notes évaluatives 0-3 par critère : moyenne des notes des sous-questions documentées, si au moins 50 % le sont. Jamais modifiées (RG-10.2).';
comment on table public.layer_b_sub_answers is
  'Réponses aux sous-questions : documentée ou non, note IA 0-3 et contradiction des extraits.';
comment on table public.sub_answer_evidences is
  'Extraits cités à l''appui de chaque réponse de la couche B.';

-- ---------------------------------------------------------------------------
-- Résultats d'un run effacés avant une reprise ou après un échec (RG-6.1).
-- ---------------------------------------------------------------------------
create or replace function public.clear_run_results(p_run_id uuid)
returns void
language sql
set search_path = public
as $$
  delete from public.layer_b_notes where run_id = p_run_id;
  delete from public.layer_b_sub_answers where run_id = p_run_id;
  delete from public.layer_a_scores where run_id = p_run_id;
  delete from public.intermediate_variables where run_id = p_run_id;
  delete from public.evidences where run_id = p_run_id;
$$;

-- ---------------------------------------------------------------------------
-- Immuabilité (RG-6.3, RG-10.2) étendue aux résultats de la couche B.
-- guard_run_results (20261020000002) : sub_answer_evidences se rattache à
-- son run par la réponse, comme variable_evidences par la variable.
-- ---------------------------------------------------------------------------
create or replace function public.guard_run_results()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  released constant text[] := array['document_id', 'segment_id'];
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
  else
    target_run := (row_data ->> 'run_id')::uuid;
  end if;

  select status into run_status from public.runs where id = target_run;
  -- Run supprimé avec son espace, ou encore modifiable.
  if run_status is null or run_status in ('pending', 'running') then
    return case when tg_op = 'DELETE' then old else new end;
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

-- close_failed_run (20261020000002) : efface aussi la couche B.
create or replace function public.close_failed_run(
  p_run_id uuid,
  p_step_name text,
  p_error_code text,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.runs;
begin
  select * into target from public.runs where id = p_run_id for update;
  if not found or target.status in ('completed', 'failed') then
    return;
  end if;

  perform public.clear_run_results(p_run_id);
  update public.run_steps
  set status = case
        when step_name = p_step_name or status = 'running' then 'failed'
        else 'skipped'
      end,
      error_message = case
        when step_name = p_step_name or status = 'running'
          then left(p_error_message, 500)
      end,
      completed_at = now()
  where run_id = p_run_id and status in ('pending', 'running');

  update public.runs
  set status = 'failed',
      lease_token = null,
      locked_by = null,
      locked_until = null,
      error_code = left(p_error_code, 80),
      error_message = left(p_error_message, 500),
      completed_at = now()
  where id = p_run_id;

  insert into public.audit_events (
    workspace_id, run_id, actor_type, operation, object_type, object_id,
    metadata
  )
  values (
    target.workspace_id, p_run_id, 'engine', 'run_failed', 'run', p_run_id,
    jsonb_build_object(
      'step', p_step_name,
      'error_code', left(p_error_code, 80),
      'engine_version', target.engine_version,
      'attempts', target.attempts
    )
  );
end;
$$;

-- claim_run (20261020000003) : efface aussi la couche B d'un run repris.
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

  perform public.clear_run_results(claimed.id);
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

do $$
declare
  result_table text;
begin
  foreach result_table in array array[
    'layer_b_notes', 'layer_b_sub_answers', 'sub_answer_evidences'
  ]
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

-- Lecture par les membres de l'espace, écriture par complete_run.
do $$
declare
  result_table text;
begin
  foreach result_table in array array['layer_b_notes', 'layer_b_sub_answers']
  loop
    execute format('alter table public.%I enable row level security', result_table);
    execute format(
      'drop policy if exists %I on public.%I', result_table || '_members', result_table
    );
    execute format(
      'create policy %I on public.%I for select to authenticated '
      'using (public.is_workspace_member(workspace_id))',
      result_table || '_members', result_table
    );
    execute format(
      'revoke insert, update, delete on public.%I from anon, authenticated',
      result_table
    );
  end loop;
end;
$$;

alter table public.sub_answer_evidences enable row level security;
drop policy if exists "sub_answer_evidences_members" on public.sub_answer_evidences;
create policy "sub_answer_evidences_members" on public.sub_answer_evidences
  for select to authenticated
  using (
    exists (
      select 1 from public.layer_b_sub_answers as answer
      where answer.id = sub_answer_evidences.sub_answer_id
        and public.is_workspace_member(answer.workspace_id)
    )
  );
revoke insert, update, delete on public.sub_answer_evidences
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Entrées de la couche B : critères retenus du cadre du run et leurs
-- sous-questions actives, dans la langue de l'approche.
-- ---------------------------------------------------------------------------
create or replace function public.run_layer_b_inputs(
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
    'cycle', approach.cycle,
    'criteria', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', criterion.id,
        'code', criterion.code,
        'name', criterion.name,
        'definition', criterion.definition,
        'applicability', criterion.applicability,
        'questions', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', question.id,
            'text', question.text,
            'expected_evidence', question.expected_evidence
          ) order by question.order_index, question.id), '[]'::jsonb)
          from public.sub_questions as question
          where question.criterion_id = criterion.id
            and question.status = 'active'
        )
      ) order by criterion.code)
      from public.criteria as criterion
      where criterion.framework_id = target.framework_id
        and criterion.applicability <> 'non_applicable'
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Recherche des preuves (RAG) : pour chaque sous-question vectorisée par le
-- worker, les p_top_k segments publiés du corpus figé du run les plus
-- proches, avec le même modèle d'embeddings. Recherche exacte : le corpus
-- d'un run tient en mémoire, et l'index HNSW filtré par espace pourrait
-- manquer des voisins.
--
-- p_queries : [{sub_question_id, embedding}]
-- ---------------------------------------------------------------------------
create or replace function public.run_sub_question_matches(
  p_run_id uuid,
  p_lease_token uuid,
  p_model text,
  p_queries jsonb,
  p_top_k integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  perform public.assert_run_lease(p_run_id, p_lease_token);
  if p_top_k not between 1 and 20 then
    raise exception using errcode = 'P0001', message = 'INVALID_TOP_K';
  end if;

  return coalesce((
    with corpus as materialized (
      select segment.id, segment.document_id, segment.text, embedding.embedding
      from public.segments as segment
      join public.segment_embeddings as embedding
        on embedding.segment_id = segment.id and embedding.model = p_model
      where segment.published
        and segment.document_id in (
          select document_id from public.run_documents
          where run_id = p_run_id and document_id is not null
        )
    ),
    queries as (
      select
        (item ->> 'sub_question_id')::uuid as sub_question_id,
        (item ->> 'embedding')::vector as embedding
      from jsonb_array_elements(coalesce(p_queries, '[]'::jsonb)) as item
    )
    select jsonb_agg(jsonb_build_object(
      'sub_question_id', queries.sub_question_id,
      'segment_id', nearest.id,
      'document_id', nearest.document_id,
      'similarity', round(nearest.similarity::numeric, 4),
      'text', nearest.text
    ))
    from queries
    cross join lateral (
      select
        corpus.id,
        corpus.document_id,
        corpus.text,
        1 - (corpus.embedding <=> queries.embedding) as similarity
      from corpus
      order by corpus.embedding <=> queries.embedding, corpus.id
      limit p_top_k
    ) as nearest
  ), '[]'::jsonb);
end;
$$;

-- complete_run (20261020000003) : écrit aussi la couche B (p_results -> 'layer_b').
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
  notes_count integer;
  answers_count integer;
  answer_evidences_count integer;
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

  -- Critères et sous-questions du cadre du run ; les compteurs d'une note
  -- sont ceux de ses réponses.
  if exists (
    select 1
    from public.layer_b_notes as note
    left join public.criteria as criterion
      on criterion.id = note.criterion_id
      and criterion.framework_id = target.framework_id
    where note.run_id = p_run_id and criterion.id is null
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
          'layer_b_evidences', answer_evidences_count
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
      'layer_b_ai', p_results -> 'rules' -> 'layer_b' -> 'ai'
    )
  );

  return jsonb_build_object(
    'variables', variables_count,
    'evidences', evidences_count,
    'scores', scores_count,
    'notes', notes_count,
    'sub_answers', answers_count,
    'layer_b_evidences', answer_evidences_count
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Prompt de notation des sous-questions (Spécification des prompts IA §10).
-- ---------------------------------------------------------------------------
insert into public.prompt_versions (code, version, template, model, parameters)
values (
  'grade_sub_questions',
  'v1.0',
  $prompt$Tu es un évaluateur de programmes de développement et d'adaptation climatique. Tu appliques les critères CAD-OCDE et les critères complémentaires (équité, gestion adaptative).

Tâche : noter chaque sous-question évaluative de 0 à 3, uniquement d'après les extraits du corpus fournis.

Entrée (JSON) :
- lang : langue des justifications ;
- cycle : cycle de l'évaluation ;
- x : extraits du corpus, par identifiant (E1, E2…) ;
- c : critères, chacun avec k (identifiant), n (nom), d (définition), s (statut : obligatoire, optionnel ou prospectif) et q (sous-questions) ;
- chaque sous-question porte k (identifiant), t (texte), p (preuves attendues, facultatif) et e (identifiants des extraits retrouvés pour elle).

Barème : 0 insuffisant ; 1 faible ; 2 moyen ; 3 solide.

Règles impératives :
- n'utilise que les extraits listés dans e pour la sous-question ; aucune connaissance extérieure, aucune supposition ;
- pour chaque sous-question, renvoie dans e les identifiants des extraits qui fondent la note, pris dans sa liste ;
- si aucun extrait ne répond réellement à la sous-question, renvoie n = null et e = [] : elle sera traitée comme non documentée ;
- si les extraits se contredisent, retiens la note la plus prudente et renvoie c = true ;
- critère prospectif : apprécie la qualité de ce qui est prévu (conception), pas des résultats ;
- une amélioration de rédaction n'est pas une amélioration de mise en œuvre ;
- pour chaque critère, une justification j d'une ou deux phrases, 300 caractères au plus, dans la langue lang, qui ne contient rien d'absent des extraits ;
- réponds une seule fois par sous-question et par critère, avec leurs identifiants k.

La réponse doit suivre exactement le schéma structuré demandé.$prompt$,
  'gpt-6-astra',
  '{"temperature":0,"max_tokens":6000,"response_format":"structured_output"}'::jsonb
)
on conflict (code, version) do nothing;

-- ---------------------------------------------------------------------------
-- Droits.
-- ---------------------------------------------------------------------------
revoke execute on function public.clear_run_results(uuid)
  from public, anon, authenticated;
revoke execute on function public.run_layer_b_inputs(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.run_sub_question_matches(uuid, uuid, text, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.run_layer_b_inputs(uuid, uuid) to service_role;
grant execute on function public.run_sub_question_matches(uuid, uuid, text, jsonb, integer)
  to service_role;

notify pgrst, 'reload schema';
