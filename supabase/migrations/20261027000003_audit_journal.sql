-- ---------------------------------------------------------------------------
-- Journal d'audit (E13, écran 21) : consultation filtrable et ajout seul.
--
-- RG-13.1 : le journal n'accepte ni modification ni suppression. Jusqu'ici,
-- seule l'absence de policy l'en protégeait ; les fonctions security definer
-- pouvaient encore le réécrire. Deux exceptions, imposées par les clés
-- étrangères : l'auteur passe à null à la suppression de son compte, et les
-- événements disparaissent avec leur espace (même règle que
-- guard_run_immutability).
--
-- Lecture par list_audit_events : les profils ne sont lisibles que par leur
-- titulaire, le nom de l'acteur est donc résolu ici. La catégorie et l'échec
-- sont dérivés de l'opération, en un seul endroit, pour que filtre, écran et
-- export disent la même chose.
-- ---------------------------------------------------------------------------

create or replace function public.guard_audit_event_append_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.workspaces where id = old.workspace_id) then
      raise exception using errcode = 'P0001', message = 'AUDIT_APPEND_ONLY';
    end if;
    return old;
  end if;
  if new.actor_user_id is null
    and to_jsonb(new) - 'actor_user_id' = to_jsonb(old) - 'actor_user_id' then
    return new;
  end if;
  raise exception using errcode = 'P0001', message = 'AUDIT_APPEND_ONLY';
end;
$$;

drop trigger if exists audit_events_append_only on public.audit_events;
create trigger audit_events_append_only
  before update or delete on public.audit_events
  for each row execute function public.guard_audit_event_append_only();

revoke update, delete, truncate on public.audit_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Classement des opérations (filtre « type d'événement », US-21.1).
-- ---------------------------------------------------------------------------
create or replace function public.audit_event_category(p_operation text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_operation like 'run\_%' or p_operation = 'rag_query' then 'run'
    when p_operation like 'document\_%'
      or p_operation in (
        'corpus_classified',
        'ingestion_settings_updated',
        'critical_mass_settings_updated'
      ) then 'corpus'
    when p_operation like 'alert\_%' then 'alert'
    when p_operation = 'prompt_call' then 'ai'
    when p_operation like '%export%' then 'export'
    else 'framework'
  end;
$$;

-- US-21.4 : les échecs (run planté, import corrompu) se repèrent au suffixe.
create or replace function public.audit_event_failed(p_operation text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_operation like '%\_failed';
$$;

-- ---------------------------------------------------------------------------
-- Liste chronologique, du plus récent au plus ancien, par pages (curseur
-- created_at + id). p_to est exclusif. p_actor vaut 'engine' ou l'identifiant
-- d'un utilisateur.
-- ---------------------------------------------------------------------------
create or replace function public.list_audit_events(
  p_workspace_id uuid,
  p_category text default null,
  p_actor text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_failures_only boolean default false,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  created_at timestamptz,
  operation text,
  category text,
  failed boolean,
  actor_type text,
  actor_user_id uuid,
  actor_name text,
  object_type text,
  object_id uuid,
  run_id uuid,
  run_engine_version text,
  before_value jsonb,
  after_value jsonb,
  metadata jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception using errcode = 'P0001', message = 'WORKSPACE_NOT_FOUND';
  end if;

  return query
  select
    event.id,
    event.created_at,
    event.operation,
    public.audit_event_category(event.operation),
    public.audit_event_failed(event.operation),
    event.actor_type,
    event.actor_user_id,
    case when event.actor_user_id is not null then
      coalesce(nullif(btrim(profile.full_name), ''), auth_user.email)
    end,
    event.object_type,
    event.object_id,
    event.run_id,
    run.engine_version,
    event.before_value,
    event.after_value,
    event.metadata
  from public.audit_events as event
  left join public.profiles as profile on profile.id = event.actor_user_id
  left join auth.users as auth_user on auth_user.id = event.actor_user_id
  left join public.runs as run on run.id = event.run_id
  where event.workspace_id = p_workspace_id
    and (p_category is null
      or public.audit_event_category(event.operation) = p_category)
    and (p_actor is null
      or (p_actor = 'engine' and event.actor_type = 'engine')
      or event.actor_user_id::text = p_actor)
    and (p_from is null or event.created_at >= p_from)
    and (p_to is null or event.created_at < p_to)
    and (not coalesce(p_failures_only, false)
      or public.audit_event_failed(event.operation))
    and (p_before_created_at is null
      or (event.created_at, event.id) < (p_before_created_at, p_before_id))
  order by event.created_at desc, event.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 500);
end;
$$;

-- Acteurs humains présents dans le journal, pour le filtre « acteur ».
create or replace function public.list_audit_actors(p_workspace_id uuid)
returns table (actor_user_id uuid, actor_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception using errcode = 'P0001', message = 'WORKSPACE_NOT_FOUND';
  end if;

  return query
  select
    actor.actor_user_id,
    coalesce(nullif(btrim(profile.full_name), ''), auth_user.email)
  from (
    select distinct event.actor_user_id
    from public.audit_events as event
    where event.workspace_id = p_workspace_id
      and event.actor_user_id is not null
  ) as actor
  left join public.profiles as profile on profile.id = actor.actor_user_id
  left join auth.users as auth_user on auth_user.id = actor.actor_user_id
  order by 2;
end;
$$;

revoke execute on function public.guard_audit_event_append_only()
  from public, anon, authenticated;
revoke execute on function public.list_audit_events(
  uuid, text, text, timestamptz, timestamptz, boolean, timestamptz, uuid, integer
) from public, anon;
grant execute on function public.list_audit_events(
  uuid, text, text, timestamptz, timestamptz, boolean, timestamptz, uuid, integer
) to authenticated;
revoke execute on function public.list_audit_actors(uuid) from public, anon;
grant execute on function public.list_audit_actors(uuid) to authenticated;

notify pgrst, 'reload schema';
