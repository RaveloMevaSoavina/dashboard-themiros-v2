-- gpt-6-astra refuse le paramètre `temperature` (400 « Unsupported
-- parameter ») : la notation de la couche B et la génération des piliers
-- échouaient. Le moteur n'envoie `temperature` que s'il figure dans les
-- paramètres du prompt ; on le retire des prompts de ce modèle.
update public.prompt_versions
set parameters = parameters - 'temperature'
where model = 'gpt-6-astra'
  and parameters ? 'temperature';
