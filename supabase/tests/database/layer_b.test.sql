-- ---------------------------------------------------------------------------
-- Couche B côté base : entrées (run_layer_b_inputs), recherche des extraits
-- (run_sub_question_matches), écriture des notes et des preuves
-- (complete_run), immuabilité, droits et effacement d'un run en échec. La
-- notation elle-même est testée dans l'API (tests/test_runs_layer_b.py).
--
-- Lancement : `supabase test db`, sur une base locale où les migrations de ce
-- dépôt sont appliquées.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

create function pg_temp.axis(k integer)
returns vector
language sql
as $$
  select array_agg(case when i = k then 1 else 0 end order by i)::vector(768)
  from generate_series(1, 768) as i;
$$;

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
-- Espace : cadre validé, Pertinence (3 sous-questions actives, 1 inactive) et
-- Équité non retenue. Cinq documents : trois parlent de l'axe 1, deux de
-- l'axe 2.
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
insert into public.pillar_variables (id, pillar_id, code, label, weight, order_index)
values ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
        'has_budget_execution', 'Taux d''exécution budgétaire', 1, 1);
insert into public.criteria (id, framework_id, code, name, definition, applicability, weight)
values
  ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'pertinence', 'Pertinence', 'Adéquation aux besoins.', 'obligatoire', 100),
  ('c1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001',
   'equite', 'Équité', 'Répartition des bénéfices.', 'non_applicable', 0);
insert into public.sub_questions (
  id, criterion_id, text, layer, status, inactive_reason, order_index, origin
)
values
  ('5a000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Les besoins sont-ils analysés ?', 'B', 'active', null, 1, 'referential'),
  ('5a000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001',
   'Les priorités nationales sont-elles prises en compte ?', 'B', 'active', null, 2, 'referential'),
  ('5a000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001',
   'Le ciblage est-il justifié ?', 'B', 'active', null, 3, 'referential'),
  ('5a000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001',
   'Question écartée', 'B', 'inactive', 'hors sujet', 4, 'referential'),
  ('5a000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000002',
   'Les femmes bénéficient-elles du programme ?', 'B', 'active', null, 1, 'referential');
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
from generate_series(1, 5) as i;
insert into public.segments (
  id, document_id, workspace_id, text, page_number, section_title, published
)
select
  ('0a000000-0000-0000-0000-00000000000' || i)::uuid,
  ('f0000000-0000-0000-0000-00000000000' || i)::uuid,
  'a0000000-0000-0000-0000-0000000000a1', 'Analyse des besoins, document ' || i || '.',
  i, 'Contexte', true
from generate_series(1, 5) as i;
insert into public.segment_embeddings (segment_id, workspace_id, embedding, model)
select id, workspace_id,
  case when right(id::text, 1)::integer <= 3 then pg_temp.axis(1) else pg_temp.axis(2) end,
  'test-model'
from public.segments
where workspace_id = 'a0000000-0000-0000-0000-0000000000a1';
update public.documents set status = 'conforme', indexed_at = now()
where workspace_id = 'a0000000-0000-0000-0000-0000000000a1';

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temporary table launched as
select (public.create_run('a0000000-0000-0000-0000-0000000000a1') ->> 'run_id')::uuid as id;

select pg_temp.as_service();
create temporary table job as
select public.claim_run('worker-1', 'layer-a/1.0.0+layer-b/1.0.0') as claim;

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
select public.run_layer_b_inputs(pg_temp.run_id(), pg_temp.lease()) as data;

select is((select data ->> 'locale' from inputs), 'en',
  'les justifications suivent la langue de l''approche');
select is(
  (select jsonb_path_query_array(data, '$.criteria[*].code') from inputs),
  '["pertinence"]'::jsonb,
  'un critère non retenu n''est pas évalué'
);
select is(
  (select jsonb_path_query_array(data, '$.criteria[0].questions[*].text') from inputs),
  '["Les besoins sont-ils analysés ?", "Les priorités nationales sont-elles prises en compte ?", "Le ciblage est-il justifié ?"]'::jsonb,
  'seules les sous-questions actives, dans leur ordre'
);
select throws_ok(
  $$select public.run_layer_b_inputs(pg_temp.run_id(), gen_random_uuid())$$,
  'P0001', 'RUN_LEASE_LOST',
  'les entrées sont réservées au détenteur du bail'
);

