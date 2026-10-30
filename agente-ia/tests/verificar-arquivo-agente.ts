/**
 * Núcleo da sincronia do Agente por arquivo: envelope, diário e mescla.
 *
 * O que não pode escapar: segredo não vai ao arquivo sem a caixa marcada, o
 * que foi apagado aqui não volta do arquivo, a leitura nunca apaga o que só
 * existe aqui, e a poda por idade é deste computador (não vira lápide).
 */

import {
  absorverDoSync,
  assinatura,
  carimbar,
  FORMATO,
  lerEnvelope,
  mesclar,
  TIPOS,
  VERSAO,
  type Diario,
  type EnvelopeAgente,
  type Retrato,
} from "../src/arquivo/envelope";
import { adaptadorAgente } from "../src/arquivo/adaptador";
import { CHAVES_DO_AGENTE, criarFila, deveAgendar, exportarBackup, fontesQueAvisam, importarBackup, MSG_IMPORTADO, MSG_NAO_E_BACKUP, travarAdaptador } from "../src/arquivo/gatilho";
import { espelharListas, lerListasDoLocal, trazerDoSync, type ListasEspelhadas } from "../src/painel/sincronia-listas";
import { ESPELHOS } from "../src/painel/espelho";
import { mudouParaOMotor, recarregarIntocados, type CampoDaConfig } from "../src/painel/campos-config";
import { fontesDoNavegador, lerListas, mudancas, type FontesRetrato } from "../src/arquivo/retrato";
import { MAX_LEMBRANCAS } from "../src/painel/memoria";
import { validarItem } from "../src/arquivo/validar";
import type { TipoLista } from "../src/arquivo/envelope";
import type { Rotina } from "../src/painel/rotinas";
import { areaMemoria } from "@comum/armazenamento/area";
import { MENSAGENS_ARQUIVO, SincroniaArquivo, type ArquivoSync } from "@comum/sincronia/arquivo";
import type { Regra } from "../src/painel/regras";
import type { Conector } from "../src/mcp/conectores";
import type { ConversaSalva } from "../src/painel/historico";
import type { Config } from "../src/painel/main";
import type { SkillUsuario } from "../src/painel/skills";
import { checar, resumo, secao } from "./util";

const DIA = 86_400_000;

const skill = (s: Partial<SkillUsuario> = {}): SkillUsuario => ({
  id: "s1",
  nome: "Despacho",
  slug: "despacho",
  descricao: "encaminhar",
  texto: "texto completo da skill",
  url: "https://github.com/o/r/blob/main/d.md",
  sincronizar: true,
  ...s,
});

const conector = (c: Partial<Conector> = {}): Conector => ({
  id: "c1",
  nome: "Compras",
  url: "https://mcp.exemplo.gov.br/mcp",
  ativo: true,
  auth: { tipo: "token", cabecalho: "Authorization", valor: "Bearer segredo" },
  padrao: "aprovar",
  permissoes: { buscar: "sempre" },
  ...c,
});

const conversa = (c: Partial<ConversaSalva> = {}): ConversaSalva => ({
  id: "v1",
  titulo: "Conversa",
  quando: 1,
  uso: { entrada: 1, saida: 1, total: 2, cache: 0, gravacaoCache: 0, raciocinio: 0, custo: 0 },
  mensagens: 2,
  itens: [{ tipo: "usuario", texto: "oi" }],
  ...c,
});

const configPadrao = (c: Partial<Config> = {}): Config =>
  ({
    reais: true,
    guardar: true,
    dias: 30,
    servico: "openrouter",
    url: "",
    chave: "sk-aqui",
    modelo: "anthropic/claude-sonnet-4.5",
    nomes: true,
    cnpj: false,
    ajustes: {},
    instrucoes: "assim",
    limites: { porConversa: 0, porDia: 0 },
    cache: true,
    memoria: true,
    modeloAuxiliar: "",
    ...c,
  }) as Config;

type Listas = Retrato["listas"];

function retrato(p: Partial<Listas> & { config?: Partial<Config> } = {}): Retrato {
  const { config, ...listas } = p;
  return {
    config: configPadrao(config),
    ignorados: {},
    listas: {
      skills: [],
      colecoes: [],
      regras: [],
      memoria: [],
      rotinas: [],
      conectores: [],
      fluxos: [],
      colecoesFluxos: [],
      conversas: [],
      ...listas,
    },
  };
}

const diario = (): Diario => ({});

/** O diário do retrato com todas as marcas no carimbo `em` (como se editadas em `em`). */
function diarioEm(r: Retrato, em: number): Diario {
  const d = carimbar(r, diario(), 0);
  return Object.fromEntries(Object.entries(d).map(([t, marcas]) => [t, Object.fromEntries(Object.entries(marcas).map(([id, m]) => [id, { ...m, em }]))]));
}

/** O envelope que um computador com este retrato, tudo editado em `em`, gravaria. */
const envelopeEm = (r: Retrato, em: number): EnvelopeAgente => mesclar(r, diarioEm(r, em), null, { agora: em, segredos: false }).envelope;

