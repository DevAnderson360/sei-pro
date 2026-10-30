/**
 * O prazo do controle nativo, lido do ícone que o SEI 4.1.5+ põe na linha do Controle de
 * Processos. Sem requisição: o `aria-label` traz tudo ("Controle de Prazo / SIGLA dd/mm/aaaa (ESTADO)").
 * O discriminador é o link (`acao=controle_prazo_definir`), nunca o texto: o retorno programado usa
 * um tooltip quase igual ("SIGLA dd/mm/aaaa (atrasado N dias)").
 */
import { parametros } from '../../../sei-nucleo/src/links/links';
import { decodificarEntidades } from '../../../sei-nucleo/src/sessao/entidades';
import { chamadas, texto } from '../../../sei-nucleo/src/sessao/literais';
import type { DataISO, EstadoNativo, PrazoNativo } from '../modelo/tipos';

export const LINK_NATIVO = 'a[href*="acao=controle_prazo_definir"]';

const ROTULO = /^Controle de Prazo\s*\/\s*(\S+)\s+(\d{2})\/(\d{2})\/(\d{4})\s*\(([^)]*)\)\s*$/s;
const iso = (d: string, m: string, a: string): DataISO => `${a}-${m}-${d}`;

function estadoDe(parenteses: string): { estado: EstadoNativo; concluidoEm?: DataISO } | null {
  const t = parenteses.trim().toLowerCase();
  const c = /^conclu[i\u00ED]do em (\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (c) return { estado: 'concluido', concluidoEm: iso(c[1]!, c[2]!, c[3]!) };
  if (/^at[e\u00E9] hoje$/.test(t)) return { estado: 'hoje' };
  if (/^atrasado \d+ dias?$/.test(t)) return { estado: 'atrasado' };
  if (/^\d+ dias?$/.test(t)) return { estado: 'noPrazo' };
  return null;
}

export function lerPrazoNativo(linha: Element): PrazoNativo | null {
  const a = linha.querySelector(LINK_NATIVO);
  if (!a) return null;
  let rotulo = a.getAttribute('aria-label') ?? '';
  if (!rotulo) {
    // Sem aria-label o tooltip serve: infraTooltipMostrar('SIGLA data (estado)','Controle de Prazo').
    const args = chamadas(a.getAttribute('onmouseover') ?? '', 'infraTooltipMostrar')[0];
    if (typeof args?.[0] === 'string') rotulo = `Controle de Prazo / ${texto(args[0])}`;
  }
  const m = ROTULO.exec(decodificarEntidades(rotulo).replace(/\s+/g, ' ').trim());
  if (!m) return null;
  const est = estadoDe(m[5]!);
  if (!est) return null;
  const link = decodificarEntidades(a.getAttribute('href') ?? '');
  const p = parametros(link);
  const idControlePrazo = p.get('id_controle_prazo') ?? '';
  const idProcedimento = p.get('id_procedimento') ?? linha.id.replace(/^P/, '');
  if (!idControlePrazo || !idProcedimento) return null;
  return { idControlePrazo, idProcedimento, sigla: m[1]!, data: iso(m[2]!, m[3]!, m[4]!), link, ...est };
}

/** Todos os prazos nativos das tabelas da caixa, por id do processo. */
export function lerPrazosDaCaixa(doc: Document): Map<string, PrazoNativo> {
  const mapa = new Map<string, PrazoNativo>();
  for (const tr of doc.querySelectorAll('tr[id^="P"]')) {
    const p = lerPrazoNativo(tr);
    if (p) mapa.set(p.idProcedimento, p);
  }
  return mapa;
}

/** A tela tem o botão nativo de Controle de Prazos na barra (SEI 4.1.5+ com a permissão do usuário). */
export function temControleNativo(doc: Document): boolean {
  return !!doc.querySelector('a[onclick*="acao=controle_prazo_definir"]');
}
