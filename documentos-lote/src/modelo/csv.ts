export interface CsvLido {
  colunas: string[];
  registros: Record<string, string>[];
  codificacao: "utf-8" | "windows-1252" | "utf-16le" | "utf-16be";
  /** O que foi lido, mas com problema que o usuário deve conferir (ex.: aspas não fechadas). */
  avisos: string[];
}

/**
 * UTF-16 só com BOM (o "Texto Unicode" do Excel grava FF FE); sem BOM, UTF-8 estrito e, se não for, Windows-1252
 * (o CSV do Excel antigo).
 */
function decodificar(bytes: Uint8Array): { texto: string; codificacao: CsvLido["codificacao"] } {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { texto: new TextDecoder("utf-16le").decode(bytes), codificacao: "utf-16le" };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { texto: new TextDecoder("utf-16be").decode(bytes), codificacao: "utf-16be" };
  let texto: string;
  let codificacao: CsvLido["codificacao"] = "utf-8";
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder("windows-1252").decode(bytes);
    codificacao = "windows-1252";
  }
  return { texto: texto.replace(/^\uFEFF/, ""), codificacao };
}

/** Separador pela primeira linha fora de aspas: o mais frequente entre `;` `,` e tab (empate: `;`). */
function detectarSeparador(texto: string): string {
  const cont: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  let aspas = false;
  for (const c of texto) {
    if (c === '"') aspas = !aspas;
    else if (!aspas) {
      if (c === "\n" || c === "\r") break;
      if (c in cont) cont[c] = (cont[c] as number) + 1;
    }
  }
  let melhor = ";";
  for (const s of [",", "\t"]) if ((cont[s] as number) > (cont[melhor] as number)) melhor = s;
  return melhor;
}

/**
 * Máquina de estados RFC 4180: aspas, aspas duplas escapadas e quebra de linha dentro da célula. Aspas que nunca
 * fecham engolem o resto do arquivo numa célula só (é o que a regra manda); `aspasAbertaNaLinha` diz a linha do
 * arquivo (1, 2...) onde elas abriram, para o aviso.
 */
function separarLinhas(texto: string, sep: string): { linhas: string[][]; aspasAbertaNaLinha?: number } {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let cel = "";
  let aspas = false;
  let linhaFisica = 1;
  let abertaEm = 0;
  const fecharLinha = (): void => {
    linha.push(cel);
    linhas.push(linha);
    linha = [];
    cel = "";
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i] as string;
    if (c === "\n" || (c === "\r" && texto[i + 1] !== "\n")) linhaFisica++;
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          cel += '"';
          i++;
        } else aspas = false;
      } else cel += c;
    } else if (c === '"') {
      aspas = true;
      abertaEm = linhaFisica;
    } else if (c === sep) {
      linha.push(cel);
      cel = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") {
        i++;
        linhaFisica++;
      }
      fecharLinha();
    } else cel += c;
  }
  if (cel !== "" || linha.length > 0) fecharLinha();
  return aspas ? { linhas, aspasAbertaNaLinha: abertaEm } : { linhas };
}

/**
 * Nomes das colunas: cabeçalho vazio sai; repetido ganha " (2)", " (3)"... até achar um nome livre. Os cabeçalhos
 * reais ficam reservados: um sufixo nunca toma o nome de uma coluna de verdade (um `##a (2)##` do modelo casa com a
 * coluna que o usuário chamou assim, não com a segunda "a").
 */
function nomesDasColunas(cabecalho: string[]): { indice: number; nome: string }[] {
  const reais = new Set(cabecalho.map((c) => c.trim()).filter(Boolean));
  const usados = new Set<string>();
  const mapa: { indice: number; nome: string }[] = [];
  cabecalho.forEach((bruto, indice) => {
    const base = bruto.trim();
    if (!base) return;
    let nome = base;
    if (usados.has(nome)) {
      let k = 2;
      while (usados.has(`${base} (${k})`) || reais.has(`${base} (${k})`)) k++;
      nome = `${base} (${k})`;
    }
    usados.add(nome);
    mapa.push({ indice, nome });
  });
  return mapa;
}

/** Lê um CSV (UTF-16 com BOM, UTF-8 estrito ou Windows-1252) em colunas e registros. Nunca lança por conteúdo vazio. */
export function lerCsv(bytes: Uint8Array): CsvLido {
  const { texto, codificacao } = decodificar(bytes);
  const sep = separarLinhas(texto, detectarSeparador(texto));
  const avisos =
    sep.aspasAbertaNaLinha !== undefined
      ? [`Aspas não fechadas na linha ${sep.aspasAbertaNaLinha}: o resto do arquivo foi lido como uma célula só. Confira a planilha.`]
      : [];
  const linhas = sep.linhas.filter((l) => l.some((c) => c.trim() !== ""));
  const cabecalho = linhas.shift();
  if (!cabecalho) return { colunas: [], registros: [], codificacao, avisos };

  const mapa = nomesDasColunas(cabecalho);
  const registros = linhas.map((l) => {
    const reg: Record<string, string> = {};
    for (const { indice, nome } of mapa) reg[nome] = l[indice] ?? "";
    return reg;
  });
  return { colunas: mapa.map((m) => m.nome), registros, codificacao, avisos };
}
