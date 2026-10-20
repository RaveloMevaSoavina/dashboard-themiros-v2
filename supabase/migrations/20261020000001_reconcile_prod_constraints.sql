-- ---------------------------------------------------------------------------
-- Rattrapage des contraintes absentes de la prod (dump du 20/10/2026).
--
-- documents et pillar_generation_jobs existaient en prod avant les migrations
-- qui les « créent » : les contraintes déclarées dans ces create table n'y ont
-- jamais été posées. Une base neuve les a, la prod non :
--   - documents : original_filename, file_hash, file_size_bytes, mime_type et
--     integrated_by_human not null ; documents_page_counts_check ;
--   - pillar_generation_jobs : attempts_check et result_object_check.
--
-- Chaque contrainte n'est posée que si les lignes existantes la respectent ;
-- sinon un avertissement nomme la contrainte et la prod reste en l'état.
-- Idempotente : sans effet sur une base neuve.
-- ---------------------------------------------------------------------------

do $$
declare
  required_column text;
begin
  foreach required_column in array array[
    'original_filename', 'file_hash', 'file_size_bytes', 'mime_type',
    'integrated_by_human'
  ]
  loop
    execute format(
      'select exists (select 1 from public.documents where %I is null)',
      required_column
    ) into strict found;
    if found then
      raise warning 'documents.% contient des valeurs nulles : not null non posé',
        required_column;
    else
      execute format(
        'alter table public.documents alter column %I set not null',
        required_column
      );
    end if;
  end loop;
end;
$$;

-- Les contraintes check sont posées sans contrôle, puis validées : une ligne
-- qui ne les respecte pas laisse la contrainte « not valid », appliquée aux
-- seules nouvelles écritures.
do $$
declare
  missing record;
begin
  for missing in
    select *
    from (values
      ('public.documents'::regclass, 'documents_page_counts_check',
       'check (exploitable_pages is null or total_pages is null or '
       '(exploitable_pages >= 0 and exploitable_pages <= total_pages))'),
      ('public.pillar_generation_jobs'::regclass,
       'pillar_generation_jobs_attempts_check', 'check (attempts >= 0)'),
      ('public.pillar_generation_jobs'::regclass,
       'pillar_generation_jobs_result_object_check',
       'check (result is null or jsonb_typeof(result) = ''object'')')
    ) as constraint_def (table_name, constraint_name, definition)
    where not exists (
      select 1 from pg_constraint
      where conrelid = constraint_def.table_name
        and conname = constraint_def.constraint_name
    )
  loop
    execute format(
      'alter table %s add constraint %I %s not valid',
      missing.table_name, missing.constraint_name, missing.definition
    );
    begin
      execute format(
        'alter table %s validate constraint %I',
        missing.table_name, missing.constraint_name
      );
    exception
      when check_violation then
        raise warning '% : des lignes existantes ne la respectent pas, contrainte laissée not valid',
          missing.constraint_name;
    end;
  end loop;
end;
$$;
