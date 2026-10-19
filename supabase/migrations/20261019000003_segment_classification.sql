-- ---------------------------------------------------------------------------
-- Classification des segments par pilier et par variable observable, et
-- couverture du cadre (note de décision « Masse critique », RG-5.5).
--
-- La couverture se lit avant tout run : la classification n'attend plus le
-- lancement d'une analyse. Elle suit le corpus et le cadre validé :
--   - à la validation du cadre, le worker calcule les vecteurs des piliers et
--     des variables (file public.framework_classifications) puis classe tout
--     le corpus de l'espace ;
--   - un document qui entre au corpus (indexé et conforme, ou intégré sur
--     décision humaine) est classé aussitôt, en SQL ; un document qui en sort
--     perd ses classifications.
--
-- Méthode (Algorithmes de calcul, étape 1) : similarité cosinus entre le
-- vecteur d'un segment et des « sondes » de chaque pilier : le texte du
-- pilier (nom et description) et chacune de ses variables (« pilier :
-- variable. description »). Le score d'un pilier est sa meilleure sonde ; un
-- segment est classé dans ses 2 meilleurs piliers au-dessus du seuil. Une
-- variable est couverte par un segment classé dans son pilier dont la
-- similarité avec la sonde de la variable dépasse son seuil.
--
-- Seuils : ceux de la spécification (0,5 / 0,7) ne conviennent pas au modèle
-- local (paraphrase-multilingual-mpnet) : un segment pertinent y obtient
-- 0,42 à 0,60 avec son pilier, un segment hors sujet moins de 0,30. Les
-- valeurs par défaut (0,40 / 0,50 / 0,40) viennent d'un échantillon réduit
-- et devront être recalibrées sur un corpus annoté. Ce sont des paramètres
-- journalisés de public.critical_mass_settings.
-- ---------------------------------------------------------------------------

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Paramètres de classification.
-- ---------------------------------------------------------------------------
alter table public.critical_mass_settings
  add column if not exists classification_min_similarity numeric(3, 2)
    not null default 0.40,
  add column if not exists classification_low_confidence numeric(3, 2)
    not null default 0.50,
  add column if not exists classification_max_pillars integer
    not null default 2,
  add column if not exists variable_min_similarity numeric(3, 2)
    not null default 0.40;

alter table public.critical_mass_settings
  drop constraint if exists critical_mass_settings_classification_check;
alter table public.critical_mass_settings
  add constraint critical_mass_settings_classification_check check (
    classification_min_similarity between 0 and 1
    and classification_low_confidence between classification_min_similarity and 1
    and classification_max_pillars between 1 and 5
    and variable_min_similarity between 0 and 1
  );

comment on column public.critical_mass_settings.classification_min_similarity is
  'Similarité minimale entre un segment et la meilleure sonde d''un pilier pour l''y classer.';
comment on column public.critical_mass_settings.classification_low_confidence is
  'Sous cette similarité, la classification est marquée « faible confiance ».';
comment on column public.critical_mass_settings.classification_max_pillars is
  'Nombre maximal de piliers par segment.';
comment on column public.critical_mass_settings.variable_min_similarity is
  'Similarité minimale entre un segment classé et la sonde d''une variable de son pilier pour la couvrir.';

-- ---------------------------------------------------------------------------
-- Sondes : texte à vectoriser pour chaque pilier et chaque variable.
-- ---------------------------------------------------------------------------
create or replace function public.framework_probe_texts(p_framework_id uuid)
returns table (
  pillar_id uuid,
  pillar_variable_id uuid,
  probe_text text,
  source_hash text
)
language sql
stable
set search_path = public
as $$
  with probes as (
    select
      pillar.id as pillar_id,
      null::uuid as pillar_variable_id,
      btrim(pillar.name) || '. ' || btrim(pillar.description) as probe_text
    from public.pillars as pillar
    where pillar.framework_id = p_framework_id
    union all
    select
      pillar.id,
      variable.id,
      btrim(pillar.name) || ' : ' || btrim(variable.label)
        || coalesce('. ' || nullif(btrim(variable.description), ''), '')
    from public.pillar_variables as variable
    join public.pillars as pillar on pillar.id = variable.pillar_id
    where pillar.framework_id = p_framework_id
  )
  select pillar_id, pillar_variable_id, probe_text, md5(probe_text)
  from probes;
