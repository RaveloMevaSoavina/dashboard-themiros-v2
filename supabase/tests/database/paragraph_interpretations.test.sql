-- ---------------------------------------------------------------------------
-- Interprétations en paragraphes côté base (20261116000001) : complete_run
-- écrit la lecture de chaque segment sur toutes ses preuves, les
-- interprétations des variables, des piliers et des sous-questions avec
-- leurs sources, les traductions des justifications et des écarts.
-- L'étape de lecture et ses règles sont testées dans l'API
-- (tests/test_runs_reading.py).
--
-- Lancement : `supabase test db`, sur une base locale où les migrations de ce
-- dépôt sont appliquées.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

create function pg_temp.as_user(user_id text)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    jsonb_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.as_service()
returns void
language sql
as $$
  select set_config('request.jwt.claims', '{"role": "service_role"}', true);
$$;

-- ---------------------------------------------------------------------------
-- Espace : le même que pour la restitution (restitution.test.sql).
-- (non retenue). Cinq documents, un segment chacun ; un sixième segment hors
-- corpus.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'admin@test.local', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'outsider@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333')
on conflict (id) do nothing;
insert into public.organizations (id, name)
values ('a0000000-0000-0000-0000-000000000001', 'Organisation de test');
insert into public.workspaces (id, organization_id, name, kind)
values ('a0000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001',
        'Programme de test', 'program');
insert into public.workspace_members (workspace_id, profile_id, role)
values ('a0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.program_versions (id, workspace_id, label, year, order_index)
values ('90000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1',
        'Revue mi-parcours 2025', 2025, 1);

insert into public.approaches (
  id, workspace_id, ref_framework_id, cycle, instrument_module,
  instrument_subtype, complexity_score, complexity_class, complexity_factors,
  recommended_methods, evaluation_nature, questionnaire_answers,
  justifications, created_by, status, confirmed_by, confirmed_at, locale
)
select
  'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1',
  id, 'mi_parcours', 'M2', 'programme', 5, 'complique', '{}', '{}',
  'externe_independante', '{}', '{}', '11111111-1111-1111-1111-111111111111',
  'confirmed', '11111111-1111-1111-1111-111111111111', now(), 'en'
from public.ref_frameworks
order by code
limit 1;
insert into public.frameworks (id, workspace_id, approach_id)
values ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1',
        'b0000000-0000-0000-0000-000000000001');
insert into public.pillars (id, framework_id, name, description, weight, order_index)
values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
        'Budget et absorption', 'Exécution budgétaire du programme.', 100, 1);
insert into public.pillar_translations (pillar_id, locale, name, description)
values ('d0000000-0000-0000-0000-000000000001', 'en', 'Budget and absorption',
        'Budget execution of the programme.');
insert into public.pillar_variables (id, pillar_id, code, label, weight, order_index)
values ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
        'has_budget_execution', 'Taux d''exécution budgétaire', 1, 1);
insert into public.criteria (id, framework_id, code, name, definition, applicability, weight)
values
  ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'pertinence', 'Pertinence', 'Adéquation aux besoins.', 'obligatoire', 100),
  ('c1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001',
   'equite', 'Équité', 'Répartition des bénéfices.', 'non_applicable', 0);
insert into public.pillar_criteria (pillar_id, criterion_id) values
  ('d0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002');
insert into public.sub_questions (
  id, criterion_id, text, layer, status, inactive_reason, order_index, origin
)
values
  ('5a000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Les besoins sont-ils analysés ?', 'B', 'active', null, 1, 'referential'),
  ('5a000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001',
   'Les priorités nationales sont-elles prises en compte ?', 'B', 'active', null, 2, 'referential'),
  ('5a000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001',
   'Le ciblage est-il justifié ?', 'B', 'active', null, 3, 'referential');
update public.frameworks
set status = 'validated', validated_by = '11111111-1111-1111-1111-111111111111',
    validated_at = now()
where id = 'c0000000-0000-0000-0000-000000000001';

insert into public.documents (
  id, workspace_id, original_filename, storage_path, file_hash,
  file_size_bytes, mime_type
)
select
  ('f0000000-0000-0000-0000-00000000000' || i)::uuid,
  'a0000000-0000-0000-0000-0000000000a1', 'doc-' || i || '.pdf',
  'test/doc-' || i || '.pdf', md5('doc-' || i), 1000, 'application/pdf'
