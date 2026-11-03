-- ---------------------------------------------------------------------------
-- Backoffice : accès réservé aux administrateurs de la plateforme,
-- invitations, espaces et facturation.
--
-- Lancement : `supabase test db`, sur une base locale où les migrations de ce
-- dépôt sont appliquées.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(26);

create function pg_temp.as_user(user_id text)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    jsonb_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.as_service()
returns void
language sql
as $$
  select set_config('request.jwt.claims', '{"role": "service_role"}', true);
$$;

-- ---------------------------------------------------------------------------
-- Un administrateur Themiros, un client et son organisation, un compte
-- d'une autre organisation.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at, last_sign_in_at) values
  ('11111111-1111-1111-1111-111111111111', 'staff@test.local', 'authenticated', 'authenticated', now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'client@test.local', 'authenticated', 'authenticated', now(), now()),
  ('33333333-3333-3333-3333-333333333333', 'other@test.local', 'authenticated', 'authenticated', now(), now());
insert into public.profiles (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333')
on conflict (id) do nothing;
insert into public.platform_admins (profile_id)
values ('11111111-1111-1111-1111-111111111111');
insert into public.organizations (id, name) values
  ('a0000000-0000-0000-0000-000000000001', 'Organisation cliente'),
  ('a0000000-0000-0000-0000-000000000002', 'Autre organisation');
update public.profiles set organization_id = 'a0000000-0000-0000-0000-000000000001', role = 'admin'
where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set organization_id = 'a0000000-0000-0000-0000-000000000002', role = 'admin'
where id = '33333333-3333-3333-3333-333333333333';

-- ---------------------------------------------------------------------------
-- Accès
-- ---------------------------------------------------------------------------
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select throws_ok(
  $$select public.backoffice_list_organizations()$$,
  '42501', 'PLATFORM_ADMIN_REQUIRED',
  'un client n''ouvre pas le backoffice'
);
select is(public.is_platform_admin(), false, 'un client n''est pas admin plateforme');
select throws_ok(
  $$select * from public.subscriptions$$,
  '42501', null,
  'les tables de facturation ne se lisent pas directement'
);
reset role;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(
  jsonb_array_length(public.backoffice_list_organizations()), 2,
  'l''admin plateforme voit toutes les organisations'
);
select throws_ok(
  $$select public.backoffice_set_platform_admin('11111111-1111-1111-1111-111111111111', false)$$,
  '42501', 'CANNOT_REVOKE_SELF',
  'l''admin ne se retire pas lui-même'
);

-- ---------------------------------------------------------------------------
-- Espaces
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.backoffice_create_workspace(
    'a0000000-0000-0000-0000-000000000001', 'Projet', 'project', 'SN',
    'design', 2026, 2028, '33333333-3333-3333-3333-333333333333')$$,
  '22023', 'OWNER_NOT_IN_ORGANIZATION',
  'le responsable appartient à l''organisation'
);

create temp table created_workspace as
select public.backoffice_create_workspace(
  'a0000000-0000-0000-0000-000000000001', ' Projet pilote ', 'project', 'SN',
  'design', 2026, 2028, '22222222-2222-2222-2222-222222222222') as id;

select is(
  (public.backoffice_get_workspace((select id from created_workspace)) -> 'members' -> 0 ->> 'role'),
  'admin',
  'le responsable devient administrateur de l''espace'
);
select throws_ok(
  $$select public.backoffice_remove_workspace_member(
    (select id from created_workspace), '22222222-2222-2222-2222-222222222222')$$,
  '22023', 'LAST_WORKSPACE_ADMIN',
  'le dernier administrateur d''un espace ne se retire pas'
);
select throws_ok(
  $$select public.backoffice_set_workspace_member(
    (select id from created_workspace), '33333333-3333-3333-3333-333333333333', 'member')$$,
  '22023', 'MEMBER_NOT_IN_ORGANIZATION',
  'un compte d''une autre organisation n''entre pas dans l''espace'
);

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.backoffice_create_invitation(
    'a0000000-0000-0000-0000-000000000001', 'other@test.local', null, 'analyste', '{}', 'member')$$,
  '23505', 'USER_IN_OTHER_ORGANIZATION',
  'un compte rattaché ailleurs ne s''invite pas'
);

