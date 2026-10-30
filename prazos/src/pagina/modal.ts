/**
 * O modal "Prazo": mesmo desenho dos diálogos dos Favoritos, do Histórico e das Ordem dos painéis
 * (dialog.spro-dialogo do base.css do sei-comum, dentro de Shadow DOM, para o CSS do SEI e o modo
 * noturno do legado não o alcançarem). Tudo por createElement/textContent: textos do SEI e do
 * usuário entram como texto, nunca como HTML. O destino do prazo (SEI ou marcador) aparece enquanto
 * se preenche, calculado pela mesma `decidir` que o serviço usa para gravar.
 */
import { icone } from '../../../sei-comum/src/ui/dom';
import { formatarData, type DataISO } from '../../../sei-comum/src/datas/dias';
import type { PrazoProcesso } from '../modelo/tipos';
import type { Entrada } from './destino';
import type { Resultado, ServicoPrazos } from './servico';

export const CLASSE_HOST = 'spro-prz-host';

export interface MarcadorOpcao {
  valor: string;
  texto: string;
}

export interface OpcoesModal {
  css?: string;
  escuro?: boolean;
  /** Marcadores da unidade (assíncrono; se falhar, o prazo vai sem marcador). */
  marcadores?: () => Promise<MarcadorOpcao[]>;
  /** Dados do processo (um só) para preencher o formulário. */
  inicial?: { prazo: PrazoProcesso | null; marcador?: string };
  titulo: string;
  /** Depois de gravar sem nenhuma falha (antes de fechar): quem abriu desmarca as linhas, como o legado. */
  aoConcluir?: (ids: string[]) => void;
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, classe = '', texto?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function botao(doc: Document, classe: string, texto: string): HTMLButtonElement {
  const b = el(doc, 'button', classe, texto);
  b.type = 'button';
  return b;
}

function campo(doc: Document, rotulo: string, ...controles: Element[]): HTMLLabelElement {
  const l = el(doc, 'label', 'spro-prz-campo');
  l.append(el(doc, 'span', 'spro-prz-rotulo', rotulo), ...controles);
  return l;
}

export function abrirModal(
  doc: Document,
  ids: string[],
  servico: ServicoPrazos,
  hoje: () => DataISO,
  opcoes: OpcoesModal,
): { fechar(): void } {
  doc.querySelectorAll(`.${CLASSE_HOST}`).forEach((antigo) => antigo.remove());
  const unico = ids.length === 1;
  const prazo = unico ? opcoes.inicial?.prazo ?? null : null;

  const host = el(doc, 'div', CLASSE_HOST);
  host.setAttribute('data-tema', opcoes.escuro ? 'escuro' : 'claro');
  const raiz: ParentNode = host.attachShadow({ mode: 'open' });
  const estilo = doc.createElement('style');
  estilo.textContent = opcoes.css ?? '';
  const dialogo = el(doc, 'dialog', 'spro-dialogo spro-prz-dialogo');
  dialogo.setAttribute('aria-labelledby', 'spro-prz-titulo');

  // ---- cabeçalho
  const titulo = el(doc, 'h2', 'spro-prz-titulo', opcoes.titulo);
  titulo.id = 'spro-prz-titulo';
  const fecharX = botao(doc, 'spro-botao-icone', '');
  fecharX.setAttribute('aria-label', 'Fechar (Esc)');
  fecharX.title = 'Fechar (Esc)';
  fecharX.append(icone('fechar', 16, doc));
  const marca = el(doc, 'span', 'spro-dialogo-icone');
  marca.setAttribute('aria-hidden', 'true');
  marca.append(icone('relogio', 18, doc));
  const cabecalho = doc.createElement('header');
  cabecalho.append(marca, titulo, fecharX);

  // ---- campos
  const vencSw = doc.createElement('input');
  vencSw.type = 'checkbox';
  vencSw.id = 'spro-prz-venc';
  vencSw.checked = prazo ? !!prazo.vencimento : true;
  const vencRot = el(doc, 'label', 'spro-prz-interruptor');
  vencRot.htmlFor = 'spro-prz-venc';
  vencRot.append(vencSw, doc.createTextNode(' Controlar vencimento'));

  const modoData = botao(doc, '', 'Data');
  const modoDias = botao(doc, '', 'Em N dias');
  modoData.setAttribute('role', 'radio');
  modoDias.setAttribute('role', 'radio');
  const segmento = el(doc, 'div', 'spro-segmentado');
  segmento.setAttribute('role', 'radiogroup');
  segmento.setAttribute('aria-label', 'Como informar o vencimento');
  segmento.append(modoData, modoDias);
  let contagem: 'data' | 'dias' = 'data';

  const data = el(doc, 'input', 'spro-campo');
  data.type = 'date';
  data.value = prazo?.vencimento ?? prazo?.inicio ?? hoje();
  const dias = el(doc, 'input', 'spro-campo spro-prz-dias');
  dias.type = 'number';
  dias.min = '1';
  dias.max = '999';
  dias.placeholder = 'dias';
  const uteis = doc.createElement('input');
  uteis.type = 'checkbox';
  const uteisRot = el(doc, 'label', 'spro-prz-uteis');
  uteisRot.append(uteis, doc.createTextNode(' úteis'));
  const hora = el(doc, 'input', 'spro-campo spro-prz-hora');
  hora.type = 'time';
  hora.value = prazo?.hora ?? '';
  const marcador = el(doc, 'select', 'spro-campo');
  const nenhum = doc.createElement('option');
  nenhum.value = '';
  nenhum.textContent = '— nenhum —';
  marcador.append(nenhum);
  const texto = el(doc, 'input', 'spro-campo');
  texto.type = 'text';
  texto.maxLength = 200;
  texto.value = prazo?.texto ?? '';
  texto.placeholder = 'Opcional: Responder ofício';

  const linhaData = el(doc, 'div', 'spro-prz-linha');
  const linhaDias = el(doc, 'div', 'spro-prz-linha');
  linhaDias.append(dias, uteisRot);
  linhaData.append(data);
  const campoVenc = campo(doc, 'Vencimento', segmento, linhaData, linhaDias);
  const inicio = el(doc, 'input', 'spro-campo');
  inicio.type = 'date';
  inicio.value = prazo?.inicio ?? hoje();
  const campoInicio = campo(doc, 'Data inicial', inicio);
  campoInicio.hidden = true;
  const campoHora = campo(doc, 'Hora (opcional)', hora);
  const campoMarcador = campo(doc, 'Marcador', marcador);
  const campoTexto = campo(doc, 'Texto (opcional)', texto);

  const destinoMsg = el(doc, 'p', 'spro-prz-destino');
  destinoMsg.setAttribute('aria-live', 'polite');
  const erroMsg = el(doc, 'p', 'spro-prz-erro');
  erroMsg.setAttribute('role', 'alert');
  const progresso = el(doc, 'p', 'spro-prz-progresso');
  progresso.setAttribute('aria-live', 'polite');
  const lista = el(doc, 'ul', 'spro-prz-falhas');

  // ---- rodapé
  const remover = botao(doc, 'spro-botao perigo spro-esquerda spro-prz-remover', 'Remover prazo');
  const concluir = botao(doc, 'spro-botao spro-prz-concluir', 'Concluir');
  const salvar = botao(doc, 'spro-botao primario spro-prz-salvar', 'Salvar');
  const rodape = el(doc, 'div', 'spro-dialogo-rodape spro-prz-rodape');
  rodape.append(remover, concluir, salvar);
  const algumPrazo = ids.some((id) => servico.ler(id));
  const algumNativo = ids.some((id) => servico.ler(id)?.idControlePrazo);
  remover.hidden = !algumPrazo;
  concluir.hidden = !algumNativo;

  const corpo = el(doc, 'div', 'spro-dialogo-corpo');
  corpo.append(vencRot, campoVenc, campoInicio, campoHora, campoMarcador, campoTexto, destinoMsg, erroMsg, progresso, lista, rodape);
  dialogo.append(cabecalho, corpo);
  raiz.append(estilo, dialogo);

  // ---- estado
  const dataAtual = (): string => (vencSw.checked ? data.value : inicio.value);
  const entrada = (): Entrada => ({
    ids,
    vencimento: vencSw.checked,
    contagem: vencSw.checked ? contagem : 'data',
    data: dataAtual() || undefined,
    dias: dias.value ? Number(dias.value) : undefined,
    uteis: uteis.checked,
    hora: hora.value || undefined,
    texto: texto.value.trim() || undefined,
    marcador: marcador.value || undefined,
  });
  function atualizar() {
    const venc = vencSw.checked;
    campoVenc.hidden = !venc;
    campoInicio.hidden = venc;
    linhaData.hidden = contagem !== 'data';
    linhaDias.hidden = contagem !== 'dias';
    modoData.setAttribute('aria-checked', String(contagem === 'data'));
    modoDias.setAttribute('aria-checked', String(contagem === 'dias'));
    modoData.setAttribute('aria-selected', String(contagem === 'data'));
    modoDias.setAttribute('aria-selected', String(contagem === 'dias'));
    const d = servico.decidir(entrada());
    destinoMsg.textContent = d.aviso ?? (d.nativo && !d.erro ? 'Será gravado no controle de prazo do SEI.' : '');
    erroMsg.textContent = d.erro ?? '';
    salvar.disabled = !!d.erro || travado;
  }
  let travado = false;
  const bloquear = (v: boolean) => {
    travado = v;
    for (const b of [salvar, remover, concluir]) b.disabled = v;
    if (!v) atualizar();
  };

  for (const c of [vencSw, data, inicio, dias, uteis, hora, marcador, texto]) {
    c.addEventListener('input', atualizar);
    c.addEventListener('change', atualizar);
  }
  modoData.addEventListener('click', () => { contagem = 'data'; atualizar(); });
  modoDias.addEventListener('click', () => { contagem = 'dias'; atualizar(); });

  opcoes.marcadores?.().then((lista) => {
    const quer = opcoes.inicial?.marcador;
    for (const m of lista) {
      const o = doc.createElement('option');
      o.value = m.valor;
      o.textContent = m.texto;
      if (quer && (m.texto === quer || m.valor === quer)) o.selected = true;
      marcador.append(o);
    }
    atualizar();
  }).catch(() => { /* sem lista de marcadores: o prazo vai só ao SEI */ });

  const fechar = () => {
    dialogo.close?.();
    host.remove();
  };
  fecharX.addEventListener('click', fechar);
  dialogo.addEventListener('cancel', () => host.remove());

  async function executar(trabalho: () => Promise<Resultado>) {
    bloquear(true);
    erroMsg.textContent = '';
    lista.replaceChildren();
    try {
      const r = await trabalho();
      if (r.erro) {
        erroMsg.textContent = r.erro;
      } else if (r.falhas.length) {
        progresso.textContent = `${r.gravados.length} de ${ids.length} gravados.`;
        for (const f of r.falhas) lista.append(el(doc, 'li', '', `${f.protocolo}: ${f.erro}`));
      } else {
        opcoes.aoConcluir?.(ids);
        fechar();
        return;
      }
    } catch (e) {
      erroMsg.textContent = e instanceof Error ? e.message : String(e);
    }
    bloquear(false);
  }
  const andamento = (feito: number, total: number) => { progresso.textContent = total > 1 ? `Gravando ${feito} de ${total}…` : ''; };
  salvar.addEventListener('click', () => { if (!salvar.disabled) void executar(() => servico.salvar(entrada(), andamento)); });
  remover.addEventListener('click', () => void executar(() => servico.remover(ids, andamento)));
  concluir.addEventListener('click', () => void executar(() => servico.concluir(ids)));

  if (prazo?.vencimento && !prazo.concluidoEm) data.value = prazo.vencimento;
  if (prazo?.concluidoEm) destinoMsg.textContent = `Prazo de ${formatarData(prazo.vencimento ?? hoje())} concluído em ${formatarData(prazo.concluidoEm)}.`;
  atualizar();
  (doc.body ?? doc.documentElement).append(host);
  if (typeof dialogo.showModal === 'function') dialogo.showModal();
  else dialogo.setAttribute('open', '');
  return { fechar };
}
