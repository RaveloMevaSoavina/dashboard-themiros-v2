-- Framework criterion weights are relative priority coefficients, not
-- percentages published by the financiers. The approach engine normalizes
-- active criteria to 100 after applying the cycle and evaluation-nature rules.
--
-- 10 = core criterion
-- 15 = criterion explicitly emphasized by the framework mandate or by one of
--      its documented specific angles
--
-- Applicability remains owned by ref_cycle_criteria (RG-4.7). These profiles
-- only provide the framework's default weighting.

update public.ref_frameworks
set activated_criteria = case code
  when 'GCF_IEU_2026' then '{
    "pertinence": {"weight": 15},
    "coherence": {"weight": 15},
    "efficacite": {"weight": 15},
    "efficience": {"weight": 10},
    "impact": {"weight": 15},
    "durabilite": {"weight": 15},
    "equite": {"weight": 15},
    "gestion_adaptative": {"weight": 15}
  }'::jsonb
  when 'AFD_CAD_2026' then '{
    "pertinence": {"weight": 15},
    "coherence": {"weight": 15},
    "efficacite": {"weight": 10},
    "efficience": {"weight": 10},
    "impact": {"weight": 15},
    "durabilite": {"weight": 15},
    "equite": {"weight": 10},
    "gestion_adaptative": {"weight": 10}
  }'::jsonb
  when 'WB_ICR_IEG_2026' then '{
    "pertinence": {"weight": 15},
    "coherence": {"weight": 10},
    "efficacite": {"weight": 15},
    "efficience": {"weight": 15},
    "impact": {"weight": 15},
    "durabilite": {"weight": 15},
    "equite": {"weight": 10},
    "gestion_adaptative": {"weight": 10}
  }'::jsonb
  when 'FIDA_IOE_2026_09' then '{
    "pertinence": {"weight": 10},
    "coherence": {"weight": 15},
    "efficacite": {"weight": 15},
    "efficience": {"weight": 10},
    "impact": {"weight": 15},
    "durabilite": {"weight": 15},
    "equite": {"weight": 15},
    "gestion_adaptative": {"weight": 15}
  }'::jsonb
  when 'PNUD_UNEG_2026' then '{
    "pertinence": {"weight": 15},
    "coherence": {"weight": 15},
    "efficacite": {"weight": 15},
    "efficience": {"weight": 10},
    "impact": {"weight": 15},
    "durabilite": {"weight": 15},
    "equite": {"weight": 15},
    "gestion_adaptative": {"weight": 10}
  }'::jsonb
  when 'UE_BETTER_REG_2026' then '{
    "pertinence": {"weight": 15},
    "coherence": {"weight": 15},
    "efficacite": {"weight": 15},
    "efficience": {"weight": 15},
    "impact": {"weight": 15},
    "durabilite": {"weight": 10},
    "equite": {"weight": 10},
    "gestion_adaptative": {"weight": 10}
  }'::jsonb
  when 'FEM_2026' then '{
    "pertinence": {"weight": 15},
    "coherence": {"weight": 10},
    "efficacite": {"weight": 15},
    "efficience": {"weight": 10},
    "impact": {"weight": 15},
    "durabilite": {"weight": 15},
    "equite": {"weight": 10},
    "gestion_adaptative": {"weight": 10}
  }'::jsonb
  when 'AF_CAD_2026' then '{
    "pertinence": {"weight": 10},
    "coherence": {"weight": 10},
    "efficacite": {"weight": 15},
    "efficience": {"weight": 10},
    "impact": {"weight": 15},
    "durabilite": {"weight": 15},
    "equite": {"weight": 15},
    "gestion_adaptative": {"weight": 15}
  }'::jsonb
  when 'THEMIROS_DEFAULT_2026' then '{
    "pertinence": {"weight": 10},
    "coherence": {"weight": 10},
    "efficacite": {"weight": 10},
    "efficience": {"weight": 10},
    "impact": {"weight": 10},
    "durabilite": {"weight": 10},
    "equite": {"weight": 10},
    "gestion_adaptative": {"weight": 10}
  }'::jsonb
  else activated_criteria
end
where code in (
  'GCF_IEU_2026',
  'AFD_CAD_2026',
  'WB_ICR_IEG_2026',
  'FIDA_IOE_2026_09',
  'PNUD_UNEG_2026',
  'UE_BETTER_REG_2026',
  'FEM_2026',
  'AF_CAD_2026',
  'THEMIROS_DEFAULT_2026'
);

comment on column public.ref_frameworks.activated_criteria is
  'Versioned Themiros criterion priority coefficients by financier framework. Values are relative inputs normalized to 100 by the approach engine; applicability remains cycle-driven.';
