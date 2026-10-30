/**
 * Provas da Prévia, da criação do lote e da Execução (Tarefa 14a). A execução roda direta sobre um lote montado à
 * mão (RPC falso por operação, cada resposta pode ser segurada pela prova; `esperar` sem dormir) e, no fim, o app
 * inteiro: Cruzamento → Prévia → Iniciar → Execução, com o lote no repositório.
 */

import { areaMemoria } from "@comum/armazenamento/area";
import { ErroRpc } from "@comum/ponte/rpc";
import { ETAPAS, proximaEtapa } from "@dl/app/app";
import { ROTULO_COLUNA_NOME } from "@dl/app/cruzamento";
import { chaveVerificacao, type DepsEtapa, type EstadoApp } from "@dl/app/estado";
import { ExecucaoDocumentos, MENSAGEM_EM_VOO, MENSAGEM_NAO_ABERTO, MENSAGEM_SESSAO, TelaExecucao } from "@dl/app/execucao";
import { linhasDoLote, montarLote, tamanhoDoLote } from "@dl/app/lote";
import { ROTULO_LINHA_PREVIA, TelaPrevia } from "@dl/app/previa";
import { TETO_BYTES_LOTE } from "@dl/modelo/constantes";
import { prepararLinhas } from "@dl/modelo/destinos";
import type { ConfigLote } from "@dl/modelo/lote";
import type { Modelo } from "@dl/sei/modelo";
import { type LoteDocumentos, RepositorioLote } from "../src/repositorio";
import { botao, checar, disparar, escolherCombo, igual, instalarDom, secao, tique } from "./util";
import { ate, montar, naPlanilha, utf8 } from "./verificar-app-modelo";

const CHAVE = "docslote/lote";
const HOST = "sei.x.gov.br";
const PROTOCOLO = "00001.000001/2026-11";
const P1 = "12345.000001/2026-01";
const P2 = "12345.000002/2026-02";

const MODELO: Modelo = {
  origem: "documento",
  numero: "0000123",
  titulo: "Ofício 12",
  tipoId: "6",
  tipoNome: "Ofício",
  campos: ["nome", "cargo", "cidade"],
  texto: "Senhor ##nome##,\n##cargo## de ##cidade##.",
};

const config = (parcial: Partial<ConfigLote> = {}): ConfigLote => ({
  camposCruzados: { nome: "nome", cargo: "cargo" },
  colunaNome: "nome",
  modeloDescricao: "Ofício para ##nome##",
  destino: { tipo: "tela" },
  pausa: 500,
  modelo: MODELO,
  ...parcial,
});

const registros = (n: number, extra: (k: number) => Record<string, string> = () => ({})) =>
  Array.from({ length: n }, (_, k) => ({ nome: `Pessoa ${k + 1}`, cargo: `Cargo ${k + 1}`, ...extra(k) }));

/** Lote pronto para executar (todas as linhas pendentes, salvo as com erro na planilha). */
function loteDe(cfg: ConfigLote, regs: Record<string, string>[]): LoteDocumentos {
  const linhas = prepararLinhas(regs, cfg);
  return {
    id: "lote-1",
    host: HOST,
    login: "ana",
    iniciadoEm: 1000,
    atualizadoEm: 1000,
    config: cfg,
    linhas,
    itens: linhas.map((l) => (l.erroLinha ? { situacao: "fora" as const, erro: l.erroLinha } : { situacao: "pendente" as const })),
    verificacoes: {},
    protocoloTela: PROTOCOLO,
  };
}

type Resposta = unknown | Error | Promise<unknown>;
type Roteiro = (op: string, args: Record<string, unknown>, n: number) => Resposta;

const okCriar = (n: number) => ({
  situacao: "ok",
  criado: {
    numero: `000${n}`,
    idDocumento: `90${n}`,
    link: `https://${HOST}/sei/controlador.php?acao=procedimento_trabalhar&id_documento=90${n}`,
  },
});

/** Execução direta: RPC falso por roteiro, repositório em memória com o lote já gravado. */
async function execucao(lote: LoteDocumentos, roteiro: Roteiro = (op, _a, n) => (op === "criar" ? okCriar(n) : null)) {
  const area = areaMemoria();
  const repo = new RepositorioLote(area, () => 5000);
  await repo.gravar(lote);
  const chamadas: Array<{ op: string; args: Record<string, unknown> }> = [];
  const conta: Record<string, number> = {};
  const rpc = {
    chamar: (async (op: string, args?: unknown) => {
      const a = (args ?? {}) as Record<string, unknown>;
      chamadas.push({ op, args: a });
      conta[op] = (conta[op] ?? 0) + 1;
      await tique(1);
      const r = await roteiro(op, a, conta[op] as number);
      if (r instanceof Error) throw r;
      return r;
    }) as never,
  };
  const t = { mudou: 0 };
  const ex = new ExecucaoDocumentos(lote, { rpc, repo, aoMudar: () => t.mudou++, esperar: () => tique(0) });
  const guardado = async () => (await area.obter(CHAVE))[CHAVE] as LoteDocumentos | undefined;
  const criar = () => chamadas.filter((c) => c.op === "criar");
  return { area, repo, rpc, chamadas, ex, t, guardado, criar };
}

/** Uma resposta segurada pela prova (RPC pendente até `soltar`). */
function segurar<T>() {
  let soltar!: (v: T) => void;
  const p = new Promise<T>((r) => {
    soltar = r;
  });
  return { p, soltar };
}

/* ---------------------------------------------------------------- prévia */

