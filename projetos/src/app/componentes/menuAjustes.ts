/**
 * Menu geral do painel (botão "ajustes", tela 1). Os itens são montados a cada
 * abertura, com o estado do momento. O que depende do P4 (Sincronização,
 * Modelos, Enviar/Receber, Importar do Atividades, Histórico de alterações)
 * entra pelas extensões; sem elas, não aparece (nada de item desligado).
 */

import { criarMenu, type EntradaMenu } from "@comum/ui/menu";
import type { OrdemEtapas } from "../../modelo/operacoes";

export interface ExtensoesMenu {
  /** No começo: "Sincronização…", "Modelos de projeto…". */
  sincronia?: () => EntradaMenu[];
  /** Depois de Exportar/Imprimir: enviar, receber, importar (sem projeto ativo, o que não tem o que levar some). */
  arquivo?: (o?: { semProjetos?: boolean }) => EntradaMenu[];
  /** No fim: "Histórico de alterações". */
  fim?: () => EntradaMenu[];
}

export interface OpcoesMenuAjustes {
  mostrarLista: boolean;
  moverDependentes: boolean;
  ordemEtapas: OrdemEtapas;
  arquivados: number;
  /** Sem projeto ativo (primeiro uso, ou só arquivados): Exportar e Imprimir não têm o que levar. */
  semProjetos?: boolean;
  extensoes?: ExtensoesMenu;
  aoMostrarLista(v: boolean): void;
  aoMoverDependentes(v: boolean): void;
  aoOrdenar(o: OrdemEtapas): void;
  aoExportar(): void;
  aoImprimir(): void;
  aoArquivados(): void;
}

/** A ordem das etapas num item só (menu mais curto): a dica diz a de agora e o clique passa para a próxima. */
const ORDENS: ReadonlyArray<[OrdemEtapas, string]> = [
  ["inicio", "por início"],
  ["nome", "por nome"],
  ["cadastro", "por cadastro"],
];

function itemDaOrdem(atual: OrdemEtapas, aoOrdenar: (o: OrdemEtapas) => void): EntradaMenu {
  const i = Math.max(
    0,
    ORDENS.findIndex(([v]) => v === atual),
  );
  const proxima = ORDENS[(i + 1) % ORDENS.length]?.[0] ?? "inicio";
  return { rotulo: "Ordenar etapas", icone: "ordenar", dica: ORDENS[i]?.[1], fazer: () => aoOrdenar(proxima) };
}

export function criarMenuAjustes(estado: () => OpcoesMenuAjustes): HTMLButtonElement {
  return criarMenu({
    rotulo: "Ajustes dos projetos",
    icone: "ajustes",
    largura: 270,
    itens: () => {
      const o = estado();
      const ext = o.extensoes ?? {};
      return [
        ...(ext.sincronia?.() ?? []),
        o.arquivados > 0 ? { rotulo: "Projetos arquivados", icone: "pasta", dica: String(o.arquivados), fazer: o.aoArquivados } : null,
        "-",
        // Marcáveis: o leitor de tela ouve se estão ligados. "Ordenar etapas" alterna, não é marcável.
        { rotulo: "Mostrar lista de etapas", marcado: o.mostrarLista, fazer: () => o.aoMostrarLista(!o.mostrarLista) },
        {
          rotulo: "Mover dependentes ao arrastar",
          marcado: o.moverDependentes,
          fazer: () => o.aoMoverDependentes(!o.moverDependentes),
        },
        itemDaOrdem(o.ordemEtapas, o.aoOrdenar),
        "-",
        o.semProjetos ? null : { rotulo: "Exportar planilha (CSV)", icone: "planilha", fazer: o.aoExportar },
        o.semProjetos ? null : { rotulo: "Imprimir / salvar PDF", icone: "documento", fazer: o.aoImprimir },
        ...(ext.arquivo?.({ semProjetos: !!o.semProjetos }) ?? []),
        "-",
        ...(ext.fim?.() ?? []),
      ];
    },
  });
}
