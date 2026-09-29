-- A workspace is the project container. A framework is the versioned
-- evaluation structure generated for a confirmed approach in that workspace.

create table if not exists public.frameworks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  approach_id uuid not null
    references public.approaches (id),
  version integer not null default 1,
  status text not null default 'draft',
  validated_by uuid references auth.users (id),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint frameworks_workspace_version_unique
    unique (workspace_id, version),
  constraint frameworks_version_positive check (version > 0),
  constraint frameworks_status_check check (
    status in ('draft', 'validated', 'superseded')
  ),
  constraint frameworks_validation_check check (
    (status = 'validated' and validated_by is not null and validated_at is not null)
    or status <> 'validated'
  )
);

create index if not exists idx_frameworks_workspace_status
  on public.frameworks (workspace_id, status);

create index if not exists idx_frameworks_approach_id
  on public.frameworks (approach_id);

drop trigger if exists set_frameworks_updated_at on public.frameworks;
create trigger set_frameworks_updated_at
before update on public.frameworks
for each row execute function public.set_updated_at();

alter table public.frameworks enable row level security;

drop policy if exists "frameworks_select_members" on public.frameworks;
create policy "frameworks_select_members" on public.frameworks
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "frameworks_insert_admins" on public.frameworks;
create policy "frameworks_insert_admins" on public.frameworks
  for insert to authenticated
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists "frameworks_update_admins" on public.frameworks;
create policy "frameworks_update_admins" on public.frameworks
  for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists "frameworks_delete_admins" on public.frameworks;
create policy "frameworks_delete_admins" on public.frameworks
  for delete to authenticated
  using (public.is_workspace_admin(workspace_id));

create table if not exists public.pillars (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null
    references public.frameworks (id) on delete cascade,
  ref_pillar_id uuid references public.ref_pillars (id) on delete set null,
  name text not null,
  description text not null,
  weight numeric(5, 2) not null,
  order_index integer not null,
  origin text not null default 'referential',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pillars_name_not_blank check (btrim(name) <> ''),
  constraint pillars_description_not_blank check (btrim(description) <> ''),
  constraint pillars_weight_check check (weight >= 0 and weight <= 100),
  constraint pillars_order_index_positive check (order_index > 0),
  constraint pillars_origin_check check (origin in ('referential', 'new'))
);

create index if not exists idx_pillars_framework_order
  on public.pillars (framework_id, order_index);

create index if not exists idx_pillars_ref_pillar_id
  on public.pillars (ref_pillar_id);

drop trigger if exists set_pillars_updated_at on public.pillars;
create trigger set_pillars_updated_at
before update on public.pillars
for each row execute function public.set_updated_at();

alter table public.pillars enable row level security;

drop policy if exists "pillars_select_members" on public.pillars;
create policy "pillars_select_members" on public.pillars
  for select to authenticated
  using (
    exists (
      select 1 from public.frameworks as framework
      where framework.id = pillars.framework_id
        and public.is_workspace_member(framework.workspace_id)
    )
  );

drop policy if exists "pillars_insert_admins" on public.pillars;
create policy "pillars_insert_admins" on public.pillars
  for insert to authenticated
  with check (
    exists (
      select 1 from public.frameworks as framework
      where framework.id = pillars.framework_id
        and public.is_workspace_admin(framework.workspace_id)
        and framework.status = 'draft'
    )
  );

drop policy if exists "pillars_update_admins" on public.pillars;
create policy "pillars_update_admins" on public.pillars
  for update to authenticated
  using (
    exists (
      select 1 from public.frameworks as framework
      where framework.id = pillars.framework_id
        and public.is_workspace_admin(framework.workspace_id)
        and framework.status = 'draft'
    )
  )
  with check (
    exists (
      select 1 from public.frameworks as framework
      where framework.id = pillars.framework_id
        and public.is_workspace_admin(framework.workspace_id)
        and framework.status = 'draft'
    )
  );

drop policy if exists "pillars_delete_admins" on public.pillars;
create policy "pillars_delete_admins" on public.pillars
  for delete to authenticated
  using (
    exists (
      select 1 from public.frameworks as framework
      where framework.id = pillars.framework_id
        and public.is_workspace_admin(framework.workspace_id)
        and framework.status = 'draft'
    )
  );

