import { lerLinhas } from "../src/modelo/linhas";
import { igual, secao } from "./util";

export function verificarLinhas(): void {
  secao("lerLinhas");
  const sem = lerLinhas("Contrato 1\n\n  Contrato 2  \r\nContrato 3");
  igual(
    "sem tabulacao: uma por linha",
    sem.linhas.map((l) => l.especificacao),
    ["Contrato 1", "Contrato 2", "Contrato 3"],
  );
  igual("sem tabulacao: colunas", sem.colunas, ["especificacao"]);

  const cab = lerLinhas(
    "Especificação\tInteressado\tObservações\tNível de acesso\nA\tFulano\tobs\trestrito\nB\tBeltrano\t\tpublico\nC\t\t\t1",
  );
  igual("cabecalho: colunas", cab.colunas, ["especificacao", "interessado", "observacao", "nivel"]);
  igual("cabecalho: nao vira linha", cab.linhas.length, 3);
  igual("cabecalho: linha 1", cab.linhas[0], { especificacao: "A", interessado: "Fulano", observacao: "obs", nivelAcesso: "1" });
  igual("cabecalho: publico", cab.linhas[1]?.nivelAcesso, "0");
  igual("cabecalho: celula vazia ausente", cab.linhas[1]?.observacao, undefined);
  igual("cabecalho: nivel 1", cab.linhas[2]?.nivelAcesso, "1");

  const desc = lerLinhas("descricao\tnivel\nX\t0");
  igual("descricao tambem e cabecalho", desc.linhas, [{ especificacao: "X", nivelAcesso: "0" }]);

  const sc = lerLinhas("A\tFulano\tobs\nB\tBeltrano\tobs2");
  igual(
    "sem cabecalho: 1a coluna e especificacao",
    sc.linhas.map((l) => l.especificacao),
    ["A", "B"],
  );
  igual("sem cabecalho: colunas", sc.colunas, ["especificacao", "interessado", "observacao"]);
  igual("sem cabecalho: interessado", sc.linhas[1]?.interessado, "Beltrano");
  igual("sem cabecalho: observacao", sc.linhas[0]?.observacao, "obs");

  const ex = lerLinhas('"Contrato\ta ""b"""\tFulano\nOutro\tBeltrano');
  igual("aspas do Excel", ex.linhas[0]?.especificacao, 'Contrato\ta "b"');
  igual("aspas: interessado", ex.linhas[0]?.interessado, "Fulano");
  igual("aspas: segunda linha", ex.linhas[1]?.especificacao, "Outro");

  const vz = lerLinhas("Especificacao\tInteressado\nA\tX\n\n   \nB\tY");
  igual(
    "linha vazia no meio descartada",
    vz.linhas.map((l) => l.especificacao),
    ["A", "B"],
  );
  igual("texto vazio", lerLinhas("").linhas, []);

  secao("lerLinhas: nivel de acesso");
  const niv = lerLinhas(
    "A\t\t\tRestrita\nB\t\t\tPública\nC\t\t\tpublica\nD\t\t\t Público \nE\t\t\tRESTRITO\nF\t\t\tSigiloso\nG\t\t\tR\nH\t\t\t",
  );
  igual(
    "restrita, pública, publica, público, RESTRITO reconhecidos",
    niv.linhas.slice(0, 5).map((l) => l.nivelAcesso),
    ["1", "0", "0", "0", "1"],
  );
  igual("reconhecido nao marca invalido", niv.linhas[0]?.nivelInvalido, undefined);
  igual("Sigiloso: nao reconhecido, sem nivel", [niv.linhas[5]?.nivelAcesso, niv.linhas[5]?.nivelInvalido], [undefined, "Sigiloso"]);
  igual("R: nao reconhecido", niv.linhas[6]?.nivelInvalido, "R");
  igual("celula vazia: nem nivel nem invalido", [niv.linhas[7]?.nivelAcesso, niv.linhas[7]?.nivelInvalido], [undefined, undefined]);
  const invisivel = lerLinhas("A\t\t\tRestrito​");
  igual("caractere invisivel nao passa como reconhecido", invisivel.linhas[0]?.nivelInvalido, "Restrito​");

  secao("lerLinhas: cabecalho");
  const plural = lerLinhas("Especificações\tInteressados\tObservações\tNível\nA\tX\to\t1");
  igual("plural e cabecalho", plural.linhas, [{ especificacao: "A", interessado: "X", observacao: "o", nivelAcesso: "1" }]);
  const assunto = lerLinhas("Assunto\tNível de acesso\nA\tRestrito");
  igual("assunto e cabecalho (e a especificacao)", assunto.linhas, [{ especificacao: "A", nivelAcesso: "1" }]);
  const meio = lerLinhas("Texto\tNível\nA\tPúblico");
  igual("qualquer celula de cabecalho basta; 1a coluna e a especificacao", meio.linhas, [{ especificacao: "A", nivelAcesso: "0" }]);
  igual("qualquer celula: a linha de cabecalho nao vira processo", meio.linhas.length, 1);
  const outra = lerLinhas("Código\tDescrição do processo\tInteressado\n12\tContrato X\tFulano");
  igual("coluna da especificacao pelo nome (descricao*)", outra.linhas, [{ especificacao: "Contrato X", interessado: "Fulano" }]);
  igual("coluna desconhecida aparece como ignorada", outra.colunas, ["(ignorada) Código", "especificacao", "interessado"]);
  const espPref = lerLinhas("Nível\tEspecificação do processo\n1\tContrato Y");
  igual("especificacao* define a coluna", espPref.linhas, [{ especificacao: "Contrato Y", nivelAcesso: "1" }]);
  const interFirst = lerLinhas("Interessado\tObservação\nContrato Z\tobs");
  igual("sem coluna de especificacao: a 1a coluna e a especificacao", interFirst.linhas, [
    { especificacao: "Contrato Z", observacao: "obs" },
  ]);
  const dado = lerLinhas("Descrição de serviço\tFulano\nB\tBeltrano");
  igual(
    "linha que parece dado nunca e cabecalho",
    dado.linhas.map((l) => l.especificacao),
    ["Descrição de serviço", "B"],
  );
  const dado2 = lerLinhas("Contrato 1\tPúblico\nContrato 2\tRestrito");
  igual("dados sem cabecalho seguem a ordem padrao", dado2.linhas.length, 2);
}
