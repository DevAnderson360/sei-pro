import { TETO } from "../src/modelo/constantes";
import { agruparPorProcesso, numeroDeProcesso, prepararLinhas } from "../src/modelo/destinos";
import { checar, igual, secao } from "./util";

export function verificarDestinos(): void {
  secao("destinos");
  igual("numero normalizado", numeroDeProcesso("  50300.018905/2018-67 "), "50300.018905/2018-67");
  igual("sem numero", numeroDeProcesso("sem numero"), null);
  igual("so numero SEI nao e processo", numeroDeProcesso("1234567"), null);
  igual("formato SP com barras", numeroDeProcesso("SEI-260005/000123/2026"), "SEI-260005/000123/2026");
  igual("formato SP com ponto", numeroDeProcesso(" 6068.2020/0000001-2 "), "6068.2020/0000001-2");
  igual("6 digitos e documento SEI", numeroDeProcesso("123456"), null);
  igual("varios tokens sem numero", numeroDeProcesso("contrato 77 do ano"), null);
  igual("celula vazia", numeroDeProcesso("   "), null);
  igual("texto + processo reconhecido", numeroDeProcesso("ver 50300.018905/2018-67 agora"), "50300.018905/2018-67");

  const coluna = { tipo: "coluna", coluna: "proc" } as const;
  const regs = [
    { proc: "50300.018905/2018-67", nome: "A" },
    { proc: " 50300.018905/2018-67 ", nome: "B" },
    { proc: "50300.000001/2020-11", nome: "C" },
  ];
  const linhas = prepararLinhas(regs, { destino: coluna, colunaNome: "nome" });
  igual(
    "destino normalizado",
    linhas.map((l) => l.destino),
    ["50300.018905/2018-67", "50300.018905/2018-67", "50300.000001/2020-11"],
  );
  igual(
    "indices",
    linhas.map((l) => l.indice),
    [0, 1, 2],
  );
  igual(
    "agrupa em 2 chaves",
    [...agruparPorProcesso(linhas).entries()],
    [
      ["50300.018905/2018-67", [0, 1]],
      ["50300.000001/2020-11", [2]],
    ],
  );
  igual("padrao publico", linhas[0]?.nivel, "publico");
  igual("sem erro", linhas[0]?.erroLinha, undefined);

  const vazia = prepararLinhas([{ proc: "", nome: "A" }], { destino: coluna, colunaNome: "nome" });
  igual("celula vazia", vazia[0]?.erroLinha, "Processo inválido ou vazio");
  igual("invalida fora do agrupamento", agruparPorProcesso(vazia).size, 0);

  const nomeVazio = prepararLinhas([{ proc: "50300.018905/2018-67", nome: "  " }], { destino: coluna, colunaNome: "nome" });
  checar("nome vazio tem erro", !!nomeVazio[0]?.erroLinha);
  igual("nome vazio mantem destino", nomeVazio[0]?.destino, "50300.018905/2018-67");
  igual("linha com erro nao entra no agrupamento", agruparPorProcesso(nomeVazio).size, 0);

  const tela = prepararLinhas([{ proc: "lixo", nome: "A" }], { destino: { tipo: "tela" }, colunaNome: "nome" });
  igual("tela ignora coluna de processo", tela[0]?.erroLinha, undefined);
  igual("tela sem destino", tela[0]?.destino, undefined);
  igual("tela nao agrupa", agruparPorProcesso(tela).size, 0);

  const cfg = { destino: { tipo: "tela" } as const, colunaNome: "nome", colunaNivel: "nivel", colunaHipotese: "hip" };
  const n = prepararLinhas(
    [
      { nome: "A", nivel: "Restrito", hip: "" },
      { nome: "B", nivel: "Restrito", hip: "Informação Pessoal" },
      { nome: "C", nivel: "Público", hip: "" },
      { nome: "D", nivel: "0", hip: "" },
      { nome: "E", nivel: "1", hip: "X" },
      { nome: "F", nivel: "secreto", hip: "" },
      { nome: "G", nivel: "", hip: "" },
    ],
    cfg,
  );
  checar("restrito sem hipotese erra", !!n[0]?.erroLinha);
  igual("restrito com hipotese", [n[1]?.nivel, n[1]?.hipotese, n[1]?.erroLinha], ["restrito", "Informação Pessoal", undefined]);
  igual("Público", n[2]?.nivel, "publico");
  igual("0 e publico", n[3]?.nivel, "publico");
  igual("1 e restrito", n[4]?.nivel, "restrito");
  checar("nivel invalido erra", !!n[5]?.erroLinha);
  igual("nivel vazio e publico sem erro", [n[6]?.nivel, n[6]?.erroLinha], ["publico", undefined]);
  const misto = prepararLinhas([{ proc: "x", nome: "A", nivel: "secreto" }], { destino: coluna, colunaNome: "nome", colunaNivel: "nivel" });
  igual("ordem: erro do processo prevalece", misto[0]?.erroLinha, "Processo inválido ou vazio");
  const pub = prepararLinhas([{ nome: "A", nivel: "publico", hip: "Informação Pessoal" }], cfg);
  igual("publico ignora hipotese", [pub[0]?.nivel, pub[0]?.hipotese], ["publico", undefined]);

  let lancou = "";
  try {
    prepararLinhas(
      Array.from({ length: TETO + 1 }, () => ({ nome: "x" })),
      { destino: { tipo: "tela" }, colunaNome: "nome" },
    );
  } catch (e) {
    lancou = (e as Error).message;
  }
  checar("2001 registros lanca com o teto", lancou.includes(String(TETO)), lancou);
  igual(
    "2000 registros passa",
    prepararLinhas(
      Array.from({ length: TETO }, () => ({ nome: "x" })),
      { destino: { tipo: "tela" }, colunaNome: "nome" },
    ).length,
    TETO,
  );
}
