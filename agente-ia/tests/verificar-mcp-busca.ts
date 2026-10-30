/**
 * mcp_buscar_tools: a ordem do que volta.
 *
 * O caso que motivou: conector com 27 ferramentas "arrendamento_*". A busca
 * "criar contrato arrendamento" casava com TODAS pelo prefixo, voltavam as 10
 * primeiras na ordem do servidor, e o modelo concluía que
 * "arrendamento_criar_contrato" não existia.
 */

import type { Conector } from "../src/mcp/conectores";
import { toolsMcp } from "../src/mcp/tools";
import type { ContextoTool } from "../src/motor/tools";
import { checar, secao } from "./util";

const tool = (nome: string, descricao = "") => ({ nome, descricao, esquema: { type: "object", properties: {} } });

/** 27 ferramentas de prefixo comum; o alvo é a 23ª. */
const NOMES = [
  "sessao", "listar_opcoes", "consultar_campos", "buscar_contratos", "consultar_contrato", "alterar_contrato", "excluir_contrato",
  "listar_registros", "incluir_registro", "alterar_registro", "excluir_registro", "enviar_arquivo", "listar_arquivos", "baixar_arquivo",
  "listar_portos", "listar_empresas", "consultar_empresa", "listar_aditivos", "incluir_aditivo", "listar_pendencias", "relatorio_contratos",
  "exportar_contratos", "criar_contrato", "listar_usuarios", "consultar_perfil", "historico_contrato", "validar_contrato",
].map((n) => `arrendamento_${n}`);

const conector = (c: Partial<Conector> = {}): Conector => ({
  id: "arr",
  nome: "Arrendamento",
  url: "http://127.0.0.1:8765/mcp",
  ativo: true,
  auth: { tipo: "nenhuma" },
  padrao: "sempre",
  permissoes: {},
  tools: NOMES.map((n) => tool(n, `Ferramenta do Sistema de Arrendamento: ${n.replace(/_/g, " ")}.`)),
  consentido: true,
  ...c,
});

type Saida = { ferramentas: Array<{ nome: string; servidor: string }>; outras?: string[]; erro?: string };

const buscarEm = (lista: Conector[]) => {
  const buscar = toolsMcp({ conectores: () => lista, guardar: async () => undefined }).find((t) => t.nome === "mcp_buscar_tools")!;
  return async (busca: string, servidor?: string) => (await buscar.executar({ busca, ...(servidor ? { servidor } : {}) }, {} as ContextoTool)) as Saida;
};

