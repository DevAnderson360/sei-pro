import { processoDaLeitura, tituloSessao } from "../src/painel/nome-sessao";
import { estadoRetomavel, gravarVarias, obter, salvar, todas, VERSAO_ESTADO_CONVERSA, type ConversaSalva, type EstadoConversa } from "../src/painel/historico";
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
  execucoesAuxiliares: [{ id: "aux-1", tarefa: "ler", modelo: "mini", inicioEm: 1, fimEm: 2, estado: "sucesso", uso, resumo: "feito" }],
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
  const antigoSemExecucoes = { ...estado, execucoesAuxiliares: undefined } as EstadoConversa;
  checar("estado anterior sem execucoes auxiliares continua abrindo", estadoRetomavel({ ...base, versaoEstado: VERSAO_ESTADO_CONVERSA, estado: antigoSemExecucoes }) === antigoSemExecucoes);
  checar("execucoes auxiliares sao preservadas", estadoRetomavel({ ...base, versaoEstado: VERSAO_ESTADO_CONVERSA, estado })?.execucoesAuxiliares?.[0].resumo === "feito");
  checar(
    "estado incompleto nao pode ser retomado",
    estadoRetomavel({ ...base, versaoEstado: VERSAO_ESTADO_CONVERSA, estado: { ...estado, tarefas: undefined } as unknown as EstadoConversa }) === null,
  );
}

export function verificarNomeSessao(): void {
  secao("historico: nomes por processo");
  const processo = "2026/000046709-00";
  checar("prefixo completo", tituloSessao("Me situe", { processo }) === `${processo} — Me situe`);
  checar("sem processo conserva comportamento", tituloSessao("Me   situe") === "Me situe");
  checar("limita descricao a 70 caracteres", tituloSessao("x".repeat(90), { processo }) === `${processo} — ${"x".repeat(70)}`);
  checar("nao duplica prefixo", tituloSessao(`${processo} Pedido`, { processo }) === `${processo} Pedido`);
  checar("titulo antigo preservado", tituloSessao("Novo pedido", { tituloOriginal: "Titulo antigo", processo }) === "Titulo antigo");
  checar("consulta usa protocolo retornado", processoDaLeitura("processo.consultar", { protocolo: processo }) === processo);
  checar("arvore usa protocolo retornado", processoDaLeitura("processo.arvore", { protocolo: processo }) === processo);
  checar("documento usa processo retornado", processoDaLeitura("documento.ler", { processo }) === processo);
  checar("pesquisa geral nao associa processo", processoDaLeitura("pesquisar", { protocolo: processo }) === undefined);
  checar("resultado sem identificacao nao associa", processoDaLeitura("documento.ler", {}) === undefined);
  checar("resultado nulo nao associa", processoDaLeitura("processo.consultar", null) === undefined);
  const comNome = { ...estado, nomeSessao: { processo }, idConversa: "conversa-1" };
  const restaurado = estadoRetomavel({ ...base, versaoEstado: VERSAO_ESTADO_CONVERSA, estado: JSON.parse(JSON.stringify(comNome)) });
  checar("metadados sobrevivem a serializacao e retomada", restaurado?.nomeSessao?.processo === processo && restaurado.idConversa === "conversa-1");
}

/** Executa as operacoes reais de persistencia com um IndexedDB em memoria. */
export async function verificarHistoricoBackup(): Promise<void> {
  secao("historico: backup preserva o estado retomavel sem rede");
  const anterior = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  const fetchAnterior = globalThis.fetch;
  let rede = 0;
  const lojas = new Map<string, Map<string, Record<string, unknown>>>();
  const pedido = (result: unknown) => {
    const r = { result, onsuccess: null as (() => void) | null };
    queueMicrotask(() => r.onsuccess?.());
    return r;
  };
  const banco = {
    close: () => undefined,
    transaction: () => {
      const t = {
        oncomplete: null as (() => void) | null,
        objectStore: (nome: string) => {
          if (!lojas.has(nome)) lojas.set(nome, new Map());
          const dados = lojas.get(nome)!;
          return {
            put: (valor: Record<string, unknown>) => dados.set(String(valor.id), structuredClone(valor)),
            get: (id: string) => pedido(structuredClone(dados.get(id))),
            getAll: () => pedido(structuredClone([...dados.values()])),
            delete: (id: string) => dados.delete(id),
          };
        },
      };
      setTimeout(() => t.oncomplete?.(), 0);
      return t;
    },
  };
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: { open: () => pedido(banco) } });
  globalThis.fetch = async () => { rede++; throw new Error("Historico nao usa rede"); };
  try {
    const conversa: ConversaSalva = { ...base, estado: { ...estado, envelope: "a1b2c3d4" }, itens: estado.transcricao };
    await salvar(conversa);
    const backup = await todas();
    checar("exportacao local leva mensagens, pseudonimos e envelope", JSON.stringify(backup[0]?.estado) === JSON.stringify(conversa.estado));
    await gravarVarias([{ ...backup[0]!, id: "importada" }], [base.id]);
    const importada = await obter("importada");
    checar("importacao conserva o estado retomavel", importada !== null && estadoRetomavel(importada)?.envelope === "a1b2c3d4");
    checar("conversa removida nao reaparece", await obter(base.id) === null);
    checar("ler e importar nao chamam a IA", rede === 0);
  } finally {
    globalThis.fetch = fetchAnterior;
    if (anterior) Object.defineProperty(globalThis, "indexedDB", anterior);
    else Reflect.deleteProperty(globalThis, "indexedDB");
  }
}
