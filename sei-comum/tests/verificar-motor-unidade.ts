/**
 * O texto que é de todos (o da unidade nos Projetos): conferência do conteúdo
 * anterior junto da gravação, nada de texto vazio criado à toa, leitura no
 * recuo de "indisponível", "aguardando permissão" e o teto do descompactado.
 */

import { areaMemoria } from "../src/armazenamento/area";
import { codificar, decodificar, ErroConteudoGrande, LIMITE_DESCOMPACTADO, paraParagrafos } from "../src/sincronia/codec";
import { consentimentoNaArea, definirConsentimento } from "../src/sincronia/consentimento";
import { ControleTextoPadrao } from "../src/sincronia/controlePagina";
import { type DestinoTexto, MENSAGENS_MOTOR, MotorTextoPadrao, type StatusSync, textoDoErro } from "../src/sincronia/motor";
import { lerConteudoTexto } from "../src/sincronia/textoPadraoCodec";
import {
  adaptadorTeste,
  destinoConferindo,
  destinoTeste,
  type EnvTeste,
  item,
  itensDoTexto,
  repoTeste,
  textoDeOutro,
} from "./adaptadorTeste";
import { checar, lanca, secao, tique } from "./util";

const DIA = 86_400_000;
const CHAVE = "teste/sync/tp/a";
const RELOGIO_RECUO = 10_000_000;

function montar(o: {
  destino: DestinoTexto;
  area?: ReturnType<typeof areaMemoria>;
  releituras?: number;
  vazio?: boolean;
  lerNoRecuo?: boolean;
  permitido?: () => Promise<boolean>;
  adaptador?: Parameters<typeof adaptadorTeste>[1];
}) {
  const area = o.area ?? areaMemoria();
  const repo = repoTeste();
  let agora = 10_000_000;
  const motor = new MotorTextoPadrao<EnvTeste>({
    adaptador: adaptadorTeste(repo, { vazio: o.vazio, ...o.adaptador }),
    destino: o.destino,
    area,
    travar: (_n, fn) => fn(),
    agora: () => agora,
    atrasoEnvio: 10,
    releituras: o.releituras,
    lerNoRecuo: o.lerNoRecuo,
    permitido: o.permitido,
    // Nenhuma nova tentativa armada sobrevive à prova.
    temporizador: { definir: () => 0, cancelar: () => undefined },
  });
  return { area, repo, motor, avancar: (ms: number) => (agora += ms) };
}

const ids = (l: Array<{ id: string }>) =>
  l
    .map((i) => i.id)
    .sort()
    .join();

