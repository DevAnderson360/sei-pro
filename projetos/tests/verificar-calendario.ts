import { somarDias } from "@comum/datas/dias";
import {
  dataDe,
  dataNaFaixa,
  dataValida,
  duracaoUteis,
  ehUtil,
  FERIADOS,
  feriadosNoPeriodo,
  fimPorDuracao,
  MAX_DIAS_UTEIS,
  meiaNoite,
  proximoUtil,
  sextaDaSemana,
  somarUteis,
  uteisEntre,
} from "../src/modelo/calendario";
import { checar, secao } from "./util";

export function verificarCalendario(): void {
  secao("projetos: calendario e dias uteis");
  checar("feriados cobrem 2000 a 2100", FERIADOS.has("2000-01-01") && FERIADOS.has("2100-12-25"));
  checar("12/10/2026 (segunda) e feriado", !ehUtil("2026-10-12"));
  checar("sabado nao e util", !ehUtil("2026-10-10"));
  checar("terca comum e util", ehUtil("2026-10-06"));
  checar("proximoUtil de dia util e ele mesmo", proximoUtil("2026-10-06") === "2026-10-06");
  checar("proximoUtil de sabado pula domingo e o feriado de segunda", proximoUtil("2026-10-10") === "2026-10-13");
  checar("duracao inclusiva (tela 2: 01/09 a 02/10 = 23 dias uteis)", duracaoUteis("2026-09-01", "2026-10-02") === 23);
  checar("etapa de 1 dia util dura 1", duracaoUteis("2026-10-06", "2026-10-06") === 1);
  checar("etapa so no fim de semana dura 0", duracaoUteis("2026-10-10", "2026-10-11") === 0);
  checar("termino antes do inicio dura 0", duracaoUteis("2026-10-09", "2026-10-05") === 0);
  checar("termino num feriado nao conta o feriado", duracaoUteis("2026-10-08", "2026-10-12") === 2);
  checar("fimPorDuracao(1) e o proprio dia", fimPorDuracao("2026-10-06", 1) === "2026-10-06");
  checar("fimPorDuracao(5) pula o feriado de 12/10", fimPorDuracao("2026-10-07", 5) === "2026-10-14");
  checar("fimPorDuracao comecando no sabado comeca na terca 13/10", fimPorDuracao("2026-10-10", 1) === "2026-10-13");
  checar("fimPorDuracao(0) vale 1", fimPorDuracao("2026-10-06", 0) === "2026-10-06");
  checar("virada de ano: 31/12 + 2 dias uteis pula 01/01 e o fim de semana", fimPorDuracao("2026-12-31", 2) === "2027-01-04");
  checar("virada de ano: duracao de 31/12 a 04/01 e 2", duracaoUteis("2026-12-31", "2027-01-04") === 2);
  checar("uteisEntre 02/10 e 06/10 = 2 (a tela mostra '2 dias uteis' de atraso)", uteisEntre("2026-10-02", "2026-10-06") === 2);
  checar("uteisEntre ao contrario e negativo", uteisEntre("2026-10-06", "2026-10-02") === -2);
  const carnaval = feriadosNoPeriodo("2027-02-01", "2027-02-28");
  checar("carnaval de 2027 em 08 e 09/02", carnaval.map((f) => f.data).join() === "2027-02-08,2027-02-09", carnaval);
  checar(
    "feriadosNoPeriodo atravessa o ano",
    feriadosNoPeriodo("2026-12-20", "2027-01-05")
      .map((f) => f.data)
      .join() === "2026-12-25,2027-01-01",
  );
  checar("feriadosNoPeriodo invertido e vazio", feriadosNoPeriodo("2026-12-31", "2026-01-01").length === 0);
  checar("sexta da semana de uma terca", sextaDaSemana("2026-10-06") === "2026-10-09");
  checar("sexta da semana de uma segunda", sextaDaSemana("2026-10-05") === "2026-10-09");
  checar("sexta da semana de um sabado ja passou", sextaDaSemana("2026-10-10") === "2026-10-09");
  checar("sexta da semana de um domingo ja passou", sextaDaSemana("2026-10-11") === "2026-10-09");
  checar("sexta da semana na virada do ano", sextaDaSemana("2026-12-29") === "2027-01-01");

  secao("projetos: datas locais (fuso)");
  const noite = new Date(2026, 9, 6, 23, 30);
  checar("toISOString as 23h30 de Brasilia ja e o dia seguinte (a armadilha)", noite.toISOString().slice(0, 10) === "2026-10-07");
  checar("dataDe as 23h30 continua no dia local", dataDe(noite) === "2026-10-06");
  checar("dataDe a 00h05 e o proprio dia", dataDe(new Date(2026, 9, 6, 0, 5)) === "2026-10-06");
  const m = meiaNoite("2026-10-06");
  checar("meiaNoite e 00:00 local do mesmo dia", m.getHours() === 0 && m.getDate() === 6 && m.getMonth() === 9);
  checar("dataValida aceita data real", dataValida("2026-02-28"));
  checar("dataValida recusa 30 de fevereiro", !dataValida("2026-02-30"));
  checar("dataValida recusa formato brasileiro", !dataValida("06/10/2026"));
  checar("dataValida recusa nao-texto", !dataValida(20261006));
  checar("29/02 so em ano bissexto", dataValida("2028-02-29") && !dataValida("2027-02-29"));

  secao("projetos: calendario a prova de valores hostis");
  const tempo = <T>(f: () => T): { r: T; ms: number } => {
    const t = Date.now();
    const r = f();
    return { r, ms: Date.now() - t };
  };
  checar("MAX_DIAS_UTEIS e 2600", MAX_DIAS_UTEIS === 2600);
  const inf = tempo(() => fimPorDuracao("2026-10-06", Number.POSITIVE_INFINITY));
  checar("fimPorDuracao(Infinity) termina e vale 1 dia", inf.ms < 2000 && inf.r === "2026-10-06");
  checar("fimPorDuracao(NaN) vale 1 dia", fimPorDuracao("2026-10-06", Number.NaN) === "2026-10-06");
  const mil = tempo(() => fimPorDuracao("2026-10-06", 1e9));
  checar("fimPorDuracao(1e9) termina rapido e no teto", mil.ms < 2000 && mil.r === fimPorDuracao("2026-10-06", MAX_DIAS_UTEIS));
  const som = tempo(() => somarUteis("2026-10-06", 1e9));
  checar("somarUteis(1e9) termina rapido e no teto", som.ms < 2000 && som.r === somarUteis("2026-10-06", MAX_DIAS_UTEIS));
  checar(
    "somarUteis(Infinity/NaN) = a propria data",
    somarUteis("2026-10-06", Number.POSITIVE_INFINITY) === "2026-10-06" && somarUteis("2026-10-06", Number.NaN) === "2026-10-06",
  );
  checar("somarUteis ainda volta com negativo normal", somarUteis("2026-10-07", -1) === "2026-10-06");
  const longa = tempo(() => duracaoUteis("2026-01-01", "2100-12-31"));
  checar("duracaoUteis de 75 anos termina rapido e no teto", longa.ms < 2000 && longa.r === MAX_DIAS_UTEIS);
  const entre = tempo(() => [uteisEntre("2026-01-01", "2100-12-31"), uteisEntre("2100-12-31", "2026-01-01")]);
  checar("uteisEntre de 75 anos: teto com sinal", entre.ms < 2000 && entre.r[0] === MAX_DIAS_UTEIS && entre.r[1] === -MAX_DIAS_UTEIS);

  secao("projetos: calendario - teto e datas fora da faixa");
  const semFeriados = duracaoUteis("2026-01-05", somarDias("2026-01-05", 3699), new Set());
  checar("duracaoUteis nunca passa do teto (3.700 dias sem feriados)", semFeriados <= MAX_DIAS_UTEIS, semFeriados);
  const semLancar = (f: () => number): number | string => {
    try {
      return f();
    } catch (e) {
      return String(e);
    }
  };
  const impossivel = semLancar(() => duracaoUteis("2026-13-45", "2026-13-46"));
  checar("duracaoUteis de data impossivel e 0 (sem andar ate o ano 10000)", impossivel === 0, impossivel);
  const entreImpossivel = semLancar(() => uteisEntre("2026-13-45", "2026-10-06"));
  checar("uteisEntre de data impossivel e 0", entreImpossivel === 0, entreImpossivel);
  checar(
    "dataNaFaixa: 2000 a 2100",
    dataNaFaixa("2000-01-01") && dataNaFaixa("2100-12-31") && !dataNaFaixa("1999-12-31") && !dataNaFaixa("2101-01-01"),
  );
  checar("dataNaFaixa: data impossivel nao passa", !dataNaFaixa("2026-02-30") && !dataNaFaixa(20261006));
}
