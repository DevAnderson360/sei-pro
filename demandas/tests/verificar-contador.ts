/** O selo da aba Demandas do lateral: so as MINHAS, abertas e atrasadas, ate o teto; o gravador so grava quando muda. */

import { areaMemoria } from "@comum/armazenamento/area";
import { CHAVE_CONTADOR_DEMANDAS, TETO_CONTADOR_DEMANDAS } from "@comum/painel/contadores";
import { contarAtrasadasMinhas, gravadorDoContador } from "../src/app/contador";
import { type DemandaNaTela, naTela } from "../src/app/dados";
import type { Demanda, Vis } from "../src/modelo/tipos";
import { demanda, HOJE } from "./fabrica";
import { checar, secao, tique } from "./util";

const ana = { login: "ana", nome: "Ana Lima" };
const item = (m: Partial<Demanda> & { id: string }, vis: Vis = "unidade"): DemandaNaTela => naTela(demanda(m), vis, HOJE);

export async function verificarContador(): Promise<void> {
  secao("contador: so as minhas atrasadas e abertas");
  const lista = [
    item({ id: "1", responsavel: ana, prazo: "2026-10-05" }),
    item({ id: "2", responsavel: { login: "ANA", nome: "outro nome" }, prazo: "2026-10-11" }, "eu"),
    item({ id: "3", responsavel: { nome: "ana  lima" }, prazo: "2026-10-01" }),
    item({ id: "4", responsavel: { login: "carla", nome: "Carla" }, prazo: "2026-10-05" }),
    item({ id: "5", prazo: "2026-10-05" }),
    item({ id: "6", responsavel: ana, prazo: "2026-10-05", concluidaEm: "2026-10-04" }),
    item({ id: "7", responsavel: ana, prazo: "2026-10-05", arquivadoEm: 5 }),
    item({ id: "8", responsavel: ana, prazo: "2026-10-12" }),
    item({ id: "9", responsavel: ana, prazo: "2026-10-30" }),
  ];
  checar(
    "login igual (sem caixa) e, sem login, nome igual: so as abertas e vencidas",
    contarAtrasadasMinhas(lista, ana) === 3,
    contarAtrasadasMinhas(lista, ana),
  );
  checar(
    "de outro, sem responsavel, concluida, arquivada, vence hoje e no prazo: fora",
    contarAtrasadasMinhas([lista[3]!, lista[4]!, lista[5]!, lista[6]!, lista[7]!, lista[8]!], ana) === 0,
  );
  checar("o selo e limitado pelo teto", contarAtrasadasMinhas(lista, ana, 2) === 2 && TETO_CONTADOR_DEMANDAS === 60000);
  checar("lista vazia: zero", contarAtrasadasMinhas([], ana) === 0);

  secao("contador: o gravador so grava quando muda");
  const area = areaMemoria();
  let gravacoes = 0;
  const original = area.gravar.bind(area);
  area.gravar = async (v) => {
    gravacoes += 1;
    return original(v);
  };
  const grava = gravadorDoContador(area);
  const valor = async () => (await area.obter(CHAVE_CONTADOR_DEMANDAS))[CHAVE_CONTADOR_DEMANDAS];
  await grava(2);
  await grava(2);
  checar("o mesmo valor duas vezes: uma gravacao", gravacoes === 1 && (await valor()) === 2);
  await grava(0);
  checar("zero tira o numero (grava 0)", gravacoes === 2 && (await valor()) === 0);
  await grava(Number.NaN);
  await grava(Number.POSITIVE_INFINITY);
  checar("valor torto: ignorado", gravacoes === 2);
  await grava(1e9);
  checar("acima do teto: grava o teto", (await valor()) === TETO_CONTADOR_DEMANDAS);
  await grava(-4);
  checar("negativo: zero; fracao: inteiro", (await valor()) === 0);
  await grava(3.9);
  checar("3.9 vira 3", (await valor()) === 3);

  secao("contador: gravacao recusada tenta de novo na proxima contagem");
  const ruim = areaMemoria();
  let recusar = true;
  let tentativas = 0;
  const gravarOriginal = ruim.gravar.bind(ruim);
  ruim.gravar = async (v) => {
    tentativas += 1;
    if (recusar) throw new Error("cota cheia");
    return gravarOriginal(v);
  };
  const g2 = gravadorDoContador(ruim);
  await g2(4);
  await tique(1);
  checar("recusada: nao rejeita", tentativas === 1);
  recusar = false;
  await g2(4);
  checar(
    "o mesmo valor volta a ser gravado",
    tentativas === 2 && (await ruim.obter(CHAVE_CONTADOR_DEMANDAS))[CHAVE_CONTADOR_DEMANDAS] === 4,
  );
  await g2(4);
  checar("e depois nao repete", tentativas === 2);
}
