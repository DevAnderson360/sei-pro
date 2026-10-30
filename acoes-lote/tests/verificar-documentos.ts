/** Modelo dos documentos: linhas da árvore, elegibilidade, filtros, atalhos e contagem por ação. */

import { lerArvore } from "@nucleo/dominio/arvore";
import { fixture } from "../../sei-nucleo/tests/util";
import { ACOES, type AcaoId } from "../src/modelo/acoes";
import { contarPorAcao, elegivel, type LinhaDoc, linhasDaArvore, tiposDosTitulos } from "../src/modelo/documentos";
import { aplicarAtalho, filtrar } from "../src/modelo/filtros";
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

export function verificarDocumentos(): void {
  secao("Documentos: linhas da árvore");
  const arv = lerArvore(fixture("sei41/arvore_completa.html"));
  const linhas = linhasDaArvore(arv);
  igual("mesma contagem da árvore", linhas.length, arv.documentos.length);
  checar("há documentos", linhas.length === 43, linhas.length);
  const desp = linhas.find((l) => l.numero === "0103947");
  igual("tipo sem o número final", desp?.tipo, "Despacho");
  igual(
    "ids preservados",
    linhas.map((l) => l.id),
    arv.documentos.map((d) => d.id),
  );
  checar("externo e formato", linhas.find((l) => l.numero === "0103950")?.externo === true);
  checar(
    "data fica indefinida",
    linhas.every((l) => l.data === undefined),
  );

  secao("Documentos: tipo tirado do título (a árvore não traz a série)");
  {
    const titulos = [
      "Despacho 0103947",
      "Despacho Maria Souza",
      "Abaixo-Assinado Anexo Documentos da vistoria",
      "Boletim 4444 sdgsdg",
      "Autorização 01 para assinatura de contrato",
      "Laudo teste B1.3",
      "Vídeo",
      "Ofício 12/2026",
      "Ofício Circular",
    ];
    igual("tipos de títulos reais do SEI SP", tiposDosTitulos(titulos), [
      "Despacho",
      "Despacho",
      "Abaixo-Assinado",
      "Boletim",
      "Autorização",
      "Laudo teste",
      "Vídeo",
      "Ofício",
      "Ofício",
    ]);
    igual("prefixo por palavra, não por letra", tiposDosTitulos(["Ata 3", "Atas Diversas"]), ["Ata", "Atas"]);
    igual("o maior tipo conhecido ganha", tiposDosTitulos(["Nota 1", "Nota Técnica 2", "Nota Técnica Conjunta"]), [
      "Nota",
      "Nota Técnica",
      "Nota Técnica",
    ]);
    const linhasSp = linhasDaArvore({
      ...arv,
      documentos: arv.documentos.slice(0, 2).map((d, i) => ({ ...d, titulo: ["Despacho 5", "Despacho Maria Souza"][i]! })),
    });
    igual(
      "linhasDaArvore usa a passada sobre todas as linhas",
      linhasSp.map((l) => l.tipo),
      ["Despacho", "Despacho"],
    );
  }

  secao("Documentos: definição das ações");
  igual(
    "ordem da spec",
    ACOES.map((a) => a.id),
    [
      "ciencia",
      "excluir",
      "cancelar-assinatura",
      "baixar",
      "alterar-nivel",
      "assinar",
      "duplicar",
      "cancelar-documento",
      "incluir-bloco",
      "alterar-dados",
      "mover",
      "pdf",
    ],
  );
  const com = (k: "final" | "confirmar") => ACOES.filter((a) => a[k]).map((a) => a.id);
  igual("finais", com("final"), ["excluir", "baixar", "cancelar-documento", "mover", "pdf"]);
  igual("com confirmação", com("confirmar"), ["excluir", "cancelar-assinatura", "cancelar-documento", "mover"]);

  secao("Documentos: elegibilidade");
  const canc = linha({ id: "1", cancelado: true });
  igual("excluir cancelado", elegivel("excluir", canc, false), { ok: false, motivo: "Documento cancelado" });
  igual("baixar cancelado", elegivel("baixar", canc, false), { ok: true });
  const sig = "Sigiloso: fora das Ações em Lote";
  const todas = ACOES.map((a) => a.id);
  checar(
    "documento sigiloso: toda ação",
    todas.every((a) => {
      const e = elegivel(a, linha({ id: "2", nivel: "sigiloso" }), false);
      return !e.ok && e.motivo === sig;
    }),
  );
  checar(
    "processo sigiloso: toda ação",
    todas.every((a) => {
      const e = elegivel(a, linha({ id: "3" }), true);
      return !e.ok && e.motivo === sig;
    }),
  );
  igual("sigiloso vem antes de cancelado", elegivel("excluir", linha({ id: "4", nivel: "sigiloso", cancelado: true }), false), {
    ok: false,
    motivo: sig,
  });
  igual("duplicar externo", elegivel("duplicar", linha({ id: "5", externo: true }), false), {
    ok: false,
    motivo: "Só documento interno pode ser duplicado",
  });
  igual("duplicar interno", elegivel("duplicar", linha({ id: "6" }), false), { ok: true });
  igual("cancelar assinatura sem assinatura", elegivel("cancelar-assinatura", linha({ id: "7" }), false), {
    ok: false,
    motivo: "Documento sem assinatura",
  });
  igual("cancelar assinatura assinado", elegivel("cancelar-assinatura", linha({ id: "8", assinado: true }), false), { ok: true });
  igual("assinar externo", elegivel("assinar", linha({ id: "9", externo: true }), false), {
    ok: false,
    motivo: "Documento externo não se assina no SEI",
  });

  secao("Documentos: filtros");
  const base = [
    linha({
      id: "a",
      numero: "0001",
      titulo: "Ofício 3",
      tipo: "Ofício",
      unidade: "ABC",
      assinado: true,
      assinaturas: ["João da Silva - Analista - ABC"],
      data: "2026-01-10",
    }),
    linha({ id: "b", numero: "0002", titulo: "Despacho 4", tipo: "Despacho", unidade: "XYZ", nivel: "restrito", data: "2026-02-10" }),
    linha({ id: "c", numero: "0003", titulo: "Laudo", tipo: "Laudo", unidade: "ABC", externo: true, formato: "pdf", data: "2026-03-10" }),
    linha({ id: "d", numero: "0004", titulo: "Parecer 9", tipo: "Parecer", unidade: "abc" }),
  ];
  const ids = (f: Parameters<typeof filtrar>[1]) => filtrar(base, f).map((l) => l.id);
  igual("sem filtro", ids({}), ["a", "b", "c", "d"]);
  igual("texto sem acento nem caixa", ids({ texto: "OFICIO" }), ["a"]);
  igual("texto pelo número", ids({ texto: "0003" }), ["c"]);
  igual("tipos", ids({ tipos: ["Despacho", "Laudo"] }), ["b", "c"]);
  igual("unidades sem caixa", ids({ unidades: ["ABC"] }), ["a", "c", "d"]);
  igual("assinados", ids({ assinatura: "assinados" }), ["a"]);
  igual("não assinados", ids({ assinatura: "nao-assinados" }), ["b", "c", "d"]);
  igual("restrito", ids({ nivel: "restrito" }), ["b"]);
  igual("público", ids({ nivel: "publico" }), ["a", "c", "d"]);
  igual("internos", ids({ origem: "internos" }), ["a", "b", "d"]);
  igual("externos", ids({ origem: "externos" }), ["c"]);
  igual("período de/até", ids({ de: "2026-02-01", ate: "2026-03-10" }), ["b", "c"]);
  igual("período exclui quem não tem data", ids({ de: "2000-01-01" }), ["a", "b", "c"]);
  igual("filtros combinados", ids({ unidades: ["abc"], origem: "internos", assinatura: "nao-assinados" }), ["d"]);

  secao("Documentos: atalhos");
  const ctx = { unidadeSigla: "abc", nomeUsuario: "JOAO da Silva" };
  igual("não assinados da minha unidade", aplicarAtalho("nao-assinados-minha-unidade", base, ctx), ["d"]);
  igual("assinados por mim (sem acento e caixa)", aplicarAtalho("assinados-por-mim", base, ctx), ["a"]);
  igual("externos", aplicarAtalho("externos", base, ctx), ["c"]);
  igual("sem nome não casa ninguém", aplicarAtalho("assinados-por-mim", base, { unidadeSigla: "abc", nomeUsuario: "" }), []);
  const homonimos = [
    linha({ id: "m", assinado: true, assinaturas: ["Mariana Silva - Analista - ABC"] }),
    linha({ id: "n", assinado: true, assinaturas: ["Ana Silva - Analista - ABC"] }),
    linha({ id: "o", assinado: true, assinaturas: ["Outra Pessoa - Chefe - ABC", "ANA SILVA"] }),
  ];
  igual(
    "nome contido em outro não casa",
    aplicarAtalho("assinados-por-mim", homonimos, { unidadeSigla: "abc", nomeUsuario: "Ana Silva" }),
    ["n", "o"],
  );

  secao("Documentos: contagem por ação");
  const sel = [...base, linha({ id: "e", nivel: "sigiloso" }), linha({ id: "f", cancelado: true, assinado: true })];
  const cont = contarPorAcao(sel, false);
  checar(
    "bate com a soma de elegivel",
    todas.every((a: AcaoId) => cont[a] === sel.filter((l) => elegivel(a, l, false).ok).length),
    cont,
  );
  igual("excluir não conta sigiloso nem cancelado", cont.excluir, 4);
  igual("baixar conta cancelado", cont.baixar, 5);
  igual(
    "processo sigiloso zera tudo",
    Object.values(contarPorAcao(sel, true)).every((n) => n === 0),
    true,
  );
}
