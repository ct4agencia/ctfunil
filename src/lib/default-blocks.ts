import { DEFAULT_CONTENT, type Block, type Vsl, type VslContent } from "@/lib/types";

/**
 * Gera os blocos iniciais a partir da configuração do Conteúdo da VSL,
 * espelhando o layout padrão (vídeo → CTA → garantia → rodapé).
 * O usuário pode então reordenar/editar/remover livremente.
 */
export function buildDefaultBlocks(
  vsl: Vsl,
  genId: () => string,
): Block[] {
  const c: Required<VslContent> = {
    ...DEFAULT_CONTENT,
    ...((vsl.content ?? {}) as VslContent),
  };
  const pitch = vsl.pitch_reveal_at ?? 0;
  const imgGarantia = vsl.img_garantia || "/images/Garantia1.webp";
  const imgPagamentos = vsl.img_pagamentos || "/images/Pagamentos1.png";
  const imgSelo = vsl.img_selo || "/images/Selogoogle1.png";

  const b = (type: Block["type"], props: Record<string, unknown>): Block => ({
    id: genId(),
    type,
    enabled: true,
    props,
  });

  const cta = () =>
    b("button", {
      label: c.cta_text,
      linkType: "checkout",
      url: "",
      bgColor: "",
      textColor: "#ffffff",
      align: "center",
      radius: 16,
      revealAfter: pitch,
      pulse: true,
      shine: true,
      componentId: "",
    });

  return [
    b("vagas", {
      mode: "escassez",
      inicial: vsl.vagas_inicial ?? 37,
      limite: vsl.vagas_limite ?? 48,
      total: vsl.vagas_total ?? 50,
      suffix: c.vagas_suffix,
      intervalMs: 15000,
      bgColor: "",
      textColor: "",
      numberColor: "",
      revealAfter: vsl.vagas_reveal_at ?? 0,
    }),
    b("video", { maxWidth: 400 }),
    cta(),
    b("image", { url: imgPagamentos, maxWidth: 280, align: "center", radius: 0, revealAfter: pitch }),
    b("spacer", { height: 24 }),
    b("text", {
      content: c.guarantee_headline,
      fontSize: 24,
      color: "#ffffff",
      align: "center",
      weight: 900,
      maxWidth: 600,
      revealAfter: pitch,
    }),
    b("image", { url: imgGarantia, maxWidth: 220, align: "center", radius: 0, revealAfter: pitch }),
    b("text", {
      content: c.guarantee_intro,
      fontSize: 18,
      color: "#cbd5e1",
      align: "center",
      weight: 800,
      maxWidth: 600,
      revealAfter: pitch,
    }),
    b("text", {
      content: c.guarantee_body,
      fontSize: 15,
      color: "#e2e8f0",
      align: "center",
      weight: 500,
      maxWidth: 600,
      revealAfter: pitch,
    }),
    cta(),
    b("spacer", { height: 32 }),
    b("image", { url: imgSelo, maxWidth: 200, align: "center", radius: 0 }),
    b("text", {
      content: `Copyright ${c.copyright_name} — Todos os direitos reservados.`,
      fontSize: 12,
      color: "#94a3b8",
      align: "center",
      weight: 400,
      maxWidth: 600,
    }),
  ];
}