export function verificarArquivoAgente(): void {
  secao("arquivo do agente: exportar, carimbar e lapides");
  // a) exportar do zero
  const r1 = mesclar(retrato({ skills: [skill()] }), diario(), null, { agora: 100, segredos: false });
  checar("skill vai ao arquivo", r1.envelope.registros.skills[0]?.id === "s1", r1.envelope.registros.skills);
  checar("skill vai com o texto inteiro", (r1.envelope.registros.skills[0]?.dado as SkillUsuario).texto === "texto completo da skill");
  checar("sem segredos por padrao", r1.envelope.segredos === undefined && !JSON.stringify(r1.envelope).includes("sk-aqui"));
  checar("envelope com formato, versao e todos os tipos", r1.envelope.formato === FORMATO && r1.envelope.versao === VERSAO && TIPOS.every((t) => Array.isArray(r1.envelope.registros[t])));
  checar("config vai sem a chave", r1.envelope.config !== undefined && !("chave" in (r1.envelope.config.dado as object)));
  checar("exportar do zero nao muda o local", !r1.mudouLocal);

  // b) carimbar é idempotente
  const d1 = carimbar(retrato({ skills: [skill()] }), diario(), 100);
  checar("primeira vista carimba 0 (sem data conhecida)", d1.skills.s1.em === 0 && d1.config._.em === 0 && d1.ignorados._.em === 0, d1);
  checar("carimbo estavel", carimbar(retrato({ skills: [skill()] }), d1, 200).skills.s1.em === 0);
  checar("edicao local carimba de novo", carimbar(retrato({ skills: [skill({ nome: "Outro" })] }), d1, 200).skills.s1.em === 200);
  checar("carimbar nao altera o diario recebido", d1.skills.s1.em === 0 && !d1.skills.s1.apagado);

  // c) exclusão local vira lápide e o arquivo não ressuscita
  const r2 = mesclar(retrato({ skills: [] }), d1, r1.envelope, { agora: 300, segredos: false });
  const lapide = r2.envelope.registros.skills[0];
  checar("lapide no envelope", lapide?.apagado === true && lapide.em === 300 && r2.retrato.listas.skills.length === 0, r2.envelope.registros.skills);
  checar("lapide vai sem dado", lapide?.dado === undefined);
  checar("lapide fica no diario", r2.diario.skills.s1.apagado === true);

  // d) lápide do arquivo mais nova apaga aqui
  const r3 = mesclar(retrato({ skills: [skill()] }), d1, r2.envelope, { agora: 400, segredos: false });
  checar("lapide remota apaga", r3.retrato.listas.skills.length === 0 && r3.mudouLocal);
  checar("e o diario recebe a lapide do arquivo", r3.diario.skills.s1.apagado === true && r3.diario.skills.s1.em === 300);

  secao("arquivo do agente: mais recente vence");
  {
    // e) edição mais nova do arquivo vence; mais velha perde
    const dLocal = diarioEm(retrato({ skills: [skill()] }), 100);
    const envNovo = envelopeEm(retrato({ skills: [skill({ nome: "De la" })] }), 500);
    const vence = mesclar(retrato({ skills: [skill()] }), dLocal, envNovo, { agora: 600, segredos: false });
    checar("edicao mais nova do arquivo entra", vence.retrato.listas.skills[0]?.nome === "De la" && vence.mudouLocal);
    checar("diario fica com o carimbo do arquivo", vence.diario.skills.s1.em === 500);
    checar("mescla seguinte nao muda mais nada", !mesclar(vence.retrato, vence.diario, vence.envelope, { agora: 700, segredos: false }).mudouLocal);
    checar(
      "e o carimbo segue o do arquivo",
      mesclar(vence.retrato, vence.diario, vence.envelope, { agora: 700, segredos: false }).diario.skills.s1.em === 500,
    );

    const envVelho = envelopeEm(retrato({ skills: [skill({ nome: "Antigo" })] }), 50);
    const perde = mesclar(retrato({ skills: [skill()] }), dLocal, envVelho, { agora: 600, segredos: false });
    checar("edicao mais velha do arquivo perde", perde.retrato.listas.skills[0]?.nome === "Despacho" && !perde.mudouLocal);
    checar("e o envelope leva a daqui", (perde.envelope.registros.skills[0]?.dado as SkillUsuario).nome === "Despacho" && perde.envelope.registros.skills[0]?.em === 100);

    const empate = mesclar(retrato({ skills: [skill()] }), dLocal, envelopeEm(retrato({ skills: [skill({ nome: "Empate" })] }), 100), { agora: 600, segredos: false });
    checar("empate fica com o local", empate.retrato.listas.skills[0]?.nome === "Despacho");

    const soLa = mesclar(retrato(), diario(), envNovo, { agora: 600, segredos: false });
    checar("registro que so existe no arquivo entra", soLa.retrato.listas.skills[0]?.id === "s1" && soLa.mudouLocal);
  }

  secao("arquivo do agente: primeira vista");
  {
    // 1) computador B recebeu s1 pelo storage.sync (sem texto) e nunca viu o arquivo
    const envA = mesclar(retrato({ skills: [skill()] }), diario(), null, { agora: 100, segredos: false }).envelope;
    checar("arquivo novo leva carimbo 0", envA.registros.skills[0]?.em === 0 && envA.config?.em === 0);
    const b = mesclar(retrato({ skills: [skill({ texto: "" })] }), diario(), envA, { agora: 200, segredos: false });
    checar("B recebe o texto da skill do arquivo", b.retrato.listas.skills[0]?.texto === "texto completo da skill" && b.mudouLocal, b.retrato.listas.skills[0]);
    checar("e o arquivo nao perde o texto", (b.envelope.registros.skills[0]?.dado as SkillUsuario).texto === "texto completo da skill");
    checar("mescla seguinte em B fica estavel", !mesclar(b.retrato, b.diario, b.envelope, { agora: 300, segredos: false }).mudouLocal);

    // 2) computador novo, config padrao, diario vazio
    const envX = mesclar(retrato({ config: { instrucoes: "X", chave: "sk-la" } }), diario(), null, { agora: 100, segredos: false }).envelope;
    const novo = mesclar(retrato(), diario(), envX, { agora: 200, segredos: false });
    checar("config do arquivo entra no computador novo", novo.retrato.config.instrucoes === "X");
    checar("com a chave local preservada", novo.retrato.config.chave === "sk-aqui");

    // 3) edição local depois da primeira vista vence o arquivo em 0
    const d0 = carimbar(retrato({ skills: [skill()] }), diario(), 100);
    const editado = mesclar(retrato({ skills: [skill({ nome: "Editado aqui" })] }), d0, envA, { agora: 400, segredos: false });
    checar("edicao local carimba agora", editado.diario.skills.s1.em === 400);
    checar("e vence o arquivo em 0", editado.retrato.listas.skills[0]?.nome === "Editado aqui" && (editado.envelope.registros.skills[0]?.dado as SkillUsuario).nome === "Editado aqui");
  }

  secao("arquivo do agente: conversas");
  {
    // f) poda: a marca velha sai do diário sem lápide
    const dConv = carimbar(retrato({ conversas: [conversa({ quando: 1 })] }), diario(), 1);
    const agora = 1 + 40 * DIA;
    const podado = carimbar(retrato(), dConv, agora);
    checar("poda nao gera lapide", podado.conversas?.v1 === undefined, podado.conversas);
    const exclusaoRecente = carimbar(retrato(), carimbar(retrato({ conversas: [conversa({ quando: agora - DIA })] }), diario(), agora - DIA), agora);
    checar("exclusao recente de conversa vira lapide", exclusaoRecente.conversas?.v1?.apagado === true);
    const semPrazo = carimbar(retrato({ config: { dias: 0 } }), dConv, agora);
    checar("com dias=0 a exclusao velha tambem vira lapide", semPrazo.conversas?.v1?.apagado === true);

    // poda pela idade da conversa (quando), não pela data do carimbo
    const vista = carimbar(retrato({ conversas: [conversa({ quando: 0 })] }), diario(), 0);
    const editadaDepois = carimbar(retrato({ conversas: [conversa({ quando: 1 * DIA, titulo: "editada" })] }), vista, 6 * DIA);
    checar("edicao da conversa carimba a data da mescla", editadaDepois.conversas.v1.em === 6 * DIA && editadaDepois.conversas.v1.q === 1 * DIA, editadaDepois.conversas.v1);
    const podadaPeloQuando = carimbar(retrato(), editadaDepois, 33 * DIA);
    checar("conversa podada pelo quando nao vira lapide", podadaPeloQuando.conversas.v1 === undefined, podadaPeloQuando.conversas);
    const apagadaDentroDoPrazo = carimbar(retrato(), editadaDepois, 20 * DIA);
    checar("mas apagada dentro do prazo vira lapide", apagadaDentroDoPrazo.conversas.v1?.apagado === true);
    // a mesma coisa quando a conversa veio do arquivo
    const envConvLa = envelopeEm(retrato({ conversas: [conversa({ quando: 1 * DIA, titulo: "de la" })] }), 6 * DIA);
    const veio = mesclar(retrato(), diarioEm(retrato(), 5), envConvLa, { agora: 6 * DIA, segredos: false });
    checar("conversa do arquivo guarda o quando na marca", veio.diario.conversas.v1?.q === 1 * DIA && veio.diario.conversas.v1.em === 6 * DIA, veio.diario.conversas.v1);
    checar("e e podada sem lapide", carimbar(retrato(), veio.diario, 33 * DIA).conversas.v1 === undefined);

    // g) guardar=false: não importa nem exporta as daqui
    const envConv = mesclar(retrato({ conversas: [conversa({ id: "la", quando: 900 })] }), diario(), null, { agora: 900, segredos: false }).envelope;
    // A config daqui tem data (editada em 950): senão a do arquivo, em 0, venceria e religaria o "guardar".
    const semGuardar = retrato({ config: { guardar: false }, conversas: [conversa({ id: "aqui", quando: 900 })] });
    const naoGuarda = mesclar(semGuardar, diarioEm(semGuardar, 950), envConv, {
      agora: 1000,
      segredos: false,
    });
    checar(
      "conversas do arquivo ficam no envelope",
      naoGuarda.envelope.registros.conversas.length === 1 && naoGuarda.envelope.registros.conversas[0].id === "la",
      naoGuarda.envelope.registros.conversas,
    );
    checar("e nao entram no retrato", !naoGuarda.retrato.listas.conversas.some((c) => c.id === "la"));
    checar("as daqui nao vao ao arquivo", !naoGuarda.envelope.registros.conversas.some((r) => r.id === "aqui"));
    checar("nem sao carimbadas", naoGuarda.diario.conversas === undefined || Object.keys(naoGuarda.diario.conversas).length === 0);
    checar("nao muda o local", !naoGuarda.mudouLocal);

    // h) conversa do arquivo mais velha que o prazo daqui
    const envVelha = mesclar(retrato({ config: { dias: 0 }, conversas: [conversa({ id: "velha", quando: 1 })] }), diario(), null, { agora: 2, segredos: false }).envelope;
    const prazo = mesclar(retrato(), diarioEm(retrato(), 5), envVelha, { agora: 1 + 40 * DIA, segredos: false });
    checar("conversa velha do arquivo nao entra no retrato", prazo.retrato.listas.conversas.length === 0 && !prazo.mudouLocal);
    checar("mas fica no envelope", prazo.envelope.registros.conversas[0]?.id === "velha" && prazo.envelope.registros.conversas[0].dado !== undefined);
    const quemGuarda = mesclar(retrato({ config: { dias: 0 } }), diario(), envVelha, { agora: 1 + 40 * DIA, segredos: false });
    checar("quem guarda para sempre recebe", quemGuarda.retrato.listas.conversas[0]?.id === "velha");
    checar("com a transcricao", JSON.stringify(quemGuarda.retrato.listas.conversas[0]?.itens) === '[{"tipo":"usuario","texto":"oi"}]');
  }

  secao("arquivo do agente: segredos");
  {
    // i) segredos=true
    const com = mesclar(retrato({ conectores: [conector()] }), diario(), null, { agora: 100, segredos: true });
    checar("chave vai aos segredos", com.envelope.segredos?.chave === "sk-aqui", com.envelope.segredos);
    checar("token vai aos segredos", com.envelope.segredos?.tokens?.c1 === "Bearer segredo");
    const registro = JSON.stringify(com.envelope.registros.conectores);
    checar("e nunca no registro do conector", !registro.includes("Bearer segredo") && registro.includes("Authorization"), registro);
    const sem = mesclar(retrato({ conectores: [conector()] }), diario(), null, { agora: 100, segredos: false });
    checar("sem a caixa, token nao vai a lugar nenhum", !JSON.stringify(sem.envelope).includes("Bearer segredo"));

    const repetido = mesclar(com.retrato, com.diario, com.envelope, { agora: 999, segredos: true });
    checar("segredos iguais mantem o carimbo (sem regravar)", repetido.envelope.segredos?.em === com.envelope.segredos?.em && assinatura(repetido.envelope) === assinatura(com.envelope));

    // importação: local vazio recebe do arquivo
    const outroPc = retrato({ config: { chave: "" }, conectores: [conector({ auth: { tipo: "token", cabecalho: "Authorization", valor: "" } })] });
    const recebe = mesclar(outroPc, diario(), com.envelope, { agora: 200, segredos: true });
    checar("chave do arquivo entra quando falta aqui", recebe.retrato.config.chave === "sk-aqui");
    const auth = recebe.retrato.listas.conectores[0]?.auth;
    checar("token do arquivo entra quando falta aqui", auth?.tipo === "token" && auth.valor === "Bearer segredo", auth);

    const viaSync = retrato({ config: { chave: "" }, conectores: [conector({ auth: { tipo: "nenhuma" } })] });
    const volta = mesclar(viaSync, diarioEm(viaSync, 300), com.envelope, { agora: 300, segredos: true });
    const auth2 = volta.retrato.listas.conectores[0]?.auth;
    checar("conector que chegou sem autenticacao volta a token", auth2?.tipo === "token" && auth2.cabecalho === "Authorization" && auth2.valor === "Bearer segredo", auth2);

    const minha = mesclar(retrato({ config: { chave: "sk-minha" } }), diario(), com.envelope, { agora: 200, segredos: true });
    checar("chave daqui nao e trocada pela do arquivo", minha.retrato.config.chave === "sk-minha" && minha.envelope.segredos?.chave === "sk-minha");

    // j) segredos=false com lido.segredos
    const intacto = mesclar(outroPc, diario(), com.envelope, { agora: 200, segredos: false });
    checar("copia os segredos do arquivo intactos", JSON.stringify(intacto.envelope.segredos) === JSON.stringify(com.envelope.segredos));
    checar("e nao importa a chave", intacto.retrato.config.chave === "");
    const authJ = intacto.retrato.listas.conectores[0]?.auth;
    checar("nem o token", authJ?.tipo === "token" && authJ.valor === "");

    // k) removerSegredos
    const removido = mesclar(retrato(), diario(), com.envelope, { agora: 200, segredos: true, removerSegredos: true });
    checar("remover segredos tira do envelope", removido.envelope.segredos === undefined && !JSON.stringify(removido.envelope).includes("sk-aqui"));

    // o token do conector daqui sobrevive à versão do arquivo que vence
    const dCon = diarioEm(retrato({ conectores: [conector()] }), 100);
    const envRenomeado = envelopeEm(retrato({ conectores: [conector({ nome: "Renomeado", auth: { tipo: "token", cabecalho: "Authorization", valor: "" } })] }), 500);
    const preservado = mesclar(retrato({ conectores: [conector()] }), dCon, envRenomeado, { agora: 600, segredos: false });
    const auth3 = preservado.retrato.listas.conectores[0];
    checar("versao do arquivo entra sem apagar o token daqui", auth3?.nome === "Renomeado" && auth3.auth.tipo === "token" && auth3.auth.valor === "Bearer segredo", auth3);
  }

  secao("arquivo do agente: arquivo adulterado");
  {
    // a) o endereço do conector mudou de servidor no arquivo: o token daqui não vai junto
    const dCon = diarioEm(retrato({ conectores: [conector()] }), 100);
    const envOutro = envelopeEm(retrato({ conectores: [conector({ url: "https://outro.exemplo/mcp", auth: { tipo: "token", cabecalho: "Authorization", valor: "" } })] }), 500);
    const desviado = mesclar(retrato({ conectores: [conector()] }), dCon, envOutro, { agora: 600, segredos: true });
    const c = desviado.retrato.listas.conectores[0];
    checar("conector do arquivo entra com o endereco novo", c?.url === "https://outro.exemplo/mcp");
    checar("sem o token daqui (outra origem)", !JSON.stringify(desviado.retrato).includes("Bearer segredo") && c?.auth.tipo === "token" && c.auth.valor === "", c?.auth);
    checar("e o token nao vai ao envelope", !JSON.stringify(desviado.envelope).includes("Bearer segredo"));

    // b) mesma origem, caminho diferente: o token fica
    const envMesma = envelopeEm(retrato({ conectores: [conector({ url: "https://mcp.exemplo.gov.br/outro", auth: { tipo: "token", cabecalho: "Authorization", valor: "" } })] }), 500);
    const mesma = mesclar(retrato({ conectores: [conector()] }), dCon, envMesma, { agora: 600, segredos: false });
    const cm = mesma.retrato.listas.conectores[0];
    checar("mesma origem mantem o token", cm?.auth.tipo === "token" && cm.auth.valor === "Bearer segredo", cm?.auth);

    const envInvalida = envelopeEm(retrato({ conectores: [conector({ url: "nao e url", auth: { tipo: "token", cabecalho: "Authorization", valor: "" } })] }), 500);
    const ci = mesclar(retrato({ conectores: [conector()] }), dCon, envInvalida, { agora: 600, segredos: false }).retrato.listas.conectores[0];
    checar("url invalida conta como outra origem", ci?.auth.tipo === "token" && ci.auth.valor === "");

    const oauth = (o: Partial<Conector> = {}): Conector =>
      conector({ auth: { tipo: "oauth", emissor: "https://id.exemplo", cliente: "x", token: "tok-oauth", refresh: "ref-oauth", expiraEm: 9 }, ...o });
    const dOa = diarioEm(retrato({ conectores: [oauth()] }), 100);
    const envOa = envelopeEm(retrato({ conectores: [oauth({ url: "https://outro.exemplo/mcp" })] }), 500);
    const oa = mesclar(retrato({ conectores: [oauth()] }), dOa, envOa, { agora: 600, segredos: false });
    checar("oauth de outra origem chega sem token", !JSON.stringify(oa.retrato).includes("tok-oauth") && !JSON.stringify(oa.retrato).includes("ref-oauth"));
    const oaMesma = mesclar(retrato({ conectores: [oauth()] }), dOa, envelopeEm(retrato({ conectores: [oauth({ nome: "Novo" })] }), 500), { agora: 600, segredos: false });
    const am = oaMesma.retrato.listas.conectores[0]?.auth;
    checar("oauth da mesma origem mantem token e refresh", am?.tipo === "oauth" && am.token === "tok-oauth" && am.refresh === "ref-oauth" && am.expiraEm === 9, am);

    // token do arquivo nao pousa em conector daqui de outro servidor
    const envTok = mesclar(retrato({ conectores: [conector()] }), diarioEm(retrato({ conectores: [conector()] }), 50), null, { agora: 50, segredos: true }).envelope;
    const longe = retrato({ conectores: [conector({ url: "https://outro.exemplo/mcp", auth: { tipo: "token", cabecalho: "Authorization", valor: "" } })] });
    const pousou = mesclar(longe, diarioEm(longe, 100), envTok, { agora: 600, segredos: true });
    checar("token do arquivo nao vai para outra origem", !JSON.stringify(pousou.retrato).includes("Bearer segredo"));

    // c) config do arquivo troca servico e endereco: a chave daqui nao vai junto
    const envEvil = envelopeEm(retrato({ config: { servico: "compativel" as Config["servico"], url: "https://x.evil/v1", modelo: "m-evil", instrucoes: "de la" } }), 500);
    const cfg = mesclar(retrato(), diarioEm(retrato(), 100), envEvil, { agora: 600, segredos: false }).retrato.config;
    checar("servico e endereco daqui ficam", cfg.servico === "openrouter" && cfg.url === "" && cfg.modelo === "anthropic/claude-sonnet-4.5", cfg);
    checar("instrucoes do arquivo ainda entram", cfg.instrucoes === "de la");
    const soUrl = envelopeEm(retrato({ config: { url: "https://x.evil/v1" } }), 500);
    checar("so o endereco diferente tambem preserva", mesclar(retrato(), diarioEm(retrato(), 100), soUrl, { agora: 600, segredos: false }).retrato.config.url === "");
    const semChave = mesclar(retrato({ config: { chave: "" } }), diarioEm(retrato({ config: { chave: "" } }), 100), envEvil, { agora: 600, segredos: false }).retrato.config;
    checar("sem chave aqui, o servico do arquivo entra", semChave.servico === "compativel" && semChave.url === "https://x.evil/v1");

    // d) carimbo do futuro vale agora
    const A = 1_000_000;
    const base = retrato({ skills: [skill()] });
    const envFuturo = envelopeEm(retrato({ skills: [skill({ nome: "Futuro" })] }), A + 1e9);
    const m1 = mesclar(base, diarioEm(base, 100), envFuturo, { agora: A, segredos: false });
    checar("registro do futuro entra, mas com carimbo de agora", m1.retrato.listas.skills[0]?.nome === "Futuro" && m1.diario.skills.s1.em === A && m1.envelope.registros.skills[0]?.em === A, m1.diario.skills.s1);
    const editadoDepois = retrato({ skills: [skill({ nome: "Local" })] });
    const m2 = mesclar(editadoDepois, m1.diario, envFuturo, { agora: A + 1, segredos: false });
    checar("edicao daqui depois vence o carimbo do futuro", m2.retrato.listas.skills[0]?.nome === "Local" && m2.envelope.registros.skills[0]?.em === A + 1, m2.envelope.registros.skills);
    checar("config do futuro tambem e limitada", m1.envelope.config!.em <= A);
  }

  secao("arquivo do agente: config e ignorados");
  {
    // l) config: instruções mais novas do arquivo entram; chave local preservada
    const dCfg = diarioEm(retrato(), 100);
    const envCfg = envelopeEm(retrato({ config: { instrucoes: "de la", chave: "sk-de-la" } }), 500);
    const cfg = mesclar(retrato(), dCfg, envCfg, { agora: 600, segredos: false });
    checar("instrucoes mais novas do arquivo entram", cfg.retrato.config.instrucoes === "de la" && cfg.mudouLocal);
    checar("chave daqui preservada", cfg.retrato.config.chave === "sk-aqui");
    checar("a chave de la nao estava no arquivo", !JSON.stringify(envCfg).includes("sk-de-la"));
    const cfgVelha = mesclar(retrato(), dCfg, envelopeEm(retrato({ config: { instrucoes: "velha" } }), 50), {
      agora: 600,
      segredos: false,
    });
    checar("config mais velha do arquivo perde", cfgVelha.retrato.config.instrucoes === "assim");

    const ign = { f1: [{ etapaId: "e1", quando: 5 }] };
    const envIgn = envelopeEm({ ...retrato(), ignorados: ign }, 500);
    const comIgn = mesclar(retrato(), dCfg, envIgn, { agora: 600, segredos: false });
    checar("ignorados mais novos do arquivo entram", JSON.stringify(comIgn.retrato.ignorados) === JSON.stringify(ign));
  }

  secao("arquivo do agente: leitura e assinatura");
  {
    // m) lerEnvelope
    checar("arquivo dos favoritos nao e lido", lerEnvelope({ formato: "seipro-favoritos", versao: 1, registros: {} }) === null);
    checar("sem registros nao e lido", lerEnvelope({ formato: FORMATO, versao: 1 }) === null);
    checar("registros nao-objeto nao e lido", lerEnvelope({ formato: FORMATO, versao: 1, registros: "x" }) === null);
    checar("lixo nao e lido", lerEnvelope(null) === null && lerEnvelope("texto") === null);
    const lido = lerEnvelope({
      formato: FORMATO,
      versao: 1,
      geradoEm: 1,
      registros: { skills: [{ id: "s1", em: 1, dado: skill() }, { id: "s2" }, { em: 3 }, { id: 4, em: 4 }] },
    });
    checar("tipo ausente vira lista vazia", lido !== null && Array.isArray(lido.registros.fluxos) && lido.registros.fluxos.length === 0);
    checar("registro sem em ou sem id e descartado", lido?.registros.skills.length === 1 && lido.registros.skills[0].id === "s1", lido?.registros.skills);
    checar("o envelope gerado e lido de volta igual", JSON.stringify(lerEnvelope(JSON.parse(JSON.stringify(r1.envelope)))) === JSON.stringify(r1.envelope));

    // n) assinatura ignora geradoEm
    const e: EnvelopeAgente = r1.envelope;
    checar("assinatura ignora geradoEm", assinatura({ ...e, geradoEm: 1 }) === assinatura({ ...e, geradoEm: 2 }));
    checar("assinatura muda com o conteudo", assinatura(e) !== assinatura(r2.envelope));
  }
}

