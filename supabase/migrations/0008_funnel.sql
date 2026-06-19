-- ============================================================
-- Migration 0008 — função de funil (analytics da aba Leads)
-- ============================================================
-- Conta sessões distintas por etapa do funil de uma VSL.
-- leads.code = session_id (definido no /api/lead), então cruzamos por aí.
create or replace function public.vsl_funnel(p_vsl_id uuid)
returns json
language sql
stable
as $$
  select json_build_object(
    'views', (
      select count(distinct session_id) from public.vsl_events
      where vsl_id = p_vsl_id and event_type = 'view'
    ),
    'plays', (
      select count(distinct session_id) from public.vsl_events
      where vsl_id = p_vsl_id and event_type = 'play'
    ),
    'cta_clicks', (
      select count(distinct session_id) from public.vsl_events
      where vsl_id = p_vsl_id and event_type = 'cta_click'
    ),
    'leads', (
      select count(*) from public.leads where vsl_id = p_vsl_id
    ),
    'cta_sem_captura', (
      select count(distinct e.session_id) from public.vsl_events e
      where e.vsl_id = p_vsl_id and e.event_type = 'cta_click'
        and not exists (
          select 1 from public.leads l
          where l.vsl_id = p_vsl_id and l.code = e.session_id
        )
    ),
    'compras', (
      select count(*) from public.sales
      where vsl_id = p_vsl_id and status = 'paid'
    )
  );
$$;
