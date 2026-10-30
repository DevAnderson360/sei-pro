/**
 * A aba "Projetos" do painel lateral liga-se à aba do SEI que está na frente
 * nesta janela (ponte do `sei-comum`) e monta o app com os projetos da unidade
 * DELA (spec 7): a chave de roteamento é host|login|u:<unidade>, então trocar
 * de unidade, de usuário ou de SEI (o SEI recarrega a página e a aba se
 * reapresenta com outra chave) desmonta o app e monta outro — nada é gravado
 * no escopo antigo. Trocar de aba na mesma unidade não remonta.
 *
 * Cada montagem tem o SEU RPC, preso à chave dela: vai só para uma aba dessa
 * chave (`daChave`), nunca para a da frente só porque ela ganhou o foco, e
 * depois de desmontar recusa tudo (um pedido atrasado do app velho não chega à
 * aba de outra unidade, nem à da própria). A montagem não tem outro RPC.
 *
 * A aba que some não desmonta na hora: o SEI recarrega a MESMA aba a cada
 * navegação (a porta cai e a página nova conecta de novo), inclusive dentro da
 * mesma unidade. O app espera uma carência (`CARENCIA_SEM_ABA_MS`): se a mesma
 * chave volta, nada acontece (diálogos, balão e o que foi digitado continuam;
 * o RPC passa a ir para a página nova); se chega outra chave, desmonta e monta
 * a nova; se a carência acaba sem aba, desmonta e mostra o aviso de sem aba.
 * Enquanto espera, o app grava no escopo dele (é a mesma unidade) e os pedidos
 * à aba recusam (`SEM_ABA`).
 *
 * Se a troca fechou algo que estava aberto (um formulário, o "Entendi"), um
 * aviso só, já na unidade nova, diz que foi fechado sem gravar (a contagem fica
 * guardada enquanto não há aba).
 *
 * Também atende o "Abrir no painel" que a árvore deixa no armazenamento
 * (`projetos/foco`, alvo "lateral"): abre o projeto (e o balão da etapa) assim
 * que o app da mesma chave estiver de pé. O pedido vale uma vez.
 */

import type { Area } from "@comum/armazenamento/area";
import { ErroRpc, type Rpc } from "@comum/ponte/rpc";
import { avisar } from "@comum/ui/aviso";
import { h, icone } from "@comum/ui/dom";
import { CHAVE_FOCO, type ContextoProjetos, chaveDaAba, lerPedidoDeFoco, pedidoDaChave } from "../../ponte/tipos";

/** O que a montagem usa da `PonteLateral` (`@comum/ponte/lateral`). */
export interface PonteDoLateral {
  atual(): { chave: string; rpc: Pick<Rpc, "chamar"> } | null;
  daChave(chave: string): { rpc: Pick<Rpc, "chamar"> } | null;
  aoMudar(cb: () => void): () => void;
}

/** O app montado para uma unidade (o `ligarApp` no modo lateral: `lateral/criar.ts`). */
export interface AppDoLateral {
  focarProjeto(id: string, etapa?: string): boolean;
  aoGanharFoco?(): void;
  /** A aba da mesma chave voltou (a página recarregou) ou outra da mesma unidade ficou na frente: a caixa pode ser outra. */
  aoVoltarAba?(): void;
  /** Desmonta; devolve quantos diálogos abertos fechou sem gravar (nada: 0). */
  destruir(): number;
}

export interface DepsMontagem {
  raiz: HTMLElement;
  ponte: PonteDoLateral;
  /** chrome.storage.local: o pedido de foco da árvore. */
  area: Area;
  agora(): number;
  /** Monta o app da unidade do contexto; `rpc` é o desta montagem (só fala com abas da chave dela). */
  criar(ctx: ContextoProjetos, rpc: Pick<Rpc, "chamar">): Promise<AppDoLateral>;
  /** Quanto esperar a aba que sumiu voltar antes de desmontar (padrão `CARENCIA_SEM_ABA_MS`; as provas encurtam). */
  carenciaMs?: number;
}

/**
 * A espera pela aba que sumiu: o SEI recarrega a página a cada clique (e numa rede lenta demora alguns segundos); o
 * que estiver aberto no lateral não pode se perder a cada navegação.
 */
export const CARENCIA_SEM_ABA_MS = 8000;

/** Uma montagem: a chave dela e se ainda vale (o RPC dela recusa depois de desmontar). */
interface Vez {
  chave: string;
  viva: boolean;
}

/** O que a desmontagem deixou para dizer: de que chave e unidade, e quantos diálogos fechou. */
interface Fechados {
  chave: string;
  sigla: string;
  quantos: number;
}

const MENSAGEM_SEM_ABA = "A aba do SEI destes projetos não está mais aberta nesta janela. Abra o SEI na unidade e tente de novo.";
/** O pedido feito durante a carência: a aba está recarregando (o mais comum é uma navegação no SEI). */
const MENSAGEM_CARREGANDO = "O SEI está carregando a página; tente de novo em instantes.";

