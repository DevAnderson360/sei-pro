/**
 * O agente lê os projetos do SEI Pro (gestor de projetos com Gantt, spec 7).
 * SOMENTE LEITURA.
 *
 * O painel do agente é página da extensão: lê o `chrome.storage.local` direto,
 * pelo repositório dos projetos, sem ponte. Da aba vem só o escopo (SEI,
 * usuário e unidade da tela ligada ao painel): os dois escopos da unidade,
 * "Toda a unidade" e "Só eu".
 *
 * Processo sigiloso nunca sai daqui, pela MESMA regra do Texto Padrão
 * (`sigiloDoEnvelope`, projetos/src/modelo/sigilo.ts: o número marcado em
 * qualquer projeto ou etapa, viva ou lápide, dos dois escopos) somada à memória
 * local do sigilo (`memoriaSigilo.ts`): o projeto de processo sigiloso e a etapa
 * de processo próprio sigiloso ficam de fora (só contados). Sem ler a memória,
 * nada é listado (falha fechada, como o texto e o arquivo).
 *
 * Nenhum número de processo nem de documento vai na resposta: os vínculos não
 * vão, e o texto livre (nomes, fase, observações, checklist; cada campo sozinho)
 * sai sem os números que este computador conhece (vínculos, documentos, registros
 * e a memória) e sem os que têm a forma de número de processo, escritos de
 * qualquer jeito que a pessoa leia como o número: qualquer pontuação ou símbolo
 * entre os blocos, invisível no meio, dígito de outra escrita, de trás para a
 * frente (ver `semNumeros`).
 */

import { type Area, areaChrome } from "@comum/armazenamento/area";
import { formatarData, hojeISO } from "@comum/datas/dias";
import { lerOpcaoLegada } from "@comum/opcoes/legadas";
import { normalizarTexto } from "@comum/texto";
import { montarUnidade, type ProjetoNaTela } from "@projetos/app/dados";
import { alertasDasEtapas } from "@projetos/modelo/alertas";
import { escoposDaUnidade, rotuloDaVis } from "@projetos/modelo/escopo";
import { ErroMemoriaSigilo } from "@projetos/modelo/memoriaSigilo";
import { porOrdem } from "@projetos/modelo/operacoes";
import { progressoDaEtapa } from "@projetos/modelo/progresso";
import { resumoDoProjeto } from "@projetos/modelo/resumo";
import { etapaSigilosa, type SigiloDoEnvelope, type SigilosConhecidos, sigiloDoEnvelope } from "@projetos/modelo/sigilo";
import { ROTULO_MARCO, ROTULO_SITUACAO, situacaoEtapa, situacaoMarco } from "@projetos/modelo/situacao";
import type { DataISO, Entidades, Etapa } from "@projetos/modelo/tipos";
import { chaveDocumento, chaveProtocolo } from "@projetos/modelo/vinculos";
import { type Dados, RepositorioProjetos } from "@projetos/repositorio";
import { s } from "../motor/esquema";
import { definirTool, type DefTool } from "../motor/tools";
import { type Achado, INVISIVEIS, varrerCamposLivres } from "../seguranca/injecao";

/**
 * A opção "Gerenciar Projetos" das opções do SEI Pro. Ausente conta como ligada (a regra do legado,
 * `opcaoLegadaLigada`); ILEGÍVEL conta como desligada: o content script e o app também não seguem sem lê-la.
 */
const opcaoDaExtensao = (): Promise<boolean> => lerOpcaoLegada("gerenciarprojetos").catch(() => false);

let fonteArea: () => Area = () => areaChrome(chrome.storage.local, "local");
let opcaoLigada: () => Promise<boolean> = opcaoDaExtensao;
/** O último valor lido da opção (null: ainda não lido). É o que a sugestão da caixa consulta. */
let opcaoVista: boolean | null = null;

/** Para os testes: a área em memória no lugar do chrome.storage. */
export function definirAreaProjetos(f: () => Area): void {
  fonteArea = f;
}

/** Para os testes: a opção "Gerenciar Projetos" no lugar do chrome.storage.sync (sem argumento, a da extensão). */
export function definirOpcaoProjetos(f: () => Promise<boolean> = opcaoDaExtensao): void {
  opcaoLigada = f;
  opcaoVista = null;
}

async function opcaoAgora(): Promise<boolean> {
  opcaoVista = await opcaoLigada();
  return opcaoVista;
}

/** O manifest da extensão traz o gestor de projetos novo (false sem `chrome`, como nos testes). */
export function projetosInstalado(): boolean {
  try {
    return (chrome.runtime.getManifest().content_scripts ?? []).some((c) => c.js?.includes("js/init_projetos.js"));
  } catch {
    return false;
  }
}

/** Para o painel, quando a tela muda: relê a opção (só no pacote com o módulo), para a sugestão da caixa. */
export async function atualizarOpcaoProjetos(): Promise<void> {
  if (projetosInstalado()) await opcaoAgora();
}

/** A ferramenta cumpre o pedido agora: o módulo no manifest e a opção ligada (a última lida). */
export function projetosDisponiveis(): boolean {
  return projetosInstalado() && opcaoVista === true;
}

/** Teto de etapas na resposta. */
export const MAX_ETAPAS = 300;

