/**
 * Quebra do rótulo das fatias da roleta.
 *
 * POR QUE EXISTE
 * A regra vivia duplicada: `labelLines` no steps.tsx (roleta clássica) e um
 * bloco solto dentro do RoletaInterativa.tsx. As duas cortavam SEMPRE em duas
 * linhas, na metade das palavras, sem olhar quanto espaço a fatia tem:
 *
 *   "Acesso gratuito ao Clube das Bolsas"
 *     → ["Acesso gratuito ao", "Clube das Bolsas"]
 *
 * Dezoito caracteres num espaço que comporta nove — o texto atravessava para a
 * fatia vizinha. Aqui a quebra é pela LARGURA REAL disponível, e o número de
 * linhas sai do texto, não de uma divisão fixa por dois.
 */

/**
 * Largura útil de uma fatia, no raio onde o texto é desenhado.
 *
 * A fatia é um triângulo saindo do centro: quanto mais perto da borda, mais
 * larga. No raio `r` a corda mede `2·r·sen(θ/2)`, com θ = ângulo da fatia.
 * O fator 0.82 é folga — encostar na borda exata faz o texto tocar a linha
 * divisória e parecer invasão mesmo sem ser.
 */
export function larguraDaFatia(fatias: number, raio: number): number {
  const theta = (2 * Math.PI) / Math.max(1, fatias);
  return 2 * raio * Math.sin(theta / 2) * 0.82;
}

/**
 * Quebra `label` em linhas que cabem na fatia.
 *
 * `fontSize` está nas unidades do viewBox da roda (não em px de tela). A média
 * de 0.55·fontSize por caractere vale para as fontes bold usadas aqui; é
 * aproximação de propósito — medir texto de verdade exigiria canvas, e o custo
 * não se paga para um rótulo de cinco palavras.
 *
 * Palavra sozinha maior que a linha NÃO é cortada no meio: fica na própria
 * linha e transborda de leve. Cortar "GRATUITO" em "GRATU-/ITO" é pior do que
 * um pixel invadindo — e existe o tamanho por fatia para resolver esse caso.
 */
export function quebrarRotulo(label: string, fatias: number, raio: number, fontSize: number): string[] {
  const texto = (label || "").trim();
  if (!texto) return [];
  const maxPx = larguraDaFatia(fatias, raio);
  const porChar = fontSize * 0.55;
  const maxChars = Math.max(4, Math.floor(maxPx / porChar));

  const palavras = texto.split(/\s+/);
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (tentativa.length <= maxChars || !atual) atual = tentativa;
    else { linhas.push(atual); atual = p; }
  }
  if (atual) linhas.push(atual);

  // Teto de 3 linhas: acima disso a pilha fica mais alta que a fatia e invade
  // as vizinhas por cima e por baixo — o mesmo defeito, no outro eixo.
  if (linhas.length <= 3) return linhas;
  const cortadas = linhas.slice(0, 3);
  cortadas[2] = `${cortadas[2]}…`;
  return cortadas;
}

/**
 * Rótulo pronto para desenhar: linhas + o tamanho que REALMENTE cabe.
 *
 * Quebrar por largura resolve frase longa, mas não resolve PALAVRA longa: numa
 * roda de 6 fatias cabem ~7 caracteres por linha em `fontSize` 11, e
 * "GRATUITO" tem 8. Medido nos rótulos reais do cdb-insta-roleta, cinco de seis
 * ainda invadiam a fatia vizinha só com a quebra.
 *
 * Então o tamanho cede: encolhe de 0,5 em 0,5 até a maior linha caber, com piso
 * em 6 (abaixo disso não se lê no celular). Quem definiu o tamanho da fatia à
 * mão manda — `respeitarFixo` desliga o encolhimento automático.
 */
export function ajustarRotulo(
  label: string,
  fatias: number,
  raio: number,
  fontSize: number,
  respeitarFixo = false,
): { linhas: string[]; fontSize: number } {
  const larg = larguraDaFatia(fatias, raio);
  let fs = fontSize;
  let linhas = quebrarRotulo(label, fatias, raio, fs);
  if (respeitarFixo) return { linhas, fontSize: fs };

  const cabe = () => {
    const maior = Math.max(0, ...linhas.map((l) => l.length));
    return maior * fs * 0.55 <= larg;
  };
  while (!cabe() && fs > 6) {
    fs = Math.round((fs - 0.5) * 2) / 2;
    linhas = quebrarRotulo(label, fatias, raio, fs);
  }
  return { linhas, fontSize: fs };
}
