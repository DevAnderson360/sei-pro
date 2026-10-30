import {
  copiarLetraDoTitulo,
  inserirNaOrdem,
  instalarEstiloPainel,
  ligarPortaDoPainel,
  montarPainelEmbutido,
  type OpcoesPainelEmbutido,
  ordemLegada,
  tratadoresDoPainel,
} from "../src/painel/embutido";
import { criarSobreposicao } from "../src/painel/sobreposicao";
import { parDePortas } from "../src/ponte/parDePortas";
import { criarRpc, type PortaRpc, type Rpc } from "../src/ponte/rpc";
import { icone } from "../src/ui/dom";
import { checar, disparar, instalarDom, lanca, secao, tique } from "./util";

const opcoes = (o: Partial<OpcoesPainelEmbutido> = {}): OpcoesPainelEmbutido => ({
  id: "projetosSeiPro",
  titulo: "Projetos",
  icone: () => icone("calendario", 20),
  urlApp: "chrome-extension://abc/html/projetos.html#modo=embutido",
  tituloIframe: "Projetos do SEI Pro",
  prefixo: "spro-prj",
  rotulos: { mostrar: "Mostrar projetos", recolher: "Recolher projetos" },
  recolhido: false,
  ordem: null,
  aoRecolher: () => undefined,
  ...o,
});

