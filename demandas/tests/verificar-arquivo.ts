import { areaMemoria } from "@comum/armazenamento/area";
import { escoposDaUnidade } from "../src/modelo/escopo";
import type { Escopo } from "../src/modelo/tipos";
import { RepositorioDemandas } from "../src/repositorio";
import { adaptadorArquivoDemandas, exportarTudo, importarTudo, lerEnvelopeArquivo, tamanhoDoArquivoAlto } from "../src/sincronia/arquivo";
import { T0 } from "./apoioRepositorio";
import { checar, secao } from "./util";

const NOVA = { titulo: "Nota técnica", prazo: "2026-10-20", distribuidaEm: "2026-10-01" };
const dono = { host: "sei.exemplo.gov.br", login: "ana" };
const carimbo = () => ({ agora: T0 + 5_000, dispositivo: "dev-a", por: "ana" });

/** Um "computador": uma área e os dois repositórios (unidade e eu) do dono, já registrados. */
async function computador(prefixoId: string) {
  const area = areaMemoria();
  const esc = escoposDaUnidade(dono.host, dono.login, "110000001");
  const mk = (e: Escopo) => {
    let n = 0;
    return new RepositorioDemandas(area, e, carimbo, () => `${prefixoId}-${e.vis}-${++n}`);
  };
  const un = mk(esc.unidade);
  const eu = mk(esc.eu);
  await un.registrar();
  await eu.registrar();
  return { area, un, eu };
}

export async function verificarArquivo(): Promise<void> {
  secao("Exportar tudo (o arquivo e o backup e o arquivo morto)");
  const A = await computador("a");
  const ativa = await A.un.criar(NOVA);
  const velha = await A.un.criar({ ...NOVA, titulo: "Já entregue" });
  await A.un.aplicar(velha.id, (d, c) => ({
    demanda: { ...d, iniciadaEm: 1, concluidaEm: "2026-10-10", atualizadoEm: c.agora, dispositivo: c.dispositivo },
    registros: [],
  }));
  await A.un.arquivarVarias([velha.id]);
  const minha = await A.eu.criar({ ...NOVA, titulo: "Só minha" });
  const env = await exportarTudo(A.area, dono, carimbo);
  const ids = env.escopos.flatMap((e) => e.entidades.d.map((d) => d.id));
  checar("leva os dois escopos do usuario", env.escopos.length === 2);
  checar(
    "leva as ativas, a arquivada e a pessoal",
    [ativa.id, velha.id, minha.id].every((id) => ids.includes(id)),
  );
  checar(
    "leva o historico inteiro",
    env.escopos.some((e) => e.entidades.h.length >= 3),
  );
  checar("formato e versao", env.formato === "seipro-demandas" && env.versao === 1);

  secao("Ler o envelope");
  checar("o proprio arquivo e lido", lerEnvelopeArquivo(JSON.parse(JSON.stringify(env))) !== null);
  checar("outro formato e recusado", lerEnvelopeArquivo({ formato: "outro", versao: 1 }) === null);
  checar("texto qualquer e recusado", lerEnvelopeArquivo("oi") === null && lerEnvelopeArquivo(null) === null);

  secao("Importar mescla e nao apaga");
  const B = await computador("b");
  await B.un.criar({ ...NOVA, titulo: "Só do B" });
  const r = await importarTudo(B.area, env, dono, carimbo);
  checar("importou as de A", r.novos >= 3);
  checar(
    "e manteve a do B",
    (await B.un.dados()).some((d) => d.titulo === "Só do B"),
  );
  checar(
    "a arquivada chegou arquivada",
    (await B.un.entidades()).d.some((d) => d.id === velha.id && d.arquivadoEm !== undefined),
  );
  const r2 = await importarTudo(B.area, env, dono, carimbo);
  checar("importar de novo e idempotente", r2.novos === 0 && r2.atualizados === 0);

  secao("Gravar o arquivo nao apaga o que outro computador gravou nele");
  const C = await computador("c");
  const dacolega = await C.un.criar({ ...NOVA, titulo: "Da colega" });
  const lido = await exportarTudo(C.area, dono, carimbo);
  const ad = adaptadorArquivoDemandas(A.area, dono, carimbo);
  await ad.importar(lido);
  const { envelope } = await ad.exportar(lido);
  const gravadas = envelope.escopos.flatMap((e) => e.entidades.d.map((d) => d.id));
  checar("o que o arquivo ja tinha (da colega) vai de volta", gravadas.includes(dacolega.id));
  checar("e o daqui tambem", gravadas.includes(ativa.id));
  checar(
    "o repositorio daqui recebeu a da colega",
    (await A.un.dados()).some((d) => d.id === dacolega.id),
  );

  secao("Aviso de tamanho (5 MB)");
  checar("abaixo de 5 MB nao avisa", !tamanhoDoArquivoAlto(5 * 1024 * 1024 - 1));
  checar("a partir de 5 MB avisa", tamanhoDoArquivoAlto(5 * 1024 * 1024));
}
