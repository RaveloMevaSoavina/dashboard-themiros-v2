-- ---------------------------------------------------------------------------
-- Runs d'analyse (E6) et résultats de la couche A (Schéma de base de données
-- §22 à 27).
--
-- Un run fige au lancement le cadre validé, l'approche, les paramètres de
-- masse critique et le corpus (public.run_documents : ajout par rapport à la
-- spec, pour rejouer un run et signaler un corpus modifié, CA-6.2). Le worker
-- le prend en file comme les classifications (bail, nouvel essai) puis écrit
-- les résultats ; un run terminé ou échoué est immuable (RG-6.3, RG-10.2).
--
-- Écarts à la spec :
--   - layer_a_scores.score peut être null : sans variable renseignée,
--     l'algorithme ne produit pas de score (Algorithmes de calcul §4) ;
--   - les références à un document supprimé définitivement passent à null :
--     le run garde le nom, le hash et les extraits du document ;
--   - les statuts sont des colonnes text contraintes, comme
--     framework_classifications.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Niveau de masse critique (note de décision §3) : même règle que
-- assessCriticalMass côté front. Exploratoire sur le seul plancher ; Standard
-- si tous les piliers ont assez de sources indépendantes ; Défendable si, en
-- plus, assez de variables en ont. Sans couverture calculée, le niveau
-- s'arrête à Exploratoire.
-- ---------------------------------------------------------------------------
create or replace function public.critical_mass_level(
  p_counted integer,
  p_coverage jsonb,
  p_settings public.critical_mass_settings
)
returns text
language sql
immutable
set search_path = public
as $$
  with items as (
    select
      coalesce(p_coverage ->> 'state' = 'ready', false) as ready,
      coalesce(p_coverage -> 'pillars', '[]'::jsonb) as pillars,
      coalesce(p_coverage -> 'variables', '[]'::jsonb) as variables
  ),
  coverage as (
    select
      ready,
      jsonb_array_length(pillars) as pillars_total,
      (
        select count(*) from jsonb_array_elements(pillars) as item
        where (item ->> 'sources')::integer < p_settings.min_independent_sources
      ) as weak_pillars,
      jsonb_array_length(variables) as variables_total,
      (
        select count(*) from jsonb_array_elements(variables) as item
        where (item ->> 'sources')::integer >= p_settings.min_independent_sources
      ) as covered_variables
    from items
  ),
  conditions as (
    select
      ready and pillars_total > 0 and weak_pillars = 0 as standard_coverage,
      ready and variables_total > 0
        and covered_variables >= ceil(
          variables_total * p_settings.defensible_variable_coverage_pct / 100.0
        ) as variables_coverage
    from coverage
  )
  select case
    when p_counted < p_settings.exploratory_min_documents then null
    when p_counted >= p_settings.defensible_min_documents
      and standard_coverage and variables_coverage then 'defendable'
    when p_counted >= p_settings.standard_min_documents
      and standard_coverage then 'standard'
    else 'exploratoire'
  end
  from conditions;
$$;

-- ---------------------------------------------------------------------------
-- Runs.
-- ---------------------------------------------------------------------------
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  framework_id uuid not null references public.frameworks (id),
  approach_id uuid not null references public.approaches (id),
  -- Version du moteur qui a pris le run en charge (GF-4).
  engine_version text,
  status text not null default 'pending',
  corpus_size integer not null,
  corpus_seuil text not null,
  -- Paramètres de masse critique, pondérations et seuils appliqués.
  rules_applied jsonb not null,
  attempts integer not null default 0,
  lease_token uuid,
  locked_by text,
  locked_until timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  validated_by uuid references auth.users (id) on delete set null,
  validated_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint runs_status_check check (
    status in ('pending', 'running', 'completed', 'failed')
  ),
  constraint runs_corpus_seuil_check check (
    corpus_seuil in ('exploratoire', 'standard', 'defendable')
  ),
  constraint runs_corpus_size_check check (corpus_size >= 0),
  constraint runs_attempts_check check (attempts >= 0),
  constraint runs_rules_applied_object_check check (
    jsonb_typeof(rules_applied) = 'object'
  ),
  constraint runs_engine_version_check check (
    status not in ('running', 'completed') or engine_version is not null
  ),
  constraint runs_completed_at_check check (
    status not in ('completed', 'failed') or completed_at is not null
  )
);

