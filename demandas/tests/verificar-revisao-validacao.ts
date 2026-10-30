import { LIMITES } from "../src/modelo/constantes";
import { entidadeValida } from "../src/repositorio";
import { repoDeTeste, T0 } from "./apoioRepositorio";
import { demanda, registro } from "./fabrica";
import { checar, secao } from "./util";

const AG = T0 + 30_000;

export async function verificarRevisaoValidacao(): Promise<void> {
  secao("Revisao: entidadeValida confere os campos que vem de fora");
  const base = demanda({ id: "v1" });
  checar("a demanda de base e valida", entidadeValida(base, "d", AG));
  const ruins: Array<[string, Record<string, unknown>]> = [
    ["responsavel com nome numerico", { responsavel: { nome: 1 } }],
    ["responsavel que e texto", { responsavel: "x" }],
    ["responsavel com nome enorme", { responsavel: { nome: "n".repeat(5000) } }],
    ["responsavel com login numerico", { responsavel: { nome: "a", login: 3 } }],
    ["etapa com rotulo de 50 mil caracteres", { etapa: { projeto: "p", etapa: "e", rotulo: "r".repeat(50_000) } }],
    ["etapa sem projeto", { etapa: { etapa: "e", rotulo: "r" } }],
    ["documentoEntregue com numero numerico", { documentoEntregue: { numero: 5 } }],
    ["documentoEntregue com numero enorme", { documentoEntregue: { numero: "1".repeat(500) } }],
    ["documentoEntregue com titulo numerico", { documentoEntregue: { numero: "1", titulo: 4 } }],
    ["documentoEntregue com sigiloso texto", { documentoEntregue: { numero: "1", sigiloso: "sim" } }],
    ["avaliacao com nota 99", { avaliacao: { nota: 99, por: "a", em: 1 } }],
    ["avaliacao sem por", { avaliacao: { nota: 3, em: 1 } }],
    ["avaliacao com comentario enorme", { avaliacao: { nota: 3, por: "a", em: 1, comentario: "c".repeat(9000) } }],
    ["concluidaEm invalida", { concluidaEm: "2026-02-30" }],
    ["prazoOriginal invalido", { prazoOriginal: "ontem" }],
    ["iniciadaEm texto", { iniciadaEm: "x" }],
    ["arquivadoEm negativo", { arquivadoEm: -1 }],
    ["alteradoPor numerico", { alteradoPor: 7 }],
  ];
  for (const [nome, extra] of ruins) checar(`recusa: ${nome}`, !entidadeValida({ ...base, ...extra }, "d", AG));
  checar(
    "aceita os campos bem formados",
    entidadeValida(
      {
        ...base,
        responsavel: { nome: "Ana", login: "ana" },
        etapa: { projeto: "p", etapa: "e", rotulo: "P > E" },
        documentoEntregue: { numero: "123", titulo: "Nota", sigiloso: true },
        avaliacao: { nota: 4, por: "ana", em: 5, comentario: "bom" },
        concluidaEm: "2026-10-05",
        prazoOriginal: "2026-10-10",
        iniciadaEm: 3,
        arquivadoEm: 9,
      },
      "d",
      AG,
    ),
  );
  checar(
    "registro com nome numerico e recusado",
    !entidadeValida(registro({ id: "r1", demanda: "v1", quando: AG, nome: 5 as never }), "h", AG),
  );
  checar("registro bom e aceito", entidadeValida(registro({ id: "r2", demanda: "v1", quando: AG, nome: "Ana" }), "h", AG));

  secao("Revisao: importar recusa o torto, descarta campo desconhecido e exportar nao lanca");
  const R = repoDeTeste();
  const lixo = "x".repeat(90_000);
  const r = await R.repo.importar(
    {
      d: [
        demanda({ id: "i1", documentoEntregue: { numero: 5 as never } }),
        demanda({ id: "i2", responsavel: { nome: 1 as never } }),
        { ...demanda({ id: "i3" }), lixo } as never,
      ],
      h: [],
    },
    AG,
  );
  checar("os dois tortos contam como ignorados", r.ignorados === 2 && r.novos === 1);
  checar("exportar nao lanca", (await R.repo.exportarTabela("d", AG)).entidades.d.length === 1);
  const gravada = (await R.repo.obter("i3")) as unknown as Record<string, unknown>;
  checar("o campo extra de 90 KB nao sobrevive", gravada && !("lixo" in gravada) && !JSON.stringify(gravada).includes("xxxxxxxx"));
  const comAninhado = { ...demanda({ id: "i4", responsavel: { nome: "A", extra: lixo } as never }) };
  await R.repo.importar({ d: [comAninhado], h: [] }, AG);
  checar("campo extra aninhado tambem cai", !JSON.stringify(await R.repo.obter("i4")).includes("xxxxxxxx"));
  await R.repo.importar({ d: [], h: [{ ...registro({ id: "h1", demanda: "i3", quando: AG }), lixo } as never] }, AG);
  checar("registro: campo extra cai", !JSON.stringify(await R.repo.historico()).includes("xxxxxxxx"));

  secao("Revisao: teto do historico local");
  checar("o teto existe", LIMITES.historicoLocal === 5000);
  const H = repoDeTeste();
  const lote = Array.from({ length: LIMITES.historicoLocal + 3 }, (_, i) =>
    registro({ id: `rr${i}`, demanda: "d", quando: T0 + i, atualizadoEm: 1 }),
  );
  const rh = await H.repo.importar({ d: [], h: lote }, AG + 100_000);
  checar("importar aceita tudo e a poda fica com os mais recentes", rh.novos === LIMITES.historicoLocal + 3 && rh.excedentes === 0);
  checar(
    "os 3 mais antigos sairam",
    !(await H.repo.historico()).some((x) => x.id === "rr0" || x.id === "rr2") && (await H.repo.historico()).some((x) => x.id === "rr3"),
  );
  checar("o local nao passa do teto", (await H.repo.historico()).length === LIMITES.historicoLocal);
  const P = repoDeTeste();
  await P.repo.importar({ d: [], h: lote.slice(0, LIMITES.historicoLocal) }, AG + 100_000);
  P.relogio.agora = T0 + 10_000_000;
  await P.repo.criar({ titulo: "Nova", prazo: "2026-10-20", distribuidaEm: "2026-10-01" });
  const depois = await P.repo.historico();
  checar("a gravacao poda os mais antigos acima do teto", depois.length === LIMITES.historicoLocal);
  checar(
    "o mais antigo saiu e o novo ficou",
    !depois.some((x) => x.id === "rr0") && depois.some((x) => x.campo === "criacao" && x.demanda !== "d"),
  );
}
