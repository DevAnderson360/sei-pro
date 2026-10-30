/**
 * Cola da pagina de opcoes (html/options.html): produto, render, abas, busca,
 * restaurar e os botoes. A logica fica nos modulos; aqui so se liga.
 */
import {
  type ApiSync,
  armazemSync,
  baixarTexto,
  interpretar,
  medirEspaco,
  mensagemEstouro,
  normalizarArquivo,
  serializar,
} from "./armazenamento";
import { filtrar } from "./busca";
import {
  aplicarConfigGeral,
  atualizarContagens,
  atualizarCores,
  atualizarDependencias,
  coletarConfigGeral,
  definirEscolhasDinamicas,
} from "./config";
import { avisar } from "./dialogo";
import { type ApiLocal, AVISO_SEM_HIPOTESES, lerHipoteses } from "./listas";
import { adicionarPerfil, coletarPerfis, ligarLista, restaurarPerfis } from "./perfis";
import { contextoDoManifesto, montarComplementos, montarGeral } from "./render";

declare const browser: typeof chrome | undefined;

const api: typeof chrome = typeof browser !== "undefined" ? browser : chrome;
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

function ligarAbas(): void {
  const abas = [...document.querySelectorAll<HTMLElement>('[role="tab"]')];
  const ativar = (alvo: HTMLElement): void => {
    for (const a of abas) {
      const ligado = a === alvo;
      a.setAttribute("aria-selected", String(ligado));
      a.tabIndex = ligado ? 0 : -1;
      const painel = document.getElementById(a.getAttribute("aria-controls") ?? "");
      if (painel) painel.hidden = !ligado;
    }
  };
  for (const a of abas) a.addEventListener("click", () => ativar(a));
  $('[role="tablist"]').addEventListener("keydown", (ev) => {
    const i = abas.findIndex((a) => a.getAttribute("aria-selected") === "true");
    const k = (ev as KeyboardEvent).key;
    const prox = k === "ArrowRight" ? abas[(i + 1) % abas.length] : k === "ArrowLeft" ? abas[(i - 1 + abas.length) % abas.length] : null;
    if (prox) {
      ativar(prox);
      prox.focus();
    }
  });
}

/** Secoes abertas/fechadas: so por sessao da aba (nada novo no sync). */
function lembrarSecoes(raiz: ParentNode): void {
  const chave = "seipro-opcoes-secoes";
  try {
    const salvo = JSON.parse(sessionStorage.getItem(chave) ?? "null") as Record<string, boolean> | null;
    for (const s of raiz.querySelectorAll<HTMLElement>("details.secao")) {
      const id = s.getAttribute("data-secao") ?? "";
      if (salvo && id in salvo) {
        if (salvo[id]) s.setAttribute("open", "");
        else s.removeAttribute("open");
      }
      s.addEventListener("toggle", () => {
        if (s.hasAttribute("data-aberta-antes")) return; // a busca mexe em "open"; isso nao e escolha do usuario
        try {
          const atual = JSON.parse(sessionStorage.getItem(chave) ?? "{}") as Record<string, boolean>;
          atual[id] = s.hasAttribute("open");
          sessionStorage.setItem(chave, JSON.stringify(atual));
        } catch {}
      });
    }
  } catch {}
}

