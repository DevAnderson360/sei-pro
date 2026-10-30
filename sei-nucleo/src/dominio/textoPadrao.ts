/**
 * Armazém de dados num Texto Padrão da unidade (`texto_padrao_interno_*`).
 *
 * Genérico: guarda um HTML sob um nome. Quem usa (os favoritos, os projetos e,
 * no futuro, a Distribuição Automática ou configurações da unidade) decide o
 * formato do conteúdo. Receita provada ao vivo no SEI 4.1.5 e no 5.0.4 (prova
 * P1 do favoritos, `docs/superpowers/specs/2026-10-01-favoritos-provas.md`):
 * - a lista vem do link do MENU (o hash é da sessão; nada de montar URL);
 * - consultar e alterar pelos links da própria linha;
 * - criar pela URL do botão "Novo" da lista;
 * - excluir como a função `acaoExcluir` da página: `hdnInfraItemId` no
 *   formulário da lista, postado no link assinado que está no script;
 * - o conteúdo vai em `txaConteudo` como HTML, e o sucesso é provado pela
 *   volta à lista. No SEI 5 o `<textarea>` não tem id: lê-se pelo `name`.
 *
 * Texto que é de todos (o da unidade nos Projetos):
 * - ler só precisa do link de consultar (quem não pode alterar ainda lê);
 *   gravar sem o link de alterar é recusado (nunca cadastra um segundo texto);
 * - `gravarConferindo` lê o conteúdo no PRÓPRIO formulário de alterar, logo
 *   antes de postar, e só posta se ele ainda é o lido (senão devolve o atual).
 *   A consulta e o formulário de alterar são lidos do mesmo jeito (o
 *   `textContent` do `txaConteudo`): sem carga, quem compara usa o HTML cru, e
 *   dois caminhos diferentes nunca deixariam regravar um texto inválido;
 * - dois usuários criando ao mesmo tempo: o de menor id é o texto; quem ficou
 *   com o outro apaga o seu e mescla o do colega;
 * - com duplicata antiga na lista, todos leem e gravam o de menor id.
 */

import { Formulario, urlContem } from "../formulario/formulario";
import type { Sei } from "../sei";
import { ErroSei, ehErroSei } from "../sessao/erros";
import type { OpcoesHttp, Pagina } from "../sessao/http";

export interface TextoLocalizado {
  id: string;
  consultar: string;
  /** Ausente quando o SEI não deixa este usuário alterar o texto (ele só lê). */
  alterar?: string;
}

/** O que o motor da sincronia sabe do texto lido (mesma forma da `ConferenciaTexto` do sei-comum). */
export interface ConferenciaGravacao {
  /** O conteúdo da última leitura (null: o texto não existia). */
  anterior: string | null;
  /** A mesma carga? Quem chama sabe comparar (o escape a mais do SEI 5 não conta). */
  mesmo(a: string | null, b: string | null): boolean;
}

/** `gravado: false`: o texto não era mais o `anterior`; `atual` é o que ele tem agora (null: sumiu). */
export type ResultadoGravacao = { gravado: true } | { gravado: false; atual: string | null };

export interface ArmazemTextoPadrao {
  localizar(op?: OpcoesHttp): Promise<TextoLocalizado | null>;
  /** O HTML guardado (já sem o escape do `<textarea>`), ou null se o texto não existe. */
  ler(op?: OpcoesHttp): Promise<string | null>;
  gravar(html: string, op?: OpcoesHttp): Promise<void>;
  /** Grava só se o texto ainda é o `anterior` (conferido no formulário de alterar); senão devolve o atual. */
  gravarConferindo(html: string, c: ConferenciaGravacao, op?: OpcoesHttp): Promise<ResultadoGravacao>;
  /** true se havia o texto e ele foi excluído. */
  excluir(op?: OpcoesHttp): Promise<boolean>;
}

const FORM_CADASTRO = "#frmTextoPadraoInternoCadastro";
const FORM_LISTA = "#frmTextoPadraoInternoLista";
const TEXTAREA = 'textarea[name="txaConteudo"], #txaConteudo';
/** Um teto para a paginação: nenhuma unidade tem tantos textos, e um laço sem fim travaria a aba. */
const MAX_PAGINAS = 40;

