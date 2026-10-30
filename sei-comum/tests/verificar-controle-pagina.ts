import { areaMemoria } from "../src/armazenamento/area";
import { chaveConsentimento, consentimentoNaArea, definirConsentimento, type PortaConsentimento } from "../src/sincronia/consentimento";
import { ControleTextoPadrao, ocultarTextosInternos } from "../src/sincronia/controlePagina";
import type { StatusSync } from "../src/sincronia/motor";
import { travarComLocks } from "../src/sincronia/trava";
import { adaptadorTeste, type EnvTeste, itensDoTexto, repoTeste } from "./adaptadorTeste";
import { checar, instalarDom, secao, tique } from "./util";

const PREFS = "teste/preferencias";
const chaveDe = (texto: string) => chaveConsentimento("sei.exemplo.gov.br", "Pedro", "110", texto);
const porta = (area: ReturnType<typeof areaMemoria>, texto = "unidade") =>
  consentimentoNaArea({ area, chavePreferencias: PREFS, campo: "textoPadrao", chave: chaveDe(texto) });

function armazemEmMemoria() {
  const remoto = { html: null as string | null, lidas: 0, excluido: false };
  const armazem = {
    ler: async () => {
      remoto.lidas++;
      return remoto.html;
    },
    gravar: async (h: string) => {
      remoto.html = h;
    },
    excluir: async () => {
      const havia = remoto.html !== null;
      remoto.excluido = true;
      remoto.html = null;
      return havia;
    },
  };
  return { remoto, armazem };
}

