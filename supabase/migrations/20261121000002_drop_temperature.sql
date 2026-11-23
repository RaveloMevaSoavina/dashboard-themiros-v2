-- ---------------------------------------------------------------------------
-- Le modèle des runs (gpt-6-astra) refuse les paramètres d'échantillonnage :
-- chaque appel de notation de la couche B était rejeté
-- (AI_PROVIDER_REJECTED), et aucune sous-question n'était notée ni répondue.
-- Les prompts ne gardent que max_tokens et response_format ; le moteur
-- n'envoie de toute façon que ceux-là.
-- ---------------------------------------------------------------------------
update public.prompt_versions
set parameters = (
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from jsonb_each(parameters)
  where key in ('max_tokens', 'response_format')
)
where exists (
  select 1 from jsonb_each(parameters)
  where key not in ('max_tokens', 'response_format')
);
