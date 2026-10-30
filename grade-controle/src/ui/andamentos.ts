/**
 * Dados do andamento na grade: o aviso antes de consultar, a coleta com progresso, o cache de 24 h e a faixa de
 * estado ("consultado há 3 h", Atualizar, Cancelar). A coleta só começa com o aval do usuário, nunca sozinha.
 */
import { h, icone } from '../../../sei-comum/src/ui/dom';
import { coletar, type DadosColeta, type ProgressoColeta } from '../andamentos/coletar';
import { type DadosAndamento, estaValido, VALIDADE_MS } from '../modelo/andamentos';
import type { AgruparPor, Processo } from '../modelo/tipos';
import type { Armazem } from '../persistencia/armazem';
import { abrirModalGrade } from './modal';

export const AGRUPAMENTOS_ANDAMENTO: readonly AgruparPor[] = ['autuacao', 'recebimento', 'envio', 'unidadeEnvio'];
export const ehAgrupamentoAndamento = (a: AgruparPor): boolean => AGRUPAMENTOS_ANDAMENTO.includes(a);

export interface DepsAndamentos {
  sombra: ShadowRoot;
  agora(): number;
  armazem: Pick<Armazem, 'lerAndamentos' | 'gravarAndamentos'>;
  consultar(p: Processo, sinal: AbortSignal): Promise<DadosColeta | null>;
  processos(): Processo[];
  /** Os dados mudaram: a grade se redesenha. */
  aoMudar(): void;
  aviso(texto: string): void;
  /** Para os testes. */
  simultaneas?: number;
  pausaMs?: number;
  esperar?(ms: number): Promise<void>;
  semDebounce?: boolean;
}

