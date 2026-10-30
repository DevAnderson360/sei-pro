/**
 * O painel "Favoritos" abaixo da lista do Controle de Processos. É um iframe
 * da própria extensão (html/favoritos.html), e não HTML injetado: o app roda
 * na origem da extensão (chrome.storage direto, CSS isolado do SEI) e é o
 * MESMO app do painel lateral da F2. Container e id são os do legado
 * (#panelHomePro, #favoritesPro), para valer a ordem entre painéis que o
 * usuário já escolheu. A montagem é a genérica da sei-comum (`@comum/painel/embutido`).
 */

import { montarPainelEmbutido, ordemLegada as ordemDoPainel, type PainelMontado } from "@comum/painel/embutido";
import { icone } from "@comum/ui/dom";
import { instalarEstilo } from "./estilo";

export { copiarLetraDoTitulo, igualarAoTituloDoSei, inserirNaOrdem, type PainelMontado } from "@comum/painel/embutido";

export const ID_PAINEL = "favoritesPro";

export function ordemLegada(armazenamento: Pick<Storage, "getItem">): number | null {
  return ordemDoPainel(armazenamento, ID_PAINEL);
}

export interface OpcoesPainel {
  urlApp: string;
  /**
   * Mesmo esquema de cor do app: com esquemas diferentes, o navegador pinta um
   * fundo opaco atrás do iframe, e o diálogo sobreposto não teria fundo transparente.
   */
  temaEscuro?: boolean;
  recolhido: boolean;
  ordem: number | null;
  aoRecolher(recolhido: boolean): void;
}

export function montarPainel(doc: Document, o: OpcoesPainel): PainelMontado | null {
  return montarPainelEmbutido(doc, {
    ...o,
    id: ID_PAINEL,
    titulo: "Monitorados",
    tituloIframe: "Monitorados do SEI Pro",
    prefixo: "spro-fav",
    rotulos: { mostrar: "Mostrar monitorados", recolher: "Recolher monitorados" },
    icone: () => {
      const estrela = icone("alvoAtivo", 20);
      estrela.setAttribute("style", "color:#e0a100");
      return estrela;
    },
    // O CSS das estrelas já traz o do título, do recolher e do aviso (spro-fav-*).
    estilo: instalarEstilo,
  });
}
