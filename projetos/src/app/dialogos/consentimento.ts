/**
 * Os dois consentimentos do Texto Padrão (spec 6.1), no desenho dos Favoritos:
 * - "Toda a unidade": aviso ÚNICO, só "Entendi" (vale como consentimento), na
 *   primeira gravação em "Toda a unidade" (criar, editar, mover, receber,
 *   importar) ou quando há alterações esperando por ele (faixa);
 * - "Só eu": faixa-convite ("Ligar…" | "Agora não") e o diálogo com os pontos.
 * Fechar pelo X ou Esc é "não": nada é gravado no SEI. Sigla e nome do texto
 * entram como texto (`h()`).
 */

import type { AbrirModal } from "@comum/ui/dialogo";
import { h } from "@comum/ui/dom";

const botao = (rotulo: string, classe: string, fazer: () => void) => h("button", { type: "button", class: classe, onclick: fazer }, rotulo);

/** "Entendi" = true; X ou Esc = false. */
export function avisoDaUnidade(c: { abrirModal: AbrirModal; sigla: string; nomeTexto: string }): Promise<boolean> {
  return new Promise((ok) => {
    let resposta = false;
    let modal: { fechar(): void } | null = null;
    const conteudo = h(
      "div",
      { class: "prj-consentimento" },
      h(
        "p",
        {},
        `Os projetos de “Toda a unidade” ficam guardados no próprio SEI, num Texto Padrão da ${c.sigla} chamado “${c.nomeTexto}”. Todos da unidade que usam o SEI Pro veem e editam esses projetos.`,
      ),
      h(
        "ul",
        {},
        h("li", {}, `Qualquer pessoa da ${c.sigla} pode abrir esse texto na lista de Textos Padrão.`),
        h("li", {}, "Não use esse texto em documentos e não o edite: o SEI Pro o regrava sozinho."),
        h("li", {}, "O número de processo sigiloso nunca vai para o SEI: fica só neste navegador."),
        h("li", {}, "Para um projeto só seu, escolha “Só eu”."),
      ),
      h(
        "div",
        { class: "spro-dialogo-rodape" },
        botao("Entendi", "spro-botao primario", () => {
          resposta = true;
          modal?.fechar();
        }),
      ),
    );
    modal = c.abrirModal({ titulo: "Projetos de toda a unidade", icone: "predio", conteudo, aoFechar: () => ok(resposta) });
  });
}

/** "Ligar" = true; "Agora não", X ou Esc = false. */
export function pedirConsentimentoPessoal(c: { abrirModal: AbrirModal; sigla: string; nomeTexto: string }): Promise<boolean> {
  return new Promise((ok) => {
    let resposta = false;
    let modal: { fechar(): void } | null = null;
    const conteudo = h(
      "div",
      { class: "prj-consentimento" },
      h(
        "p",
        {},
        `Seus projetos de “Só eu” ficam guardados no próprio SEI, num Texto Padrão chamado “${c.nomeTexto}”, e aparecem em qualquer computador em que você usar o SEI Pro. Antes de ligar:`,
      ),
      h(
        "ul",
        {},
        h("li", {}, `O texto fica visível na lista de Textos Padrão da ${c.sigla}: qualquer pessoa da unidade pode abri-lo.`),
        h("li", {}, "Não use esse texto em documentos e não o edite: o SEI Pro o regrava sozinho."),
        h("li", {}, "O número de processo sigiloso nunca vai para o SEI."),
        h("li", {}, "Para desligar, use “Sincronização…” no menu. Lá você também pode apagar o texto do SEI na hora."),
      ),
      h(
        "div",
        { class: "spro-dialogo-rodape" },
        botao("Agora não", "spro-botao", () => modal?.fechar()),
        botao("Ligar", "spro-botao primario", () => {
          resposta = true;
          modal?.fechar();
        }),
      ),
    );
    modal = c.abrirModal({ titulo: "Guardar no SEI", icone: "nuvem", conteudo, aoFechar: () => ok(resposta) });
  });
}

/** Faixa-convite do texto pessoal (só aparece com projeto "Só eu" e sem resposta ainda). */
export function faixaConvite(c: { aoLigar(): void; aoRecusar(): void }): HTMLElement {
  return h(
    "div",
    { class: "prj-faixa", role: "note", "data-faixa": "convite" },
    h("span", {}, "Guarde seus projetos pessoais no SEI para vê-los em outro computador."),
    botao("Ligar…", "spro-botao primario pequeno", c.aoLigar),
    botao("Agora não", "spro-botao pequeno", c.aoRecusar),
  );
}

/**
 * Há alterações em "Toda a unidade" esperando o "Entendi" (vieram de um caminho sem a pergunta). Aparece sozinha,
 * depois de uma rodada da sincronia: `role="status"` faz o leitor de tela anunciá-la.
 */
export function faixaAguardando(c: { sigla: string; aoEntendi(): void }): HTMLElement {
  return h(
    "div",
    { class: "prj-faixa", role: "status", "data-faixa": "aguardando" },
    h(
      "span",
      {},
      `Os projetos de “Toda a unidade” ficam num Texto Padrão que toda a ${c.sigla} vê. Suas alterações ainda não foram gravadas no SEI.`,
    ),
    botao("Entendi", "spro-botao primario pequeno", c.aoEntendi),
  );
}
