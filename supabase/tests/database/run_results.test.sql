-- ---------------------------------------------------------------------------
-- Moteur de la couche A, côté base : entrées figées d'un run (run_inputs),
-- attente de la classification (defer_run) et écriture des résultats
-- (complete_run). Le calcul lui-même est testé dans l'API
-- (tests/test_runs_domain.py) ; les résultats sont écrits ici à la main.
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

-- ---------------------------------------------------------------------------
-- Espace prêt au lancement, cadre validé dont les sondes ne sont pas encore
-- vectorisées. Cinq documents indexés, un segment Budget chacun.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role)
values ('11111111-1111-1111-1111-111111111111', 'admin@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id) values ('11111111-1111-1111-1111-111111111111')
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
insert into public.frameworks (
  id, workspace_id, approach_id, status, validated_by, validated_at
)
values ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1',
        'b0000000-0000-0000-0000-000000000001', 'validated',
        '11111111-1111-1111-1111-111111111111', now());
insert into public.pillars (id, framework_id, name, description, weight, order_index)
values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
        'Budget et absorption', 'Exécution budgétaire du programme.', 100, 1);
insert into public.pillar_variables (id, pillar_id, code, label, weight, order_index)
values ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
        'has_budget_execution', 'Taux d''exécution budgétaire', 2, 1);

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
  'a0000000-0000-0000-0000-0000000000a1', 'Budget exécuté à 8' || i || ' %.', i,
  'Exécution financière', true
from generate_series(1, 5) as i;
insert into public.segment_embeddings (segment_id, workspace_id, embedding, model)
select id, workspace_id, pg_temp.axis(1), 'test-model'
from public.segments
where workspace_id = 'a0000000-0000-0000-0000-0000000000a1';
update public.documents set status = 'conforme', indexed_at = now()
where workspace_id = 'a0000000-0000-0000-0000-0000000000a1';

select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
create temporary table launched as
select (public.create_run('a0000000-0000-0000-0000-0000000000a1') ->> 'run_id')::uuid as id;

select set_config('request.jwt.claims', '{"role": "service_role"}', true);
create temporary table job as
select public.claim_run('worker-1', 'layer-a/1.0.0') as claim;

create function pg_temp.lease()
returns uuid
language sql
as $$ select (claim ->> 'lease_token')::uuid from job $$;

-- ---------------------------------------------------------------------------
-- Classification pas encore prête : le run attend.
-- ---------------------------------------------------------------------------
select is(
  public.run_inputs((select id from launched), pg_temp.lease()) ->> 'state',
  'pending',
  'sans sondes vectorisées, la classification n''est pas prête'
);
select throws_ok(
  $$select public.run_inputs((select id from launched), gen_random_uuid())$$,
  'P0001', 'RUN_LEASE_LOST',
  'les entrées sont réservées au détenteur du bail'
);

select public.defer_run((select id from launched), pg_temp.lease(), 30, 'classification_pending');

select results_eq(
  $$select status, attempts, lease_token is null, locked_until > now()
    from public.runs where id = (select id from launched)$$,
  $$values ('pending', 0, true, true)$$,
  'le run repart en file, différé, sans tentative comptée'
);
select is(
  (select output_summary ->> 'waiting' from public.run_steps
   where run_id = (select id from launched) and step_name = 'classification'),
  'classification_pending',
  'l''écran de suivi sait pourquoi le run attend'
);
select is(
  public.claim_run('worker-1', 'layer-a/1.0.0'),
  null,
  'un run différé n''est pas repris avant son délai'
);

-- Le worker de classification vectorise les sondes et classe le corpus.
insert into public.pillar_probe_embeddings (
  framework_id, workspace_id, pillar_id, pillar_variable_id, source_hash,
  embedding, model
)
select
  'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1',
  probe.pillar_id, probe.pillar_variable_id, probe.source_hash, pg_temp.axis(1),
  'test-model'
from public.framework_probe_texts('c0000000-0000-0000-0000-000000000001') as probe;
select public.classify_workspace_segments('a0000000-0000-0000-0000-0000000000a1');

update public.runs set locked_until = now() - interval '1 second'
where id = (select id from launched);
delete from job;
insert into job select public.claim_run('worker-1', 'layer-a/1.0.0');

select is(
  (select (claim ->> 'attempts')::integer from job),
  1,
  'le délai écoulé, le run est repris'
);

-- ---------------------------------------------------------------------------
-- Entrées figées.
-- ---------------------------------------------------------------------------
create temporary table inputs as
select public.run_inputs((select id from launched), pg_temp.lease()) as data;

select is((select data ->> 'state' from inputs), 'ready',
  'une fois le corpus classé, le run est calculable');
select is(
  (select jsonb_array_length(data -> 'documents') from inputs), 5,
  'les entrées portent le corpus figé'
);
select is(
  (select (data -> 'pillars' -> 0 -> 'variables' -> 0 ->> 'weight')::numeric from inputs),
  2::numeric,
  'et le poids de chaque variable'
);
select is(
  (select jsonb_array_length(data -> 'matches') from inputs), 5,
  'une détection par document pour la variable Budget'
);
select is(
  (select data -> 'segments' from inputs),
  '{"published": 5, "classified": 5, "low_confidence": 0}'::jsonb,
  'avec le bilan de la classification'
);

