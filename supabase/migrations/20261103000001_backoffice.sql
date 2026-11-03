-- ---------------------------------------------------------------------------
-- Backoffice Themiros (backoffice-themiros) : administration de la
-- plateforme par l'équipe Themiros, toutes organisations confondues.
--
--   - platform_admins : comptes autorisés à ouvrir le backoffice ;
--   - organization_invitations : invitations par e-mail dans une
--     organisation (et, au choix, dans certains de ses espaces) ;
--   - billing_plans, subscriptions, invoices : offres de la page Tarifs,
--     abonnement négocié de chaque organisation et factures émises.
--
-- Accès : uniquement par les fonctions backoffice_* (SECURITY DEFINER), qui
-- commencent toutes par assert_platform_admin(). Aucune policy n'élargit la
-- RLS des tables existantes : le dashboard lit les espaces d'un compte par
-- la seule RLS de workspace_members, une policy « l'admin plateforme voit
-- tout » y ferait apparaître les espaces de toutes les organisations.
--
-- Les nouvelles tables n'ont aucune policy : ni anon ni authenticated n'y
-- accèdent directement.
--
-- Premier administrateur, à la main (SQL editor, clé serveur) :
--   insert into public.platform_admins (profile_id)
--   select id from auth.users where email = 'prenom@evoranq.com';
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Administrateurs de la plateforme
-- ---------------------------------------------------------------------------
create table if not exists public.platform_admins (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins pa where pa.profile_id = auth.uid()
  );
$$;

create or replace function public.assert_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
revoke execute on function public.assert_platform_admin()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Organisations : coordonnées de facturation
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists billing_email text,
  add column if not exists billing_address text,
  add column if not exists vat_number text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Invitations
--
-- L'API envoie l'e-mail (GoTrue /invite, clé serveur) puis appelle
-- backoffice_apply_invitation, qui rattache le compte à l'organisation et
-- aux espaces choisis. Le statut se déduit du compte : « acceptée » dès la
-- première connexion, « en attente » avant, « révoquée » si revoked_at.
-- ---------------------------------------------------------------------------
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'analyste',
  workspace_ids uuid[] not null default '{}',
  workspace_role text not null default 'member',
  user_id uuid references auth.users (id) on delete set null,
  -- Le compte a été créé par l'invitation : la révoquer avant la première
  -- connexion le supprime.
  user_created boolean not null default false,
  invited_by uuid references public.profiles (id) on delete set null,
  sent_count integer not null default 0,
  last_sent_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint organization_invitations_email_check check (
    email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  constraint organization_invitations_role_check check (
    role in ('admin', 'decideur', 'pmu', 'analyste')
  ),
  constraint organization_invitations_workspace_role_check check (
    workspace_role in ('admin', 'member', 'viewer')
  )
);

create unique index if not exists organization_invitations_live_email
  on public.organization_invitations (organization_id, email)
  where revoked_at is null;
create index if not exists idx_organization_invitations_email
  on public.organization_invitations (email);

alter table public.organization_invitations enable row level security;
revoke all on public.organization_invitations from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Facturation
--
-- Les offres reprennent la page Tarifs : prix HT, facturation annuelle,
-- utilisateurs illimités, un volume d'évaluations par an (une évaluation =
-- un espace traité de bout en bout). Le montant réel se négocie : il est
-- porté par l'abonnement, l'offre ne donne que le prix catalogue.
-- ---------------------------------------------------------------------------
create table if not exists public.billing_plans (
  code text primary key,
  name text not null,
  billing_cycle text not null,
  -- Prix catalogue HT : par an pour une offre annuelle, par engagement pour
  -- un forfait. Null : sur devis.
  list_price_eur numeric(12, 2),
  evaluations_included integer,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint billing_plans_cycle_check check (billing_cycle in ('annual', 'one_off')),
  constraint billing_plans_price_check check (list_price_eur is null or list_price_eur >= 0),
  constraint billing_plans_evaluations_check check (
    evaluations_included is null or evaluations_included >= 0
  )
);

insert into public.billing_plans
  (code, name, billing_cycle, list_price_eur, evaluations_included, sort_order)
values
  ('essential', 'Essentiel', 'annual', 4080, 15, 10),
  ('professional', 'Professionnel', 'annual', 15000, 40, 20),
  ('bespoke', 'Sur mesure', 'annual', null, null, 30),
  ('pilot', 'Pilote', 'one_off', null, null, 40),
  ('campaign', 'Campagne d''appréciation', 'one_off', 5000, null, 50)
