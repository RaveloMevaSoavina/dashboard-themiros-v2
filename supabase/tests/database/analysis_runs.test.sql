-- ---------------------------------------------------------------------------
-- Runs d'analyse (E6) : niveau de masse critique, lancement, file du worker,
-- immuabilité des runs terminés (RG-6.3, RG-10.2) et échec (RG-6.1).
--
-- Les résultats de la couche A sont écrits ici directement, à la place du
-- moteur. Lancement : `supabase test db`, sur une base locale où les
-- migrations de ce dépôt sont appliquées.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(51);

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

-- Couverture « prête » : n piliers et variables, chacun avec ses sources.
create function pg_temp.coverage(pillar_sources integer[], variable_sources integer[])
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'state', 'ready',
    'pillars', (select coalesce(jsonb_agg(jsonb_build_object('sources', s)), '[]')
                from unnest(pillar_sources) as s),
    'variables', (select coalesce(jsonb_agg(jsonb_build_object('sources', s)), '[]')
                  from unnest(variable_sources) as s)
  );
$$;

create function pg_temp.level(counted integer, coverage jsonb)
returns text
language sql
as $$
  select public.critical_mass_level(
    counted, coverage, public.current_critical_mass_settings(null)
  );
$$;

-- ---------------------------------------------------------------------------
-- Niveau atteint (même règle que assessCriticalMass côté front).
-- ---------------------------------------------------------------------------
select is(pg_temp.level(4, pg_temp.coverage('{2,2}', '{2,2}')), null,
  'sous le plancher Exploratoire, aucun niveau');
select is(pg_temp.level(5, pg_temp.coverage('{0,0}', '{0,0}')), 'exploratoire',
  'Exploratoire sur le seul plancher');
select is(pg_temp.level(10, pg_temp.coverage('{2,2}', '{0,0}')), 'standard',
  'Standard : plancher et tous les piliers à 2 sources');
select is(pg_temp.level(10, pg_temp.coverage('{2,1}', '{2,2}')), 'exploratoire',
  'un pilier à 1 source bloque Standard');
select is(pg_temp.level(20, pg_temp.coverage('{2,2}', '{2,2,2,2,1}')), 'defendable',
  'Défendable : 80 % des variables à 2 sources');
select is(pg_temp.level(20, pg_temp.coverage('{2,2}', '{2,2,2,1,1}')), 'standard',
  'sous 80 % des variables, le niveau reste Standard');
select is(pg_temp.level(25, '{"state": "pending"}'), 'exploratoire',
  'sans couverture calculée, le niveau s''arrête à Exploratoire');

-- ---------------------------------------------------------------------------
-- Espace : cadre en brouillon, approche confirmée, un critère obligatoire à
-- deux sous-questions, une seule version de programme.
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
values (
  'a0000000-0000-0000-0000-0000000000a1',
  'a0000000-0000-0000-0000-000000000001',
  'Programme de test', 'program'
);
insert into public.workspace_members (workspace_id, profile_id, role)
values ('a0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.program_versions (id, workspace_id, label, year, order_index)
values ('90000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1',
        'Revue mi-parcours 2025', 2025, 1);

insert into public.approaches (
  id, workspace_id, ref_framework_id, cycle, instrument_module,
  instrument_subtype, complexity_score, complexity_class, complexity_factors,
  recommended_methods, evaluation_nature, questionnaire_answers,
  justifications, created_by, status, confirmed_by, confirmed_at
)
select
  'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1',
  id, 'mi_parcours', 'M2', 'programme', 5, 'complique', '{}', '{}',
  'externe_independante', '{}', '{}', '11111111-1111-1111-1111-111111111111',
  'confirmed', '11111111-1111-1111-1111-111111111111', now()
from public.ref_frameworks
order by code
limit 1;

insert into public.frameworks (id, workspace_id, approach_id)
values ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1',
        'b0000000-0000-0000-0000-000000000001');
insert into public.pillars (id, framework_id, name, description, weight, order_index)
values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
        'Budget et absorption', 'Exécution budgétaire du programme.', 100, 1);
insert into public.pillar_variables (pillar_id, code, label, weight, order_index)
values ('d0000000-0000-0000-0000-000000000001', 'has_budget_execution',
        'Taux d''exécution budgétaire', 1, 1);
