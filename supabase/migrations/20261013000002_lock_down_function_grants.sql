-- ---------------------------------------------------------------------------
-- Droits d'exécution des fonctions.
--
-- Supabase accorde EXECUTE à anon et authenticated sur toute fonction créée
-- dans public (default privileges du rôle postgres). Les migrations faisaient
-- « revoke all … from public », ce qui ne retire pas ces grants explicites :
-- des fonctions SECURITY DEFINER prévues pour le service ou les membres
-- restaient appelables avec la seule clé publique.
-- ---------------------------------------------------------------------------

-- Ancienne file de génération des piliers : appelables par anon sans aucun
-- contrôle (claim_next_pillar_job renvoie la ligne complète d'un job), et
-- appelées par aucun code. complete_pillar_job lit une table qui n'existe plus.
drop function if exists public.claim_next_pillar_job(text);
drop function if exists public.complete_pillar_job(uuid, jsonb);
drop function if exists public.fail_pillar_job(uuid, text);

-- Réservées au service (vérifient déjà auth.role() = 'service_role', sauf
-- requalify_ready_documents qui ne vérifie rien et n'est appelée que depuis
-- d'autres fonctions SECURITY DEFINER).
revoke execute on function public.get_prompt_definition(text, text)
  from public, anon, authenticated;
revoke execute on function public.start_pillar_generation(uuid)
  from public, anon, authenticated;
revoke execute on function public.persist_generated_pillars(uuid, uuid, jsonb, uuid)
  from public, anon, authenticated;
revoke execute on function public.fail_pillar_generation(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.requalify_ready_documents(uuid, uuid)
  from public, anon, authenticated;

-- Réservées aux utilisateurs connectés (contrôlent déjà auth.uid()).
revoke execute on function public.is_workspace_admin(uuid) from public, anon;
revoke execute on function public.resolve_financier_code(text) from public, anon;
revoke execute on function public.normalize_workspace_financiers(jsonb) from public, anon;
revoke execute on function public.delete_workspace(uuid) from public, anon;
revoke execute on function public.enqueue_pillar_generation(uuid) from public, anon;
revoke execute on function public.confirm_approach_and_generate(uuid) from public, anon;
revoke execute on function public.save_approach_proposal(
  uuid,
  uuid,
  public.evaluation_cycle,
  public.instrument_module,
  text,
  integer,
  public.complexity_class,
  jsonb,
  jsonb,
  public.evaluation_nature,
  jsonb,
  jsonb,
  text,
  jsonb
) from public, anon;

-- Pour les fonctions à venir : plus d'EXECUTE implicite pour anon. Une
-- fonction destinée à anon devra le dire par un grant explicite.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;
