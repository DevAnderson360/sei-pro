/** A seção "Backup em arquivo" das configurações, montada de verdade (linkedom). */

import { DOMParser } from "linkedom";
import type { StatusArquivo } from "@comum/sincronia/arquivo";
import { secaoArquivo, type OpcoesArquivoUi } from "../src/painel/arquivo-ui";
import { checar, secao } from "./util";

const doc = new DOMParser().parseFromString("<html><body></body></html>", "text/html") as unknown as Document;
(globalThis as { document?: Document }).document = doc;

const botao = (raiz: ParentNode, texto: string) => [...raiz.querySelectorAll("button")].find((b) => b.textContent === texto) as HTMLButtonElement | undefined;
const esperar = () => new Promise((r) => setTimeout(r, 10));
const evento = (nome: string) => new (doc.defaultView as unknown as { Event: typeof Event }).Event(nome);

function montar(o: { temSeletor?: boolean; configurado?: boolean; status?: StatusArquivo | null; segredos?: boolean; falha?: "configurado" | "status" | "segredos" } = {}) {
  const chamadas: string[] = [];
  let segredos = o.segredos ?? false;
  const opcoes: OpcoesArquivoUi = {
    temSeletor: o.temSeletor ?? true,
    configurado: async () => {
      if (o.falha === "configurado") throw new Error("IndexedDB fora do ar.");
      return o.configurado ?? false;
    },
    status: async () => {
      if (o.falha === "status") throw new Error("Storage fora do ar.");
      return o.status ?? null;
    },
    escolher: async (m) => void chamadas.push(`escolher:${m}`),
    reconectar: async () => void chamadas.push("reconectar"),
    agora: async () => void chamadas.push("agora"),
    esquecer: async () => void chamadas.push("esquecer"),
    segredos: {
      ler: async () => {
        if (o.falha === "segredos") throw new Error("Caixa ilegível.");
        return segredos;
      },
      gravar: async (v) => {
        segredos = v;
        chamadas.push(`segredos:${v}`);
      },
    },
    removerSegredos: async () => void chamadas.push("removerSegredos"),
    exportar: async () => void chamadas.push("exportar"),
    importar: async () => "Importado: 3 conversas.",
  };
  return { ui: secaoArquivo(opcoes), chamadas };
}

