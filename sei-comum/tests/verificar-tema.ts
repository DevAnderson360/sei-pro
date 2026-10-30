import { CONFIG_PADRAO, esquemaResolvido, normalizarConfig } from "../src/tema/config";
import { contraste } from "../src/tema/paleta";
import { gerarFolha, gerarTokens } from "../src/tema/tokens";
import { checar, secao } from "./util";

export function verificarTema(): void {
  secao("tema/config");
  for (const lixo of [null, undefined, "", "{", "texto", 42, [], { versao: 9 }, { versao: "1" }]) {
    const c = normalizarConfig(lixo);
    checar(`lixo ${JSON.stringify(lixo)} -> padrao`, JSON.stringify(c) === JSON.stringify(CONFIG_PADRAO));
  }
  const c1 = normalizarConfig({
    versao: 1,
    ativo: true,
    modo: "escuro",
    paleta: "floresta",
    corBarra: "#ff0000",
    escurecerDocumentos: false,
  });
  checar("paleta pronta vence a cor", c1.corBarra === "#1f7a4d" && c1.paleta === "floresta");
  checar("campos validos preservados", c1.ativo && c1.modo === "escuro" && !c1.escurecerDocumentos);
  const c2 = normalizarConfig({ versao: 1, paleta: "livre", corBarra: "#AABBCC" });
  checar("cor livre em minuscula", c2.paleta === "livre" && c2.corBarra === "#aabbcc");
  const c3 = normalizarConfig({ versao: 1, paleta: "livre", corBarra: "vermelho", modo: "roxo", ativo: "sim" });
  checar("cor/modo invalidos caem no padrao", c3.corBarra === CONFIG_PADRAO.corBarra && c3.modo === "auto" && c3.ativo === false);
  checar("aceita JSON em string", normalizarConfig(JSON.stringify({ versao: 1, ativo: true })).ativo === true);
  checar("auto segue o sistema", esquemaResolvido(CONFIG_PADRAO, true) === "escuro" && esquemaResolvido(CONFIG_PADRAO, false) === "claro");
  checar(
    "claro/escuro ignoram o sistema",
    esquemaResolvido({ ...CONFIG_PADRAO, modo: "claro" }, true) === "claro" &&
      esquemaResolvido({ ...CONFIG_PADRAO, modo: "escuro" }, false) === "escuro",
  );

  secao("tema/tons dos icones");
  for (const esq of ["claro", "escuro"] as const) {
    const t = gerarTokens(CONFIG_PADRAO, esq);
    const nomes = Object.keys(t).filter((k) => k.startsWith("--spro-tom-"));
    checar(`${esq}: 7 tons definidos`, nomes.length === 7, nomes);
    const piores = nomes.map((n) => [n, contraste(t[n] as string, t["--spro-fundo"] as string)] as const).filter(([, c]) => c < 3);
    checar(`${esq}: todo tom tem contraste >= 3:1 sobre a superficie da barra`, piores.length === 0, piores);
    const sobreFundo3 = nomes.map((n) => [n, contraste(t[n] as string, t["--spro-fundo-3"] as string)] as const).filter(([, c]) => c < 3);
    checar(`${esq}: e sobre o fundo de hover (fundo-3)`, sobreFundo3.length === 0, sobreFundo3);
  }

  secao("tema/tokens");
  for (const esq of ["claro", "escuro"] as const) {
    const css = gerarFolha(CONFIG_PADRAO, esq, "/*base*/");
    for (const t of [
      "--spro-barra",
      "--spro-barra-texto",
      "--spro-barra-hover",
      "--spro-barra-borda",
      "--spro-fundo",
      "--spro-pagina",
      "--spro-texto",
      "--spro-borda",
      "--spro-destaque",
      "--spro-anel",
      "--spro-raio",
    ])
      checar(`${esq}: define ${t}`, css.includes(`${t}:`));
    checar(`${esq}: sem undefined/NaN`, !/undefined|NaN/.test(css));
    checar(
      `${esq}: sem recurso externo`,
      !/@import|url\(\s*["']?https?:|\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(css.replace(/\/\*[\s\S]*?\*\//g, "")),
    );
    checar(`${esq}: color-scheme`, css.includes(`color-scheme: ${esq === "escuro" ? "dark" : "light"}`));
    checar(`${esq}: inclui a folha base depois dos tokens`, css.endsWith("/*base*/"));
  }
  const esc = gerarFolha(CONFIG_PADRAO, "escuro");
  checar(
    "escuro usa as superficies de base.css",
    ["#141619", "#1a1d21", "#22262b", "#2b3036"].every((c) => esc.includes(c)),
  );
}

export async function verificarTemaNosPaineis(): Promise<void> {
  const { acompanharTemaEstilo2 } = await import("../src/tema/painel");
  const { aoMudarEsquemaSei, esquemaDoEstilo2, seiEscuro } = await import("../src/pagina/tema");
  const { instalarDom, tique } = await import("./util");

  secao("tema: esquema do SEI para os paineis");
  const doc = instalarDom("<html><head></head><body></body></html>");
  const sem = { getItem: () => null };
  const legado = { getItem: (k: string) => (k === "darkModePro" ? "1" : null) };
  checar("sem Estilo 2 e sem legado: claro", esquemaDoEstilo2(doc) === null && seiEscuro(doc, sem) === false);
  checar("sem Estilo 2, com modo noturno antigo: escuro", seiEscuro(doc, legado) === true);
  doc.documentElement.setAttribute("data-spro-tema", "escuro");
  checar("Estilo 2 escuro: escuro", seiEscuro(doc, sem) === true);
  doc.documentElement.setAttribute("data-spro-tema", "claro");
  checar("Estilo 2 claro vence o modo noturno antigo", seiEscuro(doc, legado) === false);
  doc.documentElement.setAttribute("data-spro-tema", "lixo");
  checar("valor desconhecido: ignora e usa o legado", esquemaDoEstilo2(doc) === null && seiEscuro(doc, legado) === true);
  doc.documentElement.removeAttribute("data-spro-tema");
  checar("aoMudarEsquemaSei nao quebra sem MutationObserver", typeof aoMudarEsquemaSei(doc, () => {}) === "function");

  secao("tema: painel (pagina da extensao)");
  const fake = (inicial: unknown, sistemaEscuro = false) => {
    let aoMudar: ((v: unknown) => void) | null = null;
    let aoSistema: (() => void) | null = null;
    let escuroSistema = sistemaEscuro;
    return {
      deps: {
        ler: async () => inicial,
        aoMudar: (cb: (v: unknown) => void) => {
          aoMudar = cb;
          return () => {
            aoMudar = null;
          };
        },
        sistemaEscuro: () => escuroSistema,
        aoMudarSistema: (cb: () => void) => {
          aoSistema = cb;
          return () => {
            aoSistema = null;
          };
        },
      },
      mudar: (v: unknown) => aoMudar?.(v),
      sistema: (e: boolean) => {
        escuroSistema = e;
        aoSistema?.();
      },
      assinado: () => aoMudar !== null || aoSistema !== null,
    };
  };
  const ligado = { versao: 1, ativo: true, modo: "escuro", paleta: "floresta", corBarra: "#1f7a4d", escurecerDocumentos: true };

  const d1 = instalarDom("<html data-tema='claro'><head></head><body></body></html>");
  const f1 = fake(ligado);
  const parar1 = acompanharTemaEstilo2(d1, f1.deps);
  await tique(10);
  checar("ativo + escuro: data-tema vira escuro", d1.documentElement.dataset.tema === "escuro");
  checar("destaque derivado da barra (hex)", /^#[0-9a-f]{6}$/.test(d1.documentElement.style.getPropertyValue("--spro-destaque")));
  checar("texto do destaque no escuro", d1.documentElement.style.getPropertyValue("--spro-destaque-texto") === "#0a1526");

  f1.mudar({ ...ligado, modo: "claro" });
  checar(
    "mudar para claro ao vivo",
    d1.documentElement.dataset.tema === "claro" && d1.documentElement.style.getPropertyValue("--spro-destaque-texto") === "#ffffff",
  );
  f1.mudar({ ...ligado, ativo: false });
  checar(
    "desligar restaura o que o contexto da aba tinha (claro) e tira o destaque",
    d1.documentElement.dataset.tema === "claro" && d1.documentElement.style.getPropertyValue("--spro-destaque") === "",
  );
  f1.mudar({ ...ligado, modo: "auto" });
  f1.sistema(true);
  checar("automatico segue o sistema ao vivo", d1.documentElement.dataset.tema === "escuro");
  f1.sistema(false);
  checar("automatico volta ao claro", d1.documentElement.dataset.tema === "claro");
  parar1();
  checar("parar desassina tudo", !f1.assinado());

  const d2 = instalarDom("<html data-tema='escuro'><head></head><body></body></html>");
  const f2 = fake(null);
  acompanharTemaEstilo2(d2, f2.deps);
  await tique(10);
  checar(
    "sem configuracao (Estilo 2 desligado): nao mexe no que o contexto definiu",
    d2.documentElement.dataset.tema === "escuro" && d2.documentElement.style.getPropertyValue("--spro-destaque") === "",
  );

  const d3 = instalarDom("<html><head></head><body></body></html>");
  const f3 = fake("lixo{");
  acompanharTemaEstilo2(d3, f3.deps);
  await tique(10);
  checar("configuracao corrompida: nao lanca e nao mexe", d3.documentElement.dataset.tema === undefined);

  secao("tema: painel ao desligar (aoDesligar) e contexto");
  const { aplicarTemaDoContexto } = await import("../src/tema/painel");
  const d4 = instalarDom("<html data-tema='escuro'><head></head><body></body></html>");
  const f4 = fake(ligado);
  let pedidos = 0;
  acompanharTemaEstilo2(d4, f4.deps, {
    aoDesligar: () => {
      pedidos++;
      aplicarTemaDoContexto(d4.documentElement, { temaEscuro: false, corTema: "#336699" });
    },
  });
  await tique(10);
  checar("ligado: sem pedir contexto", pedidos === 0 && d4.documentElement.dataset.tema === "escuro");
  f4.mudar({ ...ligado, ativo: false });
  checar("desligar tira o destaque na hora", d4.documentElement.style.getPropertyValue("--spro-destaque") === "");
  await tique(350);
  checar("desligar pede o contexto atual (uma vez) e aplica", pedidos === 1 && d4.documentElement.dataset.tema === "claro");
  checar(
    "a cor da barra do contexto vira --spro-cor-sei",
    d4.documentElement.style.getPropertyValue("--spro-cor-sei") === "#336699" && d4.documentElement.hasAttribute("data-cor-sei"),
  );
  aplicarTemaDoContexto(d4.documentElement, { temaEscuro: true });
  checar(
    "contexto sem cor limpa o que havia",
    d4.documentElement.style.getPropertyValue("--spro-cor-sei") === "" &&
      !d4.documentElement.hasAttribute("data-cor-sei") &&
      d4.documentElement.dataset.tema === "escuro",
  );

  const d5 = instalarDom("<html data-tema='claro'><head></head><body></body></html>");
  const f5 = fake({ ...ligado, ativo: false });
  let pedidos5 = 0;
  acompanharTemaEstilo2(d5, f5.deps, { aoDesligar: () => void pedidos5++ });
  await tique(350);
  checar("nunca esteve ligado: desligado nao pede contexto", pedidos5 === 0 && d5.documentElement.dataset.tema === "claro");

  const d6 = instalarDom("<html data-tema='escuro'><head></head><body></body></html>");
  const f6 = fake(ligado);
  let pedidos6 = 0;
  const parar6 = acompanharTemaEstilo2(d6, f6.deps, { aoDesligar: () => void pedidos6++ });
  await tique(10);
  f6.mudar({ ...ligado, ativo: false });
  parar6();
  await tique(350);
  checar("parar antes do prazo cancela o pedido", pedidos6 === 0);
}
