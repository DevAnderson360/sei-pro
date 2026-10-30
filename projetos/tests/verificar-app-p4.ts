/**
 * O app do painel com a colaboração ligada, montado pela MESMA função que o main.ts usa (`ligarApp`, P4): os
 * itens do menu ajustes no lugar da spec, as faixas acima das abas, o estado da sincronia, o "Novo projeto" já
 * no modelo, o "Entendi" antes de criar um projeto de toda a unidade (o app recebe o repositório da
 * colaboração, com o Proxy), o "abrir projeto" que relê, e a memória do sigilo ilegível ou a colaboração que
 * não inicia, que não derrubam o app.
 */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { definirEmissorDeAviso } from "@comum/ui/aviso";
import type { AbrirModal } from "@comum/ui/dialogo";
import { type ArquivoLigado, AVISO_LIMPEZA } from "../src/app/colaboracao/colaboracao";
import { ligarApp } from "../src/app/ligacao";
import { prefixoMemoriaSigilo } from "../src/modelo/constantes";
import { MODELOS_EMBUTIDOS } from "../src/modelos/embutidos";
import type { ContextoProjetos } from "../src/ponte/tipos";
import { chaveStatusTexto } from "../src/sincronia/textoPadrao";
import { combo, digitar, itensDoMenu, telaDoApp, texto } from "./apoioApp";
import { ESCOPO_EU, ESCOPO_UN, novoRepo } from "./apoioRepositorio";
import { HOJE } from "./fabrica";
import { ganttFalso } from "./ganttFalso";
import { botao, checar, secao, tique } from "./util";

const CTX: ContextoProjetos = {
  host: "sei.x.gov.br",
  login: "ana",
  nome: "Ana Lima",
  unidade: { id: "110", sigla: "TESTE", nome: "Unidade de Teste" },
  versao: "4.1.5",
  temaEscuro: false,
  atividades: true,
};
const AGORA = new Date(2026, 9, 6, 15).getTime();

interface Modal {
  titulo: string;
  conteudo: HTMLElement;
}

/** O app como o main.ts monta, com o navegador falso (diálogos, download, arquivo, RPC). */
async function montar(o: { area?: Area; sync?: Area; arquivo?: ArquivoLigado | null; janela?: EventTarget } = {}) {
  const doc = telaDoApp();
  const area = o.area ?? areaMemoria();
  const sync = o.sync ?? areaMemoria();
  const modais: Modal[] = [];
  const abrirModal: AbrirModal = (m) => {
    doc.body.append(m.conteudo);
    modais.push({ titulo: m.titulo, conteudo: m.conteudo });
    return {
      fechar: () => {
        m.conteudo.remove();
        m.aoFechar?.();
      },
    };
  };
  const relogio = { agora: AGORA };
  const ligado = await ligarApp({
    raiz: doc.getElementById("app")!,
    ctx: CTX,
    area,
    sync,
    rpc: { chamar: async <T>(): Promise<T> => [] as T },
    abrirModal,
    confirmar: async () => true,
    baixar: () => undefined,
    escolherArquivo: async () => null,
    hoje: () => HOJE,
    agora: () => AGORA,
    carimbo: () => ({ agora: ++relogio.agora, dispositivo: "pc", por: "ana", nome: "Ana Lima" }),
    copias: null,
    arquivo: o.arquivo ?? null,
    montarGantt: ganttFalso().montar,
    largura: () => 1000,
    janela: o.janela,
  });
  return { ...ligado, doc, area, sync, modais, raiz: doc.getElementById("app")! };
}

