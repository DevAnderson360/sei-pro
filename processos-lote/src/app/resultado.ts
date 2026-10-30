/**
 * Tela de resultado: tabela (nº, número SEI, especificação, detalhe, link), copiar com links, CSV, "Tentar de novo
 * as falhas" (so `erro`, garantidamente nao criado) e "Gerar links permanentes destes processos".
 *
 * Linhas incertas (o SEI nao confirmou) aparecem como "Incerto" com o aviso de conferir no Controle de Processos;
 * nunca entram na repeticao nem na lista do Link Permanente (o numero delas e provisorio).
 *
 * O painel "Depois de criar" (posAcao.ts) entra entre os botoes e a tabela, e o resultado das acoes vira a coluna
 * "Depois de criar", que so aparece depois que alguma acao rodou (antes disso a tabela e a CSV ficam como eram).
 */

import { paraLatin1 } from "@comum/texto/latin1";
import { h, icone } from "@comum/ui/dom";
import { type ColunaResultado, type LinhaResultado, montarTabelaResultado } from "@comum/ui/tabelaResultado";
import { MAX_ESPECIFICACAO } from "../modelo/constantes";
import { NUMERO_INCERTO, NUMERO_NAO_IDENTIFICADO } from "../pagina/executor";
import type { ItemProc } from "./execucao";

/** A Situação a tabela comum ja poe na frente; aqui so as colunas do modulo. */
export const COLUNAS: ColunaResultado[] = [
  { chave: "n", titulo: "Nº" },
  { chave: "numero", titulo: "Número SEI" },
  { chave: "especificacao", titulo: "Especificação" },
  { chave: "detalhe", titulo: "Detalhe" },
  { chave: "link", titulo: "Link", comoLink: true },
];

export const COLUNA_DEPOIS: ColunaResultado = { chave: "depois", titulo: "Depois de criar" };

/** O que a tela de resultado precisa do painel "Depois de criar" (posAcao.ts). */
export interface ExtraResultado {
  el: HTMLElement;
  /** Ha resultado de alguma acao: a coluna aparece. */
  readonly temResultados: boolean;
  depois(i: ItemProc): string;
}

export function colunasDoResultado(extra?: ExtraResultado | null): ColunaResultado[] {
  return extra?.temResultados ? [...COLUNAS, COLUNA_DEPOIS] : COLUNAS;
}

export const DICA_INCERTO = "Confira no Controle de Processos antes de repetir esta linha.";

const ehIncerto = (i: ItemProc): boolean => i.situacao === "ok" && i.resultado?.incerto === true;

/** O texto que foi (ou seria) enviado ao SEI, como o legado mostrava. */
const enviada = (esp: string): string => paraLatin1(esp).slice(0, MAX_ESPECIFICACAO).trim();

export function linhasDoResultado(itens: readonly ItemProc[], extra?: ExtraResultado | null): LinhaResultado[] {
  const comDepois = !!extra?.temResultados;
  return [...itens]
    .sort((a, b) => a.indice - b.indice)
    .map((i) => {
      const r = i.situacao === "ok" ? i.resultado : undefined;
      const incerto = ehIncerto(i);
      let rotulo = "Pendente";
      let detalhe = "";
      if (i.situacao === "ok") {
        rotulo = incerto ? "Incerto" : "Criado";
        detalhe = incerto ? `${r?.aviso ?? ""} ${DICA_INCERTO}`.trim() : (r?.aviso ?? "");
      } else if (i.situacao === "erro") {
        rotulo = "Erro";
        detalhe = i.erro ?? "";
      } else {
        detalhe = "Não enviado.";
      }
      const url = !incerto && r?.criado.url ? r.criado.url : "";
      const linha: LinhaResultado = {
        situacao: i.situacao,
        rotulo,
        campos: {
          n: String(i.indice + 1),
          numero: r?.criado.numero ?? "",
          especificacao: enviada(i.entrada.especificacao),
          detalhe,
          link: url,
        },
      };
      if (comDepois && extra) linha.campos.depois = extra.depois(i);
      if (url) linha.link = url;
      return linha;
    });
}

/** Numeros que o Link Permanente pode pesquisar: so os confirmados (sem incerto nem "nao identificado"). */
export function numerosParaLink(itens: readonly ItemProc[]): string[] {
  return [...itens]
    .sort((a, b) => a.indice - b.indice)
    .filter((i) => i.situacao === "ok" && !ehIncerto(i))
    .map((i) => i.resultado?.criado.numero ?? "")
    .filter((n) => n && n !== NUMERO_INCERTO && n !== NUMERO_NAO_IDENTIFICADO);
}

