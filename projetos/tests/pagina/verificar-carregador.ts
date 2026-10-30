/**
 * A divisão do content script (T11): o `init_projetos.js` é um carregador
 * mínimo, que roda em todo frame do SEI, marca o <html>, tira os textos
 * internos do seletor e decide pela tela; só na janela de topo com unidade (o
 * Controle de Processos inclusive) e no frame da árvore ele importa o pacote
 * pesado (`js/projetos/pagina.js`). Nos outros frames nada é importado (nem a
 * opção é lida). O balão do processo (com o `base.css` como texto) vem num
 * terceiro módulo, importado só quando o usuário abre o balão pela primeira vez.
 *
 * As provas do pacote de verdade (o carregador sem o repositório, o pacote da
 * página sem o balão, todo arquivo no `web_accessible_resources`) são os
 * portões do `build.mjs`; aqui ficam o comportamento e a ligação nos fontes.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { areaMemoria } from "@comum/armazenamento/area";
import { consentimentoNaArea } from "@comum/sincronia/consentimento";
import { escoposDaUnidade } from "../../src/modelo/escopo";
import type { Vis } from "../../src/modelo/tipos";
import { balaoAberto } from "../../src/pagina/balaoAtual";
import { abrirBalaoProcesso } from "../../src/pagina/balaoProcesso";
import { instalarIconesCaixa } from "../../src/pagina/caixa";
import { carregarProjetos, type DepsCarregador, oQueCarregar, PACOTE_PAGINA, temUnidade } from "../../src/pagina/carregador";
import { contextoProjetos } from "../../src/pagina/contexto";
import { abridorDoBalao, type ModuloBalao } from "../../src/pagina/sobDemanda";
import { RepositorioProjetos } from "../../src/repositorio";
import { HOJE } from "../fabrica";
import { checar, instalarDom, lanca, secao, telaSei, tique } from "./util";

const PASTA_PAGINA = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "pagina");
const FIXTURES_41 = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "sei-nucleo", "tests", "fixtures", "sei41");
const CAU = "99906.713-630.000032/2025-82";

const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const fonte = (f: string) => semComentario(readFileSync(join(PASTA_PAGINA, f), "utf8"));
/** Os módulos que um fonte importa (estáticos: `import ... from "x"` e `import "x"`; não conta `import type`). */
const importsDe = (codigo: string) =>
  [...codigo.matchAll(/^import\s+(?!type\s)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm)].map((m) => m[1] ?? "");

function verificarDecisao(): void {
  secao("carregador: o que cada frame carrega");
  const tela = (nome: string) => telaSei(`sei41/${nome}`);
  const decide = (nome: string, topo: boolean) => {
    const { doc, pagina } = tela(nome);
    return oQueCarregar({ topo, doc, url: pagina.url });
  };
  checar("topo do Controle de Processos: o pacote da pagina", decide("caixa.html", true) === "topo");
  checar("topo da tela do processo (com unidade): o pacote da pagina", decide("trabalhar.html", true) === "topo");
  checar("topo de outra tela com unidade (Textos Padrao): o pacote da pagina", decide("texto_padrao_listar.html", true) === "topo");
  checar("frame da arvore: o pacote da pagina (a arvore)", decide("arvore.html", false) === "arvore");
  checar("frame da arvore com as pastas abertas: o pacote da pagina", decide("arvore_completa.html", false) === "arvore");
  checar(
    "outros frames (documento, editor, formularios): nada",
    ["processo_visualizar.html", "despacho_visualizar.html", "editor.html", "p_procedimento_enviar.html", "pdf_visualizar.html"].every(
      (n) => decide(n, false) === null,
    ),
  );
  checar("a caixa dentro de um frame (nao acontece no SEI): nada", decide("caixa.html", false) === null);
  checar("topo sem o cabecalho do SEI (o editor em janela propria): nada", decide("editor.html", true) === null);
  checar(
    "topo vazio (login, janela sem a barra do SEI): nada",
    oQueCarregar({ topo: true, doc: instalarDom(), url: "https://sei.x.gov.br/sei/" }) === null,
  );
  const { doc: semUnidade, pagina } = tela("caixa.html");
  for (const el of semUnidade.querySelectorAll("#lnkInfraUnidade, #selInfraUnidades")) el.remove();
  checar(
    "topo com usuario e sem unidade: nada",
    oQueCarregar({ topo: true, doc: semUnidade, url: pagina.url.replace(/[?&]infra_unidade_atual=\d+/, "") }) === null,
  );

  // O PDF aberto no frame do documento (a fixture é o próprio PDF: sem <html>): nada, e sem lançar.
  const pdf = tela("pdf_visualizar.html");
  checar(
    "PDF no frame ou no topo (sem documentElement): nada, sem erro",
    oQueCarregar({ topo: false, doc: pdf.doc, url: pdf.pagina.url }) === null &&
      oQueCarregar({ topo: true, doc: pdf.doc, url: pdf.pagina.url }) === null,
  );

  // A guarda barata (sem serializar a página) e o contexto do pacote pesado concordam em toda tela das fixtures.
  const divergem: string[] = [];
  let telas = 0;
  for (const nome of readdirSync(FIXTURES_41).filter((f) => f.endsWith(".html"))) {
    const { doc, pagina } = tela(nome);
    if (!doc.documentElement) continue;
    telas++;
    const pesado = !!contextoProjetos(doc, { temaEscuro: false, atividades: false }, pagina.url)?.unidade;
    if (temUnidade(doc, pagina.url) !== pesado) divergem.push(nome);
  }
  checar("a guarda do carregador e o contexto do pacote concordam em todas as telas", telas >= 40 && divergem.length === 0, {
    telas,
    divergem,
  });

  // O contexto da janela de topo nao serializa a pagina inteira (outerHTML) para ler o cabecalho.
  const comUnidade = readdirSync(FIXTURES_41)
    .filter((f) => f.endsWith(".html"))
    .map((f) => tela(f))
    .find((t) => t.doc.documentElement && temUnidade(t.doc, t.pagina.url));
  if (comUnidade) {
    const el = comUnidade.doc.documentElement;
    let leituras = 0;
    Object.defineProperty(el, "outerHTML", {
      configurable: true,
      get() {
        leituras++;
        return "";
      },
    });
    const ctx = contextoProjetos(comUnidade.doc, { temaEscuro: false, atividades: false }, comUnidade.pagina.url);
    checar("contextoProjetos le o cabecalho sem serializar a pagina", !!ctx?.unidade && leituras === 0, { leituras });
  }
}