$$;

create table if not exists public.pillar_probe_embeddings (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.frameworks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  pillar_id uuid not null references public.pillars (id) on delete cascade,
  pillar_variable_id uuid
    references public.pillar_variables (id) on delete cascade,
  source_hash text not null,
  embedding vector(768) not null,
  model text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_pillar_probe_embeddings_probe
  on public.pillar_probe_embeddings (
    pillar_id,
    coalesce(pillar_variable_id, '00000000-0000-0000-0000-000000000000'::uuid),
    model
  );
create index if not exists idx_pillar_probe_embeddings_framework
  on public.pillar_probe_embeddings (framework_id, model);

comment on table public.pillar_probe_embeddings is
  'Vecteurs des sondes de classification : texte d''un pilier (pillar_variable_id null) ou d''une de ses variables.';

-- Cadre de référence de la classification : le dernier cadre validé.
create or replace function public.workspace_validated_framework(
  p_workspace_id uuid
)
returns uuid
language sql
stable
set search_path = public
as $$
  select id from public.frameworks
  where workspace_id = p_workspace_id and status = 'validated'
  order by version desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Classifications.
-- ---------------------------------------------------------------------------
create table if not exists public.segment_classifications (
  segment_id uuid not null references public.segments (id) on delete cascade,
  pillar_id uuid not null references public.pillars (id) on delete cascade,
  framework_id uuid not null references public.frameworks (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  confidence numeric(5, 4) not null,
  is_low_confidence boolean not null default false,
  rank integer not null,
  created_at timestamptz not null default now(),
  primary key (segment_id, pillar_id)
);

create index if not exists idx_segment_classifications_pillar
  on public.segment_classifications (pillar_id, document_id);
create index if not exists idx_segment_classifications_document
  on public.segment_classifications (document_id);

create table if not exists public.segment_variable_matches (
  segment_id uuid not null references public.segments (id) on delete cascade,
  pillar_variable_id uuid not null
    references public.pillar_variables (id) on delete cascade,
  pillar_id uuid not null references public.pillars (id) on delete cascade,
  framework_id uuid not null references public.frameworks (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  similarity numeric(5, 4) not null,
  created_at timestamptz not null default now(),
  primary key (segment_id, pillar_variable_id)
);

create index if not exists idx_segment_variable_matches_variable
  on public.segment_variable_matches (pillar_variable_id, document_id);
create index if not exists idx_segment_variable_matches_document
  on public.segment_variable_matches (document_id);

comment on table public.segment_classifications is
  'Segments classés par pilier du cadre validé (au plus classification_max_pillars par segment). Seuls ces segments alimentent les calculs.';
comment on table public.segment_variable_matches is
  'Variables observables couvertes par un segment classé dans leur pilier.';

-- Classe les segments publiés d'un document du corpus. Idempotente : les
-- classifications précédentes du document sont remplacées. Un document hors
-- corpus, ou un cadre sans sondes, ne laisse aucune classification.
create or replace function public.classify_document_segments(
  p_document_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target public.documents;
  framework uuid;
  settings public.critical_mass_settings;
  classified integer := 0;
begin
  delete from public.segment_variable_matches where document_id = p_document_id;
  delete from public.segment_classifications where document_id = p_document_id;

  select * into target from public.documents where id = p_document_id;
  if not found
    or target.deleted_at is not null
    or target.indexed_at is null
    or not public.document_is_eligible(target.status) then
    return 0;
  end if;
  framework := public.workspace_validated_framework(target.workspace_id);
  if framework is null then
    return 0;
  end if;
  settings := public.current_critical_mass_settings(target.workspace_id);

  -- Seules les sondes à jour du texte du cadre sont utilisées.
  if to_regclass('pg_temp.probe_scores') is null then
    create temporary table probe_scores (
      segment_id uuid,
      pillar_id uuid,
      pillar_variable_id uuid,
      similarity double precision
    ) on commit drop;
  else
    truncate pg_temp.probe_scores;
  end if;

  insert into pg_temp.probe_scores
  select
    segment.id,
    probe.pillar_id,
    probe.pillar_variable_id,
    1 - (embedding.embedding <=> probe.embedding)
  from public.segments as segment
  join public.segment_embeddings as embedding on embedding.segment_id = segment.id
  join public.pillar_probe_embeddings as probe
    on probe.framework_id = framework and probe.model = embedding.model
  join public.framework_probe_texts(framework) as current_probe
    on current_probe.pillar_id = probe.pillar_id
    and current_probe.pillar_variable_id is not distinct from probe.pillar_variable_id
    and current_probe.source_hash = probe.source_hash
  where segment.document_id = p_document_id and segment.published;

  insert into public.segment_classifications (
    segment_id, pillar_id, framework_id, document_id, workspace_id,
    confidence, is_low_confidence, rank
  )
  select
    ranked.segment_id, ranked.pillar_id, framework, p_document_id,
    target.workspace_id, round(ranked.score::numeric, 4),
    ranked.score < settings.classification_low_confidence, ranked.rank
  from (
    select
      segment_id,
      pillar_id,
      max(similarity) as score,
      row_number() over (
        partition by segment_id order by max(similarity) desc, pillar_id
      ) as rank
    from pg_temp.probe_scores
    group by segment_id, pillar_id
  ) as ranked
  where ranked.score >= settings.classification_min_similarity
    and ranked.rank <= settings.classification_max_pillars;
  get diagnostics classified = row_count;

  insert into public.segment_variable_matches (
    segment_id, pillar_variable_id, pillar_id, framework_id, document_id,
    workspace_id, similarity
  )
  select
    score.segment_id, score.pillar_variable_id, score.pillar_id, framework,
    p_document_id, target.workspace_id, round(score.similarity::numeric, 4)
  from pg_temp.probe_scores as score
  join public.segment_classifications as classification
    on classification.segment_id = score.segment_id
    and classification.pillar_id = score.pillar_id
  where score.pillar_variable_id is not null
    and score.similarity >= settings.variable_min_similarity;

  return classified;
end;
$$;

create or replace function public.classify_workspace_segments(
  p_workspace_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  document_id uuid;
  documents_count integer := 0;
begin
  delete from public.segment_variable_matches where workspace_id = p_workspace_id;
  delete from public.segment_classifications where workspace_id = p_workspace_id;
  for document_id in
    select id from public.documents
    where workspace_id = p_workspace_id
      and deleted_at is null
      and indexed_at is not null
      and public.document_is_eligible(status)
  loop
    perform public.classify_document_segments(document_id);
    documents_count := documents_count + 1;
  end loop;
  return documents_count;
end;
$$;

-- Entrée ou sortie du corpus : indexation publiée, décision humaine,
-- requalification, suppression.
create or replace function public.reclassify_document_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.classify_document_segments(new.id);
  return new;
end;
$$;

drop trigger if exists documents_reclassify on public.documents;
create trigger documents_reclassify
  after update of status, indexed_at, deleted_at on public.documents
  for each row
  when (
    old.status is distinct from new.status
    or old.indexed_at is distinct from new.indexed_at
    or old.deleted_at is distinct from new.deleted_at
  )
  execute function public.reclassify_document_on_change();

-- ---------------------------------------------------------------------------
-- File de vectorisation des cadres validés (worker d'ingestion).
-- ---------------------------------------------------------------------------
create table if not exists public.framework_classifications (
  framework_id uuid primary key references public.frameworks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  status text not null default 'pending',
  attempts integer not null default 0,
  lease_token uuid,
  locked_by text,
  locked_until timestamptz,
  model text,
  error_code text,
  error_message text,
  classified_documents integer,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint framework_classifications_status_check check (
    status in ('pending', 'running', 'completed', 'failed')
  )
);

comment on table public.framework_classifications is
  'Vectorisation des sondes du cadre validé et classification du corpus, exécutées par le worker.';

-- Un cadre est à (re)vectoriser tant qu'une de ses sondes n'a pas de vecteur
-- à jour pour le modèle du worker.
create or replace function public.framework_needs_embedding(
  p_framework_id uuid,
  p_model text
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.framework_probe_texts(p_framework_id) as current_probe
    where not exists (
      select 1 from public.pillar_probe_embeddings as probe
      where probe.pillar_id = current_probe.pillar_id
        and probe.pillar_variable_id is not distinct from current_probe.pillar_variable_id
        and probe.source_hash = current_probe.source_hash
        and probe.model = p_model
    )
  );
$$;

create or replace function public.claim_framework_classification(
  p_worker_id text,
  p_model text,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate record;
  claimed public.framework_classifications;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;

  for candidate in
    select framework.id, framework.workspace_id
    from public.frameworks as framework
    left join public.framework_classifications as job
      on job.framework_id = framework.id
    where framework.status = 'validated'
      and framework.id = public.workspace_validated_framework(framework.workspace_id)
      and (job.locked_until is null or job.locked_until < now())
      and (job.status is distinct from 'failed' or job.attempts < 5)
      and public.framework_needs_embedding(framework.id, p_model)
    order by framework.validated_at
    limit 5
  loop
    insert into public.framework_classifications (framework_id, workspace_id)
    values (candidate.id, candidate.workspace_id)
    on conflict (framework_id) do nothing;

    update public.framework_classifications
    set status = 'running',
        attempts = attempts + 1,
        lease_token = gen_random_uuid(),
        locked_by = p_worker_id,
        locked_until = now() + make_interval(secs => p_lease_seconds),
        model = p_model,
        error_code = null,
        error_message = null,
        updated_at = now()
    where framework_id = candidate.id
      and (locked_until is null or locked_until < now())
    returning * into claimed;

    if found then
      return jsonb_build_object(
        'framework_id', claimed.framework_id,
        'workspace_id', claimed.workspace_id,
        'lease_token', claimed.lease_token,
        'probes', coalesce((
          select jsonb_agg(jsonb_build_object(
            'pillar_id', probe.pillar_id,
            'pillar_variable_id', probe.pillar_variable_id,
            'text', probe.probe_text,
            'source_hash', probe.source_hash
          ))
          from public.framework_probe_texts(claimed.framework_id) as probe
        ), '[]'::jsonb)
      );
    end if;
  end loop;
  return null;
end;
$$;

-- Enregistre les vecteurs des sondes puis classe tout le corpus de l'espace.
-- Les sondes dont le texte a changé depuis la prise sont ignorées : le cadre
-- sera repris au prochain passage.
create or replace function public.complete_framework_classification(
  p_framework_id uuid,
  p_lease_token uuid,
  p_model text,
  p_probes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  job public.framework_classifications;
  stored integer;
  documents_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  select * into job from public.framework_classifications
  where framework_id = p_framework_id
  for update;
  if not found or job.lease_token is distinct from p_lease_token then
    raise exception using errcode = 'P0001', message = 'CLASSIFICATION_LEASE_LOST';
  end if;

  delete from public.pillar_probe_embeddings
  where framework_id = p_framework_id and model = p_model;

  insert into public.pillar_probe_embeddings (
    framework_id, workspace_id, pillar_id, pillar_variable_id, source_hash,
    embedding, model
  )
  select
    p_framework_id, job.workspace_id, current_probe.pillar_id,
    current_probe.pillar_variable_id, current_probe.source_hash,
    (item ->> 'embedding')::vector, p_model
  from jsonb_array_elements(p_probes) as item
  join public.framework_probe_texts(p_framework_id) as current_probe
    on current_probe.pillar_id = (item ->> 'pillar_id')::uuid
    and current_probe.pillar_variable_id
      is not distinct from (item ->> 'pillar_variable_id')::uuid
    and current_probe.source_hash = item ->> 'source_hash';
  get diagnostics stored = row_count;

  documents_count := public.classify_workspace_segments(job.workspace_id);

  update public.framework_classifications
  set status = 'completed',
      lease_token = null,
      locked_by = null,
      locked_until = null,
      attempts = 0,
      classified_documents = documents_count,
      completed_at = now(),
      updated_at = now()
  where framework_id = p_framework_id;

  insert into public.audit_events (
    workspace_id, actor_type, operation, object_type, object_id, metadata
  )
  values (
    job.workspace_id, 'engine', 'corpus_classified', 'framework',
    p_framework_id,
    jsonb_build_object(
      'model', p_model, 'probes', stored, 'documents', documents_count
    )
  );

  return jsonb_build_object('probes', stored, 'documents', documents_count);
end;
$$;

create or replace function public.fail_framework_classification(
  p_framework_id uuid,
  p_lease_token uuid,
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
  -- Nouvel essai après un délai croissant ; abandon après 5 échecs.
  update public.framework_classifications
  set status = 'failed',
      lease_token = null,
      locked_by = null,
      locked_until = now() + make_interval(mins => attempts * attempts),
      error_code = left(p_error_code, 80),
      error_message = left(p_error_message, 500),
      updated_at = now()
  where framework_id = p_framework_id and lease_token = p_lease_token;
end;
$$;

-- ---------------------------------------------------------------------------
-- Couverture du cadre (RG-5.5) : sources indépendantes, c'est-à-dire
-- documents distincts du corpus, par pilier et par variable du cadre validé.
-- ---------------------------------------------------------------------------
create or replace function public.critical_mass_coverage(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  framework uuid;
  job public.framework_classifications;
  pending boolean;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception using errcode = '42501', message = 'WORKSPACE_MEMBER_REQUIRED';
  end if;
  framework := public.workspace_validated_framework(p_workspace_id);
  if framework is null then
    return jsonb_build_object('state', 'no_framework');
  end if;
  select * into job from public.framework_classifications
  where framework_id = framework;
  -- Une sonde sans vecteur à jour, quel que soit le modèle : la couverture
  -- n'est pas encore calculable.
  select exists (
    select 1 from public.framework_probe_texts(framework) as current_probe
    where not exists (
      select 1 from public.pillar_probe_embeddings as probe
      where probe.pillar_id = current_probe.pillar_id
        and probe.pillar_variable_id is not distinct from current_probe.pillar_variable_id
        and probe.source_hash = current_probe.source_hash
    )
  ) into pending;

  return jsonb_build_object(
    'state', case
      when not pending then 'ready'
      when job.status = 'failed' and job.attempts >= 5 then 'failed'
      else 'pending'
    end,
    'framework_id', framework,
    'pillars', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pillar_id', pillar.id,
        'sources', (
          select count(distinct classification.document_id)
          from public.segment_classifications as classification
          where classification.pillar_id = pillar.id
        )
      ) order by pillar.order_index)
      from public.pillars as pillar
      where pillar.framework_id = framework
    ), '[]'::jsonb),
    'variables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pillar_variable_id', variable.id,
        'pillar_id', variable.pillar_id,
        'sources', (
          select count(distinct match.document_id)
          from public.segment_variable_matches as match
          where match.pillar_variable_id = variable.id
        )
      ) order by pillar.order_index, variable.order_index)
      from public.pillar_variables as variable
      join public.pillars as pillar on pillar.id = variable.pillar_id
      where pillar.framework_id = framework
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits.
-- ---------------------------------------------------------------------------
alter table public.pillar_probe_embeddings enable row level security;
alter table public.framework_classifications enable row level security;
alter table public.segment_classifications enable row level security;
alter table public.segment_variable_matches enable row level security;

drop policy if exists "framework_classifications_members"
  on public.framework_classifications;
create policy "framework_classifications_members"
  on public.framework_classifications
  for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists "segment_classifications_members"
  on public.segment_classifications;
create policy "segment_classifications_members"
  on public.segment_classifications
  for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists "segment_variable_matches_members"
  on public.segment_variable_matches;
create policy "segment_variable_matches_members"
  on public.segment_variable_matches
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- Écriture réservée aux fonctions SECURITY DEFINER.
revoke insert, update, delete on public.pillar_probe_embeddings
  from anon, authenticated;
revoke insert, update, delete on public.framework_classifications
  from anon, authenticated;
revoke insert, update, delete on public.segment_classifications
  from anon, authenticated;
revoke insert, update, delete on public.segment_variable_matches
  from anon, authenticated;

revoke execute on function public.classify_document_segments(uuid)
  from public, anon, authenticated;
revoke execute on function public.classify_workspace_segments(uuid)
  from public, anon, authenticated;
revoke execute on function public.reclassify_document_on_change()
  from public, anon, authenticated;
revoke execute on function public.claim_framework_classification(text, text, integer)
  from public, anon, authenticated;
revoke execute on function public.complete_framework_classification(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.fail_framework_classification(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_framework_classification(text, text, integer)
  to service_role;
grant execute on function public.complete_framework_classification(uuid, uuid, text, jsonb)
  to service_role;
grant execute on function public.fail_framework_classification(uuid, uuid, text, text)
  to service_role;

revoke execute on function public.critical_mass_coverage(uuid) from public, anon;
grant execute on function public.critical_mass_coverage(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Paramètres : les seuils de classification rejoignent les champs
-- modifiables ; les changer reclasse le corpus de l'espace (sans recalcul
-- des vecteurs).
-- ---------------------------------------------------------------------------
create or replace function public.update_critical_mass_settings(
  p_workspace_id uuid,
  p_values jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  editable constant text[] := array[
    'exploratory_min_documents', 'standard_min_documents',
    'defensible_min_documents', 'min_independent_sources',
    'defensible_variable_coverage_pct', 'saturation_document_cap',
    'saturation_min_mean_relevance', 'classification_min_similarity',
    'classification_low_confidence', 'classification_max_pillars',
    'variable_min_similarity'
  ];
  system_fields constant text[] := array[
    'version', 'workspace_id', 'note', 'created_by', 'created_at'
  ];
  current_settings public.critical_mass_settings;
  next_settings public.critical_mass_settings;
  unknown_fields text[];
  reclassified integer := 0;
begin
  if actor is null or not public.is_workspace_admin(p_workspace_id) then
    raise exception using errcode = '42501', message = 'WORKSPACE_ADMIN_REQUIRED';
  end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object' then
    raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
  end if;
  select array_agg(key) into unknown_fields
  from jsonb_object_keys(p_values) as key
  where key <> all (editable);
  if unknown_fields is not null then
    raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS',
      detail = array_to_string(unknown_fields, ', ');
  end if;

  perform pg_advisory_xact_lock(
    hashtext('critical_mass_settings:' || p_workspace_id::text)
  );
  current_settings := public.current_critical_mass_settings(p_workspace_id);

  begin
    next_settings := jsonb_populate_record(current_settings, p_values);
  exception
    when invalid_text_representation or numeric_value_out_of_range
      or datatype_mismatch or invalid_parameter_value then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
  end;

  if to_jsonb(next_settings) - system_fields
    = to_jsonb(current_settings) - system_fields then
    return jsonb_build_object(
      'version', current_settings.version, 'changed', false, 'reclassified', 0
    );
  end if;

  begin
    insert into public.critical_mass_settings (
      workspace_id, exploratory_min_documents, standard_min_documents,
      defensible_min_documents, min_independent_sources,
      defensible_variable_coverage_pct, saturation_document_cap,
      saturation_min_mean_relevance, classification_min_similarity,
      classification_low_confidence, classification_max_pillars,
      variable_min_similarity, note, created_by
    )
    values (
      p_workspace_id, next_settings.exploratory_min_documents,
      next_settings.standard_min_documents,
      next_settings.defensible_min_documents,
      next_settings.min_independent_sources,
      next_settings.defensible_variable_coverage_pct,
      next_settings.saturation_document_cap,
      next_settings.saturation_min_mean_relevance,
      next_settings.classification_min_similarity,
      next_settings.classification_low_confidence,
      next_settings.classification_max_pillars,
      next_settings.variable_min_similarity,
      nullif(btrim(p_note), ''), actor
    )
    returning * into next_settings;
  exception
    when check_violation or not_null_violation or numeric_value_out_of_range then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
  end;

  if (
    current_settings.classification_min_similarity,
    current_settings.classification_low_confidence,
    current_settings.classification_max_pillars,
    current_settings.variable_min_similarity
  ) is distinct from (
    next_settings.classification_min_similarity,
    next_settings.classification_low_confidence,
    next_settings.classification_max_pillars,
    next_settings.variable_min_similarity
  ) then
    reclassified := public.classify_workspace_segments(p_workspace_id);
  end if;

  insert into public.audit_events (
    workspace_id, actor_type, actor_user_id, operation, object_type,
    before_value, after_value, metadata
  )
  values (
    p_workspace_id, 'human', actor, 'critical_mass_settings_updated',
    'critical_mass_settings',
    to_jsonb(current_settings) - system_fields,
    to_jsonb(next_settings) - system_fields,
    jsonb_build_object(
      'version', next_settings.version,
      'previous_version', current_settings.version,
      'reason', next_settings.note,
      'reclassified', reclassified
    )
  );

  return jsonb_build_object(
    'version', next_settings.version, 'changed', true,
    'reclassified', reclassified
  );
end;
$$;

revoke execute on function public.update_critical_mass_settings(uuid, jsonb, text)
  from public, anon;
grant execute on function public.update_critical_mass_settings(uuid, jsonb, text)
  to authenticated;

-- Corpus déjà présent : classé dès que le worker aura vectorisé les cadres
-- validés (aucune sonde n'existe encore).
