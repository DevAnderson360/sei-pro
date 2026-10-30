import { arquivar, iniciar } from "../src/modelo/operacoes";
import { situacaoDe } from "../src/modelo/situacao";
import { ErroValidacao } from "../src/modelo/validacao";
import { entidadeValida } from "../src/repositorio";
import { repoDeTeste, T0 } from "./apoioRepositorio";
import { demanda } from "./fabrica";
import { checar, lanca, secao } from "./util";

const NOVA = { titulo: "Nota técnica de AIR", prazo: "2026-10-20", distribuidaEm: "2026-10-01" };
const AGORA = T0 + 20_000;

export async function verificarRepositorio(): Promise<void> {
  secao("Criar");
  const { repo, area, avancar } = repoDeTeste();
  const a = await repo.criar(NOVA);
  checar(
    "cria viva, com ordem e carimbo",
    a.id === "id1" && a.prioridade === "normal" && a.ordem !== "" && a.criadoEm === T0 && a.alteradoPor === "ana",
  );
  avancar();
  const b = await repo.criar({ ...NOVA, titulo: "Parecer" });
  checar(
    "a segunda vem depois pela ordem",
    a.ordem < b.ordem && (await repo.dados()).map((d) => d.titulo).join("|") === "Nota técnica de AIR|Parecer",
  );
  checar(
    "grava o historico de criacao",
    (await repo.historico(a.id)).some((r) => r.campo === "criacao" && r.depois === "Nota técnica de AIR"),
  );
  const invalida = await lanca(() => repo.criar({ ...NOVA, titulo: "  " }));
  checar("titulo vazio lanca ErroValidacao e nao grava", invalida instanceof ErroValidacao && (await repo.dados()).length === 2);
  checar("prazo impossivel recusado", (await lanca(() => repo.criar({ ...NOVA, prazo: "2026-02-30" }))) instanceof ErroValidacao);
  checar("etiquetas sao limpas", (await repo.criar({ ...NOVA, etiquetas: [" AIR ", "air"] })).etiquetas.join() === "AIR");

  secao("Editar e operar");
  avancar();
  const ed = await repo.editar(a.id, { titulo: "Nota técnica revisada", responsavel: { login: "carla", nome: "Carla Dias" } });
  checar("edita e carimba", ed.titulo === "Nota técnica revisada" && ed.atualizadoEm === T0 + 2_000);
  const hist = await repo.historico(a.id);
  checar(
    "registra titulo e responsavel",
    hist.some((r) => r.campo === "titulo" && r.antes === "Nota técnica de AIR") &&
      hist.some((r) => r.campo === "responsavel" && r.depois === "Carla Dias"),
  );
  checar("undefined apaga campo opcional", (await repo.editar(a.id, { responsavel: undefined })).responsavel === undefined);
  checar("editar o que nao existe lanca", (await lanca(() => repo.editar("nao", { titulo: "x" }))) instanceof ErroValidacao);
  checar(
    "editar com dado invalido nao grava",
    (await lanca(() => repo.editar(a.id, { titulo: "" }))) instanceof ErroValidacao &&
      (await repo.obter(a.id))?.titulo === "Nota técnica revisada",
  );
  const it = await repo.aplicar(a.id, iniciar);
  checar(
    "aplicar grava a transicao e o registro",
    situacaoDe(it) === "iniciada" && (await repo.historico(a.id)).some((r) => r.campo === "inicio"),
  );

  secao("Lixeira, duplicar, ordem");
  await repo.remover(b.id);
  checar(
    "remover tira da lista e deixa lapide",
    (await repo.dados()).every((d) => d.id !== b.id) && (await repo.entidades()).d.some((d) => d.id === b.id && d.removidoEm !== undefined),
  );
  checar("restaurar traz de volta", (await repo.restaurar(b.id))?.removidoEm === undefined && (await repo.obter(b.id)) !== undefined);
  const cop = await repo.duplicar(a.id);
  checar("duplicar zera o estado e acrescenta Copia", cop.titulo.startsWith("Cópia de") && cop.iniciadaEm === undefined && cop.id !== a.id);
  await repo.reordenar(cop.id, null, a.id);
  checar("reordenar poe a copia antes da primeira", (await repo.dados())[0]?.id === cop.id);

  secao("Arquivar varias");
  const conc = await repo.aplicar(b.id, (d, c) => ({
    demanda: { ...d, concluidaEm: "2026-10-10", iniciadaEm: 1, atualizadoEm: c.agora, dispositivo: c.dispositivo },
    registros: [],
  }));
  const r = await repo.arquivarVarias([conc.id, a.id, "nao"]);
  checar(
    "arquiva as concluidas e ignora o resto",
    r.arquivadas === 1 && r.ignoradas === 2 && situacaoDe((await repo.obter(conc.id))!) === "arquivada",
  );

  secao("Exportar por tabela");
  const d = await repo.exportarTabela("d", AGORA);
  const arq = await repo.exportarTabela("a", AGORA);
  const h = await repo.exportarTabela("h", AGORA);
  checar(
    "d leva so as nao arquivadas",
    d.entidades.d.every((x) => x.arquivadoEm === undefined) && d.entidades.d.length > 0 && d.entidades.h.length === 0,
  );
  checar("a leva so as arquivadas", arq.entidades.d.length === 1 && arq.entidades.d[0]?.id === conc.id);
  checar("h leva o historico e nenhuma demanda", h.entidades.h.length > 0 && h.entidades.d.length === 0);
  checar(
    "envelope diz formato, tabela e escopo",
    d.formato === "seipro-demandas" && d.tabela === "d" && d.vis === "unidade" && d.unidade === "110000001",
  );

  secao("Importar e mesclar");
  const o = repoDeTeste({ host: "sei.exemplo.gov.br", login: "bia", unidade: "110000001", vis: "unidade" });
  const ri = await o.repo.importar(d.entidades, AGORA);
  checar("importa as de outro computador", ri.novos === d.entidades.d.length && (await o.repo.dados()).length === d.entidades.d.length);
  const velha = demanda({ id: "id1", titulo: "Versão velha", atualizadoEm: 1 });
  const ri2 = await o.repo.importar({ d: [velha], h: [] }, AGORA);
  checar("versao mais velha nao vence", ri2.atualizados === 0 && (await o.repo.obter("id1"))?.titulo !== "Versão velha");
  const futura = demanda({ id: "fut", atualizadoEm: AGORA + 2 * 86_400_000 });
  const ri3 = await o.repo.importar({ d: [futura], h: [] }, AGORA);
  checar("carimbo 2 dias no futuro e recusado e contado", ri3.ignorados === 1 && (await o.repo.obter("fut")) === undefined);
  const ri4 = await o.repo.importar({ d: [{ id: "x" } as never, demanda({ id: "ok2" })], h: [] }, AGORA);
  checar("malformado e recusado, o bom entra", ri4.ignorados === 1 && ri4.novos === 1);

  secao("Arquivada por um colega vence a copia velha nao arquivada");
  const p = repoDeTeste();
  const base = await p.repo.criar(NOVA);
  const antiga = { ...base };
  p.avancar();
  await p.repo.aplicar(base.id, (x, c) => ({
    demanda: { ...x, concluidaEm: "2026-10-10", iniciadaEm: 1, atualizadoEm: c.agora, dispositivo: c.dispositivo },
    registros: [],
  }));
  await p.repo.aplicar(base.id, arquivar);
  await p.repo.importar({ d: [antiga], h: [] }, T0 + 30_000);
  const dPos = await p.repo.exportarTabela("d", T0 + 30_000);
  const aPos = await p.repo.exportarTabela("a", T0 + 30_000);
  checar("continua arquivada", situacaoDe((await p.repo.obter(base.id))!) === "arquivada");
  checar(
    "saiu da tabela d sem lapide e esta na a",
    !dPos.entidades.d.some((x) => x.id === base.id) && aPos.entidades.d.some((x) => x.id === base.id && x.removidoEm === undefined),
  );

  secao("Sigilo: o numero volta a quem o tem");
  const s = repoDeTeste();
  const comProc = await s.repo.criar({ ...NOVA, processos: [{ protocolo: "50300.001234/2026-11", idProcedimento: "77" }] });
  s.avancar();
  const doColega = {
    ...comProc,
    processos: [{ protocolo: "", sigiloso: true as const }],
    atualizadoEm: s.relogio.agora + 5_000,
    titulo: "Editada pelo colega",
  };
  await s.repo.importar({ d: [doColega], h: [] }, s.relogio.agora);
  const depois = (await s.repo.obter(comProc.id))!;
  checar("a edicao do colega entra", depois.titulo === "Editada pelo colega");
  checar(
    "mas o numero sigiloso nao se perde",
    depois.processos[0]?.protocolo === "50300.001234/2026-11" && depois.processos[0]?.sigiloso === true,
  );
  const outra = await s.repo.criar({ ...NOVA, processos: [{ protocolo: "50300.000009/2026-09" }] });
  checar(
    "marcarSigilosos marca os vinculos locais ainda sem marca",
    (await s.repo.marcarSigilosos(["50300.000009/2026-09"])) === 1 && (await s.repo.obter(outra.id))?.processos[0]?.sigiloso === true,
  );

  secao("Validade de entidade importada");
  checar("demanda boa e valida", entidadeValida(demanda({ id: "a" }), "d"));
  checar("sem carimbo e invalida", !entidadeValida({ ...demanda({ id: "a" }), atualizadoEm: undefined }, "d"));
  checar("ordem torta e invalida", !entidadeValida({ ...demanda({ id: "a" }), ordem: "###" }, "d"));
  checar("lista de etiquetas que nao e lista e invalida", !entidadeValida({ ...demanda({ id: "a" }), etiquetas: "x" }, "d"));
  checar(
    "registro de relogio quebrado e invalido",
    !entidadeValida({ id: "r", demanda: "a", quando: 5, por: "x", campo: "criacao", atualizadoEm: 1, dispositivo: "d" }, "h"),
  );
  void area;
}
