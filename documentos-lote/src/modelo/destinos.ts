import { extrairProtocolos } from "@comum/texto/protocolos";
import { TETO } from "@dl/modelo/constantes";
import { nomeNaArvore } from "@dl/modelo/nomes";

export type Destino =
  | { tipo: "tela" }
  | { tipo: "novo-processo"; idTipoProcesso: string; especificacao: string }
  | { tipo: "coluna"; coluna: string };

export interface LinhaDocumento {
  indice: number;
  dados: Record<string, string>;
  /** Nº do processo normalizado, só no destino coluna. */
  destino?: string;
  erroLinha?: string;
  nivel?: "publico" | "restrito";
  hipotese?: string;
}

export interface ConfigLinhas {
  destino: Destino;
  colunaNivel?: string;
  colunaHipotese?: string;
  colunaNome: string;
}

/**
 * Número de processo da célula: o primeiro protocolo do tipo "processo"; na falta dele, a célula aparada se for um
 * único token de 3 a 60 caracteres com dígito e "/", "." ou "-" (formatos do SEI de SP). Número só de dígitos
 * (documento SEI), vários tokens sem número reconhecido e célula vazia dão null.
 */
export function numeroDeProcesso(celula: string): string | null {
  const achado = extrairProtocolos(celula).find((p) => p.tipo === "processo");
  if (achado) return achado.texto.trim();
  const t = celula.trim();
  if (/\s/.test(t) || t.length < 3 || t.length > 60) return null;
  return /\d/.test(t) && /[/.-]/.test(t) ? t : null;
}

function lerNivel(valor: string): "publico" | "restrito" | null {
  const v = valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (v === "publico" || v === "0") return "publico";
  if (v === "restrito" || v === "1") return "restrito";
  return null;
}

/** Valida cada registro e monta as linhas; o erro de uma linha não barra as outras. */
export function prepararLinhas(registros: Record<string, string>[], cfg: ConfigLinhas): LinhaDocumento[] {
  if (registros.length > TETO) {
    throw new Error(`O arquivo tem ${registros.length} linhas; o máximo por execução é ${TETO}.`);
  }
  return registros.map((dados, indice) => {
    const linha: LinhaDocumento = { indice, dados, nivel: "publico" };
    if (cfg.destino.tipo === "coluna") {
      const numero = numeroDeProcesso(dados[cfg.destino.coluna] ?? "");
      if (numero === null) linha.erroLinha = "Processo inválido ou vazio";
      else linha.destino = numero;
    }
    if (!linha.erroLinha && !nomeNaArvore(dados[cfg.colunaNome] ?? "")) {
      linha.erroLinha = "Nome na árvore vazio";
    }
    if (cfg.colunaNivel) {
      const bruto = dados[cfg.colunaNivel] ?? "";
      const nivel = bruto.trim() === "" ? "publico" : lerNivel(bruto);
      if (!nivel) {
        linha.erroLinha ??= `Nível de acesso inválido: "${bruto.trim()}"`;
      } else {
        linha.nivel = nivel;
        if (nivel === "restrito") {
          const hip = (cfg.colunaHipotese ? (dados[cfg.colunaHipotese] ?? "") : "").trim();
          if (hip) linha.hipotese = hip;
          else linha.erroLinha ??= "Nível restrito sem hipótese legal";
        }
      }
    }
    return linha;
  });
}

/** Nº do processo → índices das linhas; ignora as com erro ou sem destino (não se verifica processo de linha que não será gravada). */
export function agruparPorProcesso(linhas: LinhaDocumento[]): Map<string, number[]> {
  const grupos = new Map<string, number[]>();
  for (const l of linhas) {
    if (l.destino === undefined || l.erroLinha) continue;
    const lista = grupos.get(l.destino);
    if (lista) lista.push(l.indice);
    else grupos.set(l.destino, [l.indice]);
  }
  return grupos;
}
