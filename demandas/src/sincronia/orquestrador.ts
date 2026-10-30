/**
 * Sincronia por Texto Padrão do lado da aba do SEI (o content script tem a sessão): TRÊS controles por escopo
 * (tabelas `d`, `a`, `h`), cada um com o seu adaptador (`sincronia/textoPadrao.ts`), o seu teto, a sua trava e o seu
 * status, sobre o motor genérico do sei-comum. Uma tabela que falha (o histórico grande demais, o SEI que recusa) não
 * bloqueia as outras: as demandas continuam sincronizando.
 *
 * - "Toda a unidade" (`[_SEIPRO_DEM_UNIDADE_D|A|H]`): lido sempre, mesmo sem consentimento (são as demandas dos
 *   colegas); gravado só depois do aviso único ("Entendi"), que o app pergunta. No recuo de "indisponível" (quem lê
 *   mas não pode alterar) continua lendo. Não há "apagar" para eles: o texto é de todos.
 * - "Só eu" (`[_SEIPRO_DEM_<login>_D|A|H]`): desligado por padrão; liga com o consentimento do diálogo do app (um por
 *   escopo, vale para as três tabelas); "apagar" exclui os três textos e desliga.
 *
 * Puxa ao iniciar, ao ganhar foco (no máximo a cada 2 min) e com pendência; mudança local vai 15 s depois. Uma
 * puxada por vez. O construtor confere que os repositórios são desta unidade e deste usuário: o consentimento de um
 * escopo nunca libera a gravação dos dados de outro.
 */

import type { Area } from "@comum/armazenamento/area";
import { type ArmazemTexto, ControleTextoPadrao } from "@comum/sincronia/controlePagina";
import { type StatusSync, textoDoErro } from "@comum/sincronia/motor";
import { type Travar, type TravarEsperando, travarComLocks, travarEsperando } from "@comum/sincronia/trava";
import { type Faixa, faixaDoTamanho } from "../modelo/alertas";
import { chaveEscopo, escoposDaUnidade } from "../modelo/escopo";
import type { EnvelopeDemandas, Escopo, Tabela, Vis } from "../modelo/tipos";
import type { RepositorioDemandas } from "../repositorio";
import { consentimentoDemandas } from "./consentimento";
import { adaptadorDemandas, chaveStatusTexto } from "./textoPadrao";

export const INTERVALO_PUXAR = 2 * 60_000;
export const TABELAS: readonly Tabela[] = ["d", "a", "h"];
const VISES: readonly Vis[] = ["unidade", "eu"];

export interface DepsSincroniaDemandas {
  host: string;
  login: string;
  nomeUsuario: string;
  unidade: { id: string; sigla: string };
  /** chrome.storage.local: os dados, o status e a cópia do texto inválido. */
  area: Area;
  /** chrome.storage.sync: o consentimento. */
  sync: Area;
  repos: Readonly<Record<Vis, RepositorioDemandas>>;
  /** O armazém do núcleo para o texto de cada escopo e tabela (criado só na primeira rodada). */
  armazem(vis: Vis, tabela: Tabela): ArmazemTexto;
  travar: Travar;
  /** A mesma trava, esperando a vez: o "apagar" do pessoal nunca é pulado por uma rodada em curso. */
  travarEsperando: TravarEsperando;
  atrasoEnvio?: number;
}

export type ResultadoSincronizar = Record<Vis, Record<Tabela, StatusSync> | null>;

/** O que um texto devolve ao "Sincronizar agora" quando nem chegou a rodar (o motivo vai na mensagem). */
function statusDaFalha(e: unknown): StatusSync {
  const t = textoDoErro(e);
  return { estado: t.estado, mensagem: t.mensagem, quando: Date.now(), pendente: false };
}

/** Roda e devolve o status; o que lança (também de forma síncrona) vira o status de erro. */
async function semLancar<T extends StatusSync | null>(f: () => Promise<T>): Promise<T | StatusSync> {
  try {
    return await f();
  } catch (e) {
    return statusDaFalha(e);
  }
}

const chaveControle = (vis: Vis, tabela: Tabela): string => `${vis}:${tabela}`;

export class SincroniaDemandas {
  private readonly controles: Record<Vis, Record<Tabela, ControleTextoPadrao<EnvelopeDemandas>>>;
  /** Os textos cujo `iniciar` falhou (`vis:tabela`): o foco seguinte tenta de novo. */
  private readonly naoIniciados = new Set<string>();
  /** A puxada em curso (uma por vez). */
  private puxando: Promise<void> | null = null;
  /** `parar()` foi chamado: o foco não religa o que não iniciou. */
  private parado = false;

