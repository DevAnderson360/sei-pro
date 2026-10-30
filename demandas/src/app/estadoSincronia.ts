/**
 * O estado da sincronia que o app mostra (indicador do cabeçalho e diálogo "Sincronização"): o status dos SEIS Textos
 * Padrão (três tabelas, dois escopos), gravado pelo content script, mais o consentimento de cada escopo. O app NUNCA
 * grava isso: só lê do armazenamento e se refaz a cada mudança (`area.aoMudar`). Uma tabela em erro mostra o erro dela
 * e não contamina as outras.
 */

import type { Area } from "@comum/armazenamento/area";
import { type EstadoConsentimento, lerConsentimento } from "@comum/sincronia/consentimento";
import type { StatusSync } from "@comum/sincronia/motor";
import { type Faixa, faixaDoTamanho } from "../modelo/alertas";
import type { Escopo, Tabela, Vis } from "../modelo/tipos";
import { CHAVE_CONSENTIMENTO, chaveDoConsentimento } from "../sincronia/consentimento";
import { TABELAS } from "../sincronia/orquestrador";
import { chaveStatusTexto, chaveSubstituido, MENSAGEM_MUDOU, nomeDoTexto } from "../sincronia/textoPadrao";
import { plural } from "./formato";

/** O texto que estava inválido no SEI e foi regravado (o motor guarda a cópia no storage.local). */
export interface TextoSubstituido {
  quando: number;
  motivo: string;
  html: string;
  cortado?: boolean;
}

export type TomSincronia = "local" | "ok" | "pendente" | "erro";

export interface SituacaoTabela {
  vis: Vis;
  tabela: Tabela;
  /** O nome do Texto Padrão no SEI. */
  nome: string;
  status?: StatusSync;
  bytes?: number;
  percentual: number;
  faixa: Faixa;
  substituido?: TextoSubstituido;
}

export interface SituacaoEscopo {
  vis: Vis;
  consentimento: EstadoConsentimento;
  tabelas: Record<Tabela, SituacaoTabela>;
}

export type SituacaoSincronia = Record<Vis, SituacaoEscopo>;

export const ROTULO_TABELA: Record<Tabela, string> = { d: "Demandas", a: "Arquivadas", h: "Histórico" };

const ESTADOS: ReadonlySet<unknown> = new Set(["ok", "erro", "indisponivel", "nunca"]);
const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const numero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** O status gravado pelo content script, ou nada se a forma não confere (a tela nunca mostra "NaN"). */
function comoStatus(v: unknown): StatusSync | undefined {
  if (!objeto(v) || !ESTADOS.has(v.estado) || !numero(v.quando)) return undefined;
  const st = v as unknown as StatusSync;
  return typeof st.mensagem === "string" || st.mensagem === undefined ? st : { ...st, mensagem: undefined };
}

function comoSubstituido(v: unknown): TextoSubstituido | undefined {
  return objeto(v) && typeof v.html === "string" && typeof v.motivo === "string" && numero(v.quando)
    ? (v as unknown as TextoSubstituido)
    : undefined;
}

function haQuanto(ms: number, agora: number): string {
  const min = Math.max(0, Math.round((agora - ms) / 60_000));
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return `há ${plural(Math.round(min / 1440), "dia", "dias")}`;
}

/** O estado de UMA tabela, para o `data-estado` da linha e para o indicador. */
export function tomDaTabela(consentimento: EstadoConsentimento, t: SituacaoTabela): TomSincronia {
  if (consentimento !== "ligado") return "local";
  const st = t.status;
  if (!st || st.estado === "nunca" || st.estado === "indisponivel") return "local";
  // Desistir porque um colega gravava ao mesmo tempo não é erro: a nova tentativa já está armada.
  if (st.estado === "erro") return st.mensagem === MENSAGEM_MUDOU ? "pendente" : "erro";
  return st.pendente || st.aguardandoPermissao ? "pendente" : "ok";
}

/** A linha de situação de uma tabela ("Sincronizado há 2 min", "Erro: …"). */
export function linhaDaTabela(consentimento: EstadoConsentimento, t: SituacaoTabela, agora: number): string {
  const st = t.status;
  if (t.vis === "eu" && consentimento !== "ligado") return "Desligado: fica só neste navegador.";
  if (t.vis === "unidade" && consentimento !== "ligado")
    return st?.aguardandoPermissao
      ? "Há alterações esperando o seu “Entendi” para ir ao SEI."
      : "Aguardando o seu “Entendi”: por enquanto só lê.";
  if (!st || st.estado === "nunca")
    return t.vis === "unidade" ? "Ainda não lido nesta unidade." : "Ligado: falta abrir o Controle de Processos.";
  if (st.estado === "indisponivel") return st.mensagem ?? "Indisponível nesta unidade.";
  if (st.estado === "erro") {
    if (st.mensagem === MENSAGEM_MUDOU) return "Um colega gravou ao mesmo tempo; nova tentativa em instantes.";
    return `Erro: ${st.mensagem ?? "tente de novo"}`;
  }
  const quando = haQuanto(st.ultimoOk ?? st.quando, agora);
  return `Sincronizado ${quando}${st.pendente ? " · alterações a enviar" : ""}${st.mensagem ? ` · ${st.mensagem}` : ""}`;
}

export const usoDaTabela = (t: SituacaoTabela): string =>
  t.bytes === undefined ? "" : `${Math.max(1, Math.round(t.bytes / 1024))} KB · ${t.percentual}%`;

