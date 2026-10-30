/**
 * A leva da revisão final da P4 ("sincronia e colaboração"), parte do repositório e da sincronia: restaurar a cópia
 * sem devolver ao escopo de antes o que mudou de "Quem vê" (1); órfãos fora da importação, do texto e do `limpar`
 * (2); teto no registro do histórico (3); a faixa do "Entendi" só com alteração daqui (4); o número do documento
 * conferido no repositório (8); a borda do teto da memória do sigilo (9) e o texto de quem só consulta (13). A
 * parte do app fica em verificar-revisao-final-app.ts; a da aba, em pagina/verificar-sincronia-pagina.ts.
 */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { copiasEmMemoria } from "@comum/sincronia/copias";
import { MotorTextoPadrao, type StatusSync } from "@comum/sincronia/motor";
import { gerarConteudoTexto, lerConteudoTexto } from "@comum/sincronia/textoPadraoCodec";
import { FOLGA_RELOGIO_MS, LIMITES, prefixoMemoriaSigilo } from "../src/modelo/constantes";
import { lerMemoria, TETO_APRENDIDAS } from "../src/modelo/memoriaSigilo";
import type { CampoHistorico, EnvelopeProjetos, Escopo, Registro, Vis } from "../src/modelo/tipos";
import { entidadeValida, moverEntreEscopos, RepositorioProjetos } from "../src/repositorio";
import { type EnvelopeArquivo, fazerCopiaDoDia, restaurarCopia } from "../src/sincronia/arquivo";
import { adaptadorProjetos, chaveRelatorio, paraOTexto, type RelatorioImportacao } from "../src/sincronia/textoPadrao";
import { etapa, fase, projeto } from "./fabrica";
import { checar, lanca, secao } from "./util";
import { noSei, noTexto } from "./verificar-sincronia-documento";

const DIA = 86_400_000;
const AGORA = Date.UTC(2026, 9, 6, 12);
const HOST = "sei.x.gov.br";
const DONO = { host: HOST, login: "ana" };
const HOJE = "2026-10-06";
const ETAPA = { inicio: "2026-10-06", fim: "2026-10-09" } as const;
const MENSAGEM_UNIDADE_SO_LEITURA =
  "O SEI não deixa gravar este Texto Padrão com o seu perfil nesta unidade; os projetos dos colegas continuam chegando.";

const escopo = (vis: Vis, login = "ana"): Escopo => ({ host: HOST, login, unidade: "110", vis });

/** Um computador: os dois escopos da unidade 110 numa área, o relógio à mostra e o motor de verdade. */
export function pc(login: string, disp: string, inicio = AGORA, area: Area = areaMemoria()) {
  const rel = { agora: inicio };
  let n = 0;
  const carimbo = () => ({ agora: ++rel.agora, dispositivo: disp, por: login, nome: login });
  const repo = (vis: Vis) => new RepositorioProjetos(area, escopo(vis, login), carimbo, () => `${disp}-${++n}`);
  const un = repo("unidade");
  const eu = repo("eu");
  const rodada = (r: RepositorioProjetos, destino: ReturnType<typeof noSei>, permitido?: () => Promise<boolean>) =>
    new MotorTextoPadrao<EnvelopeProjetos>({
      adaptador: adaptadorProjetos({ repo: r, area, sigla: "S", nomeUsuario: login }),
      destino,
      area,
      travar: (_n, fn) => fn(),
      agora: () => rel.agora,
      releituras: 3,
      permitido,
      temporizador: { definir: () => 0, cancelar: () => undefined },
    }).sincronizar({ forcar: true });
  return { area, rel, un, eu, carimbo, rodada };
}

function registro(m: Partial<Registro> & { id: string; projeto: string }): Registro {
  return {
    alvo: m.projeto,
    quando: AGORA - 1000,
    por: "bia",
    campo: "nome",
    antes: "a",
    depois: "b",
    atualizadoEm: AGORA - 1000,
    dispositivo: "pc-bia",
    ...m,
  };
}

/** O envelope inteiro do texto (com cabeçalho), para editar à mão. */
export async function envelopeDoTexto(html: string | null): Promise<EnvelopeProjetos> {
  const r = html ? await lerConteudoTexto(html) : null;
  if (!r || !("bruto" in r)) throw new Error("texto sem envelope");
  return r.bruto as EnvelopeProjetos;
}

