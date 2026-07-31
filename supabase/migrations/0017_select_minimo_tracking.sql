-- 0017: destrava o tracking — o UPDATE precisa ENXERGAR a linha pra atualizar.
--
-- POR QUE A 0016 NÃO BASTOU
-- A 0015 removeu toda policy de SELECT do papel anon em funnel_sessions. Só que
-- o tracking do browser faz:
--     update funnel_sessions set max_step_reached = 9 where session_id = '...'
-- e o Postgres precisa LOCALIZAR essa linha para atualizá-la. Sem policy de
-- SELECT, nenhuma linha é visível para o anon → o WHERE não casa com nada →
-- 0 linhas afetadas, SEM erro (é assim que o RLS nega: filtra, não reclama).
-- Isso explica exatamente o que foi medido em produção:
--     INSERT de step_events/quiz_answers/funnel_leads  -> FUNCIONA (não localiza nada)
--     UPDATE de funnel_sessions                        -> 0 linhas, sem erro
--     coluna proibida (utm_source)                     -> 42501 (o GRANT está certo)
--     mesmo UPDATE com service_role                    -> funciona (ignora RLS)
--
-- O QUE ESTA MIGRATION FAZ
-- Devolve SELECT para anon SOMENTE em funnel_sessions. Continuam FECHADOS:
--     funnel_leads   (nome/telefone das leads)
--     quiz_answers   (respostas)
--     funnels        (webhooks com a URL da Datacrazy, settings, pixels)
--
-- O QUE FICA EXPOSTO E POR QUANTO TEMPO
-- funnel_sessions volta a ser legível: session_id, funnel_slug, progresso e UTMs.
-- É dado de tracking, não PII — bem menos grave que leads. Ainda assim é
-- TEMPORÁRIO: a correção definitiva é mover a gravação do progresso para o
-- servidor (rota própria com service_role, igual o VisitBeacon já faz), e aí
-- derrubar TODA permissão de escrita e leitura anônima. Enquanto isso, as duas
-- travas da 0015 seguem de pé e impedem abuso:
--   - GRANT por coluna: anon só escreve as 6 colunas de tracking (testado: 42501)
--   - trigger trg_max_step_monotonico: o progresso só sobe, nunca desce (testado)
--
-- Idempotente.

drop policy if exists "fsessions anon select" on public.funnel_sessions;

create policy "fsessions anon select"
  on public.funnel_sessions
  for select
  to anon
  using (true);

comment on policy "fsessions anon select" on public.funnel_sessions is
  'TEMPORARIO: necessario para o UPDATE do tracking localizar a propria linha. Remover assim que a gravacao do progresso migrar para rota de servidor (service_role).';

-- ─────────────────────────────────────────────────────────────
-- Conferência final: o que o anon pode fazer em cada tabela
-- ─────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  raise notice '--- policies do anon ---';
  for r in
    select tablename, cmd, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('funnels', 'funnel_sessions', 'step_events', 'quiz_answers', 'funnel_leads')
       and 'anon' = any(roles)
     order by tablename, cmd
  loop
    raise notice '  % | % | %', r.tablename, r.cmd, r.policyname;
  end loop;
  raise notice '--- esperado: SELECT+UPDATE em funnel_sessions e INSERTs nas demais ---';
end $$;
