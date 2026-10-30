import { areaMemoria } from "@comum/armazenamento/area";
import { CHAVE_PREFERENCIAS } from "../src/modelo/constantes";
import { gravarPreferencias, lerPreferencias, PADRAO } from "../src/preferencias";
import { checar, secao } from "./util";

export async function verificarPreferencias(): Promise<void> {
  secao("Preferencias");
  const area = areaMemoria();
  checar("sem nada gravado, o padrao", JSON.stringify(await lerPreferencias(area)) === JSON.stringify(PADRAO));
  await gravarPreferencias(area, { visao: "tabela", periodoPainel: "30" });
  const p = await lerPreferencias(area);
  checar("grava e rele", p.visao === "tabela" && p.periodoPainel === "30");
  await gravarPreferencias(area, { escopo: "eu" });
  const q = await lerPreferencias(area);
  checar("gravar parcial mantem o resto", q.escopo === "eu" && q.visao === "tabela" && q.periodoPainel === "30");
  checar("o painel embutido comeca aberto", PADRAO.recolhido === false && (await lerPreferencias(areaMemoria())).recolhido === false);
  await gravarPreferencias(area, { recolhido: true });
  checar(
    "recolher lembra e nao mexe no resto",
    (await lerPreferencias(area)).recolhido === true && (await lerPreferencias(area)).escopo === "eu",
  );
  await area.gravar({ [CHAVE_PREFERENCIAS]: { recolhido: "sim" } });
  checar("recolhido torto volta ao padrao", (await lerPreferencias(area)).recolhido === false);
  await area.gravar({ [CHAVE_PREFERENCIAS]: { visao: "x", concluidasNoQuadroDias: -3, escopo: "unidade" } });
  const r = await lerPreferencias(area);
  checar("valor invalido volta ao padrao", r.visao === PADRAO.visao && r.concluidasNoQuadroDias === PADRAO.concluidasNoQuadroDias);
  checar("o valido do mesmo registro fica", r.escopo === "unidade");
}
