/**
 * A tela do anexo do chat: o chip (nome, páginas, tamanho, cortar, remover),
 * o andamento da leitura de um PDF e o aviso antes de um OCR longo.
 */

import { aplicarModo, faixas, type Anexo, type PlanoLeitura } from "./anexo";
import { h, icone } from "./dom";
import type { AbrirModal } from "./mcp-ui";
import type { EtapaLeitura } from "./pdf";

const milhar = (n: number) => n.toLocaleString("pt-BR");

export function chipDoAnexo(a: Anexo, acoes: { remover(): void; cortar(): void }): HTMLElement {
  const r = aplicarModo(a);
  const descricao = `${a.nome} — ${a.paginas ? `${a.paginas} páginas · ` : ""}${milhar(a.texto.length)} caracteres`;
  return h(
    "div",
    { class: "anexo-cartao" },
    h(
      "div",
      { class: "anexo" },
      icone("clipe", 13),
      h("span", { title: descricao }, descricao),
      r.podeCortar ? h("button", { class: "plana pequeno", onclick: () => acoes.cortar() }, "Cortar em 60 mil") : null,
      h("button", { class: "icone pequeno", title: "Remover anexo", "aria-label": "Remover anexo", onclick: () => acoes.remover() }, icone("fechar", 14)),
    ),
    r.aviso ? h("div", { class: "anexo-aviso" }, r.aviso) : null,
    a.naoLidas?.length ? h("div", { class: "anexo-aviso" }, textoNaoLidas(a.naoLidas, a.motivoNaoLidas)) : null,
  );
}

/** "4 páginas não foram lidas (2–4, 30): este navegador não faz OCR." */
function textoNaoLidas(ns: number[], motivo?: string): string {
  const inicio = ns.length === 1 ? "1 página não foi lida" : `${ns.length} páginas não foram lidas`;
  return `${inicio} (${faixas(ns)})${motivo ? `: ${motivo}` : ""}.`;
}

function textoDaEtapa(e: EtapaLeitura): string {
  if (e.fase === "abrindo") return "Abrindo…";
  if (e.fase === "texto") return `Lendo o texto: página ${e.feitas} de ${e.total}`;
  return `OCR: página ${e.feitas} de ${e.total}`;
}

export function andamentoDoAnexo(nome: string, cancelar: () => void): { elemento: HTMLElement; atualizar(e: EtapaLeitura): void } {
  const etapa = h("span", {}, "Abrindo…");
  const elemento = h(
    "div",
    { class: "anexo", role: "status" },
    icone("relogio", 13),
    h("span", { title: nome }, nome),
    etapa,
    h("button", { class: "plana pequeno", onclick: () => cancelar() }, "Cancelar leitura"),
  );
  return { elemento, atualizar: (e) => void (etapa.textContent = textoDaEtapa(e)) };
}

/** Aviso antes do OCR longo: "Continuar" segue; "Não ler as digitalizadas", X ou Esc cancelam. */
export function confirmarOcrLongo(abrirModal: AbrirModal, p: PlanoLeitura): Promise<boolean> {
  return new Promise((resolver) => {
    let decidido = false;
    const decidir = (v: boolean) => {
      if (decidido) return;
      decidido = true;
      resolver(v);
      dlg.close();
    };
    const continuar = h("button", { class: "primario" }, "Continuar");
    const pular = h("button", {}, "Não ler as digitalizadas");
    const dlg = abrirModal({
      titulo: "PDF digitalizado",
      corpo: [
        h(
          "p",
          {},
          `Este PDF tem ${p.paraOcr.length} páginas digitalizadas. O reconhecimento de texto (OCR) roda neste computador e pode deixá-lo lento por alguns minutos.`,
        ),
      ],
      acoes: [pular, continuar],
    });
    continuar.addEventListener("click", () => decidir(true));
    pular.addEventListener("click", () => decidir(false));
    dlg.addEventListener("close", () => decidir(false));
  });
}
