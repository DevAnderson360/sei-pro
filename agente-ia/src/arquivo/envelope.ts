/**
 * Núcleo da sincronia do Agente por arquivo `.json`: o envelope, o diário e a
 * mescla. Tudo puro — sem `chrome`, sem IndexedDB e sem relógio (o tempo vem
 * de `agora`) —, para a camada de leitura e gravação ficar fina e os testes
 * rodarem no Node.
 *
 * O arquivo é a cópia completa do Agente, ao contrário do espelho do
 * `storage.sync` (ver `espelho.ts`): vai o registro inteiro, com o texto das
 * skills, o histórico das rotinas e as conversas. Só os segredos ficam de fora
 * dos registros; quando a pessoa marca a opção, vão numa seção à parte
 * (`segredos`), que dá para remover sem mexer no resto.
 *
 * Como dois computadores escrevem no mesmo arquivo sem se atropelar:
 * - cada registro leva um carimbo `em` (quando mudou pela última vez);
 * - o carimbo vem do DIÁRIO, guardado neste computador: ele lembra o hash de
 *   cada registro como foi ao arquivo, e um hash diferente é uma edição daqui;
 * - um id que estava no diário e sumiu daqui é uma exclusão, e vira LÁPIDE
 *   (registro sem dado, com a data da exclusão) — sem ela o arquivo devolveria
 *   o item apagado, e o espelho o subiria de novo ao `storage.sync`;
 * - na mescla, vence o carimbo maior, contando a lápide como versão; no
 *   empate, fica o daqui.
 *
 * A poda das conversas por idade (`config.dias`) é DESTE computador: não gera
 * lápide e não propaga, e o arquivo continua com as conversas que outro
 * computador guarda por mais tempo.
 */

import type { Conector, Permissao } from "../mcp/conectores";
import type { ColecaoFluxos } from "../fluxos/colecao";
import type { Fluxo, Ignorados } from "../fluxos/modelo";
import { configDoSync, configParaSync } from "../painel/espelho";
import type { ConversaSalva } from "../painel/historico";
import type { Config } from "../painel/main";
import type { Lembranca } from "../painel/memoria";
import type { Regra } from "../painel/regras";
import type { Rotina } from "../painel/rotinas";
import type { ColecaoSkills, SkillUsuario } from "../painel/skills";

export const FORMATO = "seipro-agente";
export const VERSAO = 1;

export type TipoLista = "skills" | "colecoes" | "regras" | "memoria" | "rotinas" | "conectores" | "fluxos" | "colecoesFluxos" | "conversas";

/** A ordem dos tipos no arquivo (e na assinatura). */
export const TIPOS: TipoLista[] = ["skills", "colecoes", "regras", "memoria", "rotinas", "conectores", "fluxos", "colecoesFluxos", "conversas"];

export interface Registro {
  id: string;
  em: number;
  apagado?: true;
  dado?: unknown;
}

export interface Unico<T> {
  em: number;
  dado: T;
}

export interface Segredos {
  em: number;
  chave?: string;
  tokens?: Record<string, string>;
}

export interface EnvelopeAgente {
  formato: typeof FORMATO;
  versao: number;
  geradoEm: number;
  config?: Unico<Omit<Config, "chave">>;
  ignorados?: Unico<Ignorados>;
  registros: Record<TipoLista, Registro[]>;
  segredos?: Segredos;
}

/** Carimbo local por registro: `h` = hash do dado como vai ao arquivo. */
export interface Marca {
  em: number;
  h: string;
  apagado?: true;
  /**
   * Só em conversas: o `quando` da conversa. A poda do histórico apaga pela
   * idade da CONVERSA, não pela data em que ela mudou neste diário — e é por
   * aqui que `carimbar` reconhece a poda e não deixa lápide.
   */
  q?: number;
}

/** Tipo (`config`, `ignorados`, `segredos` ou um `TipoLista`) → id → marca. */
export type Diario = Record<string, Record<string, Marca>>;

export interface Retrato {
  config: Config;
  ignorados: Ignorados;
  listas: {
    skills: SkillUsuario[];
    colecoes: ColecaoSkills[];
    regras: Regra[];
    memoria: Lembranca[];
    rotinas: Rotina[];
    conectores: Conector[];
    fluxos: Fluxo[];
    colecoesFluxos: ColecaoFluxos[];
    conversas: ConversaSalva[];
  };
}