on conflict (code) do nothing;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_code text not null references public.billing_plans (code),
  status text not null default 'active',
  -- Montant HT négocié pour la période.
  price_eur numeric(12, 2) not null,
  -- Null : volume non plafonné (sur mesure).
  evaluations_included integer,
  starts_on date not null,
  ends_on date not null,
  auto_renew boolean not null default true,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_status_check check (
    status in ('trialing', 'active', 'past_due', 'canceled')
  ),
  constraint subscriptions_price_check check (price_eur >= 0),
  constraint subscriptions_evaluations_check check (
    evaluations_included is null or evaluations_included >= 0
  ),
  constraint subscriptions_period_check check (ends_on > starts_on)
);

-- Un seul abonnement en cours par organisation ; les résiliés restent en
-- historique.
create unique index if not exists subscriptions_one_live_per_organization
  on public.subscriptions (organization_id)
  where status <> 'canceled';

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  -- restrict : une facture émise est une pièce comptable, elle survit à
  -- tout ; l'organisation ne se supprime plus une fois facturée.
  organization_id uuid not null references public.organizations (id) on delete restrict,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  -- TH-AAAA-NNNN, attribué à l'émission.
  number text unique,
  label text not null,
  amount_eur numeric(12, 2) not null,
  vat_rate numeric(5, 2) not null default 20,
  status text not null default 'draft',
  issued_on date,
  due_on date,
  paid_on date,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_status_check check (status in ('draft', 'issued', 'paid', 'void')),
  constraint invoices_amount_check check (amount_eur >= 0),
  constraint invoices_vat_rate_check check (vat_rate between 0 and 100),
  constraint invoices_issued_check check (
    status = 'draft'
    or (number is not null and issued_on is not null and due_on is not null)
  ),
  constraint invoices_paid_check check (status <> 'paid' or paid_on is not null)
);

create index if not exists idx_invoices_organization
  on public.invoices (organization_id, created_at desc);
create index if not exists idx_subscriptions_organization
  on public.subscriptions (organization_id, starts_on desc);

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

alter table public.billing_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
revoke all on public.billing_plans from anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;
revoke all on public.invoices from anon, authenticated;

comment on table public.platform_admins is
  'Comptes de l''équipe Themiros autorisés à ouvrir le backoffice.';
comment on table public.organization_invitations is
  'Invitations par e-mail dans une organisation, envoyées depuis le backoffice.';
comment on table public.billing_plans is
  'Offres de la page Tarifs (prix catalogue HT).';
comment on table public.subscriptions is
  'Abonnement négocié d''une organisation ; un seul non résilié à la fois.';
comment on table public.invoices is
  'Factures émises aux organisations. Une facture émise ne se modifie plus.';

-- ---------------------------------------------------------------------------
-- Lectures communes
-- ---------------------------------------------------------------------------

-- Abonnement en cours d'une organisation, avec sa consommation : espaces
-- créés et coût IA sur la période.
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
    'evaluations_used', (
      select count(*) from public.workspaces w
      where w.organization_id = s.organization_id
        and w.created_at >= s.starts_on
        and w.created_at < s.ends_on + 1
    ),
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
    'total_eur', round(i.amount_eur * (1 + i.vat_rate / 100), 2),
    'status', i.status,
    'overdue', i.status = 'issued' and i.due_on < current_date,
    'issued_on', i.issued_on,
    'due_on', i.due_on,
    'paid_on', i.paid_on,
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

-- ---------------------------------------------------------------------------
-- Organisations
-- ---------------------------------------------------------------------------
create or replace function public.backoffice_list_organizations()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'type', o.type,
      'country', o.country,
      'created_at', o.created_at,
      'member_count', (
        select count(*) from public.profiles p where p.organization_id = o.id
      ),
      'workspace_count', (
        select count(*) from public.workspaces w where w.organization_id = o.id
      ),
      'pending_invitation_count', (
        select count(*)
        from public.organization_invitations i
        left join auth.users u on u.id = i.user_id
        where i.organization_id = o.id
          and i.revoked_at is null
          and u.last_sign_in_at is null
      ),
      'subscription', (
        select public.backoffice_subscription_json(s)
        from public.subscriptions s
        where s.organization_id = o.id and s.status <> 'canceled'
      )
    ) order by o.name)
    from public.organizations o
  ), '[]'::jsonb);
end;
$$;

