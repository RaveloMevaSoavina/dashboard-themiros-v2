-- ---------------------------------------------------------------------------
-- Masse critique documentaire : tests en base (note de décision, §6).
--
--   T-05 : deux segments d'un même document comptent pour une seule source ;
--   T-09 : de la classification des segments à la couverture de la jauge ;
--   T-10 : journalisation des modifications de paramètres.
--
-- Les vecteurs sont synthétiques : un axe par pilier, si bien que la
-- similarité cosinus vaut 1 entre un segment et les sondes de son pilier et
-- 0 avec les autres. Lancement : `supabase test db`, sur une base locale
-- où les migrations de ce dépôt sont appliquées.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

-- Vecteur unitaire sur l'axe k, dans la dimension des embeddings.
create function pg_temp.axis(k integer)
returns vector
language sql
as $$
  select array_agg(case when i = k then 1 else 0 end order by i)::vector(768)
  from generate_series(1, 768) as i;
$$;

-- Sources indépendantes d'un pilier ou d'une variable, vues par l'admin.
create function pg_temp.sources(kind text, item_id uuid)
returns integer
language sql
as $$
  select (item ->> 'sources')::integer
  from jsonb_array_elements(
    public.critical_mass_coverage('a0000000-0000-0000-0000-0000000000a1') -> kind
  ) as item
  where item ->> (case kind when 'pillars' then 'pillar_id'
                            else 'pillar_variable_id' end) = item_id::text;
$$;

-- ---------------------------------------------------------------------------
-- Espace, cadre validé et sondes.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'admin@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'member@test.local', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'outsider@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333')
on conflict (id) do nothing;

insert into public.organizations (id, name)
values ('a0000000-0000-0000-0000-000000000001', 'Organisation de test');
insert into public.workspaces (id, organization_id, name, kind)
values (
  'a0000000-0000-0000-0000-0000000000a1',
  'a0000000-0000-0000-0000-000000000001',
  'Programme de test', 'program'
);
insert into public.workspace_members (workspace_id, profile_id, role) values
  ('a0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('a0000000-0000-0000-0000-0000000000a1', '22222222-2222-2222-2222-222222222222', 'member');

insert into public.approaches (
  id, workspace_id, ref_framework_id, cycle, instrument_module,
  instrument_subtype, complexity_score, complexity_class, complexity_factors,
  recommended_methods, evaluation_nature, questionnaire_answers,
  justifications, created_by
)
select
  'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1',
  id, 'mi_parcours', 'M2', 'programme', 5, 'complique', '{}', '{}',
  'externe_independante', '{}', '{}', '11111111-1111-1111-1111-111111111111'
from public.ref_frameworks
order by code
limit 1;

insert into public.frameworks (
  id, workspace_id, approach_id, status, validated_by, validated_at
)
values (
  'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1',
  'b0000000-0000-0000-0000-000000000001', 'validated',
  '11111111-1111-1111-1111-111111111111', now()
);
insert into public.pillars (id, framework_id, name, description, weight, order_index)
values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'Budget et absorption', 'Exécution budgétaire du programme.', 50, 1),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001',
   'Genre et inclusion', 'Prise en compte du genre.', 50, 2);
insert into public.pillar_variables (id, pillar_id, code, label, weight, order_index)
values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   'has_budget_execution', 'Taux d''exécution budgétaire', 1, 1),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002',
   'has_gender_strategy', 'Stratégie genre', 1, 1);

-- Sondes à jour : axe 1 pour le pilier Budget, axe 2 pour le pilier Genre.
insert into public.pillar_probe_embeddings (
  framework_id, workspace_id, pillar_id, pillar_variable_id, source_hash,
  embedding, model
)
select
  'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1',
  probe.pillar_id, probe.pillar_variable_id, probe.source_hash,
  pg_temp.axis(case probe.pillar_id
    when 'd0000000-0000-0000-0000-000000000001' then 1 else 2 end),
  'test-model'
from public.framework_probe_texts('c0000000-0000-0000-0000-000000000001') as probe;

-- ---------------------------------------------------------------------------
-- Corpus. Document A : deux segments Budget. Document B : un segment Budget,
-- un segment Genre, un segment hors sujet (axe 3) et un segment Genre non
-- publié. Document C : un segment Genre, encore à vérifier.
-- ---------------------------------------------------------------------------
insert into public.documents (
  id, workspace_id, original_filename, storage_path, file_hash,
  file_size_bytes, mime_type
)
select
  id, 'a0000000-0000-0000-0000-0000000000a1', name || '.pdf',
  'test/' || name || '.pdf', md5(name), 1000, 'application/pdf'