-- ---------------------------------------------------------------------------
-- Écriture des résultats.
-- ---------------------------------------------------------------------------
select throws_ok(
  format(
    $$select public.complete_run(%L, %L, '{"scores": [{"pillar_id": "%s",
      "program_version_id": "90000000-0000-0000-0000-000000000001",
      "score": 50, "corpus_confidence": 0.5, "documents_count": 1}]}')$$,
    (select id from launched), pg_temp.lease(), gen_random_uuid()
  ),
  'P0001', 'RUN_RESULTS_INVALID',
  'un pilier hors du cadre du run est refusé'
);
select throws_ok(
  format(
    $$select public.complete_run(%L, %L, '{"variables": [{"id": "%s",
      "pillar_id": "d0000000-0000-0000-0000-000000000001",
      "variable_code": "has_budget_execution",
      "program_version_id": "90000000-0000-0000-0000-000000000001",
      "value": 0.5, "state": "present"}]}')$$,
    (select id from launched), pg_temp.lease(), gen_random_uuid()
  ),
  'P0001', 'RUN_RESULTS_INVALID',
  'une valeur incohérente avec son état est refusée'
);

select is(
  public.complete_run(
    (select id from launched), pg_temp.lease(),
    '{
      "variables": [{
        "id": "aa000000-0000-0000-0000-000000000001",
        "pillar_id": "d0000000-0000-0000-0000-000000000001",
        "variable_code": "has_budget_execution",
        "program_version_id": "90000000-0000-0000-0000-000000000001",
        "value": 1, "state": "present", "documents_count": 5,
        "corpus_confidence": 0.8683
      }],
      "evidences": [
        {"variable_id": "aa000000-0000-0000-0000-000000000001",
         "segment_id": "0a000000-0000-0000-0000-000000000001", "similarity": 1},
        {"variable_id": "aa000000-0000-0000-0000-000000000001",
         "segment_id": "0a000000-0000-0000-0000-000000000002", "similarity": 0.98765},
        {"variable_id": "aa000000-0000-0000-0000-000000000001",
         "segment_id": "00000000-0000-0000-0000-000000000000", "similarity": 0.9}
      ],
      "scores": [{
        "pillar_id": "d0000000-0000-0000-0000-000000000001",
        "program_version_id": "90000000-0000-0000-0000-000000000001",
        "score": 100, "delta": null, "evolution_label": null,
        "corpus_confidence": 0.8683, "documents_count": 5
      }],
      "rules": {"engine_version": "layer-a/1.0.0", "strong_similarity": 0.55},
      "summary": {"scores_without_value": 0}
    }'
  ),
  '{"scores": 1, "evidences": 2, "variables": 1}'::jsonb,
  'les résultats sont écrits ; une preuve sur un segment inconnu est ignorée'
);

select results_eq(
  $$select document_id, page_number, section_title, excerpt, variable_code, similarity
    from public.evidences where run_id = (select id from launched)
    order by page_number$$,
  $$values
    ('f0000000-0000-0000-0000-000000000001'::uuid, 1, 'Exécution financière',
     'Budget exécuté à 81 %.', 'has_budget_execution', 1.0000::numeric(5, 4)),
    ('f0000000-0000-0000-0000-000000000002'::uuid, 2, 'Exécution financière',
     'Budget exécuté à 82 %.', 'has_budget_execution', 0.9877::numeric(5, 4))$$,
  'la preuve reprend l''extrait, la page et la section du segment'
);
select is(
  (select count(*)::integer from public.variable_evidences
   where variable_id = 'aa000000-0000-0000-0000-000000000001'),
  2,
  'RG-1 : la variable est adossée à ses preuves'
);
select results_eq(
  $$select status, rules_applied -> 'engine' ->> 'strong_similarity',
           rules_applied -> 'critical_mass_settings' is not null
    from public.runs where id = (select id from launched)$$,
  $$values ('completed', '0.55', true)$$,
  'GF-4 : le run est terminé avec les règles du moteur'
);
select results_eq(
  $$select step_name, status from public.run_steps
    where run_id = (select id from launched) order by position$$,
  $$values ('classification', 'skipped'), ('variables', 'skipped'),
           ('layer_a', 'skipped'), ('layer_b', 'skipped'),
           ('layer_c', 'skipped'), ('restitution', 'completed')$$,
  'les étapes que le worker n''a pas signalées sont closes'
);
select is(
  (select output_summary from public.run_steps
   where run_id = (select id from launched) and step_name = 'restitution'),
  '{"scores": 1, "evidences": 2, "variables": 1, "scores_without_value": 0}'::jsonb,
  'la restitution résume ce qui a été publié'
);
select is(
  (select metadata ->> 'evidences' from public.audit_events
   where operation = 'run_completed' and run_id = (select id from launched)),
  '2',
  'la fin du run est journalisée'
);
select throws_ok(
  $$select public.complete_run((select id from launched), pg_temp.lease(), '{}')$$,
  'P0001', 'RUN_LEASE_LOST',
  'un run terminé ne reçoit plus de résultats'
);

select * from finish();
rollback;
