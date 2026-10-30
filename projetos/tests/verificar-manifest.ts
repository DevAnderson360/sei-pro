import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { checar, secao } from "./util";

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist");

interface ScriptDeConteudo {
  js?: string[];
  matches?: string[];
  exclude_matches?: string[];
  all_frames?: boolean;
  run_at?: string;
}

export async function verificarManifest(): Promise<void> {
  secao("manifest Lab e legado");
  const m = JSON.parse(await readFile(join(DIST, "manifest.json"), "utf8")) as {
    content_scripts: ScriptDeConteudo[];
    web_accessible_resources: Array<{ resources: string[] }>;
  };
  const de = (arquivo: string) => m.content_scripts.find((c) => c.js?.length === 1 && c.js[0] === arquivo);
  const novo = de("js/init_projetos.js");
  const historico = de("js/init_historico.js");
  checar(
    "content script novo com os mesmos matches do historico, todos os frames, document_start",
    !!novo &&
      !!historico &&
      JSON.stringify(novo.matches) === JSON.stringify(historico.matches) &&
      JSON.stringify(novo.exclude_matches) === JSON.stringify(historico.exclude_matches) &&
      novo.all_frames === true &&
      novo.run_at === "document_start",
  );
  const war = m.web_accessible_resources.flatMap((w) => w.resources);
  checar(
    "pagina, app e CSS acessiveis ao iframe",
    ["html/projetos.html", "js/projetos/app.js", "css/projetos.css"].every((r) => war.includes(r)),
  );
  // T11: o content script e um carregador que importa (import()) o pacote da pagina e, ao abrir o balao, o do balao.
  // Os modulos importados por um content script precisam estar no WAR, nas paginas onde o content script roda.
  const PACOTE_PAGINA = ["js/projetos/pagina.js", "js/projetos/balao.js", "js/projetos/pagina-comum.js"];
  const bloco = m.web_accessible_resources.find((w) => w.resources.includes("js/projetos/app.js")) as
    | { resources: string[]; matches?: string[] }
    | undefined;
  checar(
    "pacote da pagina e do balao no WAR, no mesmo bloco do app (as paginas do SEI)",
    !!bloco &&
      PACOTE_PAGINA.every((r) => bloco.resources.includes(r)) &&
      ["*://*.br/*", "*://*.org/*"].every((p) => bloco.matches?.includes(p)),
    PACOTE_PAGINA.filter((r) => !war.includes(r)),
  );
  const init = await readFile(join(DIST, "js", "init.js"));
  const texto = init.toString("utf8").replace(/\r\n/g, "\n");
  checar(
    "init.js: legado so sem o modulo novo ou com servidor do Atividades",
    texto.includes("hasAttribute('data-seipro-projetos')") &&
      texto.includes("configBasePro_atividades") &&
      texto.includes('getUrlExtension("js/sei-pro-projetos.js")'),
  );
  checar(
    "init.js continua so ASCII",
    init.every((b) => b <= 0x7f),
  );
  const legado = await readFile(join(DIST, "js", "sei-pro-projetos.js"));
  checar("legado vira 'Projetos (Atividades)' quando os dois aparecem", legado.toString("utf8").includes("'Projetos (Atividades)'"));
  checar(
    "sei-pro-projetos.js continua so ASCII",
    legado.every((b) => b <= 0x7f),
  );
  const fonte = texto.match(/function servidorAtividadesConfiguradoPro\(\) \{[\s\S]*?\n {12}\}\n/)?.[0] ?? "";
  const servidor = (guardado: string | null): boolean => {
    const ctx = { localStorage: { getItem: () => guardado }, resultado: undefined as unknown };
    vm.runInNewContext(`${fonte}\nresultado = servidorAtividadesConfiguradoPro();`, ctx);
    return ctx.resultado === true;
  };
  checar(
    "guarda do servidor: ausente, vazio, malformado, {} e URL_API vazio sao falsos",
    fonte !== "" &&
      !servidor(null) &&
      !servidor("") &&
      !servidor("{nao json") &&
      !servidor("{}") &&
      !servidor('{"URL_API":""}') &&
      !servidor('{"URL_API":5}') &&
      !servidor("null"),
  );
  checar(
    "guarda do servidor: URL_API preenchida basta (KEY_USER vazio no login OAuth)",
    servidor('{"URL_API":"https://x","KEY_USER":"","CLIENT_ID":"c"}') && servidor('{"URL_API":"https://x","KEY_USER":"k"}'),
  );
  checar(
    "legado carrega so sem a marca ou com servidor",
    texto.includes("!document.documentElement.hasAttribute('data-seipro-projetos') || servidorAtividadesConfiguradoPro()"),
  );
  const atividades = (await readFile(join(DIST, "js", "sei-pro-atividades.js"))).toString("utf8");
  checar(
    "atividades: initProjetos protegido por typeof nas duas chamadas",
    (atividades.match(/initProjetos\(/g) ?? []).length ===
      (atividades.match(/typeof initProjetos === 'function'\) initProjetos\(/g) ?? []).length,
  );
}
