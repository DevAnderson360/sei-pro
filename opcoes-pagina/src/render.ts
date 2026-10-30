/**
 * Monta a pagina de opcoes a partir do schema, sem innerHTML (DOM seguro).
 *
 * Contrato de DOM (lido por config.ts, busca.ts e favoritos/opcoes):
 *   div.opcao[data-opcao=<nome>][data-tipo=<tipo>][data-depende?][hidden?]
 *     i.ico (ganha .ligado/.desligado)  label.rotulo[for=id]  a.manual | span.manual.vazio
 *     span.controle > (label.chave > input[role=switch] + span.trilho) | input | select
 *   O controle leva id="itemConfigGeral_<nome>", data-name e data-tipo.
 */
import { h } from "@comum/ui/dom";
import { PREFIXO_ID } from "./config";
import { urlManual } from "./manual";
import { OPCOES_COMPLEMENTOS, type Opcao, SECOES_GERAL } from "./schema";

export interface Contexto {
  /** So o "SEI Pro Lab" mostra as linhas visivelEm "lab". */
  lab: boolean;
  /** ANTAQ Pro e ANTT Pro escondem as linhas visivelEm "fora-antaq". */
  foraAntaq: boolean;
  homepage: string;
}

export function contextoDoManifesto(m: { short_name?: string; homepage_url?: string }): Contexto {
  const nome = m.short_name ?? "";
  return {
    lab: nome === "SEI Pro Lab",
    foraAntaq: nome !== "ANTAQ Pro" && nome !== "ANTT Pro",
    homepage: m.homepage_url || "https://seipro.app",
  };
}

function controle(o: Opcao): HTMLElement {
  const base = { id: PREFIXO_ID + o.nome, "data-name": o.nome, "data-tipo": o.tipo };
  if (o.tipo === "chave")
    return h(
      "label",
      { class: "chave" },
      h("input", { ...base, type: "checkbox", role: "switch", checked: o.padrao === true }),
      h("span", { class: "trilho", "aria-hidden": "true" }),
    );
  if (o.tipo === "selecao")
    return h(
      "select",
      base,
      ...(o.escolhas ?? []).map((e) => h("option", { value: e.valor, selected: e.valor === o.padrao && e.valor !== "" }, e.rotulo)),
    );
  if (o.tipo === "numero")
    return h("input", {
      ...base,
      type: "number",
      step: "1",
      min: String(o.min ?? 1),
      max: String(o.max ?? 100),
      value: String(o.padrao ?? ""),
    });
  return h("input", {
    ...base,
    type: "text",
    autocomplete: "off",
    maxlength: o.maxLength ? String(o.maxLength) : undefined,
    value: String(o.padrao ?? ""),
  });
}

export function montarLinha(o: Opcao, ctx: Contexto): HTMLElement {
  const escondida = o.oculta === true || (o.visivelEm === "lab" && !ctx.lab) || (o.visivelEm === "fora-antaq" && !ctx.foraAntaq);
  const depende = o.dependencias?.map((d) => `${d.de}:${d.quando ? 1 : 0}:${d.limparAoEsconder ? 1 : 0}`).join(",");
  return h(
    "div",
    { class: "opcao", "data-opcao": o.nome, "data-tipo": o.tipo, "data-depende": depende, hidden: escondida || undefined },
    h("i", { class: `ico ${o.icone}`, "aria-hidden": "true" }),
    h("label", { class: "rotulo", for: PREFIXO_ID + o.nome, title: o.ajuda }, o.rotulo),
    o.manual
      ? h(
          "a",
          {
            class: "manual",
            href: urlManual(ctx.homepage, o.manual),
            target: "_blank",
            rel: "noopener",
            title: "Abrir a documentação",
            "aria-label": `Documentação: ${o.rotulo}`,
          },
          h("i", { class: "fas fa-info-circle", "aria-hidden": "true" }),
        )
      : h("span", { class: "manual vazio" }),
    h("span", { class: "controle" }, controle(o)),
  );
}

export function montarGeral(ctx: Contexto): HTMLElement {
  return h(
    "div",
    { class: "secoes", "data-aba": "geral" },
    ...SECOES_GERAL.map((s, i) =>
      h(
        "details",
        { class: "secao", "data-secao": s.id, open: i === 0 },
        h("summary", {}, h("span", { class: "secao-titulo" }, s.titulo), h("span", { class: "contagem" })),
        h("div", { class: "secao-corpo" }, ...s.opcoes.map((o) => montarLinha(o, ctx))),
      ),
    ),
  );
}

export function montarComplementos(ctx: Contexto): HTMLElement {
  return h(
    "div",
    { class: "secoes plana", "data-aba": "complementos" },
    h("div", { class: "secao-corpo cartao" }, ...OPCOES_COMPLEMENTOS.map((o) => montarLinha(o, ctx))),
  );
}
