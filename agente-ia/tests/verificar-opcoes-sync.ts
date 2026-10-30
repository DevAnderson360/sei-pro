/**
 * O mecanismo ANTIGO de sincronização (as opções do SEI Pro), com um
 * navegador de mentira.
 *
 * `dist/js/init.js` é JavaScript legado, sem build e sem teste (o
 * `options.js` virou bundle de opcoes-pagina/ e é testado por import). Três defeitos justificam cobri-los aqui: a confirmação de
 * "salvo com sucesso" sem checar o erro do navegador, o descarte silencioso
 * de bases por um campo obrigatório vazio, e as credenciais copiadas para o
 * localStorage do domínio do SEI.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { armazemSync, LIMITE_ITEM_SYNC, medirEspaco, mensagemEstouro } from "../../opcoes-pagina/src/armazenamento";
import { checar, secao } from "./util";

const AQUI = dirname(fileURLToPath(import.meta.url));
const raiz = (...p: string[]) => join(AQUI, "..", "..", ...p);

/** Extrai uma função do fonte legado e a avalia isolada, com os globais que ela usa. */
function funcaoDoFonte<T>(fonte: string, nome: string, globais: Record<string, unknown>): T {
  const inicio = fonte.indexOf(`function ${nome}(`);
  if (inicio < 0) throw new Error(`função ${nome} não encontrada`);
  // Fecha na primeira linha que tem só "}" — é o estilo do arquivo.
  const fim = fonte.indexOf("\n}", inicio);
  const corpo = fonte.slice(inicio, fim + 2);
  const chaves = Object.keys(globais);
  const montar = new Function(...chaves, `${corpo}; return ${nome};`);
  return montar(...chaves.map((k) => globais[k])) as T;
}

/** O mesmo jmespath que a extensão carrega nas páginas do SEI. */
function carregarJmespath(): { search(dados: unknown, expressao: string): unknown } {
  const fonte = readFileSync(raiz("dist", "js", "lib", "jmespath.min.js"), "utf8");
  const exports: Record<string, unknown> = {};
  new Function("exports", "module", `${fonte}`)(exports, { exports });
  return (exports.search ? exports : (exports as { jmespath?: unknown }).jmespath) as { search(dados: unknown, expressao: string): unknown };
}

const INIT = readFileSync(raiz("dist", "js", "init.js"), "utf8");

