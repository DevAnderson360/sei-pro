/**
 * Nome e logo do produto, lidos do manifest da extensao.
 *
 * O mesmo pacote sai como "SEI Pro", "SEI Pro Lab", "ANTAQ Pro"...; a pagina de
 * opcoes ja mostra o nome e a logo do manifest, e esta usa a mesma regra. Fora
 * da extensao (testes, pre-visualizacao) nao ha manifest: cai em "SEI Pro".
 */

export interface IdentidadeDoProduto {
  nome: string;
  /** Caminho da logo relativo a html/ (onde esta esta pagina). */
  logo: string;
}

interface ManifestMinimo {
  short_name?: string;
  name?: string;
  icons?: Record<string, string>;
}

const NOME_PADRAO = "SEI Pro";
const LOGO_PADRAO = "../icons/icon-32.png";

export function identidadeDoProduto(manifest: ManifestMinimo | undefined): IdentidadeDoProduto {
  const nome = (manifest?.short_name ?? manifest?.name ?? "").trim() || NOME_PADRAO;
  const icone = manifest?.icons?.["32"];
  return { nome, logo: icone ? `../${icone}` : LOGO_PADRAO };
}

/** O manifest da extensao em execucao, ou undefined fora dela. */
export function manifestAtual(): ManifestMinimo | undefined {
  try {
    return chrome.runtime.getManifest();
  } catch {
    return undefined;
  }
}
