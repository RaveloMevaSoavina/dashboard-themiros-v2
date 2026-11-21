-- ---------------------------------------------------------------------------
-- Le modèle des runs (gpt-6-astra) refuse le paramètre `temperature`
-- (« Unsupported parameter: 'temperature' is not supported with this
-- model ») : chaque appel de notation de la couche B était rejeté
-- (AI_PROVIDER_REJECTED), et aucune sous-question n'était notée ni répondue.
-- Les prompts de notation n'envoient plus ce paramètre ; le moteur retire
-- aussi de lui-même un paramètre facultatif refusé.
-- ---------------------------------------------------------------------------
update public.prompt_versions
set parameters = parameters - 'temperature'
where parameters ? 'temperature';