export const vivos = async (r: RepositorioProjetos): Promise<Set<string>> => {
  const t = await r.entidades();
  return new Set([...t.p, ...t.f, ...t.e, ...t.h].filter((x) => x.removidoEm === undefined).map((x) => x.id));
};

async function item1(): Promise<void> {
  secao("revisao final 1: restaurar a copia nao devolve ao escopo de antes o projeto que mudou de 'Quem ve'");
  for (const caso of [
    { de: "unidade", podar: false },
    { de: "unidade", podar: true },
    { de: "eu", podar: false },
  ] as const) {
    const a = pc("ana", "pc-ana");
    const origem = caso.de === "unidade" ? a.un : a.eu;
    const destino = caso.de === "unidade" ? a.eu : a.un;
    const p = await origem.criarProjeto({ nome: "P" });
    const f = await origem.criarFase(p.id, "Instrução");
    await origem.criarEtapa({ projeto: p.id, nome: "E", fase: f.id, ...ETAPA });
    const copias = copiasEmMemoria<EnvelopeArquivo>();
    await fazerCopiaDoDia(a.area, DONO, copias, HOJE, a.carimbo);
    await moverEntreEscopos(origem, destino, p.id);
    if (caso.podar) {
      a.rel.agora += 200 * DIA;
      await origem.limpar(a.rel.agora);
    }
    const [copia] = await copias.listar(DONO);
    const r = await restaurarCopia(a.area, copia!, DONO, a.carimbo);
    const nome = `${caso.de === "unidade" ? "unidade -> So eu" : "So eu -> unidade"}${caso.podar ? " (lapide ja podada)" : ""}`;
    checar(
      `${nome}: P continua so no destino; nada volta`,
      !(await origem.obterProjeto(p.id)) && !!(await destino.obterProjeto(p.id)) && r.projetos + r.fases + r.etapas + r.registros === 0,
      r,
    );
    const texto = paraOTexto(await origem.exportar(a.rel.agora), a.rel.agora);
    checar(
      `${nome}: nada de P vivo no texto do escopo de antes`,
      ![...texto.entidades.p, ...texto.entidades.f, ...texto.entidades.e].some((x) => x.removidoEm === undefined),
      texto.entidades,
    );
    const o = await vivos(origem);
    const nosDois = [...(await vivos(destino))].filter((id) => o.has(id));
    checar(`${nome}: nenhum id vivo nos dois escopos`, nosDois.length === 0, nosDois);
  }
  // O que sumiu de verdade continua voltando (a mudança não tira o que o restaurar já fazia).
  const a = pc("ana", "pc-ana");
  const p = await a.un.criarProjeto({ nome: "Excluído depois" });
  const copias = copiasEmMemoria<EnvelopeArquivo>();
  await fazerCopiaDoDia(a.area, DONO, copias, HOJE, a.carimbo);
  await a.un.removerProjeto(p.id);
  const [copia] = await copias.listar(DONO);
  const r = await restaurarCopia(a.area, copia!, DONO, a.carimbo);
  checar("o excluido depois da copia ainda volta", r.projetos === 1 && !!(await a.un.obterProjeto(p.id)), r);
}

