/**
 * Avatar de uma pessoa (responsável de etapa, autor de alteração): círculo
 * com as iniciais e uma cor estável derivada do nome (o mesmo nome tem a mesma
 * cor em qualquer computador e tema). A paleta foi escolhida para o branco das
 * iniciais ter contraste de texto (4,5:1) e o círculo aparecer também sobre o
 * fundo escuro. Estilo em linha: serve na página da extensão e no Shadow DOM.
 */

import { hashCurto, normalizarTexto } from "../texto";
import { h } from "./dom";

export const PALETA_AVATAR: readonly string[] = [
  "#1e6fd9",
  "#2e7d32",
  "#00796b",
  "#0277bd",
  "#7c3aed",
  "#c2185b",
  "#b45309",
  "#546e7a",
  "#9333ea",
  "#4d7c0f",
  "#c2410c",
  "#0e7490",
];

/** Partículas que não viram inicial ("Maria da Silva" = MS). */
const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e", "di", "du", "van", "von"]);

/** Uma letra (nome de uma palavra) ou a primeira e a última ("Pedro Henrique Soares" = PS). Login vale ("pedro.soares" = PS). */
export function iniciais(nome: string): string {
  const base = nome.split("@")[0] ?? "";
  const palavras = base.split(/[\s._-]+/).filter((p) => p.length > 0);
  const uteis = palavras.filter((p) => !PARTICULAS.has(normalizarTexto(p)));
  const lista = uteis.length ? uteis : palavras;
  const primeira = (p: string | undefined) => (p ? (Array.from(p)[0] ?? "") : "");
  if (!lista.length) return "?";
  const texto = lista.length === 1 ? primeira(lista[0]) : `${primeira(lista[0])}${primeira(lista.at(-1))}`;
  return texto.toLocaleUpperCase("pt-BR");
}

/** A mesma cor para o mesmo nome (sem acento, caixa ou espaços a mais). */
export function corDoAvatar(nome: string): string {
  const i = Number.parseInt(hashCurto(normalizarTexto(nome)).slice(0, 6), 16) % PALETA_AVATAR.length;
  return PALETA_AVATAR[i] ?? "#1e6fd9";
}

export function avatar(nome: string, o: { tamanho?: number; rotulo?: string } = {}): HTMLSpanElement {
  const t = Math.max(12, Math.min(Math.round(o.tamanho ?? 20), 64));
  const rotulo = o.rotulo ?? nome;
  const el = h("span", { class: "spro-avatar", role: "img", title: rotulo, "aria-label": rotulo }, iniciais(nome));
  const estilo: Array<[string, string]> = [
    ["display", "inline-flex"],
    ["align-items", "center"],
    ["justify-content", "center"],
    ["flex", "none"],
    ["width", `${t}px`],
    ["height", `${t}px`],
    ["border-radius", "50%"],
    ["background-color", corDoAvatar(nome)],
    ["color", "#ffffff"],
    ["font", `600 ${Math.round(t * 0.42)}px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`],
    ["letter-spacing", "0"],
    ["user-select", "none"],
  ];
  for (const [k, v] of estilo) el.style.setProperty(k, v);
  return el;
}
