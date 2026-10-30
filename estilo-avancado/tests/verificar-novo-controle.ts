import { ativarNovoControleNaAba, CHAVE_GRADE } from "../src/pagina/novoControle";
import { checar, instalarDom, secao } from "./util";

export function verificarNovoControle(): void {
  secao("novo controle junto com o estilo");
  const doc = instalarDom('<html><head></head><body><button class="spro-grade-botao" aria-pressed="false"></button></body></html>');
  const guardado: Record<string, string> = {};
  ativarNovoControleNaAba(doc, { setItem: (k, v) => void (guardado[k] = v) });
  checar("poe a bandeira da grade (spro_grade=1)", guardado[CHAVE_GRADE] === "1" && CHAVE_GRADE === "spro_grade");
  checar(
    "storage bloqueado nao lanca",
    (() => {
      try {
        ativarNovoControleNaAba(doc, {
          setItem: () => {
            throw new Error("bloqueado");
          },
        });
        return true;
      } catch {
        return false;
      }
    })(),
  );
}
