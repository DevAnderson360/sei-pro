/** A opção "Demandas" (`gerenciardemandas`) das configurações: LIGADA por padrão (ausente conta como ligada, como no Projetos). */

import { opcaoLegadaLigada } from "@comum/opcoes/legadas";

export const OPCAO_DEMANDAS = "gerenciardemandas";

export async function lerOpcaoDemandas(sync: Pick<chrome.storage.StorageArea, "get"> = chrome.storage.sync): Promise<boolean> {
  const itens = (await sync.get("dataValues")) as { dataValues?: unknown };
  return opcaoLegadaLigada(itens.dataValues, OPCAO_DEMANDAS);
}
