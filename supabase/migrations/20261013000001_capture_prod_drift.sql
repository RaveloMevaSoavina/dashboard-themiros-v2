-- ---------------------------------------------------------------------------
-- Rattrapage de l'écart entre les migrations et la prod (dump du 13/10/2026).
--
-- documents et pillar_generation_jobs existaient en prod avant les migrations
-- qui les « créent » (create table if not exists → sans effet) : ils ont gardé
-- des colonnes, index, policies et triggers d'une version antérieure. Cette
-- migration les reproduit tels quels pour qu'une base neuve soit identique à
-- la prod. Le nettoyage de cet héritage relève d'une migration séparée.
--
-- Idempotente : sans effet sur la prod.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- documents : colonnes héritées
-- ---------------------------------------------------------------------------
alter table public.documents
  add column if not exists name text,
  add column if not exists file_type text,
  add column if not exists document_type text,
  add column if not exists source text not null default 'upload',
  add column if not exists file_size bigint,
  add column if not exists version text not null default '1.0',
  add column if not exists owner text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists uploaded_by uuid,
  add column if not exists checksum_sha256 text,
  add column if not exists country text,
  add column if not exists document_year integer,
  add column if not exists generation text,
  add column if not exists language text,
  add column if not exists role text,
  add column if not exists compliance_status text not null default 'pending_check',
  add column if not exists compliance_notes text,
  add column if not exists verdict_reason text,
  add column if not exists page_count integer,
  add column if not exists usable_pages integer,
  add column if not exists ocr_used boolean;

do $$
begin
  alter table public.documents
    add constraint documents_compliance_status_check check (
      compliance_status in (
        'pending_check', 'conform', 'needs_review', 'inconsistent', 'manually_validated'
      )
    );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.documents
    add constraint documents_language_check check (
      language is null or language in ('fr', 'en', 'es')
    );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.documents
    add constraint documents_role_check check (
      role is null or role in ('primary', 'supporting')
    );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.documents
    add constraint documents_uploaded_by_fkey
    foreign key (uploaded_by) references public.profiles (id) on delete set null;
exception
  when duplicate_object then null;
end
$$;

create index if not exists idx_documents_compliance_status
  on public.documents (compliance_status);
create index if not exists idx_documents_country
  on public.documents (country);
create index if not exists idx_documents_document_year
  on public.documents (document_year);
create index if not exists idx_documents_generation
  on public.documents (generation);
create index if not exists idx_documents_language
  on public.documents (language);
create index if not exists idx_documents_uploaded_by
  on public.documents (uploaded_by);
create unique index if not exists idx_documents_workspace_checksum_unique
  on public.documents (workspace_id, checksum_sha256)
  where checksum_sha256 is not null;
create index if not exists idx_documents_workspace_country_type_generation
  on public.documents (workspace_id, country, document_type, generation);
create index if not exists idx_documents_workspace_id
  on public.documents (workspace_id);

-- Realtime : les mises à jour publient l'ancienne ligne complète.
alter table public.documents replica identity full;

comment on column public.documents.status is
  'Cycle de vie : uploaded/queued -> processing -> conform|needs_review|blocked|inconsistent|duplicate|conflict|manually_validated -> ready | error';
comment on column public.documents.relevance_score is
  'Score de pertinence 0-100 calculé au triage (heuristique). Alimente le verdict, ne l''est pas.';
comment on column public.documents.verdict_reason is
  'Motif explicite du verdict, toujours conservé et journalisé.';
comment on column public.documents.usable_pages is
  'Pages avec texte exploitable après OCR complet (heavy).';

-- Anciennes policies, doublons de documents_*_members (20260923000003). Les
-- écritures restent bloquées par le revoke de 20261006000001.
drop policy if exists documents_select_workspace_members on public.documents;
create policy documents_select_workspace_members on public.documents
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists documents_insert_workspace_members on public.documents;
create policy documents_insert_workspace_members on public.documents
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and uploaded_by = auth.uid());

drop policy if exists documents_update_workspace_members on public.documents;
create policy documents_update_workspace_members on public.documents
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists documents_delete_workspace_members on public.documents;
create policy documents_delete_workspace_members on public.documents
  for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- Journal audit_logs (baseline) sur les documents.
