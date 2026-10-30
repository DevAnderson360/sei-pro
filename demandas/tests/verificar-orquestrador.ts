import { areaMemoria } from "@comum/armazenamento/area";
import type { ArmazemTexto } from "@comum/sincronia/controlePagina";
import { gerarConteudoTexto, lerConteudoTexto } from "@comum/sincronia/textoPadraoCodec";
import { escoposDaUnidade } from "../src/modelo/escopo";
import { RepositorioDemandas } from "../src/repositorio";
import { consentimentoDemandas } from "../src/sincronia/consentimento";
import { SincroniaDemandas, TABELAS } from "../src/sincronia/orquestrador";
import { nomeDoTexto } from "../src/sincronia/textoPadrao";
import { T0 } from "./apoioRepositorio";
import { C } from "./fabrica";
import { checar, secao } from "./util";

/** O "SEI": um Map nome -> HTML. `falharAoGravar` simula o SEI recusando um texto (ex.: grande demais). */
function seiFalso() {
  const textos = new Map<string, string>();
  const falhar = new Set<string>();
  const armazem = (nome: string): ArmazemTexto => ({
    ler: async () => textos.get(nome) ?? null,
    gravar: async (h) => {
      if (falhar.has(nome)) throw new Error("O SEI recusou");
      textos.set(nome, h);
    },
    excluir: async () => textos.delete(nome),
  });
  return { textos, falhar, armazem };
}

const dev = (dispositivo: string) => ({ ...C, dispositivo });
const travar = async <T>(_n: string, fn: () => Promise<T>) => fn();

export async function verificarOrquestrador(): Promise<void> {
  const host = "sei.exemplo.gov.br";
  const E = escoposDaUnidade(host, "ana", "110000001");
  const sei = seiFalso();
  const montar = (login: string, dispositivo: string) => {
    const area = areaMemoria();
    const sync = areaMemoria();
    const esc = escoposDaUnidade(host, login, "110000001");
    let t = T0;
    const proximo = () => {
      t += 1000;
      return t;
    };
    const repos = {
      unidade: new RepositorioDemandas(area, esc.unidade, () => ({ ...dev(dispositivo), por: login, agora: proximo() })),
      eu: new RepositorioDemandas(area, esc.eu, () => ({ ...dev(dispositivo), por: login, agora: proximo() })),
    };
    const s = new SincroniaDemandas({
      host,
      login,
      nomeUsuario: login,
      unidade: { id: "110000001", sigla: "SUPAC" },
      area,
      sync,
      repos,
      armazem: (vis, tabela) => sei.armazem(nomeDoTexto(vis, login, tabela)),
      travar,
      travarEsperando: travar,
      atrasoEnvio: 3_600_000, // o envio agendado nunca dispara no teste: quem sincroniza e o agora()
    });
    return { area, sync, repos, s };
  };
  const A = montar("ana", "dev-a");
  const B = montar("bia", "dev-b");
  await consentimentoDemandas(A.sync, host, "ana", "110000001", "unidade").definir("ligado");
  await consentimentoDemandas(B.sync, host, "bia", "110000001", "unidade").definir("ligado");

  secao("Tres textos por escopo");
  checar("as tres tabelas existem", TABELAS.join() === "d,a,h");
  await A.repos.unidade.criar({ titulo: "Da Ana", prazo: "2026-10-20", distribuidaEm: "2026-10-01" });
  const r = await A.s.agora();
  checar("o texto da unidade tem tres status, nenhum em erro", !!r.unidade && TABELAS.every((t) => r.unidade![t].estado !== "erro"));
  checar("o pessoal desligado nao roda", r.eu === null);
  checar(
    "o SEI recebeu os textos d e h; o a nao existe enquanto nao ha arquivada (o motor nao cria texto vazio)",
    sei.textos.has("[_SEIPRO_DEM_UNIDADE_D]") && sei.textos.has("[_SEIPRO_DEM_UNIDADE_H]") && !sei.textos.has("[_SEIPRO_DEM_UNIDADE_A]"),
  );

  secao("O colega recebe");
  await B.s.agora();
  checar(
    "a Bia ve a demanda da Ana",
    (await B.repos.unidade.dados()).some((d) => d.titulo === "Da Ana"),
  );

  secao("Uma tabela que falha nao bloqueia as outras (historico grande demais)");
  sei.falhar.add("[_SEIPRO_DEM_UNIDADE_H]");
  await A.repos.unidade.criar({ titulo: "Segunda", prazo: "2026-10-21", distribuidaEm: "2026-10-01" });
  const r2 = await A.s.agora();
  checar("o historico deu erro", r2.unidade?.h.estado === "erro");
  checar("as demandas sincronizaram mesmo assim", r2.unidade?.d.estado === "ok");
  const lido = await lerConteudoTexto(sei.textos.get("[_SEIPRO_DEM_UNIDADE_D]")!);
  checar("e o texto d tem as duas", "bruto" in lido && (lido.bruto as { entidades: { d: unknown[] } }).entidades.d.length === 2);
  sei.falhar.clear();

  secao("Texto editado a mao nao apaga dados locais nem e sobrescrito as cegas");
  sei.textos.set("[_SEIPRO_DEM_UNIDADE_D]", "<p>alguem digitou isto</p>");
  const antes = (await A.repos.unidade.dados()).length;
  const r3 = await A.s.agora();
  const depois = (await A.repos.unidade.dados()).length;
  checar("os dados locais continuam", antes === 2 && depois === 2);
  checar(
    "o texto invalido foi regravado e a copia guardada",
    r3.unidade?.d.estado === "ok" && Object.keys(await A.area.obter(null)).some((k) => k.startsWith("demandas/sync/substituido/")),
  );

  secao("Texto de versao mais nova nao e tocado");
  const novo = await gerarConteudoTexto("x", { formato: "seipro-demandas", versao: 99, tabela: "d" });
  sei.textos.set("[_SEIPRO_DEM_UNIDADE_D]", novo);
  const r4 = await A.s.agora();
  checar("fica exatamente como estava", sei.textos.get("[_SEIPRO_DEM_UNIDADE_D]") === novo);
  void r4;

  secao("Escopo pessoal: so com consentimento");
  await consentimentoDemandas(A.sync, host, "ana", "110000001", "eu").definir("ligado");
  await A.repos.eu.criar({ titulo: "So minha", prazo: "2026-10-22", distribuidaEm: "2026-10-01" });
  const r5 = await A.s.agora();
  checar("com consentimento o pessoal roda", !!r5.eu && r5.eu.d.estado === "ok");
  checar("o texto pessoal leva o login", sei.textos.has("[_SEIPRO_DEM_ana_D]"));
  checar("apagarPessoal exclui os textos e devolve true", (await A.s.apagarPessoal()) === true && !sei.textos.has("[_SEIPRO_DEM_ana_D]"));
  A.s.parar();
  B.s.parar();
  void E;
}
