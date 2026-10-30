import {
  type ColunaResultado,
  copiarResultado,
  type LinhaResultado,
  montarTabelaResultado,
  resultadoComoCsv,
  resultadoComoHtml,
  resultadoComoTexto,
  rotuloSituacao,
} from "../src/ui/tabelaResultado";
import { checar, instalarDom, lanca, secao } from "./util";

export async function verificarTabelaResultado(): Promise<void> {
  const doc = instalarDom();
  const colunas: ColunaResultado[] = [
    { chave: "numero", titulo: "Numero", comoLink: true },
    { chave: "nota", titulo: "Nota" },
  ];
  const linhas: LinhaResultado[] = [
    { situacao: "ok", campos: { numero: "50300.1/2026-10", nota: "=SOMA(1)" }, link: "https://sei/x?a=1&b=2" },
    { situacao: "nao-encontrado", campos: { numero: "<b>x</b>", nota: 'diz "oi" & tchau' }, link: 'https://sei/"><script>' },
    { situacao: "sem-acesso", campos: { numero: "3", nota: "" } },
  ];

  secao("tabela de resultado: rotulos e tabela");
  checar("rotulo de nao encontrado", rotuloSituacao("nao-encontrado") === "Não encontrado");
  checar("rotulo de pendente", rotuloSituacao("pendente") === "Pendente");
  const tab = montarTabelaResultado(doc, linhas, colunas);
  checar("uma linha de corpo por resultado", tab.querySelectorAll("tbody tr").length === 3);
  checar("situacao aparece como texto", (tab.querySelectorAll("tbody tr")[1]?.textContent ?? "").includes("Não encontrado"));
  checar("texto com marcacao nao vira elemento", tab.querySelector("b") === null);

  {
    const proprio: LinhaResultado[] = [{ situacao: "ok", campos: { numero: "1", nota: "" }, rotulo: "Criado" }];
    const t2 = montarTabelaResultado(doc, proprio, colunas);
    checar("rotulo proprio da linha na tabela", (t2.querySelector("tbody td")?.textContent ?? "") === "Criado");
    checar("rotulo proprio no TSV", resultadoComoTexto(proprio, colunas).split("\n")[1]?.startsWith("Criado\t") === true);
    checar(
      "rotulo proprio no CSV e no HTML",
      resultadoComoCsv(proprio, colunas).includes("Criado;") && resultadoComoHtml(proprio, colunas).includes("<td>Criado</td>"),
    );
    checar("rotulo proprio nao muda a classe", t2.querySelector("tbody tr")?.getAttribute("class") === "spro-situacao-ok");
  }

  secao("tabela de resultado: texto, html e csv");
  const tsv = resultadoComoTexto(linhas, colunas).split("\n");
  checar("TSV tem cabecalho com situacao", tsv[0] === "Situação\tNumero\tNota", tsv[0]);
  checar("TSV com uma linha por resultado", tsv.length === 4);
  const html = resultadoComoHtml(linhas, colunas);
  checar("html escapa o texto", html.includes("&lt;b&gt;x&lt;/b&gt;") && !html.includes("<b>x"));
  checar("html escapa aspas e & no texto", html.includes("diz &quot;oi&quot; &amp; tchau"));
  checar("html escapa o href", html.includes('href="https://sei/&quot;&gt;&lt;script&gt;"') && !html.includes("<script>"));
  checar("html escapa & do href", html.includes('href="https://sei/x?a=1&amp;b=2"'));
  checar("coluna comoLink sem link fica texto", html.includes("<td>3</td>"));
  const csv = resultadoComoCsv(linhas, colunas);
  checar("csv neutraliza = inicial", csv.includes("'=SOMA(1)"));
  checar("csv tem BOM e separador ;", csv.startsWith("﻿") && csv.includes("Situação;Numero;Nota"));

  secao("tabela de resultado: copiar");
  const chamadas: string[] = [];
  class ItemFalso {
    constructor(public tipos: Record<string, Blob>) {}
  }
  const clip = {
    write: async (i: unknown[]) => {
      chamadas.push(`write:${Object.keys((i[0] as ItemFalso).tipos).join(",")}`);
    },
    writeText: async (t: string) => {
      chamadas.push(`texto:${t.split("\n").length}`);
    },
  };
  const r1 = await copiarResultado(linhas, colunas, clip, ItemFalso as unknown as typeof ClipboardItem);
  checar("copia rica com html e plain", r1 === "rico" && chamadas[0] === "write:text/html,text/plain", chamadas);
  const r2 = await copiarResultado(linhas, colunas, { writeText: clip.writeText });
  checar("sem write cai no texto", r2 === "texto" && chamadas[1] === "texto:4", chamadas);
  const r3 = await copiarResultado(linhas, colunas, clip);
  checar("sem Item cai no texto", r3 === "texto");

  {
    // Documento sem foco ou permissao negada: write rejeita e a copia simples ainda funciona.
    const feitas: string[] = [];
    const recusa = {
      write: async () => {
        throw new Error("Document is not focused");
      },
      writeText: async (t: string) => {
        feitas.push(t);
      },
    };
    const r4 = await copiarResultado(linhas, colunas, recusa, ItemFalso as unknown as typeof ClipboardItem);
    checar("write rejeitado cai no writeText", r4 === "texto" && feitas.length === 1, { r4, feitas });
    const nada = {
      write: async () => {
        throw new Error("negado");
      },
      writeText: async () => {
        throw new Error("texto negado");
      },
    };
    const erro = await lanca(() => copiarResultado(linhas, colunas, nada, ItemFalso as unknown as typeof ClipboardItem));
    checar("writeText rejeitado propaga o erro", erro?.message === "texto negado", erro);
  }

  secao("tabela de resultado: formula no TSV e link so http(s)");
  {
    const perigosas: LinhaResultado[] = [
      { situacao: "ok", campos: { numero: "+1", nota: "=SOMA(1)" } },
      { situacao: "ok", campos: { numero: "-2", nota: "@x" } },
      { situacao: "ok", campos: { numero: "a=b", nota: "" } },
    ];
    const t = resultadoComoTexto(perigosas, colunas).split("\n");
    checar("TSV neutraliza = e +", t[1] === "Encontrado\t'+1\t'=SOMA(1)", t[1]);
    checar("TSV neutraliza - e @", t[2] === "Encontrado\t'-2\t'@x", t[2]);
    checar("TSV nao mexe no = do meio", t[3] === "Encontrado\ta=b\t", t[3]);
    const c = resultadoComoCsv(perigosas, colunas);
    checar("CSV nao ganha apostrofo duplo", c.includes(";'+1;'=SOMA(1)") && !c.includes("''"), c);

    const links: LinhaResultado[] = [
      { situacao: "ok", campos: { numero: "js", nota: "" }, link: "javascript:alert(1)" },
      { situacao: "ok", campos: { numero: "dado", nota: "" }, link: "data:text/html,oi" },
      { situacao: "ok", campos: { numero: "http", nota: "" }, link: "http://sei/a" },
      { situacao: "ok", campos: { numero: "https", nota: "" }, link: "HTTPS://sei/b" },
    ];
    const tl = montarTabelaResultado(doc, links, colunas);
    const hrefs = [...tl.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    checar("tabela: so http(s) vira ancora", JSON.stringify(hrefs) === JSON.stringify(["http://sei/a", "HTTPS://sei/b"]), hrefs);
    checar("tabela: link recusado fica como texto", (tl.querySelectorAll("tbody tr")[0]?.textContent ?? "").includes("js"));
    const hl = resultadoComoHtml(links, colunas);
    checar("html: javascript: nao vira ancora", !hl.includes("javascript:") && hl.includes("<td>js</td>"), hl);
    checar("html: data: nao vira ancora", !hl.includes("data:") && hl.includes("<td>dado</td>"));
    checar(
      "html: http(s) continua ancora",
      hl.includes('<a href="http://sei/a">http</a>') && hl.includes('<a href="HTTPS://sei/b">https</a>'),
    );
  }
}
