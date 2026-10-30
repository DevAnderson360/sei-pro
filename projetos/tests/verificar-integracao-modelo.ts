/**
 * O que a caixa, a árvore e o lateral pedem ao núcleo do projetos (P5): o índice
 * protocolo → vínculos não põe etapa de processo sigiloso no processo do
 * projeto, concluir pelos balões nunca conclui de novo, e o sigilo que a tela do
 * SEI mostra marca os vínculos sem deixar o número no histórico.
 */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { comConsentimento, MENSAGEM_SEM_ENTENDI } from "../src/app/colaboracao/consentir";
import { prefixoMemoriaSigilo } from "../src/modelo/constantes";
import { ErroMemoriaSigilo } from "../src/modelo/memoriaSigilo";
import { VINCULO_VAZIO } from "../src/modelo/sigilo";
import { ErroValidacao } from "../src/modelo/validacao";
import { chaveProtocolo, indiceDeProcessos } from "../src/modelo/vinculos";
import type { RepositorioProjetos } from "../src/repositorio";
import { paraOTexto } from "../src/sincronia/textoPadrao";
import { ESCOPO_EU, ESCOPO_UN, novoRepo } from "./apoioRepositorio";
import { etapa, HOJE, projeto } from "./fabrica";
import { checar, lanca, secao } from "./util";

const MEMORIA = prefixoMemoriaSigilo(ESCOPO_UN.host, ESCOPO_UN.login);

/** O texto que iria ao Texto Padrão agora (com a memória do sigilo), como JSON. */
async function textoDe(repo: RepositorioProjetos, agora: number): Promise<string> {
  const { envelope, conhecidos } = await repo.exportarComConhecidos(agora);
  return JSON.stringify(paraOTexto(envelope, agora, conhecidos));
}

/** Área que falha ao ler a memória do sigilo enquanto `falha.ler` (o storage com erro). */
function areaQueFalhaNaMemoria(base: Area, falha: { ler: boolean }): Area {
  const daMemoria = (ks: string[]) => ks.some((k) => k.startsWith("projetos/sigilo/"));
  return {
    ...base,
    obter: async (ch) => {
      const ks = ch === null || ch === undefined ? ["projetos/sigilo/"] : typeof ch === "string" ? [ch] : ch;
      if (falha.ler && daMemoria(ks)) throw new Error("falha simulada ao ler o storage");
      return base.obter(ch);
    },
    aoMudar: base.aoMudar.bind(base),
  };
}

async function verificarIndice(): Promise<void> {
  secao("integracao: indice com etapa de processo sigiloso (pendencia P2 T8)");
  const p = projeto({ id: "p1", processo: { protocolo: "50300.000001/2026-11" } });
  const idx = indiceDeProcessos([
    {
      vis: "unidade",
      projetos: [p],
      etapas: [
        etapa({ id: "comum", projeto: "p1" }),
        // Como chega do Texto Padrão: o vínculo próprio vazio, marcado sigiloso (o marcador da P4).
        etapa({ id: "sig", projeto: "p1", processo: VINCULO_VAZIO }),
        etapa({ id: "outra", projeto: "p1", processo: { protocolo: "50300.000002/2026-22" } }),
        // O protocolo vazio SEM a marca é "sem processo" (a tela mostra o do projeto): fica com o do projeto.
        etapa({ id: "semMarca", projeto: "p1", processo: { protocolo: "" } }),
      ],
    },
  ]);
  const doProjeto = idx.get(chaveProtocolo("50300.000001/2026-11"));
  checar(
    "a etapa sigilosa sem numero nao aparece no processo do projeto",
    doProjeto?.[0]?.etapas.map((e) => e.id).join() === "comum,semMarca",
    doProjeto?.[0]?.etapas.map((e) => e.id),
  );
  checar("a de processo proprio fica no dela", idx.get(chaveProtocolo("50300.000002/2026-22"))?.[0]?.etapas[0]?.id === "outra");
  checar("vinculo vazio nao vira chave", !idx.has(""));
  checar(
    "o processo do projeto continua com o papel projeto",
    doProjeto?.length === 1 && doProjeto[0]?.papel === "projeto",
    doProjeto?.map((v) => v.papel),
  );

  // Projeto sigiloso que chegou sem número: nem ele nem as etapas sem processo próprio viram chave.
  const pv = projeto({ id: "pv", processo: VINCULO_VAZIO });
  const idx2 = indiceDeProcessos([
    {
      vis: "eu",
      projetos: [pv],
      etapas: [etapa({ id: "e1", projeto: "pv" }), etapa({ id: "e2", projeto: "pv", processo: { protocolo: "SEI-150016/000123/2021" } })],
    },
  ]);
  checar(
    "projeto com o marcador: so a etapa de processo proprio (com letras) entra, no dela",
    idx2.size === 1 &&
      idx2
        .get(chaveProtocolo("SEI-150016/000123/2021"))?.[0]
        ?.etapas.map((e) => e.id)
        .join() === "e2",
    [...idx2.keys()],
  );
}

