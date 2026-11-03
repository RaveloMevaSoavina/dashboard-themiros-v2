-- ---------------------------------------------------------------------------
-- Backoffice : archivage d'un profil.
--
-- Archiver n'efface rien : le compte garde son organisation, ses espaces et
-- tout ce qu'il a produit (journal d'audit, évaluations), et se restaure à
-- l'identique. Le verrou est côté Supabase Auth : l'API bannit le compte
-- (plus de connexion ni de renouvellement de session). `archived_at` n'est
-- que l'état affiché ; un compte pouvant modifier sa propre ligne de
-- `profiles` (profiles_update_own), cette colonne seule ne protégerait rien.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users (id) on delete set null;

create or replace function public.backoffice_archive_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  if p_profile_id = auth.uid() then
    -- 22023 et non 42501 : PostgREST répondrait 403 et l'API perdrait le code.
    raise exception 'CANNOT_ARCHIVE_SELF' using errcode = '22023';
  end if;

  update public.profiles
  set archived_at = coalesce(archived_at, now()),
      archived_by = case when archived_at is null then auth.uid() else archived_by end
  where id = p_profile_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.backoffice_restore_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  update public.profiles
  set archived_at = null, archived_by = null
  where id = p_profile_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

-- Même liste qu'en 20261103000001, avec l'état d'archivage.
create or replace function public.backoffice_list_profiles(
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'email', u.email,
      'full_name', p.full_name,
      'role', p.role,
      'lang', p.lang,
      'organization_id', p.organization_id,
      'organization_name', o.name,
      'is_platform_admin', exists (
        select 1 from public.platform_admins pa where pa.profile_id = p.id
      ),
      'workspace_count', (
        select count(*) from public.workspace_members wm where wm.profile_id = p.id
      ),
      'email_confirmed_at', u.email_confirmed_at,
      'last_sign_in_at', u.last_sign_in_at,
      'archived_at', p.archived_at,
      'archived_by_name', archiver.full_name,
      'created_at', p.created_at
    ) order by coalesce(nullif(p.full_name, ''), u.email))
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.organizations o on o.id = p.organization_id
    left join public.profiles archiver on archiver.id = p.archived_by
    where p_organization_id is null or p.organization_id = p_organization_id
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.backoffice_archive_profile(uuid) from public, anon;
revoke execute on function public.backoffice_restore_profile(uuid) from public, anon;
grant execute on function public.backoffice_archive_profile(uuid) to authenticated;
grant execute on function public.backoffice_restore_profile(uuid) to authenticated;