-- ---------------------------------------------------------------------------
-- Recherche des extraits.
-- ---------------------------------------------------------------------------
create temporary table matches as
select public.run_sub_question_matches(
  pg_temp.run_id(), pg_temp.lease(), 'test-model',
  jsonb_build_array(
    jsonb_build_object('sub_question_id', '5a000000-0000-0000-0000-000000000001',
                       'embedding', pg_temp.axis(1)::text),
    jsonb_build_object('sub_question_id', '5a000000-0000-0000-0000-000000000002',
                       'embedding', pg_temp.axis(2)::text)
  ),
  2
) as data;

select is((select jsonb_array_length(data) from matches), 4,
  'p_top_k extraits par sous-question');
select is(
  (select count(*)::integer from matches, jsonb_array_elements(data) as item
   where item ->> 'sub_question_id' = '5a000000-0000-0000-0000-000000000001'
     and (item ->> 'similarity')::numeric = 1
     and right(item ->> 'segment_id', 1)::integer <= 3),
  2,
  'les plus proches d''abord : segments de l''axe de la question'
);
select is(
  (select count(*)::integer
   from matches, jsonb_array_elements(data) as item
   join public.segments as segment on segment.id = (item ->> 'segment_id')::uuid
   where segment.text = item ->> 'text'),
  4,
  'avec le texte du segment, pour la notation'
);
select is(
  public.run_sub_question_matches(
    pg_temp.run_id(), pg_temp.lease(), 'other-model',
    jsonb_build_array(jsonb_build_object(
      'sub_question_id', '5a000000-0000-0000-0000-000000000001',
      'embedding', pg_temp.axis(1)::text)),
    2
  ),
  '[]'::jsonb,
  'un autre modèle d''embeddings ne se compare pas'
);
select throws_ok(
  $$select public.run_sub_question_matches(pg_temp.run_id(), pg_temp.lease(),
    'test-model', '[]', 50)$$,
  'P0001', 'INVALID_TOP_K',
  'le nombre d''extraits est borné'
);

-- ---------------------------------------------------------------------------
-- Écriture des résultats.
-- ---------------------------------------------------------------------------
create function pg_temp.results(note numeric, status text, documented integer)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'variables', '[]'::jsonb,
    'scores', '[]'::jsonb,
    'layer_b', jsonb_build_object(
      'notes', jsonb_build_array(jsonb_build_object(
        'criterion_id', 'c1000000-0000-0000-0000-000000000001',
        'note', note, 'status', status,
        'documented_sub_questions', documented, 'total_sub_questions', 3,
        'justification', 'Needs are analysed.', 'ambiguity_flag', false
      )),
      'answers', jsonb_build_array(
        jsonb_build_object('id', '5b000000-0000-0000-0000-000000000001',
          'sub_question_id', '5a000000-0000-0000-0000-000000000001',
          'status', 'documentee', 'note', 3, 'contradictory', false),
        jsonb_build_object('id', '5b000000-0000-0000-0000-000000000002',
          'sub_question_id', '5a000000-0000-0000-0000-000000000002',
          'status', 'documentee', 'note', 2, 'contradictory', false),
        jsonb_build_object('id', '5b000000-0000-0000-0000-000000000003',
          'sub_question_id', '5a000000-0000-0000-0000-000000000003',
          'status', 'non_documentee', 'note', null, 'contradictory', false)
      ),
      'evidences', jsonb_build_array(
        jsonb_build_object('sub_answer_id', '5b000000-0000-0000-0000-000000000001',
          'segment_id', '0a000000-0000-0000-0000-000000000001', 'similarity', 0.71),
        jsonb_build_object('sub_answer_id', '5b000000-0000-0000-0000-000000000002',
          'segment_id', '0a000000-0000-0000-0000-000000000004', 'similarity', 0.52),
        -- Réponse non documentée : aucune preuve n'est écrite.
        jsonb_build_object('sub_answer_id', '5b000000-0000-0000-0000-000000000003',
          'segment_id', '0a000000-0000-0000-0000-000000000005', 'similarity', 0.41)
      )
    ),
    'rules', jsonb_build_object('layer_b', jsonb_build_object(
      'ai', jsonb_build_object('status', 'completed', 'calls', 1)))
  );
