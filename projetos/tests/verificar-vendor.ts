import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import Gantt, { type BarraFrappe, type TarefaFrappe } from "../src/vendor/frappe-gantt/index";
import { area, esperarQuadro, instalarAmbienteGantt } from "./ambienteGantt";
import { checar, secao } from "./util";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = join(RAIZ, "src/vendor/frappe-gantt");
const PROIBIDO = /innerHTML|outerHTML|insertAdjacentHTML/;
// on<evento>=" dentro de literal (o mesmo critério de tools/check-dom-injection.mjs); "el.onclick = fn" não casa.
const HANDLER = /\bon[a-z]+\s*=\s*\\?["']/;

const MODOS = [
  { name: "Dia", padding: "7d", step: "1d", column_width: 28, date_format: "YYYY-MM-DD", lower_text: "D", upper_text: "MMMM" },
  { name: "Semana", padding: "14d", step: "7d", column_width: 64, date_format: "YYYY-MM-DD", lower_text: "D", upper_text: "MMMM" },
];

const tarefa = (m: Partial<TarefaFrappe> & { id: string }): TarefaFrappe => ({
  name: m.id,
  start: "2026-10-05",
  end: "2026-10-09",
  progress: 0,
  ...m,
});

export async function verificarVendor(): Promise<void> {
  secao("projetos: Frappe Gantt vendorizada - fonte e pacote");
  const arquivos = (await readdir(VENDOR)).sort();
  checar(
    "arquivos do vendor (sem popup.js)",
    arquivos.join() ===
      "AJUSTES.md,LICENSE,arrow.js,bar.js,date_utils.d.ts,date_utils.js,defaults.js,index.d.ts,index.js,svg_utils.js,tipos.d.ts",
    arquivos,
  );
  for (const f of arquivos.filter((a) => a.endsWith(".js"))) {
    const texto = (await readFile(join(VENDOR, f), "utf8")).replace(/\r\n/g, "\n");
    checar(
      `${f}: // @ts-nocheck e cabecalho de origem`,
      texto.startsWith("// @ts-nocheck\n") && texto.includes("Frappe Gantt 1.2.2") && texto.includes("SEI Pro"),
    );
    checar(`${f}: sem innerHTML/outerHTML/insertAdjacentHTML`, !PROIBIDO.test(texto));
  }
  const licenca = await readFile(join(VENDOR, "LICENSE"), "utf8");
  checar("LICENSE MIT original", licenca.includes("The MIT License (MIT)") && licenca.includes("Frappe Technologies"));
  const ajustes = await readFile(join(VENDOR, "AJUSTES.md"), "utf8");
  checar(
    "AJUSTES.md descreve os ajustes 1 a 9",
    [1, 2, 3, 4, 5, 6, 7, 8, 9].every((n) => ajustes.includes(`## ${n}.`)),
  );
  const r = await build({
    stdin: { contents: 'import Gantt from "./src/vendor/frappe-gantt/index"; globalThis.__g = Gantt;', resolveDir: RAIZ, loader: "ts" },
    bundle: true,
    minify: true,
    write: false,
    format: "esm",
    charset: "ascii",
    target: ["chrome116", "firefox115"],
    logLevel: "silent",
  });
  const pacote = r.outputFiles[0]?.text ?? "";
  checar("pacote gerado", pacote.length > 20_000, pacote.length);
  checar("pacote sem innerHTML/outerHTML/insertAdjacentHTML", !PROIBIDO.test(pacote));
  checar("pacote sem acao em atributo on*", !HANDLER.test(pacote));
  checar(
    "pacote so ASCII",
    [...pacote].every((ch) => ch.charCodeAt(0) <= 0x7f),
  );
  checar("pacote sem o modulo popup nem o popup padrao (ajuste 1f)", !pacote.includes("set_details") && !pacote.includes("<br/>"));

  secao("projetos: Frappe Gantt vendorizada - comportamento (linkedom)");
  const doc = instalarAmbienteGantt();
  const a = area(doc);
  let geral = 0;
  const porBarra: string[] = [];
  const hostil = '<img src=x onerror="alert(1)">';
  const g = new Gantt(
    a,
    [
      tarefa({ id: "e1", name: hostil, custom_class: "st-andamento realce" }),
      tarefa({ id: "e2", start: "2026-10-12", end: "2026-10-16", dependencies: "e1" }),
    ],
    {
      view_modes: MODOS,
      view_mode: "Semana",
      popup: false,
      infinite_padding: false,
      after_render: (_g: Gantt, b?: BarraFrappe) => (b ? porBarra.push(b.task.id) : geral++),
    },
  );
  checar("view_mode informado e respeitado (ajuste 3)", g.config.view_mode.name === "Semana");
  const grupo = a.querySelector('.bar-wrapper[data-id="e1"]');
  checar("custom_class com duas classes (ajuste 2)", !!grupo?.classList.contains("st-andamento") && !!grupo?.classList.contains("realce"));
  const rotulo = grupo?.querySelector(".bar-label");
  checar(
    "rotulo com HTML aparece como texto (ajuste 1a)",
    rotulo?.textContent === hostil && rotulo.children.length === 0 && !a.querySelector("img"),
  );
  checar("gancho after_render no fim do render (ajuste 4)", geral === 1);
  await esperarQuadro();
  checar("gancho after_render por barra depois do rotulo", porBarra.sort().join() === "e1,e2");
  checar("hachura criada com createElementNS (ajuste 1d)", !!g.$svg.querySelector("pattern#diagonalHatch path"));
  checar("seta do ajuste com textContent (ajuste 1c)", g.$container.querySelector(".adjust")?.textContent === "←");
  checar("textos da escala com textContent (ajuste 1e)", (g.$container.querySelector(".lower-text")?.textContent ?? "") !== "");
  const g2 = new Gantt(doc.createElement("div"), [tarefa({ id: "x" })], {
    view_modes: MODOS,
    view_mode: "Inexistente",
    infinite_padding: false,
  });
  checar("view_mode inexistente cai no primeiro", g2.config.view_mode.name === "Dia");
  g.destroy();
  checar("destroy tira o conteiner (ajuste 9)", !a.querySelector(".gantt-container"));
}
