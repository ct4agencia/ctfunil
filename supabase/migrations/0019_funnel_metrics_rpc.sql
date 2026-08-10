-- 0019: agregação EXATA das métricas do funil, no Postgres.
--
-- CONTEXTO
-- A aba Performance tinha duas classes de número convivendo:
--   * COUNT exato no banco  -> visitantes, respostas, conclusões, leads
--   * amostra LIMIT 5000    -> média de etapas, tempo, tráfego 24h, campanhas
-- Acima de 5.000 sessões no período os dois grupos divergiam EM SILÊNCIO.
--
-- Pior: o funil não era monotônico. "Leads capturados" vinha de outra tabela
-- (funnel_leads) e não tinha relação com as sessões — o mesmo lead enviando o
-- formulário duas vezes contava duas. Dava leads > respostas e pct > 100, o que
-- estourava o desenho do funil na tela. Prova em produção (cdb-01, 05/08):
-- card "Respostas Iniciadas" = 14 e funil "1ª resposta" = 20, lado a lado.
--
-- O QUE MUDA
-- Um inteiro "estágio máximo atingido" por sessão, e o funil vira um histograma
-- cumulativo: count(estagio >= k) é não-crescente em k POR CONSTRUÇÃO. É
-- matematicamente impossível uma etapa superar a anterior ou passar de 100%.
-- Leads deixam de ser COUNT de linhas e viram semi-join (pessoas, não envios).
--
-- SEGURANÇA
-- Aditiva: só `create index` e `create function`. Nenhum ALTER/DROP/UPDATE em
-- tabela com tráfego — publicável com os 12 funis pagos rodando. As funções são
-- security definer com execute só para service_role, mantendo o lockdown das
-- migrations 0015-0018 (anon não executa nada).
--
-- ROLLBACK
--   drop function if exists public.funnel_metrics_agg(text,timestamptz,timestamptz,int,int,int);
--   drop function if exists public.funnel_traffic_series(text,timestamptz,timestamptz,text,int,int);
--   drop function if exists public.funnel_campaigns(text,timestamptz,timestamptz,int);
-- O código faz fallback para o caminho antigo se as funções não existirem, então
-- derrubá-las não quebra a tela — ela volta a marcar `amostra_truncada`.

-- O semi-join de leads roda por (funnel_slug, session_id); sem este índice ele
-- vira seq scan na funnel_leads a cada carga da aba.
create index if not exists idx_fleads_slug_session
  on public.funnel_leads (funnel_slug, session_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 1) Agregado principal: os 5 estágios + insumos da faixa de conferência.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.funnel_metrics_agg(
  p_slug     text,
  p_from     timestamptz default null,
  p_to       timestamptz default null,
  p_first_q  int  default 1,   -- índice da 1ª pergunta de verdade
  p_second_q int  default 2,   -- índice da 2ª pergunta
  p_last_i   int  default 0    -- índice da última lâmina ativa
)
returns table (
  visitantes   bigint,  -- estagio >= 0
  respostas    bigint,  -- estagio >= 1
  resp2        bigint,  -- estagio >= 2
  leads        bigint,  -- estagio >= 3  (PESSOAS: sessão com ao menos 1 lead)
  conclusoes   bigint,  -- estagio >= 4
  soma_etapas  bigint,  -- p/ média de etapas exata (sem amostra)
  rastreadas   bigint,  -- sessões com utm/src preenchido
  leads_linhas bigint,  -- COUNT(*) bruto em funnel_leads  → confere duplicados
  leads_sess   bigint   -- COUNT(DISTINCT session_id)      → confere órfãos
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select s.session_id,
           s.max_step_reached,
           coalesce(nullif(btrim(s.utm_campaign), ''),
                    nullif(btrim(s.utm_source), ''),
                    nullif(btrim(s.src), '')) as camp
      from public.funnel_sessions s
     where s.funnel_slug = p_slug
       and s.hydrated_at is not null           -- visitante = app montou de fato
       and (p_from is null or s.created_at >= p_from)
       and (p_to   is null or s.created_at <= p_to)
  ),
  lead_rows as (
    select l.session_id
      from public.funnel_leads l
     where l.funnel_slug = p_slug
       and (p_from is null or l.created_at >= p_from)
       and (p_to   is null or l.created_at <= p_to)
  ),
  st as (
    select b.*,
           -- Estágio MÁXIMO atingido. O greatest() é o que garante a
           -- monotonicidade: quem virou lead conta em todas as etapas abaixo.
           greatest(
             0,
             case when b.max_step_reached >= p_first_q  then 1 else 0 end,
             case when b.max_step_reached >= p_second_q then 2 else 0 end,
             case when exists (select 1 from lead_rows lr
                                where lr.session_id = b.session_id) then 3 else 0 end,
             case when b.max_step_reached >= p_last_i   then 4 else 0 end
           ) as estagio
      from base b
  )
  select count(*),
         count(*) filter (where estagio >= 1),
         count(*) filter (where estagio >= 2),
         count(*) filter (where estagio >= 3),
         count(*) filter (where estagio >= 4),
         coalesce(sum(max_step_reached + 1), 0),
         count(*) filter (where camp is not null),
         (select count(*) from lead_rows),
         (select count(distinct session_id) from lead_rows where session_id is not null)
    from st;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) Série temporal RESPEITANDO o período escolhido.
