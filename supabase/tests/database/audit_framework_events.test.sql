-- ---------------------------------------------------------------------------
-- Journal d'audit (E13) : approche, cadre et piliers entrent dans
-- audit_events, avec les seuls champs modifiés en valeurs avant/après.
--
-- Lancement : `supabase test db`, sur une base locale où les migrations de ce
-- dépôt sont appliquées.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

create function pg_temp.as_user(user_id text)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    jsonb_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'admin@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id) values ('11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;
insert into public.organizations (id, name)
values ('a0000000-0000-0000-0000-000000000001', 'Organisation de test');
insert into public.workspaces (id, organization_id, name, kind)
values ('a0000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001',
        'Programme de test', 'program');
insert into public.workspace_members (workspace_id, profile_id, role)
values ('a0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'admin');

-- L'approche et le cadre sont créés dans la session de l'utilisatrice.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
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
-- Pilier écrit hors session client, comme par la génération.
insert into public.pillars (id, framework_id, name, description, weight, order_index)
values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
        'Budget', 'Exécution budgétaire du programme.', 100, 1);

-- ---------------------------------------------------------------------------
-- Approche.
-- ---------------------------------------------------------------------------
select results_eq(
  $$select actor_type, actor_user_id, after_value ->> 'status'
    from public.audit_events
    where object_type = 'approach' and operation = 'approach_created'$$,
  $$values ('human'::text, '11111111-1111-1111-1111-111111111111'::uuid, 'confirmed'::text)$$,
  'les événements d''approche entrent au journal, avec leur auteur'
);
update public.approaches set updated_at = updated_at + interval '1 second'
where id = 'b0000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::integer from public.audit_events
   where object_type = 'approach' and operation = 'approach_modified'),
  0, 'une écriture sans changement réel n''est pas un événement'
);
update public.approaches set complexity_score = 7
where id = 'b0000000-0000-0000-0000-000000000001';
select results_eq(
  $$select before_value, after_value from public.audit_events
    where object_type = 'approach' and operation = 'approach_modified'$$,
  $$values ('{"complexity_score": 5}'::jsonb, '{"complexity_score": 7}'::jsonb)$$,
  'avant/après : seuls les champs modifiés'
);
select is(
  (select count(*)::integer from public.audit_events
   where object_type = 'approach'
     and metadata ->> 'approach_event_id' is null),
  0, 'chaque événement garde la référence de sa source'
);

-- ---------------------------------------------------------------------------
-- Cadre et piliers.
-- ---------------------------------------------------------------------------
select is(
  (select actor_user_id from public.audit_events
   where operation = 'framework_created'
     and object_id = 'c0000000-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'la création du cadre est journalisée'
);
select is(
  (select count(*)::integer from public.audit_events where object_type = 'pillar'),
  0, 'un pilier écrit par le serveur (génération) n''est pas une décision humaine'
);

set local role authenticated;
update public.pillars set name = 'Budget et absorption'
where id = 'd0000000-0000-0000-0000-000000000001';
update public.pillars set weight = 100
where id = 'd0000000-0000-0000-0000-000000000001';
update public.frameworks
set status = 'validated',
    validated_by = '11111111-1111-1111-1111-111111111111',
    validated_at = now()
where id = 'c0000000-0000-0000-0000-000000000001';
reset role;

select results_eq(
  $$select actor_user_id, before_value, after_value from public.audit_events
    where operation = 'pillar_modified'$$,
  $$values ('11111111-1111-1111-1111-111111111111'::uuid,
            '{"name": "Budget"}'::jsonb, '{"name": "Budget et absorption"}'::jsonb)$$,
  'renommer un pilier : un événement, avec l''ancien et le nouveau nom'
);
select results_eq(
  $$select actor_type, actor_user_id, before_value ->> 'status', after_value ->> 'status'
    from public.audit_events where operation = 'framework_validated'$$,
  $$values ('human'::text, '11111111-1111-1111-1111-111111111111'::uuid,
            'draft'::text, 'validated'::text)$$,
  'Parcours E13 : la validation du cadre, son auteur et les valeurs avant/après'
);
select is(
  (select metadata -> 'pillars' -> 0 ->> 'name' from public.audit_events
   where operation = 'framework_validated'),
  'Budget et absorption', 'le cadre validé fige ses piliers'
);
select is(
  (select category from public.list_audit_events(
     'a0000000-0000-0000-0000-0000000000a1', p_category => 'framework')
   where operation = 'framework_validated'),
  'framework', 'la validation se filtre sous le type « Cadre »'
);

select * from finish();
rollback;
