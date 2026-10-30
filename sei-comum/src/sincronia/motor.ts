/**
 * Motor genérico da sincronia de UM Texto Padrão (um escopo de um módulo):
 * puxar → validar → mesclar → (se mudou) reler → gravar. O módulo entra por um
 * adaptador (envelope, mesclagem, assinatura, teto, mensagens). A mesclagem é
 * a do módulo (vence a versão mais recente de cada entidade, com lápides), então
 * a rodada pode se repetir sem medo, em qualquer aba e em qualquer ordem.
 *
 * - Puxa no máximo a cada `intervaloPuxar` (5 min), salvo pendência local ou pedido do usuário.
 * - Mudança local marca "pendente" NA HORA (persistido: se a página fechar, a
 *   próxima carga envia) e envia `atrasoEnvio` (15 s) depois da última.
 *   Mudança feita durante uma rodada, depois do exportar, não se perde: cada
 *   mudança soma uma geração, e a rodada que não levou a geração atual termina
 *   ainda pendente e rearma o envio. O envio que acha a trava ocupada (outra
 *   aba, ou a rodada desta) também é rearmado.
 * - Texto inválido (editado à mão, corrompido, de outro escopo) nunca apaga
 *   nada: é regravado a partir do local, depois de `antesDeRegravarInvalido`
 *   (a hora da cópia do módulo; se ele falhar, não grava). De versão mais
 *   nova: não é tocado.
 * - Acima do teto não grava (e explica); acima do aviso grava e avisa.
 * - Sem permissão de Texto Padrão: "indisponível", e não insiste por um dia. Quem lê
 *   mas não pode gravar (só o link de consultar) fica com a mensagem `soLeitura`.
 * - Sem o consentimento (`permitido`): não grava e marca `aguardandoPermissao`, mas só
 *   quando o envelope daqui difere do texto lido como o adaptador o gravaria
 *   (`normalizar`): a poda e o que a importação recusa não são alterações daqui.
 * - Releitura: logo antes de gravar (já conferida a permissão), lê de novo e
 *   compara a carga (o escape a mais do SEI 5 não conta como mudança). Se
 *   outra pessoa (o texto da unidade é de todos) ou outro computador gravou no
 *   meio, mescla de novo e recalcula. São até `releituras` releituras (3), ou
 *   seja, até `releituras - 1` novas mesclas (2): se a última releitura ainda
 *   achar o texto mudado, não grava e fica pendente, com nova tentativa armada
 *   em espera crescente (15 s, 30 s, 1 min, 2 min, 4 min, teto de 5 min, mais
 *   um sorteio de até metade da espera, para dois usuários não voltarem
 *   juntos); a espera volta ao começo depois de uma rodada que deixa o texto em
 *   dia. Ninguém perde o que gravou. `releituras: 0` desliga (os Favoritos: um
 *   texto por pessoa).
 * - Uma trava por texto (Web Locks, quando a página tem) evita duas abas
 *   juntas; e o conteúdo igual ao remoto não é regravado.
 * - Destino que confere sozinho (`gravarConferindo`, o armazém do núcleo): a
 *   conferência do conteúdo anterior vai junto da gravação (lê o formulário de
 *   alterar e só posta se o texto ainda é o lido), no lugar da releitura; se
 *   mudou, devolve o atual, que entra na próxima tentativa da mesma conta.
 * - Texto que ainda não existe e não teria nada (`vazio`): não é criado.
 * - `lerNoRecuo`: durante o recuo de "indisponível" (quem pode ler mas não
 *   gravar), as puxadas continuam, só sem gravar. A mudança local (inclusive a
 *   da mescla dessas puxadas) não força rodada no recuo: fica pendente e vai
 *   depois dele, ou no "Sincronizar agora" (aí o usuário pediu).
 */

import type { Area } from "../armazenamento/area";
import { deParagrafos } from "./codec";
import { gerarConteudoTexto, lerConteudoTexto, type ValidacaoTexto } from "./textoPadraoCodec";
import type { Travar } from "./trava";

