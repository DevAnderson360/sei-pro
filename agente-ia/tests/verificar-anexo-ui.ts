/**
 * A tela do anexo, montada de verdade (linkedom): o chip mostra páginas e
 * tamanho, oferece "Cortar em 60 mil" só quando passa disso, e o andamento da
 * leitura tem como cancelar.
 */

import { DOMParser } from "linkedom";
import { andamentoDoAnexo, chipDoAnexo } from "../src/painel/anexo-ui";
import { checar, secao } from "./util";

export function verificarAnexoUi(): void {
  const doc = new DOMParser().parseFromString("<html><body></body></html>", "text/html") as unknown as Document;
  (globalThis as { document?: Document }).document = doc;
  const botao = (raiz: ParentNode, texto: string) => [...raiz.querySelectorAll("button")].find((b) => b.textContent === texto) as HTMLButtonElement | undefined;

  secao("Anexo: chip");
  let cortou = 0;
  let removeu = 0;
  const acoes = { cortar: () => void (cortou += 1), remover: () => void (removeu += 1) };
  const grande = chipDoAnexo({ nome: "parecer.pdf", texto: "x".repeat(312_000), paginas: 140, modo: "inteiro" }, acoes);
  checar("chip mostra nome, páginas e caracteres", Boolean(grande.textContent?.includes("parecer.pdf — 140 páginas · 312.000 caracteres")), grande.textContent);
  checar("chip grande avisa os tokens", Boolean(grande.textContent?.includes("cerca de 78 mil tokens") || grande.textContent?.includes("o modelo leu")), grande.textContent);
  const cortar = botao(grande, "Cortar em 60 mil");
  checar("chip grande oferece cortar", Boolean(cortar));
  cortar?.click();
  checar("cortar chama a ação", cortou === 1);
  (grande.querySelector('[aria-label="Remover anexo"]') as HTMLButtonElement | null)?.click();
  checar("remover chama a ação", removeu === 1);
  const pequeno = chipDoAnexo({ nome: "nota.txt", texto: "y".repeat(10_000), modo: "inteiro" }, acoes);
  checar("chip pequeno não oferece cortar", !botao(pequeno, "Cortar em 60 mil"));
  checar("chip de texto sem páginas", Boolean(pequeno.textContent?.includes("nota.txt — 10.000 caracteres")), pequeno.textContent);
  const cortado = chipDoAnexo({ nome: "parecer.pdf", texto: "x".repeat(312_000), paginas: 140, modo: "cortado" }, acoes);
  checar("chip cortado não oferece cortar de novo", !botao(cortado, "Cortar em 60 mil") && Boolean(cortado.textContent?.includes("Cortado")), cortado.textContent);

  const naoLidas = chipDoAnexo({ nome: "scan.pdf", texto: "[p\u00E1gina 1]\nabc", paginas: 30, modo: "inteiro", naoLidas: [2, 3, 4, 30], motivoNaoLidas: "este navegador n\u00E3o faz OCR" }, acoes);
  checar("chip diz as páginas não lidas e o motivo", Boolean(naoLidas.textContent?.includes("4 p\u00E1ginas n\u00E3o foram lidas (2\u20134, 30): este navegador n\u00E3o faz OCR.")), naoLidas.textContent);
  const umaSo = chipDoAnexo({ nome: "scan.pdf", texto: "abc", paginas: 2, modo: "inteiro", naoLidas: [2] }, acoes);
  checar("chip com uma página não lida", Boolean(umaSo.textContent?.includes("1 p\u00E1gina n\u00E3o foi lida (2).")), umaSo.textContent);

  secao("Anexo: andamento");
  let cancelou = 0;
  const a = andamentoDoAnexo("scan.pdf", () => void (cancelou += 1));
  a.atualizar({ fase: "ocr", feitas: 7, total: 32 });
  checar("andamento do OCR", Boolean(a.elemento.textContent?.includes("OCR: página 7 de 32")), a.elemento.textContent);
  a.atualizar({ fase: "texto", feitas: 12, total: 80 });
  checar("andamento da leitura", Boolean(a.elemento.textContent?.includes("Lendo o texto: página 12 de 80")), a.elemento.textContent);
  botao(a.elemento, "Cancelar leitura")?.click();
  checar("cancelar leitura", cancelou === 1);
}