export async function verificarMotorUnidade(): Promise<void> {
  secao("codec: teto do tamanho descompactado");
  const bomba = await codificar({ x: "a".repeat(9 * 1024 * 1024) });
  checar("9 MB de JSON cabem em poucos KB de gzip", bomba.length < 40_000, bomba.length);
  const e1 = await lanca(() => decodificar(bomba));
  checar("decodificar recusa passar do limite (8 MB) sem montar o JSON", e1 instanceof ErroConteudoGrande, e1);
  checar("o limite padrao e de 8 MB", LIMITE_DESCOMPACTADO === 8 * 1024 * 1024);
  const pequeno = await codificar({ lista: Array.from({ length: 200 }, (_, i) => `item ${i}`) });
  checar("limite menor que o conteudo tambem recusa", (await lanca(() => decodificar(pequeno, 100))) instanceof ErroConteudoGrande);
  checar("dentro do limite, volta inteiro", ((await decodificar(pequeno, 1_000_000)) as { lista: string[] }).lista.length === 200);
  const lido = await lerConteudoTexto(paraParagrafos("Dados internos.", bomba));
  checar(
    "texto padrao com a bomba: invalido (o motor regrava a partir do local)",
    "invalido" in lido && /passam do limite/.test(lido.invalido),
    lido,
  );

  secao("motor: conferencia do conteudo anterior junto da gravacao");
  const d1 = destinoConferindo(await textoDeOutro([item("b1", 50)]));
  const m1 = montar({ destino: d1 });
  m1.repo.por("a1", "um", 100);
  const s1 = await m1.motor.sincronizar();
  checar(
    "le uma vez e grava conferindo (a releitura separada sai)",
    s1.estado === "ok" && d1.lidas === 1 && d1.conferencias === 1 && d1.gravadas === 1 && ids(await itensDoTexto(d1.html)) === "a1,b1",
    { s1, d1: { lidas: d1.lidas, conferencias: d1.conferencias, gravadas: d1.gravadas } },
  );
  const d2 = destinoConferindo(await textoDeOutro([item("b1", 50)]));
  const m2 = montar({ destino: d2 });
  m2.repo.por("a1", "um", 100);
  d2.aoConferir = async (n) => {
    if (n === 1) d2.html = await textoDeOutro([item("b1", 50), item("b2", 60)]);
  };
  const s2 = await m2.motor.sincronizar();
  checar(
    "o colega gravou entre a leitura e a gravacao: a conferencia devolve o atual, que entra na mescla",
    s2.estado === "ok" && m2.repo.itens.has("b2") && ids(await itensDoTexto(d2.html)) === "a1,b1,b2",
    await itensDoTexto(d2.html),
  );
  checar("sem ler de novo: o atual veio da propria conferencia", d2.lidas === 1 && d2.conferencias === 2 && d2.gravadas === 1, d2);
  const d3 = destinoConferindo(await textoDeOutro([item("b1", 50)]));
  const m3 = montar({ destino: d3 });
  m3.repo.por("a1", "um", 100);
  d3.aoConferir = async (n) => {
    d3.html = await textoDeOutro([item("b1", 50), item(`c${n}`, 70 + n)]);
  };
  const s3 = await m3.motor.sincronizar();
  checar(
    "texto mudando a cada conferencia: depois de 3 nao grava por cima, fica pendente e com erro brando",
    d3.conferencias === 3 && d3.gravadas === 0 && s3.estado === "erro" && s3.pendente && /mudou/.test(s3.mensagem ?? ""),
    s3,
  );
  const d4 = destinoConferindo(await textoDeOutro([item("b1", 50)]));
  const m4 = montar({ destino: d4 });
  m4.repo.por("a1", "um", 100);
  d4.aoConferir = (n) => {
    if (n === 1) d4.html = null;
  };
  await m4.motor.sincronizar();
  checar(
    "o texto sumiu no meio (colega excluiu): recria com o que ja estava mesclado",
    d4.gravadas === 1 && ids(await itensDoTexto(d4.html)) === "a1,b1",
    await itensDoTexto(d4.html),
  );
  const d5 = destinoConferindo(null);
  const m5 = montar({ destino: d5 });
  m5.repo.por("a1", "um", 100);
  d5.aoConferir = async (n) => {
    if (n === 1) d5.html = await textoDeOutro([item("b1", 50)]);
  };
  await m5.motor.sincronizar();
  checar(
    "criado por um colega no meio (nao existia na leitura): mescla o dele e grava por cima, sem duplicar",
    d5.gravadas === 1 && ids(await itensDoTexto(d5.html)) === "a1,b1" && m5.repo.itens.has("b1"),
    await itensDoTexto(d5.html),
  );
  const d7 = destinoConferindo(await textoDeOutro([item("b1", 50)]));
  const m7 = montar({ destino: d7 });
  m7.repo.por("a1", "um", 100);
  let escapou = false;
  d7.aoConferir = (n) => {
    if (n !== 1 || d7.html === null) return;
    const antes = d7.html;
    // O SEI 5 devolve o conteúdo do formulário escapado mais uma vez.
    d7.html = antes.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    escapou = d7.html !== antes;
  };
  const s7 = await m7.motor.sincronizar();
  checar(
    "o escape a mais do SEI 5 no texto conferido nao conta como mudanca: grava na 1a conferencia",
    escapou && s7.estado === "ok" && d7.conferencias === 1 && d7.gravadas === 1 && ids(await itensDoTexto(d7.html)) === "a1,b1",
    { s7, conferencias: d7.conferencias, gravadas: d7.gravadas },
  );
  const d6 = destinoConferindo(null);
  const m6 = montar({ destino: d6, releituras: 0 });
  m6.repo.por("a1", "um", 100);
  await m6.motor.sincronizar();
  checar("releituras: 0 (os Favoritos) grava sem conferir, mesmo com o destino que confere", d6.conferencias === 0 && d6.gravadas === 1);

  secao("motor: texto que nao existe e nada a guardar");
  const v1 = destinoTeste(null);
  const mv1 = montar({ destino: v1, vazio: true });
  const sv1 = await mv1.motor.sincronizar();
  checar("sem texto e sem itens: nao cria o texto", sv1.estado === "ok" && v1.gravadas === 0 && v1.html === null, { sv1, v1 });
  mv1.repo.por("a1", "um", 100);
  await mv1.motor.sincronizar({ forcar: true });
  checar("com um item: cria", v1.gravadas === 1 && ids(await itensDoTexto(v1.html)) === "a1");
  const v2 = destinoTeste(await textoDeOutro([]));
  const mv2 = montar({ destino: v2, vazio: true });
  await mv2.motor.sincronizar();
  checar("texto existente e vazio dos dois lados: igual, nao regrava", v2.gravadas === 0);

  secao("motor: leitura no recuo de indisponivel");
  const indisponivel: StatusSync = {
    estado: "indisponivel",
    quando: 1,
    pendente: false,
    indisponivelAte: 10_000_000 + DIA,
    mensagem: "Indisponível nesta unidade.",
  };
  const r1 = destinoTeste(await textoDeOutro([item("b1", 50)]));
  const mr1 = montar({ destino: r1, area: areaMemoria({ [CHAVE]: indisponivel }), lerNoRecuo: true });
  mr1.repo.por("a1", "um", 100);
  const sr1 = await mr1.motor.sincronizar();
  checar(
    "le e mescla o que os colegas gravaram, sem gravar",
    r1.lidas === 1 &&
      r1.gravadas === 0 &&
      mr1.repo.itens.has("b1") &&
      sr1.estado === "indisponivel" &&
      sr1.mensagem === indisponivel.mensagem,
    { sr1, r1 },
  );
  await mr1.motor.sincronizar();
  checar("logo depois nao le de novo (intervalo)", r1.lidas === 1);
  mr1.avancar(6 * 60_000);
  await mr1.motor.sincronizar();
  checar("depois do intervalo, le de novo", r1.lidas === 2 && r1.gravadas === 0);
  const r2 = destinoTeste(await textoDeOutro([item("b1", 50)]));
  const mr2 = montar({ destino: r2, area: areaMemoria({ [CHAVE]: indisponivel }) });
  await mr2.motor.sincronizar();
  checar("sem lerNoRecuo (os Favoritos): nao le durante o recuo", r2.lidas === 0);
  const r3 = destinoTeste(null);
  r3.erro = { codigo: "SEI_SESSAO_EXPIRADA", message: "x" };
  const mr3 = montar({ destino: r3, area: areaMemoria({ [CHAVE]: indisponivel }), lerNoRecuo: true });
  const sr3 = await mr3.motor.sincronizar();
  checar("erro na leitura do recuo: o estado fica indisponivel", sr3.estado === "indisponivel" && r3.lidas === 1, sr3);

  secao("motor: aguardando permissao");
  let pode = false;
  const p1 = destinoConferindo(await textoDeOutro([item("b1", 50)]));
  const mp1 = montar({ destino: p1, permitido: async () => pode });
  mp1.repo.por("a1", "um", 100);
  const sp1 = await mp1.motor.sincronizar();
  checar(
    "ha o que gravar e nao pode: nao grava, marca aguardando e conta a puxada",
    p1.gravadas === 0 &&
      sp1.estado === "nunca" &&
      sp1.aguardandoPermissao === true &&
      sp1.ultimoPuxar === 10_000_000 &&
      mp1.repo.itens.has("b1"),
    sp1,
  );
  pode = true;
  const sp2 = await mp1.motor.sincronizar({ forcar: true });
  checar(
    "com a permissao: grava, e a marca sai",
    p1.gravadas === 1 && sp2.estado === "ok" && !sp2.aguardandoPermissao && ids(await itensDoTexto(p1.html)) === "a1,b1",
    sp2,
  );

  secao("controle: texto lido por todos (le sem consentimento, grava com ele)");
  const area = areaMemoria();
  const prefs = areaMemoria();
  const repo = repoTeste();
  let relogio = 10_000_000;
  const remoto = destinoConferindo(await textoDeOutro([item("b1", 50)]));
  const porta = consentimentoNaArea({ area: prefs, chavePreferencias: "teste/preferencias", campo: "textoPadrao", chave: "k|un" });
  const c = new ControleTextoPadrao<EnvTeste>({
    area,
    adaptador: adaptadorTeste(repo),
    armazem: () => ({ ...remoto, excluir: async () => false }),
    consentimento: porta,
    aoMudarLocal: (cb) => repo.aoMudar(cb),
    travar: (_n, fn) => fn(),
    atrasoEnvio: 10,
    agora: () => relogio,
    lerSemConsentimento: true,
  });
  await c.iniciar({ puxar: true });
  await tique(30);
  // A gravação da própria mescla agenda mais uma rodada, que acha tudo igual (uma leitura a mais, e para).
  checar("sem consentimento: le e mescla o do colega", remoto.lidas >= 1 && repo.itens.has("b1") && remoto.gravadas === 0, remoto);
  repo.por("a1", "um", 200);
  await tique(60);
  const st = (await area.obter(CHAVE))[CHAVE] as StatusSync | undefined;
  checar("mudanca local sem consentimento: nao grava e fica aguardando", remoto.gravadas === 0 && st?.aguardandoPermissao === true, st);
  await definirConsentimento(prefs, "teste/preferencias", "textoPadrao", "k|un", "ligado");
  await tique(60);
  checar(
    "consentiu: grava na hora o que esperava",
    remoto.gravadas === 1 && ids(await itensDoTexto(remoto.html)) === "a1,b1",
    await itensDoTexto(remoto.html),
  );
  await definirConsentimento(prefs, "teste/preferencias", "textoPadrao", "k|un", "desligado");
  await tique(30);
  // Um colega grava depois; passado o intervalo, o foco puxa de novo.
  remoto.html = await textoDeOutro([...(await itensDoTexto(remoto.html)), item("b3", 300)]);
  relogio += 6 * 60_000;
  const lidasAntes = remoto.lidas;
  const sd = await c.puxar();
  checar(
    "desligado: continua lendo e mesclando o dos colegas (sem gravar)",
    sd !== null && remoto.lidas > lidasAntes && repo.itens.has("b3") && remoto.gravadas === 1,
    { sd, lidas: remoto.lidas, lidasAntes, gravadas: remoto.gravadas },
  );
  c.parar();
  let perguntas = 0;
  const repo2 = repoTeste();
  const remoto2 = destinoConferindo(null);
  const c2 = new ControleTextoPadrao<EnvTeste>({
    area: areaMemoria(),
    adaptador: adaptadorTeste(repo2),
    armazem: () => ({ ...remoto2, excluir: async () => false }),
    consentimento: porta,
    aoMudarLocal: (cb) => repo2.aoMudar(cb),
    travar: (_n, fn) => fn(),
    lerSemConsentimento: true,
    permitido: async () => {
      perguntas++;
      return true;
    },
  });
  repo2.por("a1", "um", 100);
  await c2.agora();
  checar("permitido proprio do modulo no lugar do consentimento", perguntas === 1 && remoto2.gravadas === 1);
  c2.parar();

  secao("controle: recuo de indisponivel de quem so le (a mescla nao vira tentativa de gravar)");
  for (const caso of [
    { nome: "consentiu, nada local", local: false, consentir: true },
    { nome: "consentiu, item local", local: true, consentir: true },
    { nome: "sem o Entendi, item local", local: true, consentir: false },
  ]) {
    const r = await controleNoRecuo(caso);
    checar(
      `${caso.nome}: le uma vez, mescla, nenhuma tentativa de gravar; estado, mensagem e recuo ficam; pendente guardado`,
      r.tentativas() === 0 &&
        r.remoto.lidas === 1 &&
        r.repo.itens.has("b1") &&
        r.st.estado === "indisponivel" &&
        r.st.mensagem === indisponivel.mensagem &&
        r.st.indisponivelAte === indisponivel.indisponivelAte &&
        r.st.pendente === true,
      { tentativas: r.tentativas(), lidas: r.remoto.lidas, st: r.st },
    );
    if (caso.local && caso.consentir) {
      const sa = await r.c.agora();
      checar(
        "Sincronizar agora no recuo: tenta gravar (o usuario pediu) e o recuo continua",
        r.tentativas() === 1 && sa.estado === "indisponivel" && (sa.indisponivelAte ?? 0) > RELOGIO_RECUO,
        { tentativas: r.tentativas(), sa },
      );
    }
    r.c.parar();
  }

  await verificarRevisaoFinalMotor();
}