export async function verificarControlePagina(): Promise<void> {
  secao("controle da pagina: textos internos fora do seletor do SEI");
  const doc = instalarDom(
    '<html><body><select id="selTextoPadrao"><option value="">-</option><option value="1">Despacho</option><option value="2">[_SEIPRO_FAV_ana]</option><option value="3">[_SEIPRO_PRJ_UNIDADE]</option></select><select name="selTextoPadrao"><option>[_SEIPRO_PRJ_ana]</option><option>Ofício</option></select></body></html>',
  );
  checar(
    "remove os [_SEIPRO_ dos dois seletores e mantem os outros",
    ocultarTextosInternos(doc) === 3 && doc.querySelectorAll("option").length === 3,
  );

  secao("controle da pagina: consentimento, envio e apagar");
  const area = areaMemoria();
  const prefs = areaMemoria();
  const repo = repoTeste();
  const { remoto, armazem } = armazemEmMemoria();
  const consentimento = porta(prefs);
  let t = 1000;
  const c = new ControleTextoPadrao<EnvTeste>({
    area,
    adaptador: adaptadorTeste(repo),
    armazem: () => armazem,
    consentimento,
    aoMudarLocal: (cb) => repo.aoMudar(cb),
    travar: (_n, fn) => fn(),
    atrasoEnvio: 10,
    releituras: 0,
  });
  await c.iniciar({ puxar: true });
  checar("sem consentimento, nao sincroniza", remoto.lidas === 0);
  await definirConsentimento(prefs, PREFS, "textoPadrao", chaveDe("eu"), "ligado");
  await tique(30);
  checar("ligar o texto pessoal nao liga o da unidade (consentimento por texto)", remoto.lidas === 0);
  await consentimento.definir("ligado");
  await tique(30);
  checar("ligou (de qualquer lugar): sincroniza na hora", remoto.lidas === 1 && remoto.html !== null);
  repo.por("a1", "um", ++t);
  await tique(80);
  checar("mudanca local vai para o SEI sozinha", remoto.lidas === 2 && (await itensDoTexto(remoto.html)).some((i) => i.id === "a1"));
  const st = await c.agora();
  checar("sincronizar agora (pedido do app)", st.estado === "ok" && remoto.lidas === 3, st);
  const pux = await c.puxar();
  checar("puxar ao ganhar foco respeita o intervalo", pux?.estado === "ok" && remoto.lidas === 3);
  await c.apagar();
  const status = (await area.obter("teste/sync/tp/a"))["teste/sync/tp/a"] as StatusSync | undefined;
  checar(
    "apagar exclui o texto, desliga e zera o status",
    remoto.excluido && (await consentimento.estado()) === "desligado" && status?.estado === "nunca",
    status,
  );
  repo.por("a2", "dois", ++t);
  await tique(80);
  checar("desligado: mudancas nao vao mais", remoto.html === null);
  checar("desligado: puxar nao faz nada", (await c.puxar()) === null && remoto.lidas === 3);
  c.parar();

  secao("controle da pagina: pendencia de uma carga anterior");
  const area3 = areaMemoria({ "teste/sync/tp/a": { estado: "ok", quando: 1, pendente: true } satisfies StatusSync });
  const prefs3 = areaMemoria();
  await definirConsentimento(prefs3, PREFS, "textoPadrao", chaveDe("unidade"), "ligado");
  const r3 = armazemEmMemoria();
  const c3 = new ControleTextoPadrao<EnvTeste>({
    area: area3,
    adaptador: adaptadorTeste(repoTeste()),
    armazem: () => r3.armazem,
    consentimento: porta(prefs3),
    aoMudarLocal: () => () => undefined,
    travar: (_n, fn) => fn(),
    releituras: 0,
  });
  await c3.iniciar({ puxar: false });
  await tique(30);
  checar("fora da caixa, mas com pendencia: envia ao carregar", r3.remoto.lidas === 1 && r3.remoto.html !== null);
  c3.parar();

  secao("controle da pagina: apagar com uma rodada em curso nao deixa texto no SEI");
  const area2 = areaMemoria();
  const prefs2 = areaMemoria();
  const repo2 = repoTeste();
  repo2.por("a1", "um", 1);
  const remoto2 = { html: null as string | null };
  let soltarGravacao: () => void = () => undefined;
  const armazem2 = {
    ler: async () => remoto2.html,
    // A gravação demora (rede do órgão): o usuário pede "apagar" no meio dela.
    gravar: (h: string) =>
      new Promise<void>((ok) => {
        soltarGravacao = () => {
          remoto2.html = h;
          ok();
        };
      }),
    excluir: async () => {
      const havia = remoto2.html !== null;
      remoto2.html = null;
      return havia;
    },
    localizar: async () => (remoto2.html ? { id: "1" } : null),
  };
  let fila = Promise.resolve();
  const travarEsperando = <T>(_n: string, fn: () => Promise<T>) => {
    const r = fila.then(fn);
    fila = r.then(
      () => undefined,
      () => undefined,
    );
    return r;
  };
  const c2 = new ControleTextoPadrao<EnvTeste>({
    area: area2,
    adaptador: adaptadorTeste(repo2),
    armazem: () => armazem2,
    consentimento: porta(prefs2),
    aoMudarLocal: (cb) => repo2.aoMudar(cb),
    travar: (n, fn) => travarEsperando(n, fn),
    travarEsperando,
    atrasoEnvio: 10,
    releituras: 0,
  });
  await c2.iniciar({ puxar: true });
  await porta(prefs2).definir("ligado");
  await tique(30);
  const apagando = c2.apagar();
  await tique(10);
  soltarGravacao();
  await apagando;
  await tique(30);
  checar("o texto que a rodada gravou depois do pedido tambem sai", remoto2.html === null, remoto2.html?.slice(0, 40));
  c2.parar();

  secao("controle da pagina: SEI em HTTP (sem Web Locks)");
  const prefs4 = areaMemoria();
  await definirConsentimento(prefs4, PREFS, "textoPadrao", chaveDe("unidade"), "ligado");
  const r4 = armazemEmMemoria();
  const repo4 = repoTeste();
  repo4.por("a1", "um", 1);
  const c4 = new ControleTextoPadrao<EnvTeste>({
    area: areaMemoria(),
    adaptador: adaptadorTeste(repo4),
    armazem: () => r4.armazem,
    consentimento: porta(prefs4),
    aoMudarLocal: (cb) => repo4.aoMudar(cb),
    travar: (n, fn) => travarComLocks(n, fn, null),
  });
  const s4 = await c4.agora();
  checar(
    "sem trava, a rodada roda (com a releitura padrao) e grava",
    s4.estado === "ok" && r4.remoto.lidas === 2 && r4.remoto.html !== null,
    s4,
  );
  checar("e o apagar, sem travarEsperando, tambem", (await c4.apagar()) === true && r4.remoto.html === null);
  c4.parar();

  secao("controle da pagina: iniciar de novo nao duplica o ouvinte do consentimento");
  const prefs5 = areaMemoria();
  const base5 = porta(prefs5);
  let ouvintes = 0;
  const contada: PortaConsentimento = {
    estado: () => base5.estado(),
    definir: (v) => base5.definir(v),
    aoMudar: (cb) => {
      ouvintes++;
      const soltar = base5.aoMudar(cb);
      return () => {
        ouvintes--;
        soltar();
      };
    },
  };
  const r5 = armazemEmMemoria();
  const c5 = new ControleTextoPadrao<EnvTeste>({
    area: areaMemoria(),
    adaptador: adaptadorTeste(repoTeste()),
    armazem: () => r5.armazem,
    consentimento: contada,
    aoMudarLocal: () => () => undefined,
    travar: (_n, fn) => fn(),
    releituras: 0,
  });
  await c5.iniciar({ puxar: false });
  await c5.iniciar({ puxar: false });
  checar("duas chamadas a iniciar: um ouvinte so", ouvintes === 1, ouvintes);
  c5.parar();
  checar("e parar solta o ouvinte (nenhum fica para tras)", ouvintes === 0, ouvintes);
}