$$;

select throws_ok(
  $$select public.complete_run(pg_temp.run_id(), pg_temp.lease(),
    pg_temp.results(2.5, 'conclu', 3))$$,
  'P0001', 'RUN_RESULTS_INVALID',
  'les compteurs d''une note sont ceux de ses réponses'
);
select throws_ok(
  $$select public.complete_run(pg_temp.run_id(), pg_temp.lease(),
    jsonb_set(
      jsonb_set(pg_temp.results(3, 'conclu', 1),
        '{layer_b,answers,1,status}', '"non_documentee"'),
      '{layer_b,answers,1,note}', 'null'
    ) #- '{layer_b,evidences,1}')$$,
  'P0001', 'RUN_RESULTS_INVALID',
  'RG-1 : pas de note sous 50 % de sous-questions documentées'
);

select is(
  public.complete_run(pg_temp.run_id(), pg_temp.lease(),
    pg_temp.results(2.5, 'conclu', 2)) -> 'notes',
  '1'::jsonb,
  'la note du critère est écrite avec le run'
);
select results_eq(
  $$select note, status, documented_sub_questions, total_sub_questions
    from public.layer_b_notes where run_id = pg_temp.run_id()$$,
  $$values (2.5::numeric(3,2), 'conclu'::text, 2, 3)$$,
  'note, statut et couverture des sous-questions'
);
select results_eq(
  $$select answer.note, evidence.criterion_id, evidence.excerpt
    from public.sub_answer_evidences as link
    join public.layer_b_sub_answers as answer on answer.id = link.sub_answer_id
    join public.evidences as evidence on evidence.id = link.evidence_id
    order by answer.note desc$$,
  $$values
    (3::smallint, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Analyse des besoins, document 1.'),
    (2::smallint, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Analyse des besoins, document 4.')$$,
  'chaque réponse documentée garde ses extraits, rattachés au critère'
);
select is(
  (select output_summary -> 'notes' from public.run_steps
   where run_id = pg_temp.run_id() and step_name = 'restitution'),
  '1'::jsonb,
  'le suivi du run compte les notes'
);
select is(
  (select metadata -> 'layer_b_ai' ->> 'status' from public.audit_events
   where run_id = pg_temp.run_id() and operation = 'run_completed'),
  'completed',
  'GF-4 : l''usage de l''IA est journalisé'
);

-- ---------------------------------------------------------------------------
-- Immuabilité et droits.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.layer_b_notes set note = 3 where run_id = pg_temp.run_id()$$,
  'P0001', 'RUN_IMMUTABLE',
  'une note publiée ne change plus'
);
select throws_ok(
  $$delete from public.sub_answer_evidences$$,
  'P0001', 'RUN_IMMUTABLE',
  'ses preuves non plus'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(
  (select count(*)::integer from public.layer_b_sub_answers)
    + (select count(*)::integer from public.sub_answer_evidences),
  5,
  'un membre lit les réponses et leurs preuves'
);
reset role;
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select is(
  (select count(*)::integer from public.layer_b_notes),
  0,
  'un non-membre ne voit rien'
);
reset role;

-- ---------------------------------------------------------------------------
-- Un run en échec ne garde aucun résultat de la couche B (RG-6.1).
-- ---------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
delete from launched;
insert into launched
select (public.create_run('a0000000-0000-0000-0000-0000000000a1') ->> 'run_id')::uuid;
select pg_temp.as_service();
delete from job;
insert into job select public.claim_run('worker-1', 'layer-a/1.0.0+layer-b/1.0.0');
insert into public.layer_b_sub_answers (run_id, workspace_id, sub_question_id, status)
values (pg_temp.run_id(), 'a0000000-0000-0000-0000-0000000000a1',
        '5a000000-0000-0000-0000-000000000001', 'documentee');
select public.fail_run(pg_temp.run_id(), pg_temp.lease(), 'layer_b', 'RUN_FAILED', 'échec');

select is(
  (select count(*)::integer from public.layer_b_sub_answers where run_id = pg_temp.run_id()),
  0,
  'les réponses partielles sont effacées'
);

select * from finish();
rollback;
