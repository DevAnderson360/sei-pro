import { listarBlocosParaInclusao, retornarBlocoParaInclusao } from '../../sei-nucleo/src/dominio/blocos';
import type { Sei } from '../../sei-nucleo/src/sei';
import { criarModal, type Modal } from './modal';

export interface Dependencias {
  doc: Document;
  url: string;
  sei: Sei;
  /** A janela de topo, onde o modal é montado (a tela de inclusão fica num iframe). Padrão: `doc`. */
  topo?: Document;
  /** base.css + modal.css, para o Shadow DOM do modal. */
  css?: string;
}

/** Ciclo da tela viva: só o núcleo conhece listagem, formulário e escrita do SEI. */
export function iniciar({ doc, url, sei, topo = doc, css = '' }: Dependencias) {
  let ligada = false;
  let encerrada = false;
  let escrevendo = false;
  let modal: Modal | null = null;
  let leitura: AbortController | null = null;
  let origem: HTMLElement | null = null;
  const botoes = new Set<HTMLButtonElement>();
  const contexto = new URL(url).searchParams.get('acao') === 'bloco_escolher';

  function fecharDialogo() {
    leitura?.abort(); leitura = null;
    const atual = modal;
    modal = null;
    atual?.remover();
    if (origem?.isConnected) origem.focus();
    origem = null;
  }

  function desmontar() {
    fecharDialogo();
    for (const botao of botoes) botao.remove();
    botoes.clear();
  }

  function montar() {
    if (!ligada || encerrada || !contexto) return;
    const seletor = doc.querySelector<HTMLSelectElement>('#frmBlocoEscolher #selBloco');
    if (!seletor) return;
    for (const botao of botoes) if (!botao.isConnected) botoes.delete(botao);
    const barras = [...doc.querySelectorAll<HTMLElement>('#frmBlocoEscolher #divInfraBarraComandosSuperior, #frmBlocoEscolher #divInfraBarraComandosInferior')];
    const destinos = barras.length ? barras : [seletor.parentElement!];
    for (const destino of destinos) {
      if (destino.querySelector('.spro-blocos-retornar')) continue;
      const botao = doc.createElement('button');
      botao.type = 'button';
      botao.className = 'infraButton spro-blocos-retornar';
      botao.textContent = 'Retornar bloco disponibilizado';
      botao.disabled = escrevendo;
      botao.addEventListener('click', () => { void abrir(botao); });
      destino.append(botao); botoes.add(botao);
    }
  }

  async function abrir(botao: HTMLElement) {
    if (!ligada || encerrada || modal || escrevendo) return;
    origem = botao;
    const atual = criarModal(topo, { css, escuro: !!topo.body?.classList.contains('dark-mode') });
    const { dialogo, titulo, explicacao, status, lista, confirmar, fecharX } = atual;
    modal = atual;
    const sair = () => { if (!escrevendo) fecharDialogo(); };
    dialogo.addEventListener('cancel', evento => { evento.preventDefault(); sair(); });
    dialogo.addEventListener('close', () => { if (modal === atual) { modal = null; leitura?.abort(); leitura = null; } });
    fecharX.addEventListener('click', sair);
    atual.abrir(); fecharX.focus();
    let selecionado = '';
    let aviso = '';
    const aoAviso = (mensagem: string) => { aviso = mensagem; };
    lista.addEventListener('change', () => {
      selecionado = lista.querySelector<HTMLInputElement>('input:checked')?.value ?? '';
      confirmar.disabled = !selecionado || escrevendo;
    });
    const abort = new AbortController(); leitura = abort;
    const ativa = () => !encerrada && ligada && modal === atual;
    try {
      const blocos = await listarBlocosParaInclusao(sei, { sinal: abort.signal, aoAviso });
      if (!ativa()) return;
      leitura = null;
      if (!blocos.length) {
        status.textContent = 'Nenhum bloco disponibilizado que possa retornar nesta unidade foi encontrado.' + (aviso ? ` ${aviso}` : '');
        confirmar.remove(); return;
      }
      for (const bloco of blocos) {
        const rotulo = topo.createElement('label');
        const radio = topo.createElement('input');
        radio.type = 'radio'; radio.name = 'spro-bloco-retorno'; radio.value = bloco.id;
        const texto = topo.createElement('span'); texto.textContent = `${bloco.numero} - ${bloco.descricao}`;
        rotulo.append(radio, texto); lista.append(rotulo);
      }
      lista.hidden = false;
      status.textContent = 'Escolha um bloco e confirme o retorno.' + (aviso ? ` ${aviso}` : '');
      lista.querySelector<HTMLInputElement>('input')?.focus();
    } catch (erro) {
      if (!ativa()) return;
      leitura = null;
      status.textContent = erro instanceof Error ? erro.message : 'Não foi possível carregar os blocos. Tente novamente.';
      if (aviso) status.textContent += ` ${aviso}`;
      confirmar.remove();
    }
    confirmar.addEventListener('click', () => { void retornar(); });

    async function retornar() {
      if (!ativa() || escrevendo || !selecionado || confirmar.disabled) return;
      escrevendo = true;
      confirmar.disabled = true; fecharX.disabled = true; lista.disabled = true;
      for (const botao of botoes) botao.disabled = true;
      status.textContent = 'Retornando o bloco e verificando a inclusão…';
      try {
        // A escrita já enviada continua mesmo se a preferência for desligada:
        // abortar o fetch não garante cancelar o que o servidor está fazendo.
        const bloco = await retornarBlocoParaInclusao(sei, selecionado, url, { aoAviso });
        if (!ativa()) return;
        const seletor = doc.querySelector<HTMLSelectElement>('#frmBlocoEscolher #selBloco');
        if (!seletor) {
          status.textContent = 'Bloco retornado no SEI. A tela de inclusão mudou; atualize-a antes de continuar.';
        } else {
          let opcao = [...seletor.options].find(o => o.value === bloco.id);
          if (!opcao) {
            opcao = doc.createElement('option'); opcao.value = bloco.id;
            // O SEI lista os blocos do maior número para o menor: mantém a ordem.
            const depois = [...seletor.options].find(o => /^\d+$/.test(o.value) && Number(o.value) < Number(bloco.id));
            seletor.insertBefore(opcao, depois ?? null);
          }
          opcao.textContent = bloco.rotulo;
          seletor.value = bloco.id;
          // O onchange nativo submete o formulário: só o Chosen é notificado.
          const Evento = doc.defaultView!.Event;
          seletor.dispatchEvent(new Evento('chosen:updated', { bubbles: true }));
          status.textContent = 'Bloco retornado e selecionado no campo Bloco. Você pode incluir os documentos marcados.';
        }
        if (aviso) status.textContent += ` ${aviso}`;
        titulo.textContent = 'Bloco retornado';
        explicacao.remove(); lista.remove(); confirmar.remove();
      } catch (erro) {
        if (!ativa()) return;
        status.textContent = erro instanceof Error ? erro.message : 'Não foi possível confirmar o retorno. Confira o bloco no SEI antes de tentar novamente.';
        if (aviso) status.textContent += ` ${aviso}`;
        confirmar.disabled = false;
      } finally {
        escrevendo = false;
        for (const botao of botoes) botao.disabled = false;
        if (ativa()) { fecharX.disabled = false; lista.disabled = false; fecharX.focus(); }
      }
    }
  }

  const Observador = doc.defaultView!.MutationObserver;
  const observador = new Observador(montar);
  if (contexto) observador.observe(doc.body, { childList: true, subtree: true });
  return {
    configurar(valor: boolean) {
      if (encerrada) return;
      ligada = valor;
      if (ligada) montar(); else desmontar();
    },
    fechar() {
      encerrada = true; ligada = false;
      observador.disconnect(); desmontar();
    },
  };
}
