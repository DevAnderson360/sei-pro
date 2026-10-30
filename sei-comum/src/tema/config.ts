import { AZUL_PADRAO, type Esquema, lerHex, PALETAS } from "./paleta";

/** Chave no chrome.storage.sync e no espelho síncrono (localStorage) da primeira pintura. */
export const CHAVE_TEMA = "spro_tema";
export const CHAVE_TEMA_CACHE = "spro_tema_cache";

export type ModoTema = "claro" | "escuro" | "auto";

export interface ConfigTema {
  versao: 1;
  /** "Estilo Avançado" ligado (padrão: não; o usuário liga pelo interruptor da barra do SEI ou pelas opções). */
  ativo: boolean;
  modo: ModoTema;
  /** Id de uma paleta pronta, ou "livre". */
  paleta: string;
  /** #rrggbb, sempre válida. */
  corBarra: string;
  escurecerDocumentos: boolean;
}

export const CONFIG_PADRAO: ConfigTema = {
  versao: 1,
  ativo: false,
  modo: "auto",
  paleta: "sei-pro",
  corBarra: AZUL_PADRAO,
  escurecerDocumentos: true,
};

/** Aceita qualquer coisa que venha do storage; nunca lança. */
export function normalizarConfig(valor: unknown): ConfigTema {
  if (typeof valor === "string") {
    try {
      return normalizarConfig(JSON.parse(valor));
    } catch {
      return { ...CONFIG_PADRAO };
    }
  }
  if (!valor || typeof valor !== "object" || (valor as { versao?: unknown }).versao !== 1) return { ...CONFIG_PADRAO };
  const v = valor as Record<string, unknown>;
  const modo: ModoTema = v.modo === "claro" || v.modo === "escuro" || v.modo === "auto" ? v.modo : CONFIG_PADRAO.modo;
  const pronta = PALETAS.find((p) => p.id === v.paleta);
  const hex = typeof v.corBarra === "string" ? v.corBarra.trim().toLowerCase() : "";
  const corLivre = lerHex(hex) && /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
  const paleta = pronta ? pronta.id : "livre";
  const corBarra = pronta ? pronta.cor : (corLivre ?? CONFIG_PADRAO.corBarra);
  return {
    versao: 1,
    ativo: v.ativo === true,
    modo,
    paleta: pronta || corLivre ? paleta : CONFIG_PADRAO.paleta,
    corBarra,
    escurecerDocumentos: v.escurecerDocumentos !== false,
  };
}

export function esquemaResolvido(cfg: ConfigTema, sistemaEscuro: boolean): Esquema {
  if (cfg.modo === "claro") return "claro";
  if (cfg.modo === "escuro") return "escuro";
  return sistemaEscuro ? "escuro" : "claro";
}
