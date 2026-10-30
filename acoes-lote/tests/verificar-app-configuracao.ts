/**
 * Provas da tela de configuracao da fila: DOM do linkedom e RPC falso que registra as chamadas.
 */

import { AppAcoesLote, type ContextoApp, type EstadoApp } from "../src/app/app";
import { montarConfiguracao } from "../src/app/configuracao";
import type { AcaoId } from "../src/modelo/acoes";
import type { LinhaDoc } from "../src/modelo/documentos";
import type { ParamsEtapa } from "../src/modelo/fila";
import { botao, checar, combo, disparar, escolherCombo, igual, instalarDom, secao, tique } from "./util";

const CTX: ContextoApp = {
  host: "sei.x.gov.br",
  login: "ana",
  nomeUsuario: "Ana Silva",
  unidadeSigla: "ANA/SUP",
  temaEscuro: false,
  idProcedimento: "99",
  origem: "https://sei.x.gov.br/sei/controlador.php",
};

function linha(n: number, o: Partial<LinhaDoc> = {}): LinhaDoc {
  return {
    id: String(1000 + n),
    numero: String(5000 + n),
    titulo: `Despacho ${n}`,
    tipo: "Despacho",
    externo: false,
    formato: "html",
    nivel: "publico",
    assinado: false,
    assinaturas: [],
    cancelado: false,
    unidade: "ANA/SUP",
    pasta: null,
    data: `2026-09-0${n}`,
    ...o,
  };
}

/** O 5001 e externo (nao assina); o 5002 e o primeiro elegivel para assinar. */
function estado(etapas: ParamsEtapa[], o: Partial<EstadoApp> = {}): EstadoApp {
  return {
    ctx: CTX,
    protocolo: "00001.000001/2026-11",
    sigiloso: false,
    linhas: [linha(1, { externo: true, formato: "pdf" }), linha(2), linha(3)],
    selecionados: new Set(["1001", "1002", "1003"]),
    filtro: {},
    etapas,
    planos: [],
    ...o,
  };
}

interface Chamada {
  op: string;
  args: Record<string, unknown>;
}

function rpcFalso(respostas: Record<string, (a: Record<string, unknown>) => unknown> = {}) {
  const chamadas: Chamada[] = [];
  const padrao: Record<string, (a: Record<string, unknown>) => unknown> = {
    cargos: () => ["Analista", "Chefe"],
    blocos: () => [
      { id: "7", texto: "7 - Bloco A" },
      { id: "8", texto: "8 - Bloco B" },
    ],
    hipoteses: () => [
      { id: "11", texto: "Informacao Pessoal" },
      { id: "12", texto: "Sigilo Fiscal" },
    ],
    contatos: (a) => [{ id: "c1", texto: `Contato ${a.termo}` }],
    assuntos: (a) => [{ id: "a1", texto: `Assunto ${a.termo}` }],
    destino: (a) => ({ situacao: "ok", destino: { protocolo: a.protocolo, idProcedimento: "777", tipo: "Licitacao" } }),
  };
  return {
    chamadas,
    rpc: {
      async chamar<T>(op: string, args?: unknown): Promise<T> {
        chamadas.push({ op, args: (args ?? {}) as Record<string, unknown> });
        const f = respostas[op] ?? padrao[op];
        if (!f) throw new Error(`op ${op} sem resposta`);
        return f((args ?? {}) as Record<string, unknown>) as T;
      },
    },
  };
}

function montar(e: EstadoApp, respostas?: Record<string, (a: Record<string, unknown>) => unknown>) {
  const doc = instalarDom('<html><body><div id="r"></div></body></html>');
  const f = rpcFalso(respostas);
  const eventos = { voltou: 0, previas: [] as Array<string | undefined> };
  const el = montarConfiguracao(doc, e, {
    rpc: f.rpc,
    voltar: () => {
      eventos.voltou += 1;
    },
    previa: (s) => {
      eventos.previas.push(s);
    },
  });
  doc.getElementById("r")!.append(el);
  return { doc, el, eventos, chamadas: f.chamadas };
}

