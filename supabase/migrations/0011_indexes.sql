-- 0011: índices p/ os filtros reais das métricas e do hot path de captura.
-- Todos aditivos (IF NOT EXISTS). Tabelas ainda pequenas → CREATE INDEX normal
-- (lock de milissegundos); se rodar com tabelas grandes, trocar por CONCURRENTLY.

-- HOT PATH: /api/funnel-lead busca quiz_answers por session_id a cada captura
-- de lead do tráfego pago (enriquecimento do webhook Datacrazy). Sem índice =
-- seq scan que cresce com o tráfego.
create index if not exists idx_qanswers_session
  on public.quiz_answers (session_id, created_at);

-- Métricas: filtros sempre em (funnel_slug + created_at) e (funnel_slug + max_step).
create index if not exists idx_fsessions_slug_created
  on public.funnel_sessions (funnel_slug, created_at desc);

create index if not exists idx_fsessions_slug_step
  on public.funnel_sessions (funnel_slug, max_step_reached);

create index if not exists idx_fleads_slug_created
  on public.funnel_leads (funnel_slug, created_at desc);

-- Filtro de período das answers em /api/funnel-analytics.
create index if not exists idx_qanswers_slug_created
  on public.quiz_answers (funnel_slug, created_at);
