import { TETOS_ENVELOPE } from "../src/modelo/constantes";
import {
  arquivoMortoGrandeDemais,
  candidatasAoArquivamento,
  estimarLiberacao,
  lerArquivoMorto,
  montarArquivoMorto,
  nomeDoArquivoMorto,
} from "../src/sincronia/arquivoMorto";
import { ESCOPO, repoDeTeste, T0 } from "./apoioRepositorio";
import { demanda, HOJE, registro } from "./fabrica";
import { checar, secao } from "./util";

export async function verificarArquivoMorto(): Promise<void> {
  secao("Quais concluidas sao candidatas");
  const lista = [
    demanda({ id: "a", iniciadaEm: 1, concluidaEm: "2026-06-01" }),
    demanda({ id: "b", iniciadaEm: 1, concluidaEm: "2026-10-05" }),
    demanda({ id: "c", iniciadaEm: 1 }),
    demanda({ id: "d", iniciadaEm: 1, concluidaEm: "2026-05-01", avaliacao: { nota: 3, por: "x", em: 1 } }),
    demanda({ id: "e", iniciadaEm: 1, concluidaEm: "2026-04-01", arquivadoEm: 9 }),
  ];
  checar(
    "so concluidas ou avaliadas ha mais de N dias e nao arquivadas",
    candidatasAoArquivamento(lista, { hoje: HOJE, dias: 90 })
      .map((x) => x.id)
      .join() === "a,d",
  );
  checar(
    "com 30 dias, so as mais velhas que isso",
    candidatasAoArquivamento(lista, { hoje: HOJE, dias: 30 })
      .map((x) => x.id)
      .join() === "a,d",
  );
  checar(
    "com 200 dias, so a de maio",
    candidatasAoArquivamento(lista, { hoje: HOJE, dias: 150 })
      .map((x) => x.id)
      .join() === "d",
  );
  const est = estimarLiberacao(candidatasAoArquivamento(lista, { hoje: HOJE, dias: 90 }));
  checar("estimativa de quantidade e bytes", est.quantidade === 2 && est.bytes > 0);

  secao("Arquivo morto");
  const { repo, avancar } = repoDeTeste();
  const x = await repo.criar({ titulo: "Velha", prazo: "2026-02-20", distribuidaEm: "2026-02-01" });
  await repo.aplicar(x.id, (d, c) => ({
    demanda: { ...d, iniciadaEm: 1, concluidaEm: "2026-02-10", atualizadoEm: c.agora, dispositivo: c.dispositivo },
    registros: [],
  }));
  await repo.arquivarVarias([x.id]);
  const y = await repo.criar({ titulo: "Recente", prazo: "2026-10-30", distribuidaEm: "2026-10-01" });
  const ent = await repo.entidades();
  const morto = montarArquivoMorto(ent, ESCOPO, "2026-06-01", 50_000);
  checar(
    "leva as arquivadas anteriores a data e os registros delas",
    morto.demandas.map((d) => d.id).join() === x.id && morto.registros.every((r) => r.demanda === x.id) && morto.registros.length > 0,
  );
  checar("nao leva a recente nem as nao arquivadas", !morto.demandas.some((d) => d.id === y.id));
  checar("nome do arquivo", nomeDoArquivoMorto(ESCOPO, "2026-06-01") === "demandas-arquivo-2026-06-01.json");
  checar("round trip pelo leitor", lerArquivoMorto(JSON.parse(JSON.stringify(morto)))?.demandas.length === 1);
  checar("leitor recusa outro formato", lerArquivoMorto({ formato: "outro" }) === null);
  checar(
    "o arquivo morto leva o numero do processo (e do usuario)",
    montarArquivoMorto(
      { d: [demanda({ id: "p", arquivadoEm: 1, concluidaEm: "2026-01-01", processos: [{ protocolo: "50300.001234/2026-11" }] })], h: [] },
      ESCOPO,
      "2026-06-01",
      1,
    ).demandas[0]?.processos[0]?.protocolo === "50300.001234/2026-11",
  );

  secao("Descartar so depois de guardado");
  avancar();
  const n = await repo.descartar([x.id]);
  checar(
    "descartar vira lapide e tira da lista",
    n === 1 &&
      (await repo.obter(x.id)) === undefined &&
      (await repo.entidades()).d.some((d) => d.id === x.id && d.removidoEm !== undefined),
  );
  const volta = await repo.importar({ d: morto.demandas, h: morto.registros }, T0 + 60_000);
  checar(
    "importar o arquivo morto de novo nao ressuscita (a lapide e mais nova)",
    volta.novos === 0 && (await repo.obter(x.id)) === undefined,
  );
  secao("Revisao: teto de quantidade do arquivo morto");
  const bom = montarArquivoMorto({ d: [], h: [] }, ESCOPO, "2026-06-01", 1);
  checar("arquivo vazio e lido", lerArquivoMorto(bom) !== null);
  const demais = { ...bom, demandas: Array.from({ length: TETOS_ENVELOPE.a + 1 }, (_, i) => demanda({ id: `m${i}` })) };
  checar("demandas acima do teto sao recusadas", lerArquivoMorto(demais) === null && arquivoMortoGrandeDemais(demais));
  const registrosDemais = {
    ...bom,
    registros: Array.from({ length: TETOS_ENVELOPE.h + 1 }, (_, i) => registro({ id: `q${i}`, demanda: "x" })),
  };
  checar("registros acima do teto sao recusados", lerArquivoMorto(registrosDemais) === null);
  void registro;
}