export async function verificarMcpBusca(): Promise<void> {
  const buscar = buscarEm([conector()]);
  const exibido = (n: string) => `mcp_arrendamento_${n}`;

  secao("mcp busca: prefixo comum nao esconde o alvo");
  {
    checar("o caso de teste tem 27 ferramentas e o alvo e a 23a", NOMES.length === 27 && NOMES[22] === "arrendamento_criar_contrato");
    const r = await buscar("arrendamento criar contrato");
    checar("prefixo + verbo traz o alvo em primeiro", r.ferramentas[0]?.nome === exibido("arrendamento_criar_contrato"), r.ferramentas.map((f) => f.nome));
    const outraOrdem = await buscar("criar contrato arrendamento");
    checar("em qualquer ordem dos termos", outraOrdem.ferramentas[0]?.nome === exibido("arrendamento_criar_contrato"), outraOrdem.ferramentas.map((f) => f.nome));
    checar("o termo que casa com todas nao traz as que so tem o prefixo", !outraOrdem.ferramentas.some((f) => f.nome === exibido("arrendamento_sessao")), outraOrdem.ferramentas.map((f) => f.nome));
  }

  secao("mcp busca: relevancia");
  {
    const r = await buscar("criar contrato");
    const nomes = r.ferramentas.map((f) => f.nome);
    checar("sufixo exato vem primeiro", nomes[0] === exibido("arrendamento_criar_contrato"), nomes);
    checar("depois, as que casam um termo so", nomes.includes(exibido("arrendamento_consultar_contrato")), nomes);
    const semCasar = nomes.filter((n) => !/criar|contrato/.test(n));
    checar("e nenhuma que nao casa termo nenhum", semCasar.length === 0, semCasar);

    const c = conector({
      tools: [tool("a_listar", "Serve para excluir contrato antigo."), tool("b_qualquer", "Outra coisa."), tool("c_excluir_contrato", "Remove.")],
    });
    const nomeVale = await buscarEm([c])("excluir contrato");
    checar("casar no nome vale mais que na descricao", nomeVale.ferramentas[0]?.nome.endsWith("c_excluir_contrato") && nomeVale.ferramentas[1]?.nome.endsWith("a_listar"), nomeVale.ferramentas.map((f) => f.nome));
    checar("quem nao casa fica de fora", nomeVale.ferramentas.length === 2, nomeVale.ferramentas.map((f) => f.nome));

    const exato = await buscar("arrendamento_criar_contrato");
    checar("o nome exato do servidor traz a ferramenta em primeiro", exato.ferramentas[0]?.nome === exibido("arrendamento_criar_contrato"), exato.ferramentas.map((f) => f.nome));
    const deExibicao = await buscar(exibido("arrendamento_historico_contrato"));
    checar("o nome de exibicao tambem", deExibicao.ferramentas[0]?.nome === exibido("arrendamento_historico_contrato") && deExibicao.ferramentas.length === 1, deExibicao.ferramentas.map((f) => f.nome));
    const acento = await buscar("histórico");
    checar("acento na busca nao atrapalha", acento.ferramentas[0]?.nome === exibido("arrendamento_historico_contrato"), acento.ferramentas.map((f) => f.nome));
  }

  secao("mcp busca: termo que nao discrimina");
  {
    const so = await buscar("arrendamento");
    checar("sozinho, ele vale: voltam as primeiras", so.ferramentas.length === 10 && so.ferramentas[0].nome === exibido("arrendamento_sessao"), so.ferramentas.map((f) => f.nome));
    const nada = await buscar("arrendamento inexistente");
    checar("com outro termo que nao casa nada, nao finge resultado", Boolean(nada.erro), nada);
  }

  secao("mcp busca: o que ficou de fora");
  {
    const todas = await buscar("");
    checar("sem busca, as 10 primeiras na ordem do servidor", todas.ferramentas.length === 10 && todas.ferramentas[0].nome === exibido("arrendamento_sessao"), todas.ferramentas.map((f) => f.nome));
    checar("e os nomes das outras 17", todas.outras?.length === 17 && todas.outras.includes(exibido("arrendamento_criar_contrato")), todas.outras);
    checar("'outras' traz so nomes", (todas.outras ?? []).every((n) => typeof n === "string"));
    const contrato = await buscar("contrato");
    const total = NOMES.filter((n) => n.includes("contrato")).length;
    checar("com busca, 'outras' so tem as que casaram e nao couberam", (contrato.outras?.length ?? 0) === Math.max(0, total - 10), { total, outras: contrato.outras });
    const pouca = await buscar("criar contrato");
    checar("cabendo tudo, nao ha 'outras'", pouca.outras === undefined || pouca.ferramentas.length === 10, pouca.outras);
    const bloqueada = await buscarEm([conector({ permissoes: { arrendamento_criar_contrato: "bloqueado" } })])("");
    checar("ferramenta bloqueada nao vaza por 'outras'", !(bloqueada.outras ?? []).includes(exibido("arrendamento_criar_contrato")) && bloqueada.outras?.length === 16, bloqueada.outras);
  }

  secao("mcp busca: mais de um conector");
  {
    const compras = conector({ id: "c2", nome: "Compras", tools: [tool("buscar_ata", "Busca atas de registro de preço."), tool("criar_contrato", "Cria contrato de compra.")] });
    const dois = buscarEm([conector(), compras]);
    const r = await dois("arrendamento criar contrato");
    // "arrendamento" não discrimina DENTRO do conector Arrendamento, mas é o
    // que separa os dois conectores: o do Compras não tem a palavra.
    checar("o alvo do conector certo vem antes do homonimo de outro", r.ferramentas[0]?.servidor === "Arrendamento" && r.ferramentas[0].nome === exibido("arrendamento_criar_contrato"), r.ferramentas.slice(0, 3));
    const filtrado = await dois("criar contrato", "Compras");
    checar("com servidor informado, so ele", filtrado.ferramentas.every((f) => f.servidor === "Compras") && filtrado.ferramentas[0].nome === "mcp_compras_criar_contrato", filtrado.ferramentas);
  }
}
