import {
  CHAVE_TEMA,
  CHAVE_TEMA_CACHE,
  CONFIG_PADRAO,
  type ConfigTema,
  esquemaResolvido,
  type ModoTema,
  normalizarConfig,
} from "@comum/tema/config";
import { derivarBarra, lerHex, PALETAS } from "@comum/tema/paleta";
import { gerarTokens } from "@comum/tema/tokens";
import { h } from "@comum/ui/dom";

/** O que a seção precisa do navegador: injetado para o teste não depender do chrome.* */
export interface DepsAparencia {
  ler: () => Promise<unknown>;
  gravar: (cfg: ConfigTema) => Promise<void>;
  sistemaEscuro: () => boolean;
}

const MODOS: { id: ModoTema; rotulo: string }[] = [
  { id: "claro", rotulo: "Claro" },
  { id: "escuro", rotulo: "Escuro" },
  { id: "auto", rotulo: "Automático" },
];

export const CSS_APARENCIA = `
.spro-ap-corpo{display:grid;gap:0}
.spro-ap-linha{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px 20px;border-top:1px solid var(--linha)}
.spro-ap-linha:first-child{border-top:0}
.spro-ap-rotulo{display:grid;gap:2px;line-height:1.35}
.spro-ap-dica{font-size:13px;color:var(--tinta-2)}
.spro-ap-selo{padding:2px 10px;border-radius:999px;background:var(--azul-claro);color:var(--azul);font-size:12px;font-weight:600}
.spro-ap-seg{display:inline-flex;border:1px solid var(--linha);border-radius:10px;overflow:hidden}
.spro-ap-seg button{min-height:38px;padding:0 14px;border:0;background:var(--superficie);color:var(--tinta);font:600 14px var(--texto);cursor:pointer}
.spro-ap-seg button+button{border-left:1px solid var(--linha)}
.spro-ap-seg button[aria-checked="true"]{background:var(--azul);color:var(--sobre-azul)}
.spro-ap-cores{display:grid;gap:10px;padding:14px 20px;border-top:1px solid var(--linha)}
.spro-ap-grade{display:flex;flex-wrap:wrap;gap:8px}
.spro-ap-cor{display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:0 12px 0 8px;border:1px solid var(--linha);border-radius:10px;background:var(--superficie);color:var(--tinta);font:600 13px var(--texto);cursor:pointer}
.spro-ap-cor i{width:20px;height:20px;border-radius:6px;border:1px solid rgb(0 0 0/20%)}
.spro-ap-cor[aria-pressed="true"]{border-color:var(--azul);box-shadow:0 0 0 2px var(--azul-claro)}
.spro-ap-livre{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.spro-ap-livre input[type=color]{width:44px;height:38px;padding:2px;border:1px solid var(--linha);border-radius:8px;background:var(--superficie);cursor:pointer}
.spro-ap-aviso{font-size:13px;color:var(--tinta-2);min-height:1.2em}
.spro-ap-previa{margin:0 20px 16px;border:1px solid var(--spro-borda);border-radius:var(--spro-raio-g);overflow:hidden;background:var(--spro-pagina);color:var(--spro-texto);font-family:var(--spro-fonte)}
.spro-ap-previa-barra{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--spro-barra);color:var(--spro-barra-texto);font-weight:600;border-bottom:1px solid var(--spro-barra-borda)}
.spro-ap-previa-barra span{padding:2px 8px;border-radius:6px;background:var(--spro-barra-hover);font-weight:500;font-size:12px}
.spro-ap-previa-corpo{padding:14px;display:grid;gap:10px}
.spro-ap-previa-tab{width:100%;border-collapse:collapse;font-size:13px;background:var(--spro-fundo);border:1px solid var(--spro-borda);border-radius:var(--spro-raio);overflow:hidden}
.spro-ap-previa-tab th{padding:6px 10px;text-align:left;background:var(--spro-fundo-3)}
.spro-ap-previa-tab td{padding:6px 10px;border-top:1px solid var(--spro-borda)}
.spro-ap-previa-tab tr:nth-child(even) td{background:var(--spro-fundo-2)}
.spro-ap-previa a{color:var(--spro-destaque)}
.spro-ap-previa-botoes{display:flex;gap:8px;align-items:center}
.spro-ap-previa button{min-height:34px;padding:0 14px;border-radius:var(--spro-raio);font:600 13px var(--spro-fonte)}
.spro-ap-previa .p{background:var(--spro-destaque);color:var(--spro-destaque-texto);border:1px solid var(--spro-destaque)}
.spro-ap-previa .s{background:var(--spro-fundo);color:var(--spro-texto);border:1px solid var(--spro-borda-forte)}
.spro-ap-rodape{display:flex;gap:8px;flex-wrap:wrap;padding:0 20px 16px}
`;

