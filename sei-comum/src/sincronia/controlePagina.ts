/**
 * A sincronia por Texto Padrão do lado da aba do SEI (o content script tem a
 * sessão). Um controle por texto. Liga e desliga sozinho conforme o
 * consentimento daquele texto (porta do módulo), que o usuário decide no app:
 * - ao iniciar (o módulo diz se puxa: a caixa do Controle de Processos, por
 *   exemplo), ou se ficou pendência de uma carga anterior;
 * - qualquer mudança local (aqui, no app ou em outra aba) é enviada
 *   `atrasoEnvio` depois;
 * - `puxar()` ao ganhar foco; `agora()` e `apagar()` a pedido do app.
 *
 * Texto lido por todos (o da unidade nos Projetos, `lerSemConsentimento`): o
 * controle fica ligado desde o começo (lê e mescla o que os colegas gravaram) e
 * só a GRAVAÇÃO espera o consentimento; quando ele chega, a rodada vem na hora.
 */

import type { Area } from "../armazenamento/area";
import type { PortaConsentimento } from "./consentimento";
import {
  type AdaptadorTexto,
  type ConferenciaTexto,
  type DestinoTexto,
  MotorTextoPadrao,
  nomeDaTrava,
  type ResultadoGravacao,
  type StatusSync,
} from "./motor";
import { PREFIXO_TEXTO_INTERNO } from "./textoPadraoCodec";
import type { Travar, TravarEsperando } from "./trava";

/** Esconde os textos de dados do SEI Pro no seletor "Texto Padrão" ao gerar documento. É cosmético: o dado continua no SEI. */
export function ocultarTextosInternos(doc: Document): number {
  let n = 0;
  for (const o of doc.querySelectorAll<HTMLOptionElement>('select#selTextoPadrao option, select[name="selTextoPadrao"] option')) {
    if ((o.textContent ?? "").trim().startsWith(PREFIXO_TEXTO_INTERNO)) {
      o.remove();
      n++;
    }
  }
  return n;
}

export interface ArmazemTexto extends DestinoTexto {
  /** true se havia o texto e ele foi excluído. */
  excluir(): Promise<boolean>;
  /** Para conferir que o texto sumiu depois de excluir. */
  localizar?(): Promise<unknown>;
  gravarConferindo?(html: string, c: ConferenciaTexto): Promise<ResultadoGravacao>;
}

export interface DepsControlePagina<E> {
  /** Área local (o StatusSync). */
  area: Area;
  adaptador: AdaptadorTexto<E>;
  /** Criado só na primeira rodada (o armazém do núcleo monta o Sei da aba). */
  armazem: () => ArmazemTexto;
  consentimento: PortaConsentimento;
  /** Mudança nos dados locais deste texto (o repositório do escopo). */
  aoMudarLocal(cb: () => void): () => void;
  travar: Travar;
  /** A mesma trava, mas ESPERANDO a vez (o "apagar" não pode ser pulado). */
  travarEsperando?: TravarEsperando;
  atrasoEnvio?: number;
  intervaloPuxar?: number;
  releituras?: number;
  agora?: () => number;
  /** O texto é lido (e mesclado) mesmo sem consentimento; só a gravação espera o "ligado". */
  lerSemConsentimento?: boolean;
  /** Ainda pode gravar? Padrão: o consentimento deste texto está "ligado". */
  permitido?: () => Promise<boolean>;
  /** Durante o recuo de "indisponível", continua lendo (motor.ts). */
  lerNoRecuo?: boolean;
}

export class ControleTextoPadrao<E> {
  private motor: MotorTextoPadrao<E> | null = null;
  private pararMudancas: (() => void) | null = null;
  private pararConsentimento: (() => void) | null = null;
  private ultimoEstado: string | null = null;

  constructor(private readonly d: DepsControlePagina<E>) {}

