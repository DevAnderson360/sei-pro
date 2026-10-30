/**
 * O campo "Etapa do projeto" do diálogo da demanda: um `criarCombo` com as etapas abertas dos projetos da unidade, na
 * ordem dos projetos (o rótulo "Projeto > Etapa" agrupa por projeto). Mostra a etapa guardada (pelo `rotulo` que a
 * demanda leva) mesmo sem o Projetos; com o Projetos disponível, mostra o nome ATUAL (a etapa renomeada continua ligada
 * pelo id). Sem nenhum projeto com etapas abertas e sem etapa guardada: "Nenhum projeto com etapas abertas", desabilitado.
 */

import { type Combo, type ConfigCombo, criarCombo } from "@comum/ui/combobox";
import type { EtapaRef, Vis } from "../../modelo/tipos";
import type { EtapaDoProjeto } from "../tipos";

export const TEXTO_SEM_ETAPAS = "Nenhum projeto com etapas abertas";

export interface CampoEtapa {
  combo: Combo;
  /** A etapa escolhida (com o rótulo que vai ser guardado), ou undefined (nenhuma). */
  escolhida(): EtapaRef | undefined;
  /**
   * "Quem vê" mudou: numa demanda da unidade, a etapa de um projeto "Só eu" não pode ficar (o rótulo iria para o texto da
   * unidade). Limpa a escolha e devolve true quando isso acontece; sempre refaz a lista do que pode ser escolhido.
   */
  aoMudarVis(): boolean;
}

const chaveDe = (e: Pick<EtapaRef, "projeto" | "etapa">) => `${e.projeto}␟${e.etapa}`;

export function montarCampoEtapa(o: {
  atual?: EtapaRef;
  carregar(): Promise<readonly EtapaDoProjeto[]>;
  /** Para quem a demanda vale agora. Sem isso, nenhuma etapa é escondida. */
  vis?: () => Vis;
}): CampoEtapa {
  const etapas = new Map<string, EtapaRef>();
  /** O escopo do projeto de cada etapa conhecida (a guardada, sem o Projetos, fica sem). */
  const escopos = new Map<string, Vis>();
  if (o.atual) etapas.set(chaveDe(o.atual), o.atual);
  const pessoalNaUnidade = (k: string) => o.vis?.() === "unidade" && escopos.get(k) === "eu";
  const guardada = (k: string) => !!o.atual && chaveDe(o.atual) === k;
  const cfg: ConfigCombo = {
    rotulo: "Etapa do projeto",
    opcoes: () => [
      { valor: "", rotulo: "Nenhuma" },
      ...[...etapas.entries()]
        .filter(([valor]) => !pessoalNaUnidade(valor) || guardada(valor))
        .map(([valor, e]) => ({ valor, rotulo: e.rotulo, icone: "gantt" as const })),
    ],
    // Sem etapa guardada, nada escolhido: o botao mostra o texto de `vazio` (e nao a opcao "Nenhuma").
    valor: o.atual ? [chaveDe(o.atual)] : [],
    vazio: "Nenhuma",
    busca: true,
    larguraLista: 300,
  };
  const combo = criarCombo(cfg);
  void o
    .carregar()
    .then((lista) => {
      for (const e of lista) {
        // Concluída só entra se é a que a demanda já tem (para não sumir do campo).
        if (e.concluida && !(o.atual && chaveDe(o.atual) === chaveDe(e))) continue;
        etapas.set(chaveDe(e), { projeto: e.projeto, etapa: e.etapa, rotulo: e.rotulo });
        escopos.set(chaveDe(e), e.vis);
      }
      if (!etapas.size) {
        // Nada a escolher (sem o Projetos, ou sem etapas abertas) e nada guardado: o campo diz por que não abre.
        combo.definirVazio(TEXTO_SEM_ETAPAS);
        combo.el.disabled = true;
      }
      combo.atualizar();
    })
    .catch(() => undefined);
  return {
    combo,
    escolhida: () => etapas.get(combo.valor()[0] ?? ""),
    aoMudarVis() {
      const k = combo.valor()[0] ?? "";
      const limpou = k !== "" && pessoalNaUnidade(k);
      if (limpou) combo.definir([]);
      combo.atualizar();
      return limpou;
    },
  };
}