create or replace function public.backoffice_get_organization(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.assert_platform_admin();

  select jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'type', o.type,
    'country', o.country,
    'billing_email', o.billing_email,
    'billing_address', o.billing_address,
    'vat_number', o.vat_number,
    'notes', o.notes,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'ai_cost_eur', (
      select coalesce(sum(u.cost_eur), 0)
      from public.ai_usage u
      join public.workspaces w on w.id = u.workspace_id
      where w.organization_id = o.id
    ),
    'ai_cost_30d_eur', (
      select coalesce(sum(u.cost_eur), 0)
      from public.ai_usage u
      join public.workspaces w on w.id = u.workspace_id
      where w.organization_id = o.id
        and u.created_at >= now() - interval '30 days'
    ),
    'subscription', (
      select public.backoffice_subscription_json(s)
      from public.subscriptions s
      where s.organization_id = o.id and s.status <> 'canceled'
    ),
    'has_invoices', exists (
      select 1 from public.invoices i where i.organization_id = o.id
    )
  )
  into result
  from public.organizations o
  where o.id = p_organization_id;

  if result is null then
    raise exception 'ORGANIZATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

-- Crée l'organisation quand p_organization_id est null, la met à jour sinon.
create or replace function public.backoffice_save_organization(
  p_organization_id uuid,
  p_name text,
  p_type text,
  p_country text,
  p_billing_email text,
  p_billing_address text,
  p_vat_number text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_id uuid;
begin
  perform public.assert_platform_admin();

  if nullif(btrim(p_name), '') is null then
    raise exception 'ORGANIZATION_NAME_REQUIRED' using errcode = '22023';
  end if;

  if p_organization_id is null then
    insert into public.organizations (
      name, type, country, billing_email, billing_address, vat_number, notes
    )
    values (
      btrim(p_name), nullif(p_type, ''), nullif(btrim(p_country), ''),
      nullif(lower(btrim(p_billing_email)), ''), nullif(btrim(p_billing_address), ''),
      nullif(btrim(p_vat_number), ''), nullif(btrim(p_notes), '')
    )
    returning id into saved_id;
  else
    update public.organizations
    set name = btrim(p_name),
        type = nullif(p_type, ''),
        country = nullif(btrim(p_country), ''),
        billing_email = nullif(lower(btrim(p_billing_email)), ''),
        billing_address = nullif(btrim(p_billing_address), ''),
        vat_number = nullif(btrim(p_vat_number), ''),
        notes = nullif(btrim(p_notes), '')
    where id = p_organization_id
    returning id into saved_id;

    if saved_id is null then
      raise exception 'ORGANIZATION_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;

  return saved_id;
end;
$$;

-- Supprime l'organisation et, en cascade, ses espaces et tout leur contenu.
-- Refusé dès qu'une facture existe.
create or replace function public.backoffice_delete_organization(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  if exists (select 1 from public.invoices where organization_id = p_organization_id) then
    raise exception 'ORGANIZATION_HAS_INVOICES' using errcode = '23503';
  end if;

  update public.profiles
  set current_workspace_id = null
  where current_workspace_id in (
    select id from public.workspaces where organization_id = p_organization_id
  );

  delete from public.organizations where id = p_organization_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profils
-- ---------------------------------------------------------------------------
create or replace function public.backoffice_list_profiles(
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'email', u.email,
      'full_name', p.full_name,
      'role', p.role,
      'lang', p.lang,
      'organization_id', p.organization_id,
      'organization_name', o.name,
      'is_platform_admin', exists (
        select 1 from public.platform_admins pa where pa.profile_id = p.id
      ),
      'workspace_count', (
        select count(*) from public.workspace_members wm where wm.profile_id = p.id
      ),
      'email_confirmed_at', u.email_confirmed_at,
      'last_sign_in_at', u.last_sign_in_at,
      'created_at', p.created_at
    ) order by coalesce(nullif(p.full_name, ''), u.email))
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.organizations o on o.id = p.organization_id
    where p_organization_id is null or p.organization_id = p_organization_id
  ), '[]'::jsonb);
end;
$$;