export async function verificarEmbutido(): Promise<void> {
  secao("painel embutido: ordem do legado");
  const loja = {
    getItem: () =>
      JSON.stringify({
        orderPanelHome: [
          { name: "favoritesPro", index: 3 },
          { name: "projetosSeiPro", index: "5" },
        ],
      }),
  };
  checar("ordem do painel pelo id", ordemLegada(loja, "projetosSeiPro") === 5 && ordemLegada(loja, "favoritesPro") === 3);
  checar("sem ordem guardada, ou JSON quebrado", ordemLegada(loja, "outro") === null && ordemLegada({ getItem: () => "{x" }, "x") === null);
  const docO = instalarDom(
    '<html><body><div id="c"><div class="panelHomePro" id="a" data-order="1"></div><div class="panelHomePro" id="b" data-order="5"></div></div></body></html>',
  );
  const novo = docO.createElement("div");
  novo.id = "n";
  inserirNaOrdem(docO.querySelector("#c")!, novo, 3);
  checar("entra antes do primeiro de ordem maior", [...docO.querySelectorAll("#c > div")].map((d) => d.id).join() === "a,n,b");

  secao("painel embutido: montar");
  const doc = instalarDom('<html><head></head><body><form id="frmProcedimentoControlar"></form></body></html>');
  const recolhidos: boolean[] = [];
  const m = montarPainelEmbutido(doc, opcoes({ temaEscuro: true, aoRecolher: (r) => recolhidos.push(r) }));
  checar(
    "cria #panelHomePro depois do formulario e o painel dentro",
    doc.querySelector("#frmProcedimentoControlar + #panelHomePro > #projetosSeiPro") !== null,
  );
  checar(
    "iframe do app: endereco, titulo, copiar e esquema de cores do tema",
    m?.iframe.getAttribute("src") === "chrome-extension://abc/html/projetos.html#modo=embutido" &&
      m.iframe.getAttribute("title") === "Projetos do SEI Pro" &&
      m.iframe.getAttribute("allow") === "clipboard-write" &&
      (m.iframe.getAttribute("style") ?? "").includes("color-scheme: dark") &&
      m.iframe.style.height === "120px",
  );
  const titulo = doc.querySelector("#projetosSeiPro .spro-prj-titulo");
  checar(
    "titulo com a classe da tela, icone e texto solto (sem span)",
    titulo?.classList.contains("infraBarraLocalizacao") === true &&
      !!titulo.querySelector("svg") &&
      !titulo.querySelector("span") &&
      (titulo.textContent ?? "").trim() === "Projetos",
  );
  checar("peso do titulo fixo (600)", (titulo as HTMLElement | null)?.style.getPropertyValue("font-weight") === "600");
  const estilo = doc.getElementById("spro-prj-painel-estilo")?.textContent ?? "";
  checar(
    "CSS do prefixo instalado, com a animacao do aviso",
    estilo.includes(".spro-prj-titulo") && estilo.includes("@keyframes spro-prj-aviso"),
  );
  const rec = doc.querySelector(".spro-prj-recolher") as HTMLButtonElement;
  checar(
    "botao de recolher com o rotulo do modulo",
    rec.getAttribute("aria-label") === "Recolher projetos" && rec.getAttribute("aria-expanded") === "true",
  );
  rec.click();
  checar(
    "recolher esconde, troca o rotulo e avisa",
    m?.corpo.hidden === true && rec.getAttribute("aria-label") === "Mostrar projetos" && recolhidos.join() === "true",
  );
  checar("nao monta duas vezes o mesmo painel", montarPainelEmbutido(doc, opcoes()) === null);
  const outro = montarPainelEmbutido(doc, opcoes({ id: "favoritesPro", prefixo: "spro-fav", estilo: () => undefined }));
  checar(
    "outro painel usa o mesmo contêiner, e o estilo proprio dele",
    doc.querySelectorAll("#panelHomePro").length === 1 &&
      outro?.painel.parentElement?.id === "panelHomePro" &&
      !doc.getElementById("spro-fav-painel-estilo"),
  );
  const hostil = '<img src=x onerror="alert(1)">';
  const docH = instalarDom('<html><body><form id="frmProcedimentoControlar"></form></body></html>');
  montarPainelEmbutido(docH, opcoes({ titulo: hostil }));
  checar(
    "titulo hostil como texto",
    (docH.querySelector(".spro-prj-titulo")?.textContent ?? "").includes(hostil) && !docH.querySelector(".spro-prj-titulo img"),
  );
  const docM = instalarDom('<html><body><form id="frmProcedimentoControlar"></form><table id="tblMarcadores"></table></body></html>');
  checar(
    "caixa filtrada por marcador, ou sem a caixa: nao monta",
    montarPainelEmbutido(docM, opcoes()) === null && montarPainelEmbutido(instalarDom(), opcoes()) === null,
  );
  checar(
    "prefixo invalido e recusado",
    (await lanca(() => instalarEstiloPainel(instalarDom(), "spro prj")))?.message?.includes("Prefixo") === true,
  );
  const docT = instalarDom('<html><body><div id="divInfraBarraLocalizacao">Controle de Processos</div></body></html>');
  (docT.defaultView as unknown as { getComputedStyle: () => Partial<CSSStyleDeclaration> }).getComputedStyle = () => ({
    fontSize: "22.4px",
    fontFamily: "Roboto, Arial",
  });
  const tituloT = docT.createElement("div");
  copiarLetraDoTitulo(docT, tituloT);
  checar("depois da carga, a letra do titulo da tela", tituloT.style.fontSize === "22.4px");

  secao("painel embutido: tratadores da aba");
  const docE = instalarDom('<html><body><iframe id="f"></iframe></body></html>');
  const fr = docE.getElementById("f") as HTMLIFrameElement;
  const sem = tratadoresDoPainel({ iframe: fr });
  await sem.altura?.({ px: 345.4 });
  checar("altura segue o conteudo", fr.style.height === "345px");
  await sem.altura?.({ px: 10 });
  const minimo = fr.style.height;
  await sem.altura?.({ px: 1e9 });
  checar("com limites (80 e 20000)", minimo === "80px" && fr.style.height === "20000px");
  checar(
    "sem sobreposicao (lateral) nega, sem aviso nega",
    (await sem.sobrepor?.({ ativo: true })) === false && (await sem.aviso?.({ texto: "x" })) === false,
  );
  const pedidos: Array<[string, string | undefined, number]> = [];
  const com = tratadoresDoPainel({
    iframe: fr,
    avisar: async (t, a, ms) => {
      pedidos.push([t, a, ms]);
      return true;
    },
  });
  await com.aviso?.({ texto: "x".repeat(500), acao: "D".repeat(50), ms: "nao e numero" });
  checar(
    "aviso: texto e acao cortados, prazo padrao",
    pedidos[0]?.[0].length === 400 && pedidos[0]?.[1]?.length === 40 && pedidos[0]?.[2] === 7000,
  );

  secao("painel embutido: porta a cada carga do iframe");
  const docR = instalarDom('<html><body><form id="frmProcedimentoControlar"></form></body></html>');
  const mp = montarPainelEmbutido(docR, opcoes())!;
  let conexoes = 0;
  let ladoApp: Rpc | null = null;
  const conectar = (): PortaRpc => {
    conexoes++;
    const [app, aba] = parDePortas();
    ladoApp = criarRpc(app);
    return aba;
  };
  const porta = ligarPortaDoPainel(mp, conectar, tratadoresDoPainel({ iframe: mp.iframe, sobreposicao: mp.sobreposicao }));
  checar("antes da carga do iframe, nenhuma porta", conexoes === 0);
  disparar(mp.iframe, "load");
  const primeiro = ladoApp as Rpc | null;
  await primeiro?.chamar("altura", { px: 300 });
  checar("carregou: porta nova, e o app pede a altura", conexoes === 1 && mp.iframe.style.height === "300px");
  disparar(mp.iframe, "load");
  await tique();
  checar("recarregou: a porta antiga fecha e vem outra", conexoes === 2 && primeiro?.aberta === false);
  const segundo = ladoApp as Rpc | null;
  checar(
    "o app liga a sobreposicao pela porta",
    (await segundo?.chamar("sobrepor", { ativo: true })) === true && docR.documentElement.style.overflow === "hidden",
  );
  segundo?.fechar();
  await tique();
  checar("porta caiu com dialogo aberto: a pagina destrava", docR.documentElement.style.overflow === "" && mp.iframe.style.position === "");
  porta.fechar();
  checar("fechar tira o painel", !docR.querySelector("#projetosSeiPro"));
  const sob = criarSobreposicao(docR, mp.iframe, mp.corpo);
  checar("sobreposicao de painel fora da pagina nega", sob.ligar(true) === false);
}
