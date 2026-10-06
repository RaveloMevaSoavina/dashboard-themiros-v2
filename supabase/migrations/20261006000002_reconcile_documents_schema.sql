-- Réconciliation des bases créées avant les migrations du corpus.
--
-- Sur ces bases, `public.documents` existait déjà (schéma du pipeline v2) :
-- `create table if not exists` de 20260923000003 n'a rien fait. Il en reste
-- des colonnes obligatoires inconnues de `register_document` (`name`, `tags`),
-- et `status` / `category` stockés en texte au lieu des types
-- `document_status` / `document_category`. Les colonnes héritées sont gardées,
-- mais ne bloquent plus l'enregistrement d'un document.
--
-- Les vecteurs créés en 1536 dimensions (première version de 20261006000001)
-- passent à 768, la dimension du modèle local. Les embeddings d'un autre
-- modèle ne sont pas comparables : ils sont retirés et les documents
-- concernés sont remis en file d'indexation.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- documents : colonnes héritées obligatoires.
-- ---------------------------------------------------------------------------
do $$
declare
  column_name text;
begin
  for column_name in
    select attribute.attname
    from pg_attribute as attribute
    left join pg_attrdef as definition
      on definition.adrelid = attribute.attrelid
      and definition.adnum = attribute.attnum
    where attribute.attrelid = 'public.documents'::regclass
      and attribute.attnum > 0
      and not attribute.attisdropped
      and attribute.attnotnull
      and definition.adbin is null
      and attribute.attname not in (
        'id', 'workspace_id', 'original_filename', 'storage_path', 'file_hash',
        'file_size_bytes', 'mime_type', 'category', 'status'
      )
  loop
    execute format(
      'alter table public.documents alter column %I drop not null', column_name
    );
    raise notice 'documents.% n''est plus obligatoire (colonne héritée)', column_name;
  end loop;
end
$$;

alter table public.documents
  alter column status_reason_params set default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- documents.status et documents.category : texte → types de la spécification.
-- ---------------------------------------------------------------------------
do $$
declare
  status_type text;
  category_type text;
  blocking text;
  constraint_name text;