export interface AcoesResultado {
  copiar(): void;
  baixarCsv(): void;
  repetirFalhas(): void;
  continuarPendentes(): void;
  gerarLinks(): void;
  /** So quando tudo terminou mas ha linha a conferir: o registro fica ate o usuario dizer que conferiu. */
  descartarENovo?: () => void;
}

/** A tabela (com a cor do incerto); redesenhada quando o painel "Depois de criar" muda. */
function tabelaDoResultado(itens: readonly ItemProc[], extra?: ExtraResultado | null): HTMLTableElement {
  const tabela = montarTabelaResultado(document, linhasDoResultado(itens, extra), colunasDoResultado(extra));
  // A cor so reforca: o incerto ja diz "Incerto" na Situacao.
  const ordenados = [...itens].sort((x, y) => x.indice - y.indice);
  [...tabela.querySelectorAll("tbody tr")].forEach((tr, k) => {
    if (ordenados[k] && ehIncerto(ordenados[k])) tr.classList.add("pl-incerto");
  });
  return tabela;
}

/** Troca so a tabela da tela de resultado (o painel, com o que o usuario escolheu, fica). */
export function atualizarTabelaResultado(tela: HTMLElement, itens: readonly ItemProc[], extra?: ExtraResultado | null): void {
  tela.querySelector(".pl-tabela")?.replaceChildren(tabelaDoResultado(itens, extra));
}

export function montarTelaResultado(
  itens: readonly ItemProc[],
  interrompido: boolean,
  a: AcoesResultado,
  extra?: ExtraResultado | null,
): HTMLElement {
  const total = itens.length;
  const criados = itens.filter((i) => i.situacao === "ok" && !ehIncerto(i)).length;
  const incertos = itens.filter(ehIncerto).length;
  const falhas = itens.filter((i) => i.situacao === "erro").length;
  const pendentes = itens.filter((i) => i.situacao === "pendente").length;
  const numeros = numerosParaLink(itens);
  const partesContagem = [
    `${criados} de ${total} ${total === 1 ? "processo aberto" : "processos abertos"}`,
    falhas ? `${falhas} ${falhas === 1 ? "falha" : "falhas"}` : "",
    incertos ? `${incertos} ${incertos === 1 ? "incerto" : "incertos"} (confira no Controle de Processos)` : "",
    pendentes ? `${pendentes} não ${pendentes === 1 ? "enviado" : "enviados"}` : "",
  ].filter(Boolean);
  const botao = (rotulo: string, nome: Parameters<typeof icone>[0], fazer: () => void, classe = "") =>
    h("button", { type: "button", class: `spro-botao pequeno ${classe}`.trim(), onclick: fazer }, icone(nome, 14), rotulo);
  const tabela = tabelaDoResultado(itens, extra);
  return h(
    "section",
    { class: "pl-resultado", "aria-label": "Resultado" },
    h(
      "h2",
      { class: "pl-resultado-titulo" },
      interrompido ? icone("alerta", 18) : icone("check", 18),
      interrompido ? "Execução interrompida" : "Progresso finalizado!",
    ),
    h("p", { class: "pl-contagem" }, `${partesContagem.join(" — ")}.`),
    incertos
      ? h(
          "p",
          { class: "pl-motivo" },
          icone("alerta", 16),
          `${incertos} ${incertos === 1 ? "linha ficou incerta" : "linhas ficaram incertas"}: o SEI não confirmou a criação. Confira no Controle de Processos antes de abrir de novo.`,
        )
      : null,
    h(
      "div",
      { class: "pl-acoes" },
      falhas ? botao("Tentar de novo as falhas", "atualizar", a.repetirFalhas, "primario") : null,
      pendentes ? botao("Continuar os que faltam", "atualizar", a.continuarPendentes) : null,
      numeros.length ? botao("Gerar links permanentes destes processos", "documento", a.gerarLinks) : null,
      h("span", { class: "pl-espaco" }),
      botao("Copiar com links", "copiar", a.copiar),
      botao("Baixar CSV", "baixar", a.baixarCsv),
      a.descartarENovo ? botao("Descartar e começar outro", "lixeira", a.descartarENovo, "fantasma") : null,
    ),
    extra ? extra.el : null,
    h("div", { class: "pl-tabela" }, tabela),
  );
}
