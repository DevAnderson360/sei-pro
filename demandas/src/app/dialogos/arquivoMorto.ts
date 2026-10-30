/**
 * "Exportar arquivo morto e limpar…" (spec 4.5): baixa as arquivadas de antes de uma data e SÓ DEPOIS de o usuário
 * confirmar que guardou o arquivo ("Já guardei o arquivo") remove essas demandas do Texto Padrão e do computador (viram
 * lápides). Sem baixar, nada é descartado. O mesmo diálogo importa um arquivo morto de volta (mescla; nunca apaga).
 */

import type { DataISO } from "@comum/datas/dias";
import { somarDias } from "@comum/datas/dias";
import { versaoMaisNova } from "@comum/sincronia/textoPadraoCodec";
import { h } from "@comum/ui/dom";
import type { Vis } from "../../modelo/tipos";
import {
  arquivoMortoGrandeDemais,
  FORMATO_ARQUIVO_MORTO,
  lerArquivoMorto,
  montarArquivoMorto,
  nomeDoArquivoMorto,
} from "../../sincronia/arquivoMorto";
import { mensagemDoErro } from "../erros";
import { dataLonga, plural } from "../formato";
import type { ContextoDialogo } from "../tipos";
import { caixaDeErros, campo } from "./campos";

export const MSG_GRANDE_DEMAIS = "Esse arquivo tem itens demais para ser importado de uma vez.";
export const MSG_NAO_E_DO_GESTOR = "Esse arquivo não é das Demandas.";
export const MSG_ARQUIVO_MAIS_NOVO =
  "Esse arquivo foi gravado por uma versão mais nova do SEI Pro. Atualize a extensão neste computador e importe de novo.";
export const MSG_OUTRA_UNIDADE = "Esse arquivo é de outra unidade ou de outro SEI: nada foi importado.";
const MSG_NAO_E_JSON = "O arquivo não é um JSON válido.";

export type DepsArquivoMorto = Pick<ContextoDialogo, "abrirModal" | "repos" | "hoje" | "confirmar" | "contexto"> & {
  agora(): number;
  baixar(nome: string, conteudo: string, tipo: string): void;
  escolherArquivo(): Promise<string | null>;
  avisar(texto: string): void;
};

const kb = (bytes: number): number => Math.max(1, Math.round(bytes / 1024));

/** O texto de um arquivo morto lido, ou a mensagem do que está errado (lança `Error` com ela). */
function interpretar(texto: string, d: Pick<DepsArquivoMorto, "contexto">, login: string) {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto);
  } catch {
    throw new Error(MSG_NAO_E_JSON);
  }
  if (versaoMaisNova(bruto, FORMATO_ARQUIVO_MORTO, 1)) throw new Error(MSG_ARQUIVO_MAIS_NOVO);
  const morto = lerArquivoMorto(bruto);
  if (!morto && arquivoMortoGrandeDemais(bruto)) throw new Error(MSG_GRANDE_DEMAIS);
  if (!morto || (morto.vis !== "unidade" && morto.vis !== "eu")) throw new Error(MSG_NAO_E_DO_GESTOR);
  const u = d.contexto.unidade;
  const mesmoLogin = morto.login.trim().toLowerCase() === login.trim().toLowerCase();
  if (morto.host !== d.contexto.host || String(morto.unidade) !== (u?.id ?? "") || (morto.vis === "eu" && !mesmoLogin))
    throw new Error(MSG_OUTRA_UNIDADE);
  return morto;
}

