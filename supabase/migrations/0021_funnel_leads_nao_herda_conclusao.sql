-- 0021: "Leads capturados" volta a significar lead capturado.
--
-- O DEFEITO (medido em produção, 10/08/2026)
-- A 0019 forçou monotonicidade com um greatest() de 5 ramos, sendo o último
--   case when max_step_reached >= p_last_i then 4 else 0 end
-- e depois contava leads como `estagio >= 3`. Consequência: CONCLUIR passou a
-- implicar "virou lead". Num funil de UMA lâmina, p_last_i = 0 e a condição
-- `max_step_reached >= 0` é sempre verdadeira — toda sessão vira estágio 4 e
-- TODOS os indicadores viram o total.
--
-- Prova (premio-sonia, raspadinha de 1 lâmina, 3.199 visitantes):
--   funnel_metrics_agg('premio-sonia', null, null, 1, 1000000, 0) devolvia
--   visitantes 3199 · respostas 3199 · resp2 3199 · leads 3199 · conclusoes 3199
--   e, na MESMA linha, leads_linhas 0 · leads_sess 0.
--   A tabela funnel_leads tem ZERO linha para esse funil. O painel exibia
--   3.199 leads capturados que nunca existiram.
--
-- Atingidos: premio-sonia (1 lâmina, 3199 visitantes, 0 leads reais),
-- cdb-type01 (0 lâminas ativas, 97 visitantes, 16 leads reais), cdb-type01-a,
-- adelan. Nos funis de várias lâminas o número não muda: a varredura mostrou
-- `concluiu sem virar lead` = 0 em todos eles, e o cdb-01 devolve exatamente
-- os mesmos 122 · 23 · 17 · 12 · 12 de antes.
--
-- A REGRA (Luca, 06/08/2026)
--   Visitantes   = carregou/hidratou
--   1ª interação = concluiu a interação do 1º card
--   2ª interação = concluiu a interação do 2º card
--   Leads        = deixou NOME e TELEFONE na captura
--   Conclusões   = clicou para ir à etapa VSL
-- São cinco medidas independentes. Só uma implicação é legítima: quem preencheu
-- a captura necessariamente passou pelos cards anteriores — por isso `or eh_lead`
-- entra em 1ª e 2ª interação, e é o que mantém o funil não-crescente ali.
--
-- Conclusão NÃO implica lead, e lead NÃO implica conclusão. Se um funil deixar
-- pular a captura, conclusões > leads é a realidade e o painel deve mostrá-la.
--
-- ROLLBACK: reaplicar 0019_funnel_metrics_rpc.sql (o corpo antigo está lá).

create or replace function public.funnel_metrics_agg(
  p_slug     text,
  p_from     timestamptz default null,
  p_to       timestamptz default null,
  p_first_q  int  default 1,
  p_second_q int  default 2,
  p_last_i   int  default 0
)
returns table (
  visitantes   bigint,
  respostas    bigint,
  resp2        bigint,
  leads        bigint,
  conclusoes   bigint,
  soma_etapas  bigint,
  rastreadas   bigint,
  leads_linhas bigint,
  leads_sess   bigint
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
       and s.hydrated_at is not null
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
           exists (select 1 from lead_rows lr where lr.session_id = b.session_id) as eh_lead
      from base b
  )
  select count(*),
         -- `or eh_lead`: quem preencheu a captura passou pelos cards anteriores,
         -- mesmo que max_step_reached tenha ficado para trás. É a ÚNICA
         -- implicação legítima, e é ela que segura a monotonicidade aqui.
         count(*) filter (where max_step_reached >= p_first_q  or eh_lead),
         count(*) filter (where max_step_reached >= p_second_q or eh_lead),
         -- lead é lead: semi-join com funnel_leads, sem herdar de etapa nenhuma
         count(*) filter (where eh_lead),
         -- p_last_i <= 0 significa funil sem progressão mensurável (1 lâmina ou
         -- nenhuma ativa). Sem a guarda, `>= 0` é tautologia e conclusões vira
         -- o total — foi o que inflou premio-sonia para 100% em tudo.
         count(*) filter (where p_last_i > 0 and max_step_reached >= p_last_i),
         coalesce(sum(max_step_reached + 1), 0),
         count(*) filter (where camp is not null),
         (select count(*) from lead_rows),
         (select count(distinct session_id) from lead_rows where session_id is not null)
    from st;
$$;

-- Mesma correção na série temporal: ela alimenta o gráfico ao lado dos cards, e
-- as duas divergirem é o defeito histórico que a 0019 tentou matar.
create or replace function public.funnel_traffic_series(
  p_slug    text,
  p_from    timestamptz default null,
  p_to      timestamptz default null,
  p_bucket  text default 'hour',
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
  with lead_rows as (
    select distinct l.session_id
      from public.funnel_leads l
     where l.funnel_slug = p_slug
       and (p_from is null or l.created_at >= p_from)
       and (p_to   is null or l.created_at <= p_to)
  ),
  base as (
    select s.session_id,
           s.max_step_reached,
           (s.session_id in (select session_id from lead_rows)) as eh_lead,
           date_trunc(p_bucket, s.created_at at time zone 'America/Sao_Paulo') as bk
      from public.funnel_sessions s
     where s.funnel_slug = p_slug
       and s.hydrated_at is not null
       and (p_from is null or s.created_at >= p_from)
       and (p_to   is null or s.created_at <= p_to)
  )
  select bk,
         count(*),
         count(*) filter (where max_step_reached >= p_first_q or eh_lead),
         count(*) filter (where eh_lead),
         count(*) filter (where p_last_i > 0 and max_step_reached >= p_last_i)
    from base
   group by bk
   order by bk;
$$;

-- As funções foram recriadas: reaplicar o lockdown da 0020, senão o default do
-- projeto devolve execute para `authenticated`.
revoke execute on function public.funnel_metrics_agg(text,timestamptz,timestamptz,int,int,int)     from public, anon, authenticated;
revoke execute on function public.funnel_traffic_series(text,timestamptz,timestamptz,text,int,int) from public, anon, authenticated;
grant  execute on function public.funnel_metrics_agg(text,timestamptz,timestamptz,int,int,int)     to service_role;
grant  execute on function public.funnel_traffic_series(text,timestamptz,timestamptz,text,int,int) to service_role;

notify pgrst, 'reload schema';
