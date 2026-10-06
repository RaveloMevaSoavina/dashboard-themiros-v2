-- Suppression définitive d'un document chargé.
--
-- Le front supprime d'abord le fichier du bucket `documents` (API Storage,
-- politique « workspace_documents_delete »), puis appelle cette fonction :
-- un échec à mi-chemin laisse au pire une ligne sans fichier, que l'on peut
-- supprimer de nouveau, jamais un fichier orphelin dans le bucket.
--
-- La ligne est supprimée avec tout ce qui en dépend (pages, métadonnées,
-- versions, segments, embeddings, tâches de la file). Le journal d'audit est
-- conservé (spec ingestion §11.2 : 12 mois minimum) : il garde le nom, le
-- hash et le statut du document supprimé.

create or replace function public.delete_document(
  p_document_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target public.documents;
begin
  select * into target
  from public.documents
  where id = p_document_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'DOCUMENT_NOT_FOUND';
  end if;
  if actor is null or not public.is_workspace_member(target.workspace_id) then
    raise exception using errcode = '42501', message = 'WORKSPACE_ACCESS_DENIED';
  end if;

  perform public.log_document_event(
    target.workspace_id, p_document_id, 'human', actor, 'document_deleted',
    jsonb_build_object(
      'filename', target.original_filename,
      'hash', target.file_hash,
      'size', target.file_size_bytes,
      'storage_path', target.storage_path,
      'was_indexed', target.indexed_at is not null,
      'reason', nullif(btrim(p_reason), '')
    ),
    jsonb_build_object(
      'status', target.status,
      'category', target.category,
      'relevance_score', target.relevance_score,
      'processing_state', target.processing_state
    ),
    null
  );

  -- Un worker en cours perd son bail avec la tâche : ses écritures suivantes
  -- échouent (LEASE_LOST) et il abandonne sans rien recréer.
  delete from public.documents where id = p_document_id;

  return jsonb_build_object(
    'document_id', p_document_id,
    'storage_path', target.storage_path
  );
end;
$$;

revoke all on function public.delete_document(uuid, text) from public, anon;
grant execute on function public.delete_document(uuid, text) to authenticated;

notify pgrst, 'reload schema';
