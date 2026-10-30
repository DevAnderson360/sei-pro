/**
 * documento_baixar: o documento do SEI vira arquivo na pasta Downloads, para
 * um conector local que só lê do disco (o modelo não carrega bytes: recebe o
 * caminho e o repassa).
 *
 * O que não pode escapar: nome de arquivo que o conector aceite, aprovação a
 * cada vez (o arquivo sai do SEI com dados reais), o caminho chegar INTACTO
 * ao mcp_chamar apesar do mascaramento, e dar para apagar depois.
 */

import { DOMParser } from "linkedom";
import { Pseudonimos } from "@nucleo/privacidade/anonimizar";
import type { Sei } from "@nucleo/sei";
import type { Conector } from "../src/mcp/conectores";
import { toolsMcp } from "../src/mcp/tools";
import type { ContextoTool } from "../src/motor/tools";
import { apagarBaixados, listarBaixados, registrarBaixado, salvarNoDisco, secaoBaixados, type ApiDownloads, type Baixado } from "../src/painel/baixados";
import { avaliarPassos } from "../src/painel/rotinas";
import { OPERACOES } from "../src/ponte/operacoes";
import { destinoDoArquivo, nomeDeArquivo, toolsBaixar } from "../src/tools/baixar";
import { checar, lanca, secao } from "./util";

const PROCESSO = "50300.011914/2026-37";
const b64 = (texto: string) => Buffer.from(texto, "latin1").toString("base64");

/** `chrome.downloads` de mentira: guarda o que foi pedido e "termina" o download. */
function downloadsFalsos(o: { estado?: "complete" | "interrupted"; pasta?: string } = {}) {
  const pedidos: Array<Record<string, unknown>> = [];
  const removidos: number[] = [];
  const apagadosDoHistorico: number[] = [];
  const ouvintes = new Set<(d: { id: number; state?: { current: string } }) => void>();
  const itens = new Map<number, { id: number; filename: string; fileSize: number; mime: string; state: string; exists: boolean }>();
  const api: ApiDownloads = {
    download: async (p) => {
      const id = pedidos.push(p as unknown as Record<string, unknown>);
      itens.set(id, { id, filename: `${o.pasta ?? "/Users/fulano/Downloads"}/${p.filename}`, fileSize: 1234, mime: "application/pdf", state: "in_progress", exists: true });
      setTimeout(() => {
        const estado = o.estado ?? "complete";
        itens.get(id)!.state = estado;
        for (const f of ouvintes) f({ id, state: { current: estado } });
      }, 5);
      return id;
    },
    search: async (q) => [...itens.values()].filter((i) => q.id === undefined || i.id === q.id),
    removeFile: async (id) => {
      if (!itens.get(id)?.exists) throw new Error("arquivo nao existe");
      itens.get(id)!.exists = false;
      removidos.push(id);
    },
    erase: async (q) => {
      if (q.id !== undefined) apagadosDoHistorico.push(q.id);
      return [];
    },
    onChanged: { addListener: (f) => void ouvintes.add(f), removeListener: (f) => void ouvintes.delete(f) },
  };
  return { api, pedidos, removidos, apagadosDoHistorico, itens };
}

function armazemFalso() {
  const dados: Record<string, unknown> = {};
  return {
    dados,
    get: async (k: string) => ({ [k]: dados[k] }),
    set: async (v: Record<string, unknown>) => void Object.assign(dados, v),
  };
}

const baixado = (c: Partial<Baixado> = {}): Baixado => ({ id: 1, caminho: "/Users/fulano/Downloads/SEI Pro/p/a.pdf", nome: "a.pdf", processo: PROCESSO, documento: "1234567", tamanho: 10, quando: 1, ...c });

