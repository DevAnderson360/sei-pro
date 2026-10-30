import { descricaoDoc, escaparValor, extrairCampos, preencherTexto } from "../src/modelo/campos";
import { nomeNaArvore } from "../src/modelo/nomes";
import { checar, igual, secao } from "./util";

export function verificarCampos(): void {
  secao("campos e nomes");
  igual("extrairCampos únicos na ordem", extrairCampos("<p>##nome## e ##município##, ##nome##</p>"), ["nome", "município"]);
  igual("extrairCampos com nbsp", extrairCampos("##a b##"), ["a b"]);
  igual("extrairCampos ignora ####", extrairCampos("a #### b"), []);
  igual("preencherTexto deixa o que não tem coluna", preencherTexto("Oi ##nome## ##x##", { nome: "A" }), "Oi A ##x##");
  igual("preencherTexto escapa", preencherTexto("##v##", { v: 'a<b & "c"' }, escaparValor), "a&lt;b &amp; &quot;c&quot;");
  igual("escaparValor mantém acento e aspas simples", escaparValor("é'"), "é&#39;");

  const nome = nomeNaArvore("Ofício nº 1ª — José");
  checar("nome sem acento, mantém nº e ª", nome.startsWith("Oficio nº 1ª"), nome);
  checar("nome sem travessão", !nome.includes("—"), nome);
  igual("nome corta em 50", nomeNaArvore("x".repeat(80)).length, 50);
  igual("nome faz trim após o corte", nomeNaArvore(`${"x".repeat(49)} yyy`), "x".repeat(49));

  const d = descricaoDoc("Termo - ##nome## ##u##", { nome: "José", u: "A—B" });
  checar("descrição mantém José", d.includes("José"), d);
  checar("descrição troca travessão", d.includes("A-B") && !d.includes("—"), d);
  igual("descrição corta em 250", descricaoDoc("##a##", { a: "y".repeat(300) }).length, 250);
}
