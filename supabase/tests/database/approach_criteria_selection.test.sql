-- ---------------------------------------------------------------------------
-- Sélection des critères de l'approche (RG-4.7, décision du 21/10/2026) :
-- critères CAD-OCDE obligatoires, critères complémentaires au choix de
-- l'utilisateur, exclusions du cycle prioritaires.
--
-- Lancement : `supabase test db`, sur une base locale où les migrations de ce
-- dépôt sont appliquées.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

create function pg_temp.as_user(user_id text)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    jsonb_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

-- Lot de critères tel que l'envoie le front : `active` est retenu (même si le
-- cycle l'exclut, pour tester le refus), le reste est non applicable ;
-- `omitted` est absent du lot ; `dac_override` marque aussi les CAD comme
-- ajoutés à la main.
create function pg_temp.payload(
  target_cycle text,
  active text[],
  omitted text[] default '{}',
  dac_override boolean default false
)
returns jsonb
language sql
as $$
  with rows as (
    select
      criterion.id,
      criterion.is_oecd_dac,
      rule.applicability,
      criterion.code = any(active) as is_active
    from public.ref_criteria as criterion
    join public.ref_cycle_criteria as rule
      on rule.criterion_id = criterion.id
      and rule.cycle = target_cycle
    where criterion.version = '2026-09'
      and criterion.code <> all(omitted)
  ),
  counted as (
    select count(*) filter (where is_active) as active_count from rows
  )
  select jsonb_agg(jsonb_build_object(
    'refCriterionId', rows.id,
    'applicability', case
      when not rows.is_active then 'non_applicable'
      when rows.applicability = 'non_applicable' then 'obligatoire'
      else rows.applicability::text
    end,
    'weight', case when rows.is_active then 100.0 / counted.active_count else 0 end,
    'source', 'cycle',
    'manualOverride', rows.is_active and (not rows.is_oecd_dac or dac_override)
  ))
  from rows, counted;
$$;

create function pg_temp.save(target_cycle text, criteria jsonb)
returns uuid
language sql
as $$
  select (public.save_approach_proposal(
    'a0000000-0000-0000-0000-0000000000a1',
    (select id from public.ref_frameworks order by code limit 1),
    target_cycle::public.evaluation_cycle,
    'M2', 'programme', 5, 'complique', '{}', '{}',
    'externe_independante', '{}', '{}', 'fr', criteria
  )).id;
$$;

-- Critères retenus ou ajoutés à la main sur la proposition en cours.
create function pg_temp.codes(manual_only boolean default false)
returns text[]
language sql
as $$
  select coalesce(array_agg(criterion.code order by criterion.code), '{}')
  from public.approach_criteria as saved
  join public.approaches as approach on approach.id = saved.approach_id
  join public.ref_criteria as criterion on criterion.id = saved.ref_criterion_id
  where approach.workspace_id = 'a0000000-0000-0000-0000-0000000000a1'
    and approach.status in ('proposed', 'modified')
    and saved.applicability <> 'non_applicable'
    and (not manual_only or saved.manual_override);
$$;

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'admin@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id) values
  ('11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;
insert into public.organizations (id, name)
values ('a0000000-0000-0000-0000-000000000001', 'Organisation de test');
insert into public.workspaces (id, organization_id, name, kind)
values (
  'a0000000-0000-0000-0000-0000000000a1',
  'a0000000-0000-0000-0000-000000000001',
  'Programme de test', 'program'
);
insert into public.workspace_members (workspace_id, profile_id, role)
values ('a0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'admin');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

-- ---------------------------------------------------------------------------
-- Cas acceptés.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select pg_temp.save('mi_parcours', pg_temp.payload('mi_parcours',
    array['pertinence', 'coherence', 'efficacite', 'efficience', 'impact', 'durabilite']))$$,
  'les six critères CAD-OCDE seuls suffisent');
select is(pg_temp.codes(),
  array['coherence', 'durabilite', 'efficacite', 'efficience', 'impact', 'pertinence'],
  'seuls les critères CAD-OCDE sont retenus');

select lives_ok(
  $$select pg_temp.save('mi_parcours', pg_temp.payload('mi_parcours',
    array['pertinence', 'coherence', 'efficacite', 'efficience', 'impact', 'durabilite', 'equite']))$$,
  'un critère complémentaire peut être ajouté');
select is(pg_temp.codes(true), array['equite'],
  'le critère complémentaire ajouté est marqué manual_override');

select lives_ok(
  $$select pg_temp.save('mi_parcours', pg_temp.payload('mi_parcours',
    array['pertinence', 'coherence', 'efficacite', 'efficience', 'impact', 'durabilite'],
    dac_override => true))$$,
  'un CAD signalé comme ajouté à la main reste accepté');
select is(pg_temp.codes(true), '{}'::text[],
  'un critère CAD-OCDE n''est jamais marqué manual_override');

select lives_ok(
  $$select pg_temp.save('en_cours', pg_temp.payload('en_cours',
    array['pertinence', 'coherence', 'efficacite', 'efficience', 'durabilite']))$$,
  'en cours, les cinq CAD applicables suffisent (Impact est exclu)');

-- ---------------------------------------------------------------------------
-- Cas refusés.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select pg_temp.save('mi_parcours', pg_temp.payload('mi_parcours',
    array['coherence', 'efficacite', 'efficience', 'impact', 'durabilite', 'equite']))$$,
  'P0001', 'OECD-DAC criteria applicable to the cycle cannot be removed',
  'un critère CAD-OCDE ne peut pas être retiré');

select throws_ok(
  $$select pg_temp.save('mi_parcours', pg_temp.payload('mi_parcours',
    array['coherence', 'efficacite', 'efficience', 'impact', 'durabilite'],
    omitted => array['pertinence']))$$,
  'P0001', 'OECD-DAC criteria applicable to the cycle cannot be removed',
  'un critère CAD-OCDE ne peut pas être omis du lot');

select throws_ok(
  $$select pg_temp.save('en_cours', pg_temp.payload('en_cours',
    array['pertinence', 'coherence', 'efficacite', 'efficience', 'impact', 'durabilite']))$$,
  'P0001', 'A criterion excluded by the cycle cannot be applied',
  'un critère exclu par le cycle ne peut pas être retenu');

select is(pg_temp.codes(),
  array['coherence', 'durabilite', 'efficacite', 'efficience', 'pertinence'],
  'un enregistrement refusé laisse la proposition précédente intacte');

select * from finish();
rollback;
