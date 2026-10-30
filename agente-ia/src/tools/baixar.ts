/**
 * documento_baixar: o documento do SEI vira arquivo na pasta Downloads.
 *
 * Existe para o conector que roda na máquina do usuário e só lê do disco
 * (anexar o contrato num sistema, por exemplo): o modelo não carrega bytes
 * nos argumentos, então recebe um CAMINHO e o repassa em `mcp_chamar`.
 *
 * É `escrita` — só roda dentro de plano aprovado, com o cartão mostrando o
 * documento e o destino, e plano não tem "permitir sempre". O motivo: o
 * arquivo sai do SEI para o disco com os dados pessoais reais, sem máscara.
 *
 * Só documento EXTERNO (o anexo original: PDF, planilha, imagem). Documento
 * escrito no editor do SEI precisaria virar PDF, e a extensão não tem hoje um
 * gerador de PDF que o agente possa chamar: a recusa é explícita.
 *
 * Fábrica, e não entrada de `TOOLS_SEI`, porque gravar no disco depende do
 * `chrome.downloads` do painel — que os testes trocam.
 */

import { s } from "../motor/esquema";
import { definirTool, type ContextoTool, type DefTool } from "../motor/tools";
import type { PreviaItem } from "../motor/tipos";
import type { Baixado } from "../painel/baixados";
import { hashArquivo } from "../seguranca/hash";

export interface OpcoesBaixar {
  /** Grava na pasta Downloads e devolve o caminho absoluto que o navegador deu. */
  salvar(a: { destino: string; bytes: Uint8Array; tipo: string }): Promise<{ id: number; caminho: string; tamanho: number; tipo: string }>;
  /** Anota o arquivo, para a limpeza e para o caminho passar intacto ao conector. */
  registrar(b: Baixado): Promise<void>;
  agora?(): number;
}

const MAX_NOME = 120;

const POR_TIPO: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/tiff": "tif",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/zip": "zip",
  "application/msword": "doc",
  "application/vnd.ms-excel": "xls",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
};

/** Um pedaço de caminho que qualquer sistema aceita e que não fica oculto. */
function pedacoSeguro(texto: string): string {
  return texto
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f\/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[.\s-]+/, "")
    .replace(/[.\s]+$/, "");
}

/**
 * Nome do arquivo: título do documento, nº SEI e extensão.
 *
 * Sem barra nem dois-pontos, sem ponto no início (arquivo oculto, que o
 * conector recusa), até 120 caracteres e SEMPRE com extensão. O nº SEI vai no
 * nome porque um processo costuma ter vários "Anexo": sem ele, um
 * sobrescreveria o outro.
 */
export function nomeDeArquivo(d: { titulo: string; numero: string; nomeOriginal: string; tipo: string; nomeLegivel?: string }): string {
  const doOriginal = /\.([A-Za-z0-9]{1,8})$/.exec(d.nomeOriginal.trim())?.[1]?.toLowerCase();
  const extensao = doOriginal ?? POR_TIPO[d.tipo.toLowerCase().split(";")[0].trim()] ?? "bin";
  const fim = ` (${d.numero.replace(/\D/g, "") || "sem numero"}).${extensao}`;
  const escolhido = d.nomeLegivel?.trim();
  if (escolhido && /[\/\\\u0000-\u001f\u007f]/.test(escolhido)) throw new Error("Informe apenas o nome legível do arquivo, sem caminho nem barras.");
  // Só sai do fim o que é extensão de verdade: "CUO 004.2023" não perde o ".2023".
  const semExtensao = escolhido?.replace(/\.([A-Za-z0-9]{1,8})$/, (todo, ext: string) => (ext.toLowerCase() === extensao || EXTENSOES.has(ext.toLowerCase()) ? "" : todo));
  const titulo = semExtensao ? semExtensao.replace(new RegExp(` \\(${d.numero.replace(/\D/g, "")}\\)$`), "") : d.titulo;
  const base = pedacoSeguro(titulo).slice(0, MAX_NOME - fim.length).trimEnd() || "documento";
  return `${base}${fim}`;
}

/** Caminho relativo à pasta Downloads: "SEI Pro/<processo sem barras>/<nome>". */
export function destinoDoArquivo(processo: string, nome: string): string {
  return `SEI Pro/${pedacoSeguro(processo) || "processo"}/${nome}`;
}

/**
 * O que pode ir para o disco: documento e imagem. O tipo do arquivo é o SEI
 * (e quem anexou) que define — executável, script ou atalho com cara de
 * contrato não é gravado na pasta Downloads em nome do agente.
 */
const EXTENSOES = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf", "txt", "csv", "jpg", "jpeg", "png", "gif", "tif", "tiff", "bmp"]);

const extensaoDe = (nome: string): string => /\.([a-z0-9]+)$/.exec(nome)?.[1] ?? "";

interface Meta {
  numero: string;
  titulo: string;
  formato?: string;
  nivel?: string;
  processo: string;
  baixavel?: boolean;
  arquivo?: { tipo: string; nome: string; tamanho: number; base64?: string };
}

