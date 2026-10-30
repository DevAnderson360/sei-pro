import { areaMemoria } from "../src/armazenamento/area";
import { MotorTextoPadrao, nomeDaTrava, type StatusSync, type Temporizador, textoDoErro } from "../src/sincronia/motor";
import {
  adaptadorTeste,
  type ChamadaExportar,
  destinoTeste,
  type EnvTeste,
  item,
  itensDoTexto,
  repoTeste,
  textoDeOutro,
} from "./adaptadorTeste";
import { checar, secao, tique } from "./util";

const DIA = 86_400_000;

function montar(
  o: {
    remoto?: string | null;
    teto?: number;
    aviso?: number;
    releituras?: number;
    intervaloPuxar?: number;
    diasLapide?: number;
    agora?: number;
    permitido?: () => Promise<boolean>;
    atrasoEnvio?: number;
    temporizador?: Temporizador;
    aleatorio?: () => number;
    antesDeRegravarInvalido?: (motivo: string, html: string) => Promise<void>;
    aoExportar?: (c: ChamadaExportar) => void;
  } = {},
) {
  const area = areaMemoria();
  const repo = repoTeste();
  const destino = destinoTeste(o.remoto ?? null);
  let agora = o.agora ?? 10_000_000;
  let ocupado = false;
  let emCurso = false;
  const travas: string[] = [];
  const motor = new MotorTextoPadrao<EnvTeste>({
    adaptador: adaptadorTeste(repo, {
      teto: o.teto,
      aviso: o.aviso,
      diasLapide: o.diasLapide,
      antesDeRegravarInvalido: o.antesDeRegravarInvalido,
      aoExportar: o.aoExportar,
    }),
    destino,
    area,
    // Como o Web Locks com `ifAvailable`: ocupada por outra aba (`ocupar`) ou pela rodada desta mesma aba ainda em curso.
    travar: async (nome, fn) => {
      travas.push(nome);
      if (ocupado || emCurso) return null;
      emCurso = true;
      try {
        return await fn();
      } finally {
        emCurso = false;
      }
    },
    agora: () => agora,
    atrasoEnvio: o.atrasoEnvio ?? 10,
    releituras: o.releituras,
    intervaloPuxar: o.intervaloPuxar,
    permitido: o.permitido,
    temporizador: o.temporizador,
    aleatorio: o.aleatorio,
  });
  return {
    area,
    repo,
    destino,
    motor,
    travas,
    avancar: (ms: number) => {
      agora += ms;
    },
    ocupar: (v: boolean) => {
      ocupado = v;
    },
  };
}

const ids = (l: Array<{ id: string }>) =>
  l
    .map((i) => i.id)
    .sort()
    .join();