/**
 * Revisão final da P4: a faixa do "Entendi" só quando há o que é DAQUI a gravar (item 4), e o "indisponível" de
 * quem lê mas não pode gravar com um texto que serve a ele (item 13).
 */
async function verificarRevisaoFinalMotor(): Promise<void> {
  secao("motor: aguardando permissao so com o que e daqui (o texto lido normalizado pelo adaptador)");
  const velha = item("b1", 50, "B", true);
  for (const caso of [
    { nome: "lapide que passou do prazo (a exportacao poda)", itens: [velha, item("b2", 60)] },
    { nome: "texto sem nada a podar", itens: [item("b2", 60)] },
  ]) {
    const n1 = destinoConferindo(await textoDeOutro(caso.itens));
    let pode = false;
    const mn1 = montar({ destino: n1, permitido: async () => pode, adaptador: { diasLapide: 1, normalizar: true } });
    mn1.avancar(2 * DIA);
    const sn1 = await mn1.motor.sincronizar();
    checar(
      `${caso.nome}, sem mudanca local: sem 'aguardando', nada gravado`,
      !sn1.aguardandoPermissao && n1.gravadas === 0 && sn1.estado === "ok",
      sn1,
    );
    mn1.repo.por("a1", "meu", 10_000_000 + 2 * DIA);
    const sn2 = await mn1.motor.sincronizar({ forcar: true });
    checar(`${caso.nome}, com mudanca local: 'aguardando'`, sn2.aguardandoPermissao === true && n1.gravadas === 0, sn2);
    pode = true;
    const sn3 = await mn1.motor.sincronizar({ forcar: true });
    checar(`${caso.nome}, com a permissao: grava (e a poda vai junto)`, n1.gravadas === 1 && sn3.estado === "ok", sn3);
  }
  // Sem o gancho (os Favoritos): a diferença de poda ainda conta como algo a gravar, como antes.
  const n4 = destinoConferindo(await textoDeOutro([velha, item("b2", 60)]));
  const mn4 = montar({ destino: n4, permitido: async () => false, adaptador: { diasLapide: 1 } });
  mn4.avancar(2 * DIA);
  const sn4 = await mn4.motor.sincronizar();
  checar("sem o gancho normalizar: o comportamento de antes", sn4.aguardandoPermissao === true && n4.gravadas === 0, sn4);

  secao("motor: indisponivel na gravacao de quem le (so o link de consultar)");
  const recusar = async (): Promise<never> => {
    throw Object.assign(new Error("sem o link de alterar"), { codigo: "SEI_ACAO_INDISPONIVEL" });
  };
  const soConsulta = (inicial: string | null) => ({
    html: inicial,
    lidas: 0,
    async ler() {
      this.lidas++;
      return this.html;
    },
    gravar: recusar,
    gravarConferindo: recusar,
  });
  const q1 = soConsulta(await textoDeOutro([item("b1", 50)]));
  const mq1 = montar({ destino: q1 });
  mq1.repo.por("a1", "meu", 100);
  const sq1 = await mq1.motor.sincronizar({ forcar: true });
  checar(
    "leu e nao pode gravar: indisponivel, com o texto de quem so consulta (padrao)",
    sq1.estado === "indisponivel" && sq1.mensagem === MENSAGENS_MOTOR.soLeitura && /não deixa gravar/.test(sq1.mensagem ?? ""),
    sq1,
  );
  const q2 = soConsulta(await textoDeOutro([item("b1", 50)]));
  const mq2 = montar({ destino: q2, adaptador: { mensagens: { soLeitura: "Do modulo: so consulta." } } });
  mq2.repo.por("a1", "meu", 100);
  const sq2 = await mq2.motor.sincronizar({ forcar: true });
  checar("o modulo troca o texto de quem so consulta", sq2.estado === "indisponivel" && sq2.mensagem === "Do modulo: so consulta.", sq2);
  const q3 = destinoTeste(null);
  q3.erro = { codigo: "SEI_ACAO_INDISPONIVEL", message: "sem Textos Padrao" };
  const mq3 = montar({ destino: q3, adaptador: { mensagens: { soLeitura: "Do modulo: so consulta." } } });
  const sq3 = await mq3.motor.sincronizar({ forcar: true });
  checar(
    "nem le (sem Textos Padrao): o texto de sempre",
    sq3.estado === "indisponivel" && sq3.mensagem === textoDoErro({ codigo: "SEI_ACAO_INDISPONIVEL" }).mensagem,
    sq3,
  );
}

