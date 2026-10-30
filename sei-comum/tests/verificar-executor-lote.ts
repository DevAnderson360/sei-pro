import { ExecutorLote, type ItemLote, RitmoAdaptativo, type SaidaItem } from "../src/lote/executor";
import { checar, secao } from "./util";

type It = ItemLote<number, number>;
const criar = (n: number): It[] =>
  Array.from({ length: n }, (_, i) => ({ indice: i, entrada: i, situacao: "pendente" as const, tentativas: 0 }));
const semEspera = async () => {};
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export async function verificarExecutorLote(): Promise<void> {
  secao("executor: concorrencia e ordem");
  {
    const itens = criar(7);
    let simult = 0;
    let maximo = 0;
    const ordem: number[] = [];
    const ex = new ExecutorLote<number, number>(itens, {
      concorrencia: 3,
      pausaMs: () => 0,
      esperar: semEspera,
      processar: async (e) => {
        ordem.push(e);
        simult += 1;
        maximo = Math.max(maximo, simult);
        await tick();
        simult -= 1;
        return { situacao: "ok", resultado: e * 2 };
      },
    });
    await ex.iniciar();
    checar("nunca mais de 3 simultaneos (e chegou a 3)", maximo === 3, maximo);
    checar("ordem de despacho e a dos indices", ordem.join() === "0,1,2,3,4,5,6", ordem);
    checar("estado concluido e progresso completo", ex.estado === "concluido" && ex.progresso.feitos === 7 && ex.progresso.falhas === 0);
    checar("resultado gravado", itens[3]?.resultado === 6 && itens[3]?.tentativas === 1);
  }

  secao("executor: cancelar com itens em voo");
  {
    const itens = criar(5);
    const liberar: Array<() => void> = [];
    const ex = new ExecutorLote<number, number>(itens, {
      concorrencia: 2,
      pausaMs: () => 0,
      esperar: semEspera,
      processar: (e) =>
        new Promise<SaidaItem<number>>((r) => {
          liberar.push(() => r({ situacao: "ok", resultado: e }));
        }),
    });
    const fim = ex.iniciar();
    await tick();
    checar("2 em voo", liberar.length === 2, liberar.length);
    ex.cancelar();
    for (const l of liberar) l();
    await fim;
    checar("os 2 em voo viraram ok", itens[0]?.situacao === "ok" && itens[1]?.situacao === "ok");
    checar(
      "o resto continua pendente",
      itens.slice(2).every((i) => i.situacao === "pendente"),
    );
    checar("estado cancelado", ex.estado === "cancelado");
  }

  secao("executor: pausar e continuar");
  {
    const itens = criar(5);
    const vistos: number[] = [];
    const ex: ExecutorLote<number, number> = new ExecutorLote<number, number>(itens, {
      concorrencia: 1,
      pausaMs: () => 0,
      esperar: semEspera,
      processar: async (e) => {
        vistos.push(e);
        if (e === 1) ex.pausar();
        return { situacao: "ok" };
      },
    });
    await ex.iniciar();
    checar("pausou depois do item 1", ex.estado === "pausado" && vistos.join() === "0,1", vistos);
    await ex.continuar();
    checar("retomou sem repetir ok", vistos.join() === "0,1,2,3,4" && ex.estado === "concluido", vistos);
  }

  secao("executor: saida com parar");
  {
    const itens = criar(4);
    const ex = new ExecutorLote<number, number>(itens, {
      concorrencia: 1,
      pausaMs: () => 0,
      esperar: semEspera,
      processar: async (e) => (e === 1 ? { situacao: "erro", erro: "captcha", parar: true } : { situacao: "ok" }),
    });
    await ex.iniciar();
    checar("registrou o item antes de pausar", itens[1]?.situacao === "erro" && itens[1]?.erro === "captcha");
    checar("estado pausado e restante pendente", ex.estado === "pausado" && itens[2]?.situacao === "pendente");
  }

  secao("executor: excecao e repetirFalhas");
  {
    const itens = criar(4);
    let falha = true;
    const notas: number[] = [];
    const ex = new ExecutorLote<number, number>(itens, {
      concorrencia: 2,
      pausaMs: () => 0,
      esperar: semEspera,
      aoMudar: (i) => notas.push(i.indice),
      processar: async (e) => {
        if (e === 1 && falha) throw new Error("boom");
        if (e === 2) return { situacao: "nao-encontrado" };
        return { situacao: "ok" };
      },
    });
    await ex.iniciar();
    checar("excecao vira erro com a mensagem", itens[1]?.situacao === "erro" && itens[1]?.erro === "boom");
    checar("o lote seguiu", itens[3]?.situacao === "ok" && ex.estado === "concluido");
    checar("falhas contadas", ex.progresso.falhas === 1, ex.progresso);
    checar("aoMudar avisou cada item", notas.length === 4, notas);
    falha = false;
    await ex.repetirFalhas();
    checar("repetiu so o erro", itens[1]?.situacao === "ok" && itens[1]?.tentativas === 2);
    checar("nao-encontrado nao foi repetido", itens[2]?.situacao === "nao-encontrado" && itens[2]?.tentativas === 1);
    checar("ok anteriores nao foram repetidos", itens[0]?.tentativas === 1 && itens[3]?.tentativas === 1);
  }

  secao("ritmo adaptativo");
  {
    const r = new RitmoAdaptativo(500, 3000);
    for (let i = 0; i < 5; i += 1) r.registrar(600);
    checar("linha de base nao muda a pausa", r.pausaMs() === 500);
    r.registrar(1400);
    r.registrar(1400);
    checar("lento sobe a pausa para >= 1000", r.pausaMs() >= 1000, r.pausaMs());
    for (let i = 0; i < 6; i += 1) r.registrar(1400);
    checar("nunca passa do teto", r.pausaMs() === 3000, r.pausaMs());
    for (let i = 0; i < 3; i += 1) r.registrar(650);
    checar("volta a 500 quando normaliza", r.pausaMs() === 500, r.pausaMs());
  }
}
