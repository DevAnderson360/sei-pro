import { NADA_CONHECIDO } from "@projetos/modelo/sigilo";
import { cortarSigiloDemandas } from "../src/modelo/sigilo";
import { manterNumerosSigilosos } from "../src/repositorio";
import { adaptadorDemandas } from "../src/sincronia/textoPadrao";
import { repoDeTeste, T0 } from "./apoioRepositorio";
import { demanda } from "./fabrica";
import { checar, secao } from "./util";

const NOVA = { titulo: "Nota tecnica", prazo: "2026-10-20", distribuidaEm: "2026-10-01" };
const AG = T0 + 30_000;
const X = "50300.001234/2026-11";

export async function verificarRevisaoSigilo(): Promise<void> {
  secao("Revisao: a memoria do sigilo usa a chave do Projetos (so digitos)");
  const S = repoDeTeste();
  await S.repo.criar({ ...NOVA, processos: [{ protocolo: X }] });
  await S.repo.marcarSigilosos([X]);
  const conhecidos = await S.repo.sigilosConhecidos();
  checar("marcarSigilosos grava a chave em digitos", conhecidos.processos.has("50300001234202611") && !conhecidos.processos.has(X));
  const B = await S.repo.criar({ ...NOVA, titulo: "Outra", processos: [{ protocolo: X }] });
  const ad = adaptadorDemandas({ repo: S.repo, area: S.area, tabela: "d", sigla: "S", nomeUsuario: "Ana" });
  const texto = await ad.exportar({ remoto: null, agora: AG, invalido: false });
  checar("a demanda B (sem marca) tambem sai sem o numero", !JSON.stringify(texto).includes("001234") && B.id.length > 0);
  const r = cortarSigiloDemandas([demanda({ id: "z", processos: [{ protocolo: X, sigiloso: true }] })], NADA_CONHECIDO);
  checar("o corte devolve a chave em digitos", r.raspados.processos.join() === "50300001234202611");
  const T = repoDeTeste();
  await T.repo.lembrarSigilo(r.raspados, "aprendida");
  checar(
    "o que o corte raspa vale para outra demanda sem marca",
    !JSON.stringify(
      cortarSigiloDemandas([demanda({ id: "y", processos: [{ protocolo: X }] })], await T.repo.sigilosConhecidos()).demandas,
    ).includes("001234"),
  );

  secao("Revisao: documento entregue de demanda sigilosa");
  const d = demanda({ id: "dd", processos: [{ protocolo: X, sigiloso: true }], documentoEntregue: { numero: "7654321" } });
  const c = cortarSigiloDemandas([d], NADA_CONHECIDO);
  checar("o numero do documento nao aparece", !JSON.stringify(c.demandas).includes("7654321"));
  checar(
    "o documento vai como marcador",
    c.demandas[0]?.documentoEntregue?.sigiloso === true && c.demandas[0]?.documentoEntregue?.numero === "",
  );
  checar("o numero do documento e memorizado", c.raspados.documentos.includes("7654321"));
  const dm = demanda({ id: "dm", processos: [{ protocolo: X }], documentoEntregue: { numero: "7654321" } });
  const cm = cortarSigiloDemandas([dm], { processos: new Set(["50300001234202611"]), documentos: new Set() });
  checar("processo so memorizado tambem corta o documento", !JSON.stringify(cm.demandas).includes("7654321"));
  const dp = demanda({ id: "dp", processos: [{ protocolo: "50300.000001/2026-01" }], documentoEntregue: { numero: "7654321" } });
  checar(
    "processo publico mantem o documento",
    cortarSigiloDemandas([dp], NADA_CONHECIDO).demandas[0]?.documentoEntregue?.numero === "7654321",
  );

  secao("Revisao: manterNumerosSigilosos casa em ordem, nao por posicao");
  const local = demanda({
    id: "m",
    processos: [{ protocolo: "50300.000111/2026-01" }, { protocolo: "50300.000999/2026-09", sigiloso: true }],
  });
  const venc = demanda({ id: "m", processos: [{ protocolo: "", sigiloso: true }] });
  const m = manterNumerosSigilosos(venc, local);
  checar(
    "o vazio recebe o sigiloso do local",
    m.processos.length === 1 && m.processos[0]?.protocolo === "50300.000999/2026-09" && m.processos[0]?.sigiloso === true,
  );
  const venc2 = demanda({
    id: "m",
    processos: [
      { protocolo: "", sigiloso: true },
      { protocolo: "", sigiloso: true },
    ],
  });
  const local2 = demanda({
    id: "m",
    processos: [
      { protocolo: "50300.000111/2026-01" },
      { protocolo: "50300.000999/2026-09", sigiloso: true },
      { protocolo: "50300.000888/2026-08", sigiloso: true },
    ],
  });
  const m2 = manterNumerosSigilosos(venc2, local2);
  checar(
    "dois vazios recebem os sigilosos em ordem",
    m2.processos.map((p) => p.protocolo).join() === "50300.000999/2026-09,50300.000888/2026-08",
  );
}
