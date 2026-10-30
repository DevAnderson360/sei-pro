/**
 * Diálogo "Modelos de projeto" (spec 3.2): a lista (os 3 embutidos e os
 * salvos, com onde estão), renomear na própria linha e excluir com
 * confirmação (só os salvos) e "Criar projeto", que fecha este diálogo e
 * abre o "Novo projeto" já no modelo. "Salvar como modelo" fica no Editar
 * projeto (P3).
 *
 * Renomear e excluir chegam prontos de quem abre (`ContextoModelos`): no
 * escopo "Toda a unidade" eles passam pelo "Entendi" (o repositório com o
 * consentimento); a recusa aparece aqui, como os outros erros. O nome do
 * modelo vem do texto da unidade e entra sempre como texto. Os botões se
 * repetem em cada linha: `aria-describedby` aponta para o nome da linha (o
 * leitor de tela diz "Excluir, Pregão").
 */

import type { AbrirModal } from "@comum/ui/dialogo";
import { h, icone } from "@comum/ui/dom";
import { LIMITES } from "../../modelo/constantes";
import { rotuloDaVis } from "../../modelo/escopo";
import { ErroValidacao } from "../../modelo/validacao";
import { ehEmbutido } from "../../modelos/embutidos";
import type { ModeloNaTela } from "../dados";
import { plural } from "../formato";
import { caixaDeErros, mensagensDoErro } from "./campos";

export interface ContextoModelos {
  abrirModal: AbrirModal;
  modelos: readonly ModeloNaTela[];
  confirmar(texto: string, rotuloOk?: string): Promise<boolean>;
  /** Pode devolver o modelo gravado (o nome limpo pelo repositório é o que a linha mostra). */
  renomear(m: ModeloNaTela, nome: string): Promise<unknown>;
  excluir(m: ModeloNaTela): Promise<unknown>;
  /** Abre o "Novo projeto" com este modelo (este diálogo já fechou). */
  criarProjeto(m: ModeloNaTela): void;
}

/** "9 etapas em 3 fases · exemplo do SEI Pro · descrição" (sem fases: só as etapas). */
function detalhe(m: ModeloNaTela): string {
  const etapas = plural(m.etapas.length, "etapa", "etapas");
  const tamanho = m.fases.length ? `${etapas} em ${plural(m.fases.length, "fase", "fases")}` : etapas;
  const onde = ehEmbutido(m.id) ? "exemplo do SEI Pro" : m.vis ? rotuloDaVis(m.vis) : "";
  return [tamanho, onde, m.descricao ?? ""].filter(Boolean).join(" · ");
}

/** O nome que o repositório gravou (quando devolve o modelo); senão, o digitado. */
function nomeGravado(r: unknown, digitado: string): string {
  const nome = (r as { nome?: unknown } | null)?.nome;
  return typeof nome === "string" && nome ? nome : digitado;
}

/** Ids dos nomes das linhas (para o `aria-describedby` dos botões): únicos na página. */
let seqNome = 0;

