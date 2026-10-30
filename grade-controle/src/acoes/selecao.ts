/**
 * A seleção da grade É a seleção do SEI: marcar uma linha clica o checkbox da tabela nativa (oculta), e o
 * `infraSelecionarItens` do próprio SEI mantém os campos `hdn*ItensSelecionados` que as ações da barra usam.
 */
const CHECKS = '#tblProcessosRecebidos input[type=checkbox], #tblProcessosGerados input[type=checkbox], #tblProcessosDetalhado input[type=checkbox]';

const idDe = (c: HTMLInputElement): string => c.getAttribute('value') ?? c.closest('tr')?.id.replace(/^P/, '') ?? '';

export function caixaNativa(doc: Document, id: string): HTMLInputElement | null {
  for (const c of doc.querySelectorAll<HTMLInputElement>(CHECKS)) if (idDe(c) === id) return c;
  return null;
}

/** Ids marcados na tabela nativa. */
export function lerSelecao(doc: Document): Set<string> {
  const ids = new Set<string>();
  for (const c of doc.querySelectorAll<HTMLInputElement>(CHECKS)) if (c.checked && idDe(c)) ids.add(idDe(c));
  return ids;
}

/** Ajusta a seleção nativa para `desejados`, clicando só no que difere. Devolve os ids que não têm caixa (outra página). */
export function aplicarSelecao(doc: Document, desejados: ReadonlySet<string>): string[] {
  const semCaixa = new Set(desejados);
  for (const c of doc.querySelectorAll<HTMLInputElement>(CHECKS)) {
    const id = idDe(c);
    if (!id) continue;
    semCaixa.delete(id);
    if (c.disabled) continue;
    if (!!c.checked !== desejados.has(id)) c.click();
  }
  return [...semCaixa];
}

/** Avisa quando a seleção nativa muda por qualquer meio (clique na grade, ação concluída, teclado). */
/**
 * Clique ou mudanca que nasceu DENTRO da grade (o checkbox da grade, o do cabecalho, um botao). A grade ja trata o
 * proprio evento: reagir a ele aqui redesenhava as linhas no meio do clique, antes de o navegador disparar o
 * `change`, e o checkbox sumia sem marcar nada (so o clique real do mouse expunha isso).
 */
function veioDaGrade(ev: Event): boolean {
  const caminho = ev.composedPath?.() ?? [];
  if (caminho.length) return caminho.some((n) => (n as Element).id === 'spro-grade');
  for (let n = ev.target as Node | null; n; n = n.parentNode) if ((n as Element).id === 'spro-grade') return true;
  return false;
}

export function observarSelecao(doc: Document, aoMudar: (ids: Set<string>) => void): () => void {
  let agendado = false;
  const notificar = (ev?: Event) => {
    if (ev && veioDaGrade(ev)) return;
    if (agendado) return;
    agendado = true;
    queueMicrotask(() => {
      agendado = false;
      aoMudar(lerSelecao(doc));
    });
  };
  doc.addEventListener('click', notificar, true);
  doc.addEventListener('change', notificar, true);
  return () => {
    doc.removeEventListener('click', notificar, true);
    doc.removeEventListener('change', notificar, true);
  };
}
