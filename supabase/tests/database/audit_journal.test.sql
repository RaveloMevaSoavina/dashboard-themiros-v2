-- ---------------------------------------------------------------------------
-- Journal d'audit (E13, écran 21) : lecture filtrable (list_audit_events),
-- acteurs nommés, échecs, pagination, ajout seul (RG-13.1) et droits.
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

-- Quatre événements, du plus ancien au plus récent.
insert into public.audit_events (
  id, workspace_id, run_id, actor_type, actor_user_id, operation, object_type,
  object_id, before_value, after_value, created_at
) values
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1',
   null, 'human', '11111111-1111-1111-1111-111111111111', 'document_uploaded',
   'document', gen_random_uuid(), null, null, '2026-10-01 09:00+00'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-0000000000a1',
   null, 'engine', null, 'document_ingestion_failed', 'document',
   gen_random_uuid(), null, null, '2026-10-02 09:00+00'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-0000000000a1',
   'f1000000-0000-0000-0000-000000000001', 'engine', null,
   'run_completed', 'run', null, null, null, '2026-10-03 09:00+00'),
  ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-0000000000a1',
   null, 'human', '11111111-1111-1111-1111-111111111111', 'alert_instructed',
   'layer_c_alert', gen_random_uuid(), '{"status": "a_instruire"}',
   '{"status": "instruite"}', '2026-10-04 09:00+00');

-- ---------------------------------------------------------------------------
-- Lecture.
-- ---------------------------------------------------------------------------
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select throws_ok(
  $$select * from public.list_audit_events('a0000000-0000-0000-0000-0000000000a1')$$,
  'P0001', 'WORKSPACE_NOT_FOUND',
  'un non-membre ne lit pas le journal'
);
reset role;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(
  (select count(*)::integer from public.list_audit_events('a0000000-0000-0000-0000-0000000000a1')),
  4, 'US-21.1 : le membre lit tout le journal de son espace'
);
select is(
  (select operation from public.list_audit_events('a0000000-0000-0000-0000-0000000000a1') limit 1),
  'alert_instructed', 'US-21.1 : du plus récent au plus ancien'
);
select is(
  (select actor_name from public.list_audit_events('a0000000-0000-0000-0000-0000000000a1') limit 1),
  'Amina Diallo', 'US-21.2 : l''acteur humain est nommé'
);
select is(
  (select after_value ->> 'status'
   from public.list_audit_events('a0000000-0000-0000-0000-0000000000a1') limit 1),
  'instruite', 'US-21.2 : les valeurs avant/après sont restituées'
);
select is(
  (select count(*)::integer
   from public.list_audit_events('a0000000-0000-0000-0000-0000000000a1', p_category => 'corpus')),
  2, 'filtre type : le corpus regroupe les opérations documentaires'
);
select is(
  (select count(*)::integer
   from public.list_audit_events('a0000000-0000-0000-0000-0000000000a1', p_actor => 'engine')),
  2, 'filtre acteur : le moteur'
);
select is(
  (select array_agg(operation)
   from public.list_audit_events('a0000000-0000-0000-0000-0000000000a1', p_failures_only => true)),
  array['document_ingestion_failed'], 'US-21.4 : les échecs se filtrent'
);
select is(
  (select count(*)::integer
   from public.list_audit_events('a0000000-0000-0000-0000-0000000000a1',
     p_from => '2026-10-02 00:00+00', p_to => '2026-10-04 00:00+00')),
  2, 'filtre période : borne de fin exclusive'
);
select is(
  (select array_agg(id order by created_at desc)
   from public.list_audit_events('a0000000-0000-0000-0000-0000000000a1',
     p_before_created_at => '2026-10-03 09:00+00',
     p_before_id => 'e0000000-0000-0000-0000-000000000003', p_limit => 1)),
  array['e0000000-0000-0000-0000-000000000002'::uuid],
  'pagination : la page suivante reprend après le curseur'
);
select is(
  (select array_agg(actor_name) from public.list_audit_actors('a0000000-0000-0000-0000-0000000000a1')),
  array['Amina Diallo'], 'les acteurs humains du journal alimentent le filtre'
);

-- ---------------------------------------------------------------------------
-- Ajout seul (RG-13.1).
-- ---------------------------------------------------------------------------
select lives_ok(
  $$insert into public.audit_events (workspace_id, actor_type, actor_user_id, operation, object_type)
    values ('a0000000-0000-0000-0000-0000000000a1', 'human',
            '11111111-1111-1111-1111-111111111111', 'audit_log_exported', 'audit_log')$$,
  'le membre journalise ses propres actions'
);
select throws_ok(
  $$update public.audit_events set operation = 'x'$$,
  '42501', null,
  'pas de modification depuis le client'
);
reset role;

select throws_ok(
  $$update public.audit_events set after_value = '{}'
    where id = 'e0000000-0000-0000-0000-000000000004'$$,
  'P0001', 'AUDIT_APPEND_ONLY',
  'RG-13.1 : aucune modification silencieuse, même côté serveur'
);
select throws_ok(
  $$delete from public.audit_events where id = 'e0000000-0000-0000-0000-000000000001'$$,
  'P0001', 'AUDIT_APPEND_ONLY',
  'RG-13.1 : aucune suppression, même côté serveur'
);
delete from public.workspaces where id = 'a0000000-0000-0000-0000-0000000000a1';
select is(
  (select count(*)::integer from public.audit_events
   where workspace_id = 'a0000000-0000-0000-0000-0000000000a1'),
  0, 'le journal disparaît avec son espace'
);

select * from finish();
rollback;