export interface StatusSync {
  estado: "ok" | "erro" | "indisponivel" | "nunca";
  /** Última tentativa. */
  quando: number;
  ultimoOk?: number;
  ultimoPuxar?: number;
  mensagem?: string;
  /** Bytes do último conteúdo gravado ou lido. */
  tamanho?: number;
  /** Há mudança local ainda não enviada. */
  pendente: boolean;
  indisponivelAte?: number;
  /** A última rodada tinha o que gravar, mas `permitido` disse não (o texto fica como estava). */
  aguardandoPermissao?: boolean;
}

/** O que o motor sabe do texto lido, para o destino conferir na hora de gravar. */
export interface ConferenciaTexto {
  /** O conteúdo da última leitura (null: o texto não existia). */
  anterior: string | null;
  /** A mesma carga? (o escape a mais do SEI 5 não conta como mudança) */
  mesmo(a: string | null, b: string | null): boolean;
}

/** `gravado: false`: o texto não era mais o `anterior`; `atual` é o que ele tem agora (null: sumiu). */
export type ResultadoGravacao = { gravado: true } | { gravado: false; atual: string | null };

export interface DestinoTexto {
  ler(): Promise<string | null>;
  gravar(html: string): Promise<void>;
  /** Grava só se o texto ainda é o `anterior` (conferido junto da gravação); senão devolve o atual. */
  gravarConferindo?(html: string, c: ConferenciaTexto): Promise<ResultadoGravacao>;
}

export interface MensagensMotor {
  maisNovo: string;
  grandeDemais(kb: number, tetoKb: number): string;
  pertoDoTeto(kb: number): string;
  invalidoRegravado(motivo: string): string;
  mudouDuranteGravacao: string;
  /** O texto foi lido nesta rodada, mas o SEI recusou a gravação (quem só tem o link de consultar). */
  soLeitura: string;
}

export const MENSAGENS_MOTOR: MensagensMotor = {
  maisNovo:
    "Os dados no SEI foram gravados por uma versão mais nova do SEI Pro. Atualize a extensão neste computador; o texto não foi alterado.",
  grandeDemais: (kb, tetoKb) => `Os dados ficaram grandes demais para o Texto Padrão (${kb} KB de ${tetoKb} KB).`,
  pertoDoTeto: (kb) => `Os dados estão perto do limite do Texto Padrão (${kb} KB).`,
  invalidoRegravado: (motivo) => `O texto no SEI estava inválido (${motivo}) e foi regravado a partir deste computador.`,
  mudouDuranteGravacao: "O texto no SEI mudou enquanto era gravado (outra pessoa sincronizando). Nova tentativa na próxima rodada.",
  soLeitura: "Indisponível nesta unidade: o SEI não deixa gravar este Texto Padrão com o seu perfil.",
};

