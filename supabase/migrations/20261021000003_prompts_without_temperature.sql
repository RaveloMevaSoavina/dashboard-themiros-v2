-- gpt-6-astra refuse les paramètres d'échantillonnage (400 « Unsupported
-- parameter ») : la notation de la couche B et la génération des piliers
-- échouaient. Les prompts ne gardent que max_tokens et response_format.
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
