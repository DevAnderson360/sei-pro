/**
 * Ordem e visibilidade dos painéis do Controle de Processos: a configuração, as
 * regras para normalizá-la e combiná-la com os painéis que existem na página.
 * Sem DOM e sem `chrome`: tudo aqui é função pura.
 */

/** Chave no `chrome.storage.sync`. */
export const CHAVE = 'spro_paineis';

/** O Controle de Processos é a própria tela: não pode ser ocultado. */
export const PROTEGIDOS: readonly string[] = ['processosSEIPro'];

export interface Config {
  v: 1;
  /** Ids na ordem escolhida; os que não constam vão depois, na ordem natural. */
  ordem: string[];
  ocultos: string[];
}

const ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const LIMITE = 50;

const NOMES: Record<string, string> = {
  processosSEIPro: 'Controle de Processos',
  favoritesPro: 'Monitorados',
  atividadesPro: 'Atividades',
  projetosGantt: 'Projetos',
  projetosPro: 'Projetos',
  demandasPro: 'Demandas',
};

export const configVazia = (): Config => ({ v: 1, ordem: [], ocultos: [] });

export const nomeConhecido = (id: string): string | null => NOMES[id] ?? null;

/** Só ids válidos, sem repetição, no máximo `LIMITE`. */
function listaDeIds(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const vistos = new Set<string>();
  for (const item of valor) {
    if (typeof item === 'string' && ID.test(item)) vistos.add(item);
    if (vistos.size >= LIMITE) break;
  }
  return [...vistos];
}

/** Aceita qualquer coisa que venha do armazenamento; o que não presta vira configuração vazia. */
export function normalizar(bruto: unknown): Config {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return configVazia();
  const { ordem, ocultos } = bruto as { ordem?: unknown; ocultos?: unknown };
  return { v: 1, ordem: listaDeIds(ordem), ocultos: listaDeIds(ocultos).filter(id => !PROTEGIDOS.includes(id)) };
}

export const personalizada = (cfg: Config): boolean => cfg.ordem.length > 0 || cfg.ocultos.length > 0;

/** Ids presentes na ordem final: os da configuração primeiro, o resto na ordem em que vieram. */
export function ordenar(presentes: string[], cfg: Config): string[] {
  const existentes = new Set(presentes);
  const salvos = cfg.ordem.filter(id => existentes.has(id));
  const vistos = new Set(salvos);
  return [...salvos, ...presentes.filter(id => !vistos.has(id))];
}

/**
 * Configuração a gravar depois do modal: o que foi mostrado, na ordem escolhida, mais os ids que a
 * página não tem agora (módulo desligado, painel que ainda não montou), para não perder a escolha deles.
 */
export function salvarConfig(anterior: Config, mostrados: string[], ocultos: string[]): Config {
  const naPagina = new Set(mostrados);
  return {
    v: 1,
    ordem: [...mostrados, ...anterior.ordem.filter(id => !naPagina.has(id))],
    ocultos: [...ocultos, ...anterior.ocultos.filter(id => !naPagina.has(id))].filter((id, i, todos) => !PROTEGIDOS.includes(id) && todos.indexOf(id) === i),
  };
}

/** Ponto de partida de quem já ordenava pelo arrastar antigo: `optionsPro.orderPanelHome` do legado. */
export function deLegado(optionsPro: string | null): Config | null {
  if (!optionsPro) return null;
  try {
    const lista = (JSON.parse(optionsPro) as { orderPanelHome?: unknown }).orderPanelHome;
    if (!Array.isArray(lista)) return null;
    const itens = lista
      .filter((i): i is { name: string; index: number } => typeof i?.name === 'string' && Number.isFinite(Number(i?.index)))
      .map(i => ({ name: i.name, index: Number(i.index) }))
      .sort((a, b) => a.index - b.index);
    const ordem = listaDeIds(itens.map(i => i.name));
    return ordem.length ? { v: 1, ordem, ocultos: [] } : null;
  } catch {
    return null;
  }
}

/** Nova lista com o item de `de` levado para `para` (limitado às pontas); não altera a original. */
export function mover<T>(lista: readonly T[], de: number, para: number): T[] {
  if (de < 0 || de >= lista.length) return [...lista];
  const copia = [...lista];
  const [item] = copia.splice(de, 1);
  copia.splice(Math.max(0, Math.min(para, copia.length)), 0, item as T);
  return copia;
}
