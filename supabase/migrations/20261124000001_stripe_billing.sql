-- ---------------------------------------------------------------------------
-- Facturation en libre-service par Stripe, et page Facturation du dashboard.
--
-- Stripe fait foi pour les abonnements souscrits en ligne (Checkout) ; les
-- tables subscriptions et invoices en restent le miroir, alimenté par les
-- webhooks (fonctions stripe_*, clé serveur uniquement). La colonne source
-- distingue ces lignes (« stripe ») des contrats négociés saisis dans le
-- backoffice (« manual »), qui continuent de fonctionner comme avant.
--
--   - Une ligne stripe ne se modifie que par les fonctions stripe_* : un
--     trigger refuse toute autre écriture (backoffice compris) avec
--     SUBSCRIPTION_MANAGED_BY_STRIPE / INVOICE_MANAGED_BY_STRIPE.
--   - Seules les offres self_serve (Essentiel, Professionnel) se souscrivent
--     en ligne ; leur prix Stripe se retrouve par stripe_lookup_key, ce qui
--     évite de coder en dur un price_id différent en test et en production.
--   - Les factures Stripe gardent leur numéro Stripe (préfixe de compte
--     THS-) ; la série TH-AAAA-NNNN reste celle des factures manuelles.
--   - stripe_events rend les webhooks idempotents.
--
-- Côté dashboard, les administrateurs de l'organisation (profiles.role =
-- 'admin') lisent leur offre, leur quota et leurs factures par
-- organization_billing() ; les autres rôles reçoivent
-- ORGANIZATION_ADMIN_REQUIRED.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Colonnes
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists stripe_customer_id text unique;

alter table public.billing_plans
  add column if not exists self_serve boolean not null default false,
  add column if not exists stripe_lookup_key text unique;

update public.billing_plans
set self_serve = true, stripe_lookup_key = 'themiros_' || code || '_annual'
where code in ('essential', 'professional');

alter table public.subscriptions
  add column if not exists source text not null default 'manual',
  add column if not exists stripe_subscription_id text unique,
  add column if not exists stripe_price_id text,
  add column if not exists cancel_at_period_end boolean not null default false;

alter table public.subscriptions
  drop constraint if exists subscriptions_source_check;
alter table public.subscriptions
  add constraint subscriptions_source_check check (
    source in ('manual', 'stripe')
    and (source = 'stripe') = (stripe_subscription_id is not null)
  );

alter table public.invoices
  add column if not exists source text not null default 'manual',
  add column if not exists stripe_invoice_id text unique,
  -- Montants exacts de Stripe (TVA calculée par Stripe Tax, autoliquidation
  -- comprise). Null pour une facture manuelle : TVA = HT × vat_rate.
  add column if not exists tax_eur numeric(12, 2),
  add column if not exists total_eur numeric(12, 2);

alter table public.invoices
  drop constraint if exists invoices_source_check;
alter table public.invoices
  add constraint invoices_source_check check (
    source in ('manual', 'stripe')
    and (source = 'stripe') = (stripe_invoice_id is not null)
  );

create index if not exists idx_invoices_subscription
  on public.invoices (subscription_id);

-- ---------------------------------------------------------------------------
-- Gardes
-- ---------------------------------------------------------------------------

-- Le client Stripe ne s'écrit que côté serveur : la RLS de base laisse un
-- admin d'organisation modifier sa ligne (et tout compte en créer une) ; sans
-- ce trigger, il pourrait y inscrire le client Stripe d'un autre et ouvrir
-- son portail de paiement.
create or replace function public.guard_organization_stripe_customer()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated')
    and new.stripe_customer_id is distinct from (
      case when tg_op = 'UPDATE' then old.stripe_customer_id end
    )
  then
    raise exception 'STRIPE_CUSTOMER_READ_ONLY' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_organization_stripe_customer on public.organizations;
create trigger guard_organization_stripe_customer
  before insert or update on public.organizations
  for each row execute function public.guard_organization_stripe_customer();

