-- ---------------------------------------------------------------------------
-- Restitution côté base : écriture de la synthèse, du plan d'action et de
-- leurs preuves (complete_run), immuabilité et droits. La sélection des
-- candidats et la rédaction sont testées dans l'API
-- (tests/test_runs_restitution.py).
--
-- Lancement : `supabase test db`, sur une base locale où les migrations de ce
-- dépôt sont appliquées.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

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
-- 1, l'alerte les segments 1 et 4. La restitution : un progrès (pilier), une
-- faiblesse (critère), une zone à vérifier (alerte) et une action sur
-- l'alerte, avec ses trois projections.
-- ---------------------------------------------------------------------------
create function pg_temp.results(restitution jsonb)
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
        'documented_sub_questions', 2, 'total_sub_questions', 3,
        'justification', 'Weakly supported.', 'ambiguity_flag', false
      )),
      'answers', jsonb_build_array(
        jsonb_build_object('id', '5b000000-0000-0000-0000-000000000001',
          'sub_question_id', '5a000000-0000-0000-0000-000000000001',
          'status', 'documentee', 'note', 1, 'contradictory', false),
        jsonb_build_object('id', '5b000000-0000-0000-0000-000000000002',
          'sub_question_id', '5a000000-0000-0000-0000-000000000002',
          'status', 'documentee', 'note', 1, 'contradictory', false),
        jsonb_build_object('id', '5b000000-0000-0000-0000-000000000003',
          'sub_question_id', '5a000000-0000-0000-0000-000000000003',
          'status', 'non_documentee', 'note', null, 'contradictory', false)
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
      'qualified', true, 'segment_ids', jsonb_build_array(
        '0a000000-0000-0000-0000-000000000001',
        '0a000000-0000-0000-0000-000000000004')
    ))),
    'restitution', restitution,
    'rules', jsonb_build_object('restitution', jsonb_build_object(
      'ai', jsonb_build_object('status', 'completed', 'calls', 1)))
  );
$$;

create function pg_temp.projections(how_many integer)
returns jsonb
language sql
as $$
  select jsonb_agg(jsonb_build_object(
    'persona', persona,
    'text', 'Act on relevance (' || persona || ').',
    'justification', 'the relevance criterion is weakly supported'
  ))
  from unnest((array['decideur', 'pmu', 'analyste'])[1:how_many]) as persona;
$$;

create function pg_temp.restitution(
  progress_segment text default '0a000000-0000-0000-0000-000000000004',
  projections integer default 3
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'synthesis', jsonb_build_object(
      'conclusion', '  The results suggest, subject to a richer corpus, a well documented budget.  ',
      'limits', jsonb_build_object('not_concluded', 0, 'criteria', 1,
        'confidence', 0.8, 'leads', false),
      'qualified', true
    ),
    'items', jsonb_build_array(
      jsonb_build_object(
        'id', '51000000-0000-0000-0000-000000000001',
        'section', 'progres', 'position', 1, 'text', 'Budget execution is documented.',
        'pillar_id', 'd0000000-0000-0000-0000-000000000001',
        'program_version_id', '90000000-0000-0000-0000-000000000001',
        'segment_ids', jsonb_build_array(progress_segment)),
      jsonb_build_object(
        'id', '51000000-0000-0000-0000-000000000002',
        'section', 'faiblesse', 'position', 1, 'text', 'Relevance is weakly supported.',
        'criterion_id', 'c1000000-0000-0000-0000-000000000001',
        'segment_ids', jsonb_build_array('0a000000-0000-0000-0000-000000000001')),
      jsonb_build_object(
        'id', '51000000-0000-0000-0000-000000000003',
        'section', 'a_verifier', 'position', 1, 'text', 'Check the relevance gap.',
        'alert_id', 'ac000000-0000-0000-0000-000000000001',
        'segment_ids', jsonb_build_array(
          '0a000000-0000-0000-0000-000000000001',
          '0a000000-0000-0000-0000-000000000004'))
    ),
    'actions', jsonb_build_array(jsonb_build_object(
      'id', '52000000-0000-0000-0000-000000000001',
      'position', 1, 'origin_type', 'alert',
      'alert_id', 'ac000000-0000-0000-0000-000000000001',
      'segment_ids', jsonb_build_array('0a000000-0000-0000-0000-000000000001'),
      'projections', pg_temp.projections(projections)
    ))
  );