async function item2(): Promise<void> {
  secao("revisao final 2: orfaos (fase, etapa ou registro de projeto que nao existe)");
  {
    const a = pc("ana", "pc-ana");
    const r = await a.un.importar({
      f: [fase({ id: "faseorfa", projeto: "fantasma", atualizadoEm: AGORA })],
      e: [etapa({ id: "orfa1", projeto: "fantasma", atualizadoEm: AGORA, criadoEm: AGORA })],
      h: [registro({ id: "regorfao", projeto: "fantasma" })],
    });
    const t = await a.un.entidades();
    checar(
      "importar: f/e/h de projeto que nao existe aqui nem no envelope: ignorados, nada gravado",
      r.ignorados === 3 && r.novos === 0 && t.f.length + t.e.length + t.h.length === 0,
      r,
    );
    const r2 = await a.un.importar({
      p: [projeto({ id: "plap", atualizadoEm: AGORA, removidoEm: AGORA })],
      e: [etapa({ id: "elap", projeto: "plap", atualizadoEm: AGORA })],
    });
    checar("o projeto no proprio envelope (mesmo em lapide) basta", r2.ignorados === 0 && r2.novos === 2, r2);
    const r3 = await a.un.importar({ e: [etapa({ id: "elap2", projeto: "plap", atualizadoEm: AGORA })] });
    checar("o projeto aqui (mesmo em lapide) basta", r3.ignorados === 0 && r3.novos === 1, r3);
  }
  {
    const ana = pc("ana", "pc-ana");
    const e = Array.from({ length: 3000 }, (_, i) =>
      etapa({ id: `o${i}`, projeto: `fantasma${i % 7}`, nome: "E", atualizadoEm: AGORA, criadoEm: AGORA }),
    );
    const env: EnvelopeProjetos = {
      formato: "seipro-projetos",
      versao: 1,
      host: HOST,
      unidade: "110",
      vis: "unidade",
      gerado: AGORA,
      entidades: { p: [], f: [], e, h: [], m: [] },
    };
    const html = await gerarConteudoTexto("Dados internos do SEI Pro.", env);
    const sei = noSei(html);
    const st = await ana.rodada(ana.un, sei);
    const k = chaveRelatorio(ana.un.escopo);
    const rel = (await ana.area.obter(k))[k] as RelatorioImportacao | undefined;
    const t = await ana.un.entidades();
    const kb = Math.round(html.length / 1024);
    checar(
      `texto de ${kb} KB com 3000 etapas de projetos inexistentes: ignoradas, nada gravado aqui`,
      html.length < 40 * 1024 && rel?.ignorados === 3000 && t.e.length === 0,
      { kb, rel, gravadas: t.e.length },
    );
    checar("e nada volta ao texto", st.estado === "ok" && (await noTexto(sei.html)).e.length === 0, st);
  }
  {
    const sei = noSei();
    const a = pc("ana", "pc-ana");
    const b = pc("bia", "pc-bia", AGORA + 5);
    const p = await a.un.criarProjeto({ nome: "P" });
    await a.rodada(a.un, sei);
    await b.rodada(b.un, sei);
    await a.un.removerProjeto(p.id);
    const e = await b.un.criarEtapa({ projeto: p.id, nome: "Corrida", ...ETAPA });
    await a.rodada(a.un, sei);
    await b.rodada(b.un, sei);
    await a.rodada(a.un, sei);
    const antes = await noTexto(sei.html);
    checar(
      "premissa: a etapa da corrida (criada enquanto o colega excluia o projeto) esta no texto e nos dois",
      antes.e.some((x) => x.id === e.id && x.removidoEm === undefined) &&
        antes.p.some((x) => x.id === p.id && x.removidoEm !== undefined) &&
        !!(await a.un.etapas.obter(e.id)),
    );
    for (const c of [a, b]) c.rel.agora += 181 * DIA;
    await a.rodada(a.un, sei);
    const podado = await noTexto(sei.html);
    checar(
      "depois da poda do projeto: a etapa e os registros dele saem do texto",
      !podado.p.some((x) => x.id === p.id) && !podado.e.some((x) => x.id === e.id) && !podado.h.some((x) => x.projeto === p.id),
      podado,
    );
    const gravadas = sei.gravadas;
    const c = pc("caio", "pc-caio", a.rel.agora);
    for (let i = 0; i < 2; i++) {
      await b.rodada(b.un, sei);
      await a.rodada(a.un, sei);
      await c.rodada(c.un, sei);
    }
    checar("sem vai-e-volta: ninguem regrava (nem quem chega depois)", sei.gravadas === gravadas, {
      antes: gravadas,
      depois: sei.gravadas,
    });
    await a.un.limpar(a.rel.agora);
    await b.un.limpar(b.rel.agora);
    checar(
      "limpar: a etapa viva de projeto podado sai dos dois computadores",
      !(await a.un.etapas.obter(e.id)) && !(await b.un.etapas.obter(e.id)),
    );
  }
}

