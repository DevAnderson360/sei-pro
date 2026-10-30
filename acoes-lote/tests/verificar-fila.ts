/** Fila de etapas: validação, plano por documento, registro e próxima etapa. */

import { type LinhaDoc, MOTIVO_SIGILOSO } from "../src/modelo/documentos";
import { type ParamsEtapa, planejar, proximaEtapa, registrar, validarFila } from "../src/modelo/fila";
import { checar, igual, secao } from "./util";

function linha(o: Partial<LinhaDoc> & { id: string }): LinhaDoc {
  return {
    numero: o.id,
    titulo: "Despacho 1",
    tipo: "Despacho",
    externo: false,
    formato: "interno",
    nivel: "publico",
    assinado: false,
    assinaturas: [],
    cancelado: false,
    unidade: "ABC",
    pasta: null,
    ...o,
  };
}

const ciencia: ParamsEtapa = { acao: "ciencia" };
const assinar: ParamsEtapa = { acao: "assinar", cargo: "Diretor" };
const cancAss: ParamsEtapa = { acao: "cancelar-assinatura" };
const alterarNivel: ParamsEtapa = { acao: "alterar-nivel", nivel: "publico" };

export function verificarFila(): void {
  secao("Fila: validação");
  igual("fila vazia", validarFila([]), ["Escolha ao menos uma ação."]);
  igual("fila válida", validarFila([ciencia, assinar, { acao: "excluir" }]), []);
  igual("ação repetida", validarFila([ciencia, ciencia]), ["A ação Dar ciência aparece duas vezes."]);
  igual("final fora do fim", validarFila([{ acao: "excluir" }, ciencia]), ["Excluir precisa ser a última etapa."]);
  igual(
    "final no fim é válida",
    validarFila([ciencia, { acao: "mover", destino: { protocolo: "1", idProcedimento: "2", tipo: "T" }, motivo: "x" }]),
    [],
  );
  igual(
    "baixar e pdf",
    validarFila([{ acao: "baixar", modo: "zip" }, { acao: "pdf" }]).includes("Escolha baixar ou PDF, não os dois."),
    true,
  );
  igual("nível e dados", validarFila([alterarNivel, { acao: "alterar-dados", descricao: "x" }]), [
    "Use só Alterar dados para mudar o nível junto com outros campos.",
  ]);
  igual("restrito sem hipótese", validarFila([{ acao: "alterar-nivel", nivel: "restrito" }]), ["Nível restrito exige hipótese legal."]);
  igual("restrito com hipótese", validarFila([{ acao: "alterar-nivel", nivel: "restrito", hipotese: "12" }]), []);
  igual("restrito sem hipótese em alterar-dados", validarFila([{ acao: "alterar-dados", nivel: "restrito" }]), [
    "Nível restrito exige hipótese legal.",
  ]);
  igual("cancelar sem motivo", validarFila([{ acao: "cancelar-documento", motivo: "  " }]), ["Informe o motivo do cancelamento."]);
  igual("mover sem motivo", validarFila([{ acao: "mover", destino: { protocolo: "1", idProcedimento: "2", tipo: "T" }, motivo: "" }]), [
    "Informe o motivo da movimentação.",
  ]);
  igual("assinar sem cargo", validarFila([{ acao: "assinar", cargo: "" }]), ["Escolha o cargo da assinatura."]);
  igual("alterar-dados vazio", validarFila([{ acao: "alterar-dados" }]), ["Nada para alterar."]);
  igual("alterar-dados com lista vazia", validarFila([{ acao: "alterar-dados", interessados: { modo: "acrescentar", itens: [] } }]), [
    "Nada para alterar.",
  ]);
  for (const v of ["", "  "]) {
    igual(`descrição em branco (${JSON.stringify(v)}) mantém o atual`, validarFila([{ acao: "alterar-dados", descricao: v }]), [
      "Nada para alterar.",
    ]);
    igual(`observação em branco (${JSON.stringify(v)}) mantém o atual`, validarFila([{ acao: "alterar-dados", observacao: v }]), [
      "Nada para alterar.",
    ]);
  }
  igual("alterar-dados com observação", validarFila([{ acao: "alterar-dados", observacao: "x" }]), []);

  secao("Fila: plano por documento");
  const cancelado = linha({ id: "1", cancelado: true });
  const p1 = planejar([cancelado], [alterarNivel, assinar], false);
  igual(
    "cancelado: as duas etapas puladas",
    p1[0]?.etapas.map((e) => e.situacao),
    ["pulado", "pulado"],
  );
  igual("motivo da primeira", p1[0]?.etapas[0]?.mensagem, "Documento cancelado");
  igual("seguinte: etapa anterior", p1[0]?.etapas[1]?.mensagem, "Etapa anterior não concluída");

  const p2 = planejar([linha({ id: "2" })], [ciencia, alterarNivel], false);
  igual(
    "elegível: pendentes",
    p2[0]?.etapas.map((e) => e.situacao),
    ["pendente", "pendente"],
  );
  igual(
    "etapas na ordem da fila",
    p2[0]?.etapas.map((e) => e.acao),
    ["ciencia", "alterar-nivel"],
  );

  const p3 = planejar([linha({ id: "3" })], [ciencia], true);
  igual("processo sigiloso", p3[0]?.etapas[0]?.mensagem, MOTIVO_SIGILOSO);

  const p4 = planejar([linha({ id: "4", assinado: false })], [assinar, cancAss], false);
  igual(
    "assinar antes de cancelar-assinatura",
    p4[0]?.etapas.map((e) => e.situacao),
    ["pendente", "pendente"],
  );
  const p5 = planejar([linha({ id: "5", assinado: false })], [cancAss], false);
  igual("sem assinar antes: pulado", p5[0]?.etapas[0]?.situacao, "pulado");
  const p6 = planejar([linha({ id: "6", assinado: true })], [cancAss, cancAss], false);
  igual(
    "cancelar-assinatura limpa o assinado: a segunda é pulada",
    p6[0]?.etapas.map((e) => e.situacao),
    ["pendente", "pulado"],
  );
  const p7 = planejar([linha({ id: "7", assinado: true })], [cancAss, ciencia], false);
  igual("plano guarda o documento original, sem os efeitos", p7[0]?.doc.assinado, true);
  const p7b = planejar([linha({ id: "7b", nivel: "restrito" })], [alterarNivel, ciencia], false);
  igual("alterar-nivel não altera o doc do plano", p7b[0]?.doc.nivel, "restrito");

  const sel = [linha({ id: "a" }), linha({ id: "b", nivel: "sigiloso" })];
  const p8 = planejar(sel, [ciencia], false);
  igual(
    "um plano por documento, mesma ordem",
    p8.map((p) => p.doc.id),
    ["a", "b"],
  );
  igual("sigiloso do documento", p8[1]?.etapas[0]?.situacao, "pulado");

  secao("Fila: registrar e próxima etapa");
  const base = planejar([linha({ id: "9" })], [ciencia, assinar, { acao: "duplicar" }], false)[0]!;
  igual("próxima é a 0", proximaEtapa(base), 0);
  const ok = registrar(base, 0, { situacao: "ok", dados: { x: "1" } });
  igual("após ok, próxima é a 1", proximaEtapa(ok), 1);
  igual("dados gravados", ok.etapas[0]?.dados, { x: "1" });
  checar("imutável", base.etapas[0]?.situacao === "pendente" && ok !== base);
  const erro = registrar(base, 0, { situacao: "erro", mensagem: "falhou" });
  igual("erro: mensagem", erro.etapas[0]?.mensagem, "falhou");
  igual(
    "erro: seguintes puladas",
    erro.etapas.slice(1).map((e) => e.situacao),
    ["pulado", "pulado"],
  );
  igual("erro: motivo", erro.etapas[1]?.mensagem, "Etapa anterior não concluída");
  igual("erro: sem próxima", proximaEtapa(erro), null);
  const pul = registrar(ok, 1, { situacao: "pulado", mensagem: "motivo" });
  igual("pulado: seguinte pulada", pul.etapas[2]?.situacao, "pulado");
  const inc = registrar(base, 0, { situacao: "incerto", mensagem: "talvez" });
  igual(
    "incerto não propaga",
    inc.etapas.slice(1).map((e) => e.situacao),
    ["pendente", "pendente"],
  );
  const tudo = registrar(registrar(registrar(base, 0, { situacao: "ok" }), 1, { situacao: "ok" }), 2, { situacao: "ok" });
  igual("tudo ok: null", proximaEtapa(tudo), null);
  const jaOk = registrar(ok, 1, { situacao: "erro", mensagem: "e" });
  igual("erro não mexe nas anteriores", jaOk.etapas[0]?.situacao, "ok");
}
