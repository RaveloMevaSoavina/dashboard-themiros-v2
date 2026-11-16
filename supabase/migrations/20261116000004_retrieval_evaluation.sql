-- ---------------------------------------------------------------------------
-- Évaluation de la recherche des extraits (layer-b/1.4.0).
--
-- La recherche hybride de 20261116000003 passe dans `segment_matches`, qui
-- prend directement les documents du corpus : le moteur l'appelle pour un
-- run (après contrôle du bail), et le banc d'évaluation de la recherche
-- (`python -m app.modules.evals.retrieval`) l'appelle sur les documents d'un
-- jeu annoté, sans créer de run. Les deux mesurent ainsi exactement la même
-- recherche.
-- ---------------------------------------------------------------------------

create or replace function public.segment_matches(
  p_document_ids uuid[],
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
  if p_top_k not between 1 and 20 then
    raise exception using errcode = 'P0001', message = 'INVALID_TOP_K';
  end if;

  select array_agg(segment.id)
  into corpus_ids
  from public.segments as segment
  join public.segment_embeddings as embedding
    on embedding.segment_id = segment.id and embedding.model = p_model
  where segment.published
    and segment.document_id = any(coalesce(p_document_ids, '{}'));
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

revoke execute on function public.segment_matches(uuid[], text, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.segment_matches(uuid[], text, jsonb, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- run_sub_question_matches : même signature, même résultat ; le corpus est
-- celui du run.
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
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  perform public.assert_run_lease(p_run_id, p_lease_token);
  return public.segment_matches(
    array(
      select document_id from public.run_documents
      where run_id = p_run_id and document_id is not null
    ),
    p_model,
    p_queries,
    p_top_k
  );
end;
$$;

revoke execute on function public.run_sub_question_matches(uuid, uuid, text, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.run_sub_question_matches(uuid, uuid, text, jsonb, integer)
  to service_role;

notify pgrst, 'reload schema';