export async function verificarOpcoesSync(): Promise<void> {
  // Desde a pagina de opcoes nova (opcoes-pagina/, 10/10/2026), options.js e um
  // bundle gerado: as duas garantias abaixo vivem em opcoes-pagina/src/armazenamento.ts.
  secao("opcoes: aviso antes de estourar o item do sync");
  {
    checar("limite do item e o do navegador", LIMITE_ITEM_SYNC === 8192);
    checar("configuracao pequena passa", medirEspaco(JSON.stringify({ a: 1 })).estado === "ok");
    const quase = JSON.stringify("x".repeat(7000));
    checar("a 85% apenas avisa, mas deixa salvar", medirEspaco(quase).estado === "perto");
    const grande = JSON.stringify("x".repeat(9000));
    const medida = medirEspaco(grande);
    checar("acima do limite do item, NAO deixa salvar", medida.estado === "estoura");
    checar("e explica ao usuario, com o tamanho", /espaço/.test(mensagemEstouro(medida.tamanho)) && mensagemEstouro(medida.tamanho).includes("8192"));
  }

  secao("opcoes: o erro do navegador nao passa calado");
  {
    const api = (erro?: string) => ({
      runtime: erro ? { lastError: { message: erro } } : {},
      storage: {
        sync: {
          get: (_c: Record<string, unknown>, cb: (i: Record<string, unknown>) => void) => cb({}),
          set: (_i: Record<string, unknown>, cb: () => void) => cb(),
        },
      },
    });
    let motivo = "";
    try {
      await armazemSync(api("QUOTA_BYTES quota exceeded")).gravar("x");
    } catch (e) {
      motivo = (e as Error).message;
    }
    checar("com erro, a gravacao falha (quem chama para ali)", motivo !== "");
    checar("e o usuario ve o motivo", /QUOTA_BYTES/.test(motivo), motivo);
    let falhou = false;
    await armazemSync(api())
      .gravar("x")
      .catch(() => {
        falhou = true;
      });
    checar("sem erro, segue o fluxo", !falhou);
  }

  secao("opcoes: credenciais fora do localStorage da pagina do SEI");
  {
    const guardado: Record<string, string> = {};
    const cache = funcaoDoFonte<(t: string) => void>(INIT, "cacheConfigPaginaPro", {
      localStorage: { setItem: (k: string, v: string) => void (guardado[k] = v) },
      JSON,
    });
    const dataValues = JSON.stringify([
      { baseName: "Projetos", baseTipo: "projetos", conexaoTipo: "sheets", API_KEY: "AIzaSyB-segredo", CLIENT_ID: "123-abc.apps.googleusercontent.com", KEY_USER: "chave-do-usuario" },
      { baseName: "IA da unidade", baseTipo: "openai", conexaoTipo: "api", KEY_USER: "sk-chave-da-openai" },
      { baseName: "Atividades SOG", baseTipo: "atividades", conexaoTipo: "api", URL_API: "https://atividades.exemplo.gov.br/api", KEY_USER: "hash-do-usuario" },
      { configGeral: [{ name: "autopreenchersenha", value: true }, { name: "gerenciaratividades", value: false }] },
    ]);
    cache(dataValues);
    const guardadoTexto = guardado.configBasePro ?? "";
    checar("a API_KEY nao vai para o localStorage", !guardadoTexto.includes("AIzaSyB-segredo"), guardadoTexto);
    checar("nem o CLIENT_ID", !guardadoTexto.includes("googleusercontent"));
    checar("nem a chave do usuario da planilha", !guardadoTexto.includes("chave-do-usuario"));
    checar("nem a chave da OpenAI", !guardadoTexto.includes("sk-chave-da-openai"), guardadoTexto);
    checar("as opcoes continuam lá", guardadoTexto.includes("autopreenchersenha"));
    // sei-pro-atividades.js roda no mundo da pagina e LE isto daqui: tirar
    // quebraria o gestor de atividades.
    checar("a base de atividades continua, porque o mundo da pagina depende dela", guardadoTexto.includes("hash-do-usuario"));
    const atividades = (JSON.parse(guardadoTexto) as Array<{ baseTipo?: string; baseName?: string }>).find((x) => x.baseTipo === "atividades");
    checar("com o baseName que monta o seletor de perfis", atividades?.baseName === "Atividades SOG", atividades);

    // Prova com a BIBLIOTECA REAL e as expressões exatas que os leitores usam:
    // é o que garante que o recorte não mudou o contrato de leitura.
    const jmespath = carregarJmespath();
    const lido = JSON.parse(guardadoTexto) as unknown;
    const geral = jmespath.search(lido, "[*].configGeral | [0]") as Array<{ name: string; value: unknown }> | null;
    checar("checkConfigValue continua achando o configGeral", Array.isArray(geral), geral);
    const valor = jmespath.search(geral, "[?name=='autopreenchersenha'].value | [0]");
    checar("e o valor da opcao", valor === true, valor);
    const baseAtiv = jmespath.search(lido, "[?baseTipo=='atividades'] | [?conexaoTipo=='api']") as Array<{ KEY_USER: string }>;
    checar("sei-pro-atividades.js continua achando o perfil", baseAtiv?.length === 1 && baseAtiv[0].KEY_USER === "hash-do-usuario", baseAtiv);
    const semPlanilhas = jmespath.search(lido, "[?baseTipo=='projetos'] | [?API_KEY!='']") as unknown[];
    checar("e as bases de planilha nao estao mais la", (semPlanilhas ?? []).length === 0, semPlanilhas);

    cache("");
    checar("configuracao vazia nao quebra", guardado.configBasePro === "[]", guardado.configBasePro);
    cache("isso nao e json");
    checar("texto corrompido nao quebra e limpa o cache", guardado.configBasePro === "", guardado.configBasePro);
  }
}
