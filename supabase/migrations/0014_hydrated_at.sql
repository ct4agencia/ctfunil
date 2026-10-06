-- 0014: "Visitante" passa a contar na HIDRATAÇÃO (igual inlead), não no beacon cru.
-- O VisitBeacon (script no <head>) cria a linha da sessão ANTES do app carregar —
-- isso contava como visitante quem saía em <1s sem nunca ver/hidratar o hero,
-- inflando o denominador (~9%) e afundando a taxa visitante→1ª resposta vs inlead.
-- Agora: hydrated_at é marcado quando o app monta (trackStep índice 0). A métrica
-- "Visitante" = sessões com hydrated_at. A linha do beacon sem hidratação vira só
-- um marcador de "carregou a página" (não some do banco, só não conta como visitante).

alter table public.funnel_sessions
  add column if not exists hydrated_at timestamptz;

-- Backfill: toda sessão que já tem step_event definitivamente hidratou.
-- Usa created_at como carimbo (aproximação boa o bastante p/ dados históricos).
update public.funnel_sessions s
   set hydrated_at = s.created_at
 where s.hydrated_at is null
   and exists (select 1 from public.step_events e where e.session_id = s.session_id);

-- índice p/ o COUNT de visitante (funnel_slug + hydrated_at)
create index if not exists idx_fsessions_hydrated
  on public.funnel_sessions (funnel_slug, hydrated_at);

comment on column public.funnel_sessions.hydrated_at is
  'quando o app do funil montou no browser (hidratação). NULL = beacon disparou mas o app nunca carregou (bounce pré-render). Visitante = hydrated_at IS NOT NULL.';