/**
 * Tamanho da resposta (JSON, em caracteres) que as etapas e os projetos podem ocupar. O motor corta o resultado
 * em 12 mil (`limiteResultado`) DEPOIS de trocar os nomes por pseudônimos; a folga cobre essa troca.
 */
const ORCAMENTO_PADRAO = 10_000;
let orcamento = ORCAMENTO_PADRAO;

/** Para os testes: outro tamanho máximo (sem argumento, o padrão). */
export function definirOrcamentoProjetos(n: number = ORCAMENTO_PADRAO): void {
  orcamento = n;
}

/** O que fica no texto livre no lugar de um número de processo e de um número de documento. */
export const SEM_NUMERO_PROCESSO = "[nº de processo]";
export const SEM_NUMERO_DOCUMENTO = "[nº de documento]";

/*
 * A leitura do número no texto livre, sem lista de separadores. Cada caractere é lido como a pessoa o vê, pela forma
 * normalizada (NFKC; o dígito de qualquer escrita pelo valor), mas a POSIÇÃO no texto original fica guardada: o texto
 * volta como era, só com o marcador no lugar do trecho do número (o modelo não precisa da forma normalizada, e os
 * invisíveis de dentro do trecho vão logo depois do marcador, para o `varrer` ainda os acusar no relatório).
 *
 * Os grupos de dígitos seguidos (da mesma escrita) se ligam numa cadeia por QUALQUER trecho entre eles de 1 a 3
 * caracteres que não sejam letra (os espaços em volta não contam: " - - " liga), só por ocultos, ou por nada quando a
 * escrita muda ("12345678¹"); o espaço entre palavras sozinho não liga ("1234 5678" são dois), o tipográfico sozinho
 * liga ("50 300" com o fino). Na cadeia, 15 dígitos ou mais é a forma de processo e ela sai toda; abaixo disso, todo
 * trecho de grupos seguidos é conferido contra os números conhecidos (pela chave), também nas ordens que a direção da
 * escrita mostra à pessoa (o RLO inverte os dígitos; o RLM antes de cada grupo inverte a ordem dos grupos; a letra da
 * direita para a esquerda inverte a ordem das corridas), e sai a união dos que batem. Uma passada pelo texto e, por
 * cadeia de menos de 15 dígitos, no máximo 14 grupos: linear.
 */

/**
 * Como um caractere conta na leitura: dígito (com o valor em ASCII e a escrita), letra, espaço entre palavras, espaço
 * tipográfico, conector ou oculto.
 */
type Peca =
  | { readonly k: "digito"; readonly d: string; readonly escrita: number }
  | { readonly k: "letra" | "espaco" | "tipografico" | "conector" | "oculto" };
const LETRA: Peca = { k: "letra" };
const ESPACO: Peca = { k: "espaco" };
const TIPOGRAFICO: Peca = { k: "tipografico" };
const CONECTOR: Peca = { k: "conector" };
const OCULTO: Peca = { k: "oculto" };

/**
 * A escrita de um dígito: o zero da sequência do caractere, o código dele menos o valor (0x30 no ASCII; a largura
 * total, o arábico, cada estilo do negrito matemático, o sobrescrito, o subscrito, o circulado, cada um o seu). Quando
 * ela muda, o grupo fecha: a nota de rodapé colada ("12345678¹") não esconde o número.
 */
const ESCRITA_ASCII = 0x30;
/** Os dígitos que o Unicode pôs fora da sequência deles ("¹²³" longe de "⁰⁴", os zeros dos circulados): a da sequência. */
const ESCRITA_FORA_DA_SEQUENCIA: ReadonlyMap<number, number> = new Map([
  [0xb2, 0x2070],
  [0xb3, 0x2070],
  [0xb9, 0x2070],
  [0x24ea, 0x245f],
  [0x24ff, 0x2775],
  [0x1f100, 0x2487],
  [0x1f10b, 0x277f],
  [0x1f10c, 0x2789],
]);
/** A escrita do caractere `c` fora do ASCII, cujos dígitos (lidos pelo valor) são `valor`. */
const escritaDe = (c: number, valor: string): number => ESCRITA_FORA_DA_SEQUENCIA.get(c) ?? c - Number(valor);

/** O espaço entre palavras: o comum, o NBSP, a tabulação, as quebras de linha e o avanço de página. */
const espacoEntrePalavras = (c: number): boolean =>
  c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0c || c === 0x0d || c === 0xa0 || c === 0x2028 || c === 0x2029;

/**
 * Os outros espaços: a tabulação vertical, U+1680, U+2000 a U+200A (o fino, o de figura...), U+202F, U+205F e U+3000,
 * o separador de milhar da tipografia. Contam como espaço (não gastam o limite de conectores) e, num intervalo sem outro
 * conector, como UM conector: o "50 300" com o fino liga.
 */
const espacoTipografico = (c: number): boolean =>
  c === 0x0b || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) || c === 0x202f || c === 0x205f || c === 0x3000;

