import { h } from "@comum/ui/dom";

export type TipoAviso = "ok" | "erro" | "atencao";
const ICONE: Record<TipoAviso, string> = { ok: "fa-check-circle", erro: "fa-exclamation-triangle", atencao: "fa-exclamation-triangle" };

/** Aviso modal nativo (substitui o dialog do jQuery UI). Resolve quando o usuario fecha (OK, Esc ou fundo). */
export function avisar(tipo: TipoAviso, texto: string): Promise<void> {
  return new Promise((resolver) => {
    const fechar = () => {
      dlg.remove();
      resolver();
    };
    const dlg = h(
      "dialog",
      { class: `aviso aviso-${tipo}` },
      h("p", {}, h("i", { class: `fas ${ICONE[tipo]}`, "aria-hidden": "true" }), " ", texto),
      h("div", { class: "aviso-acoes" }, h("button", { type: "button", class: "btn btn-primario", onclick: fechar }, "OK")),
    );
    dlg.addEventListener("close", fechar);
    document.body.append(dlg);
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  });
}