export function abrirArquivoMorto(d: DepsArquivoMorto): void {
  const erros = caixaDeErros();
  const resultado = h("p", { class: "dem-arquivo-resultado", role: "status" });
  const hoje = d.hoje();
  let visEscolhida: Vis = "unidade";
  const botoesVis = (
    [
      ["unidade", "Toda a unidade"],
      ["eu", "Só eu"],
    ] as const
  ).map(([id, rotulo]) => h("button", { type: "button", "data-vis": id, "aria-pressed": String(id === visEscolhida) }, rotulo));
  const vis = h("div", { class: "spro-segmentado", role: "group", "aria-label": "Quem vê" }, ...botoesVis);
  const limite = h("input", { type: "date", class: "spro-campo", name: "limite", value: somarDias(hoje, -180) });
  const resumo = h("p", { class: "dem-arquivo-resumo", role: "status" });
  const baixar = h("button", { type: "button", class: "spro-botao", disabled: true }, "Baixar arquivo");
  const guardei = h("input", { type: "checkbox", name: "guardei", disabled: true });
  const remover = h("button", { type: "button", class: "spro-botao perigo", disabled: true }, "Remover do SEI e do computador");
  /** O que o último "Baixar" levou: é exatamente isso que o "Remover" apaga (o que foi arquivado depois não entra). */
  let baixado: string[] | null = null;

  const escolhidaVis = (): Vis => visEscolhida;
  const dataEscolhida = (): DataISO | null => (/^\d{4}-\d{2}-\d{2}$/.test(limite.value) ? limite.value : null);
  const montar = async () => {
    const antesDe = dataEscolhida();
    if (!antesDe) return null;
    const repo = d.repos[escolhidaVis()];
    const morto = montarArquivoMorto(await repo.entidades(), repo.escopo, antesDe, d.agora());
    return { morto, antesDe, repo, bytes: new TextEncoder().encode(JSON.stringify(morto)).length };
  };
  const reiniciar = () => {
    baixado = null;
    guardei.checked = false;
    guardei.disabled = true;
    remover.disabled = true;
  };
  const pintar = async () => {
    reiniciar();
    resultado.textContent = "";
    let m: Awaited<ReturnType<typeof montar>>;
    try {
      m = await montar();
    } catch (e) {
      erros.mostrar([mensagemDoErro(e)]);
      return;
    }
    if (!m) {
      resumo.textContent = "Escolha uma data válida.";
      baixar.disabled = true;
      return;
    }
    if (!m.morto.demandas.length) {
      resumo.textContent = `Nenhuma demanda arquivada antes de ${dataLonga(m.antesDe)}.`;
      baixar.disabled = true;
      return;
    }
    resumo.textContent = `${plural(m.morto.demandas.length, "demanda arquivada", "demandas arquivadas")} antes de ${dataLonga(m.antesDe)}, cerca de ${kb(m.bytes)} KB.`;
    baixar.disabled = false;
  };
  for (const b of botoesVis)
    b.addEventListener("click", () => {
      visEscolhida = b.getAttribute("data-vis") === "eu" ? "eu" : "unidade";
      for (const x of botoesVis) x.setAttribute("aria-pressed", String(x === b));
      void pintar();
    });
  limite.addEventListener("change", () => void pintar());

  baixar.addEventListener("click", async () => {
    if (baixar.disabled) return;
    erros.mostrar([]);
    try {
      const m = await montar();
      if (!m?.morto.demandas.length) return;
      d.baixar(nomeDoArquivoMorto(m.repo.escopo, m.antesDe), JSON.stringify(m.morto, null, 2), "application/json");
      baixado = m.morto.demandas.map((x) => x.id);
      guardei.disabled = false;
      resultado.textContent = `Arquivo “${nomeDoArquivoMorto(m.repo.escopo, m.antesDe)}” baixado. Guarde-o num lugar seguro antes de remover.`;
    } catch (e) {
      erros.mostrar([mensagemDoErro(e)]);
    }
  });
  guardei.addEventListener("change", () => {
    remover.disabled = !(guardei.checked && baixado);
  });
  remover.addEventListener("click", async () => {
    const ids = baixado;
    if (remover.disabled || !ids || !guardei.checked) return;
    erros.mostrar([]);
    try {
      if (
        !(await d.confirmar(
          `Remover ${plural(ids.length, "demanda", "demandas")} do SEI e deste computador? O arquivo baixado é a única cópia.`,
          "Remover",
        ))
      )
        return;
      const n = await d.repos[escolhidaVis()].descartar(ids);
      const texto = `${plural(n, "demanda removida", "demandas removidas")} do SEI e do computador.`;
      d.avisar(texto);
      await pintar();
      resultado.textContent = texto;
    } catch (e) {
      erros.mostrar([mensagemDoErro(e)]);
    }
  });

  const importar = h("button", { type: "button", class: "spro-botao" }, "Importar arquivo morto…");
  importar.addEventListener("click", async () => {
    erros.mostrar([]);
    try {
      const texto = await d.escolherArquivo();
      if (texto === null) return;
      const morto = interpretar(texto, d, d.contexto.login);
      const r = await d.repos[morto.vis].importar({ d: morto.demandas, h: morto.registros });
      const t = `${plural(r.novos, "nova", "novas")}, ${plural(r.atualizados, "atualizada", "atualizadas")}, ${plural(r.ignorados, "ignorada", "ignoradas")}.`;
      resultado.textContent = t;
      d.avisar(t);
    } catch (e) {
      erros.mostrar([mensagemDoErro(e)]);
    }
  });

  d.abrirModal({
    titulo: "Exportar arquivo morto e limpar",
    icone: "pasta",
    conteudo: h(
      "div",
      { class: "dem-form dem-arquivo-morto" },
      h(
        "p",
        { class: "dem-dica" },
        "Baixe as demandas arquivadas antigas num arquivo e, só depois de guardá-lo, remova-as do SEI e deste computador. Depois de remover, a importação só traz de volta o que não foi excluído há mais de 180 dias (unidade) ou 90 dias (só você); para reaver uma demanda já excluída, use o histórico (restaurar).",
      ),
      campo("Quem vê", vis),
      campo("Arquivadas antes de", limite),
      resumo,
      h("div", { class: "dem-arquivo-acoes" }, baixar),
      h("label", { class: "dem-opcao" }, guardei, h("span", {}, "Já guardei o arquivo")),
      h("div", { class: "dem-arquivo-acoes" }, remover),
      h("hr", {}),
      h("p", { class: "dem-dica" }, "Para trazer um arquivo morto de volta:"),
      h("div", { class: "dem-arquivo-acoes" }, importar),
      resultado,
      erros.el,
    ),
  });
  void pintar();
}
