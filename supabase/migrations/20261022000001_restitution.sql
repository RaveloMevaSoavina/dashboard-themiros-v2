-- ---------------------------------------------------------------------------
-- Restitution : synthèse et plan d'action par persona (E11, Algorithmes de
-- calcul §8, Spécification des prompts IA §8 et §9).
--
-- Le worker de l'API, après la couche C :
--   1. retient par règles déterministes les candidats de la synthèse
--      (progrès, faiblesses, zones à vérifier) et les origines des actions
--      (faiblesses, alertes, critères non conclus) ;
--   2. les fait rédiger en un seul appel IA (prompt formulate_restitution) :
--      chaque puce, la conclusion prudente, et chaque action avec ses trois
--      projections persona ;
--   3. écrit le tout avec le reste du run (complete_run).
--
-- Sans IA, les candidats restent publiés avec un libellé factuel, sans
-- conclusion ni plan d'action (syntheses.qualified = false).
--
-- Écarts à la spec :
--   - un seul prompt et un seul appel par run, au lieu de formulate_synthesis
--     puis generate_action_plan par persona ;
--   - tables normalisées au lieu de colonnes JSONB : synthesis_items et
--     run_actions, leurs preuves (par segment, comme alert_evidences) et
--     run_action_projections (une ligne par persona) : les trois projections
--     d'une action partagent son origine et ses preuves (RG-11.4) ;
--   - syntheses.limits porte les limites du corpus, calculées sans IA :
--     l'écran ouvre par elles quand plusieurs critères sont non conclus
--     (RG-11.1) ;
--   - jusqu'à 3 puces par rubrique : on affiche ce qui existe (§8.6).
-- ---------------------------------------------------------------------------

create table if not exists public.syntheses (
  run_id uuid primary key references public.runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Null : conclusion non rédigée (IA indisponible).
  conclusion text,
  -- {not_concluded, criteria, confidence, leads}
  limits jsonb not null default '{}'::jsonb,
  -- Faux : puces au libellé factuel, sans rédaction par l'IA.
  qualified boolean not null default false,
  created_at timestamptz not null default now(),
  constraint syntheses_conclusion_check check (
    conclusion is null
    or (btrim(conclusion) <> '' and char_length(conclusion) <= 800)
  ),
  constraint syntheses_limits_check check (jsonb_typeof(limits) = 'object')
);

create index if not exists idx_syntheses_workspace
  on public.syntheses (workspace_id);

create table if not exists public.synthesis_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  section text not null,
  position smallint not null,
  text text not null,
  pillar_id uuid references public.pillars (id),
  program_version_id uuid references public.program_versions (id),
  criterion_id uuid references public.criteria (id),
  alert_id uuid references public.layer_c_alerts (id),
  created_at timestamptz not null default now(),
  constraint synthesis_items_section_check check (
    section in ('progres', 'faiblesse', 'a_verifier')
  ),
  constraint synthesis_items_position_check check (position between 1 and 3),
  constraint synthesis_items_text_check check (
    btrim(text) <> '' and char_length(text) <= 300
  ),
  -- Progrès : un pilier et sa version ; faiblesse : un pilier et sa version,
  -- ou un critère ; zone à vérifier : une alerte.
  constraint synthesis_items_origin_check check (
    (section = 'progres' and pillar_id is not null
      and program_version_id is not null and criterion_id is null
      and alert_id is null)
    or (section = 'faiblesse' and alert_id is null and (
      (pillar_id is not null and program_version_id is not null
        and criterion_id is null)
      or (criterion_id is not null and pillar_id is null
        and program_version_id is null)))
    or (section = 'a_verifier' and alert_id is not null and pillar_id is null
      and program_version_id is null and criterion_id is null)
  ),
  constraint synthesis_items_position_unique unique (run_id, section, position)
);

create index if not exists idx_synthesis_items_run
  on public.synthesis_items (run_id);

create table if not exists public.synthesis_item_evidences (
  item_id uuid not null references public.synthesis_items (id) on delete cascade,
  evidence_id uuid not null references public.evidences (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, evidence_id)
);

create index if not exists idx_synthesis_item_evidences_evidence
  on public.synthesis_item_evidences (evidence_id);

create table if not exists public.run_actions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  position smallint not null,
  origin_type text not null,
  pillar_id uuid references public.pillars (id),
  program_version_id uuid references public.program_versions (id),
  criterion_id uuid references public.criteria (id),
  alert_id uuid references public.layer_c_alerts (id),
  created_at timestamptz not null default now(),
  constraint run_actions_position_check check (position >= 1),
  constraint run_actions_origin_check check (
    (origin_type = 'pillar' and pillar_id is not null
      and program_version_id is not null and criterion_id is null
      and alert_id is null)
    or (origin_type = 'criterion' and criterion_id is not null
      and pillar_id is null and program_version_id is null and alert_id is null)
    or (origin_type = 'alert' and alert_id is not null and pillar_id is null
      and program_version_id is null and criterion_id is null)
  ),
  constraint run_actions_position_unique unique (run_id, position)
);

create index if not exists idx_run_actions_run
  on public.run_actions (run_id);

