do $$
begin
  create type public.approach_status as enum (
    'proposed',
    'modified',
    'confirmed'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.evaluation_cycle as enum (
    'ex_ante',
    'en_cours',
    'mi_parcours',
    'finale',
    'ex_post'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.complexity_class as enum (
    'simple',
    'complique',
    'complexe'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.evaluation_nature as enum (
    'auto_evaluation',
    'interne',
    'externe_independante',
    'conjointe'
  );
exception
  when duplicate_object then null;
end
$$;

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members as member
    where member.workspace_id = target_workspace_id
      and member.profile_id = auth.uid()
      and member.role::text = 'admin'
  );
$$;

revoke all on function public.is_workspace_admin(uuid) from public;
grant execute on function public.is_workspace_admin(uuid)
  to authenticated, service_role;

create table if not exists public.approaches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  version integer not null default 1,
  status public.approach_status not null default 'proposed',
  ref_framework_id uuid not null
    references public.ref_frameworks (id),
  cycle public.evaluation_cycle not null,
  instrument_module public.instrument_module not null,
  instrument_subtype text not null,
  complexity_score integer not null,
  complexity_class public.complexity_class not null,
  complexity_factors jsonb not null,
  method_family text not null default 'contribution_analysis',
  recommended_methods jsonb not null,
  evaluation_nature public.evaluation_nature not null,
  questionnaire_answers jsonb not null,
  justifications jsonb not null,
  manual_overrides jsonb not null default '{}'::jsonb,
  locale text not null default 'fr',
  created_by uuid not null references auth.users (id),
  confirmed_by uuid references auth.users (id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approaches_workspace_version_unique unique (workspace_id, version),
  constraint approaches_version_positive check (version > 0),
  constraint approaches_instrument_subtype_not_blank check (
    btrim(instrument_subtype) <> ''
  ),
  constraint approaches_complexity_score_check check (
    complexity_score between 0 and 10
  ),
  constraint approaches_complexity_factors_object_check check (
    jsonb_typeof(complexity_factors) = 'object'
  ),
  constraint approaches_method_family_not_blank check (
    btrim(method_family) <> ''
  ),
  constraint approaches_recommended_methods_object_check check (
    jsonb_typeof(recommended_methods) = 'object'
  ),
  constraint approaches_questionnaire_answers_object_check check (
    jsonb_typeof(questionnaire_answers) = 'object'
  ),
  constraint approaches_justifications_object_check check (
    jsonb_typeof(justifications) = 'object'
  ),
  constraint approaches_manual_overrides_object_check check (
    jsonb_typeof(manual_overrides) = 'object'
  ),
  constraint approaches_locale_check check (
    locale in ('fr', 'en', 'pt', 'es')
  ),
  constraint approaches_confirmation_check check (
    (
      status = 'confirmed'
      and confirmed_by is not null
      and confirmed_at is not null
    )
    or (
      status <> 'confirmed'
      and confirmed_by is null
      and confirmed_at is null
    )
  )
);

create index if not exists idx_approaches_workspace_status
  on public.approaches (workspace_id, status);

create unique index if not exists idx_approaches_one_open_per_workspace
  on public.approaches (workspace_id)
  where status in ('proposed', 'modified');

drop trigger if exists set_approaches_updated_at on public.approaches;
create trigger set_approaches_updated_at
before update on public.approaches
for each row execute function public.set_updated_at();

create or replace function public.protect_approach_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.workspace_id <> old.workspace_id
    or new.version <> old.version
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at then
    raise exception 'Approach identity fields cannot be modified';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_approach_identity on public.approaches;
create trigger protect_approach_identity
before update on public.approaches
for each row execute function public.protect_approach_identity();

alter table public.approaches enable row level security;

drop policy if exists "approaches_select_members" on public.approaches;
create policy "approaches_select_members" on public.approaches
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "approaches_insert_admins" on public.approaches;
create policy "approaches_insert_admins" on public.approaches
  for insert to authenticated
  with check (
    public.is_workspace_admin(workspace_id)
    and created_by = auth.uid()
  );

drop policy if exists "approaches_update_admins" on public.approaches;
create policy "approaches_update_admins" on public.approaches
  for update to authenticated
  using (
    public.is_workspace_admin(workspace_id)
    and status <> 'confirmed'
  )
  with check (public.is_workspace_admin(workspace_id));

create table if not exists public.approach_criteria (
  id uuid primary key default gen_random_uuid(),
  approach_id uuid not null
    references public.approaches (id) on delete cascade,
  ref_criterion_id uuid not null
    references public.ref_criteria (id),
  applicability public.criterion_applicability not null,
  weight numeric(7, 4) not null,
  source text not null default 'cycle',
  manual_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approach_criteria_approach_criterion_unique
    unique (approach_id, ref_criterion_id),
  constraint approach_criteria_weight_check check (
    weight >= 0 and weight <= 100
  ),
  constraint approach_criteria_non_applicable_weight_check check (
    applicability <> 'non_applicable' or weight = 0
  ),
  constraint approach_criteria_source_check check (
    source in ('cycle', 'framework', 'nature', 'manual')
  )
);

create index if not exists idx_approach_criteria_approach_id
  on public.approach_criteria (approach_id);

drop trigger if exists set_approach_criteria_updated_at
  on public.approach_criteria;
create trigger set_approach_criteria_updated_at
before update on public.approach_criteria
for each row execute function public.set_updated_at();

alter table public.approach_criteria enable row level security;

drop policy if exists "approach_criteria_select_members"
  on public.approach_criteria;
create policy "approach_criteria_select_members"
  on public.approach_criteria
  for select to authenticated
  using (
    exists (
      select 1
      from public.approaches as approach
      where approach.id = approach_criteria.approach_id
        and public.is_workspace_member(approach.workspace_id)
    )
  );

drop policy if exists "approach_criteria_insert_admins"
  on public.approach_criteria;
create policy "approach_criteria_insert_admins"
  on public.approach_criteria
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.approaches as approach
      where approach.id = approach_criteria.approach_id
        and public.is_workspace_admin(approach.workspace_id)
        and approach.status <> 'confirmed'
    )
  );

