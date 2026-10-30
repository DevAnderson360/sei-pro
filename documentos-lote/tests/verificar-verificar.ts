/**
 * Verificacao do processo de destino (src/sei/verificar.ts), com um `Http` falso que grava as chamadas e um `Sei`
 * de verdade (pesquisa rapida, arvore e tela de tipos passam pelo nucleo). A arvore e montada aqui, minima, no
 * formato que `lerArvore` le (infraArvoreNo/infraArvoreAcao); a tela de tipos e a fixture escolher_tipo.html.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Sei } from "@nucleo/sei";
import { analisarHtml, definirAnalisador } from "@nucleo/sessao/dom";
import { ErroSei } from "@nucleo/sessao/erros";
import type { Http, OpcoesHttp, Pagina } from "@nucleo/sessao/http";
import { DOMParser } from "linkedom";
import { verificarProcesso } from "../src/sei/verificar";
import { checar, igual, secao } from "./util";

const parser = new DOMParser();
definirAnalisador((html) => parser.parseFromString(html, "text/html") as unknown as Document);

const AQUI = dirname(fileURLToPath(import.meta.url));
const BASE = "https://sei.exemplo.gov.br/sei/";
const H = "a".repeat(64);
const assinado = (q: string) => `controlador.php?${q}&infra_sistema=100000100&infra_unidade_atual=110000001&infra_hash=${H}`;

function pagina(url: string, html: string): Pagina {
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

function fixture(nome: string): Pagina {
  const b = readFileSync(join(AQUI, "fixtures", nome), "utf8");
  const url = /^<!-- url: (.*?) -->/.exec(b)?.[1] ?? BASE;
  return pagina(url, b.replace(/^<!-- url: .*? -->\n/, ""));
}

type Situacao = "ok" | "restrito" | "sigiloso" | "fechado";

/** Arvore minima de um processo: o no raiz, a barra de acoes (com ou sem "Incluir Documento") e o nivel de acesso. */
function arvoreHtml(id: string, protocolo: string, s: Situacao): string {
  const incluir = assinado(`acao=documento_escolher_tipo&acao_origem=arvore_visualizar&id_procedimento=${id}&arvore=1`);
  const acoes = s === "fechado" ? "" : `<a href="${incluir}"><img title="Incluir Documento"/></a>`;
  const nivel =
    s === "sigiloso"
      ? `NosAcoes[0] = new infraArvoreAcao("NIVEL_ACESSO","NA${id}","${id}","javascript:alert('Acesso Sigiloso');",null,"Acesso Sigiloso","svg/processo_sigiloso.svg?18",true);`
      : s === "restrito"
        ? `NosAcoes[0] = new infraArvoreAcao("NIVEL_ACESSO","NA${id}","${id}","javascript:alert('Acesso Restrito');",null,"Acesso Restrito\\nInformacao pessoal","svg/processo_restrito.svg?18",true);`
        : "";
  return `<html><head><title>SEI - Arvore Montar</title></head><body><script>
Nos[0] = new infraArvoreNo("PROCESSO","${id}",null,"${assinado(`acao=arvore_visualizar&id_procedimento=${id}`)}","ifrVisualizacao","${protocolo}","Processo de teste","svg/processo.svg","svg/processo.svg","svg/processo.svg",true,true,"noVisitado",null,"noVisitado","${protocolo}");
Nos[0].acoes = '${acoes}';
${nivel}
</script></body></html>`;
}

interface Alvo {
  id: string;
  situacao: Situacao;
  /** A pesquisa rapida leva a um documento deste processo (a referencia era um numero SEI de documento). */
  documento?: string;
}

type Pares = Array<[string, string]>;
interface Chamada {
  metodo: "GET" | "POST";
  url: string;
  campos: Pares;
}

interface Montagem {
  /** referencia digitada -> processo (ausente = "nada encontrado"). */
  alvos: Record<string, Alvo>;
  /** Falha a chamada (por trecho da URL) com este erro. */
  falhas?: Record<string, unknown>;
}