async function item3(): Promise<void> {
  secao("revisao final 3: o registro do historico tem teto");
  const a = pc("ana", "pc-ana");
  const p = await a.un.criarProjeto({ nome: "P" });
  const reg = (id: string, m: Partial<Registro> = {}) => registro({ id, projeto: p.id, ...m });
  const legitimos = Array.from({ length: 5 }, (_, i) => reg(`leg${i}`));
  const forjados = Array.from({ length: 300 }, (_, i) => reg(`forj${i}`, { quando: 1e15 }));
  const r = await a.un.importar({ h: [...legitimos, ...forjados] });
  const hs = await a.un.historico();
  checar(
    "300 registros com quando = 1e15: ignorados; os legitimos ficam",
    r.ignorados === 300 && legitimos.every((l) => hs.some((x) => x.id === l.id)) && !hs.some((x) => x.id.startsWith("forj")),
    { r, n: hs.length },
  );
  const r2 = await a.un.importar({ h: [reg("gigante", { antes: "x".repeat(200_000) })] });
  const noTextoDaqui = JSON.stringify(paraOTexto(await a.un.exportar(a.rel.agora), a.rel.agora));
  checar(
    "registro com 200 mil caracteres: ignorado (o texto nao passa do teto)",
    r2.ignorados === 1 && !noTextoDaqui.includes("x".repeat(401)),
    r2,
  );
  const PISO = Date.UTC(2000, 0, 1);
  const casos: Array<[string, Partial<Registro>, Partial<Registro>]> = [
    ["antes", { antes: "x".repeat(400) }, { antes: "x".repeat(401) }],
    ["depois", { depois: "x".repeat(400) }, { depois: "x".repeat(401) }],
    ["por", { por: "p".repeat(100) }, { por: "p".repeat(101) }],
    ["nome", { nome: "n".repeat(100) }, { nome: "n".repeat(101) }],
    ["campo", { campo: "c".repeat(100) as CampoHistorico }, { campo: "c".repeat(101) as CampoHistorico }],
    ["alteradoPor", { alteradoPor: "a".repeat(100) }, { alteradoPor: "a".repeat(101) }],
    ["dispositivo", { dispositivo: "d".repeat(100) }, { dispositivo: "d".repeat(101) }],
    ["quando (piso: 2000-01-01)", { quando: PISO }, { quando: PISO - 1 }],
    ["quando (teto: relogio + 1 dia)", { quando: AGORA + FOLGA_RELOGIO_MS }, { quando: AGORA + FOLGA_RELOGIO_MS + 1 }],
  ];
  const errados = casos.filter(([, ok, alem]) => !entidadeValida(reg("r1", ok), "h", AGORA) || entidadeValida(reg("r2", alem), "h", AGORA));
  checar(
    "registro: cada campo no teto passa e um a mais nao",
    errados.length === 0,
    errados.map(([c]) => c),
  );
  checar(
    "sem o relogio (mover entre escopos), o piso de 2000 vale",
    !entidadeValida(reg("r3", { quando: PISO - 1 }), "h") && entidadeValida(reg("r4", { quando: PISO }), "h"),
  );
  const ordem = LIMITES.ordem;
  const outros: Array<[string, boolean]> = [
    [
      "ordem do projeto",
      entidadeValida(projeto({ id: "o1", ordem: "a".repeat(ordem) }), "p") &&
        !entidadeValida(projeto({ id: "o2", ordem: "a".repeat(ordem + 1) }), "p"),
    ],
    [
      "ordem da fase",
      entidadeValida(fase({ id: "o3", ordem: "a".repeat(ordem) }), "f") &&
        !entidadeValida(fase({ id: "o4", ordem: "a".repeat(ordem + 1) }), "f"),
    ],
    [
      "ordem da etapa",
      entidadeValida(etapa({ id: "o5", ordem: "a".repeat(ordem) }), "e") &&
        !entidadeValida(etapa({ id: "o6", ordem: "a".repeat(ordem + 1) }), "e"),
    ],
    [
      "login do responsavel",
      entidadeValida(etapa({ id: "o7", responsavel: { nome: "R", login: "l".repeat(100) } }), "e") &&
        !entidadeValida(etapa({ id: "o8", responsavel: { nome: "R", login: "l".repeat(101) } }), "e"),
    ],
    [
      "alteradoPor e dispositivo dos outros tipos",
      entidadeValida(fase({ id: "o9", alteradoPor: "a".repeat(100), dispositivo: "d".repeat(100) }), "f") &&
        !entidadeValida(fase({ id: "o10", alteradoPor: "a".repeat(101) }), "f") &&
        !entidadeValida(projeto({ id: "o11", dispositivo: "d".repeat(101) }), "p"),
    ],
  ];
  checar(
    "ordem, login do responsavel, alteradoPor e dispositivo com teto",
    outros.every(([, ok]) => ok),
    outros.filter(([, ok]) => !ok).map(([n]) => n),
  );
  // O que nasce aqui cabe no teto (senão nenhum colega o aceitaria, e os dois regravariam o texto a cada rodada).
  const deps: Array<{ id: string }> = [];
  for (let i = 0; i < 4; i++) deps.push(await a.un.criarEtapa({ projeto: p.id, nome: `${"D".repeat(195)} ${i}`, ...ETAPA }));
  const alvo = await a.un.criarEtapa({ projeto: p.id, nome: "Alvo", inicio: "2026-10-12", fim: "2026-10-16" });
  await a.un.editarEtapa(alvo.id, { dependeDe: deps.map((d) => d.id) }, HOJE);
  const rd = (await a.un.historico()).find((x) => x.campo === "dependencias");
  checar(
    "o registro das dependencias com nomes longos nasce no teto e e aceito por um colega",
    !!rd && (rd.depois ?? "").length <= 400 && (rd.depois ?? "").endsWith("…") && entidadeValida(rd, "h", a.rel.agora),
    rd?.depois?.length,
  );
}

