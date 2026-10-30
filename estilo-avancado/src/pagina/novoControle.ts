/**
 * Ao ligar o Estilo Avançado o Novo Controle de Processos entra junto. A opção (`gradecontrole`) é gravada por
 * `gravarTema`; aqui fica a escolha DA ABA: a grade só substitui a lista nativa quando o usuário a escolheu
 * (bandeira `spro_grade` no localStorage do SEI, a mesma que o botão da grade grava), então a bandeira é posta e,
 * se esta aba já está no Controle de Processos, o botão da grade é acionado para a visão nova aparecer na hora.
 */

/** Mesma chave de grade-controle/src/ativacao/inicio.ts (CHAVE_DICA). */
export const CHAVE_GRADE = "spro_grade";
const BOTAO_GRADE = "button.spro-grade-botao";
/** Espera o módulo da grade reagir à opção (ele monta o botão depois de ler o storage). */
const ESPERA_MS = 700;
const TENTATIVAS = 8;

export function ativarNovoControleNaAba(doc: Document, armazenamento: Pick<Storage, "setItem">): void {
  try {
    armazenamento.setItem(CHAVE_GRADE, "1");
  } catch {
    /* sem storage: a visão nova só abre pelo botão */
  }
  if (!/[?&]acao=procedimento_controlar\b/.test(doc.defaultView?.location?.search ?? "")) return;
  let n = 0;
  const tentar = () => {
    const botao = doc.querySelector<HTMLButtonElement>(BOTAO_GRADE);
    if (botao?.getAttribute("aria-pressed") === "false") botao.click();
    else if (!botao && ++n < TENTATIVAS) setTimeout(tentar, ESPERA_MS);
  };
  setTimeout(tentar, ESPERA_MS);
}
