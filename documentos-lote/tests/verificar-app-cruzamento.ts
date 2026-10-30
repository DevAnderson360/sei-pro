/**
 * Provas da etapa 3 do app, Cruzamento e destino: a tela direta (estado montado à mão, RPC falso) e, no fim, o app
 * inteiro (rótulo do botão do rodapé, invalidação quando o modelo ou a planilha mudam).
 */

import { ETAPAS } from "@dl/app/app";
import {
  ROTULO_COLUNA_HIPOTESE,
  ROTULO_COLUNA_NIVEL,
  ROTULO_COLUNA_NOME,
  ROTULO_COLUNA_PROCESSO,
  ROTULO_TIPO_PROCESSO,
  rotuloCampo,
  TelaCruzamento,
} from "@dl/app/cruzamento";
import type { EstadoApp } from "@dl/app/estado";
import { MAX_DESCRICAO, MAX_ESPECIFICACAO } from "@dl/modelo/constantes";
import { estimarDuracao, limitarPausa } from "@dl/modelo/estimativa";
import type { Modelo } from "@dl/sei/modelo";
import { botao, checar, combo, disparar, escolherCombo, igual, instalarDom, secao, tique } from "./util";
import { ate, montar, naPlanilha, utf8 } from "./verificar-app-modelo";

const MODELO: Modelo = {
  origem: "documento",
  numero: "0000123",
  titulo: "Ofício 12",
  tipoId: "6",
  tipoNome: "Ofício",
  campos: ["nome", "cargo", "valor"],
};
const COLUNAS = ["nome", "cargo", "Processo SEI", "nivel", "hip", "outra"];
const TIPOS = [
  { id: "10", nome: "Contratação" },
  { id: "11", nome: "Pessoal" },
];

function tela(parcial: Partial<EstadoApp> = {}) {
  const doc = instalarDom('<html><body><div id="app"></div></body></html>');
  const estado: EstadoApp = {
    modelo: MODELO,
    colunas: COLUNAS,
    registros: Array.from({ length: 120 }, () => ({})),
    ...parcial,
  };
  const chamadas: string[] = [];
  const t = { mudou: 0 };
  const rpc = {
    chamar: (async (op: string) => {
      chamadas.push(op);
      await tique(1);
      if (op === "tiposProcesso") return { situacao: "ok", tipos: TIPOS };
      return null;
    }) as never,
  };
  const criar = () => new TelaCruzamento({ rpc, estado, aoMudar: () => t.mudou++ });
  const tl = criar();
  doc.getElementById("app")!.append(tl.el);
  const raiz = tl.el;
  const radio = (v: string) => raiz.querySelector<HTMLInputElement>(`input[type="radio"][value="${v}"]`)!;
  const marcar = (v: string) => {
    radio(v).checked = true;
    disparar(radio(v), "change");
  };
  const visivel = (el: Element | null | undefined) => !!el && !el.closest("[hidden]");
  const pausa = () => raiz.querySelector<HTMLInputElement>('input[type="number"]')!;
  const descricao = () => raiz.querySelector<HTMLInputElement>('input[name="dl-descricao"]')!;
  const especificacao = () => raiz.querySelector<HTMLInputElement>('input[name="dl-especificacao"]')!;
  const digitar = (el: HTMLInputElement, valor: string) => {
    el.value = valor;
    disparar(el, "input");
    disparar(el, "change");
  };
  return { doc, estado, chamadas, t, tl, raiz, radio, marcar, visivel, pausa, descricao, especificacao, digitar, criar, rpc };
}

