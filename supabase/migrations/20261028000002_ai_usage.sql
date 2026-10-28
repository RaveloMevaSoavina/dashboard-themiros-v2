-- ---------------------------------------------------------------------------
-- Consommation IA par espace : tokens facturés et coût de chaque appel à
-- OpenAI.
--
-- Jusqu'ici, seuls les appels de rédaction des runs (rules_applied, par
-- étape) et la génération du cadre (audit prompt_call, total seul) étaient
-- comptés ; les embeddings ne l'étaient pas du tout. ai_usage est le
-- registre unique : une ligne par traitement et par source.
--
--   - ingestion : embeddings d'un document (pertinence et indexation) ;
--   - classification : embeddings des sondes d'un cadre validé ;
--   - layer_b_search : embeddings des sous-questions d'un run ;
--   - layer_b, layer_c, restitution : rédaction par le modèle d'un run ;
--   - pillar_generation : génération du cadre (déclencheur ci-dessous).
--
-- Les tokens sont ceux que renvoie l'API (pas des estimations). Le coût est
-- calculé par l'API Themiros avec les tarifs de sa configuration
-- (OPENAI_*_COST_EUR_PER_MILLION) au moment de l'appel : 0 tant qu'ils ne
-- sont pas renseignés. input_tokens et output_tokens sont nuls quand le
-- détail est inconnu (générations antérieures à cette migration).
--
-- Écritures : le worker (clé serveur) et le déclencheur de la génération.
-- Lecture : membres de l'espace, par workspace_ai_usage. La ligne survit à
-- son run ou son document : la dépense a eu lieu.
-- ---------------------------------------------------------------------------

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  run_id uuid references public.runs (id) on delete set null,
  document_id uuid references public.documents (id) on delete set null,
  source text not null,
  kind text not null,
  model text,
  calls integer not null,
  input_tokens bigint,
  output_tokens bigint,
  total_tokens bigint not null,
  cost_eur numeric(14, 6) not null default 0,
  created_at timestamptz not null default now(),
  constraint ai_usage_source_check check (
    source in (
      'ingestion', 'classification', 'layer_b_search', 'layer_b', 'layer_c',
      'restitution', 'pillar_generation'
    )
  ),
  constraint ai_usage_kind_check check (kind in ('completion', 'embedding')),
  constraint ai_usage_counts_check check (
    calls >= 0 and total_tokens >= 0 and cost_eur >= 0
    and coalesce(input_tokens, 0) >= 0 and coalesce(output_tokens, 0) >= 0
  )
);

create index if not exists idx_ai_usage_workspace_created
  on public.ai_usage (workspace_id, created_at desc);
create index if not exists idx_ai_usage_run
  on public.ai_usage (run_id)
  where run_id is not null;
create index if not exists idx_ai_usage_document
  on public.ai_usage (document_id)
  where document_id is not null;

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_select_members" on public.ai_usage;
create policy "ai_usage_select_members" on public.ai_usage
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

revoke all on public.ai_usage from anon;
revoke insert, update, delete, truncate on public.ai_usage from authenticated;
grant select on public.ai_usage to authenticated;

comment on table public.ai_usage is
  'Consommation IA (tokens facturés, coût) par espace, run, document et source.';

-- ---------------------------------------------------------------------------
-- Génération du cadre : identique à 20261016000003, plus le détail
-- entrée / sortie et l'inscription au registre.
-- ---------------------------------------------------------------------------
create or replace function public.audit_completed_pillar_generation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prompt_id uuid;
  v_input bigint := (new.result ->> 'input_tokens')::bigint;
  v_output bigint := (new.result ->> 'output_tokens')::bigint;
  v_total bigint := coalesce((new.result ->> 'tokens_used')::bigint, 0);
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  select prompt.id
  into prompt_id
  from public.prompt_versions as prompt
  where prompt.code = 'generate_pillars'
    and prompt.code || '_' || prompt.version = coalesce(
      new.result ->> 'prompt_version',
      'generate_pillars_v1.0'
    )
  limit 1;

  insert into public.audit_events (
    workspace_id,
    actor_type,
    operation,
    object_type,
    object_id,
    after_value,
    metadata
  )
  values (
    new.workspace_id,
    'engine',
    'prompt_call',
    'prompt',
    prompt_id,
    jsonb_build_object(
      'pillars', new.result -> 'pillars',
      'rationale', new.result -> 'rationale'
    ),
    jsonb_build_object(
      'prompt_code', 'generate_pillars',
      'prompt_version', new.result ->> 'prompt_version',
      'model', new.result ->> 'model',
      'tokens', v_total,
      'input_tokens', v_input,
      'output_tokens', v_output,
      'cost', coalesce((new.result ->> 'cost_eur')::numeric, 0),
      'duration', coalesce((new.result ->> 'duration_ms')::integer, 0),
      'generation_mode', new.result ->> 'generation_mode',
      'fallback_reason', new.result ->> 'fallback_reason',
      'inputs_summary', new.result -> 'inputs_summary',
      'outputs_summary', jsonb_build_object(
        'pillar_count', jsonb_array_length(new.result -> 'pillars'),
        'rationale', new.result -> 'rationale'
      )
    )
  );

  -- Le gabarit de secours n'appelle aucun modèle.
  if v_total > 0 then
    insert into public.ai_usage (
      workspace_id, source, kind, model, calls, input_tokens, output_tokens,
      total_tokens, cost_eur
    )
    values (
      new.workspace_id,
      'pillar_generation',
      'completion',
      new.result ->> 'model',
      1,
      v_input,
      v_output,
      v_total,
      coalesce((new.result ->> 'cost_eur')::numeric, 0)
    );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reprise de l'historique : rédaction des runs (rules_applied) et