insert into public.criteria (id, framework_id, code, name, definition, applicability)
values ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
        'efficacite', 'Efficacité', 'Atteinte des résultats.', 'obligatoire');
insert into public.sub_questions (criterion_id, text, order_index)
select 'c1000000-0000-0000-0000-000000000001', 'Question ' || i, i
from generate_series(1, 2) as i;

-- Cinq documents : quatre conformes et indexés, le cinquième à vérifier.
insert into public.documents (
  id, workspace_id, original_filename, storage_path, file_hash,
  file_size_bytes, mime_type
)
select
  ('f0000000-0000-0000-0000-00000000000' || i)::uuid,
  'a0000000-0000-0000-0000-0000000000a1', 'doc-' || i || '.pdf',
  'test/doc-' || i || '.pdf', md5('doc-' || i), 1000, 'application/pdf'
from generate_series(1, 5) as i;
update public.documents set status = 'conforme', indexed_at = now()
where workspace_id = 'a0000000-0000-0000-0000-0000000000a1'
  and id <> 'f0000000-0000-0000-0000-000000000005';
insert into public.segments (id, document_id, workspace_id, text, published)
values ('0a000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-0000000000a1', 'Budget exécuté à 80 %.', true);

-- ---------------------------------------------------------------------------
-- Lancement : conditions bloquantes (US-12.2).
-- ---------------------------------------------------------------------------
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select throws_ok(
  $$select public.create_run('a0000000-0000-0000-0000-0000000000a1')$$,
  '42501', 'WORKSPACE_MEMBER_REQUIRED',
  'seul un membre de l''espace lance une analyse'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$select public.create_run('a0000000-0000-0000-0000-0000000000a1')$$,
  'P0001', 'FRAMEWORK_NOT_VALIDATED',
  'un cadre en brouillon bloque le lancement'
);

update public.frameworks
set status = 'validated', validated_by = '11111111-1111-1111-1111-111111111111',
    validated_at = now()
where id = 'c0000000-0000-0000-0000-000000000001';

select throws_ok(
  $$select public.create_run('a0000000-0000-0000-0000-0000000000a1')$$,
  'P0001', 'CRITERIA_NOT_CONFIRMED',
  'RG-3b.2 : un critère obligatoire à moins de 3 sous-questions actives bloque le lancement'
);

insert into public.sub_questions (criterion_id, text, order_index)
values ('c1000000-0000-0000-0000-000000000001', 'Question 3', 3);

select throws_ok(
  $$select public.create_run('a0000000-0000-0000-0000-0000000000a1')$$,
  'P0001', 'INSUFFICIENT_CORPUS',
  'RG-5.2 : sous 5 documents conformes, aucun calcul n''est lancé'
);

update public.documents set status = 'conforme'
where id = 'f0000000-0000-0000-0000-000000000005';

select throws_ok(
  $$select public.create_run('a0000000-0000-0000-0000-0000000000a1')$$,
  'P0001', 'CORPUS_NOT_READY',
  'un document du corpus encore en indexation bloque le lancement'
);

update public.documents set indexed_at = now()
where id = 'f0000000-0000-0000-0000-000000000005';

-- ---------------------------------------------------------------------------
-- Lancement accepté.
-- ---------------------------------------------------------------------------
create temporary table launched as
select public.create_run('a0000000-0000-0000-0000-0000000000a1') as result;

