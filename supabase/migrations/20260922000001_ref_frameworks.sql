create table if not exists public.ref_frameworks (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  source text not null,
  year integer not null,
  activated_criteria jsonb not null default '{}'::jsonb,
  specific_angles jsonb not null default '[]'::jsonb,
  version text not null,
  created_at timestamptz not null default now(),
  constraint ref_frameworks_code_version_unique unique (code, version),
  constraint ref_frameworks_code_not_blank check (btrim(code) <> ''),
  constraint ref_frameworks_label_not_blank check (btrim(label) <> ''),
  constraint ref_frameworks_source_not_blank check (btrim(source) <> ''),
  constraint ref_frameworks_version_not_blank check (btrim(version) <> ''),
  constraint ref_frameworks_year_check check (year between 1900 and 2200),
  constraint ref_frameworks_activated_criteria_object_check check (
    jsonb_typeof(activated_criteria) = 'object'
  ),
  constraint ref_frameworks_specific_angles_array_check check (
    jsonb_typeof(specific_angles) = 'array'
  )
);

create index if not exists idx_ref_frameworks_code
  on public.ref_frameworks (code);

alter table public.ref_frameworks enable row level security;

drop policy if exists "ref_frameworks_select_authenticated"
  on public.ref_frameworks;
create policy "ref_frameworks_select_authenticated"
  on public.ref_frameworks
  for select
  to authenticated
  using (true);

comment on table public.ref_frameworks is
  'Versioned evaluation frameworks selected from the workspace principal financier.';

comment on column public.ref_frameworks.activated_criteria is
  'JSON object containing criterion statuses and default weights.';

comment on column public.ref_frameworks.specific_angles is
  'JSON array containing financier-specific evaluation angles.';

-- The documentation does not define framework-specific criterion weights yet.
-- Criteria are therefore seeded as an empty object and will fall back to the
-- cycle rules until an official, versioned weighting is provided.
insert into public.ref_frameworks (
  code,
  label,
  source,
  year,
  activated_criteria,
  specific_angles,
  version
)
values
  (
    'GCF_IEU_2026',
    'Critères d''investissement du GCF et IEU',
    'Green Climate Fund — critères d''investissement et Independent Evaluation Unit',
    2026,
    '{}'::jsonb,
    '["Changement de paradigme", "Appropriation pays", "Développement durable", "Besoins des bénéficiaires"]'::jsonb,
    '2026'
  ),
  (
    'AFD_CAD_2026',
    'CAD-OCDE et politique AFD',
    'Critères CAD-OCDE et politique d''évaluation de l''AFD',
    2026,
    '{}'::jsonb,
    '["Additionnalité", "Co-bénéfices climat"]'::jsonb,
    '2026'
  ),
  (
    'WB_ICR_IEG_2026',
    'Cadre ICR / IEG Banque mondiale',
    'Banque mondiale — ICR / Independent Evaluation Group',
    2026,
    '{}'::jsonb,
    '["Performance de l''emprunteur", "Performance de la Banque mondiale"]'::jsonb,
    '2026'
  ),
  (
    'FIDA_IOE_2026_09',
    'Manuel d''évaluation de l''IOE (FIDA)',
    'FIDA — Independent Office of Evaluation',
    2026,
    '{}'::jsonb,
    '["Innovation et mise à l''échelle", "Environnement et gestion des ressources naturelles", "Adaptation au changement climatique", "Performance des partenaires"]'::jsonb,
    '2026-09'
  ),
  (
    'PNUD_UNEG_2026',
    'Politique PNUD et normes UNEG',
    'PNUD — politique d''évaluation et normes UNEG',
    2026,
    '{}'::jsonb,
    '["Droits humains", "Ne laisser personne de côté"]'::jsonb,
    '2026'
  ),
  (
    'UE_BETTER_REG_2026',
    'Better Regulation et CAD (DG INTPA)',
    'Union européenne — Better Regulation, CAD-OCDE et DG INTPA',
    2026,
    '{}'::jsonb,
    '["Valeur ajoutée de l''Union européenne"]'::jsonb,
    '2026'
  ),
  (
    'FEM_2026',
    'Politique d''évaluation du FEM',
    'Fonds pour l''environnement mondial — politique d''évaluation',
    2026,
    '{}'::jsonb,
    '["Résultats environnementaux mondiaux"]'::jsonb,
    '2026'
  ),
  (
    'AF_CAD_2026',
    'Cadre de résultats du Fonds d''adaptation',
    'Fonds d''adaptation — cadre de résultats et critères CAD-OCDE',
    2026,
    '{}'::jsonb,
    '["Résilience", "Réduction de la vulnérabilité"]'::jsonb,
    '2026'
  ),
  (
    'THEMIROS_DEFAULT_2026',
    'Référentiel Themiros',
    'CAD-OCDE 2019, Équité et Gestion adaptative',
    2026,
    '{}'::jsonb,
    '[]'::jsonb,
    '2026'
  )
on conflict (code, version) do nothing;
