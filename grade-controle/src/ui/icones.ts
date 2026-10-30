/** Ícones da grade que o conjunto comum não tem. Mesma convenção do `icone()` do sei-comum (traço, currentColor). */
const NS = 'http://www.w3.org/2000/svg';
type Forma = [string, Record<string, string>];

const FORMAS = {
  /** Tabela com cabeçalho: a visão nova. */
  grade: [
    ['rect', { x: '3.5', y: '4.5', width: '17', height: '15', rx: '2' }],
    ['path', { d: 'M3.5 9.5h17M9 9.5v10M3.5 14.5h17' }],
  ],
  /** Três colunas: o quadro. */
  quadro: [
    ['rect', { x: '3.5', y: '4.5', width: '4.6', height: '15', rx: '1.2' }],
    ['rect', { x: '9.7', y: '4.5', width: '4.6', height: '9', rx: '1.2' }],
    ['rect', { x: '15.9', y: '4.5', width: '4.6', height: '12', rx: '1.2' }],
  ],
  lista: [['path', { d: 'M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01' }]],
  agrupar: [
    ['path', { d: 'M4 6h16M4 12h10M4 18h13' }],
    ['path', { d: 'M18 10l3 2-3 2' }],
  ],
  colunas: [
    ['rect', { x: '3.5', y: '4.5', width: '17', height: '15', rx: '2' }],
    ['path', { d: 'M9.2 4.5v15M14.8 4.5v15' }],
  ],
  disquete: [
    ['path', { d: 'M5 4.5h11l3.5 3.5v11a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 19z' }],
    ['path', { d: 'M8 4.5v5h7v-5M8 20v-6h8v6' }],
  ],
  densidade: [['path', { d: 'M4 6h16M4 10h16M4 14h16M4 18h16' }]],
  semPessoa: [
    ['circle', { cx: '12', cy: '8.5', r: '3.6' }],
    ['path', { d: 'M5 20c.8-3.6 3.5-5.5 7-5.5s6.2 1.9 7 5.5M4 4l16 16' }],
  ],
  olhoFechado: [
    ['path', { d: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z' }],
    ['circle', { cx: '12', cy: '12', r: '2.8' }],
    ['path', { d: 'M4 4l16 16' }],
  ],
  /** Caixa de entrada: processo recebido. */
  recebido: [
    ['path', { d: 'M4 13.5l2.2-7A1.6 1.6 0 0 1 7.7 5.4h8.6a1.6 1.6 0 0 1 1.5 1.1l2.2 7' }],
    ['path', { d: 'M4 13.5V18a1.6 1.6 0 0 0 1.6 1.6h12.8A1.6 1.6 0 0 0 20 18v-4.5h-4.6a3.4 3.4 0 0 1-6.8 0z' }],
  ],
  /** Folha com seta para fora: processo gerado (autuado) pela unidade. */
  gerado: [
    ['path', { d: 'M14 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V7.5z' }],
    ['path', { d: 'M14 3.5V7.5h4M9.5 14.5h5M9.5 17h3' }],
    ['path', { d: 'M9.5 11.5l2-2 2 2M11.5 9.5v3.5' }],
  ],
  novaGuia: [
    ['path', { d: 'M14 4.5h5.5V10M19.5 4.5L11 13' }],
    ['path', { d: 'M17.5 14v4a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V8A1.5 1.5 0 0 1 6 6.5h4' }],
  ],
  prioridade: [
    ['circle', { cx: '12', cy: '12', r: '8.5' }],
    ['path', { d: 'M12 7.5v5.5M12 16.4h.01' }],
  ],
  seta: [['path', { d: 'M6 9l6 6 6-6' }]],
  setaDireita: [['path', { d: 'M9 6l6 6-6 6' }]],
  desfazer: [['path', { d: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3' }]],
  bloquear: [
    ['circle', { cx: '12', cy: '12', r: '8.5' }],
    ['path', { d: 'M6 6l12 12' }],
  ],
  informacao: [
    ['circle', { cx: '12', cy: '12', r: '8.5' }],
    ['path', { d: 'M12 11v5M12 8h.01' }],
  ],
} satisfies Record<string, Forma[]>;

export type NomeIconeGrade = keyof typeof FORMAS;

export function iconeGrade(nome: NomeIconeGrade, tamanho = 16, doc: Document = document): SVGSVGElement {
  const svg = doc.createElementNS(NS, 'svg');
  const base: Record<string, string> = {
    viewBox: '0 0 24 24', width: String(tamanho), height: String(tamanho), fill: 'none', stroke: 'currentColor',
    'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', class: 'spro-icone',
  };
  for (const [k, v] of Object.entries(base)) svg.setAttribute(k, v);
  for (const [tag, attrs] of FORMAS[nome] as Forma[]) {
    const el = doc.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}