$$;

select throws_ok(
  $$select public.complete_run(pg_temp.run_id(), pg_temp.lease(),
    pg_temp.results(pg_temp.restitution('0a000000-0000-0000-0000-000000000005')))$$,
  'P0001', 'RUN_RESULTS_INVALID',
  'GF-1 : une puce cite au moins une preuve du run'
);
select throws_ok(
  $$select public.complete_run(pg_temp.run_id(), pg_temp.lease(),
    pg_temp.results(pg_temp.restitution(projections => 2)))$$,
  'P0001', 'RUN_RESULTS_INVALID',
  'RG-11.4 : une action a ses trois projections persona'
);
select throws_ok(
  $$select public.complete_run(pg_temp.run_id(), pg_temp.lease(),
    pg_temp.results(jsonb_set(pg_temp.restitution(), '{items,0,criterion_id}',
      '"c1000000-0000-0000-0000-000000000001"')))$$,
  'P0001', 'RUN_RESULTS_INVALID',
  'un progrès porte sur un pilier et sa version seulement'
);

create temporary table written as
select public.complete_run(pg_temp.run_id(), pg_temp.lease(),
  pg_temp.results(pg_temp.restitution())) as summary;

select is(
  (select summary -> 'synthesis_items' from written) || (select summary -> 'actions' from written),
  '[3, 1]'::jsonb,
  'la restitution est écrite avec le run'
);
select results_eq(
  $$select conclusion, qualified, limits ->> 'leads'
    from public.syntheses where run_id = pg_temp.run_id()$$,
  $$values ('The results suggest, subject to a richer corpus, a well documented budget.'::text,
    true, 'false'::text)$$,
  'conclusion nettoyée, qualification et limites'
);
select results_eq(
  $$select item.section, evidence.segment_id
    from public.synthesis_item_evidences as link
    join public.synthesis_items as item on item.id = link.item_id
    join public.evidences as evidence on evidence.id = link.evidence_id
    order by item.section, evidence.segment_id$$,
  $$values
    ('a_verifier'::text, '0a000000-0000-0000-0000-000000000001'::uuid),
    ('a_verifier'::text, '0a000000-0000-0000-0000-000000000004'::uuid),
    ('faiblesse'::text, '0a000000-0000-0000-0000-000000000001'::uuid),
    ('progres'::text, '0a000000-0000-0000-0000-000000000004'::uuid)$$,
  'chaque puce cite les preuves de son pilier, de son critère ou de son alerte'
);
select results_eq(
  $$select projection.persona
    from public.run_action_projections as projection
    join public.run_actions as action on action.id = projection.action_id
    where action.run_id = pg_temp.run_id()
    order by projection.persona$$,
  $$values ('analyste'::text), ('decideur'::text), ('pmu'::text)$$,
  'une action, trois projections persona'
);
select is(
  (select count(*)::integer from public.run_action_evidences
   where action_id = '52000000-0000-0000-0000-000000000001'),
  1,
  'l''action cite une preuve de son alerte'
);
select is(
  (select metadata -> 'restitution_ai' ->> 'status' from public.audit_events
   where run_id = pg_temp.run_id() and operation = 'run_completed'),
  'completed',
  'GF-4 : l''usage de l''IA est journalisé'
);

-- ---------------------------------------------------------------------------
-- Immuabilité.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.synthesis_items set text = 'Autre constat.'
    where run_id = pg_temp.run_id()$$,
  'P0001', 'RUN_IMMUTABLE',
  'RG-11.3 : une puce publiée ne change pas'
);
select throws_ok(
  $$delete from public.run_action_projections$$,
  'P0001', 'RUN_IMMUTABLE',
  'les projections d''une action non plus'
);

-- ---------------------------------------------------------------------------
-- Droits.
-- ---------------------------------------------------------------------------
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select is(
  (select count(*)::integer from public.syntheses)
    + (select count(*)::integer from public.synthesis_items)
    + (select count(*)::integer from public.run_action_projections),
  0,
  'un non-membre ne voit rien'
);
reset role;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(
  (select count(*)::integer from public.run_action_projections),
  3,
  'un membre voit les trois projections'
);
select throws_ok(
  $$delete from public.syntheses$$,
  '42501', null,
  'pas d''écriture directe : la restitution passe par complete_run'
);
reset role;

select * from finish();
rollback;
