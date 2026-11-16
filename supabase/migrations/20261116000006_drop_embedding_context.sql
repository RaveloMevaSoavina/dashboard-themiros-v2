-- ---------------------------------------------------------------------------
-- Retrait du préfixe de contexte des embeddings (20261116000005).
--
-- Le préfixe n'a jamais été activé : tous les vecteurs sont calculés sur le
-- texte seul du segment (« text »). La forme du texte vectorisé n'a donc plus
-- à être conservée : append_document_segments reprend sa définition
-- d'origine (20261006000001), puis la colonne et son index disparaissent.
-- ---------------------------------------------------------------------------

-- Garde-fou : un vecteur calculé avec le préfixe deviendrait
-- indiscernable des autres. Le revectoriser d'abord (texte seul).
do $$
declare
  remaining boolean := false;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'segment_embeddings'
      and column_name = 'input_format'
  ) then
    execute 'select exists (select 1 from public.segment_embeddings '
      || 'where input_format <> ''text'')'
      into remaining;
  end if;
  if remaining then
    raise exception using
      errcode = 'P0001',
      message = 'EMBEDDING_CONTEXT_VECTORS_REMAIN';
  end if;
end;
$$;

-- append_document_segments (20261006000001) : sans `input_format`, avant de
-- retirer la colonne. Les droits d'exécution sont conservés.
create or replace function public.append_document_segments(
  p_job_id uuid,
  p_lease_token uuid,
  p_generation uuid,
  p_segments jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  job public.ingestion_jobs;
  inserted integer;
begin
  job := public.assert_ingestion_lease(p_job_id, p_lease_token);

  with rows as (
    select
      gen_random_uuid() as id,
      item
    from jsonb_array_elements(p_segments) as item
  ),
  segment_rows as (
    insert into public.segments (
      id, document_id, workspace_id, generation, published, page_number,
      section_title, paragraph_index, text, language, char_start, char_end,
      token_count
    )
    select
      rows.id,
      job.document_id,
      job.workspace_id,
      p_generation,
      false,
      (rows.item ->> 'page_number')::integer,
      rows.item ->> 'section_title',
      (rows.item ->> 'paragraph_index')::integer,
      rows.item ->> 'text',
      rows.item ->> 'language',
      (rows.item ->> 'char_start')::integer,
      (rows.item ->> 'char_end')::integer,
      (rows.item ->> 'token_count')::integer
    from rows
    returning id
  )
  insert into public.segment_embeddings (segment_id, workspace_id, embedding, model)
  select
    rows.id,
    job.workspace_id,
    (rows.item ->> 'embedding')::vector,
    rows.item ->> 'model'
  from rows
  join segment_rows on segment_rows.id = rows.id;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

drop index if exists public.idx_segment_embeddings_model_format;

alter table public.segment_embeddings
  drop constraint if exists segment_embeddings_input_format_check;

alter table public.segment_embeddings
  drop column if exists input_format;

notify pgrst, 'reload schema';