function estadoPrevia(parcial: Partial<EstadoApp> = {}, cfg: ConfigLote = config()): EstadoApp {
  return {
    modelo: MODELO,
    protocolo: PROTOCOLO,
    colunas: ["nome", "cargo", "proc", "nivel", "hip"],
    registros: [
      { nome: "Ana Lúcia", cargo: "Chefe", proc: P1, nivel: "", hip: "" },
      { nome: "", cargo: "Sem nome", proc: P1, nivel: "", hip: "" },
      { nome: "Caio", cargo: "Diretor", proc: P2, nivel: "restrito", hip: "Sigilo fiscal" },
    ],
    config: cfg,
    ...parcial,
  };
}

function previa(estado: EstadoApp, iniciar?: () => Promise<void>) {
  const doc = instalarDom('<html><body><div id="app"></div></body></html>');
  const t = { mudou: 0, iniciou: 0 };
  const d: DepsEtapa = {
    rpc: { chamar: (async () => null) as never },
    estado,
    aoMudar: () => t.mudou++,
    iniciarExecucao: async () => {
      t.iniciou += 1;
      if (iniciar) await iniciar();
    },
    ctx: { host: HOST, login: "ana" },
  };
  const tl = new TelaPrevia(d);
  doc.getElementById("app")!.append(tl.el);
  const texto = (sel: string) => tl.el.querySelector(sel)?.textContent ?? "";
  return { doc, tl, t, d, texto, raiz: tl.el };
}

/** Estado do destino coluna com a verificação feita (P1 ok, P2 não aberto). */
function estadoColuna(): EstadoApp {
  const cfg = config({ destino: { tipo: "coluna", coluna: "proc" } });
  const e = estadoPrevia({}, cfg);
  e.linhas = prepararLinhas(e.registros ?? [], cfg);
  e.verificacoes = {
    [P1]: { numero: P1, status: "ok", idProcedimento: "11" },
    [P2]: { numero: P2, status: "nao-aberto", idProcedimento: "22", mensagem: "Enviado para outra unidade" },
  };
  e.prontas = [0];
  e.baseVerificacao = { registros: e.registros ?? [], chave: chaveVerificacao(cfg) };
  return e;
}

