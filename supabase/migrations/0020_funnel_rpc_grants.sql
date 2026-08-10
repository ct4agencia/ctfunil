-- 0020: fecha o execute das RPCs do funil e fixa o search_path do trigger.
--
-- MOTIVO
-- A 0019 dizia, no próprio cabeçalho: "As funções são security definer com
-- execute só para service_role". O REVOKE dela listava `from public, anon` e
-- esqueceu `authenticated`, e o default do projeto concede execute a esse role.
-- Resultado medido em pg_proc.proacl:
--   funnel_metrics_agg    = postgres=X | authenticated=X | service_role=X
-- Ou seja: qualquer usuário logado podia chamar /rest/v1/rpc/funnel_metrics_agg
-- com qualquer slug e ler as métricas de qualquer funil. Como são SECURITY
-- DEFINER, elas ignoram RLS por construção.
--
-- Exposição real hoje: 1 conta em auth.users (o próprio admin). O conserto é
-- preventivo — no dia em que o painel ganhar um segundo usuário, o vazamento
-- passaria a existir sem ninguém mexer em nada.
--
-- SEGURANÇA DE NÃO QUEBRAR
-- O app chama estas RPCs por `createAdminClient()` (service_role) —
-- metrics.ts:712 `const sbCount = createAdminClient()` e :771 `sbCount.rpc(...)`.
-- Nenhum caminho do app usa a chave anon/authenticated para chamá-las, então
-- revogar de `authenticated` não altera nada em runtime.
--
-- ROLLBACK
--   grant execute on function public.funnel_metrics_agg(text,timestamptz,timestamptz,int,int,int) to authenticated;
--   (idem para as outras duas)

revoke execute on function public.funnel_metrics_agg(text,timestamptz,timestamptz,int,int,int)     from authenticated;
revoke execute on function public.funnel_traffic_series(text,timestamptz,timestamptz,text,int,int) from authenticated;
revoke execute on function public.funnel_campaigns(text,timestamptz,timestamptz,int)               from authenticated;

-- `fn_max_step_monotonico` é trigger comum (prosecdef = false), então não há
-- escalação de privilégio possível aqui; fixar o search_path é higiene para o
-- advisor parar de sinalizar e para o trigger não resolver `greatest`/`coalesce`
-- de um schema plantado no caminho. Não muda comportamento.
alter function public.fn_max_step_monotonico() set search_path = pg_catalog, public;
