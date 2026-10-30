/**
 * A leva da revisão final da P4 ("sincronia e colaboração"), parte do app: CSV e impressão pela regra do sigilo e
 * pela memória do sigilo (5), o número de documento colado (7), a descrição dos botões repetidos (12) e o papel da
 * faixa "aguardando" (13). O "Sincronizar o arquivo" (6) e o carimbo que não vira data no diálogo da etapa (12)
 * ficam nas provas desses diálogos.
 */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import type { AbrirModal } from "@comum/ui/dialogo";
import type { ModeloNaTela, ProjetoNaTela } from "../src/app/dados";
import { abrirArquivados } from "../src/app/dialogos/apoio";
import { campoDocumento } from "../src/app/dialogos/campos";
import { faixaAguardando } from "../src/app/dialogos/consentimento";
import { abrirModelos } from "../src/app/dialogos/modelos";
import { montarImpressao } from "../src/app/impressao";
import { csvDosProjetos } from "../src/arquivo/csv";
import { prefixoMemoriaSigilo } from "../src/modelo/constantes";
import { ErroMemoriaSigilo } from "../src/modelo/memoriaSigilo";
import { resumoDoProjeto } from "../src/modelo/resumo";
import { etapaSigilosa, sigiloDoEnvelope } from "../src/modelo/sigilo";
import type { Escopo, Vis } from "../src/modelo/tipos";
import { RepositorioProjetos } from "../src/repositorio";
import { digitar, itemDoMenu, telaDoApp, texto } from "./apoioApp";
import { etapa, projeto } from "./fabrica";
import { ganttFalso } from "./ganttFalso";
import { checar, secao, tique } from "./util";
import { abrirAba, montar as montarApp, textoDoAviso } from "./verificar-app";

const AGORA = Date.UTC(2026, 9, 6, 12);
const HOST = "sei.x.gov.br";
const HOJE = "2026-10-06";
const X = "50300.000777/2026-10";
const CHAVE_X = "50300000777202610";
const OUTRO = "50300.000002/2026-11";

const escopo = (vis: Vis, login = "ana"): Escopo => ({ host: HOST, login, unidade: "110", vis });

function modais(doc: Document) {
  const abertos: Array<{ conteudo: HTMLElement }> = [];
  const abrirModal: AbrirModal = (o) => {
    doc.body.append(o.conteudo);
    abertos.push({ conteudo: o.conteudo });
    return { fechar: () => o.conteudo.remove() };
  };
  return { abertos, abrirModal };
}