-- Changer d'organisation retire le compte des espaces de l'ancienne.
create or replace function public.backoffice_update_profile(
  p_profile_id uuid,
  p_full_name text,
  p_role text,
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_organization_id uuid;
begin
  perform public.assert_platform_admin();

  select organization_id into previous_organization_id
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if previous_organization_id is distinct from p_organization_id then
    delete from public.workspace_members wm
    using public.workspaces w
    where wm.workspace_id = w.id
      and wm.profile_id = p_profile_id
      and w.organization_id is distinct from p_organization_id;
  end if;

  update public.profiles
  set full_name = nullif(btrim(p_full_name), ''),
      role = nullif(p_role, ''),
      organization_id = p_organization_id,
      current_workspace_id = case
        when previous_organization_id is distinct from p_organization_id then null
        else current_workspace_id
      end
  where id = p_profile_id;
end;
$$;

create or replace function public.backoffice_set_platform_admin(
  p_profile_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  if p_enabled then
    insert into public.platform_admins (profile_id, created_by)
    values (p_profile_id, auth.uid())
    on conflict (profile_id) do nothing;
  else
    -- Garde-fou : le backoffice ne peut pas se retrouver sans personne pour
    -- l'ouvrir.
    if p_profile_id = auth.uid() then
      raise exception 'CANNOT_REVOKE_SELF' using errcode = '42501';
    end if;
    delete from public.platform_admins where profile_id = p_profile_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Espaces (projets, programmes, politiques)
-- ---------------------------------------------------------------------------
create or replace function public.backoffice_list_workspaces(
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', w.id,
      'name', w.name,
      'kind', w.kind,
      'organization_id', w.organization_id,
      'organization_name', o.name,
      'target_country', w.target_country,
      'declared_stage', w.declared_stage,
      'start_year', w.start_year,
      'end_year', w.end_year,
      'framework_status', w.pillar_framework_status,
      'created_at', w.created_at,
      'member_count', (
        select count(*) from public.workspace_members wm where wm.workspace_id = w.id
      ),
      'document_count', (
        select count(*) from public.documents d
        where d.workspace_id = w.id and d.deleted_at is null
      ),
      'run_count', (
        select count(*) from public.runs r where r.workspace_id = w.id
      ),
      'last_run_at', (
        select max(r.created_at) from public.runs r where r.workspace_id = w.id
      ),
      'ai_cost_eur', (
        select coalesce(sum(u.cost_eur), 0) from public.ai_usage u
        where u.workspace_id = w.id
      )
    ) order by w.created_at desc)
    from public.workspaces w
    join public.organizations o on o.id = w.organization_id
    where p_organization_id is null or w.organization_id = p_organization_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.backoffice_get_workspace(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.assert_platform_admin();

  select jsonb_build_object(
    'id', w.id,
    'name', w.name,
    'kind', w.kind,
    'organization_id', w.organization_id,
    'organization_name', o.name,
    'target_country', w.target_country,
    'declared_stage', w.declared_stage,
    'start_year', w.start_year,
    'end_year', w.end_year,
    'framework_status', w.pillar_framework_status,
    'created_at', w.created_at,
    'created_by_name', creator.full_name,
    'document_count', (
      select count(*) from public.documents d
      where d.workspace_id = w.id and d.deleted_at is null
    ),
    'run_count', (select count(*) from public.runs r where r.workspace_id = w.id),
    'last_run_at', (select max(r.created_at) from public.runs r where r.workspace_id = w.id),
    'ai_cost_eur', (
      select coalesce(sum(u.cost_eur), 0) from public.ai_usage u
      where u.workspace_id = w.id
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'profile_id', p.id,
        'full_name', p.full_name,
        'email', u.email,
        'role', wm.role,
        'added_at', wm.created_at
      ) order by coalesce(nullif(p.full_name, ''), u.email))
      from public.workspace_members wm
      join public.profiles p on p.id = wm.profile_id
      join auth.users u on u.id = p.id
      where wm.workspace_id = w.id
    ), '[]'::jsonb)
  )
  into result
  from public.workspaces w
  join public.organizations o on o.id = w.organization_id
  left join public.profiles creator on creator.id = w.created_by
  where w.id = p_workspace_id;

  if result is null then
    raise exception 'WORKSPACE_NOT_FOUND' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

-- L'espace est créé vide : le responsable le complète (financeurs,
-- thématiques, démarche) depuis le dashboard.
create or replace function public.backoffice_create_workspace(
  p_organization_id uuid,
  p_name text,
  p_kind text,
  p_target_country text,
  p_declared_stage text,
  p_start_year integer,
  p_end_year integer,
  p_owner_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id uuid;
begin
  perform public.assert_platform_admin();

  if nullif(btrim(p_name), '') is null then
    raise exception 'WORKSPACE_NAME_REQUIRED' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_owner_profile_id and organization_id = p_organization_id
  ) then
    raise exception 'OWNER_NOT_IN_ORGANIZATION' using errcode = '22023';
  end if;

  insert into public.workspaces (
    organization_id, name, kind, created_by, target_country,
    declared_stage, start_year, end_year
  )
  values (
    p_organization_id, btrim(p_name), p_kind, p_owner_profile_id,
    nullif(btrim(p_target_country), ''), nullif(p_declared_stage, ''),
    p_start_year, p_end_year
  )
  returning id into created_id;

  insert into public.workspace_members (workspace_id, profile_id, role)
  values (created_id, p_owner_profile_id, 'admin');

  return created_id;
