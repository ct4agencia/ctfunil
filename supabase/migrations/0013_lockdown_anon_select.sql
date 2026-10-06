-- 0013: LOCKDOWN de leitura anônima (auditoria de segurança 2026-07-09)
-- Achados com a chave ANON (a que vai no browser de qualquer visitante):
--   🔴 funnels: legível por inteiro (webhooks com URL+TOKEN do Datacrazy, settings, pixel ids)
--   🔴 funnel_sessions: legível (session_ids, progresso)
-- O app NUNCA lê essas tabelas com anon — páginas públicas renderizam no servidor
-- (admin client) e o tracking só INSERE/ATUALIZA (upsert/update com return=minimal).
-- Portanto: derruba TODA policy de SELECT do papel anon nessas tabelas.
-- Policies de INSERT/UPDATE (tracking) e as do papel authenticated ficam intactas.

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
    raise notice 'removida policy % em %', r.policyname, r.tablename;
  end loop;
end $$;
