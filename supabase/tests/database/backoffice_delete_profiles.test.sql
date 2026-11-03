-- ---------------------------------------------------------------------------
-- Backoffice : préparation de la suppression définitive d'un compte.
--
-- Lancement : `supabase test db`, sur une base locale où les migrations de ce
-- dépôt sont appliquées.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

create function pg_temp.as_user(user_id text)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    jsonb_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('d1111111-1111-1111-1111-111111111111', 'staff@delete.local', 'authenticated', 'authenticated', now()),
  ('d2222222-2222-2222-2222-222222222222', 'unused@delete.local', 'authenticated', 'authenticated', now()),
  ('d3333333-3333-3333-3333-333333333333', 'author@delete.local', 'authenticated', 'authenticated', now());
insert into public.profiles (id) values
  ('d1111111-1111-1111-1111-111111111111'),
  ('d2222222-2222-2222-2222-222222222222'),
  ('d3333333-3333-3333-3333-333333333333')
on conflict (id) do nothing;
insert into public.platform_admins (profile_id)
values ('d1111111-1111-1111-1111-111111111111');
insert into public.organizations (id, name)
values ('d0000000-0000-0000-0000-000000000000', 'Delete Org');
insert into public.organization_invitations (organization_id, email, role, workspace_role, user_id)
values ('d0000000-0000-0000-0000-000000000000', 'unused@delete.local', 'analyste', 'member',
        'd2222222-2222-2222-2222-222222222222');

-- Une donnée dont le compte est l'auteur, sans action à la suppression,
-- comme approaches.created_by.
create table public.test_authored (
  id serial primary key,
  author uuid not null references auth.users (id)
);
insert into public.test_authored (author) values ('d3333333-3333-3333-3333-333333333333');

set local role authenticated;

select pg_temp.as_user('d2222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ select public.backoffice_prepare_profile_deletion('d3333333-3333-3333-3333-333333333333') $$,
  '42501', null,
  'seul un administrateur de la plateforme supprime un compte'
);

select pg_temp.as_user('d1111111-1111-1111-1111-111111111111');

select throws_ok(
  $$ select public.backoffice_prepare_profile_deletion('d1111111-1111-1111-1111-111111111111') $$,
  '22023', 'CANNOT_DELETE_SELF',
  'un administrateur ne supprime pas son propre compte'
);

select throws_ok(
  $$ select public.backoffice_prepare_profile_deletion('d9999999-9999-9999-9999-999999999999') $$,
  'P0002', 'PROFILE_NOT_FOUND',
  'supprimer un compte inconnu échoue'
);

select throws_ok(
  $$ select public.backoffice_prepare_profile_deletion('d3333333-3333-3333-3333-333333333333') $$,
  '22023', 'PROFILE_HAS_RECORDS',
  'un compte auteur de données ne se supprime pas'
);

select lives_ok(
  $$ select public.backoffice_prepare_profile_deletion('d2222222-2222-2222-2222-222222222222') $$,
  'un compte sans données se prépare à la suppression'
);

reset role;

select is(
  (select count(*)::int from public.organization_invitations
   where email = 'unused@delete.local'),
  0,
  'ses invitations sont effacées'
);

-- Ce que fera GoTrue : le compte part, le reste suit en cascade.
delete from auth.users where id = 'd2222222-2222-2222-2222-222222222222';
select is(
  (select count(*)::int from public.profiles
   where id = 'd2222222-2222-2222-2222-222222222222'),
  0,
  'la suppression du compte emporte son profil'
);

select * from finish();
rollback;
