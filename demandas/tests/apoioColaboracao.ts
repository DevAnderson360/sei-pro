/** O app de teste com a colaboração ligada: RPC, arquivo e cópias falsos, consentimento no `sync` em memória. */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import type { StatusArquivo } from "@comum/sincronia/arquivo";
import { type ArmazemCopias, copiasEmMemoria } from "@comum/sincronia/copias";
import type { StatusSync } from "@comum/sincronia/motor";
import { type ArquivoLigado, Colaboracao } from "../src/app/colaboracao";
import { escoposDaUnidade } from "../src/modelo/escopo";
import type { Tabela, Vis } from "../src/modelo/tipos";
import type { EnvelopeArquivo } from "../src/sincronia/arquivo";
import { consentimentoDemandas } from "../src/sincronia/consentimento";
import { estadoDasTabelas } from "../src/sincronia/orquestrador";
import { chaveStatusTexto } from "../src/sincronia/textoPadrao";
import { appDeTeste, type Teste } from "./apoioApp";
import { HOJE } from "./fabrica";

export interface OpcoesColab {
  sync?: Area;
  copias?: boolean;
  arquivo?: ArquivoLigado | null;
  /** O que o RPC `sincronizarAgora` devolve. */
  resposta?: unknown;
  apagou?: boolean;
  /** Operações do RPC que falham: op -> mensagem. */
  falhar?: Record<string, string>;
}

export function colabDeTeste(o: OpcoesColab = {}) {
  const t = appDeTeste();
  const sync = o.sync ?? areaMemoria();
  const chamadas: string[] = [];
  const baixados: Array<{ nome: string; conteudo: string; tipo: string }> = [];
  const arquivos: string[] = [];
  const avisos: string[] = [];
  const copias: ArmazemCopias<EnvelopeArquivo> | null = o.copias ? copiasEmMemoria<EnvelopeArquivo>() : null;
  const esc = escoposDaUnidade(t.deps.contexto.host, t.deps.contexto.login, t.deps.contexto.unidade?.id ?? "");
  const resposta = { valor: o.resposta ?? { unidade: ok3(), eu: null }, apagou: o.apagou ?? true };
  const c = new Colaboracao({
    repos: t.repos,
    area: t.area,
    sync,
    rpc: {
      chamar: async <T>(op: string): Promise<T> => {
        chamadas.push(op);
        const erro = o.falhar?.[op];
        if (erro) throw new Error(erro);
        if (op === "apagarPessoal") return resposta.apagou as T;
        return resposta.valor as T;
      },
    },
    contexto: t.deps.contexto,
    hoje: () => HOJE,
    agora: () => t.relogio.agora,
    carimbo: () => {
      t.relogio.agora += 1_000;
      return { agora: t.relogio.agora, dispositivo: "dev-a", por: "ana", nome: "Ana Lima" };
    },
    abrirModal: t.deps.abrirModal,
    confirmar: async () => true,
    baixar: (nome, conteudo, tipo) => void baixados.push({ nome, conteudo, tipo }),
    escolherArquivo: async () => arquivos.shift() ?? null,
    copias,
    arquivo: o.arquivo ?? null,
    avisar: (texto) => void avisos.push(texto),
    esperaCopia: 50,
  });
  t.deps.colaboracao = c;
  t.deps.tabelas = () => estadoDasTabelas(t.area, [esc.unidade, esc.eu]);
  const consent = (vis: Vis) =>
    consentimentoDemandas(sync, t.deps.contexto.host, t.deps.contexto.login, t.deps.contexto.unidade?.id ?? "", vis);
  /** Escreve o status de um texto como o content script faria. */
  const status = async (vis: Vis, tabela: Tabela, s: Partial<StatusSync>) =>
    t.area.gravar({
      [chaveStatusTexto(esc[vis], tabela)]: { estado: "ok", quando: t.relogio.agora, ultimoOk: t.relogio.agora, pendente: false, ...s },
    });
  return { t, c, sync, chamadas, baixados, arquivos, avisos, copias, consent, status, esc, resposta };
}

export type Colab = ReturnType<typeof colabDeTeste>;

export function ok3(): Record<Tabela, StatusSync> {
  const s: StatusSync = { estado: "ok", quando: 1, pendente: false };
  return { d: s, a: s, h: s };
}

/** Um arquivo ligado de mentira: anota o que o diálogo pediu. */
export function arquivoFalso(inicial: { configurado: boolean; status?: StatusArquivo | null }) {
  const a = { configurado: inicial.configurado, status: inicial.status ?? null, chamadas: [] as string[] };
  const lig: ArquivoLigado = {
    status: async () => a.status,
    configurado: async () => a.configurado,
    escolher: async (modo?: "novo" | "existente") => {
      a.chamadas.push(`escolher:${modo}`);
      a.configurado = true;
      a.status = { estado: "ok", quando: 1_790_000_000_000, nome: "demandas.json" };
      return null;
    },
    reconectar: async () => {
      a.chamadas.push("reconectar");
      a.status = { estado: "ok", quando: 1_790_000_000_000, nome: a.status?.nome ?? "demandas.json" };
      return null;
    },
    sincronizar: async () => {
      a.chamadas.push("sincronizar");
      return a.status;
    },
    esquecer: async () => {
      a.chamadas.push("esquecer");
      a.configurado = false;
    },
    agendar: () => void a.chamadas.push("agendar"),
    parar: () => void a.chamadas.push("parar"),
  };
  return { a, lig };
}

export type { Teste };
