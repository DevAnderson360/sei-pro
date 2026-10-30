/**
 * O retrato real do Agente neste navegador: ler tudo o que vai ao arquivo e
 * gravar de volta o que a mescla mudou.
 *
 * A mescla (`envelope.ts`) é pura; aqui fica só a leitura e a gravação, atrás
 * de `FontesRetrato`, para o adaptador ser testado com fontes em memória.
 *
 * LEITURA ESTRITA. Os `listar*` do painel devolvem `[]` quando o storage falha
 * e descartam em silêncio o item que o normalizador recusa — bom para a tela,
 * péssimo aqui: a mescla leria "sumiu" como exclusão e deixaria lápide no
 * arquivo, apagando o item em todos os computadores. Por isso o retrato lê o
 * storage cru (`lerListas`): falha do storage ou valor que não é lista
 * derruba a sincronização; item que não passa em `validarItem` fica fora do
 * retrato, mas o id vai em `preservados()` (a mescla não o trata como
 * exclusão) e o item cru volta ao storage quando a lista for regravada.
 *
 * As listas voltam pelas funções `guardar*` de cada armazenamento, que já
 * espelham no `storage.sync` — o que veio do arquivo propaga como qualquer
 * edição. A configuração vai direto ao `chrome.storage.local`: o painel a relê
 * pelo `storage.onChanged`.
 */

import { CHAVE_COLECOES as CHAVE_COLECOES_FLUXOS, guardarColecoesDeFluxos } from "../fluxos/colecao";
import { CHAVE_FLUXOS, CHAVE_IGNORADOS, guardarFluxos, guardarIgnorados, type Ignorados } from "../fluxos/modelo";
import { CHAVE_CONECTORES, guardarConectores } from "../mcp/conectores";
import { CHAVE_CONFIG, configPadrao } from "../painel/config";
import { gravarVarias, todas, type ConversaSalva } from "../painel/historico";
import type { Config } from "../painel/main";
import { CHAVE_MEMORIA, guardarMemoria } from "../painel/memoria";
import { CHAVE_REGRAS, guardarRegras } from "../painel/regras";
import { CHAVE_ROTINAS, guardarRotinas } from "../painel/rotinas";
import { CHAVE_COLECOES, CHAVE_SKILLS, guardarColecoes, guardarSkills } from "../painel/skills";
import { TIPOS, type Diario, type Retrato, type TipoLista } from "./envelope";
import { validarItem } from "./validar";

/** O diário da mescla (o hash de cada registro como foi ao arquivo). Só deste computador. */
export const CHAVE_DIARIO = "agenteIA_arquivoDiario";
/** A caixa "Incluir chave de API e tokens" (boolean). Só deste computador: não vai ao sync nem ao arquivo. */
export const CHAVE_SEGREDOS = "agenteIA_arquivoSegredos";
/** O `StatusArquivo` da última sincronização. */
export const CHAVE_STATUS = "agenteIA_arquivoStatus";

export type Preservados = Partial<Record<TipoLista, string[]>>;

export interface FontesRetrato {
  lerRetrato(): Promise<Retrato>;
  /** Grava o que mudou de `antes` para `depois`. */
  aplicar(antes: Retrato, depois: Retrato): Promise<void>;
  lerDiario(): Promise<Diario>;
  gravarDiario(d: Diario): Promise<void>;
  /** A caixa "Incluir chave de API e tokens" deste computador. */
  segredos(): Promise<boolean>;
  /**
   * Ids que o último `lerRetrato` achou no storage mas deixou de fora por não
   * passarem na validação: não são exclusões.
   */
  preservados?(): Preservados;
}

type ListaSemConversas = Exclude<TipoLista, "conversas">;

export interface Mudancas {
  config: boolean;
  ignorados: boolean;
  /** As listas (fora as conversas) que mudaram. */
  listas: ListaSemConversas[];
  /** Conversas novas ou alteradas, e os ids das que saíram. */
  conversas: { novas: ConversaSalva[]; removidas: string[] };
}

const igual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** O que gravar para o local passar de `antes` a `depois`. */
export function mudancas(antes: Retrato, depois: Retrato): Mudancas {
  const listas = TIPOS.filter((t): t is ListaSemConversas => t !== "conversas" && !igual(antes.listas[t], depois.listas[t]));
  const velhas = new Map(antes.listas.conversas.map((c) => [c.id, c]));
  const ficam = new Set(depois.listas.conversas.map((c) => c.id));
  return {
    config: !igual(antes.config, depois.config),
    ignorados: !igual(antes.ignorados, depois.ignorados),
    listas,
    conversas: {
      novas: depois.listas.conversas.filter((c) => !igual(velhas.get(c.id), c)),
      removidas: [...velhas.keys()].filter((id) => !ficam.has(id)),
    },
  };
}

/** Onde cada lista mora no `chrome.storage.local`. */
export const CHAVES_LISTAS: Record<ListaSemConversas, string> = {
  skills: CHAVE_SKILLS,
  colecoes: CHAVE_COLECOES,
  regras: CHAVE_REGRAS,
  memoria: CHAVE_MEMORIA,
  rotinas: CHAVE_ROTINAS,
  conectores: CHAVE_CONECTORES,
  fluxos: CHAVE_FLUXOS,
  colecoesFluxos: CHAVE_COLECOES_FLUXOS,
};