drop policy if exists "approach_criteria_update_admins"
  on public.approach_criteria;
create policy "approach_criteria_update_admins"
  on public.approach_criteria
  for update to authenticated
  using (
    exists (
      select 1
      from public.approaches as approach
      where approach.id = approach_criteria.approach_id
        and public.is_workspace_admin(approach.workspace_id)
        and approach.status <> 'confirmed'
    )
  )
  with check (
    exists (
      select 1
      from public.approaches as approach
      where approach.id = approach_criteria.approach_id
        and public.is_workspace_admin(approach.workspace_id)
        and approach.status <> 'confirmed'
    )
  );

create table if not exists public.approach_events (
  id uuid primary key default gen_random_uuid(),
  approach_id uuid not null
    references public.approaches (id) on delete cascade,
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  event_type text not null,
  actor_id uuid references auth.users (id),
  previous_state jsonb,
  next_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint approach_events_event_type_not_blank check (
    btrim(event_type) <> ''
  ),
  constraint approach_events_previous_state_object_check check (
    previous_state is null or jsonb_typeof(previous_state) = 'object'
  ),
  constraint approach_events_next_state_object_check check (
    next_state is null or jsonb_typeof(next_state) = 'object'
  ),
  constraint approach_events_metadata_object_check check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index if not exists idx_approach_events_approach_created_at
  on public.approach_events (approach_id, created_at desc);

create index if not exists idx_approach_events_workspace_created_at
  on public.approach_events (workspace_id, created_at desc);

alter table public.approach_events enable row level security;

drop policy if exists "approach_events_select_members"
  on public.approach_events;
create policy "approach_events_select_members"
  on public.approach_events
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create or replace function public.audit_approach_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.approach_events (
      approach_id,
      workspace_id,
      event_type,
      actor_id,
      next_state
    )
    values (
      new.id,
      new.workspace_id,
      'approach_created',
      auth.uid(),
      to_jsonb(new)
    );
    return new;
  end if;

  insert into public.approach_events (
    approach_id,
    workspace_id,
    event_type,
    actor_id,
    previous_state,
    next_state
  )
  values (
    new.id,
    new.workspace_id,
    case
      when old.status <> new.status and new.status = 'confirmed'
        then 'approach_confirmed'
      when old.status <> new.status then 'approach_status_changed'
      else 'approach_modified'
    end,
    auth.uid(),
    to_jsonb(old),
    to_jsonb(new)
  );

  return new;
end;
$$;

drop trigger if exists audit_approaches on public.approaches;
create trigger audit_approaches
after insert or update on public.approaches
for each row execute function public.audit_approach_change();

create or replace function public.audit_approach_criterion_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_approach public.approaches%rowtype;
  target_approach_id uuid;
  target_ref_criterion_id uuid;
  previous_value jsonb;
  next_value jsonb;
begin
  if tg_op = 'DELETE' then
    target_approach_id := old.approach_id;
    target_ref_criterion_id := old.ref_criterion_id;
    previous_value := to_jsonb(old);
    next_value := null;
  elsif tg_op = 'INSERT' then
    target_approach_id := new.approach_id;
    target_ref_criterion_id := new.ref_criterion_id;
    previous_value := null;
    next_value := to_jsonb(new);
  else
    target_approach_id := new.approach_id;
    target_ref_criterion_id := new.ref_criterion_id;
    previous_value := to_jsonb(old);
    next_value := to_jsonb(new);
  end if;

  select *
  into target_approach
  from public.approaches
  where id = target_approach_id;

  insert into public.approach_events (
    approach_id,
    workspace_id,
    event_type,
    actor_id,
    previous_state,
    next_state,
    metadata
  )
  values (
    target_approach.id,
    target_approach.workspace_id,
    case
      when tg_op = 'INSERT' then 'criterion_added'
      when tg_op = 'DELETE' then 'criterion_removed'
      else 'criterion_modified'
    end,
    auth.uid(),
    previous_value,
    next_value,
    jsonb_build_object(
      'ref_criterion_id',
      target_ref_criterion_id
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists audit_approach_criteria
  on public.approach_criteria;
create trigger audit_approach_criteria
after insert or update or delete on public.approach_criteria
for each row execute function public.audit_approach_criterion_change();

comment on table public.approaches is
  'Versioned deterministic evaluation approaches confirmed before pillar generation.';

comment on table public.approach_criteria is
  'Cycle- and framework-filtered criteria attached to a versioned approach.';

comment on table public.approach_events is
  'Append-only audit log for approach and criterion changes.';