from (values
  ('f0000000-0000-0000-0000-00000000000a'::uuid, 'doc-a'),
  ('f0000000-0000-0000-0000-00000000000b'::uuid, 'doc-b'),
  ('f0000000-0000-0000-0000-00000000000c'::uuid, 'doc-c')
) as document (id, name);

insert into public.segments (id, document_id, workspace_id, text, published)
values
  ('0a000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000a',
   'a0000000-0000-0000-0000-0000000000a1', 'Budget exécuté à 80 %.', true),
  ('0a000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000a',
   'a0000000-0000-0000-0000-0000000000a1', 'Décaissements trimestriels.', true),
  ('0b000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000b',
   'a0000000-0000-0000-0000-0000000000a1', 'Revue budgétaire annuelle.', true),
  ('0b000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000b',
   'a0000000-0000-0000-0000-0000000000a1', 'Plan d''action genre.', true),
  ('0b000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000b',
   'a0000000-0000-0000-0000-0000000000a1', 'Offre technique du prestataire.', true),
  ('0b000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-00000000000b',
   'a0000000-0000-0000-0000-0000000000a1', 'Brouillon non publié.', false),
  ('0c000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000c',
   'a0000000-0000-0000-0000-0000000000a1', 'Quotas de femmes bénéficiaires.', true);

insert into public.segment_embeddings (segment_id, workspace_id, embedding, model)
values
  ('0a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', pg_temp.axis(1), 'test-model'),
  ('0a000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-0000000000a1', pg_temp.axis(1), 'test-model'),
  ('0b000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', pg_temp.axis(1), 'test-model'),
  ('0b000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-0000000000a1', pg_temp.axis(2), 'test-model'),
  ('0b000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-0000000000a1', pg_temp.axis(3), 'test-model'),
  ('0b000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-0000000000a1', pg_temp.axis(2), 'test-model'),
  ('0c000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', pg_temp.axis(2), 'test-model');

-- Les fonctions d'espace lisent l'utilisateur dans le jeton.
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- ---------------------------------------------------------------------------
-- T-05 : le document A entre seul au corpus.
-- ---------------------------------------------------------------------------
update public.documents set status = 'conforme', indexed_at = now()
where id = 'f0000000-0000-0000-0000-00000000000a';

select is(
  public.critical_mass_coverage('a0000000-0000-0000-0000-0000000000a1') ->> 'state',
  'ready',
  'la couverture est calculable une fois les sondes vectorisées'
);
select is(
  (select count(*)::integer from public.segment_classifications
   where document_id = 'f0000000-0000-0000-0000-00000000000a'
     and pillar_id = 'd0000000-0000-0000-0000-000000000001'),
  2,
  'T-05 : les deux segments du document A sont classés dans Budget'
);
select is(
  pg_temp.sources('pillars', 'd0000000-0000-0000-0000-000000000001'), 1,
  'T-05 : deux segments d''un même document comptent pour une seule source'
);
select is(
  pg_temp.sources('variables', 'e0000000-0000-0000-0000-000000000001'), 1,
  'T-05 : la règle vaut aussi pour les variables'
);

-- ---------------------------------------------------------------------------
-- T-09 : de la classification à la couverture, au fil du corpus.
-- ---------------------------------------------------------------------------
update public.documents set status = 'conforme', indexed_at = now()
where id = 'f0000000-0000-0000-0000-00000000000b';

select is(
  pg_temp.sources('pillars', 'd0000000-0000-0000-0000-000000000001'), 2,
  'T-09 : Budget est couvert par les documents A et B'
);
select is(
  pg_temp.sources('pillars', 'd0000000-0000-0000-0000-000000000002'), 1,
  'T-09 : Genre n''est couvert que par le document B'
);
select is(
  pg_temp.sources('variables', 'e0000000-0000-0000-0000-000000000001'), 2,
  'T-09 : la variable Budget suit son pilier'
);
select is(
  pg_temp.sources('variables', 'e0000000-0000-0000-0000-000000000002'), 1,
  'T-09 : la variable Genre suit son pilier'
);
select is_empty(
  $$select 1 from public.segment_classifications
    where segment_id = '0b000000-0000-0000-0000-000000000003'$$,
  'CA-10 : un segment sans pilier n''est pas classé et n''alimente rien'
);
select is_empty(
  $$select 1 from public.segment_classifications
    where segment_id = '0b000000-0000-0000-0000-000000000004'$$,
  'CA-10 : un segment non publié n''est pas classé'
);
select is_empty(
  $$select 1 from public.segment_classifications
    where document_id = 'f0000000-0000-0000-0000-00000000000c'$$,
  'T-09 : un document à vérifier reste hors du calcul'
);