from generate_series(1, 6) as i;
insert into public.segments (
  id, document_id, workspace_id, text, page_number, section_title, published
)
select
  ('0a000000-0000-0000-0000-00000000000' || i)::uuid,
  ('f0000000-0000-0000-0000-00000000000' || i)::uuid,
  'a0000000-0000-0000-0000-0000000000a1', 'Exécution budgétaire, document ' || i || '.',
  i, 'Budget', true
from generate_series(1, 6) as i;
update public.documents set status = 'conforme', indexed_at = now()
where workspace_id = 'a0000000-0000-0000-0000-0000000000a1'
  and id <> 'f0000000-0000-0000-0000-000000000006';

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temporary table launched as
select (public.create_run('a0000000-0000-0000-0000-0000000000a1') ->> 'run_id')::uuid as id;

select pg_temp.as_service();
create temporary table job as
select public.claim_run('worker-1', 'layer-a/1.0.0+layer-b/1.0.0+layer-c/1.0.0+restitution/1.0.0') as claim;

create function pg_temp.lease()
returns uuid
language sql
as $$ select (claim ->> 'lease_token')::uuid from job $$;

create function pg_temp.run_id()
returns uuid
language sql
as $$ select id from launched $$;



-- ---------------------------------------------------------------------------
-- Résultats : une variable cite les segments 1 et 4, une réponse le segment
-- 1 ; une alerte. Chaque texte porte un paragraphe et ses sources.
-- ---------------------------------------------------------------------------
create function pg_temp.sources(segment text)
returns jsonb
language sql
as $$
  select jsonb_build_array(jsonb_build_object(
    'segment_id', segment, 'spans', jsonb_build_array(jsonb_build_array(0, 10))
  ))
$$;

