/** Linhas do CSV da visão atual. A neutralização de fórmulas é do `gerarCsv` (sei-comum). */
import { formatarData } from '../../../sei-comum/src/datas/dias';
import type { Ctx } from './contexto';
import { diasNaCaixa, diasParado, resumoDoPrazo } from './derivados';
import { rotuloIdade } from './idade';
import { type Coluna, type Processo, ROTULO_COLUNA } from './tipos';

export function sinaisDe(p: Processo): string[] {
  const s: string[] = [];
  if (p.sigiloso) s.push('Sigiloso');
  if (p.naoVisualizado) s.push('Não visualizado');
  if (p.documentoNovo) s.push('Documento novo');
  if (p.urgente) s.push('Urgente');
  if (p.trancado) s.push('Trancado');
  if (p.acompanhamentoEspecial) s.push(p.acompanhamentoGrupo ? `Acompanhamento especial (${p.acompanhamentoGrupo})` : 'Acompanhamento especial');
  for (const r of p.retornos) s.push(`${r.tipo === 'aguardando' ? 'Aguardando retorno' : 'Retorno programado'}${r.atrasado ? ' (atrasado)' : ''}`);
  return s;
}

export function textoPrazo(p: Processo, ctx: Ctx): string {
  const r = resumoDoPrazo(p, ctx);
  if (!p.prazo || !r) return '';
  const data = p.prazo.vencimento ?? p.prazo.inicio;
  return `${data ? formatarData(data) : ''}${p.prazo.hora ? ` ${p.prazo.hora}` : ''} (${r.texto})`.trim();
}

const celula = (p: Processo, c: Coluna, ctx: Ctx): string => {
  switch (c) {
    case 'processo':
      return p.protocolo;
    case 'tipo':
      return p.tipo;
    case 'especificacao':
      return p.especificacao;
    case 'responsavel':
      return p.atribuicao ? (p.atribuicao.nome === p.atribuicao.sigla ? p.atribuicao.sigla : `${p.atribuicao.nome} (${p.atribuicao.sigla})`) : '';
    case 'marcadores':
      return p.marcadores.map((m) => (m.texto ? `${m.nome}: ${m.texto}` : m.nome)).join('; ');
    case 'prazo':
      return textoPrazo(p, ctx);
    case 'anotacao':
      return p.anotacao?.texto.replace(/\s*\n\s*/g, ' / ') ?? '';
    case 'caixa':
      return rotuloIdade(diasNaCaixa(p, ctx));
    case 'parado':
      return rotuloIdade(diasParado(p, ctx));
    case 'sinais':
      return sinaisDe(p).join('; ');
  }
};

export function linhasCsv(processos: Processo[], colunas: Coluna[], ctx: Ctx): string[][] {
  return [colunas.map((c) => ROTULO_COLUNA[c]), ...processos.map((p) => colunas.map((c) => celula(p, c, ctx)))];
}

export const nomeArquivo = (hoje: string): string => `processos-${hoje}.csv`;
