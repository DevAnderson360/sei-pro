/**
 * O que o painel lateral mostra (tela 3): a Agenda — o que fazer agora, em três
 * grupos (Atrasadas, Esta semana, Próximos 30 dias), dos dois escopos da
 * unidade, todas ou só as minhas — e a linha de resumo do cartão de cada
 * projeto ("1 atrasada · termina 10/12"). Puro, sobre os dados do app.
 */

import { alertasDasEtapas } from "../../modelo/alertas";
import { type Eu, ehMinha } from "../../modelo/filtro";
import { dataDoPrazo, textoDoPrazo } from "../../modelo/prazo";
import { type SituacaoEtapa, situacaoEtapa } from "../../modelo/situacao";
import type { DataISO, Etapa } from "../../modelo/tipos";
import type { ProjetoNaTela } from "../dados";
import { plural } from "../formato";

export type IdGrupoAgenda = "atrasadas" | "semana" | "proximos30";

export interface ItemAgenda {
  etapa: Etapa;
  projeto: ProjetoNaTela;
  situacao: SituacaoEtapa;
  /** "venceu 02/10", "até sex 09/10", "começa 16/10"… */
  prazo: string;
}

export interface GrupoAgenda {
  id: IdGrupoAgenda;
  titulo: string;
  itens: ItemAgenda[];
}

const TITULOS: Record<IdGrupoAgenda, string> = {
  atrasadas: "Atrasadas",
  semana: "Esta semana",
  proximos30: "Próximos 30 dias",
};

/**
 * Uma etapa entra num grupo só: o primeiro que ela cumpre (atrasada, depois vence nesta semana,
 * depois começa ou termina nos próximos 30 dias). Grupo vazio não aparece. Dentro do grupo, pela data
 * que importa (o término; nos próximos 30 dias, o início se ainda não começou).
 */
export function agendaDaUnidade(ativos: readonly ProjetoNaTela[], hoje: DataISO, o: { soMinhas: boolean; eu: Eu }): GrupoAgenda[] {
  const grupos: Record<IdGrupoAgenda, ItemAgenda[]> = { atrasadas: [], semana: [], proximos30: [] };
  for (const p of ativos) {
    if (p.projeto.arquivadoEm !== undefined) continue;
    const etapas = o.soMinhas ? p.etapas.filter((e) => ehMinha(e, o.eu)) : p.etapas;
    const a = alertasDasEtapas(etapas, hoje);
    const vistas = new Set<string>();
    const pegar = (id: IdGrupoAgenda, lista: readonly Etapa[]) => {
      for (const e of lista) {
        if (vistas.has(e.id)) continue;
        vistas.add(e.id);
        grupos[id].push({ etapa: e, projeto: p, situacao: situacaoEtapa(e, hoje), prazo: textoDoPrazo(e, hoje) });
      }
    };
    pegar("atrasadas", a.atrasadas);
    pegar("semana", a.semana);
    pegar("proximos30", a.proximos30);
  }
  const quando = (id: IdGrupoAgenda, e: Etapa) => (id === "proximos30" && e.inicio > hoje ? e.inicio : e.fim);
  return (Object.keys(grupos) as IdGrupoAgenda[])
    .filter((id) => grupos[id].length)
    .map((id) => ({
      id,
      titulo: TITULOS[id],
      itens: grupos[id].sort(
        (x, y) => quando(id, x.etapa).localeCompare(quando(id, y.etapa)) || x.etapa.nome.localeCompare(y.etapa.nome, "pt-BR"),
      ),
    }));
}

/** A terceira linha do cartão do projeto (tela 3), com o tom: vermelho com atraso, verde concluído. */
export function linhaDoCartao(p: ProjetoNaTela, hoje: DataISO): { texto: string; tom: "perigo" | "ok" | "normal" } {
  const r = p.resumo;
  if (r.situacao === "semEtapas") return { texto: "sem etapas", tom: "normal" };
  if (r.situacao === "concluido") {
    const fim = p.etapas.reduce<string>(
      (m, e) => (e.removidoEm === undefined && e.concluidaEm && e.concluidaEm > m ? e.concluidaEm : m),
      "",
    );
    return { texto: fim ? `concluído em ${dataDoPrazo(fim, hoje)}` : "concluído", tom: "ok" };
  }
  const termina = r.fim ? ` · termina ${dataDoPrazo(r.fim, hoje)}` : "";
  if (r.atrasadas) return { texto: `${plural(r.atrasadas, "atrasada", "atrasadas")}${termina}`, tom: "perigo" };
  return { texto: `${r.feitas} de ${r.total}${termina}`, tom: "normal" };
}
