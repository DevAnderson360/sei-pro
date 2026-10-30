import type { Forma } from "@comum/ui/dom";

/**
 * Ícones que o conjunto dos painéis não tem e a casca do SEI precisa. Mesma grade (24 px), mesmo traço
 * (arredondado, 1,8) e mesma linguagem: contorno, sem preenchimento, salvo detalhes pequenos.
 */

/** Engrenagem por geometria: `dentes` dentes entre o raio interno e o externo, mais o furo central. */
export function engrenagem(dentes = 8, interno = 6.4, externo = 8.6): Forma[] {
  const pontos: string[] = [];
  const passo = (Math.PI * 2) / dentes;
  const f = (n: number) => Number(n.toFixed(2));
  for (let i = 0; i < dentes; i++) {
    const a = i * passo - Math.PI / 2;
    for (const [r, d] of [
      [interno, -0.32],
      [externo, -0.2],
      [externo, 0.2],
      [interno, 0.32],
    ] as const) {
      const ang = a + d * passo * 1.2;
      pontos.push(`${f(12 + r * Math.cos(ang))} ${f(12 + r * Math.sin(ang))}`);
    }
  }
  return [
    ["path", { d: `M${pontos.join("L")}z` }],
    ["circle", { cx: "12", cy: "12", r: "2.7" }],
  ];
}