export async function verificarMotorTexto(): Promise<void> {
  secao("motor generico: primeira rodada e intervalo");
  const m = montar();
  m.repo.por("a1", "um", 100);
  const s1 = await m.motor.sincronizar();
  checar(
    "sem texto no SEI: cria (e rele uma vez antes de gravar)",
    m.destino.gravadas === 1 && m.destino.lidas === 2 && s1.estado === "ok" && !s1.pendente,
    { s1, lidas: m.destino.lidas },
  );
  await m.motor.sincronizar();
  checar("logo depois, sem mudanca: nem le", m.destino.lidas === 2);
  m.avancar(6 * 60_000);
  await m.motor.sincronizar();
  checar("depois de 5 min le, e sem diferenca nao rele nem regrava", m.destino.lidas === 3 && m.destino.gravadas === 1);
  const mi = montar({ intervaloPuxar: 2 * 60_000 });
  await mi.motor.sincronizar();
  const antes = mi.destino.lidas;
  mi.avancar(3 * 60_000);
  await mi.motor.sincronizar();
  checar("intervalo configuravel (2 min): puxa de novo depois de 3 min", mi.destino.lidas > antes);
  checar(
    "trava por texto: seipro-<modulo>-sync|<chave de status> (o nome dos Favoritos nao muda)",
    m.travas[0] === "seipro-teste-sync|teste/sync/tp/a" && nomeDaTrava("favoritos", "k") === "seipro-favoritos-sync|k",
    m.travas,
  );

  secao("motor generico: mescla e releitura antes de gravar");
  const m2 = montar({ remoto: await textoDeOutro([item("b1", 50)]) });
  m2.repo.por("a1", "um", 100);
  m2.destino.aoLer = async (n) => {
    if (n === 2) m2.destino.html = await textoDeOutro([item("b1", 50), item("b2", 60)]);
  };
  await m2.motor.sincronizar();
  checar(
    "o colega gravou entre a leitura e a gravacao: a nova versao entra na mescla",
    m2.repo.itens.has("b2") && ids(await itensDoTexto(m2.destino.html)) === "a1,b1,b2",
    await itensDoTexto(m2.destino.html),
  );
  checar("e grava uma vez so, depois de reler de novo", m2.destino.gravadas === 1 && m2.destino.lidas === 3, m2.destino);
  const m3 = montar({ remoto: await textoDeOutro([item("b1", 50)]) });
  m3.repo.por("a1", "um", 100);
  const lista: ReturnType<typeof item>[] = [];
  m3.destino.aoLer = async (n) => {
    lista.push(item(`b${n}`, 50 + n));
    m3.destino.html = await textoDeOutro([...lista]);
  };
  const s3 = await m3.motor.sincronizar();
  checar(
    "texto mudando a cada leitura: depois de 3 releituras nao grava por cima e fica pendente",
    m3.destino.gravadas === 0 && m3.destino.lidas === 4 && s3.estado === "erro" && s3.pendente && /mudou/.test(s3.mensagem ?? ""),
    s3,
  );
  checar("o que o colega gravou ate a ultima mescla ja esta aqui", m3.repo.itens.has("b3"));
  m3.destino.aoLer = undefined;
  const s3b = await m3.motor.sincronizar();
  checar(
    "na rodada seguinte, com o texto parado, grava tudo",
    s3b.estado === "ok" && ids(await itensDoTexto(m3.destino.html)) === "a1,b1,b2,b3,b4",
    await itensDoTexto(m3.destino.html),
  );
  const m4 = montar({ releituras: 0 });
  m4.repo.por("a1", "um", 100);
  await m4.motor.sincronizar();
  checar("releituras: 0 le uma vez so (o modo dos Favoritos)", m4.destino.lidas === 1 && m4.destino.gravadas === 1);
  const m5 = montar({ remoto: await textoDeOutro([item("b1", 50)]) });
  await m5.motor.sincronizar();
  checar("igual depois de mesclar: nao regrava", m5.destino.gravadas === 0 && m5.repo.itens.has("b1"));

  secao("motor generico: texto invalido, mais novo, teto, aviso e permissao");
  const m6 = montar({ remoto: "<p>Um colega apagou tudo e escreveu isto</p>" });
  m6.repo.por("a1", "um", 100);
  const s6 = await m6.motor.sincronizar();
  checar(
    "invalido: regrava a partir do local e avisa",
    m6.destino.gravadas === 1 && s6.estado === "ok" && /regrav/.test(s6.mensagem ?? ""),
    s6,
  );
  checar("nada local some", m6.repo.itens.has("a1"));
  const m7 = montar({ remoto: await textoDeOutro([item("x", 1)], "maria") });
  m7.repo.por("a1", "um", 100);
  const s7 = await m7.motor.sincronizar();
  checar(
    "texto de outro escopo: invalido, com o motivo na mensagem",
    m7.destino.gravadas === 1 && /outro dono/.test(s7.mensagem ?? ""),
    s7,
  );
  const m8 = montar({ remoto: await textoDeOutro([], "pedro", 2) });
  m8.repo.por("a1", "um", 100);
  const s8 = await m8.motor.sincronizar();
  checar(
    "versao mais nova: nao toca e pede para atualizar",
    m8.destino.gravadas === 0 && s8.estado === "erro" && /mais nova/.test(s8.mensagem ?? ""),
    s8,
  );
  const m9 = montar({ teto: 100 });
  m9.repo.por("a1", "um", 100);
  const s9 = await m9.motor.sincronizar();
  checar(
    "acima do teto: nao grava e explica",
    m9.destino.gravadas === 0 && s9.estado === "erro" && /grandes demais/.test(s9.mensagem ?? ""),
    s9,
  );
  const m10 = montar({ aviso: 10 });
  m10.repo.por("a1", "um", 100);
  const s10 = await m10.motor.sincronizar();
  checar("acima do aviso: grava e avisa", m10.destino.gravadas === 1 && /perto do limite/.test(s10.mensagem ?? ""), s10);
  const m11 = montar({ permitido: async () => false });
  m11.repo.por("a1", "um", 100);
  const s11 = await m11.motor.sincronizar();
  checar("desligado no meio da rodada: nao grava", m11.destino.gravadas === 0 && s11.estado === "nunca" && !s11.pendente, s11);

  secao("motor generico: erros, trava e envio agendado");
  const m12 = montar();
  m12.destino.erro = { codigo: "SEI_SESSAO_EXPIRADA", message: "Sessão expirada" };
  await m12.motor.marcarPendente();
  const s12 = await m12.motor.sincronizar();
  checar("sessao expirada: erro, pendencia mantida", s12.estado === "erro" && s12.pendente && /Sess/.test(s12.mensagem ?? ""), s12);
  const m13 = montar();
  m13.destino.erro = { codigo: "SEI_ACAO_INDISPONIVEL", message: "sem menu" };
  const s13 = await m13.motor.sincronizar();
  checar("sem permissao de Texto Padrao: indisponivel", s13.estado === "indisponivel" && (s13.indisponivelAte ?? 0) > 0, s13);
  m13.avancar(60 * 60_000);
  await m13.motor.sincronizar();
  checar("e nao tenta de novo no mesmo dia", m13.destino.lidas === 1);
  await m13.motor.sincronizar({ forcar: true });
  checar("salvo se o usuario pedir", m13.destino.lidas === 2);
  checar("erro qualquer: a mensagem dele", textoDoErro(new Error("falhou")).mensagem === "falhou");
  const m14 = montar();
  m14.ocupar(true);
  await m14.motor.sincronizar({ forcar: true });
  checar("outra aba sincronizando: esta nao faz nada", m14.destino.lidas === 0);
  m14.ocupar(false);
  void m14.motor.agendarEnvio();
  await m14.motor.agendarEnvio();
  checar(
    "mudanca local marca pendente na hora",
    ((await m14.area.obter("teste/sync/tp/a"))["teste/sync/tp/a"] as StatusSync | undefined)?.pendente === true,
  );
  await tique(60);
  checar("duas mudancas seguidas: um envio so", m14.destino.gravadas === 1 && m14.destino.lidas === 2, m14.destino);

  secao("motor generico: lapides com prazo por escopo");
  const agora = 400 * DIA;
  const remotoVivo = await textoDeOutro([item("x", agora - 130 * DIA)]);
  const u = montar({ remoto: remotoVivo, diasLapide: 180, agora });
  u.repo.por("x", "x", agora - 200 * DIA);
  u.repo.remover("x", agora - 120 * DIA);
  await u.motor.sincronizar();
  const noTexto = (await itensDoTexto(u.destino.html)).find((i) => i.id === "x");
  checar("unidade (180 dias): a lapide de 120 dias vai no texto", noTexto?.removidoEm === agora - 120 * DIA, noTexto);
  const outro = repoTeste();
  outro.por("x", "x", agora - 130 * DIA, "B");
  outro.importar({ formato: "teste", versao: 1, dono: "pedro", itens: await itensDoTexto(u.destino.html) });
  checar("e o computador que ainda tinha o item vivo recebe a remocao (nao ressuscita)", outro.itens.get("x")?.removidoEm !== undefined);
  const p = montar({ remoto: remotoVivo, diasLapide: 90, agora });
  p.repo.por("x", "x", agora - 200 * DIA);
  p.repo.remover("x", agora - 120 * DIA);
  await p.motor.sincronizar();
  checar(
    "pessoal (90 dias): a mesma lapide ja nao viaja",
    !(await itensDoTexto(p.destino.html)).some((i) => i.id === "x"),
    await itensDoTexto(p.destino.html),
  );

  await verificarMudancaDuranteRodada();
  await verificarEsperaCrescente();
  await verificarGanchoInvalido();
  await verificarOrdemEReleitura();
}