export async function verificarAppExecucao(): Promise<void> {
  secao("prévia: etapa registrada depois da verificação");
  {
    const ids = ETAPAS.map((e) => e.id);
    checar("previa depois de verificacao", ids.indexOf("previa") === ids.indexOf("verificacao") + 1, ids);
    const iCruz = ids.indexOf("cruzamento");
    igual("destino tela: do Cruzamento direto à Prévia", proximaEtapa({ config: config() }, iCruz), ids.indexOf("previa"));
    igual(
      "destino coluna: da Verificação à Prévia",
      proximaEtapa({ config: config({ destino: { tipo: "coluna", coluna: "proc" } }) }, ids.indexOf("verificacao")),
      ids.indexOf("previa"),
    );
  }

  secao("prévia: documento da primeira linha pronta, nome e descrição finais");
  {
    const m = previa(estadoPrevia());
    checar("completa", m.tl.completa());
    igual("rótulo do rodapé: Iniciar", m.tl.rotuloAvancar?.(), "Iniciar");
    igual("resumo: 2 a gravar, 1 de fora", m.texto(".dl-previa-resumo"), "2 linhas a gravar, 1 fica de fora.");
    checar("estimativa de duração", m.texto(".dl-previa-estimativa").includes("Duração estimada"), m.texto(".dl-previa-estimativa"));
    igual("nome na árvore sem acento", m.texto(".dl-previa-nome"), "Ana Lucia");
    checar("descrição com o campo trocado", m.texto(".dl-previa-descricao") === "Ofício para Ana Lúcia", m.texto(".dl-previa-descricao"));
    igual("nível público", m.texto(".dl-previa-nivel"), "Público");
    checar("destino: processo da tela com o protocolo", m.texto(".dl-previa-destino").includes(PROTOCOLO), m.texto(".dl-previa-destino"));
    const corpo = m.texto(".dl-previa-texto");
    checar("texto com os campos trocados", corpo.includes("Senhor Ana Lúcia,") && corpo.includes("Chefe de "), corpo);
    const marcas = [...m.raiz.querySelectorAll(".dl-previa-texto mark")].map((x) => x.textContent);
    igual("campo sem coluna destacado no texto", marcas, ["##cidade##"]);
    checar("aviso dos campos sem coluna", m.texto(".dl-previa-literais").includes("##cidade##"), m.texto(".dl-previa-literais"));
    checar("sem innerHTML: o valor vira texto", !m.raiz.querySelector(".dl-previa-texto b, .dl-previa-texto script"));
    const opcoes = () => [...m.doc.querySelectorAll('.spro-combo-pop [role="option"]')].map((o) => o.getAttribute("data-valor") ?? "");
    const cb = m.raiz.querySelector<HTMLButtonElement>(`button[role="combobox"][aria-label="${ROTULO_LINHA_PREVIA}"]`);
    checar("seletor da linha", !!cb);
    cb?.click();
    igual("só linhas prontas no seletor (a com erro fica de fora)", opcoes(), ["0", "2"]);
    cb?.click();
    escolherCombo(m.raiz, ROTULO_LINHA_PREVIA, "2");
    igual("outra linha: nome", m.texto(".dl-previa-nome"), "Caio");
    igual("sem coluna de nível: público", m.texto(".dl-previa-nivel"), "Público");
    checar("outra linha: texto refeito", m.texto(".dl-previa-texto").includes("Senhor Caio,"));
  }

  secao("prévia: nível e hipótese da linha, referências sem coluna");
  {
    const cfg = config({ colunaNivel: "nivel", colunaHipotese: "hip", modeloDescricao: "Ofício ##nome## ##inexistente##" });
    const m = previa(estadoPrevia({}, cfg));
    escolherCombo(m.raiz, ROTULO_LINHA_PREVIA, "2");
    checar("nível restrito com a hipótese", m.texto(".dl-previa-nivel") === "Restrito (Sigilo fiscal)", m.texto(".dl-previa-nivel"));
    checar(
      "referência da descrição sem coluna destacada",
      m.texto(".dl-previa-refs").includes("##inexistente##") && m.texto(".dl-previa-refs").includes("descrição"),
      m.texto(".dl-previa-refs"),
    );
    igual(
      "a descrição mostra o trecho literal marcado",
      [...m.raiz.querySelectorAll(".dl-previa-descricao mark")].map((x) => x.textContent),
      ["##inexistente##"],
    );
  }

  secao("prévia: novo processo e coluna");
  {
    const cfg = config({ destino: { tipo: "novo-processo", idTipoProcesso: "100", especificacao: "Pedido de ##nome## — ##zzz##" } });
    const m = previa(estadoPrevia({ tiposProcesso: [{ id: "100", nome: "Requerimento" }] }, cfg));
    const destino = m.texto(".dl-previa-destino");
    checar(
      "novo processo: tipo e especificação preenchida (latin-1)",
      destino.includes("Requerimento") && destino.includes("Pedido de Ana Lúcia - ##zzz##"),
      destino,
    );
    checar(
      "especificação: referência sem coluna apontada",
      m.texto(".dl-previa-refs").includes("especificação") && m.texto(".dl-previa-refs").includes("##zzz##"),
      m.texto(".dl-previa-refs"),
    );

    const c = previa(estadoColuna());
    checar("coluna: completa com a verificação válida", c.tl.completa());
    igual("coluna: resumo pelas situações da verificação", c.texto(".dl-previa-resumo"), "1 linha a gravar, 2 ficam de fora.");
    checar("coluna: destino = número da linha", c.texto(".dl-previa-destino").includes(P1), c.texto(".dl-previa-destino"));

    const velho = estadoColuna();
    velho.registros = [...(velho.registros ?? [])]; // outra planilha: a verificação não vale mais
    const v = previa(velho);
    checar("coluna sem verificação válida: não completa", !v.tl.completa());
    checar("coluna sem verificação válida: aviso", v.texto(".dl-erro").includes("Verifique de novo"), v.texto(".dl-erro"));
  }

  secao("prévia: aviso do número do processo do modelo quando o destino é outro processo (D1, Ruling 21)");
  {
    const comCabecalho: Modelo = { ...MODELO, texto: `Processo nº ${PROTOCOLO}\nInteressado: CGE-CAUD\nSenhor ##nome##,` };
    const aviso = (m: { raiz: HTMLElement }) => m.raiz.querySelector<HTMLElement>(".dl-previa-processo-modelo");

    const tela = previa(estadoPrevia({}, config({ modelo: comCabecalho })));
    checar("destino tela: sem aviso (o documento fica no processo do modelo)", !aviso(tela));
    checar("sem aviso não sobra texto solto", !(tela.raiz.textContent ?? "").includes("null"));

    const novo = previa(
      estadoPrevia(
        { tiposProcesso: [{ id: "100", nome: "Requerimento" }] },
        config({ modelo: comCabecalho, destino: { tipo: "novo-processo", idTipoProcesso: "100", especificacao: "x" } }),
      ),
    );
    const a = aviso(novo);
    checar("novo processo: aviso visível", !!a && !a.hidden && !a.closest("[hidden]"));
    const t = a?.textContent ?? "";
    checar("aviso cita o número do processo do modelo", t.includes(PROTOCOLO), t);
    checar("aviso fala do interessado", t.includes("interessado"), t);
    checar("aviso recomenda campos ##campo## da planilha", t.includes("##campo##") && t.includes("planilha"), t);
    checar("é aviso, não bloqueio: a prévia continua completa", novo.tl.completa());

    const semCabecalho = previa(
      estadoPrevia({}, config({ destino: { tipo: "novo-processo", idTipoProcesso: "100", especificacao: "x" } })),
    );
    checar("novo processo sem o número no texto: sem aviso", !aviso(semCabecalho));

    const col = estadoColuna();
    (col.config as ConfigLote).modelo = comCabecalho;
    const c = previa(col);
    checar("coluna com linha para outro processo: aviso", !!aviso(c) && (aviso(c)?.textContent ?? "").includes(PROTOCOLO));

    // Coluna em que todas as linhas a gravar vão para o processo do próprio modelo: nada a avisar.
    const cfgMesmo = config({ modelo: comCabecalho, destino: { tipo: "coluna", coluna: "proc" } });
    const mesmo = estadoPrevia(
      {
        registros: [
          { nome: "Ana", cargo: "X", proc: PROTOCOLO, nivel: "", hip: "" },
          { nome: "Bia", cargo: "Y", proc: P2, nivel: "", hip: "" },
        ],
      },
      cfgMesmo,
    );
    mesmo.linhas = prepararLinhas(mesmo.registros ?? [], cfgMesmo);
    mesmo.verificacoes = {
      [PROTOCOLO]: { numero: PROTOCOLO, status: "ok", idProcedimento: "1" },
      [P2]: { numero: P2, status: "nao-aberto" },
    };
    mesmo.prontas = [0];
    mesmo.baseVerificacao = { registros: mesmo.registros ?? [], chave: chaveVerificacao(cfgMesmo) };
    checar("coluna só para o processo do modelo: sem aviso", !aviso(previa(mesmo)));

    // Texto Padrão não tem cabeçalho de processo: o número no texto é do próprio padrão, sem aviso.
    const tp: Modelo = { origem: "texto-padrao", id: "9", nome: "Padrão", tipoId: "6", campos: ["nome"], texto: `Ref. ${PROTOCOLO}` };
    const p = previa(
      estadoPrevia({}, config({ modelo: tp, destino: { tipo: "novo-processo", idTipoProcesso: "100", especificacao: "x" } })),
    );
    checar("Texto Padrão: sem aviso", !aviso(p));
  }

  secao("prévia: Iniciar chama o app uma vez; falha volta a habilitar");
  {
    const s = segurar<void>();
    const m = previa(estadoPrevia(), () => s.p);
    m.tl.avancar?.();
    m.tl.avancar?.();
    igual("dois cliques, um início", m.t.iniciou, 1);
    checar("ocupado: não completa", !m.tl.completa());
    s.soltar();
    await tique(2);
    const f = previa(estadoPrevia(), async () => {
      throw new Error("disco cheio");
    });
    f.tl.avancar?.();
    await tique(2);
    checar("falha ao iniciar aparece", f.texto(".dl-erro").includes("disco cheio"), f.texto(".dl-erro"));
    checar("e volta a completar", f.tl.completa());
  }

  secao("lote: teto de bytes do lote guardado (a cota do chrome.storage.local é dividida com outros módulos)");
  {
    igual("TETO_BYTES_LOTE é 2 MB", TETO_BYTES_LOTE, 2 * 1024 * 1024);
    // O tamanho de um lote com uma célula de `n` caracteres: o mesmo que `gravar` guarda (sem o texto do modelo).
    const comCelula = (n: number) => estadoPrevia({ registros: [{ nome: "Ana", cargo: "x".repeat(n), proc: "", nivel: "", hip: "" }] });
    const base = tamanhoDoLote(montarLote(comCelula(0), { host: HOST, login: "ana" }));
    const sobra = TETO_BYTES_LOTE - base;
    const abaixo = comCelula(sobra - 10);
    const l = montarLote(abaixo, { host: HOST, login: "ana" });
    checar("logo abaixo do limite: monta", tamanhoDoLote(l) <= TETO_BYTES_LOTE, tamanhoDoLote(l));
    // O texto do modelo (a prévia) não conta: `gravar` não o guarda.
    const comTexto = comCelula(sobra - 10);
    (comTexto.config as ConfigLote).modelo = { ...MODELO, texto: "y".repeat(500_000) };
    checar("o texto do modelo não conta", !!montarLote(comTexto, { host: HOST, login: "ana" }));
    let erro = "";
    try {
      montarLote(comCelula(sobra + 10), { host: HOST, login: "ana" });
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
    }
    checar(
      "logo acima do limite: recusa com a mensagem",
      erro.startsWith("A planilha é grande demais para guardar o andamento do lote (2,1 MB; o limite é 2 MB). Divida em partes menores."),
      erro,
    );

    const ok = previa(abaixo);
    checar("prévia abaixo do limite: Iniciar liberado", ok.tl.completa());
    const grande = previa(comCelula(sobra + 10));
    checar("prévia acima do limite: Iniciar não libera", !grande.tl.completa());
    checar(
      "prévia acima do limite: a mensagem",
      grande.texto(".dl-erro").includes("grande demais para guardar o andamento"),
      grande.texto(".dl-erro"),
    );
    grande.tl.avancar?.();
    igual("prévia acima do limite: Iniciar não chama o app", grande.t.iniciou, 0);
  }

  secao("lote: montado da prévia (itens pendente/fora, verificações sem linkArvore)");
  {
    const e = estadoPrevia();
    const l = montarLote(e, { host: HOST, login: "ana" }, { agora: () => 4242, id: "abc" });
    igual("itens", l.itens, [{ situacao: "pendente" }, { situacao: "fora", erro: "Nome na árvore vazio" }, { situacao: "pendente" }]);
    igual("cabeçalho", [l.id, l.host, l.login, l.iniciadoEm, l.atualizadoEm, l.protocoloTela], ["abc", HOST, "ana", 4242, 4242, PROTOCOLO]);
    checar("modelo sem o texto da prévia", !("texto" in l.config.modelo), l.config.modelo);
    igual("verificações vazias fora do destino coluna", l.verificacoes, {});
    igual("linhas preparadas", l.linhas.length, 3);

    const c = estadoColuna();
    (c.verificacoes?.[P1] as Record<string, unknown>).linkArvore = "https://x/?infra_hash=abc";
    const lc = montarLote(c, { host: HOST, login: "ana" }, { id: "c" });
    igual(
      "coluna: itens pelas situações",
      lc.itens.map((i) => i.situacao),
      ["pendente", "fora", "fora"],
    );
    checar("coluna: fora pelo processo leva o motivo", (lc.itens[2]?.erro ?? "").includes("Não aberto na unidade"), lc.itens[2]);
    checar("coluna: verificações sem linkArvore", !JSON.stringify(lc.verificacoes).includes("linkArvore"), lc.verificacoes);
    igual("linhasDoLote coluna", (linhasDoLote(c) as { situacoes: string[] }).situacoes, ["pendente", "fora", "fora"]);
  }

  secao("execução: destino tela, a 2ª não aberta, as outras seguem");
  {
    const lote = loteDe(config(), registros(4));
    const m = await execucao(lote, (op, _a, n) =>
      op === "criar"
        ? n === 2
          ? { situacao: "erro", erro: "O processo não está aberto nesta unidade.", naoAberto: true }
          : okCriar(n)
        : null,
    );
    await m.ex.rodar();
    igual("4 chamadas criar", m.criar().length, 4);
    igual("estado concluído", m.ex.estado, "concluido");
    const g = await m.guardado();
    igual(
      "situações gravadas",
      g?.itens.map((i) => i.situacao),
      ["criada", "erro", "criada", "criada"],
    );
    igual("erro da não aberta", g?.itens[1]?.erro, MENSAGEM_NAO_ABERTO);
    igual("criada guarda número, id e link", g?.itens[0]?.criado, okCriar(1).criado);
    igual("progresso", [m.ex.progresso.criadas, m.ex.progresso.erros, m.ex.progresso.total], [3, 1, 4]);
    const p = m.criar()[0]?.args ?? {};
    igual("alvo tela", p.alvo, { tipo: "tela" });
    igual("pedido: linha da planilha", p.linha, lote.linhas[0]?.dados);
    igual(
      "pedido: config",
      [p.colunaNome, p.modeloDescricao, p.nivel, p.camposCruzados],
      ["nome", "Ofício para ##nome##", "publico", { nome: "nome", cargo: "cargo" }],
    );
    checar("pedido: modelo sem o texto da prévia", !("texto" in ((p.modelo as object) ?? {})), p.modelo);
  }

  secao("execução: erro comum numa linha não para as outras");
  {
    const m = await execucao(loteDe(config(), registros(3)), (op, _a, n) =>
      op === "criar" ? (n === 1 ? { situacao: "erro", erro: "Tipo recusado." } : okCriar(n)) : null,
    );
    await m.ex.rodar();
    const g = await m.guardado();
    igual(
      "erro e duas criadas",
      g?.itens.map((i) => [i.situacao, i.erro ?? ""]),
      [
        ["erro", "Tipo recusado."],
        ["criada", ""],
        ["criada", ""],
      ],
    );
  }

  secao("execução: destino coluna, cada criar leva o número da linha");
  {
    const cfg = config({ destino: { tipo: "coluna", coluna: "proc" } });
    const m = await execucao(
      loteDe(
        cfg,
        registros(3, (k) => ({ proc: k === 1 ? P2 : P1 })),
      ),
    );
    await m.ex.rodar();
    igual(
      "alvos",
      m.criar().map((c) => c.args.alvo),
      [
        { tipo: "coluna", numero: P1 },
        { tipo: "coluna", numero: P2 },
        { tipo: "coluna", numero: P1 },
      ],
    );
  }

  secao("execução: sessão expirada na 3ª pausa; a 3ª volta a pendente");
  {
    let sessao = true;
    const m = await execucao(loteDe(config(), registros(4)), (op, _a, n) => {
      if (op !== "criar") return null;
      if (n === 3 && sessao) return { situacao: "erro", erro: "Sessão expirada.", sessao: true };
      return okCriar(n);
    });
    await m.ex.rodar();
    igual("pausado", m.ex.estado, "pausado");
    igual("motivo da sessão", m.ex.motivo, MENSAGEM_SESSAO);
    const g = await m.guardado();
    igual(
      "2 criadas gravadas, a 3ª pendente",
      g?.itens.map((i) => i.situacao),
      ["criada", "criada", "pendente", "pendente"],
    );
    igual("3 chamadas até a pausa", m.criar().length, 3);
    sessao = false;
    await m.ex.continuar();
    igual("continuar: concluído", m.ex.estado, "concluido");
    igual(
      "continuar: a 3ª é criada",
      (await m.guardado())?.itens.map((i) => i.situacao),
      ["criada", "criada", "criada", "criada"],
    );
    igual("continuar: sem motivo", m.ex.motivo, null);
  }

  secao("execução: incerto vira erro incerto e não é repetido");
  {
    const m = await execucao(loteDe(config(), registros(3)), (op, _a, n) =>
      op === "criar"
        ? n === 2
          ? { situacao: "erro", erro: "O SEI não confirmou.", incerto: true, criado: { idDocumento: "55", numero: "0055" } }
          : okCriar(n)
        : null,
    );
    await m.ex.rodar();
    igual("3 chamadas (sem repetir a incerta)", m.criar().length, 3);
    igual("item incerto com o que se sabe", (await m.guardado())?.itens[1], {
      situacao: "erro",
      erro: "O SEI não confirmou.",
      incerto: true,
      idDocumento: "55",
      numero: "0055",
    });
    igual("concluído", m.ex.estado, "concluido");
  }

  secao("execução: Ruling 18, a linha fica incerta antes de o criar responder");
  {
    const s = segurar<unknown>();
    const m = await execucao(loteDe(config(), registros(2)), (op, _a, n) => (op === "criar" ? (n === 1 ? s.p : okCriar(n)) : null));
    const rodada = m.ex.rodar();
    await ate(() => m.criar().length === 1);
    igual("antes da resposta: erro incerto", (await m.guardado())?.itens[0], { situacao: "erro", erro: MENSAGEM_EM_VOO, incerto: true });
    s.soltar(okCriar(1));
    await rodada;
    igual("depois: o resultado real sobrescreve", (await m.guardado())?.itens[0]?.situacao, "criada");
  }

  secao("execução: parar (fechar o modal) termina a linha em voo e deixa o lote");
  {
    const s = segurar<unknown>();
    const m = await execucao(loteDe(config(), registros(3)), (op, _a, n) => (op === "criar" ? (n === 1 ? s.p : okCriar(n)) : null));
    const rodada = m.ex.rodar();
    await ate(() => m.criar().length === 1);
    m.ex.parar();
    s.soltar(okCriar(1));
    await rodada;
    igual("pausado", m.ex.estado, "pausado");
    igual("só a linha em voo saiu", m.criar().length, 1);
    igual(
      "lote segue no repositório",
      (await m.guardado())?.itens.map((i) => i.situacao),
      ["criada", "pendente", "pendente"],
    );
  }

  secao("execução: Pausar e Continuar pela tela");
  {
    const doc = instalarDom('<html><body><div id="app"></div></body></html>');
    const s = segurar<unknown>();
    const m = await execucao(loteDe(config(), registros(3)), (op, _a, n) => (op === "criar" ? (n === 1 ? s.p : okCriar(n)) : null));
    const minimizar = { n: 0 };
    const tela = new TelaExecucao(m.ex, {
      pausar: () => {
        m.ex.pausar();
        tela.atualizar();
      },
      continuar: () => void m.ex.continuar().then(() => tela.atualizar()),
      minimizar: () => minimizar.n++,
    });
    doc.getElementById("app")!.append(tela.el);
    checar("sem botão Cancelar", !botao(tela.el, "Cancelar"));
    const rodada = m.ex.rodar();
    await ate(() => m.criar().length === 1);
    tela.atualizar();
    checar("texto: gravando 1 de 3", (tela.el.querySelector(".dl-progresso-texto")?.textContent ?? "").includes("1 de 3"));
    disparar(botao(tela.el, "Pausar")!, "click");
    checar("pausando: aguarda a linha em voo", (tela.el.querySelector(".dl-progresso-texto")?.textContent ?? "").includes("aguardando"));
    s.soltar(okCriar(1));
    await rodada;
    tela.atualizar();
    checar("pausado: Continuar visível", botao(tela.el, "Continuar")?.hidden === false);
    igual("pausado: 1 chamada", m.criar().length, 1);
    disparar(botao(tela.el, "Minimizar")!, "click");
    igual("Minimizar chama a ação", minimizar.n, 1);
    disparar(botao(tela.el, "Continuar")!, "click");
    await ate(() => m.ex.estado === "concluido");
    tela.concluida();
    igual("3 chamadas no fim", m.criar().length, 3);
    checar(
      "resumo do fim",
      (tela.el.querySelector(".dl-execucao-fim")?.textContent ?? "").includes("3 criadas, nenhuma com erro"),
      tela.el.querySelector(".dl-execucao-fim")?.textContent,
    );
  }

  secao("execução: novo processo por linha");
  {
    const cfg = config({ destino: { tipo: "novo-processo", idTipoProcesso: "100", especificacao: "Pedido de ##nome## — ok" } });
    const sp = segurar<unknown>();
    const m = await execucao(loteDe(cfg, registros(3)), (op, _a, n) => {
      if (op === "criarProcesso") {
        if (n === 1) return sp.p;
        if (n === 3)
          return {
            situacao: "erro",
            erro: "O processo pode ter sido criado.",
            incerto: true,
            criado: { idProcedimento: "7", url: `https://${HOST}/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=7` },
          };
        return {
          situacao: "ok",
          criado: {
            numero: `PN${n}`,
            idProcedimento: `${n}`,
            url: `https://${HOST}/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=${n}`,
          },
        };
      }
      if (op === "criar") return n === 2 ? { situacao: "erro", erro: "Falhou o documento." } : okCriar(n);
      return null;
    });
    const rodada = m.ex.rodar();
    await ate(() => m.chamadas.length === 1);
    igual("Ruling 18 também antes do criarProcesso", (await m.guardado())?.itens[0], {
      situacao: "erro",
      erro: MENSAGEM_EM_VOO,
      incerto: true,
    });
    sp.soltar({
      situacao: "ok",
      criado: {
        numero: "PN1",
        idProcedimento: "1",
        url: `https://${HOST}/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=1`,
      },
    });
    await rodada;
    igual(
      "ordem das chamadas",
      m.chamadas.map((c) => c.op),
      ["criarProcesso", "criar", "criarProcesso", "criar", "criarProcesso"],
    );
    igual("criarProcesso: tipo e especificação preenchida (latin-1)", m.chamadas[0]?.args, {
      idTipo: "100",
      especificacao: "Pedido de Pessoa 1 - ok",
    });
    igual("criar leva o número criado", m.criar()[0]?.args.alvo, { tipo: "novo-processo", numero: "PN1" });
    const g = await m.guardado();
    igual("criada guarda o processo", g?.itens[0]?.processo, "PN1");
    igual(
      "documento falho preserva o processo",
      [g?.itens[1]?.situacao, g?.itens[1]?.erro, g?.itens[1]?.processo],
      ["erro", "Falhou o documento.", "PN2"],
    );
    checar("documento falho: link do processo", (g?.itens[1]?.linkProcesso ?? "").includes("id_procedimento=2"), g?.itens[1]);
    igual("processo incerto: erro incerto, sem criar", [g?.itens[2]?.situacao, g?.itens[2]?.incerto], ["erro", true]);
    checar(
      "processo incerto: link do processo para conferir",
      (g?.itens[2]?.linkProcesso ?? "").includes("id_procedimento=7"),
      g?.itens[2],
    );
  }

  secao("execução: novo processo criado e sessão expirada no documento não volta a pendente");
  {
    const cfg = config({ destino: { tipo: "novo-processo", idTipoProcesso: "100", especificacao: "x" } });
    const m = await execucao(loteDe(cfg, registros(2)), (op) =>
      op === "criarProcesso"
        ? { situacao: "ok", criado: { numero: "PN9" } }
        : op === "criar"
          ? { situacao: "erro", erro: "Sessão expirada.", sessao: true }
          : null,
    );
    await m.ex.rodar();
    igual("pausado", m.ex.estado, "pausado");
    const i = (await m.guardado())?.itens[0];
    igual("erro incerto com o processo (repetir duplicaria o processo)", [i?.situacao, i?.incerto, i?.processo], ["erro", true, "PN9"]);
  }

  secao("execução: processo criado e não registrado (outra aba ou falha do storage)");
  for (const modo of ["false", "lanca"] as const) {
    instalarDom('<html><body><div id="app"></div></body></html>');
    const cfg = config({ destino: { tipo: "novo-processo", idTipoProcesso: "100", especificacao: "x" } });
    const m = await execucao(loteDe(cfg, registros(2)), (op) =>
      op === "criarProcesso" ? { situacao: "ok", criado: { numero: "PN77" } } : op === "criar" ? okCriar(1) : null,
    );
    const marcar = m.repo.marcar.bind(m.repo);
    let n = 0;
    m.repo.marcar = async (id, k, item) => {
      n += 1;
      if (n === 2) {
        if (modo === "lanca") throw new Error("cota do storage");
        return false;
      }
      return marcar(id, k, item);
    };
    const avisos: unknown[][] = [];
    const warn = console.warn;
    console.warn = (...a: unknown[]) => void avisos.push(a);
    await m.ex.rodar();
    console.warn = warn;
    igual(`${modo}: nenhum criar enviado`, m.criar().length, 0);
    igual(`${modo}: parou`, m.ex.estado, "pausado");
    const i = m.ex.lote.itens[0];
    igual(`${modo}: memória guarda o processo, incerto`, [i?.situacao, i?.incerto, i?.processo], ["erro", true, "PN77"]);
    checar(`${modo}: motivo cita o processo`, (m.ex.motivo ?? "").includes("PN77"), m.ex.motivo);
    const tela = new TelaExecucao(m.ex, { pausar: () => {}, continuar: () => {}, minimizar: () => {} });
    checar(`${modo}: a tela mostra o processo`, (tela.el.querySelector(".dl-motivo")?.textContent ?? "").includes("PN77"));
    checar(
      `${modo}: console.warn com o número`,
      avisos.some((a) => String(a[0]).includes("processo criado e não registrado") && a.includes("PN77")),
      avisos,
    );
  }

  secao("execução: falha da ponte (prazo) vira erro incerto e pausa");
  {
    const m = await execucao(loteDe(config(), registros(3)), (op, _a, n) =>
      op === "criar" ? (n === 1 ? new ErroRpc("PRAZO", "A aba do SEI não respondeu a tempo (criar).") : okCriar(n)) : null,
    );
    await m.ex.rodar();
    igual("pausado", m.ex.estado, "pausado");
    const i = (await m.guardado())?.itens[0];
    checar("erro incerto com a mensagem", i?.situacao === "erro" && i.incerto === true && (i.erro ?? "").includes("não respondeu"), i);
    checar("motivo na tela", !!m.ex.motivo);
  }

  secao("execução: nada com infra_hash");
  {
    const m = await execucao(loteDe(config(), registros(2)), (op, _a, n) =>
      op === "criar"
        ? {
            situacao: "ok",
            criado: { numero: `0${n}`, idDocumento: `${n}`, link: `https://${HOST}/sei/controlador.php?acao=x&infra_hash=abc${n}` },
          }
        : null,
    );
    await m.ex.rodar();
    const g = await m.guardado();
    checar("link com infra_hash é descartado", !JSON.stringify(g).includes("infra_hash"), g?.itens);
    checar("criada mesmo sem o link", g?.itens.every((i) => i.situacao === "criada") === true);
    checar("nenhum pedido leva infra_hash", !JSON.stringify(m.chamadas).includes("infra_hash"));
  }

  secao("execução: lote descartado por outra aba para sem enviar");
  {
    const m = await execucao(loteDe(config(), registros(2)));
    await m.repo.apagar("lote-1");
    await m.ex.rodar();
    igual("nenhum criar", m.criar().length, 0);
    igual("pausado", m.ex.estado, "pausado");
    checar("motivo", !!m.ex.motivo);
  }

  secao("app: Cruzamento → Prévia → Iniciar → Execução, com o lote gravado");
  {
    const m = montar();
    m.deps.esperar = () => tique(0);
    m.deps.agora = () => 777;
    const chamar = m.deps.rpc.chamar;
    const criados: unknown[] = [];
    m.deps.rpc.chamar = (async (op: string, args?: unknown, prazo?: number) => {
      if (op === "criar") {
        criados.push(args);
        await tique(1);
        return okCriar(criados.length);
      }
      return chamar(op, args, prazo);
    }) as typeof chamar;
    await naPlanilha(m);
    await m.escolherArquivo("a.csv", utf8("nome;cargo\nAna;Chefe\n;Sem nome\nBia;Diretora\n"));
    await ate(() => m.avancar()?.disabled === false);
    disparar(m.avancar()!, "click");
    await ate(() => !!m.raiz.querySelector(`button[role="combobox"][aria-label="${ROTULO_COLUNA_NOME}"]`));
    escolherCombo(m.raiz, ROTULO_COLUNA_NOME, "nome");
    const rodape = () => m.raiz.querySelector<HTMLButtonElement>(".dl-rodape-etapa .primario");
    disparar(rodape()!, "click");
    await ate(() => !!m.raiz.querySelector(".dl-previa"));
    checar("Prévia é a etapa atual", m.raiz.querySelector('.dl-etapas li[aria-current="step"]')?.textContent?.includes("Prévia") === true);
    igual("rodapé: Iniciar", rodape()?.textContent, "Iniciar");
    checar("rodapé habilitado", rodape()?.disabled === false);
    disparar(rodape()!, "click");
    await ate(() => !!m.raiz.querySelector(".dl-execucao"));
    checar(
      "execução: indicador e rodapé escondidos",
      m.visivel(m.raiz.querySelector(".dl-etapas")) === false && m.visivel(rodape()) === false,
    );
    // Concluída a rodada, o app mostra o resultado (Tarefa 14b); o lote fica até o usuário fechar o resultado.
    await ate(() => !!m.raiz.querySelector(".dl-resultado"), 3000);
    const guardado = (await m.deps.repo.carregar("sei.x.gov.br", "ana")) as LoteDocumentos;
    checar("lote concluído continua no repositório enquanto o resultado está na tela", !!guardado);
    igual(
      "itens: criada, fora, criada",
      guardado?.itens.map((i) => i.situacao),
      ["criada", "fora", "criada"],
    );
    igual("iniciadoEm pelo relógio do app", guardado?.iniciadoEm, 777);
    igual("2 criar", criados.length, 2);
    checar("resumo do fim", (m.raiz.querySelector(".dl-resultado-resumo")?.textContent ?? "").includes("1 ficou de fora"));
    checar("sem botão Cancelar", !botao(m.doc, "Cancelar"));
    m.app.destruir();

    // Fechar no meio: o executor pausa e o lote fica retomável.
    const m2 = montar();
    m2.deps.esperar = () => tique(0);
    const chamar2 = m2.deps.rpc.chamar;
    const s = segurar<unknown>();
    let n2 = 0;
    m2.deps.rpc.chamar = (async (op: string, args?: unknown, prazo?: number) => {
      if (op === "criar") {
        n2 += 1;
        await tique(1);
        return n2 === 1 ? s.p : okCriar(n2);
      }
      return chamar2(op, args, prazo);
    }) as typeof chamar2;
    await naPlanilha(m2);
    await m2.escolherArquivo("a.csv", utf8("nome;cargo\nAna;Chefe\nBia;Diretora\nCaio;X\n"));
    await ate(() => m2.avancar()?.disabled === false);
    disparar(m2.avancar()!, "click");
    await ate(() => !!m2.raiz.querySelector(`button[role="combobox"][aria-label="${ROTULO_COLUNA_NOME}"]`));
    escolherCombo(m2.raiz, ROTULO_COLUNA_NOME, "nome");
    const rodape2 = () => m2.raiz.querySelector<HTMLButtonElement>(".dl-rodape-etapa .primario");
    disparar(rodape2()!, "click");
    await ate(() => !!m2.raiz.querySelector(".dl-previa"));
    disparar(rodape2()!, "click");
    await ate(() => n2 === 1);
    m2.app.destruir();
    s.soltar(okCriar(1));
    await tique(20);
    igual("fechar no meio: só a linha em voo", n2, 1);
    const g2 = await m2.deps.repo.carregar("sei.x.gov.br", "ana");
    igual(
      "fechar no meio: lote retomável",
      g2?.itens.map((i) => i.situacao),
      ["criada", "pendente", "pendente"],
    );
  }

  secao("app: lote acima do teto de bytes não inicia (nada enviado, nada guardado)");
  {
    // 2000 linhas cujos registros cabem no teto, mas o lote (linhas + itens) passa dele.
    const celula = Math.floor((TETO_BYTES_LOTE - 30_000) / 2000) - 30;
    const regs = Array.from({ length: 2000 }, (_, k) => ({ nome: `P${String(k).padStart(4, "0")}`, cargo: "c".repeat(celula) }));
    checar("pré-condição: os registros cabem no teto", JSON.stringify(regs).length < TETO_BYTES_LOTE, JSON.stringify(regs).length);
    const m = montar();
    m.deps.esperar = () => tique(0);
    const chamar = m.deps.rpc.chamar;
    const enviados: string[] = [];
    m.deps.rpc.chamar = (async (op: string, args?: unknown, prazo?: number) => {
      if (op === "criar" || op === "criarProcesso") {
        enviados.push(op);
        return okCriar(enviados.length);
      }
      return chamar(op, args, prazo);
    }) as typeof chamar;
    await naPlanilha(m);
    await m.escolherArquivo("grande.csv", utf8(`nome;cargo\n${regs.map((r) => `${r.nome};${r.cargo}`).join("\n")}\n`));
    await ate(() => m.avancar()?.disabled === false);
    disparar(m.avancar()!, "click");
    await ate(() => !!m.raiz.querySelector(`button[role="combobox"][aria-label="${ROTULO_COLUNA_NOME}"]`));
    escolherCombo(m.raiz, ROTULO_COLUNA_NOME, "nome");
    const rodape = () => m.raiz.querySelector<HTMLButtonElement>(".dl-rodape-etapa .primario");
    disparar(rodape()!, "click");
    await ate(() => !!m.raiz.querySelector(".dl-previa"), 3000);
    checar("prévia: a mensagem do tamanho", m.textoVisivel("A planilha é grande demais para guardar o andamento do lote"));
    checar("prévia: Iniciar desabilitado", rodape()?.disabled === true);
    disparar(rodape()!, "click");
    await tique(20);
    igual("nada enviado ao SEI", enviados, []);
    checar("nenhuma execução", !m.raiz.querySelector(".dl-execucao"));
    igual("nada guardado", await m.deps.repo.carregar("sei.x.gov.br", "ana"), null);
    m.app.destruir();
  }
}