end;
$$;

-- La nature (kind) ne change pas : elle détermine le module de la démarche
-- et du cadre déjà générés.
create or replace function public.backoffice_update_workspace(
  p_workspace_id uuid,
  p_name text,
  p_target_country text,
  p_declared_stage text,
  p_start_year integer,
  p_end_year integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  if nullif(btrim(p_name), '') is null then
    raise exception 'WORKSPACE_NAME_REQUIRED' using errcode = '22023';
  end if;

  update public.workspaces
  set name = btrim(p_name),
      target_country = nullif(btrim(p_target_country), ''),
      declared_stage = nullif(p_declared_stage, ''),
      start_year = p_start_year,
      end_year = p_end_year
  where id = p_workspace_id;

  if not found then
    raise exception 'WORKSPACE_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.backoffice_delete_workspace(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  update public.profiles
  set current_workspace_id = null
  where current_workspace_id = p_workspace_id;

  delete from public.workspaces where id = p_workspace_id;
end;
$$;

create or replace function public.backoffice_set_workspace_member(
  p_workspace_id uuid,
  p_profile_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  if not exists (
    select 1
    from public.workspaces w
    join public.profiles p on p.organization_id = w.organization_id
    where w.id = p_workspace_id and p.id = p_profile_id
  ) then
    raise exception 'MEMBER_NOT_IN_ORGANIZATION' using errcode = '22023';
  end if;

  if p_role <> 'admin' and public.backoffice_is_last_workspace_admin(p_workspace_id, p_profile_id) then
    raise exception 'LAST_WORKSPACE_ADMIN' using errcode = '22023';
  end if;

  insert into public.workspace_members (workspace_id, profile_id, role)
  values (p_workspace_id, p_profile_id, p_role)
  on conflict (workspace_id, profile_id) do update set role = excluded.role;
end;
$$;

create or replace function public.backoffice_is_last_workspace_admin(
  p_workspace_id uuid,
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and profile_id = p_profile_id and role = 'admin'
  ) and not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and profile_id <> p_profile_id and role = 'admin'
  );
$$;

create or replace function public.backoffice_remove_workspace_member(
  p_workspace_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  if public.backoffice_is_last_workspace_admin(p_workspace_id, p_profile_id) then
    raise exception 'LAST_WORKSPACE_ADMIN' using errcode = '22023';
  end if;

  delete from public.workspace_members
  where workspace_id = p_workspace_id and profile_id = p_profile_id;

  update public.profiles
  set current_workspace_id = null
  where id = p_profile_id and current_workspace_id = p_workspace_id;
end;
$$;

revoke execute on function public.backoffice_is_last_workspace_admin(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------
create or replace function public.backoffice_list_invitations(
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id,
      'organization_id', i.organization_id,
      'organization_name', o.name,
      'email', i.email,
      'full_name', i.full_name,
      'role', i.role,
      'workspace_role', i.workspace_role,
      'workspaces', coalesce((
        select jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name) order by w.name)
        from public.workspaces w
        where w.id = any (i.workspace_ids)
      ), '[]'::jsonb),
      'status', case
        when i.revoked_at is not null then 'revoked'
        when u.last_sign_in_at is not null then 'accepted'
        else 'pending'
      end,
      'invited_by_name', inviter.full_name,
      'sent_count', i.sent_count,
      'last_sent_at', i.last_sent_at,
      'accepted_at', u.last_sign_in_at,
      'revoked_at', i.revoked_at,
      'created_at', i.created_at
    ) order by i.created_at desc)
    from public.organization_invitations i
    join public.organizations o on o.id = i.organization_id
    left join auth.users u on u.id = i.user_id
    left join public.profiles inviter on inviter.id = i.invited_by
    where p_organization_id is null or i.organization_id = p_organization_id
  ), '[]'::jsonb);
end;
$$;