create function pg_temp.results()
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'variables', jsonb_build_array(jsonb_build_object(
      'id', '7e000000-0000-0000-0000-000000000001',
      'pillar_id', 'd0000000-0000-0000-0000-000000000001',
      'variable_code', 'has_budget_execution',
      'program_version_id', '90000000-0000-0000-0000-000000000001',
      'value', 1, 'state', 'present', 'documents_count', 2,
      'corpus_confidence', 0.8,
      'interpretation', 'Le projet exécute son budget⟦1⟧.',
      'interpretation_translations', jsonb_build_object(
        'en', 'The project spends its budget⟦1⟧.', 'pt', '  '),
      'interpretation_citations',
        pg_temp.sources('0a000000-0000-0000-0000-000000000004')
    )),
    'evidences', jsonb_build_array(
      jsonb_build_object('variable_id', '7e000000-0000-0000-0000-000000000001',
        'segment_id', '0a000000-0000-0000-0000-000000000001', 'similarity', 0.6),
      jsonb_build_object('variable_id', '7e000000-0000-0000-0000-000000000001',
        'segment_id', '0a000000-0000-0000-0000-000000000004', 'similarity', 0.5)
    ),
    'scores', jsonb_build_array(jsonb_build_object(
      'pillar_id', 'd0000000-0000-0000-0000-000000000001',
      'program_version_id', '90000000-0000-0000-0000-000000000001',
      'score', 100, 'delta', null, 'evolution_label', null,
      'corpus_confidence', 0.8, 'documents_count', 2,
      'interpretation', repeat('Le projet gère ses finances. ', 80) || '⟦1⟧',
      'interpretation_translations', jsonb_build_object(
        'en', 'The project manages its finances⟦1⟧.'),
      'interpretation_citations',
        pg_temp.sources('0a000000-0000-0000-0000-000000000001')
    )),
    'readings', jsonb_build_array(jsonb_build_object(
      'segment_id', '0a000000-0000-0000-0000-000000000001',
      'interpretation', 'Le projet a exécuté son budget⟦1⟧.',
      'translations', jsonb_build_object('en', 'The project spent its budget⟦1⟧.'),
      'interpretation_citations',
        pg_temp.sources('0a000000-0000-0000-0000-000000000001'),
      'spans', jsonb_build_array(jsonb_build_array(0, 10))
    )),
    'layer_b', jsonb_build_object(
      'notes', jsonb_build_array(jsonb_build_object(
        'criterion_id', 'c1000000-0000-0000-0000-000000000001',
        'note', 1, 'status', 'conclu',
        'documented_sub_questions', 2, 'total_sub_questions', 3,
        'justification', 'Le projet analyse peu ses besoins⟦1⟧.',
        'justification_translations', jsonb_build_object(
          'en', 'The project barely analyses its needs⟦1⟧.'),
        'ambiguity_flag', false,
        'citations', pg_temp.sources('0a000000-0000-0000-0000-000000000001')
      )),
      'answers', jsonb_build_array(
        jsonb_build_object('id', '5b000000-0000-0000-0000-000000000001',
          'sub_question_id', '5a000000-0000-0000-0000-000000000001',
          'status', 'documentee', 'note', 1, 'contradictory', false,
          'interpretation', 'Le projet décrit ses besoins sans les chiffrer⟦1⟧.',
          'interpretation_translations', jsonb_build_object(
            'en', 'The project describes its needs without figures⟦1⟧.'),
          'interpretation_citations',
            pg_temp.sources('0a000000-0000-0000-0000-000000000001')),
        jsonb_build_object('id', '5b000000-0000-0000-0000-000000000002',
          'sub_question_id', '5a000000-0000-0000-0000-000000000002',
          'status', 'documentee', 'note', 1, 'contradictory', false,
          'interpretation', null, 'interpretation_translations', '{}'::jsonb,
          'interpretation_citations', '[]'::jsonb),
        jsonb_build_object('id', '5b000000-0000-0000-0000-000000000003',
          'sub_question_id', '5a000000-0000-0000-0000-000000000003',
          'status', 'non_documentee', 'note', null, 'contradictory', false)
      ),
      'evidences', jsonb_build_array(
        jsonb_build_object('sub_answer_id', '5b000000-0000-0000-0000-000000000001',
          'segment_id', '0a000000-0000-0000-0000-000000000001', 'similarity', 0.7,
          'spans', jsonb_build_array(jsonb_build_array(0, 10)))
      )
    ),
    'layer_c', jsonb_build_object('alerts', jsonb_build_array(jsonb_build_object(
      'id', 'ae000000-0000-0000-0000-000000000001',
      'pillar_id', 'd0000000-0000-0000-0000-000000000001',
      'criterion_id', 'c1000000-0000-0000-0000-000000000001',
      'program_version_id', '90000000-0000-0000-0000-000000000001',
      'rule_code', 'ALERT-01', 'alert_type', 'documentaire_sans_credibilite',
      'severity', 'majeure', 'qualified', true,
      'message', repeat('Le projet décrit son budget sans montrer ses dépenses. ', 20)
        || '⟦1⟧',
      'translations', jsonb_build_object('en', 'The project describes its budget⟦1⟧.'),
      'citations', pg_temp.sources('0a000000-0000-0000-0000-000000000004'),
      'segment_ids', jsonb_build_array('0a000000-0000-0000-0000-000000000001',
        '0a000000-0000-0000-0000-000000000004')
    ))),
    'rules', jsonb_build_object('reading', jsonb_build_object(
      'ai', jsonb_build_object('status', 'completed', 'calls', 1)))
  )
$$;

select is(
  public.run_variable_labels(pg_temp.run_id(), pg_temp.lease()),
  '[{"code": "has_budget_execution", "label": "Taux d''exécution budgétaire", "pillar_id": "d0000000-0000-0000-0000-000000000001", "description": null}]'::jsonb,
  'la lecture reçoit les intitulés des variables du cadre du run'
);

create temporary table written as
select public.complete_run(pg_temp.run_id(), pg_temp.lease(), pg_temp.results())
  as counts;

select is((select (counts ->> 'readings')::integer from written), 2,
  'la lecture d''un segment est écrite sur ses deux preuves (couches A et B)');