create index if not exists idx_runs_workspace_created
  on public.runs (workspace_id, created_at desc);
create index if not exists idx_runs_queue
  on public.runs (created_at)
  where status in ('pending', 'running');
-- Un seul run en file ou en cours par espace.
create unique index if not exists idx_runs_one_active_per_workspace
  on public.runs (workspace_id)
  where status in ('pending', 'running');

comment on table public.runs is
  'Exécutions du pipeline d''analyse. Immuables une fois terminées ou échouées (RG-6.3).';
comment on column public.runs.corpus_seuil is
  'Niveau de masse critique atteint au lancement : exploratoire, standard ou defendable.';

-- Étapes nommées du pipeline (US-13.1), source de l'écran de suivi.
create table if not exists public.run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  step_name text not null,
  position integer not null,
  status text not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  output_summary jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  constraint run_steps_run_step_unique unique (run_id, step_name),
  constraint run_steps_step_name_check check (
    step_name in (
      'classification', 'variables', 'layer_a', 'layer_b', 'layer_c',
      'restitution'
    )
  ),
  -- skipped : étape non disponible dans cette version du moteur, ou non
  -- atteinte avant un échec.
  constraint run_steps_status_check check (
    status in ('pending', 'running', 'completed', 'failed', 'skipped')
  ),
  constraint run_steps_output_summary_object_check check (
    output_summary is null or jsonb_typeof(output_summary) = 'object'
  )
);