// ------------------------------------------------------------ adaptador com fontes falsas

/** Um "computador": o retrato e o diário em memória, contando as aplicações. */
function computador(
  inicial: Retrato,
  segredos = false,
): FontesRetrato & { r: Retrato; d: Diario; aplicacoes: number; preservar: Partial<Record<TipoLista, string[]>> } {
  const c = {
    r: structuredClone(inicial),
    d: {} as Diario,
    aplicacoes: 0,
    preservar: {} as Partial<Record<TipoLista, string[]>>,
    preservados: () => c.preservar,
    lerRetrato: async () => structuredClone(c.r),
    aplicar: async (_antes: Retrato, depois: Retrato) => {
      c.aplicacoes++;
      c.r = structuredClone(depois);
    },
    lerDiario: async () => structuredClone(c.d),
    gravarDiario: async (d: Diario) => {
      c.d = structuredClone(d);
    },
    segredos: async () => segredos,
  };
  return c;
}

/** O arquivo em memória, contando as gravações. */
function arquivoMemoria(texto = ""): ArquivoSync & { texto: string; gravacoes: number } {
  const a = {
    texto,
    gravacoes: 0,
    ler: async () => a.texto,
    gravar: async (t: string) => {
      a.gravacoes++;
      a.texto = t;
    },
  };
  return a;
}

const regra = (r: Partial<Regra> = {}): Regra =>
  ({ id: "r1", nome: "Sem assinar", ativa: true, efeito: "bloquear", ferramentas: [], mensagem: "nao", ...r }) as Regra;

function sincronia(f: FontesRetrato, arquivo: ArquivoSync, relogio: () => number) {
  return new SincroniaArquivo({ area: areaMemoria(), chaveStatus: "st", arquivo, adaptador: adaptadorAgente(f, relogio) });
}

