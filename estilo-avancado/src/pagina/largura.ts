/**
 * Largura do documento na visualização: papel estreito (padrão, simula a página) ou 100% do contêiner.
 * A visualização do SEI é uma tela (`arvore_visualizar`, onde mora o link "Abrir documento em nova aba") que
 * embute o documento (`documento_visualizar`) num iframe da mesma origem. A escolha fica no localStorage do SEI
 * e chega ao iframe pelo evento `storage`, sem as duas telas se conhecerem.
 */

export const CHAVE_LARGURA = "spro_papel_largo";
export const ATRIBUTO_LARGO = "data-spro-papel-largo";
export const CLASSE_BOTAO = "spro-largura";
const ROTULO_ESTREITO = "Largura total";
const ROTULO_LARGO = "Largura de página";
const DICA_ESTREITO = "Usar toda a largura da visualização";
const DICA_LARGO = "Voltar à largura de página";
const ALVO = "a.openNewTab";

type Armazem = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function lerLargo(armazem: Pick<Storage, "getItem">): boolean {
  try {
    return armazem.getItem(CHAVE_LARGURA) === "1";
  } catch {
    return false;
  }
}

function gravarLargo(armazem: Armazem, largo: boolean): void {
  try {
    if (largo) armazem.setItem(CHAVE_LARGURA, "1");
    else armazem.removeItem(CHAVE_LARGURA);
  } catch {
    /* sem storage: vale só nesta tela */
  }
}

export function aplicarLargura(doc: Document, largo: boolean): void {
  if (largo) doc.documentElement.setAttribute(ATRIBUTO_LARGO, "");
  else doc.documentElement.removeAttribute(ATRIBUTO_LARGO);
}

/** No documento: aplica a largura escolhida e acompanha a mudança feita pelo botão na tela de fora. */
export function iniciarLarguraDoPapel(doc: Document, armazem: Armazem): () => void {
  aplicarLargura(doc, lerLargo(armazem));
  const visao = doc.defaultView;
  const aoMudar = (ev: Event) => {
    const chave = (ev as StorageEvent).key;
    if (chave === null || chave === CHAVE_LARGURA) aplicarLargura(doc, lerLargo(armazem));
  };
  visao?.addEventListener("storage", aoMudar);
  return () => {
    visao?.removeEventListener("storage", aoMudar);
    doc.documentElement.removeAttribute(ATRIBUTO_LARGO);
  };
}

export const CLASSE_ACAO = "spro-doc-acao";
export const CLASSE_GRUPO = "spro-doc-acoes";
export const ATRIBUTO_ROTULO = "data-spro-rotulo";
/** No grupo: marca a rolagem do documento; o CSS some com os rótulos e deixa só os ícones. */
export const ATRIBUTO_COMPACTO = "data-spro-compacto";
/** No grupo: o iframe da visualização não mostra um documento (formulário, capa do processo...); o CSS esconde o grupo. */
export const ATRIBUTO_SEM_DOCUMENTO = "data-spro-sem-documento";
const LIMITE_ROLAGEM = 16;

/**
 * O iframe da visualização está mostrando um documento (interno ou externo)? O SEI Pro cria "Abrir em nova aba" e os de
 * baixar quando o nó selecionado da árvore é um documento, e ele continua selecionado quando o usuário abre um formulário
 * (Incluir em Bloco, Enviar Processo...) naquele iframe: aí os botões não têm o que abrir nem baixar. Sem iframe, ou com
 * um que não dá para ler (outra origem), vale "sim": só some quando se sabe que a tela não é de documento.
 */
export function iframeMostraDocumento(doc: Document): boolean {
  const iframe = doc.querySelector<HTMLIFrameElement>("iframe#ifrVisualizacao, iframe[name=ifrVisualizacao]");
  if (!iframe) return true;
  try {
    const dentro = iframe.contentWindow?.location;
    if (!dentro) return true;
    return /[?&]acao=documento_visualizar\b/.test(dentro.search);
  } catch {
    return true;
  }
}

/** Rótulo curto de um botão só de ícone, a partir do tooltip do SEI Pro ("Baixar documento (DOCX)" -> "Baixar DOCX"). */
export function rotuloDoBotao(tooltip: string): string {
  const m = /Baixar documento \(([^)]+)\)/i.exec(tooltip);
  return m ? `Baixar ${m[1]}` : "";
}

/**
 * Na tela da visualização: o grupo de botões no canto do documento. O SEI Pro põe "Abrir documento em nova aba" e
 * os de baixar (HTML, DOCX) em posição absoluta, cada um com a sua margem; aqui eles entram num grupo só, em linha,
 * com o botão de largura na frente e o mesmo estilo. Os que só têm ícone ganham rótulo. O botão de largura alterna
 * o papel estreito e a largura total e avisa também o iframe do documento (que ouve o `storage` só quando a mudança
 * vem de OUTRO documento).
 */