-- Les fonctions stripe_* posent themiros.billing_writer = 'stripe' le temps
-- de leur écriture ; toute autre écriture d'une ligne stripe est refusée.
create or replace function public.guard_stripe_billing_rows()
returns trigger
language plpgsql
as $$
declare
  code text := case tg_table_name
    when 'subscriptions' then 'SUBSCRIPTION_MANAGED_BY_STRIPE'
    else 'INVOICE_MANAGED_BY_STRIPE'
  end;
begin
  if coalesce(current_setting('themiros.billing_writer', true), '') = 'stripe' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if (tg_op in ('UPDATE', 'DELETE') and old.source = 'stripe')
    or (tg_op in ('INSERT', 'UPDATE') and new.source = 'stripe')
  then
    raise exception '%', code using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists guard_stripe_subscriptions on public.subscriptions;
create trigger guard_stripe_subscriptions
  before insert or update or delete on public.subscriptions
  for each row execute function public.guard_stripe_billing_rows();

drop trigger if exists guard_stripe_invoices on public.invoices;
create trigger guard_stripe_invoices
  before insert or update or delete on public.invoices
  for each row execute function public.guard_stripe_billing_rows();

-- ---------------------------------------------------------------------------
-- Idempotence des webhooks
-- ---------------------------------------------------------------------------
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

comment on table public.stripe_events is
  'Événements Stripe reçus par le webhook ; processed_at non nul : déjà traité.';

-- ---------------------------------------------------------------------------
-- Lectures communes
-- ---------------------------------------------------------------------------

-- Évaluations consommées sur la période d'un abonnement : espaces créés
-- entre starts_on et ends_on (une évaluation = un espace traité de bout en
-- bout). Les dates de période Stripe alimentent starts_on / ends_on : le
-- compteur repart de zéro à chaque renouvellement.
create or replace function public.subscription_evaluations_used(s public.subscriptions)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*) from public.workspaces w
  where w.organization_id = s.organization_id
    and w.created_at >= s.starts_on
    and w.created_at < s.ends_on + 1;
$$;

revoke execute on function public.subscription_evaluations_used(public.subscriptions)
  from public, anon, authenticated;

create or replace function public.invoice_total_eur(i public.invoices)
returns numeric
language sql
immutable
as $$
  select coalesce(i.total_eur, round(i.amount_eur * (1 + i.vat_rate / 100), 2));
$$;

create or replace function public.invoice_tax_eur(i public.invoices)
returns numeric
language sql
immutable
as $$
  select coalesce(i.tax_eur, round(i.amount_eur * i.vat_rate / 100, 2));
$$;

revoke execute on function public.invoice_total_eur(public.invoices)
  from public, anon, authenticated;
revoke execute on function public.invoice_tax_eur(public.invoices)
  from public, anon, authenticated;

-- Backoffice : mêmes champs qu'avant, plus l'origine Stripe.
create or replace function public.backoffice_subscription_json(s public.subscriptions)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', s.id,
    'organization_id', s.organization_id,
    'organization_name', o.name,
    'plan_code', s.plan_code,
    'plan_name', p.name,
    'billing_cycle', p.billing_cycle,
    'status', s.status,
    'price_eur', s.price_eur,
    'evaluations_included', s.evaluations_included,
    'evaluations_used', public.subscription_evaluations_used(s),
    'ai_cost_eur', (
      select coalesce(sum(u.cost_eur), 0)
      from public.ai_usage u
      join public.workspaces w on w.id = u.workspace_id
      where w.organization_id = s.organization_id
        and u.created_at >= s.starts_on
        and u.created_at < s.ends_on + 1
    ),
    'starts_on', s.starts_on,
    'ends_on', s.ends_on,
    'auto_renew', s.auto_renew,
    'cancel_at_period_end', s.cancel_at_period_end,
    'source', s.source,
    'stripe_subscription_id', s.stripe_subscription_id,
    'notes', s.notes,
    'created_at', s.created_at
  )
  from public.organizations o, public.billing_plans p
  where o.id = s.organization_id and p.code = s.plan_code;
