import { lerCsv } from "../src/modelo/csv";
import { checar, igual, secao } from "./util";

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

export function verificarCsv(): void {
  secao("lerCsv");
  const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8("nome;município\nJosé;Brasília\n")]);
  const a = lerCsv(bom);
  igual("utf-8 com BOM: colunas", a.colunas, ["nome", "município"]);
  igual("utf-8 com BOM: registros", a.registros, [{ nome: "José", município: "Brasília" }]);
  igual("utf-8 codificação", a.codificacao, "utf-8");

  const w = lerCsv(new Uint8Array([...utf8("nome\nJos"), 0xe9, 0x0a]));
  igual("windows-1252: valor", w.registros[0]?.nome, "José");
  igual("windows-1252: codificação", w.codificacao, "windows-1252");

  const q = lerCsv(utf8('a;b\n"linha1\nlinha2";x\n"diz ""oi""";y\n'));
  igual("quebra dentro de aspas", q.registros[0]?.a, "linha1\nlinha2");
  igual("aspas duplas escapadas", q.registros[1]?.a, 'diz "oi"');
  igual("duas linhas apenas", q.registros.length, 2);

  igual("separador vírgula", lerCsv(utf8("a,b\n1,2\n")).registros, [{ a: "1", b: "2" }]);
  igual("separador tab", lerCsv(utf8("a\tb\n1\t2\n")).registros, [{ a: "1", b: "2" }]);
  igual("separador fora de aspas na 1a linha", lerCsv(utf8('"a,x";b\n1;2\n')).colunas, ["a,x", "b"]);

  const v = lerCsv(utf8("a;b\n1;2\n\n;;\n3;4\n"));
  igual("linhas vazias e só de ;; não viram registro", v.registros.length, 2);
  igual("CRLF", lerCsv(utf8("a;b\r\n1;2\r\n")).registros, [{ a: "1", b: "2" }]);

  const r = lerCsv(utf8("a;;a;b\n1;2;3;4\n"));
  igual("cabeçalho vazio descartado e repetido sufixado", r.colunas, ["a", "a (2)", "b"]);
  igual("valores seguem as colunas", r.registros[0], { a: "1", "a (2)": "3", b: "4" });
  igual("trim só nos cabeçalhos", lerCsv(utf8(" a ; b \n  x ;y\n")).registros[0], { a: "  x ", b: "y" });

  const vazio = lerCsv(new Uint8Array());
  checar("arquivo vazio", vazio.colunas.length === 0 && vazio.registros.length === 0, vazio);

  secao("lerCsv: cabeçalho repetido, UTF-16 e aspas não fechadas");
  const s1 = lerCsv(utf8("a;a (2);a\n1;2;3\n"));
  igual("sufixo não colide com cabeçalho real (a;a (2);a)", s1.colunas, ["a", "a (2)", "a (3)"]);
  igual("valores do sufixo livre", s1.registros[0], { a: "1", "a (2)": "2", "a (3)": "3" });
  const s2 = lerCsv(utf8("a;a;a (2)\n1;2;3\n"));
  igual("cabeçalho real adiante fica com o próprio nome (a;a;a (2))", s2.colunas, ["a", "a (3)", "a (2)"]);
  igual("valores sem perda", s2.registros[0], { a: "1", "a (3)": "2", "a (2)": "3" });
  igual("real repetido também sufixa (a (2);a (2))", lerCsv(utf8("a (2);a (2)\n1;2\n")).colunas, ["a (2)", "a (2) (2)"]);

  const texto16 = "nome;município\nJosé;Brasília\n";
  const le = new Uint8Array(2 + texto16.length * 2);
  const be = new Uint8Array(2 + texto16.length * 2);
  le.set([0xff, 0xfe]);
  be.set([0xfe, 0xff]);
  for (let i = 0; i < texto16.length; i++) {
    const c = texto16.charCodeAt(i);
    le[2 + i * 2] = c & 0xff;
    le[3 + i * 2] = c >> 8;
    be[2 + i * 2] = c >> 8;
    be[3 + i * 2] = c & 0xff;
  }
  const l16 = lerCsv(le);
  igual("utf-16le com BOM: codificação", l16.codificacao, "utf-16le");
  igual("utf-16le com BOM: colunas (sem BOM)", l16.colunas, ["nome", "município"]);
  igual("utf-16le com BOM: registros", l16.registros, [{ nome: "José", município: "Brasília" }]);
  const b16 = lerCsv(be);
  igual("utf-16be com BOM: codificação", b16.codificacao, "utf-16be");
  igual("utf-16be com BOM: registros", b16.registros, [{ nome: "José", município: "Brasília" }]);

  igual("sem avisos num CSV normal", lerCsv(utf8("a;b\n1;2\n")).avisos, []);
  igual("arquivo vazio: sem avisos", vazio.avisos, []);
  const aberto = lerCsv(utf8('a;b\n1;2\n"3;4\n5;6\n'));
  igual("aspas não fechadas: aviso com a linha onde abriu", aberto.avisos, [
    "Aspas não fechadas na linha 3: o resto do arquivo foi lido como uma célula só. Confira a planilha.",
  ]);
  igual("aspas fechadas em várias linhas não avisam", lerCsv(utf8('a;b\n"x\ny";2\n')).avisos, []);
}
