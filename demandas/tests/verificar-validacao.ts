import { LIMITES } from "../src/modelo/constantes";
import { conferirDemanda, dataValida, ErroValidacao, etiquetasLimpas, problemasDaDemanda } from "../src/modelo/validacao";
import { demanda } from "./fabrica";
import { checar, lanca, secao } from "./util";

export async function verificarValidacao(): Promise<void> {
  secao("Datas");
  checar("data boa", dataValida("2026-10-12"));
  checar("30 de fevereiro recusado", !dataValida("2026-02-30"));
  checar("texto qualquer recusado", !dataValida("amanha"));
  checar("numero recusado", !dataValida(20261012));

  secao("Etiquetas");
  checar("limpa, corta e tira repetidas sem olhar a caixa", etiquetasLimpas([" AIR ", "air", "Normas", ""]).join("|") === "AIR|Normas");
  checar("no maximo 10", etiquetasLimpas(Array.from({ length: 15 }, (_, i) => `e${i}`)).length === LIMITES.etiquetas);
  checar("corta o texto longo", etiquetasLimpas(["x".repeat(100)])[0]?.length === LIMITES.etiquetaTexto);

  secao("Problemas da demanda");
  checar("demanda boa nao tem problema", problemasDaDemanda(demanda({ id: "a" })).length === 0);
  checar("titulo vazio", problemasDaDemanda(demanda({ id: "a", titulo: "   " })).length > 0);
  checar("titulo gigante", problemasDaDemanda(demanda({ id: "a", titulo: "x".repeat(LIMITES.titulo + 1) })).length > 0);
  checar("prazo invalido", problemasDaDemanda(demanda({ id: "a", prazo: "2026-02-30" })).length > 0);
  checar(
    "prazo antes da distribuicao",
    problemasDaDemanda(demanda({ id: "a", distribuidaEm: "2026-10-10", prazo: "2026-10-09" })).length > 0,
  );
  checar(
    "checklist com 51 itens",
    problemasDaDemanda(demanda({ id: "a", checklist: Array.from({ length: 51 }, (_, i) => ({ id: `i${i}`, texto: "x", feito: false })) }))
      .length > 0,
  );
  checar("prioridade fora da lista", problemasDaDemanda(demanda({ id: "a", prioridade: "maxima" as never })).length > 0);
  checar("tempo estimado negativo", problemasDaDemanda(demanda({ id: "a", tempoEstimadoMin: -5 })).length > 0);
  checar("tempo gasto fracionado", problemasDaDemanda(demanda({ id: "a", tempoGastoMin: 1.5 })).length > 0);
  checar(
    "6 processos",
    problemasDaDemanda(demanda({ id: "a", processos: Array.from({ length: 6 }, (_, i) => ({ protocolo: `50300.00000${i}/2026-10` })) }))
      .length > 0,
  );

  secao("conferirDemanda lanca ErroValidacao com o campo");
  const e = await lanca(() => conferirDemanda(demanda({ id: "a", titulo: "" })));
  checar("lanca ErroValidacao", e instanceof ErroValidacao);
  checar("diz o campo", (e as ErroValidacao | null)?.campo === "titulo");
}
