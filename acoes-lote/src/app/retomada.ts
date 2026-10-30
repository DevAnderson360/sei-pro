/**
 * Retomada: ao abrir o app com um lote parado neste processo, oferece Continuar ou Descartar. Com Assinar pendente,
 * pede a senha antes (ela nunca foi gravada). Lote gravado há pouco por outra instância do app pode estar rodando
 * em outra aba: avisa, e o primeiro Continuar só arma o "Continuar mesmo assim".
 */

import { h, icone } from "@comum/ui/dom";
import { type LoteAcoes, proximaEtapa } from "../modelo/fila";

export const AVISO_OUTRA_ABA = "Este lote pode estar rodando em outra aba.";
/** Gravação mais recente que isto, por outra instância, sugere execução em curso em outra aba. */
export const JANELA_OUTRA_ABA_MS = 15_000;
const PEDE_SENHA = "Digite a senha da assinatura.";

export function textoRetomada(feitos: number, total: number): string {
  return `Há um lote de Ações em Lote parado neste processo (${feitos} de ${total}). Continuar de onde parou?`;
}

/** Há etapa a executar (só então a retomada é oferecida). */
export function loteParado(l: LoteAcoes): boolean {
  return l.planos.some((p) => proximaEtapa(p) !== null);
}

/** Rodando, gravado há menos de 15 s e por outra aba do SEI (registro sem `estado` conta como rodando). */
export function emOutraAba(l: LoteAcoes, aba: string, agora: number): boolean {
  return (l.estado ?? "rodando") === "rodando" && l.aba !== aba && agora - l.atualizadoEm < JANELA_OUTRA_ABA_MS;
}

export interface AcoesRetomada {
  continuar(senha?: string): void;
  descartar(): void;
}

export function montarRetomada(l: LoteAcoes, o: { aba: string; agora: number }, a: AcoesRetomada): HTMLElement {
  const feitos = l.planos.filter((p) => proximaEtapa(p) === null).length;
  const assinar = l.planos.some((p) => p.etapas.some((x) => x.acao === "assinar" && x.situacao === "pendente"));
  const outra = emOutraAba(l, o.aba, o.agora);
  const erro = h("p", { class: "al-erro", role: "alert" });
  const senha = assinar
    ? h("input", { type: "password", class: "spro-campo", autocomplete: "current-password", "aria-label": "Senha da assinatura" })
    : null;
  let armado = !outra;
  const continuar = h(
    "button",
    {
      type: "button",
      class: "spro-botao primario",
      onclick: () => {
        if (senha && !senha.value) {
          erro.textContent = PEDE_SENHA;
          senha.focus?.();
          return;
        }
        if (!armado) {
          armado = true;
          continuar.hidden = true;
          mesmoAssim.hidden = false;
          return;
        }
        a.continuar(senha?.value || undefined);
      },
    },
    icone("atualizar", 15),
    "Continuar",
  );
  const mesmoAssim = h(
    "button",
    {
      type: "button",
      class: "spro-botao perigo",
      hidden: true,
      onclick: () => {
        if (senha && !senha.value) {
          erro.textContent = PEDE_SENHA;
          return;
        }
        a.continuar(senha?.value || undefined);
      },
    },
    icone("atualizar", 15),
    "Continuar mesmo assim",
  );
  const descartar = h("button", { type: "button", class: "spro-botao", onclick: () => a.descartar() }, icone("lixeira", 15), "Descartar");
  return h(
    "section",
    { class: "al-retomada", "aria-label": "Lote parado" },
    h("p", {}, textoRetomada(feitos, l.planos.length)),
    outra ? h("p", { class: "al-erro al-motivo", role: "alert" }, icone("alerta", 16), AVISO_OUTRA_ABA) : null,
    senha ? h("label", { class: "al-campo" }, "Senha da assinatura", senha) : null,
    erro,
    h("div", { class: "al-rodape" }, descartar, continuar, mesmoAssim),
  );
}
