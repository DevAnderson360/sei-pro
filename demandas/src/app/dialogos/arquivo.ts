/**
 * O arquivo JSON do usuário (spec 4.4) e as cópias automáticas deste navegador: a seção "Arquivo numa pasta da nuvem"
 * do diálogo Sincronização (escolher, reconectar, sincronizar, parar; sem File System Access só Exportar e Importar) e o
 * diálogo "Cópias automáticas" (as 14 mais recentes; restaurar RECUPERA o que sumiu, não desfaz edição mais nova).
 * Tudo o que vem de fora (nome do arquivo, mensagens) entra como texto.
 */

import { formatarData } from "@comum/datas/dias";
import type { StatusArquivo } from "@comum/sincronia/arquivo";
import type { AbrirModal } from "@comum/ui/dialogo";
import { h } from "@comum/ui/dom";
import type { CopiaDemandas, ResultadoRestauracao } from "../../sincronia/arquivo";
import { mensagemDoErro } from "../erros";
import { plural } from "../formato";

export const TEXTO_SEM_ARQUIVO_LIGADO = "Neste navegador, use Exportar e Importar: importar sempre junta, nunca apaga.";

export interface DepsArquivoLigado {
  status(): Promise<StatusArquivo | null>;
  configurado(): Promise<boolean>;
  escolher(modo: "novo" | "existente"): Promise<void>;
  reconectar(): Promise<void>;
  agora(): Promise<void>;
  esquecer(): Promise<void>;
}

export interface DepsSecaoArquivo {
  /** Null: o navegador não deixa manter um arquivo ligado (Firefox, ou iframe que recusa o seletor). */
  arquivo: DepsArquivoLigado | null;
  /** A frase devolvida (se houver) aparece na seção. */
  exportar(): Promise<string | undefined>;
  importar(): Promise<string | undefined>;
}

type Avisar = (t: string) => void;

/** A linha do resultado ou do erro de uma seção (vazia some; o leitor de tela lê quando muda). */
export function linhaDeAviso(classe = "dem-sync-aviso"): { el: HTMLElement; avisar: Avisar } {
  const el = h("p", { class: `dem-dica ${classe}`, role: "status" });
  return {
    el,
    avisar: (t) => {
      el.textContent = t;
    },
  };
}

