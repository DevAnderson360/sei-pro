/**
 * Interface do backup em arquivo: a seção da configuração.
 *
 * Só desenha e repassa os cliques; quem fala com o arquivo é o controle
 * (`src/arquivo/`), entregue pelo painel em `OpcoesArquivoUi`.
 */

import type { StatusArquivo } from "@comum/sincronia/arquivo";
import { h } from "./dom";

export interface OpcoesArquivoUi {
  /** `temSeletorDeArquivo(window)`: falso no Firefox. */
  temSeletor: boolean;
  configurado(): Promise<boolean>;
  status(): Promise<StatusArquivo | null>;
  escolher(modo: "novo" | "existente"): Promise<void>;
  reconectar(): Promise<void>;
  agora(): Promise<void>;
  esquecer(): Promise<void>;
  segredos: { ler(): Promise<boolean>; gravar(v: boolean): Promise<void> };
  removerSegredos(): Promise<void>;
  exportar(): Promise<void>;
  /** Devolve a mensagem para o usuário. */
  importar(arquivo: File): Promise<string>;
}

const dois = (n: number) => String(n).padStart(2, "0");

function situacao(s: StatusArquivo | null): string {
  if (!s) return "";
  if (s.estado === "ok") {
    const d = new Date(s.quando);
    return `Sincronizado às ${dois(d.getHours())}:${dois(d.getMinutes())}${s.mensagem ? ` — ${s.mensagem}` : ""}`;
  }
  return s.mensagem ?? "";
}

export function secaoArquivo(o: OpcoesArquivoUi): { elemento: HTMLElement; redesenhar: () => void } {
  const corpo = h("div", { class: "campo" });
  const aviso = h("div", { class: "ajuda" });

  /** Roda a ação, mostra o erro se ela falhar e redesenha. */
  const rodar = (acao: () => Promise<unknown>) => async () => {
    aviso.textContent = "";
    try {
      await acao();
    } catch (e) {
      aviso.textContent = e instanceof Error ? e.message : String(e);
    }
    redesenhar();
  };

  const input = h("input", { type: "file", accept: ".json", hidden: true, "aria-label": "Arquivo de backup para importar" });
  input.addEventListener("change", async () => {
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    aviso.textContent = "";
    try {
      aviso.textContent = await o.importar(arquivo);
    } catch (e) {
      aviso.textContent = e instanceof Error ? e.message : String(e);
    }
    try {
      input.value = "";
    } catch {
      // Campo de arquivo não aceita limpar em alguns ambientes; sem consequência.
    }
    redesenhar();
  });

  const exportar = h("button", { onclick: rodar(() => o.exportar()) }, "Exportar (.json)");
  const importar = h("button", { onclick: () => input.click() }, "Importar arquivo");

  let geracao = 0;
  /** O aviso na tela é de uma leitura que falhou: some quando a leitura voltar a dar certo. */
  let avisoDaLeitura = false;
  async function desenhar(): Promise<void> {
    const minha = ++geracao;
    let configurado = false;
    let status: StatusArquivo | null = null;
    let segredos = false;
    let falha = "";
    try {
      configurado = o.temSeletor ? await o.configurado() : false;
      status = configurado ? await o.status() : null;
      segredos = configurado ? await o.segredos.ler() : false;
    } catch (e) {
      // Sem conseguir ler o estado, fica o desenho "sem arquivo": Exportar e
      // Importar continuam à mão, e o erro aparece na seção.
      configurado = false;
      status = null;
      segredos = false;
      falha = e instanceof Error ? e.message : String(e);
    }
    if (minha !== geracao) return; // um redesenho mais novo já está a caminho
    if (falha) {
      aviso.textContent = falha;
      avisoDaLeitura = true;
    } else if (avisoDaLeitura) {
      aviso.textContent = "";
      avisoDaLeitura = false;
    }

    const filhos: Array<Node | null> = [];

    if (!o.temSeletor) {
      filhos.push(h("div", { class: "ajuda" }, "Este navegador não grava direto num arquivo; use Exportar e Importar."));
    } else if (!configurado) {
      filhos.push(
        h("div", { class: "com-botao" }, h("button", { onclick: rodar(() => o.escolher("novo")) }, "Criar arquivo"), h("button", { onclick: rodar(() => o.escolher("existente")) }, "Usar arquivo existente")),
      );
    } else {
      const texto = situacao(status);
      filhos.push(
        h("div", { class: "ajuda" }, h("strong", {}, status?.nome ?? "Arquivo escolhido"), texto ? ` — ${texto}` : ""),
        h(
          "div",
          { class: "com-botao" },
          status?.estado === "permissao" ? h("button", { class: "primario", onclick: rodar(() => o.reconectar()) }, "Reconectar arquivo") : null,
          h("button", { onclick: rodar(() => o.agora()) }, "Sincronizar agora"),
          h("button", { onclick: rodar(() => o.esquecer()) }, "Esquecer arquivo"),
        ),
      );
      const caixa = h("input", { type: "checkbox", class: "switch", "aria-label": "Incluir a chave de API e os tokens dos conectores", ...(segredos ? { checked: true } : {}) });
      caixa.addEventListener("change", rodar(() => o.segredos.gravar(caixa.checked)));
      filhos.push(
        h(
          "label",
          { class: "linha-switch" },
          caixa,
          h("span", {}, "Incluir a chave de API e os tokens dos conectores", h("small", {}, "Vale só neste computador. Quem tiver acesso à pasta do arquivo poderá usar a chave.")),
        ),
        h(
          "div",
          { class: "com-botao" },
          h("button", { onclick: rodar(() => o.removerSegredos()) }, "Remover segredos do arquivo"),
        ),
        h("div", { class: "ajuda" }, "Se outro computador estiver com a opção marcada, ele os grava de novo."),
      );
    }

    filhos.push(h("div", { class: "com-botao" }, exportar, importar, input), aviso);
    corpo.replaceChildren(...(filhos.filter(Boolean) as Node[]));
  }

  function redesenhar(): void {
    void desenhar().catch((e) => {
      aviso.textContent = e instanceof Error ? e.message : String(e);
    });
  }

  redesenhar();

  const elemento = h(
    "div",
    { class: "campo" },
    h(
      "div",
      { class: "ajuda" },
      "Grava tudo do agente — conversas, memória, instruções, skills, regras, rotinas, conectores e fluxos — num arquivo seu. Escolha um arquivo numa pasta do OneDrive ou do Google Drive e ele chega aos seus outros computadores.",
    ),
    corpo,
  );

  return { elemento, redesenhar };
}
