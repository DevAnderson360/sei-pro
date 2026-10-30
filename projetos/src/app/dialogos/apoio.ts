/**
 * Diálogos pequenos do P3: projetos arquivados (reativar, excluir), o
 * documento que comprova a conclusão ("Informar documento", do aviso de
 * concluída) e o nome do modelo ("Salvar como modelo").
 */

import { hojeISO } from "@comum/datas/dias";
import type { AbrirModal } from "@comum/ui/dialogo";
import { h, icone } from "@comum/ui/dom";
import { LIMITES } from "../../modelo/constantes";
import { documentoSemNumero } from "../../modelo/sigilo";
import type { DataISO, Etapa } from "../../modelo/tipos";
import type { DocumentoConferido } from "../../ponte/tipos";
import type { ProjetoNaTela } from "../dados";
import { dataDeFormulario, dataLonga, dataValida } from "../formato";
import { caixaDeErros, campo, campoDocumento, DICA_DOCUMENTO_SEM_NUMERO, ERRO_DOCUMENTO, linhaDeCampos, mensagensDoErro } from "./campos";

/** Ids dos nomes das linhas (para o `aria-describedby` dos botões): únicos na página. */
let seqNome = 0;

/**
 * Reativar e Excluir tiram o projeto da lista quando a promessa resolve. A confirmação (ou o
 * "Desfazer") é de quem chama: resolver `false` (o usuário desistiu) deixa o projeto na lista, sem
 * mensagem; rejeitar mostra o erro e também deixa. Os dois botões se repetem em cada linha:
 * `aria-describedby` aponta para o nome do projeto da linha.
 */
export function abrirArquivados(c: {
  abrirModal: AbrirModal;
  arquivados: readonly ProjetoNaTela[];
  reativar(id: string): Promise<unknown>;
  excluir(id: string): Promise<unknown>;
}): { fechar(): void } {
  const erros = caixaDeErros();
  const lista = h("div", { class: "prj-arquivados" });
  const raiz = h("div", {}, lista, erros.el);
  let restantes = [...c.arquivados];
  let ocupado = false;
  const pintar = () => {
    lista.replaceChildren(
      ...(restantes.length
        ? restantes.map((p) => {
            const tirar = (fazer: (id: string) => Promise<unknown>) => async () => {
              if (ocupado) return;
              ocupado = true;
              try {
                const feito = await fazer(p.projeto.id);
                erros.mostrar([]);
                if (feito === false) return;
                restantes = restantes.filter((x) => x !== p);
                pintar();
              } catch (e) {
                erros.mostrar(mensagensDoErro(e));
              } finally {
                ocupado = false;
              }
            };
            const idNome = `arquivado-nome-${++seqNome}`;
            const quando = p.projeto.arquivadoEm ?? 0;
            return h(
              "div",
              { class: "prj-arquivado" },
              icone(p.vis === "unidade" ? "predio" : "pessoa", 15),
              h(
                "div",
                { class: "prj-arquivado-nome" },
                h("b", { id: idNome }, p.projeto.nome),
                h("span", {}, dataValida(quando) ? ` arquivado em ${dataLonga(hojeISO(new Date(quando)))}` : " arquivado"),
              ),
              h(
                "button",
                { type: "button", class: "spro-botao pequeno", "aria-describedby": idNome, onclick: tirar(c.reativar) },
                "Reativar",
              ),
              h(
                "button",
                { type: "button", class: "spro-botao fantasma perigo pequeno", "aria-describedby": idNome, onclick: tirar(c.excluir) },
                "Excluir",
              ),
            );
          })
        : [h("p", { class: "prj-dica" }, "Nenhum projeto arquivado.")]),
    );
  };
  pintar();
  return c.abrirModal({ titulo: "Projetos arquivados", icone: "pasta", conteudo: raiz });
}

/**
 * "Informar documento": o número e a data da conclusão. `salvar` recebe o número digitado (undefined = campo
 * vazio; o que não passa na regra do número não salva: "Número de documento inválido."); quando a etapa só tem o marcador do texto (documento de processo sigiloso sem o número), o diálogo
 * diz isso, e quem chama mantém o marcador com o campo vazio.
 */
export function abrirInformarDocumento(c: {
  abrirModal: AbrirModal;
  etapa: Etapa;
  hoje: DataISO;
  conferirDocumento?: (numero: string) => Promise<DocumentoConferido | null>;
  salvar(numero: string | undefined, concluidaEm: DataISO): Promise<void>;
}): { fechar(): void } {
  const erros = caixaDeErros();
  const semNumero = documentoSemNumero(c.etapa.documento);
  const doc = campoDocumento(c.etapa.documento?.numero ?? "", c.conferirDocumento, undefined, { semNumero });
  const data = h("input", { type: "date", class: "spro-campo", name: "concluida", value: c.etapa.concluidaEm ?? c.hoje });
  let modal: { fechar(): void } | null = null;
  const salvar = h("button", { type: "button", class: "spro-botao primario" }, "Salvar");
  let ocupado = false;
  salvar.addEventListener("click", async () => {
    if (ocupado) return;
    const d = dataDeFormulario(data.value);
    const m = [...(doc.invalido() ? [ERRO_DOCUMENTO] : []), ...(d ? [] : ["Informe uma data válida (entre 2000 e 2100)."])];
    erros.mostrar(m);
    if (m.length || !d) return;
    ocupado = true;
    try {
      await c.salvar(doc.numero() || undefined, d);
      modal?.fechar();
    } catch (e) {
      erros.mostrar(mensagensDoErro(e));
    } finally {
      ocupado = false;
    }
  });
  const conteudo = h(
    "div",
    { class: "prj-form prj-form-documento" },
    campo("Número SEI", doc.el, { dica: semNumero ? DICA_DOCUMENTO_SEM_NUMERO : undefined }),
    linhaDeCampos(campo("Concluída em", data), salvar),
    erros.el,
  );
  modal = c.abrirModal({ titulo: "Documento que comprova a conclusão", icone: "documento", conteudo });
  return { fechar: () => modal?.fechar() };
}

export function pedirNomeDoModelo(c: { abrirModal: AbrirModal; sugestao: string; salvar(nome: string): Promise<void> }): {
  fechar(): void;
} {
  const erros = caixaDeErros();
  const nome = h("input", { type: "text", class: "spro-campo", maxlength: String(LIMITES.nome), value: c.sugestao });
  let modal: { fechar(): void } | null = null;
  const salvar = h("button", { type: "button", class: "spro-botao primario" }, "Salvar modelo");
  let ocupado = false;
  salvar.addEventListener("click", async () => {
    if (ocupado) return;
    if (!nome.value.trim()) return erros.mostrar(["Informe o nome do modelo."]);
    ocupado = true;
    try {
      await c.salvar(nome.value.trim());
      modal?.fechar();
    } catch (e) {
      erros.mostrar(mensagensDoErro(e));
    } finally {
      ocupado = false;
    }
  });
  const conteudo = h(
    "div",
    { class: "prj-form prj-form-modelo" },
    campo("Nome do modelo", nome, { dica: "As datas viram dias úteis contados do início: dá para usar em outro projeto." }),
    erros.el,
    h(
      "div",
      { class: "spro-dialogo-rodape" },
      h("button", { type: "button", class: "spro-botao", onclick: () => modal?.fechar() }, "Cancelar"),
      salvar,
    ),
  );
  modal = c.abrirModal({ titulo: "Salvar como modelo", icone: "camadas", conteudo });
  return { fechar: () => modal?.fechar() };
}