export interface OpcoesMescla {
  agora: number;
  /** A caixa "Incluir chave de API e tokens", que é deste computador. */
  segredos: boolean;
  /** O botão "Remover segredos do arquivo". */
  removerSegredos?: boolean;
  /**
   * O item que o registro do arquivo vira aqui, já normalizado, ou `null` se
   * não serve: aí não entra (nada é gravado, nada é apagado) e o registro
   * fica no arquivo como estava. Sem `validar`, o dado entra como veio.
   */
  validar?: (tipo: TipoLista, dado: unknown) => unknown | null;
  /**
   * Ids que existem no armazenamento daqui mas não passaram na validação
   * (ficaram fora do retrato): a ausência deles não é exclusão. A marca do
   * diário fica como estava e o registro do arquivo também.
   */
  preservar?: Partial<Record<TipoLista, string[]>>;
}

const DIA = 86_400_000;

/** Id da marca dos itens únicos no diário (`config`, `ignorados`). */
const UNICO = "_";

// ------------------------------------------------------------ o que vai ao arquivo

/** Remove as chaves de valor `undefined`, que o JSON não carrega (e o hash não pode ver). */
function limpo<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/**
 * O conector como vai ao arquivo: tudo, menos o segredo. O NOME do cabeçalho
 * vai; o valor do token vai à parte (`segredos.tokens`), só com a caixa
 * marcada. O token do OAuth não vai nunca: é renovado por fluxo próprio.
 */
function conectorParaArquivo(c: Conector): Conector {
  const auth =
    c.auth.tipo === "token"
      ? ({ tipo: "token", cabecalho: c.auth.cabecalho } as unknown as Conector["auth"])
      : c.auth.tipo === "oauth"
        ? limpo({ tipo: "oauth" as const, emissor: c.auth.emissor, cliente: c.auth.cliente })
        : c.auth;
  return limpo({ ...c, auth });
}