-- Enregistre l'invitation avant l'envoi de l'e-mail par l'API. Renvoie
-- l'état du compte existant pour que l'API sache s'il faut envoyer un lien
-- (compte absent ou jamais confirmé) ou rattacher directement le compte.
create or replace function public.backoffice_create_invitation(
  p_organization_id uuid,
  p_email text,
  p_full_name text,
  p_role text,
  p_workspace_ids uuid[],
  p_workspace_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(btrim(p_email));
  existing_user auth.users%rowtype;
  existing_organization_id uuid;
  created_id uuid;
begin
  perform public.assert_platform_admin();

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'ORGANIZATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_workspace_ids, '{}')) as requested(id)
    where not exists (
      select 1 from public.workspaces w
      where w.id = requested.id and w.organization_id = p_organization_id
    )
  ) then
    raise exception 'WORKSPACE_NOT_IN_ORGANIZATION' using errcode = '22023';
  end if;

  select * into existing_user from auth.users where lower(email) = normalized_email;

  if found then
    select organization_id into existing_organization_id
    from public.profiles where id = existing_user.id;

    if existing_organization_id is not null
       and existing_organization_id <> p_organization_id then
      raise exception 'USER_IN_OTHER_ORGANIZATION' using errcode = '23505';
    end if;
  end if;

  if exists (
    select 1 from public.organization_invitations
    where organization_id = p_organization_id
      and email = normalized_email
      and revoked_at is null
  ) then
    raise exception 'INVITATION_ALREADY_EXISTS' using errcode = '23505';
  end if;

  insert into public.organization_invitations (
    organization_id, email, full_name, role, workspace_ids, workspace_role, invited_by
  )
  values (
    p_organization_id, normalized_email, nullif(btrim(p_full_name), ''),
    p_role, coalesce(p_workspace_ids, '{}'), p_workspace_role, auth.uid()
  )
  returning id into created_id;

  return jsonb_build_object(
    'id', created_id,
    'email', normalized_email,
    'full_name', nullif(btrim(p_full_name), ''),
    'existing_user', existing_user.id is not null,
    'confirmed', existing_user.email_confirmed_at is not null
  );
end;
$$;

-- Lecture d'une invitation par l'API avant un renvoi.
create or replace function public.backoffice_get_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.assert_platform_admin();

  select jsonb_build_object(
    'id', i.id,
    'email', i.email,
    'full_name', i.full_name,
    'user_id', i.user_id,
    'user_created', i.user_created,
    'status', case
      when i.revoked_at is not null then 'revoked'
      when u.last_sign_in_at is not null then 'accepted'
      else 'pending'
    end,
    'confirmed', u.email_confirmed_at is not null
  )
  into result
  from public.organization_invitations i
  left join auth.users u on u.id = i.user_id
  where i.id = p_invitation_id;

  if result is null then
    raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

