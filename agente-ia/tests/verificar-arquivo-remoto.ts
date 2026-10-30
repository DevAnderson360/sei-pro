/**
 * Documento do SEI entregue a um conector MCP REMOTO, que não lê o disco do
 * usuário (o servidor do Arrendamento em Ubuntu, por exemplo).
 *
 * Desenho vindo do patch de Tavares (mvforce/mcp_arrendamento,
 * integracoes/sei-pro): o modelo passa o caminho devolvido por
 * documento_baixar; depois da aprovação, a extensão relê o documento do SEI,
 * confere documento, processo, tamanho e SHA-256 do download aprovado e manda
 * os bytes num objeto só de transporte. O modelo nunca vê nem escreve base64.
 */

import { DOMParser } from "linkedom";
import { Pseudonimos } from "@nucleo/privacidade/anonimizar";
import { ClienteMcp, ErroMcp } from "../src/mcp/cliente";
import { conteudoDoBaixado } from "../src/mcp/arquivo";
import type { Conector } from "../src/mcp/conectores";
import { toolsMcp } from "../src/mcp/tools";
import type { ContextoTool } from "../src/motor/tools";
import type { PedidoTransferencia } from "../src/motor/tipos";
import type { Baixado } from "../src/painel/baixados";
import { cartaoTransferencia, type AbrirModal } from "../src/painel/mcp-ui";
import { hashArquivo } from "../src/seguranca/hash";
import { nomeDeArquivo, toolsBaixar } from "../src/tools/baixar";
import { checar, lanca, secao } from "./util";

const PROCESSO = "50300.010726/2026-91";
const CAMINHO = "C:\\Users\\fulano.beltrano\\Downloads\\SEI Pro\\50300.010726-2026-91\\Termo Aditivo - Maria Souza (123).pdf";
const BYTES = new TextEncoder().encode("%PDF-1.7 aditivo");
const B64 = btoa(String.fromCharCode(...BYTES));

const tool = (nome: string, propriedades: Record<string, unknown>) => ({ nome, descricao: "Anexa um arquivo ao contrato.", esquema: { type: "object", properties: propriedades } });
const ENVIAR = tool("arrendamento_enviar_arquivo", { id_contrato: {}, caminho_arquivo: {}, confirmar: {}, nome_arquivo: {}, conteudo_base64: {} });

const conector = (c: Partial<Conector> = {}): Conector => ({
  id: "arr",
  nome: "Arrendamento",
  url: "https://casa7.exemplo.ts.net/mcp",
  ativo: true,
  auth: { tipo: "nenhuma" },
  padrao: "sempre",
  permissoes: {},
  consentido: true,
  tools: [ENVIAR],
  ...c,
});