export const ICONES_EXTRAS = {
  engrenagem: engrenagem(),
  livro: [
    ["path", { d: "M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" }],
    ["path", { d: "M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" }],
    ["path", { d: "M9 7.5h6" }],
  ],
  lista: [
    ["path", { d: "M9.5 6.5H20M9.5 12H20M9.5 17.5H20" }],
    ["circle", { cx: "4.8", cy: "6.5", r: "1", fill: "currentColor" }],
    ["circle", { cx: "4.8", cy: "12", r: "1", fill: "currentColor" }],
    ["circle", { cx: "4.8", cy: "17.5", r: "1", fill: "currentColor" }],
  ],
  pessoas: [
    ["circle", { cx: "9", cy: "8.2", r: "3.2" }],
    ["path", { d: "M3.2 19.2a5.8 5.8 0 0 1 11.6 0" }],
    ["circle", { cx: "17.2", cy: "9", r: "2.4" }],
    ["path", { d: "M16.4 13.6a4.7 4.7 0 0 1 4.6 4.2" }],
  ],
  pastaMais: [
    ["path", { d: "M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" }],
    ["path", { d: "M12 11v5M9.5 13.5h5" }],
  ],
  escudoCheck: [
    ["path", { d: "M12 3 5 6v5.5c0 4.4 3 7.9 7 9.5 4-1.6 7-5.1 7-9.5V6z" }],
    ["path", { d: "m9.2 12 2 2 3.6-3.8" }],
  ],
  escudo: [["path", { d: "M12 3 5 6v5.5c0 4.4 3 7.9 7 9.5 4-1.6 7-5.1 7-9.5V6z" }]],
  bandeira: [
    ["path", { d: "M5.5 21V4.2" }],
    ["path", { d: "M5.5 4.8c2.4-1.2 4.6-1.2 7 0s4.6 1.2 7 0v8.6c-2.4 1.2-4.6 1.2-7 0s-4.6-1.2-7 0" }],
  ],
  pausa: [
    ["circle", { cx: "12", cy: "12", r: "9" }],
    ["path", { d: "M10 9v6M14 9v6" }],
  ],
  retorno: [["path", { d: "M4 9h13l-3-3M20 15H7l3 3" }]],
  codigo: [["path", { d: "m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.2 6.5l-2.4 11" }]],
  megafone: [
    ["path", { d: "M4 10v4a1 1 0 0 0 1 1h2.5l6 4V5l-6 4H5a1 1 0 0 0-1 1z" }],
    ["path", { d: "M17.2 9.4a3.6 3.6 0 0 1 0 5.2" }],
  ],
  acessibilidade: [
    ["circle", { cx: "12", cy: "5", r: "1.8" }],
    ["path", { d: "M5 8.5l7 1.6 7-1.6M12 10.2V15m0 0-3 6m3-6 3 6" }],
  ],
  enviar: [["path", { d: "M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z" }]],
  pessoaMais: [
    ["circle", { cx: "9.5", cy: "8", r: "3.4" }],
    ["path", { d: "M3.5 19.5a6 6 0 0 1 12 0" }],
    ["path", { d: "M19 8v6M16 11h6" }],
  ],
  blocoMais: [
    ["path", { d: "M12 3 3.5 7.5 12 12l8.5-4.5z" }],
    ["path", { d: "M3.5 12 12 16.5l3.5-1.9" }],
    ["path", { d: "M19 15v6M16 18h6" }],
  ],
  documentoMais: [
    ["path", { d: "M6 3.5h8.5L19 8v12.5H6z" }],
    ["path", { d: "M14.5 3.5V8H19" }],
    ["path", { d: "M12.5 11.5v5M10 14h5" }],
  ],
  etiquetaMais: [
    ["path", { d: "M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l7.3 7.3" }],
    ["circle", { cx: "8", cy: "8", r: "1.4", fill: "currentColor" }],
    ["path", { d: "M18.5 15.5v6M15.5 18.5h6" }],
  ],
  etiquetaMenos: [
    ["path", { d: "M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l7.3 7.3" }],
    ["circle", { cx: "8", cy: "8", r: "1.4", fill: "currentColor" }],
    ["path", { d: "M15.5 18.5h6" }],
  ],
  concluir: [
    ["circle", { cx: "12", cy: "12", r: "9" }],
    ["path", { d: "m8.4 12.3 2.4 2.4 4.8-5.1" }],
  ],
  chave: [
    ["circle", { cx: "8", cy: "15.5", r: "4" }],
    ["path", { d: "m10.8 12.7 9.2-9.2M17 6.5l3 3M14.5 9l2 2" }],
  ],
  robo: [
    ["rect", { x: "4.5", y: "8", width: "15", height: "10.5", rx: "3.2" }],
    ["path", { d: "M12 4.3V8" }],
    ["circle", { cx: "12", cy: "3.6", r: "1", fill: "currentColor" }],
    ["circle", { cx: "9", cy: "13", r: "1.1", fill: "currentColor" }],
    ["circle", { cx: "15", cy: "13", r: "1.1", fill: "currentColor" }],
    ["path", { d: "M2.8 12v2M21.2 12v2" }],
  ],
  fluxo: [
    ["rect", { x: "3.5", y: "3.8", width: "7", height: "5.2", rx: "1.4" }],
    ["rect", { x: "13.5", y: "15", width: "7", height: "5.2", rx: "1.4" }],
    ["path", { d: "M7 9v3.5h10V15" }],
  ],
  seta: [["path", { d: "M9 6l6 6-6 6" }]],
  assinar: [
    ["path", { d: "M16.5 3.2l4.3 4.3L10.2 18.1l-4.7 1 1-4.7z" }],
    ["path", { d: "m14.2 5.5 4.3 4.3" }],
    ["path", { d: "M2.8 21.3c1.6-1.5 2.7-1.5 3.3 0s1.7 1.3 2.7-.4 2.3-1.3 3.3.2" }],
  ],
  documentoLupa: [
    ["path", { d: "M6 3.5h8.5L19 8v4.5" }],
    ["path", { d: "M14.5 3.5V8H19" }],
    ["path", { d: "M6 3.5v17h5.5" }],
    ["circle", { cx: "15.4", cy: "16.4", r: "3.2" }],
    ["path", { d: "m17.8 18.8 3 3" }],
  ],
  documentoLapis: [
    ["path", { d: "M6 3.5h8.5L19 8v3.5" }],
    ["path", { d: "M14.5 3.5V8H19" }],
    ["path", { d: "M6 3.5v17h6" }],
    ["path", { d: "M9 10.5h4M9 14h2.5" }],
    ["path", { d: "M17.9 12.6a1.6 1.6 0 0 1 2.3 2.3l-6.7 6.7-3 .8.8-3z" }],
  ],
  certidao: [
    ["path", { d: "M6 3.5h8.5L19 8v5.5" }],
    ["path", { d: "M14.5 3.5V8H19" }],
    ["path", { d: "M6 3.5v17h6" }],
    ["circle", { cx: "16.2", cy: "16.6", r: "3.1" }],
    ["path", { d: "m14.9 19.1-.9 2.4 2.2-1.1 2.2 1.1-.9-2.4" }],
  ],
  desativar: [
    ["circle", { cx: "12", cy: "12", r: "9" }],
    ["path", { d: "m5.7 5.7 12.6 12.6" }],
  ],
  paginaAnterior: [["path", { d: "m15 6-6 6 6 6" }]],
  paginaPrimeira: [["path", { d: "m17 6-6 6 6 6M9 6v12" }]],
  paginaUltima: [["path", { d: "m7 6 6 6-6 6M15 6v12" }]],
  polegar: [
    ["path", { d: "M3.5 10.5h3.2v9.5H3.5z" }],
    ["path", { d: "M6.7 10.5 10.8 3.6c1.4 0 2.4 1.2 2.1 2.6L12.2 9.5H18a2 2 0 0 1 1.9 2.5l-1.6 6.3a2 2 0 0 1-1.9 1.5H6.7" }],
  ],
  selo: [
    ["circle", { cx: "12", cy: "9", r: "5.2" }],
    ["path", { d: "m9 13.6-1.3 7 4.3-2.3 4.3 2.3-1.3-7" }],
    ["path", { d: "m10.2 9 1.3 1.3 2.4-2.6" }],
  ],
  documentoX: [
    ["path", { d: "M6 3.5h8.5L19 8v12.5H6z" }],
    ["path", { d: "M14.5 3.5V8H19" }],
    ["path", { d: "m10 12.5 5 5M15 12.5l-5 5" }],
  ],
  email: [
    ["rect", { x: "3.5", y: "5.5", width: "17", height: "13", rx: "2.2" }],
    ["path", { d: "m4 7.8 8 5.8 8-5.8" }],
  ],
  pdf: [
    ["path", { d: "M6 3.5h8.5L19 8v12.5H6z" }],
    ["path", { d: "M14.5 3.5V8H19" }],
    ["path", { d: "M9 16.5h1.6a1.3 1.3 0 0 0 0-2.6H9v4M13.5 18v-4h1a2 2 0 0 1 0 4z" }],
  ],
  gerarPdf: [
    ["path", { d: "M6 3.5h8.5L19 8v12.5H6z" }],
    ["path", { d: "M14.5 3.5V8H19" }],
    ["path", { d: "M12.5 11.5V17m0 0-2-2m2 2 2-2" }],
  ],
  imprimir: [
    ["path", { d: "M7 8.5V3.5h10v5" }],
    ["rect", { x: "3.5", y: "8.5", width: "17", height: "8", rx: "2" }],
    ["path", { d: "M7 14h10v6.5H7z" }],
  ],
  comentario: [["path", { d: "M4 5.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6.5L7 20.5v-4H6a2 2 0 0 1-2-2z" }]],
  duplicar: [
    ["rect", { x: "8.5", y: "8.5", width: "12", height: "12", rx: "2" }],
    ["path", { d: "M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" }],
  ],
  link: [["path", { d: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" }]],
  ordenarLista: [["path", { d: "M4 6.5h16M4 12h10M4 17.5h6" }]],
} satisfies Record<string, Forma[]>;

export type NomeIconeExtra = keyof typeof ICONES_EXTRAS;