select results_eq(
  $$select evidence.variable_code is not null, evidence.interpretation,
      evidence.interpretation_translations ->> 'en',
      jsonb_array_length(evidence.interpretation_citations),
      evidence.interpretation_citations -> 0 ->> 'e' = evidence.id::text
    from public.evidences as evidence
    where evidence.run_id = pg_temp.run_id()
      and evidence.segment_id = '0a000000-0000-0000-0000-000000000001'$$,
  $$values
    (true, 'Le projet a exécuté son budget⟦1⟧.'::text,
     'The project spent its budget⟦1⟧.'::text, 1, true),
    (false, 'Le projet a exécuté son budget⟦1⟧.'::text,
     'The project spent its budget⟦1⟧.'::text, 1, true)$$,
  'chaque preuve du segment porte la lecture, ses sources renvoyant à elle-même'
);

select is(
  (select interpretation is null from public.evidences
   where run_id = pg_temp.run_id()
     and segment_id = '0a000000-0000-0000-0000-000000000004'),
  true,
  'un segment sans lecture reste sans interprétation'
);

select results_eq(
  $$select variable.interpretation, variable.interpretation_translations,
      evidence.segment_id
    from public.intermediate_variables as variable
    join public.evidences as evidence
      on evidence.id = (variable.interpretation_citations -> 0 ->> 'e')::uuid
    where variable.run_id = pg_temp.run_id()$$,
  $$values ('Le projet exécute son budget⟦1⟧.'::text,
    '{"en": "The project spends its budget⟦1⟧."}'::jsonb,
    '0a000000-0000-0000-0000-000000000004'::uuid)$$,
  'la variable garde son interprétation, ses traductions non vides et ses sources'
);

select results_eq(
  $$select char_length(score.interpretation), evidence.pillar_id is not null,
      score.interpretation_translations ->> 'en'
    from public.layer_a_scores as score
    join public.evidences as evidence
      on evidence.id = (score.interpretation_citations -> 0 ->> 'e')::uuid
    where score.run_id = pg_temp.run_id()$$,
  $$values (2000, true, 'The project manages its finances⟦1⟧.'::text)$$,
  'le pilier : interprétation coupée au plafond, source parmi ses preuves'
);

select results_eq(
  $$select question.order_index, answer.interpretation,
      answer.interpretation_translations ->> 'en',
      jsonb_array_length(answer.interpretation_citations)
    from public.layer_b_sub_answers as answer
    join public.sub_questions as question on question.id = answer.sub_question_id
    where answer.run_id = pg_temp.run_id()$$,
  $$values
    (1, 'Le projet décrit ses besoins sans les chiffrer⟦1⟧.'::text,
     'The project describes its needs without figures⟦1⟧.'::text, 1),
    (2, null, null, 0),
    (3, null, null, 0)$$,
  'chaque sous-question documentée porte l''interprétation de sa réponse'
);

select is(
  (select justification_translations ->> 'en' from public.layer_b_notes
   where run_id = pg_temp.run_id()),
  'The project barely analyses its needs⟦1⟧.',
  'la justification du critère est traduite'
);

select results_eq(
  $$select char_length(message) > 1000, translations ->> 'en',
      jsonb_array_length(citations)
    from public.layer_c_alerts where run_id = pg_temp.run_id()$$,
  $$values (true, 'The project describes its budget⟦1⟧.'::text, 1)$$,
  'l''écart garde son paragraphe, sa traduction et ses sources'
);

select is(
  (select metadata -> 'reading_ai' ->> 'calls' from public.audit_events
   where run_id = pg_temp.run_id() and operation = 'run_completed'),
  '1',
  'le journal garde la consommation de l''étape de lecture'
);

select throws_ok(
  $$insert into public.ai_usage (workspace_id, source, kind, calls, total_tokens)
    values ('a0000000-0000-0000-0000-0000000000a1', 'inconnue', 'completion', 1, 1)$$,
  '23514', null,
  'une source de consommation inconnue est refusée'
);

select lives_ok(
  $$insert into public.ai_usage (workspace_id, run_id, source, kind, calls, total_tokens)
    values ('a0000000-0000-0000-0000-0000000000a1', pg_temp.run_id(), 'reading',
      'completion', 1, 100)$$,
  'la consommation de l''étape de lecture est enregistrée'
);

select * from finish();
rollback;