export async function verificarAppP4(): Promise<void> {
  const avisos: string[] = [];
  definirEmissorDeAviso((t) => {
    avisos.push(t);
    return true;
  });

  secao("app ligado (como o main.ts): menu, faixas e estado");
  const area = areaMemoria();
  const { repo: un } = novoRepo(ESCOPO_UN, area, "u");
  const { repo: eu } = novoRepo(ESCOPO_EU, area, "e");
  await eu.criarProjeto({ nome: "Plano 2027" });
  const m = await montar({ area });
  const { app, raiz, modais } = m;
  const itens = itensDoMenu(raiz, "Ajustes dos projetos");
  checar(
    "o menu ajustes tem os itens do P4 no lugar da spec",
    itens[0] === "Sincronização…" &&
      itens[1] === "Modelos de projeto…" &&
      itens.includes("Enviar projeto por arquivo…") &&
      itens.includes("Receber projeto de arquivo…") &&
      itens.includes("Importar do servidor do Atividades…") &&
      itens.at(-1) === "Histórico de alterações",
    itens,
  );
  checar(
    "a faixa-convite (ha projeto 'So eu') aparece acima das abas",
    raiz.querySelector(".prj > .prj-faixas [data-faixa='convite']") !== null &&
      raiz.querySelector(".prj")?.firstElementChild?.classList.contains("prj-faixas") === true,
  );
  await area.gravar({ [chaveStatusTexto(ESCOPO_UN)]: { estado: "ok", quando: AGORA, ultimoOk: AGORA, pendente: true } });
  await tique(40);
  checar(
    "o estado da sincronia ao lado das abas",
    texto(raiz.querySelector(".prj-sinc")) === "pendente",
    texto(raiz.querySelector(".prj-sinc")),
  );
  await area.gravar({
    [chaveStatusTexto(ESCOPO_UN)]: { estado: "ok", quando: AGORA, ultimoOk: AGORA, pendente: true, aguardandoPermissao: true },
  });
  await tique(40);
  checar(
    "o que espera o Entendi aparece numa faixa acima das abas",
    raiz.querySelector(".prj > .prj-faixas [data-faixa='aguardando']") !== null,
  );

  secao("app ligado: o Novo projeto no modelo e o Entendi ao criar na unidade");
  const modelo = MODELOS_EMBUTIDOS[1]!;
  // Pelo diálogo "Modelos de projeto" (a colaboração chama o app pelos ganchos que o ligarApp passa).
  await m.colab.abrirModelos();
  botao(modais.at(-1)!.conteudo.querySelector<HTMLElement>(`.prj-modelo[data-id='${modelo.id}']`)!, "Criar projeto")?.click();
  await tique(10);
  const dlg = modais.at(-1)!;
  checar(
    "abre o Novo projeto ja em 'De um modelo', com o modelo escolhido",
    dlg.titulo === "Novo projeto" &&
      texto(combo(dlg.conteudo, "Modelo")).includes(modelo.nome) &&
      botao(dlg.conteudo, "De um modelo")?.getAttribute("aria-pressed") === "true",
    { titulo: dlg.titulo, combo: texto(combo(dlg.conteudo, "Modelo")) },
  );
  digitar(dlg.conteudo.querySelector("input[name='nome']"), "Pregão de notebooks");
  botao(dlg.conteudo, "Criar projeto")?.click();
  await tique(20);
  checar(
    "criar em 'Toda a unidade' pede o Entendi antes (o app grava pelo repositorio da colaboracao)",
    modais.at(-1)?.titulo === "Projetos de toda a unidade" && (await un.dados()).projetos.length === 0,
  );
  botao(modais.at(-1)!.conteudo, "Entendi")?.click();
  await tique(60);
  const criados = (await un.dados()).projetos;
  checar(
    "depois do Entendi, o projeto e criado do modelo e aberto",
    criados.length === 1 &&
      app.aberto === criados[0]?.id &&
      (await un.dados()).etapas.filter((e) => e.projeto === criados[0]?.id).length === modelo.etapas.length,
    { n: criados.length, aberto: app.aberto },
  );
  await app.abrirProjeto("nao-existe");
  checar("abrirProjeto de um id que nao esta ativo nao muda a aba", app.aberto === criados[0]?.id);
  const outro = await eu.criarProjeto({ nome: "Recebido agora" });
  await app.abrirProjeto(outro.id);
  checar("abrirProjeto rele antes de abrir (o projeto acabou de ser gravado)", app.aberto === outro.id, app.aberto);
  m.destruir();

  secao("app ligado: a memoria do sigilo ilegivel nao derruba o app");
  {
    avisos.length = 0;
    const base = areaMemoria({ [`${prefixoMemoriaSigilo(CTX.host, CTX.login)}p/50300000777202610`]: "local" });
    const ilegivel: Area = {
      ...base,
      obter: async (ch) => {
        const ks = ch === null || ch === undefined ? ["projetos/sigilo/"] : typeof ch === "string" ? [ch] : ch;
        if (ks.some((k) => k.startsWith("projetos/sigilo/"))) throw new Error("falha simulada ao ler o storage");
        return base.obter(ch);
      },
      aoMudar: base.aoMudar.bind(base),
    };
    const { repo: eu2 } = novoRepo(ESCOPO_EU, base, "x");
    await eu2.criarProjeto({ nome: "Meu plano" });
    const m2 = await montar({ area: ilegivel });
    await tique(40);
    checar(
      "o app abre com os projetos e um aviso curto, um so",
      texto(m2.raiz.querySelector(".prj")).includes("Meu plano") && avisos.filter((a) => a === AVISO_LIMPEZA).length === 1,
      avisos,
    );
    m2.destruir();
  }

  secao("app ligado: a colaboracao que nao inicia nao impede o app de abrir");
  {
    const base = areaMemoria();
    const quebrado: Area = {
      ...base,
      aoMudar: () => {
        throw new Error("storage.sync fora do ar");
      },
    };
    let caiu: unknown = null;
    let m3: Awaited<ReturnType<typeof montar>> | null = null;
    try {
      m3 = await montar({ sync: quebrado });
    } catch (e) {
      caiu = e;
    }
    checar("o app abre (as abas e o menu estao la)", caiu === null && !!m3?.raiz.querySelector(".prj .prj-topo"), caiu);
    m3?.destruir();
  }

  secao("app ligado: ao ganhar foco, o arquivo ligado sincroniza");
  {
    const chamadas: string[] = [];
    const arquivo: ArquivoLigado = {
      status: async () => ({ estado: "nunca", quando: 0, pendente: false }),
      configurado: async () => true,
      escolher: async () => undefined,
      reconectar: async () => true,
      sincronizar: async () => {
        chamadas.push("sincronizar");
        return null;
      },
      esquecer: async () => undefined,
      agendar: () => undefined,
      parar: () => undefined,
    } as unknown as ArquivoLigado;
    const janela = new EventTarget();
    const m4 = await montar({ arquivo, janela });
    const antes = chamadas.length;
    janela.dispatchEvent(new Event("focus"));
    await tique(5);
    checar("ao abrir e ao focar", antes === 1 && chamadas.length === 2, chamadas);
    m4.destruir();
    janela.dispatchEvent(new Event("focus"));
    await tique(5);
    checar("destruido, o foco nao faz mais nada", chamadas.length === 2, chamadas);
  }
  definirEmissorDeAviso(null);
}