/**
 * O aviso do que a troca fechou: outra unidade diz para qual mudou; mesma sigla com outra chave (outro usuário, outro
 * SEI) diz que o SEI mudou; a mesma chave (voltou depois da carência) só diz o que foi fechado.
 */
function avisoDaTroca(f: Fechados, chave: string, sigla: string): string {
  const fechou = `O que estava aberto na ${f.sigla} foi fechado sem gravar.`;
  if (f.chave === chave) return fechou;
  return f.sigla === sigla ? `O SEI desta janela mudou. ${fechou}` : `Você mudou para a ${sigla}. ${fechou}`;
}

function semAba(): HTMLElement {
  return h(
    "div",
    { class: "prj-lat-sem-aba" },
    icone("gantt", 28),
    h("p", {}, "Abra o SEI nesta janela para ver seus projetos."),
    h("p", { class: "prj-lat-dica" }, "Se o SEI já está aberto e nada aparece, recarregue a página dele (F5)."),
  );
}

/** Quantos pedidos de foco atendidos cada lateral lembra (um por clique na árvore; o pedido vale 1 minuto). */
const MAX_ATENDIDOS = 20;

export class MontagemLateral {
  private montado: { vez: Vez; app: AppDoLateral; sigla: string } | null = null;
  private fila: Promise<void> = Promise.resolve();
  private paradas: Array<() => void> = [];
  private parado = false;
  /** A aba do app montado sumiu: até quando ele espera (o timer da carência). */
  private carencia: ReturnType<typeof setTimeout> | null = null;
  /** O que uma desmontagem fechou e ainda não foi dito (sem aba, a unidade nova ainda não montou). */
  private fechadosSemAviso: Fechados | null = null;
  /** Os pedidos de foco que este lateral já atendeu (chave, prazo, projeto e etapa): o pedido fica até vencer. */
  private atendidos: string[] = [];

  constructor(private readonly d: DepsMontagem) {}

  iniciar(): void {
    this.d.raiz.replaceChildren(h("p", { class: "prj-lat-dica" }, "Procurando o SEI nesta janela…"));
    this.paradas.push(
      this.d.ponte.aoMudar(() => void this.reagir()),
      this.d.area.aoMudar((m) => {
        // Pela chave (o valor é relido): a remoção do próprio pedido também avisa e não acha nada.
        if (CHAVE_FOCO in m) this.enfileirar(() => this.atenderFoco());
      }),
    );
  }

  /** A aba da frente mudou (ou se apresentou): remonta só se a chave mudou. Devolve a volta da fila. */
  reagir(): Promise<void> {
    return this.enfileirar(() =>
      this.trocar().catch((e: unknown) => {
        if (this.parado) return;
        this.d.raiz.replaceChildren(
          h("p", { class: "prj-erro" }, `Não foi possível abrir os projetos: ${e instanceof Error ? e.message : String(e)}`),
        );
      }),
    );
  }

  aoGanharFoco(): void {
    this.montado?.app.aoGanharFoco?.();
  }

  parar(): void {
    this.parado = true;
    for (const p of this.paradas.splice(0)) p();
    this.cancelarCarencia();
    this.fechadosSemAviso = null;
    this.desmontar();
  }

  /** Uma coisa por vez: a troca de unidade e o pedido de foco nunca se cruzam. */
  private enfileirar(f: () => Promise<void>): Promise<void> {
    this.fila = this.fila.then(f, f);
    return this.fila;
  }

  private chamarNa<T>(vez: Vez, op: string, args?: unknown, prazo?: number): Promise<T> {
    const a = vez.viva && !this.parado ? this.d.ponte.daChave(vez.chave) : null;
    if (a) return a.rpc.chamar<T>(op, args, prazo);
    // Na carência do app montado a aba está recarregando: o código é o mesmo (quem chama decide por ele), o texto não.
    const carregando = vez.viva && !this.parado && this.carencia !== null && this.montado?.vez === vez;
    return Promise.reject(new ErroRpc("SEM_ABA", carregando ? MENSAGEM_CARREGANDO : MENSAGEM_SEM_ABA));
  }

  /** Desmonta o app; o que ele fechou fica guardado para o aviso da próxima montagem. */
  private desmontar(): void {
    const m = this.montado;
    this.montado = null;
    if (!m) return;
    m.vez.viva = false;
    let quantos = 0;
    try {
      const n = m.app.destruir();
      quantos = Number.isFinite(n) ? n : 0;
    } catch (e) {
      console.warn("[SEI Pro] projetos: o lateral não desmontou direito:", e);
    }
    if (quantos > 0) this.fechadosSemAviso = { chave: m.vez.chave, sigla: m.sigla, quantos };
  }