async function iniciar(): Promise<void> {
  const manifesto = api.runtime.getManifest();
  const ctx = contextoDoManifesto(manifesto);
  $(".name-space").textContent = manifesto.short_name ?? "";
  document.title = `Configurações | ${manifesto.short_name ?? ""}`;
  const icone = manifesto.icons?.["32"];
  if (icone) $<HTMLImageElement>(".icon-space").src = `../${icone}`;

  const geral = montarGeral(ctx);
  const complementos = montarComplementos(ctx);
  $("#geral-conteudo").append(geral);
  $("#complementos-conteudo").append(complementos);
  const painel = document.body;
  lembrarSecoes(geral);
  ligarAbas();

  const lista = $("#perfis");
  ligarLista(lista);
  $("#new").addEventListener("click", () => adicionarPerfil(lista));

  const atualizar = (): void => {
    atualizarDependencias(painel);
    atualizarCores(painel);
    atualizarContagens(painel);
  };
  for (const alvo of [geral, complementos]) {
    alvo.addEventListener("change", atualizar);
    alvo.addEventListener("input", atualizar);
  }

  const busca = $<HTMLInputElement>("#busca");
  busca.addEventListener("input", () => {
    const n = filtrar(geral, busca.value);
    $("#sem-resultado").hidden = busca.value.trim() === "" || n > 0;
  });
  busca.addEventListener("keydown", (ev) => {
    if ((ev as KeyboardEvent).key !== "Escape" || busca.value === "") return;
    busca.value = "";
    busca.dispatchEvent(new Event("input"));
  });

  const armazem = armazemSync(api as unknown as ApiSync);
  const dados = interpretar(await armazem.obter());
  // Hipoteses legais lidas do SEI quando o usuario abriu um processo; antes de aplicar o gravado, para ele achar a opcao na lista.
  definirEscolhasDinamicas(painel, "newdocsigilo", await lerHipoteses(api as unknown as ApiLocal), AVISO_SEM_HIPOTESES);
  // Dado gravado fora do formato nao pode deixar a pagina sem botoes: sem Salvar/Carregar o usuario nao teria como se recuperar.
  try {
    restaurarPerfis(lista, dados.perfis);
    aplicarConfigGeral(painel, dados.config);
  } catch (e) {
    console.error("SEI Pro: nao foi possivel aplicar as configuracoes gravadas; a pagina abriu com os padroes.", e);
  }
  atualizar();

  /** Grava o que a tela mostra. Devolve o texto gravado, ou null se nao coube/falhou (o aviso ja foi dado). */
  async function gravar(): Promise<string | null> {
    const { perfis, descartados } = coletarPerfis(lista);
    const texto = serializar({ perfis, config: coletarConfigGeral(painel) });
    const espaco = medirEspaco(texto);
    if (espaco.estado === "estoura") {
      await avisar("erro", mensagemEstouro(espaco.tamanho));
      return null;
    }
    if (espaco.estado === "perto")
      console.warn(`SEI Pro: as configuracoes ocupam ${espaco.tamanho} de 8192 bytes do espaco de sincronizacao.`);
    try {
      await armazem.gravar(texto);
    } catch (e) {
      await avisar("erro", `Não foi possível salvar as configurações: ${(e as Error).message}`);
      return null;
    }
    if (descartados > 0) {
      await avisar(
        "atencao",
        `As opções foram salvas, mas ${descartados} base(s) de dados ficaram de fora porque há campo obrigatório em branco (marcado em vermelho).`,
      );
      return null;
    }
    return texto;
  }

  $(".save").addEventListener("click", async () => {
    if ((await gravar()) !== null) await avisar("ok", "Configurações salvas com sucesso!");
  });
  $("#export").addEventListener("click", async () => {
    const texto = await gravar();
    if (texto !== null) baixarTexto(texto);
  });
  $("#import").addEventListener("click", () => $<HTMLInputElement>("#selectFiles").click());
  $<HTMLInputElement>("#selectFiles").addEventListener("change", async (ev) => {
    const arquivo = (ev.target as HTMLInputElement).files?.[0];
    if (!arquivo) return;
    let texto: string;
    try {
      texto = normalizarArquivo(await arquivo.text());
    } catch {
      await avisar("erro", "O arquivo escolhido não é uma configuração do SEI Pro (JSON inválido).");
      return;
    }
    const espaco = medirEspaco(texto);
    if (espaco.estado === "estoura") {
      await avisar("erro", mensagemEstouro(espaco.tamanho));
      return;
    }
    try {
      await armazem.gravar(texto);
    } catch (e) {
      await avisar("erro", `Não foi possível salvar as configurações: ${(e as Error).message}`);
      return;
    }
    await avisar("ok", "Configurações carregadas com sucesso!");
    location.reload();
  });
  // Quarto caminho para as Ferramentas de PDF. Abre em ABA, nunca no popup: o popup e destruido ao perder o foco e levaria junto o processamento em curso.
  $("#abrirFerramentasPdf").addEventListener("click", () => window.open(api.runtime.getURL("html/ferramentas-pdf.html"), "_blank"));
}

void iniciar();
