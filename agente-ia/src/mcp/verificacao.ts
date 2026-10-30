/**
 * Teste de conexão de um conector: conversa com o servidor, guarda o catálogo
 * e registra o estado (conectado, sem resposta, com erro).
 *
 * Fora da tela porque dois lugares precisam dele: o botão "Testar" e o
 * reteste que o painel faz ao abrir, para o servidor da própria máquina — que
 * o usuário liga e desliga, e cujo estado de ontem não diz nada sobre hoje.
 */

import { ClienteMcp, ErroMcp, enderecoLocal } from "./cliente";
import { conferirEndereco, destinoDe, MAX_TOOLS, type Conector } from "./conectores";

export interface OpcoesVerificacao {
  /** Trocável nos testes. */
  cliente?(c: Conector): ClienteMcp;
  /** O navegador já tem a permissão de host? Recebe o padrão ("http://127.0.0.1/*"). */
  autorizado?(permissao: string): Promise<boolean>;
  agora?(): number;
}

/**
 * Consulta, sem pedir: `chrome.permissions.request` exige gesto do usuário, e
 * isto roda também no carregamento do painel e no meio da conversa.
 */
export async function origemAutorizada(permissao: string): Promise<boolean> {
  if (typeof chrome === "undefined" || !chrome.permissions?.contains) return true;
  try {
    return await chrome.permissions.contains({ origins: [permissao] });
  } catch {
    return false;
  }
}

export async function verificarConector(c: Conector, o: OpcoesVerificacao = {}): Promise<Conector> {
  const agora = o.agora ?? Date.now;
  const endereco = conferirEndereco(c.url);
  if (!endereco.ok) return { ...c, erro: endereco.motivo, semResposta: undefined };
  if (!(await (o.autorizado ?? origemAutorizada)(endereco.permissao))) {
    return { ...c, erro: "Falta autorizar o acesso a este endereço.", semResposta: undefined };
  }
  const cliente = o.cliente ? o.cliente(c) : new ClienteMcp(destinoDe(c));
  const sinal = new AbortController().signal;
  try {
    const servidor = await cliente.iniciar(sinal);
    const tools = (await cliente.listarTools(sinal)).slice(0, MAX_TOOLS);
    return { ...c, tools, servidor, verificadoEm: agora(), erro: undefined, semResposta: undefined };
  } catch (e) {
    const desligado = e instanceof ErroMcp && e.codigo === "desligado";
    return { ...c, erro: (e as Error).message, verificadoEm: agora(), semResposta: desligado ? true : undefined };
  }
}

/**
 * Reteste de abertura do painel: só os conectores LOCAIS e ligados.
 *
 * Os de fora ficam como estavam — abrir o painel não deve gerar tráfego para
 * serviço de terceiro sem o usuário ter pedido nada.
 */
export async function retestarLocais(lista: Conector[], o: OpcoesVerificacao = {}): Promise<Conector[]> {
  return Promise.all(lista.map((c) => (c.ativo && enderecoLocal(c.url) ? verificarConector(c, o) : c)));
}