  constructor(private readonly d: DepsSincroniaDemandas) {
    const esperado = escoposDaUnidade(d.host, d.login, d.unidade.id);
    for (const vis of VISES)
      if (chaveEscopo(d.repos[vis].escopo) !== chaveEscopo(esperado[vis]))
        throw new Error(`Sincronia da aba: o repositório de "${vis}" não é desta unidade e deste usuário.`);
    const controle = (vis: Vis, tabela: Tabela) =>
      new ControleTextoPadrao<EnvelopeDemandas>({
        area: d.area,
        adaptador: adaptadorDemandas({ repo: d.repos[vis], area: d.area, tabela, sigla: d.unidade.sigla, nomeUsuario: d.nomeUsuario }),
        armazem: () => d.armazem(vis, tabela),
        consentimento: this.consentimento(vis),
        aoMudarLocal: (cb) => d.repos[vis].aoMudar(cb),
        travar: d.travar,
        travarEsperando: d.travarEsperando,
        atrasoEnvio: d.atrasoEnvio,
        intervaloPuxar: INTERVALO_PUXAR,
        // O texto da unidade é de todos: conferência na gravação; até 3 tentativas por rodada.
        releituras: 3,
        lerSemConsentimento: vis === "unidade",
        lerNoRecuo: vis === "unidade",
      });
    const tabelas = (vis: Vis) =>
      Object.fromEntries(TABELAS.map((t) => [t, controle(vis, t)])) as Record<Tabela, ControleTextoPadrao<EnvelopeDemandas>>;
    this.controles = { unidade: tabelas("unidade"), eu: tabelas("eu") };
  }

  consentimento(vis: Vis) {
    return consentimentoDemandas(this.d.sync, this.d.host, this.d.login, this.d.unidade.id, vis);
  }

  private todos(): Array<{ vis: Vis; tabela: Tabela }> {
    return VISES.flatMap((vis) => TABELAS.map((tabela) => ({ vis, tabela })));
  }

  /**
   * `puxar`: ler já; sem ele, só com pendência de uma carga anterior. Nunca rejeita: o texto que não inicia fica
   * parado até a próxima carga (o "Sincronizar agora" ainda roda) e os outros seguem.
   */
  async iniciar(o: { puxar: boolean }): Promise<void> {
    this.parado = false;
    await Promise.all(this.todos().map(({ vis, tabela }) => this.iniciarTexto(vis, tabela, o)));
  }

  /** Inicia um texto; o que falha fica em `naoIniciados` (o foco tenta de novo). Nunca rejeita. */
  private async iniciarTexto(vis: Vis, tabela: Tabela, o: { puxar: boolean }): Promise<void> {
    try {
      await this.controles[vis][tabela].iniciar(o);
      this.naoIniciados.delete(chaveControle(vis, tabela));
    } catch (e) {
      this.naoIniciados.add(chaveControle(vis, tabela));
      console.warn(`[SEI Pro] demandas: a sincronia do texto "${vis}/${tabela}" não iniciou:`, e);
    }
  }

  /**
   * A aba ganhou foco: puxa os ligados, respeitando os 2 min (um que falha não segura os outros); o texto que não
   * iniciou tenta iniciar de novo, já puxando. Uma puxada por vez: a chamada que chega com outra em curso espera a mesma.
   */
  puxar(): Promise<void> {
    this.puxando ??= this.puxarUmaVez().finally(() => {
      this.puxando = null;
    });
    return this.puxando;
  }

  private async puxarUmaVez(): Promise<void> {
    await Promise.all(
      this.todos().map(async ({ vis, tabela }) => {
        if (this.naoIniciados.has(chaveControle(vis, tabela))) {
          if (!this.parado) await this.iniciarTexto(vis, tabela, { puxar: true });
          return;
        }
        await semLancar(() => this.controles[vis][tabela].puxar());
      }),
    );
  }