export interface ListasLidas {
  listas: Omit<Retrato["listas"], "conversas">;
  ignorados: Ignorados;
  /** Ids dos itens crus que não passaram na validação. */
  preservar: Preservados;
  /** Os próprios itens crus recusados, para voltarem ao storage na regravação. */
  recusados: Partial<Record<ListaSemConversas, unknown[]>>;
}

/**
 * As listas a partir do storage cru, sem perdoar nada: valor que existe e não
 * é lista (ou ignorados que não é objeto) lança. Item recusado fica fora,
 * lembrado em `preservar` e `recusados`.
 */
export function lerListas(cru: Record<string, unknown>): ListasLidas {
  const listas = {} as Record<ListaSemConversas, unknown[]>;
  const preservar: Preservados = {};
  const recusados: ListasLidas["recusados"] = {};
  for (const [tipo, chave] of Object.entries(CHAVES_LISTAS) as Array<[ListaSemConversas, string]>) {
    const valor = cru[chave];
    if (valor === undefined) {
      listas[tipo] = [];
      continue;
    }
    if (!Array.isArray(valor)) throw new Error(`${chave} no armazenamento não é uma lista; a sincronização por arquivo parou para não apagar nada.`);
    listas[tipo] = [];
    for (const item of valor) {
      const valido = validarItem(tipo, item);
      if (valido !== null) {
        listas[tipo].push(valido);
        continue;
      }
      (recusados[tipo] ??= []).push(item);
      const id = (item as { id?: unknown } | null)?.id;
      if (typeof id === "string") (preservar[tipo] ??= []).push(id);
    }
  }
  const ign = cru[CHAVE_IGNORADOS];
  if (ign !== undefined && (typeof ign !== "object" || ign === null || Array.isArray(ign)))
    throw new Error(`${CHAVE_IGNORADOS} no armazenamento não é um objeto; a sincronização por arquivo parou para não apagar nada.`);
  return {
    listas: listas as unknown as ListasLidas["listas"],
    ignorados: (ign as Ignorados | undefined) ?? {},
    preservar,
    recusados,
  };
}

const GRAVAR: { [T in ListaSemConversas]: (lista: Retrato["listas"][T]) => Promise<void> } = {
  skills: guardarSkills,
  colecoes: guardarColecoes,
  regras: guardarRegras,
  memoria: guardarMemoria,
  rotinas: guardarRotinas,
  conectores: guardarConectores,
  fluxos: guardarFluxos,
  colecoesFluxos: guardarColecoesDeFluxos,
};

/** As fontes de verdade: `chrome.storage.local` e o histórico no IndexedDB. */
export function fontesDoNavegador(historico: { todas: typeof todas; gravarVarias: typeof gravarVarias } = { todas, gravarVarias }): FontesRetrato {
  // Da última leitura: o que ficou de fora e precisa sobreviver à regravação.
  let ultima: Pick<ListasLidas, "preservar" | "recusados"> = { preservar: {}, recusados: {} };
  return {
    async lerRetrato() {
      // Sem `catch` em nada: storage ou histórico indisponível derruba a
      // sincronização, em vez de parecer "tudo apagado" e virar lápide.
      const cru = await chrome.storage.local.get([CHAVE_CONFIG, CHAVE_IGNORADOS, ...Object.values(CHAVES_LISTAS)]);
      const lidas = lerListas(cru);
      const conversas = await historico.todas();
      ultima = { preservar: lidas.preservar, recusados: lidas.recusados };
      return {
        config: { ...configPadrao(), ...(cru[CHAVE_CONFIG] as Partial<Config> | undefined) },
        ignorados: lidas.ignorados,
        listas: { ...lidas.listas, conversas },
      };
    },
    preservados: () => ultima.preservar,
    async aplicar(antes, depois) {
      const m = mudancas(antes, depois);
      for (const t of m.listas) {
        const lista = depois.listas[t] as unknown[];
        const ids = new Set(lista.map((i) => (i as { id: string }).id));
        // O item cru recusado volta junto, a menos que o arquivo tenha trazido
        // uma versão válida dele (mesmo id).
        const crus = (ultima.recusados[t] ?? []).filter((i) => !ids.has((i as { id?: string } | null)?.id as string));
        // Sempre pelo `guardar*` (tetos, espelho no sync só dos válidos); os
        // crus entram depois, por cima do que ele gravou.
        await (GRAVAR[t] as (l: unknown) => Promise<void>)(lista);
        if (!crus.length) continue;
        const chave = CHAVES_LISTAS[t];
        const gravada = (await chrome.storage.local.get(chave))[chave];
        await chrome.storage.local.set({ [chave]: [...(Array.isArray(gravada) ? gravada : []), ...crus] });
      }
      if (m.ignorados) await guardarIgnorados(depois.ignorados);
      await historico.gravarVarias(m.conversas.novas, m.conversas.removidas);
      if (m.config) await chrome.storage.local.set({ [CHAVE_CONFIG]: depois.config });
    },
    async lerDiario() {
      const d = (await chrome.storage.local.get(CHAVE_DIARIO))[CHAVE_DIARIO] as Diario | undefined;
      return d && typeof d === "object" ? d : {};
    },
    async gravarDiario(d) {
      await chrome.storage.local.set({ [CHAVE_DIARIO]: d });
    },
    async segredos() {
      return (await chrome.storage.local.get(CHAVE_SEGREDOS))[CHAVE_SEGREDOS] === true;
    },
  };
}
