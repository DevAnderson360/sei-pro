/**
 * Inclusão de processos em bloco interno pela tela do Controle de Processos,
 * contra telas SINTÉTICAS no formato do SEI 5.0.4 (fixtures/sei5) e um
 * servidor falso por baixo do transporte de verdade (latin-1, verificarPagina).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { incluirProcessosEmBlocoInterno, listarBlocosInternosParaProcessos } from "../src/dominio/blocoProcessos";
import { Sei } from "../src/sei";
import { analisarHtml } from "../src/sessao/dom";
import type { Pagina } from "../src/sessao/http";
import { checar, lanca, secao } from "./util";

const AQUI = dirname(fileURLToPath(import.meta.url));
const ler = (n: string) => readFileSync(join(AQUI, "fixtures", "sei5", n), "utf8").replace(/\r\n/g, "\n").replace(/^<!-- url: .*? -->\n/, "");
const urlDe = (n: string) => /^<!-- url: (.*?) -->/.exec(readFileSync(join(AQUI, "fixtures", "sei5", n), "utf8"))?.[1] ?? "";
const RAIZ = "https://sei.exemplo.gov.br/sei/";
const HASH_LISTA_INTERNOS = "f".repeat(64);

type Resposta = "sucesso" | "parcial" | "validacao" | "outra" | "sessao" | "excecao";

interface Post {
  url: string;
  pares: Array<[string, string]>;
}

/** Corpo x-www-form-urlencoded em latin-1 de volta para pares. */
function lerCorpo(corpo: string): Array<[string, string]> {
  const dec = (s: string) => s.replace(/\+/g, " ").replace(/%([0-9A-F]{2})/gi, (_, h: string) => String.fromCharCode(Number.parseInt(h, 16)));
  return corpo
    ? corpo.split("&").map((p) => {
        const i = p.indexOf("=");
        return [dec(p.slice(0, i)), dec(p.slice(i + 1))] as [string, string];
      })
    : [];
}

function paginaDe(html: string, url: string): Pagina {
  let doc: Document | null = null;
  return {
    url,
    status: 200,
    html,
    get doc() {
      if (!doc) doc = analisarHtml(html);
      return doc;
    },
  };
}

/** Servidor falso: `noBloco` são os processos que o bloco 41 (ou outro) já tem. */
interface Opcoes {
  noBloco?: string[];
  resposta?: Resposta;
  semMenuInternos?: boolean;
  semLinkInclusao?: boolean;
  semSelecoes?: boolean;
  /** Lupa de blocos com controle de "próxima página". */
  lupaPaginada?: boolean;
  /** Lupa cujas linhas perderam a célula de Tipo (desalinhadas do cabeçalho). */
  lupaQuebrada?: boolean;
  /** Tela do bloco com controle de "próxima página". */
  blocoPaginado?: "previa" | "resposta";
  /** O POST sai e a rede cai antes da resposta. */
  redeCaiNoPost?: boolean;
  /** Tela do bloco cujas linhas perderam a célula de Tipo. */
  blocoQuebrado?: boolean;
  /** Onde o usuário cancela: na conferência prévia ou no POST. */
  abortarEm?: "previa" | "post";
}

const PAGINAR = `<a href="javascript:infraAcaoPaginar('+',1,'Infra', null);">Próxima</a>`;