/** O caractere ASCII: dígito, letra, espaço; o resto (pontuação, controle) é conector. */
function pecaAscii(c: number): Peca {
  if (c >= 0x30 && c <= 0x39) return { k: "digito", d: String.fromCharCode(c), escrita: ESCRITA_ASCII };
  if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) return LETRA;
  return espacoEntrePalavras(c) ? ESPACO : espacoTipografico(c) ? TIPOGRAFICO : CONECTOR;
}
const ASCII: ReadonlyArray<readonly Peca[]> = Array.from({ length: 0x80 }, (_, c) => [pecaAscii(c)]);

const RE_OCULTO = /[\p{Cf}\p{M}]/u;
/**
 * O que fica no meio de um número sem aparecer: formatação (\p{Cf}: zero-width, BOM, marcas e controles de direção,
 * hífen suave), marcas combinantes (\p{M}: o "⃣" da tecla de emoji, seletores de variação), os preenchimentos do hangul
 * e as Unicode tags. Contém os INVISIVEIS do `varrer`.
 */
const oculto = (ch: string, c: number): boolean =>
  RE_OCULTO.test(ch) || c === 0x115f || c === 0x1160 || c === 0x3164 || c === 0xffa0 || (c >= 0xe0000 && c <= 0xe007f);

const RE_DECIMAL = /\p{Nd}/u;
/**
 * O valor de um decimal (\p{Nd}) que o NFKC não leva ao ASCII (arábico-índicos, persas, devanágari...): eles vêm em blocos
 * seguidos de 0 a 9 (às vezes dois blocos juntos), e o valor é a distância até o começo da sequência, módulo 10.
 */
function valorDecimal(c: number): string {
  let v = 0;
  while (v < 100 && c - v - 1 >= 0 && RE_DECIMAL.test(String.fromCodePoint(c - v - 1))) v++;
  return String(v % 10);
}

/**
 * Os dígitos que o NFKC não traduz e que não são decimais: os de Numeric_Type=Digit do Unicode 16 (etíope, New Tai Lue,
 * os duplamente circulados, os circulados negativos, os dingbats, kharoshthi, rumi, brahmi) e os números circulados de
 * 10 a 80 dos mesmos blocos ("❿", "⓫" a "⓴"). [primeiro, último, valor do primeiro, passo].
 */
const DIGITOS_SEM_DECOMPOSICAO: ReadonlyArray<readonly [number, number, number, number]> = [
  [0x1369, 0x1371, 1, 1],
  [0x19da, 0x19da, 1, 1],
  [0x24eb, 0x24f4, 11, 1],
  [0x24f5, 0x24fe, 1, 1],
  [0x24ff, 0x24ff, 0, 1],
  [0x2776, 0x277f, 1, 1],
  [0x2780, 0x2789, 1, 1],
  [0x278a, 0x2793, 1, 1],
  [0x3248, 0x324f, 10, 10],
  [0x10a40, 0x10a43, 1, 1],
  [0x10e60, 0x10e68, 1, 1],
  [0x11052, 0x1105a, 1, 1],
  [0x1f10b, 0x1f10c, 0, 0],
];
function valorTabelado(c: number): string | null {
  for (const [a, b, v, passo] of DIGITOS_SEM_DECOMPOSICAO) if (c >= a && c <= b) return String(v + (c - a) * passo);
  return null;
}

const RE_LETRA = /\p{L}/u;
const RE_LETRA_ASCII = /^[A-Za-z]/;
/**
 * Um caractere (já normalizado e fora do ASCII) da leitura. Letra é a do português: a que, sem o acento, é de A a Z
 * ("ç", "ã"; o "ª" e o "º" o NFKC já levou a "a" e "o"). As letras de outras escritas e as que parecem pontuação
 * ("ᐟ", "ᐧ", "ー") contam como conector: entre dois grupos de dígitos, a pessoa as lê como separador.
 */
function pecaNormalizada(x: string, c: number): Peca {
  // A escrita é a do caractere de onde a peça saiu: `pecasDe` a põe.
  if (RE_DECIMAL.test(x)) return { k: "digito", d: valorDecimal(c), escrita: ESCRITA_ASCII };
  const t = valorTabelado(c);
  if (t !== null) return { k: "digito", d: t, escrita: ESCRITA_ASCII };
  if (oculto(x, c)) return OCULTO;
  if (RE_LETRA.test(x) && RE_LETRA_ASCII.test(x.normalize("NFD"))) return LETRA;
  return CONECTOR;
}

/** As peças de cada caractere fora do ASCII já lido (a mesma escrita se repete no texto). */
const PECAS = new Map<number, readonly Peca[]>();

/** Como o caractere `ch` (código `c`) conta: uma peça, ou várias quando o NFKC o abre ("⒈" dá "1.", "½" dá "1⁄2"). */
function pecasDe(ch: string, c: number): readonly Peca[] {
  if (c < 0x80) return ASCII[c] as readonly Peca[];
  const guardadas = PECAS.get(c);
  if (guardadas) return guardadas;
  let pecas: Peca[];
  if (oculto(ch, c)) pecas = [OCULTO];
  else if (espacoEntrePalavras(c)) pecas = [ESPACO];
  else if (espacoTipografico(c)) pecas = [TIPOGRAFICO];
  else {
    pecas = [];
    let valor = "";
    for (const x of ch.normalize("NFKC")) {
      const xc = x.codePointAt(0) as number;
      const p = xc < 0x80 ? ((ASCII[xc] as readonly Peca[])[0] as Peca) : pecaNormalizada(x, xc);
      if (p.k === "digito") valor += p.d;
      // O espaço que sai da decomposição de um caractere visível ("‗" e "´" dão espaço e marca) conta como conector.
      pecas.push(p.k === "espaco" || p.k === "tipografico" ? CONECTOR : p);
    }
    // Os dígitos que saem do caractere ficam com a escrita DELE (o "５" da largura total vira "5", mas não é ASCII).
    if (valor) {
      const escrita = escritaDe(c, valor);
      pecas = pecas.map((p) => (p.k === "digito" ? { k: "digito", d: p.d, escrita } : p));
    }
  }
  if (PECAS.size >= 4096) PECAS.clear();
  PECAS.set(c, pecas);
  return pecas;
}

