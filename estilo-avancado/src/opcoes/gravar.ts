import { definirOpcaoLegada } from "@comum/opcoes/legadas";
import { CHAVE_TEMA, type ConfigTema, normalizarConfig } from "@comum/tema/config";

/** Opção do legado que liga a nova visão do Controle de Processos (grade). */
export const OPCAO_NOVO_CONTROLE = "gradecontrole";

/**
 * Grava o tema no chrome.storage.sync. Ao LIGAR o Estilo Avançado (estava desligado), liga junto a nova visão do
 * Controle de Processos: os dois foram desenhados para andar juntos. Só na virada de desligado para ligado: quem
 * desliga a visão nova depois, com o estilo já ligado, não é desfeito.
 */
export async function gravarTema(cfg: ConfigTema): Promise<void> {
  const antes = normalizarConfig((await chrome.storage.sync.get(CHAVE_TEMA))[CHAVE_TEMA]);
  await chrome.storage.sync.set({ [CHAVE_TEMA]: cfg });
  if (cfg.ativo && !antes.ativo) await definirOpcaoLegada(OPCAO_NOVO_CONTROLE, true);
}
