import { AZUL_PADRAO, contraste, deOklch, derivarBarra, PALETAS, paraOklch } from "../src/tema/paleta";
import { checar, secao } from "./util";

const FUNDO = { claro: "#ffffff", escuro: "#1a1d21" } as const;

/** PRNG semeado (mulberry32): o teste tem de ser repetível. */
function prng(semente: number): () => number {
  let a = semente;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hexAleatorio = (r: () => number) =>
  `#${[0, 0, 0]
    .map(() =>
      Math.floor(r() * 256)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

export function verificarPaleta(): void {
  secao("tema/paleta");

  checar("contraste preto/branco = 21", Math.abs(contraste("#000000", "#ffffff") - 21) < 0.01);
  checar("contraste igual = 1", Math.abs(contraste("#336699", "#336699") - 1) < 0.001);

  let piorRoundTrip = 0;
  const r = prng(42);
  for (let i = 0; i < 300; i++) {
    const hex = hexAleatorio(r);
    const volta = deOklch(paraOklch(hex));
    const d = [1, 3, 5].map((k) => Math.abs(Number.parseInt(hex.slice(k, k + 2), 16) - Number.parseInt(volta.slice(k, k + 2), 16)));
    piorRoundTrip = Math.max(piorRoundTrip, ...d);
  }
  checar("round-trip OKLCH <= 1/255", piorRoundTrip <= 1, piorRoundTrip);

  for (const esquema of ["claro", "escuro"] as const) {
    let pior = 99;
    let piorDest = 99;
    let invalida = 0;
    let menuRuim = 99;
    const g = prng(esquema === "claro" ? 7 : 11);
    const entradas = [
      ...Array.from({ length: 2000 }, () => hexAleatorio(g)),
      "#000000",
      "#ffffff",
      "#808080",
      "#ffff00",
      "#00ff00",
      "#ff0000",
      ...PALETAS.map((p) => p.cor),
    ];
    for (const cor of entradas) {
      const d = derivarBarra(cor, esquema);
      for (const v of Object.values(d)) if (!/^#[0-9a-f]{6}$/.test(v)) invalida++;
      pior = Math.min(pior, contraste(d.texto, d.barra));
      menuRuim = Math.min(menuRuim, contraste("#f2f4f7", d.menu));
      piorDest = Math.min(piorDest, contraste(d.destaque, FUNDO[esquema]));
    }
    checar(`${esquema}: todos os campos sao #rrggbb`, invalida === 0, invalida);
    checar(`${esquema}: texto/barra >= 4,5 (pior ${pior.toFixed(2)})`, pior >= 4.5);
    checar(`${esquema}: texto do menu/menu >= 4,5 (pior ${menuRuim.toFixed(2)})`, menuRuim >= 4.5);
    checar(`${esquema}: destaque/fundo >= 4,5 (pior ${piorDest.toFixed(2)})`, piorDest >= 4.5);
  }

  checar("cinza cai no azul padrao no destaque", derivarBarra("#808080", "claro").destaque === derivarBarra(AZUL_PADRAO, "claro").destaque);
  checar("matiz preservado na barra (verde)", Math.abs(paraOklch(derivarBarra("#1f7a4d", "claro").barra).h - paraOklch("#1f7a4d").h) < 6);
  checar("escuro nao ofusca: barra com L <= 0,42", paraOklch(derivarBarra("#ffff00", "escuro").barra).l <= 0.43);
  checar("18 paletas, ids unicos", PALETAS.length === 18 && new Set(PALETAS.map((p) => p.id)).size === 18);
  checar("hex invalido nao lanca", derivarBarra("xyz" as string, "claro").barra.startsWith("#"));
}
