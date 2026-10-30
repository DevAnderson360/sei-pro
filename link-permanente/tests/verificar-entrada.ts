/**
 * Provas da leitura da entrada deixada pelo Processos em Lote: consome uma vez
 * (lê e apaga) e nunca lança, para um storage com defeito não travar a janela.
 */

import { areaMemoria } from "@comum/armazenamento/area";
import { lerEntradaPendente } from "@lp/app/entrada";
import { CHAVE_ENTRADA } from "@lp/modelo/constantes";
import { checar, secao } from "./util";

export async function verificarEntrada(): Promise<void> {
  secao("Entrada pendente: consumo único");
  {
    const area = areaMemoria({ [CHAVE_ENTRADA]: "123\n456" });
    checar("devolve o texto gravado", (await lerEntradaPendente(area)) === "123\n456");
    checar("apaga a chave", !(CHAVE_ENTRADA in (await area.obter(CHAVE_ENTRADA))));
    checar("segunda leitura: null", (await lerEntradaPendente(area)) === null);
  }
  {
    const vazia = areaMemoria();
    checar("sem chave: null", (await lerEntradaPendente(vazia)) === null);
  }

  secao("Entrada pendente: valores inválidos");
  for (const [nome, valor] of [
    ["número", 42],
    ["objeto", { a: 1 }],
    ["lista", ["1"]],
    ["texto vazio", ""],
    ["null", null],
  ] as const) {
    const area = areaMemoria({ [CHAVE_ENTRADA]: valor });
    checar(`${nome}: null`, (await lerEntradaPendente(area)) === null);
    checar(`${nome}: chave apagada`, !(CHAVE_ENTRADA in (await area.obter(CHAVE_ENTRADA))));
  }

  secao("Entrada pendente: falha do storage");
  {
    const base = areaMemoria({ [CHAVE_ENTRADA]: "1" });
    const quebraLeitura = { ...base, obter: async () => Promise.reject(new Error("storage fora")) };
    checar("falha ao ler: null, sem lançar", (await lerEntradaPendente(quebraLeitura)) === null);
    const quebraRemocao = { ...base, remover: async () => Promise.reject(new Error("sem remover")) };
    checar("falha ao remover: null (sem consumo único não repete), sem lançar", (await lerEntradaPendente(quebraRemocao)) === null);
  }
}
