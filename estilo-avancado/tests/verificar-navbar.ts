import { ATRIBUTO_COMPACTA, ATRIBUTO_ORGAO, iniciarNavbarCompacta } from "../src/pagina/navbar";
import { checar, disparar, instalarDom, secao } from "./util";

export function verificarNavbar(): void {
  secao("barra superior com duas alturas");
  const doc = instalarDom(
    '<html><head></head><body><nav id="navInfraBarraNavegacao"><div id="divInfraBarraSistema"><h6 class="pl-3 d-none d-md-block">MINISTERIO TESTE</h6><div id="divInfraBarraSistemaPadraoE"><div class="align-self-center" id="logo"></div></div></div></nav><div id="divInfraAreaTelaD"></div></body></html>',
  );
  const rolador = doc.getElementById("divInfraAreaTelaD") as HTMLElement;
  const medidas = { scrollTop: 0, scrollHeight: 1000, clientHeight: 700 };
  for (const k of Object.keys(medidas))
    Object.defineProperty(rolador, k, { get: () => (medidas as Record<string, number>)[k], configurable: true });
  const parar = iniciarNavbarCompacta(doc);
  const compacta = () => doc.documentElement.hasAttribute(ATRIBUTO_COMPACTA);
  const rolar = (n: number) => {
    medidas.scrollTop = n;
    disparar(rolador, "scroll");
  };

  checar("no topo: expandida", !compacta());
  checar("copia o nome do orgao para junto da logo", doc.getElementById("logo")?.getAttribute(ATRIBUTO_ORGAO) === "MINISTERIO TESTE");
  rolar(10);
  checar("rolagem pequena (abaixo de 24 px) nao compacta", !compacta());
  rolar(40);
  checar("passou de 24 px: compacta", compacta());
  rolar(10);
  checar("histerese: em 10 px continua compacta (evita oscilar)", compacta());
  rolar(2);
  checar("volta ao topo: expande", !compacta());

  medidas.scrollHeight = 730;
  rolar(40);
  checar("pagina com pouca rolagem sobrando nao compacta (a barra oscilaria)", !compacta());

  medidas.scrollHeight = 1000;
  rolar(40);
  parar();
  checar("desligar remove o atributo", !compacta());
  checar("desligar tira o nome do orgao da logo", !doc.getElementById("logo")?.hasAttribute(ATRIBUTO_ORGAO));
  rolar(80);
  checar("depois de desligar a rolagem nao mexe mais", !compacta());
}