const desfazerAmp = (s: string | null | undefined) => (s ?? "").replace(/&amp;/g, "&");
/** Menor id primeiro, pelo número (o "1000" vem depois do "960"). */
const porId = (a: TextoLocalizado, b: TextoLocalizado) => Number(a.id) - Number(b.id);
/** O conteúdo do texto numa tela (consultar ou alterar): sempre o `textContent` do `txaConteudo`. */
const conteudoNa = (p: Pagina): string => p.doc.querySelector(TEXTAREA)?.textContent ?? "";

/** O que o armazém usa do `Sei`: o HTTP da sessão e o link do menu (o content script dos Projetos monta só isso). */
export type SeiDoTexto = Pick<Sei, "http" | "linkMenu">;

export function criarArmazemTextoPadrao(sei: SeiDoTexto, o: { nome: string; descricao: string }): ArmazemTextoPadrao {
  const validar = () => {
    if (!o.nome.trim() || o.nome.length > 50) throw new ErroSei("ARGUMENTO_INVALIDO", "O nome do texto padrão deve ter de 1 a 50 caracteres.");
    if (o.descricao.length > 300) throw new ErroSei("ARGUMENTO_INVALIDO", "A descrição do texto padrão passa de 300 caracteres.");
  };

  const linhasNa = (p: Pagina) =>
    [...p.doc.querySelectorAll("table.infraTable tr")].filter((tr) =>
      [...tr.querySelectorAll("td")].some((td) => (td.textContent ?? "").trim() === o.nome),
    );

  const daLinha = (tr: Element): TextoLocalizado | null => {
    const id =
      tr.querySelector('input[type="checkbox"]')?.getAttribute("value") ??
      /acaoExcluir\(\s*['"](\d+)/.exec(tr.querySelector('a[onclick*="acaoExcluir"]')?.getAttribute("onclick") ?? "")?.[1];
    const consultar = desfazerAmp(tr.querySelector('a[href*="acao=texto_padrao_interno_consultar"]')?.getAttribute("href"));
    const alterar = desfazerAmp(tr.querySelector('a[href*="acao=texto_padrao_interno_alterar"]')?.getAttribute("href"));
    if (!id || !consultar) return null;
    return alterar ? { id, consultar, alterar } : { id, consultar };
  };

  /**
   * Percorre a lista (todas as páginas) até achar o texto. Devolve a página em que achou (ou a
   * última lida), a primeira (o botão "Novo") e todas as linhas com o nome nessa página (menor id
   * primeiro): o achado é sempre o de menor id. Linha com o nome mas sem id ou sem o link de
   * consultar: o texto existe e não serve a este usuário; tratá-lo como ausente cadastraria outro.
   */
  const percorrer = async (
    op?: OpcoesHttp,
  ): Promise<{ pagina: Pagina; primeira: Pagina; achado: TextoLocalizado | null; todos: TextoLocalizado[] }> => {
    validar();
    const primeira = await sei.http.obter(sei.linkMenu("texto_padrao_interno_listar"), op);
    let pagina = primeira;
    for (let n = 0; n < MAX_PAGINAS; n++) {
      const linhas = linhasNa(pagina);
      const todos = linhas
        .map(daLinha)
        .filter((t): t is TextoLocalizado => t !== null)
        .sort(porId);
      if (todos.length) return { pagina, primeira, achado: todos[0] ?? null, todos };
      if (linhas.length) throw new ErroSei("SEI_ACAO_INDISPONIVEL", `O texto padrão "${o.nome}" está na lista, mas o SEI não oferece a você consultá-lo nesta unidade.`);
      // Há próxima página? O infra só desenha o "+" quando há.
      if (!/infraAcaoPaginar\(\s*['"]\+['"]/.test(pagina.html)) break;
      pagina = await Formulario.de(pagina, FORM_LISTA, sei.http)
        .definir({ hdnInfraPaginaAtual: String(n + 1) })
        .enviar(op);
    }
    return { pagina, primeira, achado: null, todos: [] };
  };

  const conteudoDe = async (t: TextoLocalizado, op?: OpcoesHttp): Promise<string> => conteudoNa(await sei.http.obter(t.consultar, op));

  const opEnvio = (op?: OpcoesHttp) => ({ ...op, modos: { txaConteudo: "html" as const }, sucesso: urlContem("texto_padrao_interno_listar") });

  const abrirAlterar = async (t: TextoLocalizado, op?: OpcoesHttp): Promise<Formulario> => {
    if (!t.alterar) throw new ErroSei("SEI_ACAO_INDISPONIVEL", "O SEI não permite a você alterar este texto padrão nesta unidade.");
    return Formulario.abrir(sei.http, t.alterar, FORM_CADASTRO, op);
  };

  const postarAlteracao = async (f: Formulario, html: string, op?: OpcoesHttp): Promise<void> => {
    await f.definir({ txaConteudo: html }).enviar({ ...opEnvio(op), botao: "sbmAlterarTextoPadraoInterno", operacao: "a alteração do texto padrão" });
  };

  const criar = async (primeira: Pagina, html: string, op?: OpcoesHttp): Promise<void> => {
    const novo = desfazerAmp(/location\.href\s*=\s*'([^']+)'/.exec(primeira.doc.querySelector("#btnNovo")?.getAttribute("onclick") ?? "")?.[1]);
    if (!novo) throw new ErroSei("SEI_ACAO_INDISPONIVEL", "O SEI não permite a você criar textos padrão nesta unidade.");
    const f = await Formulario.abrir(sei.http, novo, FORM_CADASTRO, op);
    await f
      .definir({ txtNome: o.nome, txtDescricao: o.descricao, txaConteudo: html })
      .enviar({ ...opEnvio(op), botao: "sbmCadastrarTextoPadraoInterno", operacao: "o cadastro do texto padrão" });
  };

  const excluirNa = async (pagina: Pagina, id: string, op?: OpcoesHttp): Promise<void> => {
    const url = desfazerAmp(/['"](controlador\.php\?acao=texto_padrao_interno_excluir[^'"]+)['"]/.exec(pagina.html)?.[1]);
    if (!url) throw new ErroSei("SEI_ACAO_INDISPONIVEL", "O SEI não oferece a exclusão de textos padrão para você nesta unidade.");
    const form = Formulario.de(pagina, FORM_LISTA, sei.http).definir({ hdnInfraItemId: id });
    await sei.http.enviar(url, form.pares(), { ...op, aceitarValidacao: true });
  };

  /**
   * Depois de criar: dois usuários criando juntos deixam duas linhas com o nome. O de menor id é o
   * texto. Se o nosso não é ele, o nosso sai (só o que tem o nosso conteúdo) e o conteúdo do outro
   * volta para a próxima mescla. A exclusão é faxina, não pré-condição (todos leem e gravam o de
   * menor id): sem o link de excluir, o nosso fica na lista e a mescla segue.
   */
  const conferirDuplicata = async (html: string, c: ConferenciaGravacao, op?: OpcoesHttp): Promise<ResultadoGravacao> => {
    const { todos, pagina } = await percorrer(op);
    const [principal, ...outros] = todos;
    if (!principal || !outros.length) return { gravado: true };
    const doPrincipal = await conteudoDe(principal, op);
    if (c.mesmo(doPrincipal, html)) return { gravado: true };
    for (const t of outros) {
      if (!c.mesmo(await conteudoDe(t, op), html)) continue;
      try {
        await excluirNa(pagina, t.id, op);
      } catch (e) {
        if (!(ehErroSei(e) && e.codigo === "SEI_ACAO_INDISPONIVEL")) throw e;
      }
    }
    return { gravado: false, atual: doPrincipal };
  };

  return {
    async localizar(op) {
      return (await percorrer(op)).achado;
    },

    async ler(op) {
      const { achado } = await percorrer(op);
      return achado ? conteudoDe(achado, op) : null;
    },

    async gravar(html, op) {
      const { achado, primeira } = await percorrer(op);
      if (achado) await postarAlteracao(await abrirAlterar(achado, op), html, op);
      else await criar(primeira, html, op);
    },

    async gravarConferindo(html, c, op) {
      const { achado, primeira } = await percorrer(op);
      if (achado) {
        const f = await abrirAlterar(achado, op);
        // O formulário de alterar traz o conteúdo de agora (lido como na consulta): a conferência fica colada no POST.
        const atual = conteudoNa(f.pagina);
        if (!c.mesmo(atual, c.anterior)) return { gravado: false, atual };
        await postarAlteracao(f, html, op);
        return { gravado: true };
      }
      // Existia e sumiu (um colega excluiu): o motor mescla de novo, com nada, antes de recriar.
      if (c.anterior !== null) return { gravado: false, atual: null };
      await criar(primeira, html, op);
      return conferirDuplicata(html, c, op);
    },

    async excluir(op) {
      const { achado, pagina } = await percorrer(op);
      if (!achado) return false;
      await excluirNa(pagina, achado.id, op);
      return true;
    },
  };
}
