/**
 * Leitura e gravacao do dataValues no chrome.storage.sync. O formato e o do
 * legado: JSON.stringify([...perfis, { configGeral: [...] }]), tudo numa chave so.
 */
import type { ItemConfig } from "./config";

/** Limite do navegador para UM item do storage.sync (8 KB); toda a config vai numa chave so. */
export const LIMITE_ITEM_SYNC = 8192;

export type Perfil = Record<string, string>;
export interface Dados {
  perfis: Perfil[];
  config: ItemConfig[];
}

export function serializar(d: Dados): string {
  return JSON.stringify([...d.perfis, { configGeral: d.config }]);
}

/** Um item de configGeral so vale como {name: string, value: boolean | string | number}; o resto (null, objeto, sem valor) e descartado. */
function itemValido(i: unknown): i is ItemConfig {
  if (!i || typeof i !== "object") return false;
  const { name, value } = i as Record<string, unknown>;
  return typeof name === "string" && ["boolean", "string", "number"].includes(typeof value);
}

/** Nunca lanca: dado ausente, corrompido ou de outra forma vira "sem nada gravado". */
export function interpretar(texto: string): Dados {
  const vazio: Dados = { perfis: [], config: [] };
  if (!texto) return vazio;
  let lista: unknown;
  try {
    lista = JSON.parse(texto);
  } catch {
    return vazio;
  }
  if (!Array.isArray(lista)) return vazio;
  const objetos = lista.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
  const perfis = objetos.filter((x) => !!x.baseName) as Perfil[];
  const comConfig = objetos.find((x) => Array.isArray(x.configGeral));
  const itens = Array.isArray(comConfig?.configGeral) ? (comConfig.configGeral as unknown[]) : [];
  return { perfis, config: itens.filter(itemValido) };
}

export function medirEspaco(texto: string): { tamanho: number; estado: "ok" | "perto" | "estoura" } {
  const tamanho = new TextEncoder().encode(texto).length;
  if (tamanho > LIMITE_ITEM_SYNC) return { tamanho, estado: "estoura" };
  if (tamanho > LIMITE_ITEM_SYNC * 0.8) return { tamanho, estado: "perto" };
  return { tamanho, estado: "ok" };
}

export const mensagemEstouro = (tamanho: number): string =>
  `As configurações passaram do espaço que o navegador reserva para sincronizá-las (${tamanho} de ${LIMITE_ITEM_SYNC} bytes). Remova uma base de dados que não use e salve de novo.`;

export interface ApiSync {
  runtime: { lastError?: { message?: string } };
  storage: {
    sync: {
      get(chaves: Record<string, unknown>, cb: (itens: Record<string, unknown>) => void): void;
      set(itens: Record<string, unknown>, cb: () => void): void;
    };
  };
}

export interface Armazem {
  obter(): Promise<string>;
  gravar(texto: string): Promise<void>;
}

/** O erro do navegador (cota, limite de escritas por hora) so aparece em lastError: sem olhar, a pagina dizia "salvo" sem ter salvo. */
export function armazemSync(api: ApiSync): Armazem {
  return {
    obter: () => new Promise((ok) => api.storage.sync.get({ dataValues: "" }, (i) => ok(String(i.dataValues ?? "")))),
    gravar: (texto) =>
      new Promise((ok, falhou) =>
        api.storage.sync.set({ dataValues: texto }, () => {
          const erro = api.runtime.lastError;
          if (erro) falhou(new Error(erro.message ?? "erro desconhecido"));
          else ok();
        }),
      ),
  };
}

export function normalizarArquivo(texto: string): string {
  try {
    return JSON.stringify(JSON.parse(texto));
  } catch {
    throw new Error("Arquivo invalido");
  }
}

export function baixarTexto(texto: string, nome = "config.json"): void {
  const url = URL.createObjectURL(new Blob([texto], { type: "application/json;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.style.visibility = "hidden";
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
