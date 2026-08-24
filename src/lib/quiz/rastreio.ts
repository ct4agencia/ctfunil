"use client";

/**
 * Leva o rastreio da página para o destino externo (checkout, upsell).
 *
 * O PROBLEMA QUE ISTO RESOLVE
 * A UTMify reescreve o `href` dos LINKS da página para anexar utm_source,
 * xcod, sck e companhia — é assim que ela liga a visita à venda. Mas os botões
 * do funil não são links: são `<button>` que chamam `navigate(url)`. A UTMify
 * não tem o que reescrever, e a pessoa chegava na Hotmart com a URL nua:
 *
 *   entrada:  /vdc1?utm_source=FB&utm_campaign=002…&xcod=FBhQwK21wXxR…
 *   checkout: pay.hotmart.com/I107282216S?checkoutMode=10&src=vdc01
 *                                                          ↑ tudo perdido
 *
 * Sem esses parâmetros a venda chega sem dono: a UTMify não casa com a sessão,
 * o Meta não recebe a conversão, e a campanha otimiza no escuro pagando por
 * cliques que nunca aprende a avaliar.
 *
 * QUAIS PARÂMETROS
 * Os de campanha (`utm_*`), os de clique das plataformas (`fbclid`, `gclid`,
 * `ttclid`) e os que a Hotmart devolve para a UTMify (`sck`, `xcod`, `src`).
 * Lista fechada, não "tudo que estiver na URL": repassar parâmetro desconhecido
 * para domínio de terceiro é vazar dado sem motivo.
 */

const PARAMS_RASTREIO = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id",
  "xcod", "sck", "src",
  "fbclid", "gclid", "ttclid", "ctwa_clid", "source_id",
];

/**
 * `destino` com o rastreio da página atual anexado.
 *
 * O que JÁ existe no destino vence: um `src` escrito à mão no botão é escolha
 * de quem montou o funil, e sobrescrevê-lo com o da URL desfaria essa
 * configuração pelas costas.
 *
 * Fora do navegador (SSR) devolve o destino intacto — não há URL de onde ler.
 */
export function comRastreio(destino: string): string {
  if (typeof window === "undefined" || !destino) return destino;
  try {
    // só destinos absolutos: navegação interna não precisa e sujaria a URL
    if (!/^https?:\/\//i.test(destino)) return destino;

    const atual = new URLSearchParams(window.location.search);
    const url = new URL(destino);

    for (const chave of PARAMS_RASTREIO) {
      const valor = atual.get(chave);
      if (valor && !url.searchParams.has(chave)) url.searchParams.set(chave, valor);
    }
    return url.toString();
  } catch {
    /* URL malformada: seguir para o destino cru é melhor do que travar o
       clique de compra por causa de um parâmetro. */
    return destino;
  }
}
