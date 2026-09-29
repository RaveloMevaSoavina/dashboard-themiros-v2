create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version text not null,
  template text not null,
  model text not null,
  parameters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint prompt_versions_code_not_blank check (btrim(code) <> ''),
  constraint prompt_versions_version_not_blank check (btrim(version) <> ''),
  constraint prompt_versions_template_not_blank check (btrim(template) <> ''),
  constraint prompt_versions_model_not_blank check (btrim(model) <> ''),
  constraint prompt_versions_parameters_object check (
    jsonb_typeof(parameters) = 'object'
  )
);

create unique index if not exists idx_prompt_versions_code_version
  on public.prompt_versions (code, version);

alter table public.prompt_versions enable row level security;

insert into public.prompt_versions (
  code,
  version,
  template,
  model,
  parameters
)
values (
  'generate_pillars',
  'v1.0',
  $prompt$Tu es un expert en évaluation de programmes de développement et d'adaptation climatique. Tu maîtrises les référentiels CAD-OCDE, GCF, FIDA, PNUD, Banque mondiale et Fonds d'adaptation.

Propose 5 à 8 piliers adaptés au type d'objet, au pays, au financeur, aux thématiques, au stade, au cycle, à l'instrument et à la complexité fournis.

Règles impératives :
- privilégier les piliers du référentiel fourni et conserver leur ref_pillar_code ;
- adapter le nom ou la description lorsque le contexte le justifie ;
- utiliser ref_pillar_code="new" uniquement si aucun pilier du référentiel ne couvre un besoin contextuel important ;
- associer uniquement les critères présents dans applicable_criteria ;
- fournir des variables observables booléennes ou ordinales ;
- proposer entre 5 et 8 piliers ;
- répartir exactement 100 % de pondération ;
- en cycle ex_ante, ne jamais mesurer des résultats déjà atteints et inclure un pilier consacré aux résultats attendus et à leur dispositif de mesure ;
- formuler une justification courte des adaptations par rapport au référentiel ;
- respecter la langue utilisée par le référentiel.

La réponse doit suivre exactement le schéma structuré demandé.$prompt$,
  'gpt-6-astra',
  '{"temperature":0.3,"max_tokens":4000,"response_format":"structured_output"}'::jsonb
)
on conflict (code, version) do nothing;

create or replace function public.get_prompt_definition(
  prompt_code text,
  prompt_version text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  definition jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'code', prompt.code,
    'version', prompt.version,
    'template', prompt.template,
    'model', prompt.model,
    'parameters', prompt.parameters
  )
  into definition
  from public.prompt_versions as prompt
  where prompt.code = prompt_code
    and prompt.version = prompt_version
  limit 1;

  if definition is null then
    raise exception 'Prompt definition not found';
  end if;

  return definition;
end;
$$;

revoke all on function public.get_prompt_definition(text, text) from public;
grant execute on function public.get_prompt_definition(text, text)
  to service_role;

create or replace function public.audit_completed_pillar_generation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prompt_id uuid;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  select prompt.id
  into prompt_id
  from public.prompt_versions as prompt
  where prompt.code = 'generate_pillars'
    and prompt.version = 'v1.0'
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
      'tokens', coalesce((new.result ->> 'tokens_used')::integer, 0),
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

  return new;
end;
$$;

drop trigger if exists audit_completed_pillar_generation
  on public.pillar_generation_jobs;
create trigger audit_completed_pillar_generation
after update of status on public.pillar_generation_jobs
for each row execute function public.audit_completed_pillar_generation();