export function iniciarBotaoLargura(doc: Document, armazem: Armazem): () => void {
  let botao: HTMLButtonElement | null = null;
  let grupo: HTMLElement | null = null;
  let largo = lerLargo(armazem);

  const rotular = () => {
    if (!botao) return;
    botao.textContent = largo ? ROTULO_LARGO : ROTULO_ESTREITO;
    botao.setAttribute("aria-pressed", String(largo));
    botao.title = largo ? DICA_LARGO : DICA_ESTREITO;
  };

  const criarBotao = (): HTMLButtonElement => {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = `${CLASSE_BOTAO} ${CLASSE_ACAO}`;
    b.addEventListener("click", () => {
      largo = !largo;
      gravarLargo(armazem, largo);
      for (const f of doc.querySelectorAll("iframe")) {
        try {
          if (f.contentDocument) aplicarLargura(f.contentDocument, largo);
        } catch {
          /* iframe de outra origem */
        }
      }
      rotular();
    });
    return b;
  };

  /** Rolagem do documento (no iframe) ou da própria tela: rolou, os botões ficam só com o ícone. */
  const ligados = new WeakSet<object>();
  const compactar = (rolou: boolean) => {
    if (!grupo) return;
    if (rolou) grupo.setAttribute(ATRIBUTO_COMPACTO, "");
    else grupo.removeAttribute(ATRIBUTO_COMPACTO);
  };
  const topoDe = (alvo: EventTarget | null): number => {
    const el = alvo as { scrollingElement?: Element | null; scrollTop?: number; documentElement?: Element } | null;
    return el?.scrollingElement?.scrollTop ?? el?.documentElement?.scrollTop ?? el?.scrollTop ?? 0;
  };
  const vigiarRolagem = () => {
    if (!ligados.has(doc)) {
      ligados.add(doc);
      doc.addEventListener("scroll", (ev) => compactar(topoDe(ev.target) > LIMITE_ROLAGEM), true);
    }
    for (const f of doc.querySelectorAll("iframe")) {
      let dentro: Document | null = null;
      try {
        dentro = f.contentDocument;
      } catch {
        /* outra origem */
      }
      if (!dentro || ligados.has(dentro)) continue;
      ligados.add(dentro);
      compactar(topoDe(dentro) > LIMITE_ROLAGEM);
      dentro.addEventListener("scroll", () => compactar(topoDe(dentro) > LIMITE_ROLAGEM), true);
    }
  };

  const sincronizarVisibilidade = () => {
    if (!grupo) return;
    if (iframeMostraDocumento(doc)) grupo.removeAttribute(ATRIBUTO_SEM_DOCUMENTO);
    else grupo.setAttribute(ATRIBUTO_SEM_DOCUMENTO, "");
  };

  const garantir = () => {
    const ancoras = [...doc.querySelectorAll<HTMLElement>(ALVO)];
    const primeira = ancoras[0];
    if (!primeira?.parentElement) return;
    if (!grupo || !grupo.isConnected) {
      grupo = doc.createElement("div");
      grupo.className = CLASSE_GRUPO;
      primeira.before(grupo);
    }
    if (!botao || !botao.isConnected) {
      botao = criarBotao();
      grupo.prepend(botao);
      rotular();
    }
    for (const a of ancoras) {
      if (a.parentElement !== grupo) grupo.append(a);
      a.classList.add(CLASSE_ACAO);
      if (!a.hasAttribute(ATRIBUTO_ROTULO)) {
        const rotulo = rotuloDoBotao(a.getAttribute("onmouseover") ?? "");
        if (rotulo) a.setAttribute(ATRIBUTO_ROTULO, rotulo);
      }
    }
    sincronizarVisibilidade();
  };

  garantir();
  vigiarRolagem();
  // O iframe troca de documento (e de Document): religa a vigia quando ele termina de carregar.
  const aoCarregar = () => {
    compactar(false);
    vigiarRolagem();
    sincronizarVisibilidade();
  };
  doc.addEventListener("load", aoCarregar, true);
  const Obs = doc.defaultView?.MutationObserver ?? (typeof MutationObserver === "function" ? MutationObserver : null);
  const obs = Obs && doc.body ? new Obs(garantir) : null;
  obs?.observe(doc.body, { childList: true, subtree: true });

  return () => {
    obs?.disconnect();
    doc.removeEventListener("load", aoCarregar, true);
    for (const a of doc.querySelectorAll<HTMLElement>(`.${CLASSE_ACAO}`)) {
      a.classList.remove(CLASSE_ACAO);
      a.removeAttribute(ATRIBUTO_ROTULO);
    }
    if (grupo) {
      // Devolve as âncoras do SEI Pro ao lugar de onde vieram (antes do grupo) e tira o que é nosso.
      for (const a of [...grupo.querySelectorAll(ALVO)]) grupo.before(a);
      grupo.remove();
    }
    botao = null;
    grupo = null;
  };
}
