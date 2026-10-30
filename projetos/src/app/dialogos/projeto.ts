/**
 * Diálogo "Novo projeto" / "Editar projeto" (tela 2): nome; processo SEI
 * opcional (os da caixa + qualquer número); "Quem vê" em cartões (Toda a
 * unidade | Só eu); e, só no novo, "Começar": Em branco | De um modelo (modelo,
 * "Começa em" e a prévia em dias úteis). No editar, o rodapé ganha o menu com
 * Arquivar/Reativar, Duplicar, Salvar como modelo, Redefinir plano original
 * (só com etapa replanejada) e Excluir.
 */

import { diferencaDias } from "@comum/datas/dias";
import { criarCombo } from "@comum/ui/combobox";
import type { AbrirModal } from "@comum/ui/dialogo";
import { h } from "@comum/ui/dom";
import { criarMenu, type EntradaMenu } from "@comum/ui/menu";
import { LIMITES } from "../../modelo/constantes";
import { planoParaRedefinir } from "../../modelo/linhaDeBase";
import type { DataISO, Modelo, Vinculo, Vis } from "../../modelo/tipos";
import { previaDoModelo } from "../../modelos/aplicar";
import type { ProcessoDaCaixa } from "../../ponte/tipos";
import type { ModeloNaTela, ProjetoNaTela } from "../dados";
import { dataCurta, dataDeFormulario, dataLonga, plural } from "../formato";
import { caixaDeErros, campo, campoProcesso, ERRO_PROTOCOLO, linhaDeCampos, mensagensDoErro } from "./campos";

export interface ResultadoProjeto {
  nome: string;
  processo?: Vinculo;
  vis: Vis;
  /** Só no novo, com "De um modelo". */
  modelo?: { modelo: Modelo; inicio: DataISO };
}

export interface ContextoDialogoProjeto {
  abrirModal: AbrirModal;
  hoje: DataISO;
  /** Sigla da unidade ("Toda a unidade (TESTE)"). */
  sigla: string;
  /** Projeto sendo editado; ausente = novo. */
  projeto?: ProjetoNaTela;
  modelos: readonly ModeloNaTela[];
  /** O "Começar de um modelo" do primeiro uso já abre no modelo. */
  comecarDeModelo?: boolean;
  processos(): Promise<ProcessoDaCaixa[]>;
  /**
   * Grava. O diálogo fecha quando a promessa resolve; com `false` (quem chama pediu confirmação e o
   * usuário desistiu) fica aberto, sem mensagem. Rejeitar mostra o erro e também deixa aberto.
   */
  salvar(r: ResultadoProjeto): Promise<unknown>;
  /** As ações do menu seguem a mesma regra do `salvar` (`false` = desistiu: fica aberto). */
  arquivar?: () => Promise<unknown>;
  reativar?: () => Promise<unknown>;
  duplicar?: () => Promise<unknown>;
  salvarComoModelo?: () => void;
  /** "Redefinir plano original" (spec 5.4): só aparece com etapa replanejada (`planoParaRedefinir`). */
  redefinirPlano?: () => Promise<unknown>;
  excluir?: () => Promise<unknown>;
}

function cartao(valor: Vis, marcado: boolean, titulo: string, explica: string): HTMLElement {
  return h(
    "label",
    { class: "prj-opcao" },
    h("input", { type: "radio", name: "vis", value: valor, checked: marcado }),
    h("div", {}, h("b", {}, titulo), h("span", {}, ` ${explica}`)),
  );
}