/**
 * Como um grupo se liga ao anterior da cadeia: `colado`, sem nada entre eles (só a escrita mudou); `corrida`, por um
 * conector só ou só por ocultos, sem espaço (a corrida de número que a direção da escrita não parte); `separado`, o resto.
 */
type Ligacao = "colado" | "corrida" | "separado";

/** Um grupo de dígitos seguidos da mesma escrita: a posição no texto original, os dígitos em ASCII e a ligação. */
interface Grupo {
  ini: number;
  fim: number;
  d: string;
  escrita: number;
  liga: Ligacao;
}

/** Quantos caracteres conectores, no máximo, ligam dois grupos (os espaços entre eles não contam). */
const MAX_CONECTORES = 3;
/** Com menos dígitos é dia, quantidade, item: nunca sai do texto. */
const MIN_DIGITOS = 4;
/** Com tantos dígitos tem a forma de número de processo (o NUP tem 17; o do SEI-RJ, 16), mesmo desconhecido daqui. */
const DIGITOS_DE_PROCESSO = 15;

/** As escapadas do JSON e o caractere que cada uma representa. */
const ESCAPADAS_JSON: Readonly<Record<string, string>> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" };
const RE_HEX4 = /^[0-9a-fA-F]{4}$/;

/**
 * O caractere de `t` na posição `i` e onde ele acaba. Com `json` (o texto da ferramenta já em JSON), a escapada é UM
 * caractere, o que ela representa ("\n" é a quebra de linha, "\"" as aspas): é assim que o modelo lê o JSON.
 */
function caractereEm(t: string, i: number, json: boolean): [string, number] {
  if (json && t.charCodeAt(i) === 0x5c) {
    const e = t.charAt(i + 1);
    if (e === "u" && RE_HEX4.test(t.slice(i + 2, i + 6))) return [String.fromCharCode(Number.parseInt(t.slice(i + 2, i + 6), 16)), i + 6];
    const ch = ESCAPADAS_JSON[e];
    if (ch !== undefined) return [ch, i + 2];
  }
  const c = t.codePointAt(i) as number;
  return [String.fromCodePoint(c), c > 0xffff ? i + 2 : i + 1];
}

/** As cadeias de grupos de dígitos de `t`, na ordem do texto (ver a leitura acima); com `json`, como o modelo lê o JSON. */
function cadeiasDe(t: string, json: boolean): Grupo[][] {
  const cadeias: Grupo[][] = [];
  let cadeia: Grupo[] | null = null;
  let grupo: Grupo | null = null;
  // Desde o último dígito: quantos caracteres conectores, se houve espaço tipográfico, espaço entre palavras, e se a
  // ligação já se quebrou (letra ou conector demais).
  let conectores = 0;
  let tipografico = false;
  let espaco = false;
  let quebrou = false;
  for (let i = 0; i < t.length; ) {
    const [ch, fim] = caractereEm(t, i, json);
    // O limite é por caractere do texto, não pelas peças do NFKC: "…" (três pontos) e "⁗" (quatro plicas) contam um.
    let contou = false;
    for (const p of pecasDe(ch, ch.codePointAt(0) as number)) {
      if (p.k === "digito") {
        if (grupo && grupo.escrita === p.escrita) {
          grupo.d += p.d;
          grupo.fim = fim;
        } else {
          // Outra escrita colada ao grupo aberto: um grupo novo, ligado a ele. Senão, só ocultos desde o grupo anterior,
          // de 1 a 3 conectores (com ou sem espaço) ou um espaço tipográfico: a mesma cadeia.
          const liga: Ligacao = grupo ? "colado" : !espaco && !tipografico && conectores <= 1 ? "corrida" : "separado";
          const ligado = grupo !== null || (!quebrou && (conectores > 0 || tipografico || !espaco));
          grupo = { ini: i, fim, d: p.d, escrita: p.escrita, liga };
          if (cadeia && ligado) cadeia.push(grupo);
          else {
            cadeia = [grupo];
            cadeias.push(cadeia);
          }
        }
        conectores = 0;
        tipografico = false;
        espaco = false;
        quebrou = false;
        contou = false;
        continue;
      }
      // O oculto fecha o grupo (os dois lados são conferidos também sozinhos) sem mudar a ligação.
      grupo = null;
      if (p.k === "espaco") espaco = true;
      else if (p.k === "tipografico") tipografico = true;
      else if (p.k === "conector" && !contou) {
        contou = true;
        quebrou ||= ++conectores > MAX_CONECTORES;
      } else if (p.k === "letra") quebrou = true;
    }
    i = fim;
  }
  return cadeias;
}

