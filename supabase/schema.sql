-- Create tables used by the Ultron API when running on Supabase
-- Run this in Supabase SQL Editor.

-- MENU ITEMS
create table if not exists public.menu_items (
  id text primary key,
  name text not null,
  category text not null,
  description text not null default '',
  price double precision not null check (price >= 0),
  image text not null default '',
  image_path text not null default '',
  stock boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If you already created the table, run:
-- alter table public.menu_items add column if not exists image_path text not null default '';

create index if not exists menu_items_category_idx on public.menu_items (category);
create index if not exists menu_items_created_at_idx on public.menu_items (created_at);

-- TABLES
create table if not exists public.tables (
  id text primary key,
  number text not null,
  number_key text not null unique,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tables_number_idx on public.tables (number);

-- ORDERS
create table if not exists public.orders (
  id text primary key,
  user_id text not null,
  table_id text not null,
  status text not null,
  total double precision not null check (total >= 0),
  payment_status text not null,
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at);
create index if not exists orders_status_idx on public.orders (status);

-- ORDER ITEMS
create table if not exists public.order_items (
  id text primary key,
  order_id text not null references public.orders(id) on delete cascade,
  menu_id text not null,
  quantity integer not null check (quantity >= 1),
  price double precision not null check (price >= 0)
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- SETTINGS
create table if not exists public.app_settings (
  id text primary key,
  canteen_name text not null,
  contact_number text not null,
  address text not null,
  opening_time text not null,
  closing_time text not null,
  two_factor_enabled boolean not null default false,
  stripe_secret_key text not null default '',
  stripe_public_key text not null default '',
  cod_enabled boolean not null default true,
  tax_name text not null,
  tax_percentage double precision not null default 0,
  tax_included boolean not null default false,
  admin_email text not null,
  admin_password text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Storage bucket:
-- Create a PUBLIC bucket named "menu-images" in Supabase Storage.
