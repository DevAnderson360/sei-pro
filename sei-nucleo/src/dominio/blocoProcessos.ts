/**
 * Inclusão de PROCESSOS em bloco interno.
 *
 * Não há link na árvore do processo para isso: o caminho do SEI é a tela do
 * Controle de Processos. O usuário marca as caixas das linhas, clica em
 * "Incluir em Bloco", escolhe o bloco na lupa (`bloco_selecionar_processo`) e o
 * `finalizarSelecao` da lupa troca o `action` do `#frmProcedimentoControlar`
 * para `rel_bloco_protocolo_cadastrar` e envia o formulário inteiro. Aqui se faz
 * o mesmo envio, sem a tela: todos os campos como estão (as assinaturas
 * `hdn{Lista}ItensHash` vão intactas), mais a seleção (`hdn{Lista}ItensSelecionados`
 * e a caixa de cada processo) e o `hdnIdBloco`. Comprovado no SEI 5.0.4 do MJ.
 *
 * Só entram processos que estão NA PÁGINA atual do Controle (as caixas da
 * página são o que o SEI aceita na seleção): quem não está nela é
 * "fora-da-pagina", e nunca se marca outro no lugar.
 *
 * Um POST só para todos os processos: se ele falha, falha para todos, e não há
 * o que repetir processo a processo.
 *
 * Substitui no legado: nada — o SEI Pro não incluía processos em bloco.
 */

import { normalizar, Formulario } from "../formulario/formulario";
import { linkDaAcao, parametros } from "../links/links";
import { textoDe } from "../sessao/dom";
import { comoErroSei, ErroSei } from "../sessao/erros";
import type { OpcoesHttp, Pagina } from "../sessao/http";
import type { Sei } from "../sei";

export interface BlocoInterno {
  /** Valor do radio na lupa: é o que vai em `hdnIdBloco`. */
  id: string;
  numero: string;
  descricao: string;
}

/**
 * - `incluido` / `ja-estava`: o processo está no bloco (visto na tela dele).
 * - `fora-da-pagina`: não está na página do Controle; nada foi enviado.
 * - `erro`: com GARANTIA de que nada foi incluído (o SEI recusou com mensagem,
 *   sigiloso, ou o SEI confirmou e a tela inteira do bloco não o mostra).
 * - `nao-confirmado`: o POST pode ter sido gravado (ou a tela do bloco não
 *   deixou conferir); só olhando o bloco se sabe.
 */
export type ResultadoInclusao = {
  idProcedimento: string;
  situacao: "incluido" | "ja-estava" | "fora-da-pagina" | "erro" | "nao-confirmado";
  erro?: string;
};

const FORM_CONTROLE = "#frmProcedimentoControlar";