/** Os números que este computador conhece: processos pelos dígitos (`chaveProtocolo`), documentos pela `chaveDocumento`. */
interface NumerosConhecidos {
  processos: ReadonlySet<string>;
  documentos: ReadonlySet<string>;
  /** Os tamanhos das chaves: o trecho de outro tamanho nem é procurado (a conta é pela chave, não pelos dígitos crus). */
  tamanhosProcesso: ReadonlySet<number>;
  tamanhosDocumento: ReadonlySet<number>;
}

/** Os da regra e da memória (`s`) mais todo vínculo, documento e registro dos dois escopos (vivos e lápides). */
function numerosConhecidos(escopos: readonly Entidades[], s: SigiloDoEnvelope): NumerosConhecidos {
  const processos = new Set(s.chaves);
  const documentos = new Set(s.documentos);
  const processo = (t: unknown) => {
    const k = typeof t === "string" ? chaveProtocolo(t) : "";
    if (k) processos.add(k);
  };
  const documento = (t: unknown) => {
    const k = typeof t === "string" ? chaveDocumento(t) : "";
    if (k) documentos.add(k);
  };
  for (const x of escopos) {
    for (const i of [...x.p, ...x.e]) processo(i?.processo?.protocolo);
    for (const e of x.e) documento(e?.documento?.numero);
    for (const r of x.h) {
      if (r?.campo === "processo") for (const t of [r.antes, r.depois]) processo(t);
      if (r?.campo === "documento") for (const t of [r.antes, r.depois]) documento(t);
    }
  }
  const tamanhos = (xs: ReadonlySet<string>) => new Set(Array.from(xs, (k) => k.length));
  return { processos, documentos, tamanhosProcesso: tamanhos(processos), tamanhosDocumento: tamanhos(documentos) };
}

/** O marcador do trecho de dígitos `d` que `n` conhece (processo pelos dígitos, documento pela `chaveDocumento`), ou null. */
function marcadorDe(d: string, n: NumerosConhecidos): string | null {
  if (d.length < MIN_DIGITOS) return null;
  if (n.tamanhosProcesso.has(d.length) && n.processos.has(d)) return SEM_NUMERO_PROCESSO;
  // Só dígitos ASCII: sem zero à esquerda, a chave do documento é o próprio trecho.
  const k = d.charCodeAt(0) === 0x30 ? chaveDocumento(d) : d;
  return n.tamanhosDocumento.has(k.length) && n.documentos.has(k) ? SEM_NUMERO_DOCUMENTO : null;
}

const inverso = (d: string): string => d.split("").reverse().join("");

/**
 * Os trechos [primeiro grupo, último grupo, marcador] da cadeia (menos de 15 dígitos) que batem com um número conhecido:
 * cada trecho de grupos seguidos, na ordem do texto e, com `inverter`, também com os dígitos ao contrário (RLO), com os
 * grupos ao contrário (RLM; o grupo colado anda junto do anterior, como um só) e com as corridas ao contrário (a letra
 * da direita para a esquerda fora do número: "202 - 12003/1234" a pessoa vê "12003/1234 - 202"). Os que se sobrepõem
 * saem juntos ("5 - 12003/1234-202", com "512003" documento e "120031234202" processo, sai inteiro); os vizinhos, cada
 * um com o seu marcador.
 */
function trechosConhecidos(cadeia: readonly Grupo[], n: NumerosConhecidos, inverter: boolean): Array<[number, number, string]> {
  const achados: Array<[number, number, string]> = [];
  const invertidos = inverter ? cadeia.map((g) => inverso(g.d)) : [];
  for (let i = 0; i < cadeia.length; i++) {
    let frente = "";
    let aoContrario = "";
    // A ordem invertida por blocos: o bloco em curso (`grupo`, `corrida`) e os anteriores já invertidos (`antes...`).
    let grupo = "";
    let antesDoGrupo = "";
    let corrida = "";
    let antesDaCorrida = "";
    for (let j = i; j < cadeia.length; j++) {
      const g = cadeia[j] as Grupo;
      frente += g.d;
      let marca = marcadorDe(frente, n);
      if (inverter) {
        aoContrario = invertidos[j] + aoContrario;
        if (j > i && g.liga === "colado") grupo += g.d;
        else {
          antesDoGrupo = grupo + antesDoGrupo;
          grupo = g.d;
        }
        if (j > i && g.liga !== "separado") corrida += g.d;
        else {
          antesDaCorrida = corrida + antesDaCorrida;
          corrida = g.d;
        }
        // A ordem igual à do texto (ou à já conferida) não é procurada de novo.
        const porGrupos = grupo + antesDoGrupo;
        const porCorridas = corrida + antesDaCorrida;
        marca ??=
          marcadorDe(aoContrario, n) ??
          (porGrupos !== frente ? marcadorDe(porGrupos, n) : null) ??
          (porCorridas !== frente && porCorridas !== porGrupos ? marcadorDe(porCorridas, n) : null);
      }
      if (marca) achados.push([i, j, marca]);
    }
  }
  const unidos: Array<[number, number, string]> = [];
  for (const [i, j, marca] of achados) {
    const ultimo = unidos[unidos.length - 1];
    if (ultimo && i <= ultimo[1]) {
      ultimo[1] = Math.max(ultimo[1], j);
      if (marca === SEM_NUMERO_PROCESSO) ultimo[2] = marca;
    } else unidos.push([i, j, marca]);
  }
  return unidos;
}