/** O que o módulo ensina ao motor. Um adaptador por texto (escopo). */
export interface AdaptadorTexto<E> {
  /** Nome do módulo: a trava é `seipro-<modulo>-sync|<chaveStatus>`. */
  modulo: string;
  /** Onde o StatusSync deste texto fica na área local. */
  chaveStatus: string;
  /** Tamanho máximo do conteúdo (bytes do HTML): acima, não grava. */
  teto: number;
  /** Acima disto grava, mas avisa. */
  aviso: number;
  /** O parágrafo legível que abre o texto. */
  legivel(): string;
  /** O JSON lido do texto: envelope bom, inválido (motivo) ou de versão mais nova. */
  validar(bruto: unknown): ValidacaoTexto<E>;
  /** Mescla no armazenamento local (vence o mais recente; lápides valem). */
  importar(envelope: E): Promise<void>;
  /**
   * O envelope a gravar. `remoto`: o que o texto tem agora (null se não há ou é inválido);
   * `invalido`: true se o texto EXISTE mas é inválido (codec ou `validar`), false se não há
   * texto ou ele é bom; `agora`: para podar lápides.
   */
  exportar(c: { remoto: E | null; agora: number; invalido: boolean }): Promise<E>;
  /** Igual para o mesmo conteúdo em qualquer computador (sem quem gravou nem quando). */
  assinatura(envelope: E): string;
  /**
   * Logo antes de regravar por cima de um texto que existe mas é inválido (o codec recusou,
   * ou `validar` disse inválido), com o motivo e o HTML que vai ser substituído: a hora de
   * garantir a cópia (spec 6.1). Se lançar, o motor não grava (fica em erro, nada local muda).
   * Vem antes da releitura (que fica colada na gravação): se a releitura achar o texto mudado
   * e ele continuar inválido, é chamado de novo com o HTML novo; o da última chamada é o substituído.
   */
  antesDeRegravarInvalido?(motivo: string, html: string): Promise<void>;
  /** Nada a guardar: sem texto no SEI, o motor não cria um só para isto. */
  vazio?(envelope: E): boolean;
  /**
   * O texto lido como ESTE adaptador o gravaria se só tivesse ele (o que a importação recusa fica de fora; a poda
   * e os cortes da exportação valem). Sem permissão de gravar, o motor só marca `aguardandoPermissao` quando o
   * envelope daqui difere disto: a diferença que é só a poda (a lápide que passou do prazo) ou o que a importação
   * recusou (o texto editado à mão) não é alteração daqui esperando o consentimento.
   */
  normalizar?(lido: E, agora: number): Promise<E>;
  mensagens?: Partial<MensagensMotor>;
}

/** Os envios agendados (setTimeout/clearTimeout por padrão); as provas trocam para ver as esperas. */
export interface Temporizador {
  definir(fn: () => void, ms: number): unknown;
  cancelar(id: unknown): void;
}

