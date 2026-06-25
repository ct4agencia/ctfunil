import "server-only";
import { headers } from "next/headers";

/** UF (ISO region) → nome do estado. */
const BR_STATES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso",
  MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina",
  SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

export interface LeadGeo { estado?: string; cidade?: string; uf?: string; pais?: string }

/**
 * Geolocalização do lead a partir dos headers da Vercel (sem API externa).
 * x-vercel-ip-country / -country-region (UF) / -city.
 *
 * ⚠️ Em 4G/dados móveis o IP costuma cair no HUB da operadora — o estado pode
 * vir errado. Por isso o funil deve CONFIRMAR o estado (ver leadGeo no hero +
 * a lâmina de pergunta "Qual seu estado?" que sobrescreve {estado}).
 */
export async function leadGeo(): Promise<LeadGeo> {
  try {
    const h = await headers();
    const pais = h.get("x-vercel-ip-country") || undefined;
    const uf = h.get("x-vercel-ip-country-region") || undefined;
    const cidadeRaw = h.get("x-vercel-ip-city") || undefined;
    const cidade = cidadeRaw ? decodeURIComponent(cidadeRaw) : undefined;
    const estado = uf && pais === "BR" ? BR_STATES[uf.toUpperCase()] : undefined;
    return { estado, cidade, uf: uf || undefined, pais: pais || undefined };
  } catch {
    return {};
  }
}
