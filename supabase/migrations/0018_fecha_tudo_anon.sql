-- 0018: fecha a ÚLTIMA porta anônima. O tracking agora grava pelo servidor.
--
-- CONTEXTO
-- A 0017 devolveu SELECT/UPDATE em funnel_sessions para o papel anon porque o
-- navegador escrevia direto no banco e o UPDATE precisava enxergar a própria
-- linha. Isso deixava aberto: qualquer visitante lia as sessões (session_id,
-- progresso, UTMs) e podia escrever nas colunas de tracking.
--
-- O QUE MUDOU
-- O avanço de lâmina passou a ser gravado por /api/step (rota de servidor com
-- service_role, via navigator.sendBeacon). Validado em produção:
--   POST /api/step -> cria a sessão, grava max_step=7, carimba hydrated_at,
--   registra step_event com o step_type REAL, e mandar passo 3 depois do 7
--   mantém 7 (monotônico).
-- Logo o browser não precisa de mais NENHUMA permissão em funnel_sessions.
--
-- DEPOIS DESTA MIGRATION, o papel anon fica só com o que a lead realmente usa:
--   INSERT em step_events   (evento de etapa — fallback do beacon)
--   INSERT em quiz_answers  (resposta do quiz)
--   INSERT em funnel_leads  (captura)
-- e NADA de SELECT, UPDATE ou DELETE em lugar nenhum.
--
-- ATENÇÃO À JANELA DE DEPLOY
-- Rodar SÓ DEPOIS de o deploy com /api/step estar no ar (já está). Quem estiver
-- com a página aberta no código antigo perde o avanço de lâmina até recarregar
-- — impacto pequeno e transitório; a captura de lead não é afetada.
--
-- Idempotente.

-- 1) SELECT anônimo: derruba de vez (a 0017 tinha devolvido em funnel_sessions)
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

-- 2) UPDATE anônimo: não é mais necessário (quem atualiza é o /api/step)
do $$
declare r record;
begin
  for r in
    select policyname, tablename
      from pg_policies
     where schemaname = 'public'
       and tablename in ('funnels', 'funnel_sessions', 'step_events', 'quiz_answers', 'funnel_leads')
       and cmd in ('UPDATE', 'ALL')
       and 'anon' = any(roles)
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    raise notice '[update] removida policy % em %', r.policyname, r.tablename;
  end loop;
end $$;

revoke update on public.funnel_sessions from anon;
revoke select on public.funnel_sessions from anon;

-- O trigger de monotonicidade FICA: protege contra qualquer caminho futuro
-- (inclusive bug nosso) que tente rebaixar o progresso.

-- ─────────────────────────────────────────────────────────────
-- Conferência: o anon deve ficar SÓ com os 3 INSERTs
-- ─────────────────────────────────────────────────────────────
do $$
declare r record; n int := 0;
begin
  raise notice '--- policies do anon (esperado: 3 INSERTs) ---';
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
  raise notice '--- total: % ---', n;
end $$;