/** A origem (`esquema://host:porta`) do endereço, ou `null` se não for URL. */
function origem(url: unknown): string | null {
  try {
    return typeof url === "string" ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

const RIGOR: Record<Permissao, number> = { sempre: 0, aprovar: 1, bloqueado: 2 };

/** A mais restritiva das duas (bloqueado > aprovar > sempre); valor desconhecido conta como "aprovar". */
function maisRestrita(a: Permissao, b: Permissao): Permissao {
  const pa: Permissao = a in RIGOR ? a : "aprovar";
  const pb: Permissao = b in RIGOR ? b : "aprovar";
  return RIGOR[pa] >= RIGOR[pb] ? pa : pb;
}

/** Os dois endereços são do mesmo servidor (URL inválida nunca é). */
function mesmaOrigem(a: unknown, b: unknown): boolean {
  const oa = origem(a);
  return oa !== null && oa === origem(b);
}

/**
 * Remonta o conector do arquivo com o segredo que já existe aqui.
 *
 * O arquivo mora numa pasta de nuvem que outra pessoa pode editar: um
 * registro adulterado que troque o endereço do conector levaria o token
 * daqui para outro servidor na próxima chamada. Então o segredo daqui só é
 * reaproveitado quando a ORIGEM do endereço não mudou; se mudou, o conector
 * chega sem segredo e o usuário digita de novo.
 *
 * O mesmo vale para o que o conector PODE FAZER: ligá-lo, consentir que dados
 * saiam para ele e liberar ferramentas sem pedir aprovação são decisões da
 * pessoa, neste computador. Conector novo aqui, ou de outro servidor, entra
 * DESLIGADO, sem consentimento e só com restrições (ferramenta bloqueada
 * continua bloqueada). Conector conhecido só pode ser desligado ou restringido
 * pelo arquivo, nunca ligado nem liberado (desligar propaga; ligar, não).
 */
function conectorDoArquivo(vindo: Conector, localQualquer: Conector | undefined): Conector {
  const local = localQualquer && mesmaOrigem(vindo.url, localQualquer.url) ? localQualquer : undefined;
  const auth: Conector["auth"] =
    vindo.auth?.tipo === "token"
      ? {
          tipo: "token",
          cabecalho: vindo.auth.cabecalho || "Authorization",
          // Token vazio fica como token vazio (e não "sem autenticação"): assim
          // o hash não muda e o conector não volta ao arquivo rebaixado.
          valor: local?.auth.tipo === "token" ? local.auth.valor : "",
        }
      : vindo.auth?.tipo === "oauth"
        ? local?.auth.tipo === "oauth"
          ? limpo({ ...vindo.auth, token: local.auth.token, refresh: local.auth.refresh, expiraEm: local.auth.expiraEm })
          : limpo({ ...vindo.auth, token: undefined, refresh: undefined, expiraEm: undefined })
        : { tipo: "nenhuma" };
  const permissoesDeLa = vindo.permissoes ?? {};
  if (!local) {
    const bloqueadas = Object.entries(permissoesDeLa).filter(([, p]) => p === "bloqueado");
    return limpo({
      ...vindo,
      auth,
      ativo: false,
      consentido: false,
      padrao: vindo.padrao === "bloqueado" ? "bloqueado" : "aprovar",
      permissoes: Object.fromEntries(bloqueadas),
    });
  }
  const permissoesDaqui = local.permissoes ?? {};
  const permissoes: Record<string, Permissao> = {};
  for (const k of new Set([...Object.keys(permissoesDeLa), ...Object.keys(permissoesDaqui)])) {
    permissoes[k] = maisRestrita(permissoesDeLa[k] ?? vindo.padrao, permissoesDaqui[k] ?? local.padrao);
  }
  return limpo({
    ...vindo,
    auth,
    ativo: Boolean(local.ativo && vindo.ativo),
    consentido: local.consentido,
    padrao: maisRestrita(vindo.padrao, local.padrao),
    permissoes,
  });
}

/**
 * Estado DESTE computador, que não é configuração: quando a skill ou a
 * coleção foi conferida na origem (e o `etag` de lá, e a falha), quando o
 * conector respondeu (e o erro, e o "sem resposta" do servidor local). Não
 * vai ao arquivo nem entra no hash — senão cada conferência seria uma edição
 * e os dois computadores trocariam o estado um do outro —, e na entrada fica
 * o valor daqui.
 */
const DA_MAQUINA: Partial<Record<TipoLista, readonly string[]>> = {
  skills: ["verificadaEm", "etag", "erroSync"],
  colecoes: ["verificadaEm", "erroSync"],
  colecoesFluxos: ["verificadaEm", "erroSync"],
  conectores: ["erro", "semResposta", "verificadoEm"],
};

function semDaMaquina(tipo: TipoLista, item: unknown): unknown {
  const campos = DA_MAQUINA[tipo];
  if (!campos || typeof item !== "object" || item === null) return item;
  const copia = { ...(item as Record<string, unknown>) };
  for (const c of campos) delete copia[c];
  return copia;
}

/** O dado do arquivo com o estado deste computador (o do `local`, se houver). */
function comDaMaquina(tipo: TipoLista, dado: unknown, local: unknown): unknown {
  const campos = DA_MAQUINA[tipo];
  const limpoDeLa = semDaMaquina(tipo, dado);
  if (!campos || typeof local !== "object" || local === null || typeof limpoDeLa !== "object" || limpoDeLa === null) return limpoDeLa;
  const daqui = local as Record<string, unknown>;
  const r = limpoDeLa as Record<string, unknown>;
  for (const c of campos) if (daqui[c] !== undefined) r[c] = daqui[c];
  return r;
}

/** O dado do registro como vai ao arquivo. */
function paraArquivo(tipo: TipoLista, item: unknown): unknown {
  const sem = semDaMaquina(tipo, item);
  return tipo === "conectores" ? conectorParaArquivo(sem as Conector) : sem;
}

/** O item que o retrato passa a ter, a partir do dado do arquivo. */
function doArquivo(tipo: TipoLista, dadoDeLa: unknown, local: unknown): unknown {
  const dado = comDaMaquina(tipo, dadoDeLa, local);
  if (tipo === "conectores") return conectorDoArquivo(dado as Conector, local as Conector | undefined);
  if (tipo === "rotinas") return rotinaDoArquivo(dado as Rotina, local as Rotina | undefined);
  return dado;
}

/**
 * Rotina autônoma altera o SEI sozinha: quem a liga é a pessoa, neste
 * computador. A que chega do arquivo nova aqui, ou que passa a ser autônoma,
 * ou que ganha ferramenta autorizada que a daqui não tinha, entra DESLIGADA.
 * Sem ampliar nada, só fica ligada se estiver ligada aqui e lá (desligar
 * propaga; ligar, não).
 */
function rotinaDoArquivo(vinda: Rotina, local: Rotina | undefined): Rotina {
  if (vinda.alcance !== "autonoma") return vinda;
  const daqui = local?.alcance === "autonoma" ? new Set(local.autorizadas ?? []) : null;
  const amplia = daqui === null || (vinda.autorizadas ?? []).some((t) => !daqui.has(t));
  return { ...vinda, ativa: amplia ? false : Boolean(local?.ativa && vinda.ativa) };
}

const hash = (dado: unknown): string => JSON.stringify(dado);

/**
 * Resumo (FNV-1a de 32 bits) para a marca dos segredos no diário: o diário
 * guarda o hash de cada registro como texto, e o dos segredos não pode ser o
 * próprio segredo. Basta para saber se mudou; não serve para recuperá-lo.
 */
function resumoDoSegredo(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a:${h.toString(16)}:${texto.length}`;
}

const idDe = (item: unknown): string => (item as { id: string }).id;

// ------------------------------------------------------------ o diário

/** Quem não está guardando conversas não carimba nem exporta as suas. */
const guardaConversas = (c: Config): boolean => Boolean(c.guardar);

/** Abaixo deste carimbo, a conversa já passou do prazo deste computador. */
function limiteDaPoda(c: Config, agora: number): number | null {
  return c.dias > 0 ? agora - c.dias * DIA : null;
}

/**
 * Uma lista contra o diário: hash diferente carimba; id que sumiu vira lápide.
 *
 * Registro visto pela PRIMEIRA vez (sem marca no diário) não ganha `agora`,
 * ganha `primeiraVista` — por padrão 0, "sem data conhecida". Sem isso, um
 * item que acabou de chegar pelo `storage.sync` (skill sem o texto, rotina sem
 * o histórico) venceria a versão completa do arquivo só por ter sido visto
 * agora, e o outro computador perderia o que só ele tinha. Só uma mudança de
 * hash DEPOIS da primeira vista é edição daqui.
 */
function carimbarLista(
  itens: Array<[string, unknown, number, number?]>,
  marcas: Record<string, Marca> | undefined,
  agora: number,
  podaAntesDe: number | null,
  preservar: readonly string[] = [],
): Record<string, Marca> {
  const novo: Record<string, Marca> = {};
  // O que está aqui mas ficou fora do retrato (inválido) não é exclusão.
  const presentes = new Set<string>(preservar);
  for (const id of preservar) if (marcas?.[id]) novo[id] = marcas[id];
  for (const [id, dado, primeiraVista, q] of itens) {
    presentes.add(id);
    const h = hash(dado);
    const antes = marcas?.[id];
    const comQ = (m: Marca): Marca => (q === undefined ? m : { ...m, q });
    novo[id] = comQ(!antes ? { em: primeiraVista, h } : !antes.apagado && antes.h === h ? antes : { em: agora, h });
  }
  for (const [id, marca] of Object.entries(marcas ?? {})) {
    if (presentes.has(id)) continue;
    // Poda local: a marca velha sai do diário sem deixar lápide.
    // Poda local: a idade é a da conversa (`q`) quando conhecida, a mesma
    // regra de `podar` no histórico; sem `q`, a do carimbo.
    if (podaAntesDe !== null && (marca.q ?? marca.em) < podaAntesDe) continue;
    novo[id] = marca.apagado ? marca : limpo({ em: agora, h: "", apagado: true as const, q: marca.q });
  }
  return novo;
}

/**
 * O diário atualizado contra o retrato. Idempotente: carimbar o mesmo retrato
 * de novo, mais tarde, não muda nenhum carimbo.
 */
export function carimbar(r: Retrato, d: Diario, agora: number, preservar: Partial<Record<TipoLista, string[]>> = {}): Diario {
  const novo: Diario = { ...d };
  novo.config = carimbarLista([[UNICO, configParaSync(r.config), 0]], d.config, agora, null);
  novo.ignorados = carimbarLista([[UNICO, r.ignorados, 0]], d.ignorados, agora, null);
  for (const tipo of TIPOS) {
    if (tipo === "conversas") {
      // Sem guardar conversas, nada delas entra no diário (nem lápide).
      if (!guardaConversas(r.config)) continue;
      novo.conversas = carimbarLista(
        // A conversa tem data conhecida (`quando`, a última atualização): é ela
        // a primeira vista. Com 0, a marca de toda conversa nunca editada
        // ficaria abaixo do prazo da poda, e apagar a conversa não deixaria
        // lápide — o arquivo a devolveria na leitura seguinte.
        r.listas.conversas.map((c) => {
          const quando = typeof c.quando === "number" ? c.quando : undefined;
          return [c.id, c, quando ?? 0, quando];
        }),
        d.conversas,
        agora,
        limiteDaPoda(r.config, agora),
        preservar.conversas,
      );
      continue;
    }
    const lista = r.listas[tipo] as unknown[];
    novo[tipo] = carimbarLista(
      lista.map((item) => [idDe(item), paraArquivo(tipo, item), 0]),
      d[tipo],
      agora,
      null,
      preservar[tipo],
    );
  }
  return novo;
}

/**
 * O que o `storage.sync` trouxe NÃO é edição daqui: é a edição de outro
 * computador, que o arquivo também vai trazer (completa e com o carimbo de
 * lá). Sem isto, `carimbar` veria o hash novo e carimbaria `agora` — e o
 * recorte do sync (skill com a descrição nova e o texto velho, conector
 * rebaixado a "sem autenticação", rotina com o histórico daqui) venceria no
 * arquivo a versão completa que o outro computador gravou.
 *
 * Então, para cada item que mudou entre `antes` e `depois` (a lista antes e
 * depois de aplicar o sync), a marca do diário ganha o hash novo e MANTÉM o
 * carimbo. A versão do arquivo, com carimbo maior, continua vencendo; com o
 * mesmo carimbo, o arquivo fica com a dele (ver `mesmoCarimbo`).
 *
 * Só quando o item de `antes` ainda batia com a marca: se não batia, havia
 * edição daqui por carimbar, e ela segue o caminho normal.
 */
export function absorverDoSync(d: Diario, tipo: TipoLista, antes: readonly unknown[], depois: readonly unknown[], validar?: OpcoesMescla["validar"]): Diario {
  const marcas = d[tipo];
  if (!marcas) return d;
  // O mesmo hash que `carimbar` calcula: do item normalizado, como vai ao arquivo.
  const hashDe = (item: unknown): string | null => {
    const v = validar ? validar(tipo, item) : item;
    return v === null || v === undefined ? null : hash(paraArquivo(tipo, v));
  };
  const velhos = new Map(antes.map((i) => [idDe(i), i]));
  let novas: Record<string, Marca> | null = null;
  for (const item of depois) {
    const id = idDe(item);
    const marca = marcas[id];
    const velho = velhos.get(id);
    if (!marca || marca.apagado || velho === undefined || hashDe(velho) !== marca.h) continue;
    const h = hashDe(item);
    if (h === null || h === marca.h) continue;
    (novas ??= { ...marcas })[id] = { ...marca, h };
  }
  return novas ? { ...d, [tipo]: novas } : d;
}

// ------------------------------------------------------------ a mescla

interface ResultadoLista {
  itens: unknown[];
  marcas: Record<string, Marca>;
  registros: Registro[];
  /** Ids cuja versão do arquivo venceu (a marca é refeita do item final). */
  vindos: Map<string, number>;
}

/**
 * O arquivo vence quando o carimbo dele é maior. No empate fica o daqui, com
 * uma exceção: os dois em 0 ("sem data conhecida", ver `carimbarLista`) —
 * aí vence o arquivo, que é a cópia completa; o daqui pode ser só o recorte
 * que o `storage.sync` trouxe.
 */
function venceOArquivo(emArquivo: number, marca: Marca | undefined): boolean {
  return marca === undefined || emArquivo > marca.em || (emArquivo === 0 && marca.em === 0);
}

/**
 * Uma lista contra o arquivo, por id: vence o carimbo maior (`venceOArquivo`). A ORDEM é a de
 * cá; o que só existe no arquivo entra no fim, na ordem de lá.
 */
function mesclarLista(
  tipo: TipoLista,
  locais: unknown[],
  marcas: Record<string, Marca>,
  lidos: Registro[],
  aceitar: (r: Registro) => boolean,
  validar: OpcoesMescla["validar"],
  preservados: ReadonlySet<string>,
): ResultadoLista {
  const doArq = new Map(lidos.map((r) => [r.id, r]));
  const locaisPorId = new Map(locais.map((item) => [idDe(item), item]));
  const ids = [...new Set([...locais.map(idDe), ...Object.keys(marcas), ...lidos.map((r) => r.id)])];
  const itens: unknown[] = [];
  const novasMarcas: Record<string, Marca> = { ...marcas };
  const registros: Registro[] = [];
  const vindos = new Map<string, number>();
  for (const id of ids) {
    const local = locaisPorId.get(id);
    const marca = marcas[id];
    const reg = doArq.get(id);
    const venceArquivo = reg !== undefined && venceOArquivo(reg.em, marca);
    if (venceArquivo) {
      registros.push(reg);
      const dado = reg.apagado || !validar ? reg.dado : validar(tipo, reg.dado);
      // O id de dentro do dado tem de ser o do registro: senão um registro
      // "r1" adulterado sobrescreveria (ou criaria) outro item.
      const recusado = !reg.apagado && (dado === null || (validar !== undefined && idDe(dado) !== id));
      if (!aceitar(reg) || recusado) {
        // Fica no arquivo, mas não entra aqui: conversa fora do prazo daqui,
        // ou registro que não passa na validação (nada gravado, nada apagado).
        if (local !== undefined) itens.push(local);
        continue;
      }
      if (reg.apagado) {
        novasMarcas[id] = { em: reg.em, h: "", apagado: true };
      } else {
        itens.push(doArquivo(tipo, dado, local));
        vindos.set(id, reg.em);
      }
      continue;
    }
    if (local !== undefined) {
      itens.push(local);
      // Mesmo carimbo dos dois lados = o daqui não mudou desde que veio deste
      // registro; a diferença é só o que a entrada ajusta aqui (rotina
      // autônoma desligada, normalização). O arquivo fica com o dele: senão
      // cada computador regravaria a sua versão com o mesmo carimbo, em laço.
      const mesmoCarimbo = reg !== undefined && !reg.apagado && marca !== undefined && reg.em === marca.em && reg.em !== 0;
      registros.push(mesmoCarimbo ? reg : { id, em: marca?.em ?? 0, dado: paraArquivo(tipo, local) });
    } else if (marca?.apagado) {
      registros.push({ id, em: marca.em, apagado: true });
    } else if (reg !== undefined && preservados.has(id)) {
      // Existe aqui mas ficou fora do retrato (inválido): o arquivo segue com o dele.
      registros.push(reg);
    }
  }
  return { itens, marcas: novasMarcas, registros, vindos };
}

/**
 * A config do arquivo aplicada à daqui. Além do que `configDoSync` já faz
 * (serviço diferente com chave aqui preserva serviço, endereço e modelos), o
 * ENDEREÇO diferente também preserva: um arquivo adulterado que troque só a
 * `url` do serviço compatível mandaria a chave daqui para outro servidor.
 */
function configDoArquivo(bruto: Record<string, unknown>, local: Config): Config {
  const junta = configDoSync(bruto, local);
  const vindo = bruto as Partial<Config>;
  const outroServico = vindo.servico !== undefined && vindo.servico !== local.servico;
  const outraUrl = vindo.url !== undefined && vindo.url !== local.url;
  if (!local.chave || !(outroServico || outraUrl)) return junta;
  return { ...junta, servico: local.servico, url: local.url, modelo: local.modelo, modeloAuxiliar: local.modeloAuxiliar };
}

/**
 * Carimbo do arquivo no futuro vale `agora`: senão um registro adulterado (ou
 * de um relógio adiantado) com `em` enorme venceria para sempre toda edição
 * daqui.
 */
function semFuturo(e: EnvelopeAgente, agora: number): EnvelopeAgente {
  const teto = (em: number): number => Math.min(em, agora);
  const registros = {} as Record<TipoLista, Registro[]>;
  for (const tipo of TIPOS) registros[tipo] = (e.registros[tipo] ?? []).map((r) => (r.em > agora ? { ...r, em: agora } : r));
  return limpo({
    ...e,
    config: e.config && { ...e.config, em: teto(e.config.em) },
    ignorados: e.ignorados && { ...e.ignorados, em: teto(e.ignorados.em) },
    segredos: e.segredos && { ...e.segredos, em: teto(e.segredos.em) },
    registros,
  });
}

/** Os tokens dos conectores deste computador, por id. */
function tokensDaqui(conectores: Conector[]): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const c of conectores) if (c.auth.tipo === "token" && c.auth.valor) tokens[c.id] = c.auth.valor;
  return tokens;
}

/**
 * Lê o arquivo e mescla com o que está aqui; devolve o que o local passa a
 * ter, o diário novo e o envelope que vai ao arquivo. Nunca apaga daqui o que
 * o arquivo não tem: só uma lápide mais nova que a versão daqui apaga.
 */
export function mesclar(
  local: Retrato,
  d: Diario,
  lido: EnvelopeAgente | null,
  o: OpcoesMescla,
): { retrato: Retrato; diario: Diario; envelope: EnvelopeAgente; mudouLocal: boolean } {
  const { agora } = o;
  lido = lido && semFuturo(lido, agora);
  const carimbado = carimbar(local, d, agora, o.preservar);
  const diario: Diario = { ...carimbado };
  const registros = {} as Record<TipoLista, Registro[]>;
  const listas = { ...local.listas } as Record<TipoLista, unknown[]>;
  const vindosPorTipo = new Map<TipoLista, Map<string, number>>();

  // -- config e ignorados: um item só, mesma regra das listas.
  const marcaConfig = carimbado.config[UNICO];
  const configVence = lido?.config !== undefined && venceOArquivo(lido.config.em, marcaConfig);
  let config = configVence ? configDoArquivo(lido!.config!.dado as unknown as Record<string, unknown>, local.config) : local.config;
  // Mesmo carimbo dos dois lados (a mesma regra de `mesclarLista`): a config
  // daqui não mudou desde que veio do arquivo, e a diferença é só o que a
  // entrada preserva aqui (serviço e endereço com a chave deste computador).
  // O arquivo fica com a dele; senão dois computadores com serviços
  // diferentes regravariam o arquivo a cada rodada.
  const mesmoCarimboConfig = lido?.config !== undefined && lido.config.em === marcaConfig.em && marcaConfig.em !== 0;
  const envConfig: Unico<Omit<Config, "chave">> =
    configVence || mesmoCarimboConfig ? lido!.config! : { em: marcaConfig.em, dado: configParaSync(local.config) };

  const marcaIgn = carimbado.ignorados[UNICO];
  const ignVence = lido?.ignorados !== undefined && venceOArquivo(lido.ignorados.em, marcaIgn);
  const ignorados = ignVence ? lido!.ignorados!.dado : local.ignorados;
  const envIgnorados: Unico<Ignorados> = ignVence ? lido!.ignorados! : { em: marcaIgn.em, dado: local.ignorados };
  if (ignVence) diario.ignorados = { [UNICO]: { em: lido!.ignorados!.em, h: hash(ignorados) } };

  // -- as listas
  const limite = limiteDaPoda(local.config, agora);
  for (const tipo of TIPOS) {
    const lidos = lido?.registros[tipo] ?? [];
    if (tipo === "conversas" && !guardaConversas(local.config)) {
      // Não importa nem exporta as daqui: o arquivo segue com as dos outros.
      registros.conversas = lidos;
      continue;
    }
    const aceitar =
      tipo === "conversas" && limite !== null
        ? (r: Registro) => r.apagado === true || ((r.dado as Partial<ConversaSalva> | undefined)?.quando ?? 0) >= limite
        : () => true;
    const res = mesclarLista(tipo, local.listas[tipo] as unknown[], carimbado[tipo] ?? {}, lidos, aceitar, o.validar, new Set(o.preservar?.[tipo] ?? []));
    listas[tipo] = res.itens;
    registros[tipo] = res.registros;
    diario[tipo] = res.marcas;
    vindosPorTipo.set(tipo, res.vindos);
  }

  // -- segredos: importar só com a caixa marcada, e só onde falta aqui.
  const lidoSeg = lido?.segredos;
  if (o.segredos && lidoSeg) {
    if (!config.chave && lidoSeg.chave) config = { ...config, chave: lidoSeg.chave };
    const tokens = lidoSeg.tokens ?? {};
    const regsConector = new Map((lido?.registros.conectores ?? []).map((r) => [r.id, r]));
    listas.conectores = (listas.conectores as Conector[]).map((c) => {
      const token = tokens[c.id];
      // Só no conector do mesmo servidor do registro do arquivo: o token de lá
      // nunca vai para um endereço que o arquivo não indicou para ele.
      if (!token || !mesmaOrigem(c.url, (regsConector.get(c.id)?.dado as Partial<Conector> | undefined)?.url)) return c;
      if (c.auth.tipo === "token" && !c.auth.valor) return { ...c, auth: { ...c.auth, valor: token } };
      if (c.auth.tipo === "nenhuma") {
        // Chegou pelo `storage.sync` como "sem autenticação" (lá o token não
        // viaja): volta a token com o cabeçalho que o registro do arquivo tem.
        const auth = (regsConector.get(c.id)?.dado as Partial<Conector> | undefined)?.auth;
        const cabecalho = auth?.tipo === "token" && auth.cabecalho ? auth.cabecalho : "Authorization";
        return { ...c, auth: { tipo: "token", cabecalho, valor: token } };
      }
      return c;
    });
  }

  // A marca do que veio do arquivo é o carimbo de lá com o hash do item final
  // daqui: na próxima mescla, `carimbar` não o vê como edição.
  for (const [tipo, vindos] of vindosPorTipo) {
    for (const item of listas[tipo]) {
      const em = vindos.get(idDe(item));
      if (em === undefined) continue;
      const q = tipo === "conversas" ? (item as Partial<ConversaSalva>).quando : undefined;
      diario[tipo] = { ...diario[tipo], [idDe(item)]: limpo({ em, h: hash(paraArquivo(tipo, item)), q: typeof q === "number" ? q : undefined }) };
    }
  }
  if (configVence) diario.config = { [UNICO]: { em: lido!.config!.em, h: hash(configParaSync(config)) } };

  let segredos: Segredos | undefined;
  if (o.removerSegredos) {
    segredos = undefined;
    delete diario.segredos;
  } else if (o.segredos) {
    const tokens = tokensDaqui(listas.conectores as Conector[]);
    const conteudo = limpo({ chave: config.chave || undefined, tokens: Object.keys(tokens).length ? tokens : undefined });
    const h = resumoDoSegredo(hash(conteudo));
    // Segredos iguais mantêm o carimbo: senão o arquivo seria regravado a cada leitura.
    const iguais = lidoSeg !== undefined && hash(limpo({ chave: lidoSeg.chave, tokens: lidoSeg.tokens })) === hash(conteudo);
    // Os segredos daqui só substituem os do arquivo quando MUDARAM aqui desde
    // a última vez: dois computadores com a caixa marcada e chaves diferentes
    // (cada um com a sua) não regravam o arquivo a cada rodada.
    const mudouAqui = diario.segredos?.[UNICO]?.h !== h;
    segredos = lidoSeg !== undefined && !iguais && !mudouAqui ? lidoSeg : { em: iguais ? lidoSeg.em : agora, ...conteudo };
    diario.segredos = { [UNICO]: { em: segredos.em, h } };
  } else segredos = lidoSeg;

  const retrato: Retrato = { config, ignorados, listas: listas as unknown as Retrato["listas"] };
  const envelope: EnvelopeAgente = limpo({
    formato: FORMATO as typeof FORMATO,
    versao: VERSAO,
    geradoEm: agora,
    config: envConfig,
    ignorados: envIgnorados,
    registros,
    segredos,
  });
  return { retrato, diario, envelope, mudouLocal: hash(retrato) !== hash(local) };
}

// ------------------------------------------------------------ leitura e assinatura

const ehObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

function lerUnico<T>(x: unknown): Unico<T> | undefined {
  return ehObjeto(x) && typeof x.em === "number" && ehObjeto(x.dado) ? { em: x.em, dado: x.dado as T } : undefined;
}

function lerRegistro(x: unknown): Registro | null {
  if (!ehObjeto(x) || typeof x.id !== "string" || typeof x.em !== "number") return null;
  if (x.apagado === true) return { id: x.id, em: x.em, apagado: true };
  return x.dado === undefined ? null : { id: x.id, em: x.em, dado: x.dado };
}

function lerSegredos(x: unknown): Segredos | undefined {
  if (!ehObjeto(x) || typeof x.em !== "number") return undefined;
  const tokens = ehObjeto(x.tokens)
    ? Object.fromEntries(Object.entries(x.tokens).filter((e): e is [string, string] => typeof e[1] === "string"))
    : undefined;
  return limpo({ em: x.em, chave: typeof x.chave === "string" ? x.chave : undefined, tokens });
}

/**
 * O envelope do arquivo, ou `null` quando não é um arquivo do Agente (o dos
 * Favoritos, por exemplo). Registro malformado é descartado sem derrubar o
 * resto; tipo ausente vira lista vazia.
 */
export function lerEnvelope(bruto: unknown): EnvelopeAgente | null {
  if (!ehObjeto(bruto) || bruto.formato !== FORMATO || !ehObjeto(bruto.registros)) return null;
  const fonte = bruto.registros;
  const registros = {} as Record<TipoLista, Registro[]>;
  for (const tipo of TIPOS) {
    const lista = Array.isArray(fonte[tipo]) ? (fonte[tipo] as unknown[]) : [];
    registros[tipo] = lista.map(lerRegistro).filter((r): r is Registro => r !== null);
  }
  return limpo({
    formato: FORMATO as typeof FORMATO,
    versao: typeof bruto.versao === "number" ? bruto.versao : VERSAO,
    geradoEm: typeof bruto.geradoEm === "number" ? bruto.geradoEm : 0,
    config: lerUnico<Omit<Config, "chave">>(bruto.config),
    ignorados: lerUnico<Ignorados>(bruto.ignorados),
    registros,
    segredos: lerSegredos(bruto.segredos),
  });
}

/** O que identifica o conteúdo do arquivo: tudo menos a hora em que foi gerado. */
export function assinatura(e: EnvelopeAgente): string {
  const { geradoEm: _geradoEm, ...resto } = e;
  return JSON.stringify(resto);
}
