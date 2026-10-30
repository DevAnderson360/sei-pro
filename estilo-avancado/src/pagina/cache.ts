import { CHAVE_TEMA_CACHE, type ConfigTema, normalizarConfig } from "@comum/tema/config";

/**
 * Espelho síncrono da configuração (localStorage da origem do SEI): o `chrome.storage` é
 * assíncrono e, sem isto, a primeira pintura sairia no tema antigo (flash branco).
 */
export function lerCache(armazenamento: Pick<Storage, "getItem">): ConfigTema | null {
  try {
    const bruto = armazenamento.getItem(CHAVE_TEMA_CACHE);
    return bruto ? normalizarConfig(bruto) : null;
  } catch {
    return null;
  }
}

export function gravarCache(armazenamento: Pick<Storage, "setItem">, cfg: ConfigTema): void {
  try {
    armazenamento.setItem(CHAVE_TEMA_CACHE, JSON.stringify(cfg));
  } catch {
    /* armazenamento bloqueado: só perde o anti-flash */
  }
}
