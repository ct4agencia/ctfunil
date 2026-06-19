-- ============================================================
-- Seed — página original "A Arte da Resina"
-- Rode DEPOIS da migration 0002 (campo domain).
-- ============================================================
insert into public.vsls (
  slug, name, niche, status, domain,
  hotmart_product_id, hotmart_src,
  vturb_player_id, vturb_account_id,
  pitch_reveal_at, vagas_reveal_at,
  vagas_inicial, vagas_limite, vagas_total,
  primary_color, cta_keep_green,
  content
) values (
  'arte-da-resina',
  'A Arte da Resina',
  'Artesanato / Resina',
  'published',
  'artedaresina.com.br',
  null,                                   -- Hotmart Product ID (era placeholder no standalone)
  null,                                   -- src
  '6a0246f09ca1e0db9a69d11b',             -- VTurb Player ID
  '827477fe-fc01-4a51-a859-9c6a01400394', -- VTurb Account ID
  919,                                    -- pitch_reveal_at
  891,                                    -- vagas_reveal_at
  37, 48, 50,                             -- vagas inicial / limite / total
  '#0284c7',                              -- cor primária (azul)
  true,                                   -- CTA verde
  '{
    "cta_text": "QUERO A VAGA COM DESCONTO",
    "guarantee_headline": "FIQUE 100% SATISFEITA OU PEÇA SEU DINHEIRO DE VOLTA!",
    "guarantee_intro": "CONFIO TANTO NA QUALIDADE DA ARTE DA RESINA QUE VOU TE DAR 7 DIAS PARA EXPERIMENTAR",
    "guarantee_body": "Você terá 7 dias para assistir todas as aulas e bônus!",
    "guarantee_chip": "Garantia de 7 dias — risco zero para você testar",
    "vagas_suffix": "PROMOCIONAIS JÁ FORAM GARANTIDAS...",
    "copyright_name": "A Arte da Resina®"
  }'::jsonb
)
on conflict (slug) do nothing;
