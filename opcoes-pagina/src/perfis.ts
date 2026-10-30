/**
 * Aba "Base de Dados": uma ou mais bases (perfis) de conexao. Mesma forma gravada
 * do legado (8 chaves por base). As linhas "sheets" (CLIENT_ID, API_KEY, spreadsheetId)
 * nao eram mais alcancaveis pela UI (o select so oferece "api"); seus valores, se
 * existirem, sao preservados em data-legado e devolvidos na coleta.
 */
import { h } from "@comum/ui/dom";
import type { Perfil } from "./armazenamento";

interface Campo {
  nome: string;
  rotulo: string;
  tipo: "texto" | "senha" | "selecao";
  obrigatorio?: boolean;
  dica?: string;
  escolhas?: [string, string][];
}

const CAMPOS: Campo[] = [
  { nome: "baseName", rotulo: "Nome da Base *", tipo: "texto", obrigatorio: true, dica: "Nome da Base" },
  {
    nome: "baseTipo",
    rotulo: "Tipo da Base de Dados *",
    tipo: "selecao",
    obrigatorio: true,
    escolhas: [
      ["atividades", "Atividades"],
      ["openai", "Chat GPT (Open AI)"],
      ["gemini", "Gemini (Google)"],
    ],
  },
  { nome: "conexaoTipo", rotulo: "Tipo da Conexão *", tipo: "selecao", obrigatorio: true, escolhas: [["api", "Servidor Web (API)"]] },
  { nome: "URL_API", rotulo: "URL do Servidor *", tipo: "texto", dica: "Insira o caminho para o servidor de API" },
  { nome: "KEY_USER", rotulo: "Chave de Acesso *", tipo: "senha", dica: "Insira a chave de acesso fornecida pelo administrador" },
];
const ORDEM_GRAVADA = ["baseName", "baseTipo", "conexaoTipo", "CLIENT_ID", "API_KEY", "spreadsheetId", "URL_API", "KEY_USER"];
const LEGADOS = ["CLIENT_ID", "API_KEY", "spreadsheetId"];

let contador = 0;

const botaoAcao = (acao: string, rotulo: string, icone: string): HTMLButtonElement =>
  h(
    "button",
    { type: "button", class: "btn-icone", "data-acao": acao, "aria-label": rotulo, title: rotulo },
    h("i", { class: `fas ${icone}`, "aria-hidden": "true" }),
  );

function campoEl(c: Campo, n: number, valor: string): HTMLElement {
  const id = `perfil-${n}-${c.nome}`;
  const base = { id, "data-campo": c.nome, "data-name-input": c.nome, class: "input-config-pro", required: c.obrigatorio };
  const controle =
    c.tipo === "selecao"
      ? h("select", base, ...(c.escolhas ?? []).map(([v, t]) => h("option", { value: v, selected: v === valor }, t)))
      : h("input", { ...base, type: c.tipo === "senha" ? "password" : "text", placeholder: c.dica, value: valor, autocomplete: "off" });
  return h(
    "div",
    { class: "campo" },
    h("label", { for: id }, c.rotulo),
    c.tipo === "senha"
      ? h("span", { class: "campo-senha" }, controle, botaoAcao("revelar", "Mostrar ou ocultar a chave", "fa-eye"))
      : controle,
  );
}

export function montarPerfil(valores: Perfil = {}): HTMLElement {
  contador += 1;
  const n = contador;
  const legado = Object.fromEntries(LEGADOS.filter((k) => valores[k]).map((k) => [k, valores[k]]));
  return h(
    "fieldset",
    { class: "perfil", "data-legado": JSON.stringify(legado) },
    h(
      "div",
      { class: "perfil-topo" },
      h("h2", {}, "Base de Dados"),
      h(
        "span",
        { class: "perfil-acoes" },
        botaoAcao("subir", "Mover para cima", "fa-arrow-up"),
        botaoAcao("descer", "Mover para baixo", "fa-arrow-down"),
        botaoAcao("remover", "Remover esta base", "fa-trash-alt"),
      ),
    ),
    ...CAMPOS.map((c) => campoEl(c, n, valores[c.nome] ?? "")),
  );
}

export function adicionarPerfil(lista: HTMLElement): HTMLElement {
  const p = montarPerfil();
  lista.append(p);
  return p;
}

/** Sempre deixa pelo menos um formulario (em branco, esperando uma base nova). */
export function restaurarPerfis(lista: HTMLElement, perfis: Perfil[]): void {
  lista.replaceChildren(...perfis.filter((p) => p.baseName).map((p) => montarPerfil(p)));
  if (lista.children.length === 0) adicionarPerfil(lista);
}

const camposDe = (p: Element) => [...p.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-campo]")];

export function coletarPerfis(lista: HTMLElement): { perfis: Perfil[]; descartados: number } {
  const perfis: Perfil[] = [];
  let descartados = 0;
  for (const p of lista.querySelectorAll(".perfil")) {
    const campos = camposDe(p);
    // Formulario em que nenhum campo de texto foi preenchido (os selects ja vem com valor) e o formulario virgem: nao e base incompleta.
    if (campos.every((c) => c.tagName === "SELECT" || c.value.trim() === "")) continue;
    let faltando = 0;
    const valores: Perfil = { ...(JSON.parse(p.getAttribute("data-legado") || "{}") as Perfil) };
    for (const c of campos) {
      c.classList.remove("campo-invalido");
      if (c.hasAttribute("required") && c.value === "") {
        c.classList.add("campo-invalido");
        faltando += 1;
      } else valores[c.getAttribute("data-campo") as string] = c.value;
    }
    if (faltando > 0) descartados += 1;
    else perfis.push(Object.fromEntries(ORDEM_GRAVADA.map((k) => [k, valores[k] ?? ""])));
  }
  return { perfis, descartados };
}

/** Uma delegacao so para subir, descer, remover e revelar a chave. */
export function ligarLista(lista: HTMLElement): void {
  lista.addEventListener("click", (ev) => {
    const botao = (ev.target as Element).closest<HTMLElement>("[data-acao]");
    const perfil = botao?.closest<HTMLElement>(".perfil");
    if (!botao || !perfil) return;
    switch (botao.getAttribute("data-acao")) {
      case "subir": {
        const antes = perfil.previousElementSibling;
        if (antes) antes.before(perfil);
        break;
      }
      case "descer": {
        const depois = perfil.nextElementSibling;
        if (depois) depois.after(perfil);
        break;
      }
      case "remover":
        // Ultima base: so limpa o formulario. O legado tentava apagar todo o dataValues (inclusive as opcoes gerais), e esse ramo nunca rodava.
        if (lista.querySelectorAll(".perfil").length > 1) perfil.remove();
        else for (const c of camposDe(perfil)) if (c.tagName !== "SELECT") c.value = "";
        break;
      case "revelar": {
        const senha = perfil.querySelector<HTMLInputElement>('[data-campo="KEY_USER"]');
        if (!senha) break;
        const mostrando = senha.getAttribute("type") === "text";
        senha.setAttribute("type", mostrando ? "password" : "text");
        botao.querySelector("i")?.setAttribute("class", mostrando ? "fas fa-eye" : "fas fa-eye-slash");
        break;
      }
    }
  });
}
