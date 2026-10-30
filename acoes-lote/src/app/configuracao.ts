/**
 * Tela de configuração da fila: a lista de etapas (subir, descer, remover, adicionar) e os campos de cada uma.
 * Os erros de `validarFila` (mais três que ela não vê: bloco, destino) aparecem acima de "Ver prévia", que fica
 * desabilitado enquanto houver algum.
 *
 * A senha da assinatura vive só no campo desta tela. Sai por argumento em `previa(senha)` e o campo é limpo ao
 * sair (prévia ou Voltar); nunca entra em `EstadoApp`, no storage nem em `ParamsEtapa`.
 *
 * As buscas de contatos e assuntos custam uma ida ao SEI cada: esperam 300 ms sem digitar e pedem 3 letras.
 * Hipóteses, cargos e contatos precisam de um documento de referência: o primeiro selecionado que for elegível
 * para a etapa (`elegivel`).
 */

import type { Rpc } from "@comum/ponte/rpc";
import { type Combo, criarCombo, type OpcaoCombo } from "@comum/ui/combobox";
import { h, icone } from "@comum/ui/dom";
import { ACOES, type AcaoId } from "../modelo/acoes";
import { elegivel } from "../modelo/documentos";
import { type ItemLista, type ModoLista, type ParamsEtapa, validarFila } from "../modelo/fila";
import { type EstadoApp, etapaInicial } from "./app";

export interface AcoesConfiguracao {
  rpc: Pick<Rpc, "chamar">;
  voltar(): void;
  /** `senha` só vai se a fila tem Assinar e o campo foi preenchido. */
  previa(senha?: string): void;
}

/** Espera da digitação nas buscas e mínimo de letras (cada busca é uma ida ao SEI). */
export const ESPERA_BUSCA_MS = 300;
export const MINIMO_BUSCA = 3;
export const AVISO_DESTRUTIVO = "Isso apaga dados dos documentos e não pode ser desfeito.";

const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const rotuloDe = (id: AcaoId): string => ACOES.find((a) => a.id === id)!.rotulo;
type EtapaDe<A extends AcaoId> = Extract<ParamsEtapa, { acao: A }>;
type CampoLista = "interessados" | "assuntos";

const MODOS: Array<{ valor: ModoLista; rotulo: string }> = [
  { valor: "acrescentar", rotulo: "Acrescentar" },
  { valor: "remover", rotulo: "Remover" },
  { valor: "substituir", rotulo: "Substituir" },
];

/** Erros que `validarFila` não enxerga: ela não olha o bloco nem o destino resolvido. */
function errosLocais(etapas: ParamsEtapa[]): string[] {
  const erros: string[] = [];
  for (const e of etapas) {
    if (e.acao === "incluir-bloco") {
      if ("novo" in e.bloco) {
        if (!e.bloco.novo.trim()) erros.push("Informe a descrição do novo bloco.");
      } else if (!e.bloco.id) erros.push("Escolha o bloco de assinatura.");
    }
    if (e.acao === "mover" && !e.destino.idProcedimento) erros.push("Informe o processo de destino.");
  }
  return erros;
}

