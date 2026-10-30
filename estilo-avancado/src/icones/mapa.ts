/**
 * Qual desenho novo entra no lugar de cada ícone nativo do SEI (e do SEI Pro). A chave é o trecho do
 * `src` da imagem; o contexto diz onde ela aparece, porque o tamanho do ícone e o respiro mudam
 * (menu 24 px, barra superior 24 px, barras de ações 40 px, linhas de tabela 24 px).
 */
/** Tons semânticos (tokens --spro-tom-*, com variante clara e escura): a cor diferencia a função, como no SEI original. */
export type Tom = "perigo" | "azul" | "verde" | "ambar" | "laranja" | "roxo" | "rosa" | "ciano";

export type ContextoIcone = "menu" | "topo" | "barra" | "tabela";

export interface EntradaIcone {
  /** Trecho do `src` (casa com `img[src*="..."]`). */
  src: string;
  /** Nome no conjunto dos painéis (`ICONES`) ou em `ICONES_EXTRAS`. */
  icone: string;
  contexto: ContextoIcone;
  /** Seletor próprio (relativo ao escopo do contexto), para quem não tem um arquivo reconhecível no src (PNG embutido). */
  seletor?: string;
  /** Só aceita imagens da própria extensão (`src` começando por chrome-extension). */
  daExtensao?: boolean;
  /** Cor semântica do ícone; sem isto ele herda a cor do contexto. */
  tom?: Tom;
  /** Desenho multicolor próprio (proprios.ts), usado como o conteúdo da imagem em vez da máscara de uma cor. */
  proprio?: boolean;
}

const m = (src: string, icone: string): EntradaIcone => ({ src: `menu/${src}.svg`, icone, contexto: "menu" });
const t = (src: string, icone: string): EntradaIcone => ({ src: `${src}.svg`, icone, contexto: "topo" });
const tb = (src: string, icone: string, extra: Partial<EntradaIcone> = {}): EntradaIcone => ({
  src: `svg/${src}.svg`,
  icone,
  contexto: "tabela",
  ...extra,
});
const b = (src: string, icone: string, extra: Partial<EntradaIcone> = {}): EntradaIcone => ({
  src: `${src}.svg`,
  icone,
  contexto: "barra",
  ...extra,
});

export const MAPA_ICONES: EntradaIcone[] = [
  // Menu lateral
  m("acompanhamento_especial", "olho"),
  m("administracao", "engrenagem"),
  m("base_conhecimento", "livro"),
  m("blocos", "camadas"),
  m("contatos", "pessoas"),
  m("controle_prazo", "relogio"),
  m("controle_processos", "lista"),
  m("favoritos", "estrela"),
  m("grupos", "pessoas"),
  m("iniciar_processo", "pastaMais"),
  m("inspecao_administrativa", "escudoCheck"),
  m("marcadores", "etiqueta"),
  m("painel_controle", "painel"),
  m("pesquisa", "busca"),
  m("pontos_controle", "bandeira"),
  m("processos_sobrestados", "pausa"),
  m("reabertura_programada", "historico"),
  m("relatorios", "planilha"),
  m("retorno_programado", "retorno"),
  m("texto_padrao", "documento"),
  m("infra", "codigo"),
  // Barra superior
  t("menu_pontos_topo", "menu"),
  t("pesquisa_rapida", "busca"),
  t("controle_processos_barra", "lista"),
  t("painel_controle_barra", "painel"),
  t("novidades", "megafone"),
  t("acessibilidade_topo", "acessibilidade"),
  t("configuracao", "engrenagem"),
  t("usuario_topo", "pessoa"),
  t("sair", "saida"),
  // Barras de ações: os ícones nativos do SEI ficam como são (o Agente de IA, o Estúdio de Fluxo e o Monitorados também).
  // Só os botões do SEI Pro abaixo ganham desenho próprio, multicolor como os nativos (ver proprios.ts).
  b("ferramentas_pdf", "pdf", { daExtensao: true, proprio: true }),
  b("acao_lote", "camadas", { daExtensao: true, proprio: true }),
  b("doc_lote", "documentos", { daExtensao: true, proprio: true }),
  b("compare_doc", "comparar", { daExtensao: true, proprio: true }),
  // Historico de Processos Visitados na barra de acoes: icone embutido (data URI) com a marca <!--spro-historico-->
  { src: "spro-historico", icone: "historico", contexto: "barra", proprio: true },
  // Gerar Certidao de Documento Oficial: botao do SEI Pro com PNG embutido, so se acha pelo id do link
  { src: "#iconDocCertidao", seletor: "a#iconDocCertidao > img", icone: "certidao", contexto: "barra", proprio: true },
  // Ações das linhas das tabelas (consultar, alterar, desativar, excluir...) e paginação
  tb("consultar", "olho"),
  tb("pre_visualizar", "olho"),
  tb("alterar", "lapis"),
  tb("desativar", "desativar"),
  tb("excluir", "lixeira", { tom: "perigo" }),
  tb("clonar", "duplicar"),
  tb("valores", "lista"),
  tb("historico", "historico"),
  tb("check", "check"),
  tb("federacao", "mapa"),
  tb("paginacao_anterior", "paginaAnterior"),
  tb("paginacao_proxima", "seta"),
  tb("paginacao_primeira", "paginaPrimeira"),
  tb("paginacao_ultima", "paginaUltima"),
];

/**
 * Itens que o SEI Pro injeta no menu lateral: não são <img> e sim <svg> inline com glifo preenchido,
 * então a troca é pelo id do link (o desenho vira a máscara do próprio <svg>).
 */
export const MAPA_MENU_PRO: { id: string; icone: string }[] = [
  { id: "seiProAgenteMenu", icone: "robo" },
  { id: "pesquisaLinkPermanentePro", icone: "link" },
  { id: "historicoProcessosPro", icone: "historico" },
  { id: "ferramentasPdfPro", icone: "pdf" },
  { id: "processosLotePro", icone: "camadas" },
];
