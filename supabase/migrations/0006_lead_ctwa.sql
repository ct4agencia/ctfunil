-- ============================================================
-- Migration 0006 — tracking avançado no lead (CTWA + Meta cookies)
-- ============================================================
alter table public.leads
  add column if not exists ctwa_clid text,
  add column if not exists source_id text,
  add column if not exists fbp text,
  add column if not exists fbc text;
