/**
 * Diálogo "Sincronização": o Texto Padrão da unidade e o pessoal, cada um com as TRÊS tabelas (Demandas, Arquivadas,
 * Histórico), o estado e o uso (KB e %) de cada uma, e o arquivo numa pasta da nuvem. Uma tabela em erro mostra o erro
 * dela e as outras seguem como estão. "Sincronizar agora" fica no da unidade; o pessoal liga, desliga e apaga; o da
 * unidade não tem "apagar" (é de todos). Tudo o que vem de fora entra como texto (`h()`).
 */

import { formatarData, hojeISO } from "@comum/datas/dias";
import { h } from "@comum/ui/dom";
import type { Tabela } from "../../modelo/tipos";
import { TABELAS } from "../../sincronia/orquestrador";
import { mensagemDoErro } from "../erros";
import {
  linhaDaTabela,
  ROTULO_TABELA,
  type SituacaoEscopo,
  type SituacaoSincronia,
  type SituacaoTabela,
  tomDaTabela,
  usoDaTabela,
} from "../estadoSincronia";
import { botaoDeAcao, type DepsSecaoArquivo, linhaDeAviso, montarSecaoArquivo } from "./arquivo";

export interface DepsSincronizacao extends DepsSecaoArquivo {
  sigla: string;
  agora(): number;
  /** Relê a situação dos textos (o content script grava o status). */
  situacao(): Promise<SituacaoSincronia>;
  /** A situação mudou com o diálogo aberto: repinta as linhas sem reler. Devolve a desinscrição. */
  aoMudar?(f: (s: SituacaoSincronia) => void): () => void;
  /** "Sincronizar agora": a unidade e, se ligado, o pessoal, pela aba do SEI. */
  sincronizar(): Promise<void>;
  pessoal: {
    /** Pergunta o consentimento; true = ligado. */
    ligar(): Promise<boolean>;
    desligar(): Promise<void>;
    /** Desliga e exclui os textos pessoais do SEI; true = havia texto e ele foi excluído. */
    apagar(): Promise<boolean>;
  };
  baixar(nome: string, conteudo: string, tipo: string): void;
  confirmar(texto: string, rotuloOk?: string): Promise<boolean>;
}

const DIA = 86_400_000;
/** O aviso do texto inválido substituído some depois disso (o motor já regravou; ninguém mais procura o antigo). */
const DIAS_AVISO_SUBSTITUIDO = 30;

function repor(alvo: HTMLElement, ...filhos: Node[]): void {
  const tinhaFoco = alvo.contains(document.activeElement);
  alvo.replaceChildren(...filhos);
  if (tinhaFoco) alvo.querySelector<HTMLElement>("button")?.focus();
}

const dica = (t: string) => h("p", { class: "dem-dica" }, t);

function substituido(t: SituacaoTabela, agora: number, baixar: DepsSincronizacao["baixar"]): HTMLElement | null {
  const s = t.substituido;
  if (!s || agora - s.quando > DIAS_AVISO_SUBSTITUIDO * DIA) return null;
  const dia = hojeISO(new Date(s.quando));
  return h(
    "p",
    { class: "dem-dica dem-sync-substituido" },
    `Em ${formatarData(dia)} o texto de ${ROTULO_TABELA[t.tabela].toLowerCase()} no SEI estava inválido (${s.motivo}) e foi regravado.${s.cortado ? " Ficou guardado só o começo dele, que era grande demais." : ""} `,
    h(
      "button",
      {
        type: "button",
        class: "spro-botao fantasma pequeno",
        "aria-label": `Baixar o texto antigo de ${ROTULO_TABELA[t.tabela].toLowerCase()}`,
        // Texto simples: o HTML de fora, aberto como página, rodaria o que tivesse dentro.
        onclick: () => baixar(`demandas-texto-antigo-${t.tabela}-${dia}.txt`, s.html, "text/plain;charset=utf-8"),
      },
      "Baixar o texto antigo",
    ),
  );
}

/** As três linhas de um escopo (Demandas, Arquivadas, Histórico), com o estado e o uso. */
function linhasDoEscopo(e: SituacaoEscopo, agora: number, baixar: DepsSincronizacao["baixar"]): HTMLElement {
  const itens = TABELAS.map((t: Tabela) => {
    const x = e.tabelas[t];
    const tom = tomDaTabela(e.consentimento, x);
    const uso = usoDaTabela(x);
    const extra = substituido(x, agora, baixar);
    return h(
      "li",
      { class: `dem-sync-tabela dem-sync-${tom}`, "data-tabela": t, "data-estado": tom },
      h("span", { class: "dem-sync-nome", title: x.nome }, ROTULO_TABELA[t]),
      h("span", { class: "dem-sync-estado" }, linhaDaTabela(e.consentimento, x, agora)),
      uso ? h("span", { class: `dem-sync-uso${x.faixa === "normal" ? "" : ` dem-sync-uso-${x.faixa}`}` }, uso) : null,
      extra,
    );
  });
  return h("ul", { class: "dem-sync-tabelas" }, ...itens);
}

