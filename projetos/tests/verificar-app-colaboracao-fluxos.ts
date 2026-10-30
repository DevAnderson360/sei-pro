/**
 * A colaboração montada como o app usa (colaboracao.ts): os itens do menu, as
 * faixas, o "Entendi" antes de gravar na unidade e os fluxos de ponta a ponta
 * (Sincronização, exportar e importar, enviar e receber, Atividades, Modelos e
 * Histórico) com o RPC, o seletor de arquivo e o download falsos, passando
 * pelos componentes de verdade (o Proxy do "Entendi", o repositório com a
 * memória do sigilo e os diálogos).
 *
 * E o que a ligação pediu depois das Tarefas 4 a 11 (notas-t12-t13.md): "Quem
 * vê" para "Só eu" sem "Entendi" à toa, o consentimento que o storage.sync não
 * grava, o estado com o relógio atrasado e os ouvintes antes da primeira
 * leitura, o "Entendi" antes de montar o lote do Atividades, a memória do
 * sigilo ilegível ao abrir (o app segue) e o tamanho do arquivo conferido
 * antes de ler.
 */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { definirConsentimento } from "@comum/sincronia/consentimento";
import { copiasEmMemoria } from "@comum/sincronia/copias";
import { definirEmissorDeAviso } from "@comum/ui/aviso";
import type { AbrirModal } from "@comum/ui/dialogo";
import { AppProjetos } from "../src/app/app";
import {
  type ArquivoEscolhido,
  type ArquivoLigado,
  AVISO_LIMPEZA,
  Colaboracao,
  escolherArquivoLocal,
  type GanchosDoApp,
} from "../src/app/colaboracao/colaboracao";
import { MENSAGEM_CONSENTIMENTO_NAO_GRAVOU, MENSAGEM_CONSENTIMENTO_NAO_LEU, MENSAGEM_SEM_ENTENDI } from "../src/app/colaboracao/consentir";
import { EstadoDaSincronia, linhaDoTexto } from "../src/app/colaboracao/estado";
import { montarSincronizacao } from "../src/app/dialogos/sincronizacao";
import { mensagemDoErro, TEXTO_COTA_CHEIA } from "../src/app/erros";
import { MENSAGEM_COPIA_DE_TUDO, MENSAGEM_GRANDE, MENSAGEM_MEMORIA_ENVIO } from "../src/arquivo/projetoArquivo";
import { importarAtividades, projetosLegados } from "../src/importacao/atividades";
import { LIMITES } from "../src/modelo/constantes";
import { ErroMemoriaSigilo } from "../src/modelo/memoriaSigilo";
import type { Projeto } from "../src/modelo/tipos";
import { MODELOS_EMBUTIDOS } from "../src/modelos/embutidos";
import type { ContextoProjetos } from "../src/ponte/tipos";
import { RepositorioProjetos } from "../src/repositorio";
import type { ArmazemCopiasProjetos, EnvelopeArquivo } from "../src/sincronia/arquivo";
import { CHAVE_CONSENTIMENTO, chaveDoConsentimento } from "../src/sincronia/consentimento";
import { chaveStatusTexto } from "../src/sincronia/textoPadrao";
import { digitar, escolherCombo, itensDoMenu, marcar, telaDoApp, texto } from "./apoioApp";
import { ESCOPO_EU, ESCOPO_UN } from "./apoioRepositorio";
import { HOJE } from "./fabrica";
import { ganttFalso } from "./ganttFalso";
import { projetoCompleto } from "./legadoAtividades";
import { botao, checar, disparar, secao, tique } from "./util";

const AGORA = Date.UTC(2026, 9, 6, 12);
const SIGILOSO = "50300.000555/2026-15";

const CTX: ContextoProjetos = {
  host: ESCOPO_UN.host,
  login: "ana",
  nome: "Ana Lima",
  unidade: { id: "110", sigla: "SEPRO", nome: "Serviço de Projetos" },
  versao: "4.1.5",
  temaEscuro: false,
  atividades: true,
};

/** O arquivo escolhido como o navegador entrega (tamanho em bytes; `lidos` conta quem pediu o texto). */
function arquivoDe(t: string, lidos?: { n: number }): ArquivoEscolhido {
  return {
    size: new TextEncoder().encode(t).length,
    text: async () => {
      if (lidos) lidos.n++;
      return t;
    },
  };
}

/** storage.sync que falha (a mensagem é a da cota do sync do Chrome, que não é a do storage.local). */
function syncQueFalha(falha: { ler: boolean; gravar: boolean }): Area {
  const base = areaMemoria();
  return {
    ...base,
    obter: async (k) => {
      if (falha.ler) throw new Error("QUOTA_BYTES quota exceeded");
      return base.obter(k);
    },
    gravar: async (i) => {
      if (falha.gravar) throw new Error("QUOTA_BYTES_PER_ITEM quota exceeded");
      return base.gravar(i);
    },
    aoMudar: base.aoMudar.bind(base),
  };
}

/** storage.local cuja memória do sigilo não lê (`falha.ler`) ou não grava (`falha.gravar`); o resto lê e grava normalmente. */
function areaComMemoriaQueFalha(falha: { ler: boolean; gravar?: boolean }): Area {
  const base = areaMemoria();
  const daMemoria = (ks: string[]) => ks.some((k) => k.startsWith("projetos/sigilo/"));
  return {
    ...base,
    obter: async (ch) => {
      const ks = ch === null || ch === undefined ? ["projetos/sigilo/"] : typeof ch === "string" ? [ch] : ch;
      if (falha.ler && daMemoria(ks)) throw new Error("falha simulada ao ler o storage");
      return base.obter(ch);
    },
    gravar: async (i) => {
      if (falha.gravar && daMemoria(Object.keys(i))) throw new Error("falha simulada ao gravar o storage");
      return base.gravar(i);
    },
    aoMudar: base.aoMudar.bind(base),
  };
}

interface Modal {
  titulo: string;
  conteudo: HTMLElement;
  aberto: boolean;
  fechar(): void;
}