/** Um colega que grava o texto a cada leitura (o texto nunca para). */
function colegaSemParar(d: ReturnType<typeof destinoTeste>): (n: number) => Promise<void> {
  const lista: ReturnType<typeof item>[] = [];
  return async (n) => {
    lista.push(item(`c${n}`, 50 + n));
    d.html = await textoDeOutro([...lista]);
  };
}

async function verificarMudancaDuranteRodada(): Promise<void> {
  secao("motor generico: mudanca local durante uma rodada longa");
  const g1 = montar();
  g1.repo.por("a1", "um", 100);
  g1.destino.aoLer = async (n) => {
    // A releitura (já depois do exportar) demora; nesse meio o usuário acrescenta um item.
    if (n === 2) {
      g1.repo.por("a2", "dois", 200);
      await g1.motor.marcarPendente();
      await tique(20);
    }
  };
  const sg1 = await g1.motor.sincronizar();
  checar(
    "a rodada grava o que exportou e termina ainda pendente (o item novo ficou de fora)",
    sg1.estado === "ok" && sg1.pendente && ids(await itensDoTexto(g1.destino.html)) === "a1",
    sg1,
  );
  g1.destino.aoLer = undefined;
  await tique(60);
  checar(
    "e o envio rearmado leva o item novo ao texto, sem ninguem pedir",
    ids(await itensDoTexto(g1.destino.html)) === "a1,a2" && (await g1.motor.status()).pendente === false,
    await itensDoTexto(g1.destino.html),
  );

  const g2 = montar();
  g2.repo.por("a1", "um", 100);
  g2.destino.aoLer = async (n) => {
    if (n === 2) {
      g2.repo.por("a2", "dois", 200);
      // Como o controle faz a cada mudança local; o envio (10 ms) dispara com a trava ainda com esta rodada.
      void g2.motor.agendarEnvio();
      await tique(40);
    }
  };
  await g2.motor.sincronizar();
  g2.destino.aoLer = undefined;
  await tique(80);
  checar(
    "o envio agendado que achou a trava com a propria rodada nao se perde",
    ids(await itensDoTexto(g2.destino.html)) === "a1,a2" && (await g2.motor.status()).pendente === false,
    await itensDoTexto(g2.destino.html),
  );

  const g3 = montar();
  g3.repo.por("a1", "um", 100);
  g3.ocupar(true);
  await g3.motor.agendarEnvio();
  await tique(40);
  const lidasOcupada = g3.destino.lidas;
  g3.ocupar(false);
  await tique(60);
  checar(
    "trava com outra aba quando o envio dispara: o envio e rearmado e acontece",
    lidasOcupada === 0 && ids(await itensDoTexto(g3.destino.html)) === "a1" && (await g3.motor.status()).pendente === false,
    { lidasOcupada, lidas: g3.destino.lidas, gravadas: g3.destino.gravadas },
  );
  g3.motor.parar();
}

