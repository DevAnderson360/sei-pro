import { contarConvertidas, paraLatin1 } from "../src/texto/latin1";
import { checar, secao } from "./util";

/** Compara por valor (JSON), como o `igual` dos testes do processos-lote. */
function igual(nome: string, obtido: unknown, esperado: unknown): void {
  checar(nome, JSON.stringify(obtido) === JSON.stringify(esperado), { obtido, esperado });
}

export function verificarLatin1(): void {
  secao("latin1");
  igual("travessao e aspas curvas", paraLatin1("Contrato — “teste” 1"), 'Contrato - "teste" 1');
  igual("nbsp vira espaco comum", paraLatin1("a b"), "a b");
  igual("acento latin-1 preservado", paraLatin1("Ação"), "Ação");
  igual("NFC antes de tudo", paraLatin1("á"), "á");
  igual("reticencias e euro", paraLatin1("x… 5€"), "x... 5EUR");
  igual("zero-width some", paraLatin1("a​b﻿c"), "abc");
  igual("fora do latin-1 tira acento", paraLatin1("ą"), "a");
  igual("sem base latin-1 some", paraLatin1("a中b"), "ab");
  igual("null vira vazio", paraLatin1(null as unknown as string), "");
  igual("contarConvertidas so as alteradas", contarConvertidas(["ok", "a — b", "Ação", "“x”"]), 2);
}
