-- ---------------------------------------------------------------------------
-- Backoffice : suppression définitive d'un compte.
--
-- La suppression elle-même passe par l'API (GoTrue, clé serveur) : effacer
-- auth.users emporte le profil, ses appartenances aux espaces et ses droits
-- de backoffice (on delete cascade), et détache ce qui pointe vers lui avec
-- on delete set null (journal d'audit, documents déposés, factures...).
--
-- Les autres références (sans action) bloqueraient la suppression : ce sont
-- les données dont le compte est l'auteur (approches, cadres, documents
-- intégrés, générations de piliers). On ne les efface pas et on ne réécrit
-- pas leur auteur : un compte qui en a produit ne se supprime pas, il
-- s'archive. La liste vient du catalogue : une table ajoutée plus tard est
-- couverte sans changer cette fonction.
-- ---------------------------------------------------------------------------

create or replace function public.backoffice_prepare_profile_deletion(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account_email text;
  reference record;
  referenced boolean;
  blockers text[] := '{}';
begin
  perform public.assert_platform_admin();

  if p_profile_id = auth.uid() then
    raise exception 'CANNOT_DELETE_SELF' using errcode = '22023';
  end if;

  select lower(email) into account_email from auth.users where id = p_profile_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  for reference in
    select c.conrelid::regclass as source_table, a.attname as source_column
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
      and c.confdeltype in ('a', 'r')
      and cardinality(c.conkey) = 1
      and n.nspname = 'public'
  loop
    execute format(
      'select exists (select 1 from %s where %I = $1)',
      reference.source_table, reference.source_column
    )
    into referenced
    using p_profile_id;

    if referenced then
      blockers := blockers || reference.source_table::text;
    end if;
  end loop;

  if cardinality(blockers) > 0 then
    -- 22023 et non 42501 : PostgREST répondrait 403 et l'API perdrait le code.
    raise exception 'PROFILE_HAS_RECORDS'
      using errcode = '22023',
            detail = array_to_string(array(select distinct unnest(blockers) order by 1), ', ');
  end if;

  -- Une invitation sans compte se lirait « en attente » et pourrait être
  -- renvoyée : on efface celles de l'adresse.
  delete from public.organization_invitations
  where user_id = p_profile_id or email = account_email;
end;
$$;

revoke execute on function public.backoffice_prepare_profile_deletion(uuid) from public, anon;
grant execute on function public.backoffice_prepare_profile_deletion(uuid) to authenticated;
