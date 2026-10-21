-- ---------------------------------------------------------------------------
-- Couche C côté base : entrées (run_layer_c_inputs, run_segment_texts),
-- écriture des alertes et de leurs preuves (complete_run), immuabilité,
-- instruction journalisée (instruct_alert) et droits. La détection et la
-- qualification sont testées dans l'API (tests/test_runs_layer_c.py).
--
-- Lancement : `supabase test db`, sur une base locale où les migrations de ce
-- dépôt sont appliquées.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

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
-- Espace : cadre validé, un pilier lié à Pertinence (retenue) et à Équité
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
   'Les priorités nationales sont-elles prises en compte ?', 'B', 'active', null, 2, 'referential');
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
select public.claim_run('worker-1', 'layer-a/1.0.0+layer-b/1.0.0+layer-c/1.0.0') as claim;

create function pg_temp.lease()
returns uuid
language sql
as $$ select (claim ->> 'lease_token')::uuid from job $$;

create function pg_temp.run_id()
returns uuid
language sql
as $$ select id from launched $$;

-- ---------------------------------------------------------------------------
-- Entrées.
-- ---------------------------------------------------------------------------
create temporary table inputs as
select public.run_layer_c_inputs(pg_temp.run_id(), pg_temp.lease()) as data;

select is(
  (select jsonb_path_query_array(data, '$.pillars[*].name') from inputs),
  '["Budget and absorption"]'::jsonb,
  'les piliers sont nommés dans la langue de l''approche'
);
select is(
  (select jsonb_path_query_array(data, '$.links[*].code') from inputs),
  '["pertinence"]'::jsonb,
  'seuls les liens vers un critère retenu'
);
select throws_ok(
  $$select public.run_layer_c_inputs(pg_temp.run_id(), gen_random_uuid())$$,
  'P0001', 'RUN_LEASE_LOST',
  'les entrées sont réservées au détenteur du bail'
);
select is(
  public.run_segment_texts(pg_temp.run_id(), pg_temp.lease(), jsonb_build_array(
    '0a000000-0000-0000-0000-000000000002', '0a000000-0000-0000-0000-000000000006')),
  jsonb_build_object('0a000000-0000-0000-0000-000000000002',
    'Exécution budgétaire, document 2.'),
  'seul le texte des segments du corpus du run'
);

-- ---------------------------------------------------------------------------
-- Écriture des résultats : une variable et une réponse citent le segment 1,
-- l'alerte cite les segments 1 et 4.
-- ---------------------------------------------------------------------------
create function pg_temp.results(segment_ids jsonb)
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
      'corpus_confidence', 0.8
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
      'corpus_confidence', 0.8, 'documents_count', 2
    )),
    'layer_b', jsonb_build_object(
      'notes', jsonb_build_array(jsonb_build_object(
        'criterion_id', 'c1000000-0000-0000-0000-000000000001',
        'note', 1, 'status', 'conclu',
        'documented_sub_questions', 2, 'total_sub_questions', 2,
        'justification', 'Weakly supported.', 'ambiguity_flag', false
      )),
      'answers', jsonb_build_array(
        jsonb_build_object('id', '5b000000-0000-0000-0000-000000000001',
          'sub_question_id', '5a000000-0000-0000-0000-000000000001',
          'status', 'documentee', 'note', 1, 'contradictory', false),
        jsonb_build_object('id', '5b000000-0000-0000-0000-000000000002',
          'sub_question_id', '5a000000-0000-0000-0000-000000000002',
          'status', 'documentee', 'note', 1, 'contradictory', false)
      ),
      'evidences', jsonb_build_array(
        jsonb_build_object('sub_answer_id', '5b000000-0000-0000-0000-000000000001',
          'segment_id', '0a000000-0000-0000-0000-000000000001', 'similarity', 0.7)
      )
    ),
    'layer_c', jsonb_build_object('alerts', jsonb_build_array(jsonb_build_object(
      'id', 'ac000000-0000-0000-0000-000000000001',
      'pillar_id', 'd0000000-0000-0000-0000-000000000001',
      'criterion_id', 'c1000000-0000-0000-0000-000000000001',
      'program_version_id', '90000000-0000-0000-0000-000000000001',
      'rule_code', 'ALERT-01', 'alert_type', 'documentaire_sans_credibilite',
      'severity', 'majeure', 'message', 'Budget well documented, weak relevance.',
      'qualified', true, 'segment_ids', segment_ids
    ))),
    'rules', jsonb_build_object('layer_c', jsonb_build_object(
      'ai', jsonb_build_object('status', 'completed', 'calls', 1)))
  );