async function item4(): Promise<void> {
  secao("revisao final 4: a faixa do Entendi so com alteracao daqui");
  const sei = noSei();
  const w = pc("bia", "pc-bia");
  const antigo = await w.un.criarProjeto({ nome: "Antigo" });
  const vivo = await w.un.criarProjeto({ nome: "Vivo" });
  await w.un.removerProjeto(antigo.id);
  await w.rodada(w.un, sei);
  const r = pc("ana", "pc-ana", AGORA + 181 * DIA);
  const nao = async () => false;
  const st1 = await r.rodada(r.un, sei, nao);
  checar("lapide que passou de 180 dias, sem mudanca local: sem faixa e nada gravado", !st1.aguardandoPermissao && sei.gravadas === 1, st1);
  const env = await envelopeDoTexto(sei.html);
  env.entidades.e.push(etapa({ id: "orfa", projeto: "fantasma", atualizadoEm: AGORA }));
  env.entidades.h.push(registro({ id: "futuro", projeto: vivo.id, quando: 1e15 }));
  env.entidades.p.push(projeto({ id: "torto", nome: "x".repeat(300) }));
  sei.html = await gerarConteudoTexto("Dados internos do SEI Pro.", env);
  const st2 = await r.rodada(r.un, sei, nao);
  checar(
    "texto editado a mao (o que a importacao recusa), sem mudanca local: sem faixa",
    !st2.aguardandoPermissao && sei.gravadas === 1,
    st2,
  );
  await r.un.criarProjeto({ nome: "Meu" });
  const st3 = await r.rodada(r.un, sei, nao);
  checar("mudanca local: faixa", st3.aguardandoPermissao === true && sei.gravadas === 1, st3);
}

async function item8(): Promise<void> {
  secao("revisao final 8: o repositorio confere o numero do documento (o Agente grava por ele)");
  const a = pc("ana", "pc-ana");
  const p = await a.un.criarProjeto({ nome: "P" });
  const e = await a.un.criarEtapa({ projeto: p.id, nome: "E", ...ETAPA });
  const recusados: string[] = [];
  for (const numero of ["12a", "<b>1</b>", "1".repeat(21), " 123", "1.234"]) {
    const doc = { numero };
    const tentativas = [
      () => a.un.editarEtapa(e.id, { documento: doc }, HOJE),
      () => a.un.concluirEtapa(e.id, HOJE, doc),
      () => a.un.criarEtapa({ projeto: p.id, nome: "Nova", ...ETAPA, documento: doc }),
    ];
    for (const t of tentativas) if ((await lanca(t)) !== null) recusados.push(numero);
  }
  const depois = await a.un.obterEtapa(e.id);
  checar(
    "numero fora da regra (vazio ou 1 a 20 digitos): recusado em editar, concluir e criar; nada gravado",
    recusados.length === 15 && !depois?.documento && !depois?.concluidaEm && (await a.un.dados()).etapas.length === 1,
    { recusados: recusados.length, depois },
  );
  const titulo = await lanca(() => a.un.editarEtapa(e.id, { documento: { numero: "1234567", titulo: "t".repeat(201) } }, HOJE));
  checar("titulo acima de 200: recusado", titulo !== null);
  await a.un.editarEtapa(e.id, { documento: { numero: "1234567" } }, HOJE);
  await a.un.concluirEtapa(e.id, HOJE, { numero: "", sigiloso: true });
  const ok = await a.un.obterEtapa(e.id);
  checar(
    "o numero certo e o marcador do texto passam",
    ok?.documento?.numero === "" && ok.documento.sigiloso === true && !!ok.concluidaEm,
    ok,
  );
}