function montar(
  o: {
    atividades?: boolean;
    area?: Area;
    sync?: Area;
    sincronizado?: unknown;
    copias?: boolean | ArmazemCopiasProjetos;
    esperaCopia?: number;
    arquivo?: ArquivoLigado;
    /** Operações do RPC que falham (a aba fechada): op → mensagem. */
    falhar?: Record<string, string>;
  } = {},
) {
  const doc = telaDoApp();
  const area = o.area ?? areaMemoria();
  const sync = o.sync ?? areaMemoria();
  const relogio = { agora: AGORA };
  const carimbo = () => ({ agora: ++relogio.agora, dispositivo: "pc-ana", por: "ana", nome: "Ana Lima" });
  const repos = { unidade: new RepositorioProjetos(area, ESCOPO_UN, carimbo), eu: new RepositorioProjetos(area, ESCOPO_EU, carimbo) };
  const modais: Modal[] = [];
  const abrirModal: AbrirModal = (m) => {
    doc.body.append(m.conteudo);
    const x: Modal = {
      titulo: m.titulo,
      conteudo: m.conteudo,
      aberto: true,
      fechar: () => {
        if (!x.aberto) return;
        x.aberto = false;
        m.conteudo.remove();
        m.aoFechar?.();
      },
    };
    modais.push(x);
    return x;
  };
  const chamadas: string[] = [];
  const baixados: Array<{ nome: string; conteudo: string; tipo: string }> = [];
  const arquivos: Array<string | ArquivoEscolhido> = [];
  const abertos: string[] = [];
  const doModelo: string[] = [];
  const resposta = {
    sincronizado: (o.sincronizado ?? { unidade: { estado: "ok", quando: AGORA, pendente: false }, eu: null }) as unknown,
    atividades: { fonte: "servidor", projetos: [projetoCompleto()] } as Record<string, unknown>,
    apagou: true,
  };
  const app = {
    aberto: "todos",
    abrirProjeto: async (id: string) => void abertos.push(id),
    novoProjetoDeModelo: (id: string) => void doModelo.push(id),
  };
  const redesenhos = { n: 0 };
  const c = new Colaboracao({
    ctx: { ...CTX, atividades: o.atividades ?? true },
    area,
    sync,
    repos,
    rpc: {
      chamar: async <T>(op: string): Promise<T> => {
        chamadas.push(op);
        const erro = o.falhar?.[op];
        if (erro) throw new Error(erro);
        if (op === "importarAtividades") return resposta.atividades as T;
        if (op === "apagarDoSei") return resposta.apagou as T;
        return resposta.sincronizado as T;
      },
    },
    abrirModal,
    confirmar: async () => true,
    baixar: (nome, conteudo, tipo) => void baixados.push({ nome, conteudo, tipo }),
    escolherArquivo: async () => {
      const a = arquivos.shift();
      return a === undefined ? null : typeof a === "string" ? arquivoDe(a) : a;
    },
    hoje: () => HOJE,
    agora: () => AGORA,
    carimbo,
    copias: typeof o.copias === "object" ? o.copias : o.copias ? copiasEmMemoria<EnvelopeArquivo>() : null,
    esperaCopia: o.esperaCopia,
    arquivo: o.arquivo ?? null,
    app: (): GanchosDoApp => app,
    aoRedesenhar: () => void redesenhos.n++,
  });
  const ultimo = () => modais.at(-1)!;
  return { c, doc, area, sync, repos, modais, ultimo, chamadas, baixados, arquivos, abertos, doModelo, app, resposta, relogio, redesenhos };
}

/** O aviso é um só para a página (o emissor é global): todas as montagens anotam aqui. */
const avisos: string[] = [];

const rotulos = (itens: unknown[]) => itens.map((i) => (i && typeof i === "object" ? (i as { rotulo: string }).rotulo : String(i)));
/** A linha de resultado ou de erro de uma seção do diálogo Sincronização. */
const avisoDaSecao = (conteudo: HTMLElement, s: string) => texto(conteudo.querySelector(`[data-secao='${s}'] .prj-sync-aviso`));
const erroDo = (conteudo: HTMLElement) => texto(conteudo.querySelector(".prj-erros"));
const consentiu = (sync: Area) =>
  definirConsentimento(sync, CHAVE_CONSENTIMENTO, "textoPadrao", chaveDoConsentimento(ESCOPO_UN.host, "ana", "110", "unidade"), "ligado");
/** O texto do arquivo sem o número (com ou sem a pontuação). */
const vazou = (conteudo: string, numero: string) => conteudo.includes(numero) || conteudo.includes(numero.replace(/\D/g, ""));