create or replace function public.audit_document_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  qualification_fields text[] := array[
    'document_type', 'country', 'document_year', 'generation',
    'language', 'role', 'owner', 'tags', 'name'
  ];
  changes jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.write_audit_log(
      new.workspace_id,
      'document.uploaded',
      'document',
      new.id::text,
      new.name,
      jsonb_build_object(
        'file_size', new.file_size,
        'file_type', new.file_type,
        'checksum_sha256', new.checksum_sha256,
        'document_type', new.document_type,
        'country', new.country,
        'document_year', new.document_year,
        'generation', new.generation,
        'language', new.language,
        'role', new.role,
        'owner', new.owner,
        'tags', new.tags,
        'source', new.source
      )
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.write_audit_log(
      old.workspace_id,
      'document.deleted',
      'document',
      old.id::text,
      old.name,
      jsonb_build_object(
        'status_at_deletion', old.status,
        'checksum_sha256', old.checksum_sha256,
        'storage_path', old.storage_path
      )
    );
    return old;
  end if;

  -- UPDATE: journal only when a qualification field actually moved.
  changes := public.audit_diff(
    public.audit_pick(to_jsonb(old), qualification_fields),
    public.audit_pick(to_jsonb(new), qualification_fields)
  );

  if changes <> '{}'::jsonb then
    perform public.write_audit_log(
      new.workspace_id,
      'document.qualification_updated',
      'document',
      new.id::text,
      new.name,
      changes
    );
  end if;

  return new;
end;
$$;

drop trigger if exists audit_documents on public.documents;
create trigger audit_documents
  after insert or delete or update on public.documents
  for each row execute function public.audit_document_change();

-- ---------------------------------------------------------------------------
-- pillar_generation_jobs : colonnes de l'ancienne file générique
-- ---------------------------------------------------------------------------
alter table public.pillar_generation_jobs
  add column if not exists priority integer not null default 100,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists worker_id text,
  add column if not exists locked_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists created_by uuid;

do $$
begin
  alter table public.pillar_generation_jobs
    add constraint pillar_generation_jobs_check check (
      attempts >= 0 and max_attempts >= 1 and attempts <= max_attempts
    );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.pillar_generation_jobs
    add constraint pillar_generation_jobs_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;
exception
  when duplicate_object then null;
end
$$;

create index if not exists idx_pillar_generation_jobs_claim
  on public.pillar_generation_jobs (status, priority, created_at);
-- Doublon de idx_pillar_generation_jobs_one_active, présent en prod.
create unique index if not exists uniq_pillar_job_active_per_workspace
  on public.pillar_generation_jobs (workspace_id)
  where status in ('queued', 'running');

-- 20260929000001 ne pose ce trigger que si created_by existe : c'est
-- désormais toujours le cas.
drop trigger if exists sync_pillar_generation_job_requester on public.pillar_generation_jobs;
create trigger sync_pillar_generation_job_requester
  before insert or update of requested_by, created_by on public.pillar_generation_jobs
  for each row execute function public.sync_pillar_generation_job_requester();

drop policy if exists pillar_generation_jobs_select on public.pillar_generation_jobs;
create policy pillar_generation_jobs_select on public.pillar_generation_jobs
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists pillar_generation_jobs_insert on public.pillar_generation_jobs;
create policy pillar_generation_jobs_insert on public.pillar_generation_jobs
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pillar_generation_jobs'
  ) then
    alter publication supabase_realtime add table only public.pillar_generation_jobs;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Storage : anciennes policies sur le préfixe workspaces/<id>/…
-- (les fichiers actuels sont rangés sous <workspace_id>/…, cf. 20260923000003)
-- ---------------------------------------------------------------------------
drop policy if exists documents_storage_select_workspace_members on storage.objects;
create policy documents_storage_select_workspace_members on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'workspaces'
    and exists (
      select 1 from public.workspace_members wm
      where wm.profile_id = auth.uid()
        and wm.workspace_id::text = (storage.foldername(objects.name))[2]
    )
  );

drop policy if exists documents_storage_insert_workspace_members on storage.objects;
create policy documents_storage_insert_workspace_members on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'workspaces'
    and exists (
      select 1 from public.workspace_members wm
      where wm.profile_id = auth.uid()
        and wm.workspace_id::text = (storage.foldername(objects.name))[2]
    )
  );

drop policy if exists documents_storage_update_workspace_members on storage.objects;
create policy documents_storage_update_workspace_members on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'workspaces'
    and exists (
      select 1 from public.workspace_members wm
      where wm.profile_id = auth.uid()
        and wm.workspace_id::text = (storage.foldername(objects.name))[2]
    )
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'workspaces'
    and exists (
      select 1 from public.workspace_members wm
      where wm.profile_id = auth.uid()
        and wm.workspace_id::text = (storage.foldername(objects.name))[2]
    )
  );

drop policy if exists documents_storage_delete_workspace_members on storage.objects;
create policy documents_storage_delete_workspace_members on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'workspaces'
    and exists (
      select 1 from public.workspace_members wm
      where wm.profile_id = auth.uid()
        and wm.workspace_id::text = (storage.foldername(objects.name))[2]
    )
  );
