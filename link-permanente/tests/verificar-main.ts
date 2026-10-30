/**
 * Entrada da janela (src/app/main.ts) sem `chrome.storage`: o diálogo tem de abrir mesmo assim, porque é por ele
 * que o usuário fecha o iframe transparente que cobre a tela do SEI. Importa o módulo de verdade (efeitos no topo),
 * com DOM do linkedom, `chrome.runtime` falso e a aba respondendo por um par de portas em memória.
 *
 * Roda por último: troca `document`, `location` e `chrome` globais.
 */

import { parDePortas } from "@comum/ponte/parDePortas";
import { criarRpc } from "@comum/ponte/rpc";
import { CANAL_LINK_PERMANENTE } from "../src/modelo/constantes";
import { checar, instalarDom, secao, tique } from "./util";

type Global = Record<string, unknown>;

export async function verificarMain(): Promise<void> {
  secao("main: sem chrome.storage o diálogo ainda abre");
  const doc = instalarDom('<html><body><div id="app"></div></body></html>');
  const proto = Object.getPrototypeOf(doc.createElement("dialog")) as Record<string, unknown>;
  proto.showModal = function (this: HTMLElement) {
    this.setAttribute("open", "");
  };
  proto.close = function (this: HTMLElement) {
    this.removeAttribute("open");
  };
  Object.defineProperty(proto, "open", {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute("open");
    },
  });
  const g = globalThis as Global;
  const antes = { chrome: g.chrome, location: g.location };
  const ouvintes: Array<(p: unknown) => void> = [];
  // Sem `storage`: o que importa é o módulo não morrer antes de montar o diálogo.
  g.chrome = { runtime: { onConnect: { addListener: (f: (p: unknown) => void) => void ouvintes.push(f) } }, tabs: {} };
  g.location = { hash: "#modo=modal&tema=claro" };
  // A origem do pai é lida ao carregar o módulo: é por ela que a porta da aba é aceita (sem chrome.tabs).
  Object.defineProperty(doc, "referrer", { configurable: true, value: "https://sei.x.gov.br/sei/controlador.php" });
  let erroImport: unknown = null;
  try {
    await import("../src/app/main");
  } catch (e) {
    erroImport = e;
  }
  checar("o módulo carrega sem chrome.storage", erroImport === null, String(erroImport));
  const dlg = () => doc.querySelector("dialog.lp-modal");
  checar("o diálogo é montado", !!dlg());

  // A aba conecta (mesma origem do pai, frame de topo) e responde o contexto.
  const [doApp, daAba] = parDePortas();
  criarRpc(daAba, { contexto: () => ({ host: "sei.x.gov.br", login: "ana", temaEscuro: false }) });
  const porta = Object.assign(doApp, {
    name: CANAL_LINK_PERMANENTE,
    sender: { frameId: 0, tab: { id: 1 }, url: "https://sei.x.gov.br/sei/" },
  });
  for (const f of ouvintes) f(porta);
  for (let i = 0; i < 100 && !dlg()?.hasAttribute("open"); i += 1) await tique(2);
  checar("o diálogo abre", dlg()?.hasAttribute("open") === true);

  g.chrome = antes.chrome;
  g.location = antes.location;
  for (const k of ["showModal", "close", "open"]) Reflect.deleteProperty(proto, k);
}
