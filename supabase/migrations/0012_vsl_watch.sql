-- 0012: retenção da VSL por sessão (REQ-1/2/3 da spec vturb-analytics-completo)
-- vsl_watch_pct: % máxima assistida (0-100, só aumenta)
-- vsl_player_id: player VTurb que a sessão assistiu
-- vsl_milestones: marcos já disparados no webhook ('25','50','75','100','pitch') — dedup de disparo

alter table public.funnel_sessions
  add column if not exists vsl_watch_pct integer not null default 0,
  add column if not exists vsl_player_id text,
  add column if not exists vsl_milestones jsonb not null default '[]'::jsonb;

comment on column public.funnel_sessions.vsl_watch_pct is '% máxima da VSL assistida pela sessão (0-100)';
comment on column public.funnel_sessions.vsl_milestones is 'marcos de webhook vsl_progress já disparados (dedup)';
