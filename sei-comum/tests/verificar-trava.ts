import { areaMemoria } from "../src/armazenamento/area";
import {
  chaveConsentimento,
  consentimentoNaArea,
  definirConsentimento,
  estadoConsentimento,
  lerConsentimento,
} from "../src/sincronia/consentimento";
import { type GerenteDeTravas, travarComLocks, travarEsperando } from "../src/sincronia/trava";
import { checar, secao, tique } from "./util";

/** Web Locks de mentira: uma fila por nome; `ifAvailable` devolve lock null se alguém está com ela. */
function locksFalsos(): GerenteDeTravas {
  const ocupados = new Set<string>();
  const caudas = new Map<string, Promise<void>>();
  const adquirir = (nome: string, fn: (lock: unknown) => Promise<unknown>) => {
    const antes = caudas.get(nome) ?? Promise.resolve();
    let soltar: () => void = () => undefined;
    const minha = new Promise<void>((ok) => {
      soltar = ok;
    });
    caudas.set(
      nome,
      antes.then(() => minha),
    );
    return antes.then(async () => {
      ocupados.add(nome);
      try {
        return await fn({ name: nome });
      } finally {
        ocupados.delete(nome);
        soltar();
      }
    });
  };
  return {
    request(nome: string, a: unknown, b?: unknown) {
      const fn = (typeof a === "function" ? a : b) as (lock: unknown) => Promise<unknown>;
      const opcoes = (typeof a === "function" ? {} : a) as { ifAvailable?: boolean };
      if (opcoes.ifAvailable && ocupados.has(nome)) return Promise.resolve(fn(null));
      return adquirir(nome, fn);
    },
  } as unknown as GerenteDeTravas;
}

export async function verificarTravaEConsentimento(): Promise<void> {
  secao("trava: SEI em HTTP (sem Web Locks)");
  checar("sem locks, roda direto", (await travarComLocks("t", async () => 7, null)) === 7);
  checar("esperando, sem locks, tambem roda", (await travarEsperando("t", async () => 8, null)) === 8);

  secao("trava: com Web Locks");
  const locks = locksFalsos();
  let soltar: () => void = () => undefined;
  const ordem: string[] = [];
  const primeira = travarComLocks(
    "seipro-teste-sync|k",
    () =>
      new Promise<string>((ok) => {
        ordem.push("rodada");
        soltar = () => ok("feito");
      }),
    locks,
  );
  await tique();
  let rodouSegunda = false;
  const segunda = await travarComLocks(
    "seipro-teste-sync|k",
    async () => {
      rodouSegunda = true;
      return 1;
    },
    locks,
  );
  checar("outra aba com a trava: devolve null e nao roda", segunda === null && !rodouSegunda);
  checar("outro nome nao espera", (await travarComLocks("seipro-teste-sync|outra", async () => 2, locks)) === 2);
  const apagar = travarEsperando(
    "seipro-teste-sync|k",
    async () => {
      ordem.push("apagar");
      return true;
    },
    locks,
  );
  await tique();
  checar("esperando: so roda depois da rodada em curso", ordem.join() === "rodada");
  soltar();
  checar("e entao roda", (await primeira) === "feito" && (await apagar) === true && ordem.join() === "rodada,apagar");
  checar("livre de novo", (await travarComLocks("seipro-teste-sync|k", async () => 3, locks)) === 3);

  secao("consentimento: chave por SEI, login, unidade (e texto)");
  checar("formato dos Favoritos", chaveConsentimento("sei.x.gov.br", " Pedro.Soares ", "110") === "sei.x.gov.br|pedro.soares|110");
  checar("com o texto (Projetos)", chaveConsentimento("sei.x.gov.br", "pedro", "110", "eu") === "sei.x.gov.br|pedro|110|eu");
  checar("sem nada gravado: nao perguntado", estadoConsentimento(undefined, "k") === "nao-perguntado");
  checar("do mapa", estadoConsentimento({ k: "ligado" }, "k") === "ligado");

  secao("consentimento: na area de preferencias");
  const area = areaMemoria({ "teste/preferencias": { recolhido: true } });
  const k = chaveConsentimento("sei.x.gov.br", "pedro", "110", "unidade");
  await definirConsentimento(area, "teste/preferencias", "textoPadrao", k, "ligado");
  const prefs = (await area.obter("teste/preferencias"))["teste/preferencias"] as {
    recolhido?: boolean;
    textoPadrao?: Record<string, string>;
  };
  checar("grava so a chave e mantem as outras preferencias", prefs.recolhido === true && prefs.textoPadrao?.[k] === "ligado", prefs);
  checar("le de volta", (await lerConsentimento(area, "teste/preferencias", "textoPadrao", k)) === "ligado");
  const outras = [
    chaveConsentimento("sei.x.gov.br", "pedro", "110", "eu"),
    chaveConsentimento("sei.x.gov.br", "pedro", "111", "unidade"),
    chaveConsentimento("sei.x.gov.br", "ana", "110", "unidade"),
    chaveConsentimento("sei.y.gov.br", "pedro", "110", "unidade"),
  ];
  const estados = await Promise.all(outras.map((c) => lerConsentimento(area, "teste/preferencias", "textoPadrao", c)));
  checar(
    "outro texto, unidade, login ou SEI nao herda o ligado",
    estados.every((e) => e === "nao-perguntado"),
    estados,
  );
  const lixo = areaMemoria({ "teste/preferencias": "corrompido" });
  checar(
    "preferencias corrompidas: nao perguntado",
    (await lerConsentimento(lixo, "teste/preferencias", "textoPadrao", k)) === "nao-perguntado",
  );

  secao("consentimento: porta");
  const porta = consentimentoNaArea({ area, chavePreferencias: "teste/preferencias", campo: "textoPadrao", chave: k });
  let avisos = 0;
  const parar = porta.aoMudar(() => {
    avisos++;
  });
  await area.gravar({ "outra/chave": 1 });
  checar("mudanca em outra chave nao avisa", avisos === 0);
  await porta.definir("desligado");
  checar("definir avisa e grava", avisos === 1 && (await porta.estado()) === "desligado");
  parar();
  await porta.definir("ligado");
  checar("depois de parar, nao avisa mais", avisos === 1);
}