export async function verificarAppColaboracaoFluxos(): Promise<void> {
  definirEmissorDeAviso((t) => {
    avisos.push(t);
    return true;
  });
  const destruir: Array<{ c: Colaboracao }> = [];

  secao("colaboracao: menu ajustes do P4 (no lugar das telas)");
  const m = montar();
  destruir.push(m);
  await m.c.iniciar();
  const ext = m.c.extensoesMenu;
  checar("Sincronizacao e Modelos no comeco", rotulos(ext.sincronia?.() ?? []).join() === "Sincronização…,Modelos de projeto…");
  checar(
    "a Sincronizacao diz o que tem dentro (como na tela)",
    (ext.sincronia?.()[0] as { dica?: string } | undefined)?.dica === "Texto Padrão · arquivo",
  );
  checar(
    "Enviar, Receber e Importar do Atividades (com servidor)",
    rotulos((ext.arquivo?.() ?? []).filter(Boolean)).join() ===
      "Enviar projeto por arquivo…,Receber projeto de arquivo…,Importar do servidor do Atividades…",
  );
  checar("Historico de alteracoes no fim", rotulos(ext.fim?.() ?? []).join() === "Histórico de alterações");
  checar(
    "sem projeto ativo: sem o Enviar (como o CSV e o Imprimir)",
    rotulos((ext.arquivo?.({ semProjetos: true }) ?? []).filter(Boolean)).join() ===
      "Receber projeto de arquivo…,Importar do servidor do Atividades…",
  );
  const semServidor = montar({ atividades: false });
  destruir.push(semServidor);
  checar(
    "sem servidor do Atividades, o item nao aparece",
    !(semServidor.c.extensoesMenu.arquivo?.() ?? []).filter(Boolean).some((i) => /Atividades/.test(rotulos([i])[0] ?? "")),
  );
  const clicar = (itens: unknown[] | undefined, rotulo: string) =>
    (itens ?? []).find((i): i is { rotulo: string; fazer(): void } => rotulos([i])[0] === rotulo)?.fazer();
  clicar(semServidor.c.extensoesMenu.sincronia?.(), "Sincronização…");
  await tique(20);
  const t1 = semServidor.ultimo()?.titulo;
  clicar(semServidor.c.extensoesMenu.sincronia?.(), "Modelos de projeto…");
  await tique(20);
  const t2 = semServidor.ultimo()?.titulo;
  clicar(semServidor.c.extensoesMenu.fim?.(), "Histórico de alterações");
  await tique(20);
  checar(
    "os itens abrem os dialogos",
    t1 === "Sincronização" && t2 === "Modelos de projeto" && semServidor.ultimo()?.titulo === "Histórico de alterações",
    [t1, t2, semServidor.ultimo()?.titulo],
  );
  const quebrada = areaMemoria();
  const naoLe = montar({
    area: {
      ...quebrada,
      chaves: async () => {
        throw new Error("O storage não respondeu.");
      },
      aoMudar: quebrada.aoMudar.bind(quebrada),
    },
  });
  destruir.push(naoLe);
  clicar(naoLe.c.extensoesMenu.fim?.(), "Histórico de alterações");
  await tique(20);
  checar(
    "o item que falha vira aviso (nada de erro solto)",
    avisos.at(-1) === "O storage não respondeu." && naoLe.modais.length === 0,
    avisos.at(-1),
  );

  secao("colaboracao: faixas");
  checar("sem projeto 'Só eu': sem convite", m.c.faixas.children.length === 0);
  await m.repos.eu.criarProjeto({ nome: "Meu" });
  await tique(20);
  const convite = m.c.faixas.querySelector("[data-faixa='convite']");
  checar("com projeto 'Só eu' e sem resposta: o convite", !!convite);
  checar("a altura do painel e remedida quando a faixa entra", m.redesenhos.n > 0);
  const redesenhos = m.redesenhos.n;
  await m.repos.eu.criarProjeto({ nome: "Outro meu" });
  await m.area.gravar({ [chaveStatusTexto(ESCOPO_UN)]: { estado: "ok", quando: AGORA, pendente: true } });
  await tique(20);
  checar(
    "mudanca que nao muda as faixas: a mesma faixa fica (o foco do teclado nao se perde)",
    m.c.faixas.querySelector("[data-faixa='convite']") === convite && m.redesenhos.n === redesenhos,
  );
  botao(convite!, "Agora não")?.click();
  await tique(20);
  checar(
    "Agora nao: o convite some (nao pergunta de novo)",
    !m.c.faixas.querySelector("[data-faixa='convite']") && m.c.provedor.situacao().eu.consentimento === "desligado",
  );
  await m.area.gravar({ [chaveStatusTexto(ESCOPO_UN)]: { estado: "nunca", quando: AGORA, pendente: false, aguardandoPermissao: true } });
  await tique(20);
  const ag = m.c.faixas.querySelector("[data-faixa='aguardando']");
  checar("alteracoes da unidade esperando: a faixa do Entendi", !!ag);
  botao(ag!, "Entendi")?.click();
  await tique(20);
  checar(
    "Entendi: liga o da unidade e a faixa some",
    m.c.provedor.situacao().unidade.consentimento === "ligado" && !m.c.faixas.querySelector("[data-faixa='aguardando']"),
  );
  const conv2 = montar();
  destruir.push(conv2);
  await conv2.repos.eu.criarProjeto({ nome: "Pessoal" });
  await conv2.c.iniciar();
  botao(conv2.c.faixas, "Ligar…")?.click();
  await tique(5);
  checar("Ligar…: o dialogo Guardar no SEI", conv2.ultimo().titulo === "Guardar no SEI");
  botao(conv2.ultimo().conteudo, "Ligar")?.click();
  await tique(20);
  checar(
    "Ligar: o pessoal fica ligado e o convite some",
    conv2.c.provedor.situacao().eu.consentimento === "ligado" && conv2.c.faixas.children.length === 0,
  );

  secao("colaboracao: o Entendi antes de gravar na unidade");
  const g = montar();
  destruir.push(g);
  await g.c.iniciar();
  const criando = g.c.repos.unidade.criarProjeto({ nome: "Da unidade" });
  await tique(5);
  checar("criar na unidade abre o aviso", g.ultimo().titulo === "Projetos de toda a unidade");
  botao(g.ultimo().conteudo, "Entendi")?.click();
  const criado = await criando;
  checar("Entendi: grava", !!(await g.repos.unidade.obterProjeto(criado.id)));
  await g.c.repos.unidade.criarProjeto({ nome: "Outro" });
  checar("depois nao pergunta mais", g.modais.length === 1);
  await g.c.repos.eu.criarProjeto({ nome: "Pessoal" });
  checar("o 'Só eu' nunca pergunta", g.modais.length === 1);

  secao("colaboracao: o storage.sync que nao le ou nao grava o consentimento");
  const falhaSync = { ler: false, gravar: true };
  const fs = montar({ sync: syncQueFalha(falhaSync) });
  destruir.push(fs);
  await fs.c.iniciar();
  const semGravar = fs.c.repos.unidade.criarProjeto({ nome: "X" }).then(
    () => null,
    (e: unknown) => e,
  );
  await tique(5);
  botao(fs.ultimo().conteudo, "Entendi")?.click();
  const erroGravar = await semGravar;
  checar(
    "o Entendi que nao grava: mensagem propria (nao a da cota do navegador) e nada gravado",
    mensagemDoErro(erroGravar) === "Não foi possível guardar a sua confirmação. Tente de novo." &&
      MENSAGEM_CONSENTIMENTO_NAO_GRAVOU === "Não foi possível guardar a sua confirmação. Tente de novo." &&
      mensagemDoErro(erroGravar) !== TEXTO_COTA_CHEIA &&
      (await fs.repos.unidade.dados()).projetos.length === 0,
    mensagemDoErro(erroGravar),
  );
  falhaSync.ler = true;
  const modaisAntes = fs.modais.length;
  const erroLer = await fs.c.repos.unidade.criarProjeto({ nome: "Y" }).then(
    () => null,
    (e: unknown) => e,
  );
  checar(
    "o consentimento que nao le: mensagem propria, sem abrir o aviso e sem gravar",
    mensagemDoErro(erroLer) === MENSAGEM_CONSENTIMENTO_NAO_LEU &&
      fs.modais.length === modaisAntes &&
      (await fs.repos.unidade.dados()).projetos.length === 0,
    mensagemDoErro(erroLer),
  );
  falhaSync.ler = false;
  await fs.area.gravar({ [chaveStatusTexto(ESCOPO_UN)]: { estado: "ok", quando: AGORA, pendente: true, aguardandoPermissao: true } });
  await tique(20);
  botao(fs.c.faixas, "Entendi")?.click();
  await tique(10);
  checar(
    "o Entendi da faixa que nao grava: o aviso com a mensagem propria e a faixa fica",
    avisos.at(-1) === MENSAGEM_CONSENTIMENTO_NAO_GRAVOU && !!fs.c.faixas.querySelector("[data-faixa='aguardando']"),
    avisos.at(-1),
  );

  secao("colaboracao: Sincronizacao, exportar e importar");
  await g.c.abrirSincronizacao();
  checar("abre o dialogo", g.ultimo().titulo === "Sincronização");
  botao(g.ultimo().conteudo.querySelector("[data-secao='unidade']")!, "Sincronizar agora")?.click();
  await tique(10);
  checar("Sincronizar agora pede a aba", g.chamadas.includes("sincronizarAgora") && avisos.at(-1) === "Sincronizado.", avisos.at(-1));
  const expirada = montar({
    sincronizado: {
      unidade: { estado: "erro", quando: 1, pendente: false, mensagem: "Sessão do SEI expirada. Entre de novo no SEI." },
      eu: null,
    },
  });
  destruir.push(expirada);
  await expirada.c.iniciar();
  await expirada.c.abrirSincronizacao();
  botao(expirada.ultimo().conteudo, "Sincronizar agora")?.click();
  await tique(10);
  checar("e, se nao deu certo, o aviso diz o motivo", avisos.at(-1) === "Sessão do SEI expirada. Entre de novo no SEI.", avisos.at(-1));
  const fechada = montar({ falhar: { sincronizarAgora: "A aba do SEI foi fechada." } });
  destruir.push(fechada);
  await fechada.c.iniciar();
  await fechada.c.abrirSincronizacao();
  botao(fechada.ultimo().conteudo, "Sincronizar agora")?.click();
  await tique(10);
  checar(
    "a aba que nao responde: o erro fica na secao do texto (o dialogo segue aberto)",
    avisoDaSecao(fechada.ultimo().conteudo, "unidade") === "A aba do SEI foi fechada." && fechada.ultimo().aberto,
  );
  await fechada.repos.eu.criarProjeto({ nome: "Meu" });
  await consentiu(fechada.sync);
  await definirConsentimento(
    fechada.sync,
    CHAVE_CONSENTIMENTO,
    "textoPadrao",
    chaveDoConsentimento(ESCOPO_UN.host, "ana", "110", "eu"),
    "ligado",
  );
  await fechada.c.abrirSincronizacao();
  botao(fechada.ultimo().conteudo, "Desligar e apagar do SEI")?.click();
  await tique(20);
  checar(
    "Desligar e apagar do SEI: pede a aba e diz que apagou",
    fechada.chamadas.includes("apagarDoSei") && /foi apagado do SEI/.test(avisoDaSecao(fechada.ultimo().conteudo, "eu")),
    avisoDaSecao(fechada.ultimo().conteudo, "eu"),
  );
  botao(g.ultimo().conteudo, "Exportar tudo")?.click();
  await tique(10);
  const exportado = g.baixados.at(-1);
  checar(
    "exportar baixa a copia de tudo e diz o nome do arquivo",
    /^projetos-seipro-ana-2026-10-06\.json$/.test(exportado?.nome ?? "") &&
      /"tipo": "copia"/.test(exportado?.conteudo ?? "") &&
      avisoDaSecao(g.ultimo().conteudo, "arquivo").includes("projetos-seipro-ana-2026-10-06.json"),
    exportado?.nome,
  );
  const outro = montar();
  destruir.push(outro);
  await outro.c.iniciar();
  outro.arquivos.push(exportado!.conteudo);
  await outro.c.abrirSincronizacao();
  botao(outro.ultimo().conteudo, "Importar de um arquivo…")?.click();
  await tique(20);
  checar(
    "importar noutro navegador junta tudo (e diz quanto)",
    (await outro.repos.unidade.dados()).projetos.length === 2 &&
      (await outro.repos.eu.dados()).projetos.length === 1 &&
      /importad/.test(avisoDaSecao(outro.ultimo().conteudo, "arquivo")),
    avisoDaSecao(outro.ultimo().conteudo, "arquivo"),
  );
  const importarComo = async (a: string | ArquivoEscolhido): Promise<string> => {
    outro.arquivos.push(a);
    await outro.c.abrirSincronizacao();
    botao(outro.ultimo().conteudo, "Importar de um arquivo…")?.click();
    await tique(20);
    return avisoDaSecao(outro.ultimo().conteudo, "arquivo");
  };
  checar("arquivo que nao e JSON: avisa", (await importarComo("{ nao e json")) === "O arquivo não é um JSON válido.");
  checar(
    "arquivo de versao mais nova: pede para atualizar (antes de ler o envelope)",
    /versão mais nova/.test(await importarComo(JSON.stringify({ formato: "seipro-projetos", versao: 99, tipo: "copia", escopos: [] }))),
  );
  const enviadoDeMentira = JSON.stringify({
    formato: "seipro-projeto",
    versao: 1,
    projeto: { nome: "P", etiquetas: [] },
    fases: [],
    etapas: [],
  });
  checar("o projeto enviado no Importar: explica o Receber", /Receber projeto de arquivo/.test(await importarComo(enviadoDeMentira)));
  const lidosGrande = { n: 0 };
  const grande: ArquivoEscolhido = { ...arquivoDe("{}", lidosGrande), size: 60 * 1024 * 1024 };
  checar(
    "arquivo grande demais: recusado pelo tamanho, sem ler o texto",
    /passa de 50 MB/.test(await importarComo(grande)) && lidosGrande.n === 0,
  );
  const deOutro = JSON.parse(exportado!.conteudo) as EnvelopeArquivo;
  for (const s of deOutro.escopos) s.escopo.login = "bia";
  for (const s of deOutro.sigilo ?? []) s.login = "bia";
  const antesDeOutro = (await outro.repos.unidade.entidades()).p.length;
  checar(
    "arquivo de outro usuario: diz e nao importa nada",
    /outro usuário/.test(await importarComo(JSON.stringify(deOutro))) && (await outro.repos.unidade.entidades()).p.length === antesDeOutro,
  );

  secao("colaboracao: enviar e receber projeto");
  const [pUn] = (await g.repos.unidade.dados()).projetos;
  g.app.aberto = pUn!.id;
  await g.c.enviarProjeto();
  const enviado = g.baixados.at(-1);
  checar(
    "com um projeto aberto: baixa direto",
    /\.seipro-projeto\.json$/.test(enviado?.nome ?? "") && avisos.at(-1)?.includes("baixado") === true,
    enviado?.nome,
  );
  const sig = await g.c.repos.unidade.criarProjeto({ nome: "Apuração", processo: { protocolo: SIGILOSO, sigiloso: true } });
  g.app.aberto = sig.id;
  await g.c.enviarProjeto();
  checar(
    "o processo sigiloso nao vai no arquivo (pelo corte com a memoria)",
    /^Apuração\.seipro-projeto\.json$/.test(g.baixados.at(-1)?.nome ?? "") && !vazou(g.baixados.at(-1)?.conteudo ?? SIGILOSO, SIGILOSO),
  );
  g.app.aberto = "todos";
  await g.c.enviarProjeto();
  checar("no Todos: escolher o projeto", g.ultimo().titulo === "Enviar projeto por arquivo");
  const falhaMem = { ler: false };
  const mem = montar({ area: areaComMemoriaQueFalha(falhaMem) });
  destruir.push(mem);
  await mem.c.iniciar();
  const pm = await mem.repos.eu.criarProjeto({ nome: "Sindicância", processo: { protocolo: SIGILOSO, sigiloso: true } });
  falhaMem.ler = true;
  mem.app.aberto = pm.id;
  await mem.c.enviarProjeto();
  checar(
    "memoria do sigilo ilegivel: nenhum arquivo e o aviso explica",
    mem.baixados.length === 0 && avisos.at(-1) === MENSAGEM_MEMORIA_ENVIO,
    avisos.at(-1),
  );
  falhaMem.ler = false;
  const r = montar();
  destruir.push(r);
  await r.c.iniciar();
  await consentiu(r.sync);
  r.arquivos.push(enviado!.conteudo);
  await r.c.receberProjeto();
  checar("receber: a previa", r.ultimo().titulo === "Receber projeto de arquivo" && texto(r.ultimo().conteudo).includes(pUn!.nome));
  botao(r.ultimo().conteudo, "Receber projeto")?.click();
  await tique(20);
  const recebidos = (await r.repos.unidade.dados()).projetos;
  checar(
    "recebido na unidade, com id novo, e o app abre ele",
    recebidos.length === 1 && recebidos[0]?.id !== pUn!.id && r.abertos.at(-1) === recebidos[0]?.id && /recebido/.test(avisos.at(-1) ?? ""),
    r.abertos,
  );
  r.arquivos.push(exportado!.conteudo);
  await r.c.receberProjeto();
  checar("a copia de tudo no Receber: explica onde importar", avisos.at(-1) === MENSAGEM_COPIA_DE_TUDO, avisos.at(-1));
  const lidosRec = { n: 0 };
  r.arquivos.push({ ...arquivoDe("{}", lidosRec), size: 6 * 1024 * 1024 });
  const modaisAntesGrande = r.modais.length;
  await r.c.receberProjeto();
  checar(
    "projeto grande demais: recusado pelo tamanho, sem ler o texto e sem dialogo",
    avisos.at(-1) === MENSAGEM_GRANDE && lidosRec.n === 0 && r.modais.length === modaisAntesGrande,
  );
  r.arquivos.push("{ quebrado");
  await r.c.receberProjeto();
  checar("arquivo quebrado: avisa sem abrir o dialogo", /não é um projeto enviado/.test(avisos.at(-1) ?? ""), avisos.at(-1));
  const semEntendi = montar();
  destruir.push(semEntendi);
  await semEntendi.c.iniciar();
  semEntendi.arquivos.push(enviado!.conteudo, enviado!.conteudo);
  await semEntendi.c.receberProjeto();
  const dlgRec = semEntendi.ultimo();
  botao(dlgRec.conteudo, "Receber projeto")?.click();
  await tique(5);
  checar("receber em Toda a unidade pergunta o Entendi", semEntendi.ultimo().titulo === "Projetos de toda a unidade");
  semEntendi.ultimo().fechar();
  await tique(10);
  checar(
    "fechar o aviso sem o Entendi: nada recebido e o dialogo explica",
    erroDo(dlgRec.conteudo) === MENSAGEM_SEM_ENTENDI && dlgRec.aberto && (await semEntendi.repos.unidade.dados()).projetos.length === 0,
    erroDo(dlgRec.conteudo),
  );
  botao(dlgRec.conteudo, "Receber projeto")?.click();
  await tique(5);
  botao(semEntendi.ultimo().conteudo, "Entendi")?.click();
  await tique(20);
  checar("com o Entendi: recebido e o dialogo fecha", (await semEntendi.repos.unidade.dados()).projetos.length === 1 && !dlgRec.aberto);

  secao("colaboracao: importar do Atividades, modelos e historico");
  r.c.importarAtividades();
  await tique(20);
  checar(
    "pede a aba e abre o dialogo",
    r.chamadas.includes("importarAtividades") && r.ultimo().titulo === "Importar do servidor do Atividades",
  );
  botao(r.ultimo().conteudo, "Importar")?.click();
  await tique(30);
  checar(
    "importa na unidade, abre o projeto e o aviso diz o que veio",
    !!(await r.repos.unidade.obterProjeto("atvp42")) && r.abertos.at(-1) === "atvp42" && avisos.at(-1) === "1 projeto importado.",
    avisos.at(-1),
  );
  await r.repos.unidade.removerProjeto("atvp42");
  r.resposta.atividades = { fonte: "cache", aviso: "tempo esgotado", projetos: [projetoCompleto()], cortados: 2 };
  r.c.importarAtividades();
  await tique(20);
  const dlgAtv = r.ultimo().conteudo;
  const item42 = dlgAtv.querySelector<HTMLInputElement>(".prj-importar-item input[value='42']");
  checar(
    "excluido aqui: aparece desligado (nao volta)",
    !!item42?.disabled && texto(item42?.closest(".prj-importar-item")).includes("excluído aqui"),
    texto(item42?.closest(".prj-importar-item")),
  );
  checar(
    "o guardado e os cortados: o dialogo explica",
    texto(dlgAtv).includes("tempo esgotado") && texto(dlgAtv).includes("ficaram de fora"),
  );
  r.ultimo().fechar();
  const lote = montar();
  destruir.push(lote);
  await lote.c.iniciar();
  const antigo = { ...projetoCompleto(), nome_projeto: "Nome antigo" };
  await importarAtividades(lote.repos, projetosLegados([antigo]), "unidade", HOJE);
  lote.relogio.agora += 100;
  lote.c.importarAtividades();
  await tique(20);
  botao(lote.ultimo().conteudo, "Importar")?.click();
  await tique(10);
  checar("importar na unidade sem o Entendi: pergunta", lote.ultimo().titulo === "Projetos de toda a unidade");
  // Enquanto o aviso espera, chega a edição de um colega (gravada antes, no relógio dele).
  const s0 = (await lote.repos.unidade.entidades()).p.find((x) => x.id === "atvp42") as Projeto;
  await lote.repos.unidade.importar({ p: [{ ...s0, nome: "Editado pela Bia", atualizadoEm: s0.atualizadoEm + 1, dispositivo: "pc-bia" }] });
  botao(lote.ultimo().conteudo, "Entendi")?.click();
  await tique(30);
  checar(
    "o Entendi vem antes do lote: a edicao do colega que chegou na espera fica",
    (await lote.repos.unidade.obterProjeto("atvp42"))?.nome === "Editado pela Bia",
    (await lote.repos.unidade.obterProjeto("atvp42"))?.nome,
  );
  await r.c.abrirModelos();
  botao(r.ultimo().conteudo.querySelector(".prj-modelo")!, "Criar projeto")?.click();
  checar("Modelos: Criar projeto pede o Novo projeto no modelo", r.doModelo.at(-1) === MODELOS_EMBUTIDOS[0]!.id);
  const mod = montar();
  destruir.push(mod);
  await mod.c.iniciar();
  const base = await mod.repos.unidade.criarProjeto({ nome: "Base" });
  const salvo = await mod.repos.unidade.salvarComoModelo(base.id, "Modelo da unidade");
  await mod.c.abrirModelos();
  const dlgMod = mod.ultimo();
  botao(dlgMod.conteudo.querySelector(`.prj-modelo[data-id='${salvo.id}']`)!, "Excluir")?.click();
  await tique(10);
  checar("excluir modelo da unidade pergunta o Entendi", mod.ultimo().titulo === "Projetos de toda a unidade");
  mod.ultimo().fechar();
  await tique(10);
  checar(
    "sem o Entendi: o modelo fica e o dialogo explica",
    erroDo(dlgMod.conteudo) === MENSAGEM_SEM_ENTENDI && (await mod.repos.unidade.dados()).modelos.length === 1,
  );
  await r.c.abrirHistorico();
  const linhas = [...r.ultimo().conteudo.querySelectorAll(".prj-historico-reg")].map((x) => texto(x));
  checar(
    "Historico: os registros (recebido e importado), com quem mudou",
    linhas.length >= 2 && linhas.some((l) => l.includes("Ana Lima")),
    linhas,
  );
  checar(
    "Historico: o projeto excluido (lapide) ainda tem nome",
    linhas.some((l) => l.includes("Revisão da Resolução 1")) && !linhas.some((l) => l.includes("Item que não existe mais")),
    linhas,
  );

  secao("colaboracao: Quem ve de Toda a unidade para So eu sem Entendi a toa");
  await verificarQuemVe();

  secao("colaboracao: estado com o relogio atrasado e os ouvintes antes da primeira leitura");
  const relatorio = { futuros: 2, quando: AGORA, ignorados: 2, excedentes: 0 };
  const aguardando = linhaDoTexto(
    {
      vis: "unidade",
      nome: "[_SEIPRO_PRJ_UNIDADE]",
      consentimento: "nao-perguntado",
      status: { estado: "ok", quando: AGORA, pendente: true, aguardandoPermissao: true },
      relatorio,
    },
    AGORA,
  );
  const nunca = linhaDoTexto(
    {
      vis: "unidade",
      nome: "[_SEIPRO_PRJ_UNIDADE]",
      consentimento: "ligado",
      status: { estado: "nunca", quando: AGORA, pendente: false },
      relatorio,
    },
    AGORA,
  );
  checar(
    "esperando o Entendi e com o relogio atrasado: a linha explica os dois",
    aguardando.startsWith("Há alterações esperando o seu “Entendi”") && aguardando.includes("relógio deste computador"),
    aguardando,
  );
  checar("nunca lido e com o relogio atrasado: a linha explica o relogio", nunca.includes("relógio deste computador"), nunca);
  const lenta = areaMemoria();
  let soltar: () => void = () => undefined;
  const portao = new Promise<void>((ok) => {
    soltar = ok;
  });
  let primeira = true;
  const areaLenta: Area = {
    ...lenta,
    obter: async (k) => {
      const v = await lenta.obter(k);
      if (primeira) {
        primeira = false;
        await portao;
      }
      return v;
    },
    aoMudar: lenta.aoMudar.bind(lenta),
  };
  const est = new EstadoDaSincronia({
    area: areaLenta,
    sync: areaMemoria(),
    escopos: { unidade: ESCOPO_UN, eu: ESCOPO_EU },
    agora: () => AGORA,
  });
  const iniciando = est.iniciar();
  await tique(5);
  await lenta.gravar({ [chaveStatusTexto(ESCOPO_UN)]: { estado: "ok", quando: AGORA, ultimoOk: AGORA, pendente: false } });
  soltar();
  await iniciando;
  await tique(10);
  checar(
    "o status gravado durante a primeira leitura nao se perde",
    est.situacao().unidade.status?.estado === "ok",
    est.situacao().unidade.status,
  );
  est.parar();

  secao("colaboracao: memoria do sigilo ilegivel ao abrir (o app segue)");
  const falhaAbrir = { ler: false };
  const ileg = montar({ area: areaComMemoriaQueFalha(falhaAbrir), copias: true });
  destruir.push(ileg);
  await ileg.repos.unidade.criarProjeto({ nome: "Apuração", processo: { protocolo: SIGILOSO, sigiloso: true } });
  falhaAbrir.ler = true;
  const avisosAntes = avisos.length;
  let caiu: unknown = null;
  await ileg.c.iniciar().catch((e: unknown) => {
    caiu = e;
  });
  await tique(30);
  checar(
    "iniciar nao cai e a limpeza vira um aviso curto (um so, para os dois escopos)",
    caiu === null && avisos.slice(avisosAntes).filter((a) => a === AVISO_LIMPEZA).length === 1,
    avisos.slice(avisosAntes),
  );
  await ileg.repos.eu.criarProjeto({ nome: "Meu" });
  await tique(20);
  checar("o resto segue: as faixas continuam", !!ileg.c.faixas.querySelector("[data-faixa='convite']"));
  await ileg.c.abrirSincronizacao();
  checar(
    "a copia do dia que falhou aparece no dialogo, com o texto da memoria",
    texto(ileg.ultimo().conteudo.querySelector("[data-secao='copias']")).includes(new ErroMemoriaSigilo().message),
    texto(ileg.ultimo().conteudo.querySelector("[data-secao='copias']")),
  );
  falhaAbrir.ler = false;
  await ileg.c.abrirSincronizacao();
  const copiasDepois = ileg.ultimo().conteudo.querySelector("[data-secao='copias']");
  checar(
    "abrir o dialogo de novo tenta a copia do dia outra vez",
    copiasDepois?.querySelectorAll(".prj-copias li").length === 1 && !texto(copiasDepois).includes("não foi feita"),
    texto(copiasDepois),
  );

  secao("colaboracao: arquivo ligado (abrir, mudar, foco, seletor recusado, destruir)");
  const feitos: string[] = [];
  const arquivo: ArquivoLigado = {
    status: async () => null,
    configurado: async () => false,
    escolher: async () => {
      feitos.push("escolher");
      throw Object.assign(new Error("Cross origin sub frames aren't allowed to show a file picker."), { name: "SecurityError" });
    },
    reconectar: async () => null,
    sincronizar: async () => {
      feitos.push("sincronizar");
      return null;
    },
    esquecer: async () => undefined,
    agendar: () => void feitos.push("agendar"),
    parar: () => void feitos.push("parar"),
  };
  const lig = montar({ arquivo });
  await lig.c.iniciar();
  checar("ao abrir: sincroniza o arquivo", feitos.join() === "sincronizar", feitos);
  await lig.repos.unidade.criarProjeto({ nome: "Muda" });
  checar("mudou um projeto: agenda a gravacao do arquivo", feitos.at(-1) === "agendar");
  lig.c.aoGanharFoco();
  checar("ganhou o foco: sincroniza de novo", feitos.at(-1) === "sincronizar");
  await lig.c.abrirSincronizacao();
  botao(lig.ultimo().conteudo, "Criar arquivo…")?.click();
  await tique(10);
  checar(
    "seletor recusado dentro do painel: o dialogo explica em portugues",
    /não deixa escolher/.test(avisoDaSecao(lig.ultimo().conteudo, "arquivo")),
    avisoDaSecao(lig.ultimo().conteudo, "arquivo"),
  );
  lig.c.destruir();
  const depois = feitos.length;
  await lig.repos.eu.criarProjeto({ nome: "Depois" });
  await tique(20);
  checar(
    "destruir: para o arquivo e nada mais escuta (nem faixa, nem agenda)",
    feitos[depois - 1] === "parar" && feitos.length === depois && lig.c.faixas.children.length === 0,
    feitos,
  );

  secao("colaboracao: a Sincronizacao abre sem esperar a copia do dia pendurada");
  const baseCopias = copiasEmMemoria<EnvelopeArquivo>();
  let soltarCopia: () => void = () => undefined;
  const presa = new Promise<void>((ok) => {
    soltarCopia = ok;
  });
  const copiasLentas: ArmazemCopiasProjetos = {
    listar: (d) => baseCopias.listar(d),
    gravar: async (c) => {
      await presa;
      return baseCopias.gravar(c);
    },
    apagar: (id) => baseCopias.apagar(id),
  };
  const pend = montar({ copias: copiasLentas, esperaCopia: 20 });
  destruir.push(pend);
  await pend.repos.eu.criarProjeto({ nome: "Meu" });
  await pend.c.iniciar();
  const abriu = await Promise.race([pend.c.abrirSincronizacao().then(() => "abriu"), tique(300).then(() => "pendurado")]);
  checar("a copia do dia que nao termina nao segura o dialogo", abriu === "abriu" && pend.ultimo()?.titulo === "Sincronização", abriu);
  soltarCopia();
  await tique(20);
  checar("a copia termina depois, normalmente", (await baseCopias.listar({ host: ESCOPO_UN.host, login: "ana" })).length === 1);

  secao("colaboracao: o Sincronizado so quando sincronizou");
  const hon = montar();
  destruir.push(hon);
  await hon.c.iniciar();
  const sincronizarCom = async (resposta: unknown): Promise<string | undefined> => {
    hon.resposta.sincronizado = resposta;
    await hon.c.abrirSincronizacao();
    botao(hon.ultimo().conteudo.querySelector("[data-secao='unidade']")!, "Sincronizar agora")?.click();
    await tique(10);
    return avisos.at(-1);
  };
  const tortas: unknown[] = [null, "ok", { unidade: 5 }, { unidade: { estado: "talvez", quando: 1 } }, { eu: null }];
  const ditos: Array<string | undefined> = [];
  for (const t of tortas) ditos.push(await sincronizarCom(t));
  checar(
    "resposta torta da aba: nao diz Sincronizado",
    ditos.every((d) => d === "Não foi possível sincronizar agora."),
    ditos,
  );
  checar(
    "lido mas esperando o Entendi: diz isso",
    (await sincronizarCom({
      unidade: { estado: "ok", quando: AGORA, ultimoOk: AGORA, pendente: true, aguardandoPermissao: true },
      eu: null,
    })) === "Lido do SEI; há alterações esperando o seu “Entendi”.",
    avisos.at(-1),
  );
  checar(
    "o pessoal torto (nem nulo nem status) tambem nao e Sincronizado",
    (await sincronizarCom({ unidade: { estado: "ok", quando: AGORA, pendente: false }, eu: "x" })) ===
      "Não foi possível sincronizar agora.",
    avisos.at(-1),
  );
  checar(
    "os dois em dia: Sincronizado",
    (await sincronizarCom({
      unidade: { estado: "ok", quando: AGORA, pendente: false },
      eu: { estado: "ok", quando: AGORA, pendente: false },
    })) === "Sincronizado.",
  );

  secao("colaboracao: sem ler os projetos Só eu, a faixa do Entendi aparece assim mesmo");
  const semEu = montar();
  destruir.push(semEu);
  await semEu.repos.eu.criarProjeto({ nome: "Meu" });
  await semEu.area.gravar({
    [chaveStatusTexto(ESCOPO_UN)]: { estado: "ok", quando: AGORA, pendente: true, aguardandoPermissao: true },
  });
  (semEu.repos.eu as { dados: RepositorioProjetos["dados"] }).dados = async () => {
    throw new Error("O storage não respondeu.");
  };
  await semEu.c.iniciar();
  checar(
    "o convite fica de fora e o aguardando aparece",
    !!semEu.c.faixas.querySelector("[data-faixa='aguardando']") && !semEu.c.faixas.querySelector("[data-faixa='convite']"),
    semEu.c.faixas.children.length,
  );

  secao("dialogo Sincronizacao: aoMudar que avisa na hora nao quebra a montagem");
  let quebrou: unknown = null;
  const situ = await m.c.provedor.ler();
  await montarSincronizacao({
    sigla: "SEPRO",
    agora: () => AGORA,
    situacao: async () => situ,
    aoMudar: (f) => {
      f(situ);
      return () => undefined;
    },
    sincronizar: async () => undefined,
    pessoal: { ligar: async () => false, desligar: async () => undefined, apagar: async () => false },
    arquivo: null,
    exportar: async () => undefined,
    importar: async () => undefined,
    copias: null,
    baixar: () => undefined,
    confirmar: async () => true,
  }).catch((e: unknown) => {
    quebrou = e;
  });
  checar("sem erro de variavel antes da declaracao", quebrou === null, quebrou);

  secao("colaboracao: o seletor de arquivo do disco devolve o arquivo (o tamanho vem antes do texto)");
  const docSel = telaDoApp();
  const proto = Object.getPrototypeOf(docSel.createElement("input")) as Record<string, unknown>;
  const tinha = Object.getOwnPropertyDescriptor(proto, "click");
  let alvo: HTMLInputElement | null = null;
  proto.click = function (this: HTMLInputElement) {
    alvo = this;
  };
  try {
    const escolhendo = escolherArquivoLocal();
    const f = arquivoDe("{}");
    Object.defineProperty(alvo!, "files", { value: [f] });
    disparar(alvo!, "change");
    const recebido = await escolhendo;
    checar("escolheu: o proprio arquivo (sem ler o texto)", recebido === f && alvo!.getAttribute("accept") === ".json,application/json");
    const cancelando = escolherArquivoLocal();
    disparar(alvo!, "cancel");
    checar("cancelou: null", (await cancelando) === null);
  } finally {
    if (tinha) Object.defineProperty(proto, "click", tinha);
    else delete proto.click;
  }

  definirEmissorDeAviso(null);
  for (const x of destruir) x.c.destruir();
}

