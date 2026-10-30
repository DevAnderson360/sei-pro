/**
 * Busca com operadores. Uma caixa só:
 *   texto livre, "frase exata", -negado, campo:valor, campo:<valor, campo:>valor
 * Sem acento e sem diferenciar caixa. Operador desconhecido vira texto livre (nunca erro): o usuário digita
 * "http:x" ou "10:30" e a busca continua funcionando. O parser devolve também os `tokens`, para a interface
 * desenhar chips removíveis e sugerir campos.
 */
import { normalizarTexto } from '../../../sei-comum/src/texto';
import type { Ctx } from './contexto';
import { diasNaCaixa, diasParado, diasParaVencer, novoDesdeUltimaVisita, resumoDoPrazo } from './derivados';
import type { Processo } from './tipos';

export const CAMPOS = ['resp', 'tipo', 'marcador', 'espec', 'anot', 'prazo', 'caixa', 'novo', 'sigilo', 'grupo', 'retorno', 'protocolo', 'parado', 'prio', 'interessado'] as const;
export type CampoBusca = (typeof CAMPOS)[number];

const ALIAS: Record<string, CampoBusca> = {
  resp: 'resp', responsavel: 'resp', atribuido: 'resp', atribuicao: 'resp',
  tipo: 'tipo',
  marcador: 'marcador', marcadores: 'marcador', marc: 'marcador',
  espec: 'espec', especificacao: 'espec',
  anot: 'anot', anotacao: 'anot', nota: 'anot',
  prazo: 'prazo',
  caixa: 'caixa', idade: 'caixa',
  novo: 'novo',
  sigilo: 'sigilo', sigiloso: 'sigilo',
  grupo: 'grupo',
  retorno: 'retorno',
  protocolo: 'protocolo', proc: 'protocolo', processo: 'protocolo',
  parado: 'parado', mov: 'parado',
  prio: 'prio', prioridade: 'prio',
  interessado: 'interessado', interessados: 'interessado',
};

export type Comparador = '<' | '>' | '=';

export interface Termo {
  campo?: CampoBusca;
  /** Já normalizado (sem acento, minúsculo). */
  valor: string;
  /** O que o usuário digitou, para o chip. */
  original: string;
  negado: boolean;
  comparador: Comparador;
}

export interface Consulta {
  termos: Termo[];
  /** Mesmos termos, em ordem, com o texto original (chips). */
  tokens: Array<{ texto: string; termo: Termo }>;
}

/** Quebra por espaço respeitando aspas: `tipo:"ofício circular"` e `"frase exata"` são um token só. */
function quebrar(entrada: string): string[] {
  const saida: string[] = [];
  let atual = '';
  let aspas = false;
  for (const c of entrada) {
    if (c === '"') {
      aspas = !aspas;
      atual += c;
    } else if (/\s/.test(c) && !aspas) {
      if (atual) saida.push(atual);
      atual = '';
    } else atual += c;
  }
  if (atual) saida.push(atual);
  return saida;
}

const semAspas = (s: string) => s.replace(/^"|"$/g, '');

export function interpretar(entrada: string): Consulta {
  const termos: Termo[] = [];
  const tokens: Consulta['tokens'] = [];
  for (const bruto of quebrar(entrada)) {
    let resto = bruto;
    let negado = false;
    if (resto.startsWith('-') && resto.length > 1) {
      negado = true;
      resto = resto.slice(1);
    }
    let campo: CampoBusca | undefined;
    const m = /^([a-zA-Z\u00C0-\u017F]+):(.*)$/.exec(resto);
    if (m) {
      const alvo = ALIAS[normalizarTexto(m[1]!)];
      if (alvo) {
        campo = alvo;
        resto = m[2]!;
      }
    }
    let comparador: Comparador = '=';
    if (campo && /^[<>]/.test(resto)) {
      comparador = resto[0] as Comparador;
      resto = resto.slice(1);
    }
    const valor = normalizarTexto(semAspas(resto));
    if (!valor && !campo) continue;
    const termo: Termo = { ...(campo ? { campo } : {}), valor, original: bruto, negado, comparador };
    termos.push(termo);
    tokens.push({ texto: bruto, termo });
  }
  return { termos, tokens };
}

const textoLivre = (p: Processo): string =>
  normalizarTexto(
    [
      p.protocolo,
      p.protocolo.replace(/\D/g, ''),
      p.tipo,
      p.especificacao,
      p.atribuicao?.sigla,
      p.atribuicao?.nome,
      ...p.marcadores.flatMap((m) => [m.nome, m.texto]),
      p.anotacao?.texto,
      p.prazo?.texto,
      p.prioridade,
      p.interessados,
      p.observacao,
    ]
      .filter(Boolean)
      .join(' '),
  );

const contem = (texto: string | undefined, valor: string) => normalizarTexto(texto ?? '').includes(valor);
const SIM = /^(s|sim|1|true|yes)$/;

/** `7d`, `7` ou `7dias` -> 7; `null` se não for número. */
function numeroDeDias(valor: string): number | null {
  const m = /^(\d+)\s*(d|dia|dias)?$/.exec(valor);
  return m ? Number(m[1]) : null;
}

function comparar(n: number | null, comp: Comparador, alvo: number): boolean {
  if (n === null) return false;
  return comp === '<' ? n < alvo : comp === '>' ? n > alvo : n === alvo;
}

