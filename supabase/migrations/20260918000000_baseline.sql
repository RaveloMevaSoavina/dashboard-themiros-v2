-- ---------------------------------------------------------------------------
-- Socle créé à la main avant la mise en place des migrations.
--
-- Reconstitué depuis le dump de prod (pg_dump 17.6, 13/10/2026), dans l'état
-- qui précède 20260919000001 : les colonnes et contraintes que les migrations
-- suivantes ajoutent elles-mêmes (financiers, declared_stage, start_year,
-- end_year, corpus_changed_at…) n'y figurent pas.
--
-- Idempotent : rejouée sur la prod, elle ne change rien.
-- ---------------------------------------------------------------------------

-- En prod, pgvector est installé dans public (et non dans extensions) : on
-- garde le même emplacement pour que les types résolvent pareil partout.
create extension if not exists vector with schema public;

-- ---------------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organisations, profils, espaces, membres
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  country text,
  created_at timestamptz not null default now(),
  constraint organizations_type_check check (
    type is null or type in ('government', 'donor', 'ngo', 'agency', 'regional')
  )
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  current_workspace_id uuid,
  full_name text,
  role text,
  lang text not null default 'fr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_lang_check check (lang in ('fr', 'en')),
  constraint profiles_role_check check (
    role is null or role in ('admin', 'decideur', 'pmu', 'analyste')
  )
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  kind text not null,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  target_country text,
  default_language text,
  expected_donor text,
  themes text[] not null default '{}',
  expected_languages text[] not null default '{}',
  pillar_framework_status text not null default 'draft',
  pillar_framework_locked_at timestamptz,
  pillar_fingerprint text,
  pillar_fingerprint_data jsonb,
  constraint workspaces_kind_check check (kind in ('policy', 'program', 'project')),
  constraint workspaces_default_language_check check (
    default_language is null or default_language in ('fr', 'en', 'es')
  ),
  constraint workspaces_pillar_framework_status_check check (
    pillar_framework_status in ('draft', 'validated', 'locked')
  )
);

-- Référence circulaire profiles ↔ workspaces : posée après les deux tables.
do $$
begin
  alter table public.profiles
    add constraint profiles_current_workspace_id_fkey
    foreign key (current_workspace_id) references public.workspaces (id) on delete set null;
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text,
  created_at timestamptz not null default now(),
  constraint workspace_members_unique unique (workspace_id, profile_id),
  constraint workspace_members_role_check check (
    role is null or role in ('admin', 'member', 'viewer')
  )
);

create index if not exists idx_profiles_current_workspace_id
  on public.profiles (current_workspace_id);
create index if not exists idx_profiles_organization_id
  on public.profiles (organization_id);
create index if not exists idx_workspaces_created_by
  on public.workspaces (created_by);
create index if not exists idx_workspaces_organization_id
  on public.workspaces (organization_id);
create index if not exists idx_workspaces_target_country
  on public.workspaces (target_country);
create index if not exists idx_workspace_members_profile_id
  on public.workspace_members (profile_id);
create index if not exists idx_workspace_members_workspace_id
  on public.workspace_members (workspace_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Appartenance à un espace
-- ---------------------------------------------------------------------------
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.profile_id = auth.uid()
  );
$$;

create or replace function public.assert_workspace_member(target_workspace_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'not a workspace member' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profil créé à l'inscription
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, lang)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(new.raw_user_meta_data ->> 'lang', 'fr')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Premier journal d'audit (audit_logs). Toujours alimenté par des triggers,
-- mais l'application lit audit_events (20260927000002).
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid references auth.users (id) on delete set null,
  user_email text,
  user_fullname text,
  action text not null,
  entity_type text,
  entity_id text,
  entity_label text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_check check (action in (
    'document.uploaded', 'document.qualification_updated', 'document.deleted',
    'document.triage_requested', 'document.decision_submitted',
    'document.triage_completed', 'document.processing_completed',
    'document.processing_failed', 'framework.generation_requested',
    'framework.generation_completed', 'framework.generation_failed',
    'framework.validated', 'framework.fingerprint_accepted', 'pillar.added',
    'pillar.renamed', 'pillar.reweighted', 'pillar.deleted',
    'workspace.created', 'workspace.updated', 'workspace.deleted'
  )),
  constraint audit_logs_entity_type_check check (
    entity_type is null or entity_type in ('document', 'pillar', 'framework', 'workspace')
  )
);

