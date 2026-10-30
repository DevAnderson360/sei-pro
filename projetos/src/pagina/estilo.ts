/**
 * CSS mínimo da caixa e da árvore (ícone gantt e faixa), injetado uma vez por
 * documento, com o prefixo `spro-prj-` para não colidir com o SEI nem com o
 * legado. Na árvore o ícone aparece sempre e vem realçado (`data-ativo`) quando
 * o processo está num projeto; a faixa some com `hidden` (o `display` dela
 * venceria o do navegador). A página do SEI não tem a base visual do SEI Pro: as cores vão
 * fixas, nos dois temas (`.spro-prj-escuro` no modo noturno do SEI Pro). O
 * balão tem o CSS dele, no Shadow DOM (pagina/balao.ts).
 */

const ID = "spro-prj-estilo-sei";

const CSS = `.spro-prj-ic{position:relative;display:inline-grid;place-items:center;width:26px;height:24px;padding:0;margin:0 1px;border:0;border-radius:6px;background:none;color:#1f5fbf;cursor:pointer;vertical-align:middle;line-height:0}
.spro-prj-ic:hover,.spro-prj-ic[data-ativo],.spro-prj-ic[aria-expanded="true"]{background:rgb(31 95 191 / 12%)}
.spro-prj-ic:focus-visible{outline:2px solid #1a73e8;outline-offset:1px}
.spro-prj-ic svg{display:block;width:18px;height:18px}
/* Na arvore o icone acompanha a estrela e o botao dos Monitorados (mesma regra deles): inline-block na linha de base, caixa de 24 px, svg centrado. */
#topmenu .spro-prj-ic{display:inline-block;width:26px;height:24px;padding:0;margin:0 1px;line-height:0;vertical-align:baseline}
#topmenu .spro-prj-ic svg{display:block;width:18px;height:18px;margin:3px auto}
.spro-prj-ic[data-atraso]::after{content:"";position:absolute;top:1px;right:1px;width:6px;height:6px;border-radius:50%;background:#d1352b;border:1.5px solid #fff}
.spro-prj-ic.spro-prj-escuro{color:#79acff}
.spro-prj-ic.spro-prj-escuro:hover,.spro-prj-ic.spro-prj-escuro[data-ativo],.spro-prj-ic.spro-prj-escuro[aria-expanded="true"]{background:rgb(121 172 255 / 16%)}
.spro-prj-ic.spro-prj-escuro[data-atraso]::after{background:#ff7d73;border-color:#1a1d21}
.spro-prj-faixa{display:flex;align-items:center;gap:6px;box-sizing:border-box;width:100%;margin:6px 0;padding:5px 8px;border:1px solid rgb(209 53 43 / 28%);border-radius:6px;background:rgb(209 53 43 / 8%);color:#1b1f24;font:12px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:left;cursor:pointer}
.spro-prj-faixa[hidden]{display:none}
.spro-prj-faixa:focus-visible{outline:2px solid #1a73e8;outline-offset:1px}
.spro-prj-faixa svg{flex:none;color:#d1352b}
.spro-prj-faixa span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spro-prj-faixa b{font-weight:600}
.spro-prj-faixa.spro-prj-vence{border-color:rgb(180 92 10 / 30%);background:rgb(180 92 10 / 9%)}
.spro-prj-faixa.spro-prj-vence svg{color:#b45c0a}
.spro-prj-faixa.spro-prj-escuro{color:#e7e9ec;background:rgb(255 125 115 / 12%);border-color:rgb(255 125 115 / 30%)}
.spro-prj-faixa.spro-prj-escuro.spro-prj-vence{background:rgb(232 176 74 / 12%);border-color:rgb(232 176 74 / 30%)}
.spro-prj-faixa.spro-prj-escuro svg{color:#ff7d73}
.spro-prj-faixa.spro-prj-escuro.spro-prj-vence svg{color:#e8b04a}`;

export function instalarEstiloNaPagina(doc: Document): void {
  if (doc.getElementById(ID)) return;
  const s = doc.createElement("style");
  s.id = ID;
  s.textContent = CSS;
  (doc.head ?? doc.documentElement).append(s);
}
