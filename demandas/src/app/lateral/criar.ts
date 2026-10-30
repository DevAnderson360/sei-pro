/**
 * O app de uma unidade no painel lateral, como o `MontagemLateral` pede (`criar`): a mesma `Colaboracao` do painel
 * embutido (faixas do "Entendi", sincronização, menu, cópias e arquivo ligado) com a Agenda (`agenda.ts`) no lugar das
 * visões. Sem o tema do SEI (o lateral segue o sistema, como os Favoritos). Cada demanda da Agenda abre no painel da
 * aba do SEI (RPC `focarNoPainel`); "Nova demanda" abre o mesmo diálogo do painel.
 *
 * O que é de cada montagem fica com ela: os diálogos que o app abriu fecham quando ele desmonta (um formulário ou o
 * "Entendi" da unidade velha não fica por cima das demandas da unidade nova, nem grava nela depois), os avisos dele saem
 * da tela (o "Desfazer" agiria na unidade velha), e a contagem das atrasadas de cada montagem vai para a aba do painel.
 */

import type { Area } from "@comum/armazenamento/area";
import type { DataISO } from "@comum/datas/dias";
import type { Rpc } from "@comum/ponte/rpc";
import { avisar } from "@comum/ui/aviso";
import { type AbrirModal, criarConfirmar } from "@comum/ui/dialogo";
import { h, icone } from "@comum/ui/dom";
import { criarMenu } from "@comum/ui/menu";
import type { ProcessoDaCaixa, UsuarioDaUnidade } from "@projetos/ponte/tipos";
import { etapasAbertasDaUnidade, reposDosProjetos } from "../../integracao/projetos";
import { escoposDaUnidade } from "../../modelo/escopo";
import type { Carimbo } from "../../modelo/tipos";
import type { ContextoDemandas } from "../../ponte/tipos";
import { RepositorioDemandas } from "../../repositorio";
import { estadoDasTabelas } from "../../sincronia/orquestrador";
import { Colaboracao, type DepsColaboracao } from "../colaboracao";
import { contarAtrasadasMinhas, gravadorDoContador } from "../contador";
import { carregarDados, type DemandaNaTela } from "../dados";
import { abrirDialogoDemanda } from "../dialogos/demanda";
import { avisarErro } from "../erros";
import type { ContextoDialogo } from "../tipos";
import { montarAgenda } from "./agenda";
import type { AppDoLateral } from "./montagem";

/** O navegador do lateral (o main.ts põe o chrome.storage, os diálogos e o seletor de arquivo). */
export interface NavegadorDoLateral {
  raiz: HTMLElement;
  /** chrome.storage.local (dados, contador) e chrome.storage.sync (consentimentos). */
  area: Area;
  sync: Area;
  abrirModal: AbrirModal;
  baixar(nome: string, conteudo: string, tipo: string): void;
  escolherArquivo: DepsColaboracao["escolherArquivo"];
  hoje(): DataISO;
  agora(): number;
  /** Id deste navegador (`idDispositivo`), no carimbo de cada gravação. */
  dispositivo: string;
  copias: DepsColaboracao["copias"];
  /** O arquivo ligado do usuário da aba; null onde o navegador não deixa escolher arquivo. */
  arquivo(ctx: ContextoDemandas, carimbo: () => Carimbo): DepsColaboracao["arquivo"];
}

/**
 * Os diálogos de UMA montagem: `fecharTodos` fecha os que ainda estão abertos (quem espera a resposta recebe o
 * "fechou", como no X: a confirmação responde "não", o "Entendi" responde "Agora não") e devolve quantos fechou. Depois
 * disso nada mais abre: um diálogo pedido pelo app que já saiu fecha na hora, sem aparecer.
 */
export function modaisDaVez(abrir: AbrirModal): { abrirModal: AbrirModal; fecharTodos(): number } {
  const abertos = new Set<{ fechar(): void }>();
  let encerrada = false;
  return {
    abrirModal: (o) => {
      if (encerrada) {
        queueMicrotask(() => o.aoFechar?.());
        return { fechar: () => undefined };
      }
      let controle: { fechar(): void } | null = null;
      const este = { fechar: () => controle?.fechar() };
      abertos.add(este);
      controle = abrir({
        ...o,
        aoFechar: () => {
          abertos.delete(este);
          o.aoFechar?.();
        },
      });
      return este;
    },
    fecharTodos: () => {
      encerrada = true;
      const lista = [...abertos];
      for (const m of lista) m.fechar();
      abertos.clear();
      return lista.length;
    },
  };
}

