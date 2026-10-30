/**
 * Diálogo "Sincronização" (spec 3.2, desenho do diálogo dos Favoritos): as
 * formas de não perder os projetos numa tela só — o Texto Padrão da unidade,
 * o Texto Padrão pessoal, o arquivo numa pasta da nuvem (com Exportar e
 * Importar, o caminho de quem não tem o arquivo ligado) e as cópias diárias
 * deste navegador. Poucos botões: "Sincronizar agora" (os dois textos) fica
 * no da unidade; o pessoal só liga, desliga e apaga; o da unidade não tem
 * "apagar" (é de todos). O arquivo tem o seu, "Sincronizar o arquivo" (um só
 * "Sincronizar agora" no diálogo).
 *
 * Restaurar uma cópia RECUPERA (sincronia/arquivo.ts): só volta o que foi
 * excluído ou sumiu depois dela, e o que existe hoje não muda. O aviso diz o
 * que voltou de fato, por tipo ("Voltaram 1 projeto, 2 fases e 5 etapas.").
 *
 * Tudo o que vem de fora entra como texto (`h()`): a sigla, o nome do arquivo,
 * o motivo do texto inválido e as mensagens de erro (inclusive a da memória do
 * sigilo ilegível, que para o arquivo e a cópia do dia). O erro de uma ação
 * aparece na própria seção, numa linha lida pelo leitor de tela; a situação
 * que não pôde ser lida também (o diálogo abre assim mesmo).
 */

import { formatarData, hojeISO } from "@comum/datas/dias";
import type { StatusArquivo } from "@comum/sincronia/arquivo";
import { h } from "@comum/ui/dom";
import type { Vis } from "../../modelo/tipos";
import type { CopiaProjetos, ResultadoRestauracao } from "../../sincronia/arquivo";
import type { TextoSubstituido } from "../../sincronia/textoPadrao";
import { linhaDoTexto, type SituacaoSincronia } from "../colaboracao/estado";
import { mensagemDoErro } from "../erros";
import { plural } from "../formato";

export interface DepsSincronizacao {
  sigla: string;
  agora(): number;
  /** Relê a situação dos dois textos (o content script grava o status). */
  situacao(): Promise<SituacaoSincronia>;
  /**
   * A situação mudou com o diálogo aberto (uma rodada em segundo plano): o diálogo repinta as linhas dos textos com a
   * situação recebida (sem reler: no app, reler dispararia o aviso de novo). Devolve a desinscrição, que o diálogo
   * chama na primeira mudança depois de fechado (fora da página).
   */
  aoMudar?(f: (s: SituacaoSincronia) => void): () => void;
  /** "Sincronizar agora": os dois textos (o pessoal só se ligado), pela aba do SEI. */
  sincronizar(): Promise<void>;
  pessoal: {
    /** Pergunta o consentimento; true = ligado. */
    ligar(): Promise<boolean>;
    desligar(): Promise<void>;
    /** Desliga e exclui o texto pessoal do SEI; true = havia um texto e ele foi excluído. */
    apagar(): Promise<boolean>;
  };
  arquivo: {
    status(): Promise<StatusArquivo | null>;
    configurado(): Promise<boolean>;
    escolher(modo: "novo" | "existente"): Promise<void>;
    reconectar(): Promise<void>;
    agora(): Promise<void>;
    esquecer(): Promise<void>;
  } | null;
  /** A frase devolvida (se houver) aparece na seção do arquivo. */
  exportar(): Promise<string | undefined>;
  importar(): Promise<string | undefined>;
  copias: {
    listar(): Promise<CopiaProjetos[]>;
    /** O que voltou de fato, por tipo (`restaurarCopia`). */
    restaurar(c: CopiaProjetos): Promise<ResultadoRestauracao>;
    /** A cópia de hoje que não pôde ser feita (a memória do sigilo ilegível): a mensagem do erro. */
    falhaDoDia?(): string | null;
  } | null;
  baixar(nome: string, conteudo: string, tipo: string): void;
  confirmar(texto: string, rotuloOk?: string): Promise<boolean>;
}

type Avisar = (t: string) => void;

/** A linha do resultado ou do erro de uma seção (vazia some; o leitor de tela lê quando muda). */
function linhaDeAviso(): { el: HTMLElement; avisar: Avisar } {
  const el = h("p", { class: "prj-dica prj-sync-aviso", role: "status" });
  return {
    el,
    avisar: (t) => {
      el.textContent = t;
    },
  };
}

/**
 * Botão de ação: limpa o aviso da seção, ignora outro clique enquanto a ação corre (com `aria-disabled`, que não
 * tira o foco do teclado como o `disabled`) e mostra o erro como texto.
 */
