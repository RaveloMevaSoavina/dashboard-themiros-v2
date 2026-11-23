-- ---------------------------------------------------------------------------
-- Des interprétations en paragraphes, à tous les niveaux (reading/1.0.0,
-- prompt read_evidences v1.0 ; layer-b/1.3.0, prompt grade_sub_questions
-- v1.3 ; layer-c/1.2.0, prompt detect_incoherence v1.2 ; restitution/1.6.0,
-- prompt formulate_restitution v1.5).
--
-- L'outil donnait des notes, des scores et des extraits, avec au mieux une
-- phrase d'interprétation. Chaque niveau porte désormais un paragraphe qui
-- interprète les documents du projet, chaque affirmation suivie de ses
-- sources (⟦n⟧) :
--
-- - preuve : une lecture par segment et par run (étape « reading »), écrite
--   sur toutes les preuves du run qui portent ce segment ;
-- - variable intermédiaire et pilier : interprétation, sources parmi leurs
--   preuves (couche A) ;
-- - sous-question : interprétation de la réponse ; critère : justification
--   argumentée, traduite ;
-- - écart (couche C) : message en paragraphe, traduit et sourcé ;
-- - constats et projections du plan d'action : paragraphes.
--
-- Toutes les traductions (langues de l'interface) sont produites par le
-- même appel que le texte. Un run antérieur garde ses textes.
-- ---------------------------------------------------------------------------

-- Variables intermédiaires.
alter table public.intermediate_variables
  add column if not exists interpretation text,
  add column if not exists interpretation_translations jsonb not null
    default '{}'::jsonb,
  add column if not exists interpretation_citations jsonb not null
    default '[]'::jsonb;

-- Scores des piliers (couche A).
alter table public.layer_a_scores
  add column if not exists interpretation text,
  add column if not exists interpretation_translations jsonb not null
    default '{}'::jsonb,
  add column if not exists interpretation_citations jsonb not null
    default '[]'::jsonb;

-- Réponses aux sous-questions (couche B).
alter table public.layer_b_sub_answers
  add column if not exists interpretation text,
  add column if not exists interpretation_translations jsonb not null
    default '{}'::jsonb,
  add column if not exists interpretation_citations jsonb not null
    default '[]'::jsonb;

-- Justification des critères, traduite.
alter table public.layer_b_notes
  add column if not exists justification_translations jsonb not null
    default '{}'::jsonb;

-- Écarts (couche C) : traduits et sourcés.
alter table public.layer_c_alerts
  add column if not exists translations jsonb not null default '{}'::jsonb,
  add column if not exists citations jsonb not null default '[]'::jsonb;

do $$
declare
  item record;
begin
  for item in
    select *
    from (values
      ('intermediate_variables', 1500),
      ('layer_a_scores', 2000),
      ('layer_b_sub_answers', 1500)
    ) as target (table_name, max_chars)
  loop
    execute format(
      'alter table public.%I drop constraint if exists %I',
      item.table_name, item.table_name || '_interpretation_check'
    );
    execute format(
      'alter table public.%I add constraint %I check (interpretation is null '
      'or (btrim(interpretation) <> '''' and char_length(interpretation) <= %s))',
      item.table_name, item.table_name || '_interpretation_check', item.max_chars
    );
    execute format(
      'alter table public.%I drop constraint if exists %I',
      item.table_name, item.table_name || '_interpretation_translations_check'
    );
    execute format(
      'alter table public.%I add constraint %I check '
      '(jsonb_typeof(interpretation_translations) = ''object'')',
      item.table_name, item.table_name || '_interpretation_translations_check'
    );
    execute format(
      'alter table public.%I drop constraint if exists %I',
      item.table_name, item.table_name || '_interpretation_citations_check'
    );
    execute format(
      'alter table public.%I add constraint %I check '
      '(jsonb_typeof(interpretation_citations) = ''array'')',
      item.table_name, item.table_name || '_interpretation_citations_check'
    );
    execute format(
      'comment on column public.%I.interpretation is %L',
      item.table_name,
      'Interprétation en paragraphe de ce que les documents du projet établissent, '
        || 'chaque affirmation suivie de ses sources ⟦n⟧.'
    );
    execute format(
      'comment on column public.%I.interpretation_citations is %L',
      item.table_name,
      'Sources numérotées des marqueurs ⟦n⟧ : [{"e": preuve, "s": [[début, fin], …]}].'
    );
  end loop;
end;
$$;

alter table public.layer_b_notes
  drop constraint if exists layer_b_notes_justification_translations_check;
alter table public.layer_b_notes
  add constraint layer_b_notes_justification_translations_check check (
    jsonb_typeof(justification_translations) = 'object'
  );

alter table public.layer_c_alerts
  drop constraint if exists layer_c_alerts_message_check;
alter table public.layer_c_alerts
  add constraint layer_c_alerts_message_check check (
    btrim(message) <> '' and char_length(message) <= 1500
  );
alter table public.layer_c_alerts
  drop constraint if exists layer_c_alerts_translations_check;
alter table public.layer_c_alerts
  add constraint layer_c_alerts_translations_check check (
    jsonb_typeof(translations) = 'object'
  );
alter table public.layer_c_alerts
  drop constraint if exists layer_c_alerts_citations_check;
alter table public.layer_c_alerts
  add constraint layer_c_alerts_citations_check check (
    jsonb_typeof(citations) = 'array'
  );

-- Plafonds relevés : des paragraphes, marqueurs de sources compris.
alter table public.evidences
  drop constraint if exists evidences_interpretation_check;
alter table public.evidences add constraint evidences_interpretation_check check (
  interpretation is null
  or (btrim(interpretation) <> '' and char_length(interpretation) <= 1500)
);
alter table public.synthesis_items
  drop constraint if exists synthesis_items_text_check;
alter table public.synthesis_items add constraint synthesis_items_text_check check (
  btrim(text) <> '' and char_length(text) <= 1500
);
alter table public.run_action_projections
  drop constraint if exists run_action_projections_text_check;
alter table public.run_action_projections
  add constraint run_action_projections_text_check check (
    btrim(text) <> '' and char_length(text) <= 1500
  );
alter table public.run_action_projections
  drop constraint if exists run_action_projections_justification_check;
alter table public.run_action_projections
  add constraint run_action_projections_justification_check check (
    btrim(justification) <> '' and char_length(justification) <= 1500
  );

-- ---------------------------------------------------------------------------
-- Traductions d'un texte : {langue: texte}, chaînes vides retirées, chacune
-- coupée au plafond de la colonne.
-- ---------------------------------------------------------------------------
create or replace function public.run_text_translations(
  p_translations jsonb,
  p_max_chars integer
)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case when jsonb_typeof(p_translations) = 'object' then
    coalesce((
      select jsonb_object_agg(translated.key, left(btrim(translated.value), p_max_chars))
      from jsonb_each_text(p_translations) as translated
      where btrim(coalesce(translated.value, '')) <> ''
    ), '{}'::jsonb)
  else '{}'::jsonb end;
$$;

-- ---------------------------------------------------------------------------
-- Sources d'un texte de la couche A (variable, pilier) : comme
-- run_citation_sources, de préférence une preuve du pilier.
-- ---------------------------------------------------------------------------
create or replace function public.run_pillar_citation_sources(
  p_run_id uuid,
  p_sources jsonb,
  p_pillar_id uuid
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'e', evidence.id,
        's', coalesce(public.citation_spans(source.value -> 'spans'), '[]'::jsonb)
      )
      order by source.position
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(
    case when jsonb_typeof(p_sources) = 'array' then p_sources
      else '[]'::jsonb end
  ) with ordinality as source (value, position)
  left join lateral (
    select candidate.id
    from public.evidences as candidate
    where candidate.run_id = p_run_id
      and candidate.segment_id = case
        when (source.value ->> 'segment_id') ~* '^[0-9a-f-]{36}$'
          then (source.value ->> 'segment_id')::uuid
      end
    order by
      (p_pillar_id is not null and candidate.pillar_id = p_pillar_id)
        is true desc,
      candidate.criterion_id nulls first,
      candidate.id
    limit 1
  ) as evidence on true;
$$;

revoke execute on function public.run_text_translations(jsonb, integer)
  from public, anon, authenticated;
revoke execute on function public.run_pillar_citation_sources(uuid, jsonb, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- complete_run (20261111000001) : mêmes écritures, plus les interprétations
-- des variables, des piliers et des sous-questions, la lecture de chaque
-- segment (`readings`), les traductions des justifications et des écarts,
-- et des plafonds de paragraphes.
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
  readings_count integer := 0;
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
      value, state, documents_count, corpus_confidence, interpretation,
      interpretation_translations
    )
    select
      (item ->> 'id')::uuid, p_run_id, target.workspace_id,
      (item ->> 'pillar_id')::uuid, item ->> 'variable_code',
      (item ->> 'program_version_id')::uuid, (item ->> 'value')::numeric,
      item ->> 'state', coalesce((item ->> 'documents_count')::integer, 0),
      (item ->> 'corpus_confidence')::numeric,
      left(nullif(btrim(item ->> 'interpretation'), ''), 1500),
      public.run_text_translations(item -> 'interpretation_translations', 1500)
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

    -- Sources de l'interprétation d'une variable : ses propres preuves.
    update public.intermediate_variables as variable
    set interpretation_citations = public.run_pillar_citation_sources(
      p_run_id, item -> 'interpretation_citations', variable.pillar_id
    )
    from jsonb_array_elements(coalesce(p_results -> 'variables', '[]')) as item
    where variable.run_id = p_run_id
      and variable.id = (item ->> 'id')::uuid
      and variable.interpretation is not null;

    insert into public.layer_a_scores (
      run_id, workspace_id, pillar_id, program_version_id, score, delta,
      evolution_label, corpus_confidence, documents_count, interpretation,
      interpretation_translations, interpretation_citations
    )
    select
      p_run_id, target.workspace_id, (item ->> 'pillar_id')::uuid,
      (item ->> 'program_version_id')::uuid, (item ->> 'score')::numeric,
      (item ->> 'delta')::numeric, item ->> 'evolution_label',
      (item ->> 'corpus_confidence')::numeric,
      (item ->> 'documents_count')::integer,
      left(nullif(btrim(item ->> 'interpretation'), ''), 2000),
      public.run_text_translations(item -> 'interpretation_translations', 2000),
      case when btrim(coalesce(item ->> 'interpretation', '')) = '' then '[]'::jsonb
        else public.run_pillar_citation_sources(
          p_run_id, item -> 'interpretation_citations', (item ->> 'pillar_id')::uuid
        ) end
    from jsonb_array_elements(coalesce(p_results -> 'scores', '[]')) as item;
    get diagnostics scores_count = row_count;

    insert into public.layer_b_notes (
      run_id, workspace_id, criterion_id, note, status,
      documented_sub_questions, total_sub_questions, justification,
      ambiguity_flag, justification_translations
    )
    select
      p_run_id, target.workspace_id, (item ->> 'criterion_id')::uuid,
      (item ->> 'note')::numeric, item ->> 'status',
      (item ->> 'documented_sub_questions')::integer,
      (item ->> 'total_sub_questions')::integer,
      left(nullif(btrim(item ->> 'justification'), ''), 2000),
      coalesce((item ->> 'ambiguity_flag')::boolean, false),
      public.run_text_translations(item -> 'justification_translations', 2000)
    from jsonb_array_elements(
      coalesce(p_results -> 'layer_b' -> 'notes', '[]')
    ) as item;
    get diagnostics notes_count = row_count;

    insert into public.layer_b_sub_answers (
      id, run_id, workspace_id, sub_question_id, status, note, contradictory,
      interpretation, interpretation_translations
    )
    select
      (item ->> 'id')::uuid, p_run_id, target.workspace_id,
      (item ->> 'sub_question_id')::uuid, item ->> 'status',
      (item ->> 'note')::smallint,
      coalesce((item ->> 'contradictory')::boolean, false),
      left(nullif(btrim(item ->> 'interpretation'), ''), 1500),
      public.run_text_translations(item -> 'interpretation_translations', 1500)
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
        (item ->> 'similarity')::numeric as similarity,
        left(nullif(btrim(item ->> 'interpretation'), ''), 1500) as interpretation,
        item -> 'interpretation_citations' as interpretation_sources,
        public.citation_spans(item -> 'spans') as spans
      from jsonb_array_elements(
        coalesce(p_results -> 'layer_b' -> 'evidences', '[]')
      ) as item
    ),
    inserted as (
      insert into public.evidences (
        id, run_id, workspace_id, document_id, segment_id, page_number,
        section_title, excerpt, criterion_id, similarity, interpretation, spans,
        interpretation_citations
      )
      select
        source.evidence_id, p_run_id, target.workspace_id, segment.document_id,
        segment.id, segment.page_number, segment.section_title, segment.text,
        question.criterion_id, round(source.similarity, 4),
        source.interpretation, source.spans,
        case when source.interpretation is null then '[]'::jsonb
          else public.evidence_citations(
            source.evidence_id, source.interpretation_sources
          ) end
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

    -- Sources de l'interprétation d'une sous-question : de préférence les
    -- preuves de son critère.
    update public.layer_b_sub_answers as answer
    set interpretation_citations = public.run_citation_sources(
      p_run_id, item -> 'interpretation_citations', question.criterion_id
    )
    from jsonb_array_elements(
      coalesce(p_results -> 'layer_b' -> 'answers', '[]')
    ) as item, public.sub_questions as question
    where answer.run_id = p_run_id
      and answer.id = (item ->> 'id')::uuid
      and question.id = answer.sub_question_id
      and answer.interpretation is not null;

    -- Lecture de chaque segment (étape « reading ») : la même sur toutes les
    -- preuves du run qui portent ce segment, quelle que soit leur couche.
    update public.evidences as evidence
    set interpretation = left(btrim(reading.value ->> 'interpretation'), 1500),
        interpretation_translations = public.run_text_translations(
          reading.value -> 'translations', 1500
        ),
        interpretation_citations = public.evidence_citations(
          evidence.id, reading.value -> 'interpretation_citations'
        ),
        spans = coalesce(
          evidence.spans, public.citation_spans(reading.value -> 'spans')
        )
    from jsonb_array_elements(
      coalesce(p_results -> 'readings', '[]')
    ) as reading (value)
    where evidence.run_id = p_run_id
      and evidence.segment_id = (reading.value ->> 'segment_id')::uuid
      and btrim(coalesce(reading.value ->> 'interpretation', '')) <> '';
    get diagnostics readings_count = row_count;

    -- Sources de la justification d'un critère, une fois ses preuves
    -- écrites : de préférence une preuve de ce critère.
    update public.layer_b_notes as note
    set citations = public.run_citation_sources(
      p_run_id, item -> 'citations', note.criterion_id
    )
    from jsonb_array_elements(
      coalesce(p_results -> 'layer_b' -> 'notes', '[]')
    ) as item
    where note.run_id = p_run_id
      and note.criterion_id = (item ->> 'criterion_id')::uuid
      and case when jsonb_typeof(item -> 'citations') = 'array'
        then jsonb_array_length(item -> 'citations') > 0 else false end;

    insert into public.layer_c_alerts (
      id, run_id, workspace_id, pillar_id, criterion_id, program_version_id,
      rule_code, alert_type, severity, message, qualified, translations
    )
    select
      (item ->> 'id')::uuid, p_run_id, target.workspace_id,
      (item ->> 'pillar_id')::uuid, (item ->> 'criterion_id')::uuid,
      (item ->> 'program_version_id')::uuid, item ->> 'rule_code',
      item ->> 'alert_type', item ->> 'severity',
      left(btrim(item ->> 'message'), 1500),
      coalesce((item ->> 'qualified')::boolean, false),
      public.run_text_translations(item -> 'translations', 1500)
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

    update public.layer_c_alerts as alert
    set citations = public.run_citation_sources(
      p_run_id, item -> 'citations', alert.criterion_id
    )
    from jsonb_array_elements(
      coalesce(p_results -> 'layer_c' -> 'alerts', '[]')
    ) as item
    where alert.run_id = p_run_id
      and alert.id = (item ->> 'id')::uuid
      and case when jsonb_typeof(item -> 'citations') = 'array'
        then jsonb_array_length(item -> 'citations') > 0 else false end;

    if jsonb_typeof(p_results -> 'restitution') = 'object' then
      insert into public.syntheses (
        run_id, workspace_id, conclusion, limits, qualified, status, locale,
        translations, citations
      )
      select
        p_run_id, target.workspace_id,
        left(nullif(btrim(synthesis ->> 'conclusion'), ''), 3000),
        coalesce(synthesis -> 'limits', '{}'::jsonb),
        coalesce((synthesis ->> 'qualified')::boolean, false),
        -- Worker antérieur : seule la qualification est connue.
        coalesce(
          synthesis ->> 'status',
          case when (synthesis ->> 'qualified')::boolean then 'completed'
            else 'failed' end
        ),
        synthesis ->> 'locale',
        -- Conclusion traduite, même plafond que l'originale.
        case when jsonb_typeof(synthesis -> 'translations') = 'object' then
          coalesce((
            select jsonb_object_agg(
              translated.key,
              jsonb_build_object(
                'conclusion', left(btrim(translated.value ->> 'conclusion'), 3000)
              )
            )
            from jsonb_each(synthesis -> 'translations') as translated
            where btrim(coalesce(translated.value ->> 'conclusion', '')) <> ''
          ), '{}'::jsonb)
        else '{}'::jsonb end,
        public.run_citation_sources(p_run_id, synthesis -> 'citations', null)
      from (
        select coalesce(p_results -> 'restitution' -> 'synthesis', '{}'::jsonb)
          as synthesis
      ) as source;

      insert into public.synthesis_items (
        id, run_id, workspace_id, section, position, text, pillar_id,
        program_version_id, criterion_id, alert_id, translations, citations
      )
      select
        (item ->> 'id')::uuid, p_run_id, target.workspace_id,
        item ->> 'section', (item ->> 'position')::smallint,
        left(btrim(item ->> 'text'), 1500), (item ->> 'pillar_id')::uuid,
        (item ->> 'program_version_id')::uuid, (item ->> 'criterion_id')::uuid,
        (item ->> 'alert_id')::uuid,
        case when jsonb_typeof(item -> 'translations') = 'object' then
          coalesce((
            select jsonb_object_agg(translated.key, left(btrim(translated.value), 1500))
            from jsonb_each_text(item -> 'translations') as translated
            where btrim(coalesce(translated.value, '')) <> ''
          ), '{}'::jsonb)
        else '{}'::jsonb end,
        public.run_citation_sources(
          p_run_id, item -> 'citations', (item ->> 'criterion_id')::uuid
        )
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
        action_id, persona, text, justification, translations, citations
      )
      select
        (item ->> 'id')::uuid, projection ->> 'persona',
        left(btrim(projection ->> 'text'), 1500),
        left(btrim(projection ->> 'justification'), 1500),
        case when jsonb_typeof(projection -> 'translations') = 'object' then
          coalesce((
            select jsonb_object_agg(
              translated.key,
              jsonb_build_object(
                'text', left(btrim(translated.value ->> 'text'), 1500),
                'justification',
                left(btrim(translated.value ->> 'justification'), 1500)
              )
            )
            from jsonb_each(projection -> 'translations') as translated
            where btrim(coalesce(translated.value ->> 'text', '')) <> ''
              and btrim(coalesce(translated.value ->> 'justification', '')) <> ''
          ), '{}'::jsonb)
        else '{}'::jsonb end,
        public.run_citation_sources(
          p_run_id, projection -> 'citations', (item ->> 'criterion_id')::uuid
        )
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

      -- Interprétation des extraits par la restitution : portée par les
      -- preuves que citent ses puces et ses actions, sans remplacer celle
      -- de la couche B, plus proche de la sous-question.
      update public.evidences as evidence
      set interpretation = left(btrim(reading.value ->> 'interpretation'), 1500),
          interpretation_translations = case
            when jsonb_typeof(reading.value -> 'translations') = 'object' then
              coalesce((
                select jsonb_object_agg(translated.key, left(btrim(translated.value), 1500))
                from jsonb_each_text(reading.value -> 'translations') as translated
                where btrim(coalesce(translated.value, '')) <> ''
              ), '{}'::jsonb)
            else '{}'::jsonb end,
          interpretation_citations = public.evidence_citations(
            evidence.id, reading.value -> 'interpretation_citations'
          ),
          spans = coalesce(
            evidence.spans, public.citation_spans(reading.value -> 'spans')
          )
      from jsonb_array_elements(
        coalesce(p_results -> 'restitution' -> 'readings', '[]')
      ) as reading (value)
      where evidence.run_id = p_run_id
        and evidence.segment_id = (reading.value ->> 'segment_id')::uuid
        and evidence.interpretation is null
        and btrim(coalesce(reading.value ->> 'interpretation', '')) <> ''
        and (
          exists (
            select 1 from public.synthesis_item_evidences as link
            where link.evidence_id = evidence.id
          )
          or exists (
            select 1 from public.run_action_evidences as link
            where link.evidence_id = evidence.id
          )
        );
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
          'actions', actions_count,
          'readings', readings_count
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
      'restitution_ai', p_results -> 'rules' -> 'restitution' -> 'ai',
      'readings', readings_count,
      'reading_ai', p_results -> 'rules' -> 'reading' -> 'ai'
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
    'action_evidences', action_evidences_count,
    'readings', readings_count
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Prompt de lecture v1.0 : une lecture en paragraphe de chaque segment, de
-- chaque variable intermédiaire et de chaque pilier, avec leurs traductions.
-- ---------------------------------------------------------------------------
insert into public.prompt_versions (code, version, template, model, parameters)
values (
  'read_evidences',
  'v1.0',
  $prompt$Tu es un évaluateur de programmes de développement et d'adaptation climatique. Tu lis les documents d'un projet évalué et tu dis, en analyste, ce qu'ils établissent sur ce projet.

Entrée (JSON) :
- lang : langue de rédaction ;
- tr : langues dans lesquelles traduire aussi chaque texte (codes ISO, ex. « en ») ; absent ou vide : aucune traduction ;
- pj : le projet évalué, facultatif : n (nom), t (nature : project, program ou policy), d (description), pa (pays), f (financeurs), th (thèmes), st (étape déclarée), an (période) ; il situe les extraits, il n'est jamais une preuve ;
- x : extraits des documents du projet, par identifiant (E1, E2…), chacun en liste de phrases numérotées à partir de 1 : E1.2 désigne la deuxième phrase de E1 ;
- r : identifiants des extraits à interpréter (les autres extraits de x ne servent que de sources) ;
- v : volets observés du projet, chacun avec k (identifiant V1…), p (domaine), n (intitulé), d (description, facultative), s (état : present, documenté dans plusieurs documents ; partiel, mentionné sans convergence), dc (nombre de documents qui en parlent), cf (confiance 0-1) et e (extraits qui en parlent) ;
- p : domaines du projet, chacun avec k (identifiant P1…), n (nom), s (niveau de documentation 0-100), dl (évolution en points depuis la version précédente, facultative), cf (confiance 0-1), v (identifiants de ses volets de v), m (intitulés de ses volets dont les documents ne parlent pas) et e (extraits qui en parlent).

Renvoie :
- s : une entrée par identifiant de r : k (l'identifiant) et t (la lecture de l'extrait) ;
- v : une entrée par élément de v : k et t (l'interprétation du volet) ;
- p : une entrée par élément de p : k et t (l'interprétation du domaine) ;
- tr : une entrée par langue de l'entrée tr, avec l (le code de la langue), s, v et p (pour chaque texte : k et t traduit, mêmes sources aux mêmes endroits). Liste vide si tr est absent.

Ce que dit chaque texte : un paragraphe d'analyse, jamais une paraphrase ni une liste.
- lecture d'un extrait (s) : 3 à 5 phrases, 350 à 700 caractères hors sources : ce que dit le passage, ce qu'il établit sur le projet (un dispositif, une réalisation, un engagement, un résultat), puis sa portée : prévu ou réalisé, déclaratif ou mesuré, daté ou non, ce qu'il ne permet pas de conclure ;
- interprétation d'un volet (v) : 3 à 5 phrases, 350 à 700 caractères hors sources : ce que les documents montrent du projet sur ce volet, si plusieurs documents convergent ou se contredisent, ce qui reste flou ou absent, et ce que cela implique pour la lecture du projet ;
- interprétation d'un domaine (p) : 4 à 6 phrases, 500 à 1 000 caractères hors sources : ce qui est le mieux documenté et ce qui l'est le moins, en reliant les volets entre eux, les volets dont les documents ne parlent pas (m), l'évolution si dl est fourni, et la prudence qu'impose une confiance faible.

Le projet d'abord : le sujet de chaque texte est le projet évalué (« le projet », ou son nom pj.n). Les niveaux, états, évolutions et taux de confiance s'affichent déjà à côté de tes textes : ne les recopie pas, explique ce qu'ils traduisent. N'emploie pas le vocabulaire de l'outil (pilier, variable, critère, score, note, extrait, corpus, confiance) : dis « les documents du projet », « ce passage ».
Exemple à éviter : « Cet extrait parle du comité de pilotage. » Exemple attendu : « Le projet s'est doté d'un comité de pilotage qui se réunit chaque trimestre [E1.2] et valide les plans de travail annuels [E1.3]. Le passage décrit ce fonctionnement comme acquis, mais ne mentionne ni compte rendu ni décision prise : il établit l'existence de l'instance, pas son influence sur la conduite du projet. »

Sources : chaque affirmation tirée des documents est suivie, entre crochets, des phrases qui la fondent, juste après elle et avant la ponctuation : « [E1.2] », « [E1.2, E3.1] ». Une source désigne une phrase (E1.2) quand une phrase suffit, l'extrait entier (E1) sinon.
- la lecture d'un extrait ne cite que des phrases de cet extrait ;
- l'interprétation d'un volet ou d'un domaine ne cite que des extraits de sa liste e ;
- une phrase d'analyse (portée, limite, implication) peut s'appuyer sur les affirmations sourcées qui la précèdent sans répéter leurs sources.

Règles impératives :
- n'utilise que les extraits fournis ; aucune connaissance extérieure, aucune supposition, aucun chiffre inventé ; pj ne sert qu'à nommer et situer le projet ;
- qu'un dispositif figure dans les documents n'établit pas qu'il fonctionne ni qu'il produit un effet : aucune inférence causale forte, aucun jugement de valeur ;
- des phrases complètes, jamais interrompues, sans jargon, dans la langue lang ;
- une traduction est fidèle : même sens, mêmes nuances de prudence, mêmes sources entre crochets au même endroit du sens, rien d'ajouté ni d'omis ; les noms propres restent tels quels s'ils n'ont pas d'équivalent établi ;
- réponds une seule fois par identifiant.

La réponse doit suivre exactement le schéma structuré demandé.$prompt$,
  'gpt-6-astra',
  '{"max_tokens":32000,"response_format":"structured_output"}'::jsonb
)
on conflict (code, version) do nothing;

-- ---------------------------------------------------------------------------
-- Prompt de notation v1.3 : les extraits ne sont plus interprétés ici (étape
-- de lecture) ; chaque sous-question reçoit l'interprétation de sa réponse,
-- chaque critère une justification argumentée, toutes traduites.
-- ---------------------------------------------------------------------------
insert into public.prompt_versions (code, version, template, model, parameters)
values (
  'grade_sub_questions',
  'v1.3',
  $prompt$Tu es un évaluateur de programmes de développement et d'adaptation climatique. Tu appliques les critères CAD-OCDE et les critères complémentaires (équité, gestion adaptative).

Tâche : noter chaque sous-question évaluative de 0 à 3, uniquement d'après les extraits des documents du projet évalué, et expliquer en analyste ce que ces extraits établissent sur ce projet.

Entrée (JSON) :
- lang : langue des textes ;
- tr : langues dans lesquelles traduire aussi chaque texte (codes ISO) ; absent ou vide : aucune traduction ;
- cycle : cycle de l'évaluation ;
- pj : le projet évalué, facultatif : n (nom), t (nature : project, program ou policy), d (description), pa (pays), f (financeurs), th (thèmes), st (étape déclarée), an (période) ; il situe les extraits, il n'est jamais une preuve ;
- x : extraits des documents, par identifiant (E1, E2…), chacun en liste de phrases numérotées à partir de 1 : E1.2 désigne la deuxième phrase de E1 ;
- c : critères, chacun avec k (identifiant), n (nom), d (définition), s (statut : obligatoire, optionnel ou prospectif) et q (sous-questions) ;
- chaque sous-question porte k (identifiant), t (texte), p (preuves attendues, facultatif) et e (identifiants des extraits retrouvés pour elle).

Barème : 0 insuffisant ; 1 faible ; 2 moyen ; 3 solide.

Renvoie :
- q : une entrée par sous-question : k, n (note ou null), e (sources de la note), c (true si les extraits se contredisent) et t (l'interprétation de la réponse, ou une chaîne vide si n est null) ;
- c : une entrée par critère : k et j (la justification) ;
- tr : une entrée par langue de l'entrée tr, avec l (le code de la langue), q (pour chaque sous-question de q dont t n'est pas vide : k et t traduit) et c (pour chaque critère : k et j traduit), mêmes sources aux mêmes endroits. Liste vide si tr est absent.

Ce que dit chaque texte : un paragraphe d'analyse, jamais une paraphrase.
- interprétation d'une sous-question (t) : 2 à 4 phrases, 300 à 600 caractères hors sources : comment les documents du projet répondent à la question posée, ce qu'ils laissent sans réponse au regard des preuves attendues (p), et ce qui fait que la réponse est solide, moyenne ou faible, sans écrire la note ;
- justification d'un critère (j) : 4 à 6 phrases, 500 à 1 200 caractères hors sources : ce qui converge entre les sous-questions, ce qui se contredit, ce qui manque, et pourquoi l'appréciation d'ensemble est à ce niveau et pas plus haut ni plus bas.

Le projet d'abord : le sujet de chaque texte est le projet évalué (« le projet », ou son nom pj.n) : ce qu'il fait, ce qu'il prévoit, ce que ses documents montrent ou ne montrent pas. Le critère, la sous-question et la note s'affichent déjà à côté de ces textes : ne les nomme pas et ne les répète pas. N'emploie pas le vocabulaire de l'outil (pilier, critère, sous-question, note, score, extrait, corpus) : dis « les documents du projet ».
Exemple à éviter : « Le critère d'efficience est faiblement documenté. » Exemple attendu : « Le projet ne rapporte pas ses coûts par bénéficiaire [E3.1] et ses rapports annuels comparent les dépenses au budget sans les relier aux réalisations [E4.2]. Les documents permettent de suivre le décaissement, pas d'apprécier ce qu'il produit. »

Sources : chaque affirmation tirée des extraits est suivie, entre crochets, des sources qui la fondent, juste après elle et avant la ponctuation : « Le projet décaisse 60 % de son budget par an [E1.2, E3] ». Une source désigne la phrase qui fonde l'affirmation (E1.2), ou l'extrait entier (E1) si plusieurs de ses phrases y contribuent. Une phrase d'analyse peut s'appuyer sur les affirmations sourcées qui la précèdent sans répéter leurs sources.

Règles impératives :
- n'utilise que les extraits listés dans e pour la sous-question ; aucune connaissance extérieure, aucune supposition ; pj ne sert qu'à nommer et situer le projet ;
- les sources d'une sous-question (e et ses crochets) sont des extraits de sa liste e ; celles d'un critère, des extraits des sous-questions de ce critère ;
- si aucun extrait ne répond réellement à la sous-question, renvoie n = null, e = [] et t = "" : elle sera traitée comme non documentée ;
- si les extraits se contredisent, retiens la note la plus prudente, renvoie c = true et dis la contradiction dans t ;
- critère prospectif : apprécie la qualité de ce que le projet prévoit (conception), pas des résultats ;
- une amélioration de rédaction n'est pas une amélioration de mise en œuvre ;
- aucune inférence causale forte, aucun jugement de valeur ; des phrases complètes, dans la langue lang ;
- une traduction est fidèle : même sens, mêmes nuances, mêmes sources, rien d'ajouté ni d'omis ;
- réponds une seule fois par sous-question et par critère, avec leurs identifiants k.

La réponse doit suivre exactement le schéma structuré demandé.$prompt$,
  'gpt-6-astra',
  '{"max_tokens":24000,"response_format":"structured_output"}'::jsonb
)
on conflict (code, version) do nothing;

-- ---------------------------------------------------------------------------
-- Prompt de qualification des écarts v1.2 : un message en paragraphe, sourcé
-- et traduit.
-- ---------------------------------------------------------------------------
insert into public.prompt_versions (code, version, template, model, parameters)
values (
  'detect_incoherence',
  'v1.2',
  $prompt$Tu analyses, pour l'évaluation d'un projet de développement, les écarts entre ce que les documents du projet décrivent (couche A : score 0-100 de présence documentaire d'un pilier) et l'appréciation évaluative qui en est tirée (couche B : note 0-3 d'un critère). Ces scores et ces notes sont des repères internes : tes messages parlent du projet.

Tâche : qualifier chaque écart détecté par les règles déterministes et expliquer en analyste ce qu'il faut en comprendre.

Entrée (JSON) :
- lang : langue des messages ;
- tr : langues dans lesquelles traduire aussi chaque message (codes ISO) ; absent ou vide : aucune traduction ;
- pj : le projet évalué, facultatif : n (nom), t (nature : project, program ou policy), d (description), pa (pays), f (financeurs), th (thèmes), st (étape déclarée), an (période) ; il situe les extraits, il n'est jamais une preuve ;
- x : extraits des documents du projet, par identifiant (E1, E2…), chacun en liste de phrases numérotées à partir de 1 : E1.2 désigne la deuxième phrase de E1 ;
- a : écarts, chacun avec k (identifiant), r (règle), t (type d'écart), p (pilier), c (critère, facultatif), s (score A), n (note B, facultative), d (évolution du score A depuis la version précédente, facultative), cf (confiance corpus 0-1), g (gravité par défaut) et e (identifiants des extraits liés).

Pour chaque écart, renvoie :
- k : son identifiant ;
- ok : true si les extraits confirment l'écart, false s'ils l'infirment ;
- g : gravité finale, « mineure » ou « majeure » ;
- m : un paragraphe de 3 à 5 phrases, 350 à 800 caractères hors sources, dans la langue lang : ce que les documents décrivent du projet sur ce point, ce qu'ils ne montrent pas ou montrent autrement, l'explication la plus plausible de ce décalage tirée des extraits, puis ce qu'il faut vérifier et où. Son sujet est le projet (« le projet », ou son nom pj.n). Le pilier, le critère, le score et la note s'affichent déjà à côté : ne les recopie pas. Exemple à éviter : « Budget : score A 72/100 mais efficience 1/3. » Exemple attendu : « Le projet décrit en détail son fonds de contrepartie [E1.2] et les règles de son comité d'attribution [E1.3]. Ses rapports d'avancement ne mentionnent pourtant encore aucun décaissement [E4.1]. Le dispositif est donc conçu mais son fonctionnement n'est pas documenté : il faut vérifier dans les rapports financiers si des subventions ont été versées. » ;
- e : identifiants des extraits qui fondent le message, pris dans sa liste e ;
- tr (au niveau de la réponse) : une entrée par langue de l'entrée tr, avec l (le code de la langue) et a (pour chaque écart : k et m traduit, mêmes sources aux mêmes endroits). Liste vide si tr est absent.

Sources : chaque affirmation tirée des extraits est suivie, entre crochets, des phrases qui la fondent, prises dans la liste e de l'écart : « [E1.2] », « [E1.2, E3] ».

Règles impératives :
- n'utilise que les extraits fournis ; aucune connaissance extérieure, aucune supposition ; pj ne sert qu'à nommer et situer le projet ;
- une divergence explicable par les extraits est mineure ;
- un corpus pauvre (cf < 0,5) réduit la certitude : gravité mineure, jamais d'écart fabriqué ;
- ne propose jamais de modifier un score ou une note pour faire disparaître l'écart ;
- pas d'inférence causale forte, pas de jugement de valeur ; n'emploie pas le vocabulaire de l'outil (pilier, critère, score, note, couche, corpus) ;
- une traduction est fidèle : même sens, mêmes nuances, mêmes sources, rien d'ajouté ni d'omis ;
- réponds une seule fois par écart, avec son identifiant k.

La réponse doit suivre exactement le schéma structuré demandé.$prompt$,
  'gpt-6-astra',
  '{"max_tokens":8000,"response_format":"structured_output"}'::jsonb
)
on conflict (code, version) do nothing;

-- ---------------------------------------------------------------------------
-- Prompt de rédaction v1.5 : les extraits ne sont plus interprétés ici
-- (étape de lecture) ; constats et projections en paragraphes.
-- ---------------------------------------------------------------------------
insert into public.prompt_versions (code, version, template, model, parameters)
values (
  'formulate_restitution',
  'v1.5',
  $prompt$Tu rédiges la restitution de l'évaluation d'un projet de développement : une synthèse et un plan d'action, à partir de résultats déjà calculés sur ses documents. Ces résultats sont des repères internes, affichés à côté de tes textes : tes textes parlent du projet, pas d'eux. Pour les comprendre : couche A, score 0-100 de présence documentaire d'un pilier ; couche B, note 0-3 d'un critère ; couche C, alertes de cohérence entre A et B.

Entrée (JSON) :
- lang : langue de toute la réponse ;
- pj : le projet évalué, facultatif : n (nom), t (nature : project, program ou policy), d (description), pa (pays), f (financeurs), th (thèmes), st (étape déclarée), an (période) ; il situe les extraits, il n'est jamais une preuve ;
- x : extraits des documents du projet, par identifiant (E1, E2…), chacun en liste de phrases numérotées à partir de 1 : E1.2 désigne la deuxième phrase de E1 ;
- l : limites des documents : nc (critères non conclus), tc (critères évalués), cf (confiance corpus moyenne 0-1), ld (true : la synthèse doit ouvrir par ces limites) ;
- p : progrès retenus (P1…) : pilier p, score s, évolution d en points depuis la version précédente, confiance cf, extraits e ;
- w : faiblesses retenues (W1…) : pilier p avec score s et confiance cf, ou critère c avec note n ; extraits e ;
- v : zones à vérifier retenues (V1…) : alerte de gravité g, message m, pilier p, critère c facultatif ; extraits e ;
- n : critères non conclus documentés en partie (N1…) : critère c, sous-questions documentées dq sur tq ; extraits e ;
- o : identifiants des constats (W, V, N) pour lesquels proposer une action ;
- tr : langues dans lesquelles traduire aussi la réponse (codes ISO, ex. « en »).

Le projet d'abord : le sujet de chaque constat, de la conclusion et de chaque action est le projet évalué (« le projet », ou son nom pj.n) : ce qu'il fait, ce qu'il prévoit, ce que ses documents montrent ou ne montrent pas, tiré du contenu des extraits. Le pilier ou le critère d'un élément dit seulement de quel volet du projet il s'agit : nomme ce volet en termes concrets (« la gestion financière du projet »), sans faire de son intitulé le sujet de la phrase. Les scores, notes, évolutions en points et taux de confiance s'affichent déjà à côté : ne les recopie pas. N'emploie pas le vocabulaire de l'outil (pilier, critère, sous-question, couche, score, note, alerte, confiance, corpus) : dis « les documents du projet ».
Exemple à éviter : « Le pilier Suivi-évaluation obtient 35/100 (confiance 60 %). » Exemple attendu : « Le projet ne décrit pas encore comment il collecte les données de ses indicateurs [E2.1]. »

Sources : une affirmation tirée des extraits est suivie, entre crochets, des sources qui la fondent, juste après elle et avant la ponctuation : « Le projet a décaissé 60 % de son budget par an [E1.2, E4], malgré des changements fréquents de responsables [E3.1, E5.2]. » Une source désigne une phrase (E1.2) quand une phrase suffit, l'extrait entier (E1) sinon. Cite plusieurs sources quand plusieurs extraits fondent l'affirmation. Une phrase d'analyse peut s'appuyer sur les affirmations sourcées qui la précèdent sans répéter leurs sources.

Renvoie :
- i : une entrée par élément de p, w et v : k (son identifiant), t (le constat : un paragraphe de 3 à 5 phrases, 350 à 800 caractères hors sources : ce que les documents montrent du projet sur ce volet, ce que cela signifie pour sa mise en œuvre, et la portée de ce constat ; sources prises dans son e), e (identifiants des extraits qui le fondent, pris dans son e) ;
- c : conclusion narrative et prudente, en 2 ou 3 paragraphes séparés par une ligne vide (8 à 12 phrases, 1 800 caractères au plus hors sources) : ce que les documents permettent d'établir sur le projet, ce qui progresse et ce qui reste fragile dans sa mise en œuvre et ce que cela suggère, les points qui restent à vérifier, puis la portée de ces constats ; chaque phrase qui s'appuie sur les extraits cite ses sources, prises dans x ;
- a : au plus une action par identifiant de o : k (l'identifiant du constat), e (extraits pris dans le e de ce constat), et la même action formulée pour trois lecteurs, chacun avec t (l'action sur le projet, en deux ou trois phrases complètes et concrètes : quoi faire, sur quel volet du projet, et comment constater qu'elle est faite ; 450 caractères au plus) et j (la raison : un paragraphe de 2 à 4 phrases, 300 à 700 caractères hors sources, qui relie l'action à ce que montrent les documents du projet, dit ce qu'elle doit changer et à quelle condition, et cite ses sources, prises dans le e du constat ; sans « recommandée parce que », qui est ajouté à l'affichage) :
  - dec (décideur) : un arbitrage (réallouer, exiger, décider) ;
  - pmu (chef de projet) : une action opérationnelle (compléter tel dispositif, documenter tel mécanisme) ;
  - ana (analyste M&E) : un travail d'instruction (documenter telle variable, vérifier telle contradiction) ;
- tr : une entrée par langue de l'entrée tr, avec l (le code de la langue), i (pour chaque constat de i : k et t traduit), c (la conclusion traduite, mêmes paragraphes) et a (pour chaque action de a : k, puis dec, pmu et ana, chacun avec t et j traduits). Liste vide si tr est absent.

Règles impératives :
- n'utilise que les données et extraits fournis ; aucune connaissance extérieure, aucune supposition, aucun chiffre inventé ; pj ne sert qu'à nommer et situer le projet ;
- chaque constat et chaque action citent au moins un extrait de leur liste e ; jamais une source absente de x, ni, pour un constat ou une action, hors de sa liste e ;
- si l.ld est vrai, la conclusion commence par les limites des documents disponibles : plusieurs volets du projet n'y sont pas encore assez documentés pour conclure ;
- conclusion prudente : « les résultats suggèrent », « sous réserve de » ;
- qu'un dispositif figure dans les documents n'établit pas qu'il fonctionne ni qu'il produit un effet : aucune inférence causale forte, aucun jugement de valeur ;
- des constats, des actions, des raisons et une conclusion rédigés en phrases complètes, jamais interrompues, sans jargon ;
- les trois formulations d'une action visent le même constat et la même chose à faire, à des niveaux différents : jamais trois actions différentes ;
- une traduction est fidèle au texte rédigé dans la langue lang : même sens, mêmes nuances de prudence, mêmes limites de longueur, mêmes sources entre crochets au même endroit du sens, rien d'ajouté ni d'omis ; les noms propres restent tels quels s'ils n'ont pas d'équivalent établi.

La réponse doit suivre exactement le schéma structuré demandé.$prompt$,
  'gpt-6-astra',
  '{"max_tokens":20000,"response_format":"structured_output"}'::jsonb
)
on conflict (code, version) do nothing;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Consommation IA de l'étape de lecture.
-- ---------------------------------------------------------------------------
alter table public.ai_usage drop constraint if exists ai_usage_source_check;
alter table public.ai_usage add constraint ai_usage_source_check check (
  source in (
    'ingestion', 'classification', 'layer_b_search', 'layer_b', 'layer_c',
    'reading', 'restitution', 'pillar_generation'
  )
);

-- ---------------------------------------------------------------------------
-- Intitulés des variables intermédiaires du cadre du run, dans la langue de
-- l'approche : l'étape de lecture les interprète.
-- ---------------------------------------------------------------------------
create or replace function public.run_variable_labels(
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

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'pillar_id', variable.pillar_id,
      'code', variable.code,
      'label', coalesce(translation.label, variable.label),
      'description', coalesce(translation.description, variable.description)
    ) order by pillar.order_index, variable.order_index, variable.id)
    from public.pillar_variables as variable
    join public.pillars as pillar on pillar.id = variable.pillar_id
    left join public.pillar_variable_translations as translation
      on translation.pillar_variable_id = variable.id
      and translation.locale = approach.locale
    where pillar.framework_id = target.framework_id
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.run_variable_labels(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.run_variable_labels(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
