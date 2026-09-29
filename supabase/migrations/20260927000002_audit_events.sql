-- Append-only audit log used by AI calls and future evaluation operations.
-- It must exist before pillar-generation audit triggers are installed.
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  run_id uuid,
  actor_type text not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  operation text not null,
  object_type text not null,
  object_id uuid,
  before_value jsonb,
  after_value jsonb,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_actor_type_check check (
    actor_type in ('human', 'engine')
  ),
  constraint audit_events_operation_not_blank check (
    btrim(operation) <> ''
  ),
  constraint audit_events_object_type_not_blank check (
    btrim(object_type) <> ''
  ),
  constraint audit_events_before_value_object_check check (
    before_value is null or jsonb_typeof(before_value) = 'object'
  ),
  constraint audit_events_after_value_object_check check (
    after_value is null or jsonb_typeof(after_value) = 'object'
  ),
  constraint audit_events_metadata_object_check check (
    metadata is null or jsonb_typeof(metadata) = 'object'
  ),
  constraint audit_events_human_actor_check check (
    actor_type <> 'human' or actor_user_id is not null
  )
);

create index if not exists idx_audit_events_workspace_created
  on public.audit_events (workspace_id, created_at desc);

create index if not exists idx_audit_events_workspace_operation
  on public.audit_events (workspace_id, operation);

create index if not exists idx_audit_events_run_id
  on public.audit_events (run_id)
  where run_id is not null;

create index if not exists idx_audit_events_actor_user_id
  on public.audit_events (actor_user_id)
  where actor_user_id is not null;

alter table public.audit_events enable row level security;

drop policy if exists "audit_events_select_members" on public.audit_events;
create policy "audit_events_select_members" on public.audit_events
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "audit_events_insert_human_members"
  on public.audit_events;
create policy "audit_events_insert_human_members" on public.audit_events
  for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and actor_type = 'human'
    and actor_user_id = auth.uid()
  );

comment on table public.audit_events is
  'Append-only audit log. Corrections are represented by new events.';

notify pgrst, 'reload schema';