const erros = (el: ParentNode) => [...el.querySelectorAll(".al-erros li")].map((l) => (l.textContent ?? "").trim());
const ordem = (el: ParentNode) => [...el.querySelectorAll<HTMLElement>(".al-etapa")].map((c) => c.getAttribute("data-acao"));
const cartao = (el: ParentNode, acao: AcaoId) => el.querySelector<HTMLElement>(`.al-etapa[data-acao="${acao}"]`)!;

function digitar(c: HTMLInputElement | HTMLTextAreaElement, valor: string, evento = "input"): void {
  c.value = valor;
  disparar(c, evento);
}

export async function verificarAppConfiguracao(): Promise<void> {
  secao("configuracao: validacao e Ver previa");
  {
    const { el } = montar(estado([]));
    igual("fila vazia", erros(el), ["Escolha ao menos uma ação."]);
    checar("Ver previa desabilitada", botao(el, "Ver prévia")!.hasAttribute("disabled"));
    checar("sem botao Cancelar", !botao(el, "Cancelar"));
  }
  {
    const { el } = montar(estado([{ acao: "baixar", modo: "arquivos" }, { acao: "ciencia" }]));
    igual("final fora do fim", erros(el), ["Baixar precisa ser a última etapa."]);
    checar("desabilitada com erro", botao(el, "Ver prévia")!.hasAttribute("disabled"));
  }
  {
    const e = estado([{ acao: "ciencia" }]);
    const { el, eventos } = montar(e);
    igual("sem erros", erros(el), []);
    const b = botao(el, "Ver prévia")!;
    checar("habilitada", !b.hasAttribute("disabled"));
    b.click();
    igual("previa sem senha", eventos.previas, [undefined]);
    botao(el, "Voltar")!.click();
    igual("voltar", eventos.voltou, 1);
  }

  secao("configuracao: ordem e adicionar etapa");
  {
    const e = estado([{ acao: "ciencia" }, { acao: "duplicar" }, { acao: "assinar", cargo: "Analista" }]);
    const { el } = montar(e);
    igual("ordem inicial", ordem(el), ["ciencia", "duplicar", "assinar"]);
    botao(cartao(el, "duplicar"), "Subir")!.click();
    igual("subir", ordem(el), ["duplicar", "ciencia", "assinar"]);
    igual(
      "estado acompanha",
      e.etapas.map((x) => x.acao),
      ["duplicar", "ciencia", "assinar"],
    );
    botao(cartao(el, "duplicar"), "Descer")!.click();
    igual("descer", ordem(el), ["ciencia", "duplicar", "assinar"]);
    checar("primeiro nao sobe", botao(cartao(el, "ciencia"), "Subir")!.hasAttribute("disabled"));
    checar("ultimo nao desce", botao(cartao(el, "assinar"), "Descer")!.hasAttribute("disabled"));
    botao(cartao(el, "duplicar"), "Remover")!.click();
    igual("remover", ordem(el), ["ciencia", "assinar"]);
    // Adicionar etapa nao oferece o que ja esta na fila.
    combo(el, "Adicionar etapa")!.click();
    const ofertas = [...el.ownerDocument.querySelectorAll(".spro-combo-pop [role=option]")].map((o) => o.getAttribute("data-valor"));
    checar("oferece duplicar", ofertas.includes("duplicar"));
    checar("nao oferece ciencia nem assinar", !ofertas.includes("ciencia") && !ofertas.includes("assinar"));
    combo(el, "Adicionar etapa")!.click();
    escolherCombo(el, "Adicionar etapa", "excluir");
    igual("adicionada ao fim", ordem(el), ["ciencia", "assinar", "excluir"]);
    igual("com valores iniciais", e.etapas[2], { acao: "excluir" });
  }

  secao("configuracao: assinar (cargo e senha)");
  {
    const e = estado([{ acao: "assinar", cargo: "" }]);
    const { el, eventos, chamadas } = montar(e);
    await tique();
    igual(
      "cargos pelo primeiro documento elegivel",
      chamadas.filter((c) => c.op === "cargos").map((c) => c.args),
      [{ numero: "5002" }],
    );
    igual("erro de cargo", erros(el), ["Escolha o cargo da assinatura."]);
    escolherCombo(el, "Cargo", "Chefe");
    igual("cargo gravado", e.etapas[0], { acao: "assinar", cargo: "Chefe" });
    igual("sem erros", erros(el), []);
    const s = el.querySelector<HTMLInputElement>('input[type="password"]')!;
    igual("autocomplete", s.getAttribute("autocomplete"), "off");
    digitar(s, "segredo123");
    checar("senha fora do estado", !JSON.stringify({ ...e, selecionados: [...e.selecionados] }).includes("segredo123"));
    botao(el, "Ver prévia")!.click();
    igual("senha vai por argumento", eventos.previas, ["segredo123"]);
    igual("campo limpo ao sair", s.value, "");
  }
  {
    const e = estado([{ acao: "assinar", cargo: "Chefe" }]);
    const { el, eventos } = montar(e);
    const s = el.querySelector<HTMLInputElement>('input[type="password"]')!;
    digitar(s, "outra");
    botao(el, "Voltar")!.click();
    igual("voltar limpa o campo", s.value, "");
    igual("voltar nao manda senha", eventos.previas, []);
  }
  {
    const e = estado([{ acao: "assinar", cargo: "Chefe" }]);
    const { el, chamadas } = montar(e, {
      cargos: () => {
        throw new Error("falhou");
      },
    });
    await tique();
    checar("falha de cargos aparece", (el.textContent ?? "").includes("falhou"));
    igual("uma tentativa", chamadas.filter((c) => c.op === "cargos").length, 1);
  }

  secao("configuracao: alterar nivel e hipotese");
  {
    const e = estado([{ acao: "alterar-nivel", nivel: "restrito" }], { selecionados: new Set(["1002", "1003"]) });
    const { el, chamadas } = montar(e);
    await tique();
    igual("erro de hipotese", erros(el), ["Nível restrito exige hipótese legal."]);
    igual("hipoteses do primeiro elegivel", chamadas.find((c) => c.op === "hipoteses")!.args, { nivel: "restrito", numero: "5002" });
    escolherCombo(el, "Hipótese legal", "12");
    igual("hipotese gravada", e.etapas[0], { acao: "alterar-nivel", nivel: "restrito", hipotese: "12" });
    igual("sem erros", erros(el), []);
    const pub = el.querySelector<HTMLInputElement>('input[type="radio"][value="publico"]')!;
    pub.checked = true;
    disparar(pub, "change");
    igual("publico limpa a hipotese", e.etapas[0], { acao: "alterar-nivel", nivel: "publico" });
    checar("sem combo de hipotese", !combo(el, "Hipótese legal"));
    checar("sem opcao Sigiloso", !el.querySelector('input[value="sigiloso"]'));
  }

  secao("configuracao: cancelar documento e baixar");
  {
    const e = estado([{ acao: "cancelar-documento", motivo: "" }]);
    const { el } = montar(e);
    igual("sem motivo", erros(el), ["Informe o motivo do cancelamento."]);
    digitar(el.querySelector<HTMLInputElement>('[aria-label="Motivo do cancelamento"]')!, "Duplicado");
    igual("motivo gravado", e.etapas[0], { acao: "cancelar-documento", motivo: "Duplicado" });
    igual("sem erros", erros(el), []);
  }
  {
    const e = estado([{ acao: "baixar", modo: "arquivos" }]);
    const { el } = montar(e);
    const zip = el.querySelector<HTMLInputElement>('input[type="radio"][value="zip"]')!;
    zip.checked = true;
    disparar(zip, "change");
    igual("zip", e.etapas[0], { acao: "baixar", modo: "zip" });
  }

  secao("configuracao: incluir em bloco");
  {
    const e = estado([{ acao: "incluir-bloco", bloco: { id: "", texto: "" } }]);
    const { el, chamadas } = montar(e);
    await tique();
    igual("blocos lidos uma vez", chamadas.filter((c) => c.op === "blocos").length, 1);
    igual("pede bloco", erros(el), ["Escolha o bloco de assinatura."]);
    escolherCombo(el, "Bloco", "8");
    igual("bloco existente gravado", e.etapas[0], { acao: "incluir-bloco", bloco: { id: "8", texto: "8 - Bloco B" } });
    igual("sem erros", erros(el), []);
    const novo = el.querySelector<HTMLInputElement>('input[type="radio"][value="novo"]')!;
    novo.checked = true;
    disparar(novo, "change");
    igual("novo bloco sem descricao", erros(el), ["Informe a descrição do novo bloco."]);
    digitar(el.querySelector<HTMLInputElement>('[aria-label="Descrição do novo bloco"]')!, "Lote de setembro");
    igual("novo gravado", e.etapas[0], { acao: "incluir-bloco", bloco: { novo: "Lote de setembro" } });
    igual("sem erros", erros(el), []);
  }

  secao("configuracao: alterar dados");
  {
    const e = estado([{ acao: "alterar-dados" }]);
    const { el } = montar(e);
    igual("nada para alterar", erros(el), ["Nada para alterar."]);
    digitar(el.querySelector<HTMLInputElement>('[aria-label="Descrição"]')!, "Nova descricao");
    digitar(el.querySelector<HTMLTextAreaElement>('[aria-label="Observação"]')!, "Obs");
    igual("descricao e observacao", e.etapas[0], { acao: "alterar-dados", descricao: "Nova descricao", observacao: "Obs" });
    igual("sem erros", erros(el), []);
    digitar(el.querySelector<HTMLInputElement>('[aria-label="Descrição"]')!, "");
    checar("em branco volta a manter", (e.etapas[0] as { descricao?: string }).descricao === undefined);
    igual(
      "limites do SEI no campo (a prévia mostra o que grava)",
      [
        el.querySelector('[aria-label="Descrição"]')!.getAttribute("maxlength"),
        el.querySelector('[aria-label="Observação"]')!.getAttribute("maxlength"),
      ],
      ["250", "1000"],
    );
  }
  {
    const e = estado([{ acao: "alterar-dados", observacao: "x" }]);
    const AVISO = "Isso apaga dados dos documentos e não pode ser desfeito.";
    const { el } = montar(e);
    const aviso = () =>
      [...el.querySelectorAll(".al-aviso")].filter((a) => !a.hasAttribute("hidden")).map((a) => (a.textContent ?? "").trim());
    igual("sem aviso em Acrescentar", aviso(), []);
    const modo = (campo: string, valor: string) => {
      const r = el.querySelector<HTMLInputElement>(`input[type="radio"][data-campo="${campo}"][value="${valor}"]`)!;
      r.checked = true;
      disparar(r, "change");
    };
    modo("interessados", "substituir");
    igual("aviso em Substituir", aviso(), [AVISO]);
    modo("interessados", "acrescentar");
    igual("aviso some em Acrescentar", aviso(), []);
    modo("assuntos", "remover");
    igual("aviso em Remover", aviso(), [AVISO]);
  }

  secao("configuracao: busca de interessados e assuntos (debounce e minimo)");
  {
    const e = estado([{ acao: "alterar-dados" }], { selecionados: new Set(["1002", "1003"]) });
    const { el, chamadas } = montar(e);
    const campo = el.querySelector<HTMLInputElement>('[aria-label="Buscar interessados"]')!;
    digitar(campo, "ab");
    await tique(380);
    igual("menos de 3 caracteres nao chama", chamadas.filter((c) => c.op === "contatos").length, 0);
    checar("dica de minimo", (el.textContent ?? "").includes("Digite ao menos 3 caracteres"));
    digitar(campo, "abc");
    digitar(campo, "abcd");
    digitar(campo, "abcde");
    await tique(100);
    igual("antes dos 300 ms nada", chamadas.filter((c) => c.op === "contatos").length, 0);
    await tique(300);
    const cont = chamadas.filter((c) => c.op === "contatos");
    igual(
      "uma chamada so, com o ultimo termo e o primeiro elegivel",
      cont.map((c) => c.args),
      [{ termo: "abcde", numero: "5002" }],
    );
    const res = el.querySelector<HTMLElement>('.al-resultados [data-id="c1"]');
    checar("resultado listado", !!res && (res.textContent ?? "").includes("Contato abcde"));
    res!.click();
    igual("interessado adicionado (acrescentar)", e.etapas[0], {
      acao: "alterar-dados",
      interessados: { modo: "acrescentar", itens: [{ id: "c1", texto: "Contato abcde" }] },
    });
    igual("sem erros", erros(el), []);
    botao(el, "Remover Contato abcde")!.click();
    checar("remover o item limpa o campo", (e.etapas[0] as { interessados?: unknown }).interessados === undefined);
    const as = el.querySelector<HTMLInputElement>('[aria-label="Buscar assuntos"]')!;
    digitar(as, "meio ambiente");
    await tique(350);
    igual(
      "assuntos chamado",
      chamadas.filter((c) => c.op === "assuntos").map((c) => c.args),
      [{ termo: "meio ambiente", numero: "5002" }],
    );
  }

  secao("configuracao: mover");
  {
    const e = estado([{ acao: "mover", destino: { protocolo: "", idProcedimento: "", tipo: "" }, motivo: "" }], {
      selecionados: new Set(["1002", "1003"]),
    });
    const { el, chamadas } = montar(e);
    igual("destino e motivo pendentes", erros(el), ["Informe o motivo da movimentação.", "Informe o processo de destino."]);
    const campo = el.querySelector<HTMLInputElement>('[aria-label="Processo de destino"]')!;
    digitar(campo, "00002.000002/2026-22", "change");
    await tique();
    igual(
      "destino chamado",
      chamadas.filter((c) => c.op === "destino").map((c) => c.args),
      [{ protocolo: "00002.000002/2026-22", numero: "5002" }],
    );
    const txt = el.textContent ?? "";
    checar("mostra protocolo e tipo", txt.includes("00002.000002/2026-22") && txt.includes("Licitacao"));
    igual("destino gravado", (e.etapas[0] as { destino: unknown }).destino, {
      protocolo: "00002.000002/2026-22",
      idProcedimento: "777",
      tipo: "Licitacao",
    });
    igual("falta so o motivo", erros(el), ["Informe o motivo da movimentação."]);
    digitar(el.querySelector<HTMLInputElement>('[aria-label="Motivo da movimentação"]')!, "Juntada errada");
    igual("sem erros", erros(el), []);
    digitar(campo, "00003.000003/2026-33");
    igual(
      "editar o campo invalida o destino resolvido",
      (e.etapas[0] as { destino: { idProcedimento: string } }).destino.idProcedimento,
      "",
    );
    checar("previa bloqueada de novo", botao(el, "Ver prévia")!.hasAttribute("disabled"));
  }
  {
    const e = estado([{ acao: "mover", destino: { protocolo: "", idProcedimento: "", tipo: "" }, motivo: "m" }]);
    const { el } = montar(e, {
      destino: () => ({ situacao: "erro", erro: "Destino e o proprio processo." }),
    });
    digitar(el.querySelector<HTMLInputElement>('[aria-label="Processo de destino"]')!, "00001.000001/2026-11", "change");
    await tique();
    checar("mostra a mensagem de erro", (el.textContent ?? "").includes("Destino e o proprio processo."));
    checar("previa bloqueada", botao(el, "Ver prévia")!.hasAttribute("disabled"));
  }

  secao("configuracao: correcoes da revisao");
  {
    // 1) destino A resolvido, vira B, volta a A: precisa resolver de novo.
    const A = "00002.000002/2026-22";
    const e = estado([{ acao: "mover", destino: { protocolo: A, idProcedimento: "777", tipo: "Licitacao" }, motivo: "m" }], {
      selecionados: new Set(["1002"]),
    });
    const { el, chamadas } = montar(e);
    const campo = el.querySelector<HTMLInputElement>('[aria-label="Processo de destino"]')!;
    digitar(campo, "00003.000003/2026-33");
    digitar(campo, A, "change");
    await tique();
    igual("voltar ao destino anterior resolve de novo", chamadas.filter((c) => c.op === "destino").length, 1);
    igual("destino de volta", (e.etapas[0] as { destino: { idProcedimento: string } }).destino.idProcedimento, "777");
    igual("sem erros", erros(el), []);
  }
  {
    // 2) resolucao em voo que sobrevive a um redesenho nao vale.
    let liberar: () => void = () => undefined;
    const e = estado([{ acao: "ciencia" }, { acao: "mover", destino: { protocolo: "", idProcedimento: "", tipo: "" }, motivo: "m" }], {
      selecionados: new Set(["1002"]),
    });
    const { el } = montar(e, {
      destino: (a) =>
        new Promise((ok) => {
          liberar = () => ok({ situacao: "ok", destino: { protocolo: a.protocolo, idProcedimento: "777", tipo: "T" } });
        }),
    });
    const antigo = el.querySelector<HTMLInputElement>('[aria-label="Processo de destino"]')!;
    digitar(antigo, "00002.000002/2026-22", "change");
    await tique();
    botao(cartao(el, "mover"), "Subir")!.click();
    const novo = el.querySelector<HTMLInputElement>('[aria-label="Processo de destino"]')!;
    digitar(novo, "00003.000003/2026-33");
    liberar();
    await tique();
    igual("resultado de A nao aplicado", (e.etapas[0] as { destino: { idProcedimento: string } }).destino.idProcedimento, "");
    checar("previa segue bloqueada", botao(el, "Ver prévia")!.hasAttribute("disabled"));
  }
  {
    // 3) a busca pendente nao chama o SEI depois de a tela sair.
    const e = estado([{ acao: "alterar-dados" }], { selecionados: new Set(["1002"]) });
    const { doc, el, chamadas } = montar(e);
    digitar(el.querySelector<HTMLInputElement>('[aria-label="Buscar interessados"]')!, "abcd");
    doc.getElementById("r")!.replaceChildren();
    await tique(380);
    igual("nenhuma busca apos sair", chamadas.filter((c) => c.op === "contatos").length, 0);
  }
  {
    // 4) remover a etapa Assinar limpa a senha.
    const e = estado([{ acao: "assinar", cargo: "Chefe" }, { acao: "ciencia" }]);
    const { el } = montar(e);
    const s = el.querySelector<HTMLInputElement>('input[type="password"]')!;
    digitar(s, "segredo");
    botao(cartao(el, "assinar"), "Remover")!.click();
    igual("senha limpa ao remover Assinar", s.value, "");
  }

  secao("configuracao: via AppAcoesLote");
  {
    const doc = instalarDom('<html><body><div id="r"></div></body></html>');
    const f = rpcFalso({
      arvore: () => ({ protocolo: "00001.000001/2026-11", sigiloso: false, linhas: [linha(2)] }),
    });
    const app = new AppAcoesLote(doc.getElementById("r")!, { rpc: f.rpc, ctx: CTX, fechar: () => undefined });
    await app.iniciar();
    app.estado!.selecionados.add("1002");
    botao(doc, "Atualizar")!.click();
    await tique();
    botao(doc, "Baixar (1)")!.click();
    checar("tela de configuracao", app.tela === "configuracao");
    igual(
      "fila comeca com a acao",
      app.estado!.etapas.map((x) => x.acao),
      ["baixar"],
    );
    botao(doc, "Voltar")!.click();
    checar("voltou para a selecao", app.tela === "selecao");
  }
}
