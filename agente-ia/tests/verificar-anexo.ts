/**
 * Anexo de PDF (e de texto) no chat: quais páginas vão ao OCR, como o texto é
 * montado e quando ele é cortado.
 *
 * O que não pode escapar: o OCR nunca passa do teto da biblioteca, o aviso de
 * lentidão conta só as páginas digitalizadas, e o corte acontece no fim de uma
 * página dizendo até onde o modelo leu — nunca em silêncio.
 */

import { aplicarModo, LIMITE_CORTE, mensagemDeErroPdf, montarTexto, planejarLeitura, temCamadaDeTexto, TETO_ANEXO } from "../src/painel/anexo";
import { checar, secao } from "./util";

export function verificarAnexo(): void {
  secao("Anexo: plano de leitura do PDF");
  const p = planejarLeitura(130, (n) => n <= 5); // 5 com texto, 125 digitalizadas
  checar("OCR só até a página 100", p.paraOcr.length === 95 && p.paraOcr[0] === 6 && p.paraOcr.at(-1) === 100, p.paraOcr.length);
  checar("páginas digitalizadas além do teto ficam fora", p.foraDoOcr.length === 30 && p.foraDoOcr[0] === 101);
  checar("páginas com texto listadas", p.comTexto.length === 5 && p.total === 130);
  checar("avisa com mais de 20 digitalizadas", p.avisar === true);
  checar("não avisa com 20 digitalizadas", planejarLeitura(25, (n) => n <= 5).avisar === false);
  checar("PDF digital de 200 páginas não avisa", planejarLeitura(200, () => true).avisar === false);

  secao("Anexo: montagem do texto");
  const t = montarTexto([{ n: 1, texto: "a" }, { n: 2, texto: "b", ocr: true }], { total: 4, naoLidas: [3, 4] });
  checar("marca a página do OCR", t.includes("[página 2 — OCR]") && t.includes("[página 1]\na"));
  checar("aviso de OCR no topo", t.startsWith("[texto de 1 página(s) obtido por OCR; pode conter erros de reconhecimento]"));
  checar("faixa de páginas não lidas", t.includes("[páginas não lidas: 3–4]"), t);
  const semOcr = montarTexto([{ n: 1, texto: "a" }], { total: 9, naoLidas: [2, 3, 4, 7, 9], semOcr: true });
  checar("sem OCR no navegador: diz o motivo", semOcr.includes("[páginas não lidas: 2–4, 7, 9 (este navegador não faz OCR)]"), semOcr);
  checar("só texto: sem aviso de OCR", !montarTexto([{ n: 1, texto: "a" }], { total: 1, naoLidas: [] }).includes("OCR"));

  secao("Anexo: inteiro ou cortado");
  const pagina = (n: number) => `[página ${n}]\n${"x".repeat(3000)}`;
  const longo = Array.from({ length: 50 }, (_, i) => pagina(i + 1)).join("\n\n");
  const c = aplicarModo({ nome: "a.pdf", texto: longo, paginas: 50, modo: "cortado" });
  // cada página ocupa 3.000 + o cabeçalho + "\n\n"; 19 páginas cabem em 60 mil, 20 não
  const cabem = longo.slice(0, LIMITE_CORTE).split("[página ").length - 2;
  checar("corta no fim da última página que cabe", c.texto.includes(`[o modelo leu até a página ${cabem} de 50]`) && !c.texto.includes(`[página ${cabem + 1}]`), { cabem, fim: c.texto.slice(-80) });
  checar("cortado não passa do limite", c.texto.length <= LIMITE_CORTE + 80);
  checar("cortado avisa", Boolean(c.aviso) && c.podeCortar === false);
  const inteiro = aplicarModo({ nome: "a.pdf", texto: longo, paginas: 50, modo: "inteiro" });
  checar("inteiro manda tudo e oferece cortar", inteiro.texto === longo && inteiro.podeCortar === true);
  checar(
    "aviso de tamanho com tokens",
    inteiro.aviso === `${Math.round(longo.length / 1000)} mil caracteres (cerca de ${Math.round(longo.length / 4000)} mil tokens): o texto vai junto em cada resposta desta conversa.`,
    inteiro.aviso,
  );
  checar("curto não oferece cortar", aplicarModo({ nome: "a.pdf", texto: "abc", modo: "inteiro" }).podeCortar === false);
  const enorme = aplicarModo({ nome: "a.txt", texto: "y".repeat(300_000), modo: "inteiro" });
  checar("teto duro mesmo inteiro", enorme.texto.length <= TETO_ANEXO + 80 && /200\.000 de 300\.000 caracteres/.test(enorme.texto), enorme.texto.slice(-90));
  const txt = aplicarModo({ nome: "a.txt", texto: "z".repeat(70_000), modo: "cortado" });
  checar("texto sem páginas corta no limite e diz os caracteres", txt.texto.startsWith("z".repeat(LIMITE_CORTE)) && /60\.000 de 70\.000 caracteres/.test(txt.texto));

  secao("Anexo: critério de camada de texto (o mesmo do ocrPdf)");
  checar("só o número da página não é camada de texto", temCamadaDeTexto([{ str: "3" }]) === false);
  checar("vazio não é camada", temCamadaDeTexto([{ str: "  " }, {}]) === false);
  checar("palavra de verdade é camada", temCamadaDeTexto([{ str: "3" }, { str: "Of\u00EDcio" }]) === true);
  const motivo = montarTexto([{ n: 1, texto: "a" }], { total: 3, naoLidas: [2, 3], motivo: "o OCR falhou neste navegador" });
  checar("falha do OCR: diz o motivo", motivo.includes("[p\u00E1ginas n\u00E3o lidas: 2\u20133 (o OCR falhou neste navegador)]"), motivo);

  secao("Anexo: erro do PDF");
  checar("senha", mensagemDeErroPdf({ name: "PasswordException" }) === "Este PDF é protegido por senha.");
  checar("cancelado", mensagemDeErroPdf({ name: "OperacaoCancelada" }) === "Leitura cancelada.");
  checar("outro", mensagemDeErroPdf(new Error("x")) === "Não foi possível ler este PDF (protegido por senha ou danificado).");
}