/** Nome e destino a partir do que o SEI informou; `erro` quando o tipo não é aceito. */
function destinoDe(m: Meta, nomeLegivel?: string): { nome: string; destino: string; erro?: string } {
  const nome = nomeDeArquivo({ titulo: m.titulo, numero: m.numero, nomeOriginal: m.arquivo?.nome ?? "", tipo: m.arquivo?.tipo ?? "", nomeLegivel });
  const destino = destinoDoArquivo(m.processo, nome);
  if (EXTENSOES.has(extensaoDe(nome))) return { nome, destino };
  return { nome, destino, erro: `O arquivo do documento ${m.numero} é do tipo .${extensaoDe(nome)}, que o agente não grava no computador (só documentos e imagens: pdf, docx, xlsx, jpg, png, txt...). Peça ao usuário para baixá-lo pelo SEI, se for o caso.` };
}

const NATIVO = (numero: string) =>
  `O documento ${numero} foi escrito no editor do SEI, e o agente ainda não sabe gerar o PDF dele. Só documento externo (o arquivo anexado: PDF, planilha, imagem) pode ser baixado. Se precisar deste, peça ao usuário para gerar o PDF no SEI.`;

function base64ParaBytes(b64: string): Uint8Array {
  const bruto = atob(b64);
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i += 1) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

export function toolsBaixar(o: OpcoesBaixar): DefTool[] {
  const CAMPO_DESTINO = "Salvar em";

  const baixar = definirTool({
    nome: "documento_baixar",
    descricao:
      "Baixa um documento do SEI para a pasta Downloads do usuário e devolve o caminho do arquivo. Use quando um conector precisar do arquivo em disco. Só documento externo (PDF e outros anexos); documento escrito no editor do SEI ainda não. O usuário aprova cada download. Passe o 'caminho' devolvido ao conector exatamente como veio: se o conector roda em outro computador, o SEI Pro envia o conteúdo do arquivo por conta própria, depois de nova aprovação.",
    parametros: s.objeto({ documento: s.texto({ descricao: "Nº SEI do documento." }), "nome_arquivo?": s.texto({ min: 1, max: 200, descricao: "Nome legível definido pelo agente com base no documento lido, sem caminho. A extensão original e o número SEI serão preservados. Ex.: Contrato de Cessão de Uso 002-2026 - Porto de Itaqui.pdf." }) }),
    efeito: "escrita",
    rotulo: (a) => `Baixar o documento ${String(a.documento)} para o computador`,
    previsualizar: async (a, ctx: ContextoTool): Promise<PreviaItem[]> => {
      const m = await ctx.sei<Meta>("documento.baixar", { numero: String(a.documento), somenteMetadados: true });
      const alvo = `${m.titulo} (SEI ${m.numero})`;
      if (!m.baixavel) return [{ alvo, mudancas: [], resumo: "", erro: NATIVO(m.numero) }];
      const d = destinoDe(m, a.nome_arquivo as string | undefined);
      if (d.erro) return [{ alvo, mudancas: [], resumo: "", erro: d.erro }];
      return [
        {
          alvo,
          resumo: "Salvar uma cópia no computador",
          mudancas: [
            { campo: CAMPO_DESTINO, antes: "", depois: `Downloads/${d.destino}` },
            ...(m.arquivo ? [{ campo: "Arquivo", antes: "", depois: `${m.arquivo.tipo || "tipo não informado"}, ${Math.max(1, Math.round(m.arquivo.tamanho / 1024))} KB` }] : []),
            ...(m.nivel && m.nivel !== "publico" ? [{ campo: "Nível de acesso no SEI", antes: "", depois: m.nivel }] : []),
            { campo: "Atenção", antes: "", depois: "a cópia sai do SEI com os dados pessoais reais, sem máscara, e fica no seu computador até você apagar" },
          ],
        },
      ];
    },
    executar: async (a, ctx: ContextoTool) => {
      const r = await ctx.sei<Meta & { arquivo: { base64: string; tipo: string; nome: string; tamanho: number } }>("documento.baixar", { numero: String(a.documento) });
      const { nome, destino, erro } = destinoDe(r, a.nome_arquivo as string | undefined);
      if (erro) throw new Error(erro);
      // Vale o que o usuário viu NO CARTÃO DESTE PASSO (a prévia que o motor
      // entrega junto com a execução), e não uma lembrança guardada aqui: um
      // cartão recusado antes não autoriza nada, e passo sem prévia não grava.
      // Cobre também o arquivo trocado no SEI entre o cartão e este momento.
      const visto = (ctx.previa ?? []).some((item) => !item.erro && item.mudancas.some((x) => x.campo === CAMPO_DESTINO && x.depois === `Downloads/${destino}`));
      if (!visto) {
        throw new Error(`O arquivo do documento ${r.numero} não é o que foi aprovado no cartão (o documento mudou no SEI, ou o download não passou pela aprovação). Nada foi gravado: chame documento_baixar de novo, sozinho, para o usuário aprovar.`);
      }
      const bytes = base64ParaBytes(r.arquivo.base64);
      const sha256 = await hashArquivo(bytes);
      const salvo = await o.salvar({ destino, bytes, tipo: r.arquivo.tipo || "application/octet-stream" });
      await o.registrar({ id: salvo.id, caminho: salvo.caminho, nome, processo: r.processo, documento: r.numero, tamanho: bytes.length, sha256, quando: (o.agora ?? Date.now)() });
      return {
        aplicado: true,
        documento: r.numero,
        titulo: r.titulo,
        processo: r.processo,
        caminho: salvo.caminho,
        nome_arquivo: nome,
        tamanho: salvo.tamanho,
        tipo: salvo.tipo,
        como_usar: "Passe 'caminho' ao conector exatamente como está aqui.",
      };
    },
  });
  return [baixar];
}