function montar(m: Montagem) {
  const chamadas: Chamada[] = [];
  const base = new URL(BASE);
  const absoluta = (url: string) => new URL(url.replace(/&amp;/g, "&"), base).href;
  const protocolos: Record<string, string> = {};
  for (const [ref, a] of Object.entries(m.alvos)) protocolos[a.id] = a.documento ? (protocolos[a.id] ?? ref) : ref;

  const responder = async (metodo: "GET" | "POST", url: string, campos: Pares): Promise<Pagina> => {
    const abs = absoluta(url);
    chamadas.push({ metodo, url: abs, campos });
    for (const [trecho, erro] of Object.entries(m.falhas ?? {})) if (abs.includes(trecho)) throw erro;
    if (metodo === "POST" && abs.includes("acao=protocolo_pesquisa_rapida")) {
      const ref = campos.find(([k]) => k === "txtPesquisaRapida")?.[1] ?? "";
      const alvo = m.alvos[ref];
      if (!alvo) return pagina(absoluta(assinado("acao=md_pesquisa_rapida_resultado")), "<html><body>Nada encontrado</body></html>");
      const doc = alvo.documento ? `&id_protocolo=${alvo.documento}` : `&id_protocolo=${alvo.id}`;
      const src = assinado(`acao=procedimento_visualizar&acao_origem=procedimento_trabalhar&id_procedimento=${alvo.id}`);
      return pagina(
        absoluta(`controlador.php?acao=procedimento_trabalhar&id_procedimento=${alvo.id}${doc}`),
        `<html><body><iframe id="ifrArvore" src="${src}"></iframe></body></html>`,
      );
    }
    if (metodo === "GET" && abs.includes("acao=procedimento_visualizar")) {
      const id = /id_procedimento=(\d+)/.exec(abs)?.[1] ?? "";
      const alvo = Object.values(m.alvos).find((a) => a.id === id);
      return pagina(abs, arvoreHtml(id, protocolos[id] ?? id, alvo?.situacao ?? "ok"));
    }
    if (metodo === "GET" && abs.includes("acao=documento_escolher_tipo")) return fixture("escolher_tipo.html");
    throw new Error(`rota nao prevista: ${metodo} ${abs}`);
  };

  const http: Http = {
    base,
    absoluta,
    obter: (url: string, _op?: OpcoesHttp) => responder("GET", url, []),
    enviar: (url: string, campos: ReadonlyArray<readonly [string, string]>, _op?: OpcoesHttp) =>
      responder(
        "POST",
        url,
        campos.map(([n, v]) => [n, v] as [string, string]),
      ),
    baixar: async () => {
      throw new Error("baixar nao previsto");
    },
  };
  const menu = fixture("menu.html");
  const sei = new Sei(menu.url, () => menu);
  (sei as unknown as { http: Http }).http = http;
  const gets = (trecho: string) => chamadas.filter((c) => c.metodo === "GET" && c.url.includes(trecho)).length;
  return { sei, chamadas, gets, arvores: () => gets("acao=procedimento_visualizar") };
}

const PROC = "99999.000001/2026-01";
const TIPO = "12";

