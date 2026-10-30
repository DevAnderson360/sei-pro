import { parDePortas } from "../src/ponte/parDePortas";
import { criarRpc, type PortaRpc, type Rpc } from "../src/ponte/rpc";
import {
  avisarNaPagina,
  type ConfigModal,
  criarControleModal,
  ligarAvisoSemModal,
  montarModal,
  PRAZO_CONTATO_MS,
} from "../src/ui/modalIframe";
import { checar, instalarDom, lanca, secao } from "./util";

const CFG: ConfigModal = {
  evento: "spro-teste-abrir",
  titulo: "Modal de teste",
  atributoIframe: "data-spro-teste-modal",
  seletorItemMenu: "#itemTeste",
  textoSemModal: "Recarregue a pagina.",
  classeAviso: "spro-teste-aviso",
};
const URL_APP = "chrome-extension://abc/html/teste.html#modo=modal";

const tique = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function tecla(el: Element, key: string): void {
  const Ev = (el.ownerDocument.defaultView as unknown as { Event: typeof Event }).Event;
  const ev = new Ev("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "key", { value: key });
  el.dispatchEvent(ev);
}

const evento = (doc: Document, tipo: string) => new (doc.defaultView as unknown as { Event: typeof Event }).Event(tipo);
const pedirAbertura = (doc: Document) => doc.dispatchEvent(evento(doc, CFG.evento));
const iframes = (doc: Document) => doc.querySelectorAll(`iframe[${CFG.atributoIframe}]`);

function relogioFalso() {
  const pendentes: Array<{ fazer: () => void; ms: number; cancelado: boolean }> = [];
  return {
    agendar: (fazer: () => void, ms: number) => {
      const p = { fazer, ms, cancelado: false };
      pendentes.push(p);
      return () => {
        p.cancelado = true;
      };
    },
    ativos: () => pendentes.filter((p) => !p.cancelado),
    vencer: () => {
      for (const p of pendentes.splice(0)) if (!p.cancelado) p.fazer();
    },
  };
}

export async function verificarModalIframe(): Promise<void> {
  secao("modalIframe: montarModal com configuracao");
  const doc = instalarDom("<html><body><p>SEI</p></body></html>");
  doc.body.style.overflow = "scroll";
  let fechou = 0;
  const m = montarModal(doc, CFG, { urlApp: URL_APP, temaEscuro: true, aoFechar: () => fechou++ });
  const fr = doc.querySelector<HTMLIFrameElement>(`iframe[${CFG.atributoIframe}]`);
  checar("iframe marcado pelo atributo e titulo da configuracao", !!fr && fr === m.iframe && fr.getAttribute("title") === CFG.titulo);
  checar(
    "tela cheia, por cima, fundo transparente e color-scheme",
    fr?.style.position === "fixed" &&
      fr.style.inset === "0" &&
      fr.style.background === "transparent" &&
      fr.style.getPropertyValue("color-scheme") === "dark",
    fr?.getAttribute("style"),
  );
  checar("trava a rolagem", doc.documentElement.style.overflow === "hidden" && doc.body.style.overflow === "hidden");
  checar("nasce nao minimizado", m.minimizado === false);

  m.minimizar(true);
  checar(
    "minimizar: pastilha 320x64 no canto inferior direito",
    fr?.style.width === "320px" &&
      fr.style.height === "64px" &&
      fr.style.right === "16px" &&
      fr.style.bottom === "16px" &&
      fr.style.position === "fixed",
    fr?.getAttribute("style"),
  );
  checar("minimizar: continua o color-scheme do tema", fr?.style.getPropertyValue("color-scheme") === "dark");
  checar("minimizar: iframe segue no documento", fr?.isConnected === true && m.minimizado);
  checar(
    "minimizar: destrava a rolagem com os valores de antes",
    doc.body.style.overflow === "scroll" && doc.documentElement.style.overflow === "",
    [doc.body.style.overflow, doc.documentElement.style.overflow],
  );
  m.minimizar(false);
  checar(
    "restaurar: volta a tela cheia",
    fr?.style.width === "100vw" && fr.style.height === "100vh" && fr.style.inset === "0" && !m.minimizado,
    fr?.getAttribute("style"),
  );
  checar("restaurar: trava a rolagem de novo", doc.documentElement.style.overflow === "hidden" && doc.body.style.overflow === "hidden");
  m.minimizar(true);
  m.fechar();
  checar(
    "fechar minimizado devolve os valores de antes",
    doc.body.style.overflow === "scroll" && doc.documentElement.style.overflow === "" && iframes(doc).length === 0 && fechou === 1,
  );
  m.minimizar(false);
  checar("minimizar depois de fechado nao faz nada", iframes(doc).length === 0 && doc.body.style.overflow === "scroll");
  checar("fechar duas vezes e inocuo", (await lanca(() => m.fechar())) === null && fechou === 1);

  secao("modalIframe: controle (abrir, fechar, Esc, foco, prazo)");
  const docT = instalarDom('<html><body><ul><li><a id="itemTeste" onclick="x()">Item</a></li></ul></body></html>');
  const item = docT.getElementById("itemTeste") as HTMLElement;
  let focos = 0;
  let tabindexNoFoco: string | null = null;
  item.focus = () => {
    focos++;
    tabindexNoFoco = item.getAttribute("tabindex");
  };
  const relogio = relogioFalso();
  let ladoApp: PortaRpc | null = null;
  let conexoes = 0;
  let conectarFalha = false;
  let urlFalha = false;
  let minimizarRecebido: ((m: boolean) => void) | null = null;
  let fecharRecebido: (() => void) | null = null;
  const controle = criarControleModal(docT, CFG, {
    urlApp: () => {
      if (urlFalha) throw new Error("Extension context invalidated.");
      return URL_APP;
    },
    temaEscuro: false,
    conectar: () => {
      if (conectarFalha) throw new Error("Extension context invalidated.");
      conexoes++;
      const [app, aba] = parDePortas();
      ladoApp = app;
      return aba;
    },
    tratadores: (fechar, minimizar) => {
      fecharRecebido = fechar;
      minimizarRecebido = minimizar;
      return {
        ping: () => "pong",
        fechar: () => {
          fechar();
          return true;
        },
        minimizar: (args) => {
          minimizar(!!(args as { minimizado?: boolean } | undefined)?.minimizado);
          return true;
        },
      };
    },
    agendar: relogio.agendar,
  });
  const carregar = async (): Promise<Rpc> => {
    const f = iframes(docT)[0];
    if (!f) throw new Error("sem iframe");
    f.dispatchEvent(evento(docT, "load"));
    const app = criarRpc(ladoApp!);
    await app.chamar("ping");
    return app;
  };

  pedirAbertura(docT);
  checar("o evento da configuracao abre o modal", iframes(docT).length === 1 && controle.aberto && !controle.minimizado);
  checar("prazo de contato de 8 s armado", PRAZO_CONTATO_MS === 8000 && relogio.ativos().length === 1 && relogio.ativos()[0]?.ms === 8000);
  pedirAbertura(docT);
  checar("abrir de novo nao duplica", iframes(docT).length === 1);
  const app1 = await carregar();
  checar("porta nova na carga do iframe", conexoes === 1 && app1.aberta);
  checar("primeiro pedido do app desarma o prazo", relogio.ativos().length === 0);
  checar("tratadores recebem fechar e minimizar", typeof fecharRecebido === "function" && typeof minimizarRecebido === "function");

  // Minimizar pelo app (o tratador `minimizar` do executor chama o callback do controle).
  await app1.chamar("minimizar", { minimizado: true });
  checar(
    "o app pede minimizar: pastilha, controle minimizado",
    controle.minimizado && iframes(docT)[0]?.getAttribute("style")?.includes("width:320px") === true,
    iframes(docT)[0]?.getAttribute("style"),
  );
  checar("minimizado: rolagem destravada", docT.body.style.overflow === "" && docT.documentElement.style.overflow === "");
  tecla(docT.body, "Escape");
  checar("minimizado: Esc na pagina NAO fecha", iframes(docT).length === 1 && controle.aberto && app1.aberta);
  await app1.chamar("minimizar", { minimizado: false });
  checar(
    "restaurar pelo app: tela cheia, rolagem travada",
    !controle.minimizado && docT.body.style.overflow === "hidden" && docT.documentElement.style.overflow === "hidden",
  );
  controle.minimizar(true);
  checar("controle.minimizar(true) tambem minimiza", controle.minimizado);
  controle.minimizar(false);
  tecla(docT.body, "Escape");
  checar("restaurado: Esc fecha de novo", iframes(docT).length === 0 && !controle.aberto);
  checar("Esc destrava a rolagem", docT.documentElement.style.overflow === "" && docT.body.style.overflow === "");
  checar("fechar devolve o foco ao item do menu (seletor da configuracao)", focos === 1);
  checar("item sem href ganha tabindex=-1 antes do foco", tabindexNoFoco === "-1" && !item.hasAttribute("href"));
  await tique();
  checar("fechar derruba a porta", !app1.aberta);
  checar("minimizado nao vaza para a proxima abertura", controle.minimizado === false);
  controle.minimizar(true);
  checar("minimizar sem modal aberto nao faz nada", !controle.minimizado && iframes(docT).length === 0);

  pedirAbertura(docT);
  const app2 = await carregar();
  await app2.chamar("minimizar", { minimizado: true });
  ladoApp!.disconnect();
  await tique();
  checar(
    "porta caida com o modal minimizado: sai e destrava",
    iframes(docT).length === 0 && !controle.aberto && docT.body.style.overflow === "",
  );

  // Minimizado + clique no item do menu: restaura a janela e avisa o app (que desenha a tela cheia de novo).
  pedirAbertura(docT);
  const avisosRestaurar: number[] = [];
  iframes(docT)[0]?.dispatchEvent(evento(docT, "load"));
  const appR = criarRpc(ladoApp!, { restaurado: () => avisosRestaurar.push(1) });
  await appR.chamar("minimizar", { minimizado: true });
  checar("minimizado antes do clique no menu", controle.minimizado);
  pedirAbertura(docT);
  await tique(5);
  checar(
    "clique no menu com o modal minimizado: restaura (tela cheia, rolagem travada)",
    !controle.minimizado && iframes(docT).length === 1 && docT.body.style.overflow === "hidden",
  );
  checar("o app e avisado da restauracao", avisosRestaurar.length === 1);
  pedirAbertura(docT);
  await tique(5);
  checar("aberto e nao minimizado: novo clique nao avisa de novo", avisosRestaurar.length === 1 && iframes(docT).length === 1);
  controle.fechar();
  await tique();

  pedirAbertura(docT);
  const app3 = await carregar();
  await lanca(() => app3.chamar("fechar"));
  checar("o app pede fechar: o modal sai", iframes(docT).length === 0 && !controle.aberto);

  pedirAbertura(docT);
  iframes(docT)[0]?.dispatchEvent(evento(docT, "load"));
  relogio.vencer();
  checar("app mudo no prazo: o modal sai", iframes(docT).length === 0 && !controle.aberto);

  pedirAbertura(docT);
  conectarFalha = true;
  const orig = console.warn;
  let avisos = 0;
  console.warn = () => void avisos++;
  iframes(docT)[0]?.dispatchEvent(evento(docT, "load"));
  checar("sem como conectar: sai na hora e avisa", iframes(docT).length === 0 && avisos === 1);
  conectarFalha = false;
  urlFalha = true;
  const erro = await lanca(() => pedirAbertura(docT));
  console.warn = orig;
  checar("sem o endereco do app: nao monta, nao lanca, avisa", erro === null && iframes(docT).length === 0 && avisos === 2);
  urlFalha = false;
  controle.desligar();
  pedirAbertura(docT);
  checar("desligado, o evento nao abre", iframes(docT).length === 0);

  secao("modalIframe: aviso sem modal");
  const docS = instalarDom("<html><body><p>SEI</p></body></html>");
  const desligar = ligarAvisoSemModal(docS, CFG, 60);
  pedirAbertura(docS);
  const caixas = () => [...docS.querySelectorAll<HTMLElement>(`.${CFG.classeAviso}`)];
  checar(
    "o evento mostra o aviso com o texto e a classe da configuracao",
    caixas().length === 1 && caixas()[0]?.textContent === CFG.textoSemModal && caixas()[0]?.getAttribute("role") === "status",
  );
  avisarNaPagina(docS, CFG, "outro", 60);
  checar("um aviso por vez", caixas().length === 1 && caixas()[0]?.textContent === "outro");
  await tique(300);
  checar("o aviso some sozinho", caixas().length === 0);
  desligar();
  pedirAbertura(docS);
  checar("desligado, nao avisa", caixas().length === 0);
}