-- Corpus figé au lancement : une ligne par document et par version de
-- programme (un document peut documenter plusieurs versions).
create table if not exists public.run_documents (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  program_version_id uuid references public.program_versions (id),
  original_filename text not null,
  file_hash text not null,
  status public.document_status not null,
  relevance_score integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_run_documents_run
  on public.run_documents (run_id);
create index if not exists idx_run_documents_document
  on public.run_documents (document_id)
  where document_id is not null;
create unique index if not exists idx_run_documents_document_version
  on public.run_documents (
    run_id,
    document_id,
    coalesce(program_version_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

comment on table public.run_documents is
  'Documents du corpus au lancement du run, avec leur version de programme. Un document supprimé depuis garde son nom et son hash.';

-- ---------------------------------------------------------------------------
-- Résultats de la couche A.
-- ---------------------------------------------------------------------------
create table if not exists public.intermediate_variables (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  pillar_id uuid not null references public.pillars (id),
  variable_code text not null,
  program_version_id uuid not null references public.program_versions (id),
  value numeric(3, 2),
  state text not null,
  documents_count integer not null default 0,
  corpus_confidence numeric(5, 4),
  created_at timestamptz not null default now(),
  constraint intermediate_variables_unique
    unique (run_id, pillar_id, variable_code, program_version_id),
  constraint intermediate_variables_state_check check (
    (state = 'present' and value = 1)
    or (state = 'partiel' and value = 0.5)
    or (state = 'absent' and value = 0)
    or (state = 'non_renseigne' and value is null)
  ),
  constraint intermediate_variables_documents_count_check check (
    documents_count >= 0
  ),
  constraint intermediate_variables_confidence_check check (
    corpus_confidence is null or corpus_confidence between 0 and 1
  )
);

create index if not exists idx_intermediate_variables_run_pillar
  on public.intermediate_variables (run_id, pillar_id, variable_code);

create table if not exists public.evidences (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  segment_id uuid references public.segments (id) on delete set null,
  page_number integer,
  section_title text,
  excerpt text not null,
  pillar_id uuid references public.pillars (id),
  criterion_id uuid references public.criteria (id),
  variable_code text,
  -- Similarité du segment avec la sonde de la variable (couche A).
  similarity numeric(5, 4),
  created_at timestamptz not null default now(),
  constraint evidences_excerpt_not_blank check (btrim(excerpt) <> ''),
  constraint evidences_similarity_check check (
    similarity is null or similarity between -1 and 1
  )
);

create index if not exists idx_evidences_run_document
  on public.evidences (run_id, document_id);
create index if not exists idx_evidences_run_pillar
  on public.evidences (run_id, pillar_id);
create index if not exists idx_evidences_run_criterion
  on public.evidences (run_id, criterion_id)
  where criterion_id is not null;
create index if not exists idx_evidences_document
  on public.evidences (document_id)
  where document_id is not null;
create index if not exists idx_evidences_segment
  on public.evidences (segment_id)
  where segment_id is not null;

create table if not exists public.variable_evidences (
  variable_id uuid not null
    references public.intermediate_variables (id) on delete cascade,
  evidence_id uuid not null references public.evidences (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (variable_id, evidence_id)
);

create index if not exists idx_variable_evidences_evidence
  on public.variable_evidences (evidence_id);

create table if not exists public.layer_a_scores (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  pillar_id uuid not null references public.pillars (id),
  program_version_id uuid not null references public.program_versions (id),
  -- Null : aucune variable renseignée pour ce pilier et cette version.
  score numeric(5, 2),
  delta numeric(5, 2),
  evolution_label text,
  corpus_confidence numeric(5, 4) not null,
  documents_count integer not null,
  created_at timestamptz not null default now(),
  constraint layer_a_scores_unique unique (run_id, pillar_id, program_version_id),
  constraint layer_a_scores_score_check check (score is null or score between 0 and 100),
  constraint layer_a_scores_evolution_check check (
    evolution_label is null
    or evolution_label in ('renforce', 'maintenu', 'affaibli')
  ),
  constraint layer_a_scores_confidence_check check (
    corpus_confidence between 0 and 1
  ),
  constraint layer_a_scores_documents_count_check check (documents_count >= 0)
);

create index if not exists idx_layer_a_scores_pillar
  on public.layer_a_scores (pillar_id);

comment on table public.intermediate_variables is
  'Variables observables par pilier et par version : valeur 1, 0,5, 0 ou non renseignée.';
comment on table public.layer_a_scores is
  'Scores objectivés par pilier et par version (Σ poids × valeur / Σ poids × 100). Jamais modifiés (RG-10.2).';

-- ---------------------------------------------------------------------------
-- Immuabilité (RG-6.3, RG-10.2).
--
-- Un run terminé ou échoué ne change plus, ses résultats non plus. Seules
-- exceptions : la validation humaine, et les références passées à null par
-- la suppression d'un document ou d'un utilisateur. La suppression d'un
-- espace emporte ses runs : la ligne parente a alors déjà disparu.
-- ---------------------------------------------------------------------------
create or replace function public.guard_run_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  released constant text[] := array['validated_by', 'validated_at', 'created_by'];
begin
  if old.status not in ('completed', 'failed') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from public.workspaces where id = old.workspace_id) then
      raise exception using errcode = 'P0001', message = 'RUN_IMMUTABLE';
    end if;
    return old;
  end if;
  if to_jsonb(new) - released <> to_jsonb(old) - released
    or (new.created_by is not null and new.created_by is distinct from old.created_by) then
    raise exception using errcode = 'P0001', message = 'RUN_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists runs_immutable on public.runs;
create trigger runs_immutable
  before update or delete on public.runs
  for each row execute function public.guard_run_immutability();

create or replace function public.guard_run_results()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  released constant text[] := array['document_id', 'segment_id'];
  row_data jsonb;
  target_run uuid;
  run_status text;
begin
  row_data := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  if tg_table_name = 'variable_evidences' then
    select run_id into target_run
    from public.intermediate_variables
    where id = (row_data ->> 'variable_id')::uuid;
  else
    target_run := (row_data ->> 'run_id')::uuid;
  end if;

  select status into run_status from public.runs where id = target_run;
  -- Run supprimé avec son espace, ou encore modifiable.
  if run_status is null or run_status in ('pending', 'running') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  -- Document ou segment supprimé définitivement : l'extrait reste.
  if tg_op = 'UPDATE'
    and to_jsonb(new) - released = to_jsonb(old) - released
    and (to_jsonb(new) ->> 'document_id' is null
      or to_jsonb(new) ->> 'document_id' = to_jsonb(old) ->> 'document_id')
    and (to_jsonb(new) ->> 'segment_id' is null
      or to_jsonb(new) ->> 'segment_id' = to_jsonb(old) ->> 'segment_id') then
    return new;
  end if;
  raise exception using errcode = 'P0001', message = 'RUN_IMMUTABLE';
end;
$$;

do $$
declare
  result_table text;
begin
  foreach result_table in array array[
    'run_steps', 'run_documents', 'intermediate_variables', 'evidences',
    'variable_evidences', 'layer_a_scores'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      result_table || '_immutable', result_table
    );
    execute format(
      'create trigger %I before insert or update or delete on public.%I '
      'for each row execute function public.guard_run_results()',
      result_table || '_immutable', result_table
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lancement (E6, US-12.1 à 12.3).
-- ---------------------------------------------------------------------------
create or replace function public.create_run(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  framework public.frameworks;
  approach public.approaches;
  settings public.critical_mass_settings;
  incomplete_criteria text[];
  pending_documents integer;
  counted integer;
  level text;
  sole_version uuid;
  created public.runs;
begin
  if actor is null or not public.is_workspace_member(p_workspace_id) then
    raise exception using errcode = '42501', message = 'WORKSPACE_MEMBER_REQUIRED';
  end if;
  perform pg_advisory_xact_lock(hashtext('runs:' || p_workspace_id::text));

  select * into framework from public.frameworks
  where id = public.workspace_validated_framework(p_workspace_id);
  if not found then
    raise exception using errcode = 'P0001', message = 'FRAMEWORK_NOT_VALIDATED';
  end if;

  -- Approche confirmée, et au moins 3 sous-questions actives par critère
  -- obligatoire (RG-3b.2).
  select * into approach from public.approaches where id = framework.approach_id;
  select array_agg(criterion.code order by criterion.code)
  into incomplete_criteria
  from public.criteria as criterion
  where criterion.framework_id = framework.id
    and criterion.applicability = 'obligatoire'
    and (
      select count(*) from public.sub_questions as question
      where question.criterion_id = criterion.id and question.status = 'active'
    ) < 3;
  if approach.status is distinct from 'confirmed' or incomplete_criteria is not null then
    raise exception using errcode = 'P0001', message = 'CRITERIA_NOT_CONFIRMED',
      detail = coalesce(array_to_string(incomplete_criteria, ', '), '');
  end if;

  if exists (
    select 1 from public.runs
    where workspace_id = p_workspace_id and status in ('pending', 'running')
  ) then
    raise exception using errcode = 'P0001', message = 'RUN_ALREADY_ACTIVE';
  end if;

  -- Corpus : documents conformes ou intégrés sur décision humaine (RG-4.1),
  -- tous indexés (sinon leurs segments manqueraient au calcul).
  select
    count(*),
    count(*) filter (where indexed_at is null)
  into counted, pending_documents
  from public.documents
  where workspace_id = p_workspace_id
    and deleted_at is null
    and public.document_is_eligible(status);
  settings := public.current_critical_mass_settings(p_workspace_id);
  level := public.critical_mass_level(
    counted, public.critical_mass_coverage(p_workspace_id), settings
  );
  if level is null then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_CORPUS',
      detail = format('%s/%s', counted, settings.exploratory_min_documents);
  end if;
  if pending_documents > 0 then
    raise exception using errcode = 'P0001', message = 'CORPUS_NOT_READY',
      detail = pending_documents::text;
  end if;

  insert into public.runs (
    workspace_id, framework_id, approach_id, corpus_size, corpus_seuil,
    rules_applied, created_by
  )
  values (
    p_workspace_id, framework.id, approach.id, counted, level,
    jsonb_build_object(
      'critical_mass_settings',
      to_jsonb(settings) - array['workspace_id', 'note', 'created_by', 'created_at'],
      'pillars', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'pillar_id', pillar.id,
          'weight', pillar.weight,
          'variables', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'code', variable.code, 'weight', variable.weight
            ) order by variable.order_index), '[]'::jsonb)
            from public.pillar_variables as variable
            where variable.pillar_id = pillar.id
          )
        ) order by pillar.order_index), '[]'::jsonb)
        from public.pillars as pillar
        where pillar.framework_id = framework.id
      )
    ),
    actor
  )
  returning * into created;

  insert into public.run_steps (run_id, workspace_id, step_name, position)
  select created.id, p_workspace_id, step.name, step.position
  from unnest(array[
    'classification', 'variables', 'layer_a', 'layer_b', 'layer_c',
    'restitution'
  ]) with ordinality as step (name, position);

  -- Un document sans version est rattaché à la version unique de l'espace,
  -- s'il n'en a qu'une.
  select case when count(*) = 1 then (array_agg(id))[1] end
  into sole_version
  from public.program_versions
  where workspace_id = p_workspace_id;

  insert into public.run_documents (
    run_id, workspace_id, document_id, program_version_id, original_filename,
    file_hash, status, relevance_score
  )
  select
    created.id, p_workspace_id, document.id,
    coalesce(document_version.program_version_id, sole_version),
    document.original_filename, document.file_hash, document.status,
    document.relevance_score
  from public.documents as document
  left join public.document_versions as document_version
    on document_version.document_id = document.id
  where document.workspace_id = p_workspace_id
    and document.deleted_at is null
    and public.document_is_eligible(document.status);

  insert into public.audit_events (
    workspace_id, run_id, actor_type, actor_user_id, operation, object_type,
    object_id, after_value
  )
  values (
    p_workspace_id, created.id, 'human', actor, 'run_created', 'run',
    created.id,
    jsonb_build_object(
      'framework_id', framework.id,
      'corpus_size', counted,
      'corpus_seuil', level
    )
  );

  return jsonb_build_object(
    'run_id', created.id,
    'status', created.status,
    'corpus_size', created.corpus_size,
    'corpus_seuil', created.corpus_seuil,
    'created_at', created.created_at
  );