async function item5(): Promise<void> {
  secao("revisao final 5: CSV e impressao pela regra do sigilo e pela memoria");
  const conhecidos = { processos: new Set([CHAVE_X]), documentos: new Set(["7777001"]) };
  const comX = projeto({ id: "pa", processo: { protocolo: X } });
  const s = sigiloDoEnvelope([comX], [], conhecidos);
  checar(
    "etapaSigilosa: sem processo proprio herda o do projeto; o proprio decide; pela memoria tambem",
    etapaSigilosa(etapa({ id: "e1", projeto: "pa" }), comX, s) &&
      !etapaSigilosa(etapa({ id: "e2", projeto: "pa", processo: { protocolo: OUTRO } }), comX, s) &&
      etapaSigilosa(etapa({ id: "e3", projeto: "pb", processo: { protocolo: X } }), projeto({ id: "pb" }), s) &&
      !etapaSigilosa(etapa({ id: "e4", projeto: "pb" }), projeto({ id: "pb" }), s),
  );
  const etapas = [
    etapa({ id: "e1", projeto: "pa", documento: { numero: "1234567" } }),
    etapa({ id: "e2", projeto: "pa", processo: { protocolo: OUTRO }, documento: { numero: "7654321" } }),
    etapa({ id: "e3", projeto: "pa", processo: { protocolo: OUTRO }, documento: { numero: "7777001" } }),
  ];
  const so: ProjetoNaTela = {
    projeto: { ...comX, nome: "Só meu" },
    vis: "eu",
    fases: [],
    etapas,
    resumo: resumoDoProjeto(etapas, HOJE),
  };
  const csv = csvDosProjetos([so], HOJE, conhecidos);
  checar(
    "CSV: 'So eu' com X sem marca e X na memoria: o processo e o documento da etapa que herda em branco; o documento conhecido tambem",
    !csv.includes("000777") && !csv.includes("1234567") && !csv.includes("7777001") && csv.includes("7654321") && csv.includes(OUTRO),
    csv,
  );
  const semMemoria = csvDosProjetos([so], HOJE);
  checar("premissa: sem a memoria, X sairia", semMemoria.includes(X));

  // Impressão: o número que a memória conhece não sai; a memória ilegível não imprime nada.
  const falha = { ler: false };
  const base = areaMemoria();
  const area: Area = {
    ...base,
    obter: async (ch) => {
      const ks = ch === null || ch === undefined ? ["projetos/sigilo/"] : typeof ch === "string" ? [ch] : ch;
      if (falha.ler && ks.some((k) => k.startsWith("projetos/sigilo/"))) throw new Error("falha simulada ao ler o storage");
      return base.obter(ch);
    },
    chaves: async () => (await base.chaves?.()) ?? [],
    aoMudar: base.aoMudar.bind(base),
  };
  const rel = { agora: AGORA };
  const carimbo = () => ({ agora: ++rel.agora, dispositivo: "pc-ana", por: "ana", nome: "Ana" });
  const un = new RepositorioProjetos(area, escopo("unidade"), carimbo);
  const eu = new RepositorioProjetos(area, escopo("eu"), carimbo);
  const q = await eu.criarProjeto({ nome: "Só meu", processo: { protocolo: X } });
  await area.gravar({ [`${prefixoMemoriaSigilo(HOST, "ana")}p/${CHAVE_X}`]: "aprendida" });
  const par = { host: HOST, login: "ana", unidade: "110", projeto: q.id, escala: "Semana" as const };
  const doc = telaDoApp();
  let impressos = 0;
  await montarImpressao(doc.getElementById("app")!, par, {
    repos: { unidade: un, eu },
    hoje: HOJE,
    montarGantt: ganttFalso().montar,
    imprimir: () => void impressos++,
  });
  await tique(20);
  const app = doc.getElementById("app")!;
  checar("impressao: o numero que a memoria conhece nao sai", !texto(app).includes("000777") && impressos === 1, texto(app));
  falha.ler = true;
  const doc2 = telaDoApp();
  await montarImpressao(doc2.getElementById("app")!, par, {
    repos: { unidade: un, eu },
    hoje: HOJE,
    montarGantt: ganttFalso().montar,
    imprimir: () => void impressos++,
  });
  await tique(20);
  const app2 = doc2.getElementById("app")!;
  checar(
    "impressao com a memoria ilegivel: aviso e nada impresso",
    impressos === 1 && /processos sigilosos/.test(texto(app2)) && !texto(app2).includes("000777"),
    texto(app2),
  );

  // O app: a planilha consulta a memória; ilegível, avisa e não baixa nada.
  const m = await montarApp();
  await m.eu.editarProjeto(m.ids.q, { processo: { protocolo: X } });
  await tique(20);
  abrirAba(m, m.ids.q);
  await tique(20);
  itemDoMenu(m.raiz, "Ajustes dos projetos", "Exportar planilha (CSV)");
  await tique(20);
  checar("premissa: sem a memoria, a planilha do projeto 'So eu' leva X", (m.t.baixados.at(-1)?.conteudo ?? "").includes(X));
  await m.area.gravar({ [`${prefixoMemoriaSigilo(HOST, "ana")}p/${CHAVE_X}`]: "aprendida" });
  itemDoMenu(m.raiz, "Ajustes dos projetos", "Exportar planilha (CSV)");
  await tique(20);
  const baixado = m.t.baixados.at(-1)?.conteudo ?? "";
  checar("app: a planilha nao leva o numero que a memoria conhece", m.t.baixados.length === 2 && !baixado.includes("000777"), baixado);
  const conhecer = m.un.sigilosConhecidos.bind(m.un);
  m.un.sigilosConhecidos = async () => {
    throw new ErroMemoriaSigilo();
  };
  m.eu.sigilosConhecidos = m.un.sigilosConhecidos;
  itemDoMenu(m.raiz, "Ajustes dos projetos", "Exportar planilha (CSV)");
  await tique(20);
  checar(
    "app: a memoria ilegivel avisa e nao baixa nada",
    m.t.baixados.length === 2 && /processos sigilosos/.test(textoDoAviso(m.doc)),
    textoDoAviso(m.doc),
  );
  m.un.sigilosConhecidos = conhecer;
  m.app.destruir();
}

