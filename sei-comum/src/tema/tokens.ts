import type { ConfigTema } from "./config";
import { derivarBarra, type Esquema } from "./paleta";

/** Superfícies em camadas (pagina < fundo < fundo-2 < fundo-3); as do escuro são as de ui/base.css. */
const SUPERFICIES: Record<Esquema, Record<string, string>> = {
  claro: {
    "--spro-fundo": "#ffffff",
    "--spro-fundo-2": "#f6f7f9",
    "--spro-fundo-3": "#eceef2",
    "--spro-pagina": "#f3f4f7",
    "--spro-texto": "#1b1f24",
    "--spro-suave": "#5d6772",
    "--spro-fraco": "#8b939c",
    "--spro-borda": "#e3e6eb",
    "--spro-borda-forte": "#cfd4db",
    "--spro-perigo": "#d1352b",
    "--spro-aviso": "#b45c0a",
    "--spro-ok": "#12805c",
    "--spro-tom-azul": "#2563eb",
    "--spro-tom-verde": "#12805c",
    "--spro-tom-ambar": "#b45c0a",
    "--spro-tom-laranja": "#c2410c",
    "--spro-tom-roxo": "#6d4fd8",
    "--spro-tom-rosa": "#be2f78",
    "--spro-tom-ciano": "#0e7490",
    "--spro-sombra-1": "0 1px 2px rgb(16 24 40 / 6%)",
    "--spro-sombra-2": "0 2px 4px -2px rgb(16 24 40 / 8%), 0 6px 14px -4px rgb(16 24 40 / 12%)",
    "--spro-sombra-3": "0 10px 24px -6px rgb(16 24 40 / 18%), 0 24px 56px -12px rgb(16 24 40 / 24%)",
    "--spro-veu": "rgb(17 21 28 / 46%)",
  },
  escuro: {
    "--spro-fundo": "#1a1d21",
    "--spro-fundo-2": "#22262b",
    "--spro-fundo-3": "#2b3036",
    "--spro-pagina": "#141619",
    "--spro-texto": "#e7e9ec",
    "--spro-suave": "#a4abb3",
    "--spro-fraco": "#767e87",
    "--spro-borda": "#2f343a",
    "--spro-borda-forte": "#3d434a",
    "--spro-perigo": "#ff7d73",
    "--spro-aviso": "#e8b04a",
    "--spro-ok": "#4fcf96",
    "--spro-tom-azul": "#7aa8ff",
    "--spro-tom-verde": "#4fcf96",
    "--spro-tom-ambar": "#e8b04a",
    "--spro-tom-laranja": "#fb923c",
    "--spro-tom-roxo": "#ab98ff",
    "--spro-tom-rosa": "#f58bbd",
    "--spro-tom-ciano": "#5fd3e6",
    "--spro-sombra-1": "0 1px 2px rgb(0 0 0 / 30%)",
    "--spro-sombra-2": "0 2px 4px -2px rgb(0 0 0 / 40%), 0 6px 14px -4px rgb(0 0 0 / 45%)",
    "--spro-sombra-3": "0 10px 24px -6px rgb(0 0 0 / 50%), 0 24px 56px -12px rgb(0 0 0 / 60%)",
    "--spro-veu": "rgb(0 0 0 / 58%)",
  },
};

/** Texto de um destaque: branco, ou quase-preto no escuro (onde o destaque é claro). */
const TEXTO_DO_DESTAQUE: Record<Esquema, string> = { claro: "#ffffff", escuro: "#0a1526" };

/** Tokens do tema como pares nome/valor (sem seletor). */
export function gerarTokens(cfg: ConfigTema, esquema: Esquema): Record<string, string> {
  const b = derivarBarra(cfg.corBarra, esquema);
  return {
    ...SUPERFICIES[esquema],
    "--spro-barra": b.barra,
    "--spro-barra-texto": b.texto,
    "--spro-barra-hover": b.hover,
    "--spro-barra-borda": b.borda,
    "--spro-menu": b.menu,
    "--spro-menu-texto": "#f2f4f7",
    "--spro-destaque": b.destaque,
    "--spro-destaque-texto": TEXTO_DO_DESTAQUE[esquema],
    "--spro-destaque-suave": "color-mix(in srgb, var(--spro-destaque) 12%, transparent)",
    "--spro-destaque-medio": "color-mix(in srgb, var(--spro-destaque) 22%, transparent)",
    "--spro-anel": "0 0 0 3px color-mix(in srgb, var(--spro-destaque) 30%, transparent)",
    "--spro-raio-p": "6px",
    "--spro-raio": "8px",
    "--spro-raio-g": "12px",
    "--spro-raio-xg": "16px",
    "--spro-fonte": 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    "--spro-dur": "150ms",
    /** Curva das transições da casca (estava em uso em ~34 regras sem estar definida, então nenhuma transição rodava). */
    "--spro-curva": "cubic-bezier(0.22, 0.61, 0.36, 1)",
  };
}

/**
 * Texto CSS completo do tema: o bloco de tokens no seletor `:root[data-spro-tema-ativo]`
 * e, depois, a folha base (quem a escreve usa só `var(--spro-*)`).
 */
export function gerarFolha(cfg: ConfigTema, esquema: Esquema, baseCss = ""): string {
  const linhas = Object.entries(gerarTokens(cfg, esquema)).map(([k, v]) => `  ${k}: ${v};`);
  return `:root[data-spro-tema-ativo] {\n${linhas.join("\n")}\n  color-scheme: ${esquema === "escuro" ? "dark" : "light"};\n}\n${baseCss}`;
}
