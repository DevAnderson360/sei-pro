/**
 * Barra superior com duas alturas: mais alta no topo da página e normal depois de rolar. A rolagem do SEI 4/5 é
 * a da área da direita (`#divInfraAreaTelaD`), que começa logo abaixo da barra: quando a barra encolhe, a área
 * cresce. Por isso há histerese (compacta além de 24 px, volta abaixo de 4 px) e a página só compacta se sobra
 * rolagem suficiente, para o encolhimento não tirar a própria rolagem e fazer a barra oscilar.
 * O CSS (casca.css) lê `data-spro-nav-compacta` e mexe nas alturas; a barra de ações fixa acompanha pelo `top`.
 */

export const ATRIBUTO_COMPACTA = "data-spro-nav-compacta";
/** Onde o nome do órgão fica guardado para o CSS mostrar junto da logo. */
export const ATRIBUTO_ORGAO = "data-spro-orgao";
/** Onde a barra superior realmente termina (px, medido): a barra de ações fixa gruda nesse valor, sem depender de conta. */
export const VAR_FIM = "--spro-nav-fim";
const ROLADOR = "#divInfraAreaTelaD";
const LIMITE_COMPACTAR = 24;
const LIMITE_EXPANDIR = 4;
/** Altura extra da barra expandida (igual ao `--spro-nav-extra` do CSS) mais uma folga. */
const FOLGA = 14 + 40;

export function iniciarNavbarCompacta(doc: Document): () => void {
  const raiz = doc.documentElement;
  let rolador: Element | null = null;
  let ligado = true;
  let observador: ResizeObserver | null = null;
  let medir: () => void = () => {};

  const avaliar = () => {
    if (!rolador) return;
    const topo = rolador.scrollTop;
    const sobra = rolador.scrollHeight - rolador.clientHeight;
    const compacta = raiz.hasAttribute(ATRIBUTO_COMPACTA);
    if (!compacta && topo > LIMITE_COMPACTAR && sobra > FOLGA) raiz.setAttribute(ATRIBUTO_COMPACTA, "");
    else if (compacta && topo <= LIMITE_EXPANDIR) raiz.removeAttribute(ATRIBUTO_COMPACTA);
    else return;
    // Mede já, no mesmo quadro: a barra de ações fixa nasce no mesmo instante e não pode herdar a altura antiga.
    medir();
  };

  const ligar = () => {
    if (!ligado) return;
    rolador = doc.querySelector(ROLADOR);
    if (!rolador || !doc.querySelector("#navInfraBarraNavegacao")) return;
    rolador.addEventListener("scroll", avaliar, { passive: true });
    // O nome do órgão (faixa de cima) também aparece junto da logo quando a barra compacta (CSS, data-spro-orgao).
    const orgao = doc.querySelector("#divInfraBarraSistema > h6.d-md-block")?.textContent?.trim();
    const logo = doc.querySelector("#divInfraBarraSistemaPadraoE > div.align-self-center");
    if (orgao && logo) logo.setAttribute(ATRIBUTO_ORGAO, orgao);
    // Mede a barra a cada mudança de tamanho (inclusive quadro a quadro durante a transição de altura).
    const nav = doc.querySelector("#navInfraBarraNavegacao");
    medir = () => {
      if (nav) raiz.style.setProperty(VAR_FIM, `${nav.getBoundingClientRect().bottom}px`);
    };
    medir();
    if (nav && typeof ResizeObserver === "function") {
      observador = new ResizeObserver(medir);
      observador.observe(nav);
    }
  };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", ligar, { once: true });
  else ligar();

  return () => {
    ligado = false;
    rolador?.removeEventListener("scroll", avaliar);
    observador?.disconnect();
    raiz.removeAttribute(ATRIBUTO_COMPACTA);
    raiz.style.removeProperty(VAR_FIM);
    doc.querySelector(`[${ATRIBUTO_ORGAO}]`)?.removeAttribute(ATRIBUTO_ORGAO);
  };
}
