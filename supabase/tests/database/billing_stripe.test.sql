-- ---------------------------------------------------------------------------
-- Facturation Stripe et page Facturation du dashboard : accès réservé aux
-- administrateurs de l'organisation, miroir Stripe idempotent, lignes Stripe
-- en lecture seule pour le backoffice.
--
-- Lancement : `supabase test db`, sur une base locale où les migrations de ce
-- dépôt sont appliquées.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

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
-- Un admin Themiros ; une organisation cliente (admin, analyste, décideur) ;
-- une autre organisation et son admin.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at, last_sign_in_at) values
  ('11111111-1111-1111-1111-111111111111', 'staff@test.local', 'authenticated', 'authenticated', now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'admin@test.local', 'authenticated', 'authenticated', now(), now()),
  ('33333333-3333-3333-3333-333333333333', 'other@test.local', 'authenticated', 'authenticated', now(), now()),
  ('44444444-4444-4444-4444-444444444444', 'analyste@test.local', 'authenticated', 'authenticated', now(), now()),
  ('55555555-5555-5555-5555-555555555555', 'decideur@test.local', 'authenticated', 'authenticated', now(), now());
insert into public.profiles (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444'),
  ('55555555-5555-5555-5555-555555555555')
on conflict (id) do nothing;
insert into public.platform_admins (profile_id)
values ('11111111-1111-1111-1111-111111111111');
insert into public.organizations (id, name) values
  ('a0000000-0000-0000-0000-000000000001', 'Organisation cliente'),
  ('a0000000-0000-0000-0000-000000000002', 'Autre organisation');
update public.profiles set organization_id = 'a0000000-0000-0000-0000-000000000001', role = 'admin'
where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set organization_id = 'a0000000-0000-0000-0000-000000000001', role = 'analyste'
where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set organization_id = 'a0000000-0000-0000-0000-000000000001', role = 'decideur'
where id = '55555555-5555-5555-5555-555555555555';
update public.profiles set organization_id = 'a0000000-0000-0000-0000-000000000002', role = 'admin'
where id = '33333333-3333-3333-3333-333333333333';
insert into public.workspaces (organization_id, name, kind)
values ('a0000000-0000-0000-0000-000000000001', 'Évaluation 2026', 'program');

-- ---------------------------------------------------------------------------
-- Accès
-- ---------------------------------------------------------------------------
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
set local role authenticated;
select throws_ok(
  $$select public.organization_billing()$$,
  '42501', 'ORGANIZATION_ADMIN_REQUIRED',
  'un analyste n''ouvre pas la facturation'
);
select throws_ok(
  $$select public.stripe_begin_event('evt_x', 'test')$$,
  '42501', null,
  'les fonctions stripe_* sont réservées au serveur'
);
reset role;

select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
set local role authenticated;
select throws_ok(
  $$select public.organization_billing()$$,
  '42501', 'ORGANIZATION_ADMIN_REQUIRED',
  'un décideur n''ouvre pas la facturation'
);
reset role;

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(
  public.organization_billing() -> 'subscription', 'null'::jsonb,
  'sans abonnement, la page le dit'
);
select is(
  (select array_agg(p ->> 'code' order by p ->> 'code')
   from jsonb_array_elements(public.organization_billing() -> 'plans') p
   where (p ->> 'self_serve')::boolean),
  array['essential', 'professional'],
  'seules Essentiel et Professionnel se souscrivent en ligne'
);
select throws_ok(
  $$update public.organizations set stripe_customer_id = 'cus_vole'
    where id = 'a0000000-0000-0000-0000-000000000001'$$,
  '42501', 'STRIPE_CUSTOMER_READ_ONLY',
  'un admin n''écrit pas lui-même le client Stripe'
);
select throws_ok(
  $$insert into public.organizations (name, stripe_customer_id) values ('X', 'cus_vole')$$,
  '42501', 'STRIPE_CUSTOMER_READ_ONLY',
  'ni en créant une organisation'
);
select throws_ok(
  $$select public.organization_update_billing_contact('pas-un-email', null, null)$$,
  '22023', 'BILLING_EMAIL_INVALID',
  'l''e-mail de facturation est validé'
);
select lives_ok(
  $$select public.organization_update_billing_contact(
    ' Compta@Client.ORG ', '1 rue de la Paix, Paris', 'fr 12 345678901')$$,
  'l''admin met à jour ses coordonnées de facturation'
);
select is(
  public.organization_billing() -> 'organization' ->> 'billing_email', 'compta@client.org',
  'l''e-mail est normalisé'
);
reset role;

-- ---------------------------------------------------------------------------
-- Contrats manuels du backoffice : pilote en cours, facture émise, brouillon
-- ---------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.backoffice_save_subscription(
  null, 'a0000000-0000-0000-0000-000000000001', 'pilot', 'trialing', 0, 2,
  current_date - 30, current_date + 30, false, 'Pilote gratuit');
create temp table manual_invoice as
select public.backoffice_save_invoice(
  null, 'a0000000-0000-0000-0000-000000000001', null,
  'Atelier de lancement', 1000, 20, null, 'Note interne') as id;
select public.backoffice_issue_invoice(
  (select id from manual_invoice), current_date - 5, current_date + 25);
select public.backoffice_save_invoice(
  null, 'a0000000-0000-0000-0000-000000000001', null,
  'Brouillon', 500, 20, null, null);
-- Contrat négocié actif dans l'autre organisation.
select public.backoffice_save_subscription(
  null, 'a0000000-0000-0000-0000-000000000002', 'bespoke', 'active', 30000, null,
  current_date - 30, current_date + 335, true, null);
reset role;

-- ---------------------------------------------------------------------------
-- Webhooks Stripe (clé serveur)
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
set local role service_role;
select is(
  public.stripe_set_customer('a0000000-0000-0000-0000-000000000001', 'cus_1'), 'cus_1',
  'le client Stripe est enregistré'
);
select is(
  public.stripe_set_customer('a0000000-0000-0000-0000-000000000001', 'cus_2'), 'cus_1',
  'un second Checkout garde le même client'
);
select is(
  public.stripe_organization_for_customer('cus_1'), 'a0000000-0000-0000-0000-000000000001'::uuid,
  'le client Stripe retrouve son organisation'
);

select is(public.stripe_begin_event('evt_1', 'invoice.paid'), true, 'un nouvel événement est à traiter');
select is(public.stripe_begin_event('evt_1', 'invoice.paid'), true,
  'un événement en échec ou en cours reste à traiter');
select public.stripe_finish_event('evt_1');
select is(public.stripe_begin_event('evt_1', 'invoice.paid'), false, 'un événement traité est ignoré');

create temp table stripe_sub as
select public.stripe_sync_subscription(
  'a0000000-0000-0000-0000-000000000001', 'sub_1', 'price_ess', 'essential', 'active', 4080,
  current_date - 1, current_date + 364, false) as id;
select public.stripe_sync_subscription(
  'a0000000-0000-0000-0000-000000000001', 'sub_1', 'price_ess', 'essential', 'active', 4080,
  current_date - 1, current_date + 364, true);
select results_eq(
  $$select source, status, cancel_at_period_end, auto_renew, evaluations_included
    from public.subscriptions
    where organization_id = 'a0000000-0000-0000-0000-000000000001' and status <> 'canceled'$$,
  $$values ('stripe'::text, 'active'::text, true, false, 15)$$,
  'l''abonnement Stripe est recopié une seule fois, le pilote est clos'
);

select public.stripe_sync_invoice(
  'a0000000-0000-0000-0000-000000000001', 'in_1', 'sub_1', 'THS-0001',
  'Abonnement Essentiel', 4080, 816, 4896, 'issued', current_date - 1, null, null);
select public.stripe_sync_invoice(
  'a0000000-0000-0000-0000-000000000001', 'in_1', 'sub_1', 'THS-0001',
  'Abonnement Essentiel', 4080, 816, 4896, 'paid', current_date - 1, null, current_date);
select results_eq(
  $$select status, vat_rate, total_eur, subscription_id = (select id from stripe_sub), paid_on
    from public.invoices where stripe_invoice_id = 'in_1'$$,
  $$values ('paid'::text, 20.00::numeric, 4896.00::numeric, true, current_date)$$,
  'la facture Stripe est recopiée une seule fois et rattachée à l''abonnement'
);
select throws_ok(
  $$select public.stripe_sync_invoice(
    'a0000000-0000-0000-0000-000000000002', 'in_1', null, 'THS-0001',
    'Détournée', 1, 0, 1, 'paid', current_date, null, current_date)$$,
  '22023', 'STRIPE_INVOICE_ORGANIZATION_MISMATCH',
  'une facture Stripe ne change pas d''organisation'
);
select throws_ok(
  $$select public.stripe_sync_subscription(
    'a0000000-0000-0000-0000-000000000002', 'sub_2', 'price_ess', 'essential', 'active', 4080,
    current_date, current_date + 365, false)$$,
  '23505', 'MANUAL_CONTRACT_ACTIVE',
  'un contrat négocié actif n''est jamais écrasé'
);
reset role;
create temp table stripe_invoice as
select id from public.invoices where stripe_invoice_id = 'in_1';
grant select on stripe_sub, stripe_invoice to authenticated;

-- ---------------------------------------------------------------------------
-- Backoffice : lignes Stripe en lecture seule
-- ---------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(
  $$select public.backoffice_save_subscription(
    (select id from stripe_sub), 'a0000000-0000-0000-0000-000000000001', 'professional',
    'active', 1, 40, current_date, current_date + 365, true, null)$$,
  '42501', 'SUBSCRIPTION_MANAGED_BY_STRIPE',
  'le backoffice ne modifie pas un abonnement Stripe'
);
select throws_ok(
  $$select public.backoffice_set_invoice_status(
    (select id from stripe_invoice), 'issued')$$,
  '42501', 'INVOICE_MANAGED_BY_STRIPE',
  'le backoffice ne modifie pas une facture Stripe'
);
select is(
  (select s ->> 'source' from jsonb_array_elements(
    public.backoffice_list_subscriptions('a0000000-0000-0000-0000-000000000001')) s
   where s ->> 'status' <> 'canceled'),
  'stripe',
  'le backoffice voit l''origine Stripe'
);
reset role;

-- ---------------------------------------------------------------------------
-- Page Facturation de l'admin
-- ---------------------------------------------------------------------------
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select results_eq(
  $$select b -> 'subscription' ->> 'source', b -> 'subscription' ->> 'plan_code',
           (b -> 'subscription' ->> 'evaluations_used')::integer,
           (b -> 'organization' ->> 'has_stripe_customer')::boolean
    from (select public.organization_billing() as b) x$$,
  $$values ('stripe'::text, 'essential'::text, 1, true)$$,
  'l''admin voit son abonnement Stripe et son quota consommé'
);
select ok(
  not (public.organization_billing() -> 'subscription' ? 'notes')
  and not (public.organization_billing() -> 'subscription' ? 'ai_cost_eur'),
  'ni notes internes ni coût IA'
);
select is(
  (select array_agg(i ->> 'number' order by i ->> 'number')
   from jsonb_array_elements(public.organization_billing() -> 'invoices') i),
  array['TH-' || to_char(current_date - 5, 'YYYY') || '-0001', 'THS-0001'],
  'les factures émises sont listées, pas les brouillons'
);
select is(
  public.organization_billing_invoice(
    (select id from stripe_invoice)) ->> 'stripe_invoice_id',
  'in_1',
  'l''admin ouvre sa facture pour le PDF'
);
reset role;

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select throws_ok(
  format($$select public.organization_billing_invoice(%L)$$,
    (select id from stripe_invoice)),
  'P0002', 'INVOICE_NOT_FOUND',
  'la facture d''une autre organisation est introuvable'
);
reset role;

select * from finish();
rollback;