const PESO: Record<TomSincronia, number> = { local: 0, ok: 1, pendente: 2, erro: 3 };

const horaDe = (ms: number): string => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export interface Indicador {
  tom: TomSincronia;
  rotulo: string;
  /** O motivo e o detalhe por tabela (vai no `title`). */
  dica: string;
}

export function indicadorDe(s: SituacaoSincronia, agora: number): Indicador {
  const linhas: string[] = [];
  let tom: TomSincronia = "local";
  let ultimo = 0;
  let motivo = "";
  for (const vis of ["unidade", "eu"] as const) {
    const e = s[vis];
    // O pessoal desligado não acrescenta nada.
    if (vis === "eu" && e.consentimento !== "ligado") continue;
    for (const t of TABELAS) {
      const x = e.tabelas[t];
      const tomT = tomDaTabela(e.consentimento, x);
      if (PESO[tomT] > PESO[tom]) tom = tomT;
      if (tomT === "erro" && !motivo) motivo = linhaDaTabela(e.consentimento, x, agora);
      if (tomT === "ok" || tomT === "pendente") ultimo = Math.max(ultimo, x.status?.ultimoOk ?? x.status?.quando ?? 0);
      linhas.push(`${vis === "unidade" ? "Toda a unidade" : "Só eu"} · ${ROTULO_TABELA[t]}: ${linhaDaTabela(e.consentimento, x, agora)}`);
    }
  }
  const dica = [motivo, ...linhas].filter(Boolean).join("\n");
  if (tom === "local")
    return { tom, rotulo: "Neste navegador", dica: `As demandas ficam guardadas neste navegador.\n${linhas.join("\n")}` };
  if (tom === "erro") return { tom, rotulo: "Erro na sincronia", dica };
  if (tom === "pendente") return { tom, rotulo: "Sincronização pendente", dica };
  return { tom, rotulo: ultimo ? `Sincronizado ${horaDe(ultimo)}` : "Sincronizado", dica };
}

export interface DepsEstado {
  /** chrome.storage.local: o status dos textos e a cópia do texto inválido. */
  area: Area;
  /** chrome.storage.sync: os consentimentos. */
  sync: Area;
  escopos: Readonly<Record<Vis, Escopo>>;
}

function vazia(e: Escopo): SituacaoEscopo {
  const tabelas = Object.fromEntries(
    TABELAS.map((t) => [t, { vis: e.vis, tabela: t, nome: nomeDoTexto(e.vis, e.login, t), percentual: 0, faixa: "normal" as Faixa }]),
  ) as Record<Tabela, SituacaoTabela>;
  return { vis: e.vis, consentimento: "nao-perguntado", tabelas };
}

/** Lê tudo uma vez, guarda, e relê quando uma das chaves muda. */
export class EstadoDaSincronia {
  private atual: SituacaoSincronia;
  private readonly ouvintes = new Set<() => void>();
  private paradas: Array<() => void> = [];
  /** Uma leitura por vez: uma leitura lenta, começada antes, não termina por cima de uma mais nova. */
  private fila: Promise<unknown> = Promise.resolve();

  constructor(private readonly d: DepsEstado) {
    this.atual = { unidade: vazia(d.escopos.unidade), eu: vazia(d.escopos.eu) };
  }

  private chaves(): Set<string> {
    return new Set(
      (["unidade", "eu"] as const).flatMap((vis) =>
        TABELAS.flatMap((t) => [chaveStatusTexto(this.d.escopos[vis], t), chaveSubstituido(this.d.escopos[vis], t)]),
      ),
    );
  }

  /** Os ouvintes entram ANTES da primeira leitura: o que mudar no meio dela entra na fila e é relido depois. */
  async iniciar(): Promise<void> {
    const locais = this.chaves();
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
    const de = async (vis: Vis): Promise<SituacaoEscopo> => {
      const e = this.d.escopos[vis];
      const antes = this.atual[vis];
      let lido: Record<string, unknown> | null = null;
      try {
        lido = await this.d.area.obter(TABELAS.flatMap((t) => [chaveStatusTexto(e, t), chaveSubstituido(e, t)]));
      } catch {
        // storage.local recusou a leitura: a tela fica com o que já mostrava.
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
      const tabelas = Object.fromEntries(
        TABELAS.map((t) => {
          const velho = antes.tabelas[t];
          const status = lido ? comoStatus(lido[chaveStatusTexto(e, t)]) : velho.status;
          const substituido = lido ? comoSubstituido(lido[chaveSubstituido(e, t)]) : velho.substituido;
          const { faixa, percentual } = faixaDoTamanho(status?.tamanho);
          const x: SituacaoTabela = {
            vis,
            tabela: t,
            nome: nomeDoTexto(vis, e.login, t),
            percentual,
            faixa,
            ...(status ? { status } : {}),
            ...(status?.tamanho !== undefined ? { bytes: status.tamanho } : {}),
            ...(substituido ? { substituido } : {}),
          };
          return [t, x];
        }),
      ) as Record<Tabela, SituacaoTabela>;
      return { vis, consentimento, tabelas };
    };
    this.atual = { unidade: await de("unidade"), eu: await de("eu") };
    for (const o of [...this.ouvintes]) o();
    return this.atual;
  }

  situacao(): SituacaoSincronia {
    return this.atual;
  }

  aoMudar(cb: () => void): () => void {
    this.ouvintes.add(cb);
    return () => {
      this.ouvintes.delete(cb);
    };
  }
}
