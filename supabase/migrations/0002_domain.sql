-- ============================================================
-- Migration 0002 — campo de domínio próprio por VSL
-- ============================================================
-- Cada VSL pode ter um domínio comprado apontando pra ela.
-- O domínio é único (não pode haver duas VSLs no mesmo domínio).

alter table public.vsls
  add column if not exists domain text;

-- Único quando preenchido (NULLs não conflitam entre si no Postgres).
create unique index if not exists idx_vsls_domain_unique
  on public.vsls (domain)
  where domain is not null;
