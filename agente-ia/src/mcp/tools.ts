/**
 * As duas ferramentas que dão acesso aos conectores MCP.
 *
 * Por que duas, e não uma por ferramenta do servidor: o esquema de todas as
 * ferramentas de todos os conectores iria no pedido de CADA rodada. Com
 * `mcp_buscar_tools`, o custo fixo é uma linha por conector, e o esquema
 * chega quando o modelo decide usar. É o mesmo arranjo das skills: a lista é
 * curta, o conteúdo vem sob demanda.
 */

import { ClienteMcp, ErroMcp, enderecoLocal } from "./cliente";
import { acharConector, acharTool, conferirEndereco, destinoDe, nomeDeExibicao, permissaoDe, toolsVisiveis, type Conector } from "./conectores";
import { origemAutorizada } from "./verificacao";
import { conteudoDoBaixado } from "./arquivo";
import type { Baixado } from "../painel/baixados";
import type { ToolMcp } from "./protocolo";
import { s } from "../motor/esquema";
import { definirTool, type ContextoTool, type DefTool } from "../motor/tools";

export interface OpcoesToolsMcp {
  conectores(): Conector[];
  /** Grava a mudança de um conector (hoje: "permitir sempre" e o consentimento). */
  guardar(c: Conector): Promise<void>;
  /** Trocável nos testes. */
  cliente?(c: Conector): ClienteMcp;
  /** O navegador já tem a permissão de host? Trocável nos testes. */
  autorizado?(permissao: string): Promise<boolean>;
  /**
   * Caminhos de arquivo que o agente baixou do SEI (`documento_baixar`).
   * Passam ao conector como são: mascarado, o caminho não abre arquivo nenhum.
   */
  arquivos?(): string[];
  /** Downloads aprovados, com hash: o que pode ser enviado em bytes a um conector (ver `campoDeConteudo`). */
  baixados?(): Baixado[];
}

/**
 * Tira dos argumentos os caminhos de arquivo baixados pelo agente, para o
 * mascaramento não os alcançar, e devolve como recolocá-los.
 *
 * O caminho tem nome de usuário do sistema e título de documento — coisas que
 * a anonimização troca por rótulo. A comparação é feita nas duas formas (real
 * e mascarada) porque o modelo devolve o que leu, que é a forma mascarada, e
 * a reidratação do motor não garante devolver a caixa original.
 */
function protegerArquivos(args: Record<string, unknown>, arquivos: string[], anonimizar: (texto: string) => string): { args: Record<string, unknown>; recolocar<T>(v: T): T } {
  if (!arquivos.length) return { args, recolocar: (v) => v };
  const porMascara = new Map(arquivos.map((c) => [anonimizar(c), c]));
  const marcas: string[] = [];
  // Sorteada a cada chamada: texto que o modelo escreva nunca coincide com ela.
  const MARCA = `SEIPROARQUIVO${Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "abcdefghijklmnop"[b % 16]).join("")}Q`;
  const trocar = (v: unknown, ida: boolean): unknown => {
    if (typeof v === "string") {
      if (!ida) return v.startsWith(MARCA) && marcas[Number(v.slice(MARCA.length))] !== undefined ? marcas[Number(v.slice(MARCA.length))] : v;
      const real = arquivos.includes(v) ? v : porMascara.get(anonimizar(v));
      return real === undefined ? v : `${MARCA}${marcas.push(real) - 1}`;
    }
    if (Array.isArray(v)) return v.map((x) => trocar(x, ida));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trocar(x, ida)]));
    return v;
  };
  return { args: trocar(args, true) as Record<string, unknown>, recolocar: (v) => trocar(v, false) as typeof v };
}


const MAX_ACHADAS = 10;

/** Envio de arquivo: 25 MB viram ~33 MB de base64, e o túnel pode ser lento. */
const PRAZO_TRANSFERENCIA = 300_000;

const propriedadesDe = (t: ToolMcp): Record<string, { contentEncoding?: string } | undefined> =>
  (t.esquema as { properties?: Record<string, { contentEncoding?: string }> }).properties ?? {};

