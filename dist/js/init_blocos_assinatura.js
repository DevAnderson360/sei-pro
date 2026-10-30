/* GERADO por blocos-assinatura/build.mjs. NAO EDITE. Rode: npm run build */
"use strict";(()=>{var u=class extends Error{codigo;detalhe;constructor(o,r,t){super(r),this.name="ErroSei",this.codigo=o,this.detalhe=t}paraJSON(){return{codigo:this.codigo,mensagem:this.message,detalhe:this.detalhe}}};function Z(e){if(e instanceof u)return e;if(e instanceof DOMException&&e.name==="AbortError")return new u("CANCELADO","Opera\xE7\xE3o cancelada.");let o=e instanceof Error?e.message:String(e);return new u("SEI_REDE",`Falha ao falar com o SEI: ${o}`)}var Xo={AElig:198,Aacute:193,Acirc:194,Agrave:192,Aring:197,Atilde:195,Auml:196,Ccedil:199,ETH:208,Eacute:201,Ecirc:202,Egrave:200,Euml:203,Iacute:205,Icirc:206,Igrave:204,Iuml:207,Ntilde:209,Oacute:211,Ocirc:212,Ograve:210,Oslash:216,Otilde:213,Ouml:214,THORN:222,Uacute:218,Ucirc:219,Ugrave:217,Uuml:220,Yacute:221,aacute:225,acirc:226,acute:180,aelig:230,agrave:224,amp:38,apos:39,aring:229,atilde:227,auml:228,brvbar:166,bull:8226,ccedil:231,cedil:184,cent:162,copy:169,curren:164,deg:176,divide:247,eacute:233,ecirc:234,egrave:232,eth:240,euml:235,euro:8364,frac12:189,frac14:188,frac34:190,gt:62,hellip:8230,iacute:237,icirc:238,iexcl:161,igrave:236,iquest:191,iuml:239,laquo:171,ldquo:8220,lsquo:8216,lt:60,macr:175,mdash:8212,micro:181,middot:183,nbsp:160,ndash:8211,not:172,ntilde:241,oacute:243,ocirc:244,ograve:242,ordf:170,ordm:186,oslash:248,otilde:245,ouml:246,para:182,plusmn:177,pound:163,quot:34,raquo:187,rdquo:8221,reg:174,rsquo:8217,sect:167,shy:173,sup1:185,sup2:178,sup3:179,szlig:223,thorn:254,times:215,trade:8482,uacute:250,ucirc:251,ugrave:249,uml:168,uuml:252,yacute:253,yen:165,yuml:255};function E(e){return e.includes("&")?e.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g,(o,r)=>{let t=r[0]==="#"?r[1]==="x"||r[1]==="X"?parseInt(r.slice(2),16):parseInt(r.slice(1),10):Xo[r];return t===void 0||Number.isNaN(t)?o:String.fromCodePoint(t)}):e}var uo={128:8364,130:8218,131:402,132:8222,133:8230,134:8224,135:8225,136:710,137:8240,138:352,139:8249,140:338,142:381,145:8216,146:8217,147:8220,148:8221,149:8226,150:8211,151:8212,152:732,153:8482,154:353,155:8250,156:339,158:382,159:376};var po=null;function G(e){return po?po(e):new DOMParser().parseFromString(e,"text/html")}function h(e){return(e?.textContent??"").replace(/\s+/g," ").trim()}var Ko={n:`
`,r:"\r",t:"	",b:"\b",f:"\f",v:"\v",0:"\0"};function Y(e,o){let r=e[o],t="";for(o+=1;o<e.length;){let n=e[o];if(n==="\\"){let a=e[o+1];if(a==="u"&&/^[0-9a-fA-F]{4}$/.test(e.slice(o+2,o+6))){t+=String.fromCharCode(parseInt(e.slice(o+2,o+6),16)),o+=6;continue}t+=Ko[a]??a,o+=2;continue}if(n===r)return[t,o+1];t+=n,o+=1}return[t,o]}function W(e,o){let r=[],t=o;for(;t<e.length;){let n=e[t];if(n===")")return[r,t+1];if(n===","||/\s/.test(n)){t+=1;continue}if(n==='"'||n==="'"){let[s,c]=Y(e,t);r.push(s),t=c;continue}let a=/^(null|true|false|-?\d+(?:\.\d+)?)/.exec(e.slice(t,t+32));if(a){let s=a[1];r.push(s==="null"?null:s==="true"?!0:s==="false"?!1:Number(s)),t+=s.length;continue}let i=0;for(;t<e.length;){let s=e[t];if(s==="(")i+=1;else if(s===")"){if(i===0)break;i-=1}else if(s===","&&i===0)break;t+=1}r.push(null)}return[r,t]}function b(e){return typeof e=="string"?E(e):e==null?"":String(e)}var Jo=/controlador(?:_ajax)?\.php\?acao=[^"'\s<>\\]*?infra_hash=[0-9a-f]{64,192}/g;function N(e){let o=new Set;for(let r of e.replace(/&amp;/g,"&").matchAll(Jo))o.add(r[0]);return[...o]}function I(e){let o=e.indexOf("?");return new URLSearchParams(o>=0?e.slice(o+1):"")}function H(e,o,r={}){let t=Array.isArray(e)?e:N(e);for(let n of t){let a=I(n),i=a.get("acao")??"";if(!(typeof o=="string"?i!==o:!o.test(i))&&Object.entries(r).every(([s,c])=>a.get(s)===c))return n}return null}function mo(e,o){let r=[...e.doc.querySelectorAll("#infraMenu a[href], #main-menu a[href], .infraMenu a[href]")].map(i=>i.getAttribute("href")??"").join(`
`),t=N(r).filter(i=>I(i).get("acao")===o),a=(t.length?t:N(e.html).filter(i=>I(i).get("acao")===o)).sort((i,s)=>[...I(i).keys()].length-[...I(s).keys()].length)[0];if(!a)throw new u("SEI_ACAO_INDISPONIVEL",`O menu do SEI n\xE3o oferece "${o}" para este usu\xE1rio.`);return a}function Zo(e){let o=new Map;for(let r of e.matchAll(/Nos\[(\d+)\]\s*=\s*new\s+infraArvoreNo\(/g)){let[t]=W(e,r.index+r[0].length);o.set(Number(r[1]),{indice:Number(r[1]),args:t,props:{}})}for(let r of e.matchAll(/Nos\[(\d+)\]\.(\w+)\s*=\s*(['"])/g)){let t=o.get(Number(r[1]));if(!t)continue;let[n]=Y(e,r.index+r[0].length-1);t.props[r[2]]=n}return[...o.values()].sort((r,t)=>r.indice-t.indice)}function Yo(e){let o=[];for(let r of e.matchAll(/new\s+infraArvoreAcao\(/g)){let[t]=W(e,r.index+r[0].length);o.push({tipo:b(t[0]),idPai:b(t[2]),href:b(t[3]),titulo:b(t[5]),icone:b(t[6]),extra:t[8]==null?void 0:b(t[8])})}return o}function fo(e,o){let r=e.find(i=>i.tipo==="NIVEL_ACESSO"&&i.idPai===o);if(!r)return{nivel:"publico"};let[t,...n]=r.titulo.split(`
`);return{nivel:/sigilos/i.test(t)||/sigiloso/.test(r.icone)?"sigiloso":"restrito",hipotese:n.join(" ").trim()||void 0}}function go(e){return[...new Set([...e.matchAll(/<img[^>]*\btitle="([^"]+)"/g)].map(o=>b(o[1])))]}var Wo=/\s*\(\d{5,}\)\s*$/;function Qo(e){let o=e.html,r=Zo(o),t=Yo(o),n=r.find(c=>c.args[0]==="PROCESSO");if(!n)throw new u("SEI_VERSAO_NAO_SUPORTADA","A \xE1rvore do processo n\xE3o tem o n\xF3 do processo.");let a=b(n.args[1]),i=fo(t,a),s=r.filter(c=>c.args[0]==="DOCUMENTO").map(c=>{let l=b(c.args[1]),p=b(c.args[5]),d=b(c.args[7]),m=(c.props.src??"").replace(/&amp;/g,"&"),f=t.find(w=>w.tipo==="ASSINATURA"&&w.idPai===l),{nivel:x,hipotese:v}=fo(t,l),M=(/documento_([a-z0-9]+)\.svg/.exec(d)?.[1]??"interno").replace("cancelado","interno");return{id:l,numero:b(c.args[15])||(/\((\d{5,})\)\s*$/.exec(p)?.[1]??""),titulo:p.replace(Wo,""),pasta:c.args[2]&&String(c.args[2]).startsWith("PASTA")?String(c.args[2]):null,externo:/documento_download_anexo/.test(m)||!/documento_interno|documento_cancelado|formulario|email/.test(d),formato:M,nivel:x,hipotese:v,assinado:!!f,assinaturas:f?f.titulo.split(`
`).slice(1).filter(Boolean):[],cancelado:/documento_cancelado/.test(d),unidadeGeradora:t.find(w=>w.tipo==="UNIDADE_GERADORA"&&w.idPai===l)?.extra,link:b(c.args[3]).replace(/&amp;/g,"&"),src:m,acoes:N(c.props.acoes??""),botoes:go(c.props.acoes??"")}});return{idProcedimento:a,protocolo:b(n.args[5])||b(n.args[15]),tipo:b(n.args[6]),nivel:i.nivel,hipotese:i.hipotese,marcadores:t.filter(c=>c.tipo==="MARCADOR"&&c.idPai===a).map(c=>c.titulo.replace(/^Marcador\n/,"").replace(/\n/g," \u2014 ")),documentos:s,acoesProcesso:N(n.props.acoes??""),botoesProcesso:go(n.props.acoes??""),linkProcesso:b(n.args[3]).replace(/&amp;/g,"&"),sinais:t.filter(c=>c.idPai===a),links:N(o),pagina:e}}async function ho(e,o,r){let t=await e.obter(o,r);if(!/acao=procedimento_visualizar/.test(t.url)){let n=t.doc.querySelector("#ifrArvore")?.getAttribute("src");if(!n)throw new u("SEI_NAO_ENCONTRADO","N\xE3o foi poss\xEDvel abrir a \xE1rvore do processo.");t=await e.obter(n,r)}if(/infraArvoreNo\("PASTA"/.test(t.html)){let n=H(t.html,"procedimento_visualizar")&&N(t.html).find(a=>/abrir_pastas=1/.test(a));n&&(t=await e.obter(n,r))}return Qo(t)}var Ao="\xA5",Q="\xB1";function bo(e){return e.map(o=>`${o.id}${Q}${o.texto}`).join(Ao)}function oe(e){return e?e.split(Ao).map(o=>{let[r,...t]=o.split(Q);return{id:r,texto:t.join(Q)}}):[]}function xo(e){let o=[];for(let r of e.matchAll(/new\s+infraLupaSelect\(\s*['"]([\w-]+)['"]\s*,\s*['"]([\w-]+)['"]/g))o.push([r[1],r[2]]);return o}var A=class e{constructor(o,r,t){this.http=o;this.pagina=r;this.elemento=t,this.id=t.id,this.action=(t.getAttribute("action")??"").replace(/&amp;/g,"&"),this.campos=ee(t),this.sincronizarLupas()}id;action;campos;elemento;static async abrir(o,r,t,n){let a=await o.obter(r,n);return e.de(a,t,o)}static de(o,r,t=null){let n=o.doc.querySelector(r);if(!n)throw new u("SEI_VERSAO_NAO_SUPORTADA",`A tela do SEI n\xE3o tem o formul\xE1rio esperado (${r}).`,h(o.doc.querySelector("title")));return new e(t,o,n)}pares(){return this.campos.map(o=>[o.nome,o.valor])}valor(o){return this.campos.find(r=>r.nome===o)?.valor}tem(o){return this.elemento.querySelector(`[name="${o}"]`)!==null||this.campos.some(r=>r.nome===o)}opcoes(o){let r=this.elemento.querySelector(`select[name="${o}"], select#${Eo(o)}`);return r?[...r.querySelectorAll("option")].map(t=>({valor:t.getAttribute("value")??h(t),texto:h(t),selecionada:t.hasAttribute("selected")})):[]}definir(o){for(let[r,t]of Object.entries(o)){if(t===void 0)continue;if(t===null){this.campos=this.campos.filter(a=>a.nome!==r);continue}let n=this.campos.find(a=>a.nome===r);n?n.valor=t:this.campos.push({nome:r,valor:t})}return this}escolher(o,r){let t=this.opcoes(o),n=T(r),a=t.find(i=>i.valor===r)??t.find(i=>T(i.texto)===n)??vo(t.filter(i=>T(i.texto).includes(n)));if(!a)throw new u("ARGUMENTO_INVALIDO",`"${r}" n\xE3o \xE9 uma op\xE7\xE3o de ${o}.`,t.slice(0,40).map(i=>i.texto).join(" | "));return this.definir({[o]:a.valor}),a}linhas(o){return[...this.elemento.querySelectorAll(`${o} tr`)].filter(r=>r.querySelector("input[type=checkbox]"))}itensLupa(o){let r=this.hiddenDaLupa(o);return r?oe(this.valor(r)??""):[]}definirLupa(o,r){let t=this.hiddenDaLupa(o);if(!t)throw new u("SEI_VERSAO_NAO_SUPORTADA",`A lupa ${o} n\xE3o existe nesta tela.`);return this.definir({[t]:bo(r)}),this.campos=this.campos.filter(n=>n.nome!==o&&n.nome!==`${o}[]`),this}async enviar(o={}){if(!this.http)throw new u("SEI_RESPOSTA_INESPERADA","Formul\xE1rio sem transporte HTTP.");if(!this.action)throw new u("SEI_VERSAO_NAO_SUPORTADA",`O formul\xE1rio ${this.id} n\xE3o tem action.`);let r=this.pares();o.botao&&r.push(this.botaoDeEnvio(o.botao));let t=await this.http.enviar(this.action,r,o);if(o.sucesso&&!o.sucesso(t))throw new u("SEI_RESPOSTA_INESPERADA",`O SEI n\xE3o confirmou ${o.operacao??"a opera\xE7\xE3o"}.`,`${h(t.doc.querySelector("title"))} \u2014 ${t.url.replace(/infra_hash=\w+/,"infra_hash=\u2026")}`);return t}botaoDeEnvio(o){let r=this.elemento.querySelector(`[name="${o}"]`)??vo([...this.elemento.querySelectorAll('button[type="submit"][name^="sbm"], input[type="submit"][name^="sbm"]')]);return r?[r.getAttribute("name")??o,r.getAttribute("value")??h(r)??o]:[o,o]}hiddenDaLupa(o){let r=xo(this.pagina.html).find(([t])=>t===o);return r?r[1]:null}sincronizarLupas(){for(let[o,r]of xo(this.pagina.html)){let t=this.elemento.querySelector(`select#${Eo(o)}`);if(!t)continue;let n=[...t.querySelectorAll("option")].map(a=>({id:a.getAttribute("value")??"",texto:h(a)}));(this.valor(r)??"")||this.definir({[r]:bo(n)}),this.campos=this.campos.filter(a=>a.nome!==o&&a.nome!==`${o}[]`)}}};function ee(e){let o=[];for(let r of e.querySelectorAll("input, select, textarea")){let t=r.getAttribute("name");if(!t||r.hasAttribute("disabled"))continue;let n=r.tagName.toLowerCase();if(n==="input"){let a=(r.getAttribute("type")??"text").toLowerCase();if(["submit","button","image","reset","file"].includes(a)||(a==="checkbox"||a==="radio")&&!r.hasAttribute("checked"))continue;o.push({nome:t,valor:r.getAttribute("value")??(a==="checkbox"||a==="radio"?"on":"")})}else if(n==="textarea")o.push({nome:t,valor:r.textContent??""});else{let a=[...r.querySelectorAll("option")],i=a.filter(l=>l.hasAttribute("selected")),s=r.hasAttribute("multiple"),c=i.length?i:!s&&a.length?[a[0]]:[];for(let l of c)o.push({nome:t,valor:l.getAttribute("value")??h(l)})}}return o}function T(e){return e.normalize("NFD").replace(/[\u0300-\u036F]/g,"").toLowerCase().replace(/\s+/g," ").trim()}function vo(e){return e.length===1?e[0]:void 0}function Eo(e){return e.replace(/([^\w-])/g,"\\$1")}var re={"\u2010":"-","\u2011":"-","\u2012":"-","\u2013":"-","\u2014":"-","\u2015":"-","\u2212":"-","\u2018":"'","\u2019":"'","\u201A":"'","\u201B":"'","\u2032":"'","\u201C":'"',"\u201D":'"',"\u201E":'"',"\u201F":'"',"\u2033":'"',"\u2026":"...","\u2022":"-","\u2002":" ","\u2003":" ","\u2009":" ","\u202F":" ","\u205F":" ","\u200B":"","\u200C":"","\u200D":"","\u2060":"","\uFEFF":"","\u20AC":"EUR","\u2122":"(TM)","\u2192":"->","\u2190":"<-"};function X(e,o="texto"){let r="";for(let t of e){let n=t.codePointAt(0);if(n<=255){r+=t;continue}let a=re[t];if(o==="html"){r+=a===""?"":`&#${n};`;continue}if(a!==void 0){r+=a;continue}let i=t.normalize("NFKD").replace(/[\u0300-\u036F]/g,"");r+=[...i].every(s=>s.codePointAt(0)<=255)?i:""}return r}var te=/[A-Za-z0-9\-_.*]/;function wo(e){let o="";for(let r of e)r===" "?o+="+":te.test(r)?o+=r:o+="%"+r.charCodeAt(0).toString(16).toUpperCase().padStart(2,"0");return o}function So(e,o={}){return e.map(([r,t])=>{let n=o[r]??"texto";return`${wo(X(r))}=${wo(X(t??"",n))}`}).join("&")}function Io(e){let o=r=>encodeURIComponent(X(r)).replace(/%20/g,"+");return e.map(([r,t])=>`${o(r)}=${o(t??"")}`).join("&")}var yo="application/x-www-form-urlencoded";function oo(e){let o=e instanceof Uint8Array?e:new Uint8Array(e),r=[],t=16384;for(let n=0;n<o.length;n+=t){let a=o.subarray(n,n+t),i=new Array(a.length);for(let s=0;s<a.length;s+=1)i[s]=uo[a[s]]??a[s];r.push(String.fromCharCode(...i))}return r.join("")}var Oo="application/x-www-form-urlencoded; charset=ISO-8859-1";function _o(e,o,r){let t=null;return{url:e,status:o,html:r,get doc(){return t??=G(r)}}}function Po(e,o={}){if(/\/login\.php/i.test(e.url)||/[?&]acao=(?:infra_)?sair\b/.test(e.url))throw new u("SEI_SESSAO_EXPIRADA","A sess\xE3o do SEI foi encerrada. Fa\xE7a login de novo no SEI e repita o pedido.");if(e.status>=500)throw new u("SEI_EXCECAO",`O SEI respondeu com erro ${e.status}.`);if(e.html.includes('id="divInfraExcecao"')){let r=e.doc.querySelector("#divInfraExcecao");if(r){let t=h(r);throw new u("SEI_EXCECAO",t||"O SEI exibiu uma p\xE1gina de erro.",t)}}if(!o.aceitarValidacao&&e.html.includes("txaInfraValidacao")){let r=e.doc.querySelector("#txaInfraValidacao")?.textContent?.trim()??"";if(r)throw new u("SEI_VALIDACAO",r,r)}return e}function Do(e,o={}){let r=new URL(".",e),t=o.fetch??((...d)=>fetch(...d)),n=Math.max(1,o.concorrencia??3),a=0,i=[];async function s(d){a>=n&&await new Promise(m=>i.push(m)),a+=1;try{return await d()}finally{a-=1,i.shift()?.()}}let c=d=>new URL(d.replace(/&amp;/g,"&"),r).href;async function l(d,m,f){return s(async()=>{try{let x=await t(c(d),{credentials:"same-origin",redirect:"follow",...m,signal:f.sinal}),v=oo(await x.arrayBuffer());return Po(_o(x.url||c(d),x.status,v),f)}catch(x){throw Z(x)}})}async function p(d,m={}){return s(async()=>{try{let f=await t(c(d),{credentials:"same-origin",redirect:"follow",signal:m.sinal}),x=new Uint8Array(await f.arrayBuffer()),v=(f.headers?.get("content-type")??"").split(";")[0].trim().toLowerCase();v==="text/html"&&Po(_o(f.url||c(d),f.status,oo(x)),m);let M=f.headers?.get("content-disposition")??"",w=decodeURIComponent(/filename\*=UTF-8''([^;]+)/i.exec(M)?.[1]??/filename="?([^";]+)"?/i.exec(M)?.[1]??"");return{bytes:x,tipo:v,nome:w}}catch(f){throw Z(f)}})}return{base:r,absoluta:c,baixar:p,obter:(d,m={})=>l(d,{method:"GET"},m),enviar:(d,m,f={})=>l(d,f.utf8?{method:"POST",headers:{"Content-Type":yo},body:Io(m)}:{method:"POST",headers:{"Content-Type":Oo},body:So(m,f.modos)},f)}}function ae(e){let o=/Sistema Eletr(?:\u00F4|&ocirc;|\\u00F4)nico de Informa[^"]*?Vers(?:\u00E3|&atilde;)o\s*([\d.]+)/i.exec(e);return o?o[1]:/\.(?:js|svg|css)\?(\d+\.\d+\.\d+)-/.exec(e)?.[1]??""}function ne(e){let o=e.doc.querySelector("#lnkInfraUnidade")?.getAttribute("onclick")??"",r=/infra_unidade_atual=(\d+)/.exec(o)?.[1];if(r)return r;let t=/[?&]infra_unidade_atual=(\d+)/.exec(e.url)?.[1];return t||(e.doc.querySelector("#selInfraUnidades option[selected]")?.getAttribute("value")??"")}function ie(e){let o=e.doc,r=o.querySelector("#lnkInfraUnidade"),t=o.querySelector("#lnkUsuarioSistema")?.getAttribute("title")??"",[,n="",a="",i=""]=/^(.*?)\s*\(([^/)]+)(?:\/([^)]+))?/.exec(t)??[],s=ae(e.html);return{host:new URL(e.url).host,versao:s,maior:Number(s.split(".")[0])||0,unidade:{id:ne(e),sigla:h(r)||h(o.querySelector("#selInfraUnidades option[selected]")),nome:r?.getAttribute("title")??""},usuario:{nome:n.trim(),login:a.trim(),orgao:i.trim()}}}var se=3e4,K=class{constructor(o,r=null,t){this.paginaViva=r;this.http=Do(o,t)}http;paginaBase=null;arvores=new Map;localizados=new Map;base(){let o=this.paginaViva?.();if(o&&o.html.includes("frmProtocoloPesquisaRapida"))return o;if(this.paginaBase)return this.paginaBase;if(o)return o;throw new u("SEI_NAO_ENCONTRADO","Abra uma tela do SEI (por exemplo, Controle de Processos) nesta aba.")}contexto(){return ie(this.base())}linkMenu(o){return mo(this.base(),o)}async renovarBase(o){return this.paginaBase=await this.http.obter(this.linkMenu("procedimento_controlar"),o),this.arvores.clear(),this.localizados.clear(),this.paginaBase}async localizar(o,r){let t=o.trim();if(!t)throw new u("ARGUMENTO_INVALIDO","Informe o n\xFAmero do processo ou o n\xBA SEI do documento.");let n=this.localizados.get(t);if(n)return n;let a=A.de(this.base(),"#frmProtocoloPesquisaRapida",this.http);a.definir({txtPesquisaRapida:t});let i=await a.enviar(r),s=I(i.url);if(s.get("acao")!=="procedimento_trabalhar")throw new u("SEI_NAO_ENCONTRADO",`Nada encontrado no SEI para "${t}", ou voc\xEA n\xE3o tem acesso a ele.`);let c=i.doc.querySelector("#ifrArvore")?.getAttribute("src");if(!c)throw new u("SEI_VERSAO_NAO_SUPORTADA","A tela do processo n\xE3o trouxe a \xE1rvore.");let p=I(E(c)).get("id_procedimento")??"",d=s.get("id_protocolo")??"",m={idProcedimento:p,idDocumento:d&&d!==p?d:void 0,linkArvore:E(c)};return this.localizados.set(t,m),m}async arvore(o,r={}){let t=await this.localizar(o,r),n=this.arvores.get(t.idProcedimento);if(n&&!r.forcar&&Date.now()-n.quando<se)return n.arvore;let a=await ho(this.http,t.linkArvore,r);return this.arvores.set(t.idProcedimento,{quando:Date.now(),arvore:a}),a}invalidar(o){o?this.arvores.delete(o):this.arvores.clear()}esquecer(o){this.localizados.delete(o.trim())}async ajax(o,r,t){let n=await this.http.enviar(o,r,{...t,aceitarValidacao:!0}),a=[];for(let i of n.html.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/g))a.push({id:E(i[1]),texto:E(i[2]).trim()});for(let i of n.html.matchAll(/<item\s+([^>]*)>/g)){let s=G(`<i ${i[1]}></i>`).querySelector("i");a.push({id:s?.getAttribute("id")??"",texto:s?.getAttribute("descricao")??s?.getAttribute("complemento")??""})}return a.filter(i=>i.id&&i.id!=="null")}};function Lo(e,o=e.location?.href??"https://sei.invalido/sei/controlador.php"){return{url:o,status:200,get html(){return e.documentElement.outerHTML},doc:e}}function eo(){try{return window.top?.document??document}catch{return document}}function ce(e,o){let r=e;if(typeof e=="string"){if(!e.trim())return;try{r=JSON.parse(e)}catch{return}}return!Array.isArray(r)||r.length===0?void 0:r.map(n=>n?.configGeral).find(Array.isArray)?.find(n=>n?.name===o)?.value}function ro(e,o){let r=ce(e,o);return!(r===!1||r===0||r==="")}var de={assinatura:"bloco_assinatura_listar",interno:"bloco_interno_listar"},ue=e=>e.split(/[\n;/]|\s{2,}/).map(o=>o.trim()).filter(Boolean);function J(e){let o={};return[...([...e?.querySelectorAll("tr")??[]].find(t=>t.querySelector("th"))??e?.querySelector("tr"))?.querySelectorAll("th, td")??[]].forEach((t,n)=>{let a=T(h(t)).replace(/[^a-z0-9 ]/g,"").trim();a&&(o[a]=n)}),o}function pe(e,o){let r=e.doc.querySelector("#tblBlocos"),t=J(r),n=[];for(let a of r?.querySelectorAll("tr")??[]){let s=a.querySelector("input[type=checkbox]")?.getAttribute("value")??"";if(!s)continue;let c=[...a.querySelectorAll("td")],l=d=>t[d]===void 0?"":h(c[t[d]]).replace(/\s+/g," ").trim(),p=[...a.querySelectorAll("a")].map(d=>d.getAttribute("href")??"").find(d=>d.includes("rel_bloco_protocolo_listar"));n.push({numero:s,tipo:o,estado:l("estado"),descricao:l("descricao"),geradora:l("geradora"),disponibilizado:ue(l("disponibilizacao")),grupo:l("grupo"),atribuido:l("atribuicao"),link:(p??"").replace(/&amp;/g,"&")})}return n}async function me(e,o,r){let t=await e.http.obter(e.linkMenu(de[o]),{sinal:r,aceitarValidacao:!0});return{pagina:t,blocos:pe(t,o)}}function to(e){let o=[...e.doc.querySelector("#frmBlocoLista")?.querySelectorAll("table")??[]].find(n=>{let a=J(n);return(a.estado??a.situacao)!==void 0&&a.descricao!==void 0&&(a.numero??a.n)!==void 0});if(!o)throw new u("SEI_VERSAO_NAO_SUPORTADA","A listagem de blocos de assinatura n\xE3o foi reconhecida.");let r=J(o),t=[];for(let n of o.querySelectorAll("tr")){let a=[...n.querySelectorAll("td")];if(T(h(a[r.estado??r.situacao]))!=="disponibilizado")continue;let i=[...n.querySelectorAll("[onclick]")].map(l=>/\bacaoCancelarDisponibilizacao\(\s*['"]([^'"]+)['"]\s*\)/.exec(l.getAttribute("onclick")??"")?.[1]).find(Boolean);if(!i)continue;let s=n.querySelector('input[type="checkbox"]')?.getAttribute("value");if(s&&s!==i)continue;let c=r.numero??r.n;t.push({id:i,numero:h(a[c])||i,descricao:h(a[r.descricao])})}return t}async function Mo(e,o={}){return Ro(e,o,async r=>[...new Map(r.flatMap(to).map(t=>[t.id,t])).values()])}async function Ro(e,o,r){let{pagina:t}=await me(e,"assinatura",o.sinal),n=A.de(t,"#frmBlocoLista",e.http),a={},i=t.doc.querySelector("#chkSinEstadoDisponibilizado");i&&!i.hasAttribute("checked")&&(a.chkSinEstadoDisponibilizado="on");for(let l of t.doc.querySelectorAll("#frmBlocoLista input[name], #frmBlocoLista select[name], #frmBlocoLista textarea[name]")){let p=J(l.closest("table"));if(!((p.estado??p.situacao)!==void 0&&p.descricao!==void 0&&(p.numero??p.n)!==void 0)){if(/^(txt|txa)/.test(l.name)&&l.getAttribute("type")!=="hidden"&&n.valor(l.name))a[l.name]="";else if(/^sel(?!Infra)/.test(l.name)&&l.tagName.toLowerCase()==="select"){let d=n.opcoes(l.name).find(m=>m.valor===""||/^(todos?|todas?|selecione)(\b|$)/.test(T(m.texto)));d&&n.valor(l.name)!==d.valor&&(a[l.name]=d.valor)}}}n.tem("hdnInfraPaginaAtual")&&n.valor("hdnInfraPaginaAtual")!=="0"&&(a.hdnInfraPaginaAtual="0");let s=!1,c=async(l,p,d=!1)=>(s=!0,A.de(l,"#frmBlocoLista",e.http).definir({...p,hdnInfraItemId:"",hdnInfraItensSelecionados:""}).enviar({sinal:o.sinal,...d?{botao:"sbmPesquisar"}:{},aceitarValidacao:!0}));try{let l=Object.keys(a).length?await c(t,a,!0):t,p=[];for(let d=0;to(l),p.push(l),!!/infraAcaoPaginar\(\s*['"]\+['"]/.test(l.html);d++){if(d>=199||!A.de(l,"#frmBlocoLista").tem("hdnInfraPaginaAtual"))throw new u("SEI_VERSAO_NAO_SUPORTADA","N\xE3o foi poss\xEDvel consultar todas as p\xE1ginas de blocos.");l=await c(l,{hdnInfraPaginaAtual:String(d+1)})}return await r(p)}finally{if(s)try{await A.de(t,"#frmBlocoLista",e.http).definir({hdnInfraItemId:"",hdnInfraItensSelecionados:""}).enviar({botao:"sbmPesquisar",aceitarValidacao:!0})}catch{let l="N\xE3o foi poss\xEDvel restaurar os filtros da listagem de blocos. Confira-os na tela de Blocos de Assinatura.";try{o.aoAviso?.(l)}catch{}}}}async function ko(e,o,r,t={}){let n=new URL(e.http.absoluta(r));if(n.origin!==e.http.base.origin||n.searchParams.get("acao")!=="bloco_escolher"||!n.searchParams.get("infra_hash"))throw new u("ARGUMENTO_INVALIDO","A tela de inclus\xE3o deve pertencer \xE0 sess\xE3o atual do SEI.");return Ro(e,t,async a=>{let i=a.find(l=>to(l).some(p=>p.id===o));if(!i)throw new u("SEI_ACAO_INDISPONIVEL","O SEI n\xE3o oferece cancelar a disponibiliza\xE7\xE3o deste bloco nesta unidade.");await ge(e,i,o,"cancelar",t);let c=[...(await e.http.obter(n.href,t)).doc.querySelectorAll("#frmBlocoEscolher #selBloco option")].find(l=>l.getAttribute("value")===o&&!l.hasAttribute("disabled")&&!l.parentElement?.hasAttribute("disabled"));if(!c)throw new u("SEI_RESPOSTA_INESPERADA","O SEI n\xE3o confirmou o retorno do bloco na tela de inclus\xE3o. Confira seu estado antes de tentar novamente.");return{id:o,rotulo:h(c)}})}var fe={disponibilizar:{sei:"bloco_disponibilizar",vira:"Disponibilizado",ja:["Disponibilizado"],exige:["Gerado","Retornado"],frase:e=>`disponibilizar o bloco ${e}`},cancelar:{sei:"bloco_cancelar_disponibilizacao",vira:"Gerado",ja:["Gerado"],exige:["Disponibilizado"],frase:e=>`cancelar a disponibiliza\xE7\xE3o do bloco ${e}`},concluir:{sei:"bloco_concluir",vira:"Conclu\xEDdo",ja:["Conclu\xEDdo"],frase:e=>`concluir o bloco ${e}`},reabrir:{sei:"bloco_reabrir",vira:"Gerado",ja:["Gerado","Disponibilizado","Retornado"],exige:["Conclu\xEDdo"],frase:e=>`reabrir o bloco ${e}`},retornar:{sei:"bloco_retornar",vira:"Retornado",ja:["Retornado"],exige:["Disponibilizado"],frase:e=>`retornar o bloco ${e}`},excluir:{sei:"bloco_excluir",vira:"(exclu\xEDdo)",frase:e=>`excluir o bloco ${e}`}};async function ge(e,o,r,t,n){let a=fe[t],i=H(o.html,a.sei);if(!i)throw new u("SEI_ACAO_INDISPONIVEL",`O SEI n\xE3o oferece ${a.frase(r)} nesta unidade.`);let s=A.de(o,"#frmBlocoLista",e.http).definir({hdnInfraItemId:r,hdnInfraItensSelecionados:""});await e.http.enviar(i,s.pares(),{sinal:n.sinal})}var y={fill:"currentColor",stroke:"none"},$o="M12 3.2l2.7 5.5 6 .9-4.35 4.25 1 6L12 17l-5.35 2.85 1-6L3.3 9.6l6-.9z",Co={estrela:[["path",{d:$o}]],estrelaCheia:[["path",{d:$o,fill:"currentColor"}]],alvo:[["circle",{cx:"12",cy:"12",r:"7.5"}],["circle",{cx:"12",cy:"12",r:"3.2"}]],alvoAtivo:[["circle",{cx:"12",cy:"12",r:"6.6"}],["circle",{cx:"12",cy:"12",r:"2.4",fill:"currentColor"}],["path",{d:"M12 2.2v3.4M12 18.4v3.4M2.2 12h3.4M18.4 12h3.4"}]],pasta:[["path",{d:"M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"}]],etiqueta:[["path",{d:"M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.1 7.1a1 1 0 0 1-1.4 0z"}],["circle",{cx:"8",cy:"8",r:"1.4",...y}]],relogio:[["circle",{cx:"12",cy:"12",r:"9"}],["path",{d:"M12 7.2V12l3.2 1.9"}]],nota:[["path",{d:"M6 3.5h9l3.5 3.5v13.5H6z"}],["path",{d:"M9 11h6"}],["path",{d:"M9 15h6"}]],lixeira:[["path",{d:"M4.5 6.5h15"}],["path",{d:"M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7"}],["path",{d:"M6.8 6.5 7.6 19c0 .8.7 1.5 1.5 1.5h5.8c.8 0 1.5-.7 1.5-1.5l.8-12.5"}]],lapis:[["path",{d:"M17.5 3.5a2.1 2.1 0 0 1 3 3L9 18l-4.5 1.5L6 15z"}],["path",{d:"M15 6l3 3"}]],fechar:[["path",{d:"M18 6 6 18"}],["path",{d:"M6 6l12 12"}]],mais:[["path",{d:"M12 5v14"}],["path",{d:"M5 12h14"}]],busca:[["circle",{cx:"11",cy:"11",r:"6.5"}],["path",{d:"M20.5 20.5l-4.8-4.8"}]],baixar:[["path",{d:"M12 3.5v11"}],["path",{d:"M7.5 10.2 12 14.7l4.5-4.5"}],["path",{d:"M4.5 19.5h15"}]],subir:[["path",{d:"M12 14.5v-11"}],["path",{d:"M7.5 7.8 12 3.3l4.5 4.5"}],["path",{d:"M4.5 19.5h15"}]],copiar:[["rect",{x:"8.5",y:"8.5",width:"12",height:"12",rx:"2"}],["path",{d:"M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"}]],restaurar:[["path",{d:"M9 14 4 9l5-5"}],["path",{d:"M4 9h9a7 7 0 0 1 7 7v4"}]],check:[["path",{d:"M20 6.5 9.2 17.3 4 12.1"}]],alerta:[["path",{d:"M10.3 4.4 2.8 17.6a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0z"}],["path",{d:"M12 9.5v4"}],["circle",{cx:"12",cy:"16.8",r:"1",...y}]],menu:[["circle",{cx:"5",cy:"12",r:"1.4",...y}],["circle",{cx:"12",cy:"12",r:"1.4",...y}],["circle",{cx:"19",cy:"12",r:"1.4",...y}]],alca:[["circle",{cx:"9",cy:"6",r:"1.3",...y}],["circle",{cx:"15",cy:"6",r:"1.3",...y}],["circle",{cx:"9",cy:"12",r:"1.3",...y}],["circle",{cx:"15",cy:"12",r:"1.3",...y}],["circle",{cx:"9",cy:"18",r:"1.3",...y}],["circle",{cx:"15",cy:"18",r:"1.3",...y}]],ajustes:[["path",{d:"M4 7h5"}],["path",{d:"M13 7h7"}],["circle",{cx:"11",cy:"7",r:"2.1"}],["path",{d:"M4 17h9"}],["path",{d:"M17 17h3"}],["circle",{cx:"15",cy:"17",r:"2.1"}]],setaCima:[["path",{d:"M12 19V6"}],["path",{d:"M6 12l6-6 6 6"}]],setaBaixo:[["path",{d:"M12 5v13"}],["path",{d:"M18 12l-6 6-6-6"}]],recolher:[["path",{d:"M6 15l6-6 6 6"}]],expandir:[["path",{d:"M6 9l6 6 6-6"}]],local:[["path",{d:"M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11z"}],["circle",{cx:"12",cy:"10",r:"2.3"}]],sino:[["path",{d:"M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5h-14z"}],["path",{d:"M10 20.5a2 2 0 0 0 4 0"}]],documento:[["path",{d:"M7 3.5h7l4 4v13H7z"}],["path",{d:"M14 3.5v4h4"}]],painel:[["rect",{x:"3.5",y:"4.5",width:"17",height:"15",rx:"2"}],["path",{d:"M14.5 4.5v15"}]],atualizar:[["path",{d:"M19.5 12a7.5 7.5 0 1 1-2.2-5.3"}],["path",{d:"M19.5 4.5v4h-4"}]],nuvem:[["path",{d:"M7 18.5h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 9.5a4.5 4.5 0 0 0 0 9z"}]],chevron:[["path",{d:"M7 9.5l5 5 5-5"}]],pino:[["path",{d:"M9.5 3.5h5l-.8 5.2 3.3 3.1v1.7H7v-1.7l3.3-3.1z"}],["path",{d:"M12 13.5v7"}]],pinoCheio:[["path",{d:"M9.5 3.5h5l-.8 5.2 3.3 3.1v1.7H7v-1.7l3.3-3.1z",fill:"currentColor"}],["path",{d:"M12 13.5v7"}]],filtro:[["path",{d:"M4 5.5h16l-6.2 7.3v5.4l-3.6 1.8v-7.2z"}]],ordenar:[["path",{d:"M7.5 4.5v15"}],["path",{d:"M4 16l3.5 3.5L11 16"}],["path",{d:"M16.5 19.5v-15"}],["path",{d:"M13 8l3.5-3.5L20 8"}]],mapa:[["path",{d:"M9 4.5 3.5 6.6v13l5.5-2.1 6 2.1 5.5-2.1v-13L15 6.6z"}],["path",{d:"M9 4.5v13"}],["path",{d:"M15 6.6v13"}]],olho:[["path",{d:"M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"}],["circle",{cx:"12",cy:"12",r:"2.8"}]],camadas:[["path",{d:"M12 3.5 20.5 8 12 12.5 3.5 8z"}],["path",{d:"M3.5 12 12 16.5 20.5 12"}],["path",{d:"M3.5 16 12 20.5 20.5 16"}]],historico:[["path",{d:"M3.8 12.5A8.3 8.3 0 1 0 6.2 6"}],["path",{d:"M3.8 4.2v4.3h4.3"}],["path",{d:"M12 8v4.2l2.8 1.7"}]],pessoa:[["circle",{cx:"12",cy:"8",r:"3.6"}],["path",{d:"M5 20c.9-3.7 3.6-5.6 7-5.6s6.1 1.9 7 5.6"}]],predio:[["path",{d:"M5 20.5v-15a1 1 0 0 1 1-1h7.5a1 1 0 0 1 1 1v15"}],["path",{d:"M14.5 9.5H18a1 1 0 0 1 1 1v10"}],["path",{d:"M3 20.5h18"}],["path",{d:"M8.5 8.5h3"}],["path",{d:"M8.5 12h3"}],["path",{d:"M8.5 15.5h3"}]],brilho:[["path",{d:"M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"}],["path",{d:"M18.5 16.5v4"}],["path",{d:"M16.5 18.5h4"}]],calendario:[["rect",{x:"4",y:"5.5",width:"16",height:"15",rx:"2"}],["path",{d:"M4 10h16"}],["path",{d:"M8.5 3.5v4"}],["path",{d:"M15.5 3.5v4"}]],cadeado:[["rect",{x:"5.5",y:"10.5",width:"13",height:"10",rx:"2"}],["path",{d:"M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"}]],saida:[["path",{d:"M14 4.5h4.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H14"}],["path",{d:"M10 16l4-4-4-4"}],["path",{d:"M14 12H4.5"}]],planilha:[["rect",{x:"4",y:"4",width:"16",height:"16",rx:"2"}],["path",{d:"M4 9.5h16"}],["path",{d:"M4 15h16"}],["path",{d:"M10 9.5V20"}]],mover:[["path",{d:"M4.5 12h14"}],["path",{d:"M13.5 6.5 19 12l-5.5 5.5"}]],sol:[["circle",{cx:"12",cy:"12",r:"3.8"}],["path",{d:"M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"}]],teclado:[["rect",{x:"3",y:"6.5",width:"18",height:"11",rx:"2"}],["path",{d:"M7 10h.01M10.3 10h.01M13.7 10h.01M17 10h.01M8 14h8"}]],gantt:[["path",{d:"M4 5h9M7 12h11M4 19h7"}],["path",{d:"M3 3v18"}]],demandas:[["circle",{cx:"10",cy:"7.8",r:"3.2"}],["path",{d:"M3.8 19.5a6.2 5.2 0 0 1 11.8-2.6"}],["circle",{cx:"17.6",cy:"17.6",r:"4.2"}],["path",{d:"m15.6 17.7 1.5 1.5 2.5-3"}]]},Rr=Object.keys(Co);function ao(e,o=18,r=document){let t="http://www.w3.org/2000/svg",n=r.createElementNS(t,"svg"),a={viewBox:"0 0 24 24",width:String(o),height:String(o),fill:"none",stroke:"currentColor","stroke-width":"1.8","stroke-linecap":"round","stroke-linejoin":"round","aria-hidden":"true",focusable:"false",class:"spro-icone"};for(let[i,s]of Object.entries(a))n.setAttribute(i,s);for(let[i,s]of Co[e]){let c=r.createElementNS(t,i);for(let[l,p]of Object.entries(s))c.setAttribute(l,p);n.append(c)}return n}var To="spro-blk-host";function O(e,o,r="",t){let n=e.createElement(o);return r&&(n.className=r),t!==void 0&&(n.textContent=t),n}function qo(e,o,r){let t=O(e,"button",o,r);return t.type="button",t}function zo(e,o={}){e.querySelectorAll(`.${To}`).forEach(w=>w.remove());let r=O(e,"div",To);r.setAttribute("data-tema",o.escuro?"escuro":"claro");let t=r.attachShadow({mode:"open"}),n=e.createElement("style");n.textContent=o.css??"";let a=O(e,"dialog","spro-dialogo spro-blk-dialogo");a.setAttribute("aria-labelledby","spro-blk-titulo");let i=O(e,"h2","","Retornar bloco disponibilizado");i.id="spro-blk-titulo";let s=O(e,"span","spro-dialogo-icone");s.setAttribute("aria-hidden","true"),s.append(ao("restaurar",18,e));let c=qo(e,"spro-botao-icone","");c.setAttribute("aria-label","Fechar"),c.title="Fechar (Esc)",c.dataset.sproFechar="",c.append(ao("fechar",16,e));let l=e.createElement("header");l.append(s,i,c);let p=O(e,"p","spro-blk-texto","O retorno cancela a disponibiliza\xE7\xE3o para outras unidades e libera o bloco para incluir novos documentos. Depois da inclus\xE3o, voc\xEA pode disponibiliz\xE1-lo novamente."),d=O(e,"p","spro-blk-status","Carregando blocos disponibilizados\u2026");d.setAttribute("role","status"),d.setAttribute("aria-live","polite");let m=O(e,"fieldset","spro-blk-lista");m.hidden=!0,m.append(O(e,"legend","","Selecione o bloco"));let f=qo(e,"spro-botao primario","Retornar bloco");f.dataset.sproConfirmar="",f.disabled=!0;let x=O(e,"div","spro-dialogo-rodape");x.append(f);let v=O(e,"div","spro-dialogo-corpo");v.append(p,d,m,x),a.append(l,v),t.append(n,a);let M=()=>{typeof a.close=="function"&&a.open&&a.close(),r.remove()};return a.addEventListener("close",()=>r.remove()),{host:r,raiz:t,dialogo:a,titulo:i,explicacao:p,status:d,lista:m,confirmar:f,fecharX:c,remover:M,abrir(){(e.body??e.documentElement).append(r),typeof a.showModal=="function"?a.showModal():a.setAttribute("open","")}}}function Bo({doc:e,url:o,sei:r,topo:t=e,css:n=""}){let a=!1,i=!1,s=!1,c=null,l=null,p=null,d=new Set,m=new URL(o).searchParams.get("acao")==="bloco_escolher";function f(){l?.abort(),l=null;let _=c;c=null,_?.remover(),p?.isConnected&&p.focus(),p=null}function x(){f();for(let _ of d)_.remove();d.clear()}function v(){if(!a||i||!m)return;let _=e.querySelector("#frmBlocoEscolher #selBloco");if(!_)return;for(let q of d)q.isConnected||d.delete(q);let R=[...e.querySelectorAll("#frmBlocoEscolher #divInfraBarraComandosSuperior, #frmBlocoEscolher #divInfraBarraComandosInferior")],j=R.length?R:[_.parentElement];for(let q of j){if(q.querySelector(".spro-blocos-retornar"))continue;let P=e.createElement("button");P.type="button",P.className="infraButton spro-blocos-retornar",P.textContent="Retornar bloco disponibilizado",P.disabled=s,P.addEventListener("click",()=>{M(P)}),q.append(P),d.add(P)}}async function M(_){if(!a||i||c||s)return;p=_;let R=zo(t,{css:n,escuro:!!t.body?.classList.contains("dark-mode")}),{dialogo:j,titulo:q,explicacao:P,status:D,lista:k,confirmar:$,fecharX:U}=R;c=R;let io=()=>{s||f()};j.addEventListener("cancel",g=>{g.preventDefault(),io()}),j.addEventListener("close",()=>{c===R&&(c=null,l?.abort(),l=null)}),U.addEventListener("click",io),R.abrir(),U.focus();let F="",S="",so=g=>{S=g};k.addEventListener("change",()=>{F=k.querySelector("input:checked")?.value??"",$.disabled=!F||s});let co=new AbortController;l=co;let z=()=>!i&&a&&c===R;try{let g=await Mo(r,{sinal:co.signal,aoAviso:so});if(!z())return;if(l=null,!g.length){D.textContent="Nenhum bloco disponibilizado que possa retornar nesta unidade foi encontrado."+(S?` ${S}`:""),$.remove();return}for(let L of g){let C=t.createElement("label"),B=t.createElement("input");B.type="radio",B.name="spro-bloco-retorno",B.value=L.id;let V=t.createElement("span");V.textContent=`${L.numero} - ${L.descricao}`,C.append(B,V),k.append(C)}k.hidden=!1,D.textContent="Escolha um bloco e confirme o retorno."+(S?` ${S}`:""),k.querySelector("input")?.focus()}catch(g){if(!z())return;l=null,D.textContent=g instanceof Error?g.message:"N\xE3o foi poss\xEDvel carregar os blocos. Tente novamente.",S&&(D.textContent+=` ${S}`),$.remove()}$.addEventListener("click",()=>{Go()});async function Go(){if(!(!z()||s||!F||$.disabled)){s=!0,$.disabled=!0,U.disabled=!0,k.disabled=!0;for(let g of d)g.disabled=!0;D.textContent="Retornando o bloco e verificando a inclus\xE3o\u2026";try{let g=await ko(r,F,o,{aoAviso:so});if(!z())return;let L=e.querySelector("#frmBlocoEscolher #selBloco");if(!L)D.textContent="Bloco retornado no SEI. A tela de inclus\xE3o mudou; atualize-a antes de continuar.";else{let C=[...L.options].find(V=>V.value===g.id);if(!C){C=e.createElement("option"),C.value=g.id;let V=[...L.options].find(lo=>/^\d+$/.test(lo.value)&&Number(lo.value)<Number(g.id));L.insertBefore(C,V??null)}C.textContent=g.rotulo,L.value=g.id;let B=e.defaultView.Event;L.dispatchEvent(new B("chosen:updated",{bubbles:!0})),D.textContent="Bloco retornado e selecionado no campo Bloco. Voc\xEA pode incluir os documentos marcados."}S&&(D.textContent+=` ${S}`),q.textContent="Bloco retornado",P.remove(),k.remove(),$.remove()}catch(g){if(!z())return;D.textContent=g instanceof Error?g.message:"N\xE3o foi poss\xEDvel confirmar o retorno. Confira o bloco no SEI antes de tentar novamente.",S&&(D.textContent+=` ${S}`),$.disabled=!1}finally{s=!1;for(let g of d)g.disabled=!1;z()&&(U.disabled=!1,k.disabled=!1,U.focus())}}}}let w=e.defaultView.MutationObserver,no=new w(v);return m&&no.observe(e.body,{childList:!0,subtree:!0}),{configurar(_){i||(a=_,a?v():x())},fechar(){i=!0,a=!1,no.disconnect(),x()}}}var Vo=`/*\r
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
`;var Ho=`/*\r
 * O modal "Retornar bloco disponibilizado", dentro do Shadow DOM, depois do base.css do sei-comum (tokens,\r
 * bot\xF5es, dialog.spro-dialogo, cabe\xE7alho com ladrilho, rodap\xE9). Aqui s\xF3 a lista dos blocos.\r
 */\r
dialog.spro-blk-dialogo {\r
  width: min(520px, calc(100vw - 32px));\r
}\r
.spro-blk-texto,\r
.spro-blk-status {\r
  margin: 0;\r
  font-size: 13px;\r
  line-height: 1.5;\r
  color: var(--spro-suave);\r
}\r
.spro-blk-status:empty {\r
  display: none;\r
}\r
.spro-blk-lista {\r
  display: grid;\r
  gap: 6px;\r
  min-width: 0;\r
  max-height: 280px;\r
  margin: 0;\r
  padding: 0;\r
  overflow-y: auto;\r
  border: 0;\r
  scrollbar-width: thin;\r
}\r
.spro-blk-lista[hidden] {\r
  display: none;\r
}\r
.spro-blk-lista legend {\r
  margin-bottom: 6px;\r
  padding: 0;\r
  font-size: 12.5px;\r
  font-weight: 600;\r
  color: var(--spro-suave);\r
}\r
.spro-blk-lista label {\r
  display: flex;\r
  align-items: baseline;\r
  gap: 10px;\r
  padding: 8px 10px;\r
  background: var(--spro-fundo-2);\r
  border: 1px solid var(--spro-borda);\r
  border-radius: var(--spro-raio);\r
  cursor: pointer;\r
  transition:\r
    border-color var(--spro-dur),\r
    background var(--spro-dur);\r
}\r
.spro-blk-lista label:hover {\r
  border-color: var(--spro-borda-forte);\r
}\r
.spro-blk-lista label:has(input:checked) {\r
  background: var(--spro-destaque-suave);\r
  border-color: var(--spro-destaque);\r
}\r
.spro-blk-lista input {\r
  flex: none;\r
  accent-color: var(--spro-destaque);\r
}\r
.spro-blk-lista span {\r
  min-width: 0;\r
  overflow-wrap: anywhere;\r
}\r
.spro-blk-lista:disabled {\r
  opacity: 0.6;\r
}\r
/* Sem a\xE7\xE3o no rodap\xE9 (lista vazia, erro de leitura, retorno conclu\xEDdo): o X j\xE1 fecha. */\r
.spro-dialogo-rodape:empty {\r
  display: none;\r
}\r
`;var Uo=`/* S\xF3 o bot\xE3o na tela de inclus\xE3o (o modal tem o CSS pr\xF3prio, em modal.css, dentro do Shadow DOM). */\r
.spro-blocos-retornar { margin: 4px 0 4px 8px; }\r
.spro-blocos-retornar:focus-visible { outline: 2px solid #005ea8; outline-offset: 3px; }\r
`;var jo="retornarblocodisponibilizado";function Fo(){if(new URL(location.href).searchParams.get("acao")!=="bloco_escolher")return;let e=document.createElement("style");e.textContent=Uo,document.head.append(e);let o=new K(location.href,()=>{let a=eo();return Lo(a,a.location?.href??location.href)}),r=Bo({doc:document,url:location.href,sei:o,topo:eo(),css:`${Vo}
${Ho}`}),t=!1,n=(a,i)=>{i!=="sync"||!("dataValues"in a)||(t=!0,r.configurar(ro(a.dataValues.newValue,jo)))};chrome.storage.onChanged.addListener(n),chrome.storage.sync.get("dataValues").then(a=>{t||r.configurar(ro(a.dataValues,jo))}).catch(()=>{}),window.addEventListener("pagehide",a=>{a.persisted||(r.fechar(),chrome.storage.onChanged.removeListener(n),e.remove())},{once:!0})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",Fo,{once:!0}):Fo();})();