function previa(modelo: Modelo, inicio: DataISO): HTMLElement {
  const p = previaDoModelo(modelo, inicio);
  const ini = p.primeiras.reduce((m, x) => (x.inicio < m ? x.inicio : m), p.primeiras[0]?.inicio ?? inicio);
  const fim = p.primeiras.reduce((m, x) => (x.fim > m ? x.fim : m), p.primeiras[0]?.fim ?? inicio);
  const span = Math.max(1, diferencaDias(ini, fim) + 1);
  const px = (dias: number) => `${Math.round((dias / span) * 120)}px`;
  const resto = p.etapas - p.primeiras.length;
  return h(
    "div",
    { class: "prj-previa" },
    h(
      "div",
      { class: "prj-previa-t" },
      h(
        "span",
        {},
        `${plural(p.etapas, "etapa", "etapas")} em ${plural(p.fases, "fase", "fases")} · datas em dias úteis, pulando feriados`,
      ),
      p.termina ? h("b", {}, ` termina em ${dataLonga(p.termina)}`) : null,
    ),
    ...p.primeiras.map((x) =>
      h(
        "div",
        { class: "prj-previa-e" },
        h("span", {
          class: "prj-previa-barra",
          style: `margin-left:${px(diferencaDias(ini, x.inicio))};width:${px(Math.max(1, diferencaDias(x.inicio, x.fim) + 1))}`,
        }),
        h("span", { class: "prj-previa-nome" }, x.nome),
        h("span", { class: "prj-previa-d" }, ` ${dataCurta(x.inicio)} → ${dataCurta(x.fim)}`),
      ),
    ),
    resto > 0 ? h("div", { class: "prj-previa-e prj-previa-mais" }, `… e mais ${plural(resto, "etapa", "etapas")}`) : null,
  );
}