function botao(rotulo: string, fazer: () => Promise<unknown>, avisar: Avisar, classe = "spro-botao", aria?: string): HTMLButtonElement {
  const b = h("button", { type: "button", class: classe, "aria-label": aria }, rotulo);
  b.addEventListener("click", async () => {
    if (b.getAttribute("aria-disabled") === "true") return;
    b.setAttribute("aria-disabled", "true");
    avisar("");
    try {
      await fazer();
    } catch (e) {
      avisar(mensagemDoErro(e));
    } finally {
      b.removeAttribute("aria-disabled");
    }
  });
  return b;
}

/** Troca os botões de uma linha sem largar o foco do teclado (o botão clicado some ao repintar). */
function repor(alvo: HTMLElement, ...filhos: Node[]): void {
  const tinhaFoco = alvo.contains(document.activeElement);
  alvo.replaceChildren(...filhos);
  if (tinhaFoco) alvo.querySelector<HTMLElement>("button")?.focus();
}

const dica = (t: string, extra?: string) => h("p", { class: extra ? `prj-dica ${extra}` : "prj-dica" }, t);
const acoes = (...filhos: Node[]) => h("div", { class: "prj-sync-acoes" }, ...filhos);

const DIA = 86_400_000;
/** O aviso do texto inválido substituído some depois disso (o motor já regravou; ninguém mais procura o antigo). */
const DIAS_AVISO_SUBSTITUIDO = 30;

const PARTES: ReadonlyArray<["projetos" | "fases" | "etapas" | "modelos", string, string]> = [
  ["projetos", "projeto", "projetos"],
  ["fases", "fase", "fases"],
  ["etapas", "etapa", "etapas"],
  ["modelos", "modelo", "modelos"],
];

/**
 * "Voltaram 1 projeto, 2 fases e 5 etapas." / "Voltou 1 etapa." ("Voltou" só com uma parte e 1). Os registros do
 * histórico só aparecem quando são tudo o que voltou (eles vêm junto de quase toda restauração).
 */
function textoDaRestauracao(r: ResultadoRestauracao): string {
  let partes = PARTES.filter(([k]) => r[k] > 0).map(([k, um, varios]) => ({ n: r[k], t: plural(r[k], um, varios) }));
  if (!partes.length && r.registros > 0)
    partes = [{ n: r.registros, t: plural(r.registros, "registro do histórico", "registros do histórico") }];
  if (!partes.length && r.noOutroEscopo > 0) {
    const onde = r.rotulosDoOutro.map((x) => `“${x}”`).join(" e ");
    return `Nada voltou: o que faltava está em ${onde} ou foi excluído lá.`;
  }
  if (!partes.length) return "Nada para recuperar: tudo o que estava na cópia ainda existe.";
  const lista = partes.map((p) => p.t);
  const juntos = lista.length === 1 ? lista[0] : `${lista.slice(0, -1).join(", ")} e ${lista.at(-1)}`;
  return `${partes.length === 1 && partes[0]!.n === 1 ? "Voltou" : "Voltaram"} ${juntos}.`;
}

function substituido(s: TextoSubstituido | undefined, vis: Vis, agora: number, baixar: DepsSincronizacao["baixar"]): HTMLElement | null {
  if (!s || agora - s.quando > DIAS_AVISO_SUBSTITUIDO * DIA) return null;
  const dia = hojeISO(new Date(s.quando));
  return h(
    "p",
    { class: "prj-dica prj-sync-substituido" },
    `Em ${formatarData(dia)} o texto no SEI estava inválido (${s.motivo}) e foi regravado.${s.cortado ? " Ficou guardado só o começo dele, que era grande demais." : ""} `,
    h(
      "button",
      {
        type: "button",
        class: "spro-botao fantasma pequeno",
        "aria-label": vis === "unidade" ? "Baixar o texto antigo da unidade" : "Baixar o texto antigo pessoal",
        // Texto simples: o HTML de fora, aberto como página, rodaria o que tivesse dentro.
        onclick: () => baixar(`projetos-texto-antigo-${dia}.txt`, s.html, "text/plain;charset=utf-8"),
      },
      "Baixar o texto antigo",
    ),
  );
}