export async function verificarAdaptadorAgente(): Promise<void> {
  secao("arquivo do agente: adaptador e sincronia");
  let t = 1_000;
  const relogio = () => (t += 1_000);

  // arquivo vazio: grava o envelope com a skill daqui
  {
    const a = computador(retrato({ skills: [skill()] }));
    const arq = arquivoMemoria();
    const s = await sincronia(a, arq, relogio).sincronizar();
    const env = lerEnvelope(JSON.parse(arq.texto));
    checar("arquivo vazio: status ok", s.estado === "ok", s);
    checar("arquivo vazio: grava o envelope com a skill", env?.registros.skills[0]?.id === "s1" && arq.gravacoes === 1, arq.texto.slice(0, 200));
    checar("arquivo vazio: diario gravado", a.d.skills?.s1 !== undefined, a.d);

    // segunda sincronização sem mudança: não regrava
    const s2 = await sincronia(a, arq, relogio).sincronizar();
    checar("sem mudanca: status ok", s2.estado === "ok", s2);
    checar("sem mudanca: arquivo nao regravado", arq.gravacoes === 1, arq.gravacoes);
    checar("sem mudanca: local nao reaplicado", a.aplicacoes === 0, a.aplicacoes);
  }

  // arquivo de outro módulo (Favoritos): ilegível, regravado, local intacto
  {
    const a = computador(retrato({ skills: [skill()] }));
    const antes = JSON.stringify(a.r);
    const arq = arquivoMemoria(JSON.stringify({ formato: "seipro-favoritos", versao: 1, donos: {} }));
    const s = await sincronia(a, arq, relogio).sincronizar();
    checar("outro formato: regravado com a mensagem", s.estado === "ok" && s.mensagem === MENSAGENS_ARQUIVO.regravado, s);
    checar("outro formato: arquivo vira do agente", lerEnvelope(JSON.parse(arq.texto)) !== null && arq.gravacoes === 1);
    checar("outro formato: retrato local intacto", JSON.stringify(a.r) === antes && a.aplicacoes === 0);
  }

  // versão mais nova: erro, arquivo intocado
  {
    const a = computador(retrato({ skills: [skill()] }));
    const original = JSON.stringify({ formato: FORMATO, versao: 2, geradoEm: 1, registros: {} });
    const arq = arquivoMemoria(original);
    const s = await sincronia(a, arq, relogio).sincronizar();
    checar("versao 2: status erro com maisNovo", s.estado === "erro" && s.mensagem === MENSAGENS_ARQUIVO.maisNovo, s);
    checar("versao 2: arquivo nao gravado", arq.gravacoes === 0 && arq.texto === original);
    checar("versao 2: local intacto", a.aplicacoes === 0);
  }

  // dois computadores e um arquivo: criar, propagar, apagar, propagar a exclusão
  {
    const arq = arquivoMemoria();
    const A = computador(retrato({ regras: [regra()] }));
    const B = computador(retrato());
    await sincronia(A, arq, relogio).sincronizar();
    await sincronia(B, arq, relogio).sincronizar();
    checar("B recebe a regra de A", B.r.listas.regras.length === 1 && B.r.listas.regras[0].id === "r1", B.r.listas.regras);
    B.r = { ...B.r, listas: { ...B.r.listas, regras: [] } };
    await sincronia(B, arq, relogio).sincronizar();
    const lapide = lerEnvelope(JSON.parse(arq.texto))?.registros.regras[0];
    checar("B apaga: lapide no arquivo", lapide?.apagado === true, lapide);
    await sincronia(A, arq, relogio).sincronizar();
    checar("A perde a regra", A.r.listas.regras.length === 0, A.r.listas.regras);
    const n = arq.gravacoes;
    await sincronia(A, arq, relogio).sincronizar();
    await sincronia(B, arq, relogio).sincronizar();
    checar("depois de convergir, ninguem regrava", arq.gravacoes === n, arq.gravacoes - n);
  }

  // segredos: a caixa daqui decide; "remover" vale para uma gravação só
  {
    const arq = arquivoMemoria();
    const a = computador(retrato({ conectores: [conector()] }), true);
    const ad = adaptadorAgente(a, relogio);
    const sinc = new SincroniaArquivo({ area: areaMemoria(), chaveStatus: "st", arquivo: arq, adaptador: ad });
    await sinc.sincronizar();
    checar("caixa marcada: segredos no arquivo", lerEnvelope(JSON.parse(arq.texto))?.segredos?.chave === "sk-aqui");
    ad.removerSegredosNaProxima();
    await sinc.sincronizar();
    checar("remover: segredos fora do arquivo", lerEnvelope(JSON.parse(arq.texto))?.segredos === undefined && !arq.texto.includes("sk-aqui"));
    await sinc.sincronizar();
    checar("remover vale uma vez (caixa marcada grava de novo)", lerEnvelope(JSON.parse(arq.texto))?.segredos?.chave === "sk-aqui");
  }

  // armazenamento local com um item que o normalizador recusa: não vira lápide
  {
    const valida = { id: "t1", nome: "Diaria", pergunta: "p", frequencia: "diaria", hora: "08:00", ativa: true, alcance: "leitura" };
    const invalida = { id: "t2", nome: "Quebrada", frequencia: "nunca" };
    const lido = lerListas({ agenteIA_rotinas: [valida, invalida] });
    checar("leitor estrito: so a valida no retrato", lido.listas.rotinas.length === 1 && lido.listas.rotinas[0].id === "t1", lido.listas.rotinas);
    checar("leitor estrito: invalida preservada pelo id", JSON.stringify(lido.preservar.rotinas) === JSON.stringify(["t2"]), lido.preservar);
    let erro = "";
    try {
      lerListas({ agenteIA_regras: "quebrado" });
    } catch (e) {
      erro = String(e);
    }
    checar("leitor estrito: valor que nao e lista lanca", erro.includes("agenteIA_regras"), erro);

    // A já tinha as duas no arquivo (as duas válidas); a t2 corrompe só aqui.
    const arq = arquivoMemoria();
    const rotina = (id: string) => ({ ...valida, id }) as unknown as Rotina;
    const A = computador(retrato({ rotinas: [rotina("t1"), rotina("t2")] }));
    await sincronia(A, arq, relogio).sincronizar();
    A.r = { ...A.r, listas: { ...A.r.listas, rotinas: [rotina("t1")] } };
    A.preservar = { rotinas: ["t2"] };
    await sincronia(A, arq, relogio).sincronizar();
    const regs = lerEnvelope(JSON.parse(arq.texto))?.registros.rotinas ?? [];
    checar("item invalido local: sem lapide no arquivo", regs.every((r) => !r.apagado), regs);
    checar("item invalido local: o registro do arquivo fica", regs.some((r) => r.id === "t2" && r.dado !== undefined), regs);
    checar("item invalido local: marca do diario intacta", A.d.rotinas?.t2 !== undefined && !A.d.rotinas.t2.apagado, A.d.rotinas);
  }

  // registro do arquivo que não passa no normalizador não entra aqui
  {
    const env = {
      formato: FORMATO,
      versao: VERSAO,
      geradoEm: 1,
      registros: {
        rotinas: [{ id: "x1", em: 1, dado: { id: "x1", nome: "Sem frequencia" } }],
        regras: [{ id: "x2", em: 1, dado: { id: "x2", nome: "Efeito estranho", efeito: "liberar", ferramentas: [], mensagem: "" } }],
        skills: [{ id: "x3", em: 1, dado: { nome: "sem id" } }],
        conectores: [{ id: "x4", em: 1, dado: { id: "x4", nome: "sem url" } }],
      },
    };
    const arq = arquivoMemoria(JSON.stringify(env));
    const a = computador(retrato());
    const s = await sincronia(a, arq, relogio).sincronizar();
    checar("arquivo com registro invalido: sincroniza", s.estado === "ok", s);
    checar("rotina invalida do arquivo nao gravada aqui", a.r.listas.rotinas.length === 0 && a.aplicacoes === 0, a.r.listas.rotinas);
    checar("regra, skill e conector invalidos nao entram", a.r.listas.regras.length === 0 && a.r.listas.skills.length === 0 && a.r.listas.conectores.length === 0);
    const regs = lerEnvelope(JSON.parse(arq.texto))?.registros;
    checar("invalido do arquivo: sem lapide", (regs?.rotinas ?? []).every((r) => !r.apagado), regs?.rotinas);
    checar("rotina valida do arquivo entra normalizada", (() => {
      const b = computador(retrato());
      const ok = { ...env, registros: { rotinas: [{ id: "x5", em: 1, dado: { id: "x5", nome: "Boa", frequencia: "diaria" } }] } };
      return lerEnvelope(ok) !== null && mesclar(b.r, {}, lerEnvelope(ok), { agora: 10, segredos: false, validar: validarItem }).retrato.listas.rotinas[0]?.hora === "08:00";
    })());
  }

  // rotina autônoma que vem do arquivo: chega desligada aqui
  {
    const auto = (r: Partial<Rotina> = {}) =>
      ({ id: "ra", nome: "Auto", pergunta: "faz", frequencia: "diaria", hora: "08:00", ativa: true, alcance: "autonoma", autorizadas: ["incluir_documento"], avisar: true, ...r }) as Rotina;
    const comRotina = (c: ReturnType<typeof computador>, r: Rotina) => {
      c.r = { ...c.r, listas: { ...c.r.listas, rotinas: [r] } };
    };
    const arq = arquivoMemoria();
    const A = computador(retrato({ rotinas: [auto()] }));
    const B = computador(retrato());
    await sincronia(A, arq, relogio).sincronizar();
    await sincronia(B, arq, relogio).sincronizar();
    checar("autonoma nova do arquivo chega desligada", B.r.listas.rotinas[0]?.ativa === false, B.r.listas.rotinas);
    let n = arq.gravacoes;
    for (const c of [A, B, A, B]) await sincronia(c, arq, relogio).sincronizar();
    checar("autonoma desligada aqui: sem regravacao em laco", arq.gravacoes === n, arq.gravacoes - n);
    checar("autonoma: o outro computador segue ligado", A.r.listas.rotinas[0]?.ativa === true);

    // B liga aqui; A muda a pergunta (sem mexer no alcance): B continua ligado
    comRotina(B, { ...B.r.listas.rotinas[0], ativa: true });
    await sincronia(B, arq, relogio).sincronizar();
    comRotina(A, { ...A.r.listas.rotinas[0], pergunta: "faz outra" });
    await sincronia(A, arq, relogio).sincronizar();
    await sincronia(B, arq, relogio).sincronizar();
    checar("autonoma atualizada sem ampliar: mantem ligada", B.r.listas.rotinas[0]?.ativa === true && B.r.listas.rotinas[0]?.pergunta === "faz outra", B.r.listas.rotinas);
    n = arq.gravacoes;
    for (const c of [A, B, A, B]) await sincronia(c, arq, relogio).sincronizar();
    checar("depois da atualizacao: sem regravacao em laco", arq.gravacoes === n, arq.gravacoes - n);

    // A autoriza mais uma ferramenta: em B volta desligada
    comRotina(A, { ...A.r.listas.rotinas[0], autorizadas: ["incluir_documento", "enviar_processo"] });
    await sincronia(A, arq, relogio).sincronizar();
    await sincronia(B, arq, relogio).sincronizar();
    checar("autorizadas ampliadas: chega desligada", B.r.listas.rotinas[0]?.ativa === false && B.r.listas.rotinas[0]?.autorizadas?.length === 2, B.r.listas.rotinas);
    n = arq.gravacoes;
    for (const c of [A, B, A, B]) await sincronia(c, arq, relogio).sincronizar();
    checar("desligada aqui com carimbo de la: sem laco", arq.gravacoes === n, arq.gravacoes - n);
    checar("desligada aqui com carimbo de la: o arquivo segue com a versao de A", A.r.listas.rotinas[0]?.ativa === true && B.r.listas.rotinas[0]?.ativa === false && (lerEnvelope(JSON.parse(arq.texto))?.registros.rotinas[0]?.dado as Rotina).ativa === true);

    // leitura que vira autônoma: também desligada
    const C = computador(retrato({ rotinas: [auto({ id: "rl", alcance: "leitura", autorizadas: undefined, avisar: undefined })] }));
    const lidoC = lerEnvelope({ formato: FORMATO, versao: VERSAO, geradoEm: 1, registros: { rotinas: [{ id: "rl", em: 50, dado: auto({ id: "rl" }) }] } });
    const rC = mesclar(C.r, carimbar(C.r, {}, 10), lidoC, { agora: 100, segredos: false, validar: validarItem });
    checar("leitura que vira autonoma: chega desligada", rC.retrato.listas.rotinas[0]?.alcance === "autonoma" && rC.retrato.listas.rotinas[0]?.ativa === false, rC.retrato.listas.rotinas);
  }

  // conector que vem do arquivo: nunca chega ligado, consentido nem liberado (como a rotina autônoma)
  {
    const comConector = (c: ReturnType<typeof computador>, k: Conector) => {
      c.r = { ...c.r, listas: { ...c.r.listas, conectores: [k] } };
    };
    const arq = arquivoMemoria();
    const A = computador(retrato({ conectores: [conector({ consentido: true, permissoes: { buscar: "sempre", apagar: "bloqueado" } })] }));
    const B = computador(retrato());
    await sincronia(A, arq, relogio).sincronizar();
    await sincronia(B, arq, relogio).sincronizar();
    const novo = B.r.listas.conectores[0];
    checar("conector novo do arquivo chega desligado", novo?.ativo === false, novo);
    checar("conector novo do arquivo chega sem consentimento", novo?.consentido === false, novo);
    checar("conector novo: 'sempre' vira pergunta, 'bloqueado' continua", novo?.permissoes.buscar !== "sempre" && novo?.permissoes.apagar === "bloqueado" && novo?.padrao === "aprovar", novo);
    let n = arq.gravacoes;
    for (const c of [A, B, A, B]) await sincronia(c, arq, relogio).sincronizar();
    checar("conector desligado aqui: sem regravacao em laco", arq.gravacoes === n, arq.gravacoes - n);
    checar("conector: o outro computador segue ligado e consentido", A.r.listas.conectores[0]?.ativo === true && A.r.listas.conectores[0]?.consentido === true);

    // B liga e consente aqui; A muda só o nome: B continua ligado e consentido
    comConector(B, { ...B.r.listas.conectores[0], ativo: true, consentido: true });
    await sincronia(B, arq, relogio).sincronizar();
    comConector(A, { ...A.r.listas.conectores[0], nome: "Compras 2" });
    await sincronia(A, arq, relogio).sincronizar();
    await sincronia(B, arq, relogio).sincronizar();
    const mantido = B.r.listas.conectores[0];
    checar("conector conhecido, so renomeado: mantem ligado e consentido", mantido?.nome === "Compras 2" && mantido?.ativo === true && mantido?.consentido === true, mantido);

    // A libera uma ferramenta bloqueada e baixa o padrão: B não acompanha o que amplia
    comConector(A, { ...A.r.listas.conectores[0], padrao: "sempre", permissoes: { buscar: "sempre", apagar: "sempre" } });
    await sincronia(A, arq, relogio).sincronizar();
    await sincronia(B, arq, relogio).sincronizar();
    const preso = B.r.listas.conectores[0];
    checar("permissao ampliada no arquivo nao chega", preso?.padrao === "aprovar" && preso?.permissoes.apagar === "bloqueado" && preso?.permissoes.buscar !== "sempre", preso);
    n = arq.gravacoes;
    for (const c of [A, B, A, B]) await sincronia(c, arq, relogio).sincronizar();
    checar("permissao restringida aqui: sem laco", arq.gravacoes === n, arq.gravacoes - n);

    // A desliga o conector: em B desliga também (desligar propaga)
    comConector(A, { ...A.r.listas.conectores[0], ativo: false });
    await sincronia(A, arq, relogio).sincronizar();
    await sincronia(B, arq, relogio).sincronizar();
    checar("desligar no arquivo propaga", B.r.listas.conectores[0]?.ativo === false && B.r.listas.conectores[0]?.consentido === true, B.r.listas.conectores[0]);

    // arquivo adulterado: conector conhecido que troca de servidor entra desligado e sem consentimento
    const C = computador(retrato({ conectores: [conector({ consentido: true })] }));
    const adulterado = lerEnvelope({ formato: FORMATO, versao: VERSAO, geradoEm: 1, registros: { conectores: [{ id: "c1", em: 50, dado: conector({ url: "https://outro.exemplo/mcp", consentido: true, padrao: "sempre", permissoes: { x: "sempre" }, auth: { tipo: "token", cabecalho: "Authorization", valor: "" } }) }] } });
    const rC = mesclar(C.r, carimbar(C.r, {}, 10), adulterado, { agora: 100, segredos: false, validar: validarItem });
    const k = rC.retrato.listas.conectores[0];
    checar("outro servidor: entra desligado, sem consentimento e sem liberar nada", k?.url === "https://outro.exemplo/mcp" && k?.ativo === false && k?.consentido === false && k?.padrao === "aprovar" && Object.keys(k?.permissoes ?? {}).length === 0, k);
  }

  // registro com id diferente do id do dado: não entra, não apaga
  {
    const C = computador(retrato({ regras: [regra({ id: "r1" })] }));
    const lido = lerEnvelope({ formato: FORMATO, versao: VERSAO, geradoEm: 1, registros: { regras: [{ id: "r1", em: 50, dado: regra({ id: "r9", nome: "trocada" }) }, { id: "r2", em: 50, dado: regra({ id: "r3" }) }] } });
    const r = mesclar(C.r, carimbar(C.r, {}, 10), lido, { agora: 100, segredos: false, validar: validarItem });
    checar("id trocado: local fica como estava", JSON.stringify(r.retrato.listas.regras) === JSON.stringify([regra({ id: "r1" })]), r.retrato.listas.regras);
    checar("id trocado: nada gravado, sem lapide", !r.mudouLocal && r.envelope.registros.regras.every((x) => !x.apagado), r.envelope.registros.regras);
  }

  // aplicar com itens recusados: respeita os tetos do guardar*
  {
    const dados: Record<string, unknown> = {};
    const antes = (globalThis as { chrome?: unknown }).chrome;
    (globalThis as { chrome?: unknown }).chrome = {
      storage: {
        local: {
          get: async (chaves: string | string[]) =>
            Object.fromEntries((Array.isArray(chaves) ? chaves : [chaves]).filter((k) => k in dados).map((k) => [k, structuredClone(dados[k])])),
          set: async (itens: Record<string, unknown>) => void Object.assign(dados, structuredClone(itens)),
        },
      },
    };
    try {
      const lembranca = (i: number) => ({ id: `m${i}`, texto: `nota ${i}`, quando: i, origem: "usuario" });
      dados.agenteIA_memoria = [...Array.from({ length: MAX_LEMBRANCAS }, (_, i) => lembranca(i)), { id: "quebrada", quando: 1 }];
      const f = fontesDoNavegador({ todas: async () => [], gravarVarias: async () => undefined });
      const local = await f.lerRetrato();
      checar("navegador: recusada fora do retrato e preservada", local.listas.memoria.length === MAX_LEMBRANCAS && f.preservados?.().memoria?.[0] === "quebrada");
      const depois = { ...local, listas: { ...local.listas, memoria: [...local.listas.memoria, lembranca(99) as never] } };
      await f.aplicar(local, depois);
      const gravada = dados.agenteIA_memoria as Array<{ id: string }>;
      checar("navegador: teto de lembrancas respeitado", gravada.filter((l) => l.id !== "quebrada").length === MAX_LEMBRANCAS, gravada.length);
      checar("navegador: recusada volta ao storage", gravada.some((l) => l.id === "quebrada") && gravada.some((l) => l.id === "m99"));
    } finally {
      (globalThis as { chrome?: unknown }).chrome = antes;
    }
  }

  // mudancas: só o que mudou vai ser gravado
  {
    const antes = retrato({ skills: [skill()], conversas: [conversa(), conversa({ id: "v2" })] });
    const depois = retrato({ skills: [skill()], regras: [regra()], conversas: [conversa({ titulo: "Outro" }), conversa({ id: "v3" })] });
    const m = mudancas(antes, depois);
    checar("mudancas: so as listas alteradas", JSON.stringify(m.listas) === JSON.stringify(["regras"]), m.listas);
    checar("mudancas: conversas novas e alteradas", JSON.stringify(m.conversas.novas.map((c) => c.id).sort()) === JSON.stringify(["v1", "v3"]), m.conversas);
    checar("mudancas: conversa removida", JSON.stringify(m.conversas.removidas) === JSON.stringify(["v2"]), m.conversas);
    checar("mudancas: config e ignorados iguais", !m.config && !m.ignorados);
    const m2 = mudancas(antes, { ...antes, config: { ...antes.config, instrucoes: "outra" } });
    checar("mudancas: config alterada", m2.config && m2.listas.length === 0 && m2.conversas.novas.length === 0);
  }
}