async function verificarConcluirSeAberta(): Promise<void> {
  secao("integracao: concluir pelos baloes nao conclui de novo (pendencia P2 T7)");
  const { repo } = novoRepo(ESCOPO_UN, areaMemoria());
  const pr = await repo.criarProjeto({ nome: "Revisão" });
  const e = await repo.criarEtapa({ projeto: pr.id, nome: "Nota técnica", inicio: "2026-10-01", fim: "2026-10-05" });
  const primeira = await repo.concluirSeAberta(e.id, HOJE, { numero: "0104019", titulo: "Nota Técnica 12" });
  checar("aberta: conclui com a data e o documento", primeira?.concluidaEm === HOJE && primeira.documento?.numero === "0104019");
  const gravada = await repo.obterEtapa(e.id);
  const registrosAntes = (await repo.historico()).length;
  const segunda = await repo.concluirSeAberta(e.id, "2026-10-09", { numero: "0109999" });
  const lida = await repo.obterEtapa(e.id);
  checar(
    "ja concluida: nada muda (data e documento ficam)",
    segunda === null && lida?.concluidaEm === HOJE && lida.documento?.numero === "0104019",
    lida,
  );
  checar(
    "ja concluida: nada e gravado (o carimbo e o historico ficam)",
    lida?.atualizadoEm === gravada?.atualizadoEm && (await repo.historico()).length === registrosAntes,
  );
  checar("etapa que nao existe: null, sem lancar", (await repo.concluirSeAberta("nao-existe", HOJE)) === null);
  const removida = await repo.criarEtapa({ projeto: pr.id, nome: "Removida", inicio: "2026-10-01", fim: "2026-10-02" });
  await repo.removerEtapa(removida.id);
  checar("etapa excluida (lapide): null, sem lancar", (await repo.concluirSeAberta(removida.id, HOJE)) === null);

  secao("integracao: concluirSeAberta segue a regra do documento da P4");
  const aberta = await repo.criarEtapa({ projeto: pr.id, nome: "Ofício", inicio: "2026-10-01", fim: "2026-10-02" });
  for (const numero of ["12a4567", "1".repeat(21), "12 345"]) {
    const erro = await lanca(() => repo.concluirSeAberta(aberta.id, HOJE, { numero }));
    const depois = await repo.obterEtapa(aberta.id);
    checar(
      `documento "${numero.length > 10 ? `${numero.length} digitos` : numero}" recusado e a etapa continua aberta`,
      erro instanceof ErroValidacao && !!depois && depois.concluidaEm === undefined && depois.documento === undefined,
      { erro: erro?.message, depois },
    );
  }
  const vinte = await repo.concluirSeAberta(aberta.id, HOJE, { numero: "1".repeat(20) });
  checar("20 digitos: conclui", vinte?.concluidaEm === HOJE && vinte.documento?.numero === "1".repeat(20));

  secao("integracao: concluir pelo balao numa etapa de processo sigiloso marca o documento");
  const { repo: rs, relogio } = novoRepo(ESCOPO_UN, areaMemoria(), "s");
  const ps = await rs.criarProjeto({ nome: "Apuração", processo: { protocolo: "50300.000555/2026-01", sigiloso: true } });
  const herda = await rs.criarEtapa({ projeto: ps.id, nome: "Sem processo próprio", inicio: "2026-10-01", fim: "2026-10-02" });
  const pn = await rs.criarProjeto({ nome: "Comum" });
  const propria = await rs.criarEtapa({
    projeto: pn.id,
    nome: "De processo sigiloso",
    inicio: "2026-10-01",
    fim: "2026-10-02",
    processo: { protocolo: "50300.000666/2026-01", sigiloso: true },
  });
  await rs.concluirSeAberta(herda.id, HOJE, { numero: "0104019", titulo: "Nota Técnica 12" });
  await rs.concluirSeAberta(propria.id, HOJE, { numero: "7700123" });
  const [h1, h2] = await Promise.all([rs.obterEtapa(herda.id), rs.obterEtapa(propria.id)]);
  checar(
    "o documento da etapa sigilosa (herdada e de processo proprio) fica marcado sigiloso, com o numero aqui",
    h1?.documento?.sigiloso === true &&
      h1.documento.numero === "0104019" &&
      h2?.documento?.sigiloso === true &&
      h2.documento.numero === "7700123",
    { h1: h1?.documento, h2: h2?.documento },
  );
  const conhecidos = await rs.sigilosConhecidos();
  checar("os dois numeros entram na memoria do sigilo", conhecidos.documentos.has("104019") && conhecidos.documentos.has("7700123"), [
    ...conhecidos.documentos,
  ]);
  const texto = await textoDe(rs, relogio());
  checar("o texto da unidade nao leva os numeros dos documentos", !texto.includes("104019") && !texto.includes("7700123"));
}