--    Antes o gráfico era sempre "últimas 24h de agora" (metrics.ts:437), então
--    escolher "Ontem" zerava tudo sem nenhum aviso na tela.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.funnel_traffic_series(
  p_slug    text,
  p_from    timestamptz default null,
  p_to      timestamptz default null,
  p_bucket  text default 'hour',   -- 'hour' p/ janelas curtas, 'day' p/ longas
  p_first_q int default 1,
  p_last_i  int default 0
)
returns table (
  bucket     timestamptz,
  visitantes bigint,
  respostas  bigint,
  leads      bigint,
  conclusoes bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select s.session_id,
           s.max_step_reached,
           date_trunc(p_bucket, s.created_at at time zone 'America/Sao_Paulo') as bk
      from public.funnel_sessions s
     where s.funnel_slug = p_slug
       and s.hydrated_at is not null
       and (p_from is null or s.created_at >= p_from)
       and (p_to   is null or s.created_at <= p_to)
  ),
  lead_rows as (
    select distinct l.session_id
      from public.funnel_leads l
     where l.funnel_slug = p_slug
       and (p_from is null or l.created_at >= p_from)
       and (p_to   is null or l.created_at <= p_to)
  )
  select bk,
         count(*),
         count(*) filter (where max_step_reached >= p_first_q),
         -- mesma definição de lead do agregado: pessoa, não linha gravada
         count(*) filter (where session_id in (select session_id from lead_rows)),
         count(*) filter (where max_step_reached >= p_last_i)
    from base
   group by bk
   order by bk;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) Campanhas exatas (sem o teto de 5.000).
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.funnel_campaigns(
  p_slug  text,
  p_from  timestamptz default null,
  p_to    timestamptz default null,
  p_limit int default 6
)
returns table (name text, value bigint)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(btrim(utm_campaign), ''),
                  nullif(btrim(utm_source), ''),
                  nullif(btrim(src), '')) as name,
         count(*)
    from public.funnel_sessions
   where funnel_slug = p_slug
     and hydrated_at is not null
     and (p_from is null or created_at >= p_from)
     and (p_to   is null or created_at <= p_to)
   group by 1
  having coalesce(nullif(btrim(utm_campaign), ''),
                  nullif(btrim(utm_source), ''),
                  nullif(btrim(src), '')) is not null
   order by 2 desc
   limit p_limit;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Permissões: só o servidor (service_role). anon continua sem executar nada,
-- coerente com o lockdown das migrations 0015-0018.
-- ───────────────────────────────────────────────────────────────────────────
revoke all on function public.funnel_metrics_agg(text,timestamptz,timestamptz,int,int,int)     from public, anon;
revoke all on function public.funnel_traffic_series(text,timestamptz,timestamptz,text,int,int) from public, anon;
revoke all on function public.funnel_campaigns(text,timestamptz,timestamptz,int)               from public, anon;

grant execute on function public.funnel_metrics_agg(text,timestamptz,timestamptz,int,int,int)     to service_role;
grant execute on function public.funnel_traffic_series(text,timestamptz,timestamptz,text,int,int) to service_role;
grant execute on function public.funnel_campaigns(text,timestamptz,timestamptz,int)               to service_role;

-- O PostgREST guarda o schema em cache; sem isto a RPC nova responde 404 até o
-- próximo restart (pegadinha já conhecida neste projeto).
notify pgrst, 'reload schema';
