-- The jobs table may already exist from the generic worker queue migration.
-- Add the pillar-generation fields explicitly because CREATE TABLE IF NOT
-- EXISTS does not reconcile an existing table definition.
alter table public.pillar_generation_jobs
  add column if not exists approach_id uuid
    references public.approaches (id) on delete set null,
  add column if not exists framework_id uuid
    references public.frameworks (id) on delete set null,
  add column if not exists requested_by uuid
    references auth.users (id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pillar_generation_jobs'
      and column_name = 'created_by'
  ) then
    execute $sql$
      update public.pillar_generation_jobs
      set requested_by = created_by
      where requested_by is null
        and created_by is not null
    $sql$;
  end if;
end
$$;

-- Keep the legacy generic-queue actor column and the specialized requester
-- column synchronized. The trigger is installed only on legacy tables that
-- still expose created_by.
create or replace function public.sync_pillar_generation_job_requester()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.requested_by is null then
    new.requested_by := new.created_by;
  end if;

  if new.created_by is null then
    new.created_by := new.requested_by;
  end if;

  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pillar_generation_jobs'
      and column_name = 'created_by'
  ) then
    execute 'drop trigger if exists sync_pillar_generation_job_requester
      on public.pillar_generation_jobs';
    execute 'create trigger sync_pillar_generation_job_requester
      before insert or update of requested_by, created_by
      on public.pillar_generation_jobs
      for each row execute function
      public.sync_pillar_generation_job_requester()';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from public.pillar_generation_jobs
    where requested_by is null
  ) then
    alter table public.pillar_generation_jobs
      alter column requested_by set not null;
  end if;
end
$$;

create index if not exists idx_pillar_generation_jobs_approach_id
  on public.pillar_generation_jobs (approach_id);

create index if not exists idx_pillar_generation_jobs_framework_id
  on public.pillar_generation_jobs (framework_id);

notify pgrst, 'reload schema';