function casaPrazo(p: Processo, t: Termo, ctx: Ctx): boolean {
  const r = resumoDoPrazo(p, ctx);
  const v = t.valor;
  if (v === 'sem' || v === 'nenhum' || v === 'nao') return !p.prazo;
  if (v === 'com' || v === 'sim') return !!p.prazo;
  if (!r) return false;
  if (v === 'atrasado' || v === 'atrasados' || v === 'vencido') return r.situacao === 'atrasado';
  if (v === 'hoje') return r.situacao === 'hoje';
  if (v === 'concluido' || v === 'concluidos') return r.situacao === 'concluido';
  if (v === 'semana') {
    const d = diasParaVencer(p, ctx);
    return d !== null && d >= 0 && d <= 7;
  }
  const n = numeroDeDias(v);
  if (n !== null) {
    // "prazo:<7d" = vence em menos de 7 dias (os atrasados entram); "prazo:>30d" = vence daqui a mais de 30.
    return comparar(diasParaVencer(p, ctx), t.comparador === '=' ? '<' : t.comparador, n);
  }
  return contem(p.prazo?.texto, v);
}

function casaCampo(p: Processo, t: Termo, ctx: Ctx): boolean {
  const v = t.valor;
  switch (t.campo) {
    case 'resp': {
      if (v === 'sem' || v === 'ninguem') return !p.atribuicao;
      if (v === 'eu') return !!ctx.eu && normalizarTexto(p.atribuicao?.sigla ?? '') === normalizarTexto(ctx.eu);
      return contem(p.atribuicao?.sigla, v) || contem(p.atribuicao?.nome, v);
    }
    case 'tipo':
      return contem(p.tipo, v);
    case 'marcador':
      if (v === 'sem' || v === 'nenhum') return p.marcadores.length === 0;
      if (v === 'com') return p.marcadores.length > 0;
      return p.marcadores.some((m) => contem(m.nome, v) || contem(m.texto, v));
    case 'espec':
      return contem(p.especificacao, v);
    case 'anot':
      if (v === 'sem' || v === 'nao') return !p.anotacao;
      if (v === 'com' || v === 'sim') return !!p.anotacao;
      if (v === 'prioridade' || v === 'prioritaria') return !!p.anotacao?.prioridade;
      return contem(p.anotacao?.texto, v);
    case 'prazo':
      return casaPrazo(p, t, ctx);
    case 'caixa': {
      const n = numeroDeDias(v);
      if (n === null) return false;
      return comparar(diasNaCaixa(p, ctx), t.comparador === '=' ? '>' : t.comparador, n);
    }
    case 'novo':
      if (v === 'visita') return novoDesdeUltimaVisita(p, ctx);
      if (SIM.test(v)) return p.naoVisualizado;
      if (v === 'nao') return !p.naoVisualizado;
      return false;
    case 'sigilo':
      return SIM.test(v) ? p.sigiloso : !p.sigiloso;
    case 'grupo':
      return v.startsWith('rec') ? p.grupo === 'recebidos' : v.startsWith('ger') ? p.grupo === 'gerados' : false;
    case 'retorno':
      if (v === 'sem' || v === 'nao') return p.retornos.length === 0;
      if (v === 'atrasado') return p.retornos.some((r) => r.atrasado);
      if (v === 'aguardando') return p.retornos.some((r) => r.tipo === 'aguardando');
      if (v === 'programado') return p.retornos.some((r) => r.tipo === 'programado');
      return p.retornos.length > 0;
    case 'parado': {
      const n = numeroDeDias(v);
      if (n === null) return false;
      return comparar(diasParado(p, ctx), t.comparador === '=' ? '>' : t.comparador, n);
    }
    case 'prio':
      return contem(p.prioridade, v);
    case 'interessado':
      return contem(p.interessados, v);
    case 'protocolo':
      return normalizarTexto(p.protocolo).includes(v) || p.protocolo.replace(/\D/g, '').includes(v.replace(/\D/g, '') || '\u0000');
    default:
      return true;
  }
}

/** Tudo precisa casar (E). Termos negados invertem. Consulta vazia casa todos. */
export function casa(c: Consulta, p: Processo, ctx: Ctx): boolean {
  if (!c.termos.length) return true;
  let livre: string | undefined;
  for (const t of c.termos) {
    let ok: boolean;
    if (t.campo) ok = casaCampo(p, t, ctx);
    else {
      livre ??= textoLivre(p);
      ok = livre.includes(t.valor);
    }
    if (t.negado ? ok : !ok) return false;
  }
  return true;
}

export const filtrarPorBusca = (processos: Processo[], entrada: string, ctx: Ctx): Processo[] => {
  const c = interpretar(entrada);
  return c.termos.length ? processos.filter((p) => casa(c, p, ctx)) : processos;
};

/** Texto de um termo para o chip: tira o `-`, mantém o resto. */
export function remover(entrada: string, token: string): string {
  return quebrar(entrada).filter((t) => t !== token).join(' ');
}

/** Acrescenta um termo, citando se tiver espaço. Não duplica. */
export function acrescentar(entrada: string, campo: CampoBusca, valor: string): string {
  const v = /\s/.test(valor) ? `"${valor}"` : valor;
  const termo = `${campo}:${v}`;
  const atuais = quebrar(entrada);
  return atuais.includes(termo) ? entrada : [...atuais, termo].join(' ');
}