select is(
  (select result - 'run_id' - 'created_at' from launched),
  '{"status": "pending", "corpus_size": 5, "corpus_seuil": "exploratoire"}'::jsonb,
  'le run est créé en file avec la taille et le niveau du corpus'
);
select results_eq(
  $$select step_name, status from public.run_steps
    where run_id = (select (result ->> 'run_id')::uuid from launched)
    order by position$$,
  $$values ('classification', 'pending'), ('variables', 'pending'),
           ('layer_a', 'pending'), ('layer_b', 'pending'),
           ('layer_c', 'pending'), ('restitution', 'pending')$$,
  'US-13.1 : les étapes nommées sont créées dans l''ordre du pipeline'
);
select is(
  (select count(*)::integer from public.run_documents
   where run_id = (select (result ->> 'run_id')::uuid from launched)
     and program_version_id = '90000000-0000-0000-0000-000000000001'),
  5,
  'le corpus est figé ; un document sans version rejoint la version unique'
);
select is(
  (select rules_applied -> 'critical_mass_settings' ->> 'exploratory_min_documents'
   from public.runs where id = (select (result ->> 'run_id')::uuid from launched)),
  '5',
  'GF-4 : les paramètres appliqués sont enregistrés avec le run'
);
select results_eq(
  $$select actor_user_id, after_value ->> 'corpus_seuil' from public.audit_events
    where operation = 'run_created'
      and run_id = (select (result ->> 'run_id')::uuid from launched)$$,
  $$values ('11111111-1111-1111-1111-111111111111'::uuid, 'exploratoire')$$,
  'le lancement est journalisé'
);
select throws_ok(
  $$select public.create_run('a0000000-0000-0000-0000-0000000000a1')$$,
  'P0001', 'RUN_ALREADY_ACTIVE',
  'un seul run en file ou en cours par espace'
);

-- ---------------------------------------------------------------------------
-- Droits.
-- ---------------------------------------------------------------------------
set local role authenticated;
select is(
  (select count(*)::integer from public.runs),
  1,
  'un membre lit les runs de son espace'
);
select throws_ok(
  $$update public.runs set corpus_seuil = 'defendable'$$,
  '42501', null,
  'un membre ne modifie pas un run'
);
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select is(
  (select count(*)::integer from public.run_steps),
  0,
  'un non-membre ne voit rien'
);
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$select public.claim_run('worker-1', 'test-engine')$$,
  '42501', null,
  'la file est réservée au worker'
);
reset role;

-- ---------------------------------------------------------------------------
-- File du worker.
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
create temporary table claimed as
select public.claim_run('worker-1', 'engine-0.1.0') as job;

select results_eq(
  $$select status, engine_version, attempts, locked_by from public.runs
    where id = (select (job ->> 'run_id')::uuid from claimed)$$,
  $$values ('running', 'engine-0.1.0', 1, 'worker-1')$$,
  'le worker prend le run et y inscrit la version du moteur'
);
select is(
  public.claim_run('worker-2', 'engine-0.1.0'),
  null,
  'un run pris n''est pas repris tant que le bail court'
);
select throws_ok(
  $$select public.update_run_step(
      (select (job ->> 'run_id')::uuid from claimed), gen_random_uuid(),
      'classification', 'running')$$,
  'P0001', 'RUN_LEASE_LOST',
  'un worker sans le bail n''écrit rien'
);
select lives_ok(
  $$select public.update_run_step(
      (select (job ->> 'run_id')::uuid from claimed),
      (select (job ->> 'lease_token')::uuid from claimed),
      'classification', 'completed', '{"segments": 1}')$$,
  'le worker fait avancer une étape'
);
select results_eq(
  $$select status, output_summary ->> 'segments' from public.run_steps
    where run_id = (select (job ->> 'run_id')::uuid from claimed)
      and step_name = 'classification'$$,
  $$values ('completed', '1')$$,
  'l''étape porte son statut et son résumé'
);

-- Résultats écrits à la place du moteur, puis run terminé.
insert into public.intermediate_variables (
  id, run_id, workspace_id, pillar_id, variable_code, program_version_id,
  value, state, documents_count, corpus_confidence
)
select
  'aa000000-0000-0000-0000-000000000001', (job ->> 'run_id')::uuid,
  'a0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000001',
  'has_budget_execution', '90000000-0000-0000-0000-000000000001', 1, 'present',
  1, 0.3333
from claimed;
insert into public.evidences (
  id, run_id, workspace_id, document_id, segment_id, page_number, excerpt,
  pillar_id, variable_code, similarity
)
select
  'ee000000-0000-0000-0000-000000000001', (job ->> 'run_id')::uuid,
  'a0000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-000000000001',
  '0a000000-0000-0000-0000-000000000001', 3, 'Budget exécuté à 80 %.',
  'd0000000-0000-0000-0000-000000000001', 'has_budget_execution', 0.9
from claimed;
insert into public.variable_evidences (variable_id, evidence_id)
values ('aa000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000001');

