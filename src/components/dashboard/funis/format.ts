/**
 * Formatos dos cartões de Meus funis (lista no estilo da Inlead, pedido do
 * Luca em 28/11): iniciais do avatar, números compactos e "Editado há…".
 */

const LOCALE = "pt-BR";
const exact = new Intl.NumberFormat(LOCALE);
const oneDecimal = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const fullDate = new Intl.DateTimeFormat(LOCALE, { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" });

/** "SDB🍓 - Segredo das Bolsas" → "SS"; "ADR🎨 - Arte da Resina" → "AA". */
export function funnelInitials(name: string): string {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  const letters = words.slice(0, 2).map(word => word[0].toLocaleUpperCase(LOCALE));
  return letters.join("") || "?";
}

/** 950 → "950"; 13 712 → "13,7k"; 2 450 000 → "2,5mi". */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs < 1000) return exact.format(value);
  const units: [number, string][] = [[1e9, "bi"], [1e6, "mi"], [1e3, "k"]];
  for (let i = 0; i < units.length; i++) {
    const [size, suffix] = units[i];
    if (abs < size) continue;
    const scaled = value / size;
    const rounded = Math.abs(scaled) >= 100 ? Math.round(scaled) : Math.round(scaled * 10) / 10;
    // 999 950 arredonda para "1000k": sobe para a unidade de cima.
    if (Math.abs(rounded) >= 1000 && i > 0) return `${oneDecimal.format(rounded / 1000)}${units[i - 1][1]}`;
    return `${oneDecimal.format(rounded)}${suffix}`;
  }
  return exact.format(value);
}

export function exactNumber(value: number): string {
  return exact.format(value);
}

/** Data completa para a dica do "Editado há…". */
export function fullDateLabel(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : fullDate.format(date);
}

/** "há cerca de 3 horas", "há 2 dias" (mesma escala da Inlead). */
export function editedAgo(timestamp: string, now: number): string {
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return "sem data";
  const seconds = Math.max(0, (now - time) / 1000);
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;
  const months = days / 30;
  if (seconds < 45) return "agora há pouco";
  if (seconds < 90) return "há 1 minuto";
  if (minutes < 45) return `há ${Math.round(minutes)} minutos`;
  if (minutes < 90) return "há cerca de 1 hora";
  if (hours < 24) return `há cerca de ${Math.round(hours)} horas`;
  if (hours < 42) return "há 1 dia";
  if (days < 30) return `há ${Math.round(days)} dias`;
  if (days < 45) return "há cerca de 1 mês";
  if (months < 12) return `há ${Math.round(months)} meses`;
  const years = Math.floor(months / 12);
  return years <= 1 ? "há cerca de 1 ano" : `há cerca de ${years} anos`;
}
