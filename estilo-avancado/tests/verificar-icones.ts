import { gerarCssIcones, gerarCssMenuPro, nomesDeIcones, svgDoIcone } from "../src/icones/css";
import { engrenagem } from "../src/icones/extras";
import { MAPA_ICONES, MAPA_MENU_PRO } from "../src/icones/mapa";
import { ICONES_PROPRIOS } from "../src/icones/proprios";
import { checar, secao } from "./util";

export function verificarIcones(): void {
  secao("icones da casca");
  const nomes = new Set(nomesDeIcones());
  const sem = MAPA_ICONES.filter((e) => !(e.proprio ? e.icone in ICONES_PROPRIOS : nomes.has(e.icone))).map(
    (e) => `${e.src} -> ${e.icone}`,
  );
  checar("todo icone do mapa existe no conjunto", sem.length === 0, sem);
  const dup = MAPA_ICONES.filter(
    (e, i) => MAPA_ICONES.findIndex((o) => o.src === e.src && !!o.daExtensao === !!e.daExtensao && o.contexto === e.contexto) !== i,
  ).map((e) => e.src);
  checar("nenhum src repetido no mapa", dup.length === 0, dup);

  let ruins = 0;
  for (const n of nomes) {
    const svg = svgDoIcone(n);
    const abre = (svg.match(/<(path|circle|rect|line|polyline|ellipse)\b/g) ?? []).length;
    const fecha = (svg.match(/\/>/g) ?? []).length;
    if (!svg.startsWith("<svg ") || !svg.endsWith("</svg>") || abre === 0 || abre !== fecha || /NaN|undefined/.test(svg)) ruins++;
  }
  checar(`${nomes.size} icones geram SVG bem formado, sem NaN`, ruins === 0, ruins);

  const css = gerarCssIcones();
  checar("css gerado so tem ASCII", !/[^\x00-\x7f]/.test(css));
  checar("css gerado sem recurso externo (so data:)", !/url\("(?!data:)/.test(css) && !/@import/.test(css));
  checar(
    "uma regra de mascara por icone mapeado",
    (css.match(/-webkit-mask-image:/g) ?? []).length === MAPA_ICONES.filter((e) => !e.proprio).length,
  );
  checar(
    "todo seletor fica no escopo do seu contexto",
    /#infraMenu img/.test(css) && /#divInfraBarraSistemaPadrao img/.test(css) && /div\.barraBotoesSEI/.test(css) && /table img/.test(css),
  );
  checar("todo seletor fica sob o tema ativo", (css.match(/^:root\[data-spro-tema-ativo\]/gm) ?? []).length >= MAPA_ICONES.length);

  const semTom = MAPA_ICONES.filter((e) => e.contexto === "barra" && !e.tom && !e.proprio).map((e) => e.src);
  checar("todo icone das barras de acoes tem tom (cor por funcao)", semTom.length === 0, semTom);
  const menuComTom = MAPA_ICONES.filter((e) => e.contexto === "menu" && e.tom);
  checar("o menu lateral fica sem tom (uma cor so, como pedido)", menuComTom.length === 0);
  const proprios = MAPA_ICONES.filter((e) => e.proprio);
  checar(
    "os botoes do SEI Pro tem desenho multicolor proprio (conteudo da imagem, sem mascara)",
    proprios.length >= 6 && proprios.every((e) => new Set(ICONES_PROPRIOS[e.icone]?.match(/fill="#[0-9a-f]+"/gi)).size >= 2),
  );
  checar("o Agente de IA e o Estudio de Fluxo ficam com o icone original", !MAPA_ICONES.some((e) => /botpro_icon|fluxos/.test(e.src)));
  const so = svgDoIcone("documento");
  const cheio = svgDoIcone("documento", 0.62);
  checar("sem preenchimento: so traco", !/fill-opacity/.test(so));
  checar(
    "com preenchimento: corpo fechado ganha fill-opacity e o contorno continua",
    /fill="#000" fill-opacity="0.62"/.test(cheio) && /stroke="#000"/.test(cheio),
  );
  checar(
    "preenchido e traco geram o mesmo numero de formas",
    (so.match(/<path|<circle|<rect/g) ?? []).length === (cheio.match(/<path|<circle|<rect/g) ?? []).length,
  );
  checar(
    "as barras de acoes usam o preenchido e o menu nao",
    /fill-opacity/.test(gerarCssIcones([{ src: "x.svg", icone: "documento", contexto: "barra" }])) &&
      !/fill-opacity/.test(gerarCssIcones(MAPA_ICONES.filter((e) => e.contexto === "menu"))),
  );
  const pro = gerarCssMenuPro();
  checar(
    "itens do SEI Pro: um icone existente por id",
    MAPA_MENU_PRO.every((e) => nomes.has(e.icone)) && (pro.match(/-webkit-mask-image:/g) ?? []).length === MAPA_MENU_PRO.length,
  );
  checar("itens do SEI Pro: so ASCII e sem recurso externo", !/[^\x00-\x7f]/.test(pro) && !/url\("(?!data:)/.test(pro));
  const g = engrenagem(8);
  const d = String((g[0] as [string, Record<string, string>])[1].d);
  checar("engrenagem: 8 dentes (32 vertices) e sem NaN", (d.match(/L/g) ?? []).length === 31 && !/NaN/.test(d), d.slice(0, 60));
  checar(
    "icone desconhecido lanca",
    (() => {
      try {
        svgDoIcone("nao-existe");
        return false;
      } catch {
        return true;
      }
    })(),
  );
}
