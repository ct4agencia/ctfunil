-- ============================================================
-- VSL Plataforma — Migration inicial
-- Rode no painel Supabase → SQL Editor → New query → Run
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Tabela: vsls (1 row por produto / página VSL)
-- ────────────────────────────────────────────────────────────
create table if not exists public.vsls (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,
  name                text not null,
  niche               text,
  status              text not null default 'draft' check (status in ('draft','published')),

  -- Hotmart (checkout)
  hotmart_product_id  text,
  hotmart_src         text,

  -- VTurb (player)
  vturb_player_id     text,
  vturb_account_id    text,

  -- Tempos do vídeo (segundos)
  pitch_reveal_at     int not null default 919,
  vagas_reveal_at     int not null default 891,

  -- Escassez
  vagas_inicial       int not null default 37,
  vagas_limite        int not null default 48,
  vagas_total         int not null default 50,

  -- Paleta
  primary_color       text not null default '#0284c7',
  cta_keep_green      boolean not null default true,

  -- Copy (todos os textos editáveis ficam aqui como JSON)
  -- chaves esperadas: cta_text, guarantee_headline, guarantee_intro,
  -- guarantee_body, guarantee_chip, vagas_suffix, copyright_name
  content             jsonb not null default '{}'::jsonb,

  -- Imagens (URLs no Storage; null = usa default do bundle)
  img_garantia        text,
  img_pagamentos      text,
  img_selo            text,

  -- Tracking / UTMify
  utmify_pixel_id     text,
  hotmart_account_id  text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_vsls_status on public.vsls (status);
create index if not exists idx_vsls_slug   on public.vsls (slug);

-- Trigger pra manter updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_vsls_updated_at on public.vsls;
create trigger trg_vsls_updated_at
  before update on public.vsls
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- Tabela: vsl_events (tracking do player, por VSL)
-- ────────────────────────────────────────────────────────────
create table if not exists public.vsl_events (
  id            bigserial primary key,
  vsl_id        uuid references public.vsls(id) on delete set null,
  session_id    text,
  event_type    text,            -- play / heartbeat / ended / cta_click
  player_time   numeric(10,2),
  duration      numeric(10,2),
  watch_percent int,
  created_at    timestamptz not null default now()
);

create index if not exists idx_vsl_events_vsl     on public.vsl_events (vsl_id);
create index if not exists idx_vsl_events_session on public.vsl_events (session_id);
create index if not exists idx_vsl_events_created on public.vsl_events (created_at desc);

-- ────────────────────────────────────────────────────────────
-- Tabela: sales (webhook Hotmart, por VSL)
-- ────────────────────────────────────────────────────────────
create table if not exists public.sales (
  id              uuid primary key default gen_random_uuid(),
  vsl_id          uuid references public.vsls(id) on delete set null,
  transaction_id  text not null,
  event_type      text not null,
  status          text not null,
  session_id      text,
  nome            text,
  email           text,
  telefone        text,
  product_id      text,
  product_name    text,
  value           numeric(12,2),
  currency        text default 'BRL',
  payment_method  text,
  src             text,
  xcod            text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  purchase_date   timestamptz,
  raw_payload     jsonb,
  created_at      timestamptz not null default now(),
  unique (transaction_id, event_type)
);

create index if not exists idx_sales_vsl     on public.sales (vsl_id);
create index if not exists idx_sales_status  on public.sales (status);
create index if not exists idx_sales_created on public.sales (created_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.vsls       enable row level security;
alter table public.vsl_events enable row level security;
alter table public.sales      enable row level security;

-- vsls: público (anon) só lê as PUBLICADAS (necessário pra rota /[slug]).
drop policy if exists "vsls anon read published" on public.vsls;
create policy "vsls anon read published" on public.vsls
  for select to anon using (status = 'published');

-- vsls: usuários autenticados (admin) leem e escrevem tudo.
drop policy if exists "vsls auth all" on public.vsls;
create policy "vsls auth all" on public.vsls
  for all to authenticated using (true) with check (true);

-- vsl_events: anon pode INSERT (tracking client-side). Autenticado lê.
drop policy if exists "vsl_events anon insert" on public.vsl_events;
create policy "vsl_events anon insert" on public.vsl_events
  for insert to anon with check (true);
drop policy if exists "vsl_events auth read" on public.vsl_events;
create policy "vsl_events auth read" on public.vsl_events
  for select to authenticated using (true);

-- sales: só autenticado lê. Escrita é via service_role (webhook), que bypassa RLS.
drop policy if exists "sales auth read" on public.sales;
create policy "sales auth read" on public.sales
  for select to authenticated using (true);
