-- ============================================================
-- Migration 0003 — settings por página + webhooks + leads
-- ============================================================

-- Configurações (Pixel/Scripts + SEO & Favicon) por VSL, como JSON.
alter table public.vsls
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- ────────────────────────────────────────────────────────────
-- Webhooks (vários por página)
-- ────────────────────────────────────────────────────────────
create table if not exists public.webhooks (
  id            uuid primary key default gen_random_uuid(),
  vsl_id        uuid not null references public.vsls(id) on delete cascade,
  name          text,
  api_url       text not null,
  token         text,
  method        text not null default 'POST' check (method in ('POST','GET')),
  content_type  text not null default 'formData' check (content_type in ('formData','json')),
  trigger_event text not null default 'click_component'
                  check (trigger_event in ('click_component','each_step','lead_capture')),
  component_id  text,
  enabled       boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists idx_webhooks_vsl on public.webhooks (vsl_id);

-- ────────────────────────────────────────────────────────────
-- Leads (capturados na página, com tracking)
-- ────────────────────────────────────────────────────────────
create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  vsl_id       uuid references public.vsls(id) on delete cascade,
  code         text,
  name         text,
  phone        text,
  email        text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  src          text,
  xcod         text,
  fbclid       text,
  viewport     text,
  screen       text,
  platform     text,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_leads_vsl     on public.leads (vsl_id);
create index if not exists idx_leads_created on public.leads (created_at desc);

-- ============================================================
-- RLS
-- ============================================================
alter table public.webhooks enable row level security;
alter table public.leads    enable row level security;

-- webhooks: só o admin (autenticado) gerencia.
drop policy if exists "webhooks auth all" on public.webhooks;
create policy "webhooks auth all" on public.webhooks
  for all to authenticated using (true) with check (true);

-- leads: anon pode INSERT (popup na página pública). Autenticado lê.
drop policy if exists "leads anon insert" on public.leads;
create policy "leads anon insert" on public.leads
  for insert to anon with check (true);
drop policy if exists "leads auth read" on public.leads;
create policy "leads auth read" on public.leads
  for select to authenticated using (true);
