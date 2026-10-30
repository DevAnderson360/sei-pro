/**
 * Arquivos que o agente baixou do SEI para o computador (`documento_baixar`).
 *
 * Três trabalhos: gravar pelo `chrome.downloads`, lembrar o que foi gravado e
 * apagar depois. O registro existe porque são CÓPIAS de documentos do SEI,
 * com dados reais, numa pasta comum do usuário: quem as criou tem de saber
 * dizer quais são e oferecer a limpeza.
 *
 * `downloads` é permissão OPCIONAL, pedida na primeira vez: declarada como
 * obrigatória, a atualização da extensão ficaria desativada em todo navegador
 * até o usuário aceitar a permissão nova.
 */

import { h, icone } from "./dom";

export interface Baixado {
  /** Id do download no navegador: é com ele que se apaga o arquivo. */
  id: number;
  /** Caminho absoluto, como o navegador informou. */
  caminho: string;
  nome: string;
  processo: string;
  documento: string;
  tamanho: number;
  /** Hash do conteúdo aprovado, para conferir antes de transferir ao MCP remoto. */
  sha256?: string;
  quando: number;
}

/** O pedaço de `chrome.downloads` que se usa aqui; os testes o trocam. */
export interface ApiDownloads {
  download(p: { url: string; filename: string; conflictAction: "overwrite"; saveAs: false }): Promise<number>;
  search(q: { id?: number }): Promise<Array<{ id: number; filename: string; fileSize: number; mime: string; state: string; exists?: boolean }>>;
  removeFile(id: number): Promise<void>;
  erase(q: { id?: number }): Promise<unknown>;
  onChanged: {
    addListener(f: (d: { id: number; state?: { current?: string } }) => void): void;
    removeListener(f: (d: { id: number; state?: { current?: string } }) => void): void;
  };
}

interface Armazem {
  get(chave: string): Promise<Record<string, unknown>>;
  set(valores: Record<string, unknown>): Promise<void>;
}

const CHAVE = "agenteIA_baixados";
const MAX_REGISTROS = 500;
/** Arquivo local: se não terminou nisto, não vai terminar. */
const PRAZO = 60_000;

const armazemPadrao = (): Armazem => chrome.storage.local as unknown as Armazem;
const apiPadrao = (): ApiDownloads | undefined => (typeof chrome === "undefined" ? undefined : (chrome.downloads as unknown as ApiDownloads | undefined));

export async function temPermissaoDeDownloads(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ permissions: ["downloads"] });
  } catch {
    return false;
  }
}

/** Pede a permissão. Precisa de um clique recente do usuário (aprovar o plano serve). */
export async function pedirPermissaoDeDownloads(): Promise<boolean> {
  try {
    if (await chrome.permissions.contains({ permissions: ["downloads"] })) return true;
    return await chrome.permissions.request({ permissions: ["downloads"] });
  } catch {
    return false;
  }
}

export interface OpcoesSalvar {
  api?: ApiDownloads;
  permitido?(): Promise<boolean>;
  /** Endereço temporário dos bytes (blob:); trocável nos testes. */
  url?(bytes: Uint8Array, tipo: string): string;
  soltar?(url: string): void;
}

/**
 * Grava em Downloads, sem diálogo, e devolve o caminho ABSOLUTO.
 *
 * O caminho vem do próprio navegador (`downloads.search`), não de uma conta
 * feita aqui: a pasta de downloads é escolha do usuário, e é o caminho real
 * que o conector vai abrir.
 */
export async function salvarNoDisco(a: { destino: string; bytes: Uint8Array; tipo: string }, o: OpcoesSalvar = {}): Promise<{ id: number; caminho: string; tamanho: number; tipo: string }> {
  if (!(await (o.permitido ?? pedirPermissaoDeDownloads)())) {
    throw new Error('O navegador não deu ao SEI Pro a permissão de downloads, então nada foi baixado. Abra a configuração do agente, em "O que o agente pode" > Privacidade, clique em "Permitir downloads" e tente de novo.');
  }
  const api = o.api ?? apiPadrao();
  if (!api) throw new Error("A permissão de downloads foi dada, mas o painel ainda não a enxerga. Feche e abra o painel do agente e tente de novo.");
  const url = (o.url ?? ((bytes, tipo) => URL.createObjectURL(new Blob([bytes as BlobPart], { type: tipo }))))(a.bytes, a.tipo);
  try {
    const id = await api.download({ url, filename: a.destino, conflictAction: "overwrite", saveAs: false });
    await new Promise<void>((resolver, rejeitar) => {
      const falha = (motivo: string) => new Error(`O download não terminou (${motivo}). Nada foi entregue ao conector.`);
      const fim = (erro?: Error) => {
        clearTimeout(prazo);
        api.onChanged.removeListener(ouvir);
        if (erro) rejeitar(erro);
        else resolver();
      };
      const conferir = (estado?: string) => {
        if (estado === "complete") fim();
        else if (estado === "interrupted") fim(falha("o navegador interrompeu"));
      };
      const ouvir = (d: { id: number; state?: { current?: string } }) => {
        if (d.id === id) conferir(d.state?.current);
      };
      const prazo = setTimeout(() => fim(falha("passou de 60 segundos")), PRAZO);
      api.onChanged.addListener(ouvir);
      // Arquivo pequeno pode terminar antes de o ouvinte existir.
      void api.search({ id }).then(([item]) => conferir(item?.state), () => undefined);
    });
    const [item] = await api.search({ id });
    if (!item?.filename) throw new Error("O navegador não informou onde o arquivo foi salvo.");
    return { id, caminho: item.filename, tamanho: item.fileSize > 0 ? item.fileSize : a.bytes.length, tipo: item.mime || a.tipo };
  } finally {
    (o.soltar ?? ((u) => URL.revokeObjectURL(u)))(url);
  }
}