create table if not exists public.criteria (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null
    references public.frameworks (id) on delete cascade,
  code text not null,
  name text not null,
  definition text not null,
  applicability public.criterion_applicability not null,
  weight numeric(7, 4) not null default 0,
  origin text not null default 'referential',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint criteria_framework_code_unique unique (framework_id, code),
  constraint criteria_code_not_blank check (btrim(code) <> ''),
  constraint criteria_name_not_blank check (btrim(name) <> ''),
  constraint criteria_definition_not_blank check (btrim(definition) <> ''),
  constraint criteria_weight_check check (weight >= 0 and weight <= 100),
  constraint criteria_origin_check check (
    origin in ('referential', 'financier', 'user')
  )
);

create index if not exists idx_criteria_framework_applicability
  on public.criteria (framework_id, applicability);

drop trigger if exists set_criteria_updated_at on public.criteria;
create trigger set_criteria_updated_at
before update on public.criteria
for each row execute function public.set_updated_at();

alter table public.criteria enable row level security;

drop policy if exists "criteria_select_members" on public.criteria;
create policy "criteria_select_members" on public.criteria
  for select to authenticated
  using (
    exists (
      select 1 from public.frameworks as framework
      where framework.id = criteria.framework_id
        and public.is_workspace_member(framework.workspace_id)
    )
  );

drop policy if exists "criteria_write_admins" on public.criteria;
create policy "criteria_write_admins" on public.criteria
  for all to authenticated
  using (
    exists (
      select 1 from public.frameworks as framework
      where framework.id = criteria.framework_id
        and public.is_workspace_admin(framework.workspace_id)
        and framework.status = 'draft'
    )
  )
  with check (
    exists (
      select 1 from public.frameworks as framework
      where framework.id = criteria.framework_id
        and public.is_workspace_admin(framework.workspace_id)
        and framework.status = 'draft'
    )
  );

create table if not exists public.ref_questions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  criterion_code text not null,
  text text not null,
  applicable_cycles text[] not null,
  applicable_modules text[] not null,
  layer text not null,
  expected_evidence text,
  version text not null,
  created_at timestamptz not null default now(),
  constraint ref_questions_code_version_unique unique (code, version),
  constraint ref_questions_code_not_blank check (btrim(code) <> ''),
  constraint ref_questions_criterion_not_blank check (
    btrim(criterion_code) <> ''
  ),
  constraint ref_questions_text_not_blank check (btrim(text) <> ''),
  constraint ref_questions_layer_check check (layer in ('A', 'B', 'A_B')),
  constraint ref_questions_version_not_blank check (btrim(version) <> '')
);

create index if not exists idx_ref_questions_criterion_code
  on public.ref_questions (criterion_code, code);

alter table public.ref_questions enable row level security;

drop policy if exists "ref_questions_select_authenticated"
  on public.ref_questions;
create policy "ref_questions_select_authenticated"
  on public.ref_questions for select to authenticated using (true);

create table if not exists public.sub_questions (
  id uuid primary key default gen_random_uuid(),
  criterion_id uuid not null
    references public.criteria (id) on delete cascade,
  ref_question_id uuid
    references public.ref_questions (id) on delete set null,
  text text not null,
  layer text not null default 'B',
  expected_evidence text,
  status text not null default 'active',
  inactive_reason text,
  order_index integer not null,
  origin text not null default 'referential',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sub_questions_text_not_blank check (btrim(text) <> ''),
  constraint sub_questions_layer_check check (layer in ('A', 'B', 'A_B')),
  constraint sub_questions_status_check check (status in ('active', 'inactive')),
  constraint sub_questions_inactive_reason_check check (
    status = 'active' or inactive_reason is not null
  ),
  constraint sub_questions_order_index_positive check (order_index > 0),
  constraint sub_questions_origin_check check (
    origin in ('referential', 'user')
  )
);

create index if not exists idx_sub_questions_criterion_status
  on public.sub_questions (criterion_id, status);

drop trigger if exists set_sub_questions_updated_at on public.sub_questions;
create trigger set_sub_questions_updated_at
before update on public.sub_questions
for each row execute function public.set_updated_at();

alter table public.sub_questions enable row level security;

drop policy if exists "sub_questions_select_members" on public.sub_questions;
create policy "sub_questions_select_members" on public.sub_questions
  for select to authenticated
  using (
    exists (
      select 1
      from public.criteria as criterion
      join public.frameworks as framework
        on framework.id = criterion.framework_id
      where criterion.id = sub_questions.criterion_id
        and public.is_workspace_member(framework.workspace_id)
    )
  );

