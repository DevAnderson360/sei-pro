/**
 * Os icones que os outros modulos do SEI Pro (Monitorados, Projetos, Demandas) injetam na linha NATIVA do Controle
 * de Processos. A linha nativa continua no DOM (so oculta), entao ela e a fonte de verdade: a grade CLONA o icone
 * pronto (mesmo desenho, mesmo estado) e o clique chega ao modulo dono, que o resolve pela linha nativa
 * (`data-spro-id`). Assim nada e reimplementado aqui e o balao de cada modulo abre ancorado no icone da grade.
 */
const ICONES = '.spro-fav-estrela, .spro-prj-ic, .spro-dem-cx';
const MARCADORES_CSS = ['.spro-fav-', '.spro-prj-', '.spro-dem-cx'];

const celulaDeIcones = (doc: Document, id: string): Element | undefined => doc.getElementById(`P${id}`)?.querySelectorAll('td')[1];

const ORDEM = ['spro-fav-estrela', 'spro-prj-ic', 'spro-dem-cx'];
const tipoDe = (el: Element): string => ORDEM.find((c) => el.classList.contains(c)) ?? '';

/** Copia o estado do icone nativo para o clone SEM troca-lo de lugar: o balao do modulo esta ancorado nele. */
function sincronizarClone(clone: HTMLElement, nativo: HTMLElement, id: string): void {
  for (const a of Array.from(clone.attributes)) if (!nativo.hasAttribute(a.name) && a.name !== 'data-spro-id' && a.name !== 'data-tip') clone.removeAttribute(a.name);
  for (const a of Array.from(nativo.attributes)) if (a.name !== 'aria-busy' && a.name !== 'title' && clone.getAttribute(a.name) !== a.value) clone.setAttribute(a.name, a.value);
  if (nativo.getAttribute('title') && clone.getAttribute('data-tip') !== nativo.getAttribute('title')) clone.setAttribute('data-tip', nativo.getAttribute('title')!);
  clone.removeAttribute('aria-busy');
  clone.setAttribute('data-spro-id', id);
  if (clone.innerHTML !== nativo.innerHTML) clone.replaceChildren(...Array.from(nativo.cloneNode(true).childNodes));
}

/**
 * Um clonador com memoria: o MESMO elemento serve a mesma linha e o mesmo modulo enquanto ela existir. Redesenhar a
 * grade nao pode trocar o icone em que um balao (monitorado, projeto, demanda) esta ancorado: o balao iria para o
 * canto da tela.
 */
export function criarClonador() {
  const guardados = new Map<string, HTMLElement>();
  return function clonarIcones(doc: Document, id: string): HTMLElement[] {
    const td = celulaDeIcones(doc, id);
    const usados = new Set<string>();
    const saida: HTMLElement[] = [];
    if (td) {
      const nativos = [...td.querySelectorAll<HTMLElement>(ICONES)].sort((a, b) => ORDEM.indexOf(tipoDe(a)) - ORDEM.indexOf(tipoDe(b)));
      for (const nativo of nativos) {
        const chave = `${id}|${tipoDe(nativo)}`;
        usados.add(chave);
        let clone = guardados.get(chave);
        if (clone) sincronizarClone(clone, nativo, id);
        else {
          clone = nativo.cloneNode(true) as HTMLElement;
          clone.removeAttribute('aria-busy');
          clone.setAttribute('data-spro-id', id);
          guardados.set(chave, clone);
        }
        saida.push(clone);
      }
    }
    for (const t of ORDEM) if (!usados.has(`${id}|${t}`)) guardados.delete(`${id}|${t}`);
    return saida;
  };
}

/** Muda quando um icone aparece, some ou troca de estado: serve para saber se a linha precisa ser redesenhada. */
export function assinaturaIcones(doc: Document, id: string): string {
  const td = celulaDeIcones(doc, id);
  return td ? [...td.querySelectorAll<HTMLElement>(`${ICONES}, .acompanhamentoesp_icon`)].map((e) => `${e.className}|${e.getAttribute('aria-pressed') ?? ''}|${e.getAttribute('aria-label') ?? ''}|${e.hasAttribute('data-atraso') ? 1 : 0}|${e.querySelector('[class$="-n"]')?.textContent ?? ''}`).join(';') : '';
}

/** As regras de CSS dos modulos que cuidam desses icones (o Shadow DOM da grade nao enxerga o CSS da pagina). */
export function estilosDosModulos(doc: Document): string {
  const regras: string[] = [];
  for (const folha of Array.from(doc.styleSheets ?? [])) {
    let lista: CSSRuleList;
    try {
      lista = folha.cssRules;
    } catch {
      continue; // folha de outra origem
    }
    for (const r of Array.from(lista)) {
      const t = r.cssText;
      if (MARCADORES_CSS.some((m) => t.includes(m))) regras.push(t);
    }
  }
  return regras.join('\n');
}