create index if not exists audit_logs_action_idx
  on public.audit_logs (action);
create index if not exists audit_logs_workspace_entity_idx
  on public.audit_logs (workspace_id, entity_type, entity_id, created_at desc);
create index if not exists audit_logs_workspace_id_created_at_idx
  on public.audit_logs (workspace_id, created_at desc);

create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update
  before update on public.audit_logs
  for each row execute function public.audit_logs_immutable();

drop trigger if exists audit_logs_no_delete on public.audit_logs;
create trigger audit_logs_no_delete
  before delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

create or replace function public.audit_diff(before_row jsonb, after_row jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_object_agg(k.field, jsonb_build_object(
      'before', before_row -> k.field,
      'after',  after_row  -> k.field
    )),
    '{}'::jsonb
  )
  from jsonb_object_keys(
         coalesce(before_row, '{}'::jsonb) || coalesce(after_row, '{}'::jsonb)
       ) as k(field)
  where (before_row -> k.field) is distinct from (after_row -> k.field);
$$;

create or replace function public.audit_pick(row_json jsonb, fields text[])
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_object_agg(f.field, row_json -> f.field), '{}'::jsonb)
  from unnest(fields) as f(field)
  where row_json ? f.field;
$$;

create or replace function public.write_audit_log(
  target_workspace_id uuid,
  action text,
  entity_type text default null,
  entity_id text default null,
  entity_label text default null,
  metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_email text;
  actor_name text;
  log_id uuid;
begin
  if target_workspace_id is null then
    return null;
  end if;

  if actor is not null then
    select u.email, p.full_name
      into actor_email, actor_name
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.id = actor;
  end if;

  insert into public.audit_logs (
    workspace_id, user_id, user_email, user_fullname,
    action, entity_type, entity_id, entity_label, metadata
  )
  values (
    target_workspace_id, actor, actor_email, actor_name,
    write_audit_log.action,
    write_audit_log.entity_type,
    write_audit_log.entity_id,
    write_audit_log.entity_label,
    write_audit_log.metadata
  )
  returning id into log_id;

  return log_id;
end;
$$;

create or replace function public.audit_workspace_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- pillar_framework_status and pillar_fingerprint are excluded on purpose:
  -- confirm_pillar_framework and accept_pillar_fingerprint already journal
  -- those transitions with their full context, and a trigger entry alongside
  -- would double-count one action in the timeline.
  audited_fields text[] := array[
    'name', 'kind', 'description', 'default_language', 'target_country',
    'expected_donor', 'themes', 'expected_languages'
  ];
  changes jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.write_audit_log(
      new.id,
      'workspace.created',
      'workspace',
      new.id::text,
      new.name,
      jsonb_build_object(
        'kind', new.kind,
        'target_country', new.target_country,
        'expected_donor', new.expected_donor,
        'themes', new.themes,
        'expected_languages', new.expected_languages
      )
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.write_audit_log(
      old.id,
      'workspace.deleted',
      'workspace',
      old.id::text,
      old.name,
      jsonb_build_object('kind', old.kind, 'target_country', old.target_country)
    );
    return old;
  end if;

  changes := public.audit_diff(
    public.audit_pick(to_jsonb(old), audited_fields),
    public.audit_pick(to_jsonb(new), audited_fields)
  );

  if changes <> '{}'::jsonb then
    perform public.write_audit_log(
      new.id, 'workspace.updated', 'workspace', new.id::text, new.name, changes
    );
  end if;

  return new;
end;
$$;

drop trigger if exists audit_workspaces on public.workspaces;
create trigger audit_workspaces
  after insert or delete or update on public.workspaces
  for each row execute function public.audit_workspace_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists organizations_insert_authenticated on public.organizations;
create policy organizations_insert_authenticated on public.organizations
  for insert to authenticated
  with check (true);

drop policy if exists organizations_select_same_org on public.organizations;
create policy organizations_select_same_org on public.organizations
  for select to authenticated
  using (id = (select p.organization_id from public.profiles p where p.id = auth.uid()));

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.organization_id = organizations.id and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.organization_id = organizations.id and p.role = 'admin'
  ));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists workspaces_select_same_org on public.workspaces;
create policy workspaces_select_same_org on public.workspaces
  for select to authenticated
  using (organization_id = (select p.organization_id from public.profiles p where p.id = auth.uid()));