-- Clé serveur uniquement, après l'envoi par GoTrue (qui crée le compte et,
-- par handle_new_user, son profil) : rattache le compte à l'organisation,
-- lui donne son rôle et ses espaces. Idempotente : sert aussi au renvoi.
create or replace function public.backoffice_apply_invitation(
  p_invitation_id uuid,
  p_email_sent boolean,
  p_user_created boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.organization_invitations%rowtype;
  invited_user_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  select * into invitation
  from public.organization_invitations
  where id = p_invitation_id
  for update;

  if not found or invitation.revoked_at is not null then
    raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  select id into invited_user_id from auth.users where lower(email) = invitation.email;

  if invited_user_id is null then
    raise exception 'INVITED_USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.profiles (id, full_name)
  values (invited_user_id, invitation.full_name)
  on conflict (id) do nothing;

  update public.profiles
  set organization_id = invitation.organization_id,
      role = invitation.role,
      full_name = coalesce(nullif(btrim(full_name), ''), invitation.full_name)
  where id = invited_user_id
    and (organization_id is null or organization_id = invitation.organization_id);

  if not found then
    raise exception 'USER_IN_OTHER_ORGANIZATION' using errcode = '23505';
  end if;

  insert into public.workspace_members (workspace_id, profile_id, role)
  select w.id, invited_user_id, invitation.workspace_role
  from public.workspaces w
  where w.id = any (invitation.workspace_ids)
    and w.organization_id = invitation.organization_id
  on conflict (workspace_id, profile_id) do nothing;

  update public.organization_invitations
  set user_id = invited_user_id,
      user_created = user_created or p_user_created,
      sent_count = sent_count + case when p_email_sent then 1 else 0 end,
      last_sent_at = case when p_email_sent then now() else last_sent_at end
  where id = p_invitation_id;

  return invited_user_id;
end;
$$;

-- Clé serveur uniquement : l'e-mail n'a pas pu partir, l'invitation n'a
-- jamais existé pour le destinataire.
create or replace function public.backoffice_discard_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  delete from public.organization_invitations
  where id = p_invitation_id and user_id is null;
end;
$$;

-- Révoque une invitation en attente : retire le compte des espaces et de
-- l'organisation. Renvoie le compte à supprimer côté GoTrue quand
-- l'invitation l'a créé (il ne s'est jamais connecté).
create or replace function public.backoffice_revoke_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.organization_invitations%rowtype;
  signed_in boolean;
begin
  perform public.assert_platform_admin();

  select * into invitation
  from public.organization_invitations
  where id = p_invitation_id
  for update;

  if not found or invitation.revoked_at is not null then
    raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  select u.last_sign_in_at is not null into signed_in
  from auth.users u where u.id = invitation.user_id;

  if coalesce(signed_in, false) then
    raise exception 'INVITATION_ALREADY_ACCEPTED' using errcode = '22023';
  end if;

  if invitation.user_id is not null then
    delete from public.workspace_members
    where profile_id = invitation.user_id
      and workspace_id = any (invitation.workspace_ids);

    update public.profiles
    set organization_id = null, role = null, current_workspace_id = null
    where id = invitation.user_id
      and organization_id = invitation.organization_id;
  end if;

  update public.organization_invitations
  set revoked_at = now()
  where id = p_invitation_id;

  return jsonb_build_object(
    'user_id', invitation.user_id,
    'delete_user', invitation.user_created and invitation.user_id is not null
  );
end;
$$;

revoke execute on function public.backoffice_apply_invitation(uuid, boolean, boolean)
  from public, anon, authenticated;
revoke execute on function public.backoffice_discard_invitation(uuid)
  from public, anon, authenticated;
grant execute on function public.backoffice_apply_invitation(uuid, boolean, boolean)
  to service_role;
grant execute on function public.backoffice_discard_invitation(uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Facturation
-- ---------------------------------------------------------------------------
create or replace function public.backoffice_list_plans()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  return coalesce((
    select jsonb_agg(to_jsonb(p) order by p.sort_order)
    from public.billing_plans p
  ), '[]'::jsonb);
end;
$$;

-- Indicateurs de la page Facturation. ARR : abonnements annuels en cours
-- (hors résiliés), ramenés à l'année ; les forfaits n'y entrent pas.
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
      select coalesce(sum(round(amount_eur * (1 + vat_rate / 100), 2)), 0)
      from public.invoices where status = 'issued'
    ),
    'overdue_eur', (
      select coalesce(sum(round(amount_eur * (1 + vat_rate / 100), 2)), 0)
      from public.invoices where status = 'issued' and due_on < current_date
    ),
    'paid_ytd_eur', (
      select coalesce(sum(round(amount_eur * (1 + vat_rate / 100), 2)), 0)
      from public.invoices
      where status = 'paid'
        and paid_on >= date_trunc('year', current_date)::date
    ),
    'ai_cost_30d_eur', (
      select coalesce(sum(cost_eur), 0) from public.ai_usage
      where created_at >= now() - interval '30 days'
    )
  );
end;
$$;

create or replace function public.backoffice_list_subscriptions(
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  return coalesce((
    select jsonb_agg(
      public.backoffice_subscription_json(s)
      order by (s.status = 'canceled'), s.ends_on
    )
    from public.subscriptions s
    where p_organization_id is null or s.organization_id = p_organization_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.backoffice_save_subscription(
  p_subscription_id uuid,
  p_organization_id uuid,
  p_plan_code text,
  p_status text,
  p_price_eur numeric,
  p_evaluations_included integer,
  p_starts_on date,
  p_ends_on date,
  p_auto_renew boolean,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_id uuid;
begin
  perform public.assert_platform_admin();

  if p_subscription_id is null then
    if exists (
      select 1 from public.subscriptions
      where organization_id = p_organization_id and status <> 'canceled'
    ) and p_status <> 'canceled' then
      raise exception 'SUBSCRIPTION_ALREADY_LIVE' using errcode = '23505';
    end if;

    insert into public.subscriptions (
      organization_id, plan_code, status, price_eur, evaluations_included,
      starts_on, ends_on, auto_renew, notes, created_by
    )
    values (
      p_organization_id, p_plan_code, p_status, p_price_eur, p_evaluations_included,
      p_starts_on, p_ends_on, p_auto_renew, nullif(btrim(p_notes), ''), auth.uid()
    )
    returning id into saved_id;
  else
    update public.subscriptions
    set plan_code = p_plan_code,
        status = p_status,
        price_eur = p_price_eur,
        evaluations_included = p_evaluations_included,
        starts_on = p_starts_on,
        ends_on = p_ends_on,
        auto_renew = p_auto_renew,
        notes = nullif(btrim(p_notes), '')
    where id = p_subscription_id
    returning id into saved_id;

    if saved_id is null then
      raise exception 'SUBSCRIPTION_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;

  return saved_id;
end;
$$;

create or replace function public.backoffice_list_invoices(
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  return coalesce((
    select jsonb_agg(
      public.backoffice_invoice_json(i)
      order by coalesce(i.issued_on, i.created_at::date) desc, i.created_at desc
    )
    from public.invoices i
    where p_organization_id is null or i.organization_id = p_organization_id
  ), '[]'::jsonb);
end;
$$;

-- Brouillon : création ou modification. Une facture émise ne se modifie
-- plus ; on l'annule et on en émet une autre.
create or replace function public.backoffice_save_invoice(
  p_invoice_id uuid,
  p_organization_id uuid,
  p_subscription_id uuid,
  p_label text,
  p_amount_eur numeric,
  p_vat_rate numeric,
  p_due_on date,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_id uuid;
begin
  perform public.assert_platform_admin();

  if nullif(btrim(p_label), '') is null then
    raise exception 'INVOICE_LABEL_REQUIRED' using errcode = '22023';
  end if;

  if p_subscription_id is not null and not exists (
    select 1 from public.subscriptions
    where id = p_subscription_id and organization_id = p_organization_id
  ) then
    raise exception 'SUBSCRIPTION_NOT_IN_ORGANIZATION' using errcode = '22023';
  end if;

  if p_invoice_id is null then
    insert into public.invoices (
      organization_id, subscription_id, label, amount_eur, vat_rate, due_on,
      notes, created_by
    )
    values (
      p_organization_id, p_subscription_id, btrim(p_label), p_amount_eur,
      p_vat_rate, p_due_on, nullif(btrim(p_notes), ''), auth.uid()
    )
    returning id into saved_id;
  else
    update public.invoices
    set subscription_id = p_subscription_id,
        label = btrim(p_label),
        amount_eur = p_amount_eur,
        vat_rate = p_vat_rate,
        due_on = p_due_on,
        notes = nullif(btrim(p_notes), '')
    where id = p_invoice_id
      and organization_id = p_organization_id
      and status = 'draft'
    returning id into saved_id;

    if saved_id is null then
      raise exception 'INVOICE_NOT_DRAFT' using errcode = '22023';
    end if;
  end if;

  return saved_id;
end;
$$;

-- Numérotation continue par année civile : TH-2026-0001, TH-2026-0002…
create or replace function public.backoffice_issue_invoice(
  p_invoice_id uuid,
  p_issued_on date,
  p_due_on date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  prefix text := 'TH-' || to_char(p_issued_on, 'YYYY') || '-';
  next_number text;
begin
  perform public.assert_platform_admin();

  if p_due_on < p_issued_on then
    raise exception 'INVOICE_DUE_BEFORE_ISSUE' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.invoices.number'));

  select prefix || lpad((coalesce(max(substring(number from '\d+$')::integer), 0) + 1)::text, 4, '0')
  into next_number
  from public.invoices
  where number like prefix || '%';

  update public.invoices
  set status = 'issued',
      number = next_number,
      issued_on = p_issued_on,
      due_on = p_due_on
  where id = p_invoice_id and status = 'draft';

  if not found then
    raise exception 'INVOICE_NOT_DRAFT' using errcode = '22023';
  end if;

  return next_number;
end;
$$;

create or replace function public.backoffice_set_invoice_status(
  p_invoice_id uuid,
  p_status text,
  p_paid_on date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  if p_status = 'paid' then
    update public.invoices
    set status = 'paid', paid_on = coalesce(p_paid_on, current_date)
    where id = p_invoice_id and status = 'issued';
  elsif p_status = 'void' then
    update public.invoices
    set status = 'void'
    where id = p_invoice_id and status = 'issued';
  elsif p_status = 'issued' then
    -- Annule un encaissement saisi par erreur.
    update public.invoices
    set status = 'issued', paid_on = null
    where id = p_invoice_id and status = 'paid';
  else
    raise exception 'INVOICE_STATUS_INVALID' using errcode = '22023';
  end if;

  if not found then
    raise exception 'INVOICE_STATUS_TRANSITION_INVALID' using errcode = '22023';
  end if;
end;
$$;

-- Seul un brouillon se supprime.
create or replace function public.backoffice_delete_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  delete from public.invoices where id = p_invoice_id and status = 'draft';

  if not found then
    raise exception 'INVOICE_NOT_DRAFT' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits : les fonctions appelées par le backoffice vérifient elles-mêmes
-- assert_platform_admin() ; anon n'y a jamais accès.
-- ---------------------------------------------------------------------------
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'backoffice\_%'
      and p.proname not in (
        'backoffice_subscription_json', 'backoffice_invoice_json',
        'backoffice_is_last_workspace_admin', 'backoffice_apply_invitation',
        'backoffice_discard_invitation'
      )
  loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end
$$;