update public.documents set status = 'integre_decision_humaine'
where id = 'f0000000-0000-0000-0000-00000000000c';
update public.documents set indexed_at = now()
where id = 'f0000000-0000-0000-0000-00000000000c';

select is(
  pg_temp.sources('pillars', 'd0000000-0000-0000-0000-000000000002'), 2,
  'T-09 : un document intégré sur décision humaine devient une source'
);

update public.documents set deleted_at = now()
where id = 'f0000000-0000-0000-0000-00000000000a';

select is(
  pg_temp.sources('pillars', 'd0000000-0000-0000-0000-000000000001'), 1,
  'T-09 : un document supprimé cesse d''être une source'
);

-- Une variable ajoutée au cadre n'a pas encore de sonde vectorisée.
insert into public.pillar_variables (pillar_id, code, label, weight, order_index)
values ('d0000000-0000-0000-0000-000000000002', 'has_gender_budget',
        'Budget sensible au genre', 1, 2);

select is(
  public.critical_mass_coverage('a0000000-0000-0000-0000-0000000000a1') ->> 'state',
  'pending',
  'T-09 : une sonde sans vecteur à jour rend la couverture provisoire'
);

select set_config('request.jwt.claims',
  '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select throws_ok(
  $$select public.critical_mass_coverage('a0000000-0000-0000-0000-0000000000a1')$$,
  '42501', 'WORKSPACE_MEMBER_REQUIRED',
  'la couverture est réservée aux membres de l''espace'
);

-- ---------------------------------------------------------------------------
-- T-10 : journalisation des modifications de paramètres.
-- ---------------------------------------------------------------------------
set local role authenticated;

select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select throws_ok(
  $$select public.update_critical_mass_settings(
      'a0000000-0000-0000-0000-0000000000a1', '{"saturation_document_cap": 40}')$$,
  '42501', 'WORKSPACE_ADMIN_REQUIRED',
  'T-10 : seul un administrateur de l''espace modifie les paramètres'
);

select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select throws_ok(
  $$select public.update_critical_mass_settings(
      'a0000000-0000-0000-0000-0000000000a1', '{"plafond": 40}')$$,
  'P0001', 'INVALID_SETTINGS',
  'T-10 : un paramètre inconnu est refusé'
);
select is(
  public.update_critical_mass_settings(
    'a0000000-0000-0000-0000-0000000000a1', '{"saturation_document_cap": 40}',
    'Corpus de programme volumineux'
  ) ->> 'changed',
  'true',
  'T-10 : la modification crée une nouvelle version'
);

reset role;

select is(
  (public.current_critical_mass_settings('a0000000-0000-0000-0000-0000000000a1'))
    .saturation_document_cap,
  40,
  'T-10 : la nouvelle valeur est celle de la dernière version de l''espace'
);
select results_eq(
  $$select actor_user_id, before_value ->> 'saturation_document_cap',
           after_value ->> 'saturation_document_cap', metadata ->> 'reason'
    from public.audit_events
    where workspace_id = 'a0000000-0000-0000-0000-0000000000a1'
      and operation = 'critical_mass_settings_updated'$$,
  $$values ('11111111-1111-1111-1111-111111111111'::uuid, '30', '40',
            'Corpus de programme volumineux')$$,
  'T-10 : le journal d''audit garde l''auteur, l''avant, l''après et le motif'
);

set local role authenticated;
select is(
  public.update_critical_mass_settings(
    'a0000000-0000-0000-0000-0000000000a1', '{"saturation_document_cap": 40}'
  ) ->> 'changed',
  'false',
  'T-10 : une valeur inchangée ne crée pas de version'
);
reset role;

select is(
  (select count(*)::integer from public.audit_events
   where workspace_id = 'a0000000-0000-0000-0000-0000000000a1'
     and operation = 'critical_mass_settings_updated'),
  1,
  'T-10 : ni version ni événement d''audit sans changement'
);

select * from finish();
rollback;
