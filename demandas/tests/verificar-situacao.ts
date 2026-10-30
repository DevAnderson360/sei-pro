import { diasDeAtraso, prazoDe, situacaoBase, situacaoDe } from "../src/modelo/situacao";
import { demanda, HOJE } from "./fabrica";
import { checar, secao } from "./util";

export function verificarSituacao(): void {
  secao("Situacao derivada das datas");
  checar("sem nada = nao iniciada", situacaoDe(demanda({ id: "a" })) === "nao_iniciada");
  checar("com inicio = iniciada", situacaoDe(demanda({ id: "a", iniciadaEm: 5 })) === "iniciada");
  checar("pausa aberta = pausada", situacaoDe(demanda({ id: "a", iniciadaEm: 5, pausas: [{ inicio: 6 }] })) === "pausada");
  checar("pausa fechada volta a iniciada", situacaoDe(demanda({ id: "a", iniciadaEm: 5, pausas: [{ inicio: 6, fim: 7 }] })) === "iniciada");
  checar("concluida", situacaoDe(demanda({ id: "a", iniciadaEm: 5, concluidaEm: "2026-10-10" })) === "concluida");
  const aval = { nota: 4 as const, por: "ana", em: 9 };
  checar("avaliada vence concluida", situacaoDe(demanda({ id: "a", concluidaEm: "2026-10-10", avaliacao: aval })) === "avaliada");
  checar(
    "arquivada vence tudo",
    situacaoDe(demanda({ id: "a", concluidaEm: "2026-10-10", avaliacao: aval, arquivadoEm: 9 })) === "arquivada",
  );
  checar(
    "situacaoBase ignora o arquivamento",
    situacaoBase(demanda({ id: "a", concluidaEm: "2026-10-10", arquivadoEm: 9 })) === "concluida",
  );

  secao("Semaforo do prazo");
  checar("prazo hoje ainda no prazo", prazoDe(demanda({ id: "a", prazo: HOJE }), HOJE) === "no_prazo");
  checar("prazo ontem atrasada", prazoDe(demanda({ id: "a", prazo: "2026-10-11" }), HOJE) === "atrasada");
  checar("dias de atraso", diasDeAtraso(demanda({ id: "a", prazo: "2026-10-07" }), HOJE) === 5);
  checar("sem atraso = 0", diasDeAtraso(demanda({ id: "a", prazo: "2026-10-30" }), HOJE) === 0);
  checar(
    "concluida no prazo",
    prazoDe(demanda({ id: "a", prazo: "2026-10-20", concluidaEm: "2026-10-20" }), HOJE) === "concluida_no_prazo",
  );
  checar(
    "concluida fora do prazo",
    prazoDe(demanda({ id: "a", prazo: "2026-10-05", concluidaEm: "2026-10-06" }), HOJE) === "concluida_fora_do_prazo",
  );
  checar(
    "concluida nao conta como atrasada mesmo com prazo vencido",
    diasDeAtraso(demanda({ id: "a", prazo: "2026-10-05", concluidaEm: "2026-10-06" }), HOJE) === 0,
  );
}