async function verificarEsperaCrescente(): Promise<void> {
  secao("motor generico: depois de desistir, nova tentativa com espera crescente e sorteio");
  const esperas: number[] = [];
  let armado: (() => void) | undefined;
  const relogio: Temporizador = {
    definir: (fn, ms) => {
      esperas.push(ms);
      armado = fn;
      return esperas.length;
    },
    cancelar: () => undefined,
  };
  const b = montar({ remoto: await textoDeOutro([item("b1", 50)]), atrasoEnvio: 15_000, temporizador: relogio, aleatorio: () => 0 });
  b.repo.por("a1", "um", 100);
  const mudando = colegaSemParar(b.destino);
  b.destino.aoLer = mudando;
  for (let i = 0; i < 7; i++) await b.motor.sincronizar({ forcar: true });
  checar(
    "o texto nao para de mudar: 15 s, 30 s, 1 min, 2 min, 4 min e o teto de 5 min",
    esperas.join() === "15000,30000,60000,120000,240000,300000,300000",
    esperas,
  );
  b.destino.aoLer = undefined;
  const lidasB = b.destino.lidas;
  armado?.();
  await tique(30);
  const sb = await b.motor.status();
  checar(
    "a tentativa armada roda sozinha e, com o texto parado, grava",
    b.destino.lidas > lidasB && sb.estado === "ok" && !sb.pendente,
    sb,
  );
  esperas.length = 0;
  b.destino.aoLer = mudando;
  await b.motor.sincronizar({ forcar: true });
  checar("depois de gravar, a espera volta ao comeco", esperas.join() === "15000", esperas);

  const sorteadas: number[] = [];
  for (const sorteio of [0, 0.5]) {
    const j = montar({
      remoto: await textoDeOutro([item("b1", 50)]),
      atrasoEnvio: 15_000,
      aleatorio: () => sorteio,
      temporizador: {
        definir: (_fn, ms) => {
          sorteadas.push(ms);
          return 0;
        },
        cancelar: () => undefined,
      },
    });
    j.repo.por("a1", "um", 100);
    j.destino.aoLer = colegaSemParar(j.destino);
    await j.motor.sincronizar({ forcar: true });
  }
  checar("o sorteio (ate metade da espera) separa dois usuarios", sorteadas.join() === "15000,18750", sorteadas);
}

