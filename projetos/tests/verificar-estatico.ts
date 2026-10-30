import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MEDIDAS } from "../src/gantt/escalas";
import { checar, secao } from "./util";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Classes que só servem de gancho (provas, seletores do app), sem regra própria no CSS. */
const GANCHOS = new Set([
  "prj-bloco-modelo",
  "prj-campo-fim",
  "prj-corpo",
  "prj-form-documento",
  "prj-form-etapa",
  "prj-form-modelo",
  "prj-form-projeto",
  "prj-lin-projeto",
  "prj-topo",
  "prj-vista-todos",
]);

async function fontes(pasta: string): Promise<string[]> {
  const saida: string[] = [];
  for (const e of await readdir(pasta, { withFileTypes: true })) {
    const p = join(pasta, e.name);
    if (e.isDirectory()) saida.push(...(await fontes(p)));
    else if (e.name.endsWith(".ts")) saida.push(await readFile(p, "utf8"));
  }
  return saida;
}

export async function verificarEstatico(): Promise<void> {
  secao("estatico: pagina e CSS do app");
  const html = await readFile(join(RAIZ, "estatico/projetos.html"), "utf8");
  checar(
    "pagina carrega o CSS e o app (modulo)",
    html.includes('href="../css/projetos.css"') &&
      html.includes('<script type="module" src="../js/projetos/app.js">') &&
      html.includes('id="app"'),
  );
  checar(
    "o app inteiro nao e regiao viva (cada redesenho seria lido); os avisos ja tem role=status",
    !/<div id="app"[^>]*aria-live/.test(html) && !html.includes("aria-live"),
  );
  checar(
    "pagina so ASCII",
    [...html].every((c) => c.charCodeAt(0) <= 0x7f),
  );
  const css = await readFile(join(RAIZ, "estatico/projetos.css"), "utf8");
  checar(
    "projetos.css so ASCII",
    [...css].every((c) => c.charCodeAt(0) <= 0x7f),
  );
  checar("sem @import (a pagina da extensao nao busca nada de fora)", !css.includes("@import"));
  const semComentario = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const tokensAlheios = [...new Set(semComentario.match(/var\(--[a-z0-9-]+/g) ?? [])].filter((v) => !v.startsWith("var(--spro-"));
  const coresLiterais = semComentario.match(/:[^;{}]*(#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\()/gi) ?? [];
  checar(
    "so tokens --spro-* (nenhuma cor literal: os dois temas e a cor do SEI valem em tudo)",
    tokensAlheios.length === 0 && coresLiterais.length === 0,
    [...tokensAlheios, ...coresLiterais],
  );
  const impressao = /@media print \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  checar(
    "impressao leva os fundos (pilulas, barras, grupos da tabela): print-color-adjust exact",
    /(^|[^-])print-color-adjust: exact/.test(impressao) && impressao.includes("-webkit-print-color-adjust: exact"),
  );
  const regra = (seletor: string) => new RegExp(`\\.${seletor}\\s*[{,.:\\[ >]`).test(css);
  checar(
    "cabecalho da lista com a altura do cabecalho do Gantt",
    new RegExp(`\\.prj-lista-cab \\{[^}]*height: ${MEDIDAS.cabecalho}px`).test(css),
  );
  checar("linha da lista com a altura da linha do Gantt", new RegExp(`\\.prj-lin \\{[^}]*height: ${MEDIDAS.linha}px`).test(css));
  const codigo = [...(await fontes(join(RAIZ, "src/app"))), ...(await fontes(join(RAIZ, "src/arquivo")))].join("\n");
  const usadas = [...new Set(codigo.match(/prj-[a-z0-9-]+/g) ?? [])];
  const semRegra = usadas.filter((c) => !GANCHOS.has(c) && (c.endsWith("-") ? !css.includes(`.${c}`) : !regra(c)));
  checar("toda classe prj-* do app tem regra no CSS (ou e gancho declarado)", semRegra.length === 0, semRegra);
}
