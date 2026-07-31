-- 0016: URGENTE — restaura o UPDATE do tracking que a 0015 derrubou junto.
--
-- O QUE ACONTECEU
-- A 0015 removia as policies de DELETE do papel anon com:
--     where cmd in ('DELETE', 'ALL')
-- Só que a policy que permitia o tracking do browser atualizar o progresso era
-- do tipo ALL — e foi removida no mesmo laço. Sintoma: o UPDATE volta SEM erro
-- e com 0 linhas afetadas (é assim que o RLS nega: filtra, não reclama), então
-- max_step_reached parou de subir e o funil do painel congela.
-- INSERT de step_events e quiz_answers continuou funcionando normalmente.
--
-- POR QUE RECRIAR É SEGURO
-- A brecha original (qualquer visitante zerar/forjar o progresso) continua
-- fechada por DUAS camadas que a 0015 já instalou e que NÃO são desfeitas aqui:
--   1. GRANT por COLUNA: anon só pode escrever max_step_reached, last_seen_at,
--      hydrated_at, vsl_watch_pct, vsl_milestones e vsl_player_id. Não dá pra
--      mexer em funnel_slug, session_id nem utm_* (conferido: erro 42501).
--   2. TRIGGER trg_max_step_monotonico: o progresso só sobe. Mandar 0 numa
--      sessão que está em 18 mantém 18.
-- Ou seja: o anon volta a poder avançar o próprio progresso, e só isso.
--
-- Idempotente.

drop policy if exists "fsessions anon update tracking" on public.funnel_sessions;

create policy "fsessions anon update tracking"
  on public.funnel_sessions
  for update
  to anon
  using (true)
  with check (true);

-- Reforça o grant por coluna (a 0015 já fez; repetido aqui para o caso de esta
-- migration ser aplicada isolada num ambiente novo).
revoke update on public.funnel_sessions from anon;
grant update (
  max_step_reached,
  last_seen_at,
  hydrated_at,
  vsl_watch_pct,
  vsl_milestones,
  vsl_player_id
) on public.funnel_sessions to anon;

-- ─────────────────────────────────────────────────────────────
-- Conferência: o que o papel anon pode fazer agora
-- ─────────────────────────────────────────────────────────────
do $$
declare r record; n int := 0;
begin
  raise notice '--- policies do anon nas tabelas do funil ---';
  for r in
    select tablename, cmd, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('funnels', 'funnel_sessions', 'step_events', 'quiz_answers', 'funnel_leads')
       and 'anon' = any(roles)
     order by tablename, cmd
  loop
    raise notice '  % | % | %', r.tablename, r.cmd, r.policyname;
    n := n + 1;
  end loop;
  raise notice '--- total: % (esperado: INSERTs + 1 UPDATE em funnel_sessions) ---', n;

  raise notice '--- colunas que o anon pode ATUALIZAR em funnel_sessions ---';
  for r in
    select column_name
      from information_schema.column_privileges
     where table_schema = 'public'
       and table_name = 'funnel_sessions'
       and grantee = 'anon'
       and privilege_type = 'UPDATE'
     order by column_name
  loop
    raise notice '  %', r.column_name;
  end loop;
end $$;
