/**
 * Diálogo da etapa (tela 2): o essencial à mostra (nome, datas e dias úteis,
 * marco, responsável, fase, "Depende de") e o resto em seções recolhidas com
 * o resumo ao lado (checklist, processo e documento, etiquetas, observações,
 * como medir o progresso, histórico). Datas são conferidas aqui antes de ir ao
 * modelo (data impossível ou fora de 2000 a 2100 não passa); o resto da regra
 * (ciclo de dependência, limites) volta do repositório como `ErroValidacao`.
 */

import { diferencaDias } from "@comum/datas/dias";
import { novoId } from "@comum/id";
import { normalizarTexto } from "@comum/texto";
import { criarCombo, type OpcaoCombo } from "@comum/ui/combobox";
import type { AbrirModal } from "@comum/ui/dialogo";
import { h, icone } from "@comum/ui/dom";
import { duracaoUteis, LIMITE_DIAS_ETAPA } from "../../modelo/calendario";
import { LIMITES } from "../../modelo/constantes";
import { chaveResponsavel } from "../../modelo/filtro";
import { documentoSemNumero, vinculoSemNumero } from "../../modelo/sigilo";
import type { DataISO, DocumentoSei, Etapa, ItemChecklist, Medida, Registro, Responsavel, Vinculo } from "../../modelo/tipos";
import type { DocumentoConferido, ProcessoDaCaixa, UsuarioDaUnidade } from "../../ponte/tipos";
import type { ProjetoNaTela } from "../dados";
import { dataCurtaDoCarimbo, dataDeFormulario, quemDoRegistro, resumoDoUltimoRegistro, textoDiasUteis, textoDoRegistro } from "../formato";
import { iconeProjetos } from "../icones";
import {
  caixaDeErros,
  campo,
  campoDocumento,
  campoProcesso,
  DICA_DOCUMENTO_SEM_NUMERO,
  ERRO_DOCUMENTO,
  ERRO_PROTOCOLO,
  linhaDeCampos,
  mensagensDoErro,
  secao,
} from "./campos";

export interface ResultadoEtapa {
  nome: string;
  inicio: DataISO;
  fim: DataISO;
  marco: boolean;
  responsavel?: Responsavel;
  /** Id de fase existente (ausente = sem fase, ou fase nova em `novaFase`). */
  fase?: string;
  /** Nome da fase criada no combo (o app cria ao salvar). */
  novaFase?: string;
  dependeDe: string[];
  checklist: ItemChecklist[];
  /** Ausente = herda o processo do projeto. */
  processo?: Vinculo;
  documento?: DocumentoSei;
  etiquetas: string[];
  observacoes?: string;
  medida: Medida;
}

export interface ContextoDialogoEtapa {
  abrirModal: AbrirModal;
  projeto: ProjetoNaTela;
  /** Etapa sendo editada; ausente = etapa nova. */
  etapa?: Etapa;
  /** Datas da etapa nova ("+ Etapa"). */
  inicial?: { inicio: DataISO; fim: DataISO };
  hoje: DataISO;
  agora: number;
  usuarios(): Promise<UsuarioDaUnidade[]>;
  processos(): Promise<ProcessoDaCaixa[]>;
  /** Etiquetas já usadas no escopo (sugestões). */
  etiquetas: readonly string[];
  historico?: () => Promise<Registro[]>;
  conferirDocumento?: (numero: string) => Promise<DocumentoConferido | null>;
  /** Abre com uma seção aberta ("Histórico" pelo menu do balão). */
  secaoAberta?: "historico";
  salvar(r: ResultadoEtapa): Promise<void>;
  /**
   * Exclui a etapa. A confirmação (ou o aviso "Desfazer") é de quem chama (o app); o diálogo só
   * fecha se a promessa resolver. Se rejeitar, a mensagem aparece no diálogo, que continua aberto.
   */
  excluir?: () => Promise<void>;
}

const MEDIDAS: ReadonlyArray<[Medida, string, string]> = [
  ["manual", "Eu informo", "eu informo"],
  ["tempo", "Pelo tempo decorrido", "pelo tempo"],
  ["checklist", "Pelo checklist", "pelo checklist"],
];

const NOVA_FASE = "nova:";