async function verificarMarcarSigiloso(): Promise<void> {
  secao("integracao: sigilo visto na tela marca os vinculos sem o numero no historico");
  const { repo: r2, area, relogio } = novoRepo(ESCOPO_UN, areaMemoria());
  const pp = await r2.criarProjeto({ nome: "Apuração", processo: { protocolo: "50300.000777/2026-01", idProcedimento: "77" } });
  const e1 = await r2.criarEtapa({ projeto: pp.id, nome: "Sem processo", inicio: "2026-10-01", fim: "2026-10-02" });
  await r2.editarEtapa(e1.id, { documento: { numero: "4440001" } }, HOJE);
  const e2 = await r2.criarEtapa({
    projeto: pp.id,
    nome: "Do mesmo processo",
    inicio: "2026-10-01",
    fim: "2026-10-02",
    processo: { protocolo: "50300000777202601" },
  });
  const e3 = await r2.criarEtapa({
    projeto: pp.id,
    nome: "De outro",
    inicio: "2026-10-01",
    fim: "2026-10-02",
    processo: { protocolo: "50300.000888/2026-02" },
  });
  const antesTexto = await textoDe(r2, relogio());
  checar("antes: o numero ainda iria no texto (a prova abaixo vale)", antesTexto.includes("000777") && antesTexto.includes("4440001"));
  const [vp, v1, v2] = [await r2.obterProjeto(pp.id), await r2.obterEtapa(e1.id), await r2.obterEtapa(e2.id)];
  const antes = (await r2.historico()).length;
  const n = await r2.marcarSigiloso("50300.000777/2026-01");
  const p2 = await r2.obterProjeto(pp.id);
  const [x1, x2, x3] = await Promise.all([r2.obterEtapa(e1.id), r2.obterEtapa(e2.id), r2.obterEtapa(e3.id)]);
  checar(
    "o projeto e a etapa do mesmo processo (com ou sem pontuacao) ficam sigilosos",
    n === 2 && p2?.processo?.sigiloso === true && x2?.processo?.sigiloso === true,
    { n, p: p2?.processo, e2: x2?.processo },
  );
  checar("o numero fica neste computador", p2?.processo?.protocolo === "50300.000777/2026-01" && p2.processo.idProcedimento === "77");
  checar("a etapa sem processo e a de outro processo nao mudam", !x1?.processo && x3?.processo?.sigiloso !== true);
  checar(
    "o sigilo gruda sem mudar o carimbo (como as marcas da P4)",
    p2?.atualizadoEm === vp?.atualizadoEm &&
      p2?.dispositivo === vp?.dispositivo &&
      x2?.atualizadoEm === v2?.atualizadoEm &&
      x1?.atualizadoEm === v1?.atualizadoEm,
    { p: [vp?.atualizadoEm, p2?.atualizadoEm], e2: [v2?.atualizadoEm, x2?.atualizadoEm] },
  );
  checar(
    "pela maquina da P4: o documento da etapa que herda o processo fica marcado na mesma gravacao",
    x1?.documento?.sigiloso === true && x1.documento.numero === "4440001",
    x1?.documento,
  );
  const memoria = await area.obter([`${MEMORIA}p/50300000777202601`, `${MEMORIA}d/4440001`]);
  checar(
    "a memoria do sigilo guarda o numero como LOCAL (a tela deste computador mostrou), e o documento que herdou",
    memoria[`${MEMORIA}p/50300000777202601`] === "local" && memoria[`${MEMORIA}d/4440001`] !== undefined,
    memoria,
  );
  const depois = await r2.historico();
  checar(
    "o historico nao ganha o numero (marcar o mesmo processo nao gera registro)",
    depois.length === antes && !JSON.stringify(depois.slice(0, depois.length - antes)).includes("777"),
  );
  const depoisTexto = await textoDe(r2, relogio());
  checar(
    "o texto da unidade nao leva mais o numero do processo nem o documento da etapa que herda",
    !depoisTexto.includes("000777") && !depoisTexto.includes("50300000777202601") && !depoisTexto.includes("4440001"),
  );
  checar("de novo: nada a marcar", (await r2.marcarSigiloso("50300.000777/2026-01")) === 0);
  checar("numero vazio ou sem digito: nada", (await r2.marcarSigiloso("")) === 0 && (await r2.marcarSigiloso("abc")) === 0);
  const naoLigado = await r2.marcarSigiloso("50300.000999/2026-09");
  const semEntrada = await area.obter(`${MEMORIA}p/50300000999202609`);
  checar(
    "processo sigiloso que nao esta em projeto nenhum: nada a marcar e nada na memoria",
    naoLigado === 0 && Object.keys(semEntrada).length === 0,
  );

  secao("integracao: marcarSigiloso lembra o numero que so ficou num registro do historico (T7)");
  const { repo: r5, area: a5, relogio: rel5 } = novoRepo(ESCOPO_UN, areaMemoria(), "r");
  // O projeto trocou de processo: o número antigo não está em vínculo nenhum, só no registro "processo" (antes).
  const trocou = await r5.criarProjeto({ nome: "Trocou de processo", processo: { protocolo: "50300.000555/2026-05" } });
  await r5.editarProjeto(trocou.id, { processo: { protocolo: "50300.000666/2026-06" } });
  checar(
    "antes: o numero antigo so esta no registro 'processo' e ainda iria ao texto",
    (await textoDe(r5, rel5())).includes("50300.000555/2026-05") &&
      (await r5.historico()).some((r) => r.campo === "processo" && r.antes === "50300.000555/2026-05"),
  );
  const chaveReg = `${MEMORIA}p/50300000555202605`;
  const nReg = await r5.marcarSigiloso("50300000555202605");
  checar(
    "nada a marcar (nenhum vinculo tem o numero), mas a memoria do sigilo o guarda como LOCAL",
    nReg === 0 && (await a5.obter(chaveReg))[chaveReg] === "local",
    { nReg, memoria: await a5.obter(chaveReg) },
  );
  const depoisReg = await textoDe(r5, rel5());
  checar(
    "o texto da unidade nao leva mais o numero (o registro sai raspado) e o processo atual nao muda",
    !depoisReg.includes("000555") &&
      !depoisReg.includes("50300000555202605") &&
      depoisReg.includes("50300.000666/2026-06") &&
      (await r5.obterProjeto(trocou.id))?.processo?.sigiloso !== true,
  );
  checar("registro com 'processo sigiloso' nao vira numero", (await r5.marcarSigiloso("processo sigiloso")) === 0);
  const falhaReg = { ler: false };
  const { repo: r6 } = novoRepo(ESCOPO_UN, areaQueFalhaNaMemoria(areaMemoria(), falhaReg), "g");
  await r6.criarProjeto({ nome: "Já sigiloso", processo: { protocolo: "50300.000100/2026-01", sigiloso: true } });
  const trocou6 = await r6.criarProjeto({ nome: "Trocou", processo: { protocolo: "50300.000555/2026-05" } });
  await r6.editarProjeto(trocou6.id, { processo: { protocolo: "50300.000666/2026-06" } });
  falhaReg.ler = true;
  const erroReg = await lanca(() => r6.marcarSigiloso("50300.000555/2026-05"));
  falhaReg.ler = false;
  checar("so no registro, com a memoria ilegivel: falha fechada (ErroMemoriaSigilo)", erroReg instanceof ErroMemoriaSigilo, erroReg);

  secao("integracao: marcarSigiloso com numero de letras, em lapide, e o ja marcado");
  const { repo: r3, area: a3, relogio: rel3 } = novoRepo(ESCOPO_EU, areaMemoria(), "l");
  const rj = await r3.criarProjeto({ nome: "Do RJ", processo: { protocolo: "SEI-150016/000123/2021" } });
  checar(
    "numero com letras (SEI-RJ): casa pelos digitos",
    (await r3.marcarSigiloso("SEI-150016/000123/2021")) === 1 && (await r3.obterProjeto(rj.id))?.processo?.sigiloso === true,
  );
  const ex = await r3.criarEtapa({
    projeto: rj.id,
    nome: "Excluída",
    inicio: "2026-10-01",
    fim: "2026-10-02",
    processo: { protocolo: "50300.000321/2026-03" },
  });
  await r3.removerEtapa(ex.id);
  const lapideAntes = await r3.etapas.obter(ex.id);
  const nLapide = await r3.marcarSigiloso("50300.000321/2026-03");
  const lapide = await r3.etapas.obter(ex.id);
  checar(
    "so a lapide tem o numero: ela e marcada (sem mudar o carimbo) e o texto nao o leva",
    nLapide === 1 &&
      lapide?.processo?.sigiloso === true &&
      lapide.removidoEm !== undefined &&
      lapide.atualizadoEm === lapideAntes?.atualizadoEm &&
      !(await textoDe(r3, rel3())).includes("000321"),
    { nLapide, lapide: lapide?.processo },
  );
  // Marcado por um colega (a marca chegou pelo texto): a memória o tem como aprendida.
  const doColega = await r3.criarProjeto({ nome: "Do colega", processo: { protocolo: "50300.000432/2026-04", sigiloso: true } });
  const chaveColega = `${prefixoMemoriaSigilo(ESCOPO_EU.host, ESCOPO_EU.login)}p/50300000432202604`;
  await a3.gravar({ [chaveColega]: "aprendida" });
  const nJa = await r3.marcarSigiloso("50300.000432/2026-04");
  checar(
    "ja marcado: nada a marcar, e a tela promove a memoria a LOCAL",
    nJa === 0 &&
      (await a3.obter(chaveColega))[chaveColega] === "local" &&
      (await r3.obterProjeto(doColega.id))?.atualizadoEm === doColega.atualizadoEm,
    (await a3.obter(chaveColega))[chaveColega],
  );

  secao("integracao: marcarSigiloso falha fechada (memoria do sigilo ilegivel)");
  const falha = { ler: false };
  const { repo: r4 } = novoRepo(ESCOPO_UN, areaQueFalhaNaMemoria(areaMemoria(), falha), "f");
  // Um sigiloso já guardado: a memória tem entrada, e lê-la passa pelo storage.
  await r4.criarProjeto({ nome: "Já sigiloso", processo: { protocolo: "50300.000100/2026-01", sigiloso: true } });
  const alvo = await r4.criarProjeto({ nome: "Visto na tela", processo: { protocolo: "50300.000200/2026-02" } });
  falha.ler = true;
  const erro = await lanca(() => r4.marcarSigiloso("50300.000200/2026-02"));
  const erroJa = await lanca(() => r4.marcarSigiloso("50300.000100/2026-01"));
  falha.ler = false;
  checar(
    "o erro e o da memoria (a mensagem diz que nada foi gravado) e o vinculo continua como estava",
    erro instanceof ErroMemoriaSigilo &&
      erroJa instanceof ErroMemoriaSigilo &&
      (await r4.obterProjeto(alvo.id))?.processo?.sigiloso !== true,
    { erro: erro?.message, erroJa: erroJa?.message },
  );
}