/** Paginação nativa do infra (o mesmo detector de `blocos.ts`): há uma página seguinte. */
const temPaginaSeguinte = (p: Pagina) => /infraAcaoPaginar\(\s*['"]\+['"]/.test(p.html);

/** Quantas células tem o cabeçalho: linha com outra contagem é de outro desenho. */
function largura(tabela: Element): number {
  const cabecalho = [...tabela.querySelectorAll("tr")].find((tr) => tr.querySelector("th"));
  return cabecalho?.querySelectorAll("th, td").length ?? 0;
}

/** Colunas pelo texto do cabeçalho ("Número", "Tipo", "Descrição"), nunca pela posição. */
function colunas(tabela: Element): Record<string, number> {
  const mapa: Record<string, number> = {};
  const cabecalho = [...tabela.querySelectorAll("tr")].find((tr) => tr.querySelector("th"));
  [...(cabecalho?.querySelectorAll("th, td") ?? [])].forEach((c, i) => {
    const nome = normalizar(textoDe(c)).replace(/[^a-z0-9 ]/g, "").trim();
    if (nome && mapa[nome] === undefined) mapa[nome] = i;
  });
  return mapa;
}

/** Blocos da lupa: só os de tipo "Interno" (a mesma lista traz os de Reunião). */
function lerBlocosDaLupa(pagina: Pagina): BlocoInterno[] {
  const raiz = pagina.doc.querySelector("#frmBlocoLista") ?? pagina.doc;
  const tabela = [...raiz.querySelectorAll("table")].find((t) => {
    const c = colunas(t);
    return (c.numero ?? c.n) !== undefined && c.tipo !== undefined && c.descricao !== undefined;
  });
  if (!tabela) {
    // Lista vazia o SEI mostra sem tabela; tabela sem as colunas esperadas é outra versão.
    if (!raiz.querySelector("input[name=chkInfraItem]")) return [];
    throw new ErroSei("SEI_VERSAO_NAO_SUPORTADA", "A lista de blocos para incluir processos n\u00E3o foi reconhecida.");
  }
  const col = colunas(tabela);
  const n = largura(tabela);
  const blocos: BlocoInterno[] = [];
  let linhas = 0;
  let reconhecidas = 0;
  for (const tr of tabela.querySelectorAll("tr")) {
    const radio = tr.querySelector("input[name=chkInfraItem]");
    const id = radio?.getAttribute("value")?.trim() ?? "";
    if (!id) continue;
    linhas += 1;
    const tds = [...tr.querySelectorAll("td")];
    // Célula a mais ou a menos desalinha as colunas: ler assim trocaria tipo por descrição.
    if (tds.length !== n) continue;
    reconhecidas += 1;
    const celula = (i: number | undefined) => (i === undefined ? "" : textoDe(tds[i]));
    if (normalizar(celula(col.tipo)) !== "interno") continue;
    blocos.push({ id, numero: celula(col.numero ?? col.n) || id, descricao: celula(col.descricao) });
  }
  if (linhas && !reconhecidas) {
    throw new ErroSei("SEI_VERSAO_NAO_SUPORTADA", "As linhas da lista de blocos n\u00E3o t\u00EAm as colunas do cabe\u00E7alho.");
  }
  return blocos;
}

async function abrirControle(sei: Sei, op: OpcoesHttp): Promise<Pagina> {
  return sei.http.obter(sei.linkMenu("procedimento_controlar"), { sinal: op.sinal, aceitarValidacao: true });
}

/** A lupa de blocos pelo link assinado que está no script do Controle (`objLupaBlocoPesquisa`). */
async function abrirLupa(sei: Sei, controle: Pagina, op: OpcoesHttp): Promise<{ pagina: Pagina; blocos: BlocoInterno[]; paginada: boolean }> {
  const link =
    linkDaAcao(controle.html, "bloco_selecionar_processo", { id_object: "objLupaBlocoPesquisa" }) ??
    linkDaAcao(controle.html, "bloco_selecionar_processo");
  if (!link) throw new ErroSei("SEI_ACAO_INDISPONIVEL", "O Controle de Processos n\u00E3o oferece incluir processos em bloco para este usu\u00E1rio.");
  const pagina = await sei.http.obter(link, { sinal: op.sinal, aceitarValidacao: true });
  return { pagina, blocos: lerBlocosDaLupa(pagina), paginada: temPaginaSeguinte(pagina) };
}

/**
 * Blocos internos que a unidade oferece para receber processos (a lupa do
 * Controle). A lupa paginada não é percorrida (o formulário dela não foi visto
 * paginando num SEI real): falha alto em vez de devolver uma lista cortada.
 */
export async function listarBlocosInternosParaProcessos(sei: Sei, op: OpcoesHttp = {}): Promise<BlocoInterno[]> {
  const lupa = await abrirLupa(sei, await abrirControle(sei, op), op);
  if (lupa.paginada) {
    throw new ErroSei("SEI_VERSAO_NAO_SUPORTADA", "A lista de blocos tem mais de uma p\u00E1gina: use o Controle de Processos para escolher o bloco.");
  }
  return lupa.blocos;
}

interface NaPagina {
  lista: string;
  /** Nome da caixa (`chkGeradosItem2`). */
  campo: string;
  /** Número do processo, para achá-lo na tela do bloco. */
  protocolo: string;
}

/**
 * Processos marcáveis da página: as caixas `chk{Lista}Item<N>` de cada lista
 * declarada em `hdnInfraSelecoes` ("Recebidos,Gerados"; "Detalhado" na
 * visualização detalhada). Um id em duas listas fica com a primeira.
 */
function processosDaPagina(form: Formulario): { listas: string[]; mapa: Map<string, NaPagina> } {
  const doc = form.pagina.doc;
  const declaradas = (form.valor("hdnInfraSelecoes") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const listas = (declaradas.length ? declaradas : ["Recebidos", "Gerados"]).filter((l) => /^\w+$/.test(l));
  const mapa = new Map<string, NaPagina>();
  for (const lista of listas) {
    if (!form.tem(`hdn${lista}ItensSelecionados`)) continue;
    const padrao = new RegExp(`^chk${lista}Item\\d+$`);
    for (const chk of doc.querySelectorAll(`${FORM_CONTROLE} input[type=checkbox]`)) {
      const campo = chk.getAttribute("name") ?? "";
      const id = chk.getAttribute("value")?.trim() ?? "";
      if (!padrao.test(campo) || !id || mapa.has(id) || chk.hasAttribute("disabled")) continue;
      const linha = chk.closest("tr");
      const protocolo = chk.getAttribute("title")?.trim() || textoDe(linha?.querySelector("a[class^=processo]"));
      mapa.set(id, { lista, campo, protocolo });
    }
  }
  return { listas, mapa };
}

/**
 * Linhas de processo da tela do bloco, só as que têm as colunas do cabeçalho.
 * `null` quando a tela tem linhas mas nenhuma reconhecível (outro desenho);
 * bloco vazio (sem tabela, ou tabela sem linhas) dá lista vazia.
 */
function linhasDoBloco(pagina: Pagina): Element[] | null {
  const tabela =
    pagina.doc.querySelector("#tblProtocolosBlocos") ?? [...pagina.doc.querySelectorAll("table")].find((t) => colunas(t).processo !== undefined);
  if (!tabela) return pagina.doc.querySelector("input[type=checkbox][name^=chkInfraItem]") ? null : [];
  const n = largura(tabela);
  const dados = [...tabela.querySelectorAll("tr")].filter((tr) => tr.querySelector("td"));
  const certas = dados.filter((tr) => tr.querySelectorAll("td").length === n);
  return dados.length && !certas.length ? null : certas;
}

/**
 * O processo aparece entre as linhas do bloco? Pelo `id_procedimento` de algum
 * link da linha ou pelo número do processo numa célula — a tela não tem um id
 * por linha garantido.
 */
function noBloco(linhas: Element[], id: string, protocolo: string): boolean {
  const doId = new RegExp(`[?&]id_procedimento=${id}(?!\\d)`);
  return linhas.some(
    (tr) =>
      [...tr.querySelectorAll("[href], [onclick]")].some((el) =>
        doId.test(`${el.getAttribute("href") ?? ""} ${el.getAttribute("onclick") ?? ""}`.replace(/&amp;/g, "&")),
      ) || (!!protocolo && [...tr.querySelectorAll("td, a")].some((el) => textoDe(el) === protocolo)),
  );
}

/** Erros que impedem tudo (e que nenhum resultado por processo deve esconder). */
const fatal = (e: ErroSei) => e.codigo === "SEI_SESSAO_EXPIRADA" || e.codigo === "CANCELADO";

/**
 * A tela atual do bloco, para saber quem JÁ está nele antes de postar (o botão
 * clicado duas vezes não duplica nada). O link assinado `rel_bloco_protocolo_listar`
 * não vem garantido no Controle; a lista de blocos internos do menu o traz por
 * linha. Sem link, ou com qualquer falha que não seja de sessão, a conferência
 * é pulada e quem classifica é a tela devolvida pela inclusão.
 */
async function telaDoBloco(sei: Sei, idBloco: string, fontes: Pagina[], op: OpcoesHttp): Promise<Pagina | null> {
  try {
    let link = fontes.map((p) => linkDaAcao(p.html, "rel_bloco_protocolo_listar", { id_bloco: idBloco })).find(Boolean) ?? null;
    if (!link) {
      const internos = await sei.http.obter(sei.linkMenu("bloco_interno_listar"), { sinal: op.sinal, aceitarValidacao: true });
      link = linkDaAcao(internos.html, "rel_bloco_protocolo_listar", { id_bloco: idBloco });
    }
    if (!link) return null;
    const pagina = await sei.http.obter(link, { sinal: op.sinal, aceitarValidacao: true });
    return parametros(pagina.url).get("acao") === "rel_bloco_protocolo_listar" ? pagina : null;
  } catch (e) {
    const erro = comoErroSei(e);
    if (fatal(erro)) throw erro;
    return null;
  }
}

/**
 * Inclui processos num bloco interno, num POST só. Devolve um resultado por id
 * pedido (sem repetição, na ordem pedida). Só lança o que impede tudo: sessão
 * expirada, Controle sem o formulário ou sem a ação, bloco que não está na lista
 * de blocos internos.
 *
 * Contrato de repetição: só `erro` é seguro repetir (nada foi incluído).
 * `nao-confirmado` NÃO se repete às cegas: o usuário confere o bloco, porque o
 * processo pode já estar nele (POST que caiu na rede ou devolveu exceção, URL
 * final diferente da tela do bloco sem mensagem de validação, tela do bloco
 * paginada ou irreconhecível). `incluido` e `ja-estava` não pedem nada;
 * `fora-da-pagina` pede o processo visível no Controle.
 *
 * Exceção: cancelamento (`CANCELADO`) ou sessão expirada DURANTE o POST lançam
 * o erro, sem resultado por processo. O pedido pode ter saído, então quem chama
 * trata todos os ids enviados como `nao-confirmado` (nunca como `erro`).
 */
export async function incluirProcessosEmBlocoInterno(
  sei: Sei,
  idBloco: string,
  idsProcedimento: string[],
  op: OpcoesHttp = {},
): Promise<ResultadoInclusao[]> {
  const alvo = String(idBloco ?? "").trim();
  if (!alvo) throw new ErroSei("ARGUMENTO_INVALIDO", "Informe o bloco interno.");
  const pedidos = [...new Set(idsProcedimento.map((x) => String(x ?? "").trim()).filter(Boolean))];
  if (!pedidos.length) return [];

  const controle = await abrirControle(sei, op);
  const form = Formulario.de(controle, FORM_CONTROLE, sei.http);
  // Link do `finalizarSelecao` da lupa, no script: por isso o HTML cru.
  const link = linkDaAcao(controle.html, "rel_bloco_protocolo_cadastrar");
  if (!link) throw new ErroSei("SEI_ACAO_INDISPONIVEL", "O Controle de Processos n\u00E3o oferece incluir processos em bloco para este usu\u00E1rio.");
  const lupa = await abrirLupa(sei, controle, op);
  const bloco = lupa.blocos.find((b) => b.id === alvo);
  if (!bloco) {
    throw new ErroSei(
      "SEI_NAO_ENCONTRADO",
      lupa.paginada
        ? `O bloco interno ${alvo} n\u00E3o est\u00E1 entre os blocos internos da primeira p\u00E1gina da lista de blocos.`
        : `O bloco interno ${alvo} n\u00E3o est\u00E1 entre os blocos que a unidade pode usar para processos.`,
    );
  }

  const { listas, mapa } = processosDaPagina(form);
  // A tela recusa sigiloso no próprio JavaScript ("Operação não aplicável em processo sigiloso.").
  const sigilosos = new Set((controle.doc.querySelector("#hdnIdSigilosos")?.getAttribute("value") ?? "").split(",").map((x) => x.trim()).filter(Boolean));
  const resultado = new Map<string, ResultadoInclusao>();
  for (const id of pedidos) {
    if (!mapa.has(id)) resultado.set(id, { idProcedimento: id, situacao: "fora-da-pagina" });
    else if (sigilosos.has(id)) resultado.set(id, { idProcedimento: id, situacao: "erro", erro: "Processo sigiloso: n\u00E3o \u00E9 inclu\u00EDdo em bloco por aqui." });
  }

  let pendentes = pedidos.filter((id) => !resultado.has(id));
  if (pendentes.length) {
    const atual = await telaDoBloco(sei, alvo, [controle, lupa.pagina], op);
    if (atual) {
      const linhas = linhasDoBloco(atual);
      // Antes do POST ainda dá para parar sem efeito nenhum.
      if (!linhas) throw new ErroSei("SEI_VERSAO_NAO_SUPORTADA", `A tela do bloco ${bloco.numero} n\u00E3o foi reconhecida; nada foi inclu\u00EDdo.`);
      for (const id of pendentes) {
        if (noBloco(linhas, id, mapa.get(id)?.protocolo ?? "")) resultado.set(id, { idProcedimento: id, situacao: "ja-estava" });
      }
      pendentes = pendentes.filter((id) => !resultado.has(id));
      // Bloco com mais de uma página: o processo pode estar na seguinte, e
      // incluir de novo às cegas duplicaria. Fica para o usuário conferir.
      if (temPaginaSeguinte(atual)) {
        for (const id of pendentes) {
          resultado.set(id, {
            idProcedimento: id,
            situacao: "nao-confirmado",
            erro: `N\u00E3o confirmado: o bloco tem mais de uma p\u00E1gina; confira o bloco ${bloco.numero} antes de incluir.`,
          });
        }
        pendentes = [];
      }
    }
  }
  if (!pendentes.length) return pedidos.map((id) => resultado.get(id) as ResultadoInclusao);

  // Seleção como a tela a deixaria: só as caixas escolhidas (alguma que tenha
  // vindo marcada sai) e a lista escondida de cada lista do Controle.
  for (const [nome] of form.pares()) if (/^chk\w+Item\d+$/.test(nome)) form.definir({ [nome]: null });
  const valores: Record<string, string> = {};
  for (const lista of listas) {
    if (form.tem(`hdn${lista}ItensSelecionados`)) {
      valores[`hdn${lista}ItensSelecionados`] = pendentes.filter((id) => mapa.get(id)?.lista === lista).join(",");
    }
  }
  valores.hdnIdBloco = alvo;
  for (const id of pendentes) {
    const campo = mapa.get(id)?.campo;
    if (campo) valores[campo] = id;
  }
  form.definir(valores);

  const falhar = (situacao: "erro" | "nao-confirmado", mensagem: string) => {
    for (const id of pendentes) resultado.set(id, { idProcedimento: id, situacao, erro: mensagem });
  };
  let resposta: Pagina | null = null;
  try {
    resposta = await sei.http.enviar(link, form.pares(), { sinal: op.sinal, aceitarValidacao: true });
  } catch (e) {
    const erro = comoErroSei(e);
    if (fatal(erro)) throw erro;
    // O pedido saiu: rede caída ou página de exceção não dizem se foi gravado.
    falhar("nao-confirmado", `N\u00E3o confirmado: ${erro.message} Confira o bloco ${bloco.numero} antes de repetir.`);
  }
  if (resposta) {
    const validacao = resposta.doc.querySelector("#txaInfraValidacao")?.textContent?.trim() ?? "";
    const p = parametros(resposta.url);
    const confirmou =
      p.get("acao") === "rel_bloco_protocolo_listar" && p.get("acao_origem") === "rel_bloco_protocolo_cadastrar" && p.get("id_bloco") === alvo;
    if (!confirmou) {
      // Com mensagem de validação o SEI recusou (nada gravado); sem ela, não se sabe.
      if (validacao) falhar("erro", validacao);
      else falhar("nao-confirmado", `N\u00E3o confirmado: o SEI n\u00E3o confirmou a inclus\u00E3o; confira o bloco ${bloco.numero}.`);
    } else {
      const linhas = linhasDoBloco(resposta);
      // Depois do POST não se lança: a inclusão pode ter acontecido, e quem chamou precisa saber de cada processo.
      if (!linhas) falhar("nao-confirmado", `N\u00E3o confirmado: a tela do bloco ${bloco.numero} n\u00E3o foi reconhecida; confira o bloco ${bloco.numero}.`);
      const ausente: ResultadoInclusao = temPaginaSeguinte(resposta)
        ? { idProcedimento: "", situacao: "nao-confirmado", erro: `N\u00E3o confirmado: o bloco tem mais de uma p\u00E1gina; confira o bloco ${bloco.numero}.` }
        : { idProcedimento: "", situacao: "erro", erro: validacao || `O SEI n\u00E3o mostrou o processo no bloco ${bloco.numero} depois da inclus\u00E3o.` };
      for (const id of linhas ? pendentes : []) {
        resultado.set(
          id,
          noBloco(linhas ?? [], id, mapa.get(id)?.protocolo ?? "")
            ? { idProcedimento: id, situacao: "incluido" }
            : { ...ausente, idProcedimento: id },
        );
      }
    }
  }
  return pedidos.map((id) => resultado.get(id) as ResultadoInclusao);
}