$$;

select throws_ok(
  $$select public.complete_run(pg_temp.run_id(), pg_temp.lease(),
    pg_temp.results(jsonb_build_array('0a000000-0000-0000-0000-000000000005')))$$,
  'P0001', 'RUN_RESULTS_INVALID',
  'RG-4 : une alerte cite au moins une preuve du run'
);

select is(
  public.complete_run(pg_temp.run_id(), pg_temp.lease(),
    pg_temp.results(jsonb_build_array(
      '0a000000-0000-0000-0000-000000000001',
      '0a000000-0000-0000-0000-000000000004'))) -> 'alerts',
  '1'::jsonb,
  'l''alerte est écrite avec le run'
);
select results_eq(
  $$select rule_code, severity, qualified, status
    from public.layer_c_alerts where run_id = pg_temp.run_id()$$,
  $$values ('ALERT-01'::text, 'majeure'::text, true, 'a_instruire'::text)$$,
  'règle, gravité, qualification ; à instruire'
);
select results_eq(
  $$select evidence.segment_id, evidence.criterion_id is not null
    from public.alert_evidences as link
    join public.evidences as evidence on evidence.id = link.evidence_id
    order by evidence.segment_id$$,
  $$values
    ('0a000000-0000-0000-0000-000000000001'::uuid, true),
    ('0a000000-0000-0000-0000-000000000004'::uuid, false)$$,
  'un segment cité deux fois ne compte qu''une fois, preuve du critère d''abord'
);
select is(
  (select metadata -> 'layer_c_ai' ->> 'status' from public.audit_events
   where run_id = pg_temp.run_id() and operation = 'run_completed'),
  'completed',
  'GF-4 : l''usage de l''IA est journalisé'
);

-- ---------------------------------------------------------------------------
-- Immuabilité.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.layer_c_alerts set severity = 'mineure'
    where run_id = pg_temp.run_id()$$,
  'P0001', 'RUN_IMMUTABLE',
  'RG-3 : une alerte publiée ne change pas'
);
select throws_ok(
  $$delete from public.alert_evidences$$,
  'P0001', 'RUN_IMMUTABLE',
  'ses preuves non plus'
);

-- ---------------------------------------------------------------------------
-- Instruction et droits.
-- ---------------------------------------------------------------------------
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select is((select count(*)::integer from public.layer_c_alerts), 0,
  'un non-membre ne voit rien');
select throws_ok(
  $$select public.instruct_alert('ac000000-0000-0000-0000-000000000001', 'Vu.')$$,
  'P0001', 'ALERT_NOT_FOUND',
  'un non-membre n''instruit rien'
);
reset role;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(
  $$update public.layer_c_alerts set status = 'instruite'$$,
  '42501', null,
  'pas de modification directe : l''instruction passe par instruct_alert'
);
select throws_ok(
  $$select public.instruct_alert('ac000000-0000-0000-0000-000000000001', '  ')$$,
  'P0001', 'ALERT_COMMENT_REQUIRED',
  'le commentaire est obligatoire'
);
select lives_ok(
  $$select public.instruct_alert('ac000000-0000-0000-0000-000000000001',
    '  Écart expliqué par le calendrier des décaissements.  ')$$,
  'un membre instruit l''alerte'
);
reset role;

select results_eq(
  $$select alert.status, alert.instruction_comment, alert.instructed_by,
      event.actor_type, event.after_value ->> 'comment'
    from public.layer_c_alerts as alert
    join public.audit_events as event
      on event.object_id = alert.id and event.operation = 'alert_instructed'
    where alert.id = 'ac000000-0000-0000-0000-000000000001'$$,
  $$values ('instruite'::text,
    'Écart expliqué par le calendrier des décaissements.'::text,
    '11111111-1111-1111-1111-111111111111'::uuid, 'human'::text,
    'Écart expliqué par le calendrier des décaissements.'::text)$$,
  'US-17.2 : statut, commentaire et auteur, journalisés'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(
  $$select public.instruct_alert('ac000000-0000-0000-0000-000000000001', 'Encore.')$$,
  'P0001', 'ALERT_ALREADY_INSTRUCTED',
  'une alerte instruite le reste'
);
reset role;

select * from finish();
rollback;