export async function verificarArquivoUi(): Promise<void> {
  secao("arquivo/ui: sem seletor (Firefox)");
  {
    const { ui } = montar({ temSeletor: false });
    await esperar();
    checar("sem Criar arquivo", !botao(ui.elemento, "Criar arquivo"));
    checar("sem Usar arquivo existente", !botao(ui.elemento, "Usar arquivo existente"));
    checar("tem Exportar", Boolean(botao(ui.elemento, "Exportar (.json)")));
    checar("tem Importar", Boolean(botao(ui.elemento, "Importar arquivo")));
    checar("explica o navegador", /não grava direto num arquivo/.test(ui.elemento.textContent ?? ""));
  }

  secao("arquivo/ui: com seletor, sem arquivo");
  {
    const { ui, chamadas } = montar();
    await esperar();
    checar("tem Criar arquivo", Boolean(botao(ui.elemento, "Criar arquivo")));
    botao(ui.elemento, "Criar arquivo")!.click();
    botao(ui.elemento, "Usar arquivo existente")!.click();
    await esperar();
    checar("escolhe novo e existente", chamadas.join() === "escolher:novo,escolher:existente", chamadas);
    checar("sem Sincronizar agora", !botao(ui.elemento, "Sincronizar agora"));
    botao(ui.elemento, "Exportar (.json)")!.click();
    await esperar();
    checar("exportar chama", chamadas.includes("exportar"));
  }

  secao("arquivo/ui: permissao e situacao");
  {
    const { ui, chamadas } = montar({ configurado: true, status: { estado: "permissao", quando: Date.now(), nome: "agente.json", mensagem: "Reconecte o arquivo." } });
    await esperar();
    checar("mostra o nome e a mensagem", /agente\.json/.test(ui.elemento.textContent ?? "") && /Reconecte o arquivo\./.test(ui.elemento.textContent ?? ""));
    botao(ui.elemento, "Reconectar arquivo")!.click();
    await esperar();
    checar("reconectar chama", chamadas.includes("reconectar"), chamadas);
    checar("nao oferece Criar arquivo", !botao(ui.elemento, "Criar arquivo"));
    botao(ui.elemento, "Sincronizar agora")!.click();
    botao(ui.elemento, "Esquecer arquivo")!.click();
    await esperar();
    checar("agora e esquecer chamam", chamadas.includes("agora") && chamadas.includes("esquecer"), chamadas);
  }
  {
    const { ui } = montar({ configurado: true, status: { estado: "ok", quando: new Date(2026, 9, 16, 9, 5).getTime(), nome: "a.json" } });
    await esperar();
    checar("ok mostra a hora", /Sincronizado às 09:05/.test(ui.elemento.textContent ?? ""), ui.elemento.textContent);
    checar("ok nao mostra Reconectar", !botao(ui.elemento, "Reconectar arquivo"));
  }
  {
    const { ui } = montar({ configurado: true, status: { estado: "erro", quando: 1, nome: "a.json", mensagem: "Disco cheio." } });
    await esperar();
    checar("erro mostra a mensagem", /Disco cheio\./.test(ui.elemento.textContent ?? ""));
  }

  secao("arquivo/ui: segredos");
  {
    const { ui, chamadas } = montar({ configurado: true, status: { estado: "ok", quando: 1, nome: "a.json" } });
    await esperar();
    const caixa = ui.elemento.querySelector('input[aria-label="Incluir a chave de API e os tokens dos conectores"]') as HTMLInputElement;
    checar("a caixa existe e comeca desmarcada", Boolean(caixa) && !caixa.checked);
    caixa.checked = true;
    caixa.dispatchEvent(evento("change"));
    await esperar();
    checar("marcar grava true", chamadas.includes("segredos:true"), chamadas);
    botao(ui.elemento, "Remover segredos do arquivo")!.click();
    await esperar();
    checar("remover segredos chama", chamadas.includes("removerSegredos"), chamadas);
    checar("avisa do outro computador", /grava de novo/.test(ui.elemento.textContent ?? ""));
  }

  secao("arquivo/ui: importar");
  {
    const { ui } = montar({ temSeletor: false });
    await esperar();
    const input = ui.elemento.querySelector('input[type="file"]') as HTMLInputElement;
    checar("input de arquivo .json escondido", Boolean(input) && input.hidden === true && input.getAttribute("accept") === ".json");
    Object.defineProperty(input, "files", { value: [{ name: "x.json" }] });
    input.dispatchEvent(evento("change"));
    await esperar();
    checar("mostra a mensagem devolvida", /Importado: 3 conversas\./.test(ui.elemento.textContent ?? ""), ui.elemento.textContent);
  }

  secao("arquivo/ui: falha ao ler o estado");
  for (const [falha, texto] of [
    ["configurado", "IndexedDB fora do ar."],
    ["status", "Storage fora do ar."],
    ["segredos", "Caixa ilegível."],
  ] as const) {
    const { ui } = montar({ configurado: true, status: { estado: "ok", quando: 1, nome: "a.json" }, falha });
    await esperar();
    const conteudo = ui.elemento.textContent ?? "";
    checar(`falha em ${falha}: Exportar e Importar ficam`, Boolean(botao(ui.elemento, "Exportar (.json)")) && Boolean(botao(ui.elemento, "Importar arquivo")), conteudo);
    checar(`falha em ${falha}: layout sem arquivo`, Boolean(botao(ui.elemento, "Criar arquivo")) && !botao(ui.elemento, "Sincronizar agora"), conteudo);
    checar(`falha em ${falha}: mostra o erro`, conteudo.includes(texto), conteudo);
  }

  secao("arquivo/ui: o erro de leitura some quando a leitura volta");
  {
    const o: Parameters<typeof montar>[0] = { configurado: true, status: { estado: "ok", quando: 1, nome: "a.json" }, falha: "status" };
    const { ui } = montar(o);
    await esperar();
    checar("erro de leitura aparece", (ui.elemento.textContent ?? "").includes("Storage fora do ar."));
    o!.falha = undefined;
    ui.redesenhar();
    await esperar();
    checar("erro de leitura some no redesenho bom", !(ui.elemento.textContent ?? "").includes("Storage fora do ar.") && Boolean(botao(ui.elemento, "Sincronizar agora")), ui.elemento.textContent);
  }

  secao("arquivo/ui: sem titulo repetido");
  {
    const { ui } = montar();
    await esperar();
    checar("a secao nao repete o titulo do grupo", !(ui.elemento.textContent ?? "").includes("Backup em arquivo"), ui.elemento.textContent);
  }
}
