-- ---------------------------------------------------------------------------
-- Masse critique documentaire : niveaux de la note de décision (document 13).
--
-- Les planchers 5 / 10 / 20 documents conformes sont conservés. Le troisième
-- niveau s'appelle désormais « Défendable » (usage bailleur / audit) : la clé
-- 'approfondie' devient 'defendable'.
--
-- La colonne recommended_documents est supprimée : la suffisance ne se juge
-- plus sur un volume recommandé mais sur un plancher et une couverture du
-- cadre (RG-5.5). Les conditions de couverture et le garde-fou
-- anti-saturation (RG-5.7) arriveront dans des migrations dédiées.
--
-- Aucune table ne référence encore public.corpus_thresholds ni la clé
-- 'approfondie' (public.runs n'existe pas) : le renommage est sans reprise.
-- ---------------------------------------------------------------------------

update public.corpus_thresholds
set analysis_type = 'defendable', updated_at = now()
where analysis_type = 'approfondie';

alter table public.corpus_thresholds
  drop constraint if exists corpus_thresholds_values_check;
alter table public.corpus_thresholds
  drop column if exists recommended_documents;
alter table public.corpus_thresholds
  add constraint corpus_thresholds_values_check check (minimum_documents > 0);

alter table public.corpus_thresholds
  drop constraint if exists corpus_thresholds_analysis_type_check;
alter table public.corpus_thresholds
  add constraint corpus_thresholds_analysis_type_check check (
    analysis_type in ('exploratoire', 'standard', 'defendable')
  );

comment on table public.corpus_thresholds is
  'Planchers de masse critique : documents conformes minimum par niveau (Exploratoire, Standard, Défendable).';
comment on column public.corpus_thresholds.minimum_documents is
  'Plancher de documents conformes ou intégrés sur décision humaine (RG-5.1).';