async function verificarCarga(): Promise<void> {
  secao("carregador: importa o pacote so onde precisa");
  const passos: string[] = [];
  const pacote = {
    principalTopo: async () => void passos.push("principalTopo"),
    principalArvore: async () => void passos.push("principalArvore"),
  };
  const deps = (nome: string, topo: boolean, o: { ligada?: boolean; falhar?: boolean } = {}): DepsCarregador => {
    const { doc, pagina } = telaSei(`sei41/${nome}`);
    return {
      topo,
      doc,
      url: pagina.url,
      opcaoLigada: async () => {
        passos.push("opcao");
        return o.ligada ?? true;
      },
      importar: async (caminho) => {
        passos.push(`importar ${caminho}`);
        if (o.falhar) throw new Error("rede");
        return pacote;
      },
    };
  };
  const carga = async (nome: string, topo: boolean, o?: { ligada?: boolean; falhar?: boolean }) => {
    passos.length = 0;
    const r = await carregarProjetos(deps(nome, topo, o));
    return { r, passos: passos.join(" | ") };
  };
  checar("o pacote e o arquivo do web_accessible_resources", PACOTE_PAGINA === "js/projetos/pagina.js");
  const frame = await carga("processo_visualizar.html", false);
  checar("frame qualquer: nada importado, nem a opcao lida", frame.r === null && frame.passos === "", frame);
  const editor = await carga("editor.html", false);
  checar("frame do editor: nada importado", editor.r === null && editor.passos === "", editor);
  const caixa = await carga("caixa.html", true);
  checar(
    "topo com unidade: le a opcao, importa o pacote e liga o topo",
    caixa.r === "topo" && caixa.passos === `opcao | importar ${PACOTE_PAGINA} | principalTopo`,
    caixa,
  );
  const trabalhar = await carga("trabalhar.html", true);
  checar("tela do processo (topo): o mesmo", trabalhar.r === "topo" && trabalhar.passos.endsWith("principalTopo"), trabalhar);
  const arvore = await carga("arvore.html", false);
  checar(
    "frame da arvore: importa o pacote e liga a arvore",
    arvore.r === "arvore" && arvore.passos === `opcao | importar ${PACOTE_PAGINA} | principalArvore`,
    arvore,
  );
  const desligada = await carga("caixa.html", true, { ligada: false });
  checar("opcao Gerenciar Projetos desligada: nada importado", desligada.r === null && desligada.passos === "opcao", desligada);
  const semTopo = await carga("editor.html", true);
  checar("topo sem unidade: nada importado", semTopo.r === null && semTopo.passos === "", semTopo);
  passos.length = 0;
  const erro = await lanca(() => carregarProjetos(deps("arvore.html", false, { falhar: true })));
  checar(
    "o import que falha sobe (o main mostra no console) e nada e ligado",
    erro?.message === "rede" && !passos.some((p) => p.startsWith("principal")),
    passos,
  );
}