$$;

create or replace function public.backoffice_invoice_json(i public.invoices)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', i.id,
    'organization_id', i.organization_id,
    'organization_name', o.name,
    'subscription_id', i.subscription_id,
    'number', i.number,
    'label', i.label,
    'amount_eur', i.amount_eur,
    'vat_rate', i.vat_rate,
    'tax_eur', public.invoice_tax_eur(i),
    'total_eur', public.invoice_total_eur(i),
    'status', i.status,
    'overdue', i.status = 'issued' and i.due_on < current_date,
    'issued_on', i.issued_on,
    'due_on', i.due_on,
    'paid_on', i.paid_on,
    'source', i.source,
    'stripe_invoice_id', i.stripe_invoice_id,
    'notes', i.notes,
    'created_at', i.created_at
  )
  from public.organizations o
  where o.id = i.organization_id;
$$;

revoke execute on function public.backoffice_subscription_json(public.subscriptions)
  from public, anon, authenticated;
revoke execute on function public.backoffice_invoice_json(public.invoices)
  from public, anon, authenticated;

-- Encours et encaissements : montants TTC exacts des factures Stripe.
create or replace function public.backoffice_billing_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  return jsonb_build_object(
    'arr_eur', (
      select coalesce(sum(s.price_eur * 365.0 / (s.ends_on - s.starts_on)), 0)
      from public.subscriptions s
      join public.billing_plans p on p.code = s.plan_code
      where s.status in ('active', 'past_due')
        and p.billing_cycle = 'annual'
        and current_date between s.starts_on and s.ends_on
    ),
    'live_subscription_count', (
      select count(*) from public.subscriptions where status <> 'canceled'
    ),
    'renewals_90d_count', (
      select count(*) from public.subscriptions
      where status <> 'canceled'
        and ends_on between current_date and current_date + 90
    ),
    'outstanding_eur', (
      select coalesce(sum(public.invoice_total_eur(i)), 0)
      from public.invoices i where i.status = 'issued'
    ),
    'overdue_eur', (
      select coalesce(sum(public.invoice_total_eur(i)), 0)
      from public.invoices i where i.status = 'issued' and i.due_on < current_date
    ),
    'paid_ytd_eur', (
      select coalesce(sum(public.invoice_total_eur(i)), 0)
      from public.invoices i
      where i.status = 'paid'
        and i.paid_on >= date_trunc('year', current_date)::date
    ),
    'ai_cost_30d_eur', (
      select coalesce(sum(cost_eur), 0) from public.ai_usage
      where created_at >= now() - interval '30 days'
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard : administrateurs de l'organisation
-- ---------------------------------------------------------------------------
create or replace function public.assert_organization_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  select p.organization_id into org_id
  from public.profiles p
  where p.id = auth.uid() and p.role = 'admin' and p.organization_id is not null;

  if org_id is null then
    raise exception 'ORGANIZATION_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  return org_id;
end;
$$;

revoke execute on function public.assert_organization_admin()
  from public, anon, authenticated;

create or replace function public.organization_invoice_json(i public.invoices)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', i.id,
    'number', i.number,
    'label', i.label,
    'amount_eur', i.amount_eur,
    'vat_rate', i.vat_rate,
    'tax_eur', public.invoice_tax_eur(i),
    'total_eur', public.invoice_total_eur(i),
    'status', i.status,
    'overdue', i.status = 'issued' and i.due_on < current_date,
    'issued_on', i.issued_on,
    'due_on', i.due_on,
    'paid_on', i.paid_on,
    'source', i.source
  );
$$;

revoke execute on function public.organization_invoice_json(public.invoices)
  from public, anon, authenticated;

-- Page Facturation : coordonnées, abonnement (en cours, sinon le dernier
-- résilié), offres, factures émises. Ni notes internes ni coût IA.
create or replace function public.organization_billing()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid := public.assert_organization_admin();
begin
  return jsonb_build_object(
    'organization', (
      select jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'billing_email', o.billing_email,
        'billing_address', o.billing_address,
        'vat_number', o.vat_number,
        'has_stripe_customer', o.stripe_customer_id is not null
      )
      from public.organizations o where o.id = org_id
    ),
    'subscription', (
      select jsonb_build_object(
        'id', s.id,
        'plan_code', s.plan_code,
        'plan_name', p.name,
        'billing_cycle', p.billing_cycle,
        'status', s.status,
        'source', s.source,
        'price_eur', s.price_eur,
        'evaluations_included', s.evaluations_included,
        'evaluations_used', public.subscription_evaluations_used(s),
        'starts_on', s.starts_on,
        'ends_on', s.ends_on,
        'auto_renew', s.auto_renew,
        'cancel_at_period_end', s.cancel_at_period_end
      )
      from public.subscriptions s
      join public.billing_plans p on p.code = s.plan_code
      where s.organization_id = org_id
      order by (s.status = 'canceled'), s.ends_on desc, s.created_at desc
      limit 1
    ),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', p.code,
        'name', p.name,
        'billing_cycle', p.billing_cycle,
        'list_price_eur', p.list_price_eur,
        'evaluations_included', p.evaluations_included,
        'self_serve', p.self_serve
      ) order by p.sort_order)
      from public.billing_plans p where p.active
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(
        public.organization_invoice_json(i)
        order by i.issued_on desc, i.created_at desc
      )
      from public.invoices i
      where i.organization_id = org_id and i.status <> 'draft'
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.organization_billing() from public, anon;
grant execute on function public.organization_billing() to authenticated;