export function montarConfiguracao(_doc: Document, e: EstadoApp, acoes: AcoesConfiguracao): HTMLElement {
  const senha = h("input", {
    type: "password",
    class: "spro-campo",
    autocomplete: "off",
    "aria-label": "Senha de assinatura",
    placeholder: "Senha do SEI",
  });
  const lista = h("div", { class: "al-etapas" });
  const erros = h("ul", { class: "al-erros", role: "alert" });
  const previa = h("button", { type: "button", class: "spro-botao primario", disabled: true }, "Ver prévia");
  const cache = new Map<string, Promise<unknown>>();
  /** Modo (acrescentar...) e mensagem do destino por ação: as ações são únicas na fila, e a ordem muda. */
  const modos = new Map<string, ModoLista>();
  const statusDestino = new Map<string, { texto: string; erro: boolean }>();

  const adicionar: Combo = criarCombo({
    rotulo: "Adicionar etapa",
    opcoes: () => ACOES.filter((a) => !e.etapas.some((x) => x.acao === a.id)).map((a) => ({ valor: a.id, rotulo: a.rotulo })),
    vazio: "Adicionar etapa…",
    busca: false,
    aoMudar: (vs) => {
      const id = vs[0] as AcaoId | undefined;
      if (!id) return;
      e.etapas.push(etapaInicial(id));
      adicionar.definir([]);
      desenhar();
    },
  });

  /** O documento que serve de referência ao SEI para a etapa: o primeiro selecionado elegível. */
  const numeroPara = (acao: AcaoId): string | undefined =>
    e.linhas.find((l) => e.selecionados.has(l.id) && elegivel(acao, l, e.sigiloso).ok)?.numero;

  function ler<T>(chave: string, fn: () => Promise<T>): Promise<T> {
    let p = cache.get(chave) as Promise<T> | undefined;
    if (!p) {
      p = fn();
      cache.set(chave, p);
      p.catch(() => cache.delete(chave));
    }
    return p;
  }

  function atualizarErros(): void {
    const msgs = [...validarFila(e.etapas), ...errosLocais(e.etapas)];
    erros.replaceChildren(...msgs.map((m) => h("li", {}, m)));
    previa.disabled = msgs.length > 0;
  }

  /** Troca a etapa da ação `acao` (única na fila) sem redesenhar a tela. */
  function editar<A extends AcaoId>(acao: A, f: (et: EtapaDe<A>) => ParamsEtapa): void {
    const i = e.etapas.findIndex((x) => x.acao === acao);
    if (i < 0) return;
    e.etapas[i] = f(e.etapas[i] as EtapaDe<A>);
    atualizarErros();
  }

  // ---------- campos ----------

  const rotulado = (texto: string, ...filhos: Array<Node | string>): HTMLElement =>
    h("div", { class: "al-campo" }, h("span", { class: "al-rotulo" }, texto), ...filhos);

  /** `max`: o limite do próprio SEI (o núcleo corta no mesmo ponto), para a prévia mostrar o que será gravado. */
  function texto(rotulo: string, valor: string, aoMudar: (v: string) => void, area = false, max?: number): HTMLElement {
    const limite = max ? { maxlength: String(max) } : {};
    const c = area
      ? h("textarea", { class: "spro-campo", rows: "2", "aria-label": rotulo, value: valor, ...limite })
      : h("input", { type: "text", class: "spro-campo", "aria-label": rotulo, value: valor, ...limite });
    c.addEventListener("input", () => aoMudar(c.value));
    return rotulado(rotulo, c);
  }

  function radios<V extends string>(
    nome: string,
    campo: string,
    opcoes: Array<{ valor: V; rotulo: string }>,
    atual: V,
    aoMudar: (v: V) => void,
  ): HTMLElement {
    return h(
      "div",
      { class: "al-radios", role: "radiogroup" },
      ...opcoes.map((o) => {
        const r = h("input", { type: "radio", name: nome, value: o.valor, "data-campo": campo, checked: o.valor === atual });
        r.addEventListener("change", () => {
          if (r.checked) aoMudar(o.valor);
        });
        return h("label", { class: "al-radio" }, r, o.rotulo);
      }),
    );
  }

  /** Combo cujas opções chegam do SEI: mostra "carregando…" e, se falhar, o motivo. */
  function comboRemoto(
    rotulo: string,
    chave: string,
    carregar: () => Promise<OpcaoCombo[]>,
    atual: string,
    aoEscolher: (valor: string, rotuloEscolhido: string) => void,
    vazio: string,
  ): HTMLElement {
    let opcoes: OpcaoCombo[] = [];
    const nota = h("p", { class: "al-nota", hidden: true });
    const combo = criarCombo({
      rotulo,
      opcoes: () => opcoes,
      valor: atual ? [atual] : [],
      vazio: "carregando…",
      busca: true,
      larguraLista: 420,
      aoMudar: (vs) => {
        const o = opcoes.find((x) => x.valor === vs[0]);
        if (o) aoEscolher(o.valor, o.rotulo);
      },
    });
    ler(chave, carregar).then(
      (os) => {
        opcoes = os;
        combo.definirVazio(vazio);
        combo.atualizar();
      },
      (err) => {
        combo.definirVazio("indisponível");
        nota.hidden = false;
        nota.textContent = `Não foi possível carregar: ${mensagem(err)}`;
      },
    );
    return h("div", { class: "al-combo" }, combo.el, nota);
  }

  function semDocumento(): HTMLElement {
    return h("p", { class: "al-nota" }, "Nenhum documento selecionado serve para esta etapa.");
  }

  function campoHipotese(acao: "alterar-nivel" | "alterar-dados", atual: string | undefined): HTMLElement {
    const numero = numeroPara(acao);
    if (!numero) return semDocumento();
    return rotulado(
      "Hipótese legal",
      comboRemoto(
        "Hipótese legal",
        `hipoteses|${numero}`,
        async () =>
          (await acoes.rpc.chamar<ItemLista[]>("hipoteses", { nivel: "restrito", numero })).map((x) => ({ valor: x.id, rotulo: x.texto })),
        atual ?? "",
        (valor) => editar(acao, (et) => ({ ...et, hipotese: valor })),
        "selecione a hipótese legal",
      ),
    );
  }

  /** Busca com espera e mínimo de letras; o resultado clicado entra na lista de escolhidos. */
  function campoLista(et: EtapaDe<"alterar-dados">, campo: CampoLista, titulo: string, op: "contatos" | "assuntos"): HTMLElement {
    const chave = `alterar-dados:${campo}`;
    let modo = modos.get(chave) ?? et[campo]?.modo ?? "acrescentar";
    let itens: ItemLista[] = [...(et[campo]?.itens ?? [])];
    const aviso = h("p", { class: "al-aviso", hidden: true }, AVISO_DESTRUTIVO);
    const dica = h("p", { class: "al-dica" });
    const resultados = h("div", { class: "al-resultados" });
    const chips = h("div", { class: "al-chips" });
    const numero = numeroPara("alterar-dados");
    let espera: ReturnType<typeof setTimeout> | undefined;
    let geracao = 0;

    const mostrarAviso = () => {
      aviso.hidden = modo === "acrescentar";
    };
    const gravar = () => {
      editar("alterar-dados", (x) => {
        const { [campo]: _antigo, ...resto } = x;
        return itens.length ? { ...resto, [campo]: { modo, itens } } : resto;
      });
    };
    const desenharChips = () => {
      chips.replaceChildren(
        ...itens.map((it) =>
          h(
            "span",
            { class: "al-chip" },
            it.texto,
            h(
              "button",
              {
                type: "button",
                class: "spro-botao-icone",
                "aria-label": `Remover ${it.texto}`,
                onclick: () => {
                  itens = itens.filter((x) => x.id !== it.id);
                  desenharChips();
                  gravar();
                },
              },
              icone("fechar", 12),
            ),
          ),
        ),
      );
    };
    const buscar = async (termo: string, minha: number) => {
      dica.textContent = "Buscando…";
      try {
        const achados = await acoes.rpc.chamar<ItemLista[]>(op, { termo, numero });
        if (minha !== geracao) return;
        dica.textContent = achados.length ? "" : "Nada encontrado.";
        resultados.replaceChildren(
          ...achados.map((a) =>
            h(
              "button",
              {
                type: "button",
                class: "spro-botao",
                "data-id": a.id,
                onclick: () => {
                  if (!itens.some((x) => x.id === a.id)) itens = [...itens, a];
                  resultados.replaceChildren();
                  campoBusca.value = "";
                  desenharChips();
                  gravar();
                },
              },
              a.texto,
            ),
          ),
        );
      } catch (err) {
        if (minha === geracao) dica.textContent = `Não foi possível buscar: ${mensagem(err)}`;
      }
    };
    const campoBusca = h("input", {
      type: "search",
      class: "spro-campo",
      "aria-label": `Buscar ${campo}`,
      placeholder: `Buscar ${campo}…`,
    });
    campoBusca.addEventListener("input", () => {
      clearTimeout(espera);
      geracao += 1;
      const termo = campoBusca.value.trim();
      resultados.replaceChildren();
      if (!termo) {
        dica.textContent = "";
        return;
      }
      if (termo.length < MINIMO_BUSCA) {
        dica.textContent = `Digite ao menos ${MINIMO_BUSCA} caracteres.`;
        return;
      }
      dica.textContent = "";
      const minha = geracao;
      espera = setTimeout(() => {
        if (campoBusca.isConnected) void buscar(termo, minha);
      }, ESPERA_BUSCA_MS);
    });
    mostrarAviso();
    desenharChips();
    return h(
      "div",
      { class: "al-lista" },
      h("span", { class: "al-rotulo" }, titulo),
      radios(`dados-${campo}`, campo, MODOS, modo, (v) => {
        modo = v;
        modos.set(chave, v);
        mostrarAviso();
        gravar();
      }),
      aviso,
      numero ? campoBusca : semDocumento(),
      dica,
      resultados,
      chips,
    );
  }

  function campoDestino(et: EtapaDe<"mover">): HTMLElement {
    const numero = numeroPara("mover");
    const status = h("p", { class: "al-nota" });
    const pintar = () => {
      const s = statusDestino.get("mover");
      status.className = s?.erro ? "al-erro" : "al-nota";
      status.textContent = s?.texto ?? "";
    };
    if (et.destino.idProcedimento && !statusDestino.has("mover")) {
      statusDestino.set("mover", { texto: `Destino: ${et.destino.protocolo} (${et.destino.tipo})`, erro: false });
    }
    let geracao = 0;
    const campo = h("input", {
      type: "text",
      class: "spro-campo",
      "aria-label": "Processo de destino",
      placeholder: "Número do processo",
      value: et.destino.protocolo,
    });
    const resolver = async () => {
      const protocolo = campo.value.trim();
      // A etapa atual, não a do desenho: `editar` troca o objeto a cada digitação.
      const atual = e.etapas.find((x): x is EtapaDe<"mover"> => x.acao === "mover");
      if (!protocolo || !numero || !atual || (atual.destino.idProcedimento && atual.destino.protocolo === protocolo)) return;
      const minha = ++geracao;
      statusDestino.set("mover", { texto: "Conferindo o processo…", erro: false });
      pintar();
      try {
        const r = await acoes.rpc.chamar<
          { situacao: "ok"; destino: { protocolo: string; idProcedimento: string; tipo: string } } | { situacao: "erro"; erro: string }
        >("destino", { protocolo, numero });
        // Resposta de um campo que já saiu da tela ou cujo texto mudou não vale.
        if (minha !== geracao || !campo.isConnected || campo.value.trim() !== protocolo) return;
        if (r.situacao === "ok") {
          editar("mover", (x) => ({ ...x, destino: r.destino }));
          statusDestino.set("mover", { texto: `Destino: ${r.destino.protocolo} (${r.destino.tipo})`, erro: false });
        } else {
          statusDestino.set("mover", { texto: r.erro, erro: true });
        }
      } catch (err) {
        if (minha !== geracao || !campo.isConnected || campo.value.trim() !== protocolo) return;
        statusDestino.set("mover", { texto: `Não foi possível conferir o processo: ${mensagem(err)}`, erro: true });
      }
      pintar();
    };
    campo.addEventListener("input", () => {
      geracao += 1;
      statusDestino.delete("mover");
      pintar();
      editar("mover", (x) => ({ ...x, destino: { protocolo: campo.value.trim(), idProcedimento: "", tipo: "" } }));
    });
    campo.addEventListener("change", () => void resolver());
    campo.addEventListener("blur", () => void resolver());
    pintar();
    return rotulado("Processo de destino", numero ? campo : semDocumento(), status);
  }

  function camposDe(et: ParamsEtapa): Array<HTMLElement | null> {
    switch (et.acao) {
      case "alterar-nivel": {
        return [
          radios(
            "nivel",
            "nivel",
            [
              { valor: "publico", rotulo: "Público" },
              { valor: "restrito", rotulo: "Restrito" },
            ],
            et.nivel,
            (v) => {
              editar("alterar-nivel", () => ({ acao: "alterar-nivel", nivel: v }));
              desenhar();
            },
          ),
          et.nivel === "restrito" ? campoHipotese("alterar-nivel", et.hipotese) : null,
        ];
      }
      case "assinar": {
        const numero = numeroPara("assinar");
        return [
          rotulado(
            "Cargo",
            numero
              ? comboRemoto(
                  "Cargo",
                  `cargos|${numero}`,
                  async () => (await acoes.rpc.chamar<string[]>("cargos", { numero })).map((c) => ({ valor: c, rotulo: c })),
                  et.cargo,
                  (valor) => editar("assinar", () => ({ acao: "assinar", cargo: valor })),
                  "selecione o cargo",
                )
              : semDocumento(),
          ),
          rotulado("Senha", senha),
        ];
      }
      case "cancelar-documento":
        return [
          texto(
            "Motivo do cancelamento",
            et.motivo,
            (v) => editar("cancelar-documento", () => ({ acao: "cancelar-documento", motivo: v })),
            true,
          ),
        ];
      case "incluir-bloco": {
        const novo = "novo" in et.bloco;
        return [
          radios(
            "bloco",
            "bloco",
            [
              { valor: "existente", rotulo: "Bloco existente" },
              { valor: "novo", rotulo: "Novo bloco" },
            ],
            novo ? "novo" : "existente",
            (v) => {
              editar("incluir-bloco", () => ({ acao: "incluir-bloco", bloco: v === "novo" ? { novo: "" } : { id: "", texto: "" } }));
              desenhar();
            },
          ),
          "novo" in et.bloco
            ? texto("Descrição do novo bloco", et.bloco.novo, (v) =>
                editar("incluir-bloco", () => ({ acao: "incluir-bloco", bloco: { novo: v } })),
              )
            : rotulado(
                "Bloco",
                comboRemoto(
                  "Bloco",
                  "blocos",
                  async () => (await acoes.rpc.chamar<ItemLista[]>("blocos")).map((b) => ({ valor: b.id, rotulo: b.texto })),
                  et.bloco.id,
                  (valor, r) => editar("incluir-bloco", () => ({ acao: "incluir-bloco", bloco: { id: valor, texto: r } })),
                  "selecione o bloco",
                ),
              ),
        ];
      }
      case "alterar-dados": {
        const nivel = et.nivel ?? "manter";
        return [
          texto("Descrição", et.descricao ?? "", (v) => editar("alterar-dados", (x) => campoOpcional(x, "descricao", v)), false, 250),
          texto("Observação", et.observacao ?? "", (v) => editar("alterar-dados", (x) => campoOpcional(x, "observacao", v)), true, 1000),
          h("p", { class: "al-dica" }, "Em branco, a descrição e a observação continuam como estão."),
          campoLista(et, "interessados", "Interessados", "contatos"),
          campoLista(et, "assuntos", "Assuntos", "assuntos"),
          rotulado(
            "Nível de acesso",
            radios(
              "dados-nivel",
              "nivel",
              [
                { valor: "manter", rotulo: "Manter" },
                { valor: "publico", rotulo: "Público" },
                { valor: "restrito", rotulo: "Restrito" },
              ],
              nivel,
              (v) => {
                editar("alterar-dados", (x) => {
                  const { nivel: _n, hipotese: _h, ...resto } = x;
                  return v === "manter" ? resto : { ...resto, nivel: v };
                });
                desenhar();
              },
            ),
          ),
          et.nivel === "restrito" ? campoHipotese("alterar-dados", et.hipotese) : null,
        ];
      }
      case "mover":
        return [campoDestino(et), texto("Motivo da movimentação", et.motivo, (v) => editar("mover", (x) => ({ ...x, motivo: v })))];
      case "baixar":
        return [
          radios(
            "baixar",
            "modo",
            [
              { valor: "arquivos", rotulo: "Arquivos separados" },
              { valor: "zip", rotulo: "Um ZIP" },
            ],
            et.modo,
            (v) => editar("baixar", () => ({ acao: "baixar", modo: v })),
          ),
        ];
      default:
        return [];
    }
  }

  function cartao(et: ParamsEtapa, i: number): HTMLElement {
    const botaoIcone = (rotulo: string, nome: "setaCima" | "setaBaixo" | "lixeira", desabilitado: boolean, acao: () => void) =>
      h(
        "button",
        { type: "button", class: "spro-botao-icone", "aria-label": rotulo, title: rotulo, disabled: desabilitado, onclick: acao },
        icone(nome, 16),
      );
    const trocar = (j: number) => {
      const [x] = e.etapas.splice(i, 1);
      e.etapas.splice(j, 0, x!);
      desenhar();
    };
    return h(
      "section",
      { class: "al-etapa", "data-acao": et.acao },
      h(
        "header",
        { class: "al-etapa-topo" },
        h("strong", {}, `${i + 1}. ${rotuloDe(et.acao)}`),
        h(
          "span",
          { class: "al-etapa-acoes" },
          botaoIcone("Subir", "setaCima", i === 0, () => trocar(i - 1)),
          botaoIcone("Descer", "setaBaixo", i === e.etapas.length - 1, () => trocar(i + 1)),
          botaoIcone("Remover", "lixeira", false, () => {
            if (et.acao === "assinar") senha.value = "";
            e.etapas.splice(i, 1);
            desenhar();
          }),
        ),
      ),
      ...camposDe(et),
    );
  }

  function desenhar(): void {
    lista.replaceChildren(...e.etapas.map(cartao));
    if (!e.etapas.length) lista.append(h("p", { class: "al-nota" }, "Nenhuma etapa ainda. Adicione a primeira abaixo."));
    adicionar.atualizar();
    atualizarErros();
  }

  const sair = (fn: () => void) => {
    senha.value = "";
    fn();
  };
  previa.addEventListener("click", () => {
    if (previa.disabled) return;
    const s = e.etapas.some((x) => x.acao === "assinar") ? senha.value : "";
    sair(() => acoes.previa(s || undefined));
  });

  desenhar();
  return h(
    "div",
    { class: "al-config" },
    lista,
    h("div", { class: "al-adicionar" }, adicionar.el),
    erros,
    h(
      "div",
      { class: "al-rodape" },
      h("button", { type: "button", class: "spro-botao", onclick: () => sair(() => acoes.voltar()) }, "Voltar"),
      previa,
    ),
  );
}

/** Descrição e observação em branco saem da etapa (significam "manter o atual"). */
function campoOpcional(x: EtapaDe<"alterar-dados">, campo: "descricao" | "observacao", valor: string): EtapaDe<"alterar-dados"> {
  const { [campo]: _antigo, ...resto } = x;
  return valor.trim() ? { ...resto, [campo]: valor } : resto;
}