/**
 * O campo que recebe os bytes de um arquivo: o marcado no esquema com
 * `contentEncoding: "base64"` (JSON Schema), ou o `conteudo_base64` do MCP
 * Arrendamento. Pelo esquema, e não pelo nome da ferramenta, para valer a
 * qualquer conector que receba arquivo.
 */
function campoDeConteudo(t: ToolMcp): string | undefined {
  const props = propriedadesDe(t);
  return Object.entries(props).find(([, v]) => v?.contentEncoding === "base64")?.[0] ?? ("conteudo_base64" in props ? "conteudo_base64" : undefined);
}

/** Caminho de arquivo no disco: "C:\...", "/home/...", "~/...", "\\servidor\...". */
const pareceCaminho = (v: unknown): boolean => typeof v === "string" && /^([A-Za-z]:[\\/]|\/|~\/|\\\\)/.test(v.trim());

/** O argumento que traz o caminho de um download do agente, na forma real ou mascarada. */
function arquivoBaixadoEm(args: Record<string, unknown>, baixados: Baixado[], anonimizar: (texto: string) => string): { chave: string; baixado: Baixado } | undefined {
  for (const [chave, v] of Object.entries(args)) {
    if (typeof v !== "string" || !v) continue;
    const b = baixados.find((x) => x.caminho === v) ?? baixados.find((x) => anonimizar(x.caminho) === anonimizar(v));
    if (b) return { chave, baixado: b };
  }
  return undefined;
}

const ativos = (lista: Conector[]): Conector[] => lista.filter((c) => c.ativo && (c.tools?.length ?? 0) > 0);

/** O trecho do prompt de sistema: uma linha por conector ligado. */
export function linhasDeConectores(lista: Conector[]): string {
  const uteis = ativos(lista).filter((c) => toolsVisiveis(c).length > 0);
  if (!uteis.length) return "";
  const linhas = uteis
    .map((c) => {
      const vis = toolsVisiveis(c);
      const amostra = vis.slice(0, 8).map((t) => t.nome).join(", ");
      return `  - "${c.nome}" — ${vis.length} ferramenta${vis.length > 1 ? "s" : ""}: ${amostra}${vis.length > 8 ? ", ..." : ""}`;
    })
    .join("\n");
  return `\n- Conectores do usuário (servidores MCP). Para usar: mcp_buscar_tools para ver os parâmetros, depois mcp_chamar. Eles NÃO são o SEI:\n${linhas}`;
}

const semAcento = (texto: string): string =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

interface Pontuada {
  c: Conector;
  t: ToolMcp;
  exibicao: string;
  /** 2: a busca É o nome; 1: a busca é o fim do nome ("criar contrato" em "x_criar_contrato"). */
  exato: number;
  casados: number;
  noNome: number;
}

/**
 * As ferramentas do conector que casam com a busca, com o que é preciso para
 * ordená-las.
 *
 * Termo que casa com TODAS as ferramentas do conector não escolhe nenhuma — é
 * o prefixo comum ("arrendamento" em 27 ferramentas "arrendamento_*"). Ele sai
 * da conta, a menos que seja tudo o que a busca tem.
 */
function pontuar(c: Conector, termos: string[]): Pontuada[] {
  const fichas = toolsVisiveis(c).map((t) => ({ t, exibicao: nomeDeExibicao(c, t.nome), nome: semAcento(t.nome), descricao: semAcento(t.descricao) }));
  type Ficha = (typeof fichas)[number];
  const noNome = (f: Ficha, termo: string) => f.nome.includes(termo) || f.exibicao === termo;
  const casa = (f: Ficha, termo: string) => noNome(f, termo) || f.descricao.includes(termo);
  const discriminam = termos.filter((termo) => !fichas.every((f) => casa(f, termo)));
  const uteis = discriminam.length ? discriminam : termos;
  const inteira = termos.join("_");
  const fins = [...new Set([inteira, uteis.join("_")])].filter(Boolean);
  const saida: Pontuada[] = [];
  for (const f of fichas) {
    const casados = uteis.filter((termo) => casa(f, termo)).length;
    if (termos.length && !casados) continue;
    const exato = !inteira ? 0 : f.nome === inteira || f.exibicao === inteira ? 2 : fins.some((fim) => f.nome === fim || f.nome.endsWith(`_${fim}`)) ? 1 : 0;
    saida.push({ c, t: f.t, exibicao: f.exibicao, exato, casados, noNome: uteis.filter((termo) => noNome(f, termo)).length });
  }
  return saida;
}