export async function verificarVerificar(): Promise<void> {
  secao("verificar: processo aberto -> ok");
  {
    const { sei, arvores, gets } = montar({ alvos: { [PROC]: { id: "500", situacao: "ok" } } });
    const r = await verificarProcesso(sei, PROC, TIPO);
    igual("status ok", r.status, "ok");
    igual("numero devolvido como veio", r.numero, PROC);
    igual("idProcedimento", r.idProcedimento, "500");
    checar(
      "linkArvore e o link assinado da arvore",
      /acao=procedimento_visualizar.*id_procedimento=500.*infra_hash=/.test(r.linkArvore ?? ""),
      r.linkArvore,
    );
    igual("sem mensagem no ok", r.mensagem, undefined);
    igual("a arvore foi lida UMA vez (a tela de tipos reaproveita a recem-lida)", arvores(), 1);
    igual("a tela de tipos foi lida", gets("acao=documento_escolher_tipo"), 1);
  }

  secao("verificar: restrito (nao sigiloso) com link de incluir -> ok");
  {
    const { sei } = montar({ alvos: { [PROC]: { id: "500", situacao: "restrito" } } });
    igual("restrito e ok", (await verificarProcesso(sei, PROC, TIPO)).status, "ok");
  }

  secao("verificar: nao encontrado");
  {
    const { sei, arvores } = montar({ alvos: {} });
    const r = await verificarProcesso(sei, "99999.000009/2026-09", TIPO);
    igual("status nao-encontrado", r.status, "nao-encontrado");
    checar("com mensagem", Boolean(r.mensagem), r);
    igual("sem idProcedimento", r.idProcedimento, undefined);
    igual("nenhuma arvore lida", arvores(), 0);
    igual("texto qualquer de uma palavra tambem e nao-encontrado", (await verificarProcesso(sei, "Maria", TIPO)).status, "nao-encontrado");
    igual("numero vazio e nao-encontrado", (await verificarProcesso(sei, "  ", TIPO)).status, "nao-encontrado");
  }

  secao("verificar: numero de DOCUMENTO nunca vira destino");
  {
    const { sei, arvores, gets } = montar({ alvos: { "0100002": { id: "500", situacao: "ok", documento: "701" } } });
    const r = await verificarProcesso(sei, "0100002", TIPO);
    igual("status nao-encontrado", r.status, "nao-encontrado");
    checar("a mensagem diz que e de documento", /documento/i.test(r.mensagem ?? "") && /processo/i.test(r.mensagem ?? ""), r.mensagem);
    igual("sem idProcedimento (o processo do documento NAO e o destino)", r.idProcedimento, undefined);
    igual("sem linkArvore", r.linkArvore, undefined);
    igual("nao leu arvore nem tela de tipos", arvores() + gets("acao=documento_escolher_tipo"), 0);
  }

  secao("verificar: sigiloso");
  {
    const { sei, gets } = montar({ alvos: { [PROC]: { id: "500", situacao: "sigiloso" } } });
    const r = await verificarProcesso(sei, PROC, TIPO);
    igual("status sigiloso", r.status, "sigiloso");
    igual("sem linkArvore", r.linkArvore, undefined);
    igual("nao abriu a tela de tipos", gets("acao=documento_escolher_tipo"), 0);
  }

  secao("verificar: nao aberto na unidade");
  {
    const { sei, gets } = montar({ alvos: { [PROC]: { id: "500", situacao: "fechado" } } });
    const r = await verificarProcesso(sei, PROC, TIPO);
    igual("status nao-aberto", r.status, "nao-aberto");
    igual("idProcedimento presente", r.idProcedimento, "500");
    checar("linkArvore presente (para abrir em outra aba)", Boolean(r.linkArvore), r);
    igual("nao abriu a tela de tipos", gets("acao=documento_escolher_tipo"), 0);
  }

  secao("verificar: tipo indisponivel");
  {
    const { sei } = montar({ alvos: { [PROC]: { id: "500", situacao: "ok" } } });
    const r = await verificarProcesso(sei, PROC, "999");
    igual("status tipo-indisponivel", r.status, "tipo-indisponivel");
    igual("idProcedimento presente", r.idProcedimento, "500");
    checar("com mensagem", Boolean(r.mensagem), r);
  }

  secao("verificar: a tela de tipos diz indisponivel -> nao-aberto");
  {
    const { sei } = montar({
      alvos: { [PROC]: { id: "500", situacao: "ok" } },
      falhas: { "acao=documento_escolher_tipo": new ErroSei("SEI_ACAO_INDISPONIVEL", "fechado na unidade") },
    });
    igual("SEI_ACAO_INDISPONIVEL e nao-aberto", (await verificarProcesso(sei, PROC, TIPO)).status, "nao-aberto");
  }

  secao("verificar: erros de rede, sessao e cancelamento -> erro-rede (nunca lanca)");
  {
    const a = montar({
      alvos: { [PROC]: { id: "500", situacao: "ok" } },
      falhas: { "acao=protocolo_pesquisa_rapida": new ErroSei("SEI_REDE", "tempo esgotado") },
    });
    const r1 = await verificarProcesso(a.sei, PROC, TIPO);
    igual("SEI_REDE na pesquisa", r1.status, "erro-rede");
    checar("com mensagem", /tempo esgotado/.test(r1.mensagem ?? ""), r1.mensagem);

    const b = montar({
      alvos: { [PROC]: { id: "500", situacao: "ok" } },
      falhas: { "acao=procedimento_visualizar": new ErroSei("SEI_SESSAO_EXPIRADA", "sessao expirou") },
    });
    igual("sessao expirada na arvore", (await verificarProcesso(b.sei, PROC, TIPO)).status, "erro-rede");

    const c = montar({
      alvos: { [PROC]: { id: "500", situacao: "ok" } },
      falhas: { "acao=documento_escolher_tipo": new TypeError("fetch failed") },
    });
    const r3 = await verificarProcesso(c.sei, PROC, TIPO);
    igual("erro generico na tela de tipos", r3.status, "erro-rede");
    checar("mensagem do erro", /fetch failed/.test(r3.mensagem ?? ""), r3.mensagem);

    const d = montar({
      alvos: { [PROC]: { id: "500", situacao: "ok" } },
      falhas: { "acao=procedimento_visualizar": new DOMException("Aborted", "AbortError") },
    });
    const r4 = await verificarProcesso(d.sei, PROC, TIPO);
    igual("abort no meio", r4.status, "erro-rede");
    checar("mensagem de cancelado", /cancelad/i.test(r4.mensagem ?? ""), r4.mensagem);

    const e = montar({ alvos: { [PROC]: { id: "500", situacao: "ok" } } });
    const ctl = new AbortController();
    ctl.abort();
    const r5 = await verificarProcesso(e.sei, PROC, TIPO, ctl.signal);
    igual("sinal ja abortado: erro-rede", r5.status, "erro-rede");
    checar("cancelado", /cancelad/i.test(r5.mensagem ?? ""), r5.mensagem);
    igual("e nem tocou no SEI", e.chamadas.length, 0);
  }

  secao("verificar: reverificar nao usa o cache de 30 s");
  {
    const alvos: Record<string, Alvo> = { [PROC]: { id: "500", situacao: "fechado" } };
    const { sei, arvores } = montar({ alvos });
    igual("1a: nao-aberto", (await verificarProcesso(sei, PROC, TIPO)).status, "nao-aberto");
    alvos[PROC].situacao = "ok";
    igual("2a (o usuario abriu o processo na unidade): ok", (await verificarProcesso(sei, PROC, TIPO)).status, "ok");
    igual("a arvore foi relida na 2a", arvores(), 2);
    alvos[PROC].situacao = "fechado";
    igual("3a: de novo nao-aberto", (await verificarProcesso(sei, PROC, TIPO)).status, "nao-aberto");
  }

  secao("verificar: nao-encontrado que passa a encontrado (so sucesso e cacheado em localizados)");
  {
    const alvos: Record<string, Alvo> = {};
    const { sei } = montar({ alvos });
    igual("1a: nao-encontrado", (await verificarProcesso(sei, PROC, TIPO)).status, "nao-encontrado");
    alvos[PROC] = { id: "500", situacao: "ok" };
    igual("2a: ok", (await verificarProcesso(sei, PROC, TIPO)).status, "ok");
  }
}
