-- ============================================================
-- Migration 0005 — domínio deixa de ser único
-- ============================================================
-- Modelo novo: vários VSLs por domínio, cada um em /{slug}.
-- Ex: clubedasbolsas4.com.br/cbd-cap-g e clubedasbolsas4.com.br/outro-teste.
-- O slug continua único globalmente, então (domínio + slug) é único.
drop index if exists idx_vsls_domain_unique;