drop policy if exists "sub_questions_write_admins" on public.sub_questions;
create policy "sub_questions_write_admins" on public.sub_questions
  for all to authenticated
  using (
    exists (
      select 1
      from public.criteria as criterion
      join public.frameworks as framework
        on framework.id = criterion.framework_id
      where criterion.id = sub_questions.criterion_id
        and public.is_workspace_admin(framework.workspace_id)
        and framework.status = 'draft'
    )
  )
  with check (
    exists (
      select 1
      from public.criteria as criterion
      join public.frameworks as framework
        on framework.id = criterion.framework_id
      where criterion.id = sub_questions.criterion_id
        and public.is_workspace_admin(framework.workspace_id)
        and framework.status = 'draft'
    )
  );

create table if not exists public.pillar_criteria (
  pillar_id uuid not null
    references public.pillars (id) on delete cascade,
  criterion_id uuid not null
    references public.criteria (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pillar_id, criterion_id)
);

create index if not exists idx_pillar_criteria_criterion_id
  on public.pillar_criteria (criterion_id);

alter table public.pillar_criteria enable row level security;

drop policy if exists "pillar_criteria_select_members"
  on public.pillar_criteria;
create policy "pillar_criteria_select_members" on public.pillar_criteria
  for select to authenticated
  using (
    exists (
      select 1
      from public.pillars as pillar
      join public.frameworks as framework
        on framework.id = pillar.framework_id
      where pillar.id = pillar_criteria.pillar_id
        and public.is_workspace_member(framework.workspace_id)
    )
  );

drop policy if exists "pillar_criteria_write_admins"
  on public.pillar_criteria;
create policy "pillar_criteria_write_admins" on public.pillar_criteria
  for all to authenticated
  using (
    exists (
      select 1
      from public.pillars as pillar
      join public.frameworks as framework
        on framework.id = pillar.framework_id
      where pillar.id = pillar_criteria.pillar_id
        and public.is_workspace_admin(framework.workspace_id)
        and framework.status = 'draft'
    )
  )
  with check (
    exists (
      select 1
      from public.pillars as pillar
      join public.frameworks as framework
        on framework.id = pillar.framework_id
      where pillar.id = pillar_criteria.pillar_id
        and public.is_workspace_admin(framework.workspace_id)
        and framework.status = 'draft'
    )
  );

create table if not exists public.pillar_variables (
  id uuid primary key default gen_random_uuid(),
  pillar_id uuid not null
    references public.pillars (id) on delete cascade,
  code text not null,
  label text not null,
  description text,
  weight numeric(5, 2) not null,
  order_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pillar_variables_pillar_code_unique unique (pillar_id, code),
  constraint pillar_variables_code_not_blank check (btrim(code) <> ''),
  constraint pillar_variables_label_not_blank check (btrim(label) <> ''),
  constraint pillar_variables_weight_check check (
    weight >= 0 and weight <= 100
  ),
  constraint pillar_variables_order_index_positive check (order_index > 0)
);

create index if not exists idx_pillar_variables_pillar_order
  on public.pillar_variables (pillar_id, order_index);

drop trigger if exists set_pillar_variables_updated_at
  on public.pillar_variables;
create trigger set_pillar_variables_updated_at
before update on public.pillar_variables
for each row execute function public.set_updated_at();

alter table public.pillar_variables enable row level security;

drop policy if exists "pillar_variables_select_members"
  on public.pillar_variables;
create policy "pillar_variables_select_members" on public.pillar_variables
  for select to authenticated
  using (
    exists (
      select 1
      from public.pillars as pillar
      join public.frameworks as framework
        on framework.id = pillar.framework_id
      where pillar.id = pillar_variables.pillar_id
        and public.is_workspace_member(framework.workspace_id)
    )
  );

drop policy if exists "pillar_variables_write_admins"
  on public.pillar_variables;
create policy "pillar_variables_write_admins" on public.pillar_variables
  for all to authenticated
  using (
    exists (
      select 1
      from public.pillars as pillar
      join public.frameworks as framework
        on framework.id = pillar.framework_id
      where pillar.id = pillar_variables.pillar_id
        and public.is_workspace_admin(framework.workspace_id)
        and framework.status = 'draft'
    )
  )
  with check (
    exists (
      select 1
      from public.pillars as pillar
      join public.frameworks as framework
        on framework.id = pillar.framework_id
      where pillar.id = pillar_variables.pillar_id
        and public.is_workspace_admin(framework.workspace_id)
        and framework.status = 'draft'
    )
  );

notify pgrst, 'reload schema';