export async function verificarArquivoRemoto(): Promise<void> {
  const sha256 = await hashArquivo(BYTES);
  const baixado: Baixado = { id: 1, caminho: CAMINHO, nome: "Termo Aditivo - Maria Souza (123).pdf", processo: PROCESSO, documento: "123", tamanho: BYTES.length, sha256, quando: 1 };
  const doSei = { numero: "123", titulo: "Anexo", processo: PROCESSO, arquivo: { nome: "a.pdf", tipo: "application/pdf", tamanho: BYTES.length, base64: B64 } };

  secao("arquivo remoto: nome escolhido pelo agente");
  {
    const n = (nomeLegivel: string, nomeOriginal = "tecnico.PDF") => nomeDeArquivo({ titulo: "Anexo", numero: "123", nomeOriginal, tipo: "application/pdf", nomeLegivel });
    checar("nome legivel, extensao original e numero SEI", n("Contrato de Cessão de Uso - Porto de Itaqui.pdf") === "Contrato de Cessão de Uso - Porto de Itaqui (123).pdf", n("Contrato de Cessão de Uso - Porto de Itaqui.pdf"));
    checar("a extensao do SEI vale, nao a que o agente escreveu", n("Contrato.docx", "a.pdf") === "Contrato.docx (123).pdf" || n("Contrato.docx", "a.pdf") === "Contrato (123).pdf", n("Contrato.docx", "a.pdf"));
    checar("numero com ponto nao e confundido com extensao", n("CUO 004.2023") === "CUO 004.2023 (123).pdf", n("CUO 004.2023"));
    checar("o numero SEI ja escrito pelo agente nao dobra", n("Contrato (123).pdf") === "Contrato (123).pdf", n("Contrato (123).pdf"));
    const longo = n("x".repeat(300));
    checar("nome longo cabe em 120, com extensao e numero", longo.length <= 120 && longo.endsWith(" (123).pdf"), longo.length);
    checar("dois-pontos e caracteres proibidos somem", !/[:*?"<>|]/.test(n('Contrato: "final"?')), n('Contrato: "final"?'));
    const caminho = await lanca(() => n("..\\outro.pdf"));
    checar("nome com caminho e recusado", /sem caminho/.test(caminho?.message ?? ""), caminho?.message);
  }

  secao("arquivo remoto: o download registra o hash");
  {
    let registrado: Baixado | undefined;
    const [baixar] = toolsBaixar({ salvar: async (a) => ({ id: 9, caminho: `C:\\Downloads\\${a.destino}`, tamanho: BYTES.length, tipo: a.tipo }), registrar: async (b) => void (registrado = b) });
    const ctx = { sinal: new AbortController().signal, sei: async () => ({ ...doSei, baixavel: true }) } as unknown as ContextoTool;
    const args = { documento: "123", nome_arquivo: "Termo Aditivo.pdf" };
    const previa = await baixar.previsualizar!(args, ctx);
    checar("o cartao do download mostra o nome escolhido", previa[0].mudancas.some((m) => m.depois.endsWith("/Termo Aditivo (123).pdf")), previa[0].mudancas);
    const trocado = await lanca(() => baixar.executar({ ...args, nome_arquivo: "Outro.pdf" }, { ...ctx, previa } as ContextoTool));
    checar("nome trocado depois da aprovacao e recusado", /aprovado/.test(trocado?.message ?? ""), trocado?.message);
    const r = (await baixar.executar(args, { ...ctx, previa } as ContextoTool)) as Record<string, unknown>;
    checar("registra o SHA-256 do que foi baixado", registrado?.sha256 === sha256 && registrado.tamanho === BYTES.length, registrado);
    checar("e devolve o nome aprovado ao agente", r.nome_arquivo === "Termo Aditivo (123).pdf", r.nome_arquivo);
  }

  secao("arquivo remoto: conferencia antes de transferir");
  {
    const ctx = (resposta: unknown) => ({ sei: async () => resposta }) as unknown as ContextoTool;
    checar("conteudo igual ao aprovado: transfere", (await conteudoDoBaixado(baixado, ctx(doSei))) === B64);
    const sem = await lanca(() => conteudoDoBaixado({ ...baixado, sha256: undefined }, ctx(doSei)));
    checar("download antigo, sem hash: recusa", /novamente/.test(sem?.message ?? ""), sem?.message);
    const outroDoc = await lanca(() => conteudoDoBaixado(baixado, ctx({ ...doSei, numero: "999" })));
    checar("documento divergente: recusa", /não corresponde/.test(outroDoc?.message ?? ""), outroDoc?.message);
    const outroProc = await lanca(() => conteudoDoBaixado(baixado, ctx({ ...doSei, processo: "50300.000001/2026-01" })));
    checar("processo divergente: recusa", /não corresponde/.test(outroProc?.message ?? ""), outroProc?.message);
    const mudou = await lanca(() => conteudoDoBaixado(baixado, ctx({ ...doSei, arquivo: { ...doSei.arquivo, base64: btoa("%PDF-1.7 aditivX") } })));
    checar("conteudo alterado desde o download: recusa", /mudou/.test(mudou?.message ?? ""), mudou?.message);
  }

  secao("arquivo remoto: mcp_chamar");
  const monta = (o: { c?: Conector; permitir?: boolean; baixados?: Baixado[]; privacidade?: Pseudonimos; resposta?: string; semCartao?: boolean } = {}) => {
    const enviados: Array<{ tool: string; args: Record<string, unknown>; prazo?: number }> = [];
    const cartoes: PedidoTransferencia[] = [];
    const externos: unknown[] = [];
    let lidos = 0;
    const lista = o.baixados ?? [baixado];
    const priv = o.privacidade;
    const chamar = toolsMcp({
      conectores: () => [o.c ?? conector()],
      guardar: async () => undefined,
      autorizado: async () => true,
      arquivos: () => lista.map((b) => b.caminho),
      baixados: () => lista,
      cliente: () => ({ iniciar: async () => ({}), chamar: async (t: string, a: Record<string, unknown>, _s: AbortSignal, prazo?: number) => (enviados.push({ tool: t, args: a, prazo }), o.resposta ?? "prévia gerada") }) as never,
    }).find((t) => t.nome === "mcp_chamar")!;
    const ctx = {
      sinal: new AbortController().signal,
      anonimizar: (x: string) => (priv ? priv.anonimizar(x) : x),
      consentirConector: async () => true,
      sei: async () => ((lidos += 1), doSei),
      ui: {
        aprovarExterno: async (p: unknown) => (externos.push(p), { permitido: true }),
        ...(o.semCartao ? {} : { aprovarTransferencia: async (p: PedidoTransferencia) => (cartoes.push(p), o.permitir ?? true) }),
      },
    } as unknown as ContextoTool;
    return { chamar, ctx, enviados, cartoes, externos, lidos: () => lidos };
  };
  const pedido = (argumentos: Record<string, unknown> = {}) => ({ servidor: "Arrendamento", tool: "arrendamento_enviar_arquivo", argumentos: { id_contrato: 4413, caminho_arquivo: CAMINHO, confirmar: false, ...argumentos } });

  {
    const m = monta();
    const r = await m.chamar.executar(pedido(), m.ctx);
    const e = m.enviados[0]?.args ?? {};
    checar("transfere os bytes no objeto de transporte", e.conteudo_base64 === B64, Object.keys(e));
    checar("com o nome aprovado", e.nome_arquivo === baixado.nome, e.nome_arquivo);
    checar("sem o caminho do Windows", e.caminho_arquivo === "", e.caminho_arquivo);
    checar("confirmar=false passa como veio", e.confirmar === false && e.id_contrato === 4413, e);
    checar("com prazo maior que o padrao, por causa do tamanho", (m.enviados[0]?.prazo ?? 0) >= 300_000, m.enviados[0]?.prazo);
    checar("o modelo so recebe a resposta do servidor", r === "prévia gerada", r);
    checar("um cartao de transferencia, nenhum cartao comum", m.cartoes.length === 1 && m.externos.length === 0, { cartoes: m.cartoes.length, externos: m.externos.length });
    const c = m.cartoes[0];
    checar("o cartao mostra documento, processo, tamanho e hash", c.documento === "123" && c.processo === PROCESSO && c.tamanho === BYTES.length && c.sha256 === sha256 && c.nome === baixado.nome, c);
    checar("e o endereco do servidor", c.endereco === "https://casa7.exemplo.ts.net/mcp", c.endereco);
    checar("sem os bytes no cartao", !JSON.stringify(c).includes(B64) && !("conteudo_base64" in c.argumentos), Object.keys(c.argumentos));
    const m2 = monta();
    await m2.chamar.executar(pedido({ confirmar: true }), m2.ctx);
    checar("confirmar=true passa como veio", m2.enviados[0]?.args.confirmar === true);
  }
  {
    const m = monta({ c: conector({ permissoes: { arrendamento_enviar_arquivo: "sempre" } }) });
    await m.chamar.executar(pedido(), m.ctx);
    checar("'permitir sempre' na ferramenta nao dispensa o cartao da transferencia", m.cartoes.length === 1);
  }
  {
    const m = monta({ permitir: false });
    const r = (await m.chamar.executar(pedido(), m.ctx)) as { erro: string };
    checar("recusa: nada e lido do SEI nem enviado", m.lidos() === 0 && m.enviados.length === 0 && /não autorizou/.test(r.erro), r);
  }
  {
    const m = monta({ semCartao: true });
    const r = (await m.chamar.executar(pedido(), m.ctx)) as { erro: string };
    checar("sem como mostrar o cartao (agente auxiliar, rotina), nao transfere", m.enviados.length === 0 && Boolean(r.erro), r);
  }
  {
    const m = monta();
    const r = (await m.chamar.executar(pedido({ conteudo_base64: "QUJD" }), m.ctx)) as { erro: string };
    checar("base64 escrito pelo agente e recusado", m.enviados.length === 0 && /bytes/.test(r.erro), r);
    const n = (await m.chamar.executar(pedido({ nome_arquivo: "Renomeado.pdf" }), m.ctx)) as { erro: string };
    checar("nome diferente do aprovado e recusado", m.enviados.length === 0 && /nome/.test(n.erro), n);
  }
  {
    // O nome aprovado tem nome de pessoa: o modelo o leu mascarado, o motor
    // devolve o real. Não pode virar recusa por comparar formas diferentes.
    const privacidade = new Pseudonimos({ nomes: true });
    privacidade.registrarPessoas(["Maria Souza"]);
    const m = monta({ privacidade });
    const r = await m.chamar.executar(pedido({ nome_arquivo: baixado.nome }), m.ctx);
    checar("nome aprovado com nome de pessoa e aceito", r === "prévia gerada" && m.enviados[0]?.args.nome_arquivo === baixado.nome, r);
    const lido = privacidade.anonimizar(baixado.nome);
    const m2 = monta({ privacidade });
    await m2.chamar.executar(pedido({ nome_arquivo: lido }), m2.ctx);
    checar("mesmo vindo na forma mascarada", m2.enviados[0]?.args.nome_arquivo === baixado.nome, m2.enviados[0]?.args);
  }
  {
    // Na transferência a servidor REMOTO, só o campo do caminho deixa de ser
    // mascarado (e ele vai vazio). Outro argumento com caminho baixado, ou
    // qualquer texto, continua mascarado como sempre.
    const outro: Baixado = { ...baixado, id: 2, caminho: "C:\\Users\\fulano.beltrano\\Downloads\\SEI Pro\\p\\Procuração Maria Souza (456).pdf", documento: "456" };
    const privacidade = new Pseudonimos({ nomes: true });
    privacidade.registrarPessoas(["Maria Souza"]);
    const m = monta({ privacidade, baixados: [baixado, outro] });
    await m.chamar.executar(pedido({ observacao: outro.caminho }), m.ctx);
    const e = m.enviados[0]?.args ?? {};
    checar("outro caminho baixado nos argumentos segue mascarado ao servidor remoto", !String(e.observacao).includes("Maria Souza") && String(e.observacao).includes("[PESSOA_1]"), e.observacao);
    checar("e o cartao mostra o que vai de fato", !String(m.cartoes[0]?.argumentos.observacao).includes("Maria Souza"), m.cartoes[0]?.argumentos);
  }
  {
    const m = monta({ resposta: `anexado; eco: ${B64}` });
    const r = await m.chamar.executar(pedido(), m.ctx);
    checar("servidor que ecoa o base64 nao o leva ao modelo", !String(r).includes(B64), r);
  }
  {
    const m = monta({ baixados: [{ ...baixado, sha256: undefined }] });
    const r = (await m.chamar.executar(pedido(), m.ctx)) as { erro: string };
    checar("download antigo sem hash, servidor remoto: recusa e pede novo download", m.enviados.length === 0 && /documento_baixar/.test(r.erro), r);
  }
  {
    const m = monta();
    const r = (await m.chamar.executar(pedido({ caminho_arquivo: "C:\\Users\\x\\Desktop\\qualquer.pdf" }), m.ctx)) as { erro: string };
    checar("caminho que o agente nao baixou, servidor remoto: recusa", m.enviados.length === 0 && /documento_baixar/.test(r.erro), r);
  }
  {
    // Nome da ferramenta e do campo são do servidor: vale a marca do esquema.
    const outra = tool("anexar_documento", { processo_id: {}, arquivo: {}, nome_arquivo: {}, dados: { type: "string", contentEncoding: "base64" } });
    const m = monta({ c: conector({ nome: "Outro", tools: [outra] }) });
    await m.chamar.executar({ servidor: "Outro", tool: "anexar_documento", argumentos: { processo_id: 1, arquivo: CAMINHO } }, m.ctx);
    const e = m.enviados[0]?.args ?? {};
    checar("campo marcado com contentEncoding base64 recebe os bytes", e.dados === B64 && e.arquivo === "" && e.nome_arquivo === baixado.nome, e);
  }

  secao("arquivo remoto: regressao do fluxo local");
  {
    const local = conector({ url: "http://127.0.0.1:8765/mcp", tools: [tool("arrendamento_enviar_arquivo", { id_contrato: {}, caminho_arquivo: {}, confirmar: {} })] });
    const m = monta({ c: local });
    await m.chamar.executar(pedido(), m.ctx);
    const e = m.enviados[0]?.args ?? {};
    checar("servidor local sem campo de conteudo: vai o caminho real, sem bytes", e.caminho_arquivo === CAMINHO && !("conteudo_base64" in e) && m.lidos() === 0, e);
    checar("e sem cartao de transferencia", m.cartoes.length === 0);
    const comCampo = monta({ c: conector({ url: "http://127.0.0.1:8765/mcp" }), baixados: [{ ...baixado, sha256: undefined }] });
    await comCampo.chamar.executar(pedido(), comCampo.ctx);
    checar("servidor local com download antigo sem hash: segue pelo caminho", comCampo.enviados[0]?.args.caminho_arquivo === CAMINHO && !("conteudo_base64" in (comCampo.enviados[0]?.args ?? {})), comCampo.enviados[0]?.args);
    const tunel = monta({ c: conector({ url: "http://127.0.0.1:8765/mcp" }) });
    await tunel.chamar.executar(pedido(), tunel.ctx);
    checar("servidor local com campo de conteudo (tunel): transfere", tunel.enviados[0]?.args.conteudo_base64 === B64 && tunel.cartoes.length === 1);
  }

  secao("arquivo remoto: prazo do envio");
  {
    const pendurado = ((_u: string, init: RequestInit) =>
      new Promise((_r, rejeitar) => init.signal?.addEventListener("abort", () => rejeitar(new DOMException("abort", "AbortError"))))) as unknown as typeof fetch;
    const e = (await lanca(() => new ClienteMcp({ url: "https://m.exemplo.com/mcp" }, pendurado).chamar("t", {}, new AbortController().signal, 30))) as ErroMcp;
    checar("o prazo pedido vale e a mensagem diz qual foi", e?.codigo === "rede" && /não respondeu/.test(e.message), e?.message);
  }

  secao("arquivo remoto: cartao de transferencia");
  {
    const doc = new DOMParser().parseFromString("<html><body></body></html>", "text/html") as unknown as Document;
    (globalThis as { document?: Document }).document = doc;
    let dlg: HTMLElement & { close(): void } = null as never;
    const abrirModal: AbrirModal = (o) => {
      const el = doc.createElement("div") as unknown as HTMLElement & { close(): void };
      const ouvintes: Array<() => void> = [];
      el.close = () => ouvintes.forEach((f) => f());
      (el as unknown as { addEventListener: (t: string, f: () => void) => void }).addEventListener = (t, f) => void (t === "close" && ouvintes.push(f));
      for (const n of [...o.corpo, ...o.acoes]) if (n && typeof n !== "string") el.append(n);
      dlg = el;
      return el as unknown as HTMLDialogElement;
    };
    const p: PedidoTransferencia = { conector: "Arrendamento", endereco: "https://casa7.exemplo.ts.net/mcp", tool: "arrendamento_enviar_arquivo", documento: "123", processo: PROCESSO, nome: baixado.nome, tamanho: 2_500_000, sha256, argumentos: { id_contrato: 4413, confirmar: false } };
    const promessa = cartaoTransferencia(p, abrirModal);
    const texto = dlg.textContent ?? "";
    const botoes = [...dlg.querySelectorAll("button")].map((b) => b.textContent);
    checar("mostra documento, nome, tamanho e servidor", texto.includes("123") && texto.includes(baixado.nome) && /2,4 MB/.test(texto) && texto.includes("casa7.exemplo.ts.net"), texto.slice(0, 300));
    checar("mostra o comeco do hash", texto.includes(sha256.slice(0, 12)));
    checar("avisa que vai com os dados reais", /dados reais/.test(texto));
    checar("so duas saidas: sem 'permitir sempre'", botoes.join("|") === "Recusar|Enviar o documento", botoes);
    [...dlg.querySelectorAll("button")].find((b) => b.textContent === "Enviar o documento")!.click();
    checar("enviar devolve sim", (await promessa) === true);
    const recusa = cartaoTransferencia(p, abrirModal);
    dlg.close();
    checar("fechar sem escolher e recusa", (await recusa) === false);
  }
}
