import { areaMemoria } from "@comum/armazenamento/area";
import { ErroModelo, RepositorioModelos } from "../src/modelos";
import type { Parametros } from "../src/repositorio";
import { checar, igual, lanca, secao } from "./util";

const ESCOPO = "sei.exemplo.gov.br|ana";
const PREFIXO = `lote/modelos/${ESCOPO}/`;

function parametros(idTipo = "100"): Parametros {
  return { idTipo, nomeTipo: `Tipo ${idTipo}`, nivelAcesso: "1", hipoteseLegal: "7", nomeHipotese: "Controle Interno", pausa: 800 };
}

export async function verificarModelos(): Promise<void> {
  secao("RepositorioModelos");
  const area = areaMemoria();
  let relogio = 1000;
  const repo = new RepositorioModelos(area, ESCOPO, () => relogio);
  igual("vazio lista []", await repo.listar(), []);

  const m = await repo.salvar("  Contratos  ", parametros());
  igual("salvar devolve o nome sem espaços", m.nome, "Contratos");
  igual("salvar guarda só os parâmetros", m.parametros, parametros());
  checar("salvar dá id", typeof m.id === "string" && m.id.length > 0);
  igual("criadoEm do relógio", m.criadoEm, 1000);
  checar("chave lote/modelos/<escopo>/<id>", `${PREFIXO}${m.id}` in (await area.obter()));
  igual("ida e volta", await repo.listar(), [m]);

  // Linhas (ou qualquer campo a mais) nunca entram no modelo.
  const comLixo = { ...parametros("200"), linhas: [{ especificacao: "x" }] } as unknown as Parametros;
  const semLinhas = await repo.salvar("Licitações", comLixo);
  checar("salvar não guarda campo fora de Parametros", !("linhas" in (semLinhas.parametros as object)), semLinhas.parametros);

  relogio = 2000;
  const subst = await repo.salvar("contratos", parametros("300"));
  igual("mesmo nome (sem caixa) substitui: mesmo id", subst.id, m.id);
  const lista = await repo.listar();
  igual("substituído: continuam dois", lista.length, 2);
  igual("substituído: novos parâmetros", lista.find((x) => x.id === m.id)?.parametros.idTipo, "300");
  igual("substituído: novo nome", lista.find((x) => x.id === m.id)?.nome, "contratos");
  const acento = await repo.salvar("LICITACOES", parametros("400"));
  igual("mesmo nome (sem acento) substitui", acento.id, semLinhas.id);

  await repo.salvar("Ágil", parametros("500"));
  await repo.salvar("banco", parametros("600"));
  igual(
    "listar por nome, sem acento/caixa",
    (await repo.listar()).map((x) => x.nome),
    ["Ágil", "banco", "contratos", "LICITACOES"],
  );

  checar("nome vazio lança ErroModelo", (await lanca(() => repo.salvar("   ", parametros()))) instanceof ErroModelo);
  checar("nome com 81 caracteres lança ErroModelo", (await lanca(() => repo.salvar("a".repeat(81), parametros()))) instanceof ErroModelo);
  checar("nome com 80 caracteres passa", (await lanca(() => repo.salvar("b".repeat(80), parametros()))) === null);

  // posAcoes vai e volta (preenchido na Task 21).
  const pos = await repo.salvar("Com ações", parametros(), { marcador: { id: "1", nome: "Urgente", texto: "t" } });
  igual("posAcoes ida e volta", (await repo.listar()).find((x) => x.id === pos.id)?.posAcoes, {
    marcador: { id: "1", nome: "Urgente", texto: "t" },
  });

  secao("RepositorioModelos: definirPosAcoes (Task 21)");
  {
    const r = new RepositorioModelos(areaMemoria(), ESCOPO, () => 5);
    const alvo = await r.salvar("Alvo", parametros());
    const acoes = { acompanhar: { grupo: "", nomeGrupo: "", observacao: "ver" }, bloco: { id: "9", descricao: "Bloco 12" } };
    const def = await r.definirPosAcoes(alvo.id, acoes);
    igual("definirPosAcoes devolve o modelo com as ações", def?.posAcoes, acoes);
    const lido = (await r.listar())[0];
    igual("ações gravadas", lido?.posAcoes, acoes);
    igual("parâmetros e nome intactos", [lido?.nome, lido?.parametros], ["Alvo", parametros()]);
    const limpo = await r.definirPosAcoes(alvo.id, {});
    checar("ações vazias tiram o campo", !!limpo && !("posAcoes" in limpo) && !("posAcoes" in ((await r.listar())[0] ?? {})));
    igual("modelo que não existe mais devolve null", await r.definirPosAcoes("nao-existe", acoes), null);
  }

  secao("RepositorioModelos: renomear e apagar");
  const ren = await repo.renomear(m.id, "Contratos 2026");
  igual("renomear devolve o novo nome", ren?.nome, "Contratos 2026");
  igual("renomear mantém os parâmetros", ren?.parametros.idTipo, "300");
  igual("renomear id inexistente devolve null", await repo.renomear("nao-existe", "X"), null);
  checar("renomear para nome de outro modelo lança", (await lanca(() => repo.renomear(m.id, "banco"))) instanceof ErroModelo);
  checar("renomear para o próprio nome (outra caixa) passa", (await repo.renomear(m.id, "CONTRATOS 2026"))?.nome === "CONTRATOS 2026");
  checar("renomear para nome vazio lança", (await lanca(() => repo.renomear(m.id, ""))) instanceof ErroModelo);
  checar("apagar devolve true", (await repo.apagar(m.id)) === true);
  checar("apagado some da lista", !(await repo.listar()).some((x) => x.id === m.id));
  checar("apagar id inexistente devolve false", (await repo.apagar(m.id)) === false);

  secao("RepositorioModelos: leitura defensiva e escopos");
  const ruins = areaMemoria({
    [`${PREFIXO}a`]: 42,
    [`${PREFIXO}b`]: { id: "b", nome: "Sem parâmetros", criadoEm: 1 },
    [`${PREFIXO}c`]: { id: "c", nome: "", criadoEm: 1, parametros: parametros() },
    [`${PREFIXO}d`]: { id: "d", nome: "Nível ruim", criadoEm: 1, parametros: { ...parametros(), nivelAcesso: "2" } },
    [`${PREFIXO}e`]: { id: "e", nome: "Pausa NaN", criadoEm: 1, parametros: { ...parametros(), pausa: Number.NaN } },
    [`${PREFIXO}f`]: { id: "f", nome: "Bom", criadoEm: 1, parametros: parametros() },
    [`${PREFIXO}g/h`]: { id: "g/h", nome: "Outro escopo aninhado", criadoEm: 1, parametros: parametros() },
    [`lote/${ESCOPO}/atual`]: { id: "lote" },
  });
  const def = new RepositorioModelos(ruins, ESCOPO);
  igual(
    "só o modelo bom é lido",
    (await def.listar()).map((x) => x.nome),
    ["Bom"],
  );
  // Sem `chaves()` (navegador antigo): cai no obter(null).
  const { chaves: _semChaves, ...semGetKeys } = ruins;
  igual(
    "sem chaves(): mesmo resultado",
    (await new RepositorioModelos(semGetKeys, ESCOPO).listar()).map((x) => x.nome),
    ["Bom"],
  );

  // posAcoes com forma errada: o membro ruim some, o modelo continua; nada lança.
  const pa = (posAcoes: unknown) => ({ id: "p", nome: "P", criadoEm: 1, parametros: parametros(), posAcoes });
  const lerPos = async (posAcoes: unknown) =>
    (await new RepositorioModelos(areaMemoria({ [`${PREFIXO}p`]: pa(posAcoes) }), ESCOPO).listar())[0];
  igual("posAcoes não-objeto: ausente", (await lerPos("x"))?.posAcoes, undefined);
  igual("posAcoes array: ausente", (await lerPos([1]))?.posAcoes, undefined);
  igual("posAcoes vazio: ausente", (await lerPos({}))?.posAcoes, undefined);
  igual(
    "posAcoes: membro sem campo de texto some, o bom fica",
    (await lerPos({ marcador: { id: 1, nome: "x", texto: "t" }, bloco: { id: "9", descricao: "B", extra: 1 } }))?.posAcoes,
    { bloco: { id: "9", descricao: "B" } },
  );
  igual(
    "posAcoes: acompanhar válido lido",
    (await lerPos({ acompanhar: { grupo: "g", nomeGrupo: "G", observacao: "" }, marcador: null }))?.posAcoes,
    { acompanhar: { grupo: "g", nomeGrupo: "G", observacao: "" } },
  );
  checar("posAcoes ruim não derruba o modelo", (await lerPos({ marcador: "x" }))?.nome === "P");
  const salvoRuim = await new RepositorioModelos(areaMemoria(), ESCOPO).salvar("R", parametros(), { marcador: { id: "1" } } as never);
  igual("salvar com posAcoes ruim: não grava o membro ruim", salvoRuim.posAcoes, undefined);

  const outra = new RepositorioModelos(area, "sei.exemplo.gov.br|bia");
  igual("outro escopo começa vazio", await outra.listar(), []);
  await outra.salvar("Contratos 2026", parametros());
  checar(
    "escopos isolados",
    (await repo.listar()).every((x) => x.nome !== "Contratos 2026"),
  );
  igual("outro escopo vê o seu", (await outra.listar()).length, 1);

  secao("RepositorioModelos: gravações sobrepostas e fila");
  const conc = new RepositorioModelos(areaMemoria(), ESCOPO);
  await Promise.all([conc.salvar("Um", parametros("1")), conc.salvar("Dois", parametros("2")), conc.salvar("Três", parametros("3"))]);
  igual(
    "três salvar simultâneos persistem os três",
    (await conc.listar()).map((x) => x.nome),
    ["Dois", "Três", "Um"],
  );
  const mesmoNome = new RepositorioModelos(areaMemoria(), ESCOPO);
  await Promise.all([mesmoNome.salvar("Igual", parametros("1")), mesmoNome.salvar("igual", parametros("2"))]);
  igual("dois salvar simultâneos com o mesmo nome: um só modelo", (await mesmoNome.listar()).length, 1);

  const base = areaMemoria();
  let falhar = true;
  const aposErro = new RepositorioModelos(
    { ...base, gravar: (i) => (falhar ? Promise.reject(new Error("falha")) : base.gravar(i)) },
    ESCOPO,
  );
  checar("erro de armazenamento chega a quem chamou", (await lanca(() => aposErro.salvar("X", parametros()))) !== null);
  falhar = false;
  await aposErro.salvar("X", parametros());
  igual("fila segue viva após erro", (await aposErro.listar()).length, 1);

  for (const ruim of ["", "|", "host|", "|login", "semBarra"]) {
    checar(`escopo inválido "${ruim}" lança`, (await lanca(() => new RepositorioModelos(areaMemoria(), ruim))) !== null);
  }
}
