-- ---------------------------------------------------------------------------
-- Backoffice : suivi des demandes de démonstration de la landing page.
--
-- La table vient de landing-page (20260918000001_demo_requests.sql) ; la
-- fonction demo-request y écrit avec la clé serveur. On y ajoute le suivi
-- commercial : statut, notes, dernier administrateur à l'avoir traitée.
--
--   new        : arrivée, personne ne l'a encore prise ;
--   contacted  : une réponse est partie ;
--   scheduled  : un créneau est convenu ;
--   completed  : la démonstration a eu lieu ;
--   declined   : sans suite (hors cible, doublon, spam...).
--
-- Accès : uniquement par les fonctions backoffice_* ci-dessous. Le dump
-- montre un GRANT ALL à anon et authenticated : la RLS sans policy les
-- bloque déjà, on retire quand même ces droits, comme pour les autres
-- tables du backoffice. La fonction demo-request n'est pas concernée (clé
-- serveur).
-- ---------------------------------------------------------------------------

alter table public.demo_requests
  add column if not exists status text not null default 'new',
  add column if not exists notes text,
  add column if not exists handled_by uuid references public.profiles (id) on delete set null,
  add column if not exists updated_at timestamptz;

alter table public.demo_requests
  drop constraint if exists demo_requests_status_check;
alter table public.demo_requests
  add constraint demo_requests_status_check check (
    status in ('new', 'contacted', 'scheduled', 'completed', 'declined')
  );

revoke all on public.demo_requests from anon, authenticated;

create or replace function public.backoffice_list_demo_requests()
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
      'id', d.id,
      'created_at', d.created_at,
      'name', d.name,
      'organisation', d.organisation,
      'email', d.email,
      'context', d.context,
      'source', d.source,
      'notified', d.notified,
      'status', d.status,
      'notes', d.notes,
      'handled_by_name', handler.full_name,
      'updated_at', d.updated_at
    ) order by d.created_at desc)
    from public.demo_requests d
    left join public.profiles handler on handler.id = d.handled_by
  ), '[]'::jsonb);
end;
$$;

create or replace function public.backoffice_update_demo_request(
  p_id uuid,
  p_status text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  if p_status is null
     or p_status not in ('new', 'contacted', 'scheduled', 'completed', 'declined') then
    raise exception 'DEMO_REQUEST_STATUS_INVALID' using errcode = '22023';
  end if;

  update public.demo_requests
  set status = p_status,
      notes = nullif(btrim(p_notes), ''),
      handled_by = auth.uid(),
      updated_at = now()
  where id = p_id;

  if not found then
    raise exception 'DEMO_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

-- Suppression définitive : spam et demandes à effacer sur demande de la
-- personne (RGPD). Une demande simplement sans suite se classe en declined.
create or replace function public.backoffice_delete_demo_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  delete from public.demo_requests where id = p_id;

  if not found then
    raise exception 'DEMO_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.backoffice_list_demo_requests() from public, anon;
revoke execute on function public.backoffice_update_demo_request(uuid, text, text) from public, anon;
revoke execute on function public.backoffice_delete_demo_request(uuid) from public, anon;
grant execute on function public.backoffice_list_demo_requests() to authenticated;
grant execute on function public.backoffice_update_demo_request(uuid, text, text) to authenticated;
grant execute on function public.backoffice_delete_demo_request(uuid) to authenticated;