export async function verificarGatilhoAgente(): Promise<void> {
  secao("arquivo do agente: gatilho, Exportar e Importar");
  checar("gatilho: status nao agenda", deveAgendar(["agenteIA_arquivoStatus"]) === false);
  checar("gatilho: diario nao agenda", deveAgendar(["agenteIA_arquivoDiario"]) === false);
  checar("gatilho: caixa de segredos nao agenda", deveAgendar(["agenteIA_arquivoSegredos"]) === false);
  checar("gatilho: memoria agenda", deveAgendar(["agenteIA_memoria"]) === true);
  checar("gatilho: cambio nao agenda", deveAgendar(["agenteIA_cambio"]) === false);
  checar(
    "gatilho: chaves alheias nao agendam",
    ["agenteIA_gastoDiario", "agenteIA_baixados", "agenteIA_aberto", "agenteIA_cargo", "agenteIA_conversa", "spro_ia"].every((k) => !deveAgendar([k])),
  );
  checar("gatilho: status junto com config agenda", deveAgendar(["agenteIA_arquivoStatus", "agenteIA_config"]) === true);
  checar("gatilho: nenhuma chave nao agenda", deveAgendar([]) === false);
  checar(
    "gatilho: as dez chaves do agente",
    CHAVES_DO_AGENTE.length === 10 && CHAVES_DO_AGENTE.every((k) => deveAgendar([k])) && CHAVES_DO_AGENTE.includes("agenteIA_fluxosColecoes"),
    CHAVES_DO_AGENTE,
  );

  let t = 50_000;
  const relogio = () => (t += 1_000);

  // Exportar: o mesmo caminho da sincronia, com a caixa daqui e sem consumir o "remover segredos"
  {
    const a = computador(retrato({ conectores: [conector()], regras: [regra()] }), true);
    const ad = adaptadorAgente(a, relogio);
    ad.removerSegredosNaProxima();
    const texto = await exportarBackup(ad);
    const env = lerEnvelope(JSON.parse(texto));
    checar("exportar: envelope do agente com a regra", env?.registros.regras[0]?.id === "r1", texto.slice(0, 200));
    checar("exportar: caixa marcada leva os segredos", env?.segredos?.chave === "sk-aqui");
    checar("exportar: diario carimbado", a.d.regras?.r1 !== undefined, a.d);
    checar("exportar: local nao reaplicado", a.aplicacoes === 0);
    const arq = arquivoMemoria();
    await new SincroniaArquivo({ area: areaMemoria(), chaveStatus: "st", arquivo: arq, adaptador: ad }).sincronizar();
    checar("exportar: o remover pendente ainda vale na sincronia", !arq.texto.includes("sk-aqui"));
  }
  {
    const a = computador(retrato({ conectores: [conector()] }), false);
    const texto = await exportarBackup(adaptadorAgente(a, relogio));
    checar("exportar: caixa desmarcada nao leva segredo", !texto.includes("sk-aqui") && !texto.includes("Bearer segredo"));
  }

  // Importar: mescla o que é mais novo; o que não é backup não toca em nada
  {
    const A = computador(retrato({ regras: [regra()] }));
    const texto = await exportarBackup(adaptadorAgente(A, relogio));
    const B = computador(retrato({ skills: [skill()] }));
    const adB = adaptadorAgente(B, relogio);
    const msg = await importarBackup("\uFEFF" + texto, adB);
    checar("importar: mensagem de sucesso", msg === MSG_IMPORTADO, msg);
    checar("importar: regra entrou e a skill ficou", B.r.listas.regras[0]?.id === "r1" && B.r.listas.skills[0]?.id === "s1", B.r.listas);

    const C = computador(retrato({ skills: [skill()] }));
    const adC = adaptadorAgente(C, relogio);
    const naoE = await importarBackup(JSON.stringify({ formato: "seipro-favoritos", versao: 1, donos: {} }), adC);
    checar("importar: outro formato recusado", naoE === MSG_NAO_E_BACKUP && C.aplicacoes === 0, naoE);
    const quebrado = await importarBackup("{ isto nao e json", adC);
    checar("importar: json quebrado recusado", quebrado === MSG_NAO_E_BACKUP && C.aplicacoes === 0, quebrado);
    const novo = await importarBackup(JSON.stringify({ formato: FORMATO, versao: VERSAO + 1, geradoEm: 1, registros: { regras: [] } }), adC);
    checar("importar: versao mais nova recusada", novo === MENSAGENS_ARQUIVO.maisNovo && C.aplicacoes === 0, novo);
  }
}