export async function verificarAppCruzamento(): Promise<void> {
  secao("estimativa: pausa e duração");
  igual("pausa 50 vira 200", limitarPausa(50), 200);
  igual("pausa 20000 vira 10000", limitarPausa(20000), 10000);
  igual("pausa vazia vira 500", limitarPausa(""), 500);
  igual("pausa 700", limitarPausa("700"), 700);
  checar("duração curta", estimarDuracao(10, 500) === "menos de um minuto", estimarDuracao(10, 500));
  checar("duração em minutos", /^cerca de \d+ minutos?$/.test(estimarDuracao(200, 500)), estimarDuracao(200, 500));
  checar("duração em horas", /^cerca de \d+ h/.test(estimarDuracao(2000, 10000)), estimarDuracao(2000, 10000));

  secao("cruzamento: campos e coluna do nome");
  {
    const m = tela();
    checar("nome igual pré-seleciona (nome)", combo(m.raiz, rotuloCampo("nome"))?.textContent?.includes("nome") === true);
    checar("campo sem coluna igual fica sem escolha (valor)", !combo(m.raiz, rotuloCampo("valor"))?.textContent?.includes("outra"));
    checar("sem coluna do nome, Avançar desabilitado", m.tl.completa() === false);
    checar("sem coluna do nome, não há config", m.estado.config === undefined);
    escolherCombo(m.raiz, ROTULO_COLUNA_NOME, "nome");
    checar("com a coluna do nome, completa", m.tl.completa() === true);
    igual("config: campos cruzados só os com coluna", m.estado.config?.camposCruzados, { nome: "nome", cargo: "cargo" });
    igual("config: destino padrão é a tela", m.estado.config?.destino, { tipo: "tela" });
    igual("config: coluna do nome", m.estado.config?.colunaNome, "nome");
    checar("config leva o modelo", m.estado.config?.modelo === MODELO);
    igual("config: pausa padrão 500", m.estado.config?.pausa, 500);
    checar("avisou o app", m.t.mudou > 0);
    escolherCombo(m.raiz, rotuloCampo("valor"), "outra");
    igual("cruzar um campo à mão", m.estado.config?.camposCruzados.valor, "outra");
    escolherCombo(m.raiz, rotuloCampo("cargo"), "__nenhuma__");
    checar("desfazer o cruzamento tira o campo", !("cargo" in (m.estado.config?.camposCruzados ?? {})));
  }

  secao("cruzamento: descrição");
  {
    const m = tela();
    escolherCombo(m.raiz, ROTULO_COLUNA_NOME, "nome");
    m.digitar(m.descricao(), "Contrato ##nome##");
    igual("descrição aceita ##coluna##", m.estado.config?.modeloDescricao, "Contrato ##nome##");
    m.digitar(m.descricao(), "x".repeat(300));
    igual("descrição de 300 é cortada em MAX_DESCRICAO no valor da config", m.estado.config?.modeloDescricao.length, MAX_DESCRICAO);
    igual("MAX_DESCRICAO é 250", MAX_DESCRICAO, 250);
    m.digitar(m.descricao(), "");
    igual("descrição vazia é permitida", m.estado.config?.modeloDescricao, "");
  }

  secao("cruzamento: destino");
  {
    const m = tela({ colunas: ["nome", "cargo", "outra", "nivel", "hip"] });
    escolherCombo(m.raiz, ROTULO_COLUNA_NOME, "nome");
    checar("três opções de destino, uma marcada", m.raiz.querySelectorAll('input[type="radio"]').length === 3 && m.radio("tela").checked);
    checar(
      "destino tela: esconde tipo de processo e coluna do processo",
      !m.visivel(combo(m.raiz, ROTULO_TIPO_PROCESSO)) && !m.visivel(combo(m.raiz, ROTULO_COLUNA_PROCESSO)),
    );
    m.marcar("novo-processo");
    checar(
      "novo processo: mostra o tipo e esconde a coluna",
      m.visivel(combo(m.raiz, ROTULO_TIPO_PROCESSO)) && !m.visivel(combo(m.raiz, ROTULO_COLUNA_PROCESSO)),
    );
    checar("novo processo: mostra a especificação", m.visivel(m.especificacao()));
    checar("novo processo sem tipo: não completa", m.tl.completa() === false && m.estado.config === undefined);
    await ate(() => m.chamadas.includes("tiposProcesso"));
    await tique(10);
    escolherCombo(m.raiz, ROTULO_TIPO_PROCESSO, "11");
    checar("novo processo com tipo: completa", m.tl.completa() === true);
    m.digitar(m.especificacao(), "Contrato ##nome##");
    igual("config: novo processo", m.estado.config?.destino, {
      tipo: "novo-processo",
      idTipoProcesso: "11",
      especificacao: "Contrato ##nome##",
    });
    m.digitar(m.especificacao(), "e".repeat(150));
    const d = m.estado.config?.destino;
    igual("especificação cortada em MAX_ESPECIFICACAO", d?.tipo === "novo-processo" && d.especificacao.length, MAX_ESPECIFICACAO);
    igual("MAX_ESPECIFICACAO é 100", MAX_ESPECIFICACAO, 100);
    m.marcar("coluna");
    checar(
      "coluna: mostra a coluna e esconde tipo e especificação",
      m.visivel(combo(m.raiz, ROTULO_COLUNA_PROCESSO)) && !m.visivel(combo(m.raiz, ROTULO_TIPO_PROCESSO)) && !m.visivel(m.especificacao()),
    );
    checar("coluna sem coluna escolhida: não completa", m.tl.completa() === false && m.estado.config === undefined);
    escolherCombo(m.raiz, ROTULO_COLUNA_PROCESSO, "outra");
    igual("config: destino coluna", m.estado.config?.destino, { tipo: "coluna", coluna: "outra" });
    m.marcar("tela");
    igual("voltar ao destino tela", m.estado.config?.destino, { tipo: "tela" });
    checar(
      "tela: esconde de novo os campos dos outros dois",
      !m.visivel(combo(m.raiz, ROTULO_COLUNA_PROCESSO)) && !m.visivel(combo(m.raiz, ROTULO_TIPO_PROCESSO)),
    );
  }
  {
    // Só pede os tipos de processo se o destino for novo processo (e uma vez só).
    const m = tela();
    await tique(10);
    checar("destino tela não pede tipos de processo", !m.chamadas.includes("tiposProcesso"));
    m.marcar("novo-processo");
    await ate(() => m.chamadas.includes("tiposProcesso"));
    await tique(10);
    m.marcar("tela");
    m.marcar("novo-processo");
    await tique(10);
    igual("tipos pedidos uma vez", m.chamadas.filter((c) => c === "tiposProcesso").length, 1);
    checar("tipos ficam no estado", m.estado.tiposProcesso?.length === 2);
  }
  {
    // Falha ao listar os tipos: erro na tela, sem config.
    const m = tela();
    const rpc = { chamar: (async () => ({ situacao: "erro", erro: "SEI fora do ar" })) as never };
    const tl = new TelaCruzamento({ rpc, estado: m.estado, aoMudar: () => undefined });
    m.doc.getElementById("app")!.append(tl.el);
    const radio = tl.el.querySelector<HTMLInputElement>('input[value="novo-processo"]')!;
    radio.checked = true;
    disparar(radio, "change");
    await tique(15);
    checar(
      "falha nos tipos aparece na tela",
      (tl.el.querySelector(".dl-erro:not([hidden])")?.textContent ?? "").includes("SEI fora do ar"),
    );
    tl.destruir();
  }
  {
    // Sugere coluna com "processo" no nome.
    const m = tela();
    m.marcar("coluna");
    checar("sugere a coluna com 'processo' no nome", combo(m.raiz, ROTULO_COLUNA_PROCESSO)?.textContent?.includes("Processo SEI") === true);
  }

  secao("cruzamento: nível, hipótese e pausa");
  {
    const m = tela();
    escolherCombo(m.raiz, ROTULO_COLUNA_NOME, "nome");
    checar("nível e hipótese começam vazios", m.estado.config?.colunaNivel === undefined && m.estado.config?.colunaHipotese === undefined);
    escolherCombo(m.raiz, ROTULO_COLUNA_NIVEL, "nivel");
    escolherCombo(m.raiz, ROTULO_COLUNA_HIPOTESE, "hip");
    igual("nível e hipótese na config", [m.estado.config?.colunaNivel, m.estado.config?.colunaHipotese], ["nivel", "hip"]);
    escolherCombo(m.raiz, ROTULO_COLUNA_NIVEL, "__nenhuma__");
    checar("tirar o nível o remove da config", m.estado.config?.colunaNivel === undefined);
    m.digitar(m.pausa(), "50");
    igual("pausa 50 vira 200 (campo e config)", [m.pausa().value, m.estado.config?.pausa], ["200", 200]);
    m.digitar(m.pausa(), "20000");
    igual("pausa 20000 vira 10000 (campo e config)", [m.pausa().value, m.estado.config?.pausa], ["10000", 10000]);
    m.digitar(m.pausa(), "800");
    igual("pausa 800 fica", m.estado.config?.pausa, 800);
    const est = m.raiz.querySelector(".dl-estimativa")?.textContent ?? "";
    checar("estimativa na tela cita as linhas", est.includes("120"), est);
  }

  secao("cruzamento: rótulo do botão e estado ao voltar");
  {
    const m = tela();
    igual("rótulo padrão: Revisar", m.tl.rotuloAvancar(), "Revisar");
    m.marcar("novo-processo");
    igual("novo processo: Revisar", m.tl.rotuloAvancar(), "Revisar");
    m.marcar("coluna");
    igual("destino coluna: Verificar processos", m.tl.rotuloAvancar(), "Verificar processos");
    escolherCombo(m.raiz, ROTULO_COLUNA_NOME, "nome");
    escolherCombo(m.raiz, ROTULO_COLUNA_PROCESSO, "outra");
    m.digitar(m.descricao(), "Desc");
    m.tl.destruir();
    const volta = m.criar();
    m.doc.getElementById("app")!.replaceChildren(volta.el);
    checar(
      "Voltar e Avançar: a tela recomeça do que estava escolhido",
      volta.completa() && volta.rotuloAvancar() === "Verificar processos",
    );
    igual(
      "config refeita ao reabrir",
      [m.estado.config?.destino, m.estado.config?.modeloDescricao],
      [{ tipo: "coluna", coluna: "outra" }, "Desc"],
    );
  }

  secao("cruzamento: config velha não sobrevive a outro modelo ou outra planilha");
  {
    const m = tela();
    escolherCombo(m.raiz, ROTULO_COLUNA_NOME, "nome");
    checar("há config", !!m.estado.config);
    m.tl.destruir();
    m.estado.modelo = { ...MODELO, campos: ["outro"] };
    const t2 = m.criar();
    checar("outro modelo: a config é apagada ao entrar", m.estado.config === undefined && t2.completa() === false);
    checar(
      "outro modelo: campos novos aparecem, o rascunho recomeça",
      !!combo(t2.el, rotuloCampo("outro")) && !combo(t2.el, rotuloCampo("cargo")),
    );
    escolherCombo(t2.el, ROTULO_COLUNA_NOME, "nome");
    t2.destruir();
    m.estado.colunas = ["a", "b"];
    const t3 = m.criar();
    checar("outra planilha: a config é apagada ao entrar", m.estado.config === undefined && t3.completa() === false);
    checar("outra planilha: o rascunho recomeça", combo(t3.el, ROTULO_COLUNA_NOME)?.textContent?.includes("nome") !== true);
    t3.destruir();
  }

  secao("app: etapa Cruzamento");
  {
    checar(
      "cruzamento registrado depois da planilha",
      ETAPAS.map((e) => e.id)
        .join(",")
        .startsWith("modelo,planilha,cruzamento"),
    );
    const m = montar();
    await naPlanilha(m);
    await m.escolherArquivo("a.csv", utf8("nome;cargo;alvo\nAna;Chefe;00001.000001/2026-11\n"));
    await ate(() => m.avancar()?.disabled === false);
    disparar(m.avancar()!, "click");
    await ate(() => !!combo(m.raiz, ROTULO_COLUNA_NOME));
    const rodape = () => m.raiz.querySelector<HTMLButtonElement>(".dl-rodape-etapa .primario");
    checar("na etapa Cruzamento o Avançar começa desabilitado", rodape()?.disabled === true);
    escolherCombo(m.raiz, ROTULO_COLUNA_NOME, "nome");
    checar("com a coluna do nome o botão habilita e se chama Revisar", rodape()?.disabled === false && rodape()?.textContent === "Revisar");
    const r = m.raiz.querySelector<HTMLInputElement>('input[value="coluna"]')!;
    r.checked = true;
    disparar(r, "change");
    checar(
      "destino coluna sem coluna: desabilitado e com o rótulo novo",
      rodape()?.disabled === true && rodape()?.textContent === "Verificar processos",
    );
    escolherCombo(m.raiz, ROTULO_COLUNA_PROCESSO, "alvo");
    checar("destino coluna completo: habilitado", rodape()?.disabled === false && rodape()?.textContent === "Verificar processos");
    // Voltar à Planilha e ler outro arquivo: a config some.
    disparar(botao(m.raiz, "Voltar")!, "click");
    await ate(() => !!m.arquivo());
    checar("Voltar à Planilha mantém a config até a planilha mudar", m.app.estado.config !== undefined);
    await m.escolherArquivo("b.csv", utf8("nome;x\nBia;1\n"));
    checar("ler outra planilha apaga a config", m.app.estado.config === undefined);
    m.app.destruir();
  }
}
