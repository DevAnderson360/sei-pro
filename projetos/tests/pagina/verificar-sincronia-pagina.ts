/**
 * A sincronia do lado da aba (pagina/sincronia.ts): o texto da unidade lido sem
 * consentimento e gravado só depois do "Entendi"; o pessoal desligado até o
 * consentimento; "sincronizar agora" e "apagar" (só o pessoal); o número
 * sigiloso nunca chega ao texto (decodificado: passa pelo adaptador de verdade,
 * com a memória do sigilo); a memória ilegível não derruba a aba.
 */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { definirConsentimento } from "@comum/sincronia/consentimento";
import type { ConferenciaTexto, ResultadoGravacao, StatusSync } from "@comum/sincronia/motor";
import { gerarConteudoTexto, lerConteudoTexto } from "@comum/sincronia/textoPadraoCodec";
import { prefixoMemoriaSigilo } from "../../src/modelo/constantes";
import { ErroMemoriaSigilo } from "../../src/modelo/memoriaSigilo";
import type { EnvelopeProjetos, Vis } from "../../src/modelo/tipos";
import { type DepsSincroniaPagina, INTERVALO_PUXAR, ligarSincronia, SincroniaPagina } from "../../src/pagina/sincronia";
import { RepositorioProjetos } from "../../src/repositorio";
import { CHAVE_CONSENTIMENTO, chaveDoConsentimento } from "../../src/sincronia/consentimento";
import { chaveStatusTexto, MENSAGEM_MUDOU } from "../../src/sincronia/textoPadrao";
import { checar, secao, tique } from "./util";

const AGORA = Date.UTC(2026, 9, 6, 12);
const HOST = "sei.x.gov.br";
const SIGILO = "50300.000777/2026-10";

export function textoNoSei(html: string | null = null) {
  const t = {
    html,
    lidas: 0,
    gravadas: 0,
    excluido: false,
    async ler() {
      t.lidas++;
      return t.html;
    },
    async gravar(h: string) {
      t.gravadas++;
      t.html = h;
    },
    async gravarConferindo(h: string, c: ConferenciaTexto): Promise<ResultadoGravacao> {
      if (!c.mesmo(t.html, c.anterior)) return { gravado: false, atual: t.html };
      t.gravadas++;
      t.html = h;
      return { gravado: true };
    },
    async excluir() {
      const havia = t.html !== null;
      t.html = null;
      t.excluido = true;
      return havia;
    },
  };
  return t;
}

function montar(
  textos: Record<Vis, ReturnType<typeof textoNoSei>>,
  inicial: Record<string, unknown> = {},
  embrulhar: (a: Area) => Area = (a) => a,
  extra: Partial<DepsSincroniaPagina> = {},
) {
  const area = embrulhar(areaMemoria(inicial));
  const sync = extra.sync ?? areaMemoria();
  const relogio = { agora: AGORA };
  const repo = (vis: Vis) =>
    new RepositorioProjetos(area, { host: HOST, login: "ana", unidade: "110", vis }, () => ({
      agora: ++relogio.agora,
      dispositivo: "pc-ana",
      por: "ana",
      nome: "Ana Lima",
    }));
  const repos = { unidade: repo("unidade"), eu: repo("eu") };
  const deps: DepsSincroniaPagina = {
    host: HOST,
    login: "ana",
    nomeUsuario: "Ana Lima",
    unidade: { id: "110", sigla: "SEPRO" },
    area,
    sync,
    repos,
    armazem: (vis) => textos[vis],
    travar: (_n, fn) => fn(),
    travarEsperando: (_n, fn) => fn(),
    atrasoEnvio: 10,
    ...extra,
  };
  const s = new SincroniaPagina(deps);
  const consentir = (vis: Vis, v: "ligado" | "desligado") =>
    definirConsentimento(sync, CHAVE_CONSENTIMENTO, "textoPadrao", chaveDoConsentimento(HOST, "ana", "110", vis), v);
  const status = async (vis: Vis) => {
    const k = chaveStatusTexto(repos[vis].escopo);
    return (await area.obter(k))[k] as StatusSync | undefined;
  };
  return { s, repos, area, sync, consentir, status, deps };
}