end;
$$;

-- Bandeau « le corpus a changé depuis ce calcul » (CA-6.2, US-13.4) : un
-- document est entré au corpus ou en est sorti depuis le lancement.
create or replace function public.run_corpus_changed(p_run_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  with run as (
    select workspace_id from public.runs where id = p_run_id
  ),
  current_corpus as (
    select document.id
    from public.documents as document, run
    where document.workspace_id = run.workspace_id
      and document.deleted_at is null
      and public.document_is_eligible(document.status)
  ),
  run_corpus as (
    select distinct document_id as id
    from public.run_documents
    where run_id = p_run_id
  )
  select exists (
    select id from current_corpus
    except select id from run_corpus
  ) or exists (
    select 1 from run_corpus
    where id is null or id not in (select id from current_corpus)
  );
$$;

-- ---------------------------------------------------------------------------
-- File des runs (worker de l'API).
-- ---------------------------------------------------------------------------

-- Clôt un run en échec : étapes non terminées marquées, résultats partiels
-- supprimés (RG-6.1 : un échec n'écrase rien et ne publie rien).
create or replace function public.close_failed_run(
  p_run_id uuid,
  p_step_name text,
  p_error_code text,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.runs;
begin
  select * into target from public.runs where id = p_run_id for update;
  if not found or target.status in ('completed', 'failed') then
    return;
  end if;

  delete from public.layer_a_scores where run_id = p_run_id;
  delete from public.intermediate_variables where run_id = p_run_id;
  delete from public.evidences where run_id = p_run_id;
  update public.run_steps
  set status = case
        when step_name = p_step_name or status = 'running' then 'failed'
        else 'skipped'
      end,
      error_message = case
        when step_name = p_step_name or status = 'running'
          then left(p_error_message, 500)
      end,
      completed_at = now()
  where run_id = p_run_id and status in ('pending', 'running');

  update public.runs
  set status = 'failed',
      lease_token = null,
      locked_by = null,
      locked_until = null,
      error_code = left(p_error_code, 80),
      error_message = left(p_error_message, 500),
      completed_at = now()
  where id = p_run_id;

  insert into public.audit_events (
    workspace_id, run_id, actor_type, operation, object_type, object_id,
    metadata
  )
  values (
    target.workspace_id, p_run_id, 'engine', 'run_failed', 'run', p_run_id,
    jsonb_build_object(
      'step', p_step_name,
      'error_code', left(p_error_code, 80),
      'engine_version', target.engine_version,
      'attempts', target.attempts
    )
  );
end;
$$;

-- Prend le plus ancien run en file, ou un run dont le worker a perdu son
-- bail ; ce dernier repart de zéro. Après 3 bails perdus, le run échoue.
create or replace function public.claim_run(
  p_worker_id text,
  p_engine_version text,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  stale uuid;
  claimed public.runs;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;

  for stale in
    select id from public.runs
    where status = 'running' and locked_until < now() and attempts >= 3
    for update skip locked
  loop
    perform public.close_failed_run(
      stale, null, 'RUN_LEASE_EXPIRED',
      'Le worker a perdu le run à chacune de ses 3 tentatives.'
    );
  end loop;

  select * into claimed from public.runs
  where status = 'pending'
    or (status = 'running' and locked_until < now())
  order by created_at
  limit 1
  for update skip locked;
  if not found then
    return null;
  end if;

  delete from public.layer_a_scores where run_id = claimed.id;
  delete from public.intermediate_variables where run_id = claimed.id;
  delete from public.evidences where run_id = claimed.id;
  update public.run_steps
  set status = 'pending', started_at = null, completed_at = null,
      output_summary = null, error_message = null
  where run_id = claimed.id;

  update public.runs
  set status = 'running',
      attempts = attempts + 1,
      lease_token = gen_random_uuid(),
      locked_by = p_worker_id,
      locked_until = now() + make_interval(secs => p_lease_seconds),
      engine_version = p_engine_version,
      started_at = coalesce(started_at, now())
  where id = claimed.id
  returning * into claimed;

  return jsonb_build_object(
    'run_id', claimed.id,
    'workspace_id', claimed.workspace_id,
    'framework_id', claimed.framework_id,
    'lease_token', claimed.lease_token,
    'attempts', claimed.attempts,
    'rules_applied', claimed.rules_applied
  );
end;
$$;

create or replace function public.assert_run_lease(
  p_run_id uuid,
  p_lease_token uuid
)
returns public.runs
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.runs;
begin
  select * into target from public.runs where id = p_run_id for update;
  if not found
    or target.status <> 'running'
    or target.lease_token is distinct from p_lease_token then
    raise exception using errcode = 'P0001', message = 'RUN_LEASE_LOST';
  end if;
  return target;
end;
$$;

-- Avancement d'une étape ; prolonge le bail.
create or replace function public.update_run_step(
  p_run_id uuid,
  p_lease_token uuid,
  p_step_name text,
  p_status text,
  p_output_summary jsonb default null,
  p_lease_seconds integer default 300
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_status not in ('running', 'completed', 'skipped') then
    raise exception using errcode = 'P0001', message = 'INVALID_STEP_STATUS';
  end if;
  perform public.assert_run_lease(p_run_id, p_lease_token);

  update public.run_steps
  set status = p_status,
      started_at = case
        when p_status = 'running' then now()
        else coalesce(started_at, now())
      end,
      completed_at = case when p_status <> 'running' then now() end,
      output_summary = coalesce(p_output_summary, output_summary)
  where run_id = p_run_id and step_name = p_step_name;
  if not found then
    raise exception using errcode = 'P0001', message = 'RUN_STEP_NOT_FOUND';
  end if;

  update public.runs
  set locked_until = now() + make_interval(secs => p_lease_seconds)
  where id = p_run_id;
end;
$$;

create or replace function public.fail_run(
  p_run_id uuid,
  p_lease_token uuid,
  p_step_name text,
  p_error_code text,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  perform public.assert_run_lease(p_run_id, p_lease_token);
  perform public.close_failed_run(
    p_run_id, p_step_name, p_error_code, p_error_message
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits : lecture par les membres de l'espace, écriture par les fonctions
-- ci-dessus et le worker.
-- ---------------------------------------------------------------------------
do $$
declare
  run_table text;
begin
  foreach run_table in array array[
    'runs', 'run_steps', 'run_documents', 'intermediate_variables',
    'evidences', 'layer_a_scores'
  ]
  loop
    execute format('alter table public.%I enable row level security', run_table);
    execute format(
      'drop policy if exists %I on public.%I', run_table || '_members', run_table
    );
    execute format(
      'create policy %I on public.%I for select to authenticated '
      'using (public.is_workspace_member(workspace_id))',
      run_table || '_members', run_table
    );
    execute format(
      'revoke insert, update, delete on public.%I from anon, authenticated',
      run_table
    );
  end loop;
end;
$$;

alter table public.variable_evidences enable row level security;
drop policy if exists "variable_evidences_members" on public.variable_evidences;
create policy "variable_evidences_members" on public.variable_evidences
  for select to authenticated
  using (
    exists (
      select 1 from public.intermediate_variables as variable
      where variable.id = variable_evidences.variable_id
        and public.is_workspace_member(variable.workspace_id)
    )
  );
revoke insert, update, delete on public.variable_evidences
  from anon, authenticated;

revoke execute on function public.guard_run_immutability()
  from public, anon, authenticated;
revoke execute on function public.guard_run_results()
  from public, anon, authenticated;
revoke execute on function public.close_failed_run(uuid, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.assert_run_lease(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.claim_run(text, text, integer)
  from public, anon, authenticated;
revoke execute on function public.update_run_step(uuid, uuid, text, text, jsonb, integer)
  from public, anon, authenticated;
revoke execute on function public.fail_run(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_run(text, text, integer) to service_role;
grant execute on function public.update_run_step(uuid, uuid, text, text, jsonb, integer)
  to service_role;
grant execute on function public.fail_run(uuid, uuid, text, text, text)
  to service_role;

revoke execute on function public.create_run(uuid) from public, anon;
grant execute on function public.create_run(uuid) to authenticated;
revoke execute on function public.run_corpus_changed(uuid) from public, anon;
grant execute on function public.run_corpus_changed(uuid) to authenticated;
revoke execute on function public.critical_mass_level(
  integer, jsonb, public.critical_mass_settings
) from public, anon;

-- Suivi de l'avancement en temps réel (US-13.2, US-13.3).
do $$
declare
  run_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach run_table in array array['runs', 'run_steps']
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = run_table
      ) then
        execute format(
          'alter publication supabase_realtime add table only public.%I',
          run_table
        );
      end if;
    end loop;
  end if;
end;
$$;

notify pgrst, 'reload schema';