const TEMPORIZADOR_PADRAO: Temporizador = {
  definir: (fn, ms) => setTimeout(fn, ms),
  cancelar: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export interface DepsMotorTexto<E> {
  adaptador: AdaptadorTexto<E>;
  destino: DestinoTexto;
  /** Área local (o StatusSync). */
  area: Area;
  /** Roda `fn` com a trava; devolve null se outra aba já está com ela. */
  travar: Travar;
  agora?: () => number;
  /** Envio depois da última mudança local (15 s); também a primeira espera depois de desistir. */
  atrasoEnvio?: number;
  /** Intervalo mínimo entre duas puxadas sem pendência (5 min). */
  intervaloPuxar?: number;
  /** Releituras antes de gravar (3, ou seja, até 2 novas mesclas); 0 desliga. */
  releituras?: number;
  /** Ainda pode gravar? (O usuário pode ter desligado durante a rodada.) */
  permitido?: () => Promise<boolean>;
  /** Os envios agendados (setTimeout/clearTimeout). */
  temporizador?: Temporizador;
  /** O sorteio do atraso da nova tentativa, em [0, 1) (Math.random). */
  aleatorio?: () => number;
  /**
   * No recuo de "indisponível", continua puxando (sem gravar) a cada `intervaloPuxar`; o envio
   * agendado por mudança local também só puxa (a pendência fica para depois do recuo).
   */
  lerNoRecuo?: boolean;
}

const CINCO_MIN = 5 * 60_000;
const UM_DIA = 86_400_000;

export const nomeDaTrava = (modulo: string, chaveStatus: string): string => `seipro-${modulo}-sync|${chaveStatus}`;

/** A releitura compara a carga (os blocos do codec), que resiste ao escape a mais do SEI 5; sem carga (texto inválido), o HTML cru. */
export function mesmoConteudo(a: string | null, b: string | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  const ca = deParagrafos(a);
  const cb = deParagrafos(b);
  return ca !== null && cb !== null && ca === cb;
}

export function textoDoErro(e: unknown): { estado: StatusSync["estado"]; mensagem: string } {
  const codigo = (e as { codigo?: string } | null)?.codigo;
  if (codigo === "SEI_SESSAO_EXPIRADA") return { estado: "erro", mensagem: "Sessão do SEI expirada. Entre de novo no SEI." };
  if (codigo === "SEI_ACAO_INDISPONIVEL")
    return { estado: "indisponivel", mensagem: "Indisponível nesta unidade: o SEI não oferece Textos Padrão para você aqui." };
  return { estado: "erro", mensagem: e instanceof Error ? e.message : String(e) };
}

export class MotorTextoPadrao<E> {
  private espera: unknown;
  /** Soma 1 a cada mudança local: a rodada que exportou uma geração anterior termina pendente. */
  private geracao = 0;
  /** Desistências seguidas (texto mudando a cada releitura): a espera da nova tentativa dobra. */
  private desistencias = 0;
  /** `parar()` foi chamado: uma rodada que ainda termine não rearma o envio. */
  private parado = false;
  /** As gravações do status, em fila (`gravarStatus`). */
  private filaStatus: Promise<unknown> = Promise.resolve();

  constructor(private readonly d: DepsMotorTexto<E>) {}

  private get temporizador(): Temporizador {
    return this.d.temporizador ?? TEMPORIZADOR_PADRAO;
  }

  private get atrasoEnvio(): number {
    return this.d.atrasoEnvio ?? 15_000;
  }

  private agora(): number {
    return this.d.agora?.() ?? Date.now();
  }

  async status(): Promise<StatusSync> {
    const k = this.d.adaptador.chaveStatus;
    const v = (await this.d.area.obter(k))[k] as StatusSync | undefined;
    return v ?? { estado: "nunca", quando: 0, pendente: false };
  }

  /**
   * Uma gravação de status por vez, cada uma lendo o status de agora: a marca de pendente (que a mescla da própria
   * rodada também dispara pelo `aoMudar`) não pode gravar por cima, com uma leitura velha, o `ultimoPuxar` que a
   * rodada acabou de gravar (no recuo, isso fazia o envio agendado ler de novo antes do intervalo).
   */
  private gravarStatus(m: Partial<StatusSync>): Promise<StatusSync> {
    const feito = this.filaStatus.then(async () => {
      // "Aguardando permissão" vale só para a rodada que o gravou.
      const novo = { ...(await this.status()), aguardandoPermissao: undefined, ...m };
      await this.d.area.gravar({ [this.d.adaptador.chaveStatus]: novo });
      return novo;
    });
    this.filaStatus = feito.catch(() => undefined);
    return feito;
  }

  async marcarPendente(): Promise<void> {
    this.geracao++;
    const s = await this.status();
    if (!s.pendente) await this.gravarStatus({ pendente: true });
  }

  /** Mudança local: pendente na hora, envio `atrasoEnvio` depois da última. */
  agendarEnvio(): Promise<void> {
    this.parado = false;
    this.armar(this.atrasoEnvio);
    return this.marcarPendente();
  }

  parar(): void {
    this.parado = true;
    if (this.espera !== undefined) this.temporizador.cancelar(this.espera);
    this.espera = undefined;
  }

  private armar(ms: number): void {
    if (this.espera !== undefined) this.temporizador.cancelar(this.espera);
    this.espera = this.temporizador.definir(() => {
      this.espera = undefined;
      void this.enviarAgendado().catch(() => undefined);
    }, ms);
  }

  /** Arma de novo o envio, salvo se `parar()` veio no meio da rodada. */
  private rearmar(ms: number): void {
    if (!this.parado) this.armar(ms);
  }

  private async enviarAgendado(): Promise<void> {
    // No recuo com `lerNoRecuo` (quem só lê), forçar levaria a mescla do próprio `soLer` (que avisa o `aoMudar`) a
    // uma rodada que tenta gravar: lá o envio só puxa, respeitando o intervalo, e a pendência continua guardada.
    const forcar = !(this.d.lerNoRecuo && this.noRecuo(await this.status(), this.agora()));
    // Trava ocupada (outra aba, ou a rodada desta ainda em curso): sem rearmar, a mudança esperaria a próxima carga.
    if ((await this.executar(forcar)) === null) this.rearmar(this.atrasoEnvio);
  }

  private noRecuo(s: StatusSync, agora: number): boolean {
    return s.estado === "indisponivel" && (s.indisponivelAte ?? 0) > agora;
  }

  async sincronizar(o: { forcar?: boolean } = {}): Promise<StatusSync> {
    this.parado = false;
    return (await this.executar(o.forcar === true)) ?? (await this.status());
  }

  /** null: a trava estava ocupada e a rodada não rodou. */
  private async executar(forcar: boolean): Promise<StatusSync | null> {
    const agora = this.agora();
    const s = await this.status();
    const intervalo = this.d.intervaloPuxar ?? CINCO_MIN;
    const a = this.d.adaptador;
    const nome = nomeDaTrava(a.modulo, a.chaveStatus);
    if (!forcar) {
      if (this.noRecuo(s, agora)) {
        if (!this.d.lerNoRecuo || (s.ultimoPuxar && agora - s.ultimoPuxar < intervalo)) return s;
        return this.d.travar(nome, () => this.soLer(agora));
      }
      if (!s.pendente && s.ultimoPuxar && agora - s.ultimoPuxar < intervalo) return s;
    }
    return this.d.travar(nome, () => this.rodada(agora));
  }

  /** Recuo de "indisponível" com `lerNoRecuo`: lê e mescla, sem gravar; o estado e a mensagem ficam. */
  private async soLer(agora: number): Promise<StatusSync> {
    try {
      const remoto = await this.d.destino.ler();
      if (remoto !== null) {
        const r = await this.validar(remoto);
        if ("ok" in r) await this.d.adaptador.importar(r.ok);
      }
      return this.gravarStatus({ ultimoPuxar: agora, tamanho: remoto?.length });
    } catch {
      // Sem insistir: a próxima puxada é depois do intervalo.
      return this.gravarStatus({ ultimoPuxar: agora });
    }
  }

  /** O texto mudou a cada conferência: não grava, fica pendente e tenta de novo com espera crescente. */
  private async desistir(agora: number, m: MensagensMotor): Promise<StatusSync> {
    this.desistencias++;
    const s = await this.gravarStatus({
      estado: "erro",
      quando: agora,
      ultimoPuxar: agora,
      pendente: true,
      mensagem: m.mudouDuranteGravacao,
    });
    this.rearmar(this.esperaDepoisDeDesistir());
    return s;
  }

  /** 15 s, 30 s, 1 min, 2 min, 4 min, 5 min (teto), mais um sorteio de até metade da espera. */
  private esperaDepoisDeDesistir(): number {
    const espera = Math.min(this.atrasoEnvio * 2 ** Math.max(0, this.desistencias - 1), CINCO_MIN);
    return espera + Math.floor((this.d.aleatorio ?? Math.random)() * (espera / 2));
  }

  /**
   * Fim de rodada que deixou o texto em dia. Pendente (e com o envio rearmado) se houve
   * mudança local depois do exportar desta rodada: ela não está no que foi gravado.
   */
  private async concluir(geracao: number, m: Partial<StatusSync>): Promise<StatusSync> {
    this.desistencias = 0;
    let s = await this.gravarStatus({ ...m, pendente: this.geracao !== geracao });
    // Uma mudança entre a conta acima e a gravação do status pode ter tido a marca sobrescrita.
    if (!s.pendente && this.geracao !== geracao) s = await this.gravarStatus({ pendente: true });
    if (s.pendente) this.rearmar(this.atrasoEnvio);
    return s;
  }

  private async validar(html: string): Promise<ValidacaoTexto<E>> {
    const r = await lerConteudoTexto(html);
    return "invalido" in r ? r : this.d.adaptador.validar(r.bruto);
  }

  private async rodada(agora: number): Promise<StatusSync> {
    const a = this.d.adaptador;
    const m = { ...MENSAGENS_MOTOR, ...a.mensagens };
    const releituras = this.d.releituras ?? 3;
    // O texto foi lido nesta rodada: a recusa do SEI depois disso é da gravação (quem só consulta).
    let leu = false;
    try {
      let remoto = await this.d.destino.ler();
      leu = true;
      for (let tentativa = 0; ; tentativa++) {
        let lido: E | null = null;
        let invalido: string | null = null;
        if (remoto !== null) {
          const r = await this.validar(remoto);
          if ("maisNovo" in r) return this.gravarStatus({ estado: "erro", quando: agora, ultimoPuxar: agora, mensagem: m.maisNovo });
          if ("ok" in r) {
            await a.importar(r.ok);
            lido = r.ok;
          } else {
            invalido = r.invalido;
          }
        }
        // O que mudar localmente daqui em diante não entra neste envelope.
        const geracao = this.geracao;
        const env = await a.exportar({ remoto: lido, agora, invalido: invalido !== null });
        if (remoto !== null && lido !== null && a.assinatura(env) === a.assinatura(lido)) {
          return this.concluir(geracao, {
            estado: "ok",
            quando: agora,
            ultimoOk: agora,
            ultimoPuxar: agora,
            mensagem: undefined,
            tamanho: remoto.length,
          });
        }
        if (remoto === null && a.vazio?.(env)) {
          return this.concluir(geracao, {
            estado: "ok",
            quando: agora,
            ultimoOk: agora,
            ultimoPuxar: agora,
            mensagem: undefined,
            tamanho: 0,
          });
        }
        const html = await gerarConteudoTexto(a.legivel(), env);
        const kb = Math.ceil(html.length / 1024);
        if (html.length > a.teto) {
          return this.gravarStatus({
            estado: "erro",
            quando: agora,
            ultimoPuxar: agora,
            tamanho: html.length,
            mensagem: m.grandeDemais(kb, Math.round(a.teto / 1024)),
          });
        }
        // Antes da releitura, para que ela fique colada na gravação.
        if (this.d.permitido && !(await this.d.permitido())) {
          // A diferença é só a do próprio texto (poda, item recusado na importação): nada daqui espera o consentimento.
          if (lido !== null && a.normalizar && a.assinatura(env) === a.assinatura(await a.normalizar(lido, agora))) {
            return this.concluir(geracao, {
              estado: "ok",
              quando: agora,
              ultimoOk: agora,
              ultimoPuxar: agora,
              mensagem: undefined,
              tamanho: remoto?.length ?? 0,
            });
          }
          return this.gravarStatus({
            estado: "nunca",
            quando: agora,
            ultimoPuxar: agora,
            pendente: false,
            mensagem: undefined,
            aguardandoPermissao: true,
          });
        }
        if (remoto !== null && invalido !== null) await a.antesDeRegravarInvalido?.(invalido, remoto);
        const conferir = releituras > 0 ? this.d.destino.gravarConferindo?.bind(this.d.destino) : undefined;
        if (releituras > 0 && !conferir) {
          const deNovo = await this.d.destino.ler();
          if (!mesmoConteudo(deNovo, remoto)) {
            if (tentativa + 1 >= releituras) return this.desistir(agora, m);
            remoto = deNovo;
            continue;
          }
        }
        if (conferir) {
          const r = await conferir(html, { anterior: remoto, mesmo: mesmoConteudo });
          if (!r.gravado) {
            if (tentativa + 1 >= releituras) return this.desistir(agora, m);
            remoto = r.atual;
            continue;
          }
        } else {
          await this.d.destino.gravar(html);
        }
        return this.concluir(geracao, {
          estado: "ok",
          quando: agora,
          ultimoOk: agora,
          ultimoPuxar: agora,
          tamanho: html.length,
          mensagem: invalido ? m.invalidoRegravado(invalido) : html.length > a.aviso ? m.pertoDoTeto(kb) : undefined,
        });
      }
    } catch (e) {
      const t = textoDoErro(e);
      if (t.estado === "indisponivel" && leu) t.mensagem = m.soLeitura;
      return this.gravarStatus({
        estado: t.estado,
        mensagem: t.mensagem,
        quando: agora,
        indisponivelAte: t.estado === "indisponivel" ? agora + UM_DIA : undefined,
      });
    }
  }
}