drop policy if exists workspaces_insert_admin_or_pmu on public.workspaces;
create policy workspaces_insert_admin_or_pmu on public.workspaces
  for insert to authenticated
  with check (
    organization_id = (select p.organization_id from public.profiles p where p.id = auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pmu')
    )
  );

drop policy if exists workspaces_update_admin_or_creator on public.workspaces;
create policy workspaces_update_admin_or_creator on public.workspaces
  for update to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = workspaces.organization_id and p.role = 'admin'
    )
  )
  with check (organization_id = (select p.organization_id from public.profiles p where p.id = auth.uid()));

drop policy if exists workspaces_delete_admin_or_creator on public.workspaces;
create policy workspaces_delete_admin_or_creator on public.workspaces
  for delete to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = workspaces.organization_id and p.role = 'admin'
    )
  );

drop policy if exists workspace_members_select_own on public.workspace_members;
create policy workspace_members_select_own on public.workspace_members
  for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists workspace_members_insert_admin on public.workspace_members;
create policy workspace_members_insert_admin on public.workspace_members
  for insert to authenticated
  with check (exists (
    select 1
    from public.profiles p
    join public.workspaces w on w.id = workspace_members.workspace_id
    where p.id = auth.uid() and p.organization_id = w.organization_id and p.role = 'admin'
  ));

drop policy if exists workspace_members_update_admin on public.workspace_members;
create policy workspace_members_update_admin on public.workspace_members
  for update to authenticated
  using (exists (
    select 1
    from public.profiles p
    join public.workspaces w on w.id = workspace_members.workspace_id
    where p.id = auth.uid() and p.organization_id = w.organization_id and p.role = 'admin'
  ))
  with check (exists (
    select 1
    from public.profiles p
    join public.workspaces w on w.id = workspace_members.workspace_id
    where p.id = auth.uid() and p.organization_id = w.organization_id and p.role = 'admin'
  ));

drop policy if exists workspace_members_delete_admin on public.workspace_members;
create policy workspace_members_delete_admin on public.workspace_members
  for delete to authenticated
  using (exists (
    select 1
    from public.profiles p
    join public.workspaces w on w.id = workspace_members.workspace_id
    where p.id = auth.uid() and p.organization_id = w.organization_id and p.role = 'admin'
  ));

drop policy if exists "workspace members can read audit logs" on public.audit_logs;
create policy "workspace members can read audit logs" on public.audit_logs
  for select
  using (workspace_id in (
    select workspace_members.workspace_id
    from public.workspace_members
    where workspace_members.profile_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Commentaires
-- ---------------------------------------------------------------------------
comment on table public.organizations is 'Client organizations using the platform.';
comment on table public.profiles is 'App profile linked 1:1 with Supabase auth.users.';
comment on table public.workspaces is 'Project-like workspaces scoped to one organization.';
comment on table public.workspace_members is 'Membership of users in organization workspaces.';
comment on column public.workspaces.expected_donor is
  'Bailleur ou cadre de référence attendu pour le corpus (générique, tous modules).';
comment on column public.workspaces.themes is
  'Thématiques attendues du workspace, utilisées par le scoring de pertinence.';
comment on column public.workspaces.expected_languages is
  'Langues attendues des documents. La langue ne change jamais le verdict (multilingue obligatoire).';
comment on column public.workspaces.pillar_fingerprint is
  'Workspace fingerprint key the current pillar framework was generated from. Null means no framework has been generated yet.';
comment on column public.workspaces.pillar_fingerprint_data is
  'Same fingerprint exploded field by field, so the UI can show a readable diff.';
comment on column public.audit_logs.entity_id is
  'Primary key of the subject row (uuid as text). Null for workspace-level events.';
comment on column public.audit_logs.metadata is
  'Event payload. Mutations carry {"before": {...}, "after": {...}} holding only changed fields.';
comment on function public.audit_diff(jsonb, jsonb) is
  'Returns {field: {before, after}} for keys that differ between two row snapshots.';
comment on function public.audit_pick(jsonb, text[]) is
  'Projects a row snapshot down to the listed fields, dropping the rest.';
comment on function public.write_audit_log(uuid, text, text, text, text, jsonb) is
  'Sole insertion point for audit_logs. Resolves the actor from auth.uid(); never trusts a caller-supplied identity.';

-- ---------------------------------------------------------------------------
-- Droits (identiques à la prod)
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.audit_logs from anon, authenticated;

revoke all on function public.write_audit_log(uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.write_audit_log(uuid, text, text, text, text, jsonb)
  to service_role;
