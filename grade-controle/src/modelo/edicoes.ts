/** Regras puras das edicoes dinamicas (responsavel, anotacao, marcadores). Nada aqui grava nem toca o DOM. */
import type { MarcadorLinha, Processo } from './tipos';

export const MAX_ANOTACAO = 500;
export const MAX_TEXTO_MARCADOR = 250;

export interface MarcadorDesejado {
  nome: string;
  texto: string;
}

export type OperacaoMarcador =
  | { tipo: 'remover'; nome: string }
  | { tipo: 'adicionar'; nome: string; texto: string }
  | { tipo: 'texto'; nome: string; texto: string };

/**
 * O que fazer no SEI para os marcadores do processo passarem de `atuais` a `desejados`. Remocoes primeiro, depois
 * acrescimos, depois mudancas de texto: se algo falhar no meio, o processo nunca fica com MENOS do que tinha antes de
 * receber o que faltava. Nomes comparam sem diferenciar caixa; texto vazio e texto ausente sao a mesma coisa.
 */
export function planoMarcadores(atuais: readonly MarcadorLinha[], desejados: readonly MarcadorDesejado[]): OperacaoMarcador[] {
  const chave = (n: string) => n.trim().toLowerCase();
  const quer = new Map<string, MarcadorDesejado>();
  for (const d of desejados) if (d.nome.trim() && !quer.has(chave(d.nome))) quer.set(chave(d.nome), { nome: d.nome.trim(), texto: d.texto.trim().slice(0, MAX_TEXTO_MARCADOR) });
  const tem = new Map(atuais.map((m) => [chave(m.nome), m]));
  const ops: OperacaoMarcador[] = [];
  for (const m of atuais) if (!quer.has(chave(m.nome))) ops.push({ tipo: 'remover', nome: m.nome });
  for (const [k, d] of quer) if (!tem.has(k)) ops.push({ tipo: 'adicionar', nome: d.nome, texto: d.texto });
  for (const [k, d] of quer) {
    const atual = tem.get(k);
    if (atual && atual.texto.trim() !== d.texto) ops.push({ tipo: 'texto', nome: atual.nome, texto: d.texto });
  }
  return ops;
}

/** O processo como ficaria depois das operacoes (atualizacao otimista). */
export function aplicarMarcadores(p: Processo, ops: readonly OperacaoMarcador[], corDe: (nome: string) => string = () => ''): Processo {
  let m = [...p.marcadores];
  for (const o of ops) {
    if (o.tipo === 'remover') m = m.filter((x) => x.nome !== o.nome);
    else if (o.tipo === 'adicionar') m.push({ nome: o.nome, cor: corDe(o.nome), texto: o.texto });
    else m = m.map((x) => (x.nome === o.nome ? { ...x, texto: o.texto } : x));
  }
  return { ...p, marcadores: m };
}

/** Texto digitado -> o que o SEI aceita (limite e quebras de linha como o SEI guarda). */
export function textoAnotacao(bruto: string): string {
  return bruto.replace(/\r\n?/g, '\n').trim().slice(0, MAX_ANOTACAO);
}

export function aplicarAnotacao(p: Processo, texto: string, prioridade: boolean, autor = ''): Processo {
  const t = textoAnotacao(texto);
  if (!t) {
    const { anotacao: _, ...resto } = p;
    return resto;
  }
  return { ...p, anotacao: { texto: t, autor: p.anotacao?.autor ?? autor, prioridade } };
}

export function aplicarResponsavel(p: Processo, destino: { sigla: string; nome: string } | null): Processo {
  if (!destino) {
    const { atribuicao: _, ...resto } = p;
    return resto;
  }
  return { ...p, atribuicao: destino };
}

/** Aplicar a varios: o processo clicado mais os selecionados, sem repetir, so os que a edicao permite. */
export function alvosDaEdicao(clicado: Processo, selecionados: ReadonlySet<string>, todos: readonly Processo[], estender: boolean, permite: (p: Processo) => boolean): Processo[] {
  const ids = new Set<string>([clicado.id]);
  if (estender) for (const id of selecionados) ids.add(id);
  return todos.filter((p) => ids.has(p.id) && permite(p));
}

/** As operacoes calculadas no processo clicado, filtradas para um outro processo (aplicar a varios). */
export function opsParaProcesso(ops: readonly OperacaoMarcador[], p: Processo): OperacaoMarcador[] {
  const tem = new Set(p.marcadores.map((m) => m.nome.trim().toLowerCase()));
  return ops.filter((o) => {
    const t = tem.has(o.nome.trim().toLowerCase());
    return o.tipo === 'adicionar' ? !t : t;
  });
}