  /** A aba do app montado sumiu: ele fica, e a carência começa (uma só, por mais avisos que a ponte dê). */
  private esperarAba(): void {
    if (this.carencia) return;
    this.carencia = setTimeout(() => {
      this.carencia = null;
      void this.enfileirar(() => this.fimDaCarencia());
    }, this.d.carenciaMs ?? CARENCIA_SEM_ABA_MS);
  }

  private cancelarCarencia(): void {
    if (this.carencia) clearTimeout(this.carencia);
    this.carencia = null;
  }

  /** A carência acabou: se ainda não há aba com chave, desmonta e mostra o aviso de sem aba. */
  private async fimDaCarencia(): Promise<void> {
    if (this.parado || this.carencia || this.d.ponte.atual()?.chave) return;
    this.desmontar();
    this.d.raiz.replaceChildren(semAba());
  }

  private async trocar(): Promise<void> {
    if (this.parado) return;
    const a = this.d.ponte.atual();
    const chave = a?.chave ?? "";
    // Aba sem chave (sem unidade) não é aba para o lateral: a ponte real nem a oferece.
    if (!a || !chave) {
      // O app montado espera a aba voltar (o SEI recarregando a página); sem app, o aviso de sem aba.
      if (this.montado) this.esperarAba();
      else this.d.raiz.replaceChildren(semAba());
      return;
    }
    this.cancelarCarencia();
    // A mesma chave (voltou da recarga, ou outra aba da mesma unidade): nada muda (diálogos, balão, o que foi
    // digitado), só a caixa da página pode ser outra: o app relê a lista de processos na próxima vez que precisar.
    if (this.montado && this.montado.vez.chave === chave) {
      this.montado.app.aoVoltarAba?.();
      return;
    }
    this.desmontar();
    const ctx = await a.rpc.chamar<ContextoProjetos>("contexto");
    if (this.parado) return;
    // A chave que a aba apresentou tem de ser a do contexto dela (e com unidade): senão não monta e diz o mesmo que
    // sem aba (a próxima volta da fila corrige, quando a aba se reapresentar).
    if (chaveDaAba(ctx) !== chave || !ctx.unidade) {
      this.d.raiz.replaceChildren(semAba());
      return;
    }
    const sigla = ctx.unidade.sigla || "unidade";
    // O RPC já vale durante a montagem (o app pede à aba enquanto abre), preso à chave desta montagem.
    const vez: Vez = { chave, viva: true };
    let app: AppDoLateral;
    try {
      app = await this.d.criar(ctx, { chamar: (op, args, prazo) => this.chamarNa(vez, op, args, prazo) });
    } catch (e) {
      vez.viva = false;
      throw e;
    }
    this.montado = { vez, app, sigla };
    // Parou enquanto montava: o app que acabou de abrir sai já (relógio, ouvintes, arquivo ligado).
    if (this.parado) {
      this.desmontar();
      return;
    }
    const fechados = this.fechadosSemAviso;
    this.fechadosSemAviso = null;
    if (fechados) avisar(avisoDaTroca(fechados, chave, sigla));
    await this.atenderFoco();
  }

  /**
   * O "Abrir no painel" da árvore: só para a chave montada e dentro do prazo, uma vez por lateral. Nunca derruba o
   * app. Atender NÃO apaga o pedido: dois laterais na mesma chave (duas janelas do navegador no mesmo SEI, usuário e
   * unidade) atendem os dois, e o da janela onde o clique aconteceu pode montar depois do outro, que já estava aberto
   * (apagar ao atender deixava esse sem o projeto). O pedido vence no minuto; cada lateral lembra os que já atendeu
   * (`atendidos`) e não os atende de novo, nem ao remontar. O vencido (ou torto) desta chave sai do storage ao ler; o
   * de outra chave fica para ela.
   */
  private async atenderFoco(): Promise<void> {
    const m = this.montado;
    if (!m) return;
    try {
      const bruto = (await this.d.area.obter(CHAVE_FOCO))[CHAVE_FOCO];
      if (this.montado !== m) return;
      const p = lerPedidoDeFoco(bruto, "lateral", m.vez.chave, this.d.agora());
      if (!p) {
        if (pedidoDaChave(bruto, "lateral", m.vez.chave)) await this.d.area.remover(CHAVE_FOCO);
        return;
      }
      const assinatura = `${p.chave}|${p.ate}|${p.projeto}|${p.etapa ?? ""}`;
      if (this.atendidos.includes(assinatura)) return;
      this.atendidos = [...this.atendidos.slice(-(MAX_ATENDIDOS - 1)), assinatura];
      m.app.focarProjeto(p.projeto, p.etapa);
    } catch (e) {
      console.warn("[SEI Pro] projetos: o pedido de foco não foi atendido:", e);
    }
  }
}
