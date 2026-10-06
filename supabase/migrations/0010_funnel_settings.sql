-- ============================================================
-- Migration 0010 — Configurações por funil (pixel/scripts/webhook)
--   + tabela funnel_leads (captura do quiz → webhook inlead-compatível)
-- ============================================================

-- Colunas de tracking/config no funil (espelham VslSettings do vsl-platform).
alter table public.funnels
  add column if not exists font                text,
  add column if not exists music               text,
  add column if not exists click_sound         boolean not null default false,
  add column if not exists settings            jsonb not null default '{}'::jsonb,
  add column if not exists utmify_pixel_id     text,
  add column if not exists hotmart_account_id  text,
  add column if not exists hotmart_product_id  text,
  add column if not exists checkout_url        text,
  add column if not exists webhooks            jsonb not null default '[]'::jsonb;

-- ────────────────────────────────────────────────────────────
-- Leads capturados pelo funil (lâmina de captura) — keyed por slug.
-- ────────────────────────────────────────────────────────────
create table if not exists public.funnel_leads (
  id           uuid primary key default gen_random_uuid(),
  funnel_slug  text not null,
  session_id   text,
  name         text,
  phone        text not null,
  component_id text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  src          text,
  xcod         text,
  fbclid       text,
  ctwa_clid    text,
  source_id    text,
  fbp          text,
  fbc          text,
  viewport     text,
  screen       text,
  platform     text,
  user_agent   text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_fleads_slug    on public.funnel_leads (funnel_slug);
create index if not exists idx_fleads_created on public.funnel_leads (created_at desc);

-- RLS: anon insere (captura pública); autenticado lê (dashboard de leads).
alter table public.funnel_leads enable row level security;
drop policy if exists "fleads anon insert" on public.funnel_leads;
create policy "fleads anon insert" on public.funnel_leads
  for insert to anon with check (true);
drop policy if exists "fleads auth read" on public.funnel_leads;
create policy "fleads auth read" on public.funnel_leads
  for select to authenticated using (true);
