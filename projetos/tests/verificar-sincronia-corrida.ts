/**
 * Review Focus 2 do plano-mestre: dois usuários editando o mesmo projeto
 * "Toda a unidade" quase ao mesmo tempo. Dois computadores (repositório e
 * motor próprios, relógios próprios) e UM Texto Padrão em memória que confere
 * a gravação como o armazém do núcleo; o gancho intercala a rodada de um no
 * meio da do outro. Depois da próxima rodada de cada um, as duas alterações
 * estão no texto e nos dois computadores; uma exclusão não ressuscita.
 */

import { areaMemoria } from "@comum/armazenamento/area";
import { type ConferenciaTexto, MotorTextoPadrao, type ResultadoGravacao } from "@comum/sincronia/motor";
import { lerConteudoTexto } from "@comum/sincronia/textoPadraoCodec";
import type { EnvelopeProjetos, Escopo } from "../src/modelo/tipos";
import { RepositorioProjetos } from "../src/repositorio";
import { adaptadorProjetos } from "../src/sincronia/textoPadrao";
import { checar, secao } from "./util";

const AGORA = Date.UTC(2026, 9, 6, 12);

/** O texto da unidade no SEI: um só para os dois computadores. */
function textoDaUnidade() {
  const t = {
    html: null as string | null,
    gravacoes: 0,
    /** Roda (uma vez) logo antes da próxima conferência: é o colega gravando no meio. */
    antesDaConferencia: undefined as (() => Promise<unknown>) | undefined,
  };
  const destino = {
    ler: async () => t.html,
    gravar: async (h: string) => {
      t.gravacoes++;
      t.html = h;
    },
    gravarConferindo: async (h: string, c: ConferenciaTexto): Promise<ResultadoGravacao> => {
      const colega = t.antesDaConferencia;
      t.antesDaConferencia = undefined;
      if (colega) await colega();
      if (!c.mesmo(t.html, c.anterior)) return { gravado: false, atual: t.html };
      t.gravacoes++;
      t.html = h;
      return { gravado: true };
    },
  };
  return { t, destino };
}

function computador(login: string, dispositivo: string, texto: ReturnType<typeof textoDaUnidade>, inicio: number) {
  const area = areaMemoria();
  const relogio = { agora: inicio };
  const escopo: Escopo = { host: "sei.x.gov.br", login, unidade: "110", vis: "unidade" };
  let n = 0;
  const repo = new RepositorioProjetos(
    area,
    escopo,
    () => ({ agora: ++relogio.agora, dispositivo, por: login, nome: login }),
    () => `${dispositivo}-${++n}`,
  );
  const motor = new MotorTextoPadrao<EnvelopeProjetos>({
    adaptador: adaptadorProjetos({ repo, area, sigla: "SEPRO", nomeUsuario: login }),
    destino: texto.destino,
    area,
    travar: (_n, fn) => fn(),
    agora: () => relogio.agora,
    releituras: 3,
    temporizador: { definir: () => 0, cancelar: () => undefined },
  });
  return { repo, motor, relogio, rodada: () => motor.sincronizar({ forcar: true }) };
}

async function noTexto(html: string | null): Promise<EnvelopeProjetos["entidades"]> {
  const r = html ? await lerConteudoTexto(html) : null;
  return r && "bruto" in r ? (r.bruto as EnvelopeProjetos).entidades : { p: [], f: [], e: [], h: [], m: [] };
}

