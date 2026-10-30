/**
 * Os dois consentimentos do Texto Padrão (spec 4.3 e 4.6):
 * - "Toda a unidade": faixa com "Entendi" (vale como consentimento), na primeira vez que o escopo é usado;
 * - "Só eu": faixa-convite ("Ligar…" | "Agora não") e o diálogo com os pontos; fechar pelo X ou Esc é "não".
 */

import type { AbrirModal } from "@comum/ui/dialogo";
import { h, icone } from "@comum/ui/dom";

export const TEXTO_CONSENTIMENTO_UNIDADE =
  "Suas demandas da unidade ficam no Texto Padrão do SEI, visível a toda a unidade. Não escreva dados sigilosos no título ou na descrição.";
export const TEXTO_CONVITE_PESSOAL = "Guardar minhas demandas pessoais no SEI";

/** A faixa do aviso único da unidade: o botão "Entendi" liga a sincronização. */
export function faixaConsentimentoUnidade(c: { aoEntendi(): void }): HTMLElement {
  return h(
    "div",
    { class: "dem-faixa aviso", role: "status", "data-faixa": "consentimento" },
    icone("alerta", 16),
    h("span", { class: "dem-faixa-texto" }, TEXTO_CONSENTIMENTO_UNIDADE),
    h("button", { type: "button", class: "spro-botao primario pequeno", onclick: c.aoEntendi }, "Entendi"),
  );
}

/** O convite do texto pessoal (só aparece com demanda "Só eu" e sem resposta ainda). */
export function faixaConvitePessoal(c: { aoLigar(): void; aoRecusar(): void }): HTMLElement {
  return h(
    "div",
    { class: "dem-faixa", role: "note", "data-faixa": "convite" },
    icone("nuvem", 16),
    h("span", { class: "dem-faixa-texto" }, TEXTO_CONVITE_PESSOAL),
    h("button", { type: "button", class: "spro-botao primario pequeno", onclick: c.aoLigar }, "Ligar…"),
    h("button", { type: "button", class: "spro-botao pequeno", onclick: c.aoRecusar }, "Agora não"),
  );
}

/** "Ligar" = true; X ou Esc = false. */
export function pedirConsentimentoPessoal(c: { abrirModal: AbrirModal; sigla: string; nomeTexto: string }): Promise<boolean> {
  return new Promise((ok) => {
    let resposta = false;
    let modal: { fechar(): void } | null = null;
    const conteudo = h(
      "div",
      { class: "dem-consentimento" },
      h(
        "p",
        {},
        `Suas demandas de “Só eu” ficam guardadas no próprio SEI, em Textos Padrão cujo nome começa com “${c.nomeTexto}”, e aparecem em qualquer computador em que você usar o SEI Pro. Antes de ligar:`,
      ),
      h(
        "ul",
        {},
        h("li", {}, `Os textos ficam visíveis na lista de Textos Padrão da ${c.sigla}: qualquer pessoa da unidade pode abri-los.`),
        h("li", {}, "Não use esses textos em documentos e não os edite: o SEI Pro os regrava sozinho."),
        h("li", {}, "Não escreva dados sigilosos no título ou na descrição. O número de processo sigiloso nunca vai para o SEI."),
        h("li", {}, "Para desligar, use “Sincronização…” no menu. Lá você também pode apagar os textos do SEI na hora."),
      ),
      h(
        "div",
        { class: "spro-dialogo-rodape" },
        h(
          "button",
          {
            type: "button",
            class: "spro-botao primario",
            onclick: () => {
              resposta = true;
              modal?.fechar();
            },
          },
          "Ligar",
        ),
      ),
    );
    modal = c.abrirModal({ titulo: "Guardar no SEI", icone: "nuvem", conteudo, aoFechar: () => ok(resposta) });
  });
}
