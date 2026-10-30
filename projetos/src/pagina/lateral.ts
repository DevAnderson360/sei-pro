/**
 * Lado da aba do SEI na ponte com a aba "Projetos" do painel lateral: a janela
 * de topo de qualquer tela do SEI com unidade conecta quando o lateral anuncia
 * que abriu (`projetos/lateralAberto`) e se apresenta com a chave
 * host|login|u:<unidade> (`chaveDaAba`). O SEI recarrega a página a cada
 * navegação: a página nova se apresenta com a MESMA chave e a carência do
 * lateral termina sem remontar; ao trocar de unidade, a chave é outra e o
 * lateral remonta. Como nos Favoritos e no Histórico: reapresenta ao ganhar
 * foco e ao mudar a visibilidade, e confere o anúncio a cada 5 s (aba aberta
 * antes do painel, porta que caiu sem aviso).
 */

import type { Area } from "@comum/armazenamento/area";
import { ligarLadoAba } from "@comum/ponte/lateral";
import type { PortaRpc, Tratador } from "@comum/ponte/rpc";
import { CHAVE_LATERAL } from "../modelo/constantes";
import { type ContextoProjetos, chaveDaAba } from "../ponte/tipos";

export interface DepsLateralDaAba {
  doc: Document;
  ctx: ContextoProjetos;
  area: Area;
  conectar(): PortaRpc;
  tratadores: Record<string, Tratador>;
  /** Rede de segurança para as portas que caem sem aviso (padrão: 5 s). */
  intervalo?: number;
}

export function ligarLateralDaAba(d: DepsLateralDaAba): { parar(): void } {
  const janela = d.doc.defaultView;
  // A chave é a do contexto lido desta página: a mesma em toda tela da unidade e a cada recarga.
  const chave = chaveDaAba(d.ctx);
  let foco = d.doc.hasFocus?.() ? Date.now() : 0;
  const lado = ligarLadoAba({
    area: d.area,
    chave: CHAVE_LATERAL,
    conectar: d.conectar,
    tratadores: d.tratadores,
    estado: () => ({ visivel: d.doc.visibilityState === "visible", foco, chave }),
  });
  const marcar = () => {
    foco = Date.now();
    lado.apresentar();
  };
  const aoMudarVisibilidade = () => (d.doc.visibilityState === "visible" ? marcar() : lado.apresentar());
  janela?.addEventListener("focus", marcar);
  d.doc.addEventListener("visibilitychange", aoMudarVisibilidade);
  const conferir = setInterval(() => lado.verificar(), d.intervalo ?? 5000);
  return {
    parar() {
      clearInterval(conferir);
      janela?.removeEventListener("focus", marcar);
      d.doc.removeEventListener("visibilitychange", aoMudarVisibilidade);
      lado.parar();
    },
  };
}