async function verificarBalaoSobDemanda(): Promise<void> {
  secao("carregador: o balao so na primeira abertura");
  const { doc } = telaSei("sei41/caixa.html");
  const area = areaMemoria();
  const esc = escoposDaUnidade("treinamento.sei.sp.gov.br", "pedro.soares", "110000001");
  let relogio = 1_000;
  const carimbo = () => ({ agora: ++relogio, dispositivo: "t", por: "pedro.soares", nome: "Pedro Soares" });
  const repos: Record<Vis, RepositorioProjetos> = {
    unidade: new RepositorioProjetos(area, esc.unidade, carimbo),
    eu: new RepositorioProjetos(area, esc.eu, carimbo),
  };
  const p = await repos.unidade.criarProjeto({ nome: "Revisão", processo: { protocolo: CAU, idProcedimento: "148265" } });
  await repos.unidade.criarEtapa({ projeto: p.id, nome: "Minuta", inicio: "2026-09-01", fim: "2026-10-30" });
  const consentimento = consentimentoNaArea({
    area: areaMemoria(),
    chavePreferencias: "projetos/consentimento",
    campo: "textoPadrao",
    chave: "k",
  });
  let importacoes = 0;
  let falhar = false;
  const modulo: ModuloBalao = { abrirBalao: (ancora, processo, d) => abrirBalaoProcesso(ancora, processo, { ...d, cssBase: "" }) };
  const abrirBalao = abridorDoBalao(async () => {
    importacoes++;
    if (falhar) throw new Error("rede");
    return modulo;
  });
  const erros: unknown[] = [];
  const caixa = instalarIconesCaixa({
    doc,
    repos,
    hoje: () => HOJE,
    temaEscuro: false,
    atraso: 1,
    abrir: (ancora, processo) =>
      void abrirBalao(ancora, processo, {
        modo: "caixa",
        repos,
        hoje: () => HOJE,
        sigla: "TESTE",
        temaEscuro: false,
        consentimento,
        documentos: () => [],
        abrirNoPainel: () => undefined,
      }).catch((e) => void erros.push(e)),
  });
  await caixa.atualizar();
  const ic = doc.getElementById("P148265")?.querySelector<HTMLElement>(".spro-prj-ic") ?? null;
  checar("o icone na caixa sem carregar o balao", !!ic && importacoes === 0);
  falhar = true;
  ic?.click();
  await tique(30);
  checar("a carga que falha nao abre nada e o erro aparece", importacoes === 1 && balaoAberto() === null && erros.length === 1);
  falhar = false;
  ic?.click();
  await tique(30);
  checar("o clique seguinte tenta de novo e abre o balao", importacoes === 2 && balaoAberto()?.ancora === ic);
  ic?.click();
  await tique(30);
  checar("o mesmo icone fecha", balaoAberto() === null);
  ic?.click();
  await tique(30);
  checar("reabrir usa o modulo ja carregado", importacoes === 2 && balaoAberto()?.ancora === ic);
  balaoAberto()?.fechar();
  caixa.parar();
}

function verificarLigacaoNosFontes(): void {
  secao("carregador: a ligacao nos fontes (main.ts e principal.ts)");
  const main = fonte("main.ts");
  checar("main.ts: o primeiro import e o modulo que marca", importsDe(main)[0] === "./marcar", importsDe(main));
  const permitidos = ["./marcar", "@comum/opcoes/legadas", "@comum/sincronia/controlePagina", "./carregador"];
  checar(
    "main.ts: so o carregador e as guardas baratas (nada do pacote pesado)",
    importsDe(main).every((m) => permitidos.includes(m)),
    importsDe(main),
  );
  checar(
    "main.ts: o pacote por import() do endereco da extensao, com o topo de verdade",
    /importar:\s*\(caminho\)\s*=>\s*import\(chrome\.runtime\.getURL\(caminho\)\)/.test(main) && /topo:\s*window === window\.top/.test(main),
  );
  checar(
    "main.ts: os textos internos saem em todo frame, antes de decidir",
    /ocultarTextosInternos\(document\)[\s\S]*carregarProjetos\(/.test(main),
  );
  const principal = fonte("principal.ts");
  checar(
    "principal.ts: o balao so pelo import() sob demanda",
    /abridorDoBalao\(\(\) => import\("\.\/pacoteBalao"\)\)/.test(principal) &&
      !importsDe(principal).some((m) => /balaoProcesso|\.\/balao$|conteudo|adicionar|pacoteBalao|\.css$/.test(m)),
    importsDe(principal),
  );
  checar(
    "principal.ts: os dois pontos de entrada que o carregador chama",
    /export async function principalTopo\(\)/.test(principal) && /export async function principalArvore\(\)/.test(principal),
  );
  const pacoteBalao = fonte("pacoteBalao.ts");
  checar(
    "pacoteBalao.ts: o base.css como texto entra so no balao",
    importsDe(pacoteBalao).includes("@comum/ui/base.css") &&
      readdirSync(PASTA_PAGINA)
        .filter((f) => f.endsWith(".ts") && f !== "pacoteBalao.ts")
        .every((f) => !importsDe(fonte(f)).some((m) => m.endsWith(".css"))),
  );
}

export async function verificarCarregador(): Promise<void> {
  verificarDecisao();
  await verificarCarga();
  await verificarBalaoSobDemanda();
  verificarLigacaoNosFontes();
}