async function item9(): Promise<void> {
  secao("revisao final 9: memoria do sigilo quase cheia: a cascata conta no teto");
  const VAGA = 5;
  const K = "50300.000555/2026-10";
  const DOCS = Array.from({ length: 40 }, (_, i) => String(6_100_000 + i));
  const prefixo = prefixoMemoriaSigilo(HOST, "ana");
  const cheia: Record<string, string> = {};
  for (let i = 0; i < TETO_APRENDIDAS - VAGA; i++) {
    cheia[`${prefixo}p/${10_000_000_000 + i}`] = "aprendida";
    cheia[`${prefixo}d/${5_000_000 + i}`] = "aprendida";
  }
  const sei = noSei();
  const a = pc("ana", "pc-ana", AGORA, areaMemoria(cheia));
  const b = pc("bia", "pc-bia", AGORA + 5);
  const pb = await b.un.criarProjeto({ nome: "Comum" });
  for (const d of DOCS) {
    const e = await b.un.criarEtapa({ projeto: pb.id, nome: "E", ...ETAPA, processo: { protocolo: K } });
    await b.un.editarEtapa(e.id, { documento: { numero: d } }, HOJE);
    await b.un.removerEtapa(e.id);
  }
  await b.rodada(b.un, sei);
  await a.rodada(a.un, sei);
  const vazados = async () => {
    const t = JSON.stringify(await noTexto(sei.html));
    return DOCS.filter((d) => t.includes(d)).length;
  };
  checar("premissa: com K comum, os 40 documentos estao no texto", (await vazados()) === 40);
  await a.un.criarProjeto({ nome: "Apuração", processo: { protocolo: K, sigiloso: true } });
  const m = lerMemoria(await a.area.obter(null), prefixo);
  const di = DOCS.filter((d) => m.documentos.has(d));
  checar(
    "a Ana marca K: a cascata (40 documentos das lapides da Bia) entra como aprendida so ate o teto (5)",
    m.documentos.size === TETO_APRENDIDAS && di.length === VAGA && di.every((d) => m.documentos.get(d) === "aprendida"),
    { total: m.documentos.size, di: di.length },
  );
  const v: number[] = [];
  for (const c of [a, b, a, b]) {
    await c.rodada(c.un, sei);
    v.push(await vazados());
  }
  checar(
    "e nenhum documento volta ao texto (a regra raspa sem a memoria)",
    v.every((n) => n === 0),
    v,
  );
}

async function item13(): Promise<void> {
  secao("revisao final 13: quem so consulta o texto da unidade ganha o texto certo");
  const a = pc("ana", "pc-ana");
  await a.un.criarProjeto({ nome: "Meu" });
  const recusar = async (): Promise<never> => {
    throw Object.assign(new Error("sem o link de alterar"), { codigo: "SEI_ACAO_INDISPONIVEL" });
  };
  const html = await gerarConteudoTexto("Dados internos.", {
    formato: "seipro-projetos",
    versao: 1,
    host: HOST,
    unidade: "110",
    vis: "unidade",
    gerado: AGORA,
    entidades: { p: [], f: [], e: [], h: [], m: [] },
  } satisfies EnvelopeProjetos);
  const soConsulta = { ler: async () => html, gravar: recusar, gravarConferindo: recusar };
  const st: StatusSync = await new MotorTextoPadrao<EnvelopeProjetos>({
    adaptador: adaptadorProjetos({ repo: a.un, area: a.area, sigla: "S", nomeUsuario: "ana" }),
    destino: soConsulta,
    area: a.area,
    travar: (_n, fn) => fn(),
    agora: () => a.rel.agora,
    temporizador: { definir: () => 0, cancelar: () => undefined },
  }).sincronizar({ forcar: true });
  checar(
    "texto da unidade de quem so consulta: 'indisponivel' com o texto que serve a ele",
    st.estado === "indisponivel" && st.mensagem === MENSAGEM_UNIDADE_SO_LEITURA,
    st,
  );
}

export async function verificarRevisaoFinalP4(): Promise<void> {
  await item1();
  await item2();
  await item3();
  await item4();
  await item8();
  await item9();
  await item13();
}