export async function montarSincronizacao(d: DepsSincronizacao): Promise<HTMLElement> {
  const avisoUn = linhaDeAviso();
  const avisoEu = linhaDeAviso();
  const dicaUn = dica("");
  const dicaEu = dica("");
  const linhaUn = h("p", { class: "prj-dica prj-sync-situacao", "data-texto": "unidade" });
  const linhaEu = h("p", { class: "prj-dica prj-sync-situacao", "data-texto": "eu" });
  const extrasUn = h("div", { class: "prj-sync-extra" });
  const extrasEu = h("div", { class: "prj-sync-extra" });
  const acoesEu = acoes();
  /** A última situação lida (null: nenhuma leitura deu certo ainda). */
  let situ: SituacaoSincronia | null = null;
  const noTexto = (nome: string | undefined) => (nome ? `no texto “${nome}”` : "num Texto Padrão");

  const apagar = async (pergunta: string) => {
    if (!(await d.confirmar(pergunta, "Apagar"))) return;
    const nome = situ?.eu.nome ?? "";
    let excluiu: boolean;
    try {
      excluiu = await d.pessoal.apagar();
    } finally {
      // O controle grava "desligado" antes de excluir: mesmo com erro, a seção mostra o estado de agora.
      await pintar();
    }
    avisoEu.avisar(excluiu ? `O texto “${nome}” foi apagado do SEI.` : `Não havia o texto “${nome}” no SEI.`);
  };
  const botoesEu = (s: SituacaoSincronia): HTMLElement[] => {
    const ligar = botao(
      "Ligar…",
      async () => {
        if (await d.pessoal.ligar()) await pintar();
      },
      avisoEu.avisar,
      "spro-botao primario",
    );
    if (s.eu.consentimento === "ligado")
      return [
        botao(
          "Desligar",
          async () => {
            await d.pessoal.desligar();
            await pintar();
          },
          avisoEu.avisar,
        ),
        botao(
          "Desligar e apagar do SEI",
          () => apagar(`Apagar do SEI o texto “${s.eu.nome}” e desligar? Os projetos continuam neste navegador.`),
          avisoEu.avisar,
          "spro-botao perigo",
        ),
      ];
    // Quem nunca ligou não tem texto pessoal no SEI: só "Ligar…".
    if (s.eu.consentimento !== "desligado") return [ligar];
    return [
      ligar,
      // Desligado não quer dizer apagado: um texto que ficou no SEI ainda pode ser excluído daqui.
      botao(
        "Apagar o texto do SEI",
        () => apagar(`Apagar do SEI o texto “${s.eu.nome}”, se ele existir? Os projetos continuam neste navegador.`),
        avisoEu.avisar,
        "spro-botao perigo",
      ),
    ];
  };
  /** Pinta a situação (`erro`: a leitura falhou; as linhas dizem isso e o resto fica como na última leitura). */
  const desenhar = (erro: string | null) => {
    dicaUn.textContent = `Os projetos de “Toda a unidade” ficam ${noTexto(situ?.unidade.nome)}, que todos da ${d.sigla} com SEI Pro leem e gravam. O número de processo sigiloso não vai.`;
    dicaEu.textContent = `Seus projetos de “Só eu” podem ficar ${noTexto(situ?.eu.nome)}, para você vê-los em outro computador.`;
    for (const [t, linha, extras] of [
      [situ?.unidade, linhaUn, extrasUn],
      [situ?.eu, linhaEu, extrasEu],
    ] as const) {
      linha.textContent = erro ? `Não foi possível ler a situação da sincronia: ${erro}` : t ? linhaDoTexto(t, d.agora()) : "";
      if (erro) linha.classList.add("prj-sync-erro");
      else linha.classList.remove("prj-sync-erro");
      const aviso = t ? substituido(t.substituido, t.vis, d.agora(), d.baixar) : null;
      extras.replaceChildren(...(aviso ? [aviso] : []));
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
      { class: "prj-sync-secao", "data-secao": "unidade" },
      h("h3", {}, `Texto Padrão da ${d.sigla}`),
      dicaUn,
      linhaUn,
      extrasUn,
      acoes(
        botao(
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
      { class: "prj-sync-secao", "data-secao": "eu" },
      h("h3", {}, "Texto Padrão pessoal"),
      dicaEu,
      linhaEu,
      extrasEu,
      acoesEu,
      avisoEu.el,
    ),
  ];

  const avisoArq = linhaDeAviso();
  const arq = h("section", { class: "prj-sync-secao", "data-secao": "arquivo" }, h("h3", {}, "Arquivo numa pasta da nuvem"));
  // Exportar e importar à mão: só quando não há arquivo ligado (com ele, seria um botão a mais para a mesma coisa).
  const manual = () =>
    acoes(
      botao(
        "Exportar tudo",
        async () => {
          const r = await d.exportar();
          if (r) avisoArq.avisar(r);
        },
        avisoArq.avisar,
      ),
      botao(
        "Importar de um arquivo…",
        async () => {
          const r = await d.importar();
          if (r) avisoArq.avisar(r);
        },
        avisoArq.avisar,
      ),
    );
  if (d.arquivo) {
    const a = d.arquivo;
    const corpo = h("div", { class: "prj-sync-corpo" });
    const pintarArquivo = async () => {
      let st: StatusArquivo | null;
      let ok: boolean;
      try {
        [st, ok] = await Promise.all([a.status(), a.configurado()]);
      } catch (e) {
        repor(corpo, dica(`Não foi possível ler o estado do arquivo: ${mensagemDoErro(e)}`, "prj-sync-erro"));
        return;
      }
      const linha = !ok
        ? dica(
            "Escolha um arquivo numa pasta que já sincroniza com a nuvem (OneDrive, Google Drive, Dropbox ou rede). Ele leva todos os seus projetos, de todas as unidades.",
          )
        : st?.estado === "ok"
          ? dica(
              `Ligado a “${st.nome ?? "arquivo"}”. Última sincronia: ${new Date(st.quando).toLocaleString("pt-BR")}.${st.mensagem ? ` ${st.mensagem}` : ""}`,
            )
          : st?.estado === "permissao"
            ? dica(`O navegador pede de novo a permissão de “${st.nome ?? "arquivo"}”.`)
            : dica(`Erro no arquivo: ${st?.mensagem ?? "tente de novo"}`, "prj-sync-erro");
      const acao = (f: () => Promise<void>) => async () => {
        try {
          await f();
        } finally {
          await pintarArquivo();
        }
      };
      repor(
        corpo,
        linha,
        acoes(
          ...(ok
            ? [
                st?.estado === "permissao"
                  ? botao("Reconectar arquivo", acao(a.reconectar), avisoArq.avisar, "spro-botao primario")
                  : botao("Sincronizar o arquivo", acao(a.agora), avisoArq.avisar),
                botao(
                  "Trocar arquivo…",
                  acao(() => a.escolher("existente")),
                  avisoArq.avisar,
                ),
                botao(
                  "Parar de usar o arquivo",
                  async () => {
                    await acao(a.esquecer)();
                    avisoArq.avisar("O arquivo continua na pasta. Para voltar a usá-lo: “Usar um arquivo existente…”.");
                  },
                  avisoArq.avisar,
                ),
              ]
            : [
                botao(
                  "Criar arquivo…",
                  acao(() => a.escolher("novo")),
                  avisoArq.avisar,
                  "spro-botao primario",
                ),
                botao(
                  "Usar um arquivo existente…",
                  acao(() => a.escolher("existente")),
                  avisoArq.avisar,
                ),
              ]),
        ),
        ...(ok ? [] : [dica("Ou exporte e importe à mão (importar sempre junta, nunca apaga):"), manual()]),
      );
    };
    await pintarArquivo();
    arq.append(corpo);
  } else {
    arq.append(
      dica(
        "Aqui não dá para manter um arquivo ligado (o navegador não permite). Exporte e importe à mão; importar sempre junta, nunca apaga.",
      ),
      manual(),
    );
  }
  arq.append(avisoArq.el);
  secoes.push(arq);

  if (d.copias) {
    const c = d.copias;
    const avisoCp = linhaDeAviso();
    let lista: CopiaProjetos[] | null = null;
    let erroLista = "";
    try {
      lista = await c.listar();
    } catch (e) {
      erroLista = mensagemDoErro(e);
    }
    const falhaDoDia = c.falhaDoDia?.() ?? null;
    const item = (x: CopiaProjetos) => {
      const dia = formatarData(x.dia);
      return h(
        "li",
        {},
        h("span", {}, `${dia} — ${plural(x.quantidade, "projeto", "projetos")}`),
        botao(
          "Restaurar",
          async () => {
            const pergunta = `Restaurar a cópia de ${dia}? Traz de volta o que foi excluído ou sumiu desde então. O que existe hoje não muda.`;
            if (!(await d.confirmar(pergunta, "Restaurar"))) return;
            avisoCp.avisar(textoDaRestauracao(await c.restaurar(x)));
          },
          avisoCp.avisar,
          "spro-botao fantasma pequeno",
          `Restaurar a cópia de ${dia}`,
        ),
      );
    };
    secoes.push(
      h(
        "section",
        { class: "prj-sync-secao", "data-secao": "copias" },
        h("h3", {}, "Cópias deste navegador"),
        dica(
          "Uma por dia, as 14 mais recentes. Restaurar traz de volta o que foi excluído ou sumiu desde a cópia; o que existe hoje não muda.",
        ),
        falhaDoDia ? dica(`A cópia de hoje não foi feita. ${falhaDoDia}`, "prj-sync-erro") : null,
        lista === null
          ? dica(`Não foi possível ler as cópias: ${erroLista}`, "prj-sync-erro")
          : lista.length
            ? h("ul", { class: "prj-copias" }, ...lista.map(item))
            : dica("Ainda não há cópias."),
        avisoCp.el,
      ),
    );
  }

  const raiz = h("div", { class: "prj-form prj-sync" }, ...secoes);
  // Ao vivo: a situação que muda com o diálogo aberto repinta as linhas. Fechado (fora da página), desinscreve na
  // primeira mudança. Quem chama põe o diálogo na página logo depois de montar (no mesmo passo). `sair` existe antes
  // da inscrição: um provedor que avisa na hora (ainda fora da página) não cai na variável antes da declaração.
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