export async function verificarSincroniaCorrida(): Promise<void> {
  secao("corrida na unidade: duas edicoes quase ao mesmo tempo");
  const texto = textoDaUnidade();
  const ana = computador("ana", "pc-ana", texto, AGORA);
  const bia = computador("bia", "pc-bia", texto, AGORA + 5);
  const p = await ana.repo.criarProjeto({ nome: "Revisão normativa" });
  const x = await ana.repo.criarEtapa({ projeto: p.id, nome: "Minuta", inicio: "2026-10-06", fim: "2026-10-09" });
  const y = await ana.repo.criarEtapa({ projeto: p.id, nome: "Consulta pública", inicio: "2026-10-13", fim: "2026-10-23" });
  const z = await ana.repo.criarEtapa({ projeto: p.id, nome: "Nota técnica", inicio: "2026-10-26", fim: "2026-10-30" });
  await ana.rodada();
  await bia.rodada();
  checar("a bia recebeu o projeto da ana", (await bia.repo.dados()).etapas.length === 3);

  await ana.repo.editarEtapa(x.id, { nome: "Minuta revisada" }, "2026-10-06");
  await bia.repo.editarEtapa(y.id, { inicio: "2026-10-14", fim: "2026-10-27" }, "2026-10-06");
  // A ana lê; antes da conferência dela, a rodada inteira da bia grava o texto.
  texto.t.antesDaConferencia = () => bia.rodada();
  const sAna = await ana.rodada();
  const t1 = await noTexto(texto.t.html);
  checar(
    "o texto tem as duas alteracoes (a conferencia da ana achou o da bia e mesclou)",
    t1.e.find((e) => e.id === x.id)?.nome === "Minuta revisada" && t1.e.find((e) => e.id === y.id)?.fim === "2026-10-27",
    t1.e.map((e) => [e.nome, e.inicio, e.fim]),
  );
  checar("sem desistencia nem erro", sAna.estado === "ok" && !sAna.pendente, sAna);
  checar("a ana ja tem a alteracao da bia", (await ana.repo.obterEtapa(y.id))?.fim === "2026-10-27");
  const gravacoes = texto.t.gravacoes;
  await bia.rodada();
  checar("a bia, na rodada seguinte, tem a da ana", (await bia.repo.obterEtapa(x.id))?.nome === "Minuta revisada");
  checar("e nao regrava (o texto ja estava em dia)", texto.t.gravacoes === gravacoes);
  const h = (await noTexto(texto.t.html)).h;
  checar(
    "o historico tem quem mudou o que (os dois)",
    h.some((r) => r.por === "ana" && r.campo === "nome") && h.some((r) => r.por === "bia" && r.campo === "fim"),
    h.map((r) => `${r.por}:${r.campo}`),
  );

  secao("corrida na unidade: exclusao nao ressuscita");
  await ana.repo.removerEtapa(z.id);
  await bia.repo.editarEtapa(y.id, { nome: "Consulta pública (30 dias)" }, "2026-10-06");
  // A bia (que ainda tem a etapa Z viva) lê; a ana exclui e grava antes da conferência dela.
  texto.t.antesDaConferencia = () => ana.rodada();
  await bia.rodada();
  const t2 = await noTexto(texto.t.html);
  const zNoTexto = t2.e.find((e) => e.id === z.id);
  checar(
    "a etapa excluida continua lapide no texto (a copia velha da bia nao a trouxe de volta)",
    zNoTexto?.removidoEm !== undefined,
    zNoTexto,
  );
  checar("a edicao da bia entrou junto", t2.e.find((e) => e.id === y.id)?.nome === "Consulta pública (30 dias)");
  checar("na bia, a etapa sumiu", (await bia.repo.obterEtapa(z.id)) === undefined);
  await ana.rodada();
  checar(
    "na ana, a edicao da bia chegou e a exclusao ficou",
    (await ana.repo.obterEtapa(y.id))?.nome === "Consulta pública (30 dias)" && (await ana.repo.obterEtapa(z.id)) === undefined,
  );
  const terceira = computador("caio", "pc-caio", texto, AGORA + 9);
  await terceira.rodada();
  checar("um terceiro, que chega depois, recebe tudo e sem a etapa excluida", (await terceira.repo.dados()).etapas.length === 2);

  secao("corrida na unidade: dois colegas criando o texto ao mesmo tempo");
  {
    const tc = textoDaUnidade();
    const caio = computador("caio", "pc-caio", tc, AGORA);
    const dani = computador("dani", "pc-dani", tc, AGORA + 3);
    const doCaio = await caio.repo.criarProjeto({ nome: "Do caio" });
    const daDani = await dani.repo.criarProjeto({ nome: "Da dani" });
    // Nenhum texto ainda: o caio lê "não existe"; antes da conferência dele, a dani cria o texto.
    tc.t.antesDaConferencia = () => dani.rodada();
    const sc = await caio.rodada();
    const tcx = await noTexto(tc.t.html);
    checar(
      "o texto fica com os dois projetos (a conferencia do caio achou o texto criado pela dani e mesclou)",
      tcx.p.some((x) => x.id === doCaio.id) && tcx.p.some((x) => x.id === daDani.id) && sc.estado === "ok" && !sc.pendente,
      { p: tcx.p.map((x) => x.nome), sc },
    );
    checar("o caio ja tem o projeto da dani", !!(await caio.repo.obterProjeto(daDani.id)));
    const g = tc.t.gravacoes;
    await dani.rodada();
    checar(
      "a dani, na rodada seguinte, tem o do caio e nao regrava",
      !!(await dani.repo.obterProjeto(doCaio.id)) && tc.t.gravacoes === g,
      tc.t.gravacoes - g,
    );
  }

  secao("corrida na unidade: o registro antigo do numero que so a colega sabe sigiloso (memoria do sigilo)");
  {
    const SIGILO = "50300.000777/2026-10";
    const tr = textoDaUnidade();
    const ana3 = computador("ana", "pc-ana", tr, AGORA);
    const bia3 = computador("bia", "pc-bia", tr, AGORA + 5);
    const pr = await ana3.repo.criarProjeto({ nome: "Fiscalização" });
    await ana3.repo.editarProjeto(pr.id, { processo: { protocolo: SIGILO } }); // ninguém sabia do sigilo: o registro leva o número
    await ana3.rodada();
    await bia3.rodada();
    // A ana marca (a caixa) e troca o processo antes de a bia sincronizar: a bia nunca vê o vínculo marcado.
    await ana3.repo.editarProjeto(pr.id, { processo: { protocolo: SIGILO, sigiloso: true } });
    await ana3.repo.editarProjeto(pr.id, { processo: { protocolo: "50300.000002/2026-11" } });
    await ana3.rodada();
    checar(
      "premissa: a bia tem o registro antigo com o numero",
      (await bia3.repo.historico(pr.id)).some((r) => r.depois === SIGILO),
    );
    const gravadas: number[] = [];
    for (let i = 0; i < 2; i++) {
      for (const c of [bia3, ana3]) {
        const g = tr.t.gravacoes;
        await c.rodada();
        gravadas.push(tr.t.gravacoes - g);
      }
    }
    checar(
      "a bia aprende pelo registro raspado de mesmo carimbo: nenhuma das duas regrava",
      gravadas.every((g) => g === 0),
      gravadas,
    );
    checar("o numero nao esta no texto", !JSON.stringify(await noTexto(tr.t.html)).includes("000777"));
    const hb = await bia3.repo.historico(pr.id);
    checar(
      "a bia mantem o registro dela com o numero (e ja nao tem vinculo com ele)",
      hb.some((r) => r.campo === "processo" && r.depois === SIGILO) &&
        (await bia3.repo.obterProjeto(pr.id))?.processo?.protocolo !== SIGILO,
    );
  }

  secao("corrida na unidade: o numero sigiloso da colega, ligado aqui sem a marca (o sigilo gruda)");
  {
    const SIGILO = "50300.000777/2026-10";
    const tx = textoDaUnidade();
    const ana2 = computador("ana", "pc-ana", tx, AGORA);
    const bia2 = computador("bia", "pc-bia", tx, AGORA + 5);
    await ana2.repo.criarProjeto({ nome: "Apuração", processo: { protocolo: SIGILO, sigiloso: true } });
    await ana2.rodada();
    await bia2.rodada();
    // A bia só recebeu o vínculo vazio: não sabe que o número é sigiloso e o liga a um projeto dela.
    const daBia = await bia2.repo.criarProjeto({ nome: "Acompanhamento", processo: { protocolo: SIGILO } });
    const gravadas: number[] = [];
    for (let i = 0; i < 3; i++) {
      for (const c of [bia2, ana2]) {
        const g = tx.t.gravacoes;
        await c.rodada();
        gravadas.push(tx.t.gravacoes - g);
      }
    }
    checar("converge: na terceira rodada de cada uma, ninguem grava", gravadas[4] === 0 && gravadas[5] === 0, gravadas);
    const t3 = await noTexto(tx.t.html);
    checar(
      "o numero nao esta no texto",
      !JSON.stringify(t3).includes("000777") && t3.p.some((x) => x.id === daBia.id && x.processo?.protocolo === ""),
      t3.p.map((x) => x.processo),
    );
    const pb = await bia2.repo.obterProjeto(daBia.id);
    checar(
      "a bia ficou com a marca e com o numero dela (sem mudar o carimbo)",
      pb?.processo?.protocolo === SIGILO && pb.processo.sigiloso === true && pb.atualizadoEm === daBia.atualizadoEm,
      pb,
    );
  }
}
