/** Repositório do lote de Ações em Lote: um registro por processo, sem senha. */

import { areaMemoria } from "@comum/armazenamento/area";
import type { LinhaDoc } from "../src/modelo/documentos";
import { type LoteAcoes, planejar } from "../src/modelo/fila";
import { RepositorioAcoes } from "../src/repositorio";
import { checar, igual, secao } from "./util";

const doc: LinhaDoc = {
  id: "10",
  numero: "10",
  titulo: "Despacho 1",
  tipo: "Despacho",
  externo: false,
  formato: "interno",
  nivel: "publico",
  assinado: false,
  assinaturas: [],
  cancelado: false,
  unidade: "ABC",
  pasta: null,
};

function lote(id: string, proc: string): LoteAcoes {
  const etapas = [{ acao: "assinar", cargo: "Diretor" }] as LoteAcoes["etapas"];
  return {
    id,
    idProcedimento: proc,
    protocolo: "1/2026",
    criadoEm: 1,
    atualizadoEm: 2,
    aba: "t1",
    etapas,
    planos: planejar([doc], etapas, false),
  };
}

export async function verificarRepositorio(): Promise<void> {
  secao("Repositório: lote persistido");
  const area = areaMemoria();
  const r = new RepositorioAcoes(area, "sei.org", "ana");
  igual("vazio: null", await r.doProcesso("100"), null);
  await r.salvar(lote("L1", "100"));
  await r.salvar(lote("L2", "200"));
  igual("lê por processo", (await r.doProcesso("100"))?.id, "L1");
  igual("outro processo", (await r.doProcesso("200"))?.id, "L2");
  const chaves = Object.keys(await area.obter(null));
  igual("chave por entidade", chaves.sort(), ["acoes-lote/andamento/sei.org|ana/100", "acoes-lote/andamento/sei.org|ana/200"]);
  checar("sem senha", !JSON.stringify(await area.obter(null)).includes("senha"));
  igual("outro login não vê", await new RepositorioAcoes(area, "sei.org", "bia").doProcesso("100"), null);
  await r.salvar({ ...lote("L1", "100"), atualizadoEm: 9 });
  igual("salvar substitui", (await r.doProcesso("100"))?.atualizadoEm, 9);
  await area.gravar({ "acoes-lote/andamento/sei.org|ana/300": { id: "L3" } });
  igual("registro sem planos vira null", await r.doProcesso("300"), null);
  await area.gravar({ "acoes-lote/andamento/sei.org|ana/301": { planos: [] } });
  igual("registro sem id vira null", await r.doProcesso("301"), null);
  await r.descartar("L1");
  igual("descartado", await r.doProcesso("100"), null);
  igual("o outro permanece", (await r.doProcesso("200"))?.id, "L2");
  await r.descartar("inexistente");
  igual("descartar inexistente é inócuo", (await r.doProcesso("200"))?.id, "L2");
}