-- Une même action, reformulée pour chaque persona (RG-11.4).
create table if not exists public.run_action_projections (
  action_id uuid not null references public.run_actions (id) on delete cascade,
  persona text not null,
  text text not null,
  -- Raison de l'action ; l'écran l'affiche après « Recommandée parce que ».
  justification text not null,
  created_at timestamptz not null default now(),
  primary key (action_id, persona),
  constraint run_action_projections_persona_check check (
    persona in ('decideur', 'pmu', 'analyste')
  ),
  constraint run_action_projections_text_check check (
    btrim(text) <> '' and char_length(text) <= 300
  ),
  constraint run_action_projections_justification_check check (
    btrim(justification) <> '' and char_length(justification) <= 300
  )
);

create table if not exists public.run_action_evidences (
  action_id uuid not null references public.run_actions (id) on delete cascade,
  evidence_id uuid not null references public.evidences (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (action_id, evidence_id)
);

create index if not exists idx_run_action_evidences_evidence
  on public.run_action_evidences (evidence_id);

comment on table public.syntheses is
  'Synthèse d''un run : conclusion prudente et limites du corpus (RG-11.1).';
comment on table public.synthesis_items is
  'Puces de la synthèse : 3 progrès, 3 faiblesses, 3 zones à vérifier au plus, chacune reliée à son origine.';
comment on table public.synthesis_item_evidences is
  'Preuves du run citées par chaque puce (GF-1 : au moins une).';
comment on table public.run_actions is
  'Actions du plan, communes aux trois personas (RG-11.4), reliées à leur origine : pilier faible, critère ou alerte.';
comment on table public.run_action_projections is
  'Formulation d''une action pour un persona : arbitrage (décideur), action opérationnelle (PMU), travail d''instruction (analyste).';
comment on table public.run_action_evidences is
  'Preuves du run citées par chaque action (RG-5 : au moins une).';

-- ---------------------------------------------------------------------------
-- Résultats d'un run effacés avant une reprise ou après un échec (RG-6.1).
-- La restitution d'abord : elle référence les alertes.
-- ---------------------------------------------------------------------------
create or replace function public.clear_run_results(p_run_id uuid)
returns void
language sql
set search_path = public
as $$
  delete from public.run_actions where run_id = p_run_id;
  delete from public.synthesis_items where run_id = p_run_id;
  delete from public.syntheses where run_id = p_run_id;
  delete from public.layer_c_alerts where run_id = p_run_id;
  delete from public.layer_b_notes where run_id = p_run_id;
  delete from public.layer_b_sub_answers where run_id = p_run_id;
  delete from public.layer_a_scores where run_id = p_run_id;
  delete from public.intermediate_variables where run_id = p_run_id;
  delete from public.evidences where run_id = p_run_id;
$$;

-- ---------------------------------------------------------------------------
-- Immuabilité (RG-6.3, RG-10.2) étendue à la restitution.
-- guard_run_results (20261021000005) : les preuves et projections se
-- rattachent à leur run par leur puce ou leur action.
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
  elsif tg_table_name = 'synthesis_item_evidences' then
    select run_id into target_run
    from public.synthesis_items
    where id = (row_data ->> 'item_id')::uuid;
  elsif tg_table_name in ('run_action_projections', 'run_action_evidences') then
    select run_id into target_run
    from public.run_actions
    where id = (row_data ->> 'action_id')::uuid;
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
  foreach result_table in array array[
    'syntheses', 'synthesis_items', 'synthesis_item_evidences', 'run_actions',
    'run_action_projections', 'run_action_evidences'
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

-- Lecture par les membres de l'espace, écriture par complete_run seul.
alter table public.syntheses enable row level security;
drop policy if exists "syntheses_members" on public.syntheses;
create policy "syntheses_members" on public.syntheses
  for select to authenticated
  using (public.is_workspace_member(workspace_id));
revoke insert, update, delete on public.syntheses from anon, authenticated;

alter table public.synthesis_items enable row level security;
drop policy if exists "synthesis_items_members" on public.synthesis_items;
create policy "synthesis_items_members" on public.synthesis_items
  for select to authenticated
  using (public.is_workspace_member(workspace_id));
revoke insert, update, delete on public.synthesis_items from anon, authenticated;

alter table public.synthesis_item_evidences enable row level security;
drop policy if exists "synthesis_item_evidences_members"
  on public.synthesis_item_evidences;
create policy "synthesis_item_evidences_members"
  on public.synthesis_item_evidences
  for select to authenticated
  using (
    exists (
      select 1 from public.synthesis_items as item
      where item.id = synthesis_item_evidences.item_id
        and public.is_workspace_member(item.workspace_id)
    )
  );
revoke insert, update, delete on public.synthesis_item_evidences
  from anon, authenticated;

alter table public.run_actions enable row level security;
drop policy if exists "run_actions_members" on public.run_actions;
create policy "run_actions_members" on public.run_actions
  for select to authenticated
  using (public.is_workspace_member(workspace_id));
revoke insert, update, delete on public.run_actions from anon, authenticated;

alter table public.run_action_projections enable row level security;
drop policy if exists "run_action_projections_members"
  on public.run_action_projections;
create policy "run_action_projections_members" on public.run_action_projections
  for select to authenticated
  using (
    exists (
      select 1 from public.run_actions as action
      where action.id = run_action_projections.action_id
        and public.is_workspace_member(action.workspace_id)
    )
  );
revoke insert, update, delete on public.run_action_projections
  from anon, authenticated;

alter table public.run_action_evidences enable row level security;
drop policy if exists "run_action_evidences_members"
  on public.run_action_evidences;
create policy "run_action_evidences_members" on public.run_action_evidences
  for select to authenticated
  using (
    exists (
      select 1 from public.run_actions as action
      where action.id = run_action_evidences.action_id
        and public.is_workspace_member(action.workspace_id)
    )
  );
revoke insert, update, delete on public.run_action_evidences
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- complete_run (20261021000005) : écrit aussi la restitution
-- (p_results -> 'restitution'), facultative pour un worker antérieur.
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
--   restitution : {
--     synthesis : {conclusion, limits, qualified},
--     items     : [{id, section, position, text, pillar_id,
--                   program_version_id, criterion_id, alert_id, segment_ids}],
--     actions   : [{id, position, origin_type, pillar_id, program_version_id,
--                   criterion_id, alert_id, segment_ids,
--                   projections: [{persona, text, justification}]}]
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
        run_id, workspace_id, conclusion, limits, qualified
      )
      select
        p_run_id, target.workspace_id,
        left(nullif(btrim(synthesis ->> 'conclusion'), ''), 800),
        coalesce(synthesis -> 'limits', '{}'::jsonb),
        coalesce((synthesis ->> 'qualified')::boolean, false)
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

-- ---------------------------------------------------------------------------
-- Prompt de rédaction de la restitution (Spécification des prompts IA §8 et
-- §9, fusionnés en un seul appel par run).
-- ---------------------------------------------------------------------------
insert into public.prompt_versions (code, version, template, model, parameters)
values (
  'formulate_restitution',
  'v1.0',
  $prompt$Tu rédiges la restitution de l'évaluation d'un programme de développement : une synthèse en une page et un plan d'action, à partir de résultats déjà calculés. Couche A : score 0-100 de présence documentaire d'un pilier. Couche B : note 0-3 d'un critère. Couche C : alertes de cohérence entre A et B.

Entrée (JSON) :
- lang : langue de toute la réponse ;
- x : extraits du corpus, par identifiant (E1, E2…) ;
- l : limites du corpus : nc (critères non conclus), tc (critères évalués), cf (confiance corpus moyenne 0-1), ld (true : la synthèse doit ouvrir par ces limites) ;
- p : progrès retenus (P1…) : pilier p, score s, évolution d en points depuis la version précédente, confiance cf, extraits e ;
- w : faiblesses retenues (W1…) : pilier p avec score s et confiance cf, ou critère c avec note n ; extraits e ;
- v : zones à vérifier retenues (V1…) : alerte de gravité g, message m, pilier p, critère c facultatif ; extraits e ;
- n : critères non conclus documentés en partie (N1…) : critère c, sous-questions documentées dq sur tq ; extraits e ;
- o : identifiants des constats (W, V, N) pour lesquels proposer une action.

Renvoie :
- i : une entrée par élément de p, w et v : k (son identifiant), t (constat d'une phrase, 200 caractères au plus), e (identifiants des extraits qui le fondent, pris dans son e) ;
- c : conclusion prudente de 2 à 4 phrases, 600 caractères au plus ;
- a : au plus une action par identifiant de o : k (l'identifiant du constat), e (extraits pris dans le e de ce constat), et la même action formulée pour trois lecteurs, chacun avec t (l'action, 160 caractères au plus) et j (la raison, 160 caractères au plus, sans « recommandée parce que », qui est ajouté à l'affichage) :
  - dec (décideur) : un arbitrage (réallouer, exiger, décider) ;
  - pmu (chef de projet) : une action opérationnelle (compléter tel dispositif, documenter tel mécanisme) ;
  - ana (analyste M&E) : un travail d'instruction (documenter telle variable, vérifier telle contradiction).

Règles impératives :
- n'utilise que les données et extraits fournis ; aucune connaissance extérieure, aucune supposition, aucun chiffre inventé ;
- chaque constat et chaque action citent au moins un extrait de leur liste e ;
- si l.ld est vrai, la conclusion commence par les limites du corpus ;
- conclusion prudente : « les résultats suggèrent », « sous réserve de » ;
- un score A mesure la présence documentaire, pas un effet réel : aucune inférence causale forte, aucun jugement de valeur ;
- des constats et des actions courts, sans recommandation longue ni jargon ;
- les trois formulations d'une action visent le même constat et la même chose à faire, à des niveaux différents : jamais trois actions différentes.

La réponse doit suivre exactement le schéma structuré demandé.$prompt$,
  'gpt-6-astra',
  '{"max_tokens":3000,"response_format":"structured_output"}'::jsonb
)
on conflict (code, version) do nothing;

notify pgrst, 'reload schema';