async function verificarGanchoInvalido(): Promise<void> {
  secao("motor generico: gancho antes de regravar um texto invalido");
  const editado = `${await textoDeOutro([item("b1", 50)])}\n<p>Comentário do colega no fim do texto.</p>`;
  const gancho: Array<{ motivo: string; html: string; gravadasAntes: number }> = [];
  const exportes: ChamadaExportar[] = [];
  const contar = { gravadas: () => -1 };
  const comGancho = (remoto: string | null) =>
    montar({
      remoto,
      antesDeRegravarInvalido: async (motivo, html) => {
        gancho.push({ motivo, html, gravadasAntes: contar.gravadas() });
      },
      aoExportar: (c) => exportes.push(c),
    });
  const h1 = comGancho(editado);
  contar.gravadas = () => h1.destino.gravadas;
  h1.repo.por("a1", "um", 100);
  const sh1 = await h1.motor.sincronizar();
  checar(
    "colega acrescentou um paragrafo (o codec recusa): o gancho recebe o HTML invalido antes da gravacao",
    gancho.length === 1 &&
      gancho[0]?.html === editado &&
      /editado/.test(gancho[0]?.motivo ?? "") &&
      gancho[0]?.gravadasAntes === 0 &&
      h1.destino.gravadas === 1 &&
      sh1.estado === "ok" &&
      /regrav/.test(sh1.mensagem ?? ""),
    { gancho: gancho.map((g) => ({ ...g, html: g.html.length })), sh1 },
  );
  checar(
    "e o exportar sabe que o texto existe e e invalido (nao inexistente)",
    exportes.length > 0 && exportes.every((c) => c.remoto === null && c.invalido === true),
    exportes.map((c) => ({ remoto: c.remoto !== null, invalido: c.invalido })),
  );

  gancho.length = 0;
  exportes.length = 0;
  const outroDono = await textoDeOutro([item("x", 1)], "maria");
  const h2 = comGancho(outroDono);
  contar.gravadas = () => h2.destino.gravadas;
  h2.repo.por("a1", "um", 100);
  await h2.motor.sincronizar();
  checar(
    "invalido pelo adaptador (outro dono): o gancho tambem e chamado antes de gravar",
    gancho.length === 1 &&
      gancho[0]?.html === outroDono &&
      /outro dono/.test(gancho[0]?.motivo ?? "") &&
      gancho[0]?.gravadasAntes === 0 &&
      exportes.every((c) => c.invalido === true),
    { gancho: gancho.map((g) => g.motivo), exportes: exportes.map((c) => c.invalido) },
  );

  gancho.length = 0;
  exportes.length = 0;
  const h3 = comGancho(null);
  h3.repo.por("a1", "um", 100);
  await h3.motor.sincronizar();
  checar(
    "texto inexistente: sem gancho, e o exportar recebe invalido: false",
    gancho.length === 0 &&
      h3.destino.gravadas === 1 &&
      exportes.length > 0 &&
      exportes.every((c) => c.remoto === null && c.invalido === false),
    exportes.map((c) => c.invalido),
  );

  const h4 = montar({
    remoto: editado,
    antesDeRegravarInvalido: async () => {
      throw new Error("Não foi possível guardar a cópia do texto inválido.");
    },
  });
  h4.repo.por("a1", "um", 100);
  const sh4 = await h4.motor.sincronizar();
  checar(
    "se o gancho falhar, nao grava: fica em erro e o texto do SEI fica como estava",
    h4.destino.gravadas === 0 && h4.destino.html === editado && sh4.estado === "erro" && /cópia/.test(sh4.mensagem ?? ""),
    sh4,
  );
  checar("e os dados locais ficam intactos", h4.repo.itens.size === 1 && h4.repo.itens.get("a1")?.valor === "um");
}