/** "Quem vê" pelo app de verdade (AppProjetos com o repositório da unidade que pergunta o "Entendi"). */
/** O processo sigiloso da caixa (com o número): escolhê-lo no diálogo grava a memória do sigilo. */
const DA_CAIXA = "50300.000777/2026-02";

/** O AppProjetos de verdade com o repositório da unidade que pergunta o "Entendi" (como o main.ts da T13 monta). */
function montarApp(x: ReturnType<typeof montar>, area: Area, confirmacoes: string[]): AppProjetos {
  const doc = x.doc;
  return new AppProjetos({
    raiz: doc.getElementById("app")!,
    ctx: CTX,
    area,
    repos: x.c.repos,
    rpc: {
      chamar: async <T>(op: string): Promise<T> =>
        (op === "processosDaCaixa"
          ? [{ protocolo: DA_CAIXA, idProcedimento: "77", tipo: "Apuração", especificacao: "Sindicância", sigiloso: true }]
          : []) as T,
    },
    abrirModal: (o) => {
      const modal = { titulo: o.titulo, conteudo: o.conteudo, aberto: true, fechar: () => undefined };
      doc.body.append(o.conteudo);
      modal.fechar = () => {
        if (!modal.aberto) return;
        modal.aberto = false;
        o.conteudo.remove();
        o.aoFechar?.();
      };
      x.modais.push(modal);
      return modal;
    },
    confirmar: async (t) => {
      confirmacoes.push(t);
      return true;
    },
    baixar: () => undefined,
    hoje: () => HOJE,
    agora: () => AGORA,
    montarGantt: ganttFalso().montar,
    largura: () => 1000,
    sincronia: x.c.provedor,
    extensoesMenu: x.c.extensoesMenu,
  });
}

