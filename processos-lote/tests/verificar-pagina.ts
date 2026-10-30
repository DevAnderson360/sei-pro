/**
 * Lado da aba do Processos em Lote: o que os tratadores devolvem ao app (JSON simples, sem tipos de excecao), a
 * regra de nunca repetir uma criacao incerta, e o modal ligado so com a opcao `proclote`.
 *
 * As chamadas ao SEI entram pelas dependencias (`chamadas`), entao cada desfecho e forcado sem rede.
 */

import { parDePortas } from "@comum/ponte/parDePortas";
import { criarControleModal, ligarAvisoSemModal } from "@comum/ui/modalIframe";
import { ErroSei } from "@nucleo/sessao/erros";
import { ATRIBUTO_ATIVO, EVENTO_ABRIR } from "../src/modelo/constantes";
import type { ContextoLote } from "../src/pagina/contexto";
import { type ChamadasSei, tratadoresProcessosLote } from "../src/pagina/executor";
import { marcarAtivo } from "../src/pagina/marca";
import { armarSeLigado, CONFIG_MODAL } from "../src/pagina/modal";
import type { Criado } from "../src/repositorio";
import { ErroProcessoCriado } from "../src/sei/criar";
import type { FormTipo } from "../src/sei/formularioTipo";
import { checar, igual, instalarDom, lanca, secao } from "./util";

const BASE = "https://sei.x.gov.br/sei/controlador.php?acao=procedimento_controlar&infra_hash=zzz";
const CTX: ContextoLote = { host: "sei.x.gov.br", login: "ana", temaEscuro: false, base: BASE };

function formDe(idTipo: string, n: number): FormTipo {
  return {
    idTipo,
    action: `controlador.php?acao=procedimento_gerar&infra_hash=h${n}`,
    params: [["hdnSegredo", `v${n}`]],
    hipoteses: [{ id: "7", nome: "Sigilo" }],
    assuntos: "1±Assunto",
    interessados: "",
  };
}

const CRIADO: Criado = { numero: "00001.000001/2026-11", idProcedimento: "55", url: "https://sei.x.gov.br/sei/x" };

/** Seam: conta as buscas do formulario e os POSTs; `respostas` diz o desfecho de cada POST, em ordem. */
function falso(respostas: Array<() => Criado & { aviso?: string }>) {
  const n = { forms: 0, posts: 0, formsUsados: [] as string[] };
  const chamadas: ChamadasSei = {
    listarTipos: async () => [{ id: "1", nome: "Tipo A" }],
    carregarFormTipo: async (_sei, idTipo) => formDe(idTipo, ++n.forms),
    criarProcesso: async (_sei, form) => {
      n.formsUsados.push(form.action);
      const r = respostas[n.posts++];
      if (!r) throw new Error("POST a mais");
      return r();
    },
  };
  const t = tratadoresProcessosLote({ sei: {} as never, ctx: CTX, abrirLinkPermanente: () => {}, chamadas });
  return { t, n };
}

const PEDIDO = { idTipo: "1", linha: { especificacao: "Teste" }, nivelAcesso: "0", hipoteseLegal: "" };
const falha = (e: unknown) => () => {
  throw e;
};