  /**
   * "Sincronizar agora" (RPC do app): a unidade sempre; o pessoal só se ligado. Nunca rejeita: cada texto devolve
   * o seu status, e o que não rodou volta em erro com o motivo. Uma tabela que falha não derruba as outras.
   */
  async agora(): Promise<ResultadoSincronizar> {
    const rodar = async (vis: Vis): Promise<Record<Tabela, StatusSync>> => {
      const feitos = await Promise.all(TABELAS.map(async (t) => [t, await semLancar(() => this.controles[vis][t].agora())] as const));
      return Object.fromEntries(feitos) as Record<Tabela, StatusSync>;
    };
    const unidade = await rodar("unidade");
    let eu: Record<Tabela, StatusSync> | null;
    try {
      eu = (await this.consentimento("eu").estado()) === "ligado" ? await rodar("eu") : null;
    } catch (e) {
      const falha = statusDaFalha(e);
      eu = { d: falha, a: falha, h: falha };
    }
    return { unidade, eu };
  }

  /** "Desligar e apagar do SEI" (RPC do app): só os textos pessoais. Os da unidade são de todos. */
  async apagarPessoal(): Promise<boolean> {
    const r = await Promise.all(TABELAS.map((t) => this.controles.eu[t].apagar()));
    return r.some(Boolean);
  }

  parar(): void {
    this.parado = true;
    for (const { vis, tabela } of this.todos()) this.controles[vis][tabela].parar();
  }
}

export interface DepsLigarSincronia {
  ctx: { host: string; login: string; nome?: string };
  unidade: { id: string; sigla: string };
  area: Area;
  sync: Area;
  repos: Readonly<Record<Vis, RepositorioDemandas>>;
  armazem(vis: Vis, tabela: Tabela): ArmazemTexto;
  /** A janela (foco) e o documento (visibilidade) da aba. */
  janela: Pick<EventTarget, "addEventListener">;
  doc: Pick<EventTarget, "addEventListener"> & { readonly visibilityState: DocumentVisibilityState };
  atrasoEnvio?: number;
  /** Ler o SEI ao abrir e ao ganhar foco. Padrão: sim. Nas outras telas de topo, não: só o que mudou aqui vai ao SEI. */
  puxar?: boolean;
  /** A tela tem o item "Textos Padrão" no menu? Se não tem, a sincronia não liga (null). */
  temArmazem?: () => boolean;
}

/**
 * O main.ts do content script: os textos desta unidade, lidos e gravados por esta aba. null se não montou; nada
 * daqui lança nem deixa rejeição solta.
 */
export function ligarSincronia(d: DepsLigarSincronia): SincroniaDemandas | null {
  if (d.temArmazem && !d.temArmazem()) return null;
  let s: SincroniaDemandas;
  try {
    s = new SincroniaDemandas({
      host: d.ctx.host,
      login: d.ctx.login,
      nomeUsuario: d.ctx.nome || d.ctx.login,
      unidade: d.unidade,
      area: d.area,
      sync: d.sync,
      repos: d.repos,
      armazem: d.armazem,
      travar: travarComLocks,
      travarEsperando,
      atrasoEnvio: d.atrasoEnvio,
    });
  } catch (e) {
    console.warn("[SEI Pro] demandas: a sincronia não foi ligada:", e);
    return null;
  }
  const puxarJa = d.puxar ?? true;
  void s.iniciar({ puxar: puxarJa }).catch((e) => console.warn("[SEI Pro] demandas: sincronia", e));
  if (!puxarJa) return s;
  const puxar = () => void s.puxar().catch(() => undefined);
  d.janela.addEventListener("focus", puxar);
  d.doc.addEventListener("visibilitychange", () => {
    if (d.doc.visibilityState === "visible") puxar();
  });
  return s;
}

export interface EstadoTabela {
  vis: Vis;
  tabela: Tabela;
  status?: StatusSync;
  bytes?: number;
  faixa: Faixa;
  percentual: number;
}

/** O que o app mostra: o último status de cada texto e a faixa de tamanho (lê só o storage.local, sem rede). */
export async function estadoDasTabelas(area: Area, escopos: ReadonlyArray<Escopo>): Promise<EstadoTabela[]> {
  const chaves = escopos.flatMap((e) => TABELAS.map((t) => ({ e, t, k: chaveStatusTexto(e, t) })));
  const lido = await area.obter(chaves.map((c) => c.k));
  return chaves.map(({ e, t, k }) => {
    const status = lido[k] as StatusSync | undefined;
    const { faixa, percentual } = faixaDoTamanho(status?.tamanho);
    return {
      vis: e.vis,
      tabela: t,
      ...(status ? { status } : {}),
      ...(status?.tamanho !== undefined ? { bytes: status.tamanho } : {}),
      faixa,
      percentual,
    };
  });
}