export function abrirModelos(c: ContextoModelos): { fechar(): void } {
  const erros = caixaDeErros();
  const lista = h("div", { class: "prj-modelos" });
  let modelos = [...c.modelos];
  let modal: { fechar(): void } | null = null;
  let ocupado = false;
  const tentar = async (fazer: () => Promise<void>) => {
    if (ocupado) return;
    ocupado = true;
    try {
      await fazer();
      erros.mostrar([]);
    } catch (e) {
      erros.mostrar(mensagensDoErro(e));
    } finally {
      ocupado = false;
    }
  };
  /** Repinta e devolve o foco do teclado: ao botão `rotulo` da linha `id`, ou à linha que ficou no lugar `indice`. */
  const pintar = (foco?: { id?: string; rotulo?: string; indice?: number }) => {
    lista.replaceChildren(...modelos.map(linhaDoModelo));
    if (!foco) return;
    const linhas = [...lista.querySelectorAll<HTMLElement>(".prj-modelo")];
    const alvo =
      foco.id !== undefined ? linhas.find((l) => l.dataset.id === foco.id) : linhas[Math.min(foco.indice ?? 0, linhas.length - 1)];
    const botoes = [...(alvo?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    (botoes.find((b) => b.textContent === foco.rotulo) ?? botoes[0])?.focus();
  };
  const linhaDoModelo = (m: ModeloNaTela): HTMLElement => {
    const idNome = `modelo-nome-${++seqNome}`;
    const nome = h("b", { class: "prj-modelo-nome", id: idNome }, m.nome);
    const daLinha = { "aria-describedby": idNome };
    const linha = h(
      "div",
      { class: "prj-modelo", "data-id": m.id },
      icone("camadas", 16),
      h("div", { class: "prj-modelo-texto" }, nome, h("span", { class: "prj-dica", title: detalhe(m) }, detalhe(m))),
    );
    const criar = h(
      "button",
      {
        type: "button",
        class: "spro-botao pequeno",
        ...daLinha,
        onclick: () => {
          modal?.fechar();
          c.criarProjeto(m);
        },
      },
      "Criar projeto",
    );
    if (ehEmbutido(m.id)) {
      linha.append(criar);
      return linha;
    }
    const renomear = h("button", { type: "button", class: "spro-botao pequeno", ...daLinha }, "Renomear");
    renomear.addEventListener("click", () => {
      const campo = h("input", {
        type: "text",
        class: "spro-campo",
        maxlength: String(LIMITES.nome),
        value: m.nome,
        "aria-label": "Nome do modelo",
      });
      const salvar = () =>
        tentar(async () => {
          const novo = campo.value.trim();
          if (!novo) throw new ErroValidacao(["Informe o nome do modelo."]);
          if (novo !== m.nome) {
            const gravado = nomeGravado(await c.renomear(m, novo), novo);
            modelos = modelos.map((x) => (x === m ? { ...m, nome: gravado } : x));
          }
          pintar({ id: m.id, rotulo: "Renomear" });
        });
      const cancelar = () => {
        erros.mostrar([]);
        pintar({ id: m.id, rotulo: "Renomear" });
      };
      // Enter grava; Esc só desfaz a edição (sem o preventDefault, o Esc fecharia o diálogo inteiro).
      campo.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          void salvar();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          ev.stopPropagation();
          cancelar();
        }
      });
      nome.replaceWith(campo);
      for (const b of linha.querySelectorAll("button")) b.remove();
      linha.append(
        h("button", { type: "button", class: "spro-botao primario pequeno", onclick: () => void salvar() }, "Salvar"),
        h("button", { type: "button", class: "spro-botao pequeno", onclick: cancelar }, "Cancelar"),
      );
      campo.focus();
    });
    const excluir = h(
      "button",
      {
        type: "button",
        class: "spro-botao fantasma perigo pequeno",
        ...daLinha,
        onclick: () =>
          tentar(async () => {
            const onde = m.vis === "unidade" ? " para toda a unidade" : "";
            if (!(await c.confirmar(`Excluir o modelo “${m.nome}”${onde}? Os projetos criados com ele ficam.`, "Excluir"))) return;
            await c.excluir(m);
            const indice = modelos.indexOf(m);
            modelos = modelos.filter((x) => x !== m);
            pintar({ indice });
          }),
      },
      "Excluir",
    );
    linha.append(criar, renomear, excluir);
    return linha;
  };
  pintar();
  const conteudo = h(
    "div",
    { class: "prj-form prj-form-modelos" },
    h("p", { class: "prj-dica" }, "Para guardar um projeto como modelo, use “Salvar como modelo…” no Editar projeto."),
    erros.el,
    lista,
  );
  modal = c.abrirModal({ titulo: "Modelos de projeto", icone: "camadas", conteudo });
  return { fechar: () => modal?.fechar() };
}
