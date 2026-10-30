/**
 * Parte pura do app do Link Permanente: o que o texto colado reconheceu, como
 * a resposta da aba vira saída do lote e como cada item vira linha da tabela.
 * Sem DOM, para a tabela, a cópia e o CSV saírem da mesma fonte.
 */

import type { ItemLote, SaidaItem } from "@comum/lote/executor";
import type { ProtocoloReconhecido, TipoProtocolo } from "@comum/texto/protocolos";
import type { ColunaResultado, LinhaResultado } from "@comum/ui/tabelaResultado";
import type { ContextoLink } from "../pagina/contexto";
import type { ResultadoLocalizar } from "../pagina/executor";

/** O que o tratador `contexto` devolve: o da aba sem a base (que leva o infra_hash). */
export type ContextoApp = Omit<ContextoLink, "base">;

export type ItemLink = ItemLote<ProtocoloReconhecido, ResultadoLocalizar>;

/** A Situação a tabela comum já põe na frente; aqui só as colunas do módulo. */
export const COLUNAS: ColunaResultado[] = [
  { chave: "protocolo", titulo: "Protocolo" },
  { chave: "tipo", titulo: "Tipo" },
  { chave: "link", titulo: "Link Permanente", comoLink: true },
];

export const MENSAGEM_SESSAO = "A sessão do SEI expirou. Entre de novo e tente outra vez.";

export function contarPorTipo(protocolos: ProtocoloReconhecido[]): Record<TipoProtocolo, number> {
  const conta: Record<TipoProtocolo, number> = { processo: 0, sei: 0, outro: 0 };
  for (const p of protocolos) conta[p.tipo] += 1;
  return conta;
}

/** Uma frase por tipo presente, na ordem processo, nº SEI, outro; a dica do "outro" vai à parte. */
export function rotulosReconhecidos(conta: Record<TipoProtocolo, number>): { texto: string; dica?: string }[] {
  const saida: { texto: string; dica?: string }[] = [];
  if (conta.processo) saida.push({ texto: `${conta.processo} ${conta.processo === 1 ? "processo" : "processos"}` });
  if (conta.sei) saida.push({ texto: `${conta.sei} nº SEI` });
  if (conta.outro) saida.push({ texto: `${conta.outro} ${conta.outro === 1 ? "outro" : "outros"}`, dica: "será pesquisado como está" });
  return saida;
}

/** A resposta da aba já vem classificada; o executor só precisa da situação e do pedido de parada. */
export function saidaDoLocalizar(r: ResultadoLocalizar): SaidaItem<ResultadoLocalizar> {
  if (r.situacao === "ok") return { situacao: "ok", resultado: r };
  const s: SaidaItem<ResultadoLocalizar> = { situacao: r.situacao, resultado: r };
  if (r.erro) s.erro = r.erro;
  if (r.parar) s.parar = true;
  return s;
}

/**
 * Itens da tabela: só os itens que já saíram para a aba (ou voltaram), na
 * ordem de entrada. Assim as linhas aparecem conforme as respostas chegam, e
 * uma lenta guarda o seu lugar como "Pendente" em vez de pular para o fim.
 */
export function itensVisiveis(itens: readonly ItemLink[]): ItemLink[] {
  return [...itens].sort((a, b) => a.indice - b.indice).filter((i) => !(i.situacao === "pendente" && i.tentativas === 0));
}

/** Uma linha por item visível (`itensVisiveis`), na mesma ordem. */
export function linhasDosItens(itens: readonly ItemLink[]): LinhaResultado[] {
  const linhas: LinhaResultado[] = [];
  for (const i of itensVisiveis(itens)) {
    const r = i.resultado;
    const ok = i.situacao === "ok" && r?.situacao === "ok" ? r : null;
    const linha: LinhaResultado = {
      situacao: i.situacao,
      campos: { protocolo: i.entrada.texto, tipo: ok ? (ok.idDocumento ? "Documento" : "Processo") : "", link: ok?.link ?? "" },
    };
    if (ok) linha.link = ok.link;
    linhas.push(linha);
  }
  return linhas;
}

/** Itens que o "Tentar de novo" reprocessa: os com erro e, depois de uma parada, os que nem saíram. */
export function haParaRepetir(itens: readonly ItemLink[]): boolean {
  return itens.some((i) => i.situacao === "erro" || (i.situacao === "pendente" && i.tentativas === 0));
}
