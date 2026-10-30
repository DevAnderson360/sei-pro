import { ATRIBUTO_ATIVO, CANAL_LINK_PERMANENTE, CHAVE_ENTRADA, EVENTO_ABRIR } from "@lp/modelo/constantes";
import { montarLink } from "@lp/modelo/link";
import { checar, secao } from "./util";

export function verificarModelo(): void {
  secao("Modelo: constantes");
  checar("evento", EVENTO_ABRIR === "spro-link-permanente-abrir");
  checar("atributo", ATRIBUTO_ATIVO === "data-seipro-link-permanente");
  checar("canal", CANAL_LINK_PERMANENTE === "seipro-link-permanente");
  checar("chave de entrada", CHAVE_ENTRADA === "link-permanente/entrada");

  secao("Modelo: montarLink");
  const base = "https://sei.x.gov.br/sei/controlador.php?acao=procedimento_controlar&infra_hash=abc123&infra_sistema=100000100";
  const alvo = "https://sei.x.gov.br/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=123";
  checar("so processo", montarLink(base, "123") === alvo, montarLink(base, "123"));
  checar("com documento", montarLink(base, "123", "456") === `${alvo}&id_documento=456`);
  checar("documento vazio e ignorado", montarLink(base, "123", "") === alvo);
  checar("nunca infra_hash", !montarLink(base, "123", "456").includes("infra_hash"));
  checar("remove hash da URL", montarLink(`${base}#ancora`, "1") === alvo.replace("123", "1"));
  checar("base terminada em /sei/", montarLink("https://sei.x.gov.br/sei/", "123") === alvo);
  checar("base sem barra final em /sei", montarLink("https://sei.x.gov.br/sei", "123") === alvo);
  checar("base so com controlador.php", montarLink("https://sei.x.gov.br/sei/controlador.php", "123") === alvo);
  checar(
    "base terminada em controlador.php/",
    montarLink("https://sei.x.gov.br/sei/controlador.php/", "123") === alvo,
    montarLink("https://sei.x.gov.br/sei/controlador.php/", "123"),
  );
  checar(
    "base so com a origem",
    montarLink("https://sei.x.gov.br/", "123") === "https://sei.x.gov.br/controlador.php?acao=procedimento_trabalhar&id_procedimento=123",
  );
  checar(
    "subcaminho preservado",
    montarLink("https://h.gov.br/app/sei/controlador.php?x=1", "9") ===
      "https://h.gov.br/app/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=9",
  );
  checar("ids sao codificados", montarLink(base, "1&2") === alvo.replace("123", "1%262"));
}