async function verificarQuemVe(): Promise<void> {
  const falha = { ler: false, gravar: false };
  const area = areaComMemoriaQueFalha(falha);
  const x = montar({ area });
  const doc = x.doc;
  const confirmacoes: string[] = [];
  const p = await x.repos.unidade.criarProjeto({ nome: "Pregão 2027" });
  const s = await x.repos.unidade.criarProjeto({ nome: "Apuração", processo: { protocolo: SIGILOSO, sigiloso: true } });
  const app = montarApp(x, area, confirmacoes);
  await x.c.iniciar();
  await app.iniciar();
  const raiz = doc.getElementById("app")!;
  const form = () => doc.querySelector<HTMLElement>(".prj-form-projeto");
  const editar = async (id: string, nome: string, vis: "eu" | "unidade") => {
    app.focarProjeto(id);
    await tique();
    botao(raiz, "Editar projeto")?.click();
    digitar(form()?.querySelector("input[name='nome']"), nome);
    marcar(form()?.querySelector(`input[value='${vis}']`));
    botao(form()!, "Salvar")?.click();
    await tique(80);
  };
  const avisosDaUnidade = () => x.modais.filter((m) => m.titulo === "Projetos de toda a unidade").length;

  await editar(p.id, "Pregão renomeado", "eu");
  checar(
    "sair de Toda a unidade: sem Entendi, o projeto vai para So eu com o nome novo",
    avisosDaUnidade() === 0 &&
      (await x.repos.eu.obterProjeto(p.id))?.nome === "Pregão renomeado" &&
      !(await x.repos.unidade.obterProjeto(p.id)) &&
      confirmacoes.length === 1,
    { avisos: avisosDaUnidade(), confirmacoes },
  );
  checar("e o dialogo fecha", !form());

  await editar(p.id, "Pregão de volta", "unidade");
  checar("entrar em Toda a unidade: pergunta o Entendi", avisosDaUnidade() === 1);
  x.ultimo().fechar();
  await tique(40);
  checar(
    "sem o Entendi: nada muda (nem o nome no So eu) e o dialogo explica",
    (await x.repos.eu.obterProjeto(p.id))?.nome === "Pregão renomeado" &&
      !(await x.repos.unidade.obterProjeto(p.id)) &&
      texto(form()?.querySelector(".prj-erros")) === MENSAGEM_SEM_ENTENDI,
    { eu: (await x.repos.eu.obterProjeto(p.id))?.nome, erro: texto(form()?.querySelector(".prj-erros")) },
  );
  botao(form()!, "Salvar")?.click();
  await tique(20);
  botao(x.ultimo().conteudo, "Entendi")?.click();
  await tique(80);
  checar(
    "com o Entendi: o projeto entra em Toda a unidade com o nome novo",
    (await x.repos.unidade.obterProjeto(p.id))?.nome === "Pregão de volta" && !(await x.repos.eu.obterProjeto(p.id)),
  );

  const antes = confirmacoes.length;
  await editar(p.id, "x".repeat(LIMITES.nome + 1), "eu");
  checar(
    "nome invalido: valida antes de perguntar e de mover",
    confirmacoes.length === antes &&
      !!(await x.repos.unidade.obterProjeto(p.id)) &&
      texto(form()?.querySelector(".prj-erros")) === `O nome pode ter até ${LIMITES.nome} caracteres.`,
    texto(form()?.querySelector(".prj-erros")),
  );
  botao(form()!, "Cancelar")?.click();

  falha.ler = true;
  await editar(s.id, "Apuração", "eu");
  checar(
    "memoria do sigilo ilegivel no Quem ve: o dialogo explica e o projeto fica onde estava",
    texto(form()?.querySelector(".prj-erros")).includes("lista de processos sigilosos") &&
      !!(await x.repos.unidade.obterProjeto(s.id)) &&
      !(await x.repos.eu.obterProjeto(s.id)),
    texto(form()?.querySelector(".prj-erros")),
  );
  falha.ler = false;
  botao(form()!, "Cancelar")?.click();

  // A edição no destino falha DEPOIS de mover (a memória do sigilo não grava o processo sigiloso escolhido): a
  // mensagem diz que o projeto já mudou, e salvar de novo só edita (sem perguntar nem mover outra vez).
  falha.gravar = true;
  const antesDaNova = confirmacoes.length;
  app.focarProjeto(p.id);
  await tique();
  botao(raiz, "Editar projeto")?.click();
  await tique(10);
  digitar(form()?.querySelector("input[name='nome']"), "Pregão com processo");
  escolherCombo(form()!, "Processo SEI", DA_CAIXA);
  marcar(form()?.querySelector("input[value='eu']"));
  botao(form()!, "Salvar")?.click();
  await tique(80);
  const erroPosMover = texto(form()?.querySelector(".prj-erros"));
  checar(
    "a edicao que falha depois de mover: diz que o projeto ja esta no destino e o que fazer",
    erroPosMover.startsWith("O projeto já está em “Só eu”, mas o nome e o processo novos não foram salvos: ") &&
      erroPosMover.endsWith(" Salve de novo.") &&
      (await x.repos.eu.obterProjeto(p.id))?.nome === "Pregão de volta" &&
      !(await x.repos.unidade.obterProjeto(p.id)),
    { erroPosMover, eu: (await x.repos.eu.obterProjeto(p.id))?.nome, un: !!(await x.repos.unidade.obterProjeto(p.id)) },
  );
  falha.gravar = false;
  botao(form()!, "Salvar")?.click();
  await tique(80);
  const salvoNoDestino = await x.repos.eu.obterProjeto(p.id);
  checar(
    "salvar de novo: so edita no destino (sem nova confirmacao nem novo mover) e o dialogo fecha",
    confirmacoes.length === antesDaNova + 1 &&
      salvoNoDestino?.nome === "Pregão com processo" &&
      salvoNoDestino.processo?.protocolo === DA_CAIXA &&
      !form(),
    { confirmacoes: confirmacoes.length - antesDaNova, nome: salvoNoDestino?.nome, processo: salvoNoDestino?.processo, form: !!form() },
  );
  app.destruir();
  x.c.destruir();

  secao("colaboracao: sem projeto ativo o menu do app nao oferece o Enviar");
  const vazio = montar();
  const appVazio = montarApp(vazio, vazio.area, []);
  await vazio.c.iniciar();
  await appVazio.iniciar();
  const itensVazio = itensDoMenu(vazio.doc.getElementById("app")!, "Ajustes dos projetos");
  checar(
    "sem projeto: Receber fica, Enviar some",
    itensVazio.includes("Receber projeto de arquivo…") && !itensVazio.includes("Enviar projeto por arquivo…"),
    itensVazio,
  );
  await vazio.repos.eu.criarProjeto({ nome: "Primeiro" });
  await tique(80);
  checar(
    "com projeto: o Enviar volta",
    itensDoMenu(vazio.doc.getElementById("app")!, "Ajustes dos projetos").includes("Enviar projeto por arquivo…"),
  );
  appVazio.destruir();
  vazio.c.destruir();
}