/**
 * `chrome.storage` com `local` e `sync` separados e `onChanged` assíncrono,
 * só das chaves que mudaram de verdade (como no navegador). `lento`: o espelho
 * dessas chaves do `sync` demora (o item novo chega lá depois dos outros).
 */
function navegadorComAvisos(lento = "spro_regra_") {
  const dados = { local: {} as Record<string, unknown>, sync: {} as Record<string, unknown> };
  const ouvintes: Array<(m: Record<string, { newValue?: unknown; oldValue?: unknown }>, area: string) => void> = [];
  const area = (nome: "local" | "sync") => {
    const d = dados[nome];
    const avisar = (m: Record<string, { newValue?: unknown; oldValue?: unknown }>) => {
      if (Object.keys(m).length) setTimeout(() => ouvintes.forEach((o) => o(m, nome)), 0);
    };
    return {
      get: async (chaves?: string | string[] | null) => {
        if (!chaves) return structuredClone(d);
        const lista = Array.isArray(chaves) ? chaves : [chaves];
        return structuredClone(Object.fromEntries(lista.filter((k) => k in d).map((k) => [k, d[k]])));
      },
      set: async (itens: Record<string, unknown>) => {
        const demora = nome === "sync" && Object.keys(itens).some((k) => k.startsWith(lento)) ? 30 : 1;
        await new Promise((r) => setTimeout(r, demora));
        const m: Record<string, { newValue?: unknown; oldValue?: unknown }> = {};
        for (const [k, v] of Object.entries(structuredClone(itens))) {
          if (JSON.stringify(d[k]) !== JSON.stringify(v)) m[k] = { newValue: v, oldValue: d[k] };
          d[k] = v;
        }
        avisar(m);
      },
      remove: async (chaves: string | string[]) => {
        await new Promise((r) => setTimeout(r, 1));
        const m: Record<string, { newValue?: unknown; oldValue?: unknown }> = {};
        for (const k of Array.isArray(chaves) ? chaves : [chaves]) {
          if (k in d) m[k] = { oldValue: d[k] };
          delete d[k];
        }
        avisar(m);
      },
      getBytesInUse: async () => JSON.stringify(d).length,
    };
  };
  const chrome = { storage: { local: area("local"), sync: area("sync"), onChanged: { addListener: (o: (typeof ouvintes)[number]) => ouvintes.push(o) } } };
  return { dados, chrome, ouvintes };
}

const vazias = (): ListasEspelhadas => ({ skills: [], colecoes: [], regras: [], memoria: [], rotinas: [], conectores: [], fluxos: [] });

/**
 * O painel em miniatura: as listas na memória, a sincronia do `storage.sync`
 * disparada pelo `onChanged` (como em `main.ts`) e o adaptador do arquivo.
 * `coordenado` liga a trava comum e o aviso das fontes (o conserto).
 */
function painelDeMentira(nav: ReturnType<typeof navegadorComAvisos>, coordenado: boolean, relogio: () => number) {
  const trava = criarFila();
  const p = {
    listas: vazias(),
    sincronizando: false,
    async aplicarSincronizacao() {
      if (p.sincronizando) return;
      p.sincronizando = true;
      try {
        const corpo = async () => void (p.listas = await trazerDoSync(p.listas, false));
        await (coordenado ? trava(corpo) : corpo());
      } finally {
        p.sincronizando = false;
      }
    },
  };
  nav.ouvintes.push((m, area) => {
    if (area === "sync" && Object.keys(m).some((k) => k.startsWith("spro_"))) void p.aplicarSincronizacao();
  });
  const fontes = fontesQueAvisam(fontesDoNavegador({ todas: async () => [], gravarVarias: async () => undefined }), async () => {
    if (!coordenado) return;
    p.listas = await lerListasDoLocal();
    await espelharListas(p.listas);
  });
  const cru = adaptadorAgente(fontes, relogio);
  return { p, adaptador: coordenado ? travarAdaptador(cru, trava) : cru };
}

const assentar = async () => {
  for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 3));
};

export async function verificarCoordenacaoArquivo(): Promise<void> {
  secao("arquivo do agente: trava com a sincronia do storage.sync");
  let t = 90_000;
  const relogio = () => (t += 1_000);

  // fila: uma de cada vez, na ordem; a falha não trava a seguinte
  {
    const fila = criarFila();
    const ordem: string[] = [];
    const lenta = (nome: string, ms: number, falhar = false) => () =>
      new Promise<string>((ok, erro) =>
        setTimeout(() => {
          ordem.push(nome);
          if (falhar) erro(new Error(nome));
          else ok(nome);
        }, ms),
      );
    const r = await Promise.allSettled([fila(lenta("a", 15)), fila(lenta("b", 1, true)), fila(lenta("c", 1))]);
    checar("fila: na ordem de chegada", ordem.join() === "a,b,c", ordem);
    checar("fila: a falha nao trava a seguinte", r[1].status === "rejected" && r[2].status === "fulfilled", r);
  }

  // duas importações ao mesmo tempo: a segunda lê o que a primeira gravou
  {
    const backup = async (r: Partial<Listas>) => exportarBackup(adaptadorAgente(computador(retrato(r)), relogio));
    const t1 = await backup({ regras: [regra({ id: "r1" })] });
    const t2 = await backup({ regras: [regra({ id: "r2", nome: "Outra" })] });
    const montar = (travar: boolean) => {
      const c = computador(retrato());
      const aplicar = c.aplicar;
      c.aplicar = async (a, d) => {
        await new Promise((r) => setTimeout(r, 10));
        await aplicar(a, d);
      };
      const ad = adaptadorAgente(c, relogio);
      return { c, ad: travar ? travarAdaptador(ad, criarFila()) : ad };
    };
    const sem = montar(false);
    await Promise.all([importarBackup(t1, sem.ad), importarBackup(t2, sem.ad)]);
    checar("sem trava: a segunda importacao apaga a primeira (controle)", sem.c.r.listas.regras.length === 1, sem.c.r.listas.regras);
    const com = montar(true);
    await Promise.all([importarBackup(t1, com.ad), importarBackup(t2, com.ad)]);
    const ids = com.c.r.listas.regras.map((r) => r.id).sort();
    checar("com trava: as duas importacoes ficam", ids.join() === "r1,r2", ids);
  }

  // Importar num perfil limpo (ou a 1a sincronia do 2o computador) com a sincronia do sync ligada
  const antes = (globalThis as { chrome?: unknown }).chrome;
  try {
    const origem = computador(retrato({ skills: [skill({ texto: "corpo da skill" })], regras: [regra({ id: "rn" })] }));
    const texto = await exportarBackup(adaptadorAgente(origem, relogio));

    for (const coordenado of [false, true]) {
      const nav = navegadorComAvisos();
      (globalThis as { chrome?: unknown }).chrome = nav.chrome;
      const { p, adaptador } = painelDeMentira(nav, coordenado, relogio);
      // Basta sumir uma vez do local: a sincronia do arquivo que rodasse nesse
      // instante carimbaria a lápide e espalharia a exclusão.
      let teve = false;
      let sumiu = false;
      nav.ouvintes.push((m, area) => {
        if (area !== "local" || !m.agenteIA_regras) return;
        const tem = ((m.agenteIA_regras.newValue as Regra[] | undefined) ?? []).some((r) => r.id === "rn");
        if (teve && !tem) sumiu = true;
        teve ||= tem;
      });
      const msg = await importarBackup(texto, adaptador);
      await assentar();
      const skills = (nav.dados.local.agenteIA_skills as SkillUsuario[] | undefined) ?? [];
      const regras = (nav.dados.local.agenteIA_regras as Regra[] | undefined) ?? [];
      const textoOk = skills[0]?.texto === "corpo da skill";
      const regraOk = regras.some((r) => r.id === "rn");
      if (!coordenado) {
        checar("sem coordenacao: a sincronia do sync estraga o que veio do arquivo (controle)", msg === MSG_IMPORTADO && !(textoOk && regraOk), { skills, regras });
        continue;
      }
      checar("coordenado: importou", msg === MSG_IMPORTADO, msg);
      checar("coordenado: o texto da skill sobrevive a sincronia do sync", textoOk, skills);
      checar("coordenado: o item novo sobrevive (nao vira exclusao)", regraOk, regras);
      checar("coordenado: o item novo nunca some do local, nem por um instante", teve && !sumiu);
      checar("coordenado: o sync recebe o item novo", "spro_regra_rn" in nav.dados.sync, Object.keys(nav.dados.sync));
      checar("coordenado: as listas da memoria acompanham", p.listas.regras.some((r) => r.id === "rn") && p.listas.skills[0]?.texto === "corpo da skill", p.listas);
      // E a próxima sincronia do arquivo não espalha nada apagado.
      const env = lerEnvelope(JSON.parse(await exportarBackup(adaptador)));
      checar("coordenado: o arquivo seguinte sem lapide", Object.values(env?.registros ?? {}).every((l) => l.every((r) => !r.apagado)), env?.registros);
    }
  } finally {
    (globalThis as { chrome?: unknown }).chrome = antes;
  }
}

