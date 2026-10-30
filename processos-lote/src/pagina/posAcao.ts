/**
 * Acoes depois da criacao, lado da aba: as listas para escolher (marcadores, grupos de acompanhamento, blocos
 * internos) e a execucao de cada acao sobre os processos ja criados. O laco e a tela ficam no app; aqui so se
 * fala com o SEI pelo nucleo.
 *
 * Regras (as mesmas da criacao):
 * - Nunca se toca uma linha incerta: sem `idProcedimento` (ou sem protocolo) aquela entrada e recusada ANTES de
 *   qualquer requisicao. O app so manda processos `ok` com numero confirmado; isto e a segunda barreira.
 * - Tudo volta como JSON simples (`situacao`, `mensagem`, `parar`); nenhuma excecao atravessa a ponte. Sessao
 *   expirada vira `parar: true`, para o app nao seguir errando processo a processo.
 * - Marcador e acompanhamento sao idempotentes no nucleo (o mesmo valor de novo da "Nada a alterar"), entao um erro
 *   neles pode ser repetido. A inclusao em bloco nao: excecao depois do POST vira `nao-confirmado`.
 */
import { definirAcompanhamento, definirMarcador } from "@nucleo/dominio/acoesProcesso";
import { incluirProcessosEmBlocoInterno, listarBlocosInternosParaProcessos, type ResultadoInclusao } from "@nucleo/dominio/blocoProcessos";
import type { ResultadoEscrita } from "@nucleo/dominio/escrita";
import { listarOpcoes } from "@nucleo/dominio/opcoes";
import type { Sei } from "@nucleo/sei";
import { ehErroSei } from "@nucleo/sessao/erros";

/** As funcoes do nucleo, trocaveis nas provas para forcar cada desfecho sem rede. */
export interface ChamadasPosAcao {
  definirMarcador: typeof definirMarcador;
  definirAcompanhamento: typeof definirAcompanhamento;
  listarOpcoes: typeof listarOpcoes;
  listarBlocosInternosParaProcessos: typeof listarBlocosInternosParaProcessos;
  incluirProcessosEmBlocoInterno: typeof incluirProcessosEmBlocoInterno;
}

export interface Opcao {
  id: string;
  nome: string;
}

export interface OpcaoBloco {
  id: string;
  numero: string;
  descricao: string;
}

export type ListaPosAcao = "marcadores" | "grupos" | "blocos";

export interface OpcoesPosAcao {
  marcadores: Opcao[];
  grupos: Opcao[];
  blocos: OpcaoBloco[];
  /** Uma frase por lista que nao veio (a lista fica vazia; as outras seguem). */
  avisos: string[];
  /**
   * As listas que NAO carregaram (vazias por falha, nao por a unidade nao ter nada): o app nao conclui delas que
   * um marcador/grupo/bloco "nao existe mais".
   */
  falharam: ListaPosAcao[];
  parar?: boolean;
}

export interface ResultadoPosAcao {
  situacao: "ok" | "ja-estava" | "erro";
  mensagem: string;
  parar?: boolean;
}

export interface ResultadoBlocoItem {
  idProcedimento: string;
  situacao: ResultadoInclusao["situacao"];
  mensagem?: string;
}

export interface ResultadoPosAcaoBloco {
  resultados: ResultadoBlocoItem[];
  parar?: boolean;
}

const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const sessaoExpirada = (e: unknown): boolean => ehErroSei(e) && e.codigo === "SEI_SESSAO_EXPIRADA";
const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const ERRO_LINHA_INCERTA = "Processo sem número confirmado: a ação não foi aplicada.";
const ERRO_SEM_BLOCO = "Bloco interno não informado.";
const FORA_DA_PAGINA = "O processo não está na página do Controle de Processos; nada foi enviado para ele.";
const SEM_RESULTADO_DO_NUCLEO = "O SEI não informou o resultado deste processo: confira o bloco antes de repetir.";

function erroDe(e: unknown): ResultadoPosAcao {
  const r: ResultadoPosAcao = { situacao: "erro", mensagem: mensagem(e) };
  if (sessaoExpirada(e)) r.parar = true;
  return r;
}