async function verificarOrdemEReleitura(): Promise<void> {
  secao("motor generico: permissao antes da releitura, e releitura pela carga");
  const ordem: string[] = [];
  const o1 = montar({
    permitido: async () => {
      ordem.push("permitido");
      return true;
    },
  });
  o1.destino.aoLer = () => {
    ordem.push("ler");
  };
  o1.repo.por("a1", "um", 100);
  await o1.motor.sincronizar();
  checar(
    "le, confere a permissao, rele e grava (a releitura fica colada na gravacao)",
    ordem.join() === "ler,permitido,ler" && o1.destino.gravadas === 1,
    ordem,
  );
  const o2 = montar({ permitido: async () => false });
  o2.repo.por("a1", "um", 100);
  await o2.motor.sincronizar();
  checar("desligado no meio da rodada: nem rele", o2.destino.lidas === 1 && o2.destino.gravadas === 0, o2.destino);

  const plano = await textoDeOutro([item("b1", 50)]);
  const escapadoDeNovo = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const e1 = montar({ remoto: plano });
  e1.repo.por("a1", "um", 100);
  e1.destino.aoLer = (n) => {
    // O SEI 5 devolve o mesmo conteúdo escapado mais uma vez numa leitura e não na outra.
    e1.destino.html = n % 2 === 0 ? escapadoDeNovo(plano) : plano;
  };
  const se1 = await e1.motor.sincronizar();
  checar(
    "o mesmo conteudo escapado mais uma vez (SEI 5) nao conta como mudanca: grava na primeira releitura",
    se1.estado === "ok" && e1.destino.gravadas === 1 && e1.destino.lidas === 2,
    { se1, lidas: e1.destino.lidas, gravadas: e1.destino.gravadas },
  );
  e1.motor.parar();

  const exportes: ChamadaExportar[] = [];
  const r = montar({ remoto: await textoDeOutro([item("b1", 50)]), aoExportar: (c) => exportes.push(c) });
  r.repo.por("a1", "um", 100);
  r.destino.aoLer = colegaSemParar(r.destino);
  await r.motor.sincronizar();
  checar(
    "releituras: 3 = 3 releituras e 2 novas mesclas (3 exportar ao todo) antes de desistir",
    r.destino.lidas === 4 && exportes.length === 3 && r.destino.gravadas === 0,
    { lidas: r.destino.lidas, exportes: exportes.length },
  );
  r.motor.parar();
}