/**
 * Dois computadores com o `storage.sync` NO MEIO: o recorte chega pelo sync
 * em segundos, o arquivo chega depois. O que o sync trouxe não pode ser
 * carimbado como edição daqui (achados 1 e 2 da revisão final).
 */
export async function verificarSyncNoMeio(): Promise<void> {
  secao("arquivo do agente: dois computadores com o sync no meio");
  const o = (agora: number) => ({ agora, segredos: false, validar: validarItem });

  // skill: A edita texto e descrição; B recebe o recorte (texto velho) antes do arquivo
  {
    const sk = (s: Partial<SkillUsuario> = {}) => skill({ descricao: "d", texto: "velho", ...s });
    let A = retrato({ skills: [sk()] });
    let B = retrato({ skills: [sk()] });
    let rA = mesclar(A, {}, null, o(10));
    let arquivo = rA.envelope;
    let dA = rA.diario;
    let rB = mesclar(B, {}, arquivo, o(20));
    let dB = rB.diario;
    B = rB.retrato;
    arquivo = rB.envelope;
    A = retrato({ skills: [sk({ texto: "NOVO", descricao: "d2" })] });
    rA = mesclar(A, dA, arquivo, o(1000));
    dA = rA.diario;
    arquivo = rA.envelope;
    // o sync entrega o recorte de A a B (sem o texto)
    const antes = B.listas.skills;
    const depois = [ESPELHOS.skills.doSync(ESPELHOS.skills.paraSync(A.listas.skills[0])!, antes[0])!];
    checar("sync no meio: o recorte chega com o texto velho (premissa)", depois[0].texto === "velho" && depois[0].descricao === "d2", depois);
    dB = absorverDoSync(dB, "skills", antes, depois, validarItem);
    B = { ...B, listas: { ...B.listas, skills: depois } };
    rB = mesclar(B, dB, arquivo, o(2000));
    dB = rB.diario;
    arquivo = rB.envelope;
    const sB = rB.retrato.listas.skills[0];
    checar("sync no meio: B fica com o texto novo do arquivo", sB.texto === "NOVO" && sB.descricao === "d2", sB);
    const noArquivo = arquivo.registros.skills[0].dado as SkillUsuario;
    checar("sync no meio: o arquivo segue com o texto novo", noArquivo.texto === "NOVO" && arquivo.registros.skills[0].em === 1000, arquivo.registros.skills[0]);
    rA = mesclar(A, dA, arquivo, o(3000));
    checar("sync no meio: A nao perde o texto que editou", rA.retrato.listas.skills[0].texto === "NOVO", rA.retrato.listas.skills[0]);
  }

  // conector: o doSync rebaixa "token sem valor" a "sem autenticação" a cada abertura
  {
    const cA = conector({ permissoes: {} });
    let rA = mesclar(retrato({ conectores: [cA] }), {}, null, o(10));
    let arquivo = rA.envelope;
    const dA = rA.diario;
    const A = rA.retrato;
    const bruto = ESPELHOS.conectores.paraSync(cA)!;
    let B = retrato({ conectores: [validarItem("conectores", ESPELHOS.conectores.doSync(bruto, undefined)) as Conector] });
    let rB = mesclar(B, {}, arquivo, o(20));
    let dB = rB.diario;
    B = rB.retrato;
    arquivo = rB.envelope;
    for (const t of [30, 40, 50]) {
      // B abre o painel: o sync é aplicado de novo sobre o que B tem
      const antes = B.listas.conectores;
      // normalizado como o retrato o lê do storage (`lerListas`)
      const depois = [validarItem("conectores", ESPELHOS.conectores.doSync(bruto, antes[0])) as Conector];
      dB = absorverDoSync(dB, "conectores", antes, depois, validarItem);
      B = { ...B, listas: { ...B.listas, conectores: depois } };
      rB = mesclar(B, dB, arquivo, o(t));
      dB = rB.diario;
      B = rB.retrato;
      arquivo = rB.envelope;
    }
    const reg = arquivo.registros.conectores[0].dado as Conector;
    checar("sync no meio: o arquivo nao recebe o conector rebaixado", reg.auth.tipo === "token", reg.auth);
    rA = mesclar(A, dA, arquivo, o(60));
    const auth = rA.retrato.listas.conectores[0].auth;
    checar("sync no meio: A continua com o token", auth.tipo === "token" && auth.valor === "Bearer segredo", auth);
  }

  // absorver: edição daqui ainda não carimbada não é absorvida
  {
    const r = retrato({ regras: [regra()] });
    const d = carimbar(r, {}, 5);
    const editada = [regra({ mensagem: "editada aqui" })];
    const doSync = [regra({ mensagem: "veio do sync" })];
    const d2 = absorverDoSync(d, "regras", editada, doSync, validarItem);
    checar("absorver: com edicao pendente, a marca fica como estava", d2 === d, d2.regras);
    const d3 = absorverDoSync(d, "regras", r.listas.regras, doSync, validarItem);
    checar("absorver: sem edicao pendente, hash novo e mesmo carimbo", d3.regras.r1.em === d.regras.r1.em && d3.regras.r1.h !== d.regras.r1.h, d3.regras);
    checar("absorver: o carimbar seguinte nao carimba agora", carimbar({ ...r, listas: { ...r.listas, regras: doSync } }, d3, 999).regras.r1.em === d.regras.r1.em);
  }

  // integração: trazerDoSync de verdade (chrome falso) + adaptador com o arquivo de A
  const antesChrome = (globalThis as { chrome?: unknown }).chrome;
  try {
    let t = 500_000;
    const relogio = () => (t += 1_000);
    const nav = navegadorComAvisos("nada_");
    (globalThis as { chrome?: unknown }).chrome = nav.chrome;
    const sk = (s: Partial<SkillUsuario> = {}) => skill({ descricao: "d", texto: "velho", ...s });
    // A (em memória) e B (chrome falso) começam iguais, pelo arquivo
    const A = computador(retrato({ skills: [sk()] }));
    const arq = arquivoMemoria();
    await sincronia(A, arq, relogio).sincronizar();
    const fontesB = fontesDoNavegador({ todas: async () => [], gravarVarias: async () => undefined });
    await sincronia(fontesB, arq, relogio).sincronizar();
    await assentar();
    // A edita; o arquivo de A é gravado; o recorte sobe ao sync
    A.r = { ...A.r, listas: { ...A.r.listas, skills: [sk({ texto: "NOVO", descricao: "d2" })] } };
    await sincronia(A, arq, relogio).sincronizar();
    nav.dados.sync.spro_skill_s1 = ESPELHOS.skills.paraSync(A.r.listas.skills[0]);
    // B abre o painel: o sync chega primeiro
    const listasB = await lerListasDoLocal();
    await trazerDoSync(listasB, false);
    await assentar();
    const local = (nav.dados.local.agenteIA_skills as SkillUsuario[])[0];
    checar("integracao: B recebeu o recorte pelo sync (premissa)", local.descricao === "d2" && local.texto === "velho", local);
    // depois chega o arquivo
    await sincronia(fontesB, arq, relogio).sincronizar();
    await assentar();
    const final = (nav.dados.local.agenteIA_skills as SkillUsuario[])[0];
    checar("integracao: B fica com o texto novo", final.texto === "NOVO" && final.descricao === "d2", final);
    const env = lerEnvelope(JSON.parse(arq.texto));
    checar("integracao: o arquivo continua com o texto novo", (env?.registros.skills[0].dado as SkillUsuario | undefined)?.texto === "NOVO", env?.registros.skills);
    await sincronia(A, arq, relogio).sincronizar();
    checar("integracao: A continua com o texto novo", A.r.listas.skills[0].texto === "NOVO", A.r.listas.skills);
  } finally {
    (globalThis as { chrome?: unknown }).chrome = antesChrome;
  }
}

/**
 * Dois computadores que divergem de propósito (serviço de IA ou chave de cada
 * um) convergem: o arquivo não é regravado a cada rodada (achados 4 e 5).
 */