create or replace function public.organization_update_billing_contact(
  p_billing_email text,
  p_billing_address text,
  p_vat_number text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.assert_organization_admin();
  email text := nullif(lower(btrim(p_billing_email)), '');
begin
  if email is not null and email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'BILLING_EMAIL_INVALID' using errcode = '22023';
  end if;

  update public.organizations
  set billing_email = email,
      billing_address = nullif(btrim(p_billing_address), ''),
      vat_number = nullif(upper(regexp_replace(p_vat_number, '\s', '', 'g')), '')
  where id = org_id;
end;
$$;

revoke execute on function public.organization_update_billing_contact(text, text, text)
  from public, anon;
grant execute on function public.organization_update_billing_contact(text, text, text)
  to authenticated;

-- Une facture émise de l'organisation, pour son PDF (appelée par l'API avec
-- le jeton de l'utilisateur).
create or replace function public.organization_billing_invoice(p_invoice_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid := public.assert_organization_admin();
  result jsonb;
begin
  select public.organization_invoice_json(i) || jsonb_build_object(
    'stripe_invoice_id', i.stripe_invoice_id,
    'organization', jsonb_build_object(
      'name', o.name,
      'billing_email', o.billing_email,
      'billing_address', o.billing_address,
      'vat_number', o.vat_number
    )
  )
  into result
  from public.invoices i
  join public.organizations o on o.id = i.organization_id
  where i.id = p_invoice_id
    and i.organization_id = org_id
    and i.status <> 'draft';

  if result is null then
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

revoke execute on function public.organization_billing_invoice(uuid) from public, anon;
grant execute on function public.organization_billing_invoice(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Serveur (webhooks Stripe, clé serveur)
-- ---------------------------------------------------------------------------

-- true : l'événement est à traiter ; false : déjà traité.
create or replace function public.stripe_begin_event(p_id text, p_type text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  done timestamptz;
begin
  insert into public.stripe_events (id, type) values (p_id, p_type)
  on conflict (id) do nothing;

  select processed_at into done from public.stripe_events where id = p_id;
  return done is null;
end;
$$;

-- p_error null : traité ; sinon l'erreur est gardée et l'événement reste à
-- traiter (Stripe le renverra).
create or replace function public.stripe_finish_event(p_id text, p_error text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.stripe_events
  set processed_at = case when p_error is null then now() end,
      error = p_error
  where id = p_id;
$$;

-- Renseigne le client Stripe s'il ne l'est pas encore et renvoie celui en
-- place : deux Checkout lancés en même temps gardent le même client.
create or replace function public.stripe_set_customer(
  p_organization_id uuid,
  p_customer_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_id text;
begin
  update public.organizations
  set stripe_customer_id = coalesce(stripe_customer_id, p_customer_id)
  where id = p_organization_id
  returning stripe_customer_id into current_id;

  if current_id is null then
    raise exception 'ORGANIZATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  return current_id;
end;
$$;

create or replace function public.stripe_organization_for_customer(p_customer_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.organizations where stripe_customer_id = p_customer_id;
$$;

-- Coordonnées saisies dans Checkout ou le portail Stripe. Une valeur vide ne
-- remplace pas celle en place.
create or replace function public.stripe_sync_customer(
  p_customer_id text,
  p_billing_email text,
  p_billing_address text,
  p_vat_number text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.organizations
  set billing_email = coalesce(nullif(lower(btrim(p_billing_email)), ''), billing_email),
      billing_address = coalesce(nullif(btrim(p_billing_address), ''), billing_address),
      vat_number = coalesce(nullif(btrim(p_vat_number), ''), vat_number)
  where stripe_customer_id = p_customer_id;
$$;

-- Miroir d'un abonnement Stripe (upsert sur stripe_subscription_id). Le
-- pilote manuel en cours (trialing) est clos à l'activation ; un contrat
-- manuel actif bloque (l'API refuse Checkout dans ce cas, on ne l'écrase
-- jamais).
create or replace function public.stripe_sync_subscription(
  p_organization_id uuid,
  p_stripe_subscription_id text,
  p_stripe_price_id text,
  p_plan_code text,
  p_status text,
  p_price_eur numeric,
  p_starts_on date,
  p_ends_on date,
  p_cancel_at_period_end boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_id uuid;
  included integer;
begin
  select evaluations_included into included
  from public.billing_plans where code = p_plan_code;
  if not found then
    raise exception 'PLAN_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_status <> 'canceled' then
    update public.subscriptions
    set status = 'canceled',
        ends_on = greatest(starts_on + 1, least(ends_on, current_date)),
        notes = concat_ws(E'\n', notes, 'Clos par la souscription Stripe '
          || p_stripe_subscription_id || '.')
    where organization_id = p_organization_id
      and source = 'manual'
      and status = 'trialing';

    if exists (
      select 1 from public.subscriptions
      where organization_id = p_organization_id
        and source = 'manual'
        and status <> 'canceled'
    ) then
      raise exception 'MANUAL_CONTRACT_ACTIVE' using errcode = '23505';
    end if;
  end if;

  perform set_config('themiros.billing_writer', 'stripe', true);

  insert into public.subscriptions as s (
    organization_id, plan_code, status, price_eur, evaluations_included,
    starts_on, ends_on, auto_renew, source, stripe_subscription_id,
    stripe_price_id, cancel_at_period_end
  )
  values (
    p_organization_id, p_plan_code, p_status, p_price_eur, included,
    p_starts_on, p_ends_on, not p_cancel_at_period_end, 'stripe',
    p_stripe_subscription_id, p_stripe_price_id, p_cancel_at_period_end
  )
  on conflict (stripe_subscription_id) do update
  set plan_code = excluded.plan_code,
      status = excluded.status,
      price_eur = excluded.price_eur,
      evaluations_included = excluded.evaluations_included,
      starts_on = excluded.starts_on,
      ends_on = excluded.ends_on,
      auto_renew = excluded.auto_renew,
      stripe_price_id = excluded.stripe_price_id,
      cancel_at_period_end = excluded.cancel_at_period_end
  where s.organization_id = excluded.organization_id
  returning s.id into saved_id;

  perform set_config('themiros.billing_writer', '', true);

  if saved_id is null then
    raise exception 'STRIPE_SUBSCRIPTION_ORGANIZATION_MISMATCH' using errcode = '22023';
  end if;

  return saved_id;
end;
$$;

-- Miroir d'une facture Stripe finalisée (upsert sur stripe_invoice_id).
-- Montants en euros : amount = HT, tax = TVA, total = TTC.
create or replace function public.stripe_sync_invoice(
  p_organization_id uuid,
  p_stripe_invoice_id text,
  p_stripe_subscription_id text,
  p_number text,
  p_label text,
  p_amount_eur numeric,
  p_tax_eur numeric,
  p_total_eur numeric,
  p_status text,
  p_issued_on date,
  p_due_on date,
  p_paid_on date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_id uuid;
  sub_id uuid;
  rate numeric;
begin
  select id into sub_id from public.subscriptions
  where stripe_subscription_id = p_stripe_subscription_id
    and organization_id = p_organization_id;

  rate := case
    when p_amount_eur > 0 then round(coalesce(p_tax_eur, 0) * 100 / p_amount_eur, 2)
    else 0
  end;

  perform set_config('themiros.billing_writer', 'stripe', true);

  insert into public.invoices as i (
    organization_id, subscription_id, number, label, amount_eur, vat_rate,
    tax_eur, total_eur, status, issued_on, due_on, paid_on, source,
    stripe_invoice_id
  )
  values (
    p_organization_id, sub_id, p_number, p_label, p_amount_eur, rate,
    p_tax_eur, p_total_eur, p_status, p_issued_on,
    greatest(coalesce(p_due_on, p_issued_on), p_issued_on),
    case when p_status = 'paid' then coalesce(p_paid_on, p_issued_on) end,
    'stripe', p_stripe_invoice_id
  )
  on conflict (stripe_invoice_id) do update
  set subscription_id = coalesce(excluded.subscription_id, i.subscription_id),
      number = excluded.number,
      label = excluded.label,
      amount_eur = excluded.amount_eur,
      vat_rate = excluded.vat_rate,
      tax_eur = excluded.tax_eur,
      total_eur = excluded.total_eur,
      status = excluded.status,
      issued_on = excluded.issued_on,
      due_on = excluded.due_on,
      paid_on = excluded.paid_on
  where i.organization_id = excluded.organization_id
  returning i.id into saved_id;

  perform set_config('themiros.billing_writer', '', true);

  if saved_id is null then
    raise exception 'STRIPE_INVOICE_ORGANIZATION_MISMATCH' using errcode = '22023';
  end if;

  return saved_id;
end;
$$;

revoke execute on function public.stripe_begin_event(text, text)
  from public, anon, authenticated;
revoke execute on function public.stripe_finish_event(text, text)
  from public, anon, authenticated;
revoke execute on function public.stripe_set_customer(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.stripe_organization_for_customer(text)
  from public, anon, authenticated;
revoke execute on function public.stripe_sync_customer(text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.stripe_sync_subscription(
  uuid, text, text, text, text, numeric, date, date, boolean
) from public, anon, authenticated;
revoke execute on function public.stripe_sync_invoice(
  uuid, text, text, text, text, numeric, numeric, numeric, text, date, date, date
) from public, anon, authenticated;

grant execute on function public.stripe_begin_event(text, text) to service_role;
grant execute on function public.stripe_finish_event(text, text) to service_role;
grant execute on function public.stripe_set_customer(uuid, text) to service_role;
grant execute on function public.stripe_organization_for_customer(text) to service_role;
grant execute on function public.stripe_sync_customer(text, text, text, text) to service_role;
grant execute on function public.stripe_sync_subscription(
  uuid, text, text, text, text, numeric, date, date, boolean
) to service_role;
grant execute on function public.stripe_sync_invoice(
  uuid, text, text, text, text, numeric, numeric, numeric, text, date, date, date
) to service_role;

notify pgrst, 'reload schema';
