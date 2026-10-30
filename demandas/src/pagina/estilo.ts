/**
 * CSS mínimo do botão "Demandas" na barra de ações do processo e do ícone da grade do Controle de Processos (`.spro-dem-cx`), injetado uma vez por documento (prefixo `spro-dem-` para
 * não colidir com o SEI nem com o legado). A barra do SEI 4.1 é escura (ícones brancos) e a do SEI 5 é clara: a cor sai
 * do fundo real da barra (`corDoIcone`). O balão tem o CSS dele, no Shadow DOM (pagina/balaoDemandas.ts).
 */

const ID = "spro-dem-estilo-sei";

const CSS = `.spro-dem-ic{display:inline;cursor:pointer;text-decoration:none;line-height:0}
.spro-dem-env{position:relative;display:inline-block;box-sizing:content-box;width:40px;height:40px;margin:3px;vertical-align:baseline;border-radius:50%;line-height:0}
.spro-dem-ic:hover .spro-dem-env,.spro-dem-ic[aria-expanded="true"] .spro-dem-env{box-shadow:0 0 0 3px rgba(242,129,79,.18);background:rgba(242,129,79,.18)}
.spro-dem-ic:focus-visible{outline:2px solid #1a73e8;outline-offset:1px;border-radius:50%}
.spro-dem-env svg{display:block;width:40px;height:40px}
.spro-dem-selo{position:absolute;top:-3px;right:-3px;box-sizing:border-box;min-width:16px;height:16px;padding:0 3px;border:1.5px solid #fff;border-radius:8px;background:#2B5FB4;color:#fff;font:700 10px/13px Arial,sans-serif;text-align:center;pointer-events:none}
.spro-dem-selo[hidden]{display:none}
.spro-dem-cx{position:relative;display:inline-grid;place-items:center;width:26px;height:24px;padding:0;margin:0 1px;border:0;border-radius:6px;background:none;cursor:pointer;vertical-align:middle;line-height:0}
.spro-dem-cx:hover,.spro-dem-cx[aria-expanded="true"]{background:rgb(242 129 79 / 18%)}
.spro-dem-cx:focus-visible{outline:2px solid #1a73e8;outline-offset:1px}
.spro-dem-cx svg{display:block;width:20px;height:20px}
.spro-dem-cx-n{position:absolute;top:-2px;right:-3px;box-sizing:border-box;min-width:13px;height:13px;padding:0 2px;border:1px solid #fff;border-radius:7px;background:#2B5FB4;color:#fff;font:700 9px/11px Arial,sans-serif;text-align:center;pointer-events:none}
.spro-dem-cx-n[hidden]{display:none}`;

export function instalarEstiloNaPagina(doc: Document): void {
  if (doc.getElementById(ID)) return;
  const s = doc.createElement("style");
  s.id = ID;
  s.textContent = CSS;
  (doc.head ?? doc.documentElement).append(s);
}