export function rotuloIdadeCache(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h24 = Math.floor(min / 60);
  return `há ${h24} h`;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function criarAndamentos(d: DepsAndamentos) {
  let dados: Record<string, DadosAndamento> = {};
  let coleta: { ctl: AbortController; progresso: ProgressoColeta } | null = null;
  let encerrado = false;
  let ativo = false;
  let redesenhoTimer: ReturnType<typeof setTimeout> | undefined;
  const faixa = h('div', { class: 'spro-andamento', hidden: true, role: 'status', 'aria-live': 'polite' });

  const elegiveis = (): Processo[] => d.processos().filter((p) => !!p.link && !p.sigiloso && !p.naoVisualizado);
  const validos = (): DadosAndamento[] => Object.values(dados).filter((v) => estaValido(v, d.agora()));
  const faltantes = (): Processo[] => elegiveis().filter((p) => !dados[p.id] || !estaValido(dados[p.id]!, d.agora()));
  const exclusoes = () => {
    const todos = d.processos();
    return { naoVistos: todos.filter((p) => p.naoVisualizado && !p.sigiloso).length, sigilosos: todos.filter((p) => p.sigiloso).length, semLink: todos.filter((p) => !p.link && !p.sigiloso && !p.naoVisualizado).length };
  };

  async function carregar(): Promise<void> {
    try { dados = await d.armazem.lerAndamentos(d.agora()); } catch { dados = {}; }
    d.aoMudar();
  }

  function pedirConfirmacao(alvos: number, jaTem: number): Promise<boolean> {
    return new Promise((resolve) => {
      let confirmado = false;
      const ex = exclusoes();
      const itens: string[] = [];
      if (ex.naoVistos) itens.push(`${plural(ex.naoVistos, 'processo ainda não visualizado', 'processos ainda não visualizados')} nesta unidade (abrir o andamento o marcaria como visualizado ou recebido em seu nome)`);
      if (ex.sigilosos) itens.push(`${plural(ex.sigilosos, 'processo sigiloso', 'processos sigilosos')}`);
      const botao = h('button', { type: 'button', class: 'spro-botao primario', onclick: () => { confirmado = true; resolve(true); modal.fechar(); } }, icone('busca', 15), 'Consultar andamento');
      const conteudo = h('div', { class: 'spro-confirma-andamento' },
        h('p', {}, 'Para agrupar por data ou por unidade de envio, o SEI Pro precisa ',
          h('strong', {}, 'abrir o andamento de cada processo, um por um'), ' no SEI. A consulta é só de leitura, mas faz várias requisições por processo e pode levar alguns minutos.'),
        h('p', {}, h('strong', {}, `Serão consultados ${plural(alvos, 'processo', 'processos')}.`), jaTem ? ` Outros ${jaTem} já estão guardados e ficam como estão.` : ''),
        itens.length ? h('div', {}, h('p', {}, 'Ficam de fora:'), h('ul', {}, ...itens.map((t) => h('li', {}, t)))) : null,
        h('p', { class: 'spro-suave' }, 'O resultado fica guardado neste navegador por 24 horas: ao recarregar a página, ele reaparece sem nova consulta. Você pode cancelar a consulta a qualquer momento.'),
        h('div', { class: 'spro-dialogo-rodape' }, botao));
      const modal = abrirModalGrade(d.sombra, { titulo: 'Consultar o andamento dos processos', icone: 'alerta', conteudo, aoFechar: () => resolve(confirmado) });
    });
  }

  function agendarRedesenho() {
    if (d.semDebounce) return d.aoMudar();
    if (redesenhoTimer) return;
    redesenhoTimer = setTimeout(() => { redesenhoTimer = undefined; if (!encerrado) d.aoMudar(); }, 400);
  }

  async function guardar(): Promise<void> {
    try { await d.armazem.gravarAndamentos(dados); } catch { /* sem storage: o dado vale só nesta tela */ }
  }

  async function executar(alvos: Processo[]): Promise<void> {
    if (coleta || !alvos.length || encerrado) return;
    const ctl = new AbortController();
    coleta = { ctl, progresso: { feitos: 0, total: alvos.length, semDados: 0 } };
    renderFaixa();
    let desdeGravar = 0;
    const r = await coletar({
      alvos, sinal: ctl.signal,
      simultaneas: d.simultaneas, pausaMs: d.pausaMs, esperar: d.esperar,
      consultar: (p, s) => d.consultar(p, s),
      aoResolver: (p, res, prog, falhou) => {
        if (coleta) coleta.progresso = prog;
        if (!falhou) dados[p.id] = { ...(res ?? {}), consultadoEm: d.agora() };
        desdeGravar += 1;
        if (desdeGravar >= 10) { desdeGravar = 0; void guardar(); }
        renderFaixa();
        agendarRedesenho();
      },
    });
    coleta = null;
    await guardar();
    clearTimeout(redesenhoTimer); redesenhoTimer = undefined;
    if (encerrado) return;
    d.aoMudar();
    if (r.motivo === 'sessao') d.aviso('A sessão do SEI expirou: a consulta parou. O que já foi lido ficou guardado.');
    else if (r.motivo === 'erros') d.aviso('O SEI parou de responder: a consulta foi interrompida. O que já foi lido ficou guardado.');
    else if (r.motivo === 'concluida') d.aviso(`Andamento consultado: ${plural(r.progresso.feitos - r.progresso.semDados, 'processo', 'processos')} com dados${r.progresso.semDados ? `, ${r.progresso.semDados} sem informação` : ''}.`);
  }

  /** `novo`: só o que falta no cache. `todos`: reconsulta tudo (botão Atualizar). Devolve se a consulta começou. */
  async function pedir(modo: 'novo' | 'todos'): Promise<boolean> {
    if (coleta) return true;
    const alvos = modo === 'todos' ? elegiveis() : faltantes();
    if (!alvos.length) { d.aviso(modo === 'todos' ? 'Nenhum processo elegível para consultar.' : 'Todos os processos já têm o andamento guardado.'); return false; }
    const jaTem = modo === 'todos' ? 0 : elegiveis().length - alvos.length;
    if (!(await pedirConfirmacao(alvos.length, jaTem))) return false;
    void executar(alvos);
    return true;
  }

  /** O usuário escolheu um agrupamento por andamento. Devolve `false` se ele desistiu e não há nada guardado. */
  async function aoEscolherAgrupamento(): Promise<boolean> {
    if (coleta) return true;
    if (!faltantes().length) return true;
    const comecou = await pedir('novo');
    return comecou || validos().length > 0;
  }

  function renderFaixa() {
    faixa.hidden = !ativo || encerrado;
    if (faixa.hidden) return;
    if (coleta) {
      const { feitos, total } = coleta.progresso;
      faixa.replaceChildren(
        h('span', {}, `Consultando o andamento dos processos… ${feitos} de ${total}`),
        h('progress', { max: String(total), value: String(feitos), 'aria-label': 'Progresso da consulta' }),
        h('button', { type: 'button', class: 'spro-link', onclick: () => coleta?.ctl.abort() }, 'Cancelar'));
      return;
    }
    const v = validos();
    if (!v.length) {
      faixa.replaceChildren(
        h('span', {}, 'O andamento dos processos ainda não foi consultado, por isso todos aparecem em "Sem informação".'),
        h('button', { type: 'button', class: 'spro-link', onclick: () => void pedir('novo') }, 'Consultar agora'));
      return;
    }
    const maisAntigo = Math.min(...v.map((x) => x.consultadoEm));
    const ate = maisAntigo + VALIDADE_MS;
    const sem = faltantes().length;
    faixa.replaceChildren(
      h('span', {}, `Andamento consultado ${rotuloIdadeCache(d.agora() - maisAntigo)} (guardado até ${new Date(ate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})`, sem ? ` · ${plural(sem, 'processo ainda sem consulta', 'processos ainda sem consulta')}` : ''),
      h('button', { type: 'button', class: 'spro-link', onclick: () => void pedir('todos') }, icone('atualizar', 13), ' Atualizar'));
  }

  return {
    faixa,
    carregar,
    /** Os dados válidos por id de processo (vai no contexto do agrupamento). */
    dados: (): Readonly<Record<string, DadosAndamento>> => dados,
    /** A faixa só aparece com um agrupamento por andamento na tela. */
    definirAtivo(v: boolean) { ativo = v; renderFaixa(); },
    atualizarFaixa: renderFaixa,
    aoEscolherAgrupamento,
    pedir,
    emAndamento: () => !!coleta,
    fechar() { encerrado = true; coleta?.ctl.abort(); clearTimeout(redesenhoTimer); },
  };
}
