/**
 * O estado da sincronia que o app mostra ao lado das abas (P3:
 * `ProvedorSincronia`) e no diálogo "Sincronização": junta o status dos dois
 * Textos Padrão (gravado pelo content script), o consentimento de cada um, o
 * relatório da última leitura (relógio atrasado) e a cópia de um texto
 * inválido que foi substituído. Lê do armazenamento e se refaz a cada mudança.
 *
 * Calmo quando não há o que fazer: "indisponível" (sem Textos Padrão, ou só
 * com o link de consultar) é "neste navegador", com o motivo na dica, mesmo
 * que o motor tenha marcado pendente por ter mesclado o que um colega gravou;
 * desistir porque um colega gravava ao mesmo tempo é "pendente". As mensagens
 * do status (inclusive a da memória do sigilo ilegível) vão como texto, na dica.
 */

import type { Area } from "@comum/armazenamento/area";
import { type EstadoConsentimento, lerConsentimento } from "@comum/sincronia/consentimento";
import type { StatusSync } from "@comum/sincronia/motor";
import type { Escopo, Vis } from "../../modelo/tipos";
import { CHAVE_CONSENTIMENTO, chaveDoConsentimento } from "../../sincronia/consentimento";
import {
  chaveRelatorio,
  chaveStatusTexto,
  chaveSubstituido,
  MENSAGEM_MUDOU,
  nomeDoTexto,
  type RelatorioImportacao,
  type TextoSubstituido,
} from "../../sincronia/textoPadrao";
import { plural } from "../formato";
import type { EstadoSincronia, ProvedorSincronia, TomSincronia } from "../sincronia";

export interface SituacaoTexto {
  vis: Vis;
  nome: string;
  consentimento: EstadoConsentimento;
  status?: StatusSync;
  relatorio?: RelatorioImportacao;
  substituido?: TextoSubstituido;
}

export type SituacaoSincronia = Record<Vis, SituacaoTexto>;

function haQuanto(ms: number, agora: number): string {
  const min = Math.max(0, Math.round((agora - ms) / 60_000));
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return `há ${plural(Math.round(min / 1440), "dia", "dias")}`;
}

/**
 * O relógio daqui atrasado recusa o que foi gravado em outro lugar (carimbo mais de 1 dia "no futuro"): no
 * texto da unidade, pelos colegas; no pessoal, pelo próprio usuário em outro computador.
 */
export function avisoDoRelogio(r: RelatorioImportacao | undefined, vis: Vis = "unidade"): string | null {
  if (!r?.futuros) return null;
  const quais =
    vis === "unidade"
      ? plural(r.futuros, "alteração dos colegas ficou", "alterações dos colegas ficaram")
      : plural(r.futuros, "alteração feita em outro computador ficou", "alterações feitas em outro computador ficaram");
  return `O relógio deste computador parece atrasado: ${quais} de fora. Acerte a data e a hora do computador.`;
}

/** A linha de situação de um texto ("Sincronizado há 2 min", "Erro: …"), para a dica e o diálogo. */
export function linhaDoTexto(t: SituacaoTexto, agora: number): string {
  const st = t.status;
  const relogio = avisoDoRelogio(t.relatorio, t.vis);
  const com = (s: string) => (relogio ? `${s} ${relogio}` : s);
  if (t.vis === "eu" && t.consentimento !== "ligado") return "Desligado: os projetos de “Só eu” ficam neste navegador.";
  // O relógio atrasado deixa o indicador em "erro" em qualquer situação: a linha sempre diz por quê.
  if (st?.aguardandoPermissao) return com("Há alterações esperando o seu “Entendi” para ir ao SEI.");
  if (!st || st.estado === "nunca")
    return com(t.vis === "unidade" ? "Ainda não lido nesta unidade." : "Ligado: falta abrir o Controle de Processos.");
  // No recuo, a pendência (inclusive a que só veio de mesclar o que um colega gravou) espera: não aparece.
  if (st.estado === "indisponivel") return com(st.mensagem ?? "Indisponível nesta unidade.");
  if (st.estado === "erro") {
    if (st.mensagem === MENSAGEM_MUDOU) return com("Um colega gravou ao mesmo tempo; nova tentativa em instantes.");
    return com(`Erro: ${st.mensagem ?? "tente de novo"}`);
  }
  const quando = haQuanto(st.ultimoOk ?? st.quando, agora);
  return com(`Sincronizado ${quando}${st.pendente ? " · alterações a enviar" : ""}${st.mensagem ? ` · ${st.mensagem}` : ""}`);
}

const PESO: Record<TomSincronia, number> = { local: 0, ok: 1, pendente: 2, erro: 3 };

function tomDoTexto(t: SituacaoTexto): TomSincronia {
  const st = t.status;
  if (t.vis === "eu" && t.consentimento !== "ligado") return "local";
  if (avisoDoRelogio(t.relatorio)) return "erro";
  if (st?.aguardandoPermissao) return "pendente";
  if (!st || st.estado === "nunca" || st.estado === "indisponivel") return "local";
  // Desistir porque um colega gravava ao mesmo tempo não é erro: a nova tentativa já está armada.
  if (st.estado === "erro") return st.mensagem === MENSAGEM_MUDOU ? "pendente" : "erro";
  return st.pendente ? "pendente" : "ok";
}

const ROTULO: Record<TomSincronia, string> = { local: "neste navegador", ok: "sincronizado", pendente: "pendente", erro: "erro" };

