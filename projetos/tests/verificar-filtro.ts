import { SEM_FASE } from "../src/modelo/constantes";
import {
  chaveResponsavel,
  contarChips,
  criteriosAtivos,
  ehMinha,
  FILTRO_VAZIO,
  filtrarEtapas,
  filtroNoContexto,
  filtroVazio,
} from "../src/modelo/filtro";
import { etapa, HOJE } from "./fabrica";
import { checar, secao } from "./util";

export function verificarFiltro(): void {
  secao("projetos: filtro das etapas");
  const eu = { login: "ana", nome: "Ana Lima" };
  const lista = [
    etapa({
      id: "atr",
      inicio: "2026-09-01",
      fim: "2026-10-02",
      responsavel: { login: "ANA", nome: "Ana Lima" },
      fase: "f1",
      etiquetas: ["Licitação"],
    }),
    etapa({ id: "and", inicio: "2026-10-01", fim: "2026-10-20", responsavel: { nome: "Bruno Reis" }, fase: "f1" }),
    etapa({ id: "fut", inicio: "2026-12-01", fim: "2026-12-20", responsavel: { nome: "ana lima" }, fase: "f2", etiquetas: ["TI"] }),
    etapa({ id: "ok", inicio: "2026-09-01", fim: "2026-09-10", concluidaEm: "2026-09-10" }),
    etapa({ id: "rem", inicio: "2026-09-01", fim: "2026-09-10", removidoEm: 3 }),
  ];
  const ids = (f: typeof FILTRO_VAZIO) =>
    filtrarEtapas(lista, f, HOJE, eu)
      .map((e) => e.id)
      .join();
  checar("sem filtro: todas as vivas", ids(FILTRO_VAZIO) === "atr,and,fut,ok");
  checar("chips: OU entre situacoes", ids({ ...FILTRO_VAZIO, situacoes: ["atrasadas", "andamento"] }) === "atr,and");
  checar("ocultar concluidas", ids({ ...FILTRO_VAZIO, mostrarConcluidas: false }) === "atr,and,fut");
  checar("so as minhas: login sem caixa ou nome sem acento", ids({ ...FILTRO_VAZIO, soMinhas: true }) === "atr,fut");
  checar("fase: OU dentro do campo", ids({ ...FILTRO_VAZIO, fases: ["f2", SEM_FASE] }) === "fut,ok");
  checar("etiqueta sem acento e sem caixa", ids({ ...FILTRO_VAZIO, etiquetas: ["licitacao"] }) === "atr");
  checar(
    "E entre campos: fase f1 e responsavel Bruno",
    ids({ ...FILTRO_VAZIO, fases: ["f1"], responsaveis: [chaveResponsavel({ nome: "Bruno Reis" })] }) === "and",
  );
  checar("E entre chip e campo: atrasadas na fase f2 = nenhuma", ids({ ...FILTRO_VAZIO, situacoes: ["atrasadas"], fases: ["f2"] }) === "");
  checar("chave do responsavel por login", chaveResponsavel({ login: "ANA", nome: "x" }) === "login:ana");
  checar("chave do responsavel por nome", chaveResponsavel({ nome: "Álvaro  Souza" }) === "nome:alvaro souza");
  checar("ehMinha sem responsavel", !ehMinha({}, eu));
  checar(
    "criterios ativos",
    criteriosAtivos({ ...FILTRO_VAZIO, situacoes: ["atrasadas", "andamento"], mostrarConcluidas: false, fases: ["f1", "f2"] }) === 4,
  );
  checar("filtro vazio tem 0 criterios", criteriosAtivos(FILTRO_VAZIO) === 0);
  const n = contarChips(lista, HOJE);
  checar("numeros dos chips", n.atrasadas === 1 && n.andamento === 1 && n.proximos30 === 1, n);

  secao("projetos: filtro vazio nao se altera");
  checar(
    "FILTRO_VAZIO congelado, inclusive as listas",
    Object.isFrozen(FILTRO_VAZIO) && Object.isFrozen(FILTRO_VAZIO.situacoes) && Object.isFrozen(FILTRO_VAZIO.etiquetas),
  );
  const f1 = filtroVazio();
  (f1.situacoes as string[]).push("atrasadas");
  checar(
    "filtroVazio devolve um novo a cada chamada",
    filtroVazio().situacoes.length === 0 && f1 !== filtroVazio() && FILTRO_VAZIO.situacoes.length === 0,
  );
  const comFases = { ...filtroVazio(), fases: ["f1", "outra", SEM_FASE] };
  checar(
    "filtro no contexto: so as fases do projeto e Sem fase; no Todos so Sem fase",
    filtroNoContexto(comFases, [{ id: "f1" }, { id: "f2" }]).fases.join() === `f1,${SEM_FASE}` &&
      filtroNoContexto(comFases).fases.join() === SEM_FASE &&
      criteriosAtivos(filtroNoContexto({ ...filtroVazio(), fases: ["outra"] }, [{ id: "f1" }])) === 0,
  );
  checar("sem fase de fora, o mesmo filtro (sem copia)", filtroNoContexto(FILTRO_VAZIO) === FILTRO_VAZIO);
}