  private criarMotor(): MotorTextoPadrao<E> {
    const armazem = this.d.armazem();
    const destino: DestinoTexto = { ler: () => armazem.ler(), gravar: (h) => armazem.gravar(h) };
    if (armazem.gravarConferindo) destino.gravarConferindo = (h, c) => armazem.gravarConferindo!(h, c);
    return new MotorTextoPadrao<E>({
      adaptador: this.d.adaptador,
      destino,
      area: this.d.area,
      travar: this.d.travar,
      agora: this.d.agora,
      atrasoEnvio: this.d.atrasoEnvio,
      intervaloPuxar: this.d.intervaloPuxar,
      releituras: this.d.releituras,
      lerNoRecuo: this.d.lerNoRecuo,
      // Conferido logo antes de gravar: quem desligou (ou mandou apagar) no meio de uma rodada não ganha o texto de volta.
      permitido: this.d.permitido ?? (async () => (await this.d.consentimento.estado()) === "ligado"),
    });
  }

  private rodar(forcar: boolean): Promise<StatusSync> {
    this.motor ??= this.criarMotor();
    return this.motor.sincronizar({ forcar });
  }

  private ligar(puxar: boolean): void {
    if (this.pararMudancas) return;
    this.motor ??= this.criarMotor();
    // As escritas da própria mesclagem também chegam aqui: custam uma leitura a mais depois,
    // que acha tudo igual e não regrava. Ignorá-las por janela de tempo engoliria mudança do usuário.
    this.pararMudancas = this.d.aoMudarLocal(() => void this.motor?.agendarEnvio());
    if (puxar) void this.rodar(false).catch(() => undefined);
  }

  private desligar(): void {
    this.pararMudancas?.();
    this.pararMudancas = null;
    this.motor?.parar();
  }

  private async pendenteGravado(): Promise<boolean> {
    const k = this.d.adaptador.chaveStatus;
    return ((await this.d.area.obter(k))[k] as StatusSync | undefined)?.pendente === true;
  }

  async iniciar(o: { puxar: boolean }): Promise<void> {
    const estado = await this.d.consentimento.estado();
    this.ultimoEstado = estado;
    if (estado === "ligado" || this.d.lerSemConsentimento) this.ligar(o.puxar || (await this.pendenteGravado()));
    // Iniciar de novo (mesmo duas chamadas cruzadas) troca o ouvinte do consentimento em vez de somar outro.
    this.pararConsentimento?.();
    this.pararConsentimento = this.d.consentimento.aoMudar(() => {
      void this.d.consentimento.estado().then((e) => {
        const antes = this.ultimoEstado;
        this.ultimoEstado = e;
        if (e === "ligado") {
          const estavaLigado = this.pararMudancas !== null;
          this.ligar(false);
          // Acabou de ligar (ou de consentir, no texto lido por todos): o que estava esperando vai agora.
          if (!estavaLigado || antes !== "ligado") void this.rodar(true).catch(() => undefined);
        } else if (!this.d.lerSemConsentimento) {
          this.desligar();
        }
      });
    });
  }

  /** A aba ganhou foco: puxa se a sincronia está ligada, respeitando o intervalo. null = desligada. */
  async puxar(): Promise<StatusSync | null> {
    if (!this.pararMudancas) return null;
    return this.rodar(false);
  }

  /** "Sincronizar agora", pedido pelo app. */
  agora(): Promise<StatusSync> {
    return this.rodar(true);
  }

  /** "Apagar meus dados do SEI": exclui o texto e desliga a sincronia deste texto. */
  async apagar(): Promise<boolean> {
    this.desligar();
    await this.d.consentimento.definir("desligado");
    const armazem = this.d.armazem();
    const fazer = async () => {
      let excluiu = await armazem.excluir();
      // Confere: uma rodada que terminou nesse meio tempo (outra aba) pode ter gravado o texto de novo.
      if (armazem.localizar && (await armazem.localizar())) excluiu = (await armazem.excluir()) || excluiu;
      return excluiu;
    };
    // Na mesma trava da rodada: espera a que está em curso terminar, e só então exclui.
    const nome = nomeDaTrava(this.d.adaptador.modulo, this.d.adaptador.chaveStatus);
    const excluiu = this.d.travarEsperando ? await this.d.travarEsperando(nome, fazer) : await fazer();
    await this.d.area.gravar({
      [this.d.adaptador.chaveStatus]: { estado: "nunca", quando: Date.now(), pendente: false } satisfies StatusSync,
    });
    return excluiu;
  }

  parar(): void {
    this.desligar();
    this.pararConsentimento?.();
  }
}