export async function listarBaixados(armazem: Armazem = armazemPadrao()): Promise<Baixado[]> {
  try {
    const lista = (await armazem.get(CHAVE))[CHAVE];
    return Array.isArray(lista) ? (lista as Baixado[]).filter((b) => b && typeof b.caminho === "string" && typeof b.id === "number") : [];
  } catch {
    return [];
  }
}

/** Mesmo caminho baixado de novo: o arquivo foi sobrescrito, e o registro também. */
export async function registrarBaixado(b: Baixado, armazem: Armazem = armazemPadrao()): Promise<Baixado[]> {
  const lista = [...(await listarBaixados(armazem)).filter((x) => x.caminho !== b.caminho), b].slice(-MAX_REGISTROS);
  await armazem.set({ [CHAVE]: lista });
  return lista;
}

/**
 * Apaga do disco o que o agente baixou e esvazia o registro.
 *
 * `ausentes`: o que o navegador já não tinha como apagar — arquivo movido ou
 * apagado à mão, ou histórico de downloads limpo.
 */
export async function apagarBaixados(
  armazem: Armazem = armazemPadrao(),
  api: ApiDownloads | undefined = undefined,
  /** `null`: sem acesso aos downloads (só nos testes; o padrão pergunta ao navegador). */
  acesso: ApiDownloads | null | undefined = api ?? apiPadrao() ?? null,
): Promise<{ apagados: number; ausentes: number }> {
  const lista = await listarBaixados(armazem);
  if (!lista.length) return { apagados: 0, ausentes: 0 };
  // Sem o chrome.downloads não há como apagar; esvaziar o registro seria
  // esquecer arquivos que continuam no disco.
  if (!acesso) throw new Error('Sem a permissão de downloads o SEI Pro não consegue apagar os arquivos. Clique em "Permitir downloads" e tente de novo.');
  api = acesso;
  let apagados = 0;
  let ausentes = 0;
  for (const b of lista) {
    try {
      const [item] = await api.search({ id: b.id });
      // O id pode ter passado a apontar para OUTRO download (histórico limpo
      // e ids reaproveitados): só se mexe no que ainda é o arquivo registrado.
      if (!item || item.filename !== b.caminho) {
        ausentes += 1;
        continue;
      }
      if (item.exists === false) throw new Error("ausente");
      await api.removeFile(b.id);
      apagados += 1;
    } catch {
      ausentes += 1;
    }
    await Promise.resolve(api.erase({ id: b.id })).catch(() => undefined);
  }
  await armazem.set({ [CHAVE]: [] });
  return { apagados, ausentes };
}

const megas = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;

export interface OpcoesSecaoBaixados {
  listar(): Promise<Baixado[]>;
  apagar(): Promise<{ apagados: number; ausentes: number }>;
  /** Sem a permissão, a seção oferece o botão de concedê-la. */
  permitido?(): Promise<boolean>;
  pedirPermissao?(): Promise<boolean>;
}

/** A linha da configuração: quantas cópias existem e o botão de apagá-las. */
export function secaoBaixados(o: OpcoesSecaoBaixados): { elemento: HTMLElement; atualizar: () => Promise<void> } {
  const texto = h("span", {}, "");
  const status = h("div", { class: "status" });
  const apagar = h("button", {}, "Apagar arquivos baixados");
  const permitir = h("button", { hidden: true }, "Permitir downloads");

  const atualizar = async () => {
    const lista = await o.listar();
    const total = lista.reduce((n, b) => n + (b.tamanho || 0), 0);
    texto.textContent = lista.length
      ? `${lista.length} arquivo${lista.length > 1 ? "s" : ""} (${megas(total)}) em Downloads/SEI Pro`
      : "Nenhum arquivo baixado pelo agente.";
    if (lista.length) apagar.removeAttribute("disabled");
    else apagar.setAttribute("disabled", "");
    permitir.hidden = o.permitido ? await o.permitido() : true;
  };

  apagar.addEventListener("click", () => {
    void (async () => {
      let r: { apagados: number; ausentes: number };
      try {
        r = await o.apagar();
      } catch (e) {
        status.className = "status erro";
        status.textContent = (e as Error).message;
        await atualizar();
        return;
      }
      await atualizar();
      status.className = "status ok";
      status.textContent =
        `${r.apagados} apagado${r.apagados === 1 ? "" : "s"}.` +
        (r.ausentes ? ` ${r.ausentes} já não estava${r.ausentes === 1 ? "" : "m"} ao alcance do navegador: se ainda existir${r.ausentes === 1 ? "" : "em"}, apague na pasta Downloads/SEI Pro.` : "");
    })();
  });
  permitir.addEventListener("click", () => {
    void (async () => {
      const ok = (await o.pedirPermissao?.()) ?? false;
      status.className = ok ? "status ok" : "status erro";
      status.textContent = ok ? "Downloads permitidos." : "O navegador não deu a permissão.";
      await atualizar();
    })();
  });

  const elemento = h(
    "div",
    { class: "campo" },
    h("label", {}, "Arquivos baixados pelo agente"),
    h("div", { class: "ajuda" }, "Quando um conector precisa do arquivo em disco, o agente salva uma cópia do documento do SEI na pasta Downloads, sempre com a sua aprovação. A cópia tem os dados reais, sem máscara."),
    h("div", { class: "com-botao" }, apagar, permitir, texto),
    status,
    h("div", { class: "nota" }, icone("escudo", 15), h("span", {}, "Apagar remove os arquivos do computador; os documentos continuam no SEI.")),
  );
  void atualizar();
  return { elemento, atualizar };
}