export function estadoDaSincronia(s: SituacaoSincronia, agora: number): EstadoSincronia {
  const tons = [tomDoTexto(s.unidade), tomDoTexto(s.eu)];
  const tom = tons.reduce((a, b) => (PESO[b] > PESO[a] ? b : a), "local" as TomSincronia);
  const unidade = `Toda a unidade: ${linhaDoTexto(s.unidade, agora)}`;
  const eu = `Só eu: ${linhaDoTexto(s.eu, agora)}`;
  // Tudo neste navegador: o pessoal desligado não acrescenta nada à primeira frase.
  const dica =
    tom === "local"
      ? ["Os projetos ficam guardados neste navegador.", unidade, ...(s.eu.consentimento === "ligado" ? [eu] : [])].join("\n")
      : `${unidade}\n${eu}`;
  return { rotulo: ROTULO[tom], dica, tom };
}

const ESTADOS: ReadonlySet<unknown> = new Set(["ok", "erro", "indisponivel", "nunca"]);
const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const numero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** O status gravado pelo content script, ou nada se a forma não confere (a dica nunca mostra "NaN"). */
function comoStatus(v: unknown): StatusSync | undefined {
  if (!objeto(v) || !ESTADOS.has(v.estado) || !numero(v.quando)) return undefined;
  const st = v as unknown as StatusSync;
  return typeof st.mensagem === "string" || st.mensagem === undefined ? st : { ...st, mensagem: undefined };
}

function comoRelatorio(v: unknown): RelatorioImportacao | undefined {
  return objeto(v) && numero(v.futuros) && numero(v.quando) ? (v as unknown as RelatorioImportacao) : undefined;
}

function comoSubstituido(v: unknown): TextoSubstituido | undefined {
  return objeto(v) && typeof v.html === "string" && typeof v.motivo === "string" && numero(v.quando)
    ? (v as unknown as TextoSubstituido)
    : undefined;
}

export interface DepsEstado {
  /** chrome.storage.local: status, relatório, texto substituído. */
  area: Area;
  /** chrome.storage.sync: consentimentos. */
  sync: Area;
  escopos: Readonly<Record<Vis, Escopo>>;
  agora?: () => number;
}

/** O provedor do app: lê tudo uma vez, guarda, e relê quando uma das chaves muda. */
export class EstadoDaSincronia implements ProvedorSincronia {
  private atual: SituacaoSincronia;
  private readonly ouvintes = new Set<() => void>();
  private paradas: Array<() => void> = [];
  /** Uma leitura por vez: uma leitura lenta, começada antes, não termina por cima de uma mais nova. */
  private fila: Promise<unknown> = Promise.resolve();

  constructor(private readonly d: DepsEstado) {
    const vazio = (vis: Vis): SituacaoTexto => ({ vis, nome: nomeDoTexto(vis, d.escopos[vis].login), consentimento: "nao-perguntado" });
    this.atual = { unidade: vazio("unidade"), eu: vazio("eu") };
  }

  private chaves(vis: Vis): [string, string, string] {
    const e = this.d.escopos[vis];
    return [chaveStatusTexto(e), chaveRelatorio(e), chaveSubstituido(e)];
  }

  /** Os ouvintes entram ANTES da primeira leitura: o que mudar no meio dela entra na fila e é relido depois. */
  async iniciar(): Promise<void> {
    const locais = new Set([...this.chaves("unidade"), ...this.chaves("eu")]);
    this.paradas.push(
      this.d.area.aoMudar((m) => {
        if (Object.keys(m).some((k) => locais.has(k))) this.reler();
      }),
      this.d.sync.aoMudar((m) => {
        if (CHAVE_CONSENTIMENTO in m) this.reler();
      }),
    );
    await this.ler();
  }

  parar(): void {
    for (const p of this.paradas.splice(0)) p();
    this.ouvintes.clear();
  }

  private reler(): void {
    void this.ler().catch(() => undefined);
  }

  /** Relê tudo (o diálogo chama depois de "Sincronizar agora"). O que não pôde ser lido fica como estava. */
  ler(): Promise<SituacaoSincronia> {
    const vez = this.fila.then(() => this.lerAgora());
    this.fila = vez.catch(() => undefined);
    return vez;
  }

  private async lerAgora(): Promise<SituacaoSincronia> {
    const de = async (vis: Vis): Promise<SituacaoTexto> => {
      const e = this.d.escopos[vis];
      const antes = this.atual[vis];
      const [kStatus, kRel, kSub] = this.chaves(vis);
      let v: Record<string, unknown> | null = null;
      try {
        v = await this.d.area.obter([kStatus, kRel, kSub]);
      } catch {
        // storage.local recusou a leitura: o indicador fica com o que já mostrava.
      }
      let consentimento = antes.consentimento;
      try {
        consentimento = await lerConsentimento(
          this.d.sync,
          CHAVE_CONSENTIMENTO,
          "textoPadrao",
          chaveDoConsentimento(e.host, e.login, e.unidade, vis),
        );
      } catch {
        // storage.sync fora do ar: idem.
      }
      return {
        vis,
        nome: nomeDoTexto(vis, e.login),
        consentimento,
        status: v ? comoStatus(v[kStatus]) : antes.status,
        relatorio: v ? comoRelatorio(v[kRel]) : antes.relatorio,
        substituido: v ? comoSubstituido(v[kSub]) : antes.substituido,
      };
    };
    this.atual = { unidade: await de("unidade"), eu: await de("eu") };
    for (const o of [...this.ouvintes]) o();
    return this.atual;
  }

  situacao(): SituacaoSincronia {
    return this.atual;
  }

  estado(): EstadoSincronia {
    return estadoDaSincronia(this.atual, this.d.agora?.() ?? Date.now());
  }

  aoMudar(cb: () => void): () => void {
    this.ouvintes.add(cb);
    return () => {
      this.ouvintes.delete(cb);
    };
  }
}
