/**
 * O que o app do painel pede à aba do SEI (spec 7). Só o content script tem a
 * página: o cabeçalho (contexto), a caixa já carregada, a pesquisa rápida. Abrir
 * processo ou documento é o mesmo gesto do usuário. O que escreve no SEI (P4) é
 * só a sincronia dos Textos Padrão dos projetos (pagina/sincronia.ts), a pedido
 * do app ("Sincronizar agora", "Desligar e apagar do SEI" do texto pessoal).
 * Os mesmos tratadores atendem o painel embutido e o lateral (P5), que também
 * pede o "Abrir no painel" (`focarNoPainel`); os argumentos que podem vir de
 * dado compartilhado são conferidos antes de chegar à pesquisa rápida.
 */

import { abrirProcesso } from "@comum/pagina/abrir";
import type { AvisarComAcoes, AvisarNaPagina } from "@comum/painel/aviso";
import { tratadoresDoPainel } from "@comum/painel/embutido";
import type { Sobreposicao } from "@comum/painel/sobreposicao";
import { ErroRpc, type Tratador } from "@comum/ponte/rpc";
import { lerCaixaDaPagina } from "@nucleo/dominio/caixa";
import { paginaDe } from "@nucleo/sessao/pagina";
import { RE_DOCUMENTO, RE_ID_PROCEDIMENTO, RE_PROTOCOLO } from "../modelo/vinculos";
import type { ContextoProjetos, DocumentoConferido, ProcessoDaCaixa, UsuarioDaUnidade } from "../ponte/tipos";
import type { ProjetosDoAtividades } from "./atividades";
import type { ResultadoSincronizar } from "./sincronia";

export interface DepsExecutor {
  doc: Document;
  ctx: ContextoProjetos;
  iframe: HTMLIFrameElement | null;
  sobreposicao?: Sobreposicao | null;
  avisar?: AvisarNaPagina | null;
  avisarAcoes?: AvisarComAcoes | null;
  usuarios(): Promise<UsuarioDaUnidade[]>;
  conferir(numero: string): Promise<DocumentoConferido | null>;
  /** P4: a sincronia por Texto Padrão desta aba (só na janela de topo, com unidade). */
  sincronia?: { agora(): Promise<ResultadoSincronizar>; apagarPessoal(): Promise<boolean> } | null;
  /** P4: os projetos do servidor do Atividades (só com servidor configurado). */
  atividades?: (() => Promise<ProjetosDoAtividades>) | null;
  /** P5: o "Abrir no painel" do lateral (pagina/foco.ts): rola até o painel ou vai ao Controle de Processos. */
  focarNoPainel?: ((id: string, etapa?: string) => "painel" | Promise<"painel" | "navegou">) | null;
}

/**
 * Os argumentos de abrir processo e documento podem vir de dado compartilhado (o Texto Padrão da unidade, que outra
 * pessoa grava) e vão à pesquisa rápida: o número do processo na forma do vínculo (`RE_PROTOCOLO`: letras, dígitos,
 * `. / -`, até 40; há SEI que escreve com letras), sem espaço no meio (o das pontas sai); o id do processo, se vier,
 * só dígitos (até 20); o número SEI do documento, até 20 dígitos.
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
/** Id de projeto ou de etapa (texto curto, como o `focarProjeto` do app aceita). */
const idCurto = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 && v.length <= 200 ? v : undefined);

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

export function tratadoresProjetos(d: DepsExecutor): Record<string, Tratador> {
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
    // Documento: a pesquisa rápida com o número SEI, numa aba nova (a tela atual fica).
    abrirDocumento: (args) => {
      const bruto = (args as { numero?: unknown } | null)?.numero;
      const n = (typeof bruto === "string" ? bruto : (inteiroComoTexto(bruto) ?? "")).replace(/\D/g, "");
      if (!RE_DOCUMENTO.test(n)) throw new ErroRpc("ARGUMENTO_INVALIDO", "Informe o número SEI do documento (até 20 dígitos).");
      return abrirProcesso(d.doc, "", n, true);
    },
    conferirDocumento: (args) => d.conferir(String((args as { numero?: unknown } | null)?.numero ?? "")),
    processosDaCaixa: () => processosDaCaixa(d.doc),
    usuariosDaUnidade: () => d.usuarios(),
    atividadesDisponivel: () => d.ctx.atividades,
    // P4: os dois textos (o pessoal só se ligado); o resultado volta ao app, que conferiu a forma.
    sincronizarAgora: () => {
      if (!d.sincronia) throw new ErroRpc("SEM_SINCRONIA", SEM_SINCRONIA);
      return d.sincronia.agora();
    },
    // Só o texto pessoal: o da unidade é de todos e não tem "apagar".
    apagarDoSei: () => {
      if (!d.sincronia) throw new ErroRpc("SEM_SINCRONIA", SEM_SINCRONIA);
      return d.sincronia.apagarPessoal();
    },
    importarAtividades: () => {
      if (!d.atividades) throw new ErroRpc("SEM_ATIVIDADES", "Não há servidor do Atividades configurado neste SEI.");
      return d.atividades();
    },
    // P5: o "Abrir no painel" do lateral (o id vem do app, mas o projeto pode ter vindo de um colega).
    focarNoPainel: (args) => {
      const a = (args ?? {}) as { id?: unknown; etapa?: unknown };
      const id = idCurto(a.id);
      if (!id) throw new ErroRpc("ARGUMENTO_INVALIDO", "Projeto inválido.");
      if (!d.focarNoPainel) throw new ErroRpc("SEM_PAINEL", "Abra o Controle de Processos nesta aba para ver o projeto no painel.");
      return d.focarNoPainel(id, idCurto(a.etapa));
    },
  };
}
