import { naTela } from "../src/app/dados";
import { colunasDoQuadro, planoDoMovimento } from "../src/modelo/quadro";
import { demanda, HOJE } from "./fabrica";
import { checar, secao } from "./util";

export function verificarQuadro(): void {
  const t = (m: Parameters<typeof demanda>[0]) => naTela(demanda(m), "unidade", HOJE);
  const itens = [
    t({ id: "n1" }),
    t({ id: "i1", iniciadaEm: 1 }),
    t({ id: "p1", iniciadaEm: 1, pausas: [{ inicio: 2 }] }),
    t({ id: "c1", iniciadaEm: 1, concluidaEm: "2026-10-10" }),
    t({ id: "c2", iniciadaEm: 1, concluidaEm: "2026-08-01", prazo: "2026-08-05", distribuidaEm: "2026-07-25" }),
    t({ id: "a1", iniciadaEm: 1, concluidaEm: "2026-10-01", avaliacao: { nota: 4, por: "x", em: 1 } }),
    t({ id: "x1", iniciadaEm: 1, concluidaEm: "2026-10-01", arquivadoEm: 5 }),
  ];
  secao("Colunas do quadro");
  const c = colunasDoQuadro(itens, { hoje: HOJE, mostrarArquivadas: false, concluidasDias: 30 });
  const ids = (s: keyof typeof c) => c[s].map((x) => x.demanda.id).join();
  checar("cada demanda na sua coluna", ids("nao_iniciada") === "n1" && ids("iniciada") === "i1" && ids("pausada") === "p1");
  checar("concluidas recentes ficam; as velhas saem da coluna", ids("concluida") === "c1");
  checar("avaliadas recentes ficam", ids("avaliada") === "a1");
  checar("arquivadas nao aparecem por padrao", ids("arquivada") === "");
  checar(
    "mostrarArquivadas traz a coluna",
    colunasDoQuadro(itens, { hoje: HOJE, mostrarArquivadas: true, concluidasDias: 30 }).arquivada.length === 1,
  );
  checar(
    "concluidasDias maior traz as velhas",
    colunasDoQuadro(itens, { hoje: HOJE, mostrarArquivadas: false, concluidasDias: 90 }).concluida.length === 2,
  );

  secao("Plano do movimento (o que o arrastar faz)");
  const d = (m: Parameters<typeof demanda>[0]) => demanda(m);
  checar("nao iniciada para iniciada: aplica direto", planoDoMovimento(d({ id: "a" }), "iniciada").tipo === "aplicar");
  checar(
    "iniciada para concluida: pede os dados da conclusao",
    JSON.stringify(planoDoMovimento(d({ id: "a", iniciadaEm: 1 }), "concluida")) === JSON.stringify({ tipo: "pedir", dados: "conclusao" }),
  );
  checar(
    "concluida para avaliada: pede a avaliacao",
    JSON.stringify(planoDoMovimento(d({ id: "a", concluidaEm: "2026-10-10" }), "avaliada")) ===
      JSON.stringify({ tipo: "pedir", dados: "avaliacao" }),
  );
  const recusa = planoDoMovimento(d({ id: "a" }), "concluida");
  checar("nao iniciada direto para concluida: recusa com mensagem", recusa.tipo === "recusar" && recusa.mensagem.length > 0);
  checar(
    "mesma coluna: recusa silenciosa",
    (() => {
      const r = planoDoMovimento(d({ id: "a" }), "nao_iniciada");
      return r.tipo === "recusar" && r.mensagem === "";
    })(),
  );
  checar(
    "avaliada para concluida: aplica (cancela a avaliacao)",
    planoDoMovimento(d({ id: "a", concluidaEm: "2026-10-10", avaliacao: { nota: 3, por: "x", em: 1 } }), "concluida").tipo === "aplicar",
  );
  checar("iniciada para arquivada: recusa", planoDoMovimento(d({ id: "a", iniciadaEm: 1 }), "arquivada").tipo === "recusar");
  checar(
    "concluida para arquivada: aplica",
    planoDoMovimento(d({ id: "a", iniciadaEm: 1, concluidaEm: "2026-10-10" }), "arquivada").tipo === "aplicar",
  );
  const arq = d({ id: "a", iniciadaEm: 1, concluidaEm: "2026-10-10", arquivadoEm: 5 });
  checar("arquivada volta so ao estado de antes: concluida aplica", planoDoMovimento(arq, "concluida").tipo === "aplicar");
  const r = planoDoMovimento(arq, "avaliada");
  checar("arquivada para avaliada (nao era): recusa com mensagem", r.tipo === "recusar" && r.mensagem.length > 0);
}
