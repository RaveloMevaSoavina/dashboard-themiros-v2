alter table public.workspaces
  add column if not exists financiers jsonb not null default '[]'::jsonb,
  add column if not exists declared_stage text,
  add column if not exists start_year integer,
  add column if not exists end_year integer;

alter table public.workspaces
  drop constraint if exists workspaces_declared_stage_check,
  add constraint workspaces_declared_stage_check check (
    declared_stage is null or declared_stage in (
      'conception', 'demarrage', 'mise_en_oeuvre', 'cloture', 'clos'
    )
  ),
  drop constraint if exists workspaces_years_check,
  add constraint workspaces_years_check check (
    start_year is null or end_year is null or end_year >= start_year
  ),
  drop constraint if exists workspaces_financiers_array_check,
  add constraint workspaces_financiers_array_check check (
    jsonb_typeof(financiers) = 'array'
  );

create table if not exists public.program_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  label text not null,
  year integer not null,
  order_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_versions_workspace_order_unique
    unique (workspace_id, order_index)
);

create index if not exists idx_program_versions_workspace_id
  on public.program_versions (workspace_id);

drop trigger if exists set_program_versions_updated_at on public.program_versions;
create trigger set_program_versions_updated_at
before update on public.program_versions
for each row execute function public.set_updated_at();

alter table public.program_versions enable row level security;

drop policy if exists "program_versions_select_members" on public.program_versions;
create policy "program_versions_select_members" on public.program_versions
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "program_versions_insert_members" on public.program_versions;
create policy "program_versions_insert_members" on public.program_versions
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "program_versions_update_members" on public.program_versions;
create policy "program_versions_update_members" on public.program_versions
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "program_versions_delete_members" on public.program_versions;
create policy "program_versions_delete_members" on public.program_versions
  for delete to authenticated
  using (public.is_workspace_member(workspace_id));