-- générations du cadre (journal). Les embeddings passés n'ont pas été
-- comptés et ne peuvent pas l'être.
-- ---------------------------------------------------------------------------
insert into public.ai_usage (
  workspace_id, run_id, source, kind, model, calls, input_tokens,
  output_tokens, total_tokens, cost_eur, created_at
)
select
  run.workspace_id,
  run.id,
  step.name,
  'completion',
  ai ->> 'model',
  (ai ->> 'calls')::integer,
  coalesce((ai ->> 'input_tokens')::bigint, 0),
  coalesce((ai ->> 'output_tokens')::bigint, 0),
  coalesce((ai ->> 'input_tokens')::bigint, 0)
    + coalesce((ai ->> 'output_tokens')::bigint, 0),
  coalesce((ai ->> 'cost_eur')::numeric, 0),
  coalesce(run.completed_at, run.created_at)
from public.runs as run
cross join lateral (
  values ('layer_b'), ('layer_c'), ('restitution')
) as step (name)
cross join lateral (
  select run.rules_applied #> array['engine', step.name, 'ai'] as ai
) as usage
where coalesce((usage.ai ->> 'calls')::integer, 0) > 0
  and not exists (
    select 1 from public.ai_usage as existing
    where existing.run_id = run.id and existing.source = step.name
  );

insert into public.ai_usage (
  workspace_id, source, kind, model, calls, input_tokens, output_tokens,
  total_tokens, cost_eur, created_at
)
select
  event.workspace_id,
  'pillar_generation',
  'completion',
  event.metadata ->> 'model',
  1,
  (event.metadata ->> 'input_tokens')::bigint,
  (event.metadata ->> 'output_tokens')::bigint,
  (event.metadata ->> 'tokens')::bigint,
  coalesce((event.metadata ->> 'cost')::numeric, 0),
  event.created_at
from public.audit_events as event
where event.operation = 'prompt_call'
  and event.metadata ->> 'prompt_code' = 'generate_pillars'
  and coalesce((event.metadata ->> 'tokens')::bigint, 0) > 0
  and not exists (
    select 1 from public.ai_usage as existing
    where existing.workspace_id = event.workspace_id
      and existing.source = 'pillar_generation'
      and existing.created_at = event.created_at
  );

-- ---------------------------------------------------------------------------
-- Lecture pour le dashboard : totaux de l'espace, par source et par run.
-- ---------------------------------------------------------------------------
create or replace function public.workspace_ai_usage(
  p_workspace_id uuid,
  p_runs integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception using errcode = 'P0001', message = 'WORKSPACE_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'total', (
      select jsonb_build_object(
        'calls', coalesce(sum(usage.calls), 0),
        'completion_tokens', coalesce(
          sum(usage.total_tokens) filter (where usage.kind = 'completion'), 0
        ),
        'embedding_tokens', coalesce(
          sum(usage.total_tokens) filter (where usage.kind = 'embedding'), 0
        ),
        'total_tokens', coalesce(sum(usage.total_tokens), 0),
        'cost_eur', coalesce(sum(usage.cost_eur), 0),
        'since', min(usage.created_at)
      )
      from public.ai_usage as usage
      where usage.workspace_id = p_workspace_id
    ),
    'sources', coalesce((
      select jsonb_agg(
        by_source order by by_source.cost_eur desc, by_source.total_tokens desc
      )
      from (
        select
          usage.source,
          usage.kind,
          string_agg(distinct usage.model, ', ') as models,
          sum(usage.calls) as calls,
          sum(usage.input_tokens) as input_tokens,
          sum(usage.output_tokens) as output_tokens,
          sum(usage.total_tokens) as total_tokens,
          sum(usage.cost_eur) as cost_eur,
          max(usage.created_at) as last_at
        from public.ai_usage as usage
        where usage.workspace_id = p_workspace_id
        group by usage.source, usage.kind
      ) as by_source
    ), '[]'::jsonb),
    'runs', coalesce((
      select jsonb_agg(run_usage order by run_usage.created_at desc)
      from (
        select
          run.id as run_id,
          run.created_at,
          run.status,
          sum(usage.calls) as calls,
          coalesce(
            sum(usage.total_tokens) filter (where usage.kind = 'completion'), 0
          ) as completion_tokens,
          coalesce(
            sum(usage.total_tokens) filter (where usage.kind = 'embedding'), 0
          ) as embedding_tokens,
          sum(usage.cost_eur) as cost_eur
        from public.ai_usage as usage
        join public.runs as run on run.id = usage.run_id
        where usage.workspace_id = p_workspace_id
        group by run.id
        order by run.created_at desc
        limit least(greatest(coalesce(p_runs, 20), 1), 100)
      ) as run_usage
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.workspace_ai_usage(uuid, integer) from public, anon;
grant execute on function public.workspace_ai_usage(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
