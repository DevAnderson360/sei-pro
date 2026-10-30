import { gerarConteudoTexto } from "@comum/sincronia/textoPadraoCodec";
import { faixaDoTamanho } from "../src/modelo/alertas";
import { AVISO_TEXTO, TETO_TEXTO } from "../src/modelo/constantes";
import type { Demanda, EnvelopeDemandas } from "../src/modelo/tipos";
import { demanda } from "./fabrica";
import { checar, secao } from "./util";

/** Gerador determinístico: texto "de verdade" (pouco repetitivo), para a compressão não mentir. */
function sorteio(semente: number): () => number {
  let s = semente;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const PALAVRAS =
  "análise parecer nota técnica regulatório processo relatório minuta consulta pública contribuição resposta ofício encaminhamento diligência manifestação instrução decisão despacho prazo reunião norma resolução portaria edital contrato concessão tarifa fiscalização".split(
    " ",
  );
const frase = (r: () => number, n: number) => Array.from({ length: n }, () => PALAVRAS[Math.floor(r() * PALAVRAS.length)]).join(" ");

export function demandaTipica(i: number, r: () => number): Demanda {
  return demanda({
    id: `d${i.toString(36)}-${Math.floor(r() * 1e9).toString(36)}`,
    titulo: frase(r, 7),
    descricao: frase(r, 30),
    responsavel: { login: `usuario${i % 25}`, nome: `Servidor ${i % 25} da Silva` },
    etiquetas: [PALAVRAS[i % PALAVRAS.length]!, PALAVRAS[(i * 7) % PALAVRAS.length]!],
    processos: [
      {
        protocolo: `50300.${String(100000 + Math.floor(r() * 899999))}/2026-${String(10 + (i % 80))}`,
        idProcedimento: String(1000000 + Math.floor(r() * 8999999)),
      },
    ],
    checklist: Array.from({ length: 4 }, (_, k) => ({ id: `c${i}-${k}`, texto: frase(r, 4), feito: r() > 0.5 })),
    ordem: `a${i.toString(36)}`,
    atualizadoEm: 1_790_000_000_000 + i,
  });
}

async function bytesDoTexto(demandas: Demanda[]): Promise<number> {
  const env: EnvelopeDemandas = {
    formato: "seipro-demandas",
    versao: 1,
    tabela: "d",
    host: "sei.exemplo.gov.br",
    unidade: "110000001",
    vis: "unidade",
    gerado: 1,
    entidades: { d: demandas, h: [] },
  };
  return new TextEncoder().encode(await gerarConteudoTexto("Dados internos do SEI Pro.", env)).length;
}

export async function verificarEscala(): Promise<void> {
  secao("Escala: quanto cabe em um Texto Padrao (100 KB)");
  const r = sorteio(42);
  const tamanhos: Array<[number, number]> = [];
  for (const n of [100, 250, 500, 1000, 2000]) {
    const bytes = await bytesDoTexto(Array.from({ length: n }, (_, i) => demandaTipica(i, r)));
    tamanhos.push([n, bytes]);
    console.log(
      `  ${String(n).padStart(5)} demandas tipicas -> ${(bytes / 1024).toFixed(1)} KB (${faixaDoTamanho(bytes).percentual}% do teto, faixa ${faixaDoTamanho(bytes).faixa})`,
    );
  }
  checar(
    "o tamanho cresce com a quantidade",
    tamanhos.every(([, b], i) => i === 0 || b > tamanhos[i - 1]![1]),
  );
  checar(
    "as faixas respeitam os limites",
    faixaDoTamanho(AVISO_TEXTO).faixa === "aviso" && faixaDoTamanho(TETO_TEXTO).faixa === "bloqueio",
  );
}