select throws_ok(
  $$insert into public.intermediate_variables (
      run_id, workspace_id, pillar_id, variable_code, program_version_id,
      value, state)
    select (job ->> 'run_id')::uuid, 'a0000000-0000-0000-0000-0000000000a1',
      'd0000000-0000-0000-0000-000000000001', 'other',
      '90000000-0000-0000-0000-000000000001', 0.5, 'present'
    from claimed$$,
  '23514', null,
  'la valeur d''une variable suit son état (1, 0,5, 0 ou non renseignée)'
);
select lives_ok(
  $$insert into public.layer_a_scores (
      run_id, workspace_id, pillar_id, program_version_id, score,
      corpus_confidence, documents_count)
    select (job ->> 'run_id')::uuid, 'a0000000-0000-0000-0000-0000000000a1',
      'd0000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000001', null, 0, 0
    from claimed$$,
  'un pilier sans variable renseignée a un score null'
);

update public.runs set status = 'completed', completed_at = now(),
  lease_token = null, locked_by = null, locked_until = null
where id = (select (job ->> 'run_id')::uuid from claimed);

-- ---------------------------------------------------------------------------
-- Immuabilité (RG-6.3, RG-10.2).
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.layer_a_scores set score = 80$$,
  'P0001', 'RUN_IMMUTABLE',
  'RG-10.2 : un score n''est jamais modifié'
);
select throws_ok(
  $$insert into public.evidences (run_id, workspace_id, excerpt)
    select (job ->> 'run_id')::uuid, 'a0000000-0000-0000-0000-0000000000a1', 'Ajout'
    from claimed$$,
  'P0001', 'RUN_IMMUTABLE',
  'aucune preuve n''est ajoutée à un run terminé'
);
select throws_ok(
  $$delete from public.variable_evidences$$,
  'P0001', 'RUN_IMMUTABLE',
  'aucun lien variable-preuve n''est retiré d''un run terminé'
);
select throws_ok(
  $$update public.runs set corpus_seuil = 'defendable'$$,
  'P0001', 'RUN_IMMUTABLE',
  'RG-6.3 : un run terminé est immuable'
);
select throws_ok(
  $$delete from public.runs$$,
  'P0001', 'RUN_IMMUTABLE',
  'un run terminé n''est pas supprimé'
);
select lives_ok(
  $$update public.runs set validated_by = '11111111-1111-1111-1111-111111111111',
      validated_at = now()$$,
  'la validation humaine reste possible'
);

-- ---------------------------------------------------------------------------
-- Corpus modifié et document supprimé (CA-6.2).
-- ---------------------------------------------------------------------------
select is(
  public.run_corpus_changed((select (job ->> 'run_id')::uuid from claimed)),
  false,
  'corpus inchangé : pas de bandeau'
);
select lives_ok(
  $$delete from public.documents where id = 'f0000000-0000-0000-0000-000000000001'$$,
  'un document cité par un run terminé peut être supprimé'
);
select results_eq(
  $$select document_id, segment_id, excerpt from public.evidences
    where id = 'ee000000-0000-0000-0000-000000000001'$$,
  $$values (null::uuid, null::uuid, 'Budget exécuté à 80 %.')$$,
  'la preuve garde son extrait sans son document'
);
select is(
  (select count(*)::integer from public.run_documents
   where document_id is null and original_filename = 'doc-1.pdf'),
  1,
  'le run garde le nom du document supprimé'
);
select is(
  public.run_corpus_changed((select (job ->> 'run_id')::uuid from claimed)),
  true,
  'CA-6.2 : un document retiré depuis le calcul affiche le bandeau'
);

-- ---------------------------------------------------------------------------
-- Échec (RG-6.1) : le run échoue sans rien publier. Un sixième document
-- remplace celui qui a été supprimé.
-- ---------------------------------------------------------------------------
insert into public.documents (
  id, workspace_id, original_filename, storage_path, file_hash,
  file_size_bytes, mime_type
)
values ('f0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-0000000000a1',
        'doc-6.pdf', 'test/doc-6.pdf', md5('doc-6'), 1000, 'application/pdf');