function chave(ativo: boolean, rotulo: string, aoMudar: (v: boolean) => void): HTMLLabelElement {
  const entrada = h("input", { type: "checkbox", role: "switch", "aria-label": rotulo }) as HTMLInputElement;
  entrada.checked = ativo;
  entrada.addEventListener("change", () => aoMudar(entrada.checked));
  return h("label", { class: "chave" }, entrada, h("span", { class: "trilho" })) as HTMLLabelElement;
}

/** Conteúdo da aparência (sem a casca de `<details>`): usado na seção das opções e no modal da barra do SEI. */
export async function montarCorpoAparencia(deps: DepsAparencia): Promise<{ conteudo: HTMLElement; atualizar: (novo: unknown) => void }> {
  let cfg = normalizarConfig(await deps.ler());

  const previa = h(
    "div",
    { class: "spro-ap-previa", "aria-hidden": "true" },
    h("div", { class: "spro-ap-previa-barra" }, "SEI", h("span", {}, "Controle de Processos")),
    h(
      "div",
      { class: "spro-ap-previa-corpo" },
      h(
        "table",
        { class: "spro-ap-previa-tab" },
        h("tr", {}, h("th", {}, "Processo"), h("th", {}, "Tipo")),
        h("tr", {}, h("td", {}, h("a", { href: "#" }, "00000.000000/2026-00")), h("td", {}, "Ofício")),
        h("tr", {}, h("td", {}, "00000.000001/2026-11"), h("td", {}, "Parecer")),
      ),
      h(
        "div",
        { class: "spro-ap-previa-botoes" },
        h("button", { type: "button", class: "p" }, "Salvar"),
        h("button", { type: "button", class: "s" }, "Cancelar"),
      ),
    ),
  );
  const aviso = h("div", { class: "spro-ap-aviso", role: "status" });
  const linhaModo = h("div", { class: "spro-ap-seg", role: "radiogroup", "aria-label": "Modo do tema" });
  const grade = h("div", { class: "spro-ap-grade" });
  const livre = h("input", { type: "color", "aria-label": "Cor livre da barra" }) as HTMLInputElement;
  const hex = h("code", {}, "");
  const sub = h("div", { class: "spro-ap-corpo" });

  const desenhar = () => {
    const esquema = esquemaResolvido(cfg, deps.sistemaEscuro());
    for (const [k, v] of Object.entries(gerarTokens(cfg, esquema))) previa.style.setProperty(k, v);

    for (const b of linhaModo.querySelectorAll("button")) b.setAttribute("aria-checked", String(b.dataset.modo === cfg.modo));
    for (const b of grade.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.paleta === cfg.paleta));
    livre.value = cfg.corBarra;
    hex.textContent = cfg.corBarra;

    // O aviso vale para a cor escolhida em si (tema claro): escurecer a barra no modo escuro e esperado.
    const d = derivarBarra(cfg.corBarra, "claro");
    const mudou = lerHex(d.barra) && d.barra.toLowerCase() !== cfg.corBarra.toLowerCase();
    aviso.textContent = mudou ? "Ajustamos o tom para manter o texto legível." : "";
    sub.toggleAttribute("data-inativo", !cfg.ativo);
  };

  const salvar = async (parcial: Partial<ConfigTema>) => {
    cfg = normalizarConfig({ ...cfg, ...parcial });
    desenhar();
    await deps.gravar(cfg);
  };

  for (const m of MODOS) {
    const b = h("button", { type: "button", role: "radio", "data-modo": m.id, onclick: () => void salvar({ modo: m.id }) }, m.rotulo);
    linhaModo.append(b);
  }
  for (const p of PALETAS) {
    grade.append(
      h(
        "button",
        {
          type: "button",
          class: "spro-ap-cor",
          "data-paleta": p.id,
          "aria-pressed": "false",
          onclick: () => void salvar({ paleta: p.id, corBarra: p.cor }),
        },
        h("i", { style: `background:${p.cor}` }),
        p.nome,
      ),
    );
  }
  livre.addEventListener("input", () => void salvar({ paleta: "livre", corBarra: livre.value }));

  const linha = (titulo: string, dica: string, controle: Node) =>
    h(
      "div",
      { class: "spro-ap-linha" },
      h("div", { class: "spro-ap-rotulo" }, h("strong", {}, titulo), h("span", { class: "spro-ap-dica" }, dica)),
      controle,
    );

  const restaurar = h(
    "button",
    {
      type: "button",
      class: "btn btn-secundario",
      onclick: () => void salvar({ ...CONFIG_PADRAO, ativo: cfg.ativo }),
    },
    "Restaurar padrão",
  );

  sub.append(
    linha("Modo", "Automático segue o tema do seu sistema operacional.", linhaModo),
    h(
      "div",
      { class: "spro-ap-cores" },
      h("strong", {}, "Cor da barra superior"),
      grade,
      h("div", { class: "spro-ap-livre" }, "Outra cor:", livre, hex),
      aviso,
    ),
    linha(
      "Escurecer o conteúdo dos documentos",
      "No modo escuro, o texto dos documentos é adaptado e há um botão “Ver original” para conferir antes de assinar.",
      chave(cfg.escurecerDocumentos, "Escurecer o conteúdo dos documentos", (v) => void salvar({ escurecerDocumentos: v })),
    ),
    previa,
    h("div", { class: "spro-ap-rodape" }, restaurar),
  );

  const conteudo = h(
    "div",
    { class: "secao-corpo" },
    linha(
      "Ativar o Estilo Avançado",
      "Visual novo do SEI, no mesmo estilo das telas do SEI Pro. As mudanças valem na hora, sem precisar salvar.",
      chave(cfg.ativo, "Ativar o Estilo Avançado", (v) => void salvar({ ativo: v })),
    ),
    sub,
  );
  desenhar();
  return {
    conteudo,
    atualizar: (novo: unknown) => {
      cfg = normalizarConfig(novo);
      desenhar();
      const sw = conteudo.querySelectorAll<HTMLInputElement>('input[role="switch"]');
      if (sw[0]) sw[0].checked = cfg.ativo;
      if (sw[1]) sw[1].checked = cfg.escurecerDocumentos;
    },
  };
}

/** Monta a seção "Aparência". Grava a cada mudança (a prévia é ao vivo e o SEI aberto repinta sozinho). */
export async function montarSecaoAparencia(deps: DepsAparencia): Promise<HTMLElement> {
  const { conteudo } = await montarCorpoAparencia(deps);
  return h(
    "details",
    { class: "secao", open: true, id: "secao-aparencia" },
    h("summary", {}, h("span", { class: "secao-titulo" }, "Aparência (Estilo Avançado)"), h("span", { class: "spro-ap-selo" }, "Novo")),
    conteudo,
  );
}

export { CHAVE_TEMA, CHAVE_TEMA_CACHE };
