import { extrairProtocolos } from "../src/texto/protocolos";
import { checar, secao } from "./util";

export function verificarProtocolos(): void {
  secao("extrair protocolos de texto livre");
  const so = (t: string) => extrairProtocolos(t).map((p) => `${p.tipo}:${p.texto}`);

  checar(
    "processo no formato federal",
    JSON.stringify(extrairProtocolos("08027.000123/2026-10")) === JSON.stringify([{ texto: "08027.000123/2026-10", tipo: "processo" }]),
  );
  checar("processo no formato de SP", so("99906.713-630.000005/2026-91").join() === "processo:99906.713-630.000005/2026-91");

  const misto = so("Veja o SEI 12345678 e o processo 50300.018905/2018-67, depois o 12345678 de novo.");
  checar("misto: ordem de aparicao e sem repeticao", misto.join("|") === "sei:12345678|processo:50300.018905/2018-67", misto);

  checar(
    "telefone, CNPJ e data nao sao no SEI",
    extrairProtocolos("Ligue 61 99999-1234, CNPJ 12.345.678/0001-90, dia 16/10/2026").length === 0,
  );

  checar("linha solta curta sem espaco vira outro", so("Contrato-77").join() === "outro:Contrato-77");
  checar("linha com espacos e sem padrao e ignorada", extrairProtocolos("isto e uma frase qualquer").length === 0);
  checar("linha longa sem padrao e ignorada", extrairProtocolos("A".repeat(41)).length === 0);
  checar("linha de 40 caracteres ainda vale", extrairProtocolos("A".repeat(40)).length === 1);

  const zeros = so("00123456\n123456\n00123456");
  checar("zeros a esquerda nao unificam", zeros.join("|") === "sei:00123456|sei:123456", zeros);
  const caixa = so("abc\nABC");
  checar("caixa nao unifica", caixa.join("|") === "outro:abc|outro:ABC", caixa);

  const linhas = so("12345678\nContrato-77\n50300.018905/2018-67");
  checar("varias linhas em ordem", linhas.join("|") === "sei:12345678|outro:Contrato-77|processo:50300.018905/2018-67", linhas);
  checar("sem nº SEI dentro de processo", so("50300.018905/2018-67").length === 1);

  secao("protocolos: prefixo de 3 digitos e ponto final");
  const tres = so("026.00000052/2023-47 e 012.00000213/2025-12");
  checar("processo com prefixo de 3 digitos", tres.join("|") === "processo:026.00000052/2023-47|processo:012.00000213/2025-12", tres);
  checar("CNPJ continua fora com o prefixo de 3 digitos", so("CNPJ 12.345.678/0001-90").length === 0, so("CNPJ 12.345.678/0001-90"));
  const semPadrao = (t: string) => extrairProtocolos(t).filter((p) => p.tipo !== "outro");
  checar("CNPJ colado a uma letra continua fora", semPadrao("x12.345.678/0001-90").length === 0, so("x12.345.678/0001-90"));
  const fim = so("ver o documento 12345678.");
  checar("nº SEI com ponto final de frase", fim.join() === "sei:12345678", fim);
  const meio = so("o 12345678. Depois o 87654321.");
  checar("ponto final seguido de espaco", meio.join("|") === "sei:12345678|sei:87654321", meio);
  checar("ponto seguido de digito nao e ponto final", semPadrao("12345678.9").length === 0, so("12345678.9"));
  checar("ponto seguido de barra ou hifen nao e ponto final", semPadrao("12345678./x 12345678.-1").length === 0);
}
