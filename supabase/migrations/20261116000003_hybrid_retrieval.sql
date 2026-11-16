-- ---------------------------------------------------------------------------
-- Recherche hybride des extraits de la couche B (layer-b/1.4.0).
--
-- La recherche était purement vectorielle : les termes exacts d'une
-- sous-question ou de ses preuves attendues (« comité de pilotage », un sigle,
-- un indicateur) sont justement ce que les vecteurs captent mal. Chaque
-- sous-question est désormais cherchée deux fois dans le corpus du run :
--
-- - par proximité de sens (vecteurs), comme avant ;
-- - par ses mots (`segments.text_search`, calculé à l'indexation et resté
--   inutilisé jusqu'ici), limités aux mots discriminants du corpus : un mot
--   présent dans plus de 20 % des segments (« projet ») classerait n'importe
--   quel segment ;
--
-- puis les deux classements sont fusionnés par rang réciproque (RRF, k = 60).
-- Chaque candidat garde sa similarité cosinus : c'est elle que le moteur
-- compare au seuil et que la preuve conserve.
-- ---------------------------------------------------------------------------

-- Configuration plein texte d'une langue de segment (P-3 : FR, EN, PT, ES ;
-- les autres langues passent par la configuration neutre « simple »).
create or replace function public.text_search_config(p_language text)
returns regconfig
language sql
immutable
set search_path = public
as $$
  select case p_language
    when 'fr' then 'french'::regconfig
    when 'en' then 'english'::regconfig
    when 'pt' then 'portuguese'::regconfig
    when 'es' then 'spanish'::regconfig
    else 'simple'::regconfig
  end;
$$;

revoke execute on function public.text_search_config(text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- run_sub_question_matches (20261021000002) : même signature. Chaque requête
-- peut porter son texte (`text`) ; sans texte, la recherche reste vectorielle.
-- Chaque candidat porte en plus son rang plein texte (`lexical_rank`, nul s'il
-- ne vient que des vecteurs) et son score fusionné (`score`).
-- ---------------------------------------------------------------------------
create or replace function public.run_sub_question_matches(
  p_run_id uuid,
  p_lease_token uuid,
  p_model text,
  p_queries jsonb,
  p_top_k integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  corpus_ids uuid[];
  corpus_size integer;
  -- Candidats lus de chaque côté, puis candidats renvoyés par requête : le
  -- moteur filtre au seuil et répartit entre documents.
  pool integer := greatest(p_top_k * 3, 20);
  returned integer := p_top_k * 2;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  perform public.assert_run_lease(p_run_id, p_lease_token);
  if p_top_k not between 1 and 20 then
    raise exception using errcode = 'P0001', message = 'INVALID_TOP_K';
  end if;

  select array_agg(segment.id)
  into corpus_ids
  from public.segments as segment
  join public.segment_embeddings as embedding
    on embedding.segment_id = segment.id and embedding.model = p_model
  where segment.published
    and segment.document_id in (
      select document_id from public.run_documents
      where run_id = p_run_id and document_id is not null
    );
  corpus_size := coalesce(cardinality(corpus_ids), 0);
  if corpus_size = 0 then
    return '[]'::jsonb;
  end if;

  return coalesce((
    with corpus as materialized (
      select
        segment.id, segment.document_id, segment.text, segment.text_search,
        embedding.embedding
      from public.segments as segment
      join public.segment_embeddings as embedding
        on embedding.segment_id = segment.id and embedding.model = p_model
      where segment.id = any(corpus_ids)
    ),
    -- Mots discriminants du corpus : présents dans au plus 20 % de ses
    -- segments (au moins 3, pour un petit corpus).
    rare_words as materialized (
      select stat.word
      from ts_stat(format(
        'select text_search from public.segments where id = any(%L::uuid[])',
        corpus_ids
      )) as stat
      where stat.ndoc <= greatest(3, ceil(corpus_size * 0.2))
    ),
    -- Une requête est lue dans chaque langue du corpus : ses mots y sont
    -- réduits comme ceux des segments de cette langue.
    configs as materialized (
      select distinct public.text_search_config(segment.language) as config
      from public.segments as segment
      where segment.id = any(corpus_ids)
    ),
    queries as materialized (
      select
        (item ->> 'sub_question_id')::uuid as sub_question_id,
        (item ->> 'embedding')::vector as embedding,
        nullif(btrim(item ->> 'text'), '') as query_text
      from jsonb_array_elements(coalesce(p_queries, '[]'::jsonb)) as item
    ),
    lexical_queries as materialized (
      select queries.sub_question_id, words.query
      from queries
      cross join lateral (
        -- Un mot discriminant suffit : « mot | mot | … ».
        select string_agg(
          '''' || replace(replace(lexeme, '\', '\\'), '''', '''''') || '''',
          ' | '
        )::tsquery as query
        from (
          select distinct lexeme
          from configs
          cross join lateral unnest(
            tsvector_to_array(to_tsvector(configs.config, queries.query_text))
          ) as lexeme
          where lexeme in (select word from rare_words)
        ) as distinct_words
      ) as words
      where queries.query_text is not null and words.query is not null
    ),
    vector_ranked as (
      select queries.sub_question_id, nearest.id, nearest.position
      from queries
      cross join lateral (
        select
          corpus.id,
          row_number() over (
            order by corpus.embedding <=> queries.embedding, corpus.id
          ) as position
        from corpus
        order by corpus.embedding <=> queries.embedding, corpus.id
        limit pool
      ) as nearest
    ),
    lexical_ranked as (
      select lexical_queries.sub_question_id, hit.id, hit.position
      from lexical_queries
      cross join lateral (
        select
          corpus.id,
          row_number() over (
            order by ts_rank_cd(corpus.text_search, lexical_queries.query, 1) desc,
              corpus.id
          ) as position
        from corpus
        where corpus.text_search @@ lexical_queries.query
        order by ts_rank_cd(corpus.text_search, lexical_queries.query, 1) desc,
          corpus.id
        limit pool
      ) as hit
    ),
    fused as (
      select
        coalesce(by_vector.sub_question_id, by_words.sub_question_id)
          as sub_question_id,
        coalesce(by_vector.id, by_words.id) as id,
        by_words.position as lexical_rank,
        coalesce(1.0 / (60 + by_vector.position), 0)
          + coalesce(1.0 / (60 + by_words.position), 0) as score
      from vector_ranked as by_vector
      full join lexical_ranked as by_words
        on by_words.sub_question_id = by_vector.sub_question_id
        and by_words.id = by_vector.id
    ),
    kept as (
      select
        fused.*,
        row_number() over (
          partition by fused.sub_question_id
          order by fused.score desc, fused.id
        ) as position
      from fused
    )
    select jsonb_agg(jsonb_build_object(
      'sub_question_id', kept.sub_question_id,
      'segment_id', corpus.id,
      'document_id', corpus.document_id,
      'similarity', round((1 - (corpus.embedding <=> queries.embedding))::numeric, 4),
      'lexical_rank', kept.lexical_rank,
      'score', round(kept.score, 6),
      'text', corpus.text
    ) order by kept.sub_question_id, kept.position)
    from kept
    join corpus on corpus.id = kept.id
    join queries on queries.sub_question_id = kept.sub_question_id
    where kept.position <= returned
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.run_sub_question_matches(uuid, uuid, text, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.run_sub_question_matches(uuid, uuid, text, jsonb, integer)
  to service_role;

notify pgrst, 'reload schema';
