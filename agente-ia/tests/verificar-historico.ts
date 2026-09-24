import { estadoRetomavel, VERSAO_ESTADO_CONVERSA, type ConversaSalva, type EstadoConversa } from "../src/painel/historico";
import { checar, secao } from "./util";

const uso = { entrada: 0, saida: 0, total: 0, custo: 0, cache: 0, gravacaoCache: 0, raciocinio: 0 };

const base: ConversaSalva = {
  id: "conversa-1",
  titulo: "Conversa",
  quando: 1,
  uso,
  mensagens: 2,
  itens: [],
};

const estado: EstadoConversa = {
  versao: VERSAO_ESTADO_CONVERSA,
  historico: [{ role: "user", content: "pedido" }],
  transcricao: [{ tipo: "usuario", texto: "pedido" }],
  uso,
  registrosUso: [],
  pseudonimos: { valores: [], rotulos: [], contadores: [], pessoas: [] },
  tarefas: [],
};

export function verificarHistorico(): void {
  secao("historico: retomada compativel");
  checar("registro antigo continua somente leitura", estadoRetomavel(base) === null);
  checar(
    "marcador sem estado nao libera a conversa",
    estadoRetomavel({ ...base, versaoEstado: VERSAO_ESTADO_CONVERSA }) === null,
  );
  checar(
    "estado versionado pode ser retomado",
    estadoRetomavel({ ...base, versaoEstado: VERSAO_ESTADO_CONVERSA, estado }) === estado,
  );
  checar(
    "estado incompleto nao pode ser retomado",
    estadoRetomavel({ ...base, versaoEstado: VERSAO_ESTADO_CONVERSA, estado: { ...estado, tarefas: undefined } as unknown as EstadoConversa }) === null,
  );
}
