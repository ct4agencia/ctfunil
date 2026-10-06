-- ============================================================
-- Migration 0007 — page builder (blocos)
-- ============================================================
-- A página passa a poder ser composta por uma lista ordenada de blocos
-- (texto, imagem, botão, vídeo, espaçador, html). Se vazio ([]), a página
-- cai no layout legado (VslView).
alter table public.vsls
  add column if not exists blocks jsonb not null default '[]'::jsonb;
