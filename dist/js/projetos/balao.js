/* GERADO por projetos/build.mjs. NAO EDITE ESTE ARQUIVO. Rode: npm run build */
import{Ea as lo,Ha as uo,I as A,Ia as mo,Ja as fo,L as ao,M as to,N as so,P as no,Q as w,W as io,a as Z,b as oo,d as a,e as $,g as L,ja as po,ka as co,s as V,sa as F,w as ro,z as eo}from"./pagina-comum.js";var bo=`/*\r
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
`;var Lo=new Set(["criarProjeto","editarProjeto","arquivarProjeto","reativarProjeto","removerProjeto","restaurarProjeto","duplicarProjeto","criarFase","renomearFase","removerFase","criarEtapa","duplicarEtapa","editarEtapa","moverDatas","concluirEtapa","concluirSeAberta","reabrirEtapa","removerEtapa","restaurarEtapa","redefinirPlanoOriginal","criarProjetoDeModelo","salvarComoModelo","renomearModelo","removerModelo","importar","anotarVisibilidade"]),G="Sem o \u201CEntendi\u201D, os projetos de \u201CToda a unidade\u201D n\xE3o mudam. Para um projeto s\xF3 seu, escolha \u201CS\xF3 eu\u201D.",Vo="N\xE3o foi poss\xEDvel guardar a sua confirma\xE7\xE3o. Tente de novo.",_o="N\xE3o foi poss\xEDvel guardar a sua escolha. Tente de novo.",Ho="N\xE3o foi poss\xEDvel ler a sua confirma\xE7\xE3o. Tente de novo.";async function Bo(o){try{return await o.estado()}catch(r){throw console.warn("[SEI Pro] projetos: consentimento n\xE3o lido:",r instanceof Error?r.message:String(r)),new w([Ho])}}async function Fo(o,r){try{await o.definir(r)}catch(e){throw console.warn("[SEI Pro] projetos: consentimento n\xE3o gravado:",e instanceof Error?e.message:String(e)),new w([r==="ligado"?Vo:_o])}}function go(o,r){return new Proxy(o,{get(e,t,i){let s=Reflect.get(e,t,i);if(typeof s!="function")return s;let p=s.bind(e);return typeof t!="string"||!Lo.has(t)?p:async(...l)=>{if(!await r())throw new w([G]);return p(...l)}}})}function xo(o,r){let e=null;return async()=>await Bo(o)==="ligado"?!0:(e??=(async()=>{try{let t=await r();return t&&await Fo(o,"ligado"),t}finally{e=null}})(),e)}function U(o){if(!/^\d{4}-\d{2}-\d{2}$/.test(o))return null;let r=Number(o.slice(0,4));return r<2e3||r>2100?null:Z(oo(o))===o?o:null}function Go(o){let r=typeof o.protocolo=="string"?o.protocolo.trim():"";if(!ao.test(r)||!A(r))throw new w(["N\xE3o foi poss\xEDvel ler o n\xFAmero deste processo na tela do SEI."]);let e={protocolo:r};return typeof o.idProcedimento=="string"&&to.test(o.idProcedimento)&&(e.idProcedimento=o.idProcedimento),o.sigiloso===!0&&(e.sigiloso=!0),e}var X="Este j\xE1 \xE9 o processo do projeto.";async function ho(o,r,e){let t=Go(r.processo),i=o[r.vis],s=await i.obterProjeto(r.projeto);if(!s)throw new w(["O projeto n\xE3o existe mais."]);if(r.como==="projeto"){let E=s.processo;return typeof E?.protocolo=="string"&&A(E.protocolo)===A(t.protocolo)?X:(await i.editarProjeto(s.id,{processo:t}),`Este \xE9 agora o processo do projeto \u201C${s.nome}\u201D.`)}if(r.como==="ligar"){let E=r.etapa?await i.obterEtapa(r.etapa):void 0;if(!E||E.projeto!==s.id)throw new w(["Escolha a etapa."]);if(E.concluidaEm)throw new w(["Esta etapa j\xE1 foi conclu\xEDda."]);return await i.editarEtapa(E.id,{processo:t},e),`Processo ligado \xE0 etapa \u201C${E.nome}\u201D.`}let p=(r.nome??"").trim();if(!p)throw new w(["Informe o nome da etapa."]);let l=U(r.inicio??"");if(!l)throw new w(["Escolha a data de in\xEDcio (entre 2000 e 2100)."]);let c=Number(r.duracao);if(!Number.isInteger(c)||c<1||c>V)throw new w([`A dura\xE7\xE3o vai de 1 a ${V} dias \xFAteis.`]);return`Etapa \u201C${(await i.criarEtapa({projeto:s.id,nome:p,inicio:l,fim:eo(l,c),processo:t})).nome}\u201D adicionada a \u201C${s.nome}\u201D.`}var vo="Esta etapa j\xE1 foi conclu\xEDda (ou n\xE3o existe mais).";async function wo(o,r,e,t,i){let s=U(i);if(!s)throw new w(["Escolha a data da conclus\xE3o (entre 2000 e 2100)."]);let p;if(t?.numero){p={numero:t.numero.trim()};let m=t.titulo?.trim().slice(0,L.nome);m&&(p.titulo=m)}if(p){let m=io(p);if(m.length)throw new w(m)}let l=await o[r].obterEtapa(e);if(!l||l.concluidaEm)throw new w([vo]);let c=await o[r].concluirSeAberta(e,s,p);if(!c)throw new w([vo]);return`\u201C${c.nome}\u201D ${c.marco?"cumprido":"conclu\xEDda"} em ${s.split("-").reverse().join("/")}.`}var Uo=`:host{all:initial}
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
.prj-st-marco.prj-st-atrasada .prj-st-cor{fill:none;stroke:var(--spro-perigo)}`,jo="button:not([disabled]), select, input, textarea, a[href]";function Eo(o,r,e){uo()?.fechar();let t=o.ownerDocument,i=t.defaultView,s=t.createElement("div");s.setAttribute("data-tema",e.temaEscuro?"escuro":"claro"),s.className="spro-prj-balao";let p=s.attachShadow({mode:"open"}),l=t.createElement("style");l.textContent=`${e.cssBase}
${Uo}`;let c=t.createElement("div");c.setAttribute("role","dialog"),c.setAttribute("aria-label",e.rotulo),c.append(r),p.append(l,c);let m=()=>c.querySelector(jo)?.focus?.({preventScroll:!0}),E=g=>{let P=g.composedPath();!P.includes(s)&&!P.includes(o)&&n.fechar()},R=g=>{g.key==="Escape"&&n.fechar()},v=g=>{let P=g;if(P.key!=="Tab")return;let D=[...c.querySelectorAll(jo)];if(!D.length)return;let I=P.shiftKey?D[0]:D[D.length-1];g.target===I&&(g.preventDefault(),n.fechar())},q=g=>{let P=g.relatedTarget;!P||typeof P.nodeType!="number"||P===s||p.contains(P)||P===o||o.contains(P)||n.fechar()};c.addEventListener("keydown",v),c.addEventListener("focusout",q);let C=!1,n={raiz:p,ancora:o,trocar(g){C||(c.replaceChildren(g),m())},fechar(){C||(C=!0,s.remove(),t.removeEventListener("pointerdown",E,!0),t.removeEventListener("keydown",R,!0),fo(n),o.setAttribute("aria-expanded","false"),o.isConnected&&o.focus?.({preventScroll:!0}),e.aoFechar?.())}},d=o.getBoundingClientRect(),f=t.documentElement.clientWidth||i?.innerWidth||1024,j=Math.max(0,f-16),x=Math.max(8,Math.min(d.left,f-Math.min(340,j)-8))+(i?.scrollX??0),b=g=>{s.style.cssText=`position:absolute;z-index:2147483000;left:${Math.round(x)}px;top:${Math.round(g)}px;--pb-max:${j}px`};b(d.bottom+(i?.scrollY??0)+6),t.body.append(s);let k=s.getBoundingClientRect().height,y=t.documentElement.clientHeight||i?.innerHeight||0;return k&&y&&d.bottom+6+k>y&&d.top-6-k>0&&b(d.top+(i?.scrollY??0)-6-k),t.addEventListener("pointerdown",E,!0),t.addEventListener("keydown",R,!0),o.setAttribute("aria-expanded","true"),mo(n),m(),n}var Xo="O espa\xE7o do navegador para o SEI Pro est\xE1 cheio. Arquive ou exclua projetos antigos.";function Jo(o){let r=o,e=`${typeof r?.name=="string"?r.name:""} ${typeof r?.message=="string"?r.message:typeof o=="string"?o:""}`;return/quota/i.test(e)}function yo(o){let r=o?.mensagens;return Array.isArray(r)&&r.length?r.map(String).join(" "):Jo(o)?Xo:o instanceof Error?o.message:String(o)}var Po="http://www.w3.org/2000/svg",Yo={modelo:[["rect",{x:"4",y:"4",width:"16",height:"16",rx:"2"}],["path",{d:"M4 9.5h16M9.5 9.5V20"}]],checklist:[["path",{d:"m4 7 2 2 3.5-3.5M4 15l2 2 3.5-3.5M13 8h7M13 16h7"}]],progresso:[["path",{d:"M4 12a8 8 0 1 0 8-8"}],["path",{d:"M12 4v8l5 3"}]],voltar:[["path",{d:"m15 6-6 6 6 6"}]],abrir:[["path",{d:"M14 4h6v6M20 4l-9 9"}],["path",{d:"M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"}]]};function ko(o,r,e){let t=document.createElementNS(Po,"svg"),i={viewBox:r,width:String(o),height:String(o),"aria-hidden":"true",focusable:"false",...e};for(let[s,p]of Object.entries(i))t.setAttribute(s,p);return t}function M(o,r){let e=document.createElementNS(Po,o);for(let[t,i]of Object.entries(r))e.setAttribute(t,i);return e}function J(o,r=18){let e=ko(r,"0 0 24 24",{fill:"none",stroke:"currentColor","stroke-width":"1.8","stroke-linecap":"round","stroke-linejoin":"round",class:"spro-icone"});for(let[t,i]of Yo[o])e.append(M(t,i));return e}function So(o,r){let e=ko(16,"0 0 16 16",{class:`prj-st prj-st-${o}${r?" prj-st-marco":""}`});return r?(e.append(M("path",{class:"prj-st-cor",d:o==="concluida"?"M8 1.5 14.5 8 8 14.5 1.5 8z":"M8 2 14 8 8 14 2 8z"})),e):(o==="concluida"?e.append(M("circle",{class:"prj-st-cor",cx:"8",cy:"8",r:"7"}),M("path",{class:"prj-st-sinal",d:"m4.8 8.2 2.1 2.1 4.3-4.4"})):o==="atrasada"?e.append(M("circle",{class:"prj-st-cor",cx:"8",cy:"8",r:"7"}),M("path",{class:"prj-st-sinal",d:"M8 4.2v4.6"}),M("circle",{class:"prj-st-ponto",cx:"8",cy:"11.4",r:"1"})):o==="andamento"?e.append(M("circle",{class:"prj-st-cor",cx:"8",cy:"8",r:"6.2"}),M("path",{class:"prj-st-meio",d:"M8 1.8a6.2 6.2 0 0 1 0 12.4z"})):e.append(M("circle",{class:"prj-st-cor",cx:"8",cy:"8",r:"6.2"})),e)}var Y=4,Ko="Nada foi gravado: os projetos de \u201CToda a unidade\u201D s\xF3 mudam depois do \u201CEntendi\u201D.",Wo=o=>o instanceof w&&o.mensagens.length===1&&o.mensagens[0]===G;function Co(){let o=a("p",{class:"pb-erro",role:"alert"}),r=a("p",{class:"pb-nota",role:"status"});return{erro:o,nota:r,limpar(){o.textContent="",r.textContent=""},mostrar(e){Wo(e)?r.textContent=Ko:o.textContent=yo(e)}}}var Qo=o=>o?.focus?.({preventScroll:!0}),qo=new WeakMap,N=(o,r,e,...t)=>a("button",{type:"button",class:r,onclick:e},...t,o),O=(o,r)=>a("label",{class:"pb-campo"},a("span",{class:"pb-rotulo"},o),r),_=(o,r,e=!1)=>a("option",{value:o,selected:e},r),Ao=o=>ro(o.fim)?o.fim:"9999-12-31",Mo=o=>o.etapas.filter(r=>!r.concluidaEm).sort((r,e)=>Ao(r).localeCompare(Ao(e)));function Zo(o){return o.sigiloso?"":(o.especificacao||o.tipo||"").trim().slice(0,L.nome)}function Do(o,r){let e=()=>{},t=new Promise(c=>{e=c}),i=o.querySelector(".pb-slot");if(!i)return e(!1),{resposta:t,cancelar:()=>{}};let s=!1,p=c=>{if(s)return;s=!0,i.replaceChildren(),e(c);let m=qo.get(o);m?.isConnected&&m.focus?.({preventScroll:!0})},l=N("Entendi","spro-botao primario pequeno",()=>p(!0));return i.replaceChildren(a("div",{class:"pb-pergunta",role:"alert"},a("p",{},`Os projetos de \u201CToda a unidade\u201D ficam guardados no pr\xF3prio SEI, num Texto Padr\xE3o da ${r}: todos da unidade que usam o SEI Pro veem e editam. O n\xFAmero de processo sigiloso n\xE3o vai.`),a("div",{class:"pb-botoes"},l,N("Agora n\xE3o","spro-botao pequeno",()=>p(!1))))),l.focus?.({preventScroll:!0}),{resposta:t,cancelar:()=>p(!1)}}function Oo(o,r){let e=a("div",{class:"pb"}),t=null,i=o.modo==="arvore",s=a("div",{class:"pb-slot"}),p=null,l=null,c=(n,d)=>{p===n&&!l&&(l=d)},m=(n,d,...f)=>{let j=N(n,"spro-botao primario pequeno",()=>{qo.set(e,j),d()},...f);return j},E=(n,d)=>{let f=Co(),j=a("select",{class:"spro-campo",name:"etapa"},...d.map((y,g)=>_(y.id,y.nome,g===0))),x=a("select",{class:"spro-campo",name:"documento"},_("",o.documentos.length?"(sem documento)":"Nenhum documento na \xE1rvore",!0),...o.documentos.map(y=>_(y.numero,`${y.titulo} (${y.numero})`))),b=a("input",{class:"spro-campo",type:"date",name:"data",value:o.hoje});c("concluir",d.length>1?j:x);let k=()=>{let y=o.documentos.find(g=>g.numero===x.value);f.limpar(),r.concluir(n.vis,j.value,y?{numero:y.numero,titulo:y.titulo}:void 0,b.value).catch(f.mostrar)};return a("div",{class:"pb-form"},d.length>1?O("Etapa",j):a("p",{class:"pb-dica"},`Concluir \u201C${d[0]?.nome??""}\u201D`),O("Documento",x),O("Conclu\xEDda em",b),f.erro,f.nota,a("div",{class:"pb-rod"},N("Cancelar","spro-botao pequeno",()=>{t=null,C(`voltar:${n.vis}:${n.projeto.id}`)}),m("Concluir",k,$("check",13))))},R=n=>{let d=N("Concluir com documento\u2026","spro-botao primario pequeno",()=>{t=n,C("concluir")},$("documento",13));return c(`voltar:${n}`,d),d},v=(n,d)=>{let f=Mo(n),j=n.papel==="projeto"?"processo do projeto":n.etapas.length===1?"etapa":"etapas",x=`${n.vis}:${n.projeto.id}`;return a("div",{class:"pb-vinc","data-projeto":n.projeto.id},a("div",{class:"pb-proj",title:F(n.vis)},$(n.vis==="unidade"?"predio":"pessoa",13),a("span",{},`${n.projeto.nome} \xB7 ${j}`)),...f.slice(0,Y).map(b=>{let k=po(b,o.hoje);return a("div",{class:`pb-etapa${k==="atrasada"?" pb-atrasada":""}`,"data-etapa":b.id},So(k,b.marco),a("span",{class:"pb-nome"},b.nome),a("span",{class:"pb-data"},lo(b,o.hoje)))}),f.length>Y?a("div",{class:"pb-mais"},`e mais ${f.length-Y}`):null,f.length?null:a("div",{class:"pb-vazio"},n.etapas.length?"Todas as etapas ligadas est\xE3o conclu\xEDdas.":"Nenhuma etapa ligada ainda."),t===x?E(n,f):o.modo==="arvore"||d?a("div",{class:"pb-botoes"},o.modo==="arvore"&&f.length?R(x):null,N("Abrir no painel","spro-botao pequeno",()=>r.abrirNoPainel(n.projeto.id,f[0]?.id),J("abrir",13))):null)},q=()=>{if(!o.projetos.length)return a("div",{class:"pb-form"},a("p",{class:"pb-dica"},"Crie um projeto no painel do Controle de Processos para ligar este processo."));let n=new Set(o.vinculos.map(u=>`${u.vis}:${u.projeto.id}`)),d=u=>`${u.vis}:${u.projeto.id}`,f=o.projetos.find(u=>!n.has(d(u)))??o.projetos[0],j=d(f),x="etapa",b=Co(),k=a("select",{class:"spro-campo",name:"projeto"},...o.projetos.map(u=>_(d(u),`${u.projeto.nome} (${F(u.vis)})`,d(u)===j))),y=a("input",{class:"spro-campo",name:"nome",maxlength:String(L.nome),placeholder:"Nome da etapa",value:Zo(o.processo)}),g=a("input",{class:"spro-campo",type:"date",name:"inicio",value:o.hoje}),P=a("input",{class:"spro-campo",type:"number",name:"duracao",min:"1",max:String(V),step:"1",value:"10"});c("adicionar",k);let D=a("select",{class:"spro-campo",name:"etapaLigar"}),I=a("div",{class:"pb-form-como"}),K=()=>o.projetos.find(u=>d(u)===j)??f,W=[["etapa","Nova etapa"],["ligar","Ligar a uma etapa"],["projeto","Processo do projeto"]],H=A(o.processo.protocolo),Q=W.map(([u,h])=>a("button",{type:"button","aria-pressed":String(x===u),onclick:()=>{x=u,B()}},h)),$o=a("div",{class:"spro-segmentado",role:"group","aria-label":"Como"},...Q),B=()=>{Q.forEach((h,T)=>{let z=String(W[T]?.[0]===x);h.getAttribute("aria-pressed")!==z&&h.setAttribute("aria-pressed",z)});let u=K();if(x==="etapa")I.replaceChildren(O("Nome da etapa",y),a("div",{class:"pb-linha2"},O("In\xEDcio",g),O("Dura\xE7\xE3o (dias \xFAteis)",P)));else if(x==="ligar"){let h=S=>!!H&&typeof S?.protocolo=="string"&&A(S.protocolo)===H,T=h(u.projeto.processo),z=u.etapas.filter(S=>!S.concluidaEm&&(S.processo&&!so(S.processo)?!h(S.processo):!T));D.replaceChildren(...z.map((S,Io)=>_(S.id,S.processo?.protocolo||S.processo?.sigiloso?`${S.nome} (j\xE1 tem outro processo)`:S.nome,Io===0))),I.replaceChildren(z.length?O("Etapa",D):a("p",{class:"pb-dica"},"Este projeto n\xE3o tem etapa aberta para ligar."))}else{let h=u.projeto.processo;I.replaceChildren(a("p",{class:"pb-dica"},h?.protocolo||h?.sigiloso?A(h.protocolo)===H&&h.protocolo?X:`O projeto passa a ter este processo no lugar de ${h.sigiloso?"um processo sigiloso":h.protocolo}.`:"O projeto passa a ter este processo (as etapas sem processo pr\xF3prio v\xEAm junto)."))}};k.addEventListener("change",()=>{j=k.value,B()}),B();let Ro=()=>{let u=K(),h={protocolo:o.processo.protocolo};o.processo.idProcedimento&&(h.idProcedimento=o.processo.idProcedimento),o.processo.sigiloso&&(h.sigiloso=!0);let T={vis:u.vis,projeto:u.projeto.id,como:x,processo:h};x==="etapa"&&Object.assign(T,{nome:y.value,inicio:g.value,duracao:Number(P.value)}),x==="ligar"&&(T.etapa=D.value),b.limpar(),r.adicionar(T).catch(b.mostrar)};return a("div",{class:"pb-form"},o.modo==="arvore"?a("b",{},"Adicionar a um projeto"):null,O("Projeto",k),a("div",{class:"pb-campo"},a("span",{class:"pb-rotulo"},"Como"),$o),I,b.erro,b.nota,a("div",{class:"pb-rod"},m("Adicionar",Ro,$("mais",13))))};function C(n=null){p=n,l=null;let d=o.vinculos.length,f=o.modo==="arvore"?"Projetos deste processo":`Em ${d} ${d===1?"projeto":"projetos"}`,j=o.modo==="caixa"&&d===1,x=[a("div",{class:"pb-cab"},a("span",{class:"pb-ic"},$("gantt",17)),a("span",{class:"pb-tit"},a("b",{},f),a("small",{},o.processo.protocolo)),a("button",{type:"button",class:"spro-botao-icone pequeno","aria-label":"Fechar",title:"Fechar (Esc)",onclick:()=>r.fechar()},$("fechar",14))),o.mensagem?a("p",{class:"pb-ok",role:"status"},o.mensagem):null,s,...o.vinculos.map(b=>v(b,o.modo==="caixa"&&d>1)),o.modo==="arvore"&&!d?a("p",{class:"pb-dica"},"Este processo ainda n\xE3o est\xE1 em nenhum projeto."):null,i?q():a("div",{class:"pb-rod"},N(d?"Adicionar a outro projeto":"Adicionar a um projeto","spro-botao pequeno",()=>{i=!0,C("adicionar")}),j?N("Abrir no painel","spro-botao primario pequeno",()=>r.abrirNoPainel(o.vinculos[0].projeto.id,Mo(o.vinculos[0])[0]?.id),J("abrir",13)):null)];e.replaceChildren(...x.filter(b=>b!==null)),p&&Qo(l),p=null,l=null}return C(),e}async function No(o,r,e){let t=r.hoje(),[i,s]=await Promise.all([r.repos.unidade.dados(),r.repos.eu.dados()]),p=[{vis:"unidade",dados:i},{vis:"eu",dados:s}],l=no(p.map(m=>({vis:m.vis,projetos:m.dados.projetos,etapas:m.dados.etapas}))),c={modo:r.modo,processo:o,vinculos:l.get(A(o.protocolo))??[],projetos:co(p,t).ativos,documentos:r.modo==="arvore"?r.documentos():[],hoje:t};return e&&(c.mensagem=e),c}async function To(o,r,e){let t=null,i=null,s=null,p=!1,l=()=>{if(p||!i)return Promise.resolve(!1);let v=Do(i,e.sigla);return s=v,v.resposta.finally(()=>{s===v&&(s=null)})},c={unidade:go(e.repos.unidade,xo(e.consentimento,l)),eu:e.repos.eu},m=v=>(i=Oo(v,R),i),E=async v=>{let q=await No(r,e,v);return p||t?.trocar(m(q)),v},R={fechar:()=>t?.fechar(),abrirNoPainel:(v,q)=>{t?.fechar(),e.abrirNoPainel(v,q)},adicionar:async v=>E(await ho(c,v,e.hoje())),concluir:async(v,q,C,n)=>E(await wo(c,v,q,C,n))};return t=Eo(o,m(await No(r,e)),{cssBase:e.cssBase,temaEscuro:e.temaEscuro,rotulo:e.modo==="arvore"?"Projetos deste processo":`Projetos do processo ${r.protocolo}`,aoFechar:()=>{p=!0,s?.cancelar()}}),t}var Fr=(o,r,e)=>To(o,r,{...e,cssBase:bo});export{Fr as abrirBalao};