/**
 * Os controles de direção (\p{Bidi_C}: LRM, RLM, ALM, os encaixes, as substituições e os isolados). Dentro de uma
 * cadeia, a ordem que a pessoa vê não é a do texto (o RLM entre alguns grupos, o RLO num grupo só), e simular o
 * algoritmo bidi não cabe aqui: a cadeia sai inteira.
 */
const RE_DIRECAO = /\p{Bidi_C}/u;

/**
 * A ordem que a pessoa vê só difere da do texto com um controle de direção ou uma letra da direita para a esquerda (os
 * blocos do hebraico, do árabe, do siríaco e afins: U+0590 a U+08FF, as formas de apresentação, U+10800 a U+10FFF e
 * U+1E800 a U+1EFFF, estes dois pelo primeiro substituto). Sem eles, a ordem invertida nem é conferida: o número comum
 * que, ao contrário, fosse um conhecido não sai à toa.
 */
function podeInverter(t: string): boolean {
  if (RE_DIRECAO.test(t)) return true;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if ((c >= 0x590 && c <= 0x8ff) || (c >= 0xfb1d && c <= 0xfdff) || (c >= 0xfe70 && c <= 0xfefc)) return true;
    if (c === 0xd802 || c === 0xd803 || c === 0xd83a || c === 0xd83b) return true;
  }
  return false;
}

/** Os invisíveis de `t`, juntos: vão logo depois do marcador, e o `varrer` ainda os acusa no relatório (e os tira). */
const invisiveisDe = (t: string): string => (t.match(INVISIVEIS) ?? []).join("");

/**
 * O que o JSON escreveria com dígito ("\u0001", "\ud800"): os controles (fora a tabulação, as quebras de linha, o
 * avanço de página e a tabulação vertical, cuja escapada termina em letra) e as metades soltas de um par UTF-16.
 * Trocados pelo caractere de substituição, do mesmo tamanho: as posições não mudam, e a leitura também não (os dois
 * são conector).
 */
const RE_QUE_O_JSON_ESCAPA = /[\p{Cc}\p{Cs}]/gu;
const SUBSTITUTO = String.fromCharCode(0xfffd);
const semControles = (t: string): string =>
  t.replace(RE_QUE_O_JSON_ESCAPA, (c) => (c === "\t" || c === "\n" || c === "\r" || c === "\f" || c === "\v" ? c : SUBSTITUTO));

/**
 * O texto livre sem número de processo nem de documento (o que `n` conhece e o que tem a forma de processo). Com
 * `json`, `t` é o texto exato que vai ao modelo (o JSON do resultado, depois da anonimização e do corte do motor).
 */
function semNumeros(bruto: string, n: NumerosConhecidos, json = false): string {
  const t = semControles(bruto);
  let saida = "";
  let desde = 0;
  const trocar = (ini: number, fim: number, marca: string) => {
    // Dois grupos podem vir do mesmo caractere ("½" dá "1⁄2"): o que já saiu não sai de novo.
    const de = Math.max(ini, desde);
    if (fim <= de) return;
    saida += `${t.slice(desde, de)}${marca}${invisiveisDe(t.slice(de, fim))}`;
    desde = fim;
  };
  const inverter = podeInverter(t);
  for (const cadeia of cadeiasDe(t, json)) {
    const total = cadeia.reduce((soma, g) => soma + g.d.length, 0);
    if (total < MIN_DIGITOS) continue;
    const ini = (cadeia[0] as Grupo).ini;
    const fim = (cadeia[cadeia.length - 1] as Grupo).fim;
    if (total >= DIGITOS_DE_PROCESSO || RE_DIRECAO.test(t.slice(ini, fim))) {
      trocar(ini, fim, SEM_NUMERO_PROCESSO);
      continue;
    }
    for (const [i, j, marca] of trechosConhecidos(cadeia, n, inverter)) trocar((cadeia[i] as Grupo).ini, (cadeia[j] as Grupo).fim, marca);
  }
  return saida + t.slice(desde);
}

/** A memória do sigilo; ilegível, nada é listado (a regra sem ela deixaria sair o número que só ela conhece). */
async function memoriaDoSigilo(repo: RepositorioProjetos): Promise<SigilosConhecidos> {
  try {
    return await repo.sigilosConhecidos();
  } catch (e) {
    if (e instanceof ErroMemoriaSigilo)
      throw new Error(
        "Não foi possível ler a lista de processos sigilosos deste computador: por segurança, nenhum projeto foi listado. Tente de novo.",
        { cause: e },
      );
    throw e;
  }
}

/**
 * O `dados()` do repositório sobre as entidades já lidas (uma leitura por escopo): o que está vivo, na ordem
 * manual. Os modelos não interessam ao agente.
 */
