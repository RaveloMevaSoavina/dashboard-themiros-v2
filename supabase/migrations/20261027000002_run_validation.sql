-- ---------------------------------------------------------------------------
-- Validation humaine finale d'un run (GF-6, Guide par fonctionnalité F20).
--
-- Un membre de l'espace marque le run affiché « validé par [nom] le [date] » :
-- la mention suit le run dans les écrans et les exports. La validation est
-- définitive et journalisée (run_validated) ; une correction passe par un
-- nouveau run (RG-6.3).
--
-- Seul le dernier run terminé de l'espace, calculé sur le corpus actuel, peut
-- être validé : c'est celui que les écrans affichent, et ses résultats ne sont
-- pas désactivés par un corpus modifié (CA-6.2). Les alertes encore à
-- instruire ne bloquent pas la validation ; leur nombre est journalisé.
--
-- Écart à la spec : validated_by_name fige le nom du validateur. Les profils
-- ne sont lisibles que par leur titulaire, et la mention doit survivre à la
-- suppression du compte (validated_by passe alors à null).
-- ---------------------------------------------------------------------------

alter table public.runs add column if not exists validated_by_name text;

alter table public.runs drop constraint if exists runs_validation_check;
alter table public.runs add constraint runs_validation_check check (
  (validated_at is null or status = 'completed')
  and (validated_by_name is null or validated_at is not null)
);

comment on column public.runs.validated_by_name is
  'Nom du validateur au moment de la validation humaine (GF-6).';

-- ---------------------------------------------------------------------------
-- Immuabilité (20261020000002) : la validation s'écrit une seule fois. Son
-- auteur peut seulement passer à null, à la suppression de son compte.
-- ---------------------------------------------------------------------------
create or replace function public.guard_run_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  released constant text[] := array[
    'validated_by', 'validated_at', 'validated_by_name', 'created_by'
  ];
begin
  if old.status not in ('completed', 'failed') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from public.workspaces where id = old.workspace_id) then
      raise exception using errcode = 'P0001', message = 'RUN_IMMUTABLE';
    end if;
    return old;
  end if;
  if to_jsonb(new) - released <> to_jsonb(old) - released
    or (new.created_by is not null and new.created_by is distinct from old.created_by)
    or (old.validated_at is not null and (
      new.validated_at is distinct from old.validated_at
      or new.validated_by_name is distinct from old.validated_by_name
      or (new.validated_by is not null
        and new.validated_by is distinct from old.validated_by)
    )) then
    raise exception using errcode = 'P0001', message = 'RUN_IMMUTABLE';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Validation par un membre de l'espace.
-- ---------------------------------------------------------------------------
create or replace function public.validate_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target public.runs;
  actor_name text;
  pending_alerts integer;
begin
  select * into target from public.runs where id = p_run_id for update;
  if not found or actor is null
    or not public.is_workspace_member(target.workspace_id) then
    raise exception using errcode = 'P0001', message = 'RUN_NOT_FOUND';
  end if;
  if target.status <> 'completed' then
    raise exception using errcode = 'P0001', message = 'RUN_NOT_COMPLETED';
  end if;
  if target.validated_at is not null then
    raise exception using errcode = 'P0001', message = 'RUN_ALREADY_VALIDATED';
  end if;
  if exists (
    select 1 from public.runs
    where workspace_id = target.workspace_id
      and status = 'completed'
      and created_at > target.created_at
  ) then
    raise exception using errcode = 'P0001', message = 'RUN_SUPERSEDED';
  end if;
  if public.run_corpus_changed(p_run_id) then
    raise exception using errcode = 'P0001', message = 'RUN_CORPUS_CHANGED';
  end if;

  select coalesce(nullif(btrim(profile.full_name), ''), auth_user.email)
  into actor_name
  from auth.users as auth_user
  left join public.profiles as profile on profile.id = auth_user.id
  where auth_user.id = actor;

  select count(*) into pending_alerts
  from public.layer_c_alerts
  where run_id = p_run_id and status = 'a_instruire';

  update public.runs
  set validated_by = actor,
      validated_at = now(),
      validated_by_name = actor_name
  where id = p_run_id
  returning * into target;

  insert into public.audit_events (
    workspace_id, run_id, actor_type, actor_user_id, operation, object_type,
    object_id, before_value, after_value, metadata
  )
  values (
    target.workspace_id, p_run_id, 'human', actor, 'run_validated', 'run',
    p_run_id,
    jsonb_build_object('validated_at', null),
    jsonb_build_object(
      'validated_at', target.validated_at,
      'validated_by_name', target.validated_by_name
    ),
    jsonb_build_object(
      'engine_version', target.engine_version,
      'corpus_seuil', target.corpus_seuil,
      'pending_alerts', pending_alerts
    )
  );

  return jsonb_build_object(
    'run_id', target.id,
    'validated_at', target.validated_at,
    'validated_by_name', target.validated_by_name
  );
end;
$$;

revoke execute on function public.validate_run(uuid) from public, anon;
grant execute on function public.validate_run(uuid) to authenticated;

notify pgrst, 'reload schema';
