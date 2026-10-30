import { readFileSync } from "node:fs";
import { DOMParser } from "linkedom";
import { capturarAberturaAgente, podeAtenderNoFrame, temSeiAncestral } from "../src/ponte/abertura";
import { criarHttp } from "@nucleo/sessao/http";
import { checar, secao } from "./util";

export function verificarAbertura(): void {
  secao("abertura: portal F5 e frames internos");
  const direto = "https://sei.exemplo.gov.br/sei/controlador.php?acao=procedimento_controlar";
  const portal = "https://remoto.exemplo.gov.br/f5-w-68747470733a2f2f7365692e6578656d706c6f$$/sei/controlador.php?acao=procedimento_controlar";
  checar("acesso direto no topo permanece", podeAtenderNoFrame(direto, true, false));
  checar("F5 no topo permanece", podeAtenderNoFrame(portal, true, false));
  checar("tela principal dentro do portal pode conectar", podeAtenderNoFrame(portal, false, false));
  checar("frame interno do SEI no F5 nao duplica a ponte", !podeAtenderNoFrame(portal, false, true));
  checar("frame comum permanece sem ponte", !podeAtenderNoFrame(direto, false, false));
  checar("URL invalida nao habilita frame", !podeAtenderNoFrame("invalida", false, false));
  checar("endereco de documento nao habilita frame comum", !podeAtenderNoFrame("https://remoto.exemplo.gov.br/documento.html", false, false));
  checar("raiz HTTP conserva o prefixo F5", criarHttp(portal).absoluta("controlador.php?acao=teste") === portal.replace("acao=procedimento_controlar", "acao=teste"));

  const superior = { parent: null as unknown, document: { querySelector: () => ({}) } };
  superior.parent = superior;
  checar("reconhece tela SEI ancestral", temSeiAncestral({ parent: superior } as unknown as Window));
  const externo = { get document(): Document { throw new Error("SecurityError"); } };
  checar("portal de outra origem nao quebra a deteccao", !temSeiAncestral({ parent: externo } as unknown as Window));

  secao("abertura: clique capturado sem executar JavaScript da pagina");
  const doc = new DOMParser().parseFromString('<html><body><a class="iconPro_agenteia" onclick="throw new Error(\'F5\')"><img id="icone"></a><a id="normal">SEI</a></body></html>', "text/html") as unknown as Document;
  let aberturas = 0;
  capturarAberturaAgente(doc, () => { aberturas++; });
  const clicar = (el: Element, botao = 0) => {
    const ev = new doc.defaultView!.Event("click", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "button", { value: botao });
    el.dispatchEvent(ev);
    return ev;
  };
  const clique = clicar(doc.querySelector("#icone")!);
  checar("icone abre o agente uma unica vez", aberturas === 1);
  checar("clique legado e consumido", clique.defaultPrevented);
  clicar(doc.querySelector("#normal")!);
  checar("outros botoes do SEI permanecem intocados", aberturas === 1);
  const barra = doc.createElement("a");
  barra.id = "iconAIActions";
  doc.body.append(barra);
  clicar(barra);
  checar("botao da barra inserido depois tambem abre", aberturas === 2);
  clicar(barra, 2);
  checar("botao secundario nao abre", aberturas === 2);

  const manifest = JSON.parse(readFileSync(new URL("../../dist/manifest.json", import.meta.url), "utf8")) as { content_scripts: Array<{ js?: string[]; all_frames?: boolean }> };
  checar("manifest injeta abertura nos frames", manifest.content_scripts.find((c) => c.js?.includes("js/init_agente.js"))?.all_frames === true);
}
