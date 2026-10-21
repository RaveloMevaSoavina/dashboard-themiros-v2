-- Passage des embeddings à OpenAI text-embedding-3-large (768 dimensions).
--
-- Les similarités n'ont pas la même échelle qu'avec l'ancien modèle local
-- (paraphrase-multilingual-mpnet). Seuils recalibrés sur le corpus FP073
-- (2 061 segments) pour laisser passer la même part du corpus :
--   classification_min_similarity 0,40 -> 0,34 (80 % des segments classés)
--   classification_low_confidence 0,50 -> 0,41 (59 % au-dessus)
--   variable_min_similarity       0,40 -> 0,33 (25 % des paires)
--
-- Nouvelle version globale : la v1 reste dans l'historique. Les espaces
-- qui ont leurs propres paramètres gardent les leurs, à revoir à la main.
insert into public.critical_mass_settings (
  workspace_id, exploratory_min_documents, standard_min_documents,
  defensible_min_documents, min_independent_sources,
  defensible_variable_coverage_pct, saturation_document_cap,
  saturation_min_mean_relevance, classification_min_similarity,
  classification_low_confidence, classification_max_pillars,
  variable_min_similarity, note
)
select
  null, exploratory_min_documents, standard_min_documents,
  defensible_min_documents, min_independent_sources,
  defensible_variable_coverage_pct, saturation_document_cap,
  saturation_min_mean_relevance, 0.34, 0.41, classification_max_pillars,
  0.33, 'Seuils de similarité recalibrés pour text-embedding-3-large'
from public.critical_mass_settings
where workspace_id is null
  and not exists (
    select 1 from public.critical_mass_settings
    where workspace_id is null
      and note = 'Seuils de similarité recalibrés pour text-embedding-3-large'
  )
order by version desc
limit 1;
