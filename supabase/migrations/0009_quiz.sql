-- ============================================================
-- Migration 0009 — Motor de funil de quiz gamificado
--   funnels         (persiste o que o construtor edita)
--   funnel_sessions (1 linha/sessão, max_step_reached) — modelo Zenlya
--   step_events     (1 linha por avanço de etapa → funil do dashboard)
--   quiz_answers    (distribuição de respostas por pergunta)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Funis (cada um = sequência de lâminas em JSON, + paleta)
-- ────────────────────────────────────────────────────────────
create table if not exists public.funnels (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  niche       text,
  logo        text,
  palette_id  text not null default 'laranja-cdb',
  status      text not null default 'draft' check (status in ('draft','published')),
  domain      text,
  steps       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_funnels_slug on public.funnels (slug);

-- ────────────────────────────────────────────────────────────
-- Sessões do funil (max_step_reached atualizado a cada avanço)
-- ────────────────────────────────────────────────────────────
create table if not exists public.funnel_sessions (
  id               uuid primary key default gen_random_uuid(),
  session_id       text not null unique,
  funnel_slug      text not null,
  max_step_reached int  not null default 0,
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  utm_content      text,
  utm_term         text,
  src              text,
  ctwa_clid        text,
  source_id        text,
  created_at       timestamptz not null default now(),
  last_seen_at     timestamptz not null default now()
);
create index if not exists idx_fsessions_slug on public.funnel_sessions (funnel_slug);
create index if not exists idx_fsessions_seen on public.funnel_sessions (last_seen_at desc);

-- ────────────────────────────────────────────────────────────
-- Eventos de etapa (alimenta o funil granular do dashboard)
-- ────────────────────────────────────────────────────────────
create table if not exists public.step_events (
  id           uuid primary key default gen_random_uuid(),
  session_id   text not null,
  funnel_slug  text not null,
  step_index   int  not null,
  step_id      text not null,
  step_type    text not null,
  meta         jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists idx_sevents_slug    on public.step_events (funnel_slug);
create index if not exists idx_sevents_session on public.step_events (session_id);
create index if not exists idx_sevents_created on public.step_events (created_at desc);

-- ────────────────────────────────────────────────────────────
-- Respostas do quiz (aba Quiz do dashboard)
-- ────────────────────────────────────────────────────────────
create table if not exists public.quiz_answers (
  id           uuid primary key default gen_random_uuid(),
  session_id   text not null,
  funnel_slug  text not null,
  step_id      text not null,
  question     text not null,
  answer       text not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_qanswers_slug on public.quiz_answers (funnel_slug, step_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.funnels         enable row level security;
alter table public.funnel_sessions enable row level security;
alter table public.step_events     enable row level security;
alter table public.quiz_answers    enable row level security;

-- funnels: anon lê os publicados; autenticado (admin) gerencia tudo.
drop policy if exists "funnels anon read published" on public.funnels;
create policy "funnels anon read published" on public.funnels
  for select to anon using (status = 'published');
drop policy if exists "funnels auth all" on public.funnels;
create policy "funnels auth all" on public.funnels
  for all to authenticated using (true) with check (true);

-- funnel_sessions: anon cria/atualiza a própria sessão; autenticado lê (dashboard).
drop policy if exists "fsessions anon insert" on public.funnel_sessions;
create policy "fsessions anon insert" on public.funnel_sessions
  for insert to anon with check (true);
drop policy if exists "fsessions anon update" on public.funnel_sessions;
create policy "fsessions anon update" on public.funnel_sessions
  for update to anon using (true) with check (true);
drop policy if exists "fsessions anon read" on public.funnel_sessions;
create policy "fsessions anon read" on public.funnel_sessions
  for select to anon using (true);
drop policy if exists "fsessions auth read" on public.funnel_sessions;
create policy "fsessions auth read" on public.funnel_sessions
  for select to authenticated using (true);

-- step_events: anon insere; autenticado lê.
drop policy if exists "sevents anon insert" on public.step_events;
create policy "sevents anon insert" on public.step_events
  for insert to anon with check (true);
drop policy if exists "sevents auth read" on public.step_events;
create policy "sevents auth read" on public.step_events
  for select to authenticated using (true);

-- quiz_answers: anon insere; autenticado lê.
drop policy if exists "qanswers anon insert" on public.quiz_answers;
create policy "qanswers anon insert" on public.quiz_answers
  for insert to anon with check (true);
drop policy if exists "qanswers auth read" on public.quiz_answers;
create policy "qanswers auth read" on public.quiz_answers
  for select to authenticated using (true);

-- Seed opcional do funil Clube das Bolsas (vazio aqui; o app popula via construtor).
