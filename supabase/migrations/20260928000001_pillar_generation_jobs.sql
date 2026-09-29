create table if not exists public.pillar_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  approach_id uuid references public.approaches (id) on delete set null,
  framework_id uuid references public.frameworks (id) on delete set null,
  status text not null default 'queued',
  requested_by uuid not null references auth.users (id),
  attempts integer not null default 0,
  error_message text,
  result jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint pillar_generation_jobs_status_check check (
    status in ('queued', 'running', 'completed', 'failed', 'cancelled')
  ),
  constraint pillar_generation_jobs_attempts_check check (attempts >= 0),
  constraint pillar_generation_jobs_result_object_check check (
    result is null or jsonb_typeof(result) = 'object'
  )
);

-- Reconcile installations where the generic jobs table predates this
-- specialized pillar-generation migration.
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

create index if not exists idx_pillar_generation_jobs_workspace_created
  on public.pillar_generation_jobs (workspace_id, created_at desc);

create index if not exists idx_pillar_generation_jobs_status_created
  on public.pillar_generation_jobs (status, created_at);

create unique index if not exists idx_pillar_generation_jobs_one_active
  on public.pillar_generation_jobs (workspace_id)
  where status in ('queued', 'running');

drop trigger if exists set_pillar_generation_jobs_updated_at
  on public.pillar_generation_jobs;
create trigger set_pillar_generation_jobs_updated_at
before update on public.pillar_generation_jobs
for each row execute function public.set_updated_at();

alter table public.pillar_generation_jobs enable row level security;

drop policy if exists "pillar_generation_jobs_select_members"
  on public.pillar_generation_jobs;
create policy "pillar_generation_jobs_select_members"
  on public.pillar_generation_jobs
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create or replace function public.enqueue_pillar_generation(
  target_workspace_id uuid
)
returns public.pillar_generation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  current_job public.pillar_generation_jobs;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Workspace access denied' using errcode = '42501';
  end if;

  select job.*
  into current_job
  from public.pillar_generation_jobs as job
  where job.workspace_id = target_workspace_id
    and job.status in ('queued', 'running')
  order by job.created_at desc
  limit 1;

  if found then
    return current_job;
  end if;

  -- Older installations used a generic queue with a required created_by
  -- column. Populate both actor columns when that legacy column is present.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pillar_generation_jobs'
      and column_name = 'created_by'
  ) then
    execute $insert$
      insert into public.pillar_generation_jobs (
        workspace_id,
        approach_id,
        requested_by,
        created_by
      )
      values (
        $1,
        (
          select approach.id
          from public.approaches as approach
          where approach.workspace_id = $1
            and approach.status = 'confirmed'
          order by approach.version desc
          limit 1
        ),
        $2,
        $2
      )
      returning *
    $insert$
    using target_workspace_id, auth.uid()
    into current_job;
  else
    insert into public.pillar_generation_jobs (
      workspace_id,
      approach_id,
      requested_by
    )
    values (
      target_workspace_id,
      (
        select approach.id
        from public.approaches as approach
        where approach.workspace_id = target_workspace_id
          and approach.status = 'confirmed'
        order by approach.version desc
        limit 1
      ),
      auth.uid()
    )
    returning * into current_job;
  end if;

  return current_job;
exception
  when unique_violation then
    select job.*
    into current_job
    from public.pillar_generation_jobs as job
    where job.workspace_id = target_workspace_id
      and job.status in ('queued', 'running')
    order by job.created_at desc
    limit 1;
    return current_job;
end;
$$;

revoke all on function public.enqueue_pillar_generation(uuid) from public;
grant execute on function public.enqueue_pillar_generation(uuid)
  to authenticated, service_role;