function vivos(t: Entidades): Dados {
  const vivo = <T extends { removidoEm?: number }>(x: T | undefined): x is T => !!x && x.removidoEm === undefined;
  const projetos = t.p.filter(vivo).sort(porOrdem);
  const ativos = new Set(projetos.map((p) => p.id));
  return {
    projetos,
    fases: t.f.filter((f) => vivo(f) && ativos.has(f.projeto)).sort(porOrdem),
    etapas: t.e.filter((e) => vivo(e) && ativos.has(e.projeto)).sort(porOrdem),
    modelos: [],
  };
}

type Filtro = "atrasadas" | "semana" | "todos";

function situacao(e: Etapa, hoje: DataISO): string {
  return e.marco ? ROTULO_MARCO[situacaoMarco(e, hoje)] : ROTULO_SITUACAO[situacaoEtapa(e, hoje)];
}

/** Tamanho no JSON da resposta (com a vírgula que separa da próxima). */
const tamanho = (x: unknown): number => JSON.stringify(x).length + 1;

export const TOOL_PROJETOS: DefTool = definirTool({
  nome: "projetos_listar",
  descricao:
    "Lista os PROJETOS do usuário no SEI Pro (o gestor de projetos com Gantt) da unidade da tela, dos dois tipos: 'Toda a unidade' (compartilhados) e 'Só eu'. Traz os contadores (atrasadas, vencem nesta semana) e, de cada projeto, o progresso, o término e as etapas (nome, fase, situação, início, término, responsável, progresso, observações e checklist). Use para 'o que está atrasado nos meus projetos', 'o que vence esta semana', 'em que pé está o projeto X'. Somente leitura; não abre nada no SEI. Não traz número de processo nem de documento (no texto aparecem como [nº de processo] e [nº de documento]); projetos e etapas de processo sigiloso ficam de fora (só contados). Resposta grande sai cortada (etapasCortadas, projetosCortados): use o filtro ou o nome do projeto.",
  parametros: s.objeto({
    "filtro?": s.texto({
      enum: ["atrasadas", "semana", "todos"],
      descricao: "atrasadas = etapas com término vencido; semana = vencem até a sexta desta semana; todos = todas as etapas. Padrão: todos.",
    }),
    "projeto?": s.texto({ descricao: "Parte do nome do projeto (sem acento/caixa)." }),
  }),
  efeito: "leitura",
  rotulo: () => "Ler os projetos",
  executar: async (a, ctx) => {
    // Desligado (ou ilegível) nas opções: o agente não lê nada (nem a aba, nem o armazenamento).
    if (!(await opcaoAgora()))
      return {
        totalProjetos: 0,
        projetos: [],
        desligado: true,
        mensagem: "O gestor de projetos está desligado nas opções do SEI Pro (Gerenciar Projetos).",
      };
    const e = await ctx.sei<{ host: string; login: string; unidade: { id: string; sigla: string } | null }>("favoritos.escopo");
    if (!e.unidade) return { totalProjetos: 0, projetos: [], mensagem: "Abra o SEI numa unidade: os projetos são da unidade." };
    const esc = escoposDaUnidade(e.host, e.login, e.unidade.id);
    const area = fonteArea();
    const leitura = () => ({ agora: Date.now(), dispositivo: "agente" });
    const repos = { unidade: new RepositorioProjetos(area, esc.unidade, leitura), eu: new RepositorioProjetos(area, esc.eu, leitura) };
    const hoje = hojeISO();
    // Uma leitura por escopo, com as lápides (a regra do sigilo as conta); a tela e a regra veem o MESMO estado.
    const [deUn, deEu] = await Promise.all([repos.unidade.entidades(), repos.eu.entidades()]);
    // Depois: a memória só cresce, então a lida por último sabe pelo menos o que as entidades marcam.
    const conhecidos = await memoriaDoSigilo(repos.unidade);
    const dados = montarUnidade(
      [
        { vis: "unidade", dados: vivos(deUn) },
        { vis: "eu", dados: vivos(deEu) },
      ],
      hoje,
    );
    // A regra do Texto Padrão sobre os dois escopos juntos (vivos e lápides), mais a memória.
    const sigilo = sigiloDoEnvelope([...deUn.p, ...deEu.p], [...deUn.e, ...deEu.e], conhecidos);
    const numeros = numerosConhecidos([deUn, deEu], sigilo);
    const livre = (t: string) => semNumeros(t, numeros);
    // E de novo sobre o texto exato que vai ao modelo: o "⟧" que o `varrer` põe no fim da frase e o rótulo da
    // anonimização ("[PESSOA_1]") podem ligar dois pedaços que, no campo, estavam separados.
    ctx.aoModelo?.((texto) => semNumeros(texto, numeros, true));
    const projetoSigiloso = (p: ProjetoNaTela) => sigilo.projetos.has(p.projeto.id) || sigilo.vinculo(p.projeto.processo);
    const filtro: Filtro = a.filtro === "atrasadas" || a.filtro === "semana" ? a.filtro : "todos";
    // A busca vê o nome como ele sai: um número que não vai na resposta também não serve para achar.
    const busca = a.projeto ? normalizarTexto(String(a.projeto)) : "";
    // Sigiloso sai antes de qualquer outra coisa: só entra na contagem, que é da unidade toda (a busca e o
    // filtro não a mudam).
    const projetosSigilosos = dados.ativos.filter(projetoSigiloso).length;
    let etapasSigilosas = 0;
    const abertos = dados.ativos
      .filter((p) => !projetoSigiloso(p))
      .map((p) => {
        const etapas = p.etapas.filter((x) => !sigilo.etapas.has(x.id) && !etapaSigilosa(x, p.projeto, sigilo));
        etapasSigilosas += p.etapas.length - etapas.length;
        return { p, etapas };
      });
    // Progresso e término só das etapas que saem: a sigilosa não aparece nem pela conta.
    const visiveis = abertos
      .filter(({ p }) => !busca || normalizarTexto(livre(p.projeto.nome)).includes(busca))
      .map(({ p, etapas }) => ({ p, etapas, alertas: alertasDasEtapas(etapas, hoje), resumo: resumoDoProjeto(etapas, hoje) }));
    const atrasadas = visiveis.reduce((n, v) => n + v.alertas.atrasadas.length, 0);
    const semana = visiveis.reduce((n, v) => n + v.alertas.semana.length, 0);
    const contadores = {
      unidade: e.unidade.sigla,
      totalProjetos: visiveis.length,
      atrasadas,
      semana,
      sigilososOmitidos: projetosSigilosos + etapasSigilosas,
    };
    // Cabe no corte do motor: os contadores (com os de corte no maior valor possível), cada projeto e cada etapa
    // entram pelo tamanho; o que não cabe sai inteiro e é contado. A ordem fica (nada depois do primeiro que não cabe).
    const todas = visiveis.reduce((n, v) => n + v.etapas.length, 0);
    let usado = tamanho({ ...contadores, etapasCortadas: todas, projetosCortados: visiveis.length, projetos: [] });
    let cheio = false;
    let restam = MAX_ETAPAS;
    let etapasCortadas = 0;
    let projetosCortados = 0;
    const responsaveis: string[] = [];
    const projetos: unknown[] = [];
    for (const { p, etapas, alertas, resumo } of visiveis) {
      const escolhidas = filtro === "atrasadas" ? alertas.atrasadas : filtro === "semana" ? alertas.semana : etapas;
      if (filtro !== "todos" && !escolhidas.length) continue;
      // Nome, fase, observações e checklist são texto livre digitado por gente (o "Toda a unidade" é escrito por
      // qualquer colega): a mesma marcação do conteúdo dos documentos (ver seguranca/injecao.ts).
      const nome = livre(p.projeto.nome);
      const cabeca = varrerCamposLivres({
        nome,
        vis: rotuloDaVis(p.vis),
        progresso: `${resumo.progresso}%`,
        ...(resumo.fim ? { termino: formatarData(resumo.fim) } : {}),
        atrasadas: alertas.atrasadas.length,
      });
      const custo = tamanho({ ...cabeca.valor, etapas: [] });
      if (cheio || usado + custo > orcamento) {
        cheio = true;
        projetosCortados++;
        etapasCortadas += escolhidas.length;
        continue;
      }
      usado += custo;
      const achados: Achado[] = [...cabeca.achados];
      const fases = new Map(p.fases.map((f) => [f.id, f.nome]));
      const lista: unknown[] = [];
      for (const x of escolhidas) {
        if (cheio || restam <= 0) {
          etapasCortadas++;
          continue;
        }
        const fase = x.fase ? fases.get(x.fase) : undefined;
        const responsavel = x.responsavel ? livre(x.responsavel.nome) : "";
        const etapa = varrerCamposLivres({
          nome: livre(x.nome),
          ...(fase !== undefined ? { fase: livre(fase) } : {}),
          situacao: situacao(x, hoje),
          inicio: formatarData(x.inicio),
          termino: formatarData(x.fim),
          ...(responsavel ? { responsavel } : {}),
          ...(x.marco ? { marco: true } : { progresso: `${progressoDaEtapa(x, hoje)}%` }),
          ...(x.observacoes ? { observacoes: livre(x.observacoes) } : {}),
          ...(x.checklist.length ? { checklist: x.checklist.map((i) => `${i.feito ? "[x]" : "[ ]"} ${livre(i.texto)}`) } : {}),
        });
        const c = tamanho(etapa.valor);
        if (usado + c > orcamento) {
          cheio = true;
          etapasCortadas++;
          continue;
        }
        usado += c;
        restam--;
        lista.push(etapa.valor);
        achados.push(...etapa.achados);
        if (responsavel) responsaveis.push(responsavel);
      }
      if (achados.length) ctx.registrarAchados(`projeto ${nome.slice(0, 60)}`, achados);
      projetos.push({ ...cabeca.valor, etapas: lista });
    }
    // Como processo_consultar: os responsáveis entram no dicionário da anonimização (o motor troca os
    // nomes por pseudônimos antes de mandar ao modelo).
    if (responsaveis.length) ctx.pessoasVistas([...new Set(responsaveis)]);
    // Os contadores ANTES da lista: o motor corta o resultado no fim, e eles sumiriam.
    return {
      ...contadores,
      ...(etapasCortadas ? { etapasCortadas } : {}),
      ...(projetosCortados ? { projetosCortados } : {}),
      projetos,
    };
  },
});