function servidor(o: Opcoes = {}) {
  const estado = { noBloco: new Set(o.noBloco ?? []), posts: [] as Post[], gets: [] as string[] };
  let controle = ler("controle_gerados.html");
  if (o.semMenuInternos) controle = controle.replace(/<li><a href="controlador\.php\?acao=bloco_interno_listar[^\n]*\n/, "");
  if (o.semLinkInclusao) controle = controle.replace(/rel_bloco_protocolo_cadastrar/g, "rel_bloco_protocolo_outro");
  if (o.semSelecoes) controle = controle.replace(/<input[^>]*name="hdnInfraSelecoes"[^>]*>\n/, "");
  let lupa = ler("bloco_selecionar_processo.html");
  if (o.lupaPaginada) lupa = lupa.replace("</table>", `</table>${PAGINAR}`);
  if (o.lupaQuebrada) lupa = lupa.replace(/<td align="center">(Interno|Reunião)<\/td>\n/g, "");
  /** A tela do bloco com só as linhas dos processos que estão nele. */
  const telaDoBloco = (idBloco: string, naResposta = false) =>
    ler("rel_bloco_protocolo_listar.html")
      .split("\n")
      .filter((l) => {
        const id = /id_procedimento=(\d+)/.exec(l)?.[1];
        return !id || !l.startsWith("<tr") || estado.noBloco.has(id);
      })
      .join("\n")
      .replace(/Bloco Interno 41/g, `Bloco Interno ${idBloco}`)
      .replace("</table>", o.blocoPaginado === (naResposta ? "resposta" : "previa") ? `</table>${PAGINAR}` : "</table>")
      .replace(/<td>Tipo Exemplo<\/td>/g, o.blocoQuebrado ? "" : "<td>Tipo Exemplo</td>");
  const abortar = () => {
    throw new DOMException("cancelado", "AbortError");
  };
  const internos = `<html><body><table id="tblBlocos"><tr><th></th><th>Número</th><th>Descrição</th></tr>${["41", "43", "44"]
    .map(
      (n) =>
        `<tr><td><input type="checkbox" value="${n}"></td><td><a href="controlador.php?acao=rel_bloco_protocolo_listar&amp;acao_origem=bloco_interno_listar&amp;id_bloco=${n}&amp;infra_sistema=100000100&amp;infra_hash=${HASH_LISTA_INTERNOS}">${n}</a></td><td>x</td></tr>`,
    )
    .join("")}</table></body></html>`;
  const resp = (url: string, html: string) => {
    const bytes = new Uint8Array([...html].map((c) => c.charCodeAt(0) & 0xff));
    return { url, status: 200, arrayBuffer: async () => bytes.buffer } as unknown as Response;
  };
  const fetch = (async (u: string, init?: RequestInit) => {
    const acao = /[?&]acao=(\w+)/.exec(u)?.[1] ?? "";
    if (init?.method !== "POST") {
      estado.gets.push(u);
      if (acao === "procedimento_controlar") return resp(u, controle);
      if (acao === "bloco_selecionar_processo") return resp(u, lupa);
      if (acao === "bloco_interno_listar") return resp(u, internos);
      if (acao === "rel_bloco_protocolo_listar" && o.abortarEm === "previa") abortar();
      if (acao === "rel_bloco_protocolo_listar") return resp(u, telaDoBloco(/[?&]id_bloco=(\d+)/.exec(u)?.[1] ?? ""));
      return resp(u, "<html><body>?</body></html>");
    }
    const pares = lerCorpo(String(init.body ?? ""));
    estado.posts.push({ url: u, pares });
    if (o.abortarEm === "post") abortar();
    if (o.redeCaiNoPost) throw new TypeError("Failed to fetch");
    const idBloco = pares.find(([n]) => n === "hdnIdBloco")?.[1] ?? "";
    switch (o.resposta ?? "sucesso") {
      case "sessao":
        return resp(`${RAIZ}login.php?sigla_orgao_sistema=X`, "<html><body>login</body></html>");
      case "excecao":
        return resp(u, '<html><body><div id="divInfraExcecao">Erro inesperado no bloco.</div></body></html>');
      case "validacao":
        return resp(
          urlDe("controle_gerados.html"),
          controle.replace("</form>\n</body>", '</form>\n<textarea id="txaInfraValidacao">Bloco 41 não está aberto.</textarea>\n</body>'),
        );
      case "outra":
        return resp(urlDe("controle_gerados.html"), controle);
      default: {
        const caixas = pares.filter(([n]) => /^chk\w+Item\d+$/.test(n));
        // "parcial": o SEI aceita o envio mas o ultimo processo nao entra.
        for (const [, v] of o.resposta === "parcial" ? caixas.slice(0, -1) : caixas) estado.noBloco.add(v);
        const url = urlDe("rel_bloco_protocolo_listar.html").replace("id_bloco=41", `id_bloco=${idBloco}`);
        return resp(url, telaDoBloco(idBloco, true));
      }
    }
  }) as unknown as typeof globalThis.fetch;
  const base = paginaDe(controle, urlDe("controle_gerados.html"));
  const sei = new Sei(base.url, () => base, { fetch });
  return { sei, estado };
}

const HASH_REC = "a".repeat(64);
const HASH_GER = "b".repeat(64);

/** Os campos do formulário do Controle como a tela os enviaria, com a seleção pedida. */
function paresEsperados(sel: { recebidos?: string[]; gerados?: string[]; bloco: string; caixas: Array<[string, string]> }): Array<[string, string]> {
  return [
    ["hdnRecebidosNroItens", "2"],
    ["hdnRecebidosItemId", ""],
    ["hdnRecebidosItens", "700001,700002"],
    ["hdnRecebidosItensHash", HASH_REC],
    ["hdnRecebidosItensSelecionados", (sel.recebidos ?? []).join(",")],
    ["hdnGeradosNroItens", "3"],
    ["hdnGeradosItemId", ""],
    ["hdnGeradosItens", "700003,700004,700005"],
    ["hdnGeradosItensHash", HASH_GER],
    ["hdnGeradosItensSelecionados", (sel.gerados ?? []).join(",")],
    ["hdnInfraSelecoes", "Recebidos,Gerados"],
    ["hdnTipoVisualizacao", "R"],
    ["hdnIdBloco", sel.bloco],
    ["txtBloco", ""],
    ...sel.caixas,
  ];
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export async function verificarBlocoProcessos(): Promise<void> {
  secao("bloco interno: lista de blocos pela lupa do Controle");
  const s1 = servidor();
  const blocos = await listarBlocosInternosParaProcessos(s1.sei);
  checar(
    "so os blocos Interno, com id, numero e descricao (latin-1)",
    igual(blocos, [
      { id: "41", numero: "41", descricao: "Contratos 2026" },
      { id: "43", numero: "43", descricao: "Processos da semana" },
      { id: "44", numero: "44", descricao: "Licitações em instrução" },
    ]),
    blocos,
  );
  checar(
    "abre a lupa pelo link assinado do HTML cru (&amp; decodificado)",
    s1.estado.gets.some((g) => g.includes("acao=bloco_selecionar_processo&tipo_selecao=1&id_object=objLupaBlocoPesquisa&") && g.includes(`infra_hash=${"2".repeat(64)}`)),
    s1.estado.gets,
  );
  checar("listar nao posta nada", s1.estado.posts.length === 0);

  secao("bloco interno: inclusao de dois processos de Gerados");
  const s2 = servidor();
  const r2 = await incluirProcessosEmBlocoInterno(s2.sei, "41", ["700003", "700004"]);
  checar("um POST so", s2.estado.posts.length === 1, s2.estado.posts.length);
  const p2 = s2.estado.posts[0];
  checar(
    "POST no link rel_bloco_protocolo_cadastrar do finalizarSelecao",
    !!p2 && p2.url.includes("acao=rel_bloco_protocolo_cadastrar&acao_origem=procedimento_controlar&acao_retorno=procedimento_controlar&") && p2.url.includes(`infra_hash=${"3".repeat(64)}`),
    p2?.url,
  );
  const esperado2 = paresEsperados({ gerados: ["700003", "700004"], bloco: "41", caixas: [["chkGeradosItem0", "700003"], ["chkGeradosItem1", "700004"]] });
  checar("pares exatos (campos originais + selecao + caixas + hdnIdBloco)", igual(p2?.pares, esperado2), p2?.pares);
  checar(
    "os dois incluidos",
    igual(r2, [
      { idProcedimento: "700003", situacao: "incluido" },
      { idProcedimento: "700004", situacao: "incluido" },
    ]),
    r2,
  );
  checar(
    "confere o bloco ANTES de postar (link achado na lista de blocos internos)",
    s2.estado.gets.some((g) => g.includes("acao=rel_bloco_protocolo_listar") && g.includes("id_bloco=41") && g.includes(HASH_LISTA_INTERNOS)),
    s2.estado.gets,
  );

  secao("bloco interno: Recebidos e Gerados no mesmo POST");
  const s3 = servidor();
  const r3 = await incluirProcessosEmBlocoInterno(s3.sei, "43", ["700001", "700005"]);
  const esperado3 = paresEsperados({ recebidos: ["700001"], gerados: ["700005"], bloco: "43", caixas: [["chkRecebidosItem0", "700001"], ["chkGeradosItem2", "700005"]] });
  checar("um POST com a selecao de cada lista", s3.estado.posts.length === 1 && igual(s3.estado.posts[0]?.pares, esperado3), s3.estado.posts[0]?.pares);
  checar("os dois incluidos no 43", r3.every((r) => r.situacao === "incluido") && r3.length === 2, r3);

  secao("bloco interno: fora da pagina, ja no bloco, sigiloso");
  const s4 = servidor();
  const r4 = await incluirProcessosEmBlocoInterno(s4.sei, "41", ["700003", "999999"]);
  checar("id fora das listas => fora-da-pagina", igual(r4[1], { idProcedimento: "999999", situacao: "fora-da-pagina" }), r4);
  checar("e nao vai no POST", s4.estado.posts.length === 1 && !(s4.estado.posts[0]?.pares ?? []).some(([, v]) => v.includes("999999")), s4.estado.posts[0]?.pares);
  checar("o outro incluido", r4[0]?.situacao === "incluido", r4);

  const s5 = servidor({ noBloco: ["700004"] });
  const r5 = await incluirProcessosEmBlocoInterno(s5.sei, "41", ["700003", "700004"]);
  checar("id ja no bloco => ja-estava", igual(r5, [{ idProcedimento: "700003", situacao: "incluido" }, { idProcedimento: "700004", situacao: "ja-estava" }]), r5);
  const p5 = s5.estado.posts[0]?.pares ?? [];
  checar(
    "e nao vai no POST",
    s5.estado.posts.length === 1 && !p5.some(([n]) => n === "chkGeradosItem1") && p5.some(([n, v]) => n === "hdnGeradosItensSelecionados" && v === "700003"),
    p5,
  );

  const s6 = servidor();
  const r6 = await incluirProcessosEmBlocoInterno(s6.sei, "41", ["700002", "700003"]);
  checar("sigiloso => erro sem POST para ele", r6[0]?.situacao === "erro" && /sigiloso/i.test(r6[0]?.erro ?? "") && r6[1]?.situacao === "incluido", r6);
  checar("sigiloso: mensagem neutra (serve ao agente e ao Processos em Lote)", r6[0]?.erro === "Processo sigiloso: n\u00E3o \u00E9 inclu\u00EDdo em bloco por aqui.", r6[0]);
  const p6 = s6.estado.posts[0]?.pares ?? [];
  checar(
    "o sigiloso nao vai no POST",
    !p6.some(([n]) => n === "chkRecebidosItem1") && p6.some(([n, v]) => n === "hdnRecebidosItensSelecionados" && v === ""),
    p6,
  );

  secao("bloco interno: nada elegivel, nenhum POST");
  const s7 = servidor({ noBloco: ["700003"] });
  const r7 = await incluirProcessosEmBlocoInterno(s7.sei, "41", ["999998", "700003", "999999"]);
  checar("nenhum POST", s7.estado.posts.length === 0, s7.estado.posts);
  checar("cada um com a sua situacao", igual(r7.map((r) => r.situacao), ["fora-da-pagina", "ja-estava", "fora-da-pagina"]), r7);
  checar("lista vazia: nada a fazer", igual(await incluirProcessosEmBlocoInterno(servidor().sei, "41", []), []));
  const s7b = servidor();
  const r7b = await incluirProcessosEmBlocoInterno(s7b.sei, "41", ["700003", " 700003 "]);
  checar("id repetido conta uma vez", r7b.length === 1 && s7b.estado.posts.length === 1, r7b);

  secao("bloco interno: resposta sem a prova de sucesso");
  const s8 = servidor({ resposta: "validacao" });
  const r8 = await incluirProcessosEmBlocoInterno(s8.sei, "41", ["700003", "700004", "999999"]);
  checar(
    "URL final diferente => todos os postados viram erro com a mensagem do SEI",
    r8[0]?.situacao === "erro" && r8[1]?.situacao === "erro" && (r8[0]?.erro ?? "").includes("Bloco 41 não está aberto."),
    r8,
  );
  checar("fora-da-pagina continua fora-da-pagina", r8[2]?.situacao === "fora-da-pagina", r8);
  const r8b = await incluirProcessosEmBlocoInterno(servidor({ resposta: "outra" }).sei, "41", ["700003"]);
  checar("sem mensagem e URL diferente: nao-confirmado (pode ter gravado)", r8b[0]?.situacao === "nao-confirmado" && /confira o bloco 41/.test(r8b[0]?.erro ?? ""), r8b);
  const r8c = await incluirProcessosEmBlocoInterno(servidor({ resposta: "excecao" }).sei, "41", ["700003"]);
  checar(
    "pagina de excecao depois do POST => nao-confirmado com a mensagem, sem lancar",
    r8c[0]?.situacao === "nao-confirmado" && (r8c[0]?.erro ?? "").includes("Erro inesperado no bloco."),
    r8c,
  );
  const s8e = servidor({ redeCaiNoPost: true });
  const r8e = await incluirProcessosEmBlocoInterno(s8e.sei, "41", ["700003", "700004"]);
  checar(
    "rede cai no POST => nao-confirmado para todos, sem lancar",
    s8e.estado.posts.length === 1 && r8e.every((r) => r.situacao === "nao-confirmado" && /confira o bloco 41/i.test(r.erro ?? "")),
    r8e,
  );
  const r8d = await incluirProcessosEmBlocoInterno(servidor({ resposta: "parcial" }).sei, "41", ["700003", "700004"]);
  checar("URL certa mas processo fora da tela do bloco => erro so para ele", r8d[0]?.situacao === "incluido" && r8d[1]?.situacao === "erro" && !!r8d[1]?.erro, r8d);
  const e8 = await lanca(() => incluirProcessosEmBlocoInterno(servidor({ resposta: "sessao" }).sei, "41", ["700003"]));
  checar("sessao expirada lanca (nao vira erro por processo)", e8?.codigo === "SEI_SESSAO_EXPIRADA", e8);

  secao("bloco interno: bloco que nao serve");
  const s9 = servidor();
  const e9 = await lanca(() => incluirProcessosEmBlocoInterno(s9.sei, "99", ["700003"]));
  checar("bloco inexistente lanca", e9?.codigo === "SEI_NAO_ENCONTRADO", e9);
  const e9b = await lanca(() => incluirProcessosEmBlocoInterno(s9.sei, "42", ["700003"]));
  checar("bloco de Reuniao lanca", e9b?.codigo === "SEI_NAO_ENCONTRADO", e9b);
  checar("e nada foi postado", s9.estado.posts.length === 0, s9.estado.posts);
  const e9c = await lanca(() => incluirProcessosEmBlocoInterno(servidor({ semLinkInclusao: true }).sei, "41", ["700003"]));
  checar("Controle sem o link de inclusao lanca", e9c?.codigo === "SEI_ACAO_INDISPONIVEL", e9c);

  secao("bloco interno: sem como conferir o bloco antes");
  const s10 = servidor({ semMenuInternos: true });
  const r10 = await incluirProcessosEmBlocoInterno(s10.sei, "41", ["700003", "700004"]);
  checar("pula a conferencia previa (nenhum GET da tela do bloco)", !s10.estado.gets.some((g) => g.includes("acao=rel_bloco_protocolo_listar")), s10.estado.gets);
  checar("e classifica pela tela da resposta", s10.estado.posts.length === 1 && r10.every((r) => r.situacao === "incluido"), r10);

  secao("bloco interno: hdnInfraSelecoes ausente");
  const s11 = servidor({ semSelecoes: true });
  const r11 = await incluirProcessosEmBlocoInterno(s11.sei, "41", ["700001", "700004"]);
  const esperado11 = paresEsperados({ recebidos: ["700001"], gerados: ["700004"], bloco: "41", caixas: [["chkRecebidosItem0", "700001"], ["chkGeradosItem1", "700004"]] }).filter(
    ([n]) => n !== "hdnInfraSelecoes",
  );
  checar("cai para Recebidos e Gerados", igual(s11.estado.posts[0]?.pares, esperado11) && r11.every((r) => r.situacao === "incluido"), s11.estado.posts[0]?.pares);

  secao("bloco interno: cancelamento propaga");
  const s12 = servidor({ abortarEm: "previa" });
  const e12 = await lanca(() => incluirProcessosEmBlocoInterno(s12.sei, "41", ["700003"]));
  checar("cancelado na conferencia previa lanca CANCELADO, sem POST", e12?.codigo === "CANCELADO" && s12.estado.posts.length === 0, e12);
  const e12b = await lanca(() => incluirProcessosEmBlocoInterno(servidor({ abortarEm: "post" }).sei, "41", ["700003"]));
  checar("cancelado no POST lanca CANCELADO (nao vira erro por processo)", e12b?.codigo === "CANCELADO", e12b);

  secao("bloco interno: lupa de blocos paginada ou desalinhada");
  const e13 = await lanca(() => listarBlocosInternosParaProcessos(servidor({ lupaPaginada: true }).sei));
  checar("listar falha alto quando a lupa tem mais paginas", e13?.codigo === "SEI_VERSAO_NAO_SUPORTADA" && /mais de uma p/.test(e13?.message ?? ""), e13);
  const s13 = servidor({ lupaPaginada: true });
  const r13 = await incluirProcessosEmBlocoInterno(s13.sei, "41", ["700003"]);
  checar("incluir num bloco da primeira pagina funciona", r13[0]?.situacao === "incluido" && s13.estado.posts.length === 1, r13);
  const e13b = await lanca(() => incluirProcessosEmBlocoInterno(servidor({ lupaPaginada: true }).sei, "99", ["700003"]));
  checar("bloco fora da primeira pagina: a mensagem diz isso", e13b?.codigo === "SEI_NAO_ENCONTRADO" && /primeira p/.test(e13b?.message ?? ""), e13b);
  checar("sem paginacao a mensagem nao fala em primeira pagina", !/primeira p/.test(e9?.message ?? ""), e9);
  const e13c = await lanca(() => listarBlocosInternosParaProcessos(servidor({ lupaQuebrada: true }).sei));
  checar("linhas da lupa sem as colunas do cabecalho: SEI_VERSAO_NAO_SUPORTADA", e13c?.codigo === "SEI_VERSAO_NAO_SUPORTADA", e13c);

  secao("bloco interno: tela do bloco paginada ou desalinhada");
  const r14 = await incluirProcessosEmBlocoInterno(servidor({ resposta: "parcial", blocoPaginado: "resposta" }).sei, "41", ["700003", "700004"]);
  checar(
    "ausente numa tela paginada depois do POST: nao-confirmado, com o bloco",
    r14[0]?.situacao === "incluido" && r14[1]?.situacao === "nao-confirmado" && /mais de uma p.*confira o bloco 41/.test(r14[1]?.erro ?? ""),
    r14,
  );
  const s14 = servidor({ noBloco: ["700005"], blocoQuebrado: true });
  const e14 = await lanca(() => incluirProcessosEmBlocoInterno(s14.sei, "41", ["700003"]));
  checar("tela do bloco irreconhecivel antes do POST: lanca e nao posta", e14?.codigo === "SEI_VERSAO_NAO_SUPORTADA" && s14.estado.posts.length === 0, e14);
  const r14b = await incluirProcessosEmBlocoInterno(servidor({ blocoQuebrado: true, semMenuInternos: true }).sei, "41", ["700003"]);
  checar("irreconhecivel depois do POST: nao-confirmado por processo, sem lancar", r14b[0]?.situacao === "nao-confirmado" && /confira o bloco 41/.test(r14b[0]?.erro ?? ""), r14b);

  secao("bloco interno: tela do bloco paginada ANTES do POST");
  const s15 = servidor({ noBloco: ["700004"], blocoPaginado: "previa" });
  const r15 = await incluirProcessosEmBlocoInterno(s15.sei, "41", ["700003", "700004"]);
  checar("quem esta na primeira pagina: ja-estava", r15[1]?.situacao === "ja-estava", r15);
  checar(
    "quem nao esta: nao-confirmado ('confira antes de incluir')",
    r15[0]?.situacao === "nao-confirmado" && /mais de uma p.*confira o bloco 41 antes de incluir/.test(r15[0]?.erro ?? ""),
    r15,
  );
  checar("e nenhum POST as cegas", s15.estado.posts.length === 0, s15.estado.posts);
}