create or replace function public.start_pillar_generation(
  target_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  update public.pillar_generation_jobs
  set
    status = 'running',
    attempts = attempts + 1,
    error_message = null,
    started_at = now(),
    completed_at = null
  where id = target_job_id
    and status in ('queued', 'failed');

  if not found then
    raise exception 'Pillar generation job cannot be started';
  end if;
end;
$$;

revoke all on function public.start_pillar_generation(uuid) from public;
grant execute on function public.start_pillar_generation(uuid)
  to service_role;

create or replace function public.persist_generated_pillars(
  target_workspace_id uuid,
  target_approach_id uuid,
  generation_result jsonb,
  target_job_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_framework_id uuid;
  next_version integer;
  pillar_record record;
  target_pillar_id uuid;
  target_ref_pillar_id uuid;
  variable_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  if jsonb_typeof(generation_result) <> 'object'
    or jsonb_typeof(generation_result -> 'pillars') <> 'array'
    or jsonb_array_length(generation_result -> 'pillars') not between 5 and 8 then
    raise exception 'Invalid generated pillars payload';
  end if;

  if (
    select coalesce(sum((pillar.value ->> 'weight')::numeric), 0)
    from jsonb_array_elements(generation_result -> 'pillars') as pillar(value)
  ) <> 100 then
    raise exception 'Generated pillar weights must total 100';
  end if;

  perform 1
  from public.approaches as approach
  where approach.id = target_approach_id
    and approach.workspace_id = target_workspace_id
    and approach.status = 'confirmed';
  if not found then
    raise exception 'Confirmed approach not found';
  end if;

  if target_job_id is not null then
    select job.framework_id
    into target_framework_id
    from public.pillar_generation_jobs as job
    where job.id = target_job_id
      and job.workspace_id = target_workspace_id
    for update;

    if not found then
      raise exception 'Pillar generation job not found';
    end if;

    if target_framework_id is not null then
      return target_framework_id;
    end if;
  end if;

  perform 1
  from public.workspaces
  where id = target_workspace_id
  for update;

  select framework.id
  into target_framework_id
  from public.frameworks as framework
  where framework.workspace_id = target_workspace_id
    and framework.approach_id = target_approach_id
    and framework.status = 'draft'
  order by framework.version desc
  limit 1;

  if target_framework_id is null then
    select coalesce(max(framework.version), 0) + 1
    into next_version
    from public.frameworks as framework
    where framework.workspace_id = target_workspace_id;

    insert into public.frameworks (
      workspace_id,
      approach_id,
      version,
      status
    )
    values (
      target_workspace_id,
      target_approach_id,
      next_version,
      'draft'
    )
    returning id into target_framework_id;
  else
    delete from public.pillars
    where framework_id = target_framework_id;

    delete from public.criteria
    where framework_id = target_framework_id;
  end if;

  insert into public.criteria (
    framework_id,
    code,
    name,
    definition,
    applicability,
    weight,
    origin
  )
  select
    target_framework_id,
    reference.code,
    reference.label,
    reference.description,
    approach_criterion.applicability,
    approach_criterion.weight,
    'referential'
  from public.approach_criteria as approach_criterion
  join public.ref_criteria as reference
    on reference.id = approach_criterion.ref_criterion_id
  where approach_criterion.approach_id = target_approach_id;

  for pillar_record in
    select value, ordinality
    from jsonb_array_elements(generation_result -> 'pillars')
      with ordinality
  loop
    if jsonb_typeof(pillar_record.value -> 'observable_variables') <> 'array'
      or jsonb_array_length(
        pillar_record.value -> 'observable_variables'
      ) = 0 then
      raise exception 'Every pillar must contain observable variables';
    end if;

    target_ref_pillar_id := null;
    if pillar_record.value ->> 'ref_pillar_code' <> 'new' then
      select reference.id
      into target_ref_pillar_id
      from public.ref_pillars as reference
      where reference.code = pillar_record.value ->> 'ref_pillar_code'
      order by reference.created_at desc
      limit 1;
    end if;

    insert into public.pillars (
      framework_id,
      ref_pillar_id,
      name,
      description,
      weight,
      order_index,
      origin
    )
    values (
      target_framework_id,
      target_ref_pillar_id,
      pillar_record.value ->> 'name',
      pillar_record.value ->> 'description',
      (pillar_record.value ->> 'weight')::numeric,
      pillar_record.ordinality,
      case
        when target_ref_pillar_id is null then 'new'
        else 'referential'
      end
    )
    returning id into target_pillar_id;

    variable_count := jsonb_array_length(
      pillar_record.value -> 'observable_variables'
    );

    insert into public.pillar_variables (
      pillar_id,
      code,
      label,
      description,
      weight,
      order_index
    )
    select
      target_pillar_id,
      variable.value ->> 'code',
      variable.value ->> 'label',
      nullif(variable.value ->> 'description', ''),
      round(100.0 / variable_count, 2),
      variable.ordinality
    from jsonb_array_elements(pillar_record.value -> 'observable_variables')
      with ordinality as variable(value, ordinality);

    insert into public.pillar_criteria (pillar_id, criterion_id)
    select target_pillar_id, criterion.id
    from public.criteria as criterion
    where criterion.framework_id = target_framework_id
      and criterion.code in (
        select jsonb_array_elements_text(
          pillar_record.value -> 'criteria_codes'
        )
      );
  end loop;

  if target_job_id is not null then
    update public.pillar_generation_jobs
    set
      approach_id = target_approach_id,
      framework_id = target_framework_id,
      status = 'completed',
      result = generation_result,
      error_message = null,
      started_at = coalesce(started_at, now()),
      completed_at = now()
    where id = target_job_id;
  end if;

  return target_framework_id;
end;
$$;

revoke all on function public.persist_generated_pillars(uuid, uuid, jsonb, uuid)
  from public;
grant execute on function public.persist_generated_pillars(uuid, uuid, jsonb, uuid)
  to service_role;

create or replace function public.fail_pillar_generation(
  target_job_id uuid,
  failure_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  update public.pillar_generation_jobs
  set
    status = 'failed',
    error_message = left(failure_message, 2000),
    completed_at = now()
  where id = target_job_id
    and status in ('queued', 'running');
end;
$$;

revoke all on function public.fail_pillar_generation(uuid, text) from public;
grant execute on function public.fail_pillar_generation(uuid, text)
  to service_role;