export async function montarSincronizacao(d: DepsSincronizacao): Promise<HTMLElement> {
  const avisoUn = linhaDeAviso();
  const avisoEu = linhaDeAviso();
  const dicaUn = dica("");
  const dicaEu = dica("");
  const corpoUn = h("div", { class: "dem-sync-linhas", "data-escopo": "unidade" });
  const corpoEu = h("div", { class: "dem-sync-linhas", "data-escopo": "eu" });
  const acoesEu = h("div", { class: "dem-sync-acoes" });
  let situ: SituacaoSincronia | null = null;

  const apagar = async (pergunta: string) => {
    if (!(await d.confirmar(pergunta, "Apagar"))) return;
    let excluiu: boolean;
    try {
      excluiu = await d.pessoal.apagar();
    } finally {
      // O controle grava "desligado" antes de excluir: mesmo com erro, a seção mostra o estado de agora.
      await pintar();
    }
    avisoEu.avisar(excluiu ? "Os textos pessoais foram apagados do SEI." : "Não havia textos pessoais no SEI.");
  };
  const botoesEu = (s: SituacaoSincronia): HTMLElement[] => {
    const ligar = botaoDeAcao(
      "Ligar…",
      async () => {
        if (await d.pessoal.ligar()) await pintar();
      },
      avisoEu.avisar,
      "spro-botao primario",
    );
    if (s.eu.consentimento === "ligado")
      return [
        botaoDeAcao(
          "Desligar",
          async () => {
            await d.pessoal.desligar();
            await pintar();
          },
          avisoEu.avisar,
        ),
        botaoDeAcao(
          "Desligar e apagar do SEI",
          () => apagar("Apagar do SEI os textos pessoais das demandas e desligar? As demandas continuam neste navegador."),
          avisoEu.avisar,
          "spro-botao perigo",
        ),
      ];
    if (s.eu.consentimento !== "desligado") return [ligar];
    return [
      ligar,
      // Desligado não quer dizer apagado: um texto que ficou no SEI ainda pode ser excluído daqui.
      botaoDeAcao(
        "Apagar os textos do SEI",
        () => apagar("Apagar do SEI os textos pessoais das demandas, se existirem? As demandas continuam neste navegador."),
        avisoEu.avisar,
        "spro-botao perigo",
      ),
    ];
  };
  const desenhar = (erro: string | null) => {
    dicaUn.textContent = `As demandas de “Toda a unidade” ficam em três Textos Padrão (demandas, arquivadas e histórico) que todos da ${d.sigla} com SEI Pro leem e gravam. O número de processo sigiloso não vai.`;
    dicaEu.textContent = "Suas demandas de “Só eu” podem ficar em três Textos Padrão, para você vê-las em outro computador.";
    for (const [vis, corpo] of [
      ["unidade", corpoUn],
      ["eu", corpoEu],
    ] as const) {
      const e = situ?.[vis];
      if (erro) repor(corpo, h("p", { class: "dem-dica dem-sync-erro" }, `Não foi possível ler a situação da sincronia: ${erro}`));
      else if (e) repor(corpo, linhasDoEscopo(e, d.agora(), d.baixar));
    }
    repor(acoesEu, ...(situ ? botoesEu(situ) : []));
  };
  /** Relê (ou usa a situação recebida) e pinta. Nunca lança: a falha vira a linha das seções. */
  async function pintar(nova?: SituacaoSincronia): Promise<void> {
    try {
      situ = nova ?? (await d.situacao());
      desenhar(null);
    } catch (e) {
      desenhar(mensagemDoErro(e));
    }
  }
  await pintar();

  const secoes: HTMLElement[] = [
    h(
      "section",
      { class: "dem-sync-secao", "data-secao": "unidade" },
      h("h3", {}, `Texto Padrão da ${d.sigla}`),
      dicaUn,
      corpoUn,
      h(
        "div",
        { class: "dem-sync-acoes" },
        botaoDeAcao(
          "Sincronizar agora",
          async () => {
            await d.sincronizar();
            await pintar();
          },
          avisoUn.avisar,
        ),
      ),
      avisoUn.el,
    ),
    h(
      "section",
      { class: "dem-sync-secao", "data-secao": "eu" },
      h("h3", {}, "Texto Padrão pessoal"),
      dicaEu,
      corpoEu,
      acoesEu,
      avisoEu.el,
    ),
    await montarSecaoArquivo(d),
  ];

  const raiz = h("div", { class: "dem-form dem-sync" }, ...secoes);
  // Ao vivo: a situação que muda com o diálogo aberto repinta as linhas. Fechado (fora da página), desinscreve na primeira mudança.
  let sair: (() => void) | undefined;
  sair = d.aoMudar?.((s) => {
    if (!raiz.isConnected) {
      sair?.();
      return;
    }
    void pintar(s);
  });
  return raiz;
}
