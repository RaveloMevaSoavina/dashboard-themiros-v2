-- ---------------------------------------------------------------------------
-- Préfixe de contexte des embeddings.
--
-- Un segment est désormais vectorisé précédé du titre de sa section
-- (« 3.2 Comité de pilotage », puis le texte) : un passage qui ne nomme pas
-- son sujet (« Il se réunit chaque trimestre. ») se rapproche des questions
-- qui portent sur lui. Le texte du segment, affiché et cherché en plein
-- texte, ne change pas.
--
-- `input_format` dit sous quelle forme le vecteur a été calculé : « text »
-- (texte seul, tous les vecteurs existants) ou « section-v1 ». Comme un
-- changement de modèle, un changement de forme se rattrape avec
-- `python -m app.modules.ingestion.reindex`, qui revectorise les segments
-- dont la forme diffère de la configuration du moteur.
-- ---------------------------------------------------------------------------

alter table public.segment_embeddings
  add column if not exists input_format text not null default 'text';

alter table public.segment_embeddings
  drop constraint if exists segment_embeddings_input_format_check;
alter table public.segment_embeddings
  add constraint segment_embeddings_input_format_check check (
    input_format in ('text', 'section-v1')
  );

comment on column public.segment_embeddings.input_format is
  'Forme du texte vectorisé : text (texte seul) ou section-v1 (titre de section, ligne vide, texte).';

-- La revectorisation cherche les segments d'une autre forme ou d'un autre
-- modèle.
create index if not exists idx_segment_embeddings_model_format
  on public.segment_embeddings (model, input_format);

-- append_document_segments (20261006000001) : mêmes écritures, plus la forme
-- du texte vectorisé.
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
  insert into public.segment_embeddings (
    segment_id, workspace_id, embedding, model, input_format
  )
  select
    rows.id,
    job.workspace_id,
    (rows.item ->> 'embedding')::vector,
    rows.item ->> 'model',
    -- Worker antérieur : texte du segment seul.
    coalesce(rows.item ->> 'input_format', 'text')
  from rows
  join segment_rows on segment_rows.id = rows.id;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

notify pgrst, 'reload schema';