/** Conta as idas ao storage (cada `obter` e cada `chaves` é uma). */
function areaQueConta(base: Area): { area: Area; leituras(): number } {
  let n = 0;
  const area: Area = {
    ...base,
    obter: async (ch) => {
      n++;
      return base.obter(ch);
    },
    aoMudar: base.aoMudar.bind(base),
  };
  if (base.chaves) {
    const chaves = base.chaves.bind(base);
    area.chaves = async () => {
      n++;
      return chaves();
    };
  }
  return { area, leituras: () => n };
}

async function verificarMarcarSigilosos(): Promise<void> {
  secao("integracao: marcarSigilosos (a carga da tela inteira) le o escopo uma vez para todos os numeros");
  const cenario = async (k: number) => {
    const contador = areaQueConta(areaMemoria());
    const { repo } = novoRepo(ESCOPO_UN, contador.area, "s");
    const numeros: string[] = [];
    for (let i = 0; i < k; i++) {
      const n = `50300.00${String(100 + i)}/2026-0${i % 10}`;
      await repo.criarProjeto({ nome: `P${i}`, processo: { protocolo: n } });
      numeros.push(n);
    }
    return { repo, numeros, leituras: contador.leituras };
  };
  const custo = async (k: number, umAUm = false) => {
    const c = await cenario(k);
    const antes = c.leituras();
    let marcados = 0;
    if (umAUm) for (const n of c.numeros) marcados += await c.repo.marcarSigiloso(n);
    else marcados = await c.repo.marcarSigilosos(c.numeros);
    return { leituras: c.leituras() - antes, marcados };
  };
  const [um, seis, umAUm] = [await custo(1), await custo(6), await custo(6, true)];
  checar(
    "seis sigilosos custam as mesmas idas ao storage que um (e todos ficam marcados)",
    um.marcados === 1 && seis.marcados === 6 && seis.leituras === um.leituras,
    { um, seis },
  );
  checar("um a um, o custo cresceria com a tela", umAUm.marcados === 6 && umAUm.leituras > seis.leituras, { umAUm, seis });

  secao("integracao: marcarSigilosos com numeros de todo tipo");
  const { repo: rm, area: am } = novoRepo(ESCOPO_UN, areaMemoria(), "m");
  const marcar = await rm.criarProjeto({ nome: "A marcar", processo: { protocolo: "50300.000701/2026-01" } });
  const etapa = await rm.criarEtapa({
    projeto: marcar.id,
    nome: "Do outro",
    inicio: "2026-10-01",
    fim: "2026-10-02",
    processo: { protocolo: "50300.000702/2026-02" },
  });
  await rm.criarProjeto({ nome: "Já marcado por colega", processo: { protocolo: "50300.000703/2026-03", sigiloso: true } });
  const trocou = await rm.criarProjeto({ nome: "Trocou", processo: { protocolo: "50300.000704/2026-04" } });
  await rm.editarProjeto(trocou.id, { processo: { protocolo: "50300.000705/2026-05" } });
  const chave = (n: string) => `${MEMORIA}p/${chaveProtocolo(n)}`;
  await am.gravar({ [chave("50300.000703/2026-03")]: "aprendida" });
  const antes = (await rm.historico()).length;
  const n = await rm.marcarSigilosos([
    "50300.000701/2026-01",
    "50300000702202602",
    "50300.000703/2026-03",
    "50300.000704/2026-04",
    "50300.000999/2026-99",
    "",
    "abc",
    "50300.000701/2026-01",
  ]);
  const vistos = ["50300.000701/2026-01", "50300.000702/2026-02", "50300.000703/2026-03", "50300.000704/2026-04", "50300.000999/2026-99"];
  const memoria = await am.obter(vistos.map(chave));
  checar(
    "marca os vinculos com os numeros (com ou sem pontuacao), uma vez cada, numa gravacao sem registro",
    n === 2 &&
      (await rm.obterProjeto(marcar.id))?.processo?.sigiloso === true &&
      (await rm.obterEtapa(etapa.id))?.processo?.sigiloso === true &&
      (await rm.obterProjeto(trocou.id))?.processo?.sigiloso !== true &&
      (await rm.historico()).length === antes,
    n,
  );
  checar(
    "a memoria: os marcados, o ja marcado (promovido) e o so do historico como LOCAL; o desconhecido, nada",
    memoria[chave("50300.000701/2026-01")] === "local" &&
      memoria[chave("50300.000702/2026-02")] === "local" &&
      memoria[chave("50300.000703/2026-03")] === "local" &&
      memoria[chave("50300.000704/2026-04")] === "local" &&
      !(chave("50300.000999/2026-99") in memoria),
    memoria,
  );
  checar("lista vazia ou sem numero: nada", (await rm.marcarSigilosos([])) === 0 && (await rm.marcarSigilosos(["", "x"])) === 0);
  const falha = { ler: false };
  const { repo: rf } = novoRepo(ESCOPO_UN, areaQueFalhaNaMemoria(areaMemoria(), falha), "q");
  await rf.criarProjeto({ nome: "Já sigiloso", processo: { protocolo: "50300.000100/2026-01", sigiloso: true } });
  const alvo = await rf.criarProjeto({ nome: "Visto na tela", processo: { protocolo: "50300.000200/2026-02" } });
  falha.ler = true;
  const erro = await lanca(() => rf.marcarSigilosos(["50300.000200/2026-02", "50300.000100/2026-01"]));
  falha.ler = false;
  checar(
    "memoria ilegivel: falha fechada (nada marcado)",
    erro instanceof ErroMemoriaSigilo && (await rf.obterProjeto(alvo.id))?.processo?.sigiloso !== true,
    erro?.message,
  );
}

