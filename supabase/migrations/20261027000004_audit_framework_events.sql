-- ---------------------------------------------------------------------------
-- Journal d'audit (E13) : le cadre et l'approche entrent au journal.
--
-- La validation du cadre et les décisions d'approche (Parcours E13, recette
-- étape 9) n'étaient tracées que dans approach_events ou nulle part :
-- l'écran 21, qui lit audit_events, ne les voyait pas.
--
-- - approach_events est recopié dans audit_events à l'insertion, et son
--   historique repris une fois. La table reste lue par l'écran d'approche.
-- - frameworks : création, validation (draft → validated) et changement de
--   statut ; les validations déjà faites sont reprises une fois.
-- - pillars : ajout, modification (nom, description, poids) et retrait faits
--   par l'utilisateur. Seules les écritures directes du client comptent : la
--   génération des piliers passe par des fonctions security definer et se
--   journalise déjà (prompt_call) ; une cascade n'est pas une décision.
--
-- Les valeurs avant/après d'une modification ne gardent que les champs qui
-- ont changé, hors horodatages techniques.
-- ---------------------------------------------------------------------------

-- Champs de p_from dont la valeur diffère dans p_to (ou absents de p_to).
create or replace function public.audit_changed_fields(p_from jsonb, p_to jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(jsonb_object_agg(field.key, field.value), '{}'::jsonb)
  from jsonb_each(coalesce(p_from, '{}'::jsonb) - 'created_at' - 'updated_at')
    as field
  where p_to is null
    or (p_to -> field.key) is distinct from field.value;
$$;

-- ---------------------------------------------------------------------------
-- Approche : recopie d'approach_events.
-- ---------------------------------------------------------------------------
create or replace function public.mirror_approach_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  before_fields jsonb;
  after_fields jsonb;
begin
  if new.previous_state is null then
    before_fields := null;
    after_fields := new.next_state - 'created_at' - 'updated_at';
  elsif new.next_state is null then
    before_fields := new.previous_state - 'created_at' - 'updated_at';
    after_fields := null;
  else
    before_fields := public.audit_changed_fields(new.previous_state, new.next_state);
    after_fields := public.audit_changed_fields(new.next_state, new.previous_state);
    -- Une écriture qui ne change rien (horodatage seul) n'est pas un événement.
    if before_fields = '{}'::jsonb and after_fields = '{}'::jsonb then
      return new;
    end if;
  end if;

  insert into public.audit_events (
    workspace_id, actor_type, actor_user_id, operation, object_type, object_id,
    before_value, after_value, metadata, created_at
  )
  values (
    new.workspace_id,
    case when new.actor_id is null then 'engine' else 'human' end,
    new.actor_id,
    new.event_type,
    'approach',
    new.approach_id,
    before_fields,
    after_fields,
    new.metadata || jsonb_build_object('approach_event_id', new.id),
    new.created_at
  );
  return new;
end;
$$;

drop trigger if exists mirror_approach_event on public.approach_events;
create trigger mirror_approach_event
  after insert on public.approach_events
  for each row execute function public.mirror_approach_event();

-- Reprise de l'historique, une seule fois (clé : approach_event_id).
insert into public.audit_events (
  workspace_id, actor_type, actor_user_id, operation, object_type, object_id,
  before_value, after_value, metadata, created_at
)
select
  event.workspace_id,
  case when event.actor_id is null then 'engine' else 'human' end,
  event.actor_id,
  event.event_type,
  'approach',
  event.approach_id,
  case
    when event.previous_state is null then null
    when event.next_state is null
      then event.previous_state - 'created_at' - 'updated_at'
    else public.audit_changed_fields(event.previous_state, event.next_state)
  end,
  case
    when event.next_state is null then null
    when event.previous_state is null
      then event.next_state - 'created_at' - 'updated_at'
    else public.audit_changed_fields(event.next_state, event.previous_state)
  end,
  event.metadata || jsonb_build_object(
    'approach_event_id', event.id, 'migrated_from', 'approach_events'
  ),
  event.created_at
from public.approach_events as event
where not exists (
  select 1 from public.audit_events as audit
  where audit.object_type = 'approach'
    and audit.metadata ->> 'approach_event_id' = event.id::text
)
and not (
  event.previous_state is not null and event.next_state is not null
  and public.audit_changed_fields(event.previous_state, event.next_state) = '{}'::jsonb
  and public.audit_changed_fields(event.next_state, event.previous_state) = '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Cadre : création, validation, changement de statut.
-- ---------------------------------------------------------------------------
create or replace function public.audit_framework_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  pillars jsonb;
begin
  if tg_op = 'INSERT' then
    actor := auth.uid();
    insert into public.audit_events (
      workspace_id, actor_type, actor_user_id, operation, object_type,
      object_id, after_value, metadata
    )
    values (
      new.workspace_id,
      case when actor is null then 'engine' else 'human' end,
      actor,
      'framework_created',
      'framework',
      new.id,
      jsonb_build_object('version', new.version, 'status', new.status),
      jsonb_build_object('approach_id', new.approach_id)
    );
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Le validateur est celui que la ligne désigne ; à défaut, la session.
  actor := case
    when new.status = 'validated' then coalesce(new.validated_by, auth.uid())
    else auth.uid()
  end;
  -- Le cadre tel que validé : piliers et poids retenus.
  select coalesce(jsonb_agg(
    jsonb_build_object('name', pillar.name, 'weight', pillar.weight)
    order by pillar.order_index
  ), '[]'::jsonb)
  into pillars
  from public.pillars as pillar
  where pillar.framework_id = new.id;

  insert into public.audit_events (
    workspace_id, actor_type, actor_user_id, operation, object_type,
    object_id, before_value, after_value, metadata
  )
  values (
    new.workspace_id,
    case when actor is null then 'engine' else 'human' end,
    actor,
    case when new.status = 'validated'
      then 'framework_validated' else 'framework_status_changed' end,
    'framework',
    new.id,
    jsonb_build_object('status', old.status, 'validated_at', old.validated_at),
    jsonb_build_object('status', new.status, 'validated_at', new.validated_at),
    jsonb_build_object('version', new.version, 'pillars', pillars)
  );
  return new;
end;
$$;

drop trigger if exists audit_framework_change on public.frameworks;
create trigger audit_framework_change
  after insert or update of status on public.frameworks
  for each row execute function public.audit_framework_change();

-- Reprise des validations déjà faites, une seule fois. Les piliers ont pu
-- changer depuis : la reprise ne les fige donc pas.
insert into public.audit_events (
  workspace_id, actor_type, actor_user_id, operation, object_type, object_id,
  before_value, after_value, metadata, created_at
)
select
  framework.workspace_id,
  'human',
  framework.validated_by,
  'framework_validated',
  'framework',
  framework.id,
  jsonb_build_object('status', 'draft', 'validated_at', null),
  jsonb_build_object('status', 'validated', 'validated_at', framework.validated_at),
  jsonb_build_object('version', framework.version, 'reconstructed', true),
  framework.validated_at
from public.frameworks as framework
where framework.validated_at is not null
  and framework.validated_by is not null
  and not exists (
    select 1 from public.audit_events as audit
    where audit.object_id = framework.id
      and audit.operation = 'framework_validated'
  );

-- ---------------------------------------------------------------------------
-- Piliers : modifications faites par l'utilisateur.
-- ---------------------------------------------------------------------------
-- Fonction appelante (security invoker) : current_user y est le rôle qui a
-- écrit la ligne. authenticated pour une écriture directe du client ; le
-- propriétaire pour la génération (fonctions security definer) et pour une
-- cascade. L'événement passe la policy d'insertion des membres.
create or replace function public.audit_pillar_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target public.pillars := case when tg_op = 'DELETE' then old else new end;
  target_workspace_id uuid;
  actor uuid := auth.uid();
  previous jsonb;
  next jsonb;
begin
  if current_user <> 'authenticated' or actor is null then
    return target;
  end if;

  select framework.workspace_id into target_workspace_id
  from public.frameworks as framework
  where framework.id = target.framework_id;
  if not found then
    return target;
  end if;

  if tg_op <> 'INSERT' then
    previous := jsonb_build_object(
      'name', old.name, 'description', old.description, 'weight', old.weight
    );
  end if;
  if tg_op <> 'DELETE' then
    next := jsonb_build_object(
      'name', new.name, 'description', new.description, 'weight', new.weight
    );
  end if;
  if tg_op = 'UPDATE' then
    previous := public.audit_changed_fields(previous, next);
    if previous = '{}'::jsonb then
      return new;
    end if;
    next := public.audit_changed_fields(
      next,
      jsonb_build_object(
        'name', old.name, 'description', old.description, 'weight', old.weight
      )
    );
  end if;

  insert into public.audit_events (
    workspace_id, actor_type, actor_user_id, operation, object_type,
    object_id, before_value, after_value, metadata
  )
  values (
    target_workspace_id,
    'human',
    actor,
    case tg_op
      when 'INSERT' then 'pillar_added'
      when 'UPDATE' then 'pillar_modified'
      else 'pillar_removed'
    end,
    'pillar',
    target.id,
    previous,
    next,
    jsonb_build_object('framework_id', target.framework_id)
  );
  return target;
end;
$$;

drop trigger if exists audit_pillar_change on public.pillars;
create trigger audit_pillar_change
  after insert or update or delete on public.pillars
  for each row execute function public.audit_pillar_change();

revoke execute on function public.mirror_approach_event()
  from public, anon, authenticated;
revoke execute on function public.audit_framework_change()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
