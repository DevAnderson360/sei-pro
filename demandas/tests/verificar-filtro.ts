import { chaveResponsavel, EU, filtrar, SEM_RESPONSAVEL } from "../src/modelo/filtro";
import { demanda, HOJE } from "./fabrica";
import { checar, secao } from "./util";

export function verificarFiltro(): void {
  const eu = { login: "ana", nome: "Ana Lima" };
  const ctx = { hoje: HOJE, eu };
  const lista = [
    demanda({
      id: "1",
      titulo: "Nota técnica de AIR",
      responsavel: { login: "ana", nome: "Ana Lima" },
      prazo: "2026-10-05",
      etiquetas: ["AIR"],
      prioridade: "urgente",
    }),
    demanda({
      id: "2",
      titulo: "Parecer",
      responsavel: { nome: "Carla Dias" },
      prazo: "2026-10-14",
      processos: [{ protocolo: "50300.001234/2026-11" }],
    }),
    demanda({ id: "3", titulo: "Sem dono", prazo: "2026-12-01" }),
    demanda({ id: "4", titulo: "Velha", concluidaEm: "2026-09-10", arquivadoEm: 9 }),
  ];
  const ids = (l: readonly { id: string }[]) => l.map((d) => d.id).join(",");

  secao("Filtro");
  checar("arquivadas ficam de fora por padrao", ids(filtrar(lista, {}, ctx)) === "1,2,3");
  checar("mostrarArquivadas inclui", ids(filtrar(lista, { mostrarArquivadas: true }, ctx)) === "1,2,3,4");
  checar("so minhas", ids(filtrar(lista, { responsaveis: [EU] }, ctx)) === "1");
  checar("sem responsavel", ids(filtrar(lista, { responsaveis: [SEM_RESPONSAVEL] }, ctx)) === "3");
  checar("OU dentro do campo", ids(filtrar(lista, { responsaveis: [EU, SEM_RESPONSAVEL] }, ctx)) === "1,3");
  checar(
    "responsavel sem login casa pelo nome",
    ids(filtrar(lista, { responsaveis: [chaveResponsavel({ nome: "Carla Dias" })] }, ctx)) === "2",
  );
  checar("atrasadas", ids(filtrar(lista, { prazo: "atrasadas" }, ctx)) === "1");
  checar("esta semana (ate 7 dias)", ids(filtrar(lista, { prazo: "semana" }, ctx)) === "2");
  checar("etiqueta", ids(filtrar(lista, { etiquetas: ["air"] }, ctx)) === "1");
  checar("prioridade", ids(filtrar(lista, { prioridades: ["urgente"] }, ctx)) === "1");
  checar("busca no titulo sem olhar acento e caixa", ids(filtrar(lista, { busca: "tecnica" }, ctx)) === "1");
  checar("busca no numero do processo", ids(filtrar(lista, { busca: "001234" }, ctx)) === "2");
  checar("E entre campos", ids(filtrar(lista, { responsaveis: [EU], prioridades: ["normal"] }, ctx)) === "");
}
