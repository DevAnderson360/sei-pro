/** O que a linha do Controle de Processos já mostra sobre o prazo: o ícone nativo e o marcador. */
import { chamadas, texto } from '../../../sei-nucleo/src/sessao/literais';
import { lerMarcador } from '../modelo/marcador';
import type { PrazoMarcador, PrazoNativo } from '../modelo/tipos';
import { lerPrazoNativo } from '../nativo/leitura';

export const TABELAS = '#tblProcessosRecebidos, #tblProcessosGerados, #tblProcessosDetalhado';

export interface LeituraDaLinha {
  nativo: PrazoNativo | null;
  marcador: PrazoMarcador | null;
  /** Nome do marcador que traz a data (para limpar o texto ao remover). */
  nomeMarcador?: string;
}

/** `infraTooltipMostrar('TEXTO','NOME')`: lido como literal, sem executar nada. */
export function marcadoresDaLinha(tr: Element): Array<{ texto: string; nome: string }> {
  const achados: Array<{ texto: string; nome: string }> = [];
  for (const a of tr.querySelectorAll('a[href*="acao=andamento_marcador_gerenciar"]')) {
    const args = chamadas(a.getAttribute('onmouseover') ?? '', 'infraTooltipMostrar')[0];
    if (typeof args?.[0] !== 'string') continue;
    achados.push({ texto: texto(args[0]), nome: texto(args[1]) });
  }
  return achados;
}

export function lerPrazoDaLinha(tr: Element): LeituraDaLinha {
  for (const m of marcadoresDaLinha(tr)) {
    const marcador = lerMarcador(m.texto);
    if (marcador) return { nativo: lerPrazoNativo(tr), marcador, nomeMarcador: m.nome };
  }
  return { nativo: lerPrazoNativo(tr), marcador: null };
}

export function protocoloDaLinha(tr: Element): string {
  return tr.querySelector('input[type=checkbox]')?.getAttribute('title') ?? tr.querySelector('a[href*="procedimento_trabalhar"]')?.textContent?.replace(/\s+/g, '') ?? '';
}

/** Linhas marcadas pelo usuário (SEI 3: `.infraCheckbox`; 4+: `.infraCheckboxInput`). */
export function idsSelecionados(doc: Document): string[] {
  const ids: string[] = [];
  for (const c of doc.querySelectorAll<HTMLInputElement>(TABELAS.split(', ').map((t) => `${t} input[type=checkbox]`).join(', '))) {
    if (!c.checked) continue;
    const id = c.getAttribute('value') ?? c.closest('tr')?.id.replace(/^P/, '');
    if (id) ids.push(id);
  }
  return ids;
}
