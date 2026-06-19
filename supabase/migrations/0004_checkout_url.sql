-- ============================================================
-- Migration 0004 — link de checkout completo (cola da Hotmart)
-- ============================================================
-- Em vez de montar a URL a partir do Product ID, o usuário cola o
-- link de pagamento direto da Hotmart. O botão CTA usa este link
-- (com UTMs + session_id acrescentados em runtime).
alter table public.vsls
  add column if not exists checkout_url text;