/** O texto da unidade de quem só lê: em recuo de "indisponível", e gravar é recusado pelo SEI. */
async function controleNoRecuo(o: { local: boolean; consentir: boolean }) {
  const area = areaMemoria({
    [CHAVE]: {
      estado: "indisponivel",
      quando: 1,
      pendente: false,
      indisponivelAte: RELOGIO_RECUO + DIA,
      mensagem: "Indisponível nesta unidade.",
    } satisfies StatusSync,
  });
  const prefs = areaMemoria();
  const porta = consentimentoNaArea({ area: prefs, chavePreferencias: "teste/preferencias", campo: "textoPadrao", chave: "k|un" });
  if (o.consentir) await definirConsentimento(prefs, "teste/preferencias", "textoPadrao", "k|un", "ligado");
  const repo = repoTeste();
  if (o.local) repo.por("a1", "um", 100);
  const remoto = destinoConferindo(await textoDeOutro([item("b1", 50)]));
  let tentativas = 0;
  const recusar = async (): Promise<never> => {
    tentativas++;
    throw Object.assign(new Error("sem o link de alterar"), { codigo: "SEI_ACAO_INDISPONIVEL" });
  };
  const c = new ControleTextoPadrao<EnvTeste>({
    area,
    adaptador: adaptadorTeste(repo),
    armazem: () => ({ ler: () => remoto.ler(), gravar: recusar, gravarConferindo: recusar, excluir: async () => false }),
    consentimento: porta,
    aoMudarLocal: (cb) => repo.aoMudar(cb),
    travar: (_n, fn) => fn(),
    atrasoEnvio: 10,
    agora: () => RELOGIO_RECUO,
    lerSemConsentimento: true,
    lerNoRecuo: true,
  });
  await c.iniciar({ puxar: true });
  // A mescla do b1 avisa o aoMudar: o envio agendado (10 ms) tem tempo de sobra para rodar.
  await tique(80);
  const st = (await area.obter(CHAVE))[CHAVE] as StatusSync;
  return { c, repo, remoto, st, tentativas: () => tentativas };
}
