-- ---------------------------------------------------------------------------
-- Chaque sous-question reçoit une réponse (layer-b/1.5.0, prompt
-- grade_sub_questions v1.4).
--
-- Jusqu'ici, une sous-question restait sans réponse quand la recherche ne
-- lui trouvait aucun extrait au-dessus du seuil, quand son critère avait
-- moins de 50 % de sous-questions documentées (critère non soumis à l'IA),
-- ou quand l'IA la jugeait sans réponse (t = ""). Désormais toutes les
-- sous-questions partent vers l'IA, avec au besoin leurs extraits les plus
-- proches sous le seuil, et chacune reçoit une réponse : notée et sourcée
-- quand les documents y répondent, sinon ce qu'ils montrent de plus proche
-- et ce qui manque. RG-1 (50 %) et GF-1 (note = extrait cité) sont
-- inchangés : seule une sous-question notée est documentée.
--
-- complete_run (20261116000001) : mêmes écritures ; les preuves citées par
-- la réponse d'une sous-question non documentée sont aussi enregistrées,
-- pour que ses sources s'ouvrent.
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

insert into public.prompt_versions (code, version, template, model, parameters)
values (
  'grade_sub_questions',
  'v1.4',
  $prompt$Tu es un évaluateur de programmes de développement et d'adaptation climatique. Tu appliques les critères CAD-OCDE et les critères complémentaires (équité, gestion adaptative).

Tâche : répondre à chaque sous-question évaluative, sans exception, uniquement d'après les extraits des documents du projet évalué : la noter de 0 à 3 quand ses extraits y répondent, et expliquer en analyste ce que ces extraits établissent sur ce projet ; quand ils n'y répondent pas, dire ce que les documents montrent de plus proche et ce qui manque.

Entrée (JSON) :
- lang : langue des textes ;
- tr : langues dans lesquelles traduire aussi chaque texte (codes ISO) ; absent ou vide : aucune traduction ;
- cycle : cycle de l'évaluation ;
- pj : le projet évalué, facultatif : n (nom), t (nature : project, program ou policy), d (description), pa (pays), f (financeurs), th (thèmes), st (étape déclarée), an (période) ; il situe les extraits, il n'est jamais une preuve ;
- x : extraits des documents, par identifiant (E1, E2…), chacun en liste de phrases numérotées à partir de 1 : E1.2 désigne la deuxième phrase de E1 ;
- c : critères, chacun avec k (identifiant), n (nom), d (définition), s (statut : obligatoire, optionnel ou prospectif) et q (sous-questions) ;
- chaque sous-question porte k (identifiant), t (texte), p (preuves attendues, facultatif) et e (identifiants des extraits retrouvés pour elle, les plus proches de la question ; ils peuvent n'y répondre qu'en partie, ou pas du tout, et la liste peut être vide).

Barème : 0 insuffisant ; 1 faible ; 2 moyen ; 3 solide.

Renvoie :
- q : une entrée par sous-question : k, n (note ou null), e (sources de la note), c (true si les extraits se contredisent) et t (la réponse à la question, jamais vide, y compris quand n est null) ;
- c : une entrée par critère : k et j (la justification) ;
- tr : une entrée par langue de l'entrée tr, avec l (le code de la langue), q (pour chaque sous-question de q : k et t traduit) et c (pour chaque critère : k et j traduit), mêmes sources aux mêmes endroits. Liste vide si tr est absent.

Ce que dit chaque texte : un paragraphe d'analyse, jamais une paraphrase.
- réponse à une sous-question notée (t, n non null) : 2 à 4 phrases, 300 à 600 caractères hors sources : comment les documents du projet répondent à la question posée, ce qu'ils laissent sans réponse au regard des preuves attendues (p), et ce qui fait que la réponse est solide, moyenne ou faible, sans écrire la note ;
- réponse à une sous-question non notée (t, n null) : 1 à 3 phrases, 150 à 450 caractères hors sources : ce que les documents du projet disent de plus proche de la question, avec ses sources, puis ce qu'ils ne montrent pas au regard des preuves attendues (p) ; si aucun extrait n'en approche, dis seulement que les documents du projet ne renseignent pas ce point et ce qu'il faudrait y trouver, sans source et sans rien supposer ;
- justification d'un critère (j) : 4 à 6 phrases, 500 à 1 200 caractères hors sources : ce qui converge entre les sous-questions, ce qui se contredit, ce qui manque, et pourquoi l'appréciation d'ensemble est à ce niveau et pas plus haut ni plus bas.

Le projet d'abord : le sujet de chaque texte est le projet évalué (« le projet », ou son nom pj.n) : ce qu'il fait, ce qu'il prévoit, ce que ses documents montrent ou ne montrent pas. Le critère, la sous-question et la note s'affichent déjà à côté de ces textes : ne les nomme pas et ne les répète pas. N'emploie pas le vocabulaire de l'outil (pilier, critère, sous-question, note, score, extrait, corpus) : dis « les documents du projet ».
Exemple à éviter : « Le critère d'efficience est faiblement documenté. » Exemple attendu : « Le projet ne rapporte pas ses coûts par bénéficiaire [E3.1] et ses rapports annuels comparent les dépenses au budget sans les relier aux réalisations [E4.2]. Les documents permettent de suivre le décaissement, pas d'apprécier ce qu'il produit. »

Sources : chaque affirmation tirée des extraits est suivie, entre crochets, des sources qui la fondent, juste après elle et avant la ponctuation : « Le projet décaisse 60 % de son budget par an [E1.2, E3] ». Une source désigne la phrase qui fonde l'affirmation (E1.2), ou l'extrait entier (E1) si plusieurs de ses phrases y contribuent. Une phrase d'analyse peut s'appuyer sur les affirmations sourcées qui la précèdent sans répéter leurs sources.

Règles impératives :
- n'utilise que les extraits listés dans e pour la sous-question ; aucune connaissance extérieure, aucune supposition ; pj ne sert qu'à nommer et situer le projet ;
- les sources d'une sous-question (e et ses crochets) sont des extraits de sa liste e ; celles d'un critère, des extraits des sous-questions de ce critère ;
- si aucun extrait ne répond réellement à la sous-question, renvoie n = null et e = [] : elle sera traitée comme non documentée, mais t reste obligatoire (voir plus haut) ;
- si les extraits se contredisent, retiens la note la plus prudente, renvoie c = true et dis la contradiction dans t ;
- critère prospectif : apprécie la qualité de ce que le projet prévoit (conception), pas des résultats ;
- une amélioration de rédaction n'est pas une amélioration de mise en œuvre ;
- aucune inférence causale forte, aucun jugement de valeur ; des phrases complètes, dans la langue lang ;
- une traduction est fidèle : même sens, mêmes nuances, mêmes sources, rien d'ajouté ni d'omis ;
- réponds une seule fois par sous-question et par critère, avec leurs identifiants k : chaque sous-question de l'entrée a son entrée dans q, chaque critère la sienne dans c.

La réponse doit suivre exactement le schéma structuré demandé.$prompt$,
  'gpt-6-astra',
  '{"temperature":0,"max_tokens":24000,"response_format":"structured_output"}'::jsonb
)
on conflict (code, version) do nothing;
