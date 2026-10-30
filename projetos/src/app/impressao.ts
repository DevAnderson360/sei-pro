/**
 * "Imprimir / salvar PDF" (spec 3.1): a mesma página do app em
 * `#modo=impressao&...`, numa janela nova, só leitura: título, o Gantt (da aba
 * aberta, na escala dela) e a tabela; depois abre a impressão do navegador.
 * Os parâmetros vão no endereço (a página da extensão lê o armazenamento direto).
 * A impressão não tem a lista de etapas à esquerda (a tabela faz esse papel):
 * o Gantt sai sempre como "sem lista", com o nome das fases nas barras. O
 * parâmetro `lista` das primeiras versões do endereço é ignorado. O número do
 * processo segue a regra do sigilo e a memória deste computador (como o CSV):
 * sem conseguir ler a memória, nada é impresso.
 */

import { formatarData } from "@comum/datas/dias";
import { h } from "@comum/ui/dom";
import { type Escala, ehEscala } from "../gantt/escalas";
import { linhasDoPortfolio, linhasDoProjeto } from "../gantt/linhas";
import { montarGantt } from "../gantt/montar";
import { rotuloDaVis } from "../modelo/escopo";
import { type SigilosConhecidos, sigiloDoEnvelope } from "../modelo/sigilo";
import type { DataISO, Vis } from "../modelo/tipos";
import type { RepositorioProjetos } from "../repositorio";
import { montarTabelaEtapas } from "./componentes/tabelaEtapas";
import { montarTabelaProjetos } from "./componentes/vistaTodos";
import { carregarUnidade } from "./dados";
import { plural } from "./formato";

export interface ParametrosImpressao {
  host: string;
  login: string;
  unidade: string;
  /** "todos" ou o id do projeto. */
  projeto: string;
  escala: Escala;
}

export function hashDaImpressao(p: ParametrosImpressao): string {
  const q = new URLSearchParams({
    modo: "impressao",
    host: p.host,
    login: p.login,
    unidade: p.unidade,
    projeto: p.projeto,
    escala: p.escala,
  });
  return `#${q.toString()}`;
}

/** Teto de cada parâmetro do endereço de impressão. */
const TETO_PARAMETRO = 200;

/** Caractere de controle (C0, DEL e C1): nada disso vem de um contexto do SEI. */
function temControle(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) return true;
  }
  return false;
}

/** Texto não vazio, até o teto, sem controle. */
const textoValido = (s: string): boolean => s.length > 0 && s.length <= TETO_PARAMETRO && !temControle(s);
/**
 * Host e login entram na chave do armazenamento (`projetos/<host>|<login>|u:<unidade>/...`): com `|`
 * ou `/`, um endereço forjado leria o escopo de outra pessoa ou de outra unidade.
 */
const parteDaChave = (s: string): boolean => textoValido(s) && !/[|/]/.test(s);

/**
 * Lê e VALIDA o endereço (qualquer um pode abrir `html/projetos.html#...`): host e login sem `|`, `/`
 * nem controle; unidade só com dígitos; tudo com até 200 caracteres. Fora disso, null (não imprime).
 */
export function lerImpressao(hash: string): ParametrosImpressao | null {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const escala = q.get("escala");
  const host = q.get("host") ?? "";
  const login = q.get("login") ?? "";
  const unidade = q.get("unidade") ?? "";
  const projeto = q.get("projeto") ?? "";
  if (q.get("modo") !== "impressao" || !ehEscala(escala)) return null;
  if (!parteDaChave(host) || !parteDaChave(login) || !textoValido(projeto)) return null;
  if (unidade.length > TETO_PARAMETRO || !/^[0-9]+$/.test(unidade)) return null;
  return { host, login, unidade, projeto, escala };
}

export interface DepsImpressao {
  repos: Readonly<Record<Vis, RepositorioProjetos>>;
  hoje: DataISO;
  montarGantt?: typeof montarGantt;
  /** `window.print` (depois de desenhar). */
  imprimir(): void;
}

/** A memória do sigilo não pôde ser lida: o número de um processo sigiloso poderia sair no papel. */
export const MENSAGEM_IMPRESSAO_SEM_MEMORIA =
  "Não foi possível ler a lista de processos sigilosos deste computador; nada foi impresso. Feche esta janela e tente de novo.";

export async function montarImpressao(raiz: HTMLElement, p: ParametrosImpressao, d: DepsImpressao): Promise<void> {
  let conhecidos: SigilosConhecidos;
  try {
    conhecidos = await d.repos.unidade.sigilosConhecidos();
  } catch (e) {
    console.warn("[SEI Pro] projetos: impressão sem a memória do sigilo:", e instanceof Error ? e.message : String(e));
    raiz.replaceChildren(h("p", {}, MENSAGEM_IMPRESSAO_SEM_MEMORIA));
    return;
  }
  const dados = await carregarUnidade(d.repos, d.hoje);
  const todos = [...dados.ativos, ...dados.arquivados];
  const sigilo = sigiloDoEnvelope(
    todos.map((x) => x.projeto),
    todos.flatMap((x) => x.etapas),
    conhecidos,
  );
  const montar = d.montarGantt ?? montarGantt;
  const area = h("div", { class: "prj-gantt" });
  // Sem lista ao lado: com `mostrarLista`, a decoração esconderia o nome das fases (decorar.ts).
  const opcoes = { escala: p.escala, hoje: d.hoje, mostrarLista: false, moverDependentes: false, somenteLeitura: true };
  if (p.projeto === "todos") {
    raiz.replaceChildren(
      h("h1", {}, "Projetos"),
      h(
        "p",
        { class: "prj-impressao-meta" },
        `${plural(dados.ativos.length, "projeto ativo", "projetos ativos")} · impresso em ${formatarData(d.hoje)}`,
      ),
      area,
      montarTabelaProjetos(dados.ativos, { aoAbrir: () => undefined }),
    );
    montar(
      area,
      linhasDoPortfolio(
        dados.ativos.map((i) => ({ projeto: i.projeto, vis: i.vis, etapas: i.etapas })),
        d.hoje,
      ),
      opcoes,
    );
  } else {
    const item = [...dados.ativos, ...dados.arquivados].find((x) => x.projeto.id === p.projeto);
    if (!item) {
      raiz.replaceChildren(h("p", {}, "Projeto não encontrado nesta unidade."));
      return;
    }
    const linhas = linhasDoProjeto(
      { projeto: item.projeto.id, fases: item.fases, etapas: item.etapas },
      { hoje: d.hoje, ordem: "inicio", recolhidas: new Set() },
    );
    const r = item.resumo;
    raiz.replaceChildren(
      h("h1", {}, item.projeto.nome),
      h(
        "p",
        { class: "prj-impressao-meta" },
        [
          item.projeto.processo && !sigilo.vinculo(item.projeto.processo) ? item.projeto.processo.protocolo : null,
          rotuloDaVis(item.vis),
          `${r.feitas} de ${plural(r.total, "etapa concluída", "etapas concluídas")}`,
          r.fim ? `termina em ${formatarData(r.fim)}` : null,
          `impresso em ${formatarData(d.hoje)}`,
        ]
          .filter(Boolean)
          .join(" · "),
      ),
      area,
      montarTabelaEtapas(linhas, { hoje: d.hoje, aoClicar: () => undefined }),
    );
    montar(area, linhas, opcoes);
  }
  // As barras e os rótulos da Frappe se ajustam no quadro seguinte.
  setTimeout(() => d.imprimir(), 10);
}
