-- ---------------------------------------------------------------------------
-- Qualité du texte extrait (spec ingestion §4.4 à §4.6).
--
-- - headings : titres d'une page repérés par leur style (DOCX, styles
--   Heading / Titre) ; le découpage les reconnaît même quand ils ne
--   ressemblent pas à un titre (« Contexte du projet ») ;
-- - ocr_confidence : confiance moyenne de l'OCR sur la page (0-1), nulle
--   pour une page sans OCR.
--
-- Le texte des pages reste conservé intact (RG-4.6) : en-têtes, pieds de
-- page et césures ne sont retirés que des segments indexés.
-- ---------------------------------------------------------------------------

alter table public.document_pages
  add column if not exists headings text[] not null default '{}',
  add column if not exists ocr_confidence numeric(4, 3);

alter table public.document_pages
  drop constraint if exists document_pages_ocr_confidence_check;
alter table public.document_pages
  add constraint document_pages_ocr_confidence_check check (
    ocr_confidence is null or ocr_confidence between 0 and 1
  );

comment on column public.document_pages.headings is
  'Titres de la page repérés par leur style (DOCX), dans l''ordre du document.';
comment on column public.document_pages.ocr_confidence is
  'Confiance moyenne de l''OCR sur la page (0-1), pondérée par la longueur des mots ; nulle sans OCR.';

-- ---------------------------------------------------------------------------
-- commit_document_extraction (20261006000001) : mêmes écritures, plus les
-- titres et la confiance OCR de chaque page.
-- ---------------------------------------------------------------------------
create or replace function public.commit_document_extraction(
  p_job_id uuid,
  p_lease_token uuid,
  p_pages jsonb,
  p_pdf_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  job public.ingestion_jobs;
  total integer;
  exploitable integer;
begin
  job := public.assert_ingestion_lease(p_job_id, p_lease_token);

  delete from public.document_pages where document_id = job.document_id;
  insert into public.document_pages (
    document_id, workspace_id, page_number, text, section_title, is_ocr,
    ocr_failed, is_exploitable, char_start, headings, ocr_confidence
  )
  select
    job.document_id,
    job.workspace_id,
    (page ->> 'page_number')::integer,
    coalesce(page ->> 'text', ''),
    page ->> 'section_title',
    coalesce((page ->> 'is_ocr')::boolean, false),
    coalesce((page ->> 'ocr_failed')::boolean, false),
    coalesce((page ->> 'is_exploitable')::boolean, false),
    coalesce((page ->> 'char_start')::integer, 0),
    case when jsonb_typeof(page -> 'headings') = 'array' then
      coalesce((
        select array_agg(heading.value order by heading.position)
        from jsonb_array_elements_text(page -> 'headings')
          with ordinality as heading (value, position)
        where btrim(heading.value) <> ''
      ), '{}')
    else '{}' end,
    round((page ->> 'ocr_confidence')::numeric, 3)
  from jsonb_array_elements(p_pages) as page;

  select count(*), count(*) filter (where is_exploitable)
  into total, exploitable
  from public.document_pages
  where document_id = job.document_id;

  update public.documents
  set total_pages = total,
      exploitable_pages = exploitable,
      pdf_type = p_pdf_type
  where id = job.document_id;

  perform public.log_document_event(
    job.workspace_id, job.document_id, 'engine', null, 'document_extracted',
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'pdf_type', p_pdf_type,
      'total_pages', total,
      'exploitable_pages', exploitable
    )
  );
end;
$$;

notify pgrst, 'reload schema';
