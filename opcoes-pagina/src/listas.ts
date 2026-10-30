/**
 * Listas que so o SEI do orgao conhece, gravadas pelo init_db.js em chrome.storage.local (chave `listasSei`, por endereco do SEI)
 * quando o usuario abre um processo. A pagina de opcoes roda isolada do SEI: ela so le o que ja foi guardado.
 */
import type { EscolhaDinamica } from "./config";

export const AVISO_SEM_HIPOTESES = "Abra um processo no SEI para carregar a lista";

const NIVEL_ROTULO: Record<number, string> = { 2: " (Sigiloso)" };

/** Valor guardado em `newdocsigilo`: "id|nivel|rotulo" (o mesmo que o sei-functions-pro.js le). Dado fora do formato e ignorado. */
export function hipotesesDoArmazenamento(bruto: unknown): EscolhaDinamica[] {
  if (!bruto || typeof bruto !== "object") return [];
  const porEndereco = Object.entries(bruto as Record<string, unknown>).filter(([, v]) => v && typeof v === "object");
  const varios = porEndereco.length > 1;
  const saida: EscolhaDinamica[] = [];
  for (const [endereco, v] of porEndereco) {
    const lista = (v as { hipoteses?: unknown }).hipoteses;
    if (!Array.isArray(lista)) continue;
    for (const h of lista) {
      if (!h || typeof h.id !== "string" || typeof h.nome !== "string" || h.id === "" || h.id.includes("|")) continue;
      const nivel = h.nivel === 2 ? 2 : 1;
      const nome = h.nome.replace(/\|/g, "/");
      saida.push({ valor: `${h.id}|${nivel}|${nome}`, rotulo: nome + (NIVEL_ROTULO[nivel] ?? ""), grupo: varios ? endereco : undefined });
    }
  }
  return saida;
}

export interface ApiLocal {
  storage: { local: { get(chaves: Record<string, unknown>, cb: (itens: Record<string, unknown>) => void): void } };
}

export const lerHipoteses = (api: ApiLocal): Promise<EscolhaDinamica[]> =>
  new Promise((ok) => {
    try {
      api.storage.local.get({ listasSei: {} }, (i) => ok(hipotesesDoArmazenamento(i.listasSei)));
    } catch {
      ok([]);
    }
  });
