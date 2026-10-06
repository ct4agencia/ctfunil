-- 0015: LOCKDOWN de ESCRITA anônima + monotonicidade do progresso.
--
-- Auditoria de 2026-07-30, testada com a chave ANON (a mesma que vai no HTML de
-- todo funil público). O que estava aberto para QUALQUER visitante:
--
--   DELETE em funnel_leads       -> dá pra apagar TODOS os leads
--   UPDATE em funnel_sessions    -> dá pra zerar o progresso e falsificar o painel
--   SELECT em funnels            -> expõe webhooks.api_url (endpoint da Datacrazy),
--                                   settings e ids de pixel. Com a URL dá pra
--                                   injetar lead falso direto no CRM.
--   SELECT em funnel_sessions    -> 394 sessões legíveis
--
--   OK: leitura de funnel_leads e quiz_answers JÁ estava bloqueada (conferido).
--
-- SEGURO PARA O APP: nenhuma página lê essas tabelas com anon. Tudo que é público
-- renderiza no servidor com service_role (funnels-db.ts usa createAdminClient em
-- todas as leituras) e o service_role ignora RLS. O tracking do browser (INSERT
-- de step_events/quiz_answers e UPDATE do progresso) continua funcionando — só
-- fica restrito às colunas de tracking.
--
-- Incorpora a 0013 E a 0014 (nenhuma das duas foi aplicada): rodar SÓ ESTA
-- resolve as três. Idempotente: pode rodar mais de uma vez sem efeito colateral.

-- ─────────────────────────────────────────────────────────────
-- 0) hydrated_at (da 0014) — precisa existir ANTES do grant e do trigger
--    abaixo, que referenciam a coluna. "Visitante" = sessão que hidratou
--    (o app montou no browser), não o beacon cru que dispara antes de tudo.
-- ─────────────────────────────────────────────────────────────
alter table public.funnel_sessions
  add column if not exists hydrated_at timestamptz;

-- Backfill: toda sessão que já tem step_event definitivamente hidratou.
-- Usa created_at como carimbo (aproximação boa o bastante p/ histórico).
update public.funnel_sessions s
   set hydrated_at = s.created_at
 where s.hydrated_at is null
   and exists (select 1 from public.step_events e where e.session_id = s.session_id);

create index if not exists idx_fsessions_hydrated
  on public.funnel_sessions (funnel_slug, hydrated_at);

comment on column public.funnel_sessions.hydrated_at is
  'quando o app do funil montou no browser (hidratacao). NULL = beacon disparou mas o app nunca carregou (bounce pre-render). Visitante = hydrated_at IS NOT NULL.';

-- ─────────────────────────────────────────────────────────────
-- 1) SELECT anônimo: derruba em funnels e funnel_sessions
-- ─────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select policyname, tablename
      from pg_policies
     where schemaname = 'public'
       and tablename in ('funnels', 'funnel_sessions', 'step_events', 'quiz_answers', 'funnel_leads')
       and cmd = 'SELECT'
       and 'anon' = any(roles)
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    raise notice '[select] removida policy % em %', r.policyname, r.tablename;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 2) DELETE anônimo: derruba em TODAS as tabelas do funil.
--    Nenhum caminho do app apaga dado pelo browser — só o painel
--    (/api/reset-funnel-data), que roda no servidor com service_role.
-- ─────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select policyname, tablename
      from pg_policies
     where schemaname = 'public'
       and tablename in ('funnels', 'funnel_sessions', 'step_events', 'quiz_answers', 'funnel_leads')
       and cmd in ('DELETE', 'ALL')
       and 'anon' = any(roles)
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    raise notice '[delete] removida policy % em %', r.policyname, r.tablename;
  end loop;
end $$;

revoke delete on public.funnels          from anon;
revoke delete on public.funnel_sessions  from anon;
revoke delete on public.funnel_leads     from anon;
revoke delete on public.step_events      from anon;
revoke delete on public.quiz_answers     from anon;

-- ─────────────────────────────────────────────────────────────
-- 3) UPDATE anônimo por COLUNA (o RLS não faz isso; o GRANT faz).
--    O tracking do browser só precisa mexer no progresso e na VSL.
--    Sem isso, dava pra reescrever utm_*, funnel_slug e session_id.
-- ─────────────────────────────────────────────────────────────
revoke update on public.funnels          from anon;
revoke update on public.funnel_leads     from anon;
revoke update on public.step_events      from anon;
revoke update on public.quiz_answers     from anon;
revoke update on public.funnel_sessions  from anon;

grant update (
  max_step_reached,
  last_seen_at,
  hydrated_at,
  vsl_watch_pct,
  vsl_milestones,
  vsl_player_id
) on public.funnel_sessions to anon;

-- ─────────────────────────────────────────────────────────────
-- 4) MONOTONICIDADE: o progresso só sobe, nunca desce.
--    Fecha o buraco de "zerar o funil de fora" mesmo com UPDATE
--    liberado, e protege contra o bug do ensureSession que zerava
--    o progresso a cada F5 (corrigido no commit 7ded91c).
-- ─────────────────────────────────────────────────────────────
create or replace function public.fn_max_step_monotonico()
returns trigger
language plpgsql
as $$
begin
  new.max_step_reached := greatest(coalesce(old.max_step_reached, 0), coalesce(new.max_step_reached, 0));
  -- hidratação: preserva o PRIMEIRO carimbo (não reescreve a cada visita)
  if old.hydrated_at is not null then
    new.hydrated_at := old.hydrated_at;
  end if;
  return new;
end $$;

drop trigger if exists trg_max_step_monotonico on public.funnel_sessions;
create trigger trg_max_step_monotonico
  before update on public.funnel_sessions
  for each row execute function public.fn_max_step_monotonico();

comment on function public.fn_max_step_monotonico() is
  'Progresso da sessao so sobe. Impede zerar o funil (de fora ou por bug de reload) e preserva a primeira hidratacao.';

-- ─────────────────────────────────────────────────────────────
-- 5) Conferência — deve sobrar SOMENTE INSERT (e o UPDATE de sessions)
-- ─────────────────────────────────────────────────────────────
do $$
declare r record; n int := 0;
begin
  raise notice '--- policies que sobraram para anon ---';
  for r in
    select tablename, policyname, cmd
      from pg_policies
     where schemaname = 'public'
       and tablename in ('funnels', 'funnel_sessions', 'step_events', 'quiz_answers', 'funnel_leads')
       and 'anon' = any(roles)
     order by tablename, cmd
  loop
    raise notice '  % | % | %', r.tablename, r.cmd, r.policyname;
    n := n + 1;
  end loop;
  raise notice '--- total: % ---', n;
end $$;