/**
 * Do resultado do nucleo (sempre com `aplicar: true`): aplicado e `ok`; nada a mudar e `ja-estava` (o processo ja
 * tem o marcador/acompanhamento igual); qualquer outro caso nao aplicou e e `erro`.
 */
function deEscrita(r: ResultadoEscrita): ResultadoPosAcao {
  if (r.aplicado) return { situacao: "ok", mensagem: r.resumo };
  if (!r.mudancas.length) return { situacao: "ja-estava", mensagem: r.resumo };
  return { situacao: "erro", mensagem: r.resumo || "O SEI não aplicou a ação." };
}

export function tratadoresPosAcao(sei: Sei, injetadas: Partial<ChamadasPosAcao> = {}) {
  const c: ChamadasPosAcao = {
    definirMarcador,
    definirAcompanhamento,
    listarOpcoes,
    listarBlocosInternosParaProcessos,
    incluirProcessosEmBlocoInterno,
    ...injetadas,
  };

  /**
   * As tres listas, uma de cada vez e independentes: a que falha vem vazia com um aviso. Sessao expirada para as
   * seguintes (falhariam igual) e sobe `parar`. Marcadores e grupos sao lidos de um processo da unidade, por isso
   * o `protocolo` (qualquer processo criado); sem ele so essas duas ficam de fora, com aviso. Os blocos vem da tela
   * do Controle (so leitura, nenhum processo envolvido) e sao listados sempre.
   */
  const posAcaoOpcoes = async (args: unknown): Promise<OpcoesPosAcao> => {
    const protocolo = texto((args as { protocolo?: unknown } | undefined)?.protocolo);
    const r: OpcoesPosAcao = { marcadores: [], grupos: [], blocos: [], avisos: [], falharam: [] };
    const etapas: Array<[string, ListaPosAcao, () => Promise<void>]> = [];
    if (protocolo) {
      etapas.push(
        [
          "marcadores",
          "marcadores",
          async () => {
            r.marcadores = (await c.listarOpcoes(sei, "marcadores", protocolo)).map((o) => ({ id: o.id, nome: o.nome }));
          },
        ],
        [
          "grupos de acompanhamento",
          "grupos",
          async () => {
            r.grupos = (await c.listarOpcoes(sei, "grupos_acompanhamento", protocolo)).map((o) => ({ id: o.id, nome: o.nome }));
          },
        ],
      );
    } else {
      r.avisos.push("Nenhum processo criado com número confirmado: os marcadores e os grupos de acompanhamento não foram carregados.");
      r.falharam.push("marcadores", "grupos");
    }
    etapas.push([
      "blocos internos",
      "blocos",
      async () => {
        r.blocos = (await c.listarBlocosInternosParaProcessos(sei)).map((b) => ({ id: b.id, numero: b.numero, descricao: b.descricao }));
      },
    ]);
    for (const [k, [nome, lista, carregar]] of etapas.entries()) {
      try {
        await carregar();
      } catch (e) {
        r.avisos.push(`Não foi possível listar os ${nome}: ${mensagem(e)}`);
        r.falharam.push(lista);
        // Sessao expirada: as seguintes nem sao pedidas, e tambem nao carregaram.
        if (sessaoExpirada(e)) for (const [, outra] of etapas.slice(k + 1)) r.falharam.push(outra);
        if (sessaoExpirada(e)) {
          r.parar = true;
          break;
        }
      }
    }
    return r;
  };

  /** Marcador ou acompanhamento num processo (um por chamada). Bloco tem operacao propria, de um POST so. */
  const posAcao = async (args: unknown): Promise<ResultadoPosAcao> => {
    const a = (args ?? {}) as Record<string, unknown>;
    const protocolo = texto(a.protocolo);
    if (!protocolo || !texto(a.idProcedimento)) return { situacao: "erro", mensagem: ERRO_LINHA_INCERTA };
    try {
      if (a.acao === "marcador") {
        const marcador = texto(a.marcador);
        if (!marcador) return { situacao: "erro", mensagem: "Marcador não informado." };
        // Sem texto, o nucleo conserva o texto que o processo ja tiver nesse marcador.
        const m: { marcador: string; texto?: string } = { marcador };
        if (typeof a.texto === "string") m.texto = a.texto;
        return deEscrita(await c.definirMarcador(sei, protocolo, m, { aplicar: true }));
      }
      if (a.acao === "acompanhar") {
        const acomp: { grupo?: string; observacao?: string } = {};
        if (typeof a.grupo === "string") acomp.grupo = a.grupo;
        if (typeof a.observacao === "string") acomp.observacao = a.observacao;
        return deEscrita(await c.definirAcompanhamento(sei, protocolo, acomp, { aplicar: true }));
      }
      return { situacao: "erro", mensagem: "Ação desconhecida." };
    } catch (e) {
      return erroDe(e);
    }
  };

  /**
   * Inclui todos os processos num bloco interno com UMA chamada (um POST). O resultado do nucleo passa 1:1
   * (`nao-confirmado` e `fora-da-pagina` ficam distintos). Se o nucleo lancar, a falha pode ter vindo depois do
   * POST: todos ficam `nao-confirmado`, nunca `erro` (que o app trataria como repetivel).
   *
   * Id vazio (linha incerta, que o app nao devia mandar) nao vai ao nucleo: vira `erro` na propria entrada, e os
   * outros seguem. Id enviado que o nucleo nao devolveu: nao se sabe o que houve no POST, entao `nao-confirmado`.
   */
  const posAcaoBloco = async (args: unknown): Promise<ResultadoPosAcaoBloco> => {
    const a = (args ?? {}) as Record<string, unknown>;
    if (!Array.isArray(a.idsProcedimento)) return { resultados: [] };
    const brutos = a.idsProcedimento.map(texto);
    // A ordem do pedido: cada id valido uma vez, cada vazio na sua posicao.
    const ordem: string[] = [];
    const vistos = new Set<string>();
    for (const id of brutos) {
      if (!id) ordem.push("");
      else if (!vistos.has(id)) {
        vistos.add(id);
        ordem.push(id);
      }
    }
    const ids = [...vistos];
    if (!ordem.length) return { resultados: [] };
    const idBloco = texto(a.idBloco);
    if (!idBloco) return { resultados: ordem.map((id) => ({ idProcedimento: id, situacao: "erro", mensagem: ERRO_SEM_BLOCO })) };
    const montar = (porId: Map<string, ResultadoBlocoItem>): ResultadoBlocoItem[] =>
      ordem.map((id) => (id ? porId.get(id)! : { idProcedimento: "", situacao: "erro", mensagem: ERRO_LINHA_INCERTA }));
    if (!ids.length) return { resultados: montar(new Map()) };
    try {
      const r = await c.incluirProcessosEmBlocoInterno(sei, idBloco, ids);
      const porId = new Map<string, ResultadoBlocoItem>();
      for (const x of r) {
        if (!vistos.has(x.idProcedimento) || porId.has(x.idProcedimento)) continue;
        const item: ResultadoBlocoItem = { idProcedimento: x.idProcedimento, situacao: x.situacao };
        const msg = x.erro ?? (x.situacao === "fora-da-pagina" ? FORA_DA_PAGINA : undefined);
        if (msg) item.mensagem = msg;
        porId.set(x.idProcedimento, item);
      }
      for (const id of ids)
        if (!porId.has(id)) porId.set(id, { idProcedimento: id, situacao: "nao-confirmado", mensagem: SEM_RESULTADO_DO_NUCLEO });
      return { resultados: montar(porId) };
    } catch (e) {
      const msg = `Não confirmado: ${mensagem(e)} Confira o bloco antes de repetir.`;
      const porId = new Map(ids.map((id) => [id, { idProcedimento: id, situacao: "nao-confirmado" as const, mensagem: msg }]));
      const r: ResultadoPosAcaoBloco = { resultados: montar(porId) };
      if (sessaoExpirada(e)) r.parar = true;
      return r;
    }
  };

  return { posAcaoOpcoes, posAcao, posAcaoBloco };
}