/** Nome exato, depois mais termos casados, depois mais termos no nome; empate fica na ordem do servidor. */
const porRelevancia = (a: Pontuada, b: Pontuada): number => b.exato - a.exato || b.casados - a.casados || b.noNome - a.noNome;

function erro(mensagem: string): { erro: string } {
  return { erro: mensagem };
}

export function toolsMcp(o: OpcoesToolsMcp): DefTool[] {
  const fabricar = o.cliente ?? ((c: Conector) => new ClienteMcp(destinoDe(c)));

  const buscar = definirTool({
    nome: "mcp_buscar_tools",
    descricao:
      "Mostra os parâmetros das ferramentas dos conectores do usuário (servidores MCP). Use antes de mcp_chamar, filtrando pelo assunto. Voltam as 10 mais relevantes; as demais vêm só pelo nome em 'outras' — para ver os parâmetros de uma delas, busque pelo nome. NÃO use para o SEI: as ferramentas do SEI já estão todas disponíveis.",
    parametros: s.objeto({
      "servidor?": s.texto({ descricao: "Nome do conector, como aparece na lista. Em branco: procura em todos." }),
      "busca?": s.texto({ descricao: 'Palavras do que você quer fazer (ex.: "criar página"). Em branco: as primeiras.' }),
    }),
    efeito: "interna",
    rotulo: (a) => `Procurando ferramentas${a.servidor ? ` em ${String(a.servidor)}` : ""}`,
    executar: async (a) => {
      const lista = ativos(o.conectores());
      if (!lista.length) return erro("O usuário não tem nenhum conector ligado.");
      const alvo = a.servidor ? acharConector(lista, String(a.servidor)) : undefined;
      if (a.servidor && !alvo) return erro(`Não há conector "${String(a.servidor)}". Ligados: ${lista.map((c) => c.nome).join(", ")}.`);
      const termos = semAcento(String(a.busca ?? "")).split(/\s+/).filter(Boolean);
      const ordenadas = (alvo ? [alvo] : lista).flatMap((c) => pontuar(c, termos)).sort(porRelevancia);
      if (!ordenadas.length) return erro("Nenhuma ferramenta casou com a busca. Tente outras palavras ou liste sem busca.");
      const achadas = ordenadas.slice(0, MAX_ACHADAS).map(({ c, t, exibicao }) => ({ nome: exibicao, servidor: c.nome, descricao: t.descricao, parametros: t.esquema }));
      // Só os nomes do que não coube: o modelo fica sabendo que existem, sem
      // o custo de dezenas de esquemas, e pede o que quiser pelo nome.
      const outras = ordenadas.slice(MAX_ACHADAS).map((x) => x.exibicao);
      return {
        ferramentas: achadas,
        ...(outras.length ? { outras, como_ver_outras: "mcp_buscar_tools com busca = o nome da ferramenta" } : {}),
        como_chamar: "mcp_chamar com servidor, tool e argumentos",
      };
    },
  });

  const chamar = definirTool({
    nome: "mcp_chamar",
    descricao:
      "Executa uma ferramenta de um conector do usuário (servidor MCP). Confira os parâmetros com mcp_buscar_tools antes. O conteúdo enviado sai do navegador para o servidor do conector; dados pessoais vão mascarados. Para entregar um documento do SEI, use antes documento_baixar e passe o caminho devolvido: se o conector recebe arquivo, o SEI Pro envia o conteúdo, com nova aprovação do usuário. Se a ferramenta devolver erro, o texto é do servidor: repasse ao usuário o que ele pede (concluir um login, corrigir um dado) e tente de novo só depois.",
    parametros: s.objeto({
      servidor: s.texto({ descricao: "Nome do conector." }),
      tool: s.texto({ descricao: "Nome da ferramenta, como mcp_buscar_tools devolveu." }),
      "argumentos?": s.livre({ descricao: "Parâmetros da ferramenta, no formato que o esquema dela pede." }),
    }),
    efeito: "externo",
    rotulo: (a) => `${String(a.servidor)}: ${String(a.tool)}`,
    executar: async (a, ctx: ContextoTool) => {
      const todos = o.conectores();
      const achado = acharConector(todos, String(a.servidor));
      // Cada gravação parte da anterior: consentimento e "permitir sempre"
      // dados na mesma chamada não podem se sobrescrever.
      let c = achado as Conector;
      const guardar = async (mudanca: Partial<Conector>) => {
        c = { ...c, ...mudanca };
        await o.guardar(c);
      };
      if (!achado) return erro(`Não há conector "${String(a.servidor)}". Disponíveis: ${todos.map((x) => x.nome).join(", ") || "nenhum"}.`);
      if (!c.ativo) return erro(`O conector "${c.nome}" está desligado nas configurações.`);
      const t = acharTool(c, String(a.tool));
      if (!t) return erro(`O conector "${c.nome}" não tem a ferramenta "${String(a.tool)}". Use mcp_buscar_tools.`);

      const permissao = permissaoDe(c, t.nome);
      if (permissao === "bloqueado") return erro("O usuário não autorizou esta ferramenta.");

      // Sem a permissão de host o fetch falha sem dizer por quê (conector que
      // veio de outro computador pela sincronização, permissão revogada), e
      // pedi-la exige um clique do usuário: aqui só dá para apontar o caminho.
      const endereco = conferirEndereco(c.url);
      if (!endereco.ok) return erro(endereco.motivo);
      if (!(await (o.autorizado ?? origemAutorizada)(endereco.permissao))) {
        return erro(`O navegador ainda não tem autorização para acessar o endereço do conector "${c.nome}". Peça ao usuário para abrir a configuração do agente, em Conectores, e clicar em "Testar conexão" nesse conector.`);
      }

      // Dados pessoais: o motor reidrata os argumentos antes de executar, para
      // que a escrita no SEI leve o valor real. O que sai para um terceiro
      // tem de voltar a ser rótulo.
      const brutos = (a.argumentos ?? {}) as Record<string, unknown>;
      const local = enderecoLocal(c.url);

      // Documento baixado pelo agente que este conector recebe EM BYTES (o
      // esquema tem um campo de conteúdo): é assim que chega a um servidor em
      // outro computador, que não lê o disco do usuário. Desenho do patch de
      // Tavares (mvforce/mcp_arrendamento, integracoes/sei-pro).
      const campo = campoDeConteudo(t);
      if (campo && brutos[campo] !== undefined) return erro("Não informe bytes nem base64 na conversa: o SEI Pro envia sozinho o conteúdo do documento baixado.");
      const alvo = campo ? arquivoBaixadoEm(brutos, o.baixados?.() ?? [], ctx.anonimizar) : undefined;
      if (campo && !local) {
        if (!alvo && Object.values(brutos).some(pareceCaminho)) {
          return erro(`O conector "${c.nome}" roda em outro computador e não lê o disco do usuário. Baixe o documento com documento_baixar e passe o caminho devolvido: o SEI Pro envia o conteúdo.`);
        }
        if (alvo && !alvo.baixado.sha256) return erro("Este download é de uma versão anterior, sem a conferência de conteúdo. Chame documento_baixar de novo para o mesmo documento.");
      }
      // No servidor local, download antigo (sem hash) segue pelo caminho, como antes.
      const transferencia = alvo?.baixado.sha256 ? alvo : undefined;
      const campoNome = transferencia && "nome_arquivo" in propriedadesDe(t) ? "nome_arquivo" : undefined;
      if (transferencia && campoNome && brutos[campoNome] !== undefined) {
        const dado = String(brutos[campoNome]);
        // O modelo leu o nome mascarado e o motor o reidratou: as duas formas valem.
        if (dado !== transferencia.baixado.nome && ctx.anonimizar(dado) !== ctx.anonimizar(transferencia.baixado.nome)) {
          return erro(`Use o nome aprovado no download ("${ctx.anonimizar(transferencia.baixado.nome)}"), ou omita nome_arquivo. Para outro nome, chame documento_baixar de novo com o nome desejado.`);
        }
      }

      let args: Record<string, unknown>;
      try {
        // Caminho real só para quem o usa: o conector da própria máquina, que
        // abre o arquivo. Para os demais, o título do documento no caminho
        // levaria nome e CPF a um terceiro. Na transferência o caminho nem vai
        // (o campo é esvaziado abaixo), então não há o que proteger.
        const protegido = protegerArquivos(brutos, local ? (o.arquivos?.() ?? []) : [], ctx.anonimizar);
        args = protegido.recolocar(JSON.parse(ctx.anonimizar(JSON.stringify(protegido.args))) as Record<string, unknown>);
      } catch {
        // Nada sai do navegador sem passar pelo mascaramento: se ele falhou,
        // a chamada não acontece.
        return erro("Não foi possível mascarar os dados pessoais destes argumentos, então nada foi enviado. Simplifique os parâmetros e tente de novo.");
      }
      if (transferencia) {
        // O servidor não abre caminho do Windows; o nome é o aprovado no download.
        args[transferencia.chave] = "";
        if (campoNome) args[campoNome] = transferencia.baixado.nome;
      }

      // Primeira vez neste conector: o usuário precisa saber que o conteúdo sai.
      if (!c.consentido) {
        const ok = await ctx.consentirConector(
          `O conector "${c.nome}" (${c.url}) vai receber o conteúdo deste pedido. Ele é um serviço de terceiro, fora do SEI e fora do SEI Pro.`,
        );
        if (!ok) return erro("O usuário não autorizou enviar dados a este conector.");
        await guardar({ consentido: true });
      }

      if (transferencia) {
        // Sempre perguntado, mesmo com "permitir sempre" na ferramenta: sai o
        // documento inteiro, com os dados reais. Sem cartão, não sai.
        if (!ctx.ui.aprovarTransferencia) return erro("Enviar documento a um conector exige a aprovação do usuário na conversa principal.");
        const b = transferencia.baixado;
        const ok = await ctx.ui.aprovarTransferencia({ conector: c.nome, endereco: c.url, tool: t.nome, documento: b.documento, processo: b.processo, nome: b.nome, tamanho: b.tamanho, sha256: b.sha256 as string, argumentos: { ...args } });
        if (!ok) return erro("O usuário não autorizou esta chamada.");
      } else if (permissao === "aprovar") {
        const decisao = await ctx.ui.aprovarExterno?.({ conector: c.nome, tool: t.nome, descricao: t.descricao, argumentos: args });
        if (!decisao?.permitido) return erro("O usuário não autorizou esta chamada.");
        if (decisao.sempre) await guardar({ permissoes: { ...c.permissoes, [t.nome]: "sempre" } });
      }

      // Só depois da aprovação: relê do SEI e confere a identidade e o hash da
      // cópia aprovada. Os bytes vão só no objeto de transporte.
      let envio = args;
      let conteudo = "";
      if (transferencia && campo) {
        conteudo = await conteudoDoBaixado(transferencia.baixado, ctx);
        envio = { ...args, [campo]: conteudo };
      }
      const semBytes = (texto: string) => (conteudo ? texto.split(conteudo).join("[conteúdo do arquivo omitido]") : texto);

      // Cliente novo a cada chamada: a sessão não atravessa chamadas, então
      // servidor reiniciado entre uma e outra não deixa sessão velha para trás.
      const cliente = fabricar(c);
      let texto: string;
      try {
        await cliente.iniciar(ctx.sinal);
        texto = await cliente.chamar(t.nome, envio, ctx.sinal, conteudo ? PRAZO_TRANSFERENCIA : undefined);
      } catch (e) {
        // Erro que ecoasse o pedido não pode levar os bytes ao modelo.
        if (conteudo && e instanceof Error && e.message.includes(conteudo)) e.message = semBytes(e.message);
        // Só o servidor que não atendeu muda o estado do conector. Erro que a
        // FERRAMENTA devolveu (login pendente, validação) segue como veio: o
        // conector está bom e continua ligado.
        if (e instanceof ErroMcp && e.codigo === "desligado") await guardar({ semResposta: true, erro: e.message });
        throw e;
      }
      if (c.semResposta) await guardar({ semResposta: undefined, erro: undefined });
      return semBytes(texto) || "(o servidor respondeu sem conteúdo)";
    },
  });

  return [buscar, chamar];
}
