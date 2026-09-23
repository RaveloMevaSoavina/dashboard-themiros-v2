do $$
begin
  create type public.document_category as enum (
    'principal', 'complementaire', 'autre'
  );
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.document_status as enum (
    'conforme', 'a_verifier', 'rejete',
    'integre_decision_humaine', 'non_classe'
  );
exception when duplicate_object then null;
end
$$;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  original_filename text not null,
  storage_path text not null,
  file_hash text not null,
  file_size_bytes bigint not null,
  mime_type text not null,
  category public.document_category not null default 'autre',
  detected_language text,
  detected_country text,
  relevance_score integer,
  status public.document_status not null default 'a_verifier',
  status_reason text,
  exploitable_pages integer,
  total_pages integer,
  integrated_by_human boolean not null default false,
  integrated_by_user_id uuid references public.profiles (id),
  integrated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint documents_relevance_score_check check (
    relevance_score is null or relevance_score between 0 and 100
  ),
  constraint documents_page_counts_check check (
    exploitable_pages is null or total_pages is null
    or (exploitable_pages >= 0 and exploitable_pages <= total_pages)
  )
);

alter table public.documents
  add column if not exists original_filename text,
  add column if not exists storage_path text,
  add column if not exists file_hash text,
  add column if not exists file_size_bytes bigint,
  add column if not exists mime_type text,
  add column if not exists category public.document_category default 'autre',
  add column if not exists detected_language text,
  add column if not exists detected_country text,
  add column if not exists relevance_score integer,
  add column if not exists status public.document_status default 'a_verifier',
  add column if not exists status_reason text,
  add column if not exists exploitable_pages integer,
  add column if not exists total_pages integer,
  add column if not exists integrated_by_human boolean default false,
  add column if not exists integrated_by_user_id uuid references public.profiles (id),
  add column if not exists integrated_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists deleted_at timestamptz;

create unique index if not exists idx_documents_workspace_hash_active
  on public.documents (workspace_id, file_hash)
  where deleted_at is null;
create index if not exists idx_documents_workspace_status
  on public.documents (workspace_id, status)
  where deleted_at is null;

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

alter table public.documents enable row level security;

drop policy if exists "documents_select_members" on public.documents;
create policy "documents_select_members" on public.documents
  for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists "documents_insert_members" on public.documents;
create policy "documents_insert_members" on public.documents
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));
drop policy if exists "documents_update_members" on public.documents;
create policy "documents_update_members" on public.documents
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
drop policy if exists "documents_delete_members" on public.documents;
create policy "documents_delete_members" on public.documents
  for delete to authenticated
  using (public.is_workspace_member(workspace_id));

create table if not exists public.document_versions (
  document_id uuid not null references public.documents (id) on delete cascade,
  program_version_id uuid not null references public.program_versions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, program_version_id)
);

alter table public.document_versions enable row level security;
drop policy if exists "document_versions_members" on public.document_versions;
create policy "document_versions_members" on public.document_versions
  for all to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = document_id and public.is_workspace_member(d.workspace_id)
  ))
  with check (exists (
    select 1 from public.documents d
    where d.id = document_id and public.is_workspace_member(d.workspace_id)
  ));

create table if not exists public.document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  event_type text not null,
  message text,
  actor_id uuid references public.profiles (id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_events_document_created
  on public.document_events (document_id, created_at desc);
alter table public.document_events enable row level security;
drop policy if exists "document_events_select_members" on public.document_events;
create policy "document_events_select_members" on public.document_events
  for select to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = document_id and public.is_workspace_member(d.workspace_id)
  ));
drop policy if exists "document_events_insert_members" on public.document_events;
create policy "document_events_insert_members" on public.document_events
  for insert to authenticated
  with check (exists (
    select 1 from public.documents d
    where d.id = document_id and public.is_workspace_member(d.workspace_id)
  ));

create table if not exists public.corpus_thresholds (
  analysis_type text primary key,
  minimum_documents integer not null,
  recommended_documents integer not null,
  updated_at timestamptz not null default now(),
  constraint corpus_thresholds_values_check check (
    minimum_documents > 0 and recommended_documents >= minimum_documents
  )
);

insert into public.corpus_thresholds
  (analysis_type, minimum_documents, recommended_documents)
values ('exploratoire', 5, 8), ('standard', 10, 15), ('approfondie', 20, 25)
on conflict (analysis_type) do nothing;

alter table public.corpus_thresholds enable row level security;
drop policy if exists "corpus_thresholds_read" on public.corpus_thresholds;
create policy "corpus_thresholds_read" on public.corpus_thresholds
  for select to authenticated using (true);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "workspace_documents_select" on storage.objects;
create policy "workspace_documents_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "workspace_documents_insert" on storage.objects;
create policy "workspace_documents_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "workspace_documents_delete" on storage.objects;
create policy "workspace_documents_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
