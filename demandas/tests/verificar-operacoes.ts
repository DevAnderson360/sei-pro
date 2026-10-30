import {
  arquivar,
  avaliar,
  cancelarAvaliacao,
  concluir,
  dadosQueOMovimentoPede,
  desarquivar,
  type ErroOperacao,
  iniciar,
  moverPara,
  movimentoPermitido,
  pausar,
  prorrogar,
  reabrir,
  retomar,
  voltarANaoIniciada,
} from "../src/modelo/operacoes";
import { situacaoDe } from "../src/modelo/situacao";
import { C, demanda } from "./fabrica";
import { checar, lanca, secao } from "./util";

const codigo = async (fn: () => unknown) => ((await lanca(fn)) as ErroOperacao | null)?.codigo;

export async function verificarOperacoes(): Promise<void> {
  secao("Iniciar, pausar, retomar");
  const nova = demanda({ id: "a" });
  const ini = iniciar(nova, C);
  checar("iniciar marca iniciadaEm", ini.demanda.iniciadaEm === C.agora && situacaoDe(ini.demanda) === "iniciada");
  checar(
    "iniciar carimba a gravacao",
    ini.demanda.atualizadoEm === C.agora && ini.demanda.dispositivo === "dev-a" && ini.demanda.alteradoPor === "ana",
  );
  checar("iniciar registra", ini.registros[0]?.campo === "inicio");
  checar("nao inicia duas vezes", (await codigo(() => iniciar(ini.demanda, C))) === "transicao_invalida");
  const pau = pausar(ini.demanda, C);
  checar("pausar abre pausa", situacaoDe(pau.demanda) === "pausada" && pau.demanda.pausas.length === 1);
  checar("nao pausa a nao iniciada", (await codigo(() => pausar(nova, C))) === "transicao_invalida");
  const ret = retomar(pau.demanda, { ...C, agora: 2_000 });
  checar("retomar fecha a pausa", situacaoDe(ret.demanda) === "iniciada" && ret.demanda.pausas[0]?.fim === 2_000);
  checar("registra retomada", ret.registros[0]?.campo === "retomada");
  checar(
    "voltar a nao iniciada limpa inicio e pausas",
    (() => {
      const v = voltarANaoIniciada(ret.demanda, C).demanda;
      return situacaoDe(v) === "nao_iniciada" && v.iniciadaEm === undefined && v.pausas.length === 0;
    })(),
  );
  const cheia = demanda({ id: "b", iniciadaEm: 1, pausas: Array.from({ length: 20 }, (_, i) => ({ inicio: i, fim: i + 1 })) });
  checar("20 pausas e o limite", (await codigo(() => pausar(cheia, C))) === "dados_invalidos");

  secao("Concluir");
  const con = concluir(pau.demanda, { data: "2026-10-12", tempoGastoMin: 90, observacao: "Entregue" }, { ...C, agora: 3_000 });
  checar("concluir fecha a pausa aberta", con.demanda.pausas[0]?.fim === 3_000);
  checar(
    "concluir guarda data, tempo e observacao",
    con.demanda.concluidaEm === "2026-10-12" && con.demanda.tempoGastoMin === 90 && con.demanda.observacaoConclusao === "Entregue",
  );
  checar("situacao concluida", situacaoDe(con.demanda) === "concluida");
  checar(
    "conclusao nao pode ser antes da distribuicao",
    (await codigo(() => concluir(ini.demanda, { data: "2026-09-30" }, C))) === "dados_invalidos",
  );
  checar(
    "tempo gasto invalido",
    (await codigo(() => concluir(ini.demanda, { data: "2026-10-12", tempoGastoMin: -1 }, C))) === "dados_invalidos",
  );
  checar("nao conclui a nao iniciada", (await codigo(() => concluir(nova, { data: "2026-10-12" }, C))) === "transicao_invalida");

  secao("Reabrir, avaliar, cancelar avaliacao");
  const reab = reabrir(con.demanda, C);
  checar(
    "reabrir limpa a conclusao e mantem o inicio",
    situacaoDe(reab.demanda) === "iniciada" &&
      reab.demanda.concluidaEm === undefined &&
      reab.demanda.tempoGastoMin === undefined &&
      reab.demanda.iniciadaEm !== undefined,
  );
  checar("registra reabertura", reab.registros[0]?.campo === "reabertura");
  const av = avaliar(con.demanda, { nota: 5, comentario: "Ótimo" }, C);
  checar("avaliar", situacaoDe(av.demanda) === "avaliada" && av.demanda.avaliacao?.nota === 5 && av.demanda.avaliacao.por === "ana");
  checar("nota fora de 1 a 5", (await codigo(() => avaliar(con.demanda, { nota: 6 as never }, C))) === "dados_invalidos");
  checar("nao avalia a nao concluida", (await codigo(() => avaliar(ini.demanda, { nota: 3 }, C))) === "transicao_invalida");
  checar("nao reabre a avaliada sem cancelar a avaliacao", (await codigo(() => reabrir(av.demanda, C))) === "transicao_invalida");
  checar("cancelar avaliacao volta a concluida", situacaoDe(cancelarAvaliacao(av.demanda, C).demanda) === "concluida");

  secao("Arquivar e desarquivar");
  const arq = arquivar(av.demanda, C);
  checar("arquivar", situacaoDe(arq.demanda) === "arquivada" && arq.demanda.arquivadoEm === C.agora);
  checar("so arquiva concluida ou avaliada", (await codigo(() => arquivar(ini.demanda, C))) === "transicao_invalida");
  const des = desarquivar(arq.demanda, C);
  checar("desarquivar volta ao estado de antes", situacaoDe(des.demanda) === "avaliada" && des.demanda.arquivadoEm === undefined);
  checar("arquivada nao aceita outras operacoes", (await codigo(() => reabrir(arq.demanda, C))) === "transicao_invalida");

  secao("Prorrogar");
  const pro = prorrogar(ini.demanda, { prazo: "2026-10-30", motivo: "Aguardando parecer" }, C);
  checar("muda o prazo e fixa o original", pro.demanda.prazo === "2026-10-30" && pro.demanda.prazoOriginal === "2026-10-20");
  checar(
    "registra com antes, depois e motivo",
    pro.registros[0]?.campo === "prazo" &&
      pro.registros[0].antes === "2026-10-20" &&
      pro.registros[0].depois === "2026-10-30" &&
      pro.registros[0].motivo === "Aguardando parecer",
  );
  checar(
    "segunda prorrogacao mantem o original",
    prorrogar(pro.demanda, { prazo: "2026-11-10", motivo: "De novo" }, C).demanda.prazoOriginal === "2026-10-20",
  );
  checar("exige motivo", (await codigo(() => prorrogar(ini.demanda, { prazo: "2026-10-30", motivo: "  " }, C))) === "dados_invalidos");
  checar(
    "prazo igual nao e prorrogacao",
    (await codigo(() => prorrogar(ini.demanda, { prazo: "2026-10-20", motivo: "x" }, C))) === "dados_invalidos",
  );
  checar(
    "prazo antes da distribuicao",
    (await codigo(() => prorrogar(ini.demanda, { prazo: "2026-09-01", motivo: "x" }, C))) === "dados_invalidos",
  );
  checar(
    "nao prorroga concluida",
    (await codigo(() => prorrogar(con.demanda, { prazo: "2026-10-30", motivo: "x" }, C))) === "transicao_invalida",
  );

  secao("Matriz do quadro");
  checar("nao iniciada para iniciada", movimentoPermitido("nao_iniciada", "iniciada"));
  checar("iniciada para pausada e volta", movimentoPermitido("iniciada", "pausada") && movimentoPermitido("pausada", "iniciada"));
  checar("nao iniciada direto para concluida e proibido", !movimentoPermitido("nao_iniciada", "concluida"));
  checar("pausada para concluida e permitido", movimentoPermitido("pausada", "concluida"));
  checar("concluida para avaliada e de volta", movimentoPermitido("concluida", "avaliada") && movimentoPermitido("avaliada", "concluida"));
  checar(
    "arquivada para concluida ou avaliada",
    movimentoPermitido("arquivada", "concluida") && movimentoPermitido("arquivada", "avaliada"),
  );
  checar(
    "quem pede dados",
    dadosQueOMovimentoPede("iniciada", "concluida") === "conclusao" &&
      dadosQueOMovimentoPede("concluida", "avaliada") === "avaliacao" &&
      dadosQueOMovimentoPede("iniciada", "pausada") === null,
  );
  checar("moverPara sem os dados pedidos falha", (await codigo(() => moverPara(ini.demanda, "concluida", {}, C))) === "dados_invalidos");
  checar("moverPara aplica", situacaoDe(moverPara(nova, "iniciada", {}, C).demanda) === "iniciada");
  checar("moverPara para o mesmo estado e invalido", (await codigo(() => moverPara(nova, "nao_iniciada", {}, C))) === "transicao_invalida");
  checar("desarquivar para o destino certo", situacaoDe(moverPara(arq.demanda, "avaliada", {}, C).demanda) === "avaliada");
  checar(
    "desarquivar para destino que nao e o de antes e invalido",
    (await codigo(() => moverPara(arq.demanda, "concluida", {}, C))) === "transicao_invalida",
  );
}
