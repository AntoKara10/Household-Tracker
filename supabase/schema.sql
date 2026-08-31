-- FlowTrack schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Assumes Supabase auth.users already exists.

-- ============================================================
-- HOUSEHOLDS
-- ============================================================
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_at timestamptz not null default now()
);

-- One row per auth user. household_id is nullable (not everyone joins one).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  household_id uuid references households(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- MASTER DATA: categories (per-user; Operational/Nonoperational mapping
-- lives here, NOT recomputed on transactions retroactively)
-- ============================================================
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subcategory text not null check (subcategory in ('Operational', 'Nonoperational')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ============================================================
-- MASTER DATA: budgets. effective_date makes this a time series per
-- category: "what was the budget for Food as of this month" is resolved
-- by picking the latest row with effective_date <= period start.
-- ============================================================
create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  effective_date date not null,
  created_at timestamptz not null default now()
);
create index budgets_category_effective_idx on budgets (category_id, effective_date desc);

-- ============================================================
-- MASTER DATA: user-added currencies (EUR/USD/GBP/JPY exist as constants
-- in the app; this table only holds user-added extras)
-- ============================================================
create table custom_currencies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

-- ============================================================
-- TRANSACTIONS
-- Amount is always stored unsigned. Sign for calculations is derived
-- from `direction` at query time - never stored redundantly.
--
-- subcategory is a SNAPSHOT (copy of categories.subcategory at entry
-- time), by design: changing a category's mapping later must NOT alter
-- historical reporting. household_id is likewise a snapshot of the
-- user's household at entry time, for the same reason.
-- ============================================================
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  entry_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  direction text not null check (direction in ('inflow', 'outflow')),

  currency_code text not null default 'EUR',
  fx_rate_to_eur numeric(14,6) not null default 1,        -- spot rate at entry time
  amount_eur numeric(12,2) not null,                        -- amount * fx_rate_to_eur, computed app-side

  type text not null check (type in ('Cash', 'Card', 'Wire', 'Other')),
  type_other_description text,                              -- only used when type = 'Other'

  category_id uuid references categories(id) on delete set null,
  subcategory_snapshot text not null check (subcategory_snapshot in ('Operational', 'Nonoperational')),
  note text,

  visibility text not null default 'private' check (visibility in ('private', 'household')),
  household_id uuid references households(id) on delete set null, -- snapshot, see above

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_user_date_idx on transactions (user_id, entry_date desc);
create index transactions_household_idx on transactions (household_id) where visibility = 'household';

-- keep updated_at current
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger transactions_set_updated_at
before update on transactions
for each row execute function set_updated_at();

-- ============================================================
-- SEED DEFAULT CATEGORIES on profile creation
-- ============================================================
create or replace function seed_default_categories(p_user_id uuid) returns void as $$
begin
  insert into categories (user_id, name, subcategory, is_default) values
    (p_user_id, 'Salary',                  'Operational',    true),
    (p_user_id, 'Other Income',             'Nonoperational', true),
    (p_user_id, 'Groceries',                'Operational',    true),
    (p_user_id, 'Food',                     'Operational',    true),
    (p_user_id, 'Car',                      'Operational',    true),
    (p_user_id, 'Shopping',                 'Operational',    true),
    (p_user_id, 'Health',                   'Operational',    true),
    (p_user_id, 'Mandatory Subscriptions',  'Operational',    true),
    (p_user_id, 'Leisure Subscriptions',    'Nonoperational', true),
    (p_user_id, 'Investing',                'Nonoperational', true),
    (p_user_id, 'Banking',                  'Nonoperational', true),
    (p_user_id, 'Entertainment',            'Nonoperational', true),
    (p_user_id, 'Travel',                   'Nonoperational', true)
  on conflict (user_id, name) do nothing;
end;
$$ language plpgsql;

-- Auto-create a profile + seed categories whenever a new auth user signs up
create or replace function handle_new_user() returns trigger as $$
begin
  insert into profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  perform seed_default_categories(new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table households enable row level security;
alter table profiles enable row level security;
alter table categories enable row level security;
alter table budgets enable row level security;
alter table custom_currencies enable row level security;
alter table transactions enable row level security;

-- households: visible to members only
create policy household_select on households for select
  using (id in (select household_id from profiles where id = auth.uid()));

-- profiles: you can see your own profile, and profiles of people in your household
create policy profiles_select on profiles for select
  using (id = auth.uid() or household_id = (select household_id from profiles where id = auth.uid()));
create policy profiles_update_own on profiles for update
  using (id = auth.uid());

-- master data (categories, budgets, custom_currencies): strictly per-user,
-- never shared -- household view aggregates by matching category name
-- client-side, it does not share rows.
create policy categories_owner on categories for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy budgets_owner on budgets for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy currencies_owner on custom_currencies for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- transactions: you always see your own; you also see others' rows if
-- they're flagged 'household' AND share your household_id
create policy transactions_select on transactions for select
  using (
    user_id = auth.uid()
    or (
      visibility = 'household'
      and household_id is not null
      and household_id = (select household_id from profiles where id = auth.uid())
    )
  );
create policy transactions_insert on transactions for insert
  with check (user_id = auth.uid());
create policy transactions_update on transactions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy transactions_delete on transactions for delete
  using (user_id = auth.uid());

-- ============================================================
-- Joining a household by invite code (called from the client)
-- ============================================================
create or replace function join_household(p_invite_code text) returns uuid as $$
declare
  v_household_id uuid;
begin
  select id into v_household_id from households where invite_code = p_invite_code;
  if v_household_id is null then
    raise exception 'Invalid invite code';
  end if;
  update profiles set household_id = v_household_id where id = auth.uid();
  return v_household_id;
end;
$$ language plpgsql security definer;
