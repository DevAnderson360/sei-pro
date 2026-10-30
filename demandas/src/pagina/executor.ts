/**
 * O que o app do painel pede à aba do SEI. Só o content script tem a página: o cabeçalho (contexto), a caixa já
 * carregada e o gesto de abrir um processo. O que escreve no SEI é só a sincronia dos Textos Padrão das demandas
 * (pagina/sincronia.ts), a pedido do app ("Sincronizar agora", "Desligar e apagar do SEI" do texto pessoal). As etapas
 * do Gestor de Projetos o app lê direto do storage (D15): não há método para elas aqui. Os argumentos que podem vir de
 * dado compartilhado são conferidos antes de chegar à pesquisa rápida.
 *
 * Troca de unidade ou de usuário: os pedidos de sincronia levam a chave do painel (`chaveDaAba`); a que não é a desta
 * aba é recusada ("A unidade mudou; recarregue o painel") e nada é gravado nos repositórios da unidade antiga.
 */

import { abrirProcesso } from "@comum/pagina/abrir";
import type { AvisarComAcoes, AvisarNaPagina } from "@comum/painel/aviso";
import { tratadoresDoPainel } from "@comum/painel/embutido";
import type { Sobreposicao } from "@comum/painel/sobreposicao";
import { ErroRpc, type Tratador } from "@comum/ponte/rpc";
import { lerCaixaDaPagina } from "@nucleo/dominio/caixa";
import { paginaDe } from "@nucleo/sessao/pagina";
import { RE_ID_PROCEDIMENTO, RE_PROTOCOLO } from "@projetos/modelo/vinculos";
import type { ProcessoDaCaixa, UsuarioDaUnidade } from "@projetos/ponte/tipos";
import { type ContextoDemandas, chaveDaAba, idDeFocoValido } from "../ponte/tipos";
import type { ResultadoSincronizar } from "./sincronia";

export const MENSAGEM_UNIDADE_MUDOU = "A unidade mudou; recarregue o painel.";

export interface DepsExecutor {
  doc: Document;
  ctx: ContextoDemandas;
  iframe: HTMLIFrameElement | null;
  sobreposicao?: Sobreposicao | null;
  avisar?: AvisarNaPagina | null;
  avisarAcoes?: AvisarComAcoes | null;
  usuarios(): Promise<UsuarioDaUnidade[]>;
  /** A sincronia por Texto Padrão desta aba (só na janela de topo, com unidade). */
  sincronia?: { agora(): Promise<ResultadoSincronizar>; apagarPessoal(): Promise<boolean> } | null;
  /** O "Abrir no painel" do lateral (pagina/foco.ts): rola até o painel ou vai ao Controle de Processos. */
  focarNoPainel?: ((id: string) => "painel" | Promise<"painel" | "navegou">) | null;
}

/**
 * O número do processo na forma do vínculo (`RE_PROTOCOLO`: letras, dígitos, `. / -`, até 40; há SEI que escreve com
 * letras), sem espaço no meio (o das pontas sai). O argumento vem de dado compartilhado (o Texto Padrão da unidade,
 * que outra pessoa grava) e vai à pesquisa rápida.
 */
function protocoloDoPedido(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && RE_PROTOCOLO.test(t) ? t : null;
}
/** Número que vem como `number`: só inteiro seguro e não negativo (`1e21` viraria "1e+21", e os dígitos dele, "121"). */
const inteiroComoTexto = (v: unknown): string | null => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? String(v) : null);
/** O id do processo: ausente ou vazio (só a pesquisa rápida), ou só dígitos; qualquer outra coisa é null (recusa). */
function idDoPedido(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return "";
  const t = typeof v === "string" ? v : inteiroComoTexto(v);
  return t !== null && RE_ID_PROCEDIMENTO.test(t) ? t : null;
}

const SEM_SINCRONIA =
  "A sincronia pelo Texto Padrão só funciona numa tela do SEI com unidade e com o item Textos Padrão no menu. Abra o Controle de Processos e tente de novo.";

/** Os processos da página da caixa que está na tela (sem requisição). */
export function processosDaCaixa(doc: Document): ProcessoDaCaixa[] {
  try {
    return lerCaixaDaPagina(paginaDe(doc)).map((p) => {
      // O número como o SEI escreve, sem os espaços das pontas (o app ainda confere a forma).
      const item: ProcessoDaCaixa = { protocolo: p.protocolo.trim(), idProcedimento: p.idProcedimento.trim(), sigiloso: p.sigiloso };
      if (p.tipo) item.tipo = p.tipo;
      // Especificação de processo sigiloso não sai da aba (o núcleo já a deixa vazia; aqui de novo).
      if (!p.sigiloso && p.especificacao) item.especificacao = p.especificacao;
      return item;
    });
  } catch {
    return [];
  }
}

export function tratadoresDemandas(d: DepsExecutor): Record<string, Tratador> {
  /** O pedido de sincronia sem a chave desta aba, ou com a de OUTRA unidade ou usuário, não toca nada. */
  const conferirChave = (args: unknown): void => {
    const chave = (args as { chave?: unknown } | null | undefined)?.chave;
    // Sem a chave da aba, o pedido nao diz a que unidade e a que usuario se refere: recusa.
    if (typeof chave !== "string" || chave !== chaveDaAba(d.ctx)) throw new ErroRpc("UNIDADE_MUDOU", MENSAGEM_UNIDADE_MUDOU);
  };
  return {
    contexto: () => d.ctx,
    // altura, sobrepor e aviso: os de todo painel embutido (sei-comum).
    ...tratadoresDoPainel(d),
    abrirProcesso: (args) => {
      const a = (args ?? {}) as { id?: unknown; protocolo?: unknown; novaAba?: unknown };
      const id = idDoPedido(a.id);
      const protocolo = protocoloDoPedido(a.protocolo);
      if (id === null || protocolo === null) throw new ErroRpc("ARGUMENTO_INVALIDO", "Este não é um número de processo do SEI.");
      return abrirProcesso(d.doc, id, protocolo, a.novaAba === true);
    },
    processosDaCaixa: () => processosDaCaixa(d.doc),
    usuarios: () => d.usuarios(),
    // Os três textos de cada escopo (o pessoal só se ligado); o resultado volta ao app, que conferiu a forma.
    sincronizarAgora: (args) => {
      conferirChave(args);
      if (!d.sincronia) throw new ErroRpc("SEM_SINCRONIA", SEM_SINCRONIA);
      return d.sincronia.agora();
    },
    // Só os textos pessoais: os da unidade são de todos e não têm "apagar".
    apagarPessoal: (args) => {
      conferirChave(args);
      if (!d.sincronia) throw new ErroRpc("SEM_SINCRONIA", SEM_SINCRONIA);
      return d.sincronia.apagarPessoal();
    },
    // O "Abrir no painel" do lateral (o id vem do app, mas a demanda pode ter vindo de um colega).
    focarNoPainel: (args) => {
      const id = (args as { id?: unknown } | null)?.id;
      if (!idDeFocoValido(id)) throw new ErroRpc("ARGUMENTO_INVALIDO", "Demanda inválida.");
      if (!d.focarNoPainel) throw new ErroRpc("SEM_PAINEL", "Abra o Controle de Processos nesta aba para ver a demanda no painel.");
      return d.focarNoPainel(id);
    },
  };
}
