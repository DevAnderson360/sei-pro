export interface LinhaLote {
  especificacao: string;
  interessado?: string;
  observacao?: string;
  /** "0" = publico, "1" = restrito (valores do campo do SEI). */
  nivelAcesso?: "0" | "1";
  /**
   * O que veio na coluna nivel quando nao e um nivel reconhecido ("Sigiloso", "R"...). A linha NAO pode ser criada
   * assim: cair no nivel do lote (publico por padrao) exporia um processo que a planilha queria restrito. A previa
   * mostra o erro e trava o Iniciar ate o usuario corrigir ou tirar a linha.
   */
  nivelInvalido?: string;
}

const NOMES_SEM_CABECALHO = ["especificacao", "interessado", "observacao", "nivel"];

/**
 * Textos (normalizados) que fazem da 1a linha um cabecalho: basta UMA celula ser exatamente um deles. Comparacao
 * exata de proposito: "Descricao de servico" na 1a celula e dado, nao cabecalho.
 */
const PALAVRAS_CABECALHO = new Set([
  "especificacao",
  "especificacoes",
  "descricao",
  "descricoes",
  "assunto",
  "interessado",
  "interessados",
  "observacao",
  "observacoes",
  "nivel",
  "nivel de acesso",
]);

/** Minuscula e sem acento, para reconhecer cabecalhos e niveis escritos de qualquer jeito. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .trim();
}

/** Nome canonico de uma coluna que nao e a da especificacao (ou o proprio texto normalizado, que e ignorado). */
function nomeColuna(celula: string): string {
  const n = normalizar(celula);
  if (n === "interessados") return "interessado";
  if (n === "observacoes") return "observacao";
  if (n === "nivel de acesso") return "nivel";
  return n;
}

const COLUNAS_USADAS = new Set(["interessado", "observacao", "nivel"]);

/** Celula de cabecalho que nomeia a coluna da especificacao: especificacao*, descricao* ou assunto. */
function ehColunaEspecificacao(celula: string): boolean {
  const n = normalizar(celula);
  return n.startsWith("especificac") || n.startsWith("descric") || n === "assunto";
}

/**
 * Colunas a partir do cabecalho: a da especificacao e a 1a celula especificacao*, descricao* ou assunto (sem
 * nenhuma, a 1a coluna); as demais pelo nome. Outra celula com cara de especificacao, ou desconhecida, e ignorada.
 */
function colunasDoCabecalho(primeira: string[]): string[] {
  const achada = primeira.findIndex(ehColunaEspecificacao);
  const k = achada >= 0 ? achada : 0;
  return primeira.map((c, i) => {
    if (i === k) return "especificacao";
    const nome = nomeColuna(c);
    // Coluna sem uso (outra "especificacao", "Codigo"...): nomeada assim no contador da configuracao.
    return COLUNAS_USADAS.has(nome) ? nome : `(ignorada) ${c}`;
  });
}

/**
 * Separa o texto em linhas de celulas. Celulas separadas por tabulacao; uma celula que
 * comeca com aspas (como o Excel exporta quando ha tabulacao ou quebra de linha dentro
 * dela) vai ate as aspas de fechamento, e "" dentro dela e uma aspa.
 */
function separarCelulas(texto: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let i = 0;
  const n = texto.length;
  const fecharCelula = () => {
    linha.push(celula.trim());
    celula = "";
  };
  const fecharLinha = () => {
    fecharCelula();
    linhas.push(linha);
    linha = [];
  };
  while (i < n) {
    const c = texto[i] as string;
    if (c === '"' && celula.trim() === "") {
      // Celula entre aspas
      celula = "";
      i++;
      while (i < n) {
        const d = texto[i] as string;
        if (d === '"') {
          if (texto[i + 1] === '"') {
            celula += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        celula += d;
        i++;
      }
      continue;
    }
    if (c === "\t") {
      fecharCelula();
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fecharLinha();
    } else {
      celula += c;
    }
    i++;
  }
  if (celula !== "" || linha.length > 0) fecharLinha();
  return linhas;
}

/** Nivel da celula; `undefined` = nao reconhecido (quem chama marca a linha como invalida, nunca adivinha). */
function lerNivel(valor: string): "0" | "1" | undefined {
  const n = normalizar(valor);
  if (n === "publico" || n === "publica" || n === "0") return "0";
  if (n === "restrito" || n === "restrita" || n === "1") return "1";
  return undefined;
}

/**
 * Le o texto colado (ou o CSV/planilha) em linhas de processo e diz quais colunas encontrou.
 * Sem tabulacao em nenhuma linha vale o comportamento do legado: uma especificacao por linha.
 */
export function lerLinhas(texto: string): { linhas: LinhaLote[]; colunas: string[] } {
  const bruto = separarCelulas(texto).filter((cs) => cs.some((c) => c !== ""));
  if (bruto.length === 0) return { linhas: [], colunas: ["especificacao"] };

  const temTab = /\t/.test(texto);
  if (!temTab) {
    // Aspas nao tem significado especial fora de planilha; mantem o texto como veio.
    const simples = texto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== "");
    return { linhas: simples.map((especificacao) => ({ especificacao })), colunas: ["especificacao"] };
  }

  const primeira = bruto[0] as string[];
  const temCabecalho = primeira.some((c) => PALAVRAS_CABECALHO.has(normalizar(c)));
  const largura = Math.min(Math.max(...bruto.map((r) => r.length)), NOMES_SEM_CABECALHO.length);
  const colunas = temCabecalho ? colunasDoCabecalho(primeira) : NOMES_SEM_CABECALHO.slice(0, Math.max(largura, 1));
  const dados = temCabecalho ? bruto.slice(1) : bruto;

  const linhas: LinhaLote[] = dados.map((cs) => {
    const linha: LinhaLote = { especificacao: "" };
    colunas.forEach((nome, k) => {
      const v = cs[k] ?? "";
      if (nome === "especificacao") linha.especificacao = v;
      else if (v === "") return;
      else if (nome === "interessado") linha.interessado = v;
      else if (nome === "observacao") linha.observacao = v;
      else if (nome === "nivel") {
        const nivel = lerNivel(v);
        if (nivel) linha.nivelAcesso = nivel;
        else linha.nivelInvalido = v;
      }
    });
    return linha;
  });
  return { linhas, colunas };
}