export async function verificarPagina(): Promise<void> {
  secao("Pagina: marca");
  const d0 = instalarDom();
  marcarAtivo(d0);
  checar("marca o html", d0.documentElement.getAttribute(ATRIBUTO_ATIVO) === "1");

  secao("Pagina: contexto e tipos");
  {
    const { t } = falso([]);
    const c = (await t.contexto(undefined)) as Record<string, unknown>;
    checar("contexto sem base", c.host === "sei.x.gov.br" && c.login === "ana" && !("base" in c), c);
    igual("tipos", await t.tipos(undefined), [{ id: "1", nome: "Tipo A" }]);
  }

  secao("Pagina: formTipo nao atravessa a ponte");
  {
    const { t } = falso([]);
    const r = (await t.formTipo({ idTipo: "1" })) as Record<string, unknown>;
    igual("so idTipo, hipoteses e temAssuntos", r, { idTipo: "1", hipoteses: [{ id: "7", nome: "Sigilo" }], temAssuntos: true });
    checar("sem params nem action", !("params" in r) && !("action" in r) && !JSON.stringify(r).includes("infra_hash"));
  }

  secao("Pagina: criar ok (reusa o formulario)");
  {
    const { t, n } = falso([() => CRIADO, () => ({ ...CRIADO, aviso: "interessado ignorado" })]);
    await t.formTipo({ idTipo: "1" });
    igual("ok", await t.criar(PEDIDO), { situacao: "ok", criado: CRIADO });
    igual("ok com aviso", await t.criar(PEDIDO), { situacao: "ok", criado: CRIADO, aviso: "interessado ignorado" });
    checar("um formulario so para 2 POSTs", n.forms === 1 && n.posts === 2, n);
  }

  secao("Pagina: criar sem formTipo antes busca o formulario");
  {
    const { t, n } = falso([() => CRIADO]);
    igual("ok", await t.criar(PEDIDO), { situacao: "ok", criado: CRIADO });
    checar("1 formulario, 1 POST", n.forms === 1 && n.posts === 1, n);
  }

  secao("Pagina: criar refaz o formulario uma vez (nao criado garantido)");
  {
    const { t, n } = falso([falha(new ErroSei("SEI_VALIDACAO", "recusado")), () => CRIADO]);
    await t.formTipo({ idTipo: "1" });
    igual("ok na 2a", await t.criar(PEDIDO), { situacao: "ok", criado: CRIADO });
    checar("exatamente 2 POSTs e 2 formularios", n.posts === 2 && n.forms === 2, n);
    checar("a 2a usou o formulario novo", n.formsUsados[1]?.endsWith("h2") === true, n.formsUsados);
  }
  {
    const { t, n } = falso([
      falha(new ErroSei("SEI_RESPOSTA_INESPERADA", "nao confirmou")),
      falha(new ErroSei("SEI_VALIDACAO", "de novo")),
    ]);
    await t.formTipo({ idTipo: "1" });
    igual("erro depois da 2a", await t.criar(PEDIDO), { situacao: "erro", erro: "de novo" });
    checar("sem 3a tentativa", n.posts === 2 && n.forms === 2, n);
  }

  secao("Pagina: sessao expirada para a fila");
  {
    const { t, n } = falso([falha(new ErroSei("SEI_SESSAO_EXPIRADA", "sessao"))]);
    await t.formTipo({ idTipo: "1" });
    igual("erro + parar", await t.criar(PEDIDO), { situacao: "erro", erro: "sessao", parar: true });
    checar("1 POST, sem refazer formulario", n.posts === 1 && n.forms === 1, n);
  }

  secao("Pagina: criacao incerta nunca repete");
  {
    const { t, n } = falso([falha(new ErroSei("SEI_REDE", "rede"))]);
    await t.formTipo({ idTipo: "1" });
    const r = (await t.criar(PEDIDO)) as { situacao: string; incerto?: boolean; criado: Criado; aviso?: string };
    checar("rede: ok + incerto", r.situacao === "ok" && r.incerto === true, r);
    checar(
      "rede: numero de conferencia",
      r.criado.numero === "(incerto: confira no Controle de Processos)" && r.criado.idProcedimento === "",
      r,
    );
    checar("rede: aviso fala do Controle de Processos", (r.aviso ?? "").includes("Controle de Processos"), r);
    checar("rede: 1 POST so", n.posts === 1 && n.forms === 1, n);
  }
  {
    const { t, n } = falso([falha(new ErroSei("SEI_EXCECAO", "pagina de erro"))]);
    const r = (await t.criar(PEDIDO)) as { situacao: string; incerto?: boolean };
    checar("excecao: ok + incerto, 1 POST", r.situacao === "ok" && r.incerto === true && n.posts === 1, { r, n });
    checar("excecao: 1 busca de formulario (sem refazer)", n.forms === 1, n);
  }
  {
    const { t, n } = falso([falha(new ErroSei("CANCELADO", "cancelado"))]);
    const r = (await t.criar(PEDIDO)) as { situacao: string; incerto?: boolean };
    checar("cancelado: ok + incerto", r.situacao === "ok" && r.incerto === true, r);
    checar("cancelado: exatamente 1 POST", n.posts === 1 && n.forms === 1, n);
  }
  {
    const { t, n } = falso([falha(new ErroProcessoCriado("00001.000009/2026-99"))]);
    const r = (await t.criar(PEDIDO)) as { situacao: string; incerto?: boolean; criado: Criado };
    checar(
      "criado sem id: numero do titulo",
      r.situacao === "ok" && r.incerto === true && r.criado.numero === "00001.000009/2026-99" && r.criado.url === "",
      r,
    );
    checar("criado sem id: 1 POST", n.posts === 1, n);
  }
  {
    const { t } = falso([falha(new ErroProcessoCriado(""))]);
    const r = (await t.criar(PEDIDO)) as { criado: Criado };
    checar("criado sem id e sem numero: texto de conferencia", r.criado.numero === "(incerto: confira no Controle de Processos)", r);
  }
  {
    const { t, n } = falso([falha(new TypeError("Failed to fetch"))]);
    const r = (await t.criar(PEDIDO)) as { situacao: string; incerto?: boolean };
    checar("erro nao-Sei no envio: incerto, 1 POST", r.situacao === "ok" && r.incerto === true && n.posts === 1, { r, n });
  }

  secao("Pagina: numero nao identificado");
  {
    const { t } = falso([() => ({ ...CRIADO, numero: "", aviso: "numero nao identificado" })]);
    igual("ok com texto no lugar do numero", await t.criar(PEDIDO), {
      situacao: "ok",
      criado: { ...CRIADO, numero: "(numero nao identificado)" },
      aviso: "numero nao identificado",
    });
  }

  secao("Pagina: falha ao refazer o formulario");
  {
    let forms = 0;
    let posts = 0;
    const t = tratadoresProcessosLote({
      sei: {} as never,
      ctx: CTX,
      abrirLinkPermanente: () => {},
      chamadas: {
        listarTipos: async () => [],
        carregarFormTipo: async (_s, id) => {
          if (++forms > 1) throw new ErroSei("SEI_SESSAO_EXPIRADA", "caiu");
          return formDe(id, forms);
        },
        criarProcesso: async () => {
          posts++;
          throw new ErroSei("SEI_VALIDACAO", "x");
        },
      },
    });
    igual("sessao caiu ao refazer: parar", await t.criar(PEDIDO), { situacao: "erro", erro: "caiu", parar: true });
    checar("sessao caiu ao refazer: exatamente 1 POST", posts === 1 && forms === 2, { posts, forms });
  }

  secao("Pagina: argumentos");
  {
    const { t, n } = falso([]);
    const r = (await t.criar({ idTipo: "", linha: { especificacao: "x" } })) as { situacao: string };
    checar("sem tipo: erro sem POST", r.situacao === "erro" && n.posts === 0, { r, n });
    const r2 = (await t.criar({ idTipo: "1", linha: {} })) as { situacao: string };
    checar("sem especificacao: erro sem POST", r2.situacao === "erro" && n.posts === 0, { r2, n });
    // Modo quantidade do legado: especificacao vazia abre o processo sem especificacao.
    const vazia = falso([() => ({ numero: "00001.000009/2026-19", idProcedimento: "9", url: "u" })]);
    const r3 = (await vazia.t.criar({ idTipo: "1", linha: { especificacao: "" } })) as { situacao: string };
    checar("especificacao vazia: cria (modo quantidade)", r3.situacao === "ok" && vazia.n.posts === 1, { r3, n: vazia.n });
    const rf = await lanca(() => t.formTipo({ idTipo: "" }));
    checar("formTipo sem tipo: erro claro, sem buscar", !!rf && (rf.message ?? "").includes("Tipo de processo") && n.forms === 0, {
      rf,
      n,
    });
    const rf2 = await lanca(() => t.formTipo({ idTipo: 7 }));
    checar("formTipo com tipo nao-texto: erro", !!rf2 && n.forms === 0, { rf2, n });
  }

  secao("Pagina: restrito exige hipotese legal");
  for (const [nome, pedido] of [
    ["linha restrita, lote publico, sem hipotese", { ...PEDIDO, linha: { especificacao: "x", nivelAcesso: "1" } }],
    ["lote restrito com hipotese vazia", { ...PEDIDO, nivelAcesso: "1", hipoteseLegal: "" }],
    ['lote restrito com hipotese "null"', { ...PEDIDO, nivelAcesso: "1", hipoteseLegal: "null" }],
  ] as const) {
    const { t, n } = falso([() => CRIADO]);
    igual(`${nome}: erro`, await t.criar(pedido), {
      situacao: "erro",
      erro: "Linha restrita sem hipótese legal: escolha uma hipótese no lote.",
    });
    checar(`${nome}: zero POST e zero formulario`, n.posts === 0 && n.forms === 0, n);
  }
  {
    let dados: unknown = null;
    const { t, n } = falso([() => CRIADO]);
    const t2 = tratadoresProcessosLote({
      sei: {} as never,
      ctx: CTX,
      abrirLinkPermanente: () => {},
      chamadas: {
        carregarFormTipo: async (_s, id) => formDe(id, 1),
        criarProcesso: async (_s, _f, p) => {
          dados = p;
          return CRIADO;
        },
      },
    });
    const pedido = { ...PEDIDO, linha: { especificacao: "x", nivelAcesso: "1" }, hipoteseLegal: "7" };
    igual("restrito com hipotese: cria", await t2.criar(pedido), { situacao: "ok", criado: CRIADO });
    checar(
      "restrito com hipotese: POST com nivel 1 e a hipotese",
      (dados as { nivelAcesso?: string; hipoteseLegal?: string } | null)?.nivelAcesso === "1" &&
        (dados as { hipoteseLegal?: string }).hipoteseLegal === "7",
      dados,
    );
    igual("restrito com hipotese (lote): cria", await t.criar({ ...PEDIDO, nivelAcesso: "1", hipoteseLegal: "7" }), {
      situacao: "ok",
      criado: CRIADO,
    });
    checar("restrito com hipotese (lote): 1 POST", n.posts === 1 && n.forms === 1, n);
  }

  secao("Pagina: fechar, minimizar e link permanente");
  {
    let fechou = 0;
    let min: boolean | null = null;
    let lp = 0;
    const t = tratadoresProcessosLote({
      sei: {} as never,
      ctx: CTX,
      fechar: () => void fechou++,
      minimizar: (m) => {
        min = m;
      },
      abrirLinkPermanente: () => void lp++,
    });
    checar("fechar", (await t.fechar(undefined)) === true && fechou === 1);
    await t.minimizar({ minimizado: true });
    checar("minimizar repassa", min === true);
    checar("abrirLinkPermanente", (await t.abrirLinkPermanente(undefined)) === true && lp === 1);
    const sem = tratadoresProcessosLote({ sei: {} as never, ctx: CTX, abrirLinkPermanente: () => {} });
    checar("fechar sem funcao: false", (await sem.fechar(undefined)) === false);
    checar("minimizar sem funcao: false", (await sem.minimizar({ minimizado: true })) === false);
  }

  secao("Pagina: modal so com a opcao proclote");
  const armar = (dm: Document) => () => {
    criarControleModal(dm, CONFIG_MODAL, {
      urlApp: () => "chrome-extension://x/html/processos-lote.html#modo=modal&tema=claro",
      temaEscuro: false,
      conectar: () => parDePortas()[0],
      tratadores: (fechar, minimizar) =>
        tratadoresProcessosLote({ sei: {} as never, ctx: CTX, fechar, minimizar, abrirLinkPermanente: () => {} }),
      agendar: () => () => {},
    });
  };
  const evento = (dm: Document) =>
    dm.dispatchEvent(new (dm.defaultView as unknown as { CustomEvent: typeof CustomEvent }).CustomEvent(EVENTO_ABRIR));
  {
    const dm = instalarDom();
    checar("opcao ligada: arma", (await armarSeLigado(async () => true, armar(dm))) === true);
    evento(dm);
    checar("evento abre o modal", !!dm.querySelector("iframe[data-spro-processos-lote-modal]"));
  }
  {
    const dm = instalarDom();
    checar(
      "opcao desligada: nao arma o modal",
      (await armarSeLigado(
        async () => false,
        armar(dm),
        () => ligarAvisoSemModal(dm, CONFIG_MODAL),
      )) === false,
    );
    evento(dm);
    checar("opcao desligada: sem iframe", !dm.querySelector("iframe"));
    checar("opcao desligada: clique no item do legado mostra o aviso", !!dm.querySelector(".spro-processos-lote-aviso"));
  }
  checar(
    "config do modal",
    CONFIG_MODAL.titulo === "Processos em Lote" &&
      CONFIG_MODAL.seletorItemMenu === "#processosLotePro" &&
      CONFIG_MODAL.classeAviso === "spro-processos-lote-aviso" &&
      CONFIG_MODAL.atributoIframe === "data-spro-processos-lote-modal",
  );
}
