/** A tela de progresso da execução (o laço mora em execucao.ts). */

import { h, icone } from "@comum/ui/dom";
import type { ControleExecucao } from "./execucao";

export interface AcoesTelaExecucao {
  minimizar(): void;
}

/** A tela de progresso: barra, contagem, motivo da parada, senha (se Assinar pende) e os botões. */
export class TelaExecucao {
  readonly el: HTMLElement;
  private readonly texto: HTMLElement;
  private readonly barra: HTMLElement;
  private readonly falhas: HTMLElement;
  private readonly motivo: HTMLElement;
  private readonly senha: HTMLInputElement;
  private readonly campoSenha: HTMLElement;
  private readonly pausar: HTMLButtonElement;
  private readonly continuar: HTMLButtonElement;
  private readonly parar: HTMLButtonElement;

  constructor(
    private readonly c: ControleExecucao,
    a: AcoesTelaExecucao,
  ) {
    const botao = (rotulo: string, nome: Parameters<typeof icone>[0], fazer: () => void, classe = "") =>
      h("button", { type: "button", class: `spro-botao ${classe}`.trim(), onclick: fazer }, icone(nome, 15), rotulo);
    this.texto = h("p", { class: "al-progresso-texto", role: "status" });
    this.barra = h("div", { class: "al-progresso-cheia" });
    this.falhas = h("p", { class: "al-dica" });
    this.motivo = h("p", { class: "al-erro al-motivo", role: "alert", hidden: true });
    this.senha = h("input", {
      type: "password",
      class: "spro-campo",
      autocomplete: "current-password",
      "aria-label": "Senha da assinatura",
    });
    this.campoSenha = h("label", { class: "al-campo", hidden: true }, "Senha da assinatura", this.senha);
    this.pausar = botao("Pausar", "relogio", () => c.pausar());
    this.continuar = botao(
      "Continuar",
      "atualizar",
      () => {
        if (c.precisaSenha() && !this.senha.value) {
          this.motivo.hidden = false;
          this.motivo.textContent = "Digite a senha da assinatura.";
          return;
        }
        const s = this.senha.value || undefined;
        this.senha.value = "";
        void c.continuar(s);
      },
      "primario",
    );
    this.parar = botao("Parar lote", "fechar", () => c.cancelar(), "perigo");
    this.el = h(
      "section",
      { class: "al-execucao", "aria-label": "Execução" },
      h("h2", { class: "al-titulo" }, "Execução"),
      this.texto,
      h(
        "div",
        { class: "al-progresso-barra", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(c.progresso().total) },
        this.barra,
      ),
      this.falhas,
      this.motivo,
      this.campoSenha,
      h("p", { class: "al-nota" }, "Minimizar libera a tela do SEI. Fechar a janela pausa o lote, que fica salvo para continuar depois."),
      h("p", { class: "al-nota" }, "Deixe esta aba do SEI visível enquanto o lote roda: o navegador desacelera abas em segundo plano."),
      h(
        "div",
        { class: "al-rodape" },
        this.pausar,
        this.continuar,
        this.parar,
        botao("Minimizar", "recolher", () => a.minimizar()),
      ),
    );
    this.atualizar();
  }

  atualizar(): void {
    const { feitos, total, falhas } = this.c.progresso();
    const pausado = this.c.estado === "pausado";
    const parando = this.c.estado === "cancelado";
    const pct = total ? Math.round((feitos / total) * 100) : 0;
    this.barra.setAttribute("style", `width:${pct}%`);
    this.barra.parentElement?.setAttribute("aria-valuenow", String(feitos));
    if (parando) this.texto.textContent = "Parando: aguardando a etapa em andamento terminar…";
    else if (pausado && this.c.rodando)
      this.texto.textContent = `Pausando: aguardando a etapa em andamento terminar… (${feitos} de ${total})`;
    else if (pausado) this.texto.textContent = `Pausado: ${feitos} de ${total} documentos.`;
    else this.texto.textContent = `Executando ${Math.min(feitos + 1, total)} de ${total} documentos…`;
    this.falhas.textContent = falhas ? `${falhas} ${falhas === 1 ? "documento com erro" : "documentos com erro"} até agora.` : "";
    this.motivo.hidden = !this.c.motivo;
    this.motivo.textContent = this.c.motivo ?? "";
    this.campoSenha.hidden = !(pausado && !this.c.rodando && this.c.precisaSenha());
    this.pausar.hidden = pausado || parando;
    this.continuar.hidden = !pausado || this.c.rodando;
    this.parar.hidden = parando;
  }
}
