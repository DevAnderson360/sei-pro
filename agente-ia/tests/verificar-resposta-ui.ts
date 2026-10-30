/**
 * O rodapé da resposta do agente: o botão de copiar, só com ícone.
 *
 * O que se copia é o markdown que o agente escreveu, não o texto da tela:
 * tabela e lista coladas num documento ou num chamado continuam sendo tabela
 * e lista.
 */

import { DOMParser } from "linkedom";
import { checar, secao } from "./util";

export async function verificarRespostaUi(): Promise<void> {
  const doc = new DOMParser().parseFromString("<html><body></body></html>", "text/html") as unknown as Document;
  (globalThis as { document?: Document }).document = doc;
  const copiados: string[] = [];
  let falhar = false;
  Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value: {
    clipboard: {
      writeText: async (t: string) => {
        if (falhar) throw new Error("sem foco");
        copiados.push(t);
      },
    },
  } });
  const { rodapeDaResposta } = await import("../src/painel/resposta-ui");

  secao("resposta: botao de copiar");
  const texto = "## Resultado\n\n| a | b |\n|---|---|\n| 1 | 2 |";
  const rodape = rodapeDaResposta(texto);
  const botoes = [...rodape.querySelectorAll("button")];
  checar("um botao so", botoes.length === 1, botoes.length);
  checar("sem texto, so icone", !(botoes[0].textContent ?? "").trim() && Boolean(botoes[0].querySelector("svg")), botoes[0].textContent);
  checar("com rotulo acessivel", botoes[0].getAttribute("aria-label") === "Copiar a resposta" && botoes[0].title === "Copiar a resposta", botoes[0].title);
  botoes[0].click();
  await new Promise((r) => setTimeout(r, 10));
  checar("copia o markdown da resposta, inteiro", copiados.length === 1 && copiados[0] === texto, copiados);
  checar("e confirma que copiou", botoes[0].title === "Copiado", botoes[0].title);

  secao("resposta: sem permissao de area de transferencia");
  falhar = true;
  const outro = rodapeDaResposta("abc");
  const b = outro.querySelector("button") as HTMLButtonElement;
  b.click();
  await new Promise((r) => setTimeout(r, 10));
  checar("avisa que nao copiou, em vez de falhar calado", /Não foi possível copiar/.test(b.title), b.title);
}
