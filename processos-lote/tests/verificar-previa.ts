import { TEXTO_AVISO } from "../src/app/previa";
import { bloqueia, estimarDuracao, limitarPausa, montarPrevia } from "../src/modelo/previa";
import { checar, igual, secao } from "./util";

export function verificarPrevia(): void {
  secao("montarPrevia");
  const p = montarPrevia([
    { especificacao: "Contrato 1" },
    { especificacao: "Contrato 1" },
    { especificacao: "x".repeat(120) },
    { especificacao: "A — B" },
    { especificacao: `— ${"y".repeat(101)}` },
  ]);
  igual("primeira ocorrencia sem aviso", p[0]?.avisos, []);
  igual("segunda igual e duplicada", p[1]?.avisos, ["duplicada"]);
  igual(
    "indice base 1",
    p.map((l) => l.indice),
    [1, 2, 3, 4, 5],
  );
  igual("truncada acima de 100", p[2]?.avisos, ["truncada"]);
  igual("enviada corta em 100", p[2]?.enviada, "x".repeat(100));
  igual("original preservada", p[2]?.original, "x".repeat(120));
  igual("convertida quando muda", p[3]?.avisos, ["convertida"]);
  igual("enviada convertida", p[3]?.enviada, "A - B");
  igual("truncada e convertida", p[4]?.avisos, ["convertida", "truncada"]);
  igual("enviada: corta depois de converter e apara", p[4]?.enviada, `- ${"y".repeat(98)}`);
  const v = montarPrevia([{ especificacao: "  " }]);
  igual("vazia", v[0]?.avisos, ["vazia"]);
  const d = montarPrevia([{ especificacao: "a" }, { especificacao: "A" }, { especificacao: "a " }]);
  igual("duplicada compara o que sera enviado (sem espacos nas pontas)", d[2]?.avisos, ["duplicada"]);
  igual("caixa diferente nao e duplicada", d[1]?.avisos, []);

  secao("montarPrevia: nivel nao reconhecido e interessado");
  const n = montarPrevia([
    { especificacao: "A", nivelInvalido: "Sigiloso" },
    { especificacao: "B", nivelAcesso: "1" },
    { especificacao: "C", interessado: "Fulano" },
  ]);
  igual("nivel nao reconhecido e aviso da linha", n[0]?.avisos, ["nivel-invalido"]);
  checar("nivel nao reconhecido bloqueia", bloqueia(n[0]?.avisos ?? []));
  igual("nivel reconhecido sem aviso", n[1]?.avisos, []);
  igual("interessado: aviso visivel", n[2]?.avisos, ["interessado"]);
  checar("interessado nao bloqueia", !bloqueia(n[2]?.avisos ?? []));
  igual("texto do erro de nivel", TEXTO_AVISO["nivel-invalido"], "nível não reconhecido: use Público ou Restrito (ou 0/1)");
  igual("texto do aviso de interessado", TEXTO_AVISO.interessado, "interessado: não é aplicado nesta versão");

  secao("estimarDuracao e pausa");
  igual("14 minutos", estimarDuracao(600, 500), "cerca de 14 minutos");
  igual("menos de um minuto", estimarDuracao(10, 500), "menos de um minuto");
  igual("um minuto", estimarDuracao(43, 500), "cerca de 1 minuto");
  igual("minutos arredondados", estimarDuracao(2000, 500), "cerca de 47 minutos");
  igual("horas e minutos", estimarDuracao(3000, 500), "cerca de 1 h 10 min");
  igual("hora cheia", estimarDuracao(3600, 100), "cerca de 1 h");
  igual("pausa minima", limitarPausa("50"), 200);
  igual("pausa maxima", limitarPausa(99999), 10000);
  igual("pausa ausente", limitarPausa(undefined), 500);
  igual("pausa texto invalido", limitarPausa("abc"), 500);
  igual("pausa valida", limitarPausa("750"), 750);
}
