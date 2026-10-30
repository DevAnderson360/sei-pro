/**
 * "Arquivar concluídas antigas…" (spec 4.5): arquiva em lote as concluídas e avaliadas há mais de N dias (30, 60, 90 ou
 * 180). Mostra quantas são e cerca de quanto libera do texto das demandas; as arquivadas vão da tabela `d` para a `a`
 * (nada se perde). Sem candidatas, o botão fica desabilitado.
 */

import type { DataISO } from "@comum/datas/dias";
import { h } from "@comum/ui/dom";
import type { Demanda, Vis } from "../../modelo/tipos";
import { candidatasAoArquivamento, estimarLiberacao } from "../../sincronia/arquivoMorto";
import { mensagemDoErro } from "../erros";
import { plural } from "../formato";
import type { ContextoDialogo } from "../tipos";
import { caixaDeErros, campo } from "./campos";

const OPCOES_DIAS = [30, 60, 90, 180] as const;
const PADRAO_DIAS = 90;

export type DepsArquivarAntigas = Pick<ContextoDialogo, "abrirModal" | "repos" | "hoje"> & { avisar(texto: string): void };

const kb = (bytes: number): number => Math.max(1, Math.round(bytes / 1024));

export async function abrirArquivarAntigas(d: DepsArquivarAntigas, hoje: DataISO = d.hoje()): Promise<void> {
  const erros = caixaDeErros();
  let dados: Record<Vis, Demanda[]> = { unidade: [], eu: [] };
  const reler = async () => {
    const [u, e] = await Promise.all([d.repos.unidade.dados(), d.repos.eu.dados()]);
    dados = { unidade: u, eu: e };
  };
  await reler();

  let dias: number = PADRAO_DIAS;
  const botoesDias = OPCOES_DIAS.map((n) =>
    h("button", { type: "button", "data-dias": String(n), "aria-pressed": String(n === dias) }, `${n} dias`),
  );
  const seletor = h("div", { class: "spro-segmentado", role: "group", "aria-label": "Concluídas há mais de" }, ...botoesDias);
  const resumo = h("p", { class: "dem-arquivar-resumo", role: "status" });
  const resultado = h("p", { class: "dem-arquivar-resultado", role: "status" });
  const arquivar = h("button", { type: "button", class: "spro-botao primario", disabled: true }, "Arquivar");

  const candidatas = (): Record<Vis, Demanda[]> => {
    return {
      unidade: candidatasAoArquivamento(dados.unidade, { hoje, dias }),
      eu: candidatasAoArquivamento(dados.eu, { hoje, dias }),
    };
  };
  const pintar = () => {
    const n = dias;
    const c = candidatas();
    const todas = [...c.unidade, ...c.eu];
    if (!todas.length) {
      resumo.textContent = `Nenhuma demanda concluída há mais de ${n} dias.`;
      arquivar.disabled = true;
      return;
    }
    const est = estimarLiberacao(todas);
    resumo.textContent = `${plural(est.quantidade, "demanda concluída", "demandas concluídas")} há mais de ${n} dias, cerca de ${kb(est.bytes)} KB.`;
    arquivar.disabled = false;
  };
  for (const b of botoesDias)
    b.addEventListener("click", () => {
      dias = Number(b.getAttribute("data-dias"));
      for (const x of botoesDias) x.setAttribute("aria-pressed", String(x === b));
      resultado.textContent = "";
      pintar();
    });
  arquivar.addEventListener("click", async () => {
    if (arquivar.disabled) return;
    arquivar.disabled = true;
    erros.mostrar([]);
    try {
      const c = candidatas();
      let feitas = 0;
      for (const vis of ["unidade", "eu"] as const) {
        const ids = c[vis].map((x) => x.id);
        if (ids.length) feitas += (await d.repos[vis].arquivarVarias(ids)).arquivadas;
      }
      const texto = plural(feitas, "arquivada", "arquivadas");
      resultado.textContent = texto;
      d.avisar(`${texto}.`);
      await reler();
    } catch (e) {
      erros.mostrar([mensagemDoErro(e)]);
    } finally {
      pintar();
    }
  });
  pintar();

  d.abrirModal({
    titulo: "Arquivar concluídas antigas",
    icone: "pasta",
    conteudo: h(
      "div",
      { class: "dem-form dem-arquivar" },
      h(
        "p",
        { class: "dem-dica" },
        "As concluídas e avaliadas vão para as arquivadas: saem das visões e do texto das demandas, sem perder nada.",
      ),
      campo("Concluídas há mais de", seletor),
      resumo,
      resultado,
      erros.el,
      h("div", { class: "spro-dialogo-rodape" }, arquivar),
    ),
  });
}