async function item7(): Promise<void> {
  secao("revisao final 7: o numero de documento colado");
  telaDoApp();
  const casos: Array<[string, string | null]> = [
    ["Despacho 12 (1234567)", "1234567"],
    ["(1234567)", "1234567"],
    ["1234567,", "1234567"],
    ["(SEI nº 1234567)", "1234567"],
    ["SEI nº 1234567.", "1234567"],
    ["[1234567];", "1234567"],
    ["Ofício 12/2026 (1234567)", "1234567"],
    ["12 e 1234567", null],
    ["(12) (1234567)", null],
    ["1.234.567", null],
    ["12a", null],
    ["1234567", "1234567"],
    ["0012345", "0012345"],
    ["", ""],
  ];
  const errados: Array<[string, string | null, string | null]> = [];
  for (const [t, esperado] of casos) {
    const c = campoDocumento("", undefined);
    digitar(c.el.querySelector("input"), t);
    const obtido = c.invalido() ? null : c.numero();
    if (obtido !== esperado) errados.push([t, esperado, obtido]);
  }
  checar("apara a pontuacao das pontas, prefere o pedaco entre parenteses e recusa o ambiguo", errados.length === 0, errados);
}

async function item12e13(): Promise<void> {
  secao("revisao final 12: os botoes repetidos dizem de qual linha sao");
  const doc = telaDoApp();
  const md = modais(doc);
  const modelo = (id: string, nome: string): ModeloNaTela => ({
    id,
    nome,
    fases: [],
    etapas: [],
    criadoEm: 1,
    atualizadoEm: 1,
    dispositivo: "d",
    vis: "unidade",
  });
  abrirModelos({
    abrirModal: md.abrirModal,
    modelos: [modelo("m1", "Pregão"), modelo("m2", "Contrato")],
    confirmar: async () => true,
    renomear: async () => undefined,
    excluir: async () => undefined,
    criarProjeto: () => undefined,
  });
  const descrito = (raiz: ParentNode, linha: string, nome: string) =>
    [...raiz.querySelectorAll<HTMLElement>(linha)].every((l) => {
      const botoes = [...l.querySelectorAll("button")];
      return (
        botoes.length > 0 &&
        botoes.every((b) => {
          const alvo = b.getAttribute("aria-describedby");
          const el = alvo ? doc.getElementById(alvo) : null;
          return !!el && l.contains(el) && texto(el) === texto(l.querySelector(nome));
        })
      );
    });
  const dlg = md.abertos.at(-1)!.conteudo;
  checar(
    "Modelos: cada botao (Criar projeto, Renomear, Excluir) aponta para o nome da propria linha",
    descrito(dlg, ".prj-modelo", ".prj-modelo-nome"),
  );
  const docA = telaDoApp();
  const ma = modais(docA);
  const arq = (id: string, nome: string): ProjetoNaTela => ({
    projeto: projeto({ id, nome, arquivadoEm: AGORA }),
    vis: "unidade",
    fases: [],
    etapas: [],
    resumo: resumoDoProjeto([], HOJE),
  });
  abrirArquivados({
    abrirModal: ma.abrirModal,
    arquivados: [arq("a1", "Obra"), arq("a2", "Pregão")],
    reativar: async () => undefined,
    excluir: async () => undefined,
  });
  checar(
    "Arquivados: Reativar e Excluir apontam para o nome da propria linha",
    [...docA.querySelectorAll(".prj-arquivado")].every((l) =>
      [...l.querySelectorAll("button")].every((b) => {
        const el = docA.getElementById(b.getAttribute("aria-describedby") ?? "");
        return !!el && l.contains(el) && texto(el) === texto(l.querySelector(".prj-arquivado-nome b"));
      }),
    ) && docA.querySelectorAll(".prj-arquivado button").length === 4,
  );

  secao("revisao final 13: a faixa 'aguardando' e anunciada pelo leitor de tela");
  const ag = faixaAguardando({ sigla: "SEPRO", aoEntendi: () => undefined });
  checar("faixa aguardando com role=status", ag.getAttribute("role") === "status");
}

export async function verificarRevisaoFinalApp(): Promise<void> {
  await item5();
  await item7();
  await item12e13();
}