begin
  select format_type(atttypid, atttypmod) into status_type
  from pg_attribute
  where attrelid = 'public.documents'::regclass and attname = 'status';
  select format_type(atttypid, atttypmod) into category_type
  from pg_attribute
  where attrelid = 'public.documents'::regclass and attname = 'category';

  if status_type = 'document_status' and category_type = 'document_category' then
    return;
  end if;

  -- Vues, règles et politiques qui lisent ces colonnes empêchent le
  -- changement de type : on s'arrête plutôt que de les supprimer à l'aveugle.
  select string_agg(distinct dependent, ', ') into blocking
  from (
    select coalesce(
      (select 'politique ' || policy.polname
         from pg_policy as policy where policy.oid = dependency.objid),
      (select 'vue ' || rewrite.ev_class::regclass::text
         from pg_rewrite as rewrite where rewrite.oid = dependency.objid),
      (select 'déclencheur ' || trigger.tgname
         from pg_trigger as trigger
         where trigger.oid = dependency.objid
           and trigger.tgname <> 'touch_workspace_corpus')
    ) as dependent
    from pg_depend as dependency
    join pg_attribute as attribute
      on attribute.attrelid = dependency.refobjid
      and attribute.attnum = dependency.refobjsubid
    where dependency.refobjid = 'public.documents'::regclass
      and attribute.attname in ('status', 'category')
      and dependency.classid in (
        'pg_policy'::regclass, 'pg_rewrite'::regclass, 'pg_trigger'::regclass
      )
  ) as dependents
  where dependent is not null;
  if blocking is not null then
    raise exception
      'documents.status/category utilisés par : %. Adapter ces objets avant de relancer la migration.',
      blocking;
  end if;

  -- Contraintes héritées sur les valeurs texte (ex. status in ('uploaded'...)).
  for constraint_name in
    select constraint_row.conname
    from pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.documents'::regclass
      and constraint_row.contype = 'c'
      and exists (
        select 1
        from pg_attribute as attribute
        where attribute.attrelid = constraint_row.conrelid
          and attribute.attnum = any (constraint_row.conkey)
          and attribute.attname in ('status', 'category')
      )
  loop
    execute format(
      'alter table public.documents drop constraint %I', constraint_name
    );
    raise notice 'contrainte héritée % supprimée', constraint_name;
  end loop;

  drop trigger if exists touch_workspace_corpus on public.documents;

  if status_type <> 'document_status' then
    alter table public.documents alter column status drop default;
    -- Valeurs du pipeline v2 : sans décision fiable, le document est à
    -- vérifier ; il sera requalifié par le worker.
    alter table public.documents
      alter column status type public.document_status
      using (
        case
          when status in (
            'conforme', 'a_verifier', 'rejete', 'integre_decision_humaine',
            'non_classe'
          ) then status::public.document_status
          when status in ('accepted', 'compliant', 'validated', 'indexed')
            then 'conforme'::public.document_status
          when status in ('rejected', 'non_compliant')
            then 'rejete'::public.document_status
          else 'a_verifier'::public.document_status
        end
      );
    raise notice 'documents.status converti en document_status';
  end if;
  alter table public.documents alter column status set default 'a_verifier';
  alter table public.documents alter column status set not null;

  if category_type <> 'document_category' then
    alter table public.documents alter column category drop default;
    alter table public.documents
      alter column category type public.document_category
      using (
        case
          when category in ('principal', 'complementaire', 'autre')
            then category::public.document_category
          else 'autre'::public.document_category
        end
      );
    raise notice 'documents.category converti en document_category';
  end if;
  update public.documents set category = 'autre' where category is null;
  alter table public.documents alter column category set default 'autre';
  alter table public.documents alter column category set not null;

  create trigger touch_workspace_corpus
  after insert or update of status, deleted_at or delete on public.documents
  for each row execute function public.touch_workspace_corpus();
end
$$;

-- ---------------------------------------------------------------------------
-- Vecteurs : 768 dimensions (paraphrase-multilingual-mpnet-base-v2).
-- ---------------------------------------------------------------------------
do $$
begin
  if (
    select format_type(atttypid, atttypmod)
    from pg_attribute
    where attrelid = 'public.segment_embeddings'::regclass
      and attname = 'embedding'
  ) <> 'vector(768)' then
    -- Les documents indexés avec l'ancien modèle sont réindexés.
    perform public.enqueue_ingestion_job(document.id, 'index', null)
    from public.documents as document
    where document.indexed_at is not null
      and document.deleted_at is null
      and public.document_is_eligible(document.status);
    update public.documents set indexed_at = null where indexed_at is not null;
    delete from public.segments;

    drop index if exists public.idx_segment_embeddings_hnsw;
    alter table public.segment_embeddings
      alter column embedding type vector(768);
    create index idx_segment_embeddings_hnsw
      on public.segment_embeddings
      using hnsw (embedding vector_cosine_ops)
      with (m = 16, ef_construction = 64);
    raise notice 'segment_embeddings.embedding passé en vector(768)';
  end if;

  if (
    select format_type(atttypid, atttypmod)
    from pg_attribute
    where attrelid = 'public.semantic_fingerprints'::regclass
      and attname = 'embedding'
  ) <> 'vector(768)' then
    -- L'empreinte sera recalculée par le worker au prochain contrôle.
    update public.semantic_fingerprints
    set embedding = null, source_hash = null, model = null;
    alter table public.semantic_fingerprints
      alter column embedding type vector(768);
    raise notice 'semantic_fingerprints.embedding passé en vector(768)';
  end if;
end
$$;

notify pgrst, 'reload schema';

reset search_path;