/** O `criar` do `MontagemLateral`: o app da unidade do contexto, com o RPC desta montagem. */
export function criarAppDoLateral(n: NavegadorDoLateral): (ctx: ContextoDemandas, rpc: Pick<Rpc, "chamar">) => Promise<AppDoLateral> {
  return async (ctx, rpc) => {
    const unidade = ctx.unidade;
    if (!unidade) throw new Error("Abra o SEI numa unidade para ver as demandas.");
    const modais = modaisDaVez(n.abrirModal);
    const confirmar = criarConfirmar(modais.abrirModal);
    const carimbo = (): Carimbo => ({ agora: n.agora(), dispositivo: n.dispositivo, por: ctx.login, nome: ctx.nome });
    const esc = escoposDaUnidade(ctx.host, ctx.login, unidade.id);
    const repos = { unidade: new RepositorioDemandas(n.area, esc.unidade, carimbo), eu: new RepositorioDemandas(n.area, esc.eu, carimbo) };
    const colab = new Colaboracao({
      repos,
      area: n.area,
      sync: n.sync,
      rpc,
      contexto: ctx,
      hoje: n.hoje,
      agora: n.agora,
      carimbo,
      abrirModal: modais.abrirModal,
      confirmar,
      baixar: n.baixar,
      escolherArquivo: n.escolherArquivo,
      copias: n.copias,
      arquivo: n.arquivo(ctx, carimbo),
      avisar,
    });
    // Nada da colaboração impede o app de abrir: uma falha ao iniciar só vai ao console.
    await colab.iniciar().catch((e: unknown) => console.warn("[SEI Pro] demandas: a colaboração não iniciou:", e));

    const eu = { login: ctx.login, nome: ctx.nome };
    const contar = gravadorDoContador(n.area);
    const dialogo: ContextoDialogo = {
      abrirModal: modais.abrirModal,
      confirmar,
      hoje: n.hoje,
      repos,
      contexto: ctx,
      usuarios: () => rpc.chamar<UsuarioDaUnidade[]>("usuarios", undefined, 60_000).catch(() => []),
      processosDaCaixa: () => rpc.chamar<ProcessoDaCaixa[]>("processosDaCaixa").catch(() => []),
      // Vínculo opcional com as etapas do Gestor de Projetos (somente leitura aqui).
      etapasDoProjetos: () => etapasAbertasDaUnidade(reposDosProjetos(n.area, ctx, unidade.id, carimbo)),
      tabelas: () => estadoDasTabelas(n.area, [esc.unidade, esc.eu]),
    };

    let vivo = true;
    let soMinhas = true;
    let dados: DemandaNaTela[] = [];
    let leitura = 0;
    const topoEl = h("div", { class: "dem-lat-topo" });
    const agendaEl = h("div", {});
    const raiz = h("div", { class: "dem dem-lat", "data-modo": "lateral" }, topoEl, colab.faixas, agendaEl);
    n.raiz.replaceChildren(raiz);

    const abrirNaAba = (x: DemandaNaTela) =>
      void rpc.chamar("focarNoPainel", { id: x.demanda.id }, 30_000).catch((e: unknown) => avisarErro(e));
    const menu = criarMenu({ rotulo: "Ajustes", icone: "ajustes", itens: () => colab.itensDoMenu() });
    const pintar = () => {
      if (!vivo) return;
      const ind = colab.estadoDoIndicador();
      topoEl.replaceChildren(
        h("span", { class: "dem-lat-sigla" }, icone("demandas", 15), unidade.sigla || "unidade"),
        h(
          "div",
          { class: "dem-lat-dir" },
          h(
            "button",
            {
              type: "button",
              class: "dem-sinc",
              "data-tom": ind.tom,
              title: ind.dica,
              "aria-label": `Sincronização: ${ind.rotulo}`,
              onclick: () => void colab.abrirDialogoSincronizacao().catch(avisarErro),
            },
            icone("nuvem", 14),
            h("span", { class: "dem-sinc-rotulo" }, ind.rotulo),
          ),
          menu,
        ),
      );
      agendaEl.replaceChildren(
        montarAgenda(dados, {
          hoje: n.hoje(),
          eu,
          soMinhas,
          aoClicar: abrirNaAba,
          aoNova: () => void abrirDialogoDemanda(dialogo, { vis: "unidade" }).catch(avisarErro),
          aoAlternar: (v) => {
            soMinhas = v;
            pintar();
          },
        }),
      );
    };
    const ler = async () => {
      const minha = ++leitura;
      try {
        const lidos = await carregarDados(repos, n.hoje());
        if (!vivo || minha !== leitura) return;
        dados = lidos;
        void contar(contarAtrasadasMinhas(dados, eu));
      } catch (e) {
        console.warn("[SEI Pro] demandas: o lateral não leu as demandas:", e);
      }
      pintar();
    };
    let agendado: ReturnType<typeof setTimeout> | null = null;
    const agendar = () => {
      if (agendado !== null) return;
      agendado = setTimeout(() => {
        agendado = null;
        void ler();
      }, 0);
    };
    const soltar = [repos.unidade.aoMudar(agendar), repos.eu.aoMudar(agendar), colab.aoMudar(agendar)];
    pintar();
    await ler();

    return {
      aoGanharFoco: () => {
        colab.aoGanharFoco();
        // O dia pode ter virado enquanto o painel estava escondido.
        agendar();
      },
      aoVoltarAba: () => agendar(),
      destruir: () => {
        vivo = false;
        if (agendado !== null) clearTimeout(agendado);
        for (const s of soltar) s();
        // Primeiro a colaboração (a resposta "não" de um diálogo fechado agora não redesenha nada), depois os diálogos.
        colab.destruir();
        const fechados = modais.fecharTodos();
        // Os avisos do app ("Desfazer") agiriam na unidade velha com a nova na tela.
        for (const a of [...n.raiz.ownerDocument.querySelectorAll(".spro-aviso")]) a.remove();
        return fechados;
      },
    };
  };
}
