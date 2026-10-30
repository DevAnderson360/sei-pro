import {
  CHAVE_PREFERENCIAS,
  chaveImportacao,
  chaveSyncArquivo,
  chaveSyncTexto,
  chaveUsuarios,
  DIAS_LAPIDE_EU,
  DIAS_LAPIDE_UNIDADE,
  LIMITES,
} from "../src/modelo/constantes";
import { baseDoEscopo, chaveEscopo, chaveMeta, escoposDaUnidade, prefixoDe, rotuloDaVis } from "../src/modelo/escopo";
import type { Escopo } from "../src/modelo/tipos";
import { checar, secao } from "./util";

export function verificarEscopo(): void {
  secao("projetos: escopo e chaves de armazenamento");
  const un: Escopo = { host: "sei.x.gov.br", login: " Ana.Lima ", unidade: "110", vis: "unidade" };
  const eu: Escopo = { ...un, vis: "eu" };
  checar("chave do escopo da unidade (login em minusculas)", chaveEscopo(un) === "sei.x.gov.br|ana.lima|u:110/un");
  checar("chave do escopo so eu", chaveEscopo(eu) === "sei.x.gov.br|ana.lima|u:110/eu");
  checar("base com barra final", baseDoEscopo(un) === "projetos/sei.x.gov.br|ana.lima|u:110/un/");
  checar("prefixo de etapas", prefixoDe(un, "e") === "projetos/sei.x.gov.br|ana.lima|u:110/un/e/");
  checar("chave da meta", chaveMeta(eu) === "projetos/sei.x.gov.br|ana.lima|u:110/eu/meta");
  const dois = escoposDaUnidade("sei.x.gov.br", "ANA", "110");
  checar("os dois escopos da unidade", dois.unidade.vis === "unidade" && dois.eu.vis === "eu" && dois.eu.login === "ana");
  checar("rotulos", rotuloDaVis("unidade") === "Toda a unidade" && rotuloDaVis("eu") === "Só eu");
  checar("preferencias", CHAVE_PREFERENCIAS === "projetos/preferencias");
  checar("sync do Texto Padrao por escopo", chaveSyncTexto(chaveEscopo(un)) === "projetos/sync/tp/sei.x.gov.br|ana.lima|u:110/un");
  checar("sync do arquivo por login", chaveSyncArquivo("sei.x.gov.br", "ANA") === "projetos/sync/arquivo/sei.x.gov.br|ana");
  checar("cache de usuarios por unidade", chaveUsuarios("sei.x.gov.br", "110") === "projetos/usuarios/sei.x.gov.br|u:110");
  checar("mapa da importacao", chaveImportacao("sei.x.gov.br", "Ana") === "projetos/importacao/sei.x.gov.br|ana");
  checar("lapides: 180 dias na unidade, 90 no so eu", DIAS_LAPIDE_UNIDADE === 180 && DIAS_LAPIDE_EU === 90);
  checar(
    "limites da spec 5.4",
    LIMITES.nome === 200 &&
      LIMITES.checklistItens === 50 &&
      LIMITES.checklistTexto === 200 &&
      LIMITES.etiquetas === 10 &&
      LIMITES.etiquetaTexto === 40 &&
      LIMITES.observacoes === 2000 &&
      LIMITES.projetosAtivos === 100 &&
      LIMITES.etapasPorProjeto === 300 &&
      LIMITES.historico === 300 &&
      LIMITES.modelos === 50,
  );
}