update public.documents set status = 'conforme', indexed_at = now()
where id = 'f0000000-0000-0000-0000-000000000006';

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temporary table second_run as
select (public.create_run('a0000000-0000-0000-0000-0000000000a1') ->> 'run_id')::uuid as id;
select pg_temp.as_service();
create temporary table second_job as
select public.claim_run('worker-1', 'engine-0.1.0') as job;

select is(
  (select (job ->> 'run_id')::uuid from second_job),
  (select id from second_run),
  'un nouveau run est lancé après le premier'
);

select public.update_run_step(
  (select id from second_run), (select (job ->> 'lease_token')::uuid from second_job),
  'classification', 'completed'
);
insert into public.intermediate_variables (
  run_id, workspace_id, pillar_id, variable_code, program_version_id, state
)
select id, 'a0000000-0000-0000-0000-0000000000a1',
  'd0000000-0000-0000-0000-000000000001', 'has_budget_execution',
  '90000000-0000-0000-0000-000000000001', 'non_renseigne'
from second_run;

select public.fail_run(
  (select id from second_run), (select (job ->> 'lease_token')::uuid from second_job),
  'variables', 'SCORING_ERROR', 'Variable inconnue'
);

select results_eq(
  $$select status, error_code from public.runs where id = (select id from second_run)$$,
  $$values ('failed', 'SCORING_ERROR')$$,
  'le run passe en échec avec son code d''erreur'
);
select results_eq(
  $$select step_name, status from public.run_steps
    where run_id = (select id from second_run) order by position$$,
  $$values ('classification', 'completed'), ('variables', 'failed'),
           ('layer_a', 'skipped'), ('layer_b', 'skipped'),
           ('layer_c', 'skipped'), ('restitution', 'skipped')$$,
  'l''étape en échec est signalée, les suivantes ne sont pas atteintes'
);
select is_empty(
  $$select 1 from public.intermediate_variables where run_id = (select id from second_run)$$,
  'RG-6.1 : les résultats partiels d''un run échoué sont retirés'
);
select is(
  (select count(*)::integer from public.layer_a_scores),
  1,
  'RG-6.1 : les résultats du run précédent restent intacts'
);
select is(
  (select metadata ->> 'step' from public.audit_events
   where operation = 'run_failed' and run_id = (select id from second_run)),
  'variables',
  'l''échec est journalisé avec son étape'
);

-- ---------------------------------------------------------------------------
-- Bail perdu : nouvel essai depuis zéro, puis échec après 3 tentatives.
-- ---------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
create temporary table third_run as
select (public.create_run('a0000000-0000-0000-0000-0000000000a1') ->> 'run_id')::uuid as id;
select pg_temp.as_service();
select public.claim_run('worker-1', 'engine-0.1.0');
insert into public.intermediate_variables (
  run_id, workspace_id, pillar_id, variable_code, program_version_id, state
)
select id, 'a0000000-0000-0000-0000-0000000000a1',
  'd0000000-0000-0000-0000-000000000001', 'has_budget_execution',
  '90000000-0000-0000-0000-000000000001', 'non_renseigne'
from third_run;
update public.runs set locked_until = now() - interval '1 minute'
where id = (select id from third_run);

select is(
  (public.claim_run('worker-2', 'engine-0.1.1') ->> 'attempts')::integer,
  2,
  'un run dont le bail a expiré est repris par un autre worker'
);
select is_empty(
  $$select 1 from public.intermediate_variables where run_id = (select id from third_run)$$,
  'la reprise repart de zéro'
);

update public.runs set attempts = 3, locked_until = now() - interval '1 minute'
where id = (select id from third_run);

select is(
  public.claim_run('worker-2', 'engine-0.1.1'),
  null,
  'après 3 bails perdus, le run n''est plus repris'
);
select results_eq(
  $$select status, error_code from public.runs where id = (select id from third_run)$$,
  $$values ('failed', 'RUN_LEASE_EXPIRED')$$,
  'il passe en échec'
);

-- ---------------------------------------------------------------------------
-- Suppression de l'espace : ses runs terminés partent avec lui.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$delete from public.workspaces where id = 'a0000000-0000-0000-0000-0000000000a1'$$,
  'supprimer l''espace supprime ses runs terminés'
);

select * from finish();
rollback;