create temp table invitation as
select public.backoffice_create_invitation(
  'a0000000-0000-0000-0000-000000000001', ' New.User@Test.local ', 'Awa Ndiaye',
  'pmu', array[(select id from created_workspace)], 'viewer') as payload;

select is(
  (select payload ->> 'email' from invitation), 'new.user@test.local',
  'l''adresse est normalisée'
);
select is(
  (select (payload ->> 'existing_user')::boolean from invitation), false,
  'aucun compte n''existe encore'
);
select throws_ok(
  $$select public.backoffice_create_invitation(
    'a0000000-0000-0000-0000-000000000001', 'new.user@test.local', null, 'pmu', '{}', 'member')$$,
  '23505', 'INVITATION_ALREADY_EXISTS',
  'une seule invitation vivante par adresse'
);
select throws_ok(
  $$select public.backoffice_apply_invitation(
    (select (payload ->> 'id')::uuid from invitation), true, true)$$,
  '42501', 'permission denied for function backoffice_apply_invitation',
  'seule l''API rattache le compte invité'
);
reset role;

-- GoTrue crée le compte à l'envoi de l'invitation.
insert into auth.users (id, email, aud, role) values
  ('44444444-4444-4444-4444-444444444444', 'new.user@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id) values ('44444444-4444-4444-4444-444444444444')
on conflict (id) do nothing;

select pg_temp.as_service();
select is(
  public.backoffice_apply_invitation((select (payload ->> 'id')::uuid from invitation), true, true),
  '44444444-4444-4444-4444-444444444444'::uuid,
  'le compte invité est retrouvé par son adresse'
);
select is(
  (select organization_id from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'le compte invité rejoint l''organisation'
);
select is(
  (select role from public.workspace_members
   where profile_id = '44444444-4444-4444-4444-444444444444'),
  'viewer',
  'le compte invité rejoint l''espace avec le rôle prévu'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(
  (public.backoffice_list_invitations() -> 0 ->> 'status'), 'pending',
  'l''invitation reste en attente avant la première connexion'
);
select is(
  (public.backoffice_revoke_invitation((select (payload ->> 'id')::uuid from invitation)) ->> 'delete_user')::boolean,
  true,
  'révoquer une invitation qui a créé le compte le fait supprimer'
);
reset role;
select is(
  (select count(*)::integer from public.workspace_members
   where profile_id = '44444444-4444-4444-4444-444444444444'),
  0,
  'la révocation retire le compte de l''espace'
);

-- ---------------------------------------------------------------------------
-- Facturation
-- ---------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
set local role authenticated;
create temp table subscription as
select public.backoffice_save_subscription(
  null, 'a0000000-0000-0000-0000-000000000001', 'essential', 'active', 4080, 15,
  current_date - 10, current_date + 355, true, null) as id;
select throws_ok(
  $$select public.backoffice_save_subscription(
    null, 'a0000000-0000-0000-0000-000000000001', 'professional', 'active', 15000, 40,
    current_date, current_date + 365, true, null)$$,
  '23505', 'SUBSCRIPTION_ALREADY_LIVE',
  'un seul abonnement en cours par organisation'
);
select is(
  (public.backoffice_list_subscriptions() -> 0 ->> 'evaluations_used')::integer, 1,
  'l''espace créé sur la période compte comme une évaluation'
);

create temp table draft as
select public.backoffice_save_invoice(
  null, 'a0000000-0000-0000-0000-000000000001', (select id from subscription),
  'Abonnement Essentiel 2026', 4080, 20, null, null) as id;
select is(
  public.backoffice_issue_invoice((select id from draft), date '2026-11-03', date '2026-12-03'),
  'TH-2026-0001',
  'la première facture de l''année porte le numéro 0001'
);
select throws_ok(
  $$select public.backoffice_save_invoice(
    (select id from draft), 'a0000000-0000-0000-0000-000000000001', null,
    'Modifiée', 1, 20, null, null)$$,
  '22023', 'INVOICE_NOT_DRAFT',
  'une facture émise ne se modifie plus'
);
select is(
  (public.backoffice_billing_summary() ->> 'outstanding_eur')::numeric, 4896.00,
  'l''encours est compté TTC'
);
select throws_ok(
  $$select public.backoffice_delete_organization('a0000000-0000-0000-0000-000000000001')$$,
  '23503', 'ORGANIZATION_HAS_INVOICES',
  'une organisation facturée ne se supprime pas'
);
reset role;

select * from finish();
rollback;