/** O envelope gravado no texto, decodificado (null se não há texto ou ele é inválido). */
export async function envelopeDoTexto(html: string | null): Promise<EnvelopeProjetos | null> {
  const r = html ? await lerConteudoTexto(html) : null;
  return r && "bruto" in r ? (r.bruto as EnvelopeProjetos) : null;
}

export const doColega = (): EnvelopeProjetos => ({
  formato: "seipro-projetos",
  versao: 1,
  host: HOST,
  unidade: "110",
  vis: "unidade",
  gerado: AGORA,
  entidades: {
    p: [{ id: "pc1", nome: "Do colega", etiquetas: [], ordem: "a0", criadoEm: AGORA, atualizadoEm: AGORA, dispositivo: "pc-bia" }],
    f: [],
    e: [],
    h: [],
    m: [],
  },
});

export async function verificarSincroniaPagina(): Promise<void> {
  secao("pagina: o texto da unidade e lido sem consentimento");
  const un = textoNoSei(await gerarConteudoTexto("Dados", doColega()));
  const eu = textoNoSei(null);
  const m = montar({ unidade: un, eu });
  await m.s.iniciar({ puxar: true });
  await tique(40);
  checar("le e mescla o projeto do colega", (await m.repos.unidade.dados()).projetos.some((p) => p.id === "pc1") && un.gravadas === 0);
  checar("o pessoal, desligado, nem e lido", eu.lidas === 0);
  await m.repos.unidade.criarProjeto({ nome: "Meu da unidade", processo: { protocolo: SIGILO, sigiloso: true } });
  await tique(60);
  checar(
    "mudanca na unidade sem o 'Entendi': nao grava e fica aguardando",
    un.gravadas === 0 && (await m.status("unidade"))?.aguardandoPermissao === true,
  );
  await m.consentir("unidade", "ligado");
  await tique(60);
  checar("com o 'Entendi': grava na hora", un.gravadas === 1);
  // O texto é compactado: a prova decodifica o que foi gravado (o adaptador de verdade, com a memória do sigilo).
  const gravado = await envelopeDoTexto(un.html);
  const meu = gravado?.entidades.p.find((p) => p.nome === "Meu da unidade");
  checar(
    "e o numero sigiloso nao foi junto (no texto decodificado, o vinculo vai vazio e marcado)",
    !!gravado &&
      !/000777|50300000777202610/.test(JSON.stringify(gravado)) &&
      meu?.processo?.protocolo === "" &&
      meu.processo.sigiloso === true &&
      meu.processo.idProcedimento === undefined,
    gravado,
  );
  const r = await m.s.agora();
  checar("sincronizar agora: a unidade sim, o pessoal (desligado) nao", r.unidade.estado === "ok" && r.eu === null, r);
  const local = (await m.repos.unidade.dados()).projetos.find((p) => p.nome === "Meu da unidade");
  checar(
    "e quem tem o numero nao o perde quando o texto volta (sem regravar)",
    local?.processo?.protocolo === SIGILO && un.gravadas === 1,
    local,
  );

  secao("pagina: o texto pessoal so com consentimento");
  await m.repos.eu.criarProjeto({ nome: "Só meu" });
  await tique(40);
  checar("desligado: o pessoal nao vai", eu.gravadas === 0 && eu.lidas === 0);
  await m.consentir("eu", "ligado");
  await tique(60);
  checar("ligado: grava o pessoal", eu.gravadas === 1);
  const r2 = await m.s.agora();
  checar("sincronizar agora devolve os dois", r2.unidade.estado === "ok" && r2.eu?.estado === "ok", r2);
  const lidasAntes = un.lidas;
  await m.s.puxar();
  checar("puxar ao focar respeita os 2 min", un.lidas === lidasAntes && INTERVALO_PUXAR === 120_000);
  const apagou = await m.s.apagarPessoal();
  checar("apagar: so o pessoal, e desliga", apagou && eu.excluido && un.html !== null);
  const prefs = (await m.sync.obter(CHAVE_CONSENTIMENTO))[CHAVE_CONSENTIMENTO] as { textoPadrao: Record<string, string> };
  checar(
    "consentimentos por texto no storage.sync",
    prefs.textoPadrao[`${HOST}|ana|110|eu`] === "desligado" && prefs.textoPadrao[`${HOST}|ana|110|un`] === "ligado",
    prefs,
  );
  m.s.parar();

  secao("pagina: a memoria do sigilo ilegivel nao derruba a aba");
  {
    const MEMORIA = `${prefixoMemoriaSigilo(HOST, "ana")}p/50300000777202610`;
    const un2 = textoNoSei(await gerarConteudoTexto("Dados", doColega()));
    const eu2 = textoNoSei(null);
    // O storage não consegue ler a memória do sigilo (falha fechada): a única forma de ela ficar ilegível.
    const falha = { ler: true };
    const m2 = montar({ unidade: un2, eu: eu2 }, { [MEMORIA]: "local" }, (a) => ({
      ...a,
      async obter(ch?: string | string[] | null) {
        const ks = ch === null || ch === undefined ? ["projetos/sigilo/"] : typeof ch === "string" ? [ch] : ch;
        if (falha.ler && ks.some((k) => k.startsWith("projetos/sigilo/"))) throw new Error("falha simulada ao ler o storage");
        return a.obter(ch);
      },
    }));
    await m2.consentir("unidade", "ligado");
    let caiu: unknown = null;
    try {
      await m2.s.iniciar({ puxar: true });
      await tique(40);
    } catch (e) {
      caiu = e;
    }
    const st = await m2.status("unidade");
    checar(
      "iniciar nao lanca: a sincronia da unidade fica em erro, com o motivo, e nada e gravado nem mesclado",
      caiu === null &&
        st?.estado === "erro" &&
        st.mensagem === new ErroMemoriaSigilo().message &&
        un2.lidas >= 1 &&
        un2.gravadas === 0 &&
        !(await m2.repos.unidade.entidades()).p.some((p) => p.id === "pc1"),
      { caiu, st, lidas: un2.lidas, gravadas: un2.gravadas },
    );
    let caiuAgora: unknown = null;
    let r3: Awaited<ReturnType<SincroniaPagina["agora"]>> | null = null;
    try {
      r3 = await m2.s.agora();
      await m2.s.puxar();
    } catch (e) {
      caiuAgora = e;
    }
    checar(
      "sincronizar agora e puxar tambem nao lancam: devolvem o erro",
      caiuAgora === null && r3?.unidade.estado === "erro" && r3.eu === null && un2.gravadas === 0,
      { caiuAgora, r3 },
    );
    falha.ler = false;
    const r4 = await m2.s.agora();
    checar(
      "com a memoria legivel de novo, a rodada seguinte le e mescla",
      r4.unidade.estado === "ok" && (await m2.repos.unidade.dados()).projetos.some((p) => p.id === "pc1"),
      r4,
    );
    m2.s.parar();
  }

  secao("pagina: um texto que falha nao derruba o outro (T13, item 6)");
  {
    // O armazém do texto da unidade não monta (ex.: a tela sem o menu): o pessoal, ligado, segue sozinho.
    const eu3 = textoNoSei(null);
    const semUnidade = (vis: Vis) => {
      if (vis === "unidade") throw new Error("O menu do SEI não oferece Textos Padrão aqui.");
      return eu3;
    };
    const m3 = montar({ unidade: textoNoSei(null), eu: eu3 }, {}, (a) => a, { armazem: semUnidade });
    await m3.consentir("eu", "ligado");
    await m3.repos.eu.criarProjeto({ nome: "Só meu" });
    let caiu: unknown = null;
    try {
      await m3.s.iniciar({ puxar: true });
    } catch (e) {
      caiu = e;
    }
    await tique(60);
    checar("iniciar: a unidade que falha nao impede o pessoal de ler e gravar", caiu === null && eu3.gravadas === 1, {
      caiu: String(caiu),
      gravadas: eu3.gravadas,
    });
    let r5: Awaited<ReturnType<SincroniaPagina["agora"]>> | null = null;
    let caiuAgora: unknown = null;
    try {
      r5 = await m3.s.agora();
    } catch (e) {
      caiuAgora = e;
    }
    checar(
      "sincronizar agora: a unidade volta em erro com o motivo e o pessoal com o status dele",
      caiuAgora === null &&
        r5?.unidade.estado === "erro" &&
        r5.unidade.mensagem === "O menu do SEI não oferece Textos Padrão aqui." &&
        r5.eu?.estado === "ok",
      { caiuAgora: String(caiuAgora), r5 },
    );
    m3.s.parar();

    // O storage.sync não lê (o consentimento): iniciar não rejeita; o "agora" não perde o status da unidade.
    const falha = { ler: false };
    const base = areaMemoria();
    const syncFalho: Area = {
      ...base,
      obter: async (k) => {
        if (falha.ler) throw new Error("QUOTA_BYTES quota exceeded");
        return base.obter(k);
      },
      aoMudar: base.aoMudar.bind(base),
    };
    const un4 = textoNoSei(await gerarConteudoTexto("Dados", doColega()));
    const m4 = montar({ unidade: un4, eu: textoNoSei(null) }, {}, (a) => a, { sync: syncFalho });
    falha.ler = true;
    let caiuIniciar: unknown = null;
    try {
      await m4.s.iniciar({ puxar: true });
    } catch (e) {
      caiuIniciar = e;
    }
    checar("iniciar com o storage.sync que nao le: nao rejeita", caiuIniciar === null, String(caiuIniciar));
    let r6: Awaited<ReturnType<SincroniaPagina["agora"]>> | null = null;
    let caiu6: unknown = null;
    try {
      r6 = await m4.s.agora();
    } catch (e) {
      caiu6 = e;
    }
    checar(
      "sincronizar agora: a unidade (lida e mesclada) fica; o pessoal, sem saber se esta ligado, volta em erro",
      caiu6 === null &&
        r6?.unidade.estado === "ok" &&
        r6.eu?.estado === "erro" &&
        (await m4.repos.unidade.dados()).projetos.some((p) => p.id === "pc1"),
      { caiu6: String(caiu6), r6 },
    );
    m4.s.parar();
  }

  secao("pagina: a sincronia confere os escopos dos repositorios (T13, item 6)");
  {
    const m5 = montar({ unidade: textoNoSei(null), eu: textoNoSei(null) });
    const tenta = (d: Partial<DepsSincroniaPagina>) => {
      try {
        new SincroniaPagina({ ...m5.deps, ...d }).parar();
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    };
    checar("os mesmos host, login e unidade: monta", tenta({}) === null && tenta({ login: " ANA " }) === null);
    checar(
      "outro host, outro login ou outra unidade: recusa (o consentimento de um nao grava os dados de outro)",
      tenta({ host: "sei.outro.gov.br" }) !== null &&
        tenta({ login: "bia" }) !== null &&
        tenta({ unidade: { id: "999", sigla: "SEPRO" } }) !== null,
    );
    checar(
      "os repositorios trocados (o da unidade no lugar do pessoal): recusa",
      tenta({ repos: { unidade: m5.repos.eu, eu: m5.repos.unidade } }) !== null,
    );
  }

  await verificarRevisaoFinalPagina();
}

/** O projeto que um colega acabou de gravar no texto da unidade. */
const comNovoDoColega = (id: string): EnvelopeProjetos => {
  const e = doColega();
  e.entidades.p.push({
    id,
    nome: `Novo ${id}`,
    etiquetas: [],
    ordem: "a1",
    criadoEm: AGORA,
    atualizadoEm: AGORA + 1,
    dispositivo: "pc-bia",
  });
  return e;
};

/** O último puxar deste texto foi há `min` minutos (o intervalo da aba é 2 min; o padrão do motor, 5). */
async function envelhecer(m: ReturnType<typeof montar>, vis: Vis, min: number, extra: Partial<StatusSync> = {}): Promise<void> {
  const k = chaveStatusTexto(m.repos[vis].escopo);
  const st = (await m.area.obter(k))[k] as StatusSync;
  await m.area.gravar({ [k]: { ...st, ultimoPuxar: Date.now() - min * 60_000, ...extra } });
}

/**
 * Revisão final da P4: as provas que derrubam os ajustes da ligação (item 10: `intervaloPuxar`, `releituras`,
 * `lerNoRecuo`; o `idProcedimento` do sigiloso; o sigilo no texto pessoal) e a rodada única e a nova tentativa
 * de iniciar ao focar (item 11).
 */
async function verificarRevisaoFinalPagina(): Promise<void> {
  secao("pagina: o intervalo da aba e de 2 min, nao os 5 do motor (revisao final, item 10)");
  {
    const un = textoNoSei(await gerarConteudoTexto("Dados", doColega()));
    const m = montar({ unidade: un, eu: textoNoSei(null) });
    await m.s.iniciar({ puxar: true });
    await tique(60);
    await envelhecer(m, "unidade", 3);
    const lidas = un.lidas;
    await m.s.puxar();
    checar("passados 3 min (menos que os 5 do motor), o foco le", un.lidas === lidas + 1, un.lidas - lidas);
    m.s.parar();
  }

  secao("pagina: a conferencia na gravacao, ate 3 tentativas (revisao final, item 10)");
  {
    const un = textoNoSei(await gerarConteudoTexto("Dados", doColega()));
    let conferencias = 0;
    un.gravarConferindo = async () => {
      conferencias++;
      // Um colega grava entre a leitura e a gravação, todas as vezes.
      un.html = await gerarConteudoTexto("Dados", comNovoDoColega(`pc${conferencias + 10}`));
      return { gravado: false, atual: un.html };
    };
    const m = montar({ unidade: un, eu: textoNoSei(null) });
    await m.consentir("unidade", "ligado");
    await m.repos.unidade.criarProjeto({ nome: "Meu" });
    const r = await m.s.agora();
    checar(
      "o texto mudando a cada conferencia: 3 tentativas pela conferencia (nunca a gravacao cega) e desiste em 'pendente'",
      conferencias === 3 && un.gravadas === 0 && r.unidade.mensagem === MENSAGEM_MUDOU && r.unidade.pendente === true,
      { conferencias, gravadas: un.gravadas, r: r.unidade },
    );
    m.s.parar();
  }

  secao("pagina: no recuo de 'indisponivel', o texto da unidade continua lido (revisao final, item 10)");
  {
    const un = textoNoSei(await gerarConteudoTexto("Dados", doColega()));
    const recusar = async (): Promise<never> => {
      throw Object.assign(new Error("sem o link de alterar"), { codigo: "SEI_ACAO_INDISPONIVEL" });
    };
    un.gravar = recusar;
    un.gravarConferindo = recusar;
    const m = montar({ unidade: un, eu: textoNoSei(null) });
    await m.s.iniciar({ puxar: true });
    await tique(40);
    await m.consentir("unidade", "ligado");
    await m.repos.unidade.criarProjeto({ nome: "Meu" });
    const r = await m.s.agora();
    await tique(40);
    checar("premissa: quem so consulta fica em 'indisponivel', com o recuo de um dia", r.unidade.estado === "indisponivel", r.unidade);
    un.html = await gerarConteudoTexto("Dados", comNovoDoColega("pc9"));
    await envelhecer(m, "unidade", 3);
    await m.s.puxar();
    checar(
      "passados os 2 min, o foco le e mescla o que o colega gravou, sem sair do recuo",
      (await m.repos.unidade.dados()).projetos.some((p) => p.id === "pc9") && (await m.status("unidade"))?.estado === "indisponivel",
    );
    m.s.parar();
  }

  secao("pagina: o idProcedimento do sigiloso nao vai ao texto; o pessoal tambem raspa (revisao final, item 10)");
  {
    const un = textoNoSei(null);
    const eu = textoNoSei(null);
    const m = montar({ unidade: un, eu });
    await m.consentir("unidade", "ligado");
    await m.consentir("eu", "ligado");
    await m.repos.unidade.criarProjeto({ nome: "Apuração", processo: { protocolo: SIGILO, idProcedimento: "987654321", sigiloso: true } });
    const pe = await m.repos.eu.criarProjeto({
      nome: "Só meu",
      processo: { protocolo: SIGILO, idProcedimento: "987654321", sigiloso: true },
    });
    const ee = await m.repos.eu.criarEtapa({ projeto: pe.id, nome: "Oitiva", inicio: "2026-10-06", fim: "2026-10-09" });
    await m.repos.eu.editarEtapa(ee.id, { documento: { numero: "4455667" } }, "2026-10-06");
    const r = await m.s.agora();
    const tu = JSON.stringify(await envelopeDoTexto(un.html));
    const te = JSON.stringify(await envelopeDoTexto(eu.html));
    checar(
      "texto da unidade: o vinculo que TEM idProcedimento vai sem ele (e sem o numero)",
      r.unidade.estado === "ok" && !!un.html && !tu.includes("987654321") && !/000777|50300000777202610/.test(tu),
      tu,
    );
    checar(
      "texto pessoal: o numero sigiloso, o idProcedimento e o documento da etapa sigilosa nao vao",
      r.eu?.estado === "ok" && !!eu.html && !te.includes("987654321") && !/000777|50300000777202610/.test(te) && !te.includes("4455667"),
      te,
    );
    m.s.parar();
  }

  secao("pagina: uma rodada por vez ao focar (revisao final, item 11)");
  {
    const un = textoNoSei(await gerarConteudoTexto("Dados", doColega()));
    const m = montar({ unidade: un, eu: textoNoSei(null) });
    await m.s.iniciar({ puxar: true });
    await tique(60);
    await envelhecer(m, "unidade", 3);
    const lidas = un.lidas;
    await Promise.all([m.s.puxar(), m.s.puxar()]);
    checar("dois focos juntos (SEI por HTTP, sem Web Locks): uma leitura so", un.lidas === lidas + 1, un.lidas - lidas);
    m.s.parar();

    // A mesma coisa pelos eventos de verdade: o foco e a volta da visibilidade chegam juntos.
    const area = areaMemoria();
    const relogio = { agora: AGORA };
    const repo = (vis: Vis) =>
      new RepositorioProjetos(area, { host: HOST, login: "ana", unidade: "110", vis }, () => ({
        agora: ++relogio.agora,
        dispositivo: "pc-ana",
        por: "ana",
        nome: "Ana Lima",
      }));
    const un2 = textoNoSei(await gerarConteudoTexto("Dados", doColega()));
    const janela = new EventTarget();
    const pagina = Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
    const repos = { unidade: repo("unidade"), eu: repo("eu") };
    const s = ligarSincronia({
      ctx: { host: HOST, login: "ana", nome: "Ana Lima" },
      unidade: { id: "110", sigla: "SEPRO" },
      area,
      sync: areaMemoria(),
      repos,
      armazem: (vis) => (vis === "unidade" ? un2 : textoNoSei(null)),
      janela,
      doc: pagina,
      atrasoEnvio: 10,
    });
    await tique(60);
    const k = chaveStatusTexto(repos.unidade.escopo);
    const st = (await area.obter(k))[k] as StatusSync;
    await area.gravar({ [k]: { ...st, ultimoPuxar: Date.now() - 3 * 60_000 } });
    const lidas2 = un2.lidas;
    janela.dispatchEvent(new Event("focus"));
    pagina.dispatchEvent(new Event("visibilitychange"));
    await tique(60);
    checar("focus e visibilitychange juntos: uma leitura so", un2.lidas === lidas2 + 1, un2.lidas - lidas2);
    s?.parar();
  }

  secao("pagina: o texto que nao iniciou tenta de novo ao focar (revisao final, item 11)");
  {
    const falha = { ler: true };
    const base = areaMemoria();
    const sync: Area = {
      ...base,
      obter: async (k) => {
        if (falha.ler) throw new Error("QUOTA_BYTES quota exceeded");
        return base.obter(k);
      },
      aoMudar: base.aoMudar.bind(base),
    };
    const un = textoNoSei(await gerarConteudoTexto("Dados", doColega()));
    const m = montar({ unidade: un, eu: textoNoSei(null) }, {}, (a) => a, { sync });
    await m.s.iniciar({ puxar: true });
    await tique(40);
    checar("premissa: o storage.sync nao leu e a unidade nao iniciou (nada lido)", un.lidas === 0);
    await m.s.puxar();
    await tique(40);
    checar("ainda sem o storage.sync: o foco tenta e nao quebra", un.lidas === 0);
    falha.ler = false;
    await m.s.puxar();
    await tique(60);
    const lidas = un.lidas;
    checar(
      "o storage.sync voltou: o foco seguinte inicia o texto, que le e mescla o do colega",
      lidas >= 1 && (await m.repos.unidade.dados()).projetos.some((p) => p.id === "pc1"),
      lidas,
    );
    await m.s.puxar();
    await tique(40);
    checar("e, iniciado, o foco seguinte respeita os 2 min", un.lidas === lidas, un.lidas - lidas);
    m.s.parar();
  }
}