export function verificarSemPinguePongue(): void {
  secao("arquivo do agente: sem pingue-pongue entre dois computadores");

  // config: cada um com o seu serviço (e a sua chave)
  {
    let CA = retrato({ config: { servico: "openai", instrucoes: "x" } });
    let a = mesclar(CA, {}, null, { agora: 10, segredos: false });
    let f = a.envelope;
    let da = a.diario;
    let b = mesclar(retrato({ config: { servico: "openrouter", instrucoes: "x" } }), {}, f, { agora: 20, segredos: false });
    let db = b.diario;
    let lb = b.retrato;
    f = b.envelope;
    CA = retrato({ config: { servico: "openai", instrucoes: "y" } });
    a = mesclar(CA, da, f, { agora: 100, segredos: false });
    da = a.diario;
    f = a.envelope;
    let escritas = 0;
    let ass = assinatura(f);
    for (let i = 0; i < 6; i++) {
      const t = 200 + i * 100;
      for (let k = 0; k < 2; k++) {
        b = mesclar(lb, db, f, { agora: t, segredos: false });
        db = b.diario;
        lb = b.retrato;
      }
      if (assinatura(b.envelope) !== ass) {
        escritas++;
        f = b.envelope;
        ass = assinatura(f);
      }
      for (let k = 0; k < 2; k++) {
        a = mesclar(CA, da, f, { agora: t + 50, segredos: false });
        da = a.diario;
        CA = a.retrato;
      }
      if (assinatura(a.envelope) !== ass) {
        escritas++;
        f = a.envelope;
        ass = assinatura(f);
      }
    }
    checar("config: servicos diferentes nao regravam o arquivo", escritas === 0, escritas);
    checar("config: B recebe as instrucoes e fica com o seu servico", lb.config.instrucoes === "y" && lb.config.servico === "openrouter", lb.config);
    checar("config: A fica com o seu servico", CA.config.servico === "openai", CA.config);
    // edição de verdade em B continua indo ao arquivo
    lb = { ...lb, config: { ...lb.config, instrucoes: "z" } };
    b = mesclar(lb, db, f, { agora: 5_000, segredos: false });
    checar("config: edicao de B vai ao arquivo", (b.envelope.config?.dado as Partial<Config>).instrucoes === "z" && b.envelope.config?.em === 5_000, b.envelope.config);
  }

  // segredos: as duas caixas marcadas, uma chave em cada computador
  {
    const o = (agora: number) => ({ agora, segredos: true });
    let A = retrato({ config: { chave: "chave-A" } });
    let B = retrato({ config: { chave: "chave-B" } });
    let a = mesclar(A, {}, null, o(10));
    let da = a.diario;
    let f = a.envelope;
    let db: Diario = {};
    let escritas = 0;
    let ass = assinatura(f);
    for (let i = 0; i < 6; i++) {
      const t = 100 + i * 100;
      const b = mesclar(B, db, f, o(t));
      db = b.diario;
      B = b.retrato;
      if (assinatura(b.envelope) !== ass) {
        escritas++;
        f = b.envelope;
        ass = assinatura(f);
      }
      a = mesclar(A, da, f, o(t + 50));
      da = a.diario;
      A = a.retrato;
      if (assinatura(a.envelope) !== ass) {
        escritas++;
        f = a.envelope;
        ass = assinatura(f);
      }
    }
    checar("segredos: chaves diferentes regravam no maximo uma vez", escritas <= 1, escritas);
    checar("segredos: cada um fica com a sua chave", A.config.chave === "chave-A" && B.config.chave === "chave-B", [A.config.chave, B.config.chave]);
    checar("segredos: a marca do diario nao guarda o segredo", !JSON.stringify(da).includes("chave-A"), da.segredos);
    // A troca a chave: o arquivo recebe a nova
    A = { ...A, config: { ...A.config, chave: "chave-A2" } };
    a = mesclar(A, da, f, o(9_000));
    checar("segredos: chave trocada aqui vai ao arquivo", a.envelope.segredos?.chave === "chave-A2" && a.envelope.segredos?.em === 9_000, a.envelope.segredos);
    // remover limpa a marca: marcar de novo grava outra vez
    const rem = mesclar(A, a.diario, a.envelope, { agora: 9_100, segredos: true, removerSegredos: true });
    checar("segredos: remover tira a marca do diario", rem.envelope.segredos === undefined && rem.diario.segredos === undefined, rem.diario.segredos);
    const de = mesclar(A, rem.diario, rem.envelope, o(9_200));
    checar("segredos: depois de remover, marcar grava de novo", de.envelope.segredos?.chave === "chave-A2", de.envelope.segredos);
  }
}

/** Estado da máquina (conferências, erros, etag) não viaja nem oscila (achado 6). */
export function verificarEstadoDaMaquina(): void {
  secao("arquivo do agente: estado da maquina fica na maquina");
  const skA = skill({ verificadaEm: 111, etag: "W/etag-A", erroSync: "falhou em A" });
  const cA = conector({ erro: "caiu em A", semResposta: true, verificadoEm: 222 });
  const colA = { id: "col1", nome: "Equipe", url: "https://github.com/o/r/tree/main/s", verificadaEm: 333, erroSync: "x" };
  const A = retrato({ skills: [skA], conectores: [cA], colecoes: [colA] });
  const a = mesclar(A, {}, null, { agora: 10, segredos: false, validar: validarItem });
  const texto = JSON.stringify(a.envelope);
  checar("maquina: nada do estado local vai ao arquivo", !/verificadaEm|etag|erroSync|semResposta|verificadoEm|caiu em A/.test(texto), texto.slice(0, 400));
  // conferir de novo (só o estado muda) não é edição
  const A2 = retrato({ skills: [{ ...skA, verificadaEm: 999, etag: "W/outro", erroSync: undefined }], conectores: [{ ...cA, erro: undefined, semResposta: undefined, verificadoEm: 998 }], colecoes: [{ ...colA, verificadaEm: 997 }] });
  const d2 = carimbar(A2, a.diario, 5_000);
  checar("maquina: so o estado mudou, sem carimbo novo", d2.skills.s1.em === a.diario.skills.s1.em && d2.conectores.c1.em === a.diario.conectores.c1.em && d2.colecoes.col1.em === a.diario.colecoes.col1.em, [d2.skills, d2.conectores]);
  // B recebe a versão de A e fica com o seu estado
  const skB = skill({ texto: "velho", verificadaEm: 50, etag: "W/etag-B" });
  const cB = conector({ nome: "Antigo", verificadoEm: 60, auth: { tipo: "token", cabecalho: "Authorization", valor: "Bearer segredo" } });
  const B = retrato({ skills: [skB], conectores: [cB] });
  const envA = mesclar(retrato({ skills: [skA], conectores: [cA] }), diarioEm(retrato({ skills: [skA], conectores: [cA] }), 100), null, { agora: 100, segredos: false }).envelope;
  const b = mesclar(B, diarioEm(B, 50), envA, { agora: 200, segredos: false, validar: validarItem });
  const sB = b.retrato.listas.skills[0];
  const conB = b.retrato.listas.conectores[0];
  checar("maquina: B recebe o texto de A", sB.texto === skA.texto, sB);
  checar("maquina: B fica com a sua conferencia da skill", sB.verificadaEm === 50 && sB.etag === "W/etag-B" && sB.erroSync === undefined, sB);
  checar("maquina: B fica com o seu estado do conector", conB.nome === "Compras" && conB.verificadoEm === 60 && conB.erro === undefined && conB.semResposta === undefined, conB);
  const b2 = mesclar(b.retrato, b.diario, b.envelope, { agora: 300, segredos: false, validar: validarItem });
  checar("maquina: depois de receber, nada a regravar", assinatura(b2.envelope) === assinatura(b.envelope) && !b2.mudouLocal);
}

/**
 * O diálogo da configuração aberto durante o Importar (achado 3) e o motor
 * refeito com a config de fora (achado 7). O diálogo é DOM; aqui vai a regra
 * que ele usa (`campos-config.ts`), com campos falsos.
 */
export function verificarCamposDaConfig(): void {
  secao("arquivo do agente: dialogo da configuracao depois do Importar");
  const campo = (inicial: string | boolean, de: (c: Config) => string | boolean): CampoDaConfig & { v: string | boolean } => {
    const c = { v: inicial, ler: () => c.v, escrever: (v: string | boolean) => void (c.v = v), de };
    return c;
  };
  // computador novo: diálogo obrigatório aberto com a config padrão, sem chave
  const padrao = configPadrao({ chave: "", instrucoes: "", limites: { conversa: 0, dia: 0 } as Config["limites"] });
  const importada = configPadrao({ chave: "sk-do-arquivo", instrucoes: "do arquivo", limites: { conversa: 5, dia: 0 } as Config["limites"], cache: false });
  const instr = campo(padrao.instrucoes, (c) => c.instrucoes);
  const chave = campo(padrao.chave, (c) => c.chave);
  const limite = campo("", (c) => (c.limites.conversa ? String(c.limites.conversa) : ""));
  const cache = campo(padrao.cache, (c) => c.cache);
  const modelo = campo("modelo digitado", (c) => c.modelo); // o usuário já mexeu
  const n = recarregarIntocados([instr, chave, limite, cache, modelo], padrao, importada);
  checar("dialogo: campos intocados passam a mostrar a config importada", instr.v === "do arquivo" && chave.v === "sk-do-arquivo" && limite.v === "5" && cache.v === false, [instr.v, chave.v, limite.v, cache.v]);
  checar("dialogo: o que o usuario digitou fica", modelo.v === "modelo digitado", modelo.v);
  checar("dialogo: conta os trocados", n === 4, n);
  checar("dialogo: de novo com a mesma config, nada troca", recarregarIntocados([instr, chave, limite, cache, modelo], importada, importada) === 0);
  // o Salvar, que remonta a config dos campos, grava a importada (não a padrão):
  const salva = { ...importada, instrucoes: String(instr.v), chave: String(chave.v), cache: Boolean(cache.v) };
  const d = carimbar(retrato({ config: importada }), {}, 0);
  const d2 = carimbar(retrato({ config: salva }), d, 9_999);
  checar("dialogo: Salvar depois do Importar nao vira edicao nova", d2.config._.em === d.config._.em, d2.config);
  const comCamposVelhos = { ...importada, instrucoes: padrao.instrucoes, limites: padrao.limites, cache: padrao.cache };
  const d3 = carimbar(retrato({ config: comCamposVelhos }), d, 9_999);
  checar("dialogo: sem recarregar os campos, o Salvar seria edicao nova com a config velha (controle)", d3.config._.em === 9_999, d3.config);

  checar("motor: instrucoes mudaram", mudouParaOMotor(padrao, { ...padrao, instrucoes: "outra" }));
  checar("motor: modelo mudou", mudouParaOMotor(padrao, { ...padrao, modelo: "outro" }));
  checar("motor: guarda de conversas nao refaz o motor", !mudouParaOMotor(padrao, { ...padrao, dias: 7, guardar: false, reais: false }));
}

// Execução avulsa: `npx tsx tests/verificar-arquivo-agente.ts`.
if (process.argv[1]?.endsWith("verificar-arquivo-agente.ts")) {
  verificarArquivoAgente();
  await verificarAdaptadorAgente();
  await verificarGatilhoAgente();
  await verificarCoordenacaoArquivo();
  await verificarSyncNoMeio();
  verificarSemPinguePongue();
  verificarEstadoDaMaquina();
  verificarCamposDaConfig();
  resumo();
}