export function abrirDialogoProjeto(c: ContextoDialogoProjeto): { fechar(): void } {
  const p = c.projeto?.projeto;
  const erros = caixaDeErros();
  const nome = h("input", { type: "text", class: "spro-campo", name: "nome", maxlength: String(LIMITES.nome), value: p?.nome ?? "" });
  const proc = campoProcesso({ rotulo: "Processo SEI", atual: p?.processo, vazio: "Nenhum", processos: c.processos });
  const visAtual: Vis = c.projeto?.vis ?? "unidade";
  const cartoes = h(
    "div",
    { class: "prj-opcoes", role: "radiogroup", "aria-label": "Quem vê" },
    cartao(
      "unidade",
      visAtual === "unidade",
      `Toda a unidade (${c.sigla})`,
      `Quem usa o SEI Pro na ${c.sigla} vê e edita. Fica no Texto Padrão da unidade.`,
    ),
    cartao("eu", visAtual === "eu", "Só eu", "Aparece só para você, nesta unidade. Dá para mudar depois."),
  );
  const visEscolhida = (): Vis => (cartoes.querySelector<HTMLInputElement>("input[value='eu']")?.checked ? "eu" : "unidade");

  // "Começar" (só no novo).
  let deModelo = !p && !!c.comecarDeModelo;
  const modelo = criarCombo({
    rotulo: "Modelo",
    opcoes: () =>
      c.modelos.map((m) => ({
        valor: m.id,
        rotulo: m.nome,
        descricao: `${plural(m.etapas.length, "etapa", "etapas")}${m.descricao ? ` · ${m.descricao}` : ""}`,
      })),
    valor: c.modelos[0] ? [c.modelos[0].id] : [],
    vazio: "Escolher um modelo…",
    busca: c.modelos.length > 7,
    larguraLista: 340,
    aoMudar: () => pintarPrevia(),
  });
  const comeca = h("input", { type: "date", class: "spro-campo", name: "comeca", value: c.hoje });
  const caixaPrevia = h("div", {});
  const modeloEscolhido = () => c.modelos.find((m) => m.id === modelo.valor()[0]);
  const pintarPrevia = () => {
    const m = modeloEscolhido();
    const inicio = dataDeFormulario(comeca.value);
    caixaPrevia.replaceChildren(
      !inicio
        ? h("div", { class: "prj-previa" }, "Informe uma data válida (entre 2000 e 2100).")
        : m
          ? previa(m, inicio)
          : h("div", { class: "prj-previa" }, "Escolha um modelo."),
    );
  };
  comeca.addEventListener("input", pintarPrevia);
  const bloco = h(
    "div",
    { class: "prj-form prj-bloco-modelo", hidden: !deModelo },
    linhaDeCampos(campo("Modelo", modelo.el, { classe: "prj-campo-largo" }), campo("Começa em", comeca)),
    caixaPrevia,
  );
  const botoesComecar = [
    h("button", { type: "button", "aria-pressed": String(!deModelo), onclick: () => comecar(false) }, "Em branco"),
    h("button", { type: "button", "aria-pressed": String(deModelo), onclick: () => comecar(true) }, "De um modelo"),
  ];
  const comecar = (m: boolean) => {
    deModelo = m;
    botoesComecar[0]?.setAttribute("aria-pressed", String(!m));
    botoesComecar[1]?.setAttribute("aria-pressed", String(m));
    bloco.hidden = !m;
  };
  pintarPrevia();

  let modal: { fechar(): void } | null = null;
  // Arquivar/Reativar/Duplicar/Excluir: fecha só se deu certo; a falha fica no diálogo; desistir (false) não fecha.
  let ocupado = false;
  const executar = (f?: () => Promise<unknown>) => async () => {
    if (!f || ocupado) return;
    ocupado = true;
    try {
      if ((await f()) !== false) modal?.fechar();
    } catch (e) {
      erros.mostrar(mensagensDoErro(e));
    } finally {
      ocupado = false;
    }
  };
  const validar = (): string[] => {
    const m: string[] = [];
    if (!nome.value.trim()) m.push("Informe o nome do projeto.");
    if (proc.invalido()) m.push(ERRO_PROTOCOLO);
    if (!p && deModelo) {
      if (!modeloEscolhido()) m.push("Escolha um modelo.");
      if (!dataDeFormulario(comeca.value)) m.push("Informe uma data válida (entre 2000 e 2100).");
    }
    return m;
  };
  const salvar = h("button", { type: "button", class: "spro-botao primario" }, p ? "Salvar" : "Criar projeto");
  salvar.addEventListener("click", async () => {
    const m = validar();
    erros.mostrar(m);
    if (m.length) return;
    const r: ResultadoProjeto = { nome: nome.value.trim(), vis: visEscolhida() };
    const v = proc.vinculo();
    if (v) r.processo = v;
    const md = modeloEscolhido();
    if (!p && deModelo && md) r.modelo = { modelo: md, inicio: dataDeFormulario(comeca.value)! };
    salvar.disabled = true;
    try {
      if ((await c.salvar(r)) !== false) modal?.fechar();
    } catch (e) {
      erros.mostrar(mensagensDoErro(e));
    } finally {
      salvar.disabled = false;
    }
  });
  const menu = p
    ? criarMenu({
        rotulo: "Mais ações do projeto",
        classe: "spro-botao-icone spro-esquerda",
        itens: (): EntradaMenu[] => [
          p.arquivadoEm === undefined
            ? { rotulo: "Arquivar", icone: "pasta", fazer: executar(c.arquivar) }
            : { rotulo: "Reativar", icone: "restaurar", fazer: executar(c.reativar) },
          { rotulo: "Duplicar", icone: "copiar", fazer: executar(c.duplicar) },
          { rotulo: "Salvar como modelo…", icone: "camadas", fazer: () => c.salvarComoModelo?.() },
          c.redefinirPlano && c.projeto?.etapas.some(planoParaRedefinir)
            ? { rotulo: "Redefinir plano original", icone: "calendario", fazer: executar(c.redefinirPlano) }
            : null,
          "-",
          { rotulo: "Excluir", icone: "lixeira", perigo: true, fazer: executar(c.excluir) },
        ],
      })
    : null;
  const conteudo = h(
    "div",
    { class: "prj-form prj-form-projeto" },
    campo("Nome do projeto", nome),
    campo("Processo SEI", proc.combo.el, {
      opcional: "(opcional)",
      dica: "Sugere os processos da sua caixa; aceita qualquer número digitado.",
    }),
    campo("Quem vê", cartoes),
    p ? null : campo("Começar", h("div", { class: "spro-segmentado" }, ...botoesComecar)),
    p ? null : bloco,
    erros.el,
    h(
      "div",
      { class: "spro-dialogo-rodape" },
      menu,
      h("button", { type: "button", class: "spro-botao", onclick: () => modal?.fechar() }, "Cancelar"),
      salvar,
    ),
  );
  modal = c.abrirModal({ titulo: p ? "Editar projeto" : "Novo projeto", icone: "gantt", conteudo });
  return { fechar: () => modal?.fechar() };
}
