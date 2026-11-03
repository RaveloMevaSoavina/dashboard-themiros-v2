-- ---------------------------------------------------------------------------
-- Backoffice : archivage et restauration d'un profil.
--
-- Lancement : `supabase test db`, sur une base locale où les migrations de ce
-- dépôt sont appliquées.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

create function pg_temp.as_user(user_id text)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    jsonb_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('a1111111-1111-1111-1111-111111111111', 'staff@archive.local', 'authenticated', 'authenticated', now()),
  ('a2222222-2222-2222-2222-222222222222', 'client@archive.local', 'authenticated', 'authenticated', now());
insert into public.profiles (id, full_name) values
  ('a1111111-1111-1111-1111-111111111111', 'Staff'),
  ('a2222222-2222-2222-2222-222222222222', 'Client')
on conflict (id) do update set full_name = excluded.full_name;
insert into public.platform_admins (profile_id)
values ('a1111111-1111-1111-1111-111111111111');

set local role authenticated;

-- Un client ne peut pas archiver.
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ select public.backoffice_archive_profile('a1111111-1111-1111-1111-111111111111') $$,
  '42501', null,
  'seul un administrateur de la plateforme archive un profil'
);

select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');

select throws_ok(
  $$ select public.backoffice_archive_profile('a1111111-1111-1111-1111-111111111111') $$,
  '22023', 'CANNOT_ARCHIVE_SELF',
  'un administrateur ne s''archive pas lui-même'
);

select throws_ok(
  $$ select public.backoffice_archive_profile('a9999999-9999-9999-9999-999999999999') $$,
  'P0002', 'PROFILE_NOT_FOUND',
  'archiver un profil inconnu échoue'
);

select public.backoffice_archive_profile('a2222222-2222-2222-2222-222222222222');

select ok(
  (select p ->> 'archived_at' is not null and p ->> 'archived_by_name' = 'Staff'
   from jsonb_array_elements(public.backoffice_list_profiles()) p
   where p ->> 'id' = 'a2222222-2222-2222-2222-222222222222'),
  'la liste montre le profil archivé et qui l''a archivé'
);

-- Archiver deux fois garde la date et l'auteur du premier archivage.
reset role;
update public.profiles set archived_at = '2026-01-01'
where id = 'a2222222-2222-2222-2222-222222222222';
set local role authenticated;
select public.backoffice_archive_profile('a2222222-2222-2222-2222-222222222222');
select is(
  (select archived_at from public.backoffice_list_profiles() l,
     jsonb_to_recordset(l) as x(id uuid, archived_at timestamptz)
   where x.id = 'a2222222-2222-2222-2222-222222222222'),
  '2026-01-01'::timestamptz,
  'archiver un profil déjà archivé ne change pas sa date'
);

select public.backoffice_restore_profile('a2222222-2222-2222-2222-222222222222');

select ok(
  (select p -> 'archived_at' = 'null'::jsonb and p -> 'archived_by_name' = 'null'::jsonb
   from jsonb_array_elements(public.backoffice_list_profiles()) p
   where p ->> 'id' = 'a2222222-2222-2222-2222-222222222222'),
  'restaurer efface l''archivage'
);

select throws_ok(
  $$ select public.backoffice_restore_profile('a9999999-9999-9999-9999-999999999999') $$,
  'P0002', 'PROFILE_NOT_FOUND',
  'restaurer un profil inconnu échoue'
);

reset role;
set local role anon;
select throws_ok(
  $$ select public.backoffice_restore_profile('a2222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'anon n''a pas accès à la restauration'
);
reset role;

select * from finish();
rollback;