async function verificarEntendi(): Promise<void> {
  secao("integracao: em Toda a unidade, concluir pelo balao pede o Entendi e marcar sigilo nao (decisao 10)");
  const { repo: cru } = novoRepo(ESCOPO_UN, areaMemoria(), "u");
  const p = await cru.criarProjeto({ nome: "Apuração", processo: { protocolo: "50300.000777/2026-01" } });
  const e = await cru.criarEtapa({ projeto: p.id, nome: "Ofício", inicio: "2026-10-01", fim: "2026-10-02" });
  let perguntas = 0;
  const un = comConsentimento(cru, async () => {
    perguntas++;
    return false;
  });
  const erro = await lanca(() => un.concluirSeAberta(e.id, HOJE));
  checar(
    "sem o Entendi, concluir pelo balao nao grava e a mensagem explica",
    perguntas === 1 &&
      String((erro as { mensagens?: string[] } | null)?.mensagens) === MENSAGEM_SEM_ENTENDI &&
      (await cru.obterEtapa(e.id))?.concluidaEm === undefined,
    erro,
  );
  const n = await un.marcarSigiloso("50300.000777/2026-01");
  checar(
    "marcar sigilo e protecao: grava sem perguntar",
    perguntas === 1 && n === 1 && (await cru.obterProjeto(p.id))?.processo?.sigiloso === true,
    { perguntas, n },
  );
}

export async function verificarIntegracaoModelo(): Promise<void> {
  await verificarIndice();
  await verificarConcluirSeAberta();
  await verificarMarcarSigiloso();
  await verificarMarcarSigilosos();
  await verificarEntendi();
}