/** Botão de ação: ignora outro clique enquanto a ação corre (`aria-disabled` não tira o foco) e mostra o erro como texto. */
export function botaoDeAcao(
  rotulo: string,
  fazer: () => Promise<unknown>,
  avisar: Avisar,
  classe = "spro-botao",
  aria?: string,
): HTMLButtonElement {
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

const dica = (t: string, extra?: string) => h("p", { class: extra ? `dem-dica ${extra}` : "dem-dica" }, t);
const acoes = (...filhos: Node[]) => h("div", { class: "dem-sync-acoes" }, ...filhos);

function repor(alvo: HTMLElement, ...filhos: Node[]): void {
  const tinhaFoco = alvo.contains(document.activeElement);
  alvo.replaceChildren(...filhos);
  if (tinhaFoco) alvo.querySelector<HTMLElement>("button")?.focus();
}

export async function montarSecaoArquivo(d: DepsSecaoArquivo): Promise<HTMLElement> {
  const aviso = linhaDeAviso();
  const sec = h("section", { class: "dem-sync-secao", "data-secao": "arquivo" }, h("h3", {}, "Arquivo numa pasta da nuvem"));
  const manual = () =>
    acoes(
      botaoDeAcao(
        "Exportar arquivo (backup)",
        async () => {
          const r = await d.exportar();
          if (r) aviso.avisar(r);
        },
        aviso.avisar,
      ),
      botaoDeAcao(
        "Importar arquivo…",
        async () => {
          const r = await d.importar();
          if (r) aviso.avisar(r);
        },
        aviso.avisar,
      ),
    );
  const a = d.arquivo;
  if (!a) {
    sec.append(dica(TEXTO_SEM_ARQUIVO_LIGADO), manual(), aviso.el);
    return sec;
  }
  const corpo = h("div", { class: "dem-sync-corpo" });
  const pintar = async () => {
    let st: StatusArquivo | null;
    let ok: boolean;
    try {
      [st, ok] = await Promise.all([a.status(), a.configurado()]);
    } catch (e) {
      repor(corpo, dica(`Não foi possível ler o estado do arquivo: ${mensagemDoErro(e)}`, "dem-sync-erro"));
      return;
    }
    const linha = !ok
      ? dica(
          "Escolha um arquivo numa pasta que já sincroniza com a nuvem (OneDrive, Google Drive, Dropbox ou rede). Ele leva todas as suas demandas, de todas as unidades, com o histórico.",
        )
      : st?.estado === "ok"
        ? dica(
            `Ligado a “${st.nome ?? "arquivo"}”. Último envio: ${new Date(st.quando).toLocaleString("pt-BR")}.${st.mensagem ? ` ${st.mensagem}` : ""}`,
          )
        : st?.estado === "permissao"
          ? dica(`O navegador pede de novo a permissão de “${st.nome ?? "arquivo"}”.`)
          : dica(`Erro no arquivo: ${st?.mensagem ?? "tente de novo"}`, "dem-sync-erro");
    const acao = (f: () => Promise<void>) => async () => {
      try {
        await f();
      } finally {
        await pintar();
      }
    };
    repor(
      corpo,
      linha,
      acoes(
        ...(ok
          ? [
              st?.estado === "permissao"
                ? botaoDeAcao("Reconectar", acao(a.reconectar), aviso.avisar, "spro-botao primario")
                : botaoDeAcao("Sincronizar o arquivo", acao(a.agora), aviso.avisar),
              botaoDeAcao(
                "Trocar arquivo…",
                acao(() => a.escolher("existente")),
                aviso.avisar,
              ),
              botaoDeAcao(
                "Parar de usar o arquivo",
                async () => {
                  await acao(a.esquecer)();
                  aviso.avisar("O arquivo continua na pasta. Para voltar a usá-lo: “Usar um arquivo existente…”.");
                },
                aviso.avisar,
              ),
            ]
          : [
              botaoDeAcao(
                "Escolher arquivo na nuvem…",
                acao(() => a.escolher("novo")),
                aviso.avisar,
                "spro-botao primario",
              ),
              botaoDeAcao(
                "Usar um arquivo existente…",
                acao(() => a.escolher("existente")),
                aviso.avisar,
              ),
            ]),
      ),
      dica("Ou exporte e importe à mão (importar sempre junta, nunca apaga):"),
      manual(),
    );
  };
  await pintar();
  sec.append(corpo, aviso.el);
  return sec;
}

/** "Voltaram 3 demandas e 5 registros do histórico." / "Voltou 1 demanda." */
export function textoDaRestauracao(r: ResultadoRestauracao): string {
  const partes = [
    ...(r.demandas > 0 ? [{ n: r.demandas, t: plural(r.demandas, "demanda", "demandas") }] : []),
    ...(r.registros > 0 ? [{ n: r.registros, t: plural(r.registros, "registro do histórico", "registros do histórico") }] : []),
  ];
  if (!partes.length && r.noOutroEscopo > 0) {
    const onde = r.rotulosDoOutro.map((x) => `“${x}”`).join(" e ");
    return `Nada voltou: o que faltava está em ${onde} ou foi excluído lá.`;
  }
  if (!partes.length) return "Nada para recuperar: tudo o que estava na cópia ainda existe.";
  const lista = partes.map((p) => p.t);
  const juntos = lista.length === 1 ? lista[0] : `${lista.slice(0, -1).join(", ")} e ${lista.at(-1)}`;
  return `${partes.length === 1 && partes[0]?.n === 1 ? "Voltou" : "Voltaram"} ${juntos}.`;
}

export interface DepsCopias {
  abrirModal: AbrirModal;
  confirmar(texto: string, rotuloOk?: string): Promise<boolean>;
  copias: {
    listar(): Promise<CopiaDemandas[]>;
    restaurar(c: CopiaDemandas): Promise<ResultadoRestauracao>;
    /** A cópia de hoje que não pôde ser feita (a memória do sigilo ilegível): a mensagem do erro. */
    falhaDoDia?(): string | null;
  } | null;
}

export async function abrirCopias(d: DepsCopias): Promise<void> {
  const aviso = linhaDeAviso("dem-copias-aviso");
  let corpo: Node[];
  if (!d.copias) {
    corpo = [dica("Este navegador não guarda cópias automáticas.")];
  } else {
    const c = d.copias;
    let lista: CopiaDemandas[] | null = null;
    let erroLista = "";
    try {
      lista = await c.listar();
    } catch (e) {
      erroLista = mensagemDoErro(e);
    }
    const falha = c.falhaDoDia?.() ?? null;
    const item = (x: CopiaDemandas) => {
      const dia = formatarData(x.dia);
      return h(
        "li",
        { "data-dia": x.dia },
        h("span", {}, `${dia} — ${plural(x.quantidade, "demanda", "demandas")}`),
        botaoDeAcao(
          "Restaurar",
          async () => {
            const pergunta = `Restaurar a cópia de ${dia}? Traz de volta o que foi excluído ou sumiu desde então. O que existe hoje não muda.`;
            if (!(await d.confirmar(pergunta, "Restaurar"))) return;
            aviso.avisar(textoDaRestauracao(await c.restaurar(x)));
          },
          aviso.avisar,
          "spro-botao fantasma pequeno",
          `Restaurar a cópia de ${dia}`,
        ),
      );
    };
    corpo = [
      dica(
        "Uma por dia, as 14 mais recentes. Restaurar traz de volta o que foi excluído ou sumiu desde a cópia; o que existe hoje não muda.",
      ),
      ...(falha ? [dica(`A cópia de hoje não foi feita. ${falha}`, "dem-sync-erro")] : []),
      lista === null
        ? dica(`Não foi possível ler as cópias: ${erroLista}`, "dem-sync-erro")
        : lista.length
          ? h("ul", { class: "dem-copias" }, ...lista.map(item))
          : dica("Ainda não há cópias."),
    ];
  }
  d.abrirModal({
    titulo: "Cópias automáticas",
    icone: "restaurar",
    conteudo: h("div", { class: "dem-form dem-sync" }, ...corpo, aviso.el),
  });
}
