import { NADA_CONHECIDO } from "@projetos/modelo/sigilo";
import { chaveProtocolo } from "@projetos/modelo/vinculos";
import { cortarSigiloDemandas } from "../src/modelo/sigilo";
import { demanda } from "./fabrica";
import { checar, secao } from "./util";

export function verificarSigilo(): void {
  secao("Corte do sigilo nas demandas");
  const marcada = demanda({
    id: "a",
    processos: [{ protocolo: "50300.001234/2026-11", sigiloso: true }, { protocolo: "50300.000001/2026-01" }],
  });
  const r = cortarSigiloDemandas([marcada], NADA_CONHECIDO);
  checar(
    "o marcado vai vazio e o outro fica",
    r.demandas[0]?.processos[0]?.protocolo === "" &&
      r.demandas[0]?.processos[0]?.sigiloso === true &&
      r.demandas[0]?.processos[1]?.protocolo === "50300.000001/2026-01",
  );
  checar("o numero raspado volta para a memoria", r.raspados.processos.includes("50300001234202611"));
  const conhecidos = { processos: new Set([chaveProtocolo("50300.000001/2026-01")]), documentos: new Set<string>() };
  const r2 = cortarSigiloDemandas([demanda({ id: "b", processos: [{ protocolo: "50300.000001/2026-01" }] })], conhecidos);
  checar(
    "o numero que a memoria conhece vai vazio mesmo sem marca",
    r2.demandas[0]?.processos[0]?.protocolo === "" && r2.demandas[0]?.processos[0]?.sigiloso === true,
  );
  const comDoc = demanda({ id: "c", documentoEntregue: { numero: "0123456", sigiloso: true } });
  checar(
    "documento sigiloso vai como marcador",
    cortarSigiloDemandas([comDoc], NADA_CONHECIDO).demandas[0]?.documentoEntregue?.numero === "",
  );
  checar(
    "nao muda a demanda de quem nao tem sigilo",
    cortarSigiloDemandas([demanda({ id: "d" })], NADA_CONHECIDO).demandas[0] !== undefined,
  );
  checar("o JSON do que sai nao tem o numero", !JSON.stringify(r.demandas).includes("001234"));
}