export function abrirDialogoEtapa(c: ContextoDialogoEtapa): { fechar(): void } {
  const e = c.etapa;
  const doProjeto = c.projeto.etapas;
  const erros = caixaDeErros();

  // ---------- essenciais ----------
  const nome = h("input", { type: "text", class: "spro-campo", name: "nome", maxlength: String(LIMITES.nome), value: e?.nome ?? "" });
  const inicio = h("input", { type: "date", class: "spro-campo", name: "inicio", value: e?.inicio ?? c.inicial?.inicio ?? c.hoje });
  const fim = h("input", { type: "date", class: "spro-campo", name: "fim", value: e?.fim ?? c.inicial?.fim ?? c.hoje });
  const marco = h("input", { type: "checkbox", name: "marco", checked: !!e?.marco });
  const uteis = h("span", { class: "prj-uteis" });
  const campoFim = campo("Término", fim, { classe: "prj-campo-fim" });
  const pintarDatas = () => {
    const i = dataDeFormulario(inicio.value);
    const f = dataDeFormulario(fim.value);
    uteis.replaceChildren(
      icone("relogio", 14),
      i && f && f >= i && diferencaDias(i, f) <= LIMITE_DIAS_ETAPA ? textoDiasUteis(duracaoUteis(i, f)) : "—",
    );
    campoFim.hidden = marco.checked;
    uteis.hidden = marco.checked;
  };
  for (const x of [inicio, fim]) x.addEventListener("input", pintarDatas);
  marco.addEventListener("change", pintarDatas);
  pintarDatas();

  // Responsável: usuários da unidade (pela aba) primeiro, depois os já usados no projeto, e texto livre.
  const pessoas = new Map<string, Responsavel>();
  const guardar = (r: Responsavel) => {
    const k = chaveResponsavel(r);
    if (!pessoas.has(k)) pessoas.set(k, r);
  };
  let daUnidade: UsuarioDaUnidade[] = [];
  const opcoesResp = (): OpcaoCombo[] => {
    const ordem: Responsavel[] = [
      ...daUnidade.map((u) => (u.login ? { login: u.login, nome: u.nome } : { nome: u.nome })),
      ...doProjeto.flatMap((x) => (x.responsavel ? [x.responsavel] : [])),
      ...pessoas.values(),
    ];
    const saida: OpcaoCombo[] = [{ valor: "", rotulo: "Sem responsável" }];
    const vistos = new Set<string>();
    for (const r of ordem) {
      const k = chaveResponsavel(r);
      if (vistos.has(k)) continue;
      vistos.add(k);
      guardar(r);
      saida.push({ valor: k, rotulo: r.nome, descricao: r.login });
    }
    return saida;
  };
  if (e?.responsavel) guardar(e.responsavel);
  const responsavel = criarCombo({
    rotulo: "Responsável",
    opcoes: opcoesResp,
    valor: [e?.responsavel ? chaveResponsavel(e.responsavel) : ""],
    vazio: "Sem responsável",
    icone: "pessoa",
    busca: true,
    criar: (texto) => {
      const r = { nome: texto.trim().slice(0, LIMITES.nome) };
      if (!r.nome) return null;
      guardar(r);
      return { valor: chaveResponsavel(r), rotulo: r.nome };
    },
    rotuloCriar: (t) => `Usar “${t.trim()}”`,
  });
  void c
    .usuarios()
    .then((lista) => {
      daUnidade = lista;
      responsavel.atualizar();
    })
    .catch(() => undefined);

  // Fase: combo que cria (a fase nova só nasce ao salvar).
  const fases: OpcaoCombo[] = [{ valor: "", rotulo: "Sem fase" }, ...c.projeto.fases.map((f) => ({ valor: f.id, rotulo: f.nome }))];
  const fase = criarCombo({
    rotulo: "Fase",
    opcoes: () => fases,
    valor: [e?.fase && c.projeto.fases.some((f) => f.id === e.fase) ? e.fase : ""],
    vazio: "Sem fase",
    icone: "camadas",
    busca: true,
    criar: (texto) => {
      const t = texto.trim().slice(0, LIMITES.nome);
      if (!t) return null;
      const igual = fases.find((f) => normalizarTexto(f.rotulo) === normalizarTexto(t));
      if (igual) return igual;
      const nova = { valor: `${NOVA_FASE}${t}`, rotulo: t };
      fases.push(nova);
      return nova;
    },
    rotuloCriar: (t) => `Criar a fase “${t.trim()}”`,
  });

  // Depende de: chips + "Adicionar…".
  let deps = [...(e?.dependeDe ?? [])].filter((d) => doProjeto.some((x) => x.id === d));
  const nomeDe = (id: string) => doProjeto.find((x) => x.id === id)?.nome ?? id;
  const chips = h("div", { class: "prj-chips-x" });
  const adicionar = criarCombo({
    rotulo: "Adicionar dependência",
    opcoes: () => doProjeto.filter((x) => x.id !== e?.id && !deps.includes(x.id)).map((x) => ({ valor: x.id, rotulo: x.nome })),
    vazio: "Adicionar…",
    busca: true,
    classe: "spro-combo-compacto",
    aoMudar: (v) => {
      const id = v[0];
      if (id && !deps.includes(id)) deps = [...deps, id];
      adicionar.definir([]);
      pintarDeps();
    },
  });
  const pintarDeps = () => {
    chips.replaceChildren(
      ...deps.map((id) =>
        h(
          "span",
          { class: "prj-chip-x" },
          nomeDe(id),
          h(
            "button",
            {
              type: "button",
              class: "spro-botao-icone pequeno",
              "aria-label": `Tirar “${nomeDe(id)}”`,
              onclick: () => {
                deps = deps.filter((d) => d !== id);
                pintarDeps();
              },
            },
            icone("fechar", 12),
          ),
        ),
      ),
      adicionar.el,
    );
  };
  pintarDeps();

  // ---------- seções ----------
  let itens: ItemChecklist[] = (e?.checklist ?? []).map((i) => ({ ...i }));
  const lista = h("div", { class: "prj-checklist" });
  const novoItem = h("input", {
    type: "text",
    class: "spro-campo",
    placeholder: "Adicionar item (Enter)",
    maxlength: String(LIMITES.checklistTexto),
  });
  const secChecklist = secao(
    "checklist",
    iconeProjetos("checklist", 16),
    "Checklist",
    () => (itens.length ? `${itens.filter((i) => i.feito).length} de ${itens.length} feitos` : "nenhum"),
    h("div", { class: "prj-sec-pilha" }, lista, novoItem),
  );
  const pintarItens = () => {
    lista.replaceChildren(
      ...itens.map((it) => {
        const caixa = h("input", { type: "checkbox", checked: it.feito, "aria-label": it.texto });
        caixa.addEventListener("change", () => {
          it.feito = caixa.checked;
          pintarItens();
        });
        return h(
          "div",
          { class: `prj-item${it.feito ? " prj-feito" : ""}` },
          caixa,
          h("span", {}, it.texto),
          h(
            "button",
            {
              type: "button",
              class: "spro-botao-icone pequeno",
              "aria-label": `Tirar “${it.texto}”`,
              onclick: () => {
                itens = itens.filter((x) => x !== it);
                pintarItens();
              },
            },
            icone("fechar", 12),
          ),
        );
      }),
    );
    secChecklist.resumir();
  };
  novoItem.addEventListener("keydown", (ev) => {
    if ((ev as KeyboardEvent).key !== "Enter") return;
    ev.preventDefault();
    const t = novoItem.value.trim();
    if (!t || itens.length >= LIMITES.checklistItens) return;
    itens = [...itens, { id: novoId(), texto: t, feito: false }];
    novoItem.value = "";
    pintarItens();
  });

  const doProjetoProc = c.projeto.projeto.processo;
  const proc = campoProcesso({
    rotulo: "Processo da etapa",
    atual: e?.processo,
    vazio: doProjetoProc?.protocolo || vinculoSemNumero(doProjetoProc) ? "O processo do projeto" : "Sem processo",
    processos: c.processos,
    aoMudar: () => secProc.resumir(),
  });
  // Só o marcador do texto (documento de processo sigiloso sem o número): o campo vazio o mantém ao salvar.
  const semNumero = documentoSemNumero(e?.documento);
  const documento = campoDocumento(e?.documento?.numero ?? "", c.conferirDocumento, () => secProc.resumir(), { semNumero });
  const numeroDoc = () => documento.numero();
  const secProc = secao(
    "processo",
    icone("documento", 16),
    "Processo e documento",
    () => {
      const v = proc.vinculo() ?? doProjetoProc;
      const n = numeroDoc();
      const processo = v?.protocolo || (vinculoSemNumero(v) ? "processo sigiloso" : "sem processo");
      return `${processo} · ${n ? `SEI ${n}` : semNumero ? "documento de processo sigiloso" : "sem documento"}`;
    },
    h(
      "div",
      { class: "prj-sec-pilha" },
      campo("Processo", proc.combo.el, { dica: "Por padrão, o processo do projeto." }),
      campo("Documento relacionado", documento.el, { opcional: "(número SEI)", dica: semNumero ? DICA_DOCUMENTO_SEM_NUMERO : undefined }),
    ),
  );

  const etiquetasBase = [...new Set([...c.etiquetas, ...(e?.etiquetas ?? [])])];
  const etiquetas = criarCombo({
    rotulo: "Etiquetas da etapa",
    opcoes: () => etiquetasBase.map((t) => ({ valor: t, rotulo: t })),
    valor: e?.etiquetas ?? [],
    multiplo: true,
    vazio: "Escolher ou criar etiqueta…",
    icone: "etiqueta",
    criar: (texto) => {
      const t = texto.trim().slice(0, LIMITES.etiquetaTexto);
      if (!t) return null;
      if (!etiquetasBase.includes(t)) etiquetasBase.push(t);
      return { valor: t, rotulo: t };
    },
    aoMudar: () => secEtiquetas.resumir(),
  });
  const secEtiquetas = secao(
    "etiquetas",
    icone("etiqueta", 16),
    "Etiquetas",
    () => etiquetas.valor().join(", ") || "nenhuma",
    etiquetas.el,
  );

  const obs = h("textarea", {
    class: "spro-campo",
    rows: "3",
    placeholder: "Anotações livres sobre a etapa",
    maxlength: String(LIMITES.observacoes),
    value: e?.observacoes ?? "",
  });
  const secObs = secao(
    "observacoes",
    icone("nota", 16),
    "Observações",
    () => {
      const t = obs.value.trim();
      return t ? (t.length > 40 ? `${t.slice(0, 40)}…` : t) : "—";
    },
    obs,
  );
  obs.addEventListener("input", () => secObs.resumir());

  let medida: Medida = e?.medida ?? "manual";
  const botoesMedida = MEDIDAS.map(([valor, rotulo]) =>
    h(
      "button",
      {
        type: "button",
        "aria-pressed": String(valor === medida),
        onclick: () => {
          medida = valor;
          for (const [i, b] of botoesMedida.entries()) b.setAttribute("aria-pressed", String(MEDIDAS[i]?.[0] === medida));
          secMedida.resumir();
        },
      },
      rotulo,
    ),
  );
  const secMedida = secao(
    "medida",
    iconeProjetos("progresso", 16),
    "Como medir o progresso",
    () => MEDIDAS.find(([v]) => v === medida)?.[2] ?? "",
    h(
      "div",
      { class: "prj-sec-pilha" },
      h("div", { class: "spro-segmentado" }, ...botoesMedida),
      h(
        "div",
        { class: "prj-dica" },
        "“Eu informo” usa a régua do balão. “Pelo tempo” vai de 0% no início a 100% no término (o legado chamava de automático).",
      ),
    ),
  );

  let registros: Registro[] = [];
  const listaHist = h("div", { class: "prj-hist" }, h("div", { class: "prj-dica" }, "Carregando…"));
  const secHist = e
    ? secao(
        "historico",
        icone("historico", 16),
        "Histórico",
        () => (registros[0] ? resumoDoUltimoRegistro(registros[0], c.agora) : "—"),
        listaHist,
        c.secaoAberta === "historico",
      )
    : null;
  if (e && c.historico)
    void c
      .historico()
      .then((todos) => {
        registros = todos.filter((r) => r.alvo === e.id);
        listaHist.replaceChildren(
          ...(registros.length
            ? registros.map((r) =>
                h("div", {}, h("b", {}, quemDoRegistro(r)), ` · ${dataCurtaDoCarimbo(r.quando)} · ${textoDoRegistro(r, "etapa")}`),
              )
            : [h("div", { class: "prj-dica" }, "Nenhuma alteração registrada.")]),
        );
        secHist?.resumir();
      })
      .catch(() => listaHist.replaceChildren(h("div", { class: "prj-dica" }, "Não foi possível ler o histórico.")));

  // ---------- salvar ----------
  const validar = (): string[] => {
    const m: string[] = [];
    if (!nome.value.trim()) m.push("Informe o nome da etapa.");
    if (proc.invalido()) m.push(ERRO_PROTOCOLO);
    if (documento.invalido()) m.push(ERRO_DOCUMENTO);
    const i = dataDeFormulario(inicio.value);
    const f = marco.checked ? i : dataDeFormulario(fim.value);
    if (!i) m.push("Informe uma data de início válida (entre 2000 e 2100).");
    if (!marco.checked && !f) m.push("Informe uma data de término válida (entre 2000 e 2100).");
    if (i && f && f < i) m.push("O término não pode ser antes do início.");
    else if (i && f && diferencaDias(i, f) > LIMITE_DIAS_ETAPA) m.push("A etapa pode durar no máximo cerca de 10 anos.");
    if (etiquetas.valor().length > LIMITES.etiquetas) m.push(`Use no máximo ${LIMITES.etiquetas} etiquetas por etapa.`);
    return m;
  };
  const resultado = (): ResultadoEtapa => {
    const i = dataDeFormulario(inicio.value)!;
    const valorFase = fase.valor()[0] ?? "";
    const chaveResp = responsavel.valor()[0] ?? "";
    const n = numeroDoc();
    const r: ResultadoEtapa = {
      nome: nome.value.trim(),
      inicio: i,
      fim: marco.checked ? i : dataDeFormulario(fim.value)!,
      marco: marco.checked,
      dependeDe: deps,
      checklist: itens,
      etiquetas: etiquetas.valor(),
      medida,
    };
    if (chaveResp) r.responsavel = pessoas.get(chaveResp);
    if (valorFase.startsWith(NOVA_FASE)) r.novaFase = valorFase.slice(NOVA_FASE.length);
    else if (valorFase) r.fase = valorFase;
    const v = proc.vinculo();
    if (v) r.processo = v;
    if (n) r.documento = n === e?.documento?.numero ? e.documento : { numero: n };
    else if (semNumero) r.documento = e?.documento;
    if (obs.value.trim()) r.observacoes = obs.value.trim();
    return r;
  };
  let modal: { fechar(): void } | null = null;
  const salvar = h("button", { type: "button", class: "spro-botao primario" }, "Salvar");
  salvar.addEventListener("click", async () => {
    const m = validar();
    erros.mostrar(m);
    if (m.length) return;
    salvar.disabled = true;
    try {
      await c.salvar(resultado());
      modal?.fechar();
    } catch (erro) {
      erros.mostrar(mensagensDoErro(erro));
    } finally {
      salvar.disabled = false;
    }
  });
  const excluirEtapa = async (botaoExcluir: HTMLButtonElement) => {
    if (!c.excluir) return;
    botaoExcluir.disabled = true;
    try {
      await c.excluir();
      modal?.fechar();
    } catch (erro) {
      erros.mostrar(mensagensDoErro(erro));
    } finally {
      botaoExcluir.disabled = false;
    }
  };
  const conteudo = h(
    "div",
    { class: "prj-form prj-form-etapa" },
    campo("Nome", nome),
    linhaDeCampos(campo("Início", inicio), campoFim, uteis),
    h("label", { class: "prj-check" }, marco, "É um marco (uma data só, como “Publicação no DOU”)"),
    linhaDeCampos(campo("Responsável", responsavel.el), campo("Fase", fase.el)),
    campo("Depende de", chips, { opcional: "(só começa depois destas)" }),
    h("div", { class: "prj-secoes" }, secChecklist.el, secProc.el, secEtiquetas.el, secObs.el, secMedida.el, secHist?.el ?? null),
    erros.el,
    h(
      "div",
      { class: "spro-dialogo-rodape" },
      e && c.excluir
        ? h(
            "button",
            {
              type: "button",
              class: "spro-botao fantasma perigo spro-esquerda",
              onclick: (ev: Event) => void excluirEtapa(ev.currentTarget as HTMLButtonElement),
            },
            icone("lixeira", 15),
            "Excluir",
          )
        : null,
      h("button", { type: "button", class: "spro-botao", onclick: () => modal?.fechar() }, "Cancelar"),
      salvar,
    ),
  );
  pintarItens();
  modal = c.abrirModal({ titulo: "Etapa", icone: "calendario", conteudo });
  return { fechar: () => modal?.fechar() };
}
