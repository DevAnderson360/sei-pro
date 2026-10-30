import { bloqueiaCriacao, faixaDoTamanho, muitasAtivas, pesoTotalAlto } from "../src/modelo/alertas";
import { AVISO_TEXTO, TETO_TEXTO } from "../src/modelo/constantes";
import { checar, secao } from "./util";

export function verificarAlertas(): void {
  secao("Faixas de tamanho (79%, 80%, 99%, 100%)");
  const f = (b: number) => faixaDoTamanho(b).faixa;
  checar("0 e normal", f(0) === "normal");
  checar("79% e normal", f(Math.floor(TETO_TEXTO * 0.79)) === "normal");
  checar("exatamente o aviso ja avisa", f(AVISO_TEXTO) === "aviso");
  checar("99% avisa", f(Math.floor(TETO_TEXTO * 0.99)) === "aviso");
  checar("exatamente o teto bloqueia", f(TETO_TEXTO) === "bloqueio");
  checar("acima do teto bloqueia", f(TETO_TEXTO + 1) === "bloqueio");
  checar("sem medida e normal", faixaDoTamanho(undefined).faixa === "normal");
  checar("percentual", faixaDoTamanho(TETO_TEXTO / 2).percentual === 50);
  checar(
    "bloqueia criacao so no teto da tabela d",
    bloqueiaCriacao(TETO_TEXTO) && !bloqueiaCriacao(AVISO_TEXTO) && !bloqueiaCriacao(undefined),
  );
  secao("Peso total e quantidade");
  checar("peso total: 200 KB ou mais", pesoTotalAlto([100 * 1024, 100 * 1024]) && !pesoTotalAlto([100 * 1024, 99 * 1024]));
  checar("muitas ativas: acima de 800", muitasAtivas(801) && !muitasAtivas(800));
}
