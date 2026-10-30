import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { definirAnalisador } from '../../sei-nucleo/src/sessao/dom';

definirAnalisador((html) => parseHTML(html).document as unknown as Document);

let n = 0;
export async function teste(nome: string, fn: () => void | Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.error(`FALHOU: ${nome}`);
    throw e;
  }
  console.log(`OK ${++n}: ${nome}`);
}

export const fixture = (nome: string): string => readFileSync(new URL(`./fixtures/sei41/${nome}`, import.meta.url), 'utf8');
export const docDe = (html: string): Document => parseHTML(html).document as unknown as Document;
export const docFixture = (nome: string): Document => docDe(fixture(nome));

import type { Ctx } from '../src/modelo/contexto';
import type { Processo } from '../src/modelo/tipos';

export const AGORA = Date.UTC(2026, 9, 11, 12, 0, 0);
export const CTX: Ctx = { hoje: '2026-10-11', agora: AGORA, eu: 'ana' };

let seq = 0;
/** Processo mínimo; sobrescreva o que importa no teste. */
export function proc(o: Partial<Processo> = {}): Processo {
  seq += 1;
  return {
    id: String(1000 + seq),
    protocolo: `99906.713-630.${String(seq).padStart(6, '0')}/2025-${String(10 + (seq % 80))}`,
    grupo: 'recebidos',
    tipo: 'Ofício',
    especificacao: '',
    sigiloso: false,
    naoVisualizado: false,
    marcadores: [],
    retornos: [],
    acompanhamentoEspecial: false,
    documentoNovo: false,
    pagina: 0,
    naPaginaAtual: true,
    ...o,
  };
}
export const prazoEm = (id: string, vencimento: string, extra: object = {}): Processo['prazo'] => ({ idProcedimento: id, origem: 'nativo', vencimento, ...extra });

/**
 * O linkedom não tem o comportamento padrão do clique (alternar o checkbox). O navegador alterna ANTES de
 * despachar o evento; aqui alternamos durante o despacho, o que basta porque quem lê o estado o faz depois.
 */
export function ativarToggle<D extends Document>(doc: D): D {
  doc.addEventListener('click', (e) => {
    const alvo = e.target as HTMLInputElement | null;
    if (alvo?.tagName === 'INPUT' && alvo.type === 'checkbox' && !alvo.disabled) alvo.checked = !alvo.checked; // linkedom começa com undefined: !undefined já é true
  });
  return doc;
}
