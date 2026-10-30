/* GERADO por menu-suspenso/build.mjs. NAO EDITE. Rode: npm run build */
"use strict";(()=>{function U(e,n){let a=e;if(typeof e=="string"){if(!e.trim())return;try{a=JSON.parse(e)}catch{return}}return!Array.isArray(a)||a.length===0?void 0:a.map(o=>o?.configGeral).find(Array.isArray)?.find(o=>o?.name===n)?.value}function b(e,n){let a=U(e,n);return a===!0||a===1||a==="1"}var N={novo:"#divInfraBarraSistemaPadraoE, #lnkInfraMenuSistema",antigo:"#divInfraBarraSistemaE, #lnkInfraMenuSistema"};function C(e){return e.getElementById("divInfraAreaTelaE")?e.querySelector("#divInfraSidebarMenu ul#infraMenu")?"novo":"antigo":null}var T=e=>e==="novo"?"divInfraBarraSistemaPadraoE":"divInfraBarraSistemaE",p=e=>e.getElementById("divInfraAreaTelaE"),y=e=>N[e],B=768,O=e=>(e.defaultView?.innerWidth??B)>=B,M="div.barraBotoesSEI",F=8;function D(e,n,a,r){return!e||n.left>=r||n.bottom<=a?0:Math.ceil(n.bottom-a+F)}var P="data-spro-menu-suspenso",R="data-spro-menu",E="seiSlim_hidemenu",h="--spro-menu-recuo",w="data-spro-menu-sem-animacao",j="Abrir ou fechar o menu";function V(e){let n=e.documentElement,a=null,r=!1,o=!1,c=new Map;function x(){return a?[...e.querySelectorAll(y(a))]:[]}function g(){n.setAttribute(R,r?"aberto":"fechado");for(let t of x())t.setAttribute("aria-expanded",String(r))}function u(){let t=p(e),i=e.defaultView;if(!t)return;let s=0;if(a==="novo"&&i){let f=t.getBoundingClientRect();for(let l of e.querySelectorAll(M)){let d=i.getComputedStyle(l).position,A=l.getBoundingClientRect();s=Math.max(s,D(d==="fixed"||d==="sticky",A,f.top,f.width))}}s?t.style.setProperty(h,`${s}px`):t.style.removeProperty(h)}function S(){a&&(r=!0,g(),u(),e.defaultView?.addEventListener("scroll",u,!0),e.defaultView?.addEventListener("resize",u))}function m(){a&&(r=!1,g(),e.defaultView?.removeEventListener("scroll",u,!0),e.defaultView?.removeEventListener("resize",u))}function v(){r?m():S()}function I(t){let i=t.target;!i||typeof i.closest!="function"||!a||!O(e)||(i.closest(y(a))?(t.preventDefault(),t.stopImmediatePropagation(),v()):r&&!p(e)?.contains(i)&&m())}function k(t){t.key==="Escape"&&r&&!t.defaultPrevented&&m();let i=t.target;(t.key==="Enter"||t.key===" ")&&a&&i?.id===T(a)&&(t.preventDefault(),v())}function z(){if(a=C(e),!a)return;n.setAttribute(P,a);for(let s of x()){let f=[],l=(d,A)=>{s.hasAttribute(d)||(s.setAttribute(d,A),f.push(d))};l("aria-controls","divInfraAreaTelaE"),s.id.startsWith("divInfraBarra")&&(l("role","button"),l("tabindex","0"),l("aria-label",j)),c.set(s,f)}a==="antigo"&&e.body&&!e.body.classList.contains(E)&&(e.body.classList.add(E),o=!0),e.addEventListener("click",I,!0),e.addEventListener("keydown",k),r=!1,n.setAttribute(w,""),g();let t=e.defaultView,i=()=>n.removeAttribute(w);t?.requestAnimationFrame?t.requestAnimationFrame(()=>t.requestAnimationFrame(i)):setTimeout(i,50)}function L(){e.defaultView?.removeEventListener("scroll",u,!0),e.defaultView?.removeEventListener("resize",u),p(e)?.style.removeProperty(h),e.removeEventListener("click",I,!0),e.removeEventListener("keydown",k);for(let[t,i]of c){t.removeAttribute("aria-expanded");for(let s of i)t.removeAttribute(s)}c.clear(),o&&e.body?.classList.remove(E),o=!1,n.removeAttribute(P),n.removeAttribute(R),n.removeAttribute(w),a=null,r=!1}return{configurar(t){t!==(a!==null)&&(t?z():L())},abrir:S,fechar:m,alternar:v,aberto:()=>r,encerrar:L}}var _=`/* Tudo vale s\xF3 com o atributo que o content script p\xF5e no <html>: desligada, a p\xE1gina \xE9 a do SEI. */\r
\r
/* Abaixo de 768px o SEI usa o menu de celular dele e nada daqui vale. */\r
@media (min-width: 768px) {\r
  /* \u2630 no bloco do logo (o SEI novo e o antigo trazem o bloco; o \xEDcone \xE9 desenhado aqui, sem fonte de \xEDcones). */\r
  :root[data-spro-menu-suspenso] :is(#divInfraBarraSistemaPadraoE, #divInfraBarraSistemaE) {\r
    cursor: pointer;\r
  }\r
  :root[data-spro-menu-suspenso] :is(#divInfraBarraSistemaPadraoE, #divInfraBarraSistemaE)::before {\r
    content: '';\r
    display: inline-block;\r
    flex: none;\r
    align-self: center;\r
    vertical-align: middle;\r
    width: 30px;\r
    height: 30px;\r
    margin-right: 12px;\r
    background: #fff;\r
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M3 6h18M3 12h18M3 18h18' stroke='black' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;\r
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M3 6h18M3 12h18M3 18h18' stroke='black' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;\r
  }\r
  /* O bot\xE3o nativo de exibir/ocultar menu do SEI 5 (link redondo ao lado do logo) d\xE1 lugar ao \u2630: um s\xF3 bot\xE3o. */\r
  :root[data-spro-menu-suspenso] #divInfraMenuSistema {\r
    display: none;\r
  }\r
\r
  /* SEI 4.1+ e 5: a coluna do menu sai do fluxo e o conte\xFAdo ocupa a largura toda. */\r
  :root[data-spro-menu-suspenso='novo'] #divInfraAreaTela {\r
    position: relative;\r
  }\r
  :root[data-spro-menu-suspenso='novo'] #divInfraAreaTelaE {\r
    position: absolute;\r
    /* Ajuste fino medido: o menu e a barra de a\xE7\xF5es fixa terminam alinhados \xE0 borda da barra superior. */\r
    top: 4px;\r
    bottom: 0;\r
    left: 0;\r
    z-index: 1030;\r
    width: min(320px, 85vw) !important;\r
    min-width: 0 !important;\r
    max-width: none !important;\r
    overflow-y: auto !important;\r
    padding-top: var(--spro-menu-recuo, 0);\r
    transform: translateX(-100%);\r
    visibility: hidden;\r
    transition: transform 0.18s ease, visibility 0s linear 0.18s;\r
  }\r
  :root[data-spro-menu-suspenso='novo'][data-spro-menu='aberto'] #divInfraAreaTelaE {\r
    transform: none;\r
    visibility: visible;\r
    box-shadow: 4px 0 18px rgba(0, 0, 0, 0.35);\r
    transition: transform 0.18s ease;\r
  }\r
  :root[data-spro-menu-sem-animacao] #divInfraAreaTelaE {\r
    transition: none !important;\r
  }\r
  :root[data-spro-menu-suspenso='novo'] div.barraBotoesSEI.fixed {\r
    margin-top: -2px !important;\r
  }\r
  :root[data-spro-menu-suspenso='novo'] #divInfraAreaTelaD {\r
    display: block !important;\r
    width: auto !important;\r
    min-width: 0 !important;\r
    max-width: none !important;\r
    padding-left: 1rem !important;\r
  }\r
  @media (prefers-reduced-motion: reduce) {\r
    :root[data-spro-menu-suspenso='novo'] #divInfraAreaTelaE,\r
    :root[data-spro-menu-suspenso='novo'][data-spro-menu='aberto'] #divInfraAreaTelaE {\r
      transition: none;\r
    }\r
  }\r
}\r
\r
/* SEI 3 e 4.0: a coluna flutuante vira camada, como o legado fazia. */\r
:root[data-spro-menu-suspenso='antigo'] #divInfraAreaTelaE {\r
  position: absolute;\r
  z-index: 99999;\r
  background: #fff;\r
  box-shadow: 3px 3px 5px 0 #8686868a;\r
}\r
:root[data-spro-menu-suspenso='antigo'][data-spro-menu='fechado'] #divInfraAreaTelaE {\r
  display: none;\r
}\r
:root[data-spro-menu-suspenso='antigo'] #divInfraAreaTelaD {\r
  width: 99%;\r
}\r
`;var q="menususpenso";function G(){if(!document.getElementById("divInfraAreaTelaE"))return;let e=document.createElement("style");e.textContent=_,document.head.append(e);let n=V(document),a=!1,r=(o,c)=>{c!=="sync"||!("dataValues"in o)||(a=!0,n.configurar(b(o.dataValues.newValue,q)))};chrome.storage.onChanged.addListener(r),chrome.storage.sync.get("dataValues").then(o=>{a||n.configurar(b(o.dataValues,q))}).catch(()=>{}),window.addEventListener("pagehide",o=>{o.persisted||(chrome.storage.onChanged.removeListener(r),n.encerrar(),e.remove())})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",G,{once:!0}):G();})();
