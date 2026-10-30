/* GERADO por demandas/build.mjs. NAO EDITE ESTE ARQUIVO. Rode: npm run build */
import{$ as so,D as O,F as K,G as J,H as Z,N as g,V as oo,W as ro,X as eo,Z as ao,_ as to,a as _,b as Q,d as H,e as C,f as t,g as N,h as V,j as W,q as Y,r as T}from"./pagina-comum.js";var no=`/*\r
 * Base visual dos m\xF3dulos novos do SEI Pro.\r
 *\r
 * Tokens no :root (e no :host, para valerem dentro de Shadow DOM: o bal\xE3o que o\r
 * content script abre na p\xE1gina do SEI). O modo escuro vem de duas formas:\r
 * for\xE7ado por data-tema (o painel abaixo da lista segue o SEI, que s\xF3 \xE9 escuro\r
 * com o modo noturno do SEI Pro) ou pelo sistema, quando ningu\xE9m for\xE7ou nada\r
 * (o painel lateral). A cor de destaque pode vir do tema do SEI\r
 * (--spro-cor-sei, posta pelo app embutido).\r
 */\r
:root,\r
:host {\r
  --spro-fundo: #ffffff;\r
  --spro-fundo-2: #f6f7f9;\r
  --spro-fundo-3: #eceef2;\r
  --spro-pagina: #f3f4f7;\r
  --spro-texto: #1b1f24;\r
  --spro-suave: #5d6772;\r
  --spro-fraco: #8b939c;\r
  --spro-borda: #e3e6eb;\r
  --spro-borda-forte: #cfd4db;\r
  --spro-destaque: #1f5fbf;\r
  --spro-destaque-texto: #ffffff;\r
  --spro-perigo: #d1352b;\r
  --spro-aviso: #b45c0a;\r
  --spro-ok: #12805c;\r
  --spro-novidade: #6d4fd8;\r
  --spro-estrela: #f2a516;\r
  --spro-sombra-1: 0 1px 2px rgb(16 24 40 / 6%);\r
  --spro-sombra-2: 0 2px 4px -2px rgb(16 24 40 / 8%), 0 6px 14px -4px rgb(16 24 40 / 12%);\r
  --spro-sombra-3: 0 10px 24px -6px rgb(16 24 40 / 18%), 0 24px 56px -12px rgb(16 24 40 / 24%);\r
  --spro-veu: rgb(17 21 28 / 46%);\r
  --spro-raio-p: 6px;\r
  --spro-raio: 8px;\r
  --spro-raio-g: 12px;\r
  --spro-raio-xg: 16px;\r
  --spro-fonte: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;\r
  --spro-mono: ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Menlo, Consolas, monospace;\r
  --spro-dur: 150ms;\r
  --spro-curva: cubic-bezier(0.2, 0.8, 0.2, 1);\r
  --spro-destaque-suave: color-mix(in srgb, var(--spro-destaque) 10%, transparent);\r
  --spro-destaque-medio: color-mix(in srgb, var(--spro-destaque) 18%, transparent);\r
  --spro-anel: 0 0 0 3px color-mix(in srgb, var(--spro-destaque) 30%, transparent);\r
  color-scheme: light;\r
}\r
:root[data-tema="escuro"],\r
:host([data-tema="escuro"]) {\r
  --spro-fundo: #1a1d21;\r
  --spro-fundo-2: #22262b;\r
  --spro-fundo-3: #2b3036;\r
  --spro-pagina: #141619;\r
  --spro-texto: #e7e9ec;\r
  --spro-suave: #a4abb3;\r
  --spro-fraco: #767e87;\r
  --spro-borda: #2f343a;\r
  --spro-borda-forte: #3d434a;\r
  --spro-destaque: #79acff;\r
  --spro-destaque-texto: #0a1526;\r
  --spro-perigo: #ff7d73;\r
  --spro-aviso: #e8b04a;\r
  --spro-ok: #4fcf96;\r
  --spro-novidade: #ab98ff;\r
  --spro-estrela: #f6b73c;\r
  --spro-sombra-1: 0 1px 2px rgb(0 0 0 / 30%);\r
  --spro-sombra-2: 0 2px 4px -2px rgb(0 0 0 / 40%), 0 6px 14px -4px rgb(0 0 0 / 45%);\r
  --spro-sombra-3: 0 10px 24px -6px rgb(0 0 0 / 50%), 0 24px 56px -12px rgb(0 0 0 / 60%);\r
  --spro-veu: rgb(0 0 0 / 58%);\r
  --spro-destaque-suave: color-mix(in srgb, var(--spro-destaque) 14%, transparent);\r
  --spro-destaque-medio: color-mix(in srgb, var(--spro-destaque) 24%, transparent);\r
  color-scheme: dark;\r
}\r
@media (prefers-color-scheme: dark) {\r
  :root:not([data-tema]),\r
  :host(:not([data-tema])) {\r
    --spro-fundo: #1a1d21;\r
    --spro-fundo-2: #22262b;\r
    --spro-fundo-3: #2b3036;\r
    --spro-pagina: #141619;\r
    --spro-texto: #e7e9ec;\r
    --spro-suave: #a4abb3;\r
    --spro-fraco: #767e87;\r
    --spro-borda: #2f343a;\r
    --spro-borda-forte: #3d434a;\r
    --spro-destaque: #79acff;\r
    --spro-destaque-texto: #0a1526;\r
    --spro-perigo: #ff7d73;\r
    --spro-aviso: #e8b04a;\r
    --spro-ok: #4fcf96;\r
    --spro-novidade: #ab98ff;\r
    --spro-estrela: #f6b73c;\r
    --spro-sombra-1: 0 1px 2px rgb(0 0 0 / 30%);\r
    --spro-sombra-2: 0 2px 4px -2px rgb(0 0 0 / 40%), 0 6px 14px -4px rgb(0 0 0 / 45%);\r
    --spro-sombra-3: 0 10px 24px -6px rgb(0 0 0 / 50%), 0 24px 56px -12px rgb(0 0 0 / 60%);\r
    --spro-veu: rgb(0 0 0 / 58%);\r
    --spro-destaque-suave: color-mix(in srgb, var(--spro-destaque) 14%, transparent);\r
    --spro-destaque-medio: color-mix(in srgb, var(--spro-destaque) 24%, transparent);\r
    color-scheme: dark;\r
  }\r
}\r
/* Destaque na cor do tema do SEI (painel abaixo da lista). No escuro, clareado para ter contraste. */\r
:root[data-cor-sei] {\r
  --spro-destaque: var(--spro-cor-sei);\r
}\r
:root[data-cor-sei][data-tema="escuro"] {\r
  --spro-destaque: color-mix(in srgb, var(--spro-cor-sei) 45%, #ffffff);\r
}\r
\r
/* [hidden] perde para display de classe; o agente aprendeu isso do jeito dif\xEDcil. */\r
[hidden] {\r
  /* biome-ignore lint/complexity/noImportantStyles: [hidden] precisa vencer o display das classes */\r
  display: none !important;\r
}\r
.spro-icone {\r
  flex: none;\r
  vertical-align: middle;\r
}\r
\r
/* ---------- Bot\xF5es ---------- */\r
.spro-botao {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  gap: 6px;\r
  min-height: 30px;\r
  padding: 0 12px;\r
  font: inherit;\r
  font-size: 13px;\r
  font-weight: 500;\r
  line-height: 1.2;\r
  white-space: nowrap;\r
  color: var(--spro-texto);\r
  background: var(--spro-fundo);\r
  border: 1px solid var(--spro-borda-forte);\r
  border-radius: var(--spro-raio);\r
  box-shadow: var(--spro-sombra-1);\r
  cursor: pointer;\r
  transition:\r
    background var(--spro-dur),\r
    border-color var(--spro-dur),\r
    box-shadow var(--spro-dur),\r
    color var(--spro-dur);\r
}\r
.spro-botao:hover {\r
  background: var(--spro-fundo-2);\r
  border-color: color-mix(in srgb, var(--spro-borda-forte) 60%, var(--spro-texto));\r
}\r
.spro-botao:active {\r
  background: var(--spro-fundo-3);\r
}\r
.spro-botao .spro-icone {\r
  color: var(--spro-suave);\r
}\r
.spro-botao.primario {\r
  color: var(--spro-destaque-texto);\r
  background: var(--spro-destaque);\r
  border-color: transparent;\r
  box-shadow:\r
    var(--spro-sombra-1),\r
    inset 0 1px 0 rgb(255 255 255 / 14%);\r
}\r
.spro-botao.primario .spro-icone {\r
  color: inherit;\r
}\r
.spro-botao.primario:hover {\r
  background: color-mix(in srgb, var(--spro-destaque) 88%, #000000);\r
}\r
.spro-botao.perigo {\r
  color: var(--spro-perigo);\r
}\r
.spro-botao.perigo .spro-icone {\r
  color: inherit;\r
}\r
.spro-botao.primario.perigo {\r
  color: #ffffff;\r
  background: var(--spro-perigo);\r
}\r
.spro-botao.fantasma {\r
  background: transparent;\r
  border-color: transparent;\r
  box-shadow: none;\r
}\r
.spro-botao.fantasma:hover {\r
  background: var(--spro-fundo-3);\r
}\r
.spro-botao.pequeno {\r
  min-height: 26px;\r
  padding: 0 9px;\r
  font-size: 12px;\r
}\r
.spro-botao:disabled,\r
.spro-botao-icone:disabled {\r
  opacity: 0.5;\r
  cursor: default;\r
  pointer-events: none;\r
}\r
.spro-botao-icone {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  flex: none;\r
  width: 30px;\r
  height: 30px;\r
  padding: 0;\r
  color: var(--spro-suave);\r
  background: none;\r
  border: 0;\r
  border-radius: var(--spro-raio);\r
  cursor: pointer;\r
  transition:\r
    background var(--spro-dur),\r
    color var(--spro-dur);\r
}\r
.spro-botao-icone:hover,\r
.spro-botao-icone[aria-expanded="true"] {\r
  color: var(--spro-texto);\r
  background: var(--spro-fundo-3);\r
}\r
.spro-botao-icone.pequeno {\r
  width: 26px;\r
  height: 26px;\r
}\r
\r
/* ---------- Campos ---------- */\r
.spro-campo {\r
  box-sizing: border-box;\r
  min-height: 32px;\r
  min-width: 0;\r
  padding: 5px 10px;\r
  font: inherit;\r
  font-size: 13px;\r
  color: var(--spro-texto);\r
  background: var(--spro-fundo);\r
  border: 1px solid var(--spro-borda-forte);\r
  border-radius: var(--spro-raio);\r
  transition:\r
    border-color var(--spro-dur),\r
    box-shadow var(--spro-dur);\r
}\r
.spro-campo::placeholder {\r
  color: var(--spro-fraco);\r
}\r
.spro-campo:hover {\r
  border-color: color-mix(in srgb, var(--spro-borda-forte) 70%, var(--spro-texto));\r
}\r
textarea.spro-campo {\r
  resize: vertical;\r
  line-height: 1.45;\r
  padding: 8px 10px;\r
}\r
.spro-campo:focus,\r
.spro-campo:focus-visible {\r
  outline: none;\r
  border-color: var(--spro-destaque);\r
  box-shadow: var(--spro-anel);\r
}\r
.spro-botao:focus-visible,\r
.spro-botao-icone:focus-visible,\r
.spro-combo:focus-visible,\r
.spro-chip:focus-visible,\r
.spro-segmentado button:focus-visible {\r
  outline: none;\r
  box-shadow: var(--spro-anel);\r
}\r
/* No menu o fundo j\xE1 mostra o item em foco (o foco anda junto com o mouse). */\r
.spro-menu-item:focus-visible {\r
  outline: none;\r
}\r
input[type="checkbox"],\r
input[type="radio"] {\r
  accent-color: var(--spro-destaque);\r
}\r
\r
/* ---------- Controle segmentado ---------- */\r
.spro-segmentado {\r
  display: inline-flex;\r
  align-items: stretch;\r
  gap: 2px;\r
  padding: 2px;\r
  background: var(--spro-fundo-3);\r
  border-radius: calc(var(--spro-raio) + 1px);\r
}\r
.spro-segmentado button {\r
  all: unset;\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  gap: 6px;\r
  min-height: 26px;\r
  padding: 0 11px;\r
  font-size: 12.5px;\r
  font-weight: 500;\r
  color: var(--spro-suave);\r
  border-radius: var(--spro-raio-p);\r
  cursor: pointer;\r
  white-space: nowrap;\r
  transition:\r
    background var(--spro-dur),\r
    color var(--spro-dur),\r
    box-shadow var(--spro-dur);\r
}\r
.spro-segmentado button:hover {\r
  color: var(--spro-texto);\r
}\r
.spro-segmentado button[aria-selected="true"],\r
.spro-segmentado button[aria-pressed="true"],\r
.spro-segmentado button[aria-checked="true"] {\r
  color: var(--spro-texto);\r
  background: var(--spro-fundo);\r
  box-shadow: var(--spro-sombra-1);\r
  font-weight: 600;\r
}\r
\r
/* ---------- Chips (etiquetas) e p\xEDlulas ---------- */\r
.spro-chip {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 5px;\r
  min-height: 24px;\r
  padding: 0 10px;\r
  font: inherit;\r
  font-size: 12px;\r
  font-weight: 500;\r
  color: var(--spro-texto);\r
  background: color-mix(in srgb, var(--cor, var(--spro-fundo-3)) 30%, var(--spro-fundo));\r
  border: 1px solid color-mix(in srgb, var(--cor, var(--spro-borda-forte)) 60%, transparent);\r
  border-radius: 999px;\r
  cursor: pointer;\r
  transition:\r
    background var(--spro-dur),\r
    border-color var(--spro-dur),\r
    opacity var(--spro-dur);\r
}\r
:root[data-tema="escuro"] .spro-chip,\r
:host([data-tema="escuro"]) .spro-chip {\r
  background: color-mix(in srgb, var(--cor, var(--spro-fundo-3)) 16%, var(--spro-fundo));\r
}\r
@media (prefers-color-scheme: dark) {\r
  :root:not([data-tema]) .spro-chip,\r
  :host(:not([data-tema])) .spro-chip {\r
    background: color-mix(in srgb, var(--cor, var(--spro-fundo-3)) 16%, var(--spro-fundo));\r
  }\r
}\r
.spro-chip::before {\r
  content: "";\r
  width: 7px;\r
  height: 7px;\r
  border-radius: 50%;\r
  background: var(--cor, var(--spro-fraco));\r
}\r
.spro-chip[aria-pressed="false"] {\r
  color: var(--spro-suave);\r
  background: transparent;\r
  border-color: var(--spro-borda-forte);\r
  border-style: dashed;\r
}\r
.spro-pilula {\r
  --tom: var(--spro-suave);\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 4px;\r
  min-height: 20px;\r
  max-width: 100%;\r
  padding: 0 7px;\r
  font-size: 11.5px;\r
  font-weight: 500;\r
  line-height: 1;\r
  white-space: nowrap;\r
  color: var(--tom);\r
  background: color-mix(in srgb, var(--tom) 11%, transparent);\r
  border-radius: 999px;\r
  box-sizing: border-box;\r
}\r
.spro-pilula > span {\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
\r
/* ---------- Seletor inteligente (combobox) ---------- */\r
.spro-combo {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 6px;\r
  box-sizing: border-box;\r
  min-height: 30px;\r
  min-width: 0;\r
  max-width: 100%;\r
  padding: 0 8px 0 10px;\r
  font: inherit;\r
  font-size: 13px;\r
  text-align: left;\r
  color: var(--spro-texto);\r
  background: var(--spro-fundo);\r
  border: 1px solid var(--spro-borda-forte);\r
  border-radius: var(--spro-raio);\r
  box-shadow: var(--spro-sombra-1);\r
  cursor: pointer;\r
  transition:\r
    background var(--spro-dur),\r
    border-color var(--spro-dur),\r
    box-shadow var(--spro-dur);\r
}\r
.spro-combo:hover {\r
  background: var(--spro-fundo-2);\r
}\r
.spro-combo > .spro-icone {\r
  color: var(--spro-suave);\r
}\r
.spro-combo > .spro-icone:last-child {\r
  margin-left: auto;\r
  color: var(--spro-fraco);\r
  transition: transform var(--spro-dur) var(--spro-curva);\r
}\r
.spro-combo-aberto {\r
  border-color: var(--spro-destaque);\r
  box-shadow: var(--spro-anel);\r
}\r
.spro-combo-aberto > .spro-icone:last-child {\r
  transform: rotate(180deg);\r
}\r
.spro-combo-ativo {\r
  color: var(--spro-destaque);\r
  background: var(--spro-destaque-suave);\r
  border-color: color-mix(in srgb, var(--spro-destaque) 45%, transparent);\r
}\r
.spro-combo-ativo:hover {\r
  background: var(--spro-destaque-medio);\r
}\r
.spro-combo-ativo > .spro-icone {\r
  color: inherit;\r
}\r
.spro-combo-texto {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 6px;\r
  min-width: 0;\r
  flex: 1 1 auto;\r
}\r
.spro-combo-rotulo {\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
.spro-combo-vazio {\r
  color: var(--spro-suave);\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
.spro-combo-mais {\r
  flex: none;\r
  padding: 1px 6px;\r
  font-size: 11px;\r
  font-weight: 600;\r
  color: var(--spro-destaque-texto);\r
  background: var(--spro-destaque);\r
  border-radius: 999px;\r
}\r
.spro-combo-cor {\r
  flex: none;\r
  width: 9px;\r
  height: 9px;\r
  border-radius: 50%;\r
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 12%);\r
}\r
.spro-combo-pop,\r
.spro-menu-pop {\r
  position: fixed;\r
  z-index: 2147483000;\r
  display: flex;\r
  flex-direction: column;\r
  box-sizing: border-box;\r
  overflow: hidden;\r
  font-family: var(--spro-fonte);\r
  font-size: 13px;\r
  color: var(--spro-texto);\r
  background: var(--spro-fundo);\r
  border: 1px solid var(--spro-borda);\r
  border-radius: var(--spro-raio-g);\r
  box-shadow: var(--spro-sombra-3);\r
  animation: spro-surgir 140ms var(--spro-curva);\r
  transform-origin: top center;\r
}\r
.spro-flutuante-cima {\r
  transform-origin: bottom center;\r
}\r
@keyframes spro-surgir {\r
  from {\r
    opacity: 0;\r
    transform: translateY(-4px) scale(0.98);\r
  }\r
}\r
.spro-combo-cabeca {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
  padding: 0 10px;\r
  color: var(--spro-fraco);\r
  border-bottom: 1px solid var(--spro-borda);\r
}\r
.spro-combo-busca {\r
  flex: 1;\r
  min-width: 0;\r
  height: 38px;\r
  padding: 0;\r
  font: inherit;\r
  color: var(--spro-texto);\r
  background: transparent;\r
  border: 0;\r
  outline: none;\r
}\r
.spro-combo-busca::placeholder {\r
  color: var(--spro-fraco);\r
}\r
.spro-combo-lista {\r
  flex: 1 1 auto;\r
  min-height: 0;\r
  margin: 0;\r
  padding: 4px;\r
  overflow: auto;\r
  list-style: none;\r
  outline: none;\r
  scrollbar-width: thin;\r
}\r
.spro-combo-op {\r
  display: flex;\r
  align-items: center;\r
  gap: 9px;\r
  padding: 6px 8px;\r
  border-radius: var(--spro-raio-p);\r
  cursor: pointer;\r
  user-select: none;\r
}\r
.spro-combo-op > .spro-icone {\r
  color: var(--spro-suave);\r
}\r
.spro-combo-op-ativa {\r
  background: var(--spro-fundo-3);\r
}\r
.spro-combo-op[aria-selected="true"] {\r
  font-weight: 600;\r
}\r
.spro-combo-op-textos {\r
  display: grid;\r
  gap: 1px;\r
  min-width: 0;\r
  flex: 1 1 auto;\r
}\r
.spro-combo-op-rotulo {\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
.spro-combo-op-rotulo mark {\r
  color: inherit;\r
  background: color-mix(in srgb, var(--spro-estrela) 35%, transparent);\r
  border-radius: 2px;\r
}\r
.spro-combo-op-desc {\r
  font-size: 11.5px;\r
  font-weight: 400;\r
  color: var(--spro-suave);\r
  white-space: normal;\r
}\r
.spro-combo-caixa {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  flex: none;\r
  width: 16px;\r
  height: 16px;\r
  box-sizing: border-box;\r
  color: var(--spro-destaque-texto);\r
  border: 1.5px solid var(--spro-borda-forte);\r
  border-radius: 5px;\r
  transition:\r
    background var(--spro-dur),\r
    border-color var(--spro-dur);\r
}\r
.spro-combo-op[aria-selected="true"] .spro-combo-caixa {\r
  background: var(--spro-destaque);\r
  border-color: var(--spro-destaque);\r
}\r
.spro-combo-caixa .spro-icone {\r
  stroke-width: 3;\r
}\r
.spro-combo-conta {\r
  flex: none;\r
  margin-left: auto;\r
  min-width: 18px;\r
  padding: 0 6px;\r
  font-size: 11px;\r
  font-weight: 500;\r
  font-variant-numeric: tabular-nums;\r
  text-align: center;\r
  color: var(--spro-suave);\r
  background: var(--spro-fundo-3);\r
  border-radius: 999px;\r
}\r
.spro-combo-marca {\r
  flex: none;\r
  margin-left: auto;\r
  display: inline-flex;\r
  color: var(--spro-destaque);\r
}\r
.spro-combo-conta + .spro-combo-marca {\r
  margin-left: 0;\r
}\r
.spro-combo-extras:empty {\r
  display: none;\r
}\r
.spro-combo-nada {\r
  margin: 0;\r
  padding: 14px 12px;\r
  text-align: center;\r
  color: var(--spro-suave);\r
}\r
.spro-combo-criar {\r
  all: unset;\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
  margin: 0 4px 4px;\r
  padding: 7px 8px;\r
  font-weight: 500;\r
  color: var(--spro-destaque);\r
  border-radius: var(--spro-raio-p);\r
  cursor: pointer;\r
}\r
.spro-combo-criar:hover,\r
.spro-combo-criar:focus-visible {\r
  background: var(--spro-destaque-suave);\r
}\r
.spro-combo-rodape {\r
  display: flex;\r
  align-items: center;\r
  gap: 4px;\r
  padding: 6px 6px 6px 12px;\r
  background: var(--spro-fundo-2);\r
  border-top: 1px solid var(--spro-borda);\r
}\r
.spro-combo-total {\r
  flex: 1;\r
  font-size: 12px;\r
  color: var(--spro-suave);\r
  white-space: nowrap;\r
}\r
.spro-combo-acao {\r
  all: unset;\r
  padding: 4px 8px;\r
  font-size: 12px;\r
  font-weight: 500;\r
  color: var(--spro-destaque);\r
  border-radius: var(--spro-raio-p);\r
  cursor: pointer;\r
}\r
.spro-combo-acao:hover,\r
.spro-combo-acao:focus-visible {\r
  background: var(--spro-destaque-suave);\r
}\r
.spro-combo-acao:disabled {\r
  color: var(--spro-fraco);\r
  pointer-events: none;\r
}\r
\r
/* ---------- Menu ---------- */\r
.spro-menu-pop {\r
  padding: 5px;\r
  overflow: auto;\r
}\r
.spro-menu-item {\r
  all: unset;\r
  display: flex;\r
  align-items: center;\r
  gap: 10px;\r
  padding: 7px 10px 7px 8px;\r
  border-radius: var(--spro-raio-p);\r
  cursor: pointer;\r
  white-space: nowrap;\r
}\r
.spro-menu-item:hover,\r
.spro-menu-item:focus {\r
  background: var(--spro-fundo-3);\r
}\r
.spro-menu-icone {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: 24px;\r
  height: 24px;\r
  flex: none;\r
  color: var(--spro-suave);\r
  background: var(--spro-fundo-2);\r
  border: 1px solid var(--spro-borda);\r
  border-radius: var(--spro-raio-p);\r
  box-sizing: border-box;\r
}\r
.spro-menu-item:hover .spro-menu-icone,\r
.spro-menu-item:focus .spro-menu-icone {\r
  color: var(--spro-destaque);\r
  background: var(--spro-fundo);\r
}\r
.spro-menu-rotulo {\r
  flex: 1;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
.spro-menu-dica {\r
  font-size: 11.5px;\r
  color: var(--spro-fraco);\r
  font-variant-numeric: tabular-nums;\r
}\r
.spro-menu-perigo {\r
  color: var(--spro-perigo);\r
}\r
.spro-menu-perigo .spro-menu-icone,\r
.spro-menu-perigo:hover .spro-menu-icone,\r
.spro-menu-perigo:focus .spro-menu-icone {\r
  color: var(--spro-perigo);\r
  background: color-mix(in srgb, var(--spro-perigo) 10%, transparent);\r
  border-color: color-mix(in srgb, var(--spro-perigo) 22%, transparent);\r
}\r
.spro-menu-sep {\r
  height: 1px;\r
  margin: 5px 6px;\r
  background: var(--spro-borda);\r
}\r
\r
/* ---------- Di\xE1logo ---------- */\r
dialog.spro-dialogo {\r
  box-sizing: border-box;\r
  width: min(580px, calc(100vw - 24px));\r
  max-width: none;\r
  max-height: min(calc(100vh - 32px), 820px);\r
  padding: 0;\r
  font-family: var(--spro-fonte);\r
  font-size: 13px;\r
  color: var(--spro-texto);\r
  background: var(--spro-fundo);\r
  border: 1px solid var(--spro-borda);\r
  border-radius: var(--spro-raio-xg);\r
  box-shadow: var(--spro-sombra-3);\r
  overflow: hidden;\r
}\r
dialog.spro-dialogo[open] {\r
  display: flex;\r
  flex-direction: column;\r
  animation: spro-dialogo-entrar 180ms var(--spro-curva);\r
}\r
@keyframes spro-dialogo-entrar {\r
  from {\r
    opacity: 0;\r
    transform: translateY(8px) scale(0.985);\r
  }\r
}\r
dialog.spro-dialogo::backdrop {\r
  background: var(--spro-veu);\r
  backdrop-filter: blur(2px);\r
}\r
dialog.spro-dialogo > header {\r
  display: flex;\r
  align-items: center;\r
  gap: 12px;\r
  padding: 16px 16px 12px 18px;\r
  flex: none;\r
}\r
.spro-dialogo-icone {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  flex: none;\r
  width: 34px;\r
  height: 34px;\r
  color: var(--spro-destaque);\r
  background: var(--spro-destaque-suave);\r
  border-radius: var(--spro-raio);\r
}\r
dialog.spro-dialogo > header h2 {\r
  flex: 1;\r
  min-width: 0;\r
  margin: 0;\r
  font-size: 15.5px;\r
  font-weight: 650;\r
  letter-spacing: -0.005em;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
.spro-dialogo-corpo {\r
  display: grid;\r
  gap: 12px;\r
  min-height: 0;\r
  padding: 2px 18px 18px;\r
  overflow: auto;\r
  scrollbar-width: thin;\r
}\r
.spro-dialogo-rodape {\r
  position: sticky;\r
  bottom: -18px;\r
  z-index: 1;\r
  display: flex;\r
  flex-wrap: wrap;\r
  justify-content: flex-end;\r
  gap: 8px;\r
  margin: 6px -18px -18px;\r
  padding: 12px 18px;\r
  background: var(--spro-fundo-2);\r
  border-top: 1px solid var(--spro-borda);\r
}\r
.spro-dialogo-rodape > .spro-esquerda {\r
  margin-right: auto;\r
}\r
\r
/* ---------- Aviso (toast) ---------- */\r
.spro-aviso {\r
  position: fixed;\r
  left: 50%;\r
  bottom: 16px;\r
  z-index: 2147483001;\r
  display: flex;\r
  align-items: center;\r
  gap: 12px;\r
  max-width: min(560px, calc(100vw - 24px));\r
  box-sizing: border-box;\r
  padding: 10px 10px 10px 14px;\r
  font-family: var(--spro-fonte);\r
  font-size: 13px;\r
  line-height: 1.35;\r
  color: #f3f5f8;\r
  background: #1f2329;\r
  border: 1px solid rgb(255 255 255 / 8%);\r
  border-radius: var(--spro-raio-g);\r
  box-shadow: var(--spro-sombra-3);\r
  transform: translateX(-50%);\r
  animation: spro-aviso-entrar 220ms var(--spro-curva);\r
}\r
/* Como popover (camada de cima, acima de di\xE1logo aberto): sem a posi\xE7\xE3o e a margem padr\xE3o do navegador. */\r
.spro-aviso[popover] {\r
  inset: auto auto 16px 50%;\r
  margin: 0;\r
  overflow: visible;\r
}\r
.spro-aviso > .spro-icone {\r
  color: #8fd6b4;\r
}\r
.spro-aviso > span {\r
  flex: 1;\r
}\r
@keyframes spro-aviso-entrar {\r
  from {\r
    opacity: 0;\r
    transform: translate(-50%, 10px);\r
  }\r
}\r
.spro-aviso button {\r
  flex: none;\r
  padding: 5px 10px;\r
  font: inherit;\r
  font-weight: 600;\r
  color: #9cc3ff;\r
  background: rgb(255 255 255 / 6%);\r
  border: 0;\r
  border-radius: var(--spro-raio-p);\r
  cursor: pointer;\r
}\r
.spro-aviso button:hover {\r
  background: rgb(255 255 255 / 12%);\r
}\r
\r
@media (prefers-reduced-motion: reduce) {\r
  .spro-combo-pop,\r
  .spro-menu-pop,\r
  dialog.spro-dialogo[open],\r
  .spro-aviso {\r
    animation: none;\r
  }\r
  * {\r
    transition-duration: 0ms !important;\r
  }\r
}\r
`;var To=`:host{all:initial}
.pb{box-sizing:border-box;width:340px;max-width:var(--pb-max,340px);display:grid;gap:8px;padding:12px 14px;font:13px/1.4 var(--spro-fonte);color:var(--spro-texto);background:var(--spro-fundo);border:1px solid var(--spro-borda);border-radius:12px;box-shadow:var(--spro-sombra-3)}
.pb-cab{display:flex;align-items:center;gap:10px}
.pb-ic{display:grid;place-items:center;width:32px;height:32px;flex:none;border-radius:8px;color:var(--spro-destaque);background:var(--spro-destaque-suave)}
.pb-tit{flex:1;min-width:0;display:grid;line-height:1.25}
.pb-tit b{font-size:13.5px}
.pb-tit small{color:var(--spro-suave);font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pb-vinc{display:grid;gap:4px;padding:8px 10px;border:1px solid var(--spro-borda);border-radius:10px}
.pb-proj{display:flex;align-items:center;gap:6px;min-width:0;color:var(--spro-suave);font-size:12px}
.pb-proj span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pb-etapa{display:flex;align-items:center;gap:8px;min-width:0;font-weight:600}
.pb-etapa .pb-nome{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pb-data{margin-left:auto;color:var(--spro-suave);font-size:12px;font-weight:400;white-space:nowrap}
.pb-atrasada .pb-data{color:var(--spro-perigo)}
.pb-mais,.pb-vazio{color:var(--spro-suave);font-size:12px}
.pb-botoes{display:flex;flex-wrap:wrap;gap:6px;padding-top:4px}
.pb-rod{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding-top:4px}
.pb-form{display:grid;gap:10px;padding-top:10px;border-top:1px solid var(--spro-borda)}
.pb-vinc .pb-form{padding-top:8px}
.pb-form-como{display:grid;gap:10px}
.pb-campo{display:grid;gap:5px}
.pb-rotulo{font-size:12px;font-weight:600;color:var(--spro-suave)}
.pb-linha2{display:flex;gap:8px}
.pb-linha2>*{flex:1;min-width:0}
.pb-campo .spro-campo{box-sizing:border-box;width:100%}
.pb-dica{margin:0;color:var(--spro-suave);font-size:12px}
.pb-ok{margin:0;color:var(--spro-ok);font-size:12px}
.pb-erro{margin:0;color:var(--spro-perigo);font-size:12px}
.pb-nota{margin:0;color:var(--spro-suave);font-size:12px}
.pb-erro:empty,.pb-nota:empty,.pb-slot:empty{display:none}
.pb-pergunta{display:grid;gap:8px;padding:8px 10px;border:1px solid color-mix(in srgb,var(--spro-aviso) 35%,transparent);border-radius:8px;background:color-mix(in srgb,var(--spro-aviso) 8%,var(--spro-fundo))}
.pb-pergunta p{margin:0}
.pb .spro-segmentado{justify-self:start;flex-wrap:wrap}
.prj-st{flex:none}
.prj-st .prj-st-cor{fill:none;stroke-width:1.6}
.prj-st-concluida .prj-st-cor,.prj-st-atrasada .prj-st-cor{stroke:none}
.prj-st-concluida .prj-st-cor{fill:var(--spro-ok)}
.prj-st-atrasada .prj-st-cor{fill:var(--spro-perigo)}
.prj-st-andamento .prj-st-cor{stroke:var(--spro-destaque)}
.prj-st-andamento .prj-st-meio{fill:var(--spro-destaque)}
.prj-st-futura .prj-st-cor{stroke:var(--spro-borda-forte);stroke-dasharray:2.4 2}
.prj-st-sinal{fill:none;stroke:var(--spro-fundo);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.prj-st-ponto{fill:var(--spro-fundo)}
.prj-st-marco.prj-st-andamento .prj-st-cor,.prj-st-marco.prj-st-futura .prj-st-cor{stroke:var(--spro-novidade);stroke-dasharray:none}
.prj-st-marco.prj-st-atrasada .prj-st-cor{fill:none;stroke:var(--spro-perigo)}`,io="button:not([disabled]), select, input, textarea, a[href]";function po(o,r,e){ao()?.fechar();let a=o.ownerDocument,s=a.defaultView,i=a.createElement("div");i.setAttribute("data-tema",e.temaEscuro?"escuro":"claro"),i.className="spro-prj-balao";let p=i.attachShadow({mode:"open"}),l=a.createElement("style");l.textContent=`${e.cssBase}
${To}`;let c=a.createElement("div");c.setAttribute("role","dialog"),c.setAttribute("aria-label",e.rotulo),c.append(r),p.append(l,c);let f=()=>c.querySelector(io)?.focus?.({preventScroll:!0}),w=x=>{let h=x.composedPath();!h.includes(i)&&!h.includes(o)&&n.fechar()},P=x=>{x.key==="Escape"&&n.fechar()},m=x=>{let h=x;if(h.key!=="Tab")return;let $=[...c.querySelectorAll(io)];if(!$.length)return;let L=h.shiftKey?$[0]:$[$.length-1];x.target===L&&(x.preventDefault(),n.fechar())},D=x=>{let h=x.relatedTarget;!h||typeof h.nodeType!="number"||h===i||p.contains(h)||h===o||o.contains(h)||n.fechar()};c.addEventListener("keydown",m),c.addEventListener("focusout",D);let k=!1,n={raiz:p,ancora:o,trocar(x){k||(c.replaceChildren(x),f())},fechar(){k||(k=!0,i.remove(),a.removeEventListener("pointerdown",w,!0),a.removeEventListener("keydown",P,!0),so(n),o.setAttribute("aria-expanded","false"),o.isConnected&&o.focus?.({preventScroll:!0}),e.aoFechar?.())}},d=o.getBoundingClientRect(),b=a.documentElement.clientWidth||s?.innerWidth||1024,u=Math.max(0,b-16),q=Math.max(8,Math.min(d.left,b-Math.min(340,u)-8))+(s?.scrollX??0),y=x=>{i.style.cssText=`position:absolute;z-index:2147483000;left:${Math.round(q)}px;top:${Math.round(x)}px;--pb-max:${u}px`};y(d.bottom+(s?.scrollY??0)+6),a.body.append(i);let v=i.getBoundingClientRect().height,z=a.documentElement.clientHeight||s?.innerHeight||0;return v&&z&&d.bottom+6+v>z&&d.top-6-v>0&&y(d.top+(s?.scrollY??0)-6-v),a.addEventListener("pointerdown",w,!0),a.addEventListener("keydown",P,!0),o.setAttribute("aria-expanded","true"),to(n),f(),n}function co(o){let r=o,e=`${typeof r?.name=="string"?r.name:""} ${typeof r?.message=="string"?r.message:typeof o=="string"?o:""}`;return/quota/i.test(e)}var $o="O navegador n\xE3o tem mais espa\xE7o para guardar as demandas. Arquive as conclu\xEDdas antigas e exporte o arquivo morto.";function B(o){return o instanceof g||o instanceof oo?o.message:co(o)?$o:o instanceof Error?o.message:String(o)}function U(o,r,e){return`${o} ${o===1?r:e}`}function M(o){if(!/^\d{4}-\d{2}-\d{2}$/.test(o))return null;let r=Number(o.slice(0,4));return r<2e3||r>2100?null:_(Q(o))===o?o:null}function lo(o){if(o===void 0)return"";let r=Math.floor(o/60),e=o%60;return r?e?`${r}h${String(e).padStart(2,"0")}`:`${r}h`:`${e}min`}function uo(o){let r=o.trim().toLowerCase().replace(/\s+/g,"");if(!r)return;let e=/^(\d+)(?:h|:)(\d{1,2})(?:min)?$/.exec(r);return e?Number(e[2])>59?null:Number(e[1])*60+Number(e[2]):(e=/^(\d+)h$/.exec(r),e?Number(e[1])*60:(e=/^(\d+)(?:min)?$/.exec(r),e?Number(e[1]):null))}var mo={nao_iniciada:"N\xE3o iniciada",iniciada:"Iniciada",pausada:"Pausada",concluida:"Conclu\xEDda",avaliada:"Avaliada",arquivada:"Arquivada"};function fo(o,r){switch(o.prazo){case"atrasada":return`Atrasada h\xE1 ${U(o.diasAtraso,"dia","dias")}`;case"concluida_no_prazo":return"Entregue no prazo";case"concluida_fora_do_prazo":return"Entregue com atraso";default:return r===void 0?"No prazo":o.demanda.prazo===r?"Vence hoje":`Vence em ${U(H(r,o.demanda.prazo),"dia","dias")}`}}var Ao=o=>o==="unidade"?"Toda a unidade":"S\xF3 eu";function No(o){let r=typeof o.protocolo=="string"?o.protocolo.trim():"";if(!J.test(r)||!O(r))throw new g("processos","N\xE3o foi poss\xEDvel ler o n\xFAmero deste processo na tela do SEI.");let e={protocolo:r};return o.idProcedimento&&Z.test(o.idProcedimento)&&(e.idProcedimento=o.idProcedimento),o.sigiloso&&(e.sigiloso=!0),e}function Ro(o,r){let e=(o??"").replace(/\s*\(\d{5,20}\)\s*$/,"").trim();return r&&e.endsWith(r)&&(e.length===r.length||/\s/.test(e[e.length-r.length-1]??""))&&(e=e.slice(0,e.length-r.length).trim()),e}function bo(o,r){if(r?.sigiloso)return"";let e=r?Ro(r.titulo,r.numero):"";return o.sigiloso?e.slice(0,T.titulo):(r?`${e} ${r.numero}`.trim():(o.tipo??"").trim()).slice(0,T.titulo)}function Oo(o,r,e){let a=o.numero.trim();if(!a)return;if(!K.test(a))throw new g("documento","N\xFAmero de documento inv\xE1lido (s\xF3 d\xEDgitos, at\xE9 20).");let s={numero:a},i=o.titulo.trim().slice(0,T.titulo);return i&&(s.titulo=i),(r.sigiloso||e?.numero===a&&e.sigiloso)&&(s.sigiloso=!0),s}async function go(o,r,e){let a=M(r.prazo);if(!a)throw new g("prazo","Informe um prazo v\xE1lido (dia/m\xEAs/ano).");let s=No(r.processo),i=o[r.vis],p=r.vis==="eu"?e:r.responsavel,l=await i.criar({titulo:r.titulo,...p?{responsavel:p}:{},prazo:a,prioridade:r.prioridade,processos:[s]});return s.sigiloso&&await i.marcarSigilosos([s.protocolo]).catch(()=>{}),`Demanda \u201C${l.titulo}\u201D criada (${Ao(r.vis)}), prazo ${C(l.prazo)}.`}async function vo(o,r,e){let a=await o[r].obter(e);if(!a)throw new g("id","Esta demanda n\xE3o existe mais.");if(V(a)!=="nao_iniciada")throw new g("situacao","Esta demanda j\xE1 foi iniciada.");return`\u201C${(await o[r].aplicar(e,(i,p)=>ro(i,p))).titulo}\u201D iniciada.`}async function xo(o,r,e,a,s,i){let p=M(a.data);if(!p)throw new g("data","Informe uma data de conclus\xE3o v\xE1lida.");let l=uo(a.tempo);if(l===null)throw new g("tempo","Tempo gasto inv\xE1lido. Use 1h30, 1:30, 45min ou s\xF3 os minutos.");let c=Oo(a,s,i),f=await o[r].obter(e);if(!f)throw new g("id","Esta demanda n\xE3o existe mais.");let w=V(f);if(w!=="iniciada"&&w!=="pausada")throw new g("situacao","S\xF3 uma demanda iniciada ou pausada pode ser conclu\xEDda.");if(p<f.distribuidaEm)throw new g("data",`A conclus\xE3o n\xE3o pode ser antes da distribui\xE7\xE3o (${C(f.distribuidaEm)}).`);let P=a.observacao.trim();return`\u201C${(await o[r].aplicar(e,(D,k)=>eo(D,{data:p,...l!==void 0?{tempoGastoMin:l}:{},...P?{observacao:P}:{},...c?{documento:c}:{}},k))).titulo}\u201D conclu\xEDda em ${C(p)}.`}var Mo=new Set(["criar","editar","aplicar","arquivarVarias","descartar","remover","restaurar","duplicar","reordenar","importar"]),j="consentimento",ho="Sem o \u201CEntendi\u201D, as demandas de \u201CToda a unidade\u201D n\xE3o mudam. Para uma demanda s\xF3 sua, escolha \u201CS\xF3 eu\u201D.",jo="N\xE3o foi poss\xEDvel ler a sua confirma\xE7\xE3o. Tente de novo.",Io="N\xE3o foi poss\xEDvel guardar a sua confirma\xE7\xE3o. Tente de novo.",wo=o=>o instanceof g&&o.campo===j&&o.message===ho;async function Lo(o){try{return await o.estado()}catch(r){throw console.warn("[SEI Pro] demandas: consentimento n\xE3o lido:",r instanceof Error?r.message:String(r)),new g(j,jo)}}function yo(o,r){return new Proxy(o,{get(e,a,s){let i=Reflect.get(e,a,s);if(typeof i!="function")return i;let p=i.bind(e);return typeof a!="string"||!Mo.has(a)?p:async(...l)=>{if(!await r())throw new g(j,ho);return p(...l)}}})}function Eo(o,r){let e=null;return async()=>await Lo(o)==="ligado"?!0:(e??=(async()=>{try{let a=await r();if(a)try{await o.definir("ligado")}catch(s){throw console.warn("[SEI Pro] demandas: consentimento n\xE3o gravado:",s instanceof Error?s.message:String(s)),new g(j,Io)}return a}finally{e=null}})(),e)}var F=5,_o="Nada foi gravado: as demandas de \u201CToda a unidade\u201D s\xF3 mudam depois do \u201CEntendi\u201D.";function G(){let o=t("p",{class:"pb-erro",role:"alert"}),r=t("p",{class:"pb-nota",role:"status"});return{erro:o,nota:r,limpar(){o.textContent="",r.textContent=""},mostrar(e){wo(e)?r.textContent=_o:o.textContent=B(e)}}}var Ho=o=>o?.focus?.({preventScroll:!0}),ko=new WeakMap,R=(o,r,e,...a)=>t("button",{type:"button",class:r,onclick:e},...a,o),S=(o,r)=>t("label",{class:"pb-campo"},t("span",{class:"pb-rotulo"},o),r),I=(o,r,e=!1)=>t("option",{value:o,selected:e},r);function Do(o,r){let e=()=>{},a=new Promise(c=>{e=c}),s=o.querySelector(".pb-slot");if(!s)return e(!1),{resposta:a,cancelar:()=>{}};let i=!1,p=c=>{if(i)return;i=!0,s.replaceChildren(),e(c);let f=ko.get(o);f?.isConnected&&f.focus?.({preventScroll:!0})},l=R("Entendi","spro-botao primario pequeno",()=>p(!0));return s.replaceChildren(t("div",{class:"pb-pergunta",role:"alert"},t("p",{},`As demandas de \u201CToda a unidade\u201D ficam guardadas no pr\xF3prio SEI, num Texto Padr\xE3o da ${r}: todos da unidade que usam o SEI Pro veem e editam. O n\xFAmero de processo sigiloso n\xE3o vai.`),t("p",{},Vo),t("div",{class:"pb-botoes"},l,R("Agora n\xE3o","spro-botao pequeno",()=>p(!1))))),l.focus?.({preventScroll:!0}),{resposta:a,cancelar:()=>p(!1)}}var Vo="N\xE3o escreva dados sigilosos no t\xEDtulo ou na descri\xE7\xE3o: ficam no Texto Padr\xE3o e todos da unidade os leem.";function Bo(o,r){let e=new Set,a=[];for(let s of[o,...r]){let i=(s.login??s.nome).trim().toLowerCase();!i||!s.nome.trim()||e.has(i)||(e.add(i),a.push(s.login?{login:s.login,nome:s.nome}:{nome:s.nome}))}return a}function Po(o,r){let e=t("div",{class:"pb"}),a=null,s=o.ligadas.length===0,i=t("div",{class:"pb-slot"}),p=null,l=null,c=(n,d)=>{p===n&&!l&&(l=d)},f=(n,d,...b)=>{let u=R(n,"spro-botao primario pequeno",()=>{ko.set(e,u),d()},...b);return u},w=n=>`${n.vis}:${n.demanda.id}`,P=n=>{let d=G(),b=t("input",{class:"spro-campo",type:"date",name:"data",value:o.hoje}),u=t("input",{class:"spro-campo",type:"text",name:"tempo",placeholder:"1h30",value:lo(n.demanda.tempoGastoMin)}),q=t("textarea",{class:"spro-campo",name:"observacao",rows:"2",maxlength:String(T.observacao)}),y=t("input",{class:"spro-campo",type:"text",name:"numero",inputmode:"numeric",placeholder:"N\xFAmero SEI",maxlength:"30",value:o.documento?.numero??""}),v=t("input",{class:"spro-campo",type:"text",name:"titulo",maxlength:String(T.titulo),placeholder:"T\xEDtulo do documento",value:o.documento?.titulo??""});c(`concluir:${w(n)}`,b);let z=()=>{d.limpar(),r.concluir(n.vis,n.demanda.id,{data:b.value,tempo:u.value,observacao:q.value,numero:y.value,titulo:v.value}).catch(d.mostrar)};return t("div",{class:"pb-form","data-concluir":n.demanda.id},t("b",{},"Concluir com este documento"),t("div",{class:"pb-linha2"},S("Conclu\xEDda em",b),S("Tempo gasto (opcional)",u)),S("N\xFAmero SEI do documento entregue",y),S("T\xEDtulo do documento (opcional)",v),S("Observa\xE7\xE3o (opcional)",q),o.documento?null:t("p",{class:"pb-dica"},"Nenhum documento aberto: informe o n\xFAmero ou deixe em branco."),d.erro,d.nota,t("div",{class:"pb-rod"},R("Voltar","spro-botao pequeno",()=>{a=null,k(`voltar:${w(n)}`)}),f("Concluir",z,N("check",13))))},m=n=>{let d=w(n),b=G(),u=n.demanda,q=n.situacao==="iniciada"||n.situacao==="pausada",y=[];if(n.situacao==="nao_iniciada"&&y.push(f("Iniciar",()=>{b.limpar(),r.iniciar(n.vis,u.id).catch(b.mostrar)})),q){let v=R("Concluir com este documento\u2026","spro-botao primario pequeno",()=>{a=d,k(`concluir:${d}`)},N("documento",13));c(`voltar:${d}`,v),y.push(v)}return y.push(R("Abrir no painel","spro-botao pequeno",()=>r.abrirNoPainel(u.id))),t("div",{class:`pb-vinc${n.prazo==="atrasada"?" pb-atrasada":""}`,"data-demanda":u.id},t("div",{class:"pb-proj",title:Y(n.vis)},N(n.vis==="unidade"?"predio":"pessoa",13),t("span",{},`${mo[n.situacao]}${u.responsavel?` \xB7 ${u.responsavel.nome}`:""}`)),t("div",{class:"pb-etapa"},t("span",{class:"pb-nome"},u.titulo),t("span",{class:"pb-data"},`${fo(n,o.hoje)} \xB7 ${C(u.prazo)}`)),a===d?P(n):t("div",{class:"pb-botoes"},...y),a===d?null:b.erro,a===d?null:b.nota)},D=()=>{let n=G(),d=Bo(o.eu,o.usuarios),b=t("input",{class:"spro-campo",type:"text",name:"titulo",maxlength:String(T.titulo),placeholder:"T\xEDtulo da demanda",value:bo(o.processo,o.documento)}),u=t("select",{class:"spro-campo",name:"responsavel"},...d.map((E,A)=>I(String(A),A===0?`${E.nome} (eu)`:E.nome,A===0))),q=t("input",{class:"spro-campo",type:"date",name:"prazo",value:o.hoje}),y=t("select",{class:"spro-campo",name:"prioridade"},I("normal","Normal",!0),I("importante","Importante"),I("urgente","Urgente")),v="unidade",z=[["unidade","Toda a unidade"],["eu","S\xF3 eu"]],x=z.map(([E,A])=>t("button",{type:"button","aria-pressed":String(v===E),onclick:()=>{v=E,h()}},A)),h=()=>{x.forEach((E,A)=>{let X=String(z[A]?.[0]===v);E.getAttribute("aria-pressed")!==X&&E.setAttribute("aria-pressed",X)}),v==="eu"?u.setAttribute("disabled",""):u.removeAttribute("disabled")};c("nova",b);let $=()=>{n.limpar();let E=d[Number(u.value)]??o.eu;r.criar({vis:v,titulo:b.value,prazo:q.value,prioridade:y.value,...v==="unidade"?{responsavel:E}:{},processo:o.processo}).catch(n.mostrar)};b.addEventListener("keydown",E=>{E.key==="Enter"&&(E.preventDefault(),$())});let L=t("div",{class:"pb-form","data-nova":"1"},t("b",{},"Nova demanda deste processo"),S("T\xEDtulo",b),o.processo.sigiloso?t("p",{class:"pb-dica"},"Processo sigiloso: o n\xFAmero dele n\xE3o vai ao Texto Padr\xE3o da unidade."):t("p",{class:"pb-dica"},`Processo ${o.processo.protocolo}`),t("div",{class:"pb-linha2"},S("Respons\xE1vel",u),S("Prazo",q)),t("div",{class:"pb-linha2"},S("Prioridade",y)),t("div",{class:"pb-campo"},t("span",{class:"pb-rotulo"},"Quem v\xEA"),t("div",{class:"spro-segmentado",role:"group","aria-label":"Quem v\xEA"},...x)),n.erro,n.nota,t("div",{class:"pb-rod"},f("Criar demanda",$,N("mais",13))));return h(),L};function k(n=null){p=n,l=null;let d=o.ligadas.length,b=[t("div",{class:"pb-cab"},t("span",{class:"pb-ic"},N("demandas",17)),t("span",{class:"pb-tit"},t("b",{},"Demandas deste processo"),t("small",{},o.processo.protocolo)),t("button",{type:"button",class:"spro-botao-icone pequeno","aria-label":"Fechar",title:"Fechar (Esc)",onclick:()=>r.fechar()},N("fechar",14))),o.mensagem?t("p",{class:"pb-ok",role:"status"},o.mensagem):null,i,...o.ligadas.slice(0,F).map(m),d>F?t("div",{class:"pb-mais"},`e mais ${d-F}`):null,d?null:t("p",{class:"pb-dica"},"Este processo ainda n\xE3o tem demanda."),s?D():t("div",{class:"pb-rod"},R("Nova demanda deste processo","spro-botao pequeno",()=>{s=!0,k("nova")}))];e.replaceChildren(...b.filter(u=>u!==null)),p&&Ho(l),p=null,l=null}return k(),e}async function qo(o,r,e){let a=r.hoje(),s=O(o.processo.protocolo),[i,p]=await Promise.all([W(r.repos,a),r.usuarios().catch(()=>[])]),l={processo:o.processo,documento:o.documento,ligadas:i.filter(c=>c.situacao!=="arquivada"&&c.demanda.processos.some(f=>!!f.protocolo&&O(f.protocolo)===s)),hoje:a,eu:r.eu,usuarios:p};return e&&(l.mensagem=e),l}async function So(o,r,e){let a=null,s=null,i=null,p=!1,l=()=>{if(p||!s)return Promise.resolve(!1);let m=Do(s,e.sigla);return i=m,m.resposta.finally(()=>{i===m&&(i=null)})},c={unidade:yo(e.repos.unidade,Eo(e.consentimento,l)),eu:e.repos.eu},f=m=>(s=Po(m,P),s),w=async m=>{let D=await qo(r,e,m);return p||a?.trocar(f(D)),m},P={fechar:()=>a?.fechar(),abrirNoPainel:m=>{a?.fechar(),e.abrirNoPainel(m)},criar:async m=>w(await go(c,m,e.eu)),iniciar:async(m,D)=>w(await vo(c,m,D)),concluir:async(m,D,k)=>w(await xo(c,m,D,k,r.processo,r.documento))};return a=po(o,f(await qo(r,e)),{cssBase:e.cssBase,temaEscuro:e.temaEscuro,rotulo:`Demandas do processo ${r.processo.protocolo}`,aoFechar:()=>{p=!0,i?.cancelar()}}),a}var jr=(o,r,e)=>So(o,r,{...e,cssBase:no});export{jr as abrirBalao};
