import { areaMemoria } from "@comum/armazenamento/area";
import { gerarConteudoTexto, lerConteudoTexto } from "@comum/sincronia/textoPadraoCodec";
import { NADA_CONHECIDO } from "@projetos/modelo/sigilo";
import { TETOS_ENVELOPE } from "../src/modelo/constantes";
import { arquivar } from "../src/modelo/operacoes";
import { adaptadorDemandas, comOsDoFuturo, nomeDoTexto, validarEnvelope } from "../src/sincronia/textoPadrao";
import { ESCOPO, repoDeTeste, T0 } from "./apoioRepositorio";
import { demanda } from "./fabrica";
import { checar, secao } from "./util";

const NOVA = { titulo: "Nota técnica", prazo: "2026-10-20", distribuidaEm: "2026-10-01" };
const AG = T0 + 30_000;

export async function verificarTextoPadrao(): Promise<void> {
  secao("Nomes dos textos (um por tabela)");
  checar("unidade, tabela d", nomeDoTexto("unidade", "ana", "d") === "[_SEIPRO_DEM_UNIDADE_D]");
  checar(
    "unidade, tabela a e h",
    nomeDoTexto("unidade", "ana", "a") === "[_SEIPRO_DEM_UNIDADE_A]" && nomeDoTexto("unidade", "ana", "h") === "[_SEIPRO_DEM_UNIDADE_H]",
  );
  checar("pessoal leva o login em minusculas", nomeDoTexto("eu", "Ana", "d") === "[_SEIPRO_DEM_ana_D]");
  checar("nome nunca passa de 50 caracteres", nomeDoTexto("eu", "x".repeat(80), "d").length <= 50);
  checar(
    "nomes diferentes por tabela com login longo",
    new Set(["d", "a", "h"].map((t) => nomeDoTexto("eu", "y".repeat(80), t as "d"))).size === 3,
  );

  secao("Validar o envelope lido");
  const { repo } = repoDeTeste();
  await repo.criar(NOVA);
  const env = await repo.exportarTabela("d", AG);
  checar("envelope bom", "ok" in validarEnvelope(env, ESCOPO, "d"));
  checar("outra tabela e invalido", "invalido" in validarEnvelope(env, ESCOPO, "a"));
  checar("outra unidade e invalido", "invalido" in validarEnvelope(env, { ...ESCOPO, unidade: "999" }, "d"));
  checar("outro SEI e invalido", "invalido" in validarEnvelope(env, { ...ESCOPO, host: "outro.gov.br" }, "d"));
  checar("outra visibilidade e invalido", "invalido" in validarEnvelope(env, { ...ESCOPO, vis: "eu" }, "d"));
  checar("versao mais nova nao e invalida", "maisNovo" in validarEnvelope({ ...env, versao: 2 }, ESCOPO, "d"));
  checar("texto qualquer e invalido", "invalido" in validarEnvelope({ qualquer: 1 }, ESCOPO, "d"));
  const demais = { ...env, entidades: { d: Array.from({ length: TETOS_ENVELOPE.d + 1 }, (_, i) => demanda({ id: `x${i}` })), h: [] } };
  checar("itens demais e invalido", "invalido" in validarEnvelope(demais, ESCOPO, "d"));

  secao("Ida e volta entre dois computadores (as tres tabelas)");
  const A = repoDeTeste();
  const B = repoDeTeste({ ...ESCOPO, login: "bia" }, { dispositivo: "dev-b", por: "bia" });
  const d1 = await A.repo.criar(NOVA);
  A.avancar();
  const d2 = await A.repo.criar({ ...NOVA, titulo: "Já entregue" });
  A.avancar();
  await A.repo.aplicar(d2.id, (x, c) => ({
    demanda: { ...x, iniciadaEm: 1, concluidaEm: "2026-10-10", atualizadoEm: c.agora, dispositivo: c.dispositivo },
    registros: [],
  }));
  await A.repo.aplicar(d2.id, arquivar);
  for (const tabela of ["d", "a", "h"] as const) {
    const ad = adaptadorDemandas({ repo: A.repo, area: A.area, tabela, sigla: "SUPAC", nomeUsuario: "Ana Lima" });
    const saiu = await ad.exportar({ remoto: null, agora: AG, invalido: false });
    const html = await gerarConteudoTexto(ad.legivel(), saiu);
    const lido = await lerConteudoTexto(html);
    const bruto = "bruto" in lido ? lido.bruto : null;
    const adB = adaptadorDemandas({ repo: B.repo, area: B.area, tabela, sigla: "SUPAC", nomeUsuario: "Bia" });
    const ok = adB.validar(bruto);
    if ("ok" in ok) await adB.importar(ok.ok);
    checar(`tabela ${tabela}: validou e importou`, "ok" in ok);
  }
  checar(
    "B recebeu as duas demandas",
    (await B.repo.dados())
      .map((d) => d.id)
      .sort()
      .join() === [d1.id, d2.id].sort().join(),
  );
  checar("a arquivada chegou arquivada", (await B.repo.obter(d2.id))?.arquivadoEm !== undefined);
  checar("o historico chegou", (await B.repo.historico(d1.id)).length > 0);

  secao("Cada tabela leva so a sua parte");
  const adD = adaptadorDemandas({ repo: A.repo, area: A.area, tabela: "d", sigla: "S", nomeUsuario: "Ana" });
  const adA = adaptadorDemandas({ repo: A.repo, area: A.area, tabela: "a", sigla: "S", nomeUsuario: "Ana" });
  const eD = await adD.exportar({ remoto: null, agora: AG, invalido: false });
  const eA = await adA.exportar({ remoto: null, agora: AG, invalido: false });
  checar("d so tem a nao arquivada", eD.entidades.d.map((x) => x.id).join() === d1.id);
  checar("a so tem a arquivada", eA.entidades.d.map((x) => x.id).join() === d2.id);
  checar("assinaturas diferem entre tabelas", adD.assinatura(eD) !== adA.assinatura(eA));
  checar("vazio so quando nao ha nada", adD.vazio?.(eD) === false && adD.vazio?.({ ...eD, entidades: { d: [], h: [] } }) === true);

  secao("Sigilo: o numero nunca vai ao texto e nunca se perde na volta");
  const S = repoDeTeste();
  const T = repoDeTeste({ ...ESCOPO, login: "bia" }, { dispositivo: "dev-b", por: "bia" });
  const sd = await S.repo.criar({ ...NOVA, processos: [{ protocolo: "50300.001234/2026-11", idProcedimento: "77" }] });
  await S.repo.marcarSigilosos(["50300.001234/2026-11"]);
  const adS = adaptadorDemandas({ repo: S.repo, area: S.area, tabela: "d", sigla: "S", nomeUsuario: "Ana" });
  const texto = await adS.exportar({ remoto: null, agora: AG, invalido: false });
  checar("o envelope gravado nao tem o numero", !JSON.stringify(texto).includes("001234"));
  checar(
    "o vinculo vai vazio e marcado",
    texto.entidades.d[0]?.processos[0]?.protocolo === "" && texto.entidades.d[0]?.processos[0]?.sigiloso === true,
  );
  checar("o repositorio de origem continua com o numero", (await S.repo.obter(sd.id))?.processos[0]?.protocolo === "50300.001234/2026-11");
  const adT = adaptadorDemandas({ repo: T.repo, area: T.area, tabela: "d", sigla: "S", nomeUsuario: "Bia" });
  await adT.importar(texto);
  S.avancar();
  const editada = { ...(await T.repo.obter(sd.id))!, titulo: "Editada pela Bia", atualizadoEm: T0 + 25_000, dispositivo: "dev-b" };
  await T.repo.importar({ d: [editada], h: [] }, AG);
  const volta = await adT.exportar({ remoto: null, agora: AG, invalido: false });
  await adS.importar(volta);
  const final = (await S.repo.obter(sd.id))!;
  checar("a edicao da Bia chegou", final.titulo === "Editada pela Bia");
  checar("e o numero nao se perdeu", final.processos[0]?.protocolo === "50300.001234/2026-11");
  checar(
    "a memoria do sigilo lembra o numero pela chave em digitos",
    (await S.repo.sigilosConhecidos()).processos.has("50300001234202611"),
  );

  secao("Relogio adiantado de um colega nao apaga o trabalho dele");
  const F = repoDeTeste();
  await F.repo.criar(NOVA);
  const futuro = demanda({ id: "dofuturo", atualizadoEm: AG + 2 * 86_400_000 });
  const remoto = { ...(await F.repo.exportarTabela("d", AG)), entidades: { d: [futuro], h: [] } };
  const levado = comOsDoFuturo(await F.repo.exportarTabela("d", AG), remoto, AG);
  checar(
    "o item do futuro e levado adiante no texto",
    levado.entidades.d.some((x) => x.id === "dofuturo"),
  );
  checar("mas nao entra no repositorio daqui", (await F.repo.obter("dofuturo")) === undefined);
  void areaMemoria;
  void NADA_CONHECIDO;
}