export async function verificarBaixar(): Promise<void> {
  secao("baixar: nome de arquivo seguro");
  {
    const n = nomeDeArquivo({ titulo: "Contrato 002/2026: Cessão de Uso \\ EMAP", numero: "1234567", nomeOriginal: "contrato.PDF", tipo: "application/pdf" });
    checar("sem barra, contrabarra nem dois-pontos", !/[\/\\:]/.test(n), n);
    checar("leva o numero SEI, para dois 'Anexo' nao se sobrescreverem", n.includes("1234567"), n);
    checar("extensao do arquivo original, em minuscula", n.endsWith(".pdf"), n);
    const oculto = nomeDeArquivo({ titulo: "...oculto", numero: "7", nomeOriginal: "", tipo: "application/pdf" });
    checar("sem ponto no inicio (o conector recusa arquivo oculto)", !oculto.startsWith(".") && oculto.endsWith(".pdf"), oculto);
    const longo = nomeDeArquivo({ titulo: "x".repeat(300), numero: "1234567", nomeOriginal: "a.docx", tipo: "" });
    checar("no maximo 120 caracteres, sem perder a extensao nem o numero", longo.length <= 120 && longo.endsWith(".docx") && longo.includes("1234567"), longo.length);
    checar("sem nome original, a extensao vem do tipo", nomeDeArquivo({ titulo: "Foto", numero: "9", nomeOriginal: "", tipo: "image/jpeg" }).endsWith(".jpg"));
    checar("tipo desconhecido ainda sai com extensao", /\.[a-z0-9]+$/.test(nomeDeArquivo({ titulo: "Coisa", numero: "9", nomeOriginal: "semextensao", tipo: "application/x-estranho" })));
    checar("extensao esquisita do original nao passa", nomeDeArquivo({ titulo: "A", numero: "9", nomeOriginal: "a.p/d:f", tipo: "application/pdf" }).endsWith(".pdf"));
    const vazio = nomeDeArquivo({ titulo: "///", numero: "9", nomeOriginal: "", tipo: "application/pdf" });
    checar("titulo que some inteiro ainda da um nome", /^[^.].*\.pdf$/.test(vazio), vazio);
    const d = destinoDoArquivo(PROCESSO, "Contrato (1234567).pdf");
    checar("pasta: SEI Pro/<processo sem barras>/", d === "SEI Pro/50300.011914-2026-37/Contrato (1234567).pdf", d);
    checar("nenhuma parte do caminho comeca com ponto", d.split("/").every((p) => !p.startsWith(".")), d);
  }

  secao("baixar: a operacao na pagina do SEI");
  {
    const doc = (c: Record<string, unknown>) => ({ id: "9", numero: "1234567", titulo: "Contrato 002/2026", formato: "pdf", externo: true, nivel: "publico", assinado: false, assinaturas: [], src: "controlador.php?acao=documento_download_anexo&id=9", ...c });
    const sei = (d: Record<string, unknown>, nivel = "publico") => {
      let baixou = 0;
      const s = {
        localizar: async () => ({ idDocumento: "9" }),
        arvore: async () => ({ protocolo: PROCESSO, nivel, documentos: [d] }),
        http: { baixar: async () => ((baixou += 1), { bytes: new Uint8Array([37, 80, 68, 70]), tipo: "application/pdf", nome: "contrato.pdf" }), obter: async () => ({ html: "<html><body>x</body></html>" }) },
      } as unknown as Sei;
      return { s, baixou: () => baixou };
    };
    const sinal = new AbortController().signal;
    const ext = sei(doc({}));
    const meta = (await OPERACOES["documento.baixar"](ext.s, { numero: "1234567", somenteMetadados: true }, sinal)) as { baixavel: boolean; processo: string; arquivo?: { nome: string; tipo: string; tamanho: number; base64?: string } };
    checar("so metadados: diz se da para baixar", meta.baixavel === true && meta.processo === PROCESSO, meta);
    // O cartão de aprovação tem de mostrar o arquivo que SERÁ gravado: nome e
    // tipo reais vêm do SEI, não de um palpite pelo ícone da árvore.
    checar("com o nome, o tipo e o tamanho reais do arquivo", meta.arquivo?.nome === "contrato.pdf" && meta.arquivo.tipo === "application/pdf" && meta.arquivo.tamanho === 4, meta.arquivo);
    checar("mas sem trazer os bytes para o painel", meta.arquivo?.base64 === undefined, Object.keys(meta.arquivo ?? {}));
    const r = (await OPERACOES["documento.baixar"](ext.s, { numero: "1234567" }, sinal)) as { arquivo: { base64: string; tipo: string; nome: string; tamanho: number } };
    checar("documento externo: devolve o arquivo original", atob(r.arquivo.base64) === "%PDF" && r.arquivo.tipo === "application/pdf" && r.arquivo.tamanho === 4, r.arquivo);
    const nativo = sei(doc({ externo: false, formato: "interno", src: "controlador.php?acao=documento_visualizar&id=9" }));
    const mn = (await OPERACOES["documento.baixar"](nativo.s, { numero: "1234567", somenteMetadados: true }, sinal)) as { baixavel: boolean };
    checar("documento do editor: nao e baixavel", mn.baixavel === false, mn);
    const e = await lanca(() => OPERACOES["documento.baixar"](nativo.s, { numero: "1234567" }, sinal));
    checar("e a recusa explica o motivo", /editor do SEI/.test(e?.message ?? "") && /externo/.test(e?.message ?? ""), e?.message);
    const sig = sei(doc({ nivel: "sigiloso" }));
    const es = await lanca(() => OPERACOES["documento.baixar"](sig.s, { numero: "1234567", somenteMetadados: true }, sinal));
    checar("sigiloso e recusado antes de qualquer byte", es?.codigo === "SEI_SIGILOSO" && sig.baixou() === 0, es);
  }

  secao("baixar: a ferramenta");
  const monta = (resposta: (op: string, a: Record<string, unknown>) => unknown) => {
    const salvos: Array<{ destino: string; bytes: Uint8Array; tipo: string }> = [];
    const registrados: Baixado[] = [];
    const [t] = toolsBaixar({
      salvar: async (a) => (salvos.push(a), { id: 7, caminho: `/Users/fulano/Downloads/${a.destino}`, tamanho: a.bytes.length, tipo: a.tipo }),
      registrar: async (x) => void registrados.push(x),
      agora: () => 99,
    });
    const ctx = { sinal: new AbortController().signal, sei: async (op: string, a: Record<string, unknown> = {}) => resposta(op, a) } as unknown as ContextoTool;
    /** Como o motor: a prévia que o usuário aprovou acompanha a execução do passo. */
    const aprovar = async (documento: string) => ({ ...ctx, previa: await t.previsualizar!({ documento }, ctx) }) as ContextoTool;
    return { t, salvos, registrados, ctx, aprovar };
  };
  const META = { numero: "1234567", titulo: "Contrato 002/2026", formato: "pdf", externo: true, nivel: "restrito", processo: PROCESSO };
  {
    const { t, salvos, registrados, ctx, aprovar } = monta((_op, a) => ({ ...META, baixavel: true, arquivo: { ...(a.somenteMetadados ? {} : { base64: b64("%PDF-1.7") }), tipo: "application/pdf", nome: "contrato.pdf", tamanho: 8 } }));
    checar("chama-se documento_baixar", t.nome === "documento_baixar");
    checar("e escrita: so roda com aprovacao, e nao existe 'permitir sempre' em plano", t.efeito === "escrita" && typeof t.previsualizar === "function");
    checar("a descricao e a combinada", t.descricao.startsWith("Baixa um documento do SEI para a pasta Downloads do usuário e devolve o caminho do arquivo. Use quando um conector precisar do arquivo em disco."), t.descricao);

    const previa = await t.previsualizar!({ documento: "1234567" }, ctx);
    checar("o cartao mostra o documento", /Contrato 002\/2026/.test(previa[0].alvo) && /1234567/.test(previa[0].alvo), previa[0].alvo);
    checar("mostra o destino no computador", previa[0].mudancas.some((m) => m.depois === "Downloads/SEI Pro/50300.011914-2026-37/Contrato 002-2026 (1234567).pdf"), previa[0].mudancas);
    checar("e avisa que o arquivo sai com dados reais", previa[0].mudancas.some((m) => /dados pessoais reais|sem máscara/i.test(`${m.campo} ${m.depois}`)), previa[0].mudancas);
    checar("a previa nao baixa nada", salvos.length === 0);

    const r = (await t.executar({ documento: "1234567" }, await aprovar("1234567"))) as { caminho: string; tamanho: number; tipo: string; aplicado: boolean };
    checar("salva na pasta do processo", salvos[0]?.destino === "SEI Pro/50300.011914-2026-37/Contrato 002-2026 (1234567).pdf", salvos[0]?.destino);
    checar("com os bytes do SEI", new TextDecoder().decode(salvos[0].bytes) === "%PDF-1.7");
    checar("devolve o caminho absoluto, o tamanho e o tipo", r.caminho === "/Users/fulano/Downloads/SEI Pro/50300.011914-2026-37/Contrato 002-2026 (1234567).pdf" && r.tamanho === 8 && r.tipo === "application/pdf" && r.aplicado === true, r);
    checar("e registra o arquivo para a limpeza", registrados.length === 1 && registrados[0].id === 7 && registrados[0].documento === "1234567" && registrados[0].quando === 99, registrados);
  }
  {
    const { t, salvos, ctx } = monta((_op, a) => {
      if (a.somenteMetadados) return { ...META, externo: false, formato: "interno", baixavel: false };
      throw Object.assign(new Error("O documento 1234567 foi escrito no editor do SEI."), { codigo: "SEI_ACAO_INDISPONIVEL" });
    });
    const previa = await t.previsualizar!({ documento: "1234567" }, ctx);
    checar("documento do editor: o cartao ja diz que nao da", /editor do SEI/.test(previa[0].erro ?? ""), previa[0]);
    const e = await lanca(() => t.executar({ documento: "1234567" }, ctx));
    checar("e a execucao recusa sem gravar nada", Boolean(e) && salvos.length === 0, e?.message);
  }

  secao("baixar: o que foi aprovado e o que e gravado");
  {
    // O arquivo trocado no SEI entre o cartão e a gravação: o usuário aprovou
    // um PDF, e o que chegaria ao disco é outra coisa.
    let trocado = false;
    const { t, salvos, ctx, aprovar } = monta((_op, a) => ({ ...META, baixavel: true, arquivo: { ...(a.somenteMetadados ? {} : { base64: b64("x") }), tipo: trocado ? "image/png" : "application/pdf", nome: trocado ? "outro.png" : "contrato.pdf", tamanho: 1 } }));
    const visto = await aprovar("1234567");
    trocado = true;
    const e = await lanca(() => t.executar({ documento: "1234567" }, visto));
    checar("destino diferente do aprovado: recusa", /aprovad/i.test(e?.message ?? "") && salvos.length === 0, e?.message);
    trocado = false;

    // A aprovação é a do CARTÃO DESTE PASSO, e não uma lembrança da ferramenta:
    // um cartão recusado antes não pode valer para uma execução que veio
    // depois sem prévia (passo de plano com referência "$1...").
    await t.previsualizar!({ documento: "1234567" }, ctx);
    const semPrevia = await lanca(() => t.executar({ documento: "1234567" }, ctx));
    checar("previa de um cartao anterior nao autoriza execucao sem previa", /aprovad/i.test(semPrevia?.message ?? "") && salvos.length === 0, semPrevia?.message);
    const previaVazia = await lanca(() => t.executar({ documento: "1234567" }, { ...ctx, previa: [] } as ContextoTool));
    checar("passo sem previa (dependente) nao grava", /aprovad/i.test(previaVazia?.message ?? "") && salvos.length === 0, previaVazia?.message);
    const deOutro = await lanca(async () => t.executar({ documento: "1234567" }, { ...ctx, previa: [{ alvo: "x", resumo: "", mudancas: [{ campo: "Salvar em", antes: "", depois: "Downloads/SEI Pro/outro/Outro (7654321).pdf" }] }] } as ContextoTool));
    checar("previa de outro documento nao serve", /aprovad/i.test(deOutro?.message ?? "") && salvos.length === 0, deOutro?.message);
    await t.executar({ documento: "1234567" }, await aprovar("1234567"));
    checar("com a previa certa, grava", salvos.length === 1, salvos.length);
  }
  {
    const { t, salvos, ctx } = monta((_op, a) => ({ ...META, baixavel: true, arquivo: { ...(a.somenteMetadados ? {} : { base64: b64("MZ") }), tipo: "application/x-msdownload", nome: "instalar.exe", tamanho: 2 } }));
    const previa = await t.previsualizar!({ documento: "1234567" }, ctx);
    checar("arquivo que nao e documento: o cartao ja recusa", /\.exe/.test(previa[0].erro ?? "") && previa[0].mudancas.length === 0, previa[0]);
    const e = await lanca(() => t.executar({ documento: "1234567" }, ctx));
    checar("e nada e gravado", Boolean(e) && salvos.length === 0, e?.message);
    const xlsx = monta((_op, a) => ({ ...META, baixavel: true, arquivo: { ...(a.somenteMetadados ? {} : { base64: b64("PK") }), tipo: "", nome: "Planilha.XLSX", tamanho: 2 } }));
    const px = await xlsx.t.previsualizar!({ documento: "1234567" }, xlsx.ctx);
    checar("o cartao mostra a extensao real, nao um palpite", px[0].mudancas.some((m) => m.depois.endsWith("(1234567).xlsx")), px[0].mudancas);
    await xlsx.t.executar({ documento: "1234567" }, { ...xlsx.ctx, previa: px } as ContextoTool);
    checar("e e essa que vai para o disco", xlsx.salvos[0]?.destino.endsWith("(1234567).xlsx"), xlsx.salvos[0]?.destino);
  }

  secao("baixar: gravacao pelo chrome.downloads");
  {
    const d = downloadsFalsos();
    const urls: string[] = [];
    const r = await salvarNoDisco({ destino: "SEI Pro/p/Contrato (1).pdf", bytes: new Uint8Array([1, 2, 3]), tipo: "application/pdf" }, { api: d.api, permitido: async () => true, url: () => (urls.push("blob:x"), "blob:x"), soltar: () => undefined });
    checar("pede o download com o caminho relativo", d.pedidos[0]?.filename === "SEI Pro/p/Contrato (1).pdf" && d.pedidos[0].url === "blob:x", d.pedidos[0]);
    checar("sem dialogo e sobrescrevendo", d.pedidos[0].saveAs === false && d.pedidos[0].conflictAction === "overwrite", d.pedidos[0]);
    checar("espera terminar e devolve o caminho ABSOLUTO do navegador", r.caminho === "/Users/fulano/Downloads/SEI Pro/p/Contrato (1).pdf" && r.tamanho === 1234 && r.tipo === "application/pdf" && r.id === 1, r);

    const falho = downloadsFalsos({ estado: "interrupted" });
    const e = await lanca(() => salvarNoDisco({ destino: "SEI Pro/p/a.pdf", bytes: new Uint8Array([1]), tipo: "application/pdf" }, { api: falho.api, permitido: async () => true, url: () => "blob:y", soltar: () => undefined }));
    checar("download interrompido vira erro explicado", /não terminou|interromp/i.test(e?.message ?? ""), e?.message);

    const negado = downloadsFalsos();
    const n = await lanca(() => salvarNoDisco({ destino: "SEI Pro/p/a.pdf", bytes: new Uint8Array([1]), tipo: "application/pdf" }, { api: negado.api, permitido: async () => false, url: () => "blob:z", soltar: () => undefined }));
    checar("sem a permissao de downloads, nada e baixado", negado.pedidos.length === 0 && /permiss/i.test(n?.message ?? ""), n?.message);
  }

  secao("baixar: registro e limpeza");
  {
    const armazem = armazemFalso();
    await registrarBaixado(baixado({ id: 1 }), armazem);
    await registrarBaixado(baixado({ id: 2, caminho: "/Users/fulano/Downloads/SEI Pro/p/b.pdf", nome: "b.pdf" }), armazem);
    await registrarBaixado(baixado({ id: 3, quando: 5 }), armazem);
    const lista = await listarBaixados(armazem);
    checar("guarda o que foi baixado", lista.length === 2, lista);
    checar("o mesmo caminho baixado de novo substitui o registro (o arquivo foi sobrescrito)", lista.some((x) => x.id === 3) && !lista.some((x) => x.id === 1), lista.map((x) => x.id));

    const d = downloadsFalsos();
    d.itens.set(2, { id: 2, filename: "/Users/fulano/Downloads/SEI Pro/p/b.pdf", fileSize: 1, mime: "", state: "complete", exists: true });
    d.itens.set(3, { id: 3, filename: "/Users/fulano/Downloads/SEI Pro/p/a.pdf", fileSize: 1, mime: "", state: "complete", exists: false });
    const r = await apagarBaixados(armazem, d.api);
    checar("apaga o arquivo do disco", d.removidos.join() === "2", d.removidos);
    checar("e tira os dois do historico de downloads", d.apagadosDoHistorico.sort().join() === "2,3", d.apagadosDoHistorico);
    checar("conta o que apagou e o que ja nao existia", r.apagados === 1 && r.ausentes === 1, r);
    checar("e o registro fica vazio", (await listarBaixados(armazem)).length === 0);

    // O id de download pode passar a apontar para OUTRO arquivo (histórico do
    // navegador limpo e ids reaproveitados): apagar pelo id, sem conferir o
    // caminho, removeria um arquivo do usuário que o agente nunca criou.
    await registrarBaixado(baixado({ id: 5, caminho: "/Users/fulano/Downloads/SEI Pro/p/meu.pdf" }), armazem);
    const outro = downloadsFalsos();
    outro.itens.set(5, { id: 5, filename: "/Users/fulano/Downloads/declaracao-imposto.pdf", fileSize: 1, mime: "", state: "complete", exists: true });
    const ro = await apagarBaixados(armazem, outro.api);
    checar("id que hoje aponta para outro arquivo: nao apaga", outro.removidos.length === 0 && ro.apagados === 0 && ro.ausentes === 1, { removidos: outro.removidos, ro });
    checar("nem tira do historico o download alheio", outro.apagadosDoHistorico.length === 0, outro.apagadosDoHistorico);

    // Permissão revogada: sem o chrome.downloads não há como apagar, e
    // esvaziar o registro seria esquecer arquivos que continuam no disco.
    await registrarBaixado(baixado({ id: 9 }), armazem);
    const e = await lanca(() => apagarBaixados(armazem, undefined, null));
    checar("sem acesso aos downloads, avisa em vez de fingir que apagou", /permiss/i.test(e?.message ?? ""), e?.message);
    checar("e o registro continua la", (await listarBaixados(armazem)).length === 1);
  }
  {
    const doc = new DOMParser().parseFromString("<html><body></body></html>", "text/html") as unknown as Document;
    (globalThis as { document?: Document }).document = doc;
    let lista = [baixado({ id: 1, tamanho: 1024 * 1024 }), baixado({ id: 2, caminho: "/x/b.pdf", tamanho: 1024 * 1024 })];
    let apagou = 0;
    const ui = secaoBaixados({ listar: async () => lista, apagar: async () => ((apagou += 1), (lista = []), { apagados: 2, ausentes: 0 }) });
    await ui.atualizar();
    checar("a configuracao diz quantos arquivos ha", /2 arquivos/.test(ui.elemento.textContent ?? "") && /2,0 MB/.test(ui.elemento.textContent ?? ""), ui.elemento.textContent);
    const botao = [...ui.elemento.querySelectorAll("button")].find((b) => /Apagar/.test(b.textContent ?? "")) as HTMLButtonElement;
    checar("com o botao de apagar", Boolean(botao) && !botao.hasAttribute("disabled"));
    botao.click();
    await new Promise((r) => setTimeout(r, 10));
    checar("o clique apaga e a tela passa a dizer que nao ha nada", apagou === 1 && /Nenhum arquivo/.test(ui.elemento.textContent ?? ""), ui.elemento.textContent);
  }

  secao("baixar: o caminho chega intacto ao conector");
  {
    const conector: Conector = { id: "arr", nome: "Arrendamento", url: "http://127.0.0.1:8765/mcp", ativo: true, auth: { tipo: "nenhuma" }, padrao: "sempre", permissoes: {}, consentido: true, tools: [{ nome: "arrendamento_enviar_arquivo", descricao: "", esquema: {} }] };
    const privacidade = new Pseudonimos({ nomes: true, cnpj: true });
    privacidade.registrarPessoas(["Fulano Beltrano", "Maria Souza"]);
    const caminho = "/Users/fulano.beltrano/Downloads/SEI Pro/50300.011914-2026-37/Procuração Maria Souza - CPF 123.456.789-09 (1234567).pdf";
    const enviados: Array<Record<string, unknown>> = [];
    const vistosNoCartao: Array<Record<string, unknown>> = [];
    const chamar = toolsMcp({
      conectores: () => [conector],
      guardar: async () => undefined,
      autorizado: async () => true,
      arquivos: () => [caminho],
      cliente: () => ({ iniciar: async () => ({}), chamar: async (_t: string, a: Record<string, unknown>) => (enviados.push(a), "ok") }) as never,
    }).find((t) => t.nome === "mcp_chamar")!;
    const ctx = (): ContextoTool =>
      ({ sinal: new AbortController().signal, anonimizar: (x: string) => privacidade.anonimizar(x), consentirConector: async () => true, ui: { aprovarExterno: async (p: { argumentos: Record<string, unknown> }) => (vistosNoCartao.push(p.argumentos), { permitido: true }) } }) as unknown as ContextoTool;

    // O que o modelo lê é o resultado mascarado; o que ele devolve, o motor reidrata.
    const lidoPeloModelo = (JSON.parse(privacidade.anonimizar(JSON.stringify({ caminho }))) as { caminho: string }).caminho;
    checar("(premissa) o mascaramento mexe no caminho que o modelo le", lidoPeloModelo !== caminho, lidoPeloModelo);
    const reidratado = privacidade.reidratarValor({ id_contrato: 12, caminho_arquivo: lidoPeloModelo, obs: "Procuração de Maria Souza" });
    await chamar.executar({ servidor: "Arrendamento", tool: "arrendamento_enviar_arquivo", argumentos: reidratado }, ctx());
    checar("o conector recebe o caminho real, byte a byte", enviados[0]?.caminho_arquivo === caminho, enviados[0]);
    checar("o resto dos argumentos continua mascarado", !/Maria Souza/.test(String(enviados[0]?.obs)), enviados[0]);

    await chamar.executar({ servidor: "Arrendamento", tool: "arrendamento_enviar_arquivo", argumentos: { caminho_arquivo: lidoPeloModelo } }, ctx());
    checar("mesmo se o caminho vier ainda mascarado, vai o real", enviados[1]?.caminho_arquivo === caminho, enviados[1]);

    await chamar.executar({ servidor: "Arrendamento", tool: "arrendamento_enviar_arquivo", argumentos: { caminho_arquivo: "/Users/fulano.beltrano/Documents/Maria Souza.pdf" } }, ctx());
    checar("caminho que o agente NAO baixou segue a regra geral (mascarado)", !/Maria Souza/.test(String(enviados[2]?.caminho_arquivo)), enviados[2]);

    // Conector de FORA não lê o disco do usuário: o caminho real não lhe serve
    // de nada, e o título do documento levaria nome e CPF a um terceiro.
    const deFora = toolsMcp({
      conectores: () => [{ ...conector, url: "https://mcp.terceiro.com/mcp" }],
      guardar: async () => undefined,
      autorizado: async () => true,
      arquivos: () => [caminho],
      cliente: () => ({ iniciar: async () => ({}), chamar: async (_t: string, a: Record<string, unknown>) => (enviados.push(a), "ok") }) as never,
    }).find((t) => t.nome === "mcp_chamar")!;
    await deFora.executar({ servidor: "Arrendamento", tool: "arrendamento_enviar_arquivo", argumentos: { caminho_arquivo: caminho } }, ctx());
    checar("conector remoto recebe o caminho mascarado, como qualquer outro dado", !/Maria Souza|123\.456\.789-09/.test(String(enviados[3]?.caminho_arquivo)), enviados[3]);

    // A marca interna da troca não pode ser um texto que o modelo saiba escrever.
    await chamar.executar({ servidor: "Arrendamento", tool: "arrendamento_enviar_arquivo", argumentos: { obs: "SEIPROARQUIVOBAIXADOQZX0" } }, ctx());
    checar("texto igual a uma marca antiga nao vira caminho", enviados[4]?.obs === "SEIPROARQUIVOBAIXADOQZX0", enviados[4]);

    const comCartao = toolsMcp({ conectores: () => [{ ...conector, padrao: "aprovar" }], guardar: async () => undefined, autorizado: async () => true, arquivos: () => [caminho], cliente: () => ({ iniciar: async () => ({}), chamar: async () => "ok" }) as never }).find((t) => t.nome === "mcp_chamar")!;
    await comCartao.executar({ servidor: "Arrendamento", tool: "arrendamento_enviar_arquivo", argumentos: { caminho_arquivo: caminho } }, ctx());
    checar("o cartao de aprovacao mostra o caminho que vai de fato", vistosNoCartao[0]?.caminho_arquivo === caminho, vistosNoCartao[0]);
  }

  secao("baixar: rotina nunca baixa sozinha");
  {
    const rotina = { alcance: "autonoma", autorizadas: ["documento_baixar", "processo_anotacao"] } as never;
    const v = avaliarPassos(rotina, [{ tool: "documento_baixar", efeito: "escrita" }]);
    checar("mesmo autorizada na lista, pede o usuario", v.aprovado === false && /documento_baixar/.test(v.motivo ?? ""), v);
    checar("as outras escritas autorizadas continuam valendo", avaliarPassos(rotina, [{ tool: "processo_anotacao", efeito: "escrita" }]).aprovado === true);
  }
}
