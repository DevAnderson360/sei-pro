/** Filtro das visões: OU dentro do campo, E entre campos (como no Projetos e nos Favoritos). */

import { type DataISO, somarDias } from "@comum/datas/dias";
import { normalizarTexto } from "@comum/texto";
import { prazoDe, type Situacao, situacaoDe } from "./situacao";
import type { Demanda, Prioridade, Responsavel } from "./tipos";

export const SEM_RESPONSAVEL = "__sem__";
export const EU = "__eu__";

export interface FiltroDemandas {
  responsaveis?: string[];
  situacoes?: Situacao[];
  prazo?: "atrasadas" | "semana" | "mes";
  prioridades?: Prioridade[];
  etiquetas?: string[];
  etapa?: string;
  busca?: string;
  mostrarArquivadas?: boolean;
}

/** Login em minúsculas; sem login, o nome sem acento e sem caixa. */
export function chaveResponsavel(r?: Responsavel): string {
  if (!r) return SEM_RESPONSAVEL;
  return r.login ? `l:${r.login.trim().toLowerCase()}` : `n:${normalizarTexto(r.nome)}`;
}

export function filtrar(lista: readonly Demanda[], f: FiltroDemandas, ctx: { hoje: DataISO; eu: Responsavel }): Demanda[] {
  const minha = chaveResponsavel(ctx.eu);
  const resp = f.responsaveis?.map((r) => (r === EU ? minha : r));
  const busca = f.busca ? normalizarTexto(f.busca) : "";
  const semana = somarDias(ctx.hoje, 7);
  const mes = somarDias(ctx.hoje, 30);
  return lista.filter((d) => {
    const s = situacaoDe(d);
    if (s === "arquivada" && !f.mostrarArquivadas) return false;
    if (resp?.length && !resp.includes(chaveResponsavel(d.responsavel))) return false;
    if (f.situacoes?.length && !f.situacoes.includes(s)) return false;
    if (f.prazo === "atrasadas" && prazoDe(d, ctx.hoje) !== "atrasada") return false;
    if (f.prazo === "semana" && !(d.prazo >= ctx.hoje && d.prazo <= semana && !d.concluidaEm)) return false;
    if (f.prazo === "mes" && !(d.prazo >= ctx.hoje && d.prazo <= mes && !d.concluidaEm)) return false;
    if (f.prioridades?.length && !f.prioridades.includes(d.prioridade)) return false;
    if (f.etiquetas?.length) {
      const dele = d.etiquetas.map((e) => e.toLocaleLowerCase("pt-BR"));
      if (!f.etiquetas.some((e) => dele.includes(e.toLocaleLowerCase("pt-BR")))) return false;
    }
    if (f.etapa && d.etapa?.etapa !== f.etapa) return false;
    if (busca) {
      const palheiro = normalizarTexto([d.titulo, d.descricao ?? "", ...d.processos.map((p) => p.protocolo), ...d.etiquetas].join(" "));
      if (!palheiro.includes(busca)) return false;
    }
    return true;
  });
}
