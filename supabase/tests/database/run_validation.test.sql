-- ---------------------------------------------------------------------------
-- Validation humaine finale d'un run (GF-6) : conditions (validate_run),
-- mention « validé par [nom] le [date] », journalisation, écriture unique et
-- droits.
--
-- Lancement : `supabase test db`, sur une base locale où les migrations de ce
-- dépôt sont appliquées.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

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
-- Espace : cadre validé, un pilier, un critère obligatoire à trois
-- sous-questions ; cinq documents au corpus, un sixième hors corpus.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'admin@test.local', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'outsider@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333')
on conflict (id) do nothing;
update public.profiles set full_name = ' Amina Diallo '
where id = '11111111-1111-1111-1111-111111111111';
insert into public.organizations (id, name)
values ('a0000000-0000-0000-0000-000000000001', 'Organisation de test');
insert into public.workspaces (id, organization_id, name, kind)
values ('a0000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001',
        'Programme de test', 'program');
insert into public.workspace_members (workspace_id, profile_id, role)
values ('a0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'admin');

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
  'confirmed', '11111111-1111-1111-1111-111111111111', now(), 'fr'
from public.ref_frameworks
order by code
limit 1;
insert into public.frameworks (id, workspace_id, approach_id)
values ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1',
        'b0000000-0000-0000-0000-000000000001');
insert into public.pillars (id, framework_id, name, description, weight, order_index)
values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
        'Budget et absorption', 'Exécution budgétaire du programme.', 100, 1);
insert into public.criteria (id, framework_id, code, name, definition, applicability, weight)
values ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
        'pertinence', 'Pertinence', 'Adéquation aux besoins.', 'obligatoire', 100);
insert into public.sub_questions (
  id, criterion_id, text, layer, status, inactive_reason, order_index, origin
)
select
  ('5a000000-0000-0000-0000-00000000000' || i)::uuid,
  'c1000000-0000-0000-0000-000000000001', 'Question ' || i || ' ?', 'B',
  'active', null, i, 'referential'
from generate_series(1, 3) as i;
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
update public.documents set status = 'conforme', indexed_at = now()
where workspace_id = 'a0000000-0000-0000-0000-0000000000a1'
  and id <> 'f0000000-0000-0000-0000-000000000006';

-- Lance un run, puis le termine sans résultat à la place du moteur.
create function pg_temp.launch()
returns uuid
language sql
as $$
  select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
  select (public.create_run('a0000000-0000-0000-0000-0000000000a1') ->> 'run_id')::uuid;
$$;

create function pg_temp.complete()
returns void
language plpgsql
as $$
declare
  claim jsonb;
begin
  perform pg_temp.as_service();
  claim := public.claim_run('worker-1', 'layer-a/1.0.0');
  perform public.complete_run(
    (claim ->> 'run_id')::uuid, (claim ->> 'lease_token')::uuid, '{}'::jsonb
  );
end;
$$;

create temporary table launched (position integer, id uuid);
grant select on launched to authenticated;
insert into launched select 1, pg_temp.launch();

-- ---------------------------------------------------------------------------
-- Conditions.
-- ---------------------------------------------------------------------------
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select throws_ok(
  $$select public.validate_run((select id from launched where position = 1))$$,
  'P0001', 'RUN_NOT_FOUND',
  'un non-membre ne valide rien'
);
reset role;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(
  $$select public.validate_run((select id from launched where position = 1))$$,
  'P0001', 'RUN_NOT_COMPLETED',
  'un run en file ne se valide pas'
);
reset role;

select pg_temp.complete();

-- Second run, lancé après le premier (même transaction : même now()).
insert into launched select 2, pg_temp.launch();
update public.runs set created_at = created_at + interval '1 minute'
where id = (select id from launched where position = 2);
select pg_temp.complete();

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(
  $$select public.validate_run((select id from launched where position = 1))$$,
  'P0001', 'RUN_SUPERSEDED',
  'seul le dernier run terminé, celui affiché, se valide'
);
reset role;

update public.documents set status = 'conforme', indexed_at = now()
where id = 'f0000000-0000-0000-0000-000000000006';
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(
  $$select public.validate_run((select id from launched where position = 2))$$,
  'P0001', 'RUN_CORPUS_CHANGED',
  'CA-6.2 : un run calculé sur un autre corpus ne se valide pas'
);
reset role;
update public.documents set status = 'non_classe'
where id = 'f0000000-0000-0000-0000-000000000006';

-- ---------------------------------------------------------------------------
-- Validation.
-- ---------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(
  $$update public.runs set validated_at = now()$$,
  '42501', null,
  'pas d''écriture directe : la validation passe par validate_run'
);
select is(
  public.validate_run((select id from launched where position = 2)) ->> 'validated_by_name',
  'Amina Diallo',
  'GF-6 : le run est validé par un membre, nommé'
);
select throws_ok(
  $$select public.validate_run((select id from launched where position = 2))$$,
  'P0001', 'RUN_ALREADY_VALIDATED',
  'une validation est définitive'
);
reset role;

select results_eq(
  $$select validated_by, validated_by_name, validated_at is not null
    from public.runs where id = (select id from launched where position = 2)$$,
  $$values ('11111111-1111-1111-1111-111111111111'::uuid, 'Amina Diallo'::text, true)$$,
  'auteur, nom et date sont écrits sur le run'
);
select results_eq(
  $$select actor_type, actor_user_id, after_value ->> 'validated_by_name',
      (metadata ->> 'pending_alerts')::integer
    from public.audit_events
    where operation = 'run_validated'
      and run_id = (select id from launched where position = 2)$$,
  $$values ('human'::text, '11111111-1111-1111-1111-111111111111'::uuid,
    'Amina Diallo'::text, 0)$$,
  'GF-4 : la validation est journalisée'
);

-- ---------------------------------------------------------------------------
-- Écriture unique.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.runs set validated_at = null
    where id = (select id from launched where position = 2)$$,
  'P0001', 'RUN_IMMUTABLE',
  'une validation ne s''annule pas'
);
select throws_ok(
  $$update public.runs set validated_at = now() + interval '1 day'
    where id = (select id from launched where position = 2)$$,
  'P0001', 'RUN_IMMUTABLE',
  'sa date ne change pas'
);
select throws_ok(
  $$update public.runs set validated_by_name = 'Autre nom'
    where id = (select id from launched where position = 2)$$,
  'P0001', 'RUN_IMMUTABLE',
  'le nom du validateur non plus'
);
select throws_ok(
  $$update public.runs set validated_by = '33333333-3333-3333-3333-333333333333'
    where id = (select id from launched where position = 2)$$,
  'P0001', 'RUN_IMMUTABLE',
  'ni son auteur'
);
select lives_ok(
  $$update public.runs set validated_by = null
    where id = (select id from launched where position = 2)$$,
  'l''auteur passe à null à la suppression de son compte'
);
select is(
  (select validated_by_name from public.runs
   where id = (select id from launched where position = 2)),
  'Amina Diallo',
  'la mention garde son nom'
);

insert into launched select 3, pg_temp.launch();
select throws_ok(
  $$update public.runs set validated_at = now()
    where id = (select id from launched where position = 3)$$,
  '23514', null,
  'seul un run terminé porte une validation'
);

select * from finish();
rollback;
