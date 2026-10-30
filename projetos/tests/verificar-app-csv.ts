import { areaMemoria } from "@comum/armazenamento/area";
import type { ProjetoNaTela } from "../src/app/dados";
import { hashDaImpressao, lerImpressao, montarImpressao } from "../src/app/impressao";
import { csvDosProjetos, nomeDoCsv } from "../src/arquivo/csv";
import { idLinhaFase } from "../src/gantt/linhas";
import { resumoDoProjeto } from "../src/modelo/resumo";
import { area as areaDoGantt, esperarQuadro, instalarAmbienteGantt } from "./ambienteGantt";
import { telaDoApp, texto } from "./apoioApp";
import { ESCOPO_EU, ESCOPO_UN, novoRepo } from "./apoioRepositorio";
import { HOSTIL } from "./cenarioGantt";
import { etapa, fase, HOJE, projeto } from "./fabrica";
import { ganttFalso } from "./ganttFalso";
import { checar, secao, tique } from "./util";

export async function verificarAppCsv(): Promise<void> {
  secao("app: exportar planilha (CSV)");
  const etapas = [
    etapa({
      id: "e1",
      nome: "=SOMA(A1)",
      fase: "f1",
      inicio: "2026-09-01",
      fim: "2026-10-02",
      responsavel: { nome: "Carla Dias" },
      processo: { protocolo: "50300.009999/2026-01", sigiloso: true },
      etiquetas: ["AIR", "TI"],
      observacoes: 'Diz "sim"; depois',
    }),
    etapa({
      id: "m1",
      nome: HOSTIL,
      marco: true,
      inicio: "2026-12-03",
      fim: "2026-12-03",
      concluidaEm: "2026-12-03",
      documento: { numero: "1240001" },
    }),
  ];
  const p: ProjetoNaTela = {
    projeto: projeto({ id: "p1", nome: "Revisão", processo: { protocolo: "50300.001234/2026-11" } }),
    vis: "unidade",
    fases: [fase({ id: "f1", nome: "Instrução" })],
    etapas,
    resumo: resumoDoProjeto(etapas, HOJE),
  };
  const sig: ProjetoNaTela = {
    ...p,
    projeto: projeto({ id: "p2", nome: "Sigiloso", processo: { protocolo: "50300.000777/2026-77", sigiloso: true } }),
    vis: "eu",
    etapas: [etapa({ id: "x", projeto: "p2" })],
  };
  const csv = csvDosProjetos([p, sig], HOJE);
  const BOM = String.fromCharCode(0xfeff);
  const linhas = csv.slice(1).split("\r\n");
  checar(
    "cabecalho das colunas",
    linhas[0] ===
      "Projeto;Quem vê;Processo;Fase;Etapa;Marco;Responsável;Início;Término;Dias úteis;Situação;Progresso (%);Concluída em;Documento SEI;Etiquetas;Observações",
  );
  checar("BOM para o Excel", csv.startsWith(BOM));
  const l1 = linhas[1] ?? "";
  checar("formula neutralizada", l1.includes(";'=SOMA(A1);"));
  checar(
    "processo sigiloso da etapa sai em branco (nem o do projeto entra no lugar)",
    !l1.includes("50300.009999") && l1.startsWith("Revisão;Toda a unidade;;Instrução;"),
    l1,
  );
  checar("aspas e ponto e virgula protegidos", l1.endsWith(';AIR, TI;"Diz ""sim""; depois"'), l1);
  checar("datas, dias uteis, situacao e progresso", l1.includes(";01/09/2026;02/10/2026;23;Atrasada;0;;;"), l1);
  const l2 = linhas[2] ?? "";
  checar(
    "marco: 'sim', sem termino; texto hostil como texto",
    l2.includes(`;"${HOSTIL.replace(/"/g, '""')}";sim;`) && l2.includes(";03/12/2026;;0;Marco cumprido;100;03/12/2026;1240001;"),
    l2,
  );
  checar("processo sigiloso do projeto em branco", (linhas[3] ?? "").startsWith("Sigiloso;Só eu;;"));
  const comMarcador =
    csvDosProjetos([{ ...p, etapas: [etapa({ id: "mk", concluidaEm: "2026-10-01", documento: { numero: "", sigiloso: true } })] }], HOJE)
      .slice(1)
      .split("\r\n")[1] ?? "";
  checar(
    "o marcador (documento de processo sigiloso sem o numero) sai em branco na coluna do documento",
    comMarcador.endsWith(";01/10/2026;;;"),
    comMarcador,
  );
  const docsSig = csvDosProjetos(
    [
      {
        ...p,
        etapas: [
          etapa({ id: "s1", processo: { protocolo: "50300.009999/2026-01", sigiloso: true }, documento: { numero: "1240011" } }),
          etapa({ id: "s2", documento: { numero: "1240012", sigiloso: true } }),
          etapa({ id: "s3", documento: { numero: "1240013" } }),
        ],
      },
      { ...sig, etapas: [etapa({ id: "s4", projeto: "p2", documento: { numero: "1240014" } })] },
    ],
    HOJE,
  );
  checar(
    "o documento de etapa sigilosa (processo proprio ou herdado do projeto) ou marcado sigiloso sai em branco; o comum fica",
    !docsSig.includes("1240011") && !docsSig.includes("1240012") && docsSig.includes("1240013") && !docsSig.includes("1240014"),
    docsSig,
  );
  const sigSemEtapas = csvDosProjetos([{ ...sig, etapas: [] }], HOJE)
    .slice(1)
    .split("\r\n");
  checar(
    "projeto sigiloso sem etapas: uma linha, com o processo em branco",
    sigSemEtapas.length === 2 && sigSemEtapas[1] === `Sigiloso;Só eu;${";".repeat(13)}` && !sigSemEtapas.join().includes("50300.000777"),
    sigSemEtapas,
  );
  checar(
    "nome do arquivo sem acento nem espaco",
    nomeDoCsv("Revisão da Resolução nº 5.432", HOJE) === "projeto-revisao-da-resolucao-n-5-432-2026-10-06.csv" &&
      nomeDoCsv(null, HOJE) === "projetos-2026-10-06.csv",
  );

  secao("app: imprimir / salvar PDF");
  const par = { host: "sei.x.gov.br", login: "ana", unidade: "110", projeto: "todos", escala: "Mês" as const };
  const hash = hashDaImpressao(par);
  checar("parametros no endereco e de volta", JSON.stringify(lerImpressao(hash)) === JSON.stringify(par));
  checar(
    "o endereco nao leva mais a lista; o 'lista=1' das versoes anteriores e ignorado",
    !hash.includes("lista") && JSON.stringify(lerImpressao(`${hash}&lista=1`)) === JSON.stringify(par),
  );
  checar("endereco estranho nao imprime", lerImpressao("#modo=impressao&host=x") === null && lerImpressao("#modo=embutido") === null);
  // O hash vira a chave do armazenamento (projetos/<host>|<login>|u:<unidade>/...): nada que mude o escopo passa.
  const comHash = (troca: Record<string, string>) =>
    lerImpressao(`#${new URLSearchParams({ ...par, lista: "1", modo: "impressao", ...troca }).toString()}`);
  const NUL = String.fromCharCode(0);
  const LF = String.fromCharCode(10);
  const DEL = String.fromCharCode(0x7f);
  const maliciosos = {
    "host com |": comHash({ host: "sei.x.gov.br|ana|u:110/un/p" }),
    "host com /": comHash({ host: "sei.x.gov.br/../outro" }),
    "login com |": comHash({ login: "ana|u:999" }),
    "login com /": comHash({ login: "ana/un" }),
    "login com NUL": comHash({ login: `ana${NUL}` }),
    "host com quebra de linha": comHash({ host: `sei.x.gov.br${LF}` }),
    "login com DEL": comHash({ login: `ana${DEL}` }),
    "unidade com letra": comHash({ unidade: "110a" }),
    "unidade com | (outro escopo)": comHash({ unidade: "110|u:2" }),
    "unidade negativa": comHash({ unidade: "-110" }),
    "host com 201 caracteres": comHash({ host: "a".repeat(201) }),
    "login com 201 caracteres": comHash({ login: "a".repeat(201) }),
    "unidade com 201 digitos": comHash({ unidade: "1".repeat(201) }),
    "projeto com 201 caracteres": comHash({ projeto: "p".repeat(201) }),
    "projeto com controle": comHash({ projeto: `p1${LF}` }),
    "| codificado (%7C)": lerImpressao("#modo=impressao&host=sei.x.gov.br%7Cana&login=ana&unidade=110&projeto=todos&escala=Dia"),
  };
  const passaram = Object.entries(maliciosos)
    .filter(([, v]) => v !== null)
    .map(([k]) => k);
  checar("hash malicioso nao imprime (|, /, controle, mais de 200, unidade nao numerica)", passaram.length === 0, passaram);
  checar(
    "no limite (200 caracteres; login com ponto, arroba e hifen; host com porta) imprime",
    comHash({ host: "a".repeat(200) }) !== null &&
      comHash({ login: "a".repeat(200) }) !== null &&
      comHash({ unidade: "1".repeat(200) }) !== null &&
      comHash({ login: "ana.lima-2@orgao", host: "sei.x.gov.br:8443" })?.login === "ana.lima-2@orgao",
  );
  const area = areaMemoria();
  const { repo: un } = novoRepo(ESCOPO_UN, area, "u");
  const { repo: eu } = novoRepo(ESCOPO_EU, area, "e");
  const pr = await un.criarProjeto({ nome: HOSTIL });
  await un.criarEtapa({ projeto: pr.id, nome: "Etapa A", inicio: "2026-10-05", fim: "2026-10-09" });
  await eu.criarProjeto({ nome: "Meu" });
  const doc = telaDoApp();
  const g = ganttFalso();
  let impresso = 0;
  await montarImpressao(
    doc.getElementById("app")!,
    { ...par, host: "sei.x.gov.br", login: "ana" },
    { repos: { unidade: un, eu }, hoje: HOJE, montarGantt: g.montar, imprimir: () => (impresso += 1) },
  );
  await tique(20);
  const app = doc.getElementById("app")!;
  checar(
    "Todos: titulo, Gantt so leitura e tabela",
    texto(app.querySelector("h1")) === "Projetos" &&
      g.opcoes()?.somenteLeitura === true &&
      app.querySelectorAll("tr.prj-tab-linha").length === 2,
  );
  checar("abre a impressao do navegador", impresso === 1);
  const doc2 = telaDoApp();
  await montarImpressao(
    doc2.getElementById("app")!,
    { ...par, projeto: pr.id, escala: "Semana" },
    { repos: { unidade: un, eu }, hoje: HOJE, montarGantt: ganttFalso().montar, imprimir: () => undefined },
  );
  const app2 = doc2.getElementById("app")!;
  checar(
    "projeto: nome hostil como texto e etapas na tabela",
    texto(app2.querySelector("h1")) === HOSTIL && !app2.querySelector("img") && texto(app2).includes("Etapa A"),
  );
  const doc3 = telaDoApp();
  await montarImpressao(
    doc3.getElementById("app")!,
    { ...par, projeto: "sumiu" },
    { repos: { unidade: un, eu }, hoje: HOJE, imprimir: () => undefined },
  );
  checar("projeto que nao existe: aviso", texto(doc3.getElementById("app")) === "Projeto não encontrado nesta unidade.");
  const sg = await un.criarProjeto({ nome: "Reservado", processo: { protocolo: "50300.000555/2026-55", sigiloso: true } });
  const doc4 = telaDoApp();
  await montarImpressao(
    doc4.getElementById("app")!,
    { ...par, projeto: sg.id },
    { repos: { unidade: un, eu }, hoje: HOJE, montarGantt: ganttFalso().montar, imprimir: () => undefined },
  );
  checar("impressao: processo sigiloso do projeto nao aparece", !texto(doc4.getElementById("app")).includes("50300.000555"));
  await un.criarEtapa({
    projeto: sg.id,
    nome: "Etapa reservada",
    inicio: "2026-10-05",
    fim: "2026-10-09",
    processo: { protocolo: "50300.000556/2026-56", sigiloso: true },
  });
  const doc5 = telaDoApp();
  const g5 = ganttFalso();
  await montarImpressao(
    doc5.getElementById("app")!,
    { ...par, projeto: "todos" },
    { repos: { unidade: un, eu }, hoje: HOJE, montarGantt: g5.montar, imprimir: () => undefined },
  );
  const todos5 = texto(doc5.getElementById("app"));
  checar(
    "impressao do Todos: o projeto sigiloso aparece, sem o numero (nem o da etapa)",
    todos5.includes("Reservado") && !todos5.includes("50300.000555") && !todos5.includes("50300.000556"),
    todos5,
  );

  // A impressão não tem a lista à esquerda: o nome da fase fica no Gantt, mesmo com "lista=1" no endereço
  // (o parâmetro das versões anteriores; com a lista, a decoração esconde o rótulo da fase).
  const comFase = await un.criarProjeto({ nome: "Com fase" });
  const fi = await un.criarFase(comFase.id, "Instrucao");
  await un.criarEtapa({ projeto: comFase.id, fase: fi.id, nome: "Nota tecnica", inicio: "2026-10-05", fim: "2026-10-09" });
  const docG = instalarAmbienteGantt();
  const pG = lerImpressao(
    `#modo=impressao&host=sei.x.gov.br&login=ana&unidade=110&projeto=${encodeURIComponent(comFase.id)}&escala=Semana&lista=1`,
  );
  if (pG) await montarImpressao(areaDoGantt(docG), pG, { repos: { unidade: un, eu }, hoje: HOJE, imprimir: () => undefined });
  await esperarQuadro();
  const rotuloFase = docG.querySelector(`.bar-wrapper[data-id="${idLinhaFase(fi.id)}"] .bar-label`);
  checar(
    "impressao com lista=1 no endereco: a barra da fase mostra o nome (nao ha lista ao lado)",
    !!pG && rotuloFase?.textContent === "Instrucao" && rotuloFase.getAttribute("display") !== "none",
    rotuloFase ? { texto: rotuloFase.textContent, display: rotuloFase.getAttribute("display") } : "sem rotulo da fase",
  );
}
