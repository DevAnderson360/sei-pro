/**
 * O corte do sigilo nas demandas (spec 4.6): processo ou documento sigiloso nunca vai ao Texto Padrão. A regra é
 * a do Projetos (`@projetos/modelo/sigilo`): vai vazio e marcado. O que o corte raspa volta como `raspados` para a
 * memória do sigilo do usuário (o que o texto raspou uma vez continua raspado).
 */

import { DOCUMENTO_VAZIO, type Numeros, nenhumNumero, type SigilosConhecidos, VINCULO_VAZIO } from "@projetos/modelo/sigilo";
import { chaveDocumento, chaveProtocolo } from "@projetos/modelo/vinculos";
import type { Demanda } from "./tipos";

export function cortarSigiloDemandas(
  demandas: readonly Demanda[],
  conhecidos: SigilosConhecidos,
): { demandas: Demanda[]; raspados: Numeros } {
  const raspados = nenhumNumero();
  const saida = demandas.map((d) => {
    let mudou = false;
    let processoSigiloso = false;
    const processos = d.processos.map((p) => {
      const sigiloso = p.sigiloso === true || (p.protocolo !== "" && conhecidos.processos.has(chaveProtocolo(p.protocolo)));
      if (!sigiloso) return p;
      // A memória guarda a chave (so digitos), a mesma que o Projetos grava e que o corte consulta.
      if (chaveProtocolo(p.protocolo)) raspados.processos.push(chaveProtocolo(p.protocolo));
      mudou = true;
      processoSigiloso = true;
      return { ...VINCULO_VAZIO };
    });
    let documentoEntregue = d.documentoEntregue;
    const doc = d.documentoEntregue;
    // O documento entregue de uma demanda com processo sigiloso e sigiloso (como o Projetos deduz pelo processo).
    if (
      doc &&
      (processoSigiloso || doc.sigiloso === true || (doc.numero !== "" && conhecidos.documentos.has(chaveDocumento(doc.numero))))
    ) {
      if (doc.numero) raspados.documentos.push(doc.numero);
      documentoEntregue = { ...DOCUMENTO_VAZIO };
      mudou = true;
    }
    return mudou ? { ...d, processos, ...(documentoEntregue ? { documentoEntregue } : {}) } : d;
  });
  return { demandas: saida, raspados };
}
